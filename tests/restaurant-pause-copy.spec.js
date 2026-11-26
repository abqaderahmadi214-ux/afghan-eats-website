const { test, expect } = require('@playwright/test');

const restaurant = {
  id: 'shah-restaurant-herat',
  name: 'Shah Restaurant Herat',
  name_dari: 'رستورانت شاه هرات',
  description: 'Afghan food',
  description_dari: 'غذای افغانی',
  cuisine_tags: ['Afghan'],
  category_primary: 'Afghan',
  address: 'Herat',
  city: 'Herat',
  has_delivery: true,
  has_takeaway: true,
  delivery_time_min: 25,
  delivery_time_max: 40,
  delivery_fee_min: 50,
  min_order_amount: 0,
  status: 'active',
  is_open: true,
  rating: 4.8,
  total_reviews: 12,
  verification_status: 'owner_confirmed'
};
const menu = {
  categories: [{ id: 'main', name: 'Main dishes', name_dari: 'غذاهای اصلی' }],
  items: [{ id: 'kebab', category_id: 'main', name: 'Kebab', name_dari: 'کباب', description: 'Fresh kebab', price: 250, is_available: true }]
};
const pausedStatus = {
  orderingEnabled: false,
  orderingMessageEn: 'New ordering is temporarily paused. Please try again later.',
  orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
  banner: null,
  incidents: []
};
const openAvailability = {
  restaurantId: restaurant.id,
  acceptingNow: true,
  acceptingScheduled: true,
  operationMode: 'normal',
  reason: null
};
const trpc = data => JSON.stringify({ result: { data: { json: data } } });

test('global ordering pause replaces only positive restaurant status copy and restores it when resumed', async ({ page }) => {
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    let data = [];
    if (endpoint === 'platform.publicStatus') data = pausedStatus;
    else if (endpoint === 'restaurants.list') data = [restaurant];
    else if (endpoint === 'restaurants.getMenu') data = menu;
    else if (endpoint === 'merchant.publicAvailabilityBatch') data = [openAvailability];
    await route.fulfill({ status: 200, contentType: 'application/json', body: trpc(data) });
  });

  await page.goto('/restaurant.html?id=shah-restaurant-herat');
  const merchantBanner = page.locator('#aeMerchantBanner');
  const merchantState = page.locator('#aeMerchantBanner .ae-merchant-banner');
  const pauseNotice = page.locator('#aeOrderingPauseContext');
  await expect(pauseNotice).toHaveText('The restaurant is open. You can browse the menu while new orders are temporarily paused.');
  await expect(page.locator('#aePlatformStatus')).toHaveCount(0);
  await expect(merchantBanner).toBeHidden();
  await expect(page.locator('.cart-panel')).toBeHidden();
  await expect(page.locator('.store-badges .status-pill')).toHaveText('Open');
  await expect(page.locator('.menu-item .add-btn')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.currentRestaurant?._availability?.acceptingNow)).toBe(true);
  expect(await page.evaluate(() => window.currentRestaurant?.is_open)).toBe(true);

  await page.evaluate(() => renderPublicStatus({ orderingEnabled: true, banner: null, incidents: [] }));
  await expect(merchantBanner).toContainText('Open now');
  await expect(merchantBanner).toContainText('Accepting orders normally.');
  await expect(merchantState).toHaveClass(/open/);
  await expect(page.locator('.menu-item .add-btn')).toBeEnabled();
  await expect(page.locator('.store-badges .status-pill')).toHaveText('Open');

  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.reload();
  await expect(pauseNotice).toHaveText('رستورانت باز است. فعلاً می‌توانید منو را ببینید؛ ثبت سفارش موقتاً متوقف است.');
  await expect(merchantBanner).toBeHidden();
  await expect(page.locator('.store-meta-line')).toContainText('دریافت حضوری');
  expect((await page.locator('.store-meta-line').innerText()).match(/دریافت حضوری/g)).toHaveLength(1);
  await expect(page.locator('.store-badges .status-pill')).toHaveText('باز');
});

test('a failed status check can be retried without losing the saved basket or posting orders', async ({ page }) => {
  let statusAvailable = false;
  const orderRequests = [];
  await page.setViewportSize({ width: 390, height: 844 });
  const saved = [{ id: 'kebab', restaurantId: restaurant.id, restaurantName: restaurant.name, name: 'Kebab', qty: 2, price: 250 }];
  await page.addInitScript(items => localStorage.setItem('ae_cart', JSON.stringify(items)), saved);
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    if (endpoint.startsWith('orders.place')) orderRequests.push(endpoint);
    if (endpoint === 'platform.publicStatus' && !statusAvailable) return route.fulfill({ status: 503, body: '{}' });
    const response = {
      'platform.publicStatus': { orderingEnabled: true },
      'restaurants.list': [restaurant],
      'restaurants.getMenu': menu,
      'merchant.publicAvailabilityBatch': [openAvailability]
    };
    return route.fulfill({ json: { result: { data: { json: response[endpoint] || [] } } } });
  });
  await page.goto('/restaurant.html?id=shah-restaurant-herat');
  const notice = page.locator('#aeOrderingPauseContext');
  await expect(notice).toContainText('Ordering availability could not be confirmed');
  await expect(page.locator('.menu-item')).toContainText('Kebab');
  await expect(page.locator('.cart-order-actions')).toBeHidden();
  await expect(page.locator('.menu-item .add-btn')).toBeHidden();
  statusAvailable = true;
  await notice.getByRole('button', { name: 'Retry' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.menu-item .add-btn')).toBeEnabled();
  await page.evaluate(() => renderPublicStatus({ orderingEnabled: false }));
  await expect(notice).toContainText('new orders are temporarily paused');
  await expect(page.locator('.cart-order-actions')).toBeHidden();
  await expect(page.locator('.group-order')).toBeHidden();
  await expect(page.locator('.saved-basket-note')).toBeVisible();
  await expect(page.locator('#cartItems')).toContainText('Kebab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ae_cart')))).toEqual(saved);
  expect(orderRequests).toEqual([]);
});
