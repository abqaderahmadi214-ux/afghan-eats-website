(() => {
  'use strict';
  const button = document.querySelector('[data-department-language]');
  const applyLanguage = () => {
    const isDari = localStorage.getItem('ae_lang') === 'fa';
    document.documentElement.lang = isDari ? 'fa' : 'en';
    document.documentElement.dir = isDari ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', isDari);
    document.querySelectorAll('[data-aria-en][data-aria-fa]').forEach((element) => {
      const label = isDari ? element.dataset.ariaFa : element.dataset.ariaEn;
      if (label) element.setAttribute('aria-label', label);
    });
    if (button) {
      button.textContent = isDari ? 'English' : 'دری';
      button.setAttribute('aria-label', isDari ? 'تغییر زبان به انگلیسی' : 'Switch language to Dari');
    }
  };
  button?.addEventListener('click', () => {
    localStorage.setItem('ae_lang', localStorage.getItem('ae_lang') === 'fa' ? 'en' : 'fa');
    applyLanguage();
  });
  applyLanguage();
})();
