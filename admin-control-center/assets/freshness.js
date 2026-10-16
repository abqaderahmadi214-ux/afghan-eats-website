'use strict';
(function (global) {
  function canRefresh({ token, hidden, online, busy, dirty, editing, dialogOpen, view }) {
    return Boolean(token && !hidden && online !== false && !busy && !dirty && !editing && !dialogOpen && ['overview', 'dispatch', 'support'].includes(view));
  }
  function createFreshness({ document, navigator, getState, refresh, now = Date.now, setTimer = setInterval }) {
    let lastUpdated = 0, busy = false, dirty = false, failures = 0;
    const target = document.getElementById('connection-state');
    function paint() {
      if (!target) return;
      const age = lastUpdated ? Math.max(0, Math.floor((now() - lastUpdated) / 1000)) : null;
      target.dataset.freshness = navigator.onLine === false ? 'offline' : failures ? 'error' : age === null || age > 90 ? 'stale' : 'current';
      target.textContent = navigator.onLine === false ? 'Offline · updates paused' : busy ? 'Updating…' : failures ? 'Some data unavailable · refresh to retry' : dirty ? 'Edits in progress · auto-refresh paused' : age === null ? 'Waiting for data' : `Updated ${age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} ago`;
      if (lastUpdated) target.title = `Last complete refresh: ${new Date(lastUpdated).toLocaleString('en-GB', { timeZone: 'Asia/Kabul' })} (Kabul)`;
    }
    function tick() {
      paint();
      const active = document.activeElement;
      if (canRefresh({ ...getState(), hidden: document.hidden, online: navigator.onLine, busy, dirty, editing: Boolean(active?.matches?.('input,textarea,select,[contenteditable="true"]')), dialogOpen: Boolean(document.querySelector('dialog[open]')) })) void refresh();
    }
    document.addEventListener('input', event => { if (event.target.closest?.('#view-root')) { dirty = true; paint(); } });
    document.addEventListener('change', event => { if (event.target.closest?.('#view-root')) { dirty = true; paint(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    global.addEventListener?.('online', tick);
    global.addEventListener?.('offline', paint);
    setTimer(tick, 30000);
    return {
      begin() { busy = true; failures = 0; paint(); },
      failed() { failures += 1; paint(); },
      end(success) { busy = false; if (success && !failures) lastUpdated = now(); paint(); },
      clearDirty() { dirty = false; paint(); },
      isDirty() { return dirty; },
      reset() { lastUpdated = 0; busy = false; dirty = false; failures = 0; paint(); },
    };
  }
  global.AEFreshness = { canRefresh, createFreshness };
  if (typeof module !== 'undefined') module.exports = global.AEFreshness;
})(typeof window !== 'undefined' ? window : globalThis);
