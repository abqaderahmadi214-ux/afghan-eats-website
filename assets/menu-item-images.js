(() => {
  'use strict';

  const MANIFEST_URL = '/data/menu-item-images.json?v=20261113-shah-1';
  const FETCH_TIMEOUT_MS = 3500;
  let manifestPromise = null;

  function normalizedImageUrl(value) {
    return value == null || value === '' ? '' : String(value);
  }

  function validImageSrc(value) {
    if (typeof value !== 'string' || !value) return false;
    if (value.startsWith('/assets/menu-item-images/')) {
      return !value.split('/').includes('..') && !/[\\?#]/.test(value.slice('/assets/menu-item-images/'.length));
    }
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
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
        || !['original', 'illustration'].includes(mapping.kind) || !validImageSrc(mapping.src)) return item;
      if (Object.prototype.hasOwnProperty.call(mapping, 'expected_image_url')
        && normalizedImageUrl(item.image_url) !== normalizedImageUrl(mapping.expected_image_url)) return item;
      if (Object.prototype.hasOwnProperty.call(mapping, 'expected_updated_at')
        && item.updated_at !== mapping.expected_updated_at) return item;
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
        console.warn('[Afghan Eats] Menu image manifest unavailable; continuing without mapped images.', error?.message || error);
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
      if (mapping && Object.prototype.hasOwnProperty.call(mapping, 'expected_image_url')
        && normalizedImageUrl(mapping.expected_image_url) !== normalizedImageUrl(item.image_url)) return item;
      const text = [item.description, item.description_dari].filter(Boolean).join(' ');
      if (stripLegacyImageProvenance(text) === text.replace(/\s{2,}/g, ' ').trim()) return item;
      changed = true;
      return {...item, image_url: '', _menuSourceImageSuppressed: true};
    });
    return changed ? {...menu, items} : menu;
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function imageLabelMarkup(presentation) {
    if (!presentation) return '';
    const fa = typeof lang !== 'undefined' && lang === 'fa';
    if (presentation.kind === 'illustration') {
      return `<span class="menu-image-presentation menu-image-illustration" data-menu-image-label>${fa ? 'تصویر نمونه' : 'Illustrative image'}</span><span class="menu-image-disclaimer" data-menu-image-label>${fa ? 'عکس واقعی غذای رستورانت نیست.' : 'Not an actual restaurant dish photo.'}</span>`;
    }
    const label = fa ? 'عکس رستورانت' : 'Restaurant photo';
    const source = presentation.source_url
      ? `<a class="menu-image-source" data-menu-image-label href="${escapeHtml(presentation.source_url)}" title="${escapeHtml(presentation.source_label || (fa ? 'منبع عکس' : 'Photo source'))}" target="_blank" rel="noopener noreferrer">${fa ? 'منبع عکس' : 'Photo source'}</a>`
      : '';
    return `<span class="menu-image-presentation menu-image-original" data-menu-image-label>${label}</span>${source}`;
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

  // Expose the deterministic merger for regression tests and non-browser consumers.
  globalThis.applyMenuItemImages = applyMenuItemImages;
  globalThis.menuImageLabelMarkup = imageLabelMarkup;
  globalThis.hideMenuImageBadgeOnError = hideMenuImageBadgeOnError;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyMenuItemImages, imageLabelMarkup, stripLegacyImageProvenance, validImageSrc };
  }

  if (typeof getMenu === 'function') {
    const originalGetMenu = getMenu;
    getMenu = async function getMenuWithImagePresentation(restaurant) {
      const liveMenu = await originalGetMenu(restaurant);
      try {
        const manifest = await loadMenuImageManifest();
        const decorated = manifest ? applyMenuItemImages(liveMenu, restaurant?.id, manifest) : liveMenu;
        return suppressMenuReferenceImages(decorated, restaurant?.id, manifest);
      } catch (error) {
        console.warn('[Afghan Eats] Menu image decoration failed; keeping the live menu usable.', error?.message || error);
        return suppressMenuReferenceImages(liveMenu, restaurant?.id, null);
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
