(() => {
  const video = document.querySelector('[data-hero-video]');
  const button = document.querySelector('[data-hero-video-toggle]');
  if (!video || !button) return;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const englishLabel = button.querySelector('.en-copy');
  const dariLabel = button.querySelector('.fa-copy');
  const isDari = () => document.documentElement.dir === 'rtl' || document.body.classList.contains('rtl');
  const canAutoplay = () => !reducedMotion?.matches && connection?.saveData !== true;

  function updateButton() {
    const playing = !video.paused && !video.ended;
    const enText = playing ? 'Pause' : 'Play';
    const faText = playing ? 'توقف' : 'پخش';
    if (englishLabel) englishLabel.textContent = enText;
    if (dariLabel) dariLabel.textContent = faText;
    button.querySelector('[data-video-icon]')?.replaceChildren(document.createTextNode(playing ? 'Ⅱ' : '▶'));
    button.setAttribute('aria-label', isDari()
      ? (playing ? 'توقف پیش‌نمایش نمونهٔ اپ' : 'پخش پیش‌نمایش نمونهٔ اپ')
      : `${enText} sample app preview`);
  }

  function startWhenAllowed() {
    if (!canAutoplay()) return;
    const playback = video.play();
    playback?.catch?.(updateButton);
  }

  // The native controls remain as a no-JavaScript fallback. Once this accessible
  // custom control is ready, avoid showing two sets of controls at once.
  video.controls = false;
  button.hidden = false;
  button.addEventListener('click', () => {
    if (video.paused || video.ended) {
      const playback = video.play();
      playback?.catch?.(updateButton);
    } else {
      video.pause();
    }
  });
  for (const eventName of ['play', 'pause', 'ended']) {
    video.addEventListener(eventName, updateButton);
  }
  updateButton();
  startWhenAllowed();

  const onMotionPreferenceChange = event => {
    if (event.matches) video.pause();
    else startWhenAllowed();
    updateButton();
  };
  if (reducedMotion?.addEventListener) reducedMotion.addEventListener('change', onMotionPreferenceChange);
  else reducedMotion?.addListener?.(onMotionPreferenceChange);

  if ('MutationObserver' in window) {
    new MutationObserver(updateButton).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir', 'lang', 'class']
    });
  }
})();
