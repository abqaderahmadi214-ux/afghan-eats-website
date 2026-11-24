const { test, expect } = require('@playwright/test');

async function stubPausedStatus(page) {
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
}

test('premium home is address-first, keeps peer department choices, and switches language', async ({ page }) => {
  await stubPausedStatus(page);
  await page.goto('/');

  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await expect(page.locator('#aeHomeArea')).toHaveAttribute('name', 'area');
  await expect(page.locator('#aeHomeSearch')).toBeVisible();
  await expect(page.locator('#aeHomeSearch')).toHaveAttribute('name', 'q');
  await expect(page.locator('.ae-home-business')).toHaveCount(1);
  await expect(page.locator('.ae-home-business-link[href="/organizations/"]')).toBeVisible();
  await expect(page.locator('#homeRestaurants')).toHaveCount(0);
  await expect(page.locator('.ae-value-strip')).toHaveCount(0);
  await expect(page.locator('#aeOrderingPauseContext')).toBeVisible();
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('New ordering is temporarily paused');
  await expect(page.locator('#aeOrderingPauseContext')).toContainText('Public menus remain available to browse');
  await expect(page.locator('.ae-cart')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.ae-order-box')).toHaveCount(0);
  await expect(page.locator('.lang')).toHaveAccessibleName('Switch language to Dari');

  const departments = page.locator('.ae-home-department-nav');
  await expect(departments).toBeVisible();
  const departmentKeys = await departments.locator('.ae-department-row > [data-department]').evaluateAll(cards => cards.map(card => card.dataset.department));
  expect(departmentKeys).toEqual(['restaurants', 'groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']);
  await expect(departments.locator('[data-department="alcohol"]')).toHaveCount(0);
  await expect(departments.locator('[data-department="restaurants"]')).toContainText('Browse menus');
  for (const key of ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies']) {
    await expect(departments.locator(`[data-department="${key}"]`)).toContainText('Coming soon');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#aeHomeAreaForm')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('ae_lang', 'fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#aeHomeAreaForm label .fa-copy')).toContainText('ناحیه یا نشانی نزدیک شما در هرات');
  await expect(page.locator('.lang')).toHaveAccessibleName('تغییر زبان به انگلیسی');
  await expect(page.getByRole('navigation', { name: 'بخش‌های فروشگاه' })).toBeVisible();
  await expect(departments.locator('[data-department="restaurants"]')).toContainText('رستورانت‌ها');
  const comingSoonDari = [
    ['groceries', 'مواد خوراکی'], ['health-beauty', 'صحت و زیبایی'], ['convenience', 'ضروریات روزانه'],
    ['gifts', 'هدایا'], ['electronics', 'لوازم الکترونیکی'], ['pet-supplies', 'لوازم حیوانات خانگی']
  ];
  for (const [key, label] of comingSoonDari) {
    const tile = departments.locator(`[data-department="${key}"]`);
    await expect(tile).toContainText(label);
    await expect(tile).toContainText('به‌زودی');
  }

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  }

  await page.locator('.lang').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.lang')).toHaveAccessibleName('Switch language to Dari');
});

test('primary site language controls show only flags and keep accessible toggle names', async ({ page }) => {
  await stubPausedStatus(page);
  for (const route of ['/', '/restaurants', '/organizations/index.html']) {
    await page.goto(route);
    const button = page.locator('button.lang');
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName('Switch language to Dari');
    await expect.poll(() => button.evaluate(element => getComputedStyle(element).fontSize)).toBe('0px');
    await expect.poll(() => button.evaluate(element => getComputedStyle(element, '::before').content)).toContain('🇦🇫');

    await button.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(button).toHaveAccessibleName('تغییر زبان به انگلیسی');
    await expect.poll(() => button.evaluate(element => getComputedStyle(element, '::before').content)).toContain('🇬🇧');

    await button.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(button).toHaveAccessibleName('Switch language to Dari');
    await expect.poll(() => button.evaluate(element => getComputedStyle(element, '::before').content)).toContain('🇦🇫');
  }
});

test('homepage area CTA hover feedback respects reduced-motion settings', async ({ page }) => {
  await page.route('https://afghaneats-api.onrender.com/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ result: { data: { json: {} } } })
  }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const department = page.locator('.ae-department-tile').first();
  const photo = department.locator('.ae-department-art img');
  await department.hover();
  await expect.poll(() => photo.evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  const areaButton = page.locator('#aeHomeAreaSubmit');
  await areaButton.hover();
  await expect.poll(() => areaButton.evaluate(el => getComputedStyle(el).transform)).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => photo.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await expect.poll(() => areaButton.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await expect.poll(() => photo.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await expect.poll(() => areaButton.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});
