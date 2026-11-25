const { test, expect } = require('@playwright/test');

const pausedStatus = {
  orderingEnabled: false,
  orderingMessageEn: 'New ordering is temporarily paused. Please try again later.',
  orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
  banner: null,
  incidents: []
};

function envelope(data) {
  return { result: { data: { json: data } } };
}

async function routeApi(page, { restaurants = [], previews = [], browseMenu = null, status = pausedStatus } = {}) {
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    let data = {};
    if (path === 'platform.publicStatus') data = status;
    if (path === 'restaurants.list') data = restaurants;
    if (path === 'restaurants.listBrowsePreviews') data = previews;
    if (path === 'restaurants.getBrowseMenu') data = browseMenu || { categories: [], items: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(envelope(data))
    });
  });
}

test('paused home makes browsing primary and keeps the verified directory reachable in both languages', async ({ page }) => {
  await routeApi(page);
  await page.goto('/');

  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('.ae-order-box')).toHaveCount(0);
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('.ae-home-business-link[href="/organizations/"]')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Public menus remain available to browse');
  await expect(page.locator('#homeRestaurants')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Marketplace departments' })).toBeVisible();
  const departments = page.locator('ae-market-orbit');
  await expect(departments).toBeVisible();
  await expect(departments.locator('[data-department]')).toHaveCount(7);
  const departmentKeys = await departments.locator('[data-department]').evaluateAll(cards => cards.map(card => card.dataset.department));
  expect(departmentKeys).toEqual(['restaurants', 'groceries', 'health-beauty', 'convenience', 'pet-supplies', 'electronics', 'gifts']);
  await expect(departments.locator('[data-department="alcohol"]')).toHaveCount(0);
  await expect(page.locator('.ae-cuisine')).toHaveCount(0);
  await expect(departments.locator('[data-department="restaurants"]')).toContainText('Browse restaurants');
  for (const key of ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']) {
    await expect(departments.locator(`[data-department="${key}"]`).locator('..')).toContainText('Coming soon');
  }

  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#aeHomeAreaForm label .fa-copy')).toContainText('ناحیه یا نشانی نزدیک شما در هرات');
  await expect(page.getByRole('navigation', { name: 'بخش‌های فروشگاه' })).toBeVisible();
  await expect(departments.locator('[data-department="restaurants"]')).toContainText('رستورانت‌ها');
  const comingSoonDari = [
    ['groceries', 'مواد خوراکی'], ['health-beauty', 'صحت و زیبایی'], ['convenience', 'ضروریات روزانه'],
    ['gifts', 'هدایا'], ['electronics', 'لوازم الکترونیکی'], ['pet-supplies', 'لوازم حیوانات خانگی']
  ];
  for (const [key, label] of comingSoonDari) {
    const tile = departments.locator(`[data-department="${key}"]`);
    await expect(tile).toContainText(label);
    await expect(tile.locator('..')).toContainText('به‌زودی');
  }

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
});

test('mobile department collections fit their swipe track', async ({ page }) => {
  await routeApi(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  const grid = await page.locator('ae-market-orbit ul').boundingBox();
  const card = await page.locator('ae-market-orbit li').first().boundingBox();
  const art = await page.locator('ae-market-orbit li').first().boundingBox();
  const photo = await page.locator('ae-market-orbit li img').first().boundingBox();
  expect(card.width).toBeGreaterThan(grid.width * 0.45);
  expect(photo.width).toBeGreaterThan(art.width * 0.95);
});

test('merchant growth bundle is loaded once without a duplicate declaration error', async ({ page }) => {
  await routeApi(page);
  const growthScripts = [];
  const duplicateErrors = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/assets/growth.js') growthScripts.push(request.url());
  });
  page.on('pageerror', error => {
    if (error.message.includes("Identifier 'AEGROWTH' has already been declared")) duplicateErrors.push(error.message);
  });
  await page.goto('/');
  await page.waitForTimeout(150);
  expect(growthScripts).toHaveLength(1);
  expect(duplicateErrors).toHaveLength(0);
});

test('paused Basket is subdued and inaccessible, then restores its normal action when ordering is active', async ({ page }) => {
  const status = { ...pausedStatus };
  await routeApi(page, { status });
  await page.goto('/');

  const basket = page.locator('header .ae-cart');
  await expect(basket).toHaveAttribute('aria-disabled', 'true');
  await expect(basket).toHaveAttribute('tabindex', '-1');
  await expect(basket).not.toHaveAttribute('href');
  await expect(basket.locator('.ae-cart-label')).toContainText('Ordering paused');
  await expect.poll(() => basket.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(233, 236, 231)');
  await expect.poll(() => basket.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  await page.locator('.ae-account').focus();
  await page.keyboard.press('Tab');
  await expect(basket).not.toBeFocused();

  status.orderingEnabled = true;
  await page.evaluate(() => refreshPublicPlatformStatus());
  await expect(basket).toHaveAttribute('href', '/checkout');
  await expect(basket).not.toHaveAttribute('aria-disabled');
  await expect(basket).not.toHaveAttribute('tabindex', '-1');
  await expect(basket.locator('.ae-cart-label')).toContainText('Basket');
  const activeBackground = await basket.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(activeBackground).not.toBe('rgb(233, 236, 231)');
});

test('homepage search finds restaurants, menu items, and categories in both languages while orders stay paused', async ({ page }) => {
  const restaurant = {
    id: 'search-preview-kitchen',
    slug: 'search-preview-kitchen',
    name: 'Saffron Kitchen Preview',
    name_dari: 'آشپزخانهٔ زعفران',
    category_primary: 'Afghan',
    cuisine_tags: ['Afghan', 'Rice'],
    _categories: [{ id: 'main-dishes', name: 'Main dishes', name_dari: 'غذاهای اصلی' }],
    city: 'Herat',
    status: 'active',
    is_open: true,
    has_delivery: true,
    has_takeaway: true,
    menu_preview_only: false,
    listing_mode: 'directory',
    verification_status: 'public_seeded',
    partnership_status: 'prospect',
    public_menu_item_count: 1,
    _items: [{ id: 'qabili-signature', name: 'Qabili Signature', name_dari: 'قابلی ویژه', price: 180, is_available: true }]
  };
  await routeApi(page, { restaurants: [restaurant] });
  const orderRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/trpc/orders.place')) orderRequests.push(request.url());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('.ae-order-box')).toBeHidden();
  await expect(page.getByRole('search')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('name', 'q');
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('placeholder', 'Search restaurants, items, and categories');
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('aria-label', 'Search restaurants, items, and categories');
  await expect(page.locator('#aeHomeSearchNote')).toContainText('Browse menus while ordering is paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');

  await page.locator('#aeHomeSearch').fill('Saffron Kitchen Preview');
  await page.locator('.ae-home-search button[type="submit"]').click();
  await expect(page).toHaveURL(/\/restaurants\?q=Saffron\+Kitchen\+Preview$/);
  await expect(page.locator('#search')).toHaveValue('Saffron Kitchen Preview');
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('Saffron Kitchen Preview');

  await page.goto('/');
  await page.locator('#aeHomeSearch').fill('Qabili Signature');
  await page.locator('.ae-home-search button[type="submit"]').click();
  await expect(page).toHaveURL(/\/restaurants\?q=Qabili\+Signature$/);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('Saffron Kitchen Preview');

  await page.goto('/');
  await page.locator('#aeHomeSearch').fill('Main dishes');
  await page.locator('.ae-home-search button[type="submit"]').click();
  await expect(page).toHaveURL(/\/restaurants\?q=Main\+dishes$/);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('Saffron Kitchen Preview');

  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('placeholder', 'رستورانت‌ها، غذاها و دسته‌بندی‌ها');
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('aria-label', 'جستجوی رستورانت‌ها، غذاها و دسته‌بندی‌ها');
  await expect(page.locator('.ae-home-search button[type="submit"]')).toContainText('جستجو');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('ثبت سفارش جدید موقتاً متوقف است');
  await page.locator('#aeHomeSearch').fill('قابلی ویژه');
  await page.locator('.ae-home-search button[type="submit"]').click();
  await expect(page).toHaveURL(/\/restaurants\?q=/);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('آشپزخانهٔ زعفران');

  await page.goto('/');
  await page.locator('#aeHomeSearch').fill('غذاهای اصلی');
  await page.locator('.ae-home-search button[type="submit"]').click();
  await expect(page).toHaveURL(/\/restaurants\?q=/);
  await expect(page.locator('#restaurantGrid .restaurant-card').first()).toContainText('آشپزخانهٔ زعفران');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(orderRequests).toHaveLength(0);
});

test('public browse-only restaurant menus stay visible while all ordering paths remain paused', async ({ page }) => {
  const restaurant = {
    id: 'preview-kitchen-2026',
    slug: 'preview-kitchen-2026',
    name: 'Preview Kitchen Herat',
    name_dari: 'آشپزخانهٔ نمونه هرات',
    category_primary: 'Afghan',
    cuisine_tags: ['Afghan', 'Rice Dishes'],
    city: 'Herat',
    status: 'active',
    is_open: true,
    has_delivery: true,
    has_takeaway: true,
    menu_preview_only: false,
    verification_status: 'public_seeded',
    partnership_status: 'prospect',
    public_menu_item_count: 1,
    _items: [{ id: 'kabuli-pulao', name: 'Kabuli Pulao', name_dari: 'قابلی پلو', price: 180, is_available: true }]
  };
  const menu = {
    categories: [{ id: 'main', name: 'From the kitchen', name_dari: 'از آشپزخانه' }],
    items: [{ id: 'kabuli-pulao', category_id: 'main', name: 'Kabuli Pulao', name_dari: 'قابلی پلو', description: 'Rice with carrots and raisins', description_dari: 'برنج با زردک و کشمش', price: 180, is_available: true }]
  };
  await routeApi(page, { restaurants: [restaurant], previews: [{ id: restaurant.id, menu_item_count: 1 }], browseMenu: menu });
  const orderRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/trpc/orders.place')) orderRequests.push(request.url());
  });

  await page.goto(`/restaurant.html?id=${restaurant.id}`);
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#menuContent')).toContainText('Kabuli Pulao');
  await expect(page.locator('#menuContent')).toContainText('Menu preview · browse only');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  expect(orderRequests).toHaveLength(0);
});

test('homepage motion respects a reduced-motion preference', async ({ page }) => {
  await routeApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('ae-market-orbit li').first()).toBeVisible();
  const motion = await page.evaluate(() => ({
    enabled: document.documentElement.classList.contains('ae-motion-enabled'),
    photoTransition: getComputedStyle(document.querySelector('ae-market-orbit').shadowRoot.querySelector('li img')).transitionDuration,
    areaTransition: getComputedStyle(document.querySelector('#aeHomeAreaSubmit')).transitionDuration
  }));
  expect(motion.enabled).toBe(false);
  expect(motion.photoTransition).toBe('0s');
  expect(motion.areaTransition).toBe('0s');
});
