(function () {
  'use strict';

  const DISMISS_KEY = 'ae_pwa_install_dismissed';
  let deferredPrompt = null;

  function isDari() {
    return localStorage.getItem('ae_lang') === 'fa';
  }

  function injectStyles() {
    if (document.getElementById('aePwaInstallStyles')) return;
    const style = document.createElement('style');
    style.id = 'aePwaInstallStyles';
    style.textContent = `
      .ae-pwa-install{position:fixed;left:16px;right:16px;bottom:82px;z-index:10000;max-width:520px;margin:auto;background:#fff;border:1px solid rgba(15,23,42,.12);border-radius:16px;box-shadow:0 18px 45px rgba(15,23,42,.2);padding:14px;display:flex;gap:12px;align-items:center}
      .ae-pwa-install[hidden]{display:none}
      .ae-pwa-install-copy{flex:1;min-width:0}
      .ae-pwa-install-copy strong{display:block;margin-bottom:3px}
      .ae-pwa-install-copy small{color:#64748b}
      .ae-pwa-install-actions{display:flex;gap:8px;flex-wrap:wrap}
      .ae-pwa-install button{border:0;border-radius:10px;padding:9px 13px;font:inherit;cursor:pointer}
      .ae-pwa-install .install{background:#b91c1c;color:#fff}
      .ae-pwa-install .later{background:#f1f5f9;color:#0f172a}
      @media (max-width:560px){.ae-pwa-install{bottom:74px;align-items:flex-start;flex-direction:column}.ae-pwa-install-actions{width:100%}.ae-pwa-install button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function removeBanner() {
    document.getElementById('aePwaInstall')?.remove();
  }

  function showBanner() {
    if (!deferredPrompt || localStorage.getItem(DISMISS_KEY) === '1' || document.getElementById('aePwaInstall')) return;

    injectStyles();
    const fa = isDari();
    const banner = document.createElement('aside');
    banner.id = 'aePwaInstall';
    banner.className = 'ae-pwa-install';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', fa ? 'نصب افغان ایتس' : 'Install Afghan Eats');
    banner.innerHTML = `
      <div class="ae-pwa-install-copy">
        <strong>${fa ? 'افغان ایتس را نصب کنید' : 'Install Afghan Eats'}</strong>
        <small>${fa ? 'برای دسترسی سریع‌تر و استفاده بهتر در اینترنت ضعیف.' : 'Faster access and a better experience on slower connections.'}</small>
      </div>
      <div class="ae-pwa-install-actions">
        <button class="later" type="button" data-pwa-later>${fa ? 'بعداً' : 'Later'}</button>
        <button class="install" type="button" data-pwa-install>${fa ? 'نصب' : 'Install'}</button>
      </div>
    `;

    banner.querySelector('[data-pwa-later]')?.addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, '1');
      removeBanner();
    });

    banner.querySelector('[data-pwa-install]')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        removeBanner();
      }
    });

    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeBanner();
  });
})();
