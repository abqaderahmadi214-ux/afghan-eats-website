(function () {
  'use strict';

  const CATEGORY_TERMS = {
    afghan: ['afghan', 'traditional', 'herati', 'qabuli', 'qabili', 'kabuli', 'biryani', 'afghan rice', 'افغانی', 'سنتی', 'هراتی', 'قابلی', 'کابلی', 'بریانی', 'پلو'],
    'rice-dishes': ['qabili', 'qabuli', 'kabuli', 'biryani', 'rice', 'pulao', 'pilaf', 'قابلی', 'کابلی', 'بریانی', 'برنج', 'پلو'],
    kebab: ['kebab', 'kabob', 'koobideh', 'doner', 'grilled meat', 'کباب', 'کوبیده', 'دونر'],
    pizza: ['pizza', 'پیتزا'],
    burgers: ['burger', 'hamburger', 'cheeseburger', 'برگر'],
    desserts: ['dessert', 'sweets', 'fruit', 'vanilla', 'ice cream', 'bakery', 'دسر', 'شیرینی', 'میوه', 'وانیل', 'بستنی'],
    iftar: ['iftar', 'ramadan', 'افطار', 'رمضان'],
    'family-platter': ['family platter', 'family', 'platter', 'خانوادگی', 'سینی', 'پلاتر'],
    catering: ['catering', 'event', 'events', 'کترینگ', 'محفل', 'مهمانی'],
    sweets: ['sweets', 'dessert', 'bakery', 'شیرینی', 'دسر']
  };

  let timer = null;
  let requestController = null;
  let requestSequence = 0;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function currentLanguage() {
    return localStorage.getItem('ae_lang') === 'fa' ? 'fa' : 'en';
  }

  function normalizeDish(raw) {
    const restaurant = raw?.restaurant || {};
    return {
      name: raw?.name || raw?.name_dari || raw?.title || '',
      nameDari: raw?.name_dari || raw?.nameFa || '',
      restaurantName: raw?.restaurantName || raw?.restaurant_name || restaurant?.name || '',
      restaurantNameDari: raw?.restaurantNameDari || raw?.restaurant_name_dari || restaurant?.name_dari || '',
      restaurantId: raw?.restaurantId || raw?.restaurant_id || restaurant?.slug || restaurant?.public_slug || restaurant?.id || '',
      price: Number(raw?.price || 0),
      image: raw?.image_url || raw?.imageUrl || ''
    };
  }

  function dishResultMarkup(dish) {
    const fa = currentLanguage() === 'fa';
    const name = fa && dish.nameDari ? dish.nameDari : dish.name;
    const restaurantName = fa && dish.restaurantNameDari ? dish.restaurantNameDari : dish.restaurantName;
    const media = dish.image
      ? `<div class="smart-card-media"><img src="${esc(dish.image)}" alt="${esc(name)}" loading="lazy" decoding="async"></div>`
      : '';
    const price = dish.price > 0 ? `؋ ${dish.price.toLocaleString(fa ? 'fa-AF' : 'en-US')}` : (fa ? 'قیمت هنگام سفارش' : 'Price at restaurant');

    return `<a class="smart-card dish-result-card" href="/restaurant.html?id=${encodeURIComponent(dish.restaurantId)}">
      ${media}
      <div class="smart-card-content">
        <div class="smart-card-title"><h3 dir="auto">${esc(name)}</h3><b dir="ltr">${esc(price)}</b></div>
        <div class="tagline" dir="auto">${esc(restaurantName || (fa ? 'رستورانت هرات' : 'Herat restaurant'))}</div>
        <span class="smart-reason">${fa ? 'مشاهده در منو' : 'View on menu'}</span>
      </div>
    </a>`;
  }

  function renderDishResults(items, query) {
    const host = document.getElementById('dishResults');
    if (!host) return;
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-busy', 'false');
    const dishes = (Array.isArray(items) ? items : []).map(normalizeDish).filter(dish => dish.name && dish.restaurantId).slice(0, 12);
    if (!query) {
      host.innerHTML = '';
      host.hidden = true;
      return;
    }
    host.hidden = false;
    if (!dishes.length) {
      const message = currentLanguage() === 'fa' ? 'غذای مطابق پیدا نشد؛ جستجوی دیگری را امتحان کنید.' : 'No matching dishes. Try another search.';
      host.innerHTML = `<p class="dish-search-empty" role="status">${esc(message)}</p>`;
      return;
    }
    host.innerHTML = dishes.map(dishResultMarkup).join('');
  }

  function localDishMatches(query) {
    const needle = aeNormalizeFoodSearch(query);
    const source = typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : [];
    if (needle.length < 2 || !source.length) return [];
    const results = [];
    for (const restaurant of source) {
      if (typeof isCustomerVisibleRestaurant === 'function' && !isCustomerVisibleRestaurant(restaurant)) continue;
      if (window.aeBrowseAreaMatchesRestaurant && !window.aeBrowseAreaMatchesRestaurant(restaurant)) continue;
      const routeId = restaurant?.slug || restaurant?.public_slug || restaurant?.id;
      for (const item of restaurant?._items || []) {
        if (!item || item.archived_at || item.is_archived || item.status === 'archived') continue;
        const hay = aeNormalizeFoodSearch(`${item?.name || ''} ${item?.name_dari || ''} ${item?.description || ''} ${item?.description_dari || ''}`);
        if (!hay.includes(needle)) continue;
        results.push({
          ...item,
          restaurantId: routeId,
          restaurantName: restaurant?.name || '',
          restaurantNameDari: restaurant?.name_dari || ''
        });
        if (results.length >= 12) return results;
      }
    }
    return results;
  }

  async function fetchDishResults(query, signal) {
    const base = String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('Dish API is not configured');

    const response = await fetch(`${base}/api/dishes?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
      signal
    });
    if (!response.ok) throw new Error(`Dish search unavailable (${response.status})`);
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.dishes)) return data.dishes;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

  async function runSearch() {
    const input = document.getElementById('search');
    const query = String(input?.value || '').trim();
    const requestId = ++requestSequence;
    requestController?.abort();
    requestController = null;

    if (typeof window.advancedRestaurantSearch === 'function') window.advancedRestaurantSearch();
    if (query.length < 2) {
      renderDishResults([], '');
      return;
    }

    const controller = new AbortController();
    requestController = controller;
    const host = document.getElementById('dishResults');
    if (host) {
      host.hidden = false;
      host.setAttribute('aria-busy', 'true');
    }

    try {
      const results = await fetchDishResults(aeNormalizeDiscoveryText(query), controller.signal);
      if (requestId !== requestSequence || query !== String(input?.value || '').trim()) return;
      const rows = typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : [];
      const selectedArea = Boolean(window.aeBrowseAreaSelected?.());
      const eligible = selectedArea ? results.filter(raw => {
        const id = String(normalizeDish(raw).restaurantId);
        return rows.some(row => [row.id, row.slug, row.public_slug].some(value => value != null && String(value) === id)
          && window.aeBrowseAreaMatchesRestaurant(row));
      }) : results;
      renderDishResults(eligible.length ? eligible : localDishMatches(query), query);
    } catch (error) {
      if (error?.name === 'AbortError' || requestId !== requestSequence || query !== String(input?.value || '').trim()) return;
      renderDishResults(localDishMatches(query), query);
    } finally {
      if (requestId === requestSequence && host) host.setAttribute('aria-busy', 'false');
    }
  }

  function scheduleSearch() {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 250);
  }

  function setCategory(button) {
    document.querySelectorAll('[data-dish-category]').forEach(chip => {
      const active = chip === button;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    window.AE_DISH_CATEGORY = button?.dataset.dishCategory || '';
    if (typeof window.advancedRestaurantSearch === 'function') window.advancedRestaurantSearch();
    scheduleSearch();
  }

  function init() {
    const input = document.getElementById('search');
    if (!input) return;

    const initialQuery = new URLSearchParams(location.search).get('q') || '';
    if (initialQuery && !input.value) input.value = initialQuery;

    input.addEventListener('input', scheduleSearch);
    document.querySelectorAll('[data-dish-category]').forEach(chip => {
      chip.addEventListener('click', () => setCategory(chip));
    });

    const all = document.querySelector('[data-dish-category=""]');
    if (all) setCategory(all);
    if (initialQuery) scheduleSearch();
  }

  window.AfghanEatsDishSearch = {
    runSearch,
    scheduleSearch,
    categoryTerms: CATEGORY_TERMS
  };

  document.addEventListener('DOMContentLoaded', init);
})();

