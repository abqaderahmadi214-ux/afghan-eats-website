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

test('home keeps address-first public discovery and one shared seven-choice department rail', async ({ page }) => {
  await stubPublicApi(page);
  await page.goto('/');

  await expect(page.locator('.ae-hero')).toBeVisible();
  await expect(page.locator('.ae-hero img, .ae-hero video, .ae-hero-visual')).toHaveCount(0);
  await expect(page.locator('img[src*="afghan-feast"]')).toHaveCount(0);
  await expect(page.locator('.ae-hero-copy h1')).toBeVisible();
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#aeHomeAreaForm')).toHaveAttribute('action', '/restaurants');
  await expect(page.locator('#aeHomeAreaForm')).toHaveAttribute('method', 'get');
  const fields = await page.locator('#aeHomeAreaForm input').evaluateAll(nodes => nodes.map(node => ({ id: node.id, name: node.name })));
  expect(fields).toEqual([{ id: 'aeHomeArea', name: 'area' }, { id: 'aeHomeSearch', name: 'q' }]);
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('aria-label', 'Search restaurants, items, and categories');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Public menus remain available to browse');

  const departments = page.locator('#aeMarketplaceTabs');
  await expect(departments).toBeVisible();
  await expect(departments).toHaveAttribute('aria-label', 'Department links');
  await expect(departments.locator('[data-department]')).toHaveCount(7);
  const keys = await departments.locator('.ae-marketplace-tabs__track > [data-department]').evaluateAll(nodes => nodes.map(node => node.dataset.department));
  expect(keys).toEqual(['restaurants', 'groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']);
  await expect(page.locator('.ae-home-department-nav, .ae-department-tile')).toHaveCount(0);
  await expect(departments.locator('[data-department="restaurants"]')).toContainText('Browse menus');
  for (const key of keys.slice(1)) await expect(departments.locator(`[data-department="${key}"]`)).toContainText('Coming soon');
  await expect(departments.locator('[data-department="alcohol"]')).toHaveCount(0);
  await expect(page.locator('.ae-home-business-link')).toBeVisible();
});

test('mobile home puts area before search, scrolls the department rail, and respects reduced motion', async ({ page }) => {
  await stubPublicApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('#aeOrderingPauseContext')).toContainText('paused');
  await expect(page.locator('.ae-hero-copy h1')).toBeVisible();
  await expect(page.locator('#aeHomeArea')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  await expect(page.locator('.ae-home-business-link')).toBeVisible();
  const positions = await page.evaluate(() => ({
    area: document.querySelector('#aeHomeArea').getBoundingClientRect().top,
    search: document.querySelector('#aeHomeSearch').getBoundingClientRect().top
  }));
  expect(positions.area).toBeLessThan(positions.search);
  const rail = await page.locator('.ae-marketplace-tabs__track').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(rail.scroll).toBeGreaterThan(rail.client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const motion = await page.evaluate(() => ({
    enabled: document.documentElement.classList.contains('ae-motion-enabled'),
    buttonTransition: getComputedStyle(document.querySelector('#aeHomeAreaSubmit')).transitionDuration,
    buttonTransform: getComputedStyle(document.querySelector('#aeHomeAreaSubmit')).transform
  }));
  expect(motion.enabled).toBe(false);
  expect(motion.buttonTransition).toBe('0s');
  expect(motion.buttonTransform).toBe('none');
});

test('motion-enabled homepage reveals the organization panel when it enters view', async ({ page }) => {
  await stubPublicApi(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/ae-motion-enabled/);
  const panel = page.locator('.ae-home-business-card');
  await expect(panel).toHaveClass(/ae-motion-reveal/);
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveClass(/ae-motion-visible/);
  await expect(panel).toBeVisible();
});
