(() => {
  const body = document.body;
  if (!body?.classList.contains('premium-home')) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  body.classList.add('motion-ready');

  requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('is-page-ready')));

  /* Header depth on scroll */
  const header = document.querySelector('.header');
  const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 14);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive:true });

  /* Section + dynamic card reveals */
  const revealObserver = !reduceMotion && 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold:0.12, rootMargin:'0px 0px -7% 0px' })
    : null;

  function observeReveal(el, delay=0) {
    if (!el || el.classList.contains('ae-reveal')) return;
    el.classList.add('ae-reveal');
    if (delay) el.dataset.revealDelay = String(delay);
    if (reduceMotion || !revealObserver) el.classList.add('is-revealed');
    else revealObserver.observe(el);
  }

  document.querySelectorAll('.section-head').forEach((el,i) => observeReveal(el, Math.min(i % 3, 2)));
  document.querySelectorAll('.community-band .join-copy,.community-band .join-actions,.footer-main').forEach((el,i) => observeReveal(el, i+1));

  const cuisineCards = [...document.querySelectorAll('.cuisine-photo-card')];
  cuisineCards.forEach((card,i) => observeReveal(card, (i % 4) + 1));

  const homeGrid = document.getElementById('homeRestaurants');
  function wireRestaurantCards(scope=document) {
    const cards = [...scope.querySelectorAll?.('.restaurant-card') || []];
    cards.forEach((card,i) => {
      if (card.dataset.motionWired === '1') return;
      card.dataset.motionWired = '1';
      observeReveal(card, (i % 3) + 1);
      if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
        card.addEventListener('pointermove', e => {
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / Math.max(rect.width,1)) * 100;
          const y = ((e.clientY - rect.top) / Math.max(rect.height,1)) * 100;
          card.style.setProperty('--card-x', `${x.toFixed(1)}%`);
          card.style.setProperty('--card-y', `${y.toFixed(1)}%`);
        }, { passive:true });
      }
    });
  }
  wireRestaurantCards(document);
  if (homeGrid && 'MutationObserver' in window) {
    new MutationObserver(() => wireRestaurantCards(homeGrid)).observe(homeGrid,{childList:true,subtree:true});
  }

  /* Hero carousel parallax and drag state */
  const carousel = document.getElementById('heroCarousel');
  if (carousel) {
    const progress = document.createElement('div');
    progress.className = 'hero-motion-progress';
    progress.setAttribute('aria-hidden','true');
    progress.innerHTML = '<span></span>';
    carousel.appendChild(progress);
    const progressBar = progress.firstElementChild;

    const restartProgress = () => {
      if (!progressBar || reduceMotion) return;
      progressBar.classList.remove('is-running');
      void progressBar.offsetWidth;
      progressBar.classList.add('is-running');
    };
    restartProgress();

    const track = document.getElementById('heroCarouselTrack');
    if (track && 'MutationObserver' in window) {
      new MutationObserver(mutations => {
        if (mutations.some(m => m.type === 'attributes' && m.attributeName === 'class')) restartProgress();
      }).observe(track,{subtree:true,attributes:true,attributeFilter:['class']});
    }

    if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
      let frame = 0;
      carousel.addEventListener('pointermove', e => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = carousel.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / Math.max(rect.width,1)) - .5;
          const ny = ((e.clientY - rect.top) / Math.max(rect.height,1)) - .5;
          carousel.style.setProperty('--hero-pan-x', `${(nx * -9).toFixed(2)}px`);
          carousel.style.setProperty('--hero-pan-y', `${(ny * -7).toFixed(2)}px`);
        });
      }, { passive:true });
      carousel.addEventListener('pointerleave', () => {
        carousel.style.setProperty('--hero-pan-x','0px');
        carousel.style.setProperty('--hero-pan-y','0px');
      });
    }
    carousel.addEventListener('pointerdown', () => carousel.classList.add('is-dragging'));
    window.addEventListener('pointerup', () => carousel.classList.remove('is-dragging'), { passive:true });
    window.addEventListener('pointercancel', () => carousel.classList.remove('is-dragging'), { passive:true });
  }

  /* Button ripple feedback: decorative only, no navigation interception */
  if (!reduceMotion) {
    document.querySelectorAll('.premium-home .btn,.premium-home .join-link').forEach(el => {
      el.classList.add('ae-ripple-host');
      el.addEventListener('pointerdown', e => {
        if (e.button != null && e.button !== 0) return;
        const rect = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ae-ripple';
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top = `${e.clientY - rect.top}px`;
        el.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once:true });
      });
    });
  }

  /* Make keyboard interaction as polished as pointer interaction */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    body.classList.add('using-keyboard');
  }, { once:true });
})();
