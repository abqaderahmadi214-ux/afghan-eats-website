(function () {
  'use strict';

  const HERAT_CENTER = [34.352, 62.204];
  const POLL_INTERVAL_MS = 30000;

  let riderMap = null;
  let riderMarker = null;
  let pollTimer = null;
  let resizeObserver = null;

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

  function showLeafletFallback() {
    const host = document.getElementById('riderMap');
    if (host) {
      host.classList.add('rider-map-unavailable');
      host.innerHTML = '<div class="rider-map-fallback"><strong>Map unavailable</strong><span>Rider location will be sent by WhatsApp.</span></div>';
    }
    setStatus(
      'Map unavailable — rider location will be sent by WhatsApp.',
      'نقشه در دسترس نیست — موقعیت پیک از طریق واتساپ ارسال می‌شود.',
      'unavailable'
    );
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

  function ensureVisibleSize() {
    if (!riderMap) return;
    window.requestAnimationFrame(() => {
      riderMap.invalidateSize({ pan: false });
    });
    window.setTimeout(() => {
      riderMap?.invalidateSize({ pan: false });
    }, 250);
  }

  function initRiderMap() {
    const host = document.getElementById('riderMap');
    if (!host) {
      console.warn('[Afghan Eats] Rider map container is missing.');
      return false;
    }

    if (typeof window.L === 'undefined') {
      console.warn('[Afghan Eats] Leaflet failed to load; rider map is unavailable.');
      showLeafletFallback();
      return false;
    }

    if (riderMap) {
      ensureVisibleSize();
      return true;
    }

    riderMap = window.L.map(host, {
      zoomControl: true,
      attributionControl: true
    }).setView(HERAT_CENTER, 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(riderMap);

    riderMarker = window.L.marker(HERAT_CENTER, {
      title: 'Herat — waiting for rider location'
    }).addTo(riderMap);

    riderMarker.bindPopup('Herat — waiting for rider location');

    setStatus(
      getOrderId() ? 'Waiting for rider location…' : 'Waiting for rider — order ID not available yet.',
      getOrderId() ? 'در انتظار موقعیت پیک…' : 'در انتظار پیک — شناسه سفارش هنوز موجود نیست.',
      'waiting'
    );

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => ensureVisibleSize());
      resizeObserver.observe(host);
    }

    ensureVisibleSize();
    return true;
  }

  async function pollRiderLocation() {
    if (!riderMap || !riderMarker) return;

    const orderId = getOrderId();
    if (!orderId) {
      setStatus(
        'Waiting for rider — order ID not available yet.',
        'در انتظار پیک — شناسه سفارش هنوز موجود نیست.',
        'waiting'
      );
      return;
    }

    if (!trackingIsVerified()) {
      setStatus(
        'Verify your order to see the rider’s live location.',
        'برای دیدن موقعیت زنده پیک، سفارش خود را تأیید کنید.',
        'waiting'
      );
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      setStatus(
        'Waiting for rider location — live tracking is temporarily unavailable.',
        'در انتظار موقعیت پیک — پیگیری زنده موقتاً در دسترس نیست.',
        'waiting'
      );
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/orders/${encodeURIComponent(orderId)}/rider-location`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        setStatus(
          'Waiting for rider location…',
          'در انتظار موقعیت پیک…',
          'waiting'
        );
        return;
      }

      const point = parseCoordinates(await response.json());
      if (!point) {
        setStatus(
          'Waiting for rider location…',
          'در انتظار موقعیت پیک…',
          'waiting'
        );
        return;
      }

      riderMarker.setLatLng(point);
      riderMarker.setPopupContent('Rider live location');
      riderMap.panTo(point, { animate: true, duration: 0.6 });
      setStatus(
        'Rider location updated.',
        'موقعیت پیک به‌روزرسانی شد.',
        'live'
      );
    } catch (error) {
      console.warn('[Afghan Eats] Rider location request failed.', error);
      setStatus(
        'Waiting for rider location…',
        'در انتظار موقعیت پیک…',
        'waiting'
      );
    }
  }

  function startRiderLocationPolling() {
    if (pollTimer) return;

    pollRiderLocation();
    pollTimer = window.setInterval(pollRiderLocation, POLL_INTERVAL_MS);
  }

  function watchTrackingVisibility() {
    const experience = document.getElementById('trackingExperience');
    const gate = document.getElementById('trackGate');

    const observer = new MutationObserver(() => {
      ensureVisibleSize();
      if (trackingIsVerified()) {
        pollRiderLocation();
      }
    });

    if (experience) {
      observer.observe(experience, {
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
      });
    }

    if (gate) {
      observer.observe(gate, {
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
      });
    }
  }

  function bootRiderMap() {
    if (!document.getElementById('riderMap')) {
      console.warn('[Afghan Eats] Rider map was not mounted in the DOM.');
      return;
    }

    if (!initRiderMap()) return;

    watchTrackingVisibility();
    startRiderLocationPolling();

    window.addEventListener('resize', ensureVisibleSize, { passive: true });
    window.addEventListener('orientationchange', ensureVisibleSize, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRiderMap, { once: true });
  } else {
    bootRiderMap();
  }

  window.AfghanEatsRiderMap = {
    initRiderMap,
    pollRiderLocation
  };
})();
