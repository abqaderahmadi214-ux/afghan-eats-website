(function () {
  'use strict';

  const HERAT_CENTER = { lat: 34.348, lng: 62.208 };
  const HERAT_BOUNDS = { minLat: 34.0, maxLat: 34.5, minLng: 62.0, maxLng: 62.4 };
  const CUISINE_FA = {
    Afghan: 'افغانی',
    Traditional: 'سنتی',
    Kebab: 'کباب',
    'Fast Food': 'فست‌فود',
    Pizza: 'پیتزا',
    Burgers: 'برگر',
    Sandwiches: 'ساندویچ',
    Biryani: 'بریانی',
    'Rice Dishes': 'غذاهای برنجی',
    Turkish: 'ترکی',
    Doner: 'دونر',
    Herati: 'هراتی'
  };

  let map = null;
  let infoWindow = null;
  let mapLoaded = false;
  let loadingMaps = false;
  let catalogReady = false;
  let catalog = [];
  let markers = new Map();
  let activeRouteId = '';

  const listGrid = document.getElementById('restaurantGrid');
  const mapView = document.getElementById('restaurantDiscoveryMapView');
  const mapHost = document.getElementById('restaurantDiscoveryMap');
  const mapList = document.getElementById('restaurantDiscoveryMapList');
  const mapStatus = document.getElementById('restaurantDiscoveryMapStatus');
  const mapCount = document.getElementById('restaurantDiscoveryMapCount');

  if (!listGrid || !mapView || !mapHost) return;

  function isFa() {
    return document.documentElement.lang === 'fa' ||
      document.documentElement.dir === 'rtl' ||
      localStorage.getItem('ae_lang') === 'fa';
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  }

  function validLocation(location) {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    return String(location?.accuracy || '').toLowerCase() === 'verified' &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= HERAT_BOUNDS.minLat && lat <= HERAT_BOUNDS.maxLat &&
      lng >= HERAT_BOUNDS.minLng && lng <= HERAT_BOUNDS.maxLng;
  }

  function routeId(restaurant) {
    return String(restaurant?.slug || restaurant?.public_slug || restaurant?.id || '').trim();
  }

  function localizedName(restaurant) {
    return isFa() && restaurant?.name_dari ? restaurant.name_dari : restaurant?.name || '';
  }

  function cuisineText(restaurant) {
    const tags = Array.isArray(restaurant?.cuisine_tags) && restaurant.cuisine_tags.length
      ? restaurant.cuisine_tags.slice(0, 3)
      : [restaurant?.category_primary].filter(Boolean);
    return tags.map((tag) => isFa() ? (CUISINE_FA[tag] || tag) : tag).join(' • ');
  }

  function etaText(restaurant) {
    const min = Number(restaurant?.delivery_time_min);
    const max = Number(restaurant?.delivery_time_max);
    if (Number.isFinite(min)) {
      const end = Number.isFinite(max) ? max : min + 15;
      return isFa() ? `${min}–${end} دقیقه` : `${min}–${end} min`;
    }
    return isFa() ? 'زمان در حال تأیید' : 'ETA confirming';
  }

  function setStatus(en, fa, state = 'ready') {
    if (!mapStatus) return;
    mapStatus.textContent = isFa() ? fa : en;
    mapStatus.dataset.state = state;
  }

  function showFallback(en, fa) {
    mapHost.innerHTML = `
      <div class="restaurant-map-fallback">
        <strong>${esc(isFa() ? 'نقشه در دسترس نیست' : 'Map unavailable')}</strong>
        <span>${esc(isFa() ? fa : en)}</span>
      </div>`;
    setStatus(en, fa, 'error');
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  }

  function fallbackRestaurantMap(rows) {
    const mapByName = new Map();
    for (const entry of Array.isArray(rows) ? rows : []) {
      const restaurant = entry?.restaurant || entry;
      if (!restaurant?.name) continue;
      mapByName.set(normalize(restaurant.name), { ...restaurant });
    }
    return mapByName;
  }

  function mergeResearchLocations(fallbackRows, researchRows) {
    const byName = fallbackRestaurantMap(fallbackRows);
    const rows = [];
    for (const entry of Array.isArray(researchRows) ? researchRows : []) {
      const research = entry?.restaurant || entry;
      if (!validLocation(research?.location)) continue;
      const candidates = [research?.name, ...(Array.isArray(research?.aliases) ? research.aliases : [])]
        .map(normalize)
        .filter(Boolean);
      let base = null;
      for (const candidate of candidates) {
        if (byName.has(candidate)) {
          base = byName.get(candidate);
          break;
        }
      }
      if (!base) continue;
      rows.push({ ...base, location: research.location, _mapSource: 'research' });
    }
    return rows;
  }

  function directoryLocations(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((entry) => entry?.restaurant || entry)
      .filter((restaurant) => validLocation(restaurant?.location))
      .map((restaurant) => ({ ...restaurant, _mapSource: 'directory' }));
  }

  function dedupe(rows) {
    const seen = new Set();
    return rows.filter((restaurant) => {
      const key = routeId(restaurant) || normalize(restaurant.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadCatalog() {
    if (catalogReady) return catalog;
    try {
      const [fallback, research, directory] = await Promise.all([
        fetchJson('/data/fallback-restaurants.json'),
        fetchJson('/data/researched-herat-restaurants.json'),
        fetchJson('/data/public-herat-directory.json')
      ]);
      catalog = dedupe([
        ...mergeResearchLocations(fallback, research),
        ...directoryLocations(directory)
      ]);
      catalogReady = true;
      return catalog;
    } catch (error) {
      console.error('[Afghan Eats] Restaurant map catalog failed.', error);
      showFallback(
        'Restaurant locations could not be loaded. Please try again.',
        'موقعیت رستورانت‌ها بارگذاری نشد. لطفاً دوباره تلاش کنید.'
      );
      return [];
    }
  }

  function visibleRouteIds() {
    const anchors = [...listGrid.querySelectorAll('a.restaurant-card-link[href*="restaurant.html?id="]')];
    if (!anchors.length) return null;
    return new Set(anchors.map((anchor) => {
      try {
        return new URL(anchor.href, location.origin).searchParams.get('id') || '';
      } catch {
        return '';
      }
    }).filter(Boolean));
  }

  function visibleCatalog() {
    const ids = visibleRouteIds();
    if (!ids) return catalog;
    return catalog.filter((restaurant) => ids.has(routeId(restaurant)));
  }

  function popupHtml(restaurant) {
    const id = routeId(restaurant);
    const name = localizedName(restaurant);
    const cuisine = cuisineText(restaurant) || (isFa() ? 'رستورانت' : 'Restaurant');
    const eta = etaText(restaurant);
    const button = isFa() ? 'مشاهده منو' : 'View menu';
    return `
      <div class="restaurant-map-popup" dir="${isFa() ? 'rtl' : 'ltr'}">
        <h3>${esc(name)}</h3>
        <p>${esc(cuisine)}</p>
        <p>🕒 ${esc(eta)}</p>
        <a href="/restaurant.html?id=${encodeURIComponent(id)}">${esc(button)}</a>
      </div>`;
  }

  function focusRestaurant(restaurant) {
    const id = routeId(restaurant);
    const marker = markers.get(id);
    if (!marker || !map) return;
    activeRouteId = id;
    map.panTo(marker.getPosition());
    if (Number(map.getZoom()) < 15) map.setZoom(15);
    infoWindow?.setContent(popupHtml(restaurant));
    infoWindow?.open({ map, anchor: marker });
    renderSidePanel(visibleCatalog());
  }

  function markerFor(restaurant) {
    const id = routeId(restaurant);
    const position = {
      lat: Number(restaurant.location.lat),
      lng: Number(restaurant.location.lng)
    };
    const marker = new google.maps.Marker({
      position,
      map,
      title: restaurant.name,
      label: {
        text: localizedName(restaurant),
        className: 'ae-map-marker-label'
      }
    });
    marker.addListener('click', () => focusRestaurant(restaurant));
    markers.set(id, marker);
  }

  function clearMarkers() {
    for (const marker of markers.values()) marker.setMap(null);
    markers.clear();
  }

  function fitToRestaurants(rows) {
    if (!map || !rows.length) return;
    const bounds = new google.maps.LatLngBounds();
    rows.forEach((restaurant) => bounds.extend({
      lat: Number(restaurant.location.lat),
      lng: Number(restaurant.location.lng)
    }));
    map.fitBounds(bounds, 54);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if (Number(map.getZoom()) > 15) map.setZoom(15);
    });
  }

  function renderSidePanel(rows) {
    if (!mapList) return;
    mapList.innerHTML = rows.map((restaurant) => {
      const id = routeId(restaurant);
      return `
        <button class="restaurant-map-list-item ${id === activeRouteId ? 'active' : ''}"
          type="button" data-map-route="${esc(id)}">
          <strong>${esc(localizedName(restaurant))}</strong>
          <span>${esc(cuisineText(restaurant) || (isFa() ? 'رستورانت' : 'Restaurant'))} · ${esc(etaText(restaurant))}</span>
        </button>`;
    }).join('');
    mapList.querySelectorAll('[data-map-route]').forEach((button) => {
      button.addEventListener('click', () => {
        const restaurant = rows.find((row) => routeId(row) === button.dataset.mapRoute);
        if (restaurant) focusRestaurant(restaurant);
      });
    });
  }

  function syncMap() {
    if (!mapLoaded || !map) return;
    const rows = visibleCatalog();
    clearMarkers();
    rows.forEach(markerFor);
    renderSidePanel(rows);
    if (mapCount) {
      mapCount.textContent = isFa()
        ? `${rows.length} رستورانت دارای موقعیت تأییدشده`
        : `${rows.length} restaurants with verified locations`;
    }
    if (!rows.length) {
      setStatus(
        'No verified locations match the current restaurant filters.',
        'هیچ موقعیت تأییدشده‌ای با فیلترهای فعلی مطابقت ندارد.'
      );
      map.setCenter(HERAT_CENTER);
      map.setZoom(13);
      return;
    }
    fitToRestaurants(rows);
    setStatus(
      'Tap a pin to view restaurant details.',
      'برای دیدن جزئیات رستورانت روی پین بزنید.'
    );
  }

  function initMap() {
    if (!window.google?.maps || mapLoaded) return;
    map = new google.maps.Map(mapHost, {
      center: HERAT_CENTER,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false
    });
    infoWindow = new google.maps.InfoWindow();
    mapLoaded = true;
    syncMap();
  }

  function loadGoogleMaps() {
    if (window.google?.maps) {
      initMap();
      return;
    }
    if (loadingMaps) return;
    const key = String(window.AFGHAN_EATS_CONFIG?.googleMapsApiKey || '').trim();
    if (!key || key === '__GMAPS_KEY__') {
      showFallback(
        'Map is unavailable in this deploy context. Restaurant list view is still available.',
        'نقشه در این نسخه در دسترس نیست. فهرست رستورانت‌ها همچنان قابل استفاده است.'
      );
      return;
    }
    loadingMaps = true;
    window.__initRestaurantDiscoveryMap = initMap;
    window.gm_authFailure = () => showFallback(
      'Google Maps could not authenticate. Please use the restaurant list.',
      'Google Maps تأیید نشد. لطفاً از فهرست رستورانت‌ها استفاده کنید.'
    );
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(key) + '&callback=__initRestaurantDiscoveryMap&loading=async';
    script.onerror = () => showFallback(
      'Google Maps could not load. Please use the restaurant list.',
      'Google Maps بارگذاری نشد. لطفاً از فهرست رستورانت‌ها استفاده کنید.'
    );
    document.head.appendChild(script);
  }

  async function setView(view) {
    const mapMode = view === 'map';
    document.body.classList.toggle('restaurant-map-mode', mapMode);
    mapView.hidden = !mapMode;
    document.querySelectorAll('[data-restaurant-view]').forEach((button) => {
      const active = button.dataset.restaurantView === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!mapMode) return;
    setStatus('Loading restaurant locations…', 'در حال بارگذاری موقعیت رستورانت‌ها…');
    await loadCatalog();
    loadGoogleMaps();
    if (mapLoaded) syncMap();
  }

  document.querySelectorAll('[data-restaurant-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.restaurantView || 'list'));
  });

  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('restaurant-map-mode')) syncMap();
  });
  observer.observe(listGrid, { childList: true, subtree: true });

  window.addEventListener('ae:restaurantsrefreshed', () => {
    if (document.body.classList.contains('restaurant-map-mode')) syncMap();
  });

  document.addEventListener('ae:languagechange', () => {
    if (document.body.classList.contains('restaurant-map-mode')) syncMap();
  });

  loadCatalog();
})();
