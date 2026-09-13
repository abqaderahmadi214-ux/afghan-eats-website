/* Presentation-only enhancements. Ordering, authentication and catalogue APIs stay in their existing modules. */
(() => {
  const init = () => {
    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    document.querySelectorAll('.navlinks a, .mobile-nav a').forEach(link => {
      const target = new URL(link.href).pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      if (target === path || (target === '/restaurants' && path === '/restaurant')) link.setAttribute('aria-current', 'page');
    });
    const category = new URLSearchParams(location.search).get('c');
    document.querySelectorAll('.ae-category-filters a').forEach(link => {
      if (new URL(link.href).searchParams.get('c') === category) link.setAttribute('aria-current', 'true');
    });
    const syncModes = () => document.querySelectorAll('.mode-tabs button[data-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === (localStorage.getItem('ae_mode') || 'delivery')));
    });
    syncModes();
    window.addEventListener('ae:modechange', syncModes);
    document.querySelectorAll('input[type="tel"], a[href^="mailto:"]').forEach(el => el.setAttribute('dir', 'ltr'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
