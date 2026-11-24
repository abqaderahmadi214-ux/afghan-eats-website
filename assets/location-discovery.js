(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const queryArea = String(params.get('area') || '').trim();
  let selectedArea = queryArea || String(localStorage.getItem('ae_browse_area') || '').trim();
  if (queryArea) localStorage.setItem('ae_browse_area', queryArea);
  window.AE_BROWSE_AREA = selectedArea;

  const clean = value => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200e\u200f\u200c]/g, '')
    .replace(/[ك]/g, 'ک')
    .replace(/[يى]/g, 'ی')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  function allRestaurants() {
    return typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : [];
  }

  function isVisibleListing(restaurant) {
    if (typeof isCustomerVisibleRestaurant === 'function' && !isCustomerVisibleRestaurant(restaurant)) return false;
    if (typeof isHiddenListing === 'function' && isHiddenListing(restaurant)) return false;
    return true;
  }

  function isHeratListing(restaurant) {
    const cities = ['city', 'city_en', 'city_dari']
      .map(key => restaurant?.[key])
      .filter(value => typeof value === 'string' && value.trim())
      .map(clean);
    return !cities.length || cities.every(city => city.includes('herat') || city.includes('هرات'));
  }

  function listingText(restaurant) {
    const keys = [
      'address', 'address_en', 'address_dari', 'district', 'district_en', 'district_dari',
      'neighborhood', 'neighborhood_en', 'neighborhood_dari', 'landmark', 'landmark_en', 'landmark_dari'
    ];
    return keys
      .map(key => restaurant?.[key])
      .filter(value => typeof value === 'string' && value.trim())
      .map(clean)
      .filter(Boolean);
  }

  function matchesArea(restaurant, area = selectedArea) {
    const query = clean(area);
    if (!query) return true;
    const tokens = query.split(/\s+/).filter(token => token.length > 1);
    if (!tokens.length) return false;
    const fields = listingText(restaurant);
    return fields.some(field => field === query || field.includes(query)) ||
      (tokens.length > 1 && tokens.every(token => fields.some(field => field.includes(token))));
  }

  function matchingListings() {
    if (!selectedArea) return [];
    return allRestaurants().filter(isVisibleListing).filter(isHeratListing).filter(restaurant => matchesArea(restaurant));
  }

  function eligibleFallbackRows() {
    return allRestaurants().filter(isVisibleListing);
  }

  function statusCopy(state) {
    const area = selectedArea;
    if (state === 'matched') {
      return {
        en: `Showing restaurant listings whose published location details match “${area}”. This is not delivery-coverage confirmation.`,
        fa: `فهرست رستورانت‌هایی نمایش داده می‌شود که جزئیات موقعیت عمومی‌شان با «${area}» مطابقت دارد. این تطبیق، محدودهٔ تحویل را تأیید نمی‌کند.`
      };
    }
    if (state === 'fallback') {
      return {
        en: `No published restaurant address matches “${area}”. Showing all Herat restaurant listings instead. This does not confirm delivery coverage.`,
        fa: `هیچ نشانی عمومی رستورانت با «${area}» مطابقت ندارد. در عوض همهٔ فهرست‌های رستورانت‌های هرات نمایش داده می‌شوند. این کار دسترسی تحویل را تأیید نمی‌کند.`
      };
    }
    return {
      en: 'Choose an area to match public restaurant location details. Delivery availability is checked separately.',
      fa: 'برای تطبیق جزئیات موقعیت عمومی رستورانت‌ها، ساحه را انتخاب کنید. دسترسی تحویل جداگانه بررسی می‌شود.'
    };
  }

  function renderAreaStatus(state) {
    const status = document.getElementById('aeLocationBrowseStatus');
    if (!status) return;
    const copy = statusCopy(state);
    status.textContent = document.documentElement.lang === 'fa' ? copy.fa : copy.en;
    status.dataset.state = state;
    status.dir = 'auto';
  }

  function filterByArea(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!selectedArea) {
      renderAreaStatus('unselected');
      return list;
    }
    const matches = matchingListings();
    if (!allRestaurants().length) return list;
    if (!matches.length) {
      renderAreaStatus('fallback');
      return list.filter(isHeratListing);
    }
    const ids = new Set(matches.map(row => String(row?.id || '')));
    renderAreaStatus('matched');
    return list.filter(row => ids.has(String(row?.id || '')));
  }

  window.aeBrowseAreaFilter = filterByArea;
  window.aeBrowseAreaMatchesRestaurant = restaurant => {
    if (!selectedArea) return true;
    if (!isHeratListing(restaurant)) return false;
    const matches = matchingListings();
    return !matches.length || matches.some(row => String(row?.id || '') === String(restaurant?.id || ''));
  };
  window.aeBrowseAreaSelected = () => selectedArea;

  function init() {
    const homeInput = document.getElementById('aeHomeArea');
    if (homeInput && selectedArea) homeInput.value = selectedArea;

    const areaInput = document.getElementById('aeLocationArea');
    if (areaInput) areaInput.value = selectedArea;
    const form = document.getElementById('aeLocationBrowseForm');
    if (form) {
      const current = new URL(window.location.href);
      for (const key of ['q', 'c']) {
        const hidden = form.querySelector(`input[type="hidden"][name="${key}"]`);
        if (hidden) hidden.value = current.searchParams.get(key) || '';
      }
    }
    if (form && areaInput) {
      form.addEventListener('submit', event => {
        const value = areaInput.value.trim();
        if (!value) return;
        event.preventDefault();
        selectedArea = value;
        window.AE_BROWSE_AREA = value;
        localStorage.setItem('ae_browse_area', value);
        const next = new URL('/restaurants', window.location.origin);
        next.searchParams.set('area', value);
        const current = new URL(window.location.href);
        for (const key of ['q', 'c']) {
          const currentValue = key === 'q'
            ? (document.getElementById('search')?.value || current.searchParams.get(key) || '').trim()
            : (current.searchParams.get(key) || '');
          if (currentValue) next.searchParams.set(key, currentValue);
        }
        window.location.assign(next.href);
      });
    }

    document.getElementById('aeClearLocationBrowseArea')?.addEventListener('click', () => {
      selectedArea = '';
      window.AE_BROWSE_AREA = '';
      localStorage.removeItem('ae_browse_area');
      const current = new URL(window.location.href);
      current.searchParams.delete('area');
      window.location.assign(`${current.pathname}${current.search}${current.hash}`);
    });

    renderAreaStatus(selectedArea ? (matchingListings().length ? 'matched' : 'fallback') : 'unselected');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
