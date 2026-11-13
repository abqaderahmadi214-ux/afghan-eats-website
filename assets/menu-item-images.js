(() => {
  'use strict';

  const MANIFEST_URL = '/data/menu-item-images.json?v=20261113-all-22';
  const FETCH_TIMEOUT_MS = 3500;
  const ASSET_PREFIX = '/assets/menu-item-images/';
  const ILLUSTRATION_LABEL = 'AI-generated illustration; not an actual restaurant photo';
  let manifestPromise = null;

  function normalizedImageUrl(value) {
    return value == null || value === '' ? '' : String(value);
  }

  function imagePath(value) {
    if (!value) return '';
    try {
      return new URL(String(value), 'https://afghan-eats.invalid').pathname;
    } catch {
      return String(value).split(/[?#]/, 1)[0];
    }
  }

  // A compact opaque guard lets us detect a changed signed image URL without
  // committing its query string (which may contain an access token).
  function imageFingerprint(value) {
    if (!value) return '';
    const text = String(value);
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193) >>> 0;
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
    }
    return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
  }

  function validImageSrc(value) {
    if (typeof value !== 'string' || !value) return false;
    if (value.startsWith(ASSET_PREFIX)) {
      return !value.split('/').includes('..') && !/[\\?#]/.test(value.slice(ASSET_PREFIX.length));
    }
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  function matchesImageBaseline(item, mapping) {
    if (Object.prototype.hasOwnProperty.call(mapping, 'expected_image_url')
      && normalizedImageUrl(item.image_url) !== normalizedImageUrl(mapping.expected_image_url)) return false;
    if (Object.prototype.hasOwnProperty.call(mapping, 'expected_image_path')
      && imagePath(item.image_url) !== mapping.expected_image_path) return false;
    if (Object.prototype.hasOwnProperty.call(mapping, 'expected_image_fingerprint')
      && imageFingerprint(item.image_url) !== mapping.expected_image_fingerprint) return false;
    if (Object.prototype.hasOwnProperty.call(mapping, 'expected_updated_at')
      && item.updated_at !== mapping.expected_updated_at) return false;
    return true;
  }

  function applyMenuItemImages(menu, restaurantId, manifest) {
    if (!menu || typeof menu !== 'object' || !Array.isArray(menu.items)
      || manifest?.version !== 1 || !manifest.restaurants || typeof manifest.restaurants !== 'object') return menu;
    const restaurant = manifest.restaurants[String(restaurantId ?? '')];
    if (!restaurant?.items || typeof restaurant.items !== 'object') return menu;
    let changed = false;
    const items = menu.items.map((item) => {
      if (!item || typeof item !== 'object' || item.id == null || item.name == null) return item;
      const mapping = restaurant.items[String(item.id)];
      if (!mapping || typeof mapping !== 'object' || mapping.item_name !== item.name
        || !['original', 'illustration'].includes(mapping.kind) || !validImageSrc(mapping.src)
        || !matchesImageBaseline(item, mapping)) return item;
      changed = true;
      return {
        ...item,
        image_url: mapping.src,
        _menuImagePresentation: {
          kind: mapping.kind,
          src: mapping.src,
          source_url: typeof mapping.source_url === 'string' && /^https:\/\//i.test(mapping.source_url) ? mapping.source_url : '',
          source_label: typeof mapping.source_label === 'string' ? mapping.source_label : '',
        },
      };
    });
    return changed ? { ...menu, items } : menu;
  }

  function loadMenuImageManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(MANIFEST_URL, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Image manifest request failed (${response.status})`);
        const data = await response.json();
        if (data?.version !== 1 || !data.restaurants || typeof data.restaurants !== 'object') {
          throw new Error('Unsupported menu image manifest');
        }
        return data;
      } catch (error) {
        console.warn('[Afghan Eats] Menu image manifest unavailable; using safe dish illustrations where needed.', error?.message || error);
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    return manifestPromise;
  }

  function stripLegacyImageProvenance(text) {
    return String(text || '')
      .replace(/(?:^|\s)The image is the original menu page, not an individual dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)The image is a menu page, not an individual dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)This is the original menu page, not an individual dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)Image is a SOURCE-MENU REFERENCE crop, not a dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)تصویر مرجع منو است، نه عکس غذا\.?/g, ' ')
      .replace(/(?:^|\s)The image is the source-menu photograph, not an individual dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)Menu-source reference image only; no dish photograph supplied\.?/gi, ' ')
      .replace(/(?:^|\s)Image is the restaurant[’']s supplied menu reference, not an individual dish photo\.?/gi, ' ')
      .replace(/(?:^|\s)Image shows the source menu poster, not an individual dish photo\.?/gi, ' ')
      .replace(/\s{2,}/g, ' ').trim();
  }

  function suppressMenuReferenceImages(menu, restaurantId, manifest) {
    if (!Array.isArray(menu?.items)) return menu;
    let changed = false;
    const items = menu.items.map((item) => {
      if (!item?.image_url || item._menuImagePresentation) return item;
      const mapping = manifest?.restaurants?.[String(restaurantId ?? '')]?.items?.[String(item.id)];
      if (mapping && !matchesImageBaseline(item, mapping)) return item;
      const text = [item.description, item.description_dari].filter(Boolean).join(' ');
      if (stripLegacyImageProvenance(text) === text.replace(/\s{2,}/g, ' ').trim()) return item;
      changed = true;
      return { ...item, image_url: '', _menuSourceImageSuppressed: true };
    });
    return changed ? { ...menu, items } : menu;
  }

  function classifyMenuIllustration(item, categories = []) {
    const category = categories.find((row) => String(row?.id) === String(item?.category_id));
    const text = [item?.name, item?.name_dari, item?.description, item?.description_dari, category?.name, category?.name_dari]
      .filter(Boolean).join(' ').toLowerCase();
    const rules = [
      [/pizza|پیتزا/, 'generic-pizza.webp'],
      [/lahmacun|lahmajoun/, 'lahmacun.webp'],
      [/pide|پیده/, 'pide.webp'],
      [/döner|doner|دونر|shawarma|شاورما/, 'turkish-doner.webp'],
      [/black burger|بلک برگر/, 'black-burger.webp'],
      [/double burger|دبل برگر/, 'double-burger.webp'],
      [/zinger burger|زینگر برگر/, 'zinger-chicken-burger.webp'],
      [/burger|برگر/, 'burger.webp'],
      [/biryani|بریانی/, 'biryani-rice.webp'],
      [/qabuli|qabeli|qabili|palaw|pulao|pulaw|pilaf|قابلی|پلو/, 'qabuli-rice.webp'],
      [/kichiri|khichdi|kichri|کیچری|کیچیری/, 'kichiri-rice.webp'],
      [/plain rice|برنج ساده|کته/, 'plain-rice.webp'],
      [/rice|برنج|چلو|پلو/, 'rice-with-accompaniment.webp'],
      [/mantu|مانتی|منتو|ashak|آشک/, 'mantu-dumplings.webp'],
      [/fried chicken|مرغ سوخاری|مرغ سرخ شده/, 'fried-chicken.webp'],
      [/chicken wings|\bwings\b|بال مرغ/, 'chicken-wings.webp'],
      [/chicken leg|leg piece|ران مرغ/, 'chicken-leg.webp'],
      [/whole chicken|chargha|چرغه|مرغ کامل/, 'whole-chicken.webp'],
      [/chicken fillet|\bfillet\b|فیله مرغ/, 'chicken-fillet.webp'],
      [/joojeh|chicken kebab|chicken kabab|کباب مرغ|جوجه کباب/, 'chicken-kebab.webp'],
      [/popcorn chicken|nugget|ناگت/, 'popcorn-chicken.webp'],
      [/\bchicken\b|مرغ/, 'chicken-leg.webp'],
      [/koobideh|kubideh|کوبیده/, 'koobideh-kebab.webp'],
      [/shishlik|shish kebab|شیشلیک/, 'tandoori-ribs.webp'],
      [/offal|jigar|جگر|قلوه/, 'offal-kebab.webp'],
      [/kebab|kabob|kabab|کباب/, 'grilled-meat-kebab.webp'],
      [/lamb shank|lamb neck|mahicha|maicha|shank|ماهیچه|گردن گوسفند|دست گوسفند/, 'lamb-shank.webp'],
      [/karahi|qorma|stew|qeymeh|qeema|قورمه|قیمه|کاری/, 'karahi.webp'],
      [/pot kebab|pot kabab|کباب دیگی/, 'pot-kabab.webp'],
      [/\bsteak\b|استیک/, 'steak.webp'],
      [/\bfish\b|ماهی/, 'fish.webp'],
      [/sandwich|ساندویچ/, 'sandwich.webp'],
      [/wrap|\broll\b|رول/, 'wrap-roll.webp'],
      [/pasta|پاستا|ماکارونی/, 'pasta.webp'],
      [/samosa|سمبوسه/, 'samosa.webp'],
      [/fries|french fries|chips|چپس|سیب زمینی سرخ کرده/, 'fries.webp'],
      [/soup|shorwa|ash soup|سوپ|شوربا|آش/, 'soup.webp'],
      [/salad|سالاد/, 'salad.webp'],
      [/doogh|دوش|دوغ/, 'doogh.webp'],
      [/yogurt|ماست/, 'yogurt.webp'],
      [/tea|coffee|chai|چای|قهوه/, 'hot-beverage.webp'],
      [/juice|smoothie|shake|شیک|آبمیوه|آب میوه/, 'blended-drink.webp'],
      [/cola|pepsi|soda|water|نوشابه|آب معدنی|نوشیدنی/, 'cold-drink.webp'],
      [/ice cream|icecream|بستنی/, 'ice-cream.webp'],
      [/cake|pastry|کیک|شیرینی/, 'cake-pastry.webp'],
      [/firni|rice pudding|pudding|فرنی|شیربرنج/, 'rice-pudding.webp'],
      [/fruit|میوه/, 'fruit-assortment.webp'],
      [/breakfast|صبحانه/, 'english-breakfast.webp'],
      [/egg|omelette|omelet|تخم مرغ|املت/, 'omelette.webp'],
      [/whole roast sheep|roast sheep|lamb shinwari|گوسفند بریان/, 'whole-roast-sheep.webp'],
      [/tray|platter|sharing|family|arabic|سینی|بشقاب مخصوص/, 'afghan-sharing-platter.webp'],
    ];
    for (const [pattern, asset] of rules) if (pattern.test(text)) return ASSET_PREFIX + asset;
    const categoryText = `${category?.name || ''} ${category?.name_dari || ''}`.toLowerCase();
    if (/beverage|drink|نوشیدنی|چای/.test(categoryText)) return ASSET_PREFIX + 'cold-drink.webp';
    if (/dessert|sweet|دسر|شیرینی/.test(categoryText)) return ASSET_PREFIX + 'cake-pastry.webp';
    if (/pizza|پیتزا/.test(categoryText)) return ASSET_PREFIX + 'generic-pizza.webp';
    if (/burger|برگر/.test(categoryText)) return ASSET_PREFIX + 'burger.webp';
    if (/rice|پلو|برنج|بریانی/.test(categoryText)) return ASSET_PREFIX + 'qabuli-rice.webp';
    if (/kebab|kabob|kabab|کباب/.test(categoryText)) return ASSET_PREFIX + 'grilled-meat-kebab.webp';
    if (/salad|سالاد/.test(categoryText)) return ASSET_PREFIX + 'salad.webp';
    if (/breakfast|صبحانه/.test(categoryText)) return ASSET_PREFIX + 'english-breakfast.webp';
    return ASSET_PREFIX + 'generic-stew.webp';
  }

  function fillMissingMenuIllustrations(menu) {
    if (!Array.isArray(menu?.items)) return menu;
    let changed = false;
    const items = menu.items.map((item) => {
      if (!item || typeof item !== 'object' || item._menuImagePresentation || (item.image_url && !item._menuSourceImageSuppressed)) return item;
      const src = classifyMenuIllustration(item, menu.categories);
      changed = true;
      return {
        ...item,
        image_url: src,
        _menuImagePresentation: { kind: 'illustration', src, source_url: '', source_label: ILLUSTRATION_LABEL },
      };
    });
    return changed ? { ...menu, items } : menu;
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function imageLabelMarkup(presentation) {
    if (!presentation) return '';
    if (presentation.kind === 'illustration') {
      return '<span class="menu-image-presentation menu-image-illustration" data-menu-image-label>Illustration · تصویر نمونه</span><span class="menu-image-disclaimer" data-menu-image-label>Not an actual dish photo · عکس واقعی غذا نیست.</span>';
    }
    const source = presentation.source_url
      ? `<a class="menu-image-source" data-menu-image-label href="${escapeHtml(presentation.source_url)}" title="${escapeHtml(presentation.source_label || 'Photo source · منبع عکس')}" target="_blank" rel="noopener noreferrer">Photo source · منبع عکس</a>`
      : '';
    return `<span class="menu-image-presentation menu-image-original" data-menu-image-label>Restaurant photo · عکس رستورانت</span>${source}`;
  }

  function decorateMarkup(markup, item) {
    const presentation = item?._menuImagePresentation;
    if (!presentation) return markup;
    const label = imageLabelMarkup(presentation);
    const disclaimer = label.match(/<span class="menu-image-disclaimer"[\s\S]*?<\/span>/)?.[0] || '';
    const mediaLabel = disclaimer ? label.replace(disclaimer, '') : label;
    return markup.replace('<img ', '<img data-menu-image-src="true" ')
      .replace('</div><div class="menu-item-copy">', `${mediaLabel}</div><div class="menu-item-copy">`)
      .replace('</h3>', `</h3>${disclaimer}`);
  }

  function itemForImageRender(item) {
    if (!item?._menuImagePresentation && !item?._menuSourceImageSuppressed) return item;
    return {
      ...item,
      description: stripLegacyImageProvenance(item.description),
      description_dari: stripLegacyImageProvenance(item.description_dari),
    };
  }

  function hideMenuImageBadgeOnError(event) {
    const image = event?.target;
    if (!image?.hasAttribute?.('data-menu-image-src')) return;
    image.closest?.('.menu-item')?.querySelectorAll?.('[data-menu-image-label]')
      ?.forEach((label) => { label.hidden = true; });
  }

  globalThis.applyMenuItemImages = applyMenuItemImages;
  globalThis.menuImageLabelMarkup = imageLabelMarkup;
  globalThis.hideMenuImageBadgeOnError = hideMenuImageBadgeOnError;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      applyMenuItemImages, imageLabelMarkup, stripLegacyImageProvenance, validImageSrc,
      imagePath, imageFingerprint, classifyMenuIllustration, fillMissingMenuIllustrations,
    };
  }

  if (typeof getMenu === 'function') {
    const originalGetMenu = getMenu;
    getMenu = async function getMenuWithImagePresentation(restaurant) {
      const liveMenu = await originalGetMenu(restaurant);
      try {
        const manifest = await loadMenuImageManifest();
        const mapped = manifest ? applyMenuItemImages(liveMenu, restaurant?.id, manifest) : liveMenu;
        const safe = suppressMenuReferenceImages(mapped, restaurant?.id, manifest);
        return fillMissingMenuIllustrations(safe);
      } catch (error) {
        console.warn('[Afghan Eats] Menu image decoration failed; keeping live menu text usable.', error?.message || error);
        return fillMissingMenuIllustrations(suppressMenuReferenceImages(liveMenu, restaurant?.id, null));
      }
    };
  }

  if (typeof menuItemMarkup === 'function') {
    const originalMenuItemMarkup = menuItemMarkup;
    menuItemMarkup = function menuItemMarkupWithImagePresentation(item, ...args) {
      if (!item?._menuImagePresentation && !item?._menuSourceImageSuppressed) return originalMenuItemMarkup(item, ...args);
      return decorateMarkup(originalMenuItemMarkup(itemForImageRender(item), ...args), item);
    };
  }
  if (typeof publicMenuItemMarkup === 'function') {
    const originalPublicMenuItemMarkup = publicMenuItemMarkup;
    publicMenuItemMarkup = function publicMenuItemMarkupWithImagePresentation(item, ...args) {
      if (!item?._menuImagePresentation && !item?._menuSourceImageSuppressed) return originalPublicMenuItemMarkup(item, ...args);
      return decorateMarkup(originalPublicMenuItemMarkup(itemForImageRender(item), ...args), item);
    };
  }
  if (typeof document !== 'undefined') document.addEventListener('error', hideMenuImageBadgeOnError, true);
})();
