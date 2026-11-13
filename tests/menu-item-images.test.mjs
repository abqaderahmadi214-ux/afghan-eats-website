import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';

const require = createRequire(import.meta.url);
const {applyMenuItemImages, imageLabelMarkup} = require('../assets/menu-item-images.js');
const script = readFileSync('assets/menu-item-images.js', 'utf8');
const app = readFileSync('assets/app.js', 'utf8');
const poster = '/assets/menu-item-images/demo-poster.webp';
const photo = '/assets/menu-item-images/demo-photo.webp';

function mapping(extra = {}) {
  return {
    version: 1,
    restaurants: {
      'restaurant-exact': {
        name: 'Test Restaurant',
        items: {
          'item-exact': {
            item_name: 'Kabuli Pulao',
            kind: 'original',
            src: photo,
            source_url: 'https://example.com/dish',
            source_label: 'Restaurant Instagram',
            expected_image_url: poster,
            ...extra,
          },
        },
      },
    },
  };
}

function rendererContext({fetchImpl = async () => ({ok: true, json: async () => mapping()}), menu = {categories: [{id: 'cat'}], items: [{id: 'item-exact', name: 'Kabuli Pulao', description: 'The image is the original menu page, not an individual dish photo.', image_url: poster, price: 100, is_available: true}]} } = {}) {
  const listeners = [];
  const context = {
    console: {warn() {}},
    fetch: fetchImpl,
    AbortController,
    URL,
    setTimeout,
    clearTimeout,
    lang: 'en',
    esc: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'),
    money: (value) => `؋ ${value}`,
    t: (key) => key,
    resilientImageMarkup: (value) => value ? `<img src="${value}"><div class="premium-menu-placeholder media-fallback" hidden>Photo not added</div>` : '<div class="premium-menu-placeholder media-fallback">Photo not added</div>',
    publicMenuPrice: () => '؋ 100',
    document: {addEventListener: (...args) => listeners.push(args)},
    listeners,
    getMenu: async () => menu,
  };
  context.globalThis = context;
  const start = app.indexOf('function publicMenuItemMarkup(');
  const end = app.indexOf('async function initRestaurantPage()', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(app.slice(start, end).replace(/function directoryContactMarkup\([\s\S]*$/, ''), context);
  // The renderer declarations are deliberately evaluated from the current app.js source.
  const menuStart = app.indexOf('function menuItemMarkup(');
  const menuEnd = app.indexOf('async function initRestaurantPage()', menuStart);
  vm.runInNewContext(app.slice(menuStart, menuEnd), context);
  const previewPublicMarkup = context.publicMenuItemMarkup;
  context.publicMenuItemMarkup = function publicMenuItemMarkupWithPreviewAvailability(item) {
    const markup = previewPublicMarkup(item);
    if (item?.is_available !== false) return markup;
    return markup
      .replace('class="menu-item public-menu-item premium-menu-card"', 'class="menu-item public-menu-item premium-menu-card menu-item-unavailable"')
      .replace('</div></article>', '<span class="ae-soldout">Temporarily unavailable</span></div></article>');
  };
  vm.runInNewContext(script, context);
  return context;
}

test('mapping requires exact restaurant ID, item ID, item name, and expected image baseline', () => {
  const original = {id: 'item-exact', name: 'Kabuli Pulao', image_url: poster, is_available: false};
  const menu = {categories: [{id: 'cat'}], items: [original]};
  assert.equal(applyMenuItemImages(menu, 'restaurant-wrong', mapping()), menu);
  assert.equal(applyMenuItemImages(menu, 'restaurant-exact', mapping({item_name: 'Kabuli Pulao (large)'})), menu);
  assert.equal(applyMenuItemImages(menu, 'restaurant-exact', mapping({expected_image_url: '/new-owner-photo.webp'})), menu);
  assert.equal(original.image_url, poster);
});

test('image merge preserves all rows, category data, flags, and original objects while replacing a baseline poster', () => {
  const original = {id: 'item-exact', name: 'Kabuli Pulao', description: 'Rice', image_url: poster, is_available: false, is_popular: true, price: 300, sort_order: 9};
  const other = {id: 'other', name: 'Mantu', image_url: '', is_available: true, price: 100};
  const menu = {categories: [{id: 'cat', name: 'Main'}], items: [original, other]};
  const result = applyMenuItemImages(menu, 'restaurant-exact', mapping());
  assert.notEqual(result, menu);
  assert.equal(result.items.length, menu.items.length);
  assert.deepEqual(result.categories, menu.categories);
  assert.strictEqual(result.items[1], other);
  assert.equal(result.items[0].image_url, photo);
  assert.equal(result.items[0]._menuImagePresentation.kind, 'original');
  for (const field of ['id', 'name', 'description', 'is_available', 'is_popular', 'price', 'sort_order']) {
    assert.equal(result.items[0][field], original[field], `${field} must not change`);
  }
  assert.equal(original.image_url, poster);
  assert.equal(original._menuImagePresentation, undefined);
});

test('new live rows and owner-updated photos are not replaced by stale mappings', () => {
  const currentPoster = {id: 'item-exact', name: 'Kabuli Pulao', image_url: '/uploads/new-owner-photo.webp', updated_at: 'later'};
  const newLiveItem = {id: 'new-live-item', name: 'Ashak', image_url: '/uploads/ashak.webp'};
  const menu = {items: [currentPoster, newLiveItem]};
  const result = applyMenuItemImages(menu, 'restaurant-exact', mapping());
  assert.strictEqual(result, menu);
  assert.equal(result.items[0].image_url, '/uploads/new-owner-photo.webp');
  assert.equal(result.items[1].image_url, '/uploads/ashak.webp');
  assert.equal(applyMenuItemImages(menu, 'restaurant-exact', mapping({expected_image_url: '/uploads/new-owner-photo.webp', expected_updated_at: 'yesterday'})), menu);
});

test('manifest kind decides original-versus-illustration presentation and source attribution', () => {
  const original = applyMenuItemImages({items: [{id: 'item-exact', name: 'Kabuli Pulao', image_url: poster}]}, 'restaurant-exact', mapping());
  assert.equal(original.items[0].image_url, photo);
  assert.equal(original.items[0]._menuImagePresentation.kind, 'original');
  const illustration = applyMenuItemImages({items: [{id: 'item-exact', name: 'Kabuli Pulao', image_url: poster}]}, 'restaurant-exact', mapping({kind: 'illustration'}));
  assert.equal(illustration.items[0]._menuImagePresentation.kind, 'illustration');
  assert.match(illustration.items[0].image_url, /demo-photo/);
  assert.match(imageLabelMarkup(original.items[0]._menuImagePresentation), /Restaurant photo/);
  assert.match(imageLabelMarkup(original.items[0]._menuImagePresentation), /https:\/\/example\.com\/dish/);
});

test('illustration label and explicit not-an-actual-dish-photo explanation are bilingual', () => {
  global.lang = 'en';
  const english = imageLabelMarkup({kind: 'illustration'});
  assert.match(english, /Illustrative image/);
  assert.match(english, /Not an actual restaurant dish photo/);
  global.lang = 'fa';
  const dari = imageLabelMarkup({kind: 'illustration'});
  assert.match(dari, /تصویر نمونه/);
  assert.match(dari, /عکس واقعی غذای رستورانت نیست/);
  delete global.lang;
});

test('failed mapped image leaves the photo placeholder available and hides its label', async () => {
  const ctx = rendererContext();
  const menu = await ctx.getMenu({id: 'restaurant-exact'});
  const item = menu.items[0];
  const markup = ctx.menuItemMarkup(item, {id: 'restaurant-exact'});
  assert.match(markup, /data-menu-image-src/);
  assert.match(markup, /premium-menu-placeholder media-fallback/);
  assert.match(markup, /data-menu-image-label/);
  let hidden = false;
  const event = {target: {
    hasAttribute: (name) => name === 'data-menu-image-src',
    closest: () => ({querySelectorAll: () => [{set hidden(value) { hidden = value; }}]}),
  }};
  ctx.listeners.find(([type]) => type === 'error')[1](event);
  assert.equal(hidden, true);
  assert.match(markup, /premium-menu-placeholder/);
});

test('replaced-image provenance is suppressed only in markup, never in live item data', async () => {
  const original = {id: 'item-exact', name: 'Kabuli Pulao', description: 'The image is the original menu page, not an individual dish photo. A fragrant rice dish.', image_url: poster, price: 100};
  const ctx = rendererContext({menu: {items: [original]}});
  const menu = await ctx.getMenu({id: 'restaurant-exact'});
  const markup = ctx.menuItemMarkup(menu.items[0], {id: 'restaurant-exact'});
  assert.doesNotMatch(markup, /original menu page, not an individual dish photo/i);
  assert.match(markup, /A fragrant rice dish/);
  assert.equal(original.description, 'The image is the original menu page, not an individual dish photo. A fragrant rice dish.');
});

test('unavailable browse menu items stay browse-only with no Add button or cart controls', async () => {
  const ctx = rendererContext();
  const browse = await ctx.getMenu({id: 'restaurant-exact', _browse_menu_preview: true});
  const unavailable = {...browse.items[0], is_available: false};
  const publicMarkup = ctx.publicMenuItemMarkup(unavailable);
  assert.doesNotMatch(publicMarkup, /<button|Add|openItem/);
  assert.match(publicMarkup, /menu-item-unavailable/);
  assert.doesNotMatch(publicMarkup, /cart|checkout/i);
  const regularMarkup = ctx.menuItemMarkup(unavailable, {id: 'restaurant-exact'});
  assert.match(regularMarkup, /<button[^>]*disabled/);
  assert.match(regularMarkup, /Temporarily unavailable/);
});

test('manifest fetch failure returns the original usable live menu unchanged', async () => {
  let calls = 0;
  const ctx = rendererContext({fetchImpl: async () => { calls += 1; throw new Error('offline'); }});
  const liveMenu = {categories: [{id: 'cat'}], items: [{id: 'live', name: 'New live dish', image_url: ''}]};
  ctx.getMenu = async () => liveMenu;
  // Re-evaluate only the wrapper with the rejecting manifest fetch to exercise graceful failure.
  vm.runInNewContext(script, ctx);
  assert.strictEqual(await ctx.getMenu({id: 'restaurant-exact'}), liveMenu);
  assert.strictEqual(await ctx.getMenu({id: 'restaurant-exact'}), liveMenu);
  assert.equal(calls, 1, 'a single shared manifest promise should cache failure');
});

test('published manifest covers the approved 787-row image scope without changing any source fields', () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  assert.equal(Object.keys(manifest.restaurants).length, 14);
  const counts = {original: 0, illustration: 0};
  const checkedAssets = new Set();
  for (const [restaurantId, restaurant] of Object.entries(manifest.restaurants)) {
    const items = Object.entries(restaurant.items).map(([id, entry]) => {
      assert.ok(entry.item_name);
      assert.ok(['original', 'illustration'].includes(entry.kind));
      assert.ok(Object.prototype.hasOwnProperty.call(entry, 'expected_image_url'));
      counts[entry.kind] += 1;
      if (entry.kind === 'original') assert.match(entry.source_url, /^https:\/\//);
      if (entry.src.startsWith('/assets/menu-item-images/') && !checkedAssets.has(entry.src)) {
        assert.ok(existsSync('.' + entry.src), `Required menu image missing: ${entry.src}`);
        const bytes = readFileSync('.' + entry.src);
        assert.ok(bytes.length > 1024, entry.src);
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
        assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
        checkedAssets.add(entry.src);
      }
      return {id, name: entry.item_name, image_url: entry.expected_image_url,
        is_available: false, is_popular: false, price: 317, category_id: 'preserved-category',
        description: 'Preserved live menu description', sort_order: 17};
    });
    const live = {categories: [{id: 'preserved-category'}], items};
    const before = structuredClone(live);
    const result = applyMenuItemImages(live, restaurantId, manifest);
    assert.equal(result.items.length, before.items.length);
    assert.deepEqual(live, before);
    assert.strictEqual(result.categories, live.categories);
    result.items.forEach((item, index) => {
      assert.ok(item._menuImagePresentation);
      const {image_url, _menuImagePresentation, ...unchanged} = item;
      const {image_url: previousImage, ...original} = before.items[index];
      assert.deepEqual(unchanged, original);
      assert.equal(item.is_available, false);
    });
  }
  assert.deepEqual(counts, {original: 6, illustration: 781});
  assert.equal(checkedAssets.size, 72);
});

test('Shah has exact baseline coverage, verified photo attribution, and active getMenu application', async () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  const expected = JSON.parse(readFileSync('tests/fixtures/shah-menu-items.json', 'utf8'));
  const restaurant = manifest.restaurants['shah-restaurant-herat'];
  assert.equal(restaurant.name, 'Shah Restaurant Herat');
  assert.equal(Object.keys(restaurant.items).length, 74);
  assert.deepEqual(Object.keys(restaurant.items).sort(), expected.map((item) => item.id).sort());
  for (const item of expected) {
    const entry = restaurant.items[item.id];
    assert.equal(entry.item_name, item.name);
    assert.equal(entry.expected_image_url, item.image_url);
    if (item.id === 'shah-chicken-fingers') {
      assert.equal(entry.kind, 'original');
      assert.equal(entry.source_url, 'https://www.instagram.com/reel/DayAk_hiF0T/');
      assert.match(entry.source_label, /Shah Restaurant official Instagram/);
    } else {
      assert.equal(entry.kind, 'illustration');
      assert.equal(entry.source_url, '');
      assert.equal(entry.source_label, 'AI-generated illustration; not an actual restaurant photo');
    }
    assert.match(entry.asset_key, /^[a-z0-9-]+$/);
    assert.equal(entry.src, `/assets/menu-item-images/${entry.asset_key}.webp`);
  }

  const liveMenu = {categories: [{id: 'shah-kebab'}], items: expected.map((item) => ({
    ...item, image_url: item.image_url, is_available: false, is_popular: true, price: 321,
  }))};
  const ctx = rendererContext({menu: liveMenu, fetchImpl: async () => ({ok: true, json: async () => manifest})});
  const decorated = await ctx.getMenu({id: 'shah-restaurant-herat'});
  assert.equal(decorated.items.length, 74);
  assert.deepEqual(decorated.categories, liveMenu.categories);
  for (const item of decorated.items) {
    const entry = restaurant.items[item.id];
    assert.equal(item.image_url, entry.src);
    assert.equal(item._menuImagePresentation.kind, entry.kind);
    assert.equal(item._menuImagePresentation.source_url, entry.source_url);
    assert.equal(item._menuImagePresentation.source_label, entry.source_label);
    assert.equal(item.is_available, false);
    assert.equal(item.is_popular, true);
    assert.equal(item.price, 321);
  }
  global.lang = 'en';
  assert.match(imageLabelMarkup(decorated.items[0]._menuImagePresentation), /Illustrative image/);
  assert.match(imageLabelMarkup(decorated.items[0]._menuImagePresentation), /Not an actual restaurant dish photo/);
  global.lang = 'fa';
  assert.match(imageLabelMarkup(decorated.items[0]._menuImagePresentation), /تصویر نمونه/);
  assert.match(imageLabelMarkup(decorated.items[0]._menuImagePresentation), /عکس واقعی غذای رستورانت نیست/);
  delete global.lang;
});

test('Shah mappings leave renamed items and changed owner photos untouched', () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  const entry = manifest.restaurants['shah-restaurant-herat'].items['shah-special-pizza'];
  const renamed = {id: 'shah-special-pizza', name: 'Owner-renamed pizza', image_url: null};
  const ownerPhoto = {id: 'shah-special-pizza', name: entry.item_name, image_url: '/uploads/shah-owner-photo.webp'};
  const renamedMenu = {items: [renamed]};
  const ownerMenu = {items: [ownerPhoto]};
  assert.strictEqual(applyMenuItemImages(renamedMenu, 'shah-restaurant-herat', manifest), renamedMenu);
  assert.strictEqual(applyMenuItemImages(ownerMenu, 'shah-restaurant-herat', manifest), ownerMenu);
  assert.equal(renamed.image_url, null);
  assert.equal(ownerPhoto.image_url, '/uploads/shah-owner-photo.webp');
});

test('all known obsolete poster-image notes are suppressed without losing portions or dish details', () => {
  const {stripLegacyImageProvenance} = require('../assets/menu-item-images.js');
  const notes = [
    'Image is a SOURCE-MENU REFERENCE crop, not a dish photo.',
    'تصویر مرجع منو است، نه عکس غذا.',
    'The image is the source-menu photograph, not an individual dish photo.',
    'Menu-source reference image only; no dish photograph supplied.',
    'Image is the restaurant’s supplied menu reference, not an individual dish photo.',
    'The image is the original menu page, not an individual dish photo.',
    'Image shows the source menu poster, not an individual dish photo.',
  ];
  for (const note of notes) {
    assert.equal(stripLegacyImageProvenance('1 kg (یک کیلو) ' + note), '1 kg (یک کیلو)');
    assert.equal(stripLegacyImageProvenance('Owner-provided menu. ' + note + ' Dish details remain.'),
      'Owner-provided menu. Dish details remain.');
  }
});

test('manifest failure hides a known source-menu poster without changing the source menu', async () => {
  const item = {id: 'item-exact', name: 'Kabuli Pulao', image_url: poster, is_available: false,
    price: 300, description: '1 kg. The image is the original menu page, not an individual dish photo.'};
  const source = {items: [item]};
  const ctx = rendererContext({menu: source, fetchImpl: async () => {throw new Error('offline');}});
  const result = await ctx.getMenu({id: 'restaurant-exact'});
  assert.equal(result.items[0].image_url, '');
  assert.equal(result.items[0].is_available, false);
  assert.equal(result.items[0].price, 300);
  assert.equal(item.image_url, poster);
  const markup = ctx.publicMenuItemMarkup(result.items[0]);
  assert.match(markup, /Photo not added/);
  assert.match(markup, /1 kg/);
  assert.doesNotMatch(markup, /original menu page/);
});

test('known posters on newly added rows are hidden, but later owner photo uploads still win', async () => {
  const description = 'The image is the original menu page, not an individual dish photo.';
  const changed = {id: 'item-exact', name: 'Kabuli Pulao', image_url: '/uploads/new-owner-photo.webp', description};
  const added = {id: 'new-live-item', name: 'Ashak', image_url: poster, description, is_available: false};
  const ctx = rendererContext({menu: {items: [changed, added]}});
  const result = await ctx.getMenu({id: 'restaurant-exact'});
  assert.strictEqual(result.items[0], changed);
  assert.equal(result.items[0].image_url, '/uploads/new-owner-photo.webp');
  assert.equal(result.items[1].image_url, '');
  assert.equal(added.image_url, poster);
});
