import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = spawn(process.execPath, ['admin-control-center/server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '8143' }, stdio: 'pipe' });
let browser;
const report = language => ({ language, snapshotAt: '2026-10-26T10:00:00Z', text: language === 'fa' ? 'گزارش عملیاتی\nارزش مجموع: 300.75 افغانی' : 'Orders delivered: 2\nGross delivered order value: 300.75 AFN\n<script>unsafe()</script>', specialists: [
  { id: 'operations', name: 'Operations <img src=x>', state: 'recent_record', message: 'Recent stored activity; live operation remains unverified.', referenceAt: '2026-10-26T09:59:00Z' },
  { id: 'restaurant_maintenance', name: 'Restaurant listing quality', state: 'failed', message: 'Latest recorded outcome is failure.', referenceAt: null },
  { id: 'restaurant_discovery', name: 'Restaurant research', state: 'unavailable', message: 'Snapshot unavailable.', referenceAt: null },
] });
try {
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited: ${code}`))); });
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { sessionStorage.setItem('ae_control_center_token', 'test'); sessionStorage.setItem('ae_control_center_user', JSON.stringify({ id: 1, role: 'admin' })); });
  let mode = 'ok', pending, reads = 0, writes = 0;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  // No live backend, Google sign-in, providers or external requests in this suite.
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'afghaneats-api.onrender.com') return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() !== 'GET') writes++;
    const path = url.pathname.split('/').at(-1);
    let data = [];
    if (path === 'auth.me') data = { id: 1, role: 'admin' };
    if (path === 'aiManager.report') {
      reads++;
      assert.equal(req.method(), 'GET');
      assert.equal(req.headers().authorization, 'Bearer test');
      const lang = JSON.parse(url.searchParams.get('input')).json.language;
      if (mode === 'delay') { pending = { route, lang }; return; }
      if (mode === 'error') return route.fulfill({ headers, status: 404, json: { error: { json: { message: '<script>raw proxy details</script>' } } } });
      data = mode === 'malformed' ? {} : report(lang);
    }
    return route.fulfill({ headers, json: { result: { data: { json: data } } } });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8143/#manager');
  await page.locator('#manager-report-text').waitFor();
  assert.match(await page.locator('#manager-report-text').innerText(), /300.75 AFN/);
  assert.equal(await page.locator('.manager-specialist').count(), 3);
  assert.equal(await page.locator('.manager-page img, .manager-page script').count(), 0);
  assert.equal(await page.getByText('Review needed', { exact: true }).count(), 2);
  assert.match(await page.locator('.manager-page').innerText(), /live operation remains unverified/);
  assert.match(await page.locator('.manager-snapshot').innerText(), /14:30/);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `no overflow at ${width}`);
  }
  await page.locator('#manager-language').selectOption('fa');
  await page.locator('.manager-page[lang=fa][dir=rtl]').waitFor();
  assert.match(await page.locator('#manager-report-text').innerText(), /300.75 افغانی/);
  await page.locator('[data-manager-refresh]').focus();
  const beforeRefresh = reads;
  await page.keyboard.press('Enter');
  await page.locator('#manager-report-text').waitFor();
  assert.ok(reads > beforeRefresh, 'keyboard refresh works');
  mode = 'error';
  await page.locator('[data-manager-refresh]').click();
  await page.locator('.manager-page [role=alert]').waitFor();
  assert.equal(await page.locator('#manager-report-text').count(), 0, 'failed refresh clears old private report');
  assert.equal(await page.getByText('raw proxy details', { exact: false }).count(), 0);
  mode = 'malformed';
  await page.locator('[data-manager-refresh]').click();
  await page.locator('.manager-page [role=alert]').waitFor();
  assert.equal(await page.locator('#manager-report-text').count(), 0, 'malformed responses are not zero reports');
  mode = 'ok';
  await page.locator('[data-manager-refresh]').click();
  await page.locator('#manager-report-text').waitFor();
  mode = 'delay';
  await page.locator('[data-manager-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.loading-panel'));
  while (!pending) await new Promise(resolve => setTimeout(resolve, 20));
  await page.evaluate(() => logout(false));
  await pending.route.fulfill({ headers, json: { result: { data: { json: report(pending.lang) } } } });
  await page.waitForFunction(() => !renderBusy);
  assert.equal(await page.locator('.manager-page').count(), 0, 'late response cannot restore report after logout');
  const beforeStaff = reads;
  await page.evaluate(() => { saveSession('staff', { id: 2, role: 'restaurant_staff' }); setShell(); setView('manager'); });
  await page.waitForFunction(() => !renderBusy);
  assert.equal(await page.locator('[data-view=manager]').isVisible(), false);
  assert.equal(reads, beforeStaff, 'restricted staff cannot fetch report through navigation');
  assert.equal(writes, 0, 'dashboard never mutates');
  assert.deepEqual(errors, []);
  console.log('PASS manager dashboard: English/Dari, escaped report, specialist states, Kabul time, responsive layouts, keyboard refresh, safe failures, logout isolation, restricted staff, zero writes.');
  await context.close();
} finally { await browser?.close(); server.kill(); }
