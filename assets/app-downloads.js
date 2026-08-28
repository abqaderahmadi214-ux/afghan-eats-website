(() => {
  const cfg = window.AFGHAN_EATS_CONFIG || {};
  const entries = [
    { id:'customerAndroidDownload', url:cfg.customerAndroidUrl, label:'Google Play' },
    { id:'customerIosDownload', url:cfg.customerIosUrl, label:'App Store' }
  ];
  for (const entry of entries) {
    const el = document.getElementById(entry.id);
    if (!el) continue;
    const url = String(entry.url || '').trim();
    const status = el.querySelector('.app-download-status');
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
      el.classList.add('is-live');
      el.removeAttribute('aria-disabled');
      if (status) status.textContent = entry.label;
    } else {
      el.removeAttribute('href');
      el.removeAttribute('target');
      el.setAttribute('aria-disabled','true');
    }
  }
})();