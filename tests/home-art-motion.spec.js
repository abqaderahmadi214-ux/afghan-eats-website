const { test, expect } = require('@playwright/test');

const paused = {
  orderingEnabled: false,
  orderingMessageEn: 'New ordering is temporarily paused.',
  orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.',
  banner: null,
  incidents: []
};

async function stubPublicApi(page) {
  await page.route('https://afghaneats-api.onrender.com/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    const data = endpoint === 'platform.publicStatus' ? paused : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ result: { data: { json: data } } })
    });
  });
}

test('home uses the Afghan food image and focused address-first copy, not a checkout-oriented video', async ({ page }) => {
  await stubPublicApi(page);
  await page.goto('/');

  const heroImage = page.locator('.ae-hero-visual img.ae-feast');
  await expect(heroImage).toHaveAttribute('src', '/assets/menu-item-images/darbar-herat-restaurant-koobideh-kebab-f427a616.jpg');
  await expect(heroImage).toHaveAttribute('alt', '');
  await expect(heroImage).toHaveCSS('object-fit', 'cover');
  await expect.poll(() => heroImage.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.ae-hero-visual video')).toHaveCount(0);
  await expect(page.locator('.ae-hero-accent')).toHaveCount(0);
  await expect(page.locator('.ae-hero-visual figcaption')).toContainText('Kebabs · Darbar Herat');
  await expect(page.locator('.ae-hero-visual figcaption')).not.toContainText(/checkout|rider tracking|new orders remain paused/i);
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('You can still browse menus');

  for (const department of ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']) {
    const photo = page.locator(`ae-market-orbit [data-department="${department}"]`).locator('..').locator('img');
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute('alt', '');
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('ae-market-orbit [data-department="alcohol"]')).toHaveCount(0);
});

test('mobile home puts area and search controls first, fits the viewport, and respects reduced motion', async ({ page }) => {
  await stubPublicApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('paused');
  await expect(page.locator('.ae-hero-copy h1')).toBeVisible();
  await expect(page.locator('#aeHomeArea')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  await expect(page.locator('.ae-home-business-link')).toBeVisible();
  const heroImage = page.locator('.ae-hero-visual .ae-feast');
  await expect(heroImage).toBeHidden();
  await expect(page.locator('#aeMarketplaceTabs')).toHaveCount(0);
  expect((await page.locator('.ae-restaurants').boundingBox()).y).toBeLessThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('desktop orbit can pause and replay', async ({ page }) => {
  await stubPublicApi(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/ae-motion-enabled/);
  await page.setViewportSize({width:1280,height:800});
  const orbit = page.locator('ae-market-orbit');
  await orbit.getByRole('button', {name:'Pause'}).click();
  await expect(orbit.getByRole('button', {name:'Play', exact:true})).toBeVisible();
  await orbit.getByRole('button', {name:'Replay'}).click();
  await expect(orbit.getByRole('button', {name:'Pause'})).toBeVisible();
});
