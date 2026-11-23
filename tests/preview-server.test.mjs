import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/preview-server.mjs';

async function rawRequest(base, path, options = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path, method: options.method || 'GET', headers: options.headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function withServer(run, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'ae-preview-server-'));
  let server;
  try {
    await mkdir(join(root, 'assets'), { recursive: true });
    await mkdir(join(root, 'data'), { recursive: true });
    await writeFile(join(root, 'index.html'), '<h1>Public home</h1>');
    await writeFile(join(root, 'restaurant.html'), '<h1>Public restaurant page</h1>');
    await writeFile(join(root, 'assets', 'app.js'), 'window.publicApp = true;');
    await writeFile(join(root, 'data', 'fallback-restaurants.json'), '[]');
    for (const path of ['.git/config', 'node_modules/pkg/index.js', 'tests/private.txt', 'scripts/private.mjs', 'artifacts/proof.png', 'visual-proof/capture.png']) {
      const file = join(root, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, 'private');
    }
    server = createPreviewServer({ root, ...options });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`, root);
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

test('serves intended web files and blocks private project paths and dotfiles', async () => {
  await withServer(async base => {
    for (const path of ['/', '/restaurant', '/restaurant.html', '/assets/app.js', '/data/fallback-restaurants.json']) {
      assert.equal((await fetch(`${base}${path}`)).status, 200, path);
    }
    for (const path of [
      '/.git/config', '/node_modules/pkg/index.js', '/tests/private.txt', '/scripts/private.mjs',
      '/artifacts/proof.png', '/visual-proof/capture.png', '/.env', '/unknown.json', '/admin-reset.html'
    ]) assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    assert.equal((await fetch(`${base}/restaurant`)).headers.get('content-type'), 'text/html; charset=utf-8');
  });
});

test('blocks traversal and symlinks that resolve outside the public root', async () => {
  await withServer(async (base, root) => {
    const outside = join(root, '..', `ae-preview-outside-${Date.now()}.txt`);
    try {
      await writeFile(outside, 'outside root secret');
      await symlink(outside, join(root, 'assets', 'escape.txt'));
      for (const path of ['/../package.json', '/%2e%2e/package.json', '/assets/escape.txt', '/assets/%2e%2e/index.html', '/assets/%2fetc/passwd']) {
        assert.equal((await rawRequest(base, path)).status, 404, path);
      }
    } finally {
      await rm(outside, { force: true });
    }
  });
});

test('proxies only exact anonymous GET read shapes and never forwards caller credentials', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url: new URL(url), options });
    return new Response(JSON.stringify({ result: { data: { json: { categories: [], items: [{ id: 'dish-1' }] } } } }), {
      status: 200, headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  };
  await withServer(async base => {
    const payload = encodeURIComponent(JSON.stringify({ json: { restaurantId: 'char-fasl-food-complex' } }));
    const result = await fetch(`${base}/api/trpc/restaurants.getBrowseMenu?input=${payload}`, {
      headers: { Cookie: 'session=secret', Authorization: 'Bearer secret', 'X-Anything': 'private' }
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).result.data.json.items[0].id, 'dish-1');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url.pathname, '/api/trpc/restaurants.getBrowseMenu');
    assert.equal(seen[0].options.method, 'GET');
    assert.deepEqual(seen[0].options.headers, { Accept: 'application/json' });
    assert.equal(seen[0].options.body, undefined);
    assert.equal(seen[0].options.redirect, 'error');

    for (const path of [
      '/api/trpc/restaurants.getMenu?input=' + encodeURIComponent(JSON.stringify({ json: { restaurantId: 'd490f576-1690-42c9-a548-c58831a07b9c' } })),
      '/api/trpc/restaurants.getById?input=' + encodeURIComponent(JSON.stringify({ json: { id: 'char-fasl-restaurant' } }))
    ]) assert.equal((await fetch(`${base}${path}`)).status, 200);
    assert.equal(seen.length, 3);
    assert(seen.some(call => call.url.pathname.endsWith('/restaurants.getMenu')));
    assert(seen.some(call => call.url.pathname.endsWith('/restaurants.getById')));
  }, { fetchImpl });
});

test('rejects writes, unlisted procedures and malformed or expanded inputs before upstream access', async () => {
  let calls = 0;
  await withServer(async base => {
    const valid = encodeURIComponent(JSON.stringify({ json: { restaurantId: 'char-fasl-food-complex' } }));
    assert.equal((await fetch(`${base}/api/trpc/orders.place?input=${valid}`)).status, 404);
    assert.equal((await fetch(`${base}/api/trpc/orders.place?input=${valid}`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/api/trpc/restaurants.getMenu?input=${valid}`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/api/trpc/restaurants.getMenu?input=${encodeURIComponent('{bad')}`)).status, 400);
    assert.equal((await fetch(`${base}/api/trpc/restaurants.getMenu?input=${encodeURIComponent(JSON.stringify({ json: { restaurantId: 'ok', extra: true } }))}`)).status, 400);
    assert.equal((await fetch(`${base}/api/trpc/restaurants.list?input=${valid}&other=x`)).status, 400);
    assert.equal((await fetch(`${base}/api/trpc/restaurants.getMenu?input=${encodeURIComponent(JSON.stringify({ json: { restaurantId: '../../etc/passwd' } }))}`)).status, 400);
    assert.equal(calls, 0);
  }, { fetchImpl: async () => { calls++; throw new Error('must not be called'); } });
});

test('Playwright loads requested live and browse-only menus when the public list exceeds the fallback race', { timeout: 60_000 }, async () => {
  const mainRestaurant = {
    id: 'd490f576-1690-42c9-a548-c58831a07b9c', slug: 'char-fasl-restaurant',
    name: 'Char Fasl Restaurant', status: 'active', is_open: true, listing_mode: null,
    verification_status: 'public_seeded', partnership_status: 'prospect', public_menu_item_count: 1,
    has_delivery: true, has_takeaway: true, cuisine_tags: ['Afghan']
  };
  const previewRestaurant = {
    id: 'char-fasl-food-complex', slug: 'char-fasl-food-complex', name: 'Char Fasl Food Complex',
    status: 'active', is_open: false, listing_mode: 'directory', menu_preview_only: true,
    verification_status: 'public_seeded', partnership_status: 'prospect', public_menu_item_count: 1,
    phone: '+93 798 811 414', cuisine_tags: ['Afghan']
  };
  const category = { id: 'test-category', name: 'Test category', name_dari: null };
  const mainMenu = { categories: [category], items: [{ id: 'main-dish', category_id: category.id, name: 'Live Char Fasl Dish', price: 300, is_available: true }] };
  const previewMenu = { categories: [category], items: [{ id: 'preview-dish', category_id: category.id, name: 'Browse-only Char Fasl Dish', price: 200, is_available: false }] };
  const calls = [];
  const fetchImpl = async url => {
    const parsed = new URL(url);
    const procedure = parsed.pathname.slice('/api/trpc/'.length);
    const input = JSON.parse(parsed.searchParams.get('input')).json;
    calls.push({ procedure, input });
    if (procedure === 'restaurants.list') await new Promise(resolve => setTimeout(resolve, 2200));
    const data = {
      'restaurants.list': [mainRestaurant, previewRestaurant],
      'restaurants.listBrowsePreviews': [{ id: previewRestaurant.id, menu_item_count: 1 }],
      'restaurants.getMenu': mainMenu,
      'restaurants.getBrowseMenu': previewMenu,
      'restaurants.getById': input?.id === mainRestaurant.id ? mainRestaurant : null,
      'platform.publicStatus': { orderingEnabled: false, orderingMessageEn: 'Paused', incidents: [] }
    }[procedure] ?? [];
    return new Response(JSON.stringify({ result: { data: { json: data } } }), {
      status: 200, headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  };
  const server = createPreviewServer({ root: process.cwd(), fetchImpl });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const writes = [];
    page.on('request', request => {
      if (request.url().includes('/api/trpc/') && request.method() !== 'GET') writes.push(request.url());
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/restaurant.html?id=char-fasl-restaurant`);
    await page.locator('#storeHero h1').getByText('Char Fasl Restaurant').waitFor({ timeout: 20_000 });
    await page.locator('#menuContent').getByText('Live Char Fasl Dish', { exact: true }).waitFor({ timeout: 10_000 });
    assert(calls.some(call => call.procedure === 'restaurants.getMenu' && call.input.restaurantId === mainRestaurant.id));

    await page.goto(`${base}/restaurant.html?id=char-fasl-food-complex`);
    await page.locator('#storeHero h1').getByText('Char Fasl Food Complex').waitFor({ timeout: 20_000 });
    await page.locator('#menuContent').getByText('Browse-only Char Fasl Dish', { exact: true }).waitFor({ timeout: 10_000 });
    assert(calls.some(call => call.procedure === 'restaurants.getBrowseMenu' && call.input.restaurantId === previewRestaurant.id));
    assert.equal(writes.length, 0);
  } finally {
    await browser?.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});
