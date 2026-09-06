(() => {
  const styles = [
    ['/assets/brand-theme.css?v=20260906-2', 'aeBrandTheme'],
    ['/assets/home-signature.css?v=20260906-1', 'aeHomeSignature'],
    ['/assets/home-hero-refined.css?v=20260906-1', 'aeHomeHeroRefined'],
    ['/assets/home-hero-density.css?v=20260906-1', 'aeHomeHeroDensity']
  ];
  for (const [href, datasetKey] of styles) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset[datasetKey] = '1';
    document.head.appendChild(link);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b332a');

  const grid = document.getElementById('cuisinePhotoGrid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.cuisine-photo-card')];
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduce || !('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    cards.forEach(card => card.classList.add('is-visible'));
    observer.disconnect();
  }, { threshold: 0.18 });
  observer.observe(grid);
})();