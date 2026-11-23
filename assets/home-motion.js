(() => {
  const root = document.documentElement;
  const home = document.querySelector('.premium-home');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!home || reduceMotion?.matches) return;

  // The hero entrance itself is composed in CSS. Keep this class as the single
  // progressive-enhancement switch so content stays readable without JS/IO.
  root.classList.add('ae-motion-enabled');

  const revealSelector = [
    '.ae-value-item',
    '.ae-cuisine-section .section-head',
    '.ae-cuisine',
    '.ae-restaurants .section-head',
    '.ae-restaurants .restaurant-card',
    '.ae-community-head',
    '.ae-join-card'
  ].join(', ');
  const staggerGroups = new WeakMap();
  const groupSelector = '.ae-value-list, .ae-cuisines, .restaurant-grid, .ae-join-grid';
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('ae-motion-visible');
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' })
    : null;

  function nextStaggerDelay(element) {
    const group = element.closest(groupSelector);
    if (!group) return 0;
    const index = staggerGroups.get(group) || 0;
    staggerGroups.set(group, index + 1);
    // A short cascade gives each visual group a considered rhythm without
    // making later items wait too long, including on narrow screens.
    return Math.min(index, 5) * 58;
  }

  function prepareReveal(element) {
    if (element.classList.contains('ae-motion-reveal')) return;
    element.classList.add('ae-motion-reveal');
    element.style.setProperty('--ae-motion-delay', `${nextStaggerDelay(element)}ms`);
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add('ae-motion-visible');
  }

  function registerRevealTargets(scope = home) {
    if (scope.matches?.(revealSelector)) prepareReveal(scope);
    scope.querySelectorAll?.(revealSelector).forEach(prepareReveal);
  }

  registerRevealTargets();

  // Restaurant cards are populated asynchronously; give them the same measured
  // reveal as the static story sections without observing unrelated page nodes.
  const restaurantGrid = home.querySelector('#homeRestaurants');
  if (restaurantGrid && 'MutationObserver' in window) {
    const restaurantObserver = new MutationObserver(() => {
      restaurantGrid.querySelectorAll('.restaurant-card').forEach(prepareReveal);
    });
    restaurantObserver.observe(restaurantGrid, { childList: true, subtree: true });
  }

  const hero = home.querySelector('.ae-hero');
  const heroVisual = home.querySelector('.ae-hero-visual');
  // The existing CSS owns the hero transform; update only its scroll-depth
  // custom property to avoid competing transforms or pointer tracking.
  if (hero && heroVisual && window.matchMedia?.('(min-width: 761px)').matches) {
    let frame = 0;
    const updateDepth = () => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
      const denominator = Math.max(1, window.innerHeight / 2 + bounds.height / 2);
      const progress = (window.innerHeight / 2 - (bounds.top + bounds.height / 2)) / denominator;
      const depth = Math.max(-5, Math.min(5, progress * 6));
      heroVisual.style.setProperty('--ae-scroll-depth', `${depth.toFixed(1)}px`);
    };
    const scheduleDepthUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateDepth);
    };
    window.addEventListener('scroll', scheduleDepthUpdate, { passive: true });
    window.addEventListener('resize', scheduleDepthUpdate, { passive: true });
    scheduleDepthUpdate();
  }
})();
