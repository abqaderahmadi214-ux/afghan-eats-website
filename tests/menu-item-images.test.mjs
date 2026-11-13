import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';

const require = createRequire(import.meta.url);
const {
  applyMenuItemImages, imageLabelMarkup, imagePath, imageFingerprint,
  classifyMenuIllustration, fillMissingMenuIllustrations,
} = require('../assets/menu-item-images.js');
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

test('opaque URL fingerprint protects a same-path owner photo update without storing its query', () => {
  const oldUrl = 'https://cdn.example.com/menu/dish.jpg?v=baseline';
  const manifest = mapping();
  const entry = manifest.restaurants['restaurant-exact'].items['item-exact'];
  delete entry.expected_image_url;
  entry.expected_image_path = imagePath(oldUrl);
  entry.expected_image_fingerprint = imageFingerprint(oldUrl);
  const oldItem = {id: 'item-exact', name: 'Kabuli Pulao', image_url: oldUrl};
  const applied = applyMenuItemImages({items: [oldItem]}, 'restaurant-exact', manifest);
  assert.equal(applied.items[0].image_url, photo);
  const updatedItem = {...oldItem, image_url: 'https://cdn.example.com/menu/dish.jpg?v=owner-upload'};
  const updatedMenu = {items: [updatedItem]};
  assert.strictEqual(applyMenuItemImages(updatedMenu, 'restaurant-exact', manifest), updatedMenu);
  assert.equal(updatedItem.image_url, 'https://cdn.example.com/menu/dish.jpg?v=owner-upload');
  assert.match(entry.expected_image_fingerprint, /^[a-f0-9]{16}$/);
  assert.doesNotMatch(JSON.stringify(manifest), /\?v=baseline/);
});

test('image merge preserves all source rows, category data, availability, price, and text', () => {
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

test('new live rows with no image receive a relevant local illustration, with no source mutation', () => {
  const item = {id: 'new-live-item', name: 'Ashak', image_url: '', description: 'A traditional dumpling', is_available: false, price: 250};
  const source = {categories: [{id: 'dumplings', name: 'Afghan'}], items: [item]};
  const result = fillMissingMenuIllustrations(source);
  assert.notStrictEqual(result, source);
  assert.equal(result.items[0].image_url, '/assets/menu-item-images/mantu-dumplings.webp');
  assert.equal(result.items[0]._menuImagePresentation.kind, 'illustration');
  assert.equal(result.items[0].description, item.description);
  assert.equal(item.image_url, '');
  assert.equal(item.price, 250);
});

test('manifest kind controls photo attribution and bilingual image labels', () => {
  const original = applyMenuItemImages({items: [{id: 'item-exact', name: 'Kabuli Pulao', image_url: poster}]}, 'restaurant-exact', mapping());
  assert.equal(original.items[0].image_url, photo);
  assert.equal(original.items[0]._menuImagePresentation.kind, 'original');
  assert.match(imageLabelMarkup(original.items[0]._menuImagePresentation), /Restaurant photo · عکس رستورانت/);
  assert.match(imageLabelMarkup(original.items[0]._menuImagePresentation), /https:\/\/example\.com\/dish/);
  const illustration = applyMenuItemImages({items: [{id: 'item-exact', name: 'Kabuli Pulao', image_url: poster}]}, 'restaurant-exact', mapping({kind: 'illustration'}));
  const label = imageLabelMarkup(illustration.items[0]._menuImagePresentation);
  assert.match(label, /Illustration · تصویر نمونه/);
  assert.match(label, /Not an actual dish photo · عکس واقعی غذا نیست/);
});

test('dish illustration classifier selects specific food assets and a safe fallback', () => {
  assert.equal(classifyMenuIllustration({name: 'Special Pizza'}), '/assets/menu-item-images/generic-pizza.webp');
  assert.equal(classifyMenuIllustration({name: 'Chicken Wings'}), '/assets/menu-item-images/chicken-wings.webp');
  assert.equal(classifyMenuIllustration({name: 'Qabili with Lamb'}), '/assets/menu-item-images/qabuli-rice.webp');
  assert.equal(classifyMenuIllustration({name: 'Unrecognized dish'}), '/assets/menu-item-images/generic-stew.webp');
});

test('failed mapped image leaves a useful card and hides its image labels', async () => {
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
  const ctx = rendererContext({menu: {items: [original]}, fetchImpl: async () => ({ok: true, json: async () => mapping({kind: 'illustration'})})});
  const menu = await ctx.getMenu({id: 'restaurant-exact'});
  const markup = ctx.menuItemMarkup(menu.items[0], {id: 'restaurant-exact'});
  assert.doesNotMatch(markup, /original menu page, not an individual dish photo/i);
  assert.match(markup, /A fragrant rice dish/);
  assert.match(markup, /Illustration · تصویر نمونه/);
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

test('manifest failure still hides a known menu poster and uses an illustration without mutating live data', async () => {
  const item = {id: 'item-exact', name: 'Kabuli Pulao', image_url: poster, is_available: false, price: 300, description: '1 kg. The image is the original menu page, not an individual dish photo.'};
  const source = {items: [item]};
  const ctx = rendererContext({menu: source, fetchImpl: async () => {throw new Error('offline');}});
  const result = await ctx.getMenu({id: 'restaurant-exact'});
  assert.notStrictEqual(result, source);
  assert.equal(result.items[0].image_url, '/assets/menu-item-images/qabuli-rice.webp');
  assert.equal(result.items[0]._menuImagePresentation.kind, 'illustration');
  assert.equal(result.items[0].is_available, false);
  assert.equal(result.items[0].price, 300);
  assert.equal(item.image_url, poster);
  assert.match(ctx.publicMenuItemMarkup(result.items[0]), /Illustration · تصویر نمونه/);
  assert.match(ctx.publicMenuItemMarkup(result.items[0]), /1 kg/);
  assert.doesNotMatch(ctx.publicMenuItemMarkup(result.items[0]), /original menu page/);
});

test('known posters on newly added rows are illustrated, while a later owner photo still wins', async () => {
  const description = 'The image is the original menu page, not an individual dish photo.';
  const changed = {id: 'item-exact', name: 'Kabuli Pulao', image_url: '/uploads/new-owner-photo.webp', description};
  const added = {id: 'new-live-item', name: 'Ashak', image_url: poster, description, is_available: false};
  const ctx = rendererContext({menu: {items: [changed, added]}});
  const result = await ctx.getMenu({id: 'restaurant-exact'});
  assert.strictEqual(result.items[0], changed);
  assert.equal(result.items[0].image_url, '/uploads/new-owner-photo.webp');
  assert.equal(result.items[1].image_url, '/assets/menu-item-images/mantu-dumplings.webp');
  assert.equal(result.items[1]._menuImagePresentation.kind, 'illustration');
  assert.equal(added.image_url, poster);
});

test('published manifest and sanitized audit cover all current restaurants and every menu item', () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  const audit = JSON.parse(readFileSync('tests/fixtures/current-menu-image-audit.json', 'utf8'));
  const serialized = JSON.stringify(manifest);
  assert.equal(Object.keys(manifest.restaurants).length, 22);
  assert.equal(audit.restaurants.length, 22);
  const auditItems = audit.restaurants.flatMap((restaurant) => restaurant.items.map((item) => ({...item, restaurantId: restaurant.id})));
  assert.equal(auditItems.length, 636);
  const states = auditItems.reduce((acc, item) => (acc[item.image_state] = (acc[item.image_state] || 0) + 1, acc), {});
  assert.deepEqual(states, {missing: 467, 'preserved-live-photo': 23, 'replaced-reference': 146});
  const kinds = {original: 0, illustration: 0};
  const checkedAssets = new Set();
  let testedMissingImages = 0;
  for (const restaurantAudit of audit.restaurants) {
    const restaurant = manifest.restaurants[restaurantAudit.id];
    assert.ok(restaurant, `Missing current restaurant ${restaurantAudit.name}`);
    const sourceItems = [];
    const expectedMappedIds = new Set();
    for (const item of restaurantAudit.items) {
      const entry = restaurant.items[item.id];
      if (item.image_state === 'preserved-live-photo') {
        assert.equal(entry, undefined, `${item.name} must keep its genuine uploaded photo`);
        const ownerPhoto = {id: item.id, name: item.name, image_url: '/uploads/owner-photo.webp'};
        const ownerMenu = {items: [ownerPhoto]};
        assert.strictEqual(applyMenuItemImages(ownerMenu, restaurantAudit.id, manifest), ownerMenu);
        continue;
      }
      assert.ok(entry, `Missing menu image mapping: ${restaurantAudit.name} / ${item.name}`);
      assert.equal(entry.item_name, item.name);
      assert.equal(entry.kind, item.presentation_kind);
      assert.ok(['original', 'illustration'].includes(entry.kind));
      assert.ok(Object.prototype.hasOwnProperty.call(entry, 'expected_image_path'));
      assert.doesNotMatch(entry.expected_image_path, /[?#]/);
      assert.equal(Object.prototype.hasOwnProperty.call(entry, 'expected_image_url'), false);
      kinds[entry.kind] += 1;
      expectedMappedIds.add(item.id);
      if (item.image_state === 'missing') {
        assert.equal(entry.expected_image_path, '');
        assert.equal(Object.prototype.hasOwnProperty.call(entry, 'expected_image_fingerprint'), false);
        sourceItems.push({id: item.id, name: item.name, image_url: '', is_available: false, is_popular: true, price: 317, category_id: 'preserved-category', description: 'Preserved live description', sort_order: 17});
        testedMissingImages += 1;
      } else {
        assert.ok(entry.expected_image_path.startsWith('/'));
        assert.match(entry.expected_image_fingerprint, /^[a-f0-9]{16}$/);
      }
      if (entry.kind === 'original') assert.match(entry.source_url, /^https:\/\//);
      assert.doesNotMatch(JSON.stringify(entry), /[?&]token=/i);
      if (!checkedAssets.has(entry.src)) {
        assert.ok(existsSync('.' + entry.src), `Required menu image missing: ${entry.src}`);
        const bytes = readFileSync('.' + entry.src);
        assert.ok(bytes.length > 1024, entry.src);
        if (entry.src.endsWith('.webp')) {
          assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
          assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
        } else {
          assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `Expected JPEG: ${entry.src}`);
        }
        checkedAssets.add(entry.src);
      }
    }
    assert.deepEqual(Object.keys(restaurant.items).sort(), [...expectedMappedIds].sort());
    if (sourceItems.length) {
      const live = {categories: [{id: 'preserved-category'}], items: sourceItems};
      const before = structuredClone(live);
      const result = applyMenuItemImages(live, restaurantAudit.id, manifest);
      assert.equal(result.items.length, before.items.length);
      assert.deepEqual(live, before);
      assert.strictEqual(result.categories, live.categories);
      result.items.forEach((item, index) => {
        const {image_url, _menuImagePresentation, ...unchanged} = item;
        const {image_url: previousImage, ...original} = before.items[index];
        assert.deepEqual(unchanged, original);
        assert.equal(item.is_available, false);
        assert.equal(item._menuImagePresentation.kind, restaurant.items[item.id].kind);
        assert.equal(item.image_url, restaurant.items[item.id].src);
      });
    }
  }
  assert.deepEqual(kinds, {original: 12, illustration: 601});
  assert.equal(testedMissingImages, 467);
  assert.equal(checkedAssets.size, 60);
  assert.doesNotMatch(serialized, /[?&]token=/i);
});

test('promotional poster assets are replaced by relevant labeled illustrations', () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  const audit = JSON.parse(readFileSync('tests/fixtures/current-menu-image-audit.json', 'utf8'));
  const replacements = [
    ['Food Box Restaurant', 'Food Box Special Pizza (Small)', 'generic-pizza.webp'],
    ['Food Box Restaurant', 'Food Box Special Pizza (Medium)', 'generic-pizza.webp'],
    ['Food Box Restaurant', 'Food Box Special Pizza (Large)', 'generic-pizza.webp'],
    ['Food Box Restaurant', 'Kabuli Biryani', 'biryani-rice.webp'],
    ['Food Box Restaurant', 'Arabic Tray for Two', 'afghan-sharing-platter.webp'],
    ['Parmis Restaurant', 'Parmis Special Pizza (Big)', 'generic-pizza.webp'],
  ];
  const removedPosterFiles = [
    'food-box-restaurant-food-box-special-pizza-small-1e301dbd.jpg',
    'food-box-restaurant-kabuli-biryani-e52dba4a.jpg',
    'food-box-restaurant-arabic-tray-for-two-b7bff281.jpg',
    'parmis-restaurant-parmis-special-pizza-big-1b793f27.jpg',
  ];
  for (const [restaurantName, itemName, imageFile] of replacements) {
    const restaurant = audit.restaurants.find((row) => row.name === restaurantName);
    const item = restaurant?.items.find((row) => row.name === itemName);
    assert.ok(item, `Missing audit row: ${restaurantName} / ${itemName}`);
    const entry = manifest.restaurants[restaurant.id].items[item.id];
    assert.equal(entry.kind, 'illustration');
    assert.equal(entry.src, `/assets/menu-item-images/${imageFile}`);
    assert.equal(entry.source_url, '');
    assert.equal(entry.source_label, 'AI-generated illustration; not an actual restaurant photo');
    const label = imageLabelMarkup({kind: entry.kind, source_url: entry.source_url, source_label: entry.source_label});
    assert.match(label, /Illustration · تصویر نمونه/);
    assert.match(label, /Not an actual dish photo · عکس واقعی غذا نیست/);
  }
  for (const filename of removedPosterFiles) {
    assert.equal(existsSync(`assets/menu-item-images/${filename}`), false);
    assert.equal(JSON.stringify(manifest).includes(filename), false);
  }
});

test('Shah keeps exact 74-item baseline, verified photo attribution, and bilingual illustration labels', async () => {
  const manifest = JSON.parse(readFileSync('data/menu-item-images.json', 'utf8'));
  const expected = JSON.parse(readFileSync('tests/fixtures/shah-menu-items.json', 'utf8'));
  const restaurant = manifest.restaurants['shah-restaurant-herat'];
  assert.equal(restaurant.name, 'Shah Restaurant Herat');
  assert.equal(Object.keys(restaurant.items).length, 74);
  assert.deepEqual(Object.keys(restaurant.items).sort(), expected.map((item) => item.id).sort());
  for (const item of expected) {
    const entry = restaurant.items[item.id];
    assert.equal(entry.item_name, item.name);
    assert.equal(entry.expected_image_path, imagePath(item.image_url));
    if (item.id === 'shah-chicken-fingers') {
      assert.equal(entry.kind, 'original');
      assert.equal(entry.source_url, 'https://www.instagram.com/reel/DayAk_hiF0T/');
      assert.match(entry.source_label, /Shah Restaurant official Instagram/);
    } else {
      assert.equal(entry.kind, 'illustration');
      assert.equal(entry.source_url, '');
      assert.equal(entry.source_label, 'AI-generated illustration; not an actual restaurant photo');
    }
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
  const label = imageLabelMarkup(decorated.items.find((item) => item._menuImagePresentation.kind === 'illustration')._menuImagePresentation);
  assert.match(label, /Illustration · تصویر نمونه/);
  assert.match(label, /Not an actual dish photo · عکس واقعی غذا نیست/);
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

test('all known obsolete poster-image notes are removed only from image presentation text', () => {
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
