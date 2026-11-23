const { test, expect } = require('@playwright/test');

const paused = { orderingEnabled: false, orderingMessageEn: 'New ordering is temporarily paused.', orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.', banner: null, incidents: [] };
async function stubPublicApi(page) {
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    const data = endpoint === 'platform.publicStatus' ? paused : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ result: { data: { json: data } } }) });
  });
}

test('sample app-screen hero video and category artwork load without attributing them to a restaurant', async ({ page }) => {
  await stubPublicApi(page);
  await page.goto('/');
  const hero = page.locator('.ae-hero-visual video.ae-feast');
  await expect(hero).toHaveAttribute('poster', /afghan-eats-hero-poster[.]webp/);
  await expect(hero).toHaveAttribute('muted', '');
  await expect(hero).toHaveAttribute('loop', '');
  await expect(hero).toHaveAttribute('playsinline', '');
  await expect(hero.locator('source')).toHaveAttribute('src', '/assets/video/afghan-eats-hero-journey.mp4?v=app-preview-20261123');
  await expect(hero).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.ae-hero-accent')).toBeHidden();
  const videoBox = await hero.boundingBox();
  const captionBox = await page.locator('.ae-hero-visual figcaption').boundingBox();
  expect(captionBox.y).toBeGreaterThanOrEqual(videoBox.y + videoBox.height);
  await expect(page.locator('.ae-hero-visual figcaption')).toContainText(/simulated cash-only checkout/i);
  await expect(page.locator('.ae-hero-visual figcaption')).toContainText(/new orders remain paused/i);
  await expect(page.locator('.ae-hero-visual figcaption strong .fa-copy')).toContainText('ثبت سفارش جدید متوقف است');
  const control = page.locator('[data-hero-video-toggle]');
  await expect(control).toBeVisible();
  await expect.poll(() => hero.evaluate(video => video.readyState > 0 && !video.paused), { timeout: 10000 }).toBe(true);
  await expect(control).toHaveAccessibleName('Pause sample app preview');
  await control.click();
  await expect(hero).toHaveJSProperty('paused', true);
  await expect(control).toHaveAccessibleName('Play sample app preview');
  await control.click();
  await expect.poll(() => hero.evaluate(video => !video.paused), { timeout: 10000 }).toBe(true);
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
  await expect(hero).toHaveCSS('object-fit', 'contain');
  const captionBox = await page.locator('.ae-hero-visual figcaption').boundingBox();
  expect(captionBox.y).toBeGreaterThanOrEqual(box.y + box.height);
  await expect(hero).toHaveJSProperty('paused', true);
  await expect(page.locator('[data-hero-video-toggle]')).toHaveAccessibleName('Play sample app preview');
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
