(function () {
  'use strict';

  const CATEGORY_TERMS = {
    afghan: ['afghan', 'traditional', 'herati', 'افغانی', 'سنتی', 'هراتی'],
    kebab: ['kebab', 'kabob', 'کباب'],
    iftar: ['iftar', 'ramadan', 'افطار', 'رمضان'],
    'family-platter': ['family platter', 'family', 'platter', 'خانوادگی', 'سینی', 'پلاتر'],
    catering: ['catering', 'event', 'events', 'کترینگ', 'محفل', 'مهمانی'],
    sweets: ['sweets', 'dessert', 'bakery', 'شیرینی', 'دسر']
  };

  let timer = null;
  let requestController = null;

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
        <div class="smart-card-title"><h3>${esc(name)}</h3><b dir="ltr">${esc(price)}</b></div>
        <div class="tagline">${esc(restaurantName || (fa ? 'رستورانت هرات' : 'Herat restaurant'))}</div>
        <span class="smart-reason">🍽️ ${fa ? 'مشاهده در منو' : 'View on menu'}</span>
      </div>
    </a>`;
  }

  function renderDishResults(items, query) {
    const host = document.getElementById('dishResults');
    if (!host) return;
    const dishes = (Array.isArray(items) ? items : []).map(normalizeDish).filter((dish) => dish.name && dish.restaurantId).slice(0, 12);
    if (!query || !dishes.length) {
      host.innerHTML = '';
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.innerHTML = dishes.map(dishResultMarkup).join('');
  }

  function localDishMatches(query) {
    const needle = String(query || '').trim().toLowerCase();
    const source = typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : [];
    if (needle.length < 2 || !source.length) return [];
    const results = [];
    for (const restaurant of source) {
      const routeId = restaurant?.slug || restaurant?.public_slug || restaurant?.id;
      for (const item of restaurant?._items || []) {
        const hay = `${item?.name || ''} ${item?.name_dari || ''} ${item?.description || ''} ${item?.description_dari || ''}`.toLowerCase();
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

  function filterExistingCards(query) {
    const needle = String(query || '').trim().toLowerCase();
    const cards = [...document.querySelectorAll('#restaurantGrid .restaurant-card[data-name][data-cuisine]')];
    if (!cards.length || !needle) return;
    const directMatches = cards.filter((card) => `${card.dataset.name || ''} ${card.dataset.cuisine || ''}`.toLowerCase().includes(needle));
    if (!directMatches.length) return;
    cards.forEach((card) => {
      card.hidden = !directMatches.includes(card);
    });
  }

  async function fetchDishResults(query) {
    const base = String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('Dish API is not configured');

    requestController?.abort();
    requestController = new AbortController();
    const response = await fetch(`${base}/api/dishes?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
      signal: requestController.signal
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

    if (typeof window.advancedRestaurantSearch === 'function') {
      window.advancedRestaurantSearch();
    }

    if (query.length < 2) {
      renderDishResults([], '');
      return;
    }

    try {
      const results = await fetchDishResults(query);
      renderDishResults(results.length ? results : localDishMatches(query), query);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      filterExistingCards(query);
      renderDishResults(localDishMatches(query), query);
    }
  }

  function scheduleSearch() {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 250);
  }

  function setCategory(button) {
    document.querySelectorAll('[data-dish-category]').forEach((chip) => {
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
    document.querySelectorAll('[data-dish-category]').forEach((chip) => {
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
