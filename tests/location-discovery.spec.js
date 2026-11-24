const { test, expect } = require('@playwright/test');

const paused = {
  orderingEnabled: false,
  orderingMessageEn: 'New ordering is temporarily paused.',
  orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
  banner: null,
  incidents: []
};

function directoryListing({ id, name, address, addressDari = '', district, districtDari = '', neighborhood = '', city = 'Herat' }) {
  return {
    id,
    slug: id,
    name,
    name_dari: name,
    address,
    address_dari: addressDari,
    district,
    district_dari: districtDari,
    neighborhood,
    city,
    status: 'pending',
    is_open: false,
    has_delivery: false,
    has_takeaway: false,
    listing_mode: 'directory',
    verification_status: 'public_seeded',
    partnership_status: 'prospect',
    public_menu_item_count: 1,
    _items: [{ id: `${id}-item`, name: 'Public menu item', name_dari: 'آیتم منوی عمومی', price: 100, is_available: true }]
  };
}

const rows = [
  directoryListing({ id: 'gulha-location-kitchen', name: 'Gulha Location Kitchen', address: 'Gulha Circle, Herat', district: 'Gulha', districtDari: 'چهارراه گل‌ها' }),
  directoryListing({ id: 'dari-location-kitchen', name: 'Dari Location Kitchen', address: 'Herat', addressDari: 'هرات، چهارراهی گل‌ها', district: 'Gulha', districtDari: 'گل‌ها' }),
  directoryListing({ id: 'far-location-kitchen', name: 'Far Location Kitchen', address: 'Mokhaberat Road, Herat', district: 'Mokhaberat' }),
  directoryListing({ id: 'kabul-location-kitchen', name: 'Kabul Location Kitchen', address: 'Gulha Circle, Kabul', district: 'Gulha', city: 'Kabul' }),
  { id: 'airport-orderable-kitchen', slug: 'airport-orderable-kitchen', name: 'Airport Orderable Kitchen', name_dari: 'آشپزخانه ارسال میدان هوایی', address: 'Airport Road, Herat', district: 'Airport Road', city: 'Herat', status: 'active', is_open: true, has_delivery: true, has_takeaway: true, listing_mode: 'orderable', verification_status: 'owner_confirmed', partnership_status: 'active_partner', public_menu_item_count: 1, _items: [{ id: 'airport-orderable-item', name: 'Airport dish', name_dari: 'غذای میدان هوایی', price: 100, is_available: true }] }
];

const cityOnlyListing = directoryListing({ id: 'city-only-kitchen', name: 'City Only Kitchen', address: 'Side Street', district: 'Old Town', city: 'Herat' });

function trpc(data) {
  return JSON.stringify({ result: { data: { json: data } } });
}

async function stubApi(page, quoteInputs = [], options = {}) {
  const { restaurants = rows, quoteUnavailable = false } = options;
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    let data = {};
    if (endpoint === 'platform.publicStatus') data = paused;
    else if (endpoint === 'restaurants.list') data = restaurants;
    else if (endpoint === 'restaurants.listBrowsePreviews') data = [];
    else if (endpoint === 'restaurants.getMenu' || endpoint === 'restaurants.getBrowseMenu') data = { categories: [], items: [] };
    else if (endpoint === 'orders.quote') {
      const input = JSON.parse(new URL(route.request().url()).searchParams.get('input') || '{"json":{}}').json || {};
      quoteInputs.push(input);
      if (quoteUnavailable) {
        await route.fulfill({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: { json: { message: 'Delivery is unavailable at this address' } } }) });
        return;
      }
      data = { restaurantId: input.restaurantId, fulfillment: input.fulfillment || 'delivery', deliveryFee: 0, minimumOrder: 0, etaMin: 20, etaMax: 35, source: 'test' };
    } else if (endpoint === 'merchant.publicAvailabilityBatch') data = [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: trpc(data)
    });
  });
}

async function stubEmptyStaticData(page) {
  for (const file of ['fallback-restaurants.json', 'public-herat-directory.json', 'researched-herat-restaurants.json']) {
    await page.route(`**/data/${file}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  }
}

test('home area form routes to address-matched public listings without calling delivery or order endpoints', async ({ page }) => {
  const quoteInputs = [];
  const orderWrites = [];
  await stubApi(page, quoteInputs);
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/orders.place')) orderWrites.push(request);
  });

  await page.goto('/');
  await page.locator('#aeHomeArea').fill('Gulha Circle');
  await page.locator('#aeHomeAreaSubmit').click();
  await expect(page).toHaveURL(/\/restaurants\?area=Gulha\+Circle&q=$/);
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('published location details match');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Gulha Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Far Location Kitchen' })).toHaveCount(0);
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Kabul Location Kitchen' })).toHaveCount(0);
  await expect(page.locator('#aeLocationArea')).toHaveValue('Gulha Circle');
  expect(await page.evaluate(() => localStorage.getItem('ae_browse_area'))).toBe('Gulha Circle');
  expect(await page.evaluate(() => localStorage.getItem('ae_address'))).toBeNull();
  expect(quoteInputs).toHaveLength(0);
  expect(orderWrites).toHaveLength(0);
});

test('area matching reads published Dari address and district fields', async ({ page }) => {
  await stubApi(page);
  await page.goto(`/restaurants?area=${encodeURIComponent('چهارراه گل‌ها')}`);
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('published location details match');
  await expect(page.locator('#aeLocationArea')).toHaveValue('چهارراه گل‌ها');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Dari Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Far Location Kitchen' })).toHaveCount(0);
  await page.locator('#search').fill('Dari Location Kitchen');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Dari Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Gulha Location Kitchen' })).toHaveCount(0);
  await page.locator('#search').fill('');
  await page.locator('#sort').selectOption('rating');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Dari Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Gulha Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Far Location Kitchen' })).toHaveCount(0);
});

test('city names alone do not count as an address-area match', async ({ page }) => {
  await stubApi(page, [], { restaurants: [cityOnlyListing] });
  await stubEmptyStaticData(page);
  await page.goto('/restaurants?area=Herat');
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('No published restaurant address matches');
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('Showing all Herat restaurant listings instead');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'City Only Kitchen' })).toBeVisible();
});

test('area browsing still shows matching directory cards when a saved delivery address has no quote', async ({ page }) => {
  const quoteInputs = [];
  await stubApi(page, quoteInputs, { quoteUnavailable: true });
  await stubEmptyStaticData(page);
  await page.addInitScript(() => localStorage.setItem('ae_address', 'Saved delivery address'));
  await page.goto('/restaurants?area=Mokhaberat');
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('published location details match');
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Far Location Kitchen' })).toBeVisible();
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Airport Orderable Kitchen' })).toHaveCount(0);
  await expect(page.locator('#restaurantGrid .delivery-inline-notice')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ae_address'))).toBe('Saved delivery address');
  expect(quoteInputs.some(input => input.restaurantId === 'airport-orderable-kitchen')).toBe(true);
});

test('when no published location matches, all Herat listings are shown and clearing the area keeps delivery address separate', async ({ page }) => {
  await stubApi(page);
  await page.addInitScript(() => localStorage.setItem('ae_address', 'Saved delivery address'));
  await page.goto('/restaurants?area=Atlantis');
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('No published restaurant address matches');
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('Showing all Herat restaurant listings instead');
  for (const name of ['Gulha Location Kitchen', 'Dari Location Kitchen', 'Far Location Kitchen']) {
    await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: name })).toBeVisible();
  }
  await expect(page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Kabul Location Kitchen' })).toHaveCount(0);
  await page.locator('#aeClearLocationBrowseArea').click();
  await expect(page).toHaveURL(/\/restaurants(?:\?.*)?$/);
  await expect(page).not.toHaveURL(/area=/);
  expect(await page.evaluate(() => localStorage.getItem('ae_browse_area'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('ae_address'))).toBe('Saved delivery address');
});

test('area-matched restaurant menus remain browse-only while global ordering is paused', async ({ page }) => {
  const orderWrites = [];
  await stubApi(page);
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/orders.place')) orderWrites.push(request.url());
  });
  await page.goto('/restaurants?area=Gulha%20Circle');
  const card = page.locator('#restaurantGrid .restaurant-card').filter({ hasText: 'Gulha Location Kitchen' });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#menuContent')).toContainText('Public menu item');
  await expect(page.locator('.add-btn')).toHaveCount(0);
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  expect(orderWrites).toHaveLength(0);
});

test('location browsing form and read-only delivery quote dialog have separate identifiers and behavior', async ({ page }) => {
  const quoteInputs = [];
  await stubApi(page, quoteInputs);
  await page.goto('/restaurants');
  await expect(page.locator('#aeLocationBrowseForm')).toHaveCount(1);
  await expect(page.locator('#aeBrowseAreaForm')).toHaveCount(1);
  await expect(page.locator('#aeBrowseAreaDialog')).toBeHidden();
  await page.locator('#aeBrowseAreaTrigger').click();
  const dialog = page.locator('#aeBrowseAreaDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#aeBrowseAreaForm')).toHaveCount(1);
  await expect(dialog.locator('#aeBrowseAreaInput')).toHaveAttribute('autocomplete', 'street-address');
  await expect(page.locator('#aeLocationBrowseForm')).toHaveCount(1);
  await expect(page.locator('#aeLocationBrowseStatus')).toContainText('Delivery availability is checked separately');
  await expect(dialog).toContainText('does not use your basket or place an order');
  expect(quoteInputs).toHaveLength(0);
});
