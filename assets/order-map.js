(function () {
  'use strict';

  const HERAT_CENTER = { lat: 34.352, lng: 62.204 };
  const POLL_INTERVAL_MS = 30000;

  let map = null;
  let restaurantMarker = null;
  let customerMarker = null;
  let riderMarker = null;
  let routeLine = null;
  let pollTimer = null;
  let lastStaticLocationKey = '';

  function getOrderId() {
    return new URLSearchParams(window.location.search).get('id') || '';
  }

  function getApiBaseUrl() {
    return String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
  }

  function getStatusElement() {
    return document.getElementById('riderMapStatus');
  }

  function setStatus(en, fa, state) {
    const el = getStatusElement();
    if (!el) return;

    const isFa = document.documentElement.lang === 'fa' ||
      document.documentElement.dir === 'rtl' ||
      localStorage.getItem('ae_lang') === 'fa';

    el.textContent = isFa ? fa : en;
    el.dataset.state = state || 'waiting';
    el.hidden = false;
  }

  function showMapFallback(
    en = 'Map unavailable — rider location will be sent by WhatsApp.',
    fa = 'نقشه در دسترس نیست — موقعیت پیک از طریق واتساپ ارسال می‌شود.'
  ) {
    const host = document.getElementById('riderMap');
    const isFa = document.documentElement.lang === 'fa' ||
      document.documentElement.dir === 'rtl' ||
      localStorage.getItem('ae_lang') === 'fa';
    if (host) {
      host.classList.add('rider-map-unavailable');
      host.innerHTML = isFa
        ? '<div class="rider-map-fallback"><strong>نقشه در دسترس نیست</strong><span>موقعیت پیک از طریق واتساپ ارسال می‌شود.</span></div>'
        : '<div class="rider-map-fallback"><strong>Map unavailable</strong><span>Rider location will be sent by WhatsApp.</span></div>';
    }
    setStatus(en, fa, 'unavailable');
  }

  function trackingIsVerified() {
    const experience = document.getElementById('trackingExperience');
    const gate = document.getElementById('trackGate');

    return Boolean(
      (experience && !experience.classList.contains('is-locked')) ||
      gate?.classList.contains('hidden')
    );
  }

  function parseCoordinates(payload) {
    const candidates = [
      payload,
      payload?.location,
      payload?.rider,
      payload?.rider_location,
      payload?.data,
      payload?.data?.location
    ].filter(Boolean);

    for (const value of candidates) {
      const lat = Number(value?.lat ?? value?.latitude ?? value?.last_latitude);
      const lng = Number(value?.lng ?? value?.lon ?? value?.longitude ?? value?.last_longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        return [lat, lng];
      }
    }

    return null;
  }

  function readLocationAttribute(attribute) {
    const el = document.querySelector(`[${attribute}]`);
    if (!el) return null;

    try {
      const loc = JSON.parse(el.getAttribute(attribute) || 'null');
      if (String(loc?.accuracy || '').trim().toLowerCase() === 'unresolved') return null;
      const lat = Number(loc?.lat);
      const lng = Number(loc?.lng);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180 &&
        (Math.abs(lat) > 0.000001 || Math.abs(lng) > 0.000001)
      ) return { lat, lng };
    } catch {
      // Invalid or unavailable tracking coordinates are treated as missing.
    }
    return null;
  }

  function getRestaurantLocationFromPage() {
    return readLocationAttribute('data-restaurant-location');
  }

  function getCustomerLocationFromPage() {
    return readLocationAttribute('data-customer-location');
  }

  function clearMarker(marker) {
    if (marker) marker.setMap(null);
    return null;
  }

  function resetRouteLine() {
    if (routeLine) routeLine.setMap(null);
    routeLine = null;
  }

  function fitBoundsToPins() {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPin = false;

    [restaurantMarker, customerMarker, riderMarker].forEach((marker) => {
      if (marker && marker.getVisible() !== false && marker.getPosition()) {
        bounds.extend(marker.getPosition());
        hasPin = true;
      }
    });

    if (!hasPin) return;

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map && Number(map.getZoom()) > 16) map.setZoom(16);
    });
  }

  function syncStaticLocations() {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const restaurantLoc = getRestaurantLocationFromPage();
    const customerLoc = getCustomerLocationFromPage();
    const staticKey = JSON.stringify({ restaurantLoc, customerLoc });
    const changed = staticKey !== lastStaticLocationKey;
    lastStaticLocationKey = staticKey;

    if (restaurantLoc) {
      if (!restaurantMarker) {
        restaurantMarker = new google.maps.Marker({
          position: restaurantLoc,
          map,
          title: 'Restaurant',
          icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
      } else {
        restaurantMarker.setPosition(restaurantLoc);
        restaurantMarker.setMap(map);
      }
    } else {
      restaurantMarker = clearMarker(restaurantMarker);
    }

    if (customerLoc) {
      if (!customerMarker) {
        customerMarker = new google.maps.Marker({
          position: customerLoc,
          map,
          title: 'Your address',
          icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });
      } else {
        customerMarker.setPosition(customerLoc);
        customerMarker.setMap(map);
      }
    } else {
      customerMarker = clearMarker(customerMarker);
    }

    if (!riderMarker) {
      riderMarker = new google.maps.Marker({
        position: restaurantLoc || customerLoc || HERAT_CENTER,
        map,
        title: 'Rider',
        icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        visible: false
      });
    }

    if (!riderMarker.getVisible()) {
      resetRouteLine();
      if (restaurantLoc && customerLoc) {
        routeLine = new google.maps.Polyline({
          path: [restaurantLoc, customerLoc],
          geodesic: true,
          strokeColor: '#9ca3af',
          strokeOpacity: 0.6,
          strokeWeight: 2,
          map
        });
      }
    }

    if (changed) fitBoundsToPins();
  }

  function initMap() {
    const host = document.getElementById('riderMap');
    if (!host) return false;

    if (typeof google === 'undefined' || !google.maps) {
      showMapFallback();
      return false;
    }

    host.classList.remove('rider-map-unavailable');
    const fallback = host.querySelector('.rider-map-fallback');
    if (fallback) host.replaceChildren();

    if (!map) {
      map = new google.maps.Map(host, {
        center: HERAT_CENTER,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true
      });
    }

    syncStaticLocations();

    setStatus(
      getOrderId()
        ? 'Waiting for rider — this map updates when a driver is assigned.'
        : 'Waiting for rider — order ID not available yet.',
      getOrderId()
        ? 'در انتظار پیک — این نقشه پس از تعیین راننده به‌روزرسانی می‌شود.'
        : 'در انتظار پیک — شناسه سفارش هنوز موجود نیست.',
      'waiting'
    );

    startPolling();
    return true;
  }

  async function pollRiderLocation() {
    if (!map || !riderMarker) return;

    const orderId = getOrderId();
    if (!orderId || !trackingIsVerified()) return;

    const base = getApiBaseUrl();
    if (!base) return;

    try {
      const response = await fetch(
        `${base}/api/orders/${encodeURIComponent(orderId)}/rider-location`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }
      );

      if (!response.ok) {
        setStatus(
          'Waiting for rider — this map updates when a driver is assigned.',
          'در انتظار پیک — این نقشه پس از تعیین راننده به‌روزرسانی می‌شود.',
          'waiting'
        );
        return;
      }

      const point = parseCoordinates(await response.json());
      if (!point) {
        setStatus(
          'Waiting for rider — this map updates when a driver is assigned.',
          'در انتظار پیک — این نقشه پس از تعیین راننده به‌روزرسانی می‌شود.',
          'waiting'
        );
        return;
      }

      riderMarker.setPosition({ lat: point[0], lng: point[1] });
      riderMarker.setVisible(true);

      if (customerMarker) {
        resetRouteLine();
        routeLine = new google.maps.Polyline({
          path: [riderMarker.getPosition(), customerMarker.getPosition()],
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map
        });
      }

      setStatus(
        'Rider location updated.',
        'موقعیت پیک به‌روزرسانی شد.',
        'live'
      );

      // Do not re-fit bounds here; preserve the user's zoom and pan while polling.
    } catch (error) {
      console.warn('[Afghan Eats] Rider location request failed.', error);
      setStatus(
        'Waiting for rider location…',
        'در انتظار موقعیت پیک…',
        'waiting'
      );
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollRiderLocation();
    pollTimer = window.setInterval(pollRiderLocation, POLL_INTERVAL_MS);
  }

  window.AfghanEatsRiderMap = { initMap, pollRiderLocation, showMapFallback };

  if (
    document.readyState !== 'loading' &&
    typeof google !== 'undefined' &&
    google.maps
  ) {
    initMap();
  }
})();
