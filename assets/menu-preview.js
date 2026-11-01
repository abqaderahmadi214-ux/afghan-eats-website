(() => {
  const approvedPreviewIds = new Set([
    '5df516b2-52d2-4c81-b90e-d7e55a034344', // Arghawan Restaurant
    'char-fasl-food-complex', // Char Fasl Food Complex
    '5062b505-812d-48be-8079-712fd67a5361', // Hazar Dastan Café
    '4539c17d-8118-4e62-a112-05d57e2ec330', // Isteqlal Restaurant
    'e388bc40-04b3-4da7-8d20-35559f65d923', // Mahtab Restaurant
    'maza-biryani-herat', // Maza Biryani
    'mr-burger-herat', // Mr Burger Herat
    'd3008f38-f9a4-4b1c-b8d5-e39be529fb5f', // Sar Ashpaz
    'dee417e2-7c95-4b4a-8683-0034cec2dccc', // Shabha-ye Tehran Restaurant
    '683181f3-eac8-4b8e-b609-6007e10a69e7', // Duniya Kabab
    'a0af9735-5ea0-4dde-aa44-0c5fbb208c2b', // Navid Restaurant
    '9b3eed54-f239-4d6c-9cc9-9bf10bee3413', // Padehda Restaurant
    'f0c6fbb1-7e3c-4989-b745-feefa717cc2b', // Uranus Restaurant
  ]);
  const approvedPreviewNames = new Set([
    'arghawan restaurant',
    'char fasl food complex',
    'hazar dastan café',
    'hazar dastan cafe',
    'isteqlal restaurant',
    'mahtab restaurant',
    'maza biryani',
    'mr burger herat',
    'sar ashpaz',
    'shabha-ye tehran restaurant',
    'duniya kabab',
    'navid restaurant',
    'padehda restaurant',
    'uranus restaurant',
  ]);
  let browsePreviewRows = [];
  let liveRestaurantRows = [];

  function previewCounts(rows) {
    return new Map((Array.isArray(rows) ? rows : [])
      .filter((row) => Number(row?.menu_item_count) > 0)
      .map((row) => [String(row.id || ''), Number(row.menu_item_count)]));
  }

  function isHiddenListing(restaurant) {
    const rejected = [restaurant?.application_status, restaurant?.partner_application_status]
      .some((status) => String(status || '').trim().toLowerCase() === 'rejected');
    const archived = String(restaurant?.status || '').trim().toLowerCase() === 'archived'
      || Boolean(restaurant?.archived_at || restaurant?.is_archived === true || restaurant?.archived === true);
    return rejected || archived;
  }

  function hasPublicMenuItems(restaurant) {
    const items = Array.isArray(restaurant?._items)
      ? restaurant._items.filter((item) => !item?.archived_at && item?.is_archived !== true && String(item?.status || '').toLowerCase() !== 'archived')
      : [];
    return Number(restaurant?.public_menu_item_count ?? restaurant?.menu_preview_item_count ?? restaurant?.menu_item_count ?? 0) > 0
      || items.length > 0;
  }

  function applyBrowsePreviewRows(rows, previewRows) {
    const counts = previewCounts(previewRows);
    return (Array.isArray(rows) ? rows : [])
      .filter((restaurant) => {
        const id = String(restaurant?.id || '');
        const name = String(restaurant?.name || '').trim().toLowerCase();
        const isApprovedCandidate = approvedPreviewIds.has(id) || approvedPreviewNames.has(name);
        return !isApprovedCandidate || counts.has(id);
      })
      .map((restaurant) => {
        const id = String(restaurant?.id || '');
        const itemCount = counts.get(id);
        return itemCount
          ? { ...restaurant, menu_preview_only: true, _browse_menu_preview: true, menu_preview_item_count: itemCount, _deliveryUnavailable: false }
          : restaurant;
      });
  }

  async function fetchBrowsePreviewRows() {
    try {
      const rows = await trpcQuery('restaurants.listBrowsePreviews', {});
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      if (error?.name === 'TimeoutError') restaurantDataTimeoutError = restaurantDataTimeoutError || error;
      console.warn('[Afghan Eats] Browse-only menu previews unavailable.', error?.message || error);
      return [];
    }
  }

  function rebuildRestaurantRows(fallback = restaurantFallbackEntries) {
    const base = liveRestaurantRows.length
      ? mergeLiveRestaurants(liveRestaurantRows, fallback)
      : fallbackRestaurants(fallback);
    const liveIds = new Set(liveRestaurantRows.map((restaurant) => String(restaurant?.id || '')));
    restaurants = applyBrowsePreviewRows(base, browsePreviewRows)
      .filter((restaurant) => {
        if (isHiddenListing(restaurant)) return false;
        const itemCount = restaurant?.public_menu_item_count ?? restaurant?.menu_preview_item_count ?? restaurant?.menu_item_count;
        if (itemCount != null && Number(itemCount) <= 0) return false;
        if (isDirectoryListing(restaurant)) return hasPublicMenuItems(restaurant);
        return liveIds.has(String(restaurant?.id || '')) || hasPublicMenuItems(restaurant);
      });
    return restaurants;
  }

  loadData = async function loadDataWithBrowsePreviews() {
    if (restaurantDataPromise) return restaurantDataPromise;
    restaurantDataTimeoutError = null;
    restaurantDataPromise = (async () => {
      const loaded = await Promise.all([loadRestaurantSeeds(), loadRestaurantResearch()]);
      restaurantFallbackEntries = loaded[0];
      const livePromise = trpcQuery('restaurants.list', {}).catch((error) => {
        console.warn('Live restaurant API unavailable', error);
        return [];
      });
      const previewsPromise = fetchBrowsePreviewRows();
      const [live, previews] = await Promise.all([
        Promise.race([livePromise, new Promise((resolve) => setTimeout(() => resolve([]), 1800))]),
        Promise.race([previewsPromise, new Promise((resolve) => setTimeout(() => resolve([]), 1800))]),
      ]);
      liveRestaurantRows = Array.isArray(live) ? live : [];
      browsePreviewRows = Array.isArray(previews) ? previews : [];
      rebuildRestaurantRows(restaurantFallbackEntries);

      if (!liveRestaurantRows.length) {
        livePromise.then((rows) => {
          if (!Array.isArray(rows) || !rows.length) return;
          liveRestaurantRows = rows;
          rebuildRestaurantRows(restaurantFallbackEntries);
          deliveryContextPromise = null;
          renderRestaurantSurfaces();
          hydrateDeliveryContext().then(renderRestaurantSurfaces);
        });
      }
      if (!browsePreviewRows.length) {
        previewsPromise.then((rows) => {
          if (!Array.isArray(rows) || !rows.length) return;
          browsePreviewRows = rows;
          rebuildRestaurantRows(restaurantFallbackEntries);
          deliveryContextPromise = null;
          renderRestaurantSurfaces();
          hydrateDeliveryContext().then(renderRestaurantSurfaces);
        });
      }
      return restaurants;
    })();
    return restaurantDataPromise;
  };

  refreshLiveRestaurants = async function refreshLiveRestaurantsWithBrowsePreviews(fallback = restaurantFallbackEntries) {
    if (restaurantRefreshPromise) return restaurantRefreshPromise;
    restaurantRefreshPromise = Promise.all([
      trpcQuery('restaurants.list', {}),
      fetchBrowsePreviewRows(),
    ]).then(async ([live, previews]) => {
      if (Array.isArray(live) && live.length) {
        liveRestaurantRows = live;
        browsePreviewRows = Array.isArray(previews) ? previews : [];
        restaurantFallbackEntries = fallback;
        rebuildRestaurantRows(fallback);
        deliveryContextPromise = null;
        renderRestaurantSurfaces();
        await hydrateDeliveryContext();
        renderRestaurantSurfaces();
        window.dispatchEvent(new CustomEvent('ae:restaurantsrefreshed', { detail: { count: restaurants.length } }));
      }
      return restaurants;
    }).catch((error) => {
      console.warn('Live restaurant API unavailable', error);
      return restaurants;
    }).finally(() => {
      restaurantRefreshPromise = null;
    });
    return restaurantRefreshPromise;
  };

  const originalModeEligible = modeEligible;
  modeEligible = function modeEligibleWithBrowsePreviews(restaurant) {
    return !isHiddenListing(restaurant) && (Boolean(restaurant?._browse_menu_preview) || originalModeEligible(restaurant));
  };

  const originalListFilters = listFilters;
  listFilters = function listFiltersWithBrowsePreviews() {
    const previewRows = restaurants.filter((restaurant) => restaurant?._browse_menu_preview);
    const previousDeliveryFlags = previewRows.map((restaurant) => ({
      restaurant,
      hadFlag: Object.prototype.hasOwnProperty.call(restaurant, '_deliveryUnavailable'),
      value: restaurant._deliveryUnavailable,
    }));
    previewRows.forEach((restaurant) => { delete restaurant._deliveryUnavailable; });
    try {
      return originalListFilters().filter((restaurant) => !isHiddenListing(restaurant) && (!isDirectoryListing(restaurant) || hasPublicMenuItems(restaurant)));
    } finally {
      previousDeliveryFlags.forEach(({ restaurant, hadFlag, value }) => {
        if (hadFlag) restaurant._deliveryUnavailable = value;
        else delete restaurant._deliveryUnavailable;
      });
    }
  };

  const originalRenderDeliveryEmpty = renderDeliveryEmpty;
  renderDeliveryEmpty = function renderDeliveryEmptyWithBrowsePreviews(grid, directory = []) {
    const visibleDirectory = directory.filter((restaurant) => !isHiddenListing(restaurant) && hasPublicMenuItems(restaurant));
    const existing = new Set(visibleDirectory.map((restaurant) => String(restaurant?.id || '')));
    const previews = restaurants.filter((restaurant) => restaurant?._browse_menu_preview && !existing.has(String(restaurant.id || '')));
    return originalRenderDeliveryEmpty(grid, [...visibleDirectory, ...previews]);
  };

  const originalRestaurantCard = restaurantCard;
  restaurantCard = function restaurantCardWithBrowseOnlyLabel(restaurant) {
    if (isHiddenListing(restaurant) || (isDirectoryListing(restaurant) && !hasPublicMenuItems(restaurant))) return '';
    if (!restaurant?._browse_menu_preview) return originalRestaurantCard(restaurant);
    const safeDisplayRow = { ...restaurant, verification_status: 'public_seeded', partnership_status: 'prospect' };
    const markup = originalRestaurantCard(safeDisplayRow);
    const badge = lang === 'fa' ? 'پیش‌نمایش منو · فقط مرور' : 'Menu preview · browse only';
    const note = lang === 'fa'
      ? 'فقط مرور؛ تحویل و سفارش آنلاین فعال نیست'
      : 'Browse only; delivery and online ordering are unavailable';
    return markup
      .replace(/>(?:Preview|پیش‌نمایش)<\/span>/, `>${esc(badge)}</span>`)
      .replace(/>(?:Menu preview|پیش‌نمایش منو)<\/div>/, `>${esc(note)}</div>`);
  };

  const originalGetMenu = getMenu;
  getMenu = async function getMenuWithBrowsePreview(restaurant) {
    if (!restaurant?._browse_menu_preview) return originalGetMenu(restaurant);
    try {
      const menu = await trpcQuery('restaurants.getBrowseMenu', { restaurantId: restaurant.id });
      return Array.isArray(menu?.items) && menu.items.length ? menu : { categories: [], items: [] };
    } catch (error) {
      if (error?.name === 'TimeoutError') throw error;
      console.warn('[Afghan Eats] Browse-only menu could not be loaded.', restaurant?.id, error?.message || error);
      return { categories: [], items: [] };
    }
  };

  const originalPublicMenuItemMarkup = publicMenuItemMarkup;
  publicMenuItemMarkup = function publicMenuItemMarkupWithAvailability(item) {
    const markup = originalPublicMenuItemMarkup(item);
    if (item?.is_available !== false) return markup;
    const unavailable = lang === 'fa' ? 'فعلاً ناموجود' : 'Temporarily unavailable';
    return markup
      .replace('class="menu-item public-menu-item premium-menu-card"', 'class="menu-item public-menu-item premium-menu-card menu-item-unavailable"')
      .replace('</div></article>', `<span class="ae-soldout">${esc(unavailable)}</span></div></article>`);
  };

  const originalInitRestaurantPage = initRestaurantPage;
  initRestaurantPage = async function initRestaurantPageWithBrowseNotice(...args) {
    await loadData();
    const unfilteredRows = restaurants;
    const liveIds = new Set(liveRestaurantRows.map((restaurant) => String(restaurant?.id || '')));
    restaurants = restaurants.filter((restaurant) => !isHiddenListing(restaurant)
      && (liveIds.has(String(restaurant?.id || '')) || hasPublicMenuItems(restaurant)));
    try {
      const result = await originalInitRestaurantPage(...args);
      if (window.currentRestaurant?._browse_menu_preview) {
        const detail = document.querySelector('#menuContent .directory-detail');
        if (detail && !detail.querySelector('.menu-preview-browse-only')) {
          const notice = document.createElement('div');
          notice.className = 'menu-preview-browse-only';
          notice.setAttribute('role', 'status');
          notice.textContent = lang === 'fa'
            ? 'پیش‌نمایش منو · فقط برای مرور. تحویل و ثبت سفارش آنلاین در دسترس نیست.'
            : 'Menu preview · browse only. Delivery and online ordering are unavailable.';
          detail.prepend(notice);
        }
      }
      return result;
    } finally {
      restaurants = unfilteredRows;
    }
  };

})();
