const { test, expect } = require('@playwright/test');

test('ordering pause is clear across customer paths without hiding restaurant recruitment', async ({ page }) => {
  const pausedStatus = {
    orderingEnabled: false,
    orderingMessageEn: 'New ordering is temporarily paused. Please try again later.',
    orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
    banner: null,
    incidents: []
  };
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    const data = path === 'platform.publicStatus' ? pausedStatus : {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ result: { data: { json: data } } })
    });
  });

  await page.goto('/');
  await expect(page.locator('#aePlatformStatus')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Restaurant listings are for discovery only');
  await expect(page.locator('#aeOrderingPauseContext a[href="/partner"]')).toBeVisible();
  await expect(page.locator('.ae-platform-partner-link[href="/partner"]')).toBeVisible();
  await expect(page.locator('.ae-order-box .mode-tabs button').first()).toBeDisabled();
  await expect(page.locator('.ae-order-box .address-box button[type="submit"]')).toBeDisabled();
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-label', 'Ordering paused');
  await expect(page.locator('.ae-cart .ae-cart-label .en-copy')).toHaveText('Ordering paused');
  await expect(page.locator('.ae-join-restaurant[href="/partner"]')).toBeVisible();

  await page.goto('/restaurants');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  await expect(page.locator('.restaurants-page .mode-tabs button').first()).toBeDisabled();

  await page.goto('/discover');
  await expect(page.locator('.discovery-intro > .btn-primary')).toHaveText('Browse Afghan Eats restaurant listings');
  await expect(page.locator('#aeOrderingPauseContext a[href="/partner"]')).toBeVisible();

  await page.goto('/orders');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  await expect(page.locator('.orders-head > a .en-copy')).toHaveText('Browse restaurants');
  await expect(page.locator('#ordersMembership .orders-member-card.guest b')).toHaveText('Guest orders');

  await page.goto('/account');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  await expect(page.locator('.account-container')).toContainText('Track guest orders here or in your account');

  await page.goto('/checkout');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New orders are paused');
  await expect(page.locator('#aeOrderingPauseNote')).toBeVisible();
  await expect(page.locator('.checkout-place-order')).toBeDisabled();

  await page.evaluate(() => renderPublicStatus({ orderingEnabled: true, banner: null, incidents: [] }));
  await expect(page.locator('#aeOrderingPauseContext')).toHaveCount(0);
  await expect(page.locator('.checkout-place-order')).toBeEnabled();
  await expect(page.locator('.ae-cart')).toHaveAttribute('href', '/checkout');
  await expect(page.locator('.ae-cart .ae-cart-label .en-copy')).toHaveText('Basket');
});
