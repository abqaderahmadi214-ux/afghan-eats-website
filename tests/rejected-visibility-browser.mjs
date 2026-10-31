import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('..', import.meta.url);
const server = spawn(process.execPath, ['admin-control-center/server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '8152' },
  stdio: 'ignore'
});
const publicServer = spawn(process.execPath, ['tests/server.mjs'], { cwd: root, stdio: 'ignore' });
let browser;
try {
  await delay(700);
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    sessionStorage.setItem('ae_control_center_token', 'test-token');
    sessionStorage.setItem('ae_control_center_user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
  });

  const rejected = [
    { id: 'r-rej-one', name: 'Test One Resturant', status: 'pending', listing_mode: 'directory', district: 'Herat' },
    { id: 'r-rej-two', name: 'Hamisha Resturant', status: 'pending', listing_mode: 'directory', district: 'Herat', application_status: 'rejected' },
    { id: 'r-rej-three', name: 'Arezo Resturant', status: 'pending', listing_mode: 'directory', district: 'Herat', application_status: 'rejected' }
  ];
  const restaurants = [
    ...rejected,
    { id: 'r-active', name: 'Normal Active', status: 'active', is_open: true, district: 'Herat', application_status: 'approved' },
    { id: 'r-pending', name: 'Normal Pending', status: 'pending', is_open: false, district: 'Herat', application_status: 'reviewing' }
  ];
  const partners = [
    { id: 'p-one', restaurant_id: 'r-rej-one', restaurant_name: 'Test One Resturant', reference: 'AEP-R1', status: 'rejected', created_at: '2026-10-01T00:00:00Z' },
    { id: 'p-two', restaurant_id: 'r-rej-two', restaurant_name: 'Hamisha Resturant', reference: 'AEP-R2', status: 'rejected', created_at: '2026-10-02T00:00:00Z' },
    { id: 'p-three', restaurant_id: 'r-rej-three', restaurant_name: 'Arezo Resturant', reference: 'AEP-R3', status: 'rejected', created_at: '2026-10-03T00:00:00Z' },
    { id: 'p-pending', restaurant_id: 'r-pending', restaurant_name: 'Normal Pending', reference: 'AEP-P1', status: 'pending', created_at: '2026-10-04T00:00:00Z' }
  ];
  const accounts = [
    ...rejected.map((item, index) => ({ id: `owner-${index}`, role: 'owner', restaurant_id: item.id, restaurant_name: item.name, username: `owner${index}`, active: false })),
    { id: 'owner-working', role: 'owner', restaurant_id: 'r-pending', restaurant_name: 'Normal Pending', username: 'normal-owner', active: false }
  ];
  const adminListViews = [];
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    let input = {};
    try { input = JSON.parse(new URL(route.request().url()).searchParams.get('input') || '{}').json || {}; } catch {}
    let data = [];
    if (path === 'auth.me') data = { id: 1, username: 'admin', role: 'admin' };
    if (path === 'restaurants.adminList') { adminListViews.push(input.view || 'missing'); data = restaurants; }
    if (path === 'operations.adminPartnerApplications') data = partners;
    if (path === 'portal.adminAccounts') data = accounts;
    if (path === 'portal.adminSetupSubmissions') data = [];
    if (path === 'operations.adminPartnerApplicationDetail') {
      const application = partners.find(item => item.id === input.id);
      data = { application, restaurant: restaurants.find(item => item.id === application?.restaurant_id) || null, setupSubmissions: [], menu: { categories: [], items: [] } };
    }
    return route.fulfill({ headers, json: { result: { data: { json: data } } } });
  });

  await page.goto('http://127.0.0.1:8152/#restaurants');
  await page.getByRole('heading', { name: 'Restaurant listings' }).waitFor();
  assert.ok(adminListViews.includes('working'), 'working view requests the safe backend view');
  const workingListings = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Restaurant listings' }) });
  for (const name of ['Normal Active', 'Normal Pending']) assert.match(await workingListings.innerText(), new RegExp(name));
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.doesNotMatch(await workingListings.innerText(), new RegExp(name));
  const workingApps = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Restaurant applications' }) });
  assert.match(await workingApps.innerText(), /Normal Pending/);
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.doesNotMatch(await workingApps.innerText(), new RegExp(name));
  const workingOwners = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Owner portal readiness' }) });
  assert.match(await workingOwners.innerText(), /Normal Pending/);
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.doesNotMatch(await workingOwners.innerText(), new RegExp(name));

  await page.getByRole('button', { name: 'Rejected / archive' }).click();
  await page.getByText('Archived — history only').first().waitFor();
  assert.ok(adminListViews.includes('rejected'), 'archive requests the rejected backend view');
  const archiveListings = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Restaurant listings' }) });
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.match(await archiveListings.innerText(), new RegExp(name));
  assert.doesNotMatch(await archiveListings.innerText(), /Normal Active|Normal Pending/);
  assert.equal(await archiveListings.locator('[data-action="edit-restaurant"], [data-action="toggle-listing"], [data-action="remove-restaurant"]').count(), 0, 'archived restaurant rows have no edit, restore, remove, or activation controls');
  const archiveApps = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Rejected applications' }) });
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.match(await archiveApps.innerText(), new RegExp(name));
  assert.doesNotMatch(await archiveApps.innerText(), /Normal Pending/);
  const archiveOwners = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Owner portal readiness' }) });
  for (const name of ['Test One Resturant', 'Hamisha Resturant', 'Arezo Resturant']) assert.match(await archiveOwners.innerText(), new RegExp(name));
  assert.doesNotMatch(await archiveOwners.innerText(), /Normal Pending/);

  await archiveApps.getByRole('button', { name: 'Review application' }).first().click();
  await page.locator('#partner-application-review-workspace').waitFor();
  assert.match(await page.locator('#partner-application-review-workspace').innerText(), /AEP-R1/);
  assert.equal(await page.locator('#partner-application-review-workspace [data-action="application-status"]').count(), 0, 'rejected dossier is retained as read-only history');
  assert.deepEqual(errors, [], 'admin view has no browser errors');

  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => typeof mergeLiveRestaurants === 'function');
  const mergeCheck = await page.evaluate(() => mergeLiveRestaurants(
    [{ id: 'hidden-id', name: 'Fallback Hidden', application_status: 'rejected' }],
    [
      { restaurant: { id: 'hidden-id', name: 'Fallback Hidden' }, categories: [], items: [] },
      { restaurant: { id: 'discovery-id', name: 'Legitimate Discovery' }, categories: [], items: [] }
    ]
  ).map(item => item.name));
  assert.deepEqual(mergeCheck, ['Legitimate Discovery'], 'authoritative rejected records are not reintroduced from fallback');
  assert.deepEqual(await page.evaluate(() => fallbackRestaurants([{ restaurant: { id: 'outage-seed', name: 'Outage Discovery' }, categories: [], items: [] }]).map(item => item.name)), ['Outage Discovery'], 'fallback discovery remains available when no live API list is used');
  console.log('PASS rejected visibility: working/archive separation, linked pending detection, normal workflow retention, owner readiness filtering, read-only archive, dossier history, and fallback guard.');
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill();
  publicServer.kill();
}
