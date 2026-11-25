const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { chromium } = require('@playwright/test');

const [baseline, candidate, output] = process.argv.slice(2).map(p => path.resolve(p));
const mobile = { width: 390, height: 844 };
const apiHost = 'afghaneats-api.onrender.com';
const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', woff2: 'font/woff2', ico: 'image/x-icon' };
const fixtures = {
  'restaurants.list': [],
  'restaurants.listBrowsePreviews': [],
  'restaurants.getBrowseMenu': { categories: [], items: [] },
  'restaurants.getMenu': { categories: [], items: [] },
  'platform.publicStatus': {
    orderingEnabled: false, orderingMessageEn: 'New ordering is temporarily paused.',
    orderingMessageDari: 'ثبت سفارش جدید موقتاً متوقف است.', banner: null, incidents: []
  }
};

async function serve(root) {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const publicRoot = pathname.startsWith('/data/') ? baseline : root;
      if (pathname.split('/').some(part => part.startsWith('.'))) throw new Error();
      let file = path.join(publicRoot, pathname);
      if (pathname.endsWith('/')) file = path.join(file, 'index.html');
      if (!path.extname(file)) file += '.html';
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

async function session(browser, origin, viewport, language) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    const procedure = url.pathname.split('/').pop();
    if (url.host === apiHost && route.request().method() === 'GET' && Object.hasOwn(fixtures, procedure)) {
      return route.fulfill({ json: { result: { data: { json: fixtures[procedure] } } }, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.abort();
  });
  await ctx.addInitScript(lang => localStorage.setItem('ae_lang', lang), language);
  return { ctx, page: await ctx.newPage() };
}

async function measure(browser, origin) {
  const { ctx, page } = await session(browser, origin, mobile, 'en');
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 80, downloadThroughput: 250000, uploadThroughput: 125000
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0;
    cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
    await page.addInitScript(() => {
      window.metrics = { lcpMs: null, cls: 0 };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.metrics.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      let start = -Infinity, last = -Infinity, sum = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (entry.startTime - last >= 1000 || entry.startTime - start >= 5000) {
            start = entry.startTime;
            sum = 0;
          }
          last = entry.startTime;
          sum += entry.value;
          window.metrics.cls = Math.max(window.metrics.cls, sum);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(origin, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(5000);
    const result = await page.evaluate(() => window.metrics);
    if (result.lcpMs === null) throw new Error('Chromium did not report LCP');
    return { ...result, bytes };
  } finally { await ctx.close(); }
}

async function capture(browser, origin, build, language, viewport, menuPath) {
  const { ctx, page } = await session(browser, origin, viewport, language);
  const rows = [];
  try {
    for (const [surface, url] of Object.entries({ home: '/', discovery: '/restaurants', menu: menuPath })) {
      await page.goto(origin + url, { waitUntil: 'load' });
      if (surface === 'home') await page.locator('#homeRestaurants a[href*="restaurant"]').first().waitFor();
      if (surface === 'menu') await page.locator('h1:visible').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const layout = await page.evaluate(() => ({
        direction: document.documentElement.dir, overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        heading: document.querySelector('h1')?.innerText || ''
      }));
      const screenshot = [build, language, viewport.width, surface].join('-') + '.png';
      await page.screenshot({ path: path.join(output, screenshot) });
      rows.push({ build, language, width: viewport.width, surface, screenshot, ...layout });
    }
  } finally { await ctx.close(); }
  return rows;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const a = await serve(baseline), b = await serve(candidate);
  const origins = { baseline: a.origin, candidate: b.origin };
  let browser;
  try {
    browser = await chromium.launch({ args: ['--disable-background-networking'] });
    const samples = { baseline: [], candidate: [] }, captures = [];
    for (let round = 0; round < 3; round++) {
      const builds = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
      for (const build of builds) samples[build].push(await measure(browser, origins[build]));
    }
    const { ctx, page } = await session(browser, a.origin, mobile, 'en');
    await page.goto(a.origin);
    const link = page.locator('#homeRestaurants a[href*="restaurant"]').first();
    await link.waitFor();
    const menuUrl = new URL(await link.getAttribute('href'), a.origin);
    await ctx.close();
    for (const [build, origin] of Object.entries(origins)) {
      for (const lang of ['en', 'fa']) {
        for (const size of [mobile, { width: 1440, height: 900 }]) {
          captures.push(...await capture(browser, origin, build, lang, size, menuUrl.pathname + menuUrl.search));
        }
      }
    }
    const median = (rows, key) => rows.map(row => row[key]).sort((a, b) => a - b)[1];
    const lines = ['# Homepage lab comparison', '', 'Fresh Chromium contexts, English, 390 × 844, 4× CPU slowdown, 2 Mbps download, 80 ms simulated latency. Three runs per build. Measurements end five seconds after load. Bytes count completed network transfers in Chromium. Local servers serve uncompressed files, identical directory data and a paused API fixture. Remote images, fonts and services are blocked. Production timings can differ.', '', '| Build | Median LCP (ms) | Median CLS | Median bytes |', '| --- | ---: | ---: | ---: |'];
    for (const [build, rows] of Object.entries(samples)) lines.push('| ' + [build, median(rows, 'lcpMs').toFixed(0), median(rows, 'cls').toFixed(4), median(rows, 'bytes')].join(' | ') + ' |');
    lines.push('', 'Screenshots cover the homepage, discovery and the same directory entry in English and Dari. See measurements.json for the individual samples, viewport overflow, direction and headings.');
    await fs.writeFile(path.join(output, 'comparison.md'), lines.join('\n') + '\n');
    await fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify({ samples, captures, menu: menuUrl.pathname + menuUrl.search }, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
    if (captures.some(row => row.build === 'candidate' && (row.overflowPx > 1 || (row.language === 'fa' && row.direction !== 'rtl')))) throw new Error('Candidate layout exceeded viewport or lacked Dari RTL. Inspect measurements.json.');
  } finally {
    if (browser) await browser.close();
    a.server.close(); b.server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
