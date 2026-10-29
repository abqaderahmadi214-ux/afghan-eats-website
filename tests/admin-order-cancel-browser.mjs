import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const portalUrl = process.env.ADMIN_PORTAL_URL || '';
const port = process.env.PORT || '8149';
let server = null;
let browser = null;

if (!portalUrl) {
  server = spawn(process.execPath, ['admin-control-center/server.mjs'], {
    env: { ...process.env, PORT: port },
    stdio: 'pipe',
  });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Control Center server exited ${code}`)));
  });
}

const baseUrl = (portalUrl || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const baseOrigin = new URL(baseUrl).origin;
const now = new Date().toISOString();
let orders = [
  { id: '00000000-0000-4000-8000-000000000001', order_number: 'AE-TEST-PLACED-001', customer_name: 'Fixture customer', customer_phone: '0791234567', total: 720, status: 'placed', created_at: now, delivery_address: 'Herat City' },
  { id: '00000000-0000-4000-8000-000000000002', order_number: 'AE-TEST-PREPARING-002', customer_name: 'Fixture customer', total: 565, status: 'preparing', created_at: now, delivery_address: 'Herat City' },
  { id: '00000000-0000-4000-8000-000000000003', order_number: 'AE-TEST-ON-THE-WAY-003', customer_name: 'Fixture customer', total: 400, status: 'on_the_way', created_at: now, delivery_address: 'Herat City' },
  { id: '00000000-0000-4000-8000-000000000004', order_number: 'AE-TEST-DELIVERED-004', customer_name: 'Fixture customer', total: 300, status: 'delivered', created_at: now, delivery_address: 'Herat City' },
];
let fixtureRole = 'admin';
const writes = [];

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    sessionStorage.setItem('ae_control_center_token', 'fixture-session');
    sessionStorage.setItem('ae_control_center_user', JSON.stringify({ id: 1, username: 'Fixture admin', role: sessionStorage.getItem('fixtureRole') || 'admin' }));
  });
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseOrigin) return route.continue();
    if (url.hostname !== 'afghaneats-api.onrender.com') return route.abort();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    const path = url.pathname.split('/').at(-1);
    let data = [];
    if (request.method() !== 'GET') {
      const payload = JSON.parse(request.postData() || '{}')?.json || {};
      writes.push({ path, payload });
      if (path === 'orders.adminCancel') {
        orders = orders.map(order => order.id === payload.orderId ? { ...order, status: 'cancelled' } : order);
        data = { success: true, status: 'cancelled' };
      }
    }
    if (path === 'auth.me') data = { id: 1, username: 'Fixture admin', role: fixtureRole };
    if (path === 'orders.adminList') data = orders;
    if (path === 'operations.adminRiders' || path === 'operations.adminAssignments') data = [];
    if (path === 'ruleWorkers.snapshot') data = { enabled: false, findings: [], runs: [], summary: {}, offset: 0, totalMatching: 0, recentlyCleared: [] };
    return route.fulfill({ headers, json: { result: { data: { json: data } } } });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(`${baseUrl}/#dispatch`);
  await page.getByRole('heading', { name: 'Live dispatch board', exact: true }).waitFor();

  const dispatch = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Live dispatch board', exact: true }) });
  assert.match(await dispatch.innerText(), /0 dispatch-eligible riders/);
  const placedRow = dispatch.locator('tbody tr').filter({ hasText: 'AE-TEST-PLACED-001' });
  assert.match(await placedRow.innerText(), /Unassigned/);
  assert.equal(await placedRow.getByRole('button', { name: 'Cancel order', exact: true }).count(), 1, 'placed/unassigned order exposes cancellation when no rider is available');
  for (const orderNumber of ['AE-TEST-PREPARING-002', 'AE-TEST-ON-THE-WAY-003']) {
    const row = dispatch.locator('tbody tr').filter({ hasText: orderNumber });
    assert.equal(await row.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0, `${orderNumber} must not expose cancellation`);
  }
  const history = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Recent order history', exact: true }) });
  const deliveredRow = history.locator('tbody tr').filter({ hasText: 'AE-TEST-DELIVERED-004' });
  assert.equal(await deliveredRow.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0, 'delivered order remains protected');

  fixtureRole = 'operations_staff';
  await page.evaluate(() => sessionStorage.setItem('fixtureRole', 'operations_staff'));
  await page.reload();
  await page.locator('#page-title').waitFor();
  assert.equal(await page.locator('#page-title').innerText(), 'Restaurants', 'operations staff remain outside the full-admin dispatch view');
  assert.equal(await page.getByRole('button', { name: 'Cancel order', exact: true }).count(), 0, 'staff without full-admin cancellation permission must not see the control');
  fixtureRole = 'admin';
  await page.evaluate(() => { sessionStorage.setItem('fixtureRole', 'admin'); history.replaceState(null, '', `${location.pathname}#dispatch`); });
  await page.reload();
  await page.getByRole('heading', { name: 'Live dispatch board', exact: true }).waitFor();

  await placedRow.getByRole('button', { name: 'Cancel order', exact: true }).click();
  const dialog = page.locator('#confirm-dialog');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await page.locator('#confirm-reason').isVisible(), true);
  assert.equal(await page.locator('#confirm-reason').getAttribute('required'), '');
  assert.equal(writes.length, 0, 'opening cancellation confirmation does not write');
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  assert.equal(writes.length, 0, 'confirmation without a reason cannot write');

  if (!(await dialog.evaluate(element => element.open))) {
    assert.match(await page.locator('#global-notice').innerText(), /cancellation reason/i);
    await placedRow.getByRole('button', { name: 'Cancel order', exact: true }).click();
  }
  const reason = 'No rider is available in the delivery area';
  await page.locator('#confirm-reason').fill(reason);
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await history.getByText('AE-TEST-PLACED-001').waitFor();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    path: 'orders.adminCancel',
    payload: { orderId: '00000000-0000-4000-8000-000000000001', reason },
  });
  assert.deepEqual(errors, []);

  console.log(`PASS: ${portalUrl ? 'deployed' : 'local'} Control Center shows cancellation only for placed orders, requires an audit reason, and sends only the mocked adminCancel mutation.`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
