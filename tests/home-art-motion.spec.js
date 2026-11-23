const { test, expect } = require('@playwright/test');

const paused = { orderingEnabled: false, orderingMessageEn: 'New ordering is temporarily paused.', orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.', banner: null, incidents: [] };
async function stubPublicApi(page) {
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    const data = endpoint === 'platform.publicStatus' ? paused : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ result: { data: { json: data } } }) });
  });
}

test('original hero and category artwork load without attributing them to a restaurant', async ({ page }) => {
  await stubPublicApi(page);
  await page.goto('/');
  const hero = page.locator('.ae-hero-visual .ae-feast');
  await expect(hero).toHaveAttribute('alt', /Illustrative Afghan-style/);
  await expect.poll(() => hero.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const category of ['Kebab', 'Biryani', 'Sandwiches']) {
    const photo = page.locator('.ae-cuisine').filter({ hasText: category }).locator('img');
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute('alt', '');
    await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('#aePlatformStatus')).toContainText('paused');
});

test('mobile hero imagery is visible early and motion stops when reduced motion is requested', async ({ page }) => {
  await stubPublicApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#aePlatformStatus')).toContainText('paused');
  const hero = page.locator('.ae-hero-visual .ae-feast');
  const box = await hero.boundingBox();
  expect(box.y).toBeLessThan(350);
  expect(box.height).toBeGreaterThan(160);
  await expect(page.locator('.ae-browse-link')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  const animation = await page.locator('.ae-hero-visual').evaluate(el => getComputedStyle(el, '::before').animationName);
  expect(animation).toBe('none');
  const accentAnimation = await page.locator('.ae-hero-accent').evaluate(el => getComputedStyle(el).animationName);
  expect(accentAnimation).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('motion-enabled category cards reveal when brought into view', async ({ page }) => {
  await stubPublicApi(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/ae-motion-enabled/);
  const card = page.locator('.ae-cuisine').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/ae-motion-visible/);
  await expect(card).toBeVisible();
});
