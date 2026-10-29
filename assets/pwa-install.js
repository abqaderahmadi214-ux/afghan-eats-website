(function () {
  'use strict';

  const DISMISS_KEY = 'ae_pwa_install_dismissed';
  let deferredPrompt = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The install guidance remains usable when browser storage is unavailable.
    }
  }

  function isDari() {
    return storageGet('ae_lang') === 'fa';
  }

  function isIOSDevice() {
    const userAgent = window.navigator.userAgent || '';
    const platform = window.navigator.platform || '';
    return /iPad|iPhone|iPod/i.test(userAgent) ||
      (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.navigator.standalone === true ||
      Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
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
      .ae-pwa-install-copy small{display:block;color:#475569;line-height:1.45}
      .ae-pwa-install-copy .note{margin-top:5px;color:#64748b}
      .ae-pwa-install-actions{display:flex;gap:8px;flex-wrap:wrap}
      .ae-pwa-install button{min-height:44px;border:0;border-radius:10px;padding:9px 13px;font:inherit;cursor:pointer}
      .ae-pwa-install .install{background:#b91c1c;color:#fff}
      .ae-pwa-install .later{background:#f1f5f9;color:#0f172a}
      @media (max-width:560px){.ae-pwa-install{bottom:74px;align-items:flex-start;flex-direction:column}.ae-pwa-install-actions{width:100%}.ae-pwa-install button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function removeBanner() {
    document.getElementById('aePwaInstall')?.remove();
  }

  function createBanner({ label, title, instructions, note, laterLabel, installLabel }) {
    if (storageGet(DISMISS_KEY) === '1' || document.getElementById('aePwaInstall')) return null;

    injectStyles();
    const banner = document.createElement('aside');
    banner.id = 'aePwaInstall';
    banner.className = 'ae-pwa-install';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', label);
    banner.innerHTML = `
      <div class="ae-pwa-install-copy">
        <strong>${title}</strong>
        <small>${instructions}</small>
        ${note ? `<small class="note">${note}</small>` : ''}
      </div>
      <div class="ae-pwa-install-actions">
        <button class="later" type="button" data-pwa-later>${laterLabel}</button>
        ${installLabel ? `<button class="install" type="button" data-pwa-install>${installLabel}</button>` : ''}
      </div>
    `;

    banner.querySelector('[data-pwa-later]')?.addEventListener('click', () => {
      storageSet(DISMISS_KEY, '1');
      removeBanner();
    });

    if (installLabel) {
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
    }

    document.body.appendChild(banner);
    return banner;
  }

  function showIOSGuide() {
    if (!isIOSDevice() || isStandalone()) return;
    const fa = isDari();
    createBanner({
      label: fa ? 'افزودن افغان ایتس به صفحهٔ اصلی' : 'Add Afghan Eats to your Home Screen',
      title: fa ? 'افغان ایتس را به صفحهٔ اصلی اضافه کنید' : 'Add Afghan Eats to your Home Screen',
      instructions: fa
        ? 'در Safari این صفحه را باز کنید، Share را بزنید و Add to Home Screen را انتخاب کنید. اگر Open as Web App نمایش داده شد، آن را روشن کنید و Add را بزنید.'
        : 'In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if it appears, then tap Add.',
      note: fa
        ? 'برای دیدن اطلاعات تازهٔ رستورانت‌ها و ثبت یا پیگیری سفارش به اینترنت نیاز دارید.'
        : 'Live restaurant information and placing or managing orders still require an internet connection.',
      laterLabel: fa ? 'بعداً' : 'Later'
    });
  }

  function showBrowserInstallPrompt() {
    if (!deferredPrompt || isIOSDevice() || isStandalone()) return;
    const fa = isDari();
    createBanner({
      label: fa ? 'نصب افغان ایتس' : 'Install Afghan Eats',
      title: fa ? 'افغان ایتس را نصب کنید' : 'Install Afghan Eats',
      instructions: fa
        ? 'افغان ایتس را برای دسترسی آسان‌تر به صفحهٔ اصلی اضافه کنید.'
        : 'Add Afghan Eats to your home screen for easier access.',
      laterLabel: fa ? 'بعداً' : 'Later',
      installLabel: fa ? 'نصب' : 'Install'
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    if (isIOSDevice()) return;
    event.preventDefault();
    deferredPrompt = event;
    showBrowserInstallPrompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeBanner();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showIOSGuide, { once: true });
  } else {
    showIOSGuide();
  }
})();
