import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';

const outDir = 'diagnostic-output';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const android = devices['Pixel 5'];
const report = {
  generatedAt: new Date().toISOString(),
  production: {},
  hotfixPreview: {},
  orderMap: {},
  pwa: {}
};

function watched(url) {
  return /restaurants\.getMenu|restaurants\.list|orders\.quote|\/data\/(fallback-restaurants|public-herat-directory|researched-herat-restaurants)\.json/i.test(url);
}

async function testRestaurant(baseUrl, slug, label, screenshotName) {
  const context = await browser.newContext({ ...android });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const network = [];
  const responseTasks = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', error => {
    pageErrors.push(String(error?.stack || error?.message || error));
  });
  page.on('requestfailed', request => {
    if (watched(request.url())) {
      failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText || ''
      });
    }
  });
  page.on('response', response => {
    if (!watched(response.url())) return;
    const task = (async () => {
      let body = '';
      try {
        body = await response.text();
      } catch (error) {
        body = '[body unavailable: ' + String(error?.message || error) + ']';
      }
      network.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        contentType: response.headers()['content-type'] || '',
        body: body.slice(0, 8000)
      });
    })();
    responseTasks.push(task);
  });

  const url = `${baseUrl}/restaurant.html?id=${encodeURIComponent(slug)}`;
  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (error) {
    navigationError = String(error?.message || error);
  }

  try {
    await page.waitForFunction(() => {
      const loading = document.querySelector('#menuContent .menu-loading');
      const menuItems = document.querySelectorAll('#menuContent .menu-item').length;
      const error = document.querySelector('#menuContent .notice.error');
      return !loading || menuItems > 0 || Boolean(error);
    }, { timeout: 15000 });
  } catch {}

  await page.waitForTimeout(1500);
  await Promise.allSettled(responseTasks);

  const state = await page.evaluate(async () => {
    const loading = document.querySelector('#menuContent .menu-loading');
    const content = document.querySelector('#menuContent');
    const registrations = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    return {
      title: document.title,
      menuItems: document.querySelectorAll('#menuContent .menu-item').length,
      publicMenuItems: document.querySelectorAll('#menuContent .public-menu-item').length,
      menuLoadingPresent: Boolean(loading),
      menuLoadingVisible: Boolean(loading && getComputedStyle(loading).display !== 'none'),
      errorVisible: Boolean(document.querySelector('#menuContent .notice.error')),
      menuText: String(content?.innerText || '').trim().slice(0, 4000),
      serviceWorkers: registrations.map(reg => ({
        scope: reg.scope,
        scriptURL: reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      }))
    };
  });

  if (screenshotName) {
    await page.screenshot({ path: `${outDir}/${screenshotName}`, fullPage: true });
  }

  await context.close();
  return {
    label,
    url,
    navigationError,
    ...state,
    network,
    failedRequests,
    consoleMessages,
    pageErrors
  };
}

for (const [slug, label] of [
  ['darbar-herat', 'Darbar Herat'],
  ['mawlana-restaurant', 'Mawlana Restaurant'],
  ['char-fasl-restaurant', 'Char Fasl Restaurant']
]) {
  report.production[slug] = await testRestaurant(
    'https://afghaneats.net',
    slug,
    label,
    slug === 'darbar-herat' ? 'production-darbar-mobile.png' : null
  );
}

report.hotfixPreview['darbar-herat'] = await testRestaurant(
  'https://deploy-preview-83--afghaneats.netlify.app',
  'darbar-herat',
  'Darbar Herat hotfix preview',
  'hotfix-darbar-mobile.png'
);

async function inspectPage(url, screenshotName) {
  const context = await browser.newContext({ ...android });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(String(err?.stack || err?.message || err)));
  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (error) {
    navigationError = String(error?.message || error);
  }
  await page.waitForTimeout(2000);
  const state = await page.evaluate(async () => {
    const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    return {
      manifestHref: document.querySelector('link[rel="manifest"]')?.href || '',
      pwaBannerPresent: Boolean(document.getElementById('aePwaInstall')),
      serviceWorkers: regs.map(reg => ({
        scope: reg.scope,
        scriptURL: reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      })),
      riderMapPresent: Boolean(document.getElementById('riderMap')),
      leafletContainerPresent: Boolean(document.querySelector('.leaflet-container')),
      leafletMarkerCount: document.querySelectorAll('.leaflet-marker-icon').length,
      leafletTileCount: document.querySelectorAll('.leaflet-tile').length,
      riderMapText: document.getElementById('riderMapStatus')?.textContent?.trim() || ''
    };
  });
  if (screenshotName) await page.screenshot({ path: `${outDir}/${screenshotName}`, fullPage: true });
  await context.close();
  return { url, navigationError, ...state, consoleMessages, pageErrors };
}

report.orderMap.production = await inspectPage(
  'https://afghaneats.net/order.html?id=diagnostic-order',
  'production-order-mobile.png'
);
report.orderMap.preview80 = await inspectPage(
  'https://deploy-preview-80--afghaneats.netlify.app/order.html?id=diagnostic-order',
  'preview80-order-map-mobile.png'
);
report.pwa.production = await inspectPage(
  'https://afghaneats.net/',
  'production-home-mobile.png'
);
report.pwa.preview78 = await inspectPage(
  'https://deploy-preview-78--afghaneats.netlify.app/',
  'preview78-home-mobile.png'
);

await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log('===AFGHAN_EATS_DIAGNOSTIC===');
console.log(JSON.stringify(report, null, 2));
await browser.close();
