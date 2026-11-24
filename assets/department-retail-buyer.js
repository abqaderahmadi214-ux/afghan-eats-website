(() => {
  'use strict';
  const API = `${window.AFGHAN_EATS_CONFIG?.apiBaseUrl || 'https://afghaneats-api.onrender.com'}/api/trpc/`;
  const DEPARTMENTS = {
    groceries: ['Groceries', 'مواد خوراکی'],
    'health-beauty': ['Health & Beauty', 'صحت و زیبایی'],
    convenience: ['Convenience', 'ضروریات روزانه'],
    gifts: ['Gifts', 'هدایا'],
    electronics: ['Electronics', 'لوازم الکترونیکی'],
    'pet-supplies': ['Pet Supplies', 'لوازم حیوانات خانگی'],
  };
  const params = new URLSearchParams(location.search);
  const departmentKey = params.get('departmentKey') || '';
  const cityKey = params.get('cityKey') || 'herat';
  const merchantId = params.get('merchantId') || '';
  const state = { directory: null, storefront: null, cart: null, quote: null, quoteInputKey: null, quoteRequestId: 0, quoting: false };
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const fa = () => document.documentElement.lang === 'fa' || localStorage.getItem('ae_lang') === 'fa';
  const bi = (en, dari) => `<span class="en-copy">${esc(en)}</span><span class="fa-copy">${esc(dari)}</span>`;
  const label = key => DEPARTMENTS[key] || [key || 'Retail departments', 'بخش‌های فروشگاه'];
  const money = value => `؋ ${esc(value)}`;
  const cartKey = id => `ae_retail_cart_v1:${id}`;
  const readCart = id => {
    try { const cart = JSON.parse(localStorage.getItem(cartKey(id)) || 'null'); return cart && Array.isArray(cart.items) ? cart : { merchantId:id, departmentKey, items:[] }; }
    catch { return { merchantId:id, departmentKey, items:[] }; }
  };
  const saveCart = cart => localStorage.setItem(cartKey(cart.merchantId), JSON.stringify(cart));
  const countCart = cart => (cart?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const updateCartLinks = cart => {
    document.querySelectorAll('[data-retail-checkout-link]').forEach(link => {
      link.href = `/retail-checkout.html?departmentKey=${encodeURIComponent(cart?.departmentKey || departmentKey)}&cityKey=${encodeURIComponent(cityKey)}&merchantId=${encodeURIComponent(cart?.merchantId || merchantId)}`;
      const count = link.querySelector('[data-retail-cart-count]'); if (count) count.textContent = countCart(cart);
    });
  };
  async function query(path, input) {
    const url = `${API}${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    const response = await fetch(url, { headers: { Accept:'application/json' } });
    const payload = await response.json();
    if (!response.ok || payload?.error) throw new Error(payload?.error?.json?.message || payload?.error?.message || `Request failed (${response.status})`);
    return payload?.result?.data?.json;
  }
  async function mutate(path, input) {
    const response = await fetch(`${API}${path}`, { method:'POST', headers:{ 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({ json:input }) });
    const payload = await response.json();
    if (!response.ok || payload?.error) throw new Error(payload?.error?.json?.message || payload?.error?.message || `Request failed (${response.status})`);
    return payload?.result?.data?.json;
  }
  function notice(target, en, dari, kind='info') {
    target.className = `dr-notice ${kind}`;
    target.innerHTML = bi(en, dari);
    target.hidden = false;
  }
  function imageFor(url) {
    const value = String(url || '');
    return /^https:\/\//i.test(value) || value.startsWith('/assets/') ? value : '';
  }
  function updateStoreCart(cart) {
    state.cart = cart; saveCart(cart); updateCartLinks(cart);
    document.querySelectorAll('[data-retail-add]').forEach(button => {
      const line = cart.items.find(item => item.id === button.dataset.retailAdd);
      button.innerHTML = line ? bi(`Add to basket (${line.quantity})`, `افزودن به سبد (${line.quantity})`) : bi('Add to basket', 'افزودن به سبد');
    });
  }
  function renderProducts(data) {
    const content = byId('retailStoreContent');
    const categories = new Map((data.categories || []).map(item => [item.id, item]));
    const products = data.products || [];
    const groups = new Map();
    for (const product of products) {
      const key = product.department_id || 'uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    }
    let html = `<div class="dr-store-head"><div><p class="dr-eyebrow">${bi(label(departmentKey)[0], label(departmentKey)[1])}</p><h2>${esc(data.merchant.name || '')}</h2><p>${esc(data.merchant.address || '')}</p></div><div class="dr-store-basket"><a class="dr-button" data-retail-checkout-link href="/retail-checkout.html?departmentKey=${encodeURIComponent(departmentKey)}&cityKey=${encodeURIComponent(cityKey)}&merchantId=${encodeURIComponent(data.merchant.id)}">${bi('Basket', 'سبد')} <span data-retail-cart-count>0</span></a></div></div>`;
    if (!data.orderingAvailable) html += `<div class="dr-notice warning">${bi('Ordering is paused for this department. You may browse products, but no order can be placed.', 'ثبت سفارش برای این بخش متوقف است. می‌توانید محصولات را ببینید، اما سفارش ثبت نمی‌شود.')}</div>`;
    for (const [key, items] of groups) {
      const category = categories.get(key);
      html += `<section class="dr-category"><h3>${esc(category?.name || (fa() ? 'سایر محصولات' : 'Other products'))}</h3><div class="dr-product-grid">`;
      for (const product of items) {
        const img = imageFor(product.image_url);
        const inStock = product.in_stock !== false;
        html += `<article class="dr-product-card">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="dr-product-art" aria-hidden="true"></div>'}<div class="dr-product-body"><h4>${esc(fa() ? (product.name_dari || product.name) : product.name)}</h4><p>${esc(fa() ? (product.description_dari || product.description || '') : (product.description || ''))}</p><div class="dr-product-price">${money(product.price)}${product.unit_label ? `<small> / ${esc(fa() ? (product.unit_label_dari || product.unit_label) : product.unit_label)}</small>` : ''}</div><button class="dr-button dr-button-small" type="button" data-retail-add="${esc(product.id)}" ${inStock ? '' : 'disabled'}>${bi(inStock ? 'Add to basket' : 'Out of stock', inStock ? 'افزودن به سبد' : 'ناموجود')}</button></div></article>`;
      }
      html += '</div></section>';
    }
    if (!products.length) html += `<div class="dr-empty">${bi('This store has no products available to browse yet.', 'این فروشگاه هنوز محصولی برای نمایش ندارد.')}</div>`;
    content.innerHTML = html;
    state.cart = readCart(data.merchant.id);
    updateStoreCart(state.cart);
    content.querySelectorAll('[data-retail-add]').forEach(button => button.addEventListener('click', () => {
      const product = products.find(item => item.id === button.dataset.retailAdd);
      if (!product || product.in_stock === false) return;
      const cart = readCart(data.merchant.id);
      const current = cart.items.find(item => item.id === product.id);
      if (current) current.quantity = Math.min(50, current.quantity + 1);
      else cart.items.push({ id:product.id, name:product.name, nameDari:product.name_dari || null, price:product.price, unitLabel:product.unit_label || null, imageUrl:imageFor(product.image_url), quantity:1 });
      cart.departmentKey = departmentKey;
      updateStoreCart(cart);
    }));
  }
  async function loadStore() {
    const content = byId('retailStoreContent'), status = byId('retailStoreStatus');
    if (!DEPARTMENTS[departmentKey]) {
      notice(status, 'Choose a valid retail department to browse.', 'برای مرور، یک بخش معتبر را انتخاب کنید.', 'warning');
      return;
    }
    const [en, dari] = label(departmentKey);
    byId('retailStoreTitle').innerHTML = bi(en, dari);
    try {
      if (merchantId) {
        const data = await query('departmentRetail.publicStorefront', { merchantId, departmentKey, cityKey });
        if (!data?.available) {
          notice(status, data?.reason === 'department_coming_soon' ? 'This department is coming soon. Ordering is not open.' : 'This store is not currently available. Retail ordering remains paused.', data?.reason === 'department_coming_soon' ? 'این بخش به‌زودی فعال می‌شود. ثبت سفارش باز نیست.' : 'این فروشگاه فعلاً در دسترس نیست. ثبت سفارش فروشگاهی متوقف است.', 'warning');
          content.innerHTML = '';
          return;
        }
        status.hidden = true;
        state.storefront = data;
        renderProducts(data);
        return;
      }
      const data = await query('departmentRetail.publicDirectory', { departmentKey, cityKey });
      if (!data?.available) {
        notice(status, 'This department is coming soon. Business listings and ordering are not open yet.', 'این بخش به‌زودی فعال می‌شود. فهرست کسب‌وکارها و ثبت سفارش هنوز باز نیست.', 'warning');
        content.innerHTML = '';
        return;
      }
      state.directory = data;
      status.hidden = true;
      if (!data.merchants?.length) {
        content.innerHTML = `<div class="dr-empty">${bi('No stores are available in this area yet.', 'در این ساحه هنوز فروشگاهی در دسترس نیست.')}</div>`;
        return;
      }
      content.innerHTML = `<div class="dr-merchant-grid">${data.merchants.map(merchant => `<article class="dr-merchant-card"><div><p class="dr-eyebrow">${bi(en, dari)}</p><h2>${esc(fa() ? (merchant.name_dari || merchant.name) : merchant.name)}</h2><p>${esc(merchant.address || '')}</p><div class="dr-tag-row">${merchant.has_delivery ? `<span>${bi('Delivery', 'ارسال')}</span>` : ''}${merchant.has_pickup ? `<span>${bi('Pickup', 'دریافت حضوری')}</span>` : ''}</div></div><a class="dr-button" href="/retail-store.html?departmentKey=${encodeURIComponent(departmentKey)}&cityKey=${encodeURIComponent(cityKey)}&merchantId=${encodeURIComponent(merchant.id)}">${bi('Browse products', 'مرور محصولات')}</a></article>`).join('')}</div>`;
    } catch (error) {
      notice(status, `The retail catalog could not be loaded: ${error.message}`, 'بارگیری فهرست فروشگاه‌ها ممکن نشد. لطفاً بعداً دوباره تلاش کنید.', 'error');
    }
  }
  const productCartLine = line => `<li><span>${esc(fa() ? (line.nameDari || line.name) : line.name)} × ${esc(line.quantity)}</span><strong>${money((Number(line.price) * Number(line.quantity)).toFixed(2))}</strong></li>`;
  async function loadCheckout() {
    const status = byId('retailCheckoutStatus'), form = byId('retailCheckoutForm'), summary = byId('retailCartItems');
    const cart = merchantId ? readCart(merchantId) : null;
    state.cart = cart;
    updateCartLinks(cart);
    if (!DEPARTMENTS[departmentKey] || !merchantId || !cart?.items?.length) {
      notice(status, 'Your retail basket is empty or unavailable. Return to a store to continue browsing.', 'سبد خرید فروشگاهی خالی یا در دسترس نیست. برای مرور، به فروشگاه برگردید.', 'warning');
      return;
    }
    byId('retailCheckoutStore').textContent = cart.items[0]?.name ? (fa() ? cart.items[0].nameDari || cart.items[0].name : cart.items[0].name) : label(departmentKey)[0];
    summary.innerHTML = cart.items.map(productCartLine).join('');
    byId('retailCheckoutBack').href = `/retail-store.html?departmentKey=${encodeURIComponent(departmentKey)}&cityKey=${encodeURIComponent(cityKey)}&merchantId=${encodeURIComponent(merchantId)}`;
    try {
      const storefront = await query('departmentRetail.publicStorefront', { merchantId, departmentKey, cityKey });
      state.storefront = storefront;
      if (!storefront?.available) {
        const quote = await query('departmentRetail.quoteOrder', { merchantId, departmentKey, cityKey, items:cart.items.map(({id,quantity})=>({id,quantity})), fulfillmentMethod:'delivery' });
        state.quote = quote;
        notice(status, quote?.reason === 'department_coming_soon' ? 'This department is coming soon. No order has been or can be placed.' : 'Retail ordering is paused. Your basket is saved, and no order has been or can be placed.', quote?.reason === 'department_coming_soon' ? 'این بخش به‌زودی فعال می‌شود. هیچ سفارشی ثبت نشده و ثبت نمی‌شود.' : 'ثبت سفارش فروشگاهی متوقف است. سبد شما ذخیره شده و هیچ سفارشی ثبت نشده و ثبت نمی‌شود.', 'warning');
        form.hidden = true;
        return;
      }
      setupFulfillment(storefront);
      form.hidden = false;
      status.hidden = true;
      await updateQuote();
    } catch (error) {
      notice(status, `Checkout could not be verified: ${error.message}. No order was submitted.`, 'بررسی پرداخت ممکن نشد. هیچ سفارشی ارسال نشده است.', 'error');
      form.hidden = true;
    }
  }
  function setupFulfillment(storefront) {
    const select = byId('retailFulfillment');
    select.innerHTML = '';
    if (storefront.merchant.hasDelivery) select.add(new Option(fa() ? 'ارسال' : 'Delivery', 'delivery'));
    if (storefront.merchant.hasPickup) select.add(new Option(fa() ? 'دریافت حضوری' : 'Pickup', 'pickup'));
    if (!select.options.length) select.add(new Option(fa() ? 'در دسترس نیست' : 'Unavailable', 'unavailable'));
    const delivery = storefront.merchant.deliveryZones || [];
    byId('retailZone').innerHTML = delivery.map(zone => `<option value="${esc(zone.key)}">${esc(zone.name || zone.key)} — ${money(zone.fee)}</option>`).join('');
    if (!delivery.length) byId('retailZone').add(new Option(fa() ? 'ساحه‌ای تنظیم نشده' : 'No area configured', ''));
    if (!storefront.merchant.hasDelivery && storefront.merchant.hasPickup) select.value = 'pickup';
    const deliveryFields = byId('retailDeliveryFields');
    const refreshFulfillmentFields = () => {
      deliveryFields.hidden = select.value !== 'delivery';
      invalidateQuote();
      updateQuote();
    };
    select.addEventListener('change', refreshFulfillmentFields);
    byId('retailZone').addEventListener('change', () => { invalidateQuote(); updateQuote(); });
    const scheduleAddressQuote = debounce(updateQuote, 350);
    byId('retailAddress').addEventListener('input', () => { invalidateQuote(); scheduleAddressQuote(); });
    refreshFulfillmentFields();
  }
  function debounce(fn, wait) { let timer; return () => { clearTimeout(timer); timer = setTimeout(fn, wait); }; }
  function currentQuoteInput() {
    const fulfillmentMethod = byId('retailFulfillment').value;
    const input = { merchantId, departmentKey, cityKey, items:state.cart.items.map(({id,quantity})=>({id,quantity})), fulfillmentMethod };
    if (fulfillmentMethod === 'delivery') { input.zoneKey = byId('retailZone').value; input.deliveryAddress = byId('retailAddress').value.trim(); }
    return input;
  }
  function quoteInputSignature(input) { return JSON.stringify(input); }
  function invalidateQuote() {
    state.quote = null;
    state.quoteInputKey = null;
    state.quoteRequestId += 1;
    const button = byId('retailPlaceOrder');
    if (button) button.disabled = true;
    const totals = byId('retailQuoteTotals');
    if (totals) totals.hidden = true;
  }
  async function updateQuote() {
    if (!state.storefront?.available) return;
    const input = currentQuoteInput();
    const signature = quoteInputSignature(input);
    const requestId = ++state.quoteRequestId;
    if (input.fulfillmentMethod === 'delivery' && (input.deliveryAddress.length < 5 || !input.zoneKey)) {
      state.quote = null;
      state.quoteInputKey = null;
      notice(byId('retailQuoteStatus'), 'Enter a delivery address and choose an area to request a server quote.', 'برای دریافت نرخ سروری، آدرس را وارد کنید و ساحه را انتخاب نمایید.', 'info');
      byId('retailQuoteTotals').hidden = true;
      return;
    }
    if (input.fulfillmentMethod === 'unavailable') return;
    state.quoting = true;
    byId('retailPlaceOrder').disabled = true;
    byId('retailQuoteTotals').hidden = true;
    notice(byId('retailQuoteStatus'), 'Refreshing the server quote…', 'در حال تازه‌سازی نرخ سروری…', 'info');
    try {
      const quote = await query('departmentRetail.quoteOrder', input);
      if (requestId !== state.quoteRequestId || signature !== quoteInputSignature(currentQuoteInput())) return;
      state.quote = quote;
      state.quoteInputKey = signature;
      if (!quote?.available) {
        notice(byId('retailQuoteStatus'), 'Retail ordering is paused. No order can be submitted.', 'ثبت سفارش فروشگاهی متوقف است. سفارش ارسال نمی‌شود.', 'warning');
        byId('retailQuoteTotals').hidden = true;
        return;
      }
      byId('retailQuoteStatus').hidden = true;
      byId('retailQuoteSubtotal').textContent = money(quote.subtotal);
      byId('retailQuoteDelivery').textContent = money(quote.deliveryFee);
      byId('retailQuoteTotal').textContent = money(quote.total);
      byId('retailQuoteTotals').hidden = false;
      const cash = quote.paymentMethods?.cashOnDelivery?.available === true;
      byId('retailPlaceOrder').disabled = !cash;
      notice(byId('retailPaymentStatus'), cash ? 'Cash on delivery is available. Online payment can be added alongside it after an approved provider is integrated.' : 'Online payment is not configured; no payment can be taken. Please contact the store about payment availability.', cash ? 'پرداخت نقدی هنگام تحویل در دسترس است. پس از ادغام ارائه‌دهندهٔ تأییدشده، پرداخت آنلاین نیز می‌تواند در کنار آن افزوده شود.' : 'پرداخت آنلاین تنظیم نشده است و پرداختی انجام نمی‌شود. دربارهٔ روش پرداخت با فروشگاه تماس بگیرید.', 'info');
    } catch (error) {
      if (requestId !== state.quoteRequestId || signature !== quoteInputSignature(currentQuoteInput())) return;
      state.quote = null;
      state.quoteInputKey = null;
      notice(byId('retailQuoteStatus'), `A server quote is not available: ${error.message}. No order was submitted.`, 'نرخ سروری در دسترس نیست. هیچ سفارشی ارسال نشده است.', 'error');
      byId('retailQuoteTotals').hidden = true;
      byId('retailPlaceOrder').disabled = true;
    } finally { if (requestId === state.quoteRequestId) state.quoting = false; }
  }
  function createAttemptKey(payload) {
    const key = `ae_retail_checkout_attempt:${merchantId}`;
    const signature = JSON.stringify(payload);
    try {
      const prior = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (prior?.signature === signature && prior?.idempotencyKey) return prior.idempotencyKey;
      const idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ signature, idempotencyKey }));
      return idempotencyKey;
    } catch { return crypto.randomUUID(); }
  }
  async function submitOrder(event) {
    event.preventDefault();
    const button = byId('retailPlaceOrder'), outcome = byId('retailOrderResult');
    const input = currentQuoteInput();
    if (state.quoteInputKey !== quoteInputSignature(input)) {
      invalidateQuote();
      notice(outcome, 'Checkout details changed. Refreshing the server quote; review the total before submitting again.', 'جزئیات پرداخت تغییر کرده است. نرخ سروری تازه می‌شود؛ پیش از ثبت دوباره مجموع را بررسی کنید.', 'info');
      updateQuote();
      return;
    }
    if (!state.quote?.available || !state.quote?.paymentMethods?.cashOnDelivery?.available || !state.storefront?.orderingAvailable) {
      notice(outcome, 'Ordering is paused or no verified quote is available. No order was submitted.', 'ثبت سفارش متوقف است یا نرخ تأییدشده‌ای در دسترس نیست. هیچ سفارشی ارسال نشد.', 'warning');
      return;
    }
    const payload = { ...input, customerName:byId('retailCustomerName').value.trim(), customerPhone:byId('retailCustomerPhone').value.trim(), customerNote:byId('retailCustomerNote').value.trim() || undefined, paymentMethod:'cash_on_delivery', idempotencyKey:createAttemptKey({ ...input, name:byId('retailCustomerName').value.trim(), phone:byId('retailCustomerPhone').value.trim(), note:byId('retailCustomerNote').value.trim() }) };
    if (payload.customerName.length < 2 || payload.customerPhone.replace(/[^0-9]/g,'').length < 9) {
      notice(outcome, 'Enter your name and a valid contact number.', 'نام و شمارهٔ تماس معتبر را وارد کنید.', 'warning');
      return;
    }
    button.disabled = true;
    try {
      const result = await mutate('departmentRetail.placeOrder', payload);
      state.cart.items = [];
      saveCart(state.cart); updateCartLinks(state.cart);
      byId('retailCheckoutForm').hidden = true;
      byId('retailCartItems').innerHTML = '';
      const totalCopy = result.total == null ? '' : ` Server-confirmed total: ؋ ${result.total}.`;
      const totalCopyDari = result.total == null ? '' : ` مجموع تأییدشده سرور: ؋ ${result.total}.`;
      notice(outcome, `Order received: ${result.orderNumber}.${totalCopy} Payment is cash on delivery; no online charge was taken.`, `سفارش ثبت شد: ${result.orderNumber}.${totalCopyDari} پرداخت نقدی هنگام تحویل است؛ هیچ پرداخت آنلاین انجام نشد.`, 'success');
    } catch (error) {
      notice(outcome, `The order was not confirmed: ${error.message}. Your basket is unchanged.`, 'سفارش تأیید نشد. سبد خرید شما تغییر نکرده است.', 'error');
    } finally { button.disabled = false; }
  }
  async function init() {
    const storePage = byId('retailStoreContent');
    if (storePage) {
      byId('retailStoreStatus').hidden = false;
      notice(byId('retailStoreStatus'), 'Checking department availability…', 'در حال بررسی دسترسی بخش…', 'info');
      await loadStore();
    }
    if (byId('retailCheckoutForm')) {
      byId('retailCheckoutStatus').hidden = false;
      notice(byId('retailCheckoutStatus'), 'Checking department availability…', 'در حال بررسی دسترسی بخش…', 'info');
      byId('retailCheckoutForm').addEventListener('submit', submitOrder);
      await loadCheckout();
    }
    const cart = merchantId ? readCart(merchantId) : null;
    updateCartLinks(cart);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
