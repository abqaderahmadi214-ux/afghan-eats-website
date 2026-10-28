const { test, expect } = require('@playwright/test');

test('premium home keeps its local discovery paths clear in English and Dari at mobile and desktop widths', async ({ page }) => {
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    const data = path === 'platform.publicStatus'
      ? {
          orderingEnabled: false,
          orderingMessageEn: 'New ordering is temporarily paused. Please try again later.',
          orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
          banner: null,
          incidents: []
        }
      : {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ result: { data: { json: data } } })
    });
  });

  await page.goto('/');
  const strip = page.locator('.ae-value-strip');
  await expect(strip).toContainText('Made for Herat');
  await expect(strip).toContainText('English + Dari');
  await expect(strip).toContainText('Follow your order');
  await expect(strip.locator('a[href="/restaurants"]')).toBeVisible();
  await expect(strip.locator('a[href="/orders"]')).toBeVisible();
  await expect(page.locator('#aePlatformStatus.critical')).toBeVisible();
  await expect(page.locator('.ae-order-box .mode-tabs button').first()).toBeDisabled();

  const pauseBackground = await page.locator('#aePlatformStatus.critical').evaluate(el => getComputedStyle(el).backgroundImage);
  expect(pauseBackground).toContain('linear-gradient');

  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(strip).toContainText('ساخته‌شده برای هرات');
  await expect(strip).toContainText('انگلیسی + دری');
  await expect(strip).toContainText('سفارش خود را پیگیری کنید');
  const languageButton = page.locator('.ae-value-strip button');
  await expect(languageButton).toBeVisible();

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  }

  await languageButton.click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.ae-value-strip')).toContainText('Made for Herat');
});
