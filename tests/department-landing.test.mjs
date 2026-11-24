import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const slugs = ['groceries', 'health-beauty', 'convenience', 'gifts', 'electronics', 'pet-supplies'];
const pages = Object.fromEntries(slugs.map(slug => [slug, read(`${slug}.html`)]));
const homepage = read('index.html');

test('each department has a complete bilingual, image-led landing page that remains closed to shoppers', () => {
  for (const slug of slugs) {
    const page = pages[slug];
    assert.match(page, /<body class="ae-premium premium-customer department-page">/, `${slug} uses the Afghan Eats site shell`);
    assert.match(page, new RegExp(`<link rel="canonical" href="https://afghaneats\\.net/${slug}">`), `${slug} has its canonical URL`);
    assert.match(page, new RegExp(`/assets/department-images/${slug}\\.jpg`), `${slug} uses its genuine category image`);
    assert.match(page, /Coming soon/);
    assert.match(page, /به‌زودی/);
    assert.match(page, /No public shops are listed yet/);
    assert.match(page, /There are no approved public shop listings in this department yet/);
    assert.match(page, /no retail order can be placed here/);
    assert.match(page, /https:\/\/afghaneats\.net\/department-partner\.html/);
    assert.match(page, /class="department-planned-title"/);
    assert.doesNotMatch(page, /\bAlcohol\b/i);
    assert.doesNotMatch(page, /fetch\s*\(|addToCart|data-product=|href="\/checkout"/i, `${slug} has no live shop or checkout behavior`);

    const peerNav = page.match(/<nav class="department-peer-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.match(peerNav, /href="\/restaurants"/);
    for (const peerSlug of slugs) assert.match(peerNav, new RegExp(`href="/${peerSlug}"`), `${slug} links to ${peerSlug} as a peer`);
    assert.equal((peerNav.match(/class="department-peer(?:\s|"|\[)/g) ?? []).length, 7, `${slug} has Restaurants plus six peer departments`);
  }
});

test('homepage keeps all marketplace departments as peers and links each Coming soon tile', () => {
  const departmentNav = homepage.match(/<nav class="ae-home-department-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.match(departmentNav, /<a class="ae-department-tile is-available" data-department="restaurants" href="\/restaurants">/);
  for (const slug of slugs) {
    assert.match(departmentNav, new RegExp(`<a class="ae-department-tile is-coming-soon" data-department="${slug}" href="/${slug}">`));
    assert.match(departmentNav, /Coming soon/);
    assert.doesNotMatch(departmentNav, new RegExp(`<button[^>]*data-department="${slug}"`));
  }
  assert.doesNotMatch(departmentNav, /data-department="alcohol"/i);
});

test('static route aliases, Render rewrites, and sitemap expose all six page URLs', () => {
  const redirects = read('_redirects').split(/\r?\n/);
  const render = JSON.parse(read('render-static-config.json'));
  const sitemap = read('sitemap.xml');
  for (const slug of slugs) {
    assert.ok(redirects.includes(`/${slug} /${slug}.html 200`), `${slug} has a static redirect alias`);
    assert.ok(render.routes.some(route => route.type === 'rewrite' && route.source === `/${slug}` && route.destination === `/${slug}.html`), `${slug} has a Render rewrite`);
    assert.ok(sitemap.includes(`<loc>https://afghaneats.net/${slug}</loc>`), `${slug} is in the sitemap`);
  }
});

test('department language toggle localizes accessible aria-label values', () => {
  let language = 'fa';
  const listenerMap = {};
  const labelElement = {
    dataset: { ariaEn: 'Marketplace departments', ariaFa: 'بخش‌های فروشگاه' },
    setAttribute(name, value) { this[name] = value; },
  };
  const button = {
    textContent: '',
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, listener) { listenerMap[name] = listener; },
  };
  const document = {
    documentElement: {},
    body: { classList: { toggle() {} } },
    querySelector(selector) { return selector === '[data-department-language]' ? button : null; },
    querySelectorAll() { return [labelElement]; },
  };
  const localStorage = {
    getItem() { return language; },
    setItem(key, value) { if (key === 'ae_lang') language = value; },
  };
  vm.runInNewContext(read('assets/department-landing.js'), { document, localStorage });
  assert.equal(document.documentElement.lang, 'fa');
  assert.equal(labelElement['aria-label'], 'بخش‌های فروشگاه');
  listenerMap.click();
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(labelElement['aria-label'], 'Marketplace departments');
});
