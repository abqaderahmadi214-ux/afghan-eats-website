import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['tests/server.mjs'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  const check = () => fetch('http://127.0.0.1:4173/account.html').then(resolve).catch(() => setTimeout(check, 100));
  check();
});
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
let notifications = [{ id: 'old-1', title: 'Older message', body: 'Existing update', read_at: null, created_at: '2026-10-28T10:00:00Z' }];
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    sessionStorage.setItem('ae_customer_token', 'fixture-customer');
    window.__soundCount = 0;
    window.__blockAudio = false;
    class FakeAudioContext {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
      async resume() { if (window.__blockAudio) throw Error('blocked'); this.state = 'running'; }
      createOscillator() { return { frequency: {}, connect() {}, start() { window.__soundCount += 1; }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    }
    window.AudioContext = FakeAudioContext;
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = url.pathname.split('/').at(-1);
    let data = {};
    if (path === 'customer.me') data = { profile: { name: 'Test customer', email: 'customer@example.test', phone: '0700000000' }, addresses: [], orders: [], favorites: [], loyalty: {}, ledger: [], reviews: [], support: [] };
    if (path === 'communications.customerList') data = { notifications, preferences: { order_updates: true, support_updates: true, promotions: true }, unreadCount: notifications.filter(item => !item.read_at).length };
    return route.fulfill({ headers, json: { result: { data: { json: data } } } });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/account.html');
  await page.locator('#customerNotificationCenter').waitFor();
  await page.locator('#customerNotificationList [data-customer-notification="old-1"]').waitFor();
  const sound = page.locator('[data-ae-sound-toggle]');
  assert.equal(await sound.getAttribute('aria-pressed'), 'false', 'sound is opt-in and local to this device');
  await page.evaluate(() => { window.__blockAudio = true; });
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), 'false', 'a blocked autoplay attempt must remain visibly disabled');
  await page.evaluate(() => { window.__blockAudio = false; });
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), 'true', 'a user gesture enables the local audio context');
  assert.equal(await page.evaluate(() => window.__soundCount), 0, 'the initial unread notification snapshot never replays');

  notifications = [...notifications, { id: 'new-2', title: 'A new offer', body: 'Customer message', read_at: null, created_at: '2026-10-29T10:00:00Z' }];
  await page.evaluate(() => refreshCustomerNotifications(true));
  assert.equal(await page.evaluate(() => window.__soundCount), 2, 'one genuinely new unread notification plays one short chime');
  await page.evaluate(() => refreshCustomerNotifications(true));
  assert.equal(await page.evaluate(() => window.__soundCount), 2, 'duplicate polling does not replay the same notification');
  assert.equal(await page.locator('#customerNotificationList script').count(), 0, 'notification content is text-escaped');
  assert.deepEqual(errors, []);
  console.log('PASS customer account: opt-in gesture, blocked autoplay, initial baseline, one chime for a new unread notification, duplicate suppression, no browser errors.');
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
