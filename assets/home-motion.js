(() => {
  'use strict';
  const root = document.documentElement;
  const home = document.querySelector('.premium-home');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!home || reduceMotion?.matches) return;

  root.classList.add('ae-motion-enabled');
  const revealSelector = [
    '.ae-restaurants .section-head',
    '.ae-restaurants .restaurant-card',
    '.ae-home-business-card'
  ].join(', ');
  const prepared = new WeakSet();
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('ae-motion-visible');
          observer.unobserve(entry.target);
        }
      }, { threshold: 0, rootMargin: '0px 0px 48px 0px' })
    : null;

  function prepareReveal(element) {
    if (prepared.has(element)) return;
    prepared.add(element);
    element.classList.add('ae-motion-reveal');
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add('ae-motion-visible');
  }

  home.querySelectorAll(revealSelector).forEach(prepareReveal);
  const restaurantGrid = home.querySelector('#homeRestaurants');
  if (restaurantGrid && 'MutationObserver' in window) {
    const restaurantObserver = new MutationObserver(() => {
      restaurantGrid.querySelectorAll('.restaurant-card').forEach(prepareReveal);
    });
    restaurantObserver.observe(restaurantGrid, { childList: true, subtree: true });
  }
})();
