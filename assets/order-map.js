(function () {
  'use strict';

  const HERAT = [34.352, 62.204];
  const POLL_MS = 30000;
  let map = null;
  let marker = null;
  let timer = null;

  function orderId() {
    return new URLSearchParams(location.search).get('id') || '';
  }

  function apiBase() {
    return String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
  }

  function trackingUnlocked() {
    const experience = document.getElementById('trackingExperience');
    const gate = document.getElementById('trackGate');
    return Boolean(
      (experience && !experience.classList.contains('is-locked')) ||
      gate?.classList.contains('hidden')
    );
  }

  function coordinates(payload) {
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
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
    }
    return null;
  }

  function initMap() {
    const host = document.getElementById('riderMap');
    if (!host || !window.L) return false;

    map = window.L.map(host, {
      zoomControl: true,
      attributionControl: true
    }).setView(HERAT, 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    marker = window.L.marker(HERAT).addTo(map);
    return true;
  }

  async function pollRiderLocation() {
    const id = orderId();
    const base = apiBase();
    if (!map || !marker || !id || !base || !trackingUnlocked()) return;

    try {
      const response = await fetch(`${base}/api/orders/${encodeURIComponent(id)}/rider-location`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) return;

      const point = coordinates(await response.json());
      if (!point) return;

      marker.setLatLng(point);
      map.panTo(point, { animate: true, duration: 0.6 });
    } catch {
      // Keep the existing text tracking experience as the fallback.
    }
  }

  function startPolling() {
    if (timer) return;
    pollRiderLocation();
    timer = window.setInterval(pollRiderLocation, POLL_MS);
  }

  function watchVerification() {
    const experience = document.getElementById('trackingExperience');
    const gate = document.getElementById('trackGate');
    const observer = new MutationObserver(() => {
      if (trackingUnlocked()) {
        map?.invalidateSize();
        pollRiderLocation();
      }
    });
    if (experience) observer.observe(experience, { attributes: true, attributeFilter: ['class'] });
    if (gate) observer.observe(gate, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    if (!orderId()) return;
    if (!initMap()) return;
    watchVerification();
    startPolling();
    window.setTimeout(() => map?.invalidateSize(), 200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
