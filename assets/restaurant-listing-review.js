(function () {
  'use strict';

  const isDari = () => document.documentElement.lang === 'fa' || localStorage.getItem('ae_lang') === 'fa';
  const copy = (en, fa) => isDari() ? fa : en;
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const faDigits = value => new Intl.NumberFormat('fa-AF').format(value);
  const browseAfn = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '';
    const formatted = new Intl.NumberFormat(isDari() ? 'fa-AF' : 'en-US', { maximumFractionDigits: 2 }).format(amount);
    return isDari() ? `${formatted} افغانی` : `AFN ${formatted}`;
  };

  function getRows() {
    try { return typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : []; }
    catch { return []; }
  }

  function appFunction(name) {
    try { return typeof window[name] === 'function' ? window[name] : null; }
    catch { return null; }
  }

  function setBrowseAreaLabel(trigger, value) {
    const label = document.getElementById('aeBrowseAreaName');
    const caption = trigger?.querySelector('small');
    const address = String(value || '').trim();
    if (caption) caption.innerHTML = `<span class="en-copy">Delivery address</span><span class="fa-copy">آدرس تحویل</span>`;
    if (label) {
      label.textContent = address || copy('Set address', 'آدرس را وارد کنید');
      label.dir = 'auto';
    }
    trigger?.setAttribute('aria-label', address
      ? copy(`Delivery address: ${address}. Change delivery address`, `آدرس تحویل: ${address}. تغییر آدرس تحویل`)
      : copy('Set a delivery address to check restaurant quotes', 'برای بررسی نرخ رستورانت، آدرس تحویل را وارد کنید'));
  }

  function addBrowseAreaDialog(trigger) {
    if (!trigger) return;
    let dialog = document.getElementById('aeBrowseAreaDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'aeBrowseAreaDialog';
      dialog.className = 'ae-discovery-dialog ae-browse-area-dialog';
      dialog.setAttribute('aria-labelledby', 'aeBrowseAreaTitle');
      dialog.setAttribute('aria-describedby', 'aeBrowseAreaDescription');
      dialog.innerHTML = `<form class="ae-dialog-card" id="aeBrowseAreaForm"><div class="ae-dialog-title-row"><span class="restaurant-page-kicker"><span class="en-copy">DELIVERY ADDRESS</span><span class="fa-copy">آدرس تحویل</span></span><button class="ae-dialog-close" type="button" aria-label="Close" data-dialog-close>×</button></div><h2 id="aeBrowseAreaTitle"><span class="en-copy">Enter a delivery address</span><span class="fa-copy">آدرس تحویل را وارد کنید</span></h2><p id="aeBrowseAreaDescription"><span class="en-copy">Enter a street or landmark to check delivery fees and times.</span><span class="fa-copy">برای بررسی هزینه و زمان ارسال، نام سرک یا یک نشانی نزدیک را بنویسید.</span></p><label for="aeBrowseAreaInput"><span class="en-copy">Full address, street or landmark</span><span class="fa-copy">آدرس کامل، سرک یا نشانی نزدیک</span></label><input id="aeBrowseAreaInput" name="deliveryAddress" autocomplete="street-address" minlength="5" maxlength="180" required placeholder="Street, area or landmark" data-ph-en="Street, area or landmark" data-ph-fa="سرک، ناحیه یا نشانی نزدیک" dir="auto"><p id="aeBrowseAreaStatus" class="ae-location-status" role="status" aria-live="polite" hidden></p><div class="ae-dialog-actions"><button class="btn btn-light" type="button" data-dialog-close><span class="en-copy">Cancel</span><span class="fa-copy">لغو</span></button><button class="btn btn-primary" type="submit"><span class="en-copy">Check delivery here</span><span class="fa-copy">بررسی ارسال به این نشانی</span></button></div></form>`;
      document.body.append(dialog);
    }
    const form = dialog.querySelector('#aeBrowseAreaForm');
    const input = dialog.querySelector('#aeBrowseAreaInput');
    const status = dialog.querySelector('#aeBrowseAreaStatus');
    const submit = form?.querySelector('button[type="submit"]');
    const updateInputCopy = () => { if (input) input.placeholder = copy(input.dataset.phEn, input.dataset.phFa); };
    setBrowseAreaLabel(trigger, localStorage.getItem('ae_address') || '');
    trigger.addEventListener('click', () => {
      if (input) {
        input.value = localStorage.getItem('ae_address') || '';
        input.setCustomValidity('');
      }
      if (status) {
        status.hidden = true;
        status.textContent = '';
        delete status.dataset.state;
      }
      updateInputCopy();
      if (!dialog.open) dialog.showModal();
      input?.focus();
    });
    input?.addEventListener('input', () => input.setCustomValidity(''));
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
    });
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const address = String(input?.value || '').trim();
      if (!input || !submit || !form.reportValidity()) return;
      if (address.length < 5) {
        input.setCustomValidity(copy('Enter at least five characters for the address.', 'برای آدرس دست‌کم پنج نویسه وارد کنید.'));
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      localStorage.setItem('ae_address', address);
      setBrowseAreaLabel(trigger, address);
      normalizeAddressSummary();
      if (status) {
        status.hidden = false;
        status.dataset.state = 'checking';
        status.textContent = copy('Checking current address-specific delivery quotes…', 'در حال بررسی نرخ‌های فعلی ارسال برای این آدرس…');
      }
      form.setAttribute('aria-busy', 'true');
      input.disabled = true;
      submit.disabled = true;
      try {
        const clearQuoteCache = appFunction('clearQuoteCache');
        const setMode = appFunction('setMode');
        const refreshDeliveryContext = appFunction('refreshDeliveryContext');
        const renderRestaurantSurfaces = appFunction('renderRestaurantSurfaces');
        if (!clearQuoteCache || !setMode || !refreshDeliveryContext) {
          throw new Error('The existing live address-quote flow is unavailable.');
        }
        clearQuoteCache();
        getRows().forEach(restaurant => {
          delete restaurant._deliveryQuote;
          delete restaurant._deliveryUnavailable;
        });
        setMode('delivery', { silent: true });
        await refreshDeliveryContext();
        renderRestaurantSurfaces?.();
        window.dispatchEvent(new CustomEvent('ae:restaurantsrefreshed', { detail: { count: getRows().length } }));
        const quotedRestaurants = getRows().filter(restaurant => deliveryQuoteFor(restaurant)).length;
        if (status) {
          status.dataset.state = quotedRestaurants ? 'success' : 'pending';
          status.textContent = quotedRestaurants
            ? copy('Delivery fees and times appear for restaurants with a current quote.', 'هزینه و زمان ارسال برای رستورانت‌هایی که نرخ تازه دارند نمایش داده می‌شود.')
            : copy('No current address-specific quote was returned. Delivery availability is not confirmed; public menus remain available.', 'برای این آدرس نرخ تازه‌ای دریافت نشد. دسترسی ارسال تأیید نشده است؛ منوهای عمومی همچنان قابل مشاهده‌اند.');
        }
      } catch (error) {
        console.warn('Address quote refresh unavailable', error);
        if (status) {
          status.dataset.state = 'error';
          status.textContent = copy('Live delivery details could not be refreshed. No availability is confirmed; public menus remain available.', 'معلومات زنده ارسال تازه نشد. دسترسی ارسال تأیید نشده است؛ منوهای عمومی همچنان قابل مشاهده‌اند.');
        }
      } finally {
        form.removeAttribute('aria-busy');
        input.disabled = false;
        submit.disabled = false;
      }
    });
    dialog.addEventListener('close', () => trigger.focus());
  }

  function addBrowseNote(anchor) {
    if (!anchor || document.getElementById('aeListingAreaNote')) return;
    const note = document.createElement('aside');
    note.id = 'aeListingAreaNote';
    note.className = 'ae-listing-browse-note';
    note.setAttribute('role', 'note');
    note.innerHTML = `<span class="ae-listing-browse-icon" aria-hidden="true">i</span><p><span class="en-copy">Enter a delivery address to refresh restaurant-level quotes. Fees and times appear only when a restaurant returns an address-specific quote; this page does not place orders.</span><span class="fa-copy">برای تازه‌سازی نرخ‌های هر رستورانت، آدرس تحویل را وارد کنید. هزینه و زمان تنها هنگام دریافت نرخ مخصوص همان آدرس نمایش داده می‌شود؛ از این صفحه سفارش ثبت نمی‌شود.</span></p>`;
    anchor.insertAdjacentElement('afterend', note);
  }

  function cuisineData() {
    return [
      { key: '', en: 'All cuisines', fa: 'همه دسته‌ها', markEn: 'All', markFa: 'همه' },
      { key: 'afghan', en: 'Afghan', fa: 'افغانی', art: '/assets/images/afghan-feast-small.webp' },
      { key: 'rice-dishes', en: 'Qabili & rice', fa: 'قابلی و برنجی', art: '/assets/images/afghan-feast-small.webp' },
      { key: 'kebab', en: 'Kebab', fa: 'کباب', art: '/assets/images/kebab.webp' },
      { key: 'pizza', en: 'Pizza', fa: 'پیتزا', art: '/assets/images/pizza.webp' },
      { key: 'burgers', en: 'Burgers', fa: 'برگر', art: '/assets/images/burger.webp' },
      { key: 'desserts', en: 'Desserts', fa: 'دسر', art: '/assets/images/sweets.webp' }
    ];
  }

  function makeCuisineTiles(row) {
    if (!row || row.dataset.reviewTilesReady === 'true') return;
    row.dataset.reviewTilesReady = 'true';
    row.setAttribute('aria-label', copy('Browse by cuisine', 'جستجو بر اساس دسته'));
    row.innerHTML = cuisineData().map((item, index) => `<button class="dish-category-chip${index === 0 ? ' active' : ''}" type="button" data-dish-category="${esc(item.key)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${item.art ? `<span class="dish-category-image"><img src="${esc(item.art)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="dish-category-image"><span class="dish-category-all"><span class="en-copy">${item.markEn}</span><span class="fa-copy">${item.markFa}</span></span></span>`}<strong><span class="en-copy">${item.en}</span><span class="fa-copy">${item.fa}</span></strong></button>`).join('');
    row.addEventListener('click', event => {
      const button = event.target.closest('[data-dish-category]');
      if (!button || !row.contains(button)) return;
      row.querySelectorAll('[data-dish-category]').forEach(chip => {
        const selected = chip === button;
        chip.classList.toggle('active', selected);
        chip.setAttribute('aria-pressed', String(selected));
      });
      window.AE_DISH_CATEGORY = button.dataset.dishCategory || '';
      window.advancedRestaurantSearch?.();
      window.AfghanEatsDishSearch?.scheduleSearch?.();
      syncFilterState();
    });
  }

  function createFilterButton(filter, en, fa) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip restaurant-filter-chip';
    button.dataset.filter = filter;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="en-copy">${en}</span><span class="fa-copy">${fa}</span>`;
    button.addEventListener('click', () => window.toggleAdvancedFilter?.(button));
    return button;
  }

  function patchListingCardRendering() {
    if (window.__aeListingCardWrapped || typeof window.restaurantCard !== 'function') return;
    const originalCard = window.restaurantCard;
    const originalMedia = window.browseRestaurantMedia;
    window.__aeListingCardWrapped = true;
    window.__aeListingOriginalRestaurantCard = originalCard;
    window.browseRestaurantMedia = function (restaurant) {
      if (!document.body.classList.contains('restaurants-page')) return originalMedia ? originalMedia(restaurant) : '';
      const name = typeof displayName === 'function' ? displayName(restaurant) : (restaurant?.name || 'Restaurant');
      const sources = [restaurant?.cover_image_url, ...(Array.isArray(restaurant?.gallery_images) ? restaurant.gallery_images : [])].filter(Boolean);
      const image = typeof resilientImageMarkup === 'function' ? resilientImageMarkup(sources, name) : '';
      const initials = typeof restaurantPlaceholderInitials === 'function' ? restaurantPlaceholderInitials(restaurant) : 'AE';
      const placeholder = `<div class="restaurant-photo-placeholder restaurant-specific-placeholder media-fallback" aria-label="${esc(copy('Restaurant photo unavailable', 'عکس رستورانت در دسترس نیست'))}"${image ? ' hidden' : ''}><span class="restaurant-placeholder-mark" aria-hidden="true">${esc(initials)}</span><b>${esc(name)}</b><small>${esc(copy('Photo unavailable', 'عکس در دسترس نیست'))}</small></div>`;
      return `${image}${placeholder}`;
    };
    window.restaurantCard = function (restaurant) {
      const html = originalCard.call(this, restaurant);
      if (!document.body.classList.contains('restaurants-page')) return html;
      let result = html;
      const logoUrl = typeof safeMediaUrl === 'function' ? safeMediaUrl(restaurant?.logo_url) : '';
      const logo = logoUrl ? `<span class="ae-card-logo" aria-hidden="true"><img src="${esc(logoUrl)}" alt="" loading="lazy" decoding="async"></span>` : '';
      if (logo) result = result.replace(/(<div class="restaurant-image">[\s\S]*?)(<\/div><div class="restaurant-body">)/, `$1${logo}$2`);
      result = result.replace('<h3>', '<h3 dir="auto">').replace('<div class="tagline">', '<div class="tagline" dir="auto">');
      const directory = typeof isDirectoryListing === 'function' && isDirectoryListing(restaurant);
      const preview = Boolean(restaurant?.menu_preview_only && !['owner_confirmed', 'field_verified'].includes(restaurant?.verification_status));
      const rating = typeof trustedRating === 'function' ? trustedRating(restaurant) : null;
      if (!directory && !preview) {
        result = result.replace(/<div class="browse-card-meta"[^>]*>[\s\S]*?<\/div>/, `<div class="browse-card-meta" dir="auto">${esc(safeQuoteMeta(restaurant))}</div>`);
      }
      if (rating) {
        const ratingLabel = copy(`${rating.rating.toFixed(1)} out of 5 from ${rating.count} reviews`, `${rating.count} دیدگاه، امتیاز ${rating.rating.toFixed(1)} از ۵`);
        result = result.replace(/<span class="rating">[\s\S]*?<\/span>/, `<span class="rating" aria-label="${esc(ratingLabel)}">★ ${rating.rating.toFixed(1)} (${rating.count})</span>`);
      }
      if (!directory && !preview && !rating) {
        const reviewNote = `<div class="browse-card-reviews"><span class="en-copy">No verified customer rating</span><span class="fa-copy">امتیاز تأییدشدۀ مشتری موجود نیست</span></div>`;
        result = result.replace('<div class="tagline" dir="auto">', `${reviewNote}<div class="tagline" dir="auto">`);
      }
      return result;
    };
  }

  function deliveryQuoteFor(restaurant) {
    const quote = restaurant?._deliveryQuote || null;
    return quote && quote.source !== 'pickup' && quote.fulfillment !== 'pickup' ? quote : null;
  }

  function safeQuoteMeta(restaurant) {
    const quote = restaurant?._deliveryQuote || null;
    const pickup = typeof mode !== 'undefined' ? mode === 'pickup' : localStorage.getItem('ae_mode') === 'pickup';
    const pieces = [];
    if (pickup) {
      const pickupQuote = quote && (quote.fulfillment === 'pickup' || quote.source === 'pickup') ? quote : null;
      const etaMin = pickupQuote?.pickupEtaMin ?? pickupQuote?.collectionEtaMin;
      const etaMax = pickupQuote?.pickupEtaMax ?? pickupQuote?.collectionEtaMax;
      if (etaMin != null && etaMin !== '') {
        const eta = etaMax != null && etaMax !== '' && Number(etaMax) !== Number(etaMin) ? `${etaMin}–${etaMax}` : `${etaMin}`;
        pieces.push(copy(`Pickup estimate: ${eta} min`, `زمان دریافت: ${eta} دقیقه`));
      } else {
        pieces.push(copy('Pickup timing not confirmed', 'زمان دریافت تأیید نشده است'));
      }
      return pieces.join(' · ');
    }
    const deliveryQuote = deliveryQuoteFor(restaurant);
    const etaMin = deliveryQuote?.etaMin;
    const etaMax = deliveryQuote?.etaMax;
    if (etaMin != null && etaMin !== '') {
      const eta = etaMax != null && etaMax !== '' && Number(etaMax) !== Number(etaMin) ? `${etaMin}–${etaMax}` : `${etaMin}`;
      pieces.push(copy(`Delivery ${eta} min`, `ارسال ${eta} دقیقه`));
    } else {
      pieces.push(copy('Delivery time pending', 'زمان ارسال در انتظار تأیید'));
    }
    if (deliveryQuote?.deliveryFee != null && deliveryQuote.deliveryFee !== '') {
      pieces.push(Number(deliveryQuote.deliveryFee) === 0
        ? copy('Free delivery', 'ارسال رایگان')
        : `${copy('Delivery fee', 'هزینه ارسال')} ${browseAfn(deliveryQuote.deliveryFee)}`);
    } else {
      pieces.push(copy('Fee needs address confirmation', 'هزینه پس از تأیید آدرس مشخص می‌شود'));
    }
    const minimumOrder = Number(deliveryQuote?.minimumOrder);
    if (Number.isFinite(minimumOrder) && minimumOrder > 0) pieces.push(copy(`Minimum order ${browseAfn(minimumOrder)}`, `حداقل سفارش ${browseAfn(minimumOrder)}`));
    return pieces.join(' · ');
  }

  function currentFilterButtons() {
    return [...document.querySelectorAll('#restaurantFilterRail [data-filter]')];
  }

  function syncFilterState() {
    const buttons = currentFilterButtons();
    const active = buttons.filter(button => button.classList.contains('active')).length;
    const count = document.getElementById('aeFilterCount');
    if (count) {
      count.hidden = active === 0;
      count.textContent = String(active);
      count.setAttribute('aria-label', copy(`${active} filters selected`, `${faDigits(active)} فیلتر انتخاب شده`));
    }
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
    const chips = document.getElementById('aeActiveFilterChips');
    if (chips) {
      const labels = {
        open: ['Open now', 'اکنون باز'],
        favorites: ['Saved favourites', 'علاقه‌مندی‌ها'],
        verified: ['Verified information', 'معلومات تأییدشده']
      };
      chips.innerHTML = buttons.filter(button => button.classList.contains('active')).map(button => {
        const [en, fa] = labels[button.dataset.filter] || [button.textContent.trim(), button.textContent.trim()];
        return `<button type="button" data-remove-filter="${esc(button.dataset.filter)}"><span class="en-copy">${en} ×</span><span class="fa-copy">${fa} ×</span></button>`;
      }).join('');
      chips.querySelectorAll('[data-remove-filter]').forEach(chip => chip.addEventListener('click', () => {
        const target = buttons.find(button => button.dataset.filter === chip.dataset.removeFilter);
        if (target) window.toggleAdvancedFilter?.(target);
        syncFilterState();
      }));
    }
  }

  function updateFilterAvailability() {
    const rows = getRows().filter(row => typeof isCustomerVisibleRestaurant !== 'function' || isCustomerVisibleRestaurant(row));
    const openSupported = rows.length > 0 && rows.every(row => typeof row?.is_open === 'boolean');
    const openButton = document.querySelector('#restaurantFilterRail [data-filter="open"]');
    if (openButton) openButton.hidden = !openSupported;
    const verifiedSupported = rows.some(row => ['field_verified', 'owner_confirmed'].includes(row?.verification_status));
    const verifiedButton = document.querySelector('#restaurantFilterRail [data-filter="verified"]');
    if (verifiedButton) verifiedButton.hidden = !verifiedSupported;
  }

  function updateSortAvailability() {
    updateFilterAvailability();
    const rows = getRows().filter(row => typeof isCustomerVisibleRestaurant !== 'function' || isCustomerVisibleRestaurant(row));
    const sort = document.getElementById('sort');
    if (!sort) return;
    const hasRatings = rows.some(row => typeof trustedRating === 'function' && trustedRating(row));
    const pickupMode = typeof mode !== 'undefined' && mode === 'pickup';
    const hasQuotedEta = !pickupMode && rows.some(row => {
      const quote = deliveryQuoteFor(row);
      return quote?.etaMin != null && quote.etaMin !== '';
    });
    const hasQuotedFee = !pickupMode && rows.some(row => {
      const quote = deliveryQuoteFor(row);
      return quote?.deliveryFee != null && quote.deliveryFee !== '';
    });
    const hasMinimumOrder = !pickupMode && rows.some(row => {
      const value = deliveryQuoteFor(row)?.minimumOrder;
      return value != null && value !== '' && Number.isFinite(Number(value));
    });
    const updateOption = (value, labelEn, labelFa, available, hidden = false) => {
      const option = sort.querySelector(`option[value="${value}"]`);
      if (!option) return;
      option.hidden = hidden;
      option.disabled = hidden || !available;
      const en = available ? labelEn : `${labelEn} — Coming soon`;
      const fa = available ? labelFa : `${labelFa} — به‌زودی`;
      option.dataset.en = en;
      option.dataset.fa = fa;
      option.textContent = copy(en, fa);
    };
    updateOption('rating', 'Reviews', 'دیدگاه‌ها', hasRatings);
    updateOption('distance', 'Distance', 'فاصله', false);
    updateOption('fastest', 'Estimated delivery time', 'زمان تخمینی ارسال', hasQuotedEta, pickupMode);
    updateOption('min-order', 'Minimum order amount', 'حداقل مبلغ سفارش', hasMinimumOrder, pickupMode);
    updateOption('fee', 'Delivery costs', 'هزینه ارسال', hasQuotedFee, pickupMode);
    if (sort.selectedOptions[0]?.hidden || sort.selectedOptions[0]?.disabled) sort.value = 'recommended';
  }

  function sanitizeRestaurantCards() {
    const cards = document.querySelectorAll('#restaurantGrid .restaurant-card, .ae-featured-shelf-track .restaurant-card');
    const rows = getRows();
    cards.forEach(card => {
      const link = card.querySelector('.restaurant-card-link');
      const meta = card.querySelector('.browse-card-meta');
      if (!link || !meta) return;
      let routeId = '';
      try { routeId = new URL(link.href, location.origin).searchParams.get('id') || ''; } catch {}
      const restaurant = rows.find(row => [row?.id, row?.slug, row?.public_slug].some(value => String(value || '') === String(routeId)));
      if (!restaurant || (typeof isDirectoryListing === 'function' && isDirectoryListing(restaurant)) || (restaurant?.menu_preview_only && !['owner_confirmed', 'field_verified'].includes(restaurant?.verification_status))) return;
      meta.textContent = safeQuoteMeta(restaurant);
      meta.dir = 'auto';
    });
  }

  function cardAvailableForBrowsing(restaurant) {
    return (typeof isCustomerVisibleRestaurant !== 'function' || isCustomerVisibleRestaurant(restaurant)) &&
      (typeof modeEligible !== 'function' || modeEligible(restaurant)) &&
      !(typeof isDirectoryListing === 'function' && isDirectoryListing(restaurant)) &&
      !(restaurant?.menu_preview_only && !['owner_confirmed', 'field_verified'].includes(restaurant?.verification_status));
  }

  function renderFeaturedShelf(shelf, before) {
    if (!shelf || !before) return;
    const rows = getRows().filter(cardAvailableForBrowsing).filter(row => row?.status === 'active');
    if (rows.length < 3 || typeof window.restaurantCard !== 'function') {
      shelf.hidden = true;
      shelf.querySelector('.ae-featured-shelf-track')?.replaceChildren();
      return;
    }
    const ranked = typeof compareRecommended === 'function' ? [...rows].sort(compareRecommended) : rows;
    const selected = ranked.slice(0, 4);
    shelf.hidden = false;
    shelf.querySelector('.ae-featured-shelf-track').innerHTML = selected.map(restaurant => window.restaurantCard(restaurant)).join('');
    sanitizeRestaurantCards();
    if (shelf.parentElement !== before.parentElement) before.insertAdjacentElement('beforebegin', shelf);
  }

  function estimateRows(filters = []) {
    let rows = getRows().filter(row => typeof isCustomerVisibleRestaurant !== 'function' || isCustomerVisibleRestaurant(row));
    rows = rows.filter(row => typeof modeEligible !== 'function' || modeEligible(row));
    rows = rows.filter(row => (typeof isDirectoryListing === 'function' && isDirectoryListing(row)) || !row?._deliveryUnavailable);
    const query = String(document.getElementById('search')?.value || new URLSearchParams(location.search).get('q') || '').trim().toLowerCase();
    if (query) rows = rows.filter(row => {
      const items = (row?._items || []).map(item => `${item?.name || ''} ${item?.name_dari || ''} ${item?.description || ''} ${item?.description_dari || ''}`).join(' ');
      const haystack = `${row?.name || ''} ${row?.name_dari || ''} ${row?.address || ''} ${row?.address_dari || ''} ${row?.district || ''} ${row?.neighborhood || ''} ${(row?.cuisine_tags || []).join(' ')} ${items}`.toLowerCase();
      return haystack.includes(query);
    });
    const category = window.AE_DISH_CATEGORY || '';
    if (category) {
      const terms = window.AfghanEatsDishSearch?.categoryTerms?.[category] || [category];
      rows = rows.filter(row => {
        const items = (row?._items || []).map(item => `${item?.name || ''} ${item?.name_dari || ''} ${item?.description || ''} ${item?.description_dari || ''}`).join(' ');
        const haystack = `${row?.category_primary || ''} ${(row?.cuisine_tags || []).join(' ')} ${row?.name || ''} ${row?.name_dari || ''} ${items}`.toLowerCase();
        return terms.some(term => haystack.includes(String(term).toLowerCase()));
      });
    }
    for (const filter of filters) {
      if (filter === 'open') rows = rows.filter(row => !(typeof isDirectoryListing === 'function' && isDirectoryListing(row)) && (row?.is_open ?? row?.status === 'active'));
      if (filter === 'favorites') rows = rows.filter(row => typeof isFav === 'function' && isFav(row?.id));
      if (filter === 'verified') rows = rows.filter(row => ['field_verified', 'owner_confirmed'].includes(row?.verification_status));
    }
    return rows;
  }

  function buildMobileFilterDialog(rail, trigger) {
    const dialog = document.createElement('dialog');
    dialog.id = 'aeMobileFiltersDialog';
    dialog.className = 'ae-discovery-dialog ae-mobile-filters-dialog';
    dialog.setAttribute('aria-labelledby', 'aeMobileFiltersTitle');
    dialog.innerHTML = `<div class="ae-dialog-card"><div class="ae-dialog-title-row"><h2 id="aeMobileFiltersTitle"><span class="en-copy">Filter restaurants</span><span class="fa-copy">فیلتر رستورانت‌ها</span></h2><button class="ae-dialog-close" type="button" aria-label="Close" data-dialog-close>×</button></div><div class="ae-mobile-filter-mount"></div><div class="ae-mobile-filter-actions"><button type="button" class="btn btn-light" data-stage-reset><span class="en-copy">Reset</span><span class="fa-copy">پاک‌کردن</span></button><button type="button" class="btn btn-primary" id="aeMobileFilterApply"><span class="en-copy">Show restaurants</span><span class="fa-copy">نمایش رستورانت‌ها</span></button></div></div>`;
    document.body.append(dialog);
    const mount = dialog.querySelector('.ae-mobile-filter-mount');
    let stagedRail = null;
    const getStagedButtons = () => [...(stagedRail?.querySelectorAll('[data-stage-filter]') || [])];
    const stagedValues = () => getStagedButtons().filter(button => button.classList.contains('active')).map(button => button.dataset.stageFilter);
    const updatePreview = () => {
      const count = estimateRows(stagedValues()).length;
      const label = copy(`Show ${count} ${count === 1 ? 'restaurant' : 'restaurants'}`, `نمایش ${faDigits(count)} رستورانت`);
      const apply = dialog.querySelector('#aeMobileFilterApply');
      if (apply) {
        apply.innerHTML = `<span class="en-copy">${label}</span><span class="fa-copy">${label}</span>`;
        apply.setAttribute('aria-label', label);
      }
    };
    const open = () => {
      stagedRail = rail.cloneNode(true);
      stagedRail.removeAttribute('id');
      stagedRail.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      stagedRail.querySelectorAll('[data-filter]').forEach(button => {
        button.dataset.stageFilter = button.dataset.filter;
        button.removeAttribute('data-filter');
        button.removeAttribute('onclick');
        button.setAttribute('aria-pressed', String(button.classList.contains('active')));
        button.addEventListener('click', () => {
          button.classList.toggle('active');
          button.setAttribute('aria-pressed', String(button.classList.contains('active')));
          updatePreview();
        });
      });
      const clear = stagedRail.querySelector('.restaurant-clear-filters');
      clear?.addEventListener('click', () => {
        getStagedButtons().forEach(button => {
          button.classList.remove('active');
          button.setAttribute('aria-pressed', 'false');
        });
        updatePreview();
      });
      mount.replaceChildren(stagedRail);
      updatePreview();
      if (!dialog.open) dialog.showModal();
      trigger.setAttribute('aria-expanded', 'true');
    };
    trigger.addEventListener('click', open);
    dialog.querySelector('[data-stage-reset]').addEventListener('click', () => {
      getStagedButtons().forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      });
      updatePreview();
    });
    dialog.querySelector('#aeMobileFilterApply').addEventListener('click', () => {
      const selected = new Set(stagedValues());
      rail.querySelectorAll('[data-filter]').forEach(button => {
        const active = selected.has(button.dataset.filter);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      window.advancedRestaurantSearch?.();
      syncFilterState();
      dialog.close();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
    });
    dialog.addEventListener('close', () => {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
      mount.replaceChildren();
      stagedRail = null;
    });
  }

  function saveRecentSearch(input) {
    const value = String(input?.value || '').trim();
    if (value.length < 2) return;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('ae_restaurant_recent_searches') || '[]'); } catch {}
    recent = [value, ...recent.filter(item => String(item).toLowerCase() !== value.toLowerCase())].slice(0, 5);
    localStorage.setItem('ae_restaurant_recent_searches', JSON.stringify(recent));
    const list = document.getElementById('aeRestaurantRecentSearches');
    if (list) list.innerHTML = recent.map(item => `<option value="${esc(item)}"></option>`).join('');
  }

  function setupSearch(input) {
    if (!input) return;
    input.setAttribute('aria-label', copy('Search restaurants, items, and categories', 'جستجوی رستورانت‌ها، غذاها و دسته‌بندی‌ها'));
    input.setAttribute('dir', 'auto');
    input.dataset.ariaEn = 'Search restaurants, items, and categories';
    input.dataset.ariaFa = 'جستجوی رستورانت‌ها، غذاها و دسته‌بندی‌ها';
    input.dataset.phEn = 'Search restaurants, items, and categories';
    input.dataset.phFa = 'رستورانت‌ها، غذاها و دسته‌بندی‌ها';
    input.placeholder = copy(input.dataset.phEn, input.dataset.phFa);
    input.setAttribute('list', 'aeRestaurantRecentSearches');
    const datalist = document.createElement('datalist');
    datalist.id = 'aeRestaurantRecentSearches';
    try {
      const recent = JSON.parse(localStorage.getItem('ae_restaurant_recent_searches') || '[]');
      datalist.innerHTML = (Array.isArray(recent) ? recent : []).slice(0, 5).map(item => `<option value="${esc(item)}"></option>`).join('');
    } catch {}
    input.closest('.restaurant-search-wrap')?.append(datalist);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') saveRecentSearch(input); });
  }

  function normalizeAddressSummary() {
    const summary = document.getElementById('addressSummary');
    if (!summary) return;
    const address = String(localStorage.getItem('ae_address') || '').trim();
    const pickup = document.querySelector('.restaurant-service-row .mode-tabs button.active')?.dataset.mode === 'pickup';
    const label = summary.querySelector('span');
    summary.classList.toggle('ae-no-confirmed-address', !address && !pickup);
    summary.dir = 'auto';
    if (pickup) {
      if (label) label.textContent = copy('Pickup selected; preparation time appears only when confirmed.', 'دریافت حضوری انتخاب شده؛ زمان آماده‌سازی تنها پس از تأیید نمایش داده می‌شود.');
    } else if (address) {
      if (label) label.textContent = copy(`Address entered: ${address}. Restaurant delivery details appear only when a current quote is returned.`, `آدرس واردشده: ${address}. جزئیات ارسال رستورانت تنها با دریافت نرخ تازه نمایش داده می‌شود.`);
    } else {
      summary.replaceChildren();
    }
  }

  function installAddressSummary() {
    const original = window.renderAddressContext;
    if (typeof original === 'function' && !window.__aeBrowseAddressSummaryWrapped) {
      window.__aeBrowseAddressSummaryWrapped = true;
      window.renderAddressContext = function (...args) {
        const result = original.apply(this, args);
        normalizeAddressSummary();
        return result;
      };
    }
    normalizeAddressSummary();
  }

  function makeEmptyState(grid) {
    if (!grid || grid.getAttribute('aria-busy') === 'true' || grid.querySelector('.restaurant-card, .delivery-empty')) return;
    if (grid.querySelector('.ae-empty-state')) return;
    const hasRows = getRows().length > 0;
    const hasSearch = Boolean(String(document.getElementById('search')?.value || '').trim());
    const hasFilters = currentFilterButtons().some(button => button.classList.contains('active')) ||
      Boolean(window.AE_DISH_CATEGORY || new URLSearchParams(location.search).get('c'));
    const title = hasRows
      ? copy('No matching restaurants', 'رستورانتی پیدا نشد')
      : copy('Restaurant list unavailable', 'فهرست رستورانت‌ها در دسترس نیست');
    const body = hasRows
      ? copy('Try another dish, cuisine or restaurant.', 'نام غذا، دسته یا رستورانت دیگری را جستجو کنید.')
      : copy('Try loading the list again.', 'فهرست را دوباره بارگیری کنید.');
    grid.innerHTML = `<div class="ae-empty-state" role="status"><h3>${esc(title)}</h3><p>${esc(body)}</p>${hasRows && (hasSearch || hasFilters) ? `<button type="button" data-empty-clear>${esc(copy('Clear search and filters', 'پاک‌کردن جستجو و فیلترها'))}</button> <a href="/restaurants" data-browse-all>${esc(copy('Browse all restaurants', 'دیدن تمام رستورانت‌ها'))}</a>` : `<button type="button" data-empty-retry>${esc(copy('Try again', 'تلاش دوباره'))}</button>`}</div>`;
    grid.querySelector('[data-empty-clear]')?.addEventListener('click', () => window.clearAdvancedFilters?.());
    grid.querySelector('[data-browse-all]')?.addEventListener('click', () => localStorage.removeItem('ae_browse_area'));
    grid.querySelector('[data-empty-retry]')?.addEventListener('click', async () => {
      const refresh = appFunction('refreshLiveRestaurants') || appFunction('loadData');
      if (refresh) await refresh();
      window.advancedRestaurantSearch?.();
    });
  }

  function syncFilterStateFromCount() {
    syncFilterState();
    const grid = document.getElementById('restaurantGrid');
    makeEmptyState(grid);
  }

  function saveListingStateForMenu() {
    if (!document.body.classList.contains('restaurants-page')) return;
    const state = {
      savedAt: Date.now(),
      search: document.getElementById('search')?.value || '',
      sort: document.getElementById('sort')?.value || 'recommended',
      mode: localStorage.getItem('ae_mode') || 'delivery',
      category: window.AE_DISH_CATEGORY || '',
      filters: currentFilterButtons().filter(button => button.classList.contains('active')).map(button => button.dataset.filter),
      view: document.querySelector('[data-restaurant-view].active')?.dataset.restaurantView || 'list',
      scrollY: window.scrollY
    };
    sessionStorage.setItem('ae_restaurant_discovery_return', JSON.stringify(state));
  }

  function restoreListingStateFromMenu(allowBackForward = false) {
    let referrer;
    let state;
    try {
      referrer = document.referrer ? new URL(document.referrer) : null;
      state = JSON.parse(sessionStorage.getItem('ae_restaurant_discovery_return') || 'null');
    } catch { state = null; }
    const fromMenu = referrer?.origin === location.origin && /^\/restaurant(?:\.html)?$/.test(referrer.pathname);
    if ((!fromMenu && !allowBackForward) || !state || Date.now() - Number(state.savedAt || 0) > 30 * 60 * 1000) return;
    sessionStorage.removeItem('ae_restaurant_discovery_return');
    const input = document.getElementById('search');
    const sort = document.getElementById('sort');
    if (input) input.value = state.search || '';
    const savedSort = sort?.querySelector(`option[value="${CSS.escape(state.sort || 'recommended')}"]`);
    if (savedSort && !savedSort.hidden && !savedSort.disabled) sort.value = state.sort || 'recommended';
    const filters = new Set(Array.isArray(state.filters) ? state.filters : []);
    currentFilterButtons().forEach(button => {
      button.classList.toggle('active', filters.has(button.dataset.filter));
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });
    window.AE_DISH_CATEGORY = state.category || '';
    document.querySelectorAll('[data-dish-category]').forEach(button => {
      const selected = (button.dataset.dishCategory || '') === window.AE_DISH_CATEGORY;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (typeof window.setMode === 'function' && state.mode) window.setMode(state.mode, { silent: true });
    window.advancedRestaurantSearch?.();
    window.AfghanEatsDishSearch?.runSearch?.();
    syncFilterState();
    if (state.view === 'map') document.querySelector('[data-restaurant-view="map"]')?.click();
    window.setTimeout(() => window.scrollTo({ top: Math.max(0, Number(state.scrollY) || 0), behavior: 'auto' }), 450);
  }

  function buildDiscoveryLayout() {
    const container = document.querySelector('main.section.soft > .container');
    const bar = container?.querySelector('.restaurant-discovery-bar');
    const service = bar?.querySelector('.restaurant-service-row');
    const oldRow = bar?.querySelector('.restaurant-filter-row');
    if (!container || !bar || !service || !oldRow || container.querySelector('.restaurant-layout-review')) return;

    const searchWrap = oldRow.querySelector('.restaurant-search-wrap');
    const search = searchWrap?.querySelector('#search');
    const sort = oldRow.querySelector('#sort');
    const open = oldRow.querySelector('[data-filter="open"]');
    const favorites = oldRow.querySelector('[data-filter="favorites"]');
    const viewToggle = service.querySelector('.restaurant-view-toggle');
    if (!searchWrap || !search || !sort) return;

    patchListingCardRendering();
    setupSearch(search);
    installAddressSummary();

    const layout = document.createElement('div');
    layout.className = 'restaurant-layout-review';
    const content = document.createElement('div');
    content.className = 'restaurant-discovery-content';
    const rail = document.createElement('aside');
    rail.id = 'restaurantFilterRail';
    rail.className = 'restaurant-filter-rail';
    rail.setAttribute('aria-label', copy('Restaurant filters', 'فیلتر رستورانت‌ها'));
    rail.innerHTML = `<div class="restaurant-filter-heading"><h2><span class="en-copy">Filters</span><span class="fa-copy">فیلترها</span></h2><button type="button" class="restaurant-clear-filters"><span class="en-copy">Clear all</span><span class="fa-copy">پاک‌کردن همه</span></button></div><div class="restaurant-filter-options"></div><p class="restaurant-filter-note"><span class="en-copy">Only filters backed by reliable data are shown.</span><span class="fa-copy">تنها فیلترهای پشتیبانی‌شده با معلومات معتبر نمایش داده شده‌اند.</span></p>`;
    const options = rail.querySelector('.restaurant-filter-options');
    const normaliseFilter = (button, key, en, fa) => {
      if (!button) return null;
      button.type = 'button';
      button.removeAttribute('onclick');
      button.removeAttribute('data-i18n');
      button.className = 'chip restaurant-filter-chip';
      button.dataset.filter = key;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<span class="en-copy">${en}</span><span class="fa-copy">${fa}</span>`;
      button.addEventListener('click', () => window.toggleAdvancedFilter?.(button));
      return button;
    };
    const openButton = normaliseFilter(open, 'open', 'Open now', 'اکنون باز');
    const favoriteButton = normaliseFilter(favorites, 'favorites', 'Saved favourites', 'علاقه‌مندی‌ها');
    if (openButton) options.append(openButton);
    if (favoriteButton) options.append(favoriteButton);
    const verified = createFilterButton('verified', 'Verified information', 'معلومات تأییدشده');
    verified.dataset.filterOptional = 'verified';
    options.append(verified);

    rail.querySelector('.restaurant-clear-filters').addEventListener('click', () => {
      window.clearAdvancedFilters?.();
      syncFilterState();
    });

    const toolbar = document.createElement('div');
    toolbar.className = 'restaurant-toolbar';
    const sortLabel = document.createElement('label');
    sortLabel.className = 'restaurant-sort-label';
    sortLabel.htmlFor = 'sort';
    sortLabel.innerHTML = `<span class="en-copy">Sort by</span><span class="fa-copy">مرتب‌سازی</span>`;
    sortLabel.append(sort);
    const filterTrigger = document.createElement('button');
    filterTrigger.type = 'button';
    filterTrigger.id = 'aeMobileFilterOpen';
    filterTrigger.className = 'restaurant-mobile-filter-trigger';
    filterTrigger.setAttribute('aria-haspopup', 'dialog');
    filterTrigger.setAttribute('aria-controls', 'aeMobileFiltersDialog');
    filterTrigger.setAttribute('aria-expanded', 'false');
    filterTrigger.innerHTML = `<span aria-hidden="true">☷</span><span class="en-copy">Filters</span><span class="fa-copy">فیلترها</span><span class="ae-filter-count" id="aeFilterCount" hidden></span>`;
    toolbar.append(searchWrap, sortLabel, filterTrigger);
    if (viewToggle) toolbar.append(viewToggle);

    const noteAnchor = container.querySelector('.section-head.restaurant-page-head');
    addBrowseNote(noteAnchor);
    const categoryRow = container.querySelector('.dish-category-row');
    makeCuisineTiles(categoryRow);
    const mapView = container.querySelector('#restaurantDiscoveryMapView');
    const dishResults = container.querySelector('#dishResults');
    const summary = container.querySelector('.restaurant-result-summary');
    const grid = container.querySelector('#restaurantGrid');
    const oldHeading = container.querySelector('.restaurant-page-head');
    const discoveryLink = container.querySelector('.discovery-link');
    const resultsHeading = document.createElement('div');
    resultsHeading.className = 'restaurant-results-heading';
    resultsHeading.innerHTML = `<div><h2><span class="en-copy">Restaurants in Herat</span><span class="fa-copy">رستورانت‌های هرات</span></h2><p><span class="en-copy">Browse public menus. Delivery availability, fees and timing appear only when an address-specific quote is returned.</span><span class="fa-copy">منوهای عمومی را ببینید؛ دسترسی ارسال، هزینه و زمان تنها هنگام دریافت نرخ مخصوص همان آدرس نمایش داده می‌شود.</span></p></div>`;

    const feeContext = document.createElement('p');
    feeContext.className = 'ae-fee-context';
    feeContext.innerHTML = `<span aria-hidden="true">i</span><span><span class="en-copy">Delivery timing and fees appear only after an address quote.</span><span class="fa-copy">زمان و هزینهٔ ارسال تنها پس از تأیید آدرس نمایش داده می‌شود.</span></span>`;
    const activeChips = document.createElement('div');
    activeChips.id = 'aeActiveFilterChips';
    activeChips.className = 'ae-active-filter-chips';
    activeChips.setAttribute('aria-label', copy('Active filters', 'فیلترهای فعال'));
    const shelf = document.createElement('section');
    shelf.className = 'ae-featured-shelf';
    shelf.hidden = true;
    shelf.setAttribute('aria-labelledby', 'aeFeaturedShelfTitle');
    shelf.innerHTML = `<div class="ae-featured-shelf-head"><h2 id="aeFeaturedShelfTitle"><span class="en-copy">Menus from local partners</span><span class="fa-copy">منوهای همکاران محلی</span></h2><a href="#restaurantGrid"><span class="en-copy">See all restaurants</span><span class="fa-copy">دیدن همۀ رستورانت‌ها</span></a></div><div class="ae-featured-shelf-track"></div>`;

    content.append(service, toolbar, activeChips);
    if (categoryRow) content.append(categoryRow);
    content.append(feeContext, shelf);
    if (mapView) content.append(mapView);
    if (dishResults) content.append(dishResults);
    content.append(resultsHeading);
    if (grid) content.append(grid);
    layout.append(rail, content);

    if (summary) {
      summary.classList.add('restaurant-top-count');
      summary.setAttribute('role', 'status');
      summary.setAttribute('aria-live', 'polite');
      summary.setAttribute('aria-atomic', 'true');
      if (discoveryLink) discoveryLink.insertAdjacentElement('afterend', summary);
      else (oldHeading || container.firstElementChild)?.insertAdjacentElement('afterend', summary);
    }
    if (summary?.parentElement === container) summary.insertAdjacentElement('afterend', layout);
    else (discoveryLink || oldHeading)?.insertAdjacentElement('afterend', layout);
    bar.remove();

    buildMobileFilterDialog(rail, filterTrigger);

    const footer = document.createElement('footer');
    footer.className = 'ae-listing-footer';
    footer.innerHTML = `<a href="mailto:support@afghaneats.net">support@afghaneats.net</a><a href="/partner"><span class="en-copy">For restaurants</span><span class="fa-copy">برای رستورانت‌ها</span></a><a href="/organizations/"><span class="en-copy">For organizations</span><span class="fa-copy">برای سازمان‌ها</span></a><a href="/rider-portal"><span class="en-copy">Rider portal</span><span class="fa-copy">درگاه پیک</span></a><a href="/careers"><span class="en-copy">Careers</span><span class="fa-copy">فرصت‌های کاری</span></a><a href="/help"><span class="en-copy">Help</span><span class="fa-copy">راهنما</span></a><a href="/terms"><span class="en-copy">Terms</span><span class="fa-copy">شرایط</span></a><a href="/privacy"><span class="en-copy">Privacy</span><span class="fa-copy">حریم خصوصی</span></a><span class="ae-listing-copyright">© ${new Date().getFullYear()} Afghan Eats</span>`;
    if (grid) grid.insertAdjacentElement('afterend', footer);

    const backTop = document.createElement('button');
    backTop.type = 'button';
    backTop.className = 'ae-back-to-top';
    backTop.setAttribute('aria-label', copy('Back to top', 'بازگشت به بالا'));
    backTop.innerHTML = '↑';
    backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.append(backTop);
    const updateBackTop = () => backTop.classList.toggle('is-visible', window.scrollY > 500);
    window.addEventListener('scroll', updateBackTop, { passive: true });
    updateBackTop();

    const gridObserver = grid && new MutationObserver(() => requestAnimationFrame(() => {
      sanitizeRestaurantCards();
      updateSortAvailability();
      renderFeaturedShelf(shelf, resultsHeading);
      syncFilterStateFromCount();
    }));
    gridObserver?.observe(grid, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href*="/restaurant.html?id="]');
      if (link && link.origin === location.origin) saveListingStateForMenu();
    }, true);
    window.addEventListener('ae:restaurantsrefreshed', () => {
      normalizeAddressSummary();
      updateSortAvailability();
      sanitizeRestaurantCards();
      renderFeaturedShelf(shelf, resultsHeading);
      syncFilterStateFromCount();
    });
    window.addEventListener('ae:modechange', () => {
      normalizeAddressSummary();
      updateSortAvailability();
      sanitizeRestaurantCards();
      syncFilterState();
    });
    window.addEventListener('pageshow', () => {
      if (sessionStorage.getItem('ae_restaurant_discovery_return')) restoreListingStateFromMenu(true);
    });
    const originalClear = window.clearAdvancedFilters;
    if (typeof originalClear === 'function' && !window.__aeListingClearWrapped) {
      window.__aeListingClearWrapped = true;
      window.clearAdvancedFilters = function (...args) {
        const result = originalClear.apply(this, args);
        syncFilterState();
        return result;
      };
    }
    updateSortAvailability();
    setTimeout(() => {
      updateSortAvailability();
      sanitizeRestaurantCards();
      renderFeaturedShelf(shelf, resultsHeading);
      syncFilterStateFromCount();
      restoreListingStateFromMenu();
    }, 700);
    setTimeout(updateSortAvailability, 1800);
  }

  function boot() {
    if (!document.body.classList.contains('restaurants-page')) return;
    patchListingCardRendering();
    buildDiscoveryLayout();
    addBrowseAreaDialog(document.getElementById('aeBrowseAreaTrigger'));
    document.querySelectorAll('[data-favorite-id]').forEach(button => {
      if (!button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(button.classList.contains('on')));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

