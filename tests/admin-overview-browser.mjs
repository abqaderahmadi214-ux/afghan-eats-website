import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['admin-control-center/server.mjs'], { env: { ...process.env, PORT: '8148' }, stdio: 'pipe' });
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited ${code}`))); });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
mkdirSync('/tmp/afghan-eats-preview', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => { sessionStorage.setItem('ae_control_center_token', 'test-session'); sessionStorage.setItem('ae_control_center_user', JSON.stringify({ id: 1, username: 'Operations team', role: 'admin' })); });
  let writes = 0;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'afghaneats-api.onrender.com') return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (req.method() !== 'GET') writes++;
    const path = url.pathname.split('/').at(-1);
    let data = [];
    if (path === 'auth.me') data = { id: 1, username: 'Operations team', role: 'admin' };
    if (path === 'orders.adminList') data = [
      { id: '1', order_number: 'AE-20261027-1042', customer_name: 'Sample customer', total: 720, status: 'preparing', created_at: '2026-10-27T09:00:00Z', delivery_address: 'Herat City' },
      { id: '2', order_number: 'AE-20261027-1043', customer_name: 'Demo customer', total: 565, status: 'on_the_way', created_at: '2026-10-27T09:10:00Z', delivery_address: 'Cinema Square, Herat' },
      { id: '3', order_number: 'CANCELLED-ORDER', status: 'cancelled', total: 100 },
      { id: '4', order_number: 'DELIVERED-ORDER', status: 'delivered', total: 100 }
    ];
    if (path === 'operations.adminPartnerApplications') data = [{ status: 'pending' }];
    if (path === 'platform.adminStatus') data = { controls: { ordering_enabled: false }, incidents: [] };
    if (path === 'dispatch.adminSettings') data = { auto_dispatch_enabled: true, acceptance_timeout_seconds: 180 };
    if (path === 'riderOperations.adminBoard') data = { availability: [{ status: 'pending' }], riders: [{ status: 'active', isAvailable: true, shiftActive: true, busy: false }] };
    if (path === 'ruleWorkers.snapshot') data = { enabled: false, findings: [], runs: [], summary: {} };
    return route.fulfill({ headers, json: { result: { data: { json: data } } } });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8148/#overview');
  await page.getByRole('heading', { name: 'Good food. Great operations.' }).waitFor();
  assert.deepEqual(await page.locator('.overview-shortcuts a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['#restaurants', '#riders', '#support']);
  assert.equal(await page.locator('#primary-nav a[aria-current="page"]').getAttribute('href'), '#overview');
  const queue = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Active order queue', exact: true }) });
  assert.match(await queue.innerText(), /AE-20261027-1042/);
  assert.doesNotMatch(await queue.innerText(), /CANCELLED-ORDER|DELIVERED-ORDER/);
  assert.equal(await page.locator('.overview-metrics .metric-card strong').first().innerText(), '2');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `No overflow at ${width}px`);
    if ([1440,390].includes(width)) {
      await page.screenshot({ path: `/tmp/afghan-eats-preview/overview-${width}.png`, fullPage: true, animations: 'disabled' });
      await page.screenshot({ path: `/tmp/afghan-eats-preview/overview-screen-${width}.png`, animations: 'disabled' });
    }
  }
  await page.getByRole('button', { name: 'Open market', exact: true }).click();
  await page.locator('#confirm-dialog[open]').waitFor();
  assert.equal(writes, 0, 'market changes require explicit confirmation');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(writes, 0);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('link', { name: 'View live orders', exact: true }).click();
  await page.getByRole('heading', { name: 'Live dispatch board', exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, '#dispatch');
  assert.deepEqual(errors, []);
  console.log('PASS: active queue filtering, metric counts, five responsive widths, confirmation/cancel, metric navigation, no browser errors. Screenshots: /tmp/afghan-eats-preview');
} finally { await browser.close(); server.kill(); }
