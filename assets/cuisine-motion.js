(() => {
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