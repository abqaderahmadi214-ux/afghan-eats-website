const { test, expect } = require('@playwright/test');

const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const LOCAL_HOME = 'http://127.0.0.1:4173/';

async function newIPhonePage(browser, { dari = false, standalone = false } = {}) {
  const context = await browser.newContext({
    userAgent: IPHONE_SAFARI_UA,
    viewport: { width: 390, height: 844 }
  });
  await context.addInitScript(({ dari, standalone }) => {
    if (dari) localStorage.setItem('ae_lang', 'fa');
    if (standalone) {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true
      });
    }
  }, { dari, standalone });
  return { context, page: await context.newPage() };
}

test('homepage exposes a valid root-scoped manifest and all declared PNG icons', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Afghan Eats');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0D4A3A');

  const response = await request.get('/manifest.json');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#0D4A3A');
  expect(manifest.background_color).toBe('#FFF8ED');
  expect(manifest.lang).toBe('en-AF');
  expect(manifest.dir).toBe('ltr');

  for (const icon of manifest.icons) {
    expect(icon.type).toBe('image/png');
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.status(), `${icon.src} should be published`).toBe(200);
    const bytes = await iconResponse.body();
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
});

test('an iPhone visitor gets explicit Safari Add to Home Screen steps and no fake one-tap install', async ({ browser }) => {
  const { context, page } = await newIPhonePage(browser);
  try {
    await page.goto(LOCAL_HOME, { waitUntil: 'domcontentloaded' });
    const guide = page.locator('#aePwaInstall');
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute('role', 'region');
    await expect(guide).toContainText('Safari');
    await expect(guide).toContainText('Share');
    await expect(guide).toContainText('Add to Home Screen');
    await expect(guide).toContainText('Open as Web App');
    await expect(guide).toContainText('internet connection');
    await expect(guide.locator('[data-pwa-install]')).toHaveCount(0);

    await guide.locator('[data-pwa-later]').click();
    await expect(guide).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('ae_pwa_install_dismissed'))).toBe('1');
  } finally {
    await context.close();
  }
});

test('the iPhone install guidance follows the selected Dari language', async ({ browser }) => {
  const { context, page } = await newIPhonePage(browser, { dari: true });
  try {
    await page.goto(LOCAL_HOME, { waitUntil: 'domcontentloaded' });
    const guide = page.locator('#aePwaInstall');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('افغان ایتس');
    await expect(guide).toContainText('Safari');
    await expect(guide).toContainText('Add to Home Screen');
    await expect(guide).toContainText('اینترنت');
  } finally {
    await context.close();
  }
});

test('an already-installed iPhone web app does not show the install guide', async ({ browser }) => {
  const { context, page } = await newIPhonePage(browser, { standalone: true });
  try {
    await page.goto(LOCAL_HOME, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#aePwaInstall')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('the homepage shows the existing bilingual QR callout on desktop with an accessible image', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const section = page.locator('#aeDesktopInstall');
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { level: 2 })).toContainText('Scan to open Afghan Eats on your phone');
  await expect(section.locator('h2 .fa-copy')).toContainText('برای باز کردن افغان ایتس در تلفن‌تان اسکن کنید');

  const qr = section.locator('img');
  await expect(qr).toHaveAttribute('src', '/assets/qr/afghan-eats-homepage.png');
  await expect(qr).toHaveAttribute('alt', 'QR code linking to Afghan Eats at https://afghaneats.net/');
  await expect(qr).toBeVisible();
  const imageResponse = await request.get('/assets/qr/afghan-eats-homepage.png');
  expect(imageResponse.status()).toBe(200);
  expect(await qr.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
});

test('the QR callout is hidden on narrow screens so iPhone visitors can use Safari guidance', async ({ browser }) => {
  const { context, page } = await newIPhonePage(browser);
  try {
    await page.goto(LOCAL_HOME, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#aeDesktopInstall')).toBeHidden();
    await expect(page.locator('#aePwaInstall')).toBeVisible();
    await expect(page.locator('#aePwaInstall')).toContainText('Add to Home Screen');
  } finally {
    await context.close();
  }
});

test('the browser install prompt remains available when beforeinstallprompt fires', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });

  const guide = page.locator('#aePwaInstall');
  await expect(guide).toBeVisible();
  await expect(guide.locator('[data-pwa-install]')).toBeVisible();
});

test('the service worker registers at the site root and caches no HTML or customer data', async ({ page }) => {
  await page.goto('/');
  const scope = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe('http://127.0.0.1:4173/');

  await page.evaluate(async () => {
    try {
      await fetch('/data/fallback-restaurants.json', { cache: 'no-store' });
    } catch {
      // The assertion below is about service-worker storage, not network success.
    }
  });
  const cachedPaths = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const paths = [];
    for (const name of cacheNames) {
      if (!name.startsWith('afghan-eats-')) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });

  expect(cachedPaths).toContain('/manifest.json');
  expect(cachedPaths.some(path => path.startsWith('/assets/'))).toBe(true);
  expect(cachedPaths).not.toContain('/');
  expect(cachedPaths).not.toContain('/index.html');
  expect(cachedPaths).not.toContain('/restaurants.html');
  expect(cachedPaths).not.toContain('/checkout.html');
  expect(cachedPaths).not.toContain('/orders.html');
  expect(cachedPaths).not.toContain('/account.html');
  expect(cachedPaths).not.toContain('/data/fallback-restaurants.json');
  expect(cachedPaths.every(path => path === '/manifest.json' || path.startsWith('/assets/'))).toBe(true);
});
