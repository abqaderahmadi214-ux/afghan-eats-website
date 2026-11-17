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
  await expect(page.locator('#aePlatformStatus')).toContainText('New ordering is temporarily paused');
  await expect(merchantBanner).toContainText('Ordering paused');
  await expect(merchantBanner).toContainText('New orders are temporarily paused across Afghan Eats.');
  await expect(merchantBanner).toContainText('Restaurant hours and local availability are unchanged.');
  await expect(merchantBanner).not.toContainText('Open now');
  await expect(merchantBanner).not.toContainText('Accepting orders normally.');
  await expect(merchantState).toHaveClass(/paused/);
  await expect(page.locator('.store-badges .status-pill')).toHaveText('Open');
  await expect(page.locator('.menu-item .add-btn')).toBeDisabled();
  expect(await page.evaluate(() => window.currentRestaurant?._availability?.acceptingNow)).toBe(true);
  expect(await page.evaluate(() => window.currentRestaurant?.is_open)).toBe(true);

  await page.evaluate(() => renderPublicStatus({ orderingEnabled: true, banner: null, incidents: [] }));
  await expect(merchantBanner).toContainText('Open now');
  await expect(merchantBanner).toContainText('Accepting orders normally.');
  await expect(merchantState).toHaveClass(/open/);
  await expect(page.locator('.menu-item .add-btn')).toBeEnabled();
  await expect(page.locator('.store-badges .status-pill')).toHaveText('Open');

  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.reload();
  await expect(page.locator('#aePlatformStatus')).toContainText('ثبت سفارش جدید موقتاً متوقف است');
  await expect(merchantBanner).toContainText('سفارش‌گیری متوقف است');
  await expect(merchantBanner).toContainText('ثبت سفارش‌های جدید در سراسر افغان ایتس موقتاً متوقف است.');
  await expect(merchantBanner).toContainText('ساعات کاری و وضعیت محلی رستورانت تغییر نکرده است.');
  await expect(merchantBanner).not.toContainText('اکنون باز');
  await expect(merchantBanner).not.toContainText('سفارش‌ها به‌صورت عادی پذیرفته می‌شوند.');
  await expect(page.locator('.store-badges .status-pill')).toHaveText('باز');
});
