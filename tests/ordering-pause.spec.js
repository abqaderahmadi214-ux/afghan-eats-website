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
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Public menus remain available to browse');
  await expect(page.locator('#aeOrderingPauseContext a[href="/partner"]')).toBeVisible();
  await expect(page.locator('#aePlatformStatus.ae-platform-pause-duplicate')).toBeHidden();
  await expect(page.locator('.ae-order-box')).toHaveCount(0);
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-label', 'Ordering paused');
  await expect(page.locator('.ae-cart .ae-cart-label .en-copy')).toHaveText('Ordering paused');
  await expect(page.locator('.footer a[href="/partner"]')).toBeVisible();

  await page.goto('/restaurants');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Menus remain available to browse');
  await expect(page.locator('#aePlatformStatus')).toBeHidden();
  await expect(page.locator('.restaurants-page .mode-tabs button[data-mode="delivery"]')).toBeEnabled();
  await expect(page.locator('.restaurants-page .mode-tabs button[data-mode="pickup"]')).toBeEnabled();
  await page.locator('.restaurants-page .mode-tabs button[data-mode="pickup"]').click();
  await expect(page.locator('.restaurants-page .mode-tabs button[data-mode="pickup"]')).toHaveClass(/active/);
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');

  await page.goto('/discover');
  await expect(page.locator('.discovery-intro > .btn-primary')).toHaveText('Browse Afghan Eats restaurant listings');
  await expect(page.locator('#aeOrderingPauseContext a[href="/partner"]')).toBeVisible();

  await page.goto('/orders');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('.orders-head > a .en-copy')).toHaveText('Browse restaurants');
  await expect(page.locator('#ordersMembership .orders-member-card.guest b')).toHaveText('Guest orders');

  await page.goto('/account');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('.account-container')).toContainText('Track guest orders here or in your account');

  await page.goto('/checkout');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#aeOrderingPauseNote')).toBeVisible();
  await expect(page.locator('.checkout-place-order')).toBeDisabled();

  await page.evaluate(() => renderPublicStatus({ orderingEnabled: true, banner: null, incidents: [] }));
  await expect(page.locator('#aeOrderingPauseContext')).toHaveCount(0);
  await expect(page.locator('.checkout-place-order')).toBeEnabled();
  await expect(page.locator('.ae-cart')).toHaveAttribute('href', '/checkout');
  await expect(page.locator('.ae-cart .ae-cart-label .en-copy')).toHaveText('Basket');
});


test('checkout stays hidden and blocked when ordering status cannot be fetched', async ({ page }) => {
  const orderRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/trpc/orders.place')) orderRequests.push(request.url());
  });
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
  });
  await page.goto('/checkout');
  await expect(page.locator('#aeOrderingPauseNote')).toContainText('could not verify');
  await expect(page.locator('#checkoutShell')).toBeHidden();
  await expect(page.locator('.checkout-place-order')).toBeDisabled();
  const submissionBlocked = await page.locator('#checkoutShell').evaluate(form => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(submissionBlocked).toBe(true);
  expect(orderRequests).toHaveLength(0);
});


test('unknown status fails closed until verified, remains truthful in both languages, and recovers when enabled', async ({ page }) => {
  let releaseStatus;
  const statusGate = new Promise(resolve => { releaseStatus = resolve; });
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    if (path === 'platform.publicStatus') {
      await statusGate;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ result: { data: { json: { orderingEnabled: true, banner: null, incidents: [] } } } })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"result":{"data":{"json":{}}}}' });
  });

  await page.goto('/');
  await expect(page.locator('#aePlatformStatus')).toContainText('Unable to verify ordering status');
  await expect(page.locator('#aePlatformStatus')).toContainText('Ordering is unavailable');
  await expect(page.locator('#aePlatformStatus')).not.toContainText('paused');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-label', 'Ordering unavailable');
  await expect(page.locator('.ae-cart')).not.toHaveAttribute('href', '/checkout');
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  await expect(page.locator('.lang')).toBeEnabled();
  await expect(page.locator('#aeHomeAreaForm')).toHaveAttribute('action', '/restaurants');

  await page.evaluate(() => { document.documentElement.lang = 'fa'; });
  await expect(page.locator('#aePlatformStatus')).toContainText('وضعیت ثبت سفارش بررسی نشد');
  await expect(page.locator('#aePlatformStatus')).toContainText('ثبت سفارش فعلاً در دسترس نیست');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-label', 'ثبت سفارش در دسترس نیست');

  releaseStatus();
  await expect(page.locator('body')).toHaveAttribute('data-ordering-available', 'true');
  await expect(page.locator('#aePlatformStatus')).toHaveCount(0);
  await expect(page.locator('.ae-cart')).toHaveAttribute('href', '/checkout');
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#aeHomeArea')).toBeEnabled();
});
