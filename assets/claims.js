const AECLAIM = { restaurant: null, claims: [] };

function claimEsc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function claimText(en, fa) { return typeof lang !== 'undefined' && lang === 'fa' ? fa : en; }
function claimApiBase() { return (window.AFGHAN_EATS_CONFIG || {}).apiBaseUrl || ''; }

function claimError(raw, status) {
  try {
    const data = JSON.parse(raw);
    return data?.error?.json?.message || data?.error?.message || `Request failed (${status})`;
  } catch {
    return raw || `Request failed (${status})`;
  }
}

async function claimMutation(path, input) {
  const response = await fetch(`${claimApiBase()}/api/trpc/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(claimError(raw, response.status));
  const body = JSON.parse(raw);
  return body?.result?.data?.json ?? body?.result?.data ?? body;
}

async function claimQuery(path, input) {
  const query = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const response = await fetch(`${claimApiBase()}/api/trpc/${path}?input=${query}`, { headers: { Accept: 'application/json' } });
  const raw = await response.text();
  if (!response.ok) throw new Error(claimError(raw, response.status));
  const body = JSON.parse(raw);
  return body?.result?.data?.json ?? body?.result?.data ?? body;
}

function claimBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.dataset.label ||= button.innerHTML;
  if (busy) button.textContent = claimText('Submitting…', 'در حال ارسال…');
  else button.innerHTML = button.dataset.label;
}

function claimPublicUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

async function initRestaurantClaim() {
  const form = document.getElementById('restaurantClaimForm');
  if (!form) return;
  const id = new URLSearchParams(location.search).get('restaurant') || '';
  const summary = document.getElementById('claimRestaurantSummary');
  try {
    if (typeof loadData === 'function') await loadData();
    const catalogue = () => typeof restaurants !== 'undefined' ? restaurants : (window.restaurants || []);
    let restaurant = catalogue().find(item => String(item.id) === id);
    if (!restaurant && typeof refreshLiveRestaurants === 'function') {
      await refreshLiveRestaurants([]);
      restaurant = catalogue().find(item => String(item.id) === id);
    }
    if (!restaurant || restaurant.listing_mode !== 'directory') throw new Error(claimText('This public restaurant listing is not available for claiming.', 'این فهرست عمومی برای درخواست مالکیت در دسترس نیست.'));
    AECLAIM.restaurant = restaurant;
    form.elements.restaurantId.value = restaurant.id;
    const name = typeof displayName === 'function' ? displayName(restaurant) : restaurant.name;
    const address = typeof restaurantAddress === 'function' ? restaurantAddress(restaurant) : restaurant.address;
    const source = claimPublicUrl(restaurant.source_url);
    summary.innerHTML = `<span class="directory-kicker">${claimEsc(claimText('Selected listing', 'فهرست انتخاب‌شده'))}</span><h2>${claimEsc(name)}</h2><p>📍 ${claimEsc(address || claimText('Address being confirmed', 'آدرس در حال تأیید است'))}</p>${source ? `<a href="${claimEsc(source)}" target="_blank" rel="noopener noreferrer">${claimEsc(claimText('View the public source used for this listing', 'مشاهده منبع عمومی این فهرست'))}</a>` : ''}`;
    document.title = claimText(`Claim ${restaurant.name} | Afghan Eats`, `درخواست مالکیت ${restaurant.name_dari || restaurant.name} | Afghan Eats`);
  } catch (error) {
    summary.className = 'notice error';
    summary.textContent = error.message;
    form.classList.add('hidden');
  }
}

window.submitRestaurantClaim = async function submitRestaurantClaim(event) {
  event.preventDefault();
  const form = event.currentTarget, output = document.getElementById('restaurantClaimResult'), data = new FormData(form);
  claimBusy(form, true);
  output.className = 'notice hidden';
  try {
    const result = await claimMutation('operations.applyRestaurantClaim', {
      restaurantId: String(data.get('restaurantId') || ''),
      claimantName: String(data.get('claimantName') || ''),
      claimantRole: String(data.get('claimantRole') || 'owner'),
      phone: String(data.get('phone') || ''),
      whatsapp: String(data.get('whatsapp') || ''),
      email: String(data.get('email') || ''),
      evidenceNotes: String(data.get('evidenceNotes') || ''),
    });
    output.className = 'notice success';
    output.innerHTML = `<b>${claimEsc(result.duplicate ? claimText('Existing claim found', 'درخواست قبلی پیدا شد') : claimText('Claim received', 'درخواست دریافت شد'))}</b><p>${claimEsc(result.restaurantName || AECLAIM.restaurant?.name || '')}</p><p>${claimEsc(claimText('Reference:', 'شماره پیگیری:'))} <strong>${claimEsc(result.reference)}</strong></p><small>${claimEsc(claimText('Keep this reference and the phone number you used. Afghan Eats will verify the claim through a published restaurant number before granting access.', 'این شماره پیگیری و شماره تماس ثبت‌شده را نگه دارید. افغان ایتس پیش از دادن دسترسی، درخواست را از طریق شماره عمومی رستورانت بررسی می‌کند.'))}</small>`;
    localStorage.setItem('ae_restaurant_claim_reference', result.reference);
    if (!result.duplicate) {
      [...form.elements].forEach(field => { if (field.name && !['restaurantId', 'claimantRole'].includes(field.name)) field.value = ''; });
    }
  } catch (error) {
    output.className = 'notice error';
    output.textContent = error.message || claimText('Claim could not be submitted.', 'درخواست ارسال نشد.');
  } finally { claimBusy(form, false); }
};

window.checkRestaurantClaim = async function checkRestaurantClaim(event) {
  event.preventDefault();
  const form = event.currentTarget, output = document.getElementById('restaurantClaimStatus'), data = new FormData(form);
  try {
    const result = await claimQuery('operations.restaurantClaimStatus', { reference: String(data.get('reference') || ''), phone: String(data.get('phone') || '') });
    output.className = 'notice success';
    output.innerHTML = `<b>${claimEsc(result.restaurant_name)}</b><p>${claimEsc(result.reference)} · <span class="status-badge status-${claimEsc(result.status)}">${claimEsc(result.status)}</span></p>`;
  } catch (error) {
    output.className = 'notice error';
    output.textContent = error.message || claimText('Claim not found.', 'درخواست پیدا نشد.');
  }
};

function claimNumbers(item) {
  const extra = Array.isArray(item.restaurant_phone_numbers) ? item.restaurant_phone_numbers : [];
  return [...extra, item.restaurant_phone, item.restaurant_phone2].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
}

function ensureClaimAdminUi() {
  if (!document.querySelector('link[href="/assets/claims.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet'; stylesheet.href = '/assets/claims.css';
    document.head.appendChild(stylesheet);
  }
  const tabs = document.querySelector('.ops-tabs'), partnerPanel = document.getElementById('panelPartners');
  if (!tabs || !partnerPanel || document.getElementById('restaurantClaimsTab')) return;
  const tab = document.createElement('button');
  tab.id = 'restaurantClaimsTab'; tab.type = 'button'; tab.className = 'ops-tab'; tab.textContent = 'Restaurant claims';
  tab.addEventListener('click', () => showOpsTab('panelRestaurantClaims', tab));
  const partnerTab = [...tabs.querySelectorAll('.ops-tab')].find(button => button.getAttribute('onclick')?.includes('panelPartners'));
  partnerTab?.insertAdjacentElement('afterend', tab) || tabs.appendChild(tab);
  const panel = document.createElement('section');
  panel.id = 'panelRestaurantClaims'; panel.className = 'ops-panel hidden';
  panel.innerHTML = '<div class="ops-panel-head"><div><h2>Restaurant ownership claims</h2><p class="muted">Verify each claimant by calling a published restaurant number. Approval keeps ordering disabled until onboarding is complete.</p></div><button class="btn btn-light" type="button" onclick="loadRestaurantClaims()">↻</button></div><div id="restaurantClaimAdminError" class="notice error hidden"></div><div id="restaurantClaimInviteOutput"></div><div id="restaurantClaimAdminList" class="ops-list"></div>';
  partnerPanel.insertAdjacentElement('afterend', panel);
}

window.loadRestaurantClaims = async function loadRestaurantClaims() {
  ensureClaimAdminUi();
  if (typeof opsQuery !== 'function' || typeof AEOPS === 'undefined' || !AEOPS.token) return;
  const errorBox = document.getElementById('restaurantClaimAdminError');
  try {
    AECLAIM.claims = await opsQuery('operations.adminRestaurantClaims', { limit: 100 }, true);
    if (errorBox) errorBox.classList.add('hidden');
    renderRestaurantClaims(AECLAIM.claims || []);
  } catch (error) {
    if (errorBox) { errorBox.className = 'notice error'; errorBox.textContent = error.message; }
  }
};

function renderRestaurantClaims(items) {
  const host = document.getElementById('restaurantClaimAdminList');
  if (!host) return;
  host.innerHTML = items.length ? items.map(item => {
    const numbers = claimNumbers(item), source = claimPublicUrl(item.source_url), approved = item.status === 'approved';
    return `<article class="claim-admin-card" data-claim-id="${claimEsc(item.id)}"><div class="claim-admin-head"><div><h3>${claimEsc(item.restaurant_name)}</h3><p>${claimEsc(item.restaurant_address || '')}</p><div class="claim-admin-source">${numbers.map(number => `<a class="btn btn-light btn-sm" href="tel:${claimEsc(String(number).replace(/[^0-9+]/g, ''))}">☎ ${claimEsc(number)}</a>`).join('')}${source ? `<a class="btn btn-light btn-sm" href="${claimEsc(source)}" target="_blank" rel="noopener noreferrer">Public source ↗</a>` : ''}</div></div><div><b>${claimEsc(item.reference)}</b><br><span class="status-badge status-${claimEsc(item.status)}">${claimEsc(item.status)}</span></div></div><div class="claim-admin-grid"><div><b>${claimEsc(item.claimant_name)}</b><p>${claimEsc(item.claimant_role.replaceAll('_', ' '))} · ${claimEsc(item.phone)}</p><small>${claimEsc(item.email || item.whatsapp || '')}</small></div><div class="claim-proof-note"><b>Claim evidence</b><br>${claimEsc(item.evidence_notes)}</div><label class="field"><span>Published number called</span><select data-claim-phone><option value="">Select after calling</option>${numbers.map(number => `<option value="${claimEsc(number)}" ${item.verified_phone && String(item.verified_phone).replace(/\D/g, '') === String(number).replace(/\D/g, '') ? 'selected' : ''}>${claimEsc(number)}</option>`).join('')}</select></label><label class="field"><span>Admin notes</span><textarea data-claim-notes rows="3" maxlength="1500">${claimEsc(item.admin_notes || '')}</textarea></label><div class="field full ops-actions"><button class="btn btn-light btn-sm" type="button" onclick="reviewRestaurantClaim('${claimEsc(item.id)}','reviewing')">Mark reviewing</button><button class="btn btn-primary btn-sm" type="button" onclick="reviewRestaurantClaim('${claimEsc(item.id)}','approved')" ${approved ? 'disabled' : ''}>Approve verified owner</button><button class="btn btn-danger btn-sm" type="button" onclick="reviewRestaurantClaim('${claimEsc(item.id)}','rejected')">Reject</button>${approved && !item.owner_portal_username ? `<button class="btn btn-dark btn-sm" type="button" onclick="createClaimOwnerInvite('${claimEsc(item.id)}')">Create owner access</button>` : ''}${item.owner_portal_username ? `<span class="status-badge status-approved">Portal: ${claimEsc(item.owner_portal_username)}${item.owner_portal_activated_at ? ' · activated' : ' · invited'}</span>` : ''}</div></div></article>`;
  }).join('') : '<div class="empty-state">No restaurant ownership claims yet.</div>';
}

window.reviewRestaurantClaim = async function reviewRestaurantClaim(id, status) {
  const card = document.querySelector(`[data-claim-id="${CSS.escape(id)}"]`), verifiedPhone = card?.querySelector('[data-claim-phone]')?.value || '', adminNotes = card?.querySelector('[data-claim-notes]')?.value || '';
  if (status === 'approved') {
    if (!verifiedPhone) { alert('Call and select a published restaurant number before approval.'); return; }
    if (!confirm('Confirm that you personally verified this owner or manager by calling the selected published restaurant number.')) return;
  }
  try {
    await opsMutation('operations.adminReviewRestaurantClaim', { id, status, adminNotes, verificationMethod: status === 'approved' ? 'published_phone_call' : undefined, verifiedPhone: status === 'approved' ? verifiedPhone : undefined }, true);
    await loadRestaurantClaims();
  } catch (error) { alert(error.message); }
};

window.createClaimOwnerInvite = async function createClaimOwnerInvite(claimId) {
  try {
    const result = await opsMutation('portal.adminCreateClaimInvite', { claimId }, true), url = `${location.origin}/activate?token=${encodeURIComponent(result.activationToken)}`, host = document.getElementById('restaurantClaimInviteOutput');
    host.className = 'claim-invite-output';
    host.innerHTML = `<b>One-time owner activation link for ${claimEsc(result.restaurantName)}</b><p>Username: <strong>${claimEsc(result.username)}</strong> · expires in ${claimEsc(result.expiresInHours)} hours</p><textarea id="restaurantClaimInviteLink" readonly>${claimEsc(url)}</textarea><button class="btn btn-dark btn-sm" type="button" onclick="copyRestaurantClaimInvite()">Copy private activation link</button><p class="muted">Send this link privately. It cannot be recovered after leaving this page.</p>`;
    await loadRestaurantClaims();
  } catch (error) { alert(error.message); }
};

window.copyRestaurantClaimInvite = async function copyRestaurantClaimInvite() {
  const value = document.getElementById('restaurantClaimInviteLink')?.value;
  if (value) await navigator.clipboard.writeText(value);
};

function initClaimModule() {
  initRestaurantClaim();
  ensureClaimAdminUi();
  if (typeof AEOPS !== 'undefined' && AEOPS.token) loadRestaurantClaims();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initClaimModule);
else initClaimModule();
