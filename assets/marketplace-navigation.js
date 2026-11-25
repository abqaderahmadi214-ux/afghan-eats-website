(() => {
  'use strict';

  const departments = [
    { slug: 'restaurants', href: '/restaurants', nameEn: 'Restaurants', nameFa: 'رستورانت‌ها', statusEn: 'Browse menus', statusFa: 'دیدن منوها', availability: 'available' },
    { slug: 'groceries', href: '/groceries', nameEn: 'Groceries', nameFa: 'مواد غذایی', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
    { slug: 'health-beauty', href: '/health-beauty', nameEn: 'Health & Beauty', nameFa: 'صحت و زیبایی', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
    { slug: 'convenience', href: '/convenience', nameEn: 'Convenience', nameFa: 'ضروریات روزمره', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
    { slug: 'gifts', href: '/gifts', nameEn: 'Gifts', nameFa: 'هدایا', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
    { slug: 'electronics', href: '/electronics', nameEn: 'Electronics', nameFa: 'الکترونیک', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
    { slug: 'pet-supplies', href: '/pet-supplies', nameEn: 'Pet Supplies', nameFa: 'لوازم حیوانات خانگی', statusEn: 'Coming soon', statusFa: 'به‌زودی', availability: 'coming-soon' },
  ];

  function normalizedPath(path) {
    let value = String(path || '/');
    if (value.endsWith('/index.html')) value = value.slice(0, -'index.html'.length);
    else if (value.endsWith('.html')) value = value.slice(0, -'.html'.length);
    value = value.replace(/\/+$/, '');
    return value || '/';
  }

  function linkPath(anchor) {
    try {
      const url = new URL(anchor.getAttribute('href') || '', window.location.origin);
      return url.origin === window.location.origin ? normalizedPath(url.pathname) : '';
    } catch {
      return '';
    }
  }

  function localizedText(en, fa) {
    const group = document.createElement('span');
    const english = document.createElement('span');
    const dari = document.createElement('span');
    english.className = 'en-copy';
    dari.className = 'fa-copy';
    english.textContent = en;
    dari.textContent = fa;
    group.append(english, dari);
    return group;
  }

  function updateAccessibleLabels() {
    const isDari = document.documentElement.lang === 'fa';
    const nav = document.getElementById('aeMarketplaceTabs');
    if (nav) nav.setAttribute('aria-label', isDari ? nav.dataset.ariaFa : nav.dataset.ariaEn);
    document.querySelectorAll('button.lang').forEach((button) => {
      button.setAttribute('aria-label', isDari ? 'تغییر زبان به انگلیسی' : 'Switch language to Dari');
      button.dataset.targetLanguage = isDari ? 'en' : 'fa';
    });
  }

  function makeTab(department, currentPath) {
    const anchor = document.createElement('a');
    anchor.className = 'ae-marketplace-tab';
    anchor.href = department.href;
    anchor.dataset.department = department.slug;
    anchor.dataset.availability = department.availability;
    anchor.append(localizedText(department.nameEn, department.nameFa));

    const status = document.createElement('span');
    status.className = 'ae-marketplace-tab__status';
    status.append(localizedText(department.statusEn, department.statusFa));
    anchor.append(status);

    const isRestaurantsDetail = department.slug === 'restaurants' && currentPath === '/restaurant';
    if (currentPath === department.href || isRestaurantsDetail) anchor.setAttribute('aria-current', 'page');
    return anchor;
  }

  function mountNavigation() {
    if (document.getElementById('aeMarketplaceTabs')) return;
    const header = document.querySelector('header.header, .header');
    const utilityNav = header?.querySelector('nav.navlinks');
    const headerRow = header?.querySelector('.container.nav, .nav');
    if (!header || !utilityNav || !headerRow) return;

    if (['/', '/restaurants', '/restaurant'].includes(normalizedPath(window.location.pathname))) {
      document.body.classList.add('ae-food-journey');
      updateAccessibleLabels();
      new MutationObserver(updateAccessibleLabels).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
      return;
    }

    // Restaurants now lives in the department strip, alongside the six peer departments.
    utilityNav.querySelectorAll('a').forEach((anchor) => {
      if (linkPath(anchor) === '/restaurants') anchor.remove();
    });
    let removedMobileRestaurants = false;
    document.querySelectorAll('.mobile-nav a').forEach((anchor) => {
      if (linkPath(anchor) === '/restaurants') {
        anchor.remove();
        removedMobileRestaurants = true;
      }
    });

    const nav = document.createElement('nav');
    nav.id = 'aeMarketplaceTabs';
    nav.className = 'ae-marketplace-tabs';
    nav.dataset.ariaEn = 'Department links';
    nav.dataset.ariaFa = 'پیوندهای بخش‌ها';
    nav.setAttribute('aria-label', document.documentElement.lang === 'fa' ? nav.dataset.ariaFa : nav.dataset.ariaEn);

    const track = document.createElement('div');
    track.className = 'ae-marketplace-tabs__track';
    departments.forEach((department) => track.append(makeTab(department, normalizedPath(window.location.pathname))));
    nav.append(track);
    headerRow.insertAdjacentElement('afterend', nav);

    document.body.classList.add('ae-has-marketplace-tabs');
    if (removedMobileRestaurants) document.body.classList.add('ae-marketplace-mobile-nav-compact');
    updateAccessibleLabels();

    const languageObserver = new MutationObserver(updateAccessibleLabels);
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    document.addEventListener('ae:languagechange', updateAccessibleLabels);
  }

  function loadStylesAndMount() {
    const existing = document.querySelector('link[data-ae-marketplace-navigation-styles]');
    if (existing) {
      mountNavigation();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/marketplace-navigation.css?v=20261124-1';
    link.dataset.aeMarketplaceNavigationStyles = 'true';
    link.addEventListener('load', mountNavigation, { once: true });
    link.addEventListener('error', mountNavigation, { once: true });
    document.head.append(link);
    if (link.sheet) mountNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadStylesAndMount, { once: true });
  else loadStylesAndMount();
})();
