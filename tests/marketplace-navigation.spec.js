const { test, expect } = require('@playwright/test');

const departmentPaths = [
  '/restaurants',
  '/groceries',
  '/health-beauty',
  '/convenience',
  '/gifts',
  '/electronics',
  '/pet-supplies',
];

const comingSoon = ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies'];

test('shared marketplace tabs present seven first-level departments and keep six closed', async ({ page }) => {
  await page.goto('/groceries');
  const nav = page.locator('#aeMarketplaceTabs');
  await expect(nav).toBeVisible();
  await expect(nav.locator('a')).toHaveCount(7);
  await expect(nav).toHaveAttribute('aria-label', 'Marketplace departments');
  const actualDepartmentPaths = await nav.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(actualDepartmentPaths).toEqual(departmentPaths);
  await expect(nav.locator('a[data-department="groceries"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.navlinks a[href="/restaurants"]')).toHaveCount(0);
  await expect(page.locator('.mobile-nav a[href="/restaurants"]')).toHaveCount(0);
  await expect(page.locator('body')).toHaveClass(/ae-marketplace-mobile-nav-compact/);

  for (const slug of comingSoon) {
    await expect(nav.locator(`a[data-department="${slug}"] .ae-marketplace-tab__status .en-copy`)).toHaveText('Coming soon');
  }
  await expect(nav.locator('a[data-department="restaurants"] .ae-marketplace-tab__status .en-copy')).toHaveText('Browse menus');
  await expect(nav.locator('a[href*="alcohol"]')).toHaveCount(0);
});

test('mobile marketplace rail scrolls to every peer department', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/groceries');
  const track = page.locator('.ae-marketplace-tabs__track');
  await expect(track).toHaveCSS('overflow-x', 'auto');
  const widths = await track.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(widths.scroll).toBeGreaterThan(widths.client);
  await track.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(() => track.locator('a').last().evaluate(element => {
    const right = element.getBoundingClientRect().right;
    const edge = element.parentElement.getBoundingClientRect().right;
    return right <= edge + 1;
  })).toBe(true);
});

test('desktop header shows all seven peer choices without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/groceries');
  const track = page.locator('.ae-marketplace-tabs__track');
  await expect(track.locator('a')).toHaveCount(7);
  const widths = await track.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test('department tabs mark their own page and remain navigable', async ({ page }) => {
  for (const route of ['/groceries', '/health-beauty', '/convenience', '/gifts', '/electronics', '/pet-supplies']) {
    await page.goto(route);
    await expect(page.locator('#aeMarketplaceTabs a[aria-current="page"]')).toHaveAttribute('href', route);
  }
  await page.locator('#aeMarketplaceTabs a[href="/health-beauty"]').click();
  await expect(page).toHaveURL(/\/health-beauty$/);
});

test('language switch shows flags only while exposing a localized accessible name', async ({ page }) => {
  await page.goto('/groceries');
  const languageButton = page.locator('button[data-department-language]');
  await expect(languageButton).toHaveAttribute('aria-label', 'Switch language to Dari');
  const dariFlag = await languageButton.evaluate(element => getComputedStyle(element, '::before').content);
  expect(dariFlag).toContain('🇦🇫');
  await expect(languageButton).toHaveCSS('font-size', '0px');

  await languageButton.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(languageButton).toHaveAttribute('aria-label', 'تغییر زبان به انگلیسی');
  await expect(page.locator('#aeMarketplaceTabs')).toHaveAttribute('aria-label', 'بخش‌های فروشگاه');
  const englishFlag = await languageButton.evaluate(element => getComputedStyle(element, '::before').content);
  expect(englishFlag).toContain('🇬🇧');
});
