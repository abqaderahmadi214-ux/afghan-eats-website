const AEOPS = {
  token: sessionStorage.getItem('ae_admin_token') || '',
  admin: JSON.parse(sessionStorage.getItem('ae_admin') || 'null'),
  riders: [],
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function opsApiBase() {
  return (window.AFGHAN_EATS_CONFIG || {}).apiBaseUrl || '';
}

async function opsQuery(path, input, authenticated = false) {
  const base = opsApiBase();
  if (!base) throw new Error('API is not configured');
  const q = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const headers = { Accept: 'application/json' };
  if (authenticated && AEOPS.token) headers.Authorization = `Bearer ${AEOPS.token}`;
  const res = await fetch(`${base}/api/trpc/${path}?input=${q}`, { headers });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseOpsError(raw, res.status));
  const body = JSON.parse(raw);
  return body?.result?.data?.json ?? body?.result?.data ?? body;
}

async function opsMutation(path, input, authenticated = false) {
  const base = opsApiBase();
  if (!base) throw new Error('API is not configured');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (authenticated && AEOPS.token) headers.Authorization = `Bearer ${AEOPS.token}`;
  const res = await fetch(`${base}/api/trpc/${path}`, {
    method: 'POST', headers, body: JSON.stringify({ json: input }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseOpsError(raw, res.status));
  const body = JSON.parse(raw);
  return body?.result?.data?.json ?? body?.result?.data ?? body;
}

function parseOpsError(raw, status) {
  try {
    const data = JSON.parse(raw);
    return data?.error?.json?.message || data?.error?.message || `Request failed (${status})`;
  } catch {
    return raw || `Request failed (${status})`;
  }
}

function setSubmitState(form, busy) {
  const button = form.querySelector('button[type=submit]');
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? (lang === 'fa' ? 'در حال ارسال…' : 'Submitting…') : button.dataset.label;
}

async function submitPartnerApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const out = document.getElementById('partnerResult');
  setSubmitState(form, true);
  out.className = 'notice hidden';
  try {
    const f = new FormData(form);
    const result = await opsMutation('operations.applyPartner', {
      restaurantName: String(f.get('restaurantName') || ''),
      ownerName: String(f.get('ownerName') || ''),
      phone: String(f.get('phone') || ''),
      whatsapp: String(f.get('whatsapp') || ''),
      email: String(f.get('email') || ''),
      district: String(f.get('district') || ''),
      address: String(f.get('address') || ''),
      deliveryModel: String(f.get('deliveryModel') || 'afghan_eats'),
      cuisine: String(f.get('cuisine') || ''),
      notes: String(f.get('notes') || ''),
    });
    out.className = 'notice success';
    out.innerHTML = `${result.duplicate ? '✓ Existing application found.' : '✓ Application received.'} <b>${esc(result.reference)}</b><br><span class="muted">${lang === 'fa' ? 'این شماره پیگیری را نگه دارید.' : 'Keep this reference to check your application status.'}</span>`;
    localStorage.setItem('ae_partner_reference', result.reference);
    if (!result.duplicate) form.reset();
  } catch (error) {
    out.className = 'notice error';
    out.textContent = error.message || 'Application could not be submitted.';
  } finally {
    setSubmitState(form, false);
  }
}

async function submitRiderApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const out = document.getElementById('riderResult');
  setSubmitState(form, true);
  out.className = 'notice hidden';
  try {
    const f = new FormData(form);
    const result = await opsMutation('operations.applyRider', {
      fullName: String(f.get('fullName') || ''),
      phone: String(f.get('phone') || ''),
      whatsapp: String(f.get('whatsapp') || ''),
      vehicle: String(f.get('vehicle') || 'motorcycle'),
      serviceArea: String(f.get('serviceArea') || ''),
      emergencyContact: String(f.get('emergencyContact') || ''),
      experience: String(f.get('experience') || ''),
      notes: String(f.get('notes') || ''),
    });
    out.className = 'notice success';
    out.innerHTML = `${result.duplicate ? '✓ Existing application found.' : '✓ Rider application received.'} <b>${esc(result.reference)}</b><br><span class="muted">${lang === 'fa' ? 'این شماره پیگیری را نگه دارید.' : 'Keep this reference to check your application status.'}</span>`;
    localStorage.setItem('ae_rider_reference', result.reference);
    if (!result.duplicate) form.reset();
  } catch (error) {
    out.className = 'notice error';
    out.textContent = error.message || 'Application could not be submitted.';
  } finally {
    setSubmitState(form, false);
  }
}

async function checkApplicationStatus(event, type) {
  event.preventDefault();
  const form = event.currentTarget;
  const out = form.querySelector('.application-status-result');
  try {
    const f = new FormData(form);
    const result = await opsQuery('operations.applicationStatus', {
      type,
      reference: String(f.get('reference') || ''),
      phone: String(f.get('phone') || ''),
    });
    out.className = 'notice success application-status-result';
    out.innerHTML = `<b>${esc(result.reference)}</b> · <span class="status-badge status-${esc(result.status)}">${esc(result.status)}</span>`;
  } catch (error) {
    out.className = 'notice error application-status-result';
    out.textContent = error.message || 'Application not found.';
  }
}

async function adminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.getElementById('adminLoginError');
  setSubmitState(form, true);
  try {
    const f = new FormData(form);
    const result = await opsMutation('auth.login', {
      username: String(f.get('username') || ''),
      password: String(f.get('password') || ''),
    });
    AEOPS.token = result.token;
    AEOPS.admin = result.admin;
    sessionStorage.setItem('ae_admin_token', result.token);
    sessionStorage.setItem('ae_admin', JSON.stringify(result.admin));
    errorBox.classList.add('hidden');
    showAdminConsole();
    await loadAdminDashboard();
  } catch (error) {
    errorBox.className = 'notice error';
    errorBox.textContent = error.message || 'Login failed.';
  } finally {
    setSubmitState(form, false);
  }
}

function adminLogout() {
  sessionStorage.removeItem('ae_admin_token');
  sessionStorage.removeItem('ae_admin');
  AEOPS.token = '';
  AEOPS.admin = null;
  document.getElementById('adminConsole')?.classList.add('hidden');
  document.getElementById('adminLogin')?.classList.remove('hidden');
}

async function verifyAdminSession() {
  if (!AEOPS.token) return false;
  try {
    const me = await opsQuery('auth.me', null, true);
    AEOPS.admin = me;
    return true;
  } catch {
    adminLogout();
    return false;
  }
}

function showAdminConsole() {
  document.getElementById('adminLogin')?.classList.add('hidden');
  document.getElementById('adminConsole')?.classList.remove('hidden');
  const who = document.getElementById('adminWho');
  if (who) who.textContent = AEOPS.admin?.username || 'Admin';
}

async function loadAdminDashboard() {
  const loading = document.getElementById('adminLoading');
  if (loading) loading.classList.remove('hidden');
  try {
    const [ordersData, partners, ridersApps, riders, assignments] = await Promise.all([
      opsQuery('orders.adminList', { limit: 50, offset: 0 }, true),
      opsQuery('operations.adminPartnerApplications', { limit: 100 }, true),
      opsQuery('operations.adminRiderApplications', { limit: 100 }, true),
      opsQuery('operations.adminRiders', { availableOnly: false }, true),
      opsQuery('operations.adminAssignments', { limit: 100 }, true),
    ]);
    AEOPS.riders = riders || [];
    renderAdminStats(ordersData.orders || [], partners || [], ridersApps || [], riders || []);
    renderAdminOrders(ordersData.orders || []);
    renderPartnerApplications(partners || []);
    renderRiderApplications(ridersApps || []);
    renderRiders(riders || []);
    renderAssignments(assignments || []);
  } catch (error) {
    const globalError = document.getElementById('adminGlobalError');
    if (globalError) {
      globalError.className = 'notice error';
      globalError.textContent = error.message || 'Could not load operations data.';
    }
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderAdminStats(orders, partners, riderApps, riders) {
  const el = document.getElementById('opsStats');
  if (!el) return;
  const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'failed'].includes(o.status)).length;
  const pendingPartners = partners.filter(x => ['pending', 'reviewing'].includes(x.status)).length;
  const pendingRiders = riderApps.filter(x => ['pending', 'reviewing'].includes(x.status)).length;
  const availableRiders = riders.filter(x => x.status === 'active' && x.is_available).length;
  el.innerHTML = [
    ['Live orders', activeOrders, 'Orders still moving through the system'],
    ['Partner queue', pendingPartners, 'Restaurants awaiting a decision'],
    ['Rider queue', pendingRiders, 'Rider applications awaiting review'],
    ['Available riders', availableRiders, 'Approved and ready for assignment'],
  ].map(([label, value, note]) => `<div class="ops-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`).join('');
}

function riderOptions() {
  const active = AEOPS.riders.filter(r => r.status === 'active');
  return active.map(r => `<option value="${esc(r.id)}">${esc(r.full_name)} · ${esc(r.vehicle)}${r.is_available ? ' · available' : ''}</option>`).join('');
}

function renderAdminOrders(orders) {
  const el = document.getElementById('opsOrders');
  if (!el) return;
  if (!orders.length) { el.innerHTML = '<div class="empty-state">No orders yet.</div>'; return; }
  el.innerHTML = orders.map(o => `<div class="ops-row">
    <div><b>${esc(o.order_number)}</b><div class="muted">${esc(o.customer_name || '')} · ${esc(o.customer_phone || '')}</div><small>${esc(o.delivery_address || '')}</small></div>
    <div><b>؋ ${Number(o.total || 0).toLocaleString()}</b><div class="status-badge status-${esc(o.status)}">${esc(o.status)}</div></div>
    <div class="ops-actions"><select id="rider-${esc(o.id)}"><option value="">Choose rider</option>${riderOptions()}</select><button class="btn btn-primary btn-sm" onclick="assignRider('${esc(o.id)}')">Assign</button></div>
  </div>`).join('');
}

async function assignRider(orderId) {
  const select = document.getElementById(`rider-${orderId}`);
  if (!select?.value) return;
  try {
    await opsMutation('operations.adminAssignRider', { orderId, riderId: select.value }, true);
    await loadAdminDashboard();
  } catch (error) { alert(error.message); }
}

function applicationButtons(type, item) {
  return `<div class="ops-actions">
    <button class="btn btn-light btn-sm" onclick="setApplicationStatus('${type}','${esc(item.id)}','reviewing')">Reviewing</button>
    <button class="btn btn-primary btn-sm" onclick="setApplicationStatus('${type}','${esc(item.id)}','approved')">Approve</button>
    <button class="btn btn-light btn-sm" onclick="setApplicationStatus('${type}','${esc(item.id)}','waitlisted')">Waitlist</button>
    <button class="btn btn-danger btn-sm" onclick="setApplicationStatus('${type}','${esc(item.id)}','rejected')">Reject</button>
  </div>`;
}

function renderPartnerApplications(items) {
  const el = document.getElementById('opsPartners'); if (!el) return;
  el.innerHTML = items.length ? items.map(x => `<div class="ops-row ops-row-wide">
    <div><b>${esc(x.restaurant_name)}</b><div>${esc(x.owner_name)} · ${esc(x.phone)}</div><small>${esc(x.district)} · ${esc(x.address)}</small></div>
    <div><b>${esc(x.reference)}</b><div class="status-badge status-${esc(x.status)}">${esc(x.status)}</div></div>
    ${applicationButtons('partner', x)}
  </div>`).join('') : '<div class="empty-state">No restaurant applications yet.</div>';
}

function renderRiderApplications(items) {
  const el = document.getElementById('opsRiderApps'); if (!el) return;
  el.innerHTML = items.length ? items.map(x => `<div class="ops-row ops-row-wide">
    <div><b>${esc(x.full_name)}</b><div>${esc(x.phone)} · ${esc(x.vehicle)}</div><small>${esc(x.service_area || 'Herat')}</small></div>
    <div><b>${esc(x.reference)}</b><div class="status-badge status-${esc(x.status)}">${esc(x.status)}</div></div>
    ${applicationButtons('rider', x)}
  </div>`).join('') : '<div class="empty-state">No rider applications yet.</div>';
}

async function setApplicationStatus(type, id, status) {
  try {
    const path = type === 'partner' ? 'operations.adminUpdatePartnerApplication' : 'operations.adminUpdateRiderApplication';
    await opsMutation(path, { id, status }, true);
    await loadAdminDashboard();
  } catch (error) { alert(error.message); }
}

function renderRiders(items) {
  const el = document.getElementById('opsRiders'); if (!el) return;
  el.innerHTML = items.length ? items.map(r => `<div class="ops-row">
    <div><b>${esc(r.full_name)}</b><div>${esc(r.phone)} · ${esc(r.vehicle)}</div><small>${Number(r.total_deliveries || 0)} deliveries</small></div>
    <div><span class="status-badge status-${esc(r.status)}">${esc(r.status)}</span><div>${r.is_available ? '🟢 Available' : '⚪ Busy/offline'}</div></div>
    <div class="ops-actions"><button class="btn btn-light btn-sm" onclick="toggleRiderAvailability('${esc(r.id)}',${!r.is_available})">${r.is_available ? 'Set busy' : 'Set available'}</button></div>
  </div>`).join('') : '<div class="empty-state">Approve rider applications to build the fleet.</div>';
}

async function toggleRiderAvailability(id, isAvailable) {
  try { await opsMutation('operations.adminUpdateRider', { id, isAvailable }, true); await loadAdminDashboard(); }
  catch (error) { alert(error.message); }
}

function renderAssignments(items) {
  const el = document.getElementById('opsAssignments'); if (!el) return;
  const statuses = ['assigned', 'accepted', 'at_restaurant', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
  el.innerHTML = items.length ? items.map(a => `<div class="ops-row">
    <div><b>${esc(a.order_number)}</b><div>${esc(a.rider_name)}</div><small>${esc(a.delivery_address || '')}</small></div>
    <div><span class="status-badge status-${esc(a.status)}">${esc(a.status)}</span></div>
    <div class="ops-actions"><select id="assignment-${esc(a.id)}">${statuses.map(s => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${s.replaceAll('_',' ')}</option>`).join('')}</select><button class="btn btn-primary btn-sm" onclick="updateAssignment('${esc(a.id)}')">Update</button></div>
  </div>`).join('') : '<div class="empty-state">No delivery assignments yet.</div>';
}

async function updateAssignment(id) {
  const status = document.getElementById(`assignment-${id}`)?.value;
  if (!status) return;
  try { await opsMutation('operations.adminUpdateAssignment', { id, status }, true); await loadAdminDashboard(); }
  catch (error) { alert(error.message); }
}

function showOpsTab(id, button) {
  document.querySelectorAll('.ops-panel').forEach(x => x.classList.add('hidden'));
  document.querySelectorAll('.ops-tab').forEach(x => x.classList.remove('active'));
  document.getElementById(id)?.classList.remove('hidden');
  button?.classList.add('active');
}

async function initOperationsAdmin() {
  if (!document.getElementById('adminConsole')) return;
  if (await verifyAdminSession()) {
    showAdminConsole();
    await loadAdminDashboard();
  }
}

document.addEventListener('DOMContentLoaded', initOperationsAdmin);
