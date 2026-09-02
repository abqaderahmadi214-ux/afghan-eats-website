'use strict';

const API_BASE = 'https://afghaneats-api.onrender.com';
const TOKEN_KEY = 'ae_control_center_token';
const USER_KEY = 'ae_control_center_user';
const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'restaurant_staff', 'rider_staff', 'operations_staff']);
const FULL_ADMIN_ROLES = new Set(['admin', 'superadmin']);
const state = { token: sessionStorage.getItem(TOKEN_KEY) || '', user: safeJson(sessionStorage.getItem(USER_KEY)), view: location.hash.slice(1) || 'overview', cache: {}, invite: null, setupReviewId: null, partnerReviewId: null, partnerReviewDetail: null, riderReviewId: null, riderReviewDetail: null, restaurantEditId: null, confirmCallback: null };

const root = document.getElementById('view-root');
const loginView = document.getElementById('login-view');
const appShell = document.getElementById('app-shell');
const notice = document.getElementById('global-notice');
const dialog = document.getElementById('confirm-dialog');

function safeJson(value) { try { return value ? JSON.parse(value) : null; } catch { return null; } }
function esc(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function attr(value) { return esc(value).replaceAll('\n', '&#10;'); }
function asArray(value) { return Array.isArray(value) ? value : (value?.items || value?.orders || value?.restaurants || value?.customers || []); }
function number(value) { return Number(value || 0).toLocaleString(); }
function money(value) { return `AFN ${number(value)}`; }
function shortDate(value) { if (!value) return '—'; try { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); } catch { return '—'; } }
function afghanDate(value) { if (!value) return '—'; try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kabul', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); } catch { return '—'; } }
function kabulIso(value) { const raw = String(value || '').trim(); if (!raw) throw new Error('Choose the shift date and time.'); const normalized = raw.length === 16 ? `${raw}:00` : raw; const date = new Date(`${normalized}+04:30`); if (Number.isNaN(date.getTime())) throw new Error('The Afghanistan shift date/time is invalid.'); return date.toISOString(); }
function statusClass(value) { const key = String(value || '').toLowerCase(); if (['active','approved','open','delivered','resolved','enabled'].includes(key)) return 'badge-active'; if (['pending','reviewing','waitlisted','new','preparing','monitoring','assigned','accepted','on_the_way'].includes(key)) return 'badge-pending'; if (['inactive','suspended','rejected','cancelled','paused','failed','closed'].includes(key)) return 'badge-suspended'; return 'badge-neutral'; }
function badge(value) { return `<span class="badge ${statusClass(value)}">${esc(String(value || 'unknown').replaceAll('_', ' '))}</span>`; }
function title(value) { return String(value || '').replace(/\b\w/g, char => char.toUpperCase()); }
function openPrivateRiderDocument(doc){
  if(!doc?.base64||!doc?.mime_type)throw new Error('Private document content is unavailable.');
  const binary=atob(doc.base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:doc.mime_type}));
  const opened=window.open(url,'_blank','noopener,noreferrer');
  if(!opened)toast('Allow pop-ups for the admin site to open this private document.','error');
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}

async function request(path, input, method = 'GET', authenticated = true) {
  const headers = { Accept: 'application/json' };
  if (authenticated && state.token) headers.Authorization = `Bearer ${state.token}`;
  let url = `${API_BASE}/api/trpc/${path}`;
  const options = { method, headers };
  if (method === 'GET') url += `?input=${encodeURIComponent(JSON.stringify({ json: input ?? null }))}`;
  else { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({ json: input ?? {} }); }
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch { throw new Error(raw || `Request failed (${response.status})`); }
  if (!response.ok || payload?.error) {
    const message = payload?.error?.json?.message || payload?.error?.message || `Request failed (${response.status})`;
    if (response.status === 401 || response.status === 403) logout(false);
    throw new Error(message);
  }
  return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
}
const query = (path, input) => request(path, input, 'GET');
const mutate = (path, input) => request(path, input, 'POST');

function setNotice(message, type = 'error') { notice.className = `notice notice-${type}`; notice.textContent = message; notice.classList.remove('hidden'); }
function clearNotice() { notice.className = 'notice hidden'; notice.textContent = ''; }
function toast(message, type = 'success') { const region = document.getElementById('toast-region'); const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message; region.appendChild(item); window.setTimeout(() => item.remove(), 4200); }
function loading(label = 'Loading control data…') { root.innerHTML = `<div class="loading-panel"><span class="spinner"></span><p>${esc(label)}</p></div>`; }
function openConfirm(titleText, copy, callback, danger = true) { document.getElementById('confirm-title').textContent = titleText; document.getElementById('confirm-copy').textContent = copy; document.getElementById('confirm-action').className = `button ${danger ? 'button-danger' : 'button-primary'}`; state.confirmCallback = callback; dialog.showModal(); }
dialog.addEventListener('close', async () => { const callback = state.confirmCallback; state.confirmCallback = null; if (dialog.returnValue !== 'confirm' || !callback) return; try { await callback(); } catch (error) { setNotice(error.message || 'The requested control change could not be completed.'); } });

function saveSession(token, user) { state.token = token; state.user = user; sessionStorage.setItem(TOKEN_KEY, token); sessionStorage.setItem(USER_KEY, JSON.stringify(user)); }
function logout(show = true) { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); state.token = ''; state.user = null; state.cache = {}; state.invite = null; appShell.classList.add('hidden'); loginView.classList.remove('hidden'); if (show) toast('You have been signed out.', 'success'); }
function userLabel() { return state.user?.name || state.user?.username || state.user?.email || 'Administrator'; }
function currentRole(){ return String(state.user?.role || '').toLowerCase(); }
function isFullAdmin(){ return FULL_ADMIN_ROLES.has(currentRole()); }
function allowedViews(){
  const role=currentRole();
  if(FULL_ADMIN_ROLES.has(role)) return new Set(Object.keys(VIEW_META));
  if(role==='restaurant_staff') return new Set(['restaurants','security']);
  if(role==='rider_staff') return new Set(['riders','security']);
  if(role==='operations_staff') return new Set(['restaurants','riders','security']);
  return new Set();
}
function defaultView(){
  const role=currentRole();
  if(role==='rider_staff')return 'riders';
  if(role==='restaurant_staff'||role==='operations_staff')return 'restaurants';
  return 'overview';
}
function canView(view){ return allowedViews().has(view); }
function applyRoleNavigation(){
  const allowed=allowedViews();
  document.querySelectorAll('#primary-nav a').forEach(link=>link.classList.toggle('hidden',!allowed.has(link.dataset.view)));
}
function setShell() { loginView.classList.add('hidden'); appShell.classList.remove('hidden'); document.getElementById('admin-name').textContent = userLabel(); document.getElementById('admin-role').textContent = title(String(state.user?.role || 'administrator').replaceAll('_',' ')); document.getElementById('admin-initial').textContent = userLabel().slice(0, 1).toUpperCase(); applyRoleNavigation(); }

const VIEW_META = {
  overview: ['Marketplace control', 'Overview'],
  dispatch: ['Live operations', 'Orders & dispatch'],
  restaurants: ['Partner operations', 'Restaurants'],
  riders: ['Delivery operations', 'Riders'],
  customers: ['Customer operations', 'Customers & rewards'],
  promotions: ['Commercial operations', 'Promotions'],
  communications: ['Customer operations', 'Communications'],
  support: ['Customer operations', 'Customer support'],
  access: ['Identity & access', 'Portal access'],
  security: ['Identity & access', 'Administrator security'],
  audit: ['Governance', 'Operations audit'],
  ops: ['Support & governance', 'Support & operations'],
  careers: ['People operations', 'Careers'],
  website: ['Public-site control', 'Website reliability'],
};

function setActiveNav() { document.querySelectorAll('#primary-nav a').forEach(link => link.classList.toggle('active', link.dataset.view === state.view)); const meta = VIEW_META[state.view] || VIEW_META.overview; document.getElementById('page-kicker').textContent = meta[0]; document.getElementById('page-title').textContent = meta[1]; }
function setView(view) { const requested=VIEW_META[view] ? view : defaultView(); state.view=canView(requested)?requested:defaultView(); if (location.hash.slice(1) !== state.view) history.replaceState(null, '', `#${state.view}`); setActiveNav(); clearNotice(); renderView(); }

async function verifySession() {
  if (!state.token) return false;
  const user = await query('auth.me', null);
  if (!ALLOWED_ROLES.has(String(user?.role || '').toLowerCase())) throw new Error('This account does not have authorized Control Center access.');
  state.user = user; sessionStorage.setItem(USER_KEY, JSON.stringify(user)); applyRoleNavigation(); return true;
}


async function handleGoogleStaffCredential(response) {
  const error = document.getElementById('login-error');
  error.className = 'notice hidden';
  error.textContent = '';
  try {
    const result = await request('auth.googleStaffSignIn', { credential: String(response?.credential || '') }, 'POST', false);
    if (result?.status === 'approved' && result?.token) {
      saveSession(result.token, result.admin || {});
      await verifySession();
      setShell();
      setView(location.hash.slice(1) || 'overview');
      return;
    }
    error.textContent = result?.message || 'Your staff access request is pending administrator approval.';
    error.className = result?.status === 'rejected' ? 'notice notice-error' : 'notice notice-success';
  } catch (err) {
    error.textContent = err.message || 'Google staff sign-in failed.';
    error.className = 'notice notice-error';
  }
}
window.handleGoogleStaffCredential = handleGoogleStaffCredential;

async function initGoogleStaffSignIn(attempt = 0) {
  const mount = document.getElementById('google-staff-signin');
  if (!mount || state.token) return;
  if (!window.google?.accounts?.id) {
    if (attempt < 20) window.setTimeout(() => initGoogleStaffSignIn(attempt + 1), 250);
    return;
  }
  try {
    const config = await request('identity.googleConfig', null, 'GET', false);
    const clientId = config?.webClientId || config?.clientId;
    if (!clientId) return;
    mount.innerHTML = '';
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleStaffCredential, auto_select: false, cancel_on_tap_outside: true });
    window.google.accounts.id.renderButton(mount, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 });
  } catch (err) {
    mount.innerHTML = '<small>Google staff sign-in is temporarily unavailable. Username/password sign-in remains available.</small>';
  }
}

async function renderView() {
  loading();
  try {
    if (state.view === 'overview') await renderOverview();
    if (state.view === 'dispatch') await renderDispatch();
    if (state.view === 'restaurants') await renderRestaurants();
    if (state.view === 'riders') await renderRiders();
    if (state.view === 'customers') await renderCustomers();
    if (state.view === 'promotions') await renderPromotionsView();
    if (state.view === 'communications') await renderCommunicationsView();
    if (state.view === 'support') await renderSupportView();
    if (state.view === 'security') await renderSecurityView();
    if (state.view === 'audit') await renderAuditView();
    if (state.view === 'ops') await renderOperationsTools();
    if (state.view === 'access') await renderAccess();
    if (state.view === 'careers') await renderCareers();
    if (state.view === 'website') await renderWebsite();
  } catch (error) {
    root.innerHTML = `<section class="panel"><div class="panel-body"><div class="notice notice-error">${esc(error.message || 'The control data could not be loaded.')} </div><button class="button button-secondary" type="button" data-action="refresh-view">Try again</button></div></section>`;
  }
}

async function overviewData() {
  const result = await Promise.allSettled([
    query('orders.adminList', { limit: 25, offset: 0 }),
    query('operations.adminPartnerApplications', { limit: 100 }),
    query('operations.adminRiderApplications', { limit: 100 }),
    query('operations.adminRiders', { availableOnly: false }),
    query('platform.adminStatus', null),
    query('riderOperations.adminBoard', null),
    query('dispatch.adminSettings', null),
  ]);
  const get = index => result[index].status === 'fulfilled' ? result[index].value : null;
  return { orders: asArray(get(0)), partners: asArray(get(1)), riderApps: asArray(get(2)), riders: asArray(get(3)), platform: get(4) || { controls: {}, incidents: [] }, riderBoard: get(5) || { availability: [], riders: [] }, dispatch: get(6) || {} };
}

async function renderOverview() {
  const data = await overviewData(); state.cache.overview = data;
  const activeOrders = data.orders.filter(item => !['delivered','cancelled','failed'].includes(item.status)).length;
  const pendingPartners = data.partners.filter(item => ['pending','reviewing'].includes(item.status)).length;
  const pendingRiders = data.riderApps.filter(item => ['pending','reviewing'].includes(item.status)).length;
  const eligibleRiders = asArray(data.riderBoard.riders).filter(item => item.status === 'active' && item.isAvailable && item.shiftActive && !item.busy).length;
  const pendingAvailability = asArray(data.riderBoard.availability).filter(item => item.status === 'pending').length;
  const controls = data.platform.controls || {};
  const marketOpen = controls.ordering_enabled !== false;
  const autoDispatch = Boolean(data.dispatch.auto_dispatch_enabled);
  const incidents = asArray(data.platform.incidents).filter(item => item.status !== 'resolved');
  root.innerHTML = `
    <div class="metric-grid">
      ${metric('Live orders', activeOrders, 'Orders still in progress')}
      ${metric('Partner queue', pendingPartners, 'Restaurant applications to review')}
      ${metric('Rider availability', pendingAvailability, 'Requests waiting for approval')}
      ${metric('Eligible riders', eligibleRiders, 'On shift, available and free')}
    </div>
    <div class="content-grid">
      <section class="panel"><div class="panel-head"><div><h2>Marketplace master control</h2><p>This is the final server-enforced market switch.</p></div>${badge(marketOpen ? 'open' : 'paused')}</div><div class="panel-body"><div class="safety-card"><strong>${marketOpen ? 'Afghan Eats is OPEN for new orders' : 'Afghan Eats is CLOSED for new orders'}</strong><p>${marketOpen ? 'Customer checkout can create new orders.' : esc(controls.ordering_message_en || 'New checkout is paused; active orders keep running.')}</p></div><div class="button-stack space-top-sm"><button class="button ${marketOpen ? 'button-danger' : 'button-primary'}" type="button" data-action="market-toggle" data-open="${marketOpen ? 'false' : 'true'}">${marketOpen ? 'Close market' : 'Open market'}</button><a class="button button-secondary" href="#website">Service banner settings</a></div></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Automatic rider assignment</h2><p>Only free riders inside an active approved shift are eligible.</p></div>${badge(autoDispatch ? 'enabled' : 'paused')}</div><div class="panel-body"><div class="safety-card"><strong>${autoDispatch ? 'Automatic dispatch is ON' : 'Automatic dispatch is OFF'}</strong><p>Acceptance window: ${number(data.dispatch.acceptance_timeout_seconds || 180)} seconds. Unanswered jobs can be reassigned according to dispatch policy.</p></div><button class="button ${autoDispatch ? 'button-danger' : 'button-primary'} space-top-sm" type="button" data-action="auto-dispatch-toggle" data-enabled="${autoDispatch ? 'false' : 'true'}">${autoDispatch ? 'Turn off automatic dispatch' : 'Turn on automatic dispatch'}</button></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Active order queue</h2><p>Review and assign active marketplace orders.</p></div><a class="button button-secondary button-small" href="#dispatch">Open dispatch</a></div><div class="panel-body">${ordersTable(data.orders.slice(0, 7), false)}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Public service state</h2><p>Incidents and public notices.</p></div><a class="button button-secondary button-small" href="#website">Manage</a></div><div class="panel-body"><div class="activity-list">${incidents.length ? incidents.slice(0,4).map(incidentRow).join('') : '<div class="empty-state">No active public incidents.</div>'}</div></div></section>
    </div>`;
}
function metric(label, value, note) { return `<article class="metric-card"><small>${esc(label)}</small><strong>${number(value)}</strong><span>${esc(note)}</span></article>`; }
function incidentRow(item) { return `<div class="activity-row"><i class="activity-dot"></i><div><p><strong>${esc(item.title_en || item.title || 'Service incident')}</strong> ${badge(item.severity || 'info')}</p><small>${esc(item.status || 'open')} · ${shortDate(item.started_at)}</small></div></div>`; }

async function dispatchData() {
  const [ordersData, riders, assignments] = await Promise.all([
    query('orders.adminList', { limit: 100, offset: 0 }),
    query('operations.adminRiders', { availableOnly: false }),
    query('operations.adminAssignments', { limit: 100 }),
  ]);
  return { orders: asArray(ordersData), riders: asArray(riders), assignments: asArray(assignments) };
}
async function renderDispatch() {
  const data = await dispatchData(); state.cache.dispatch = data;
  const assignmentsByOrder = new Map(data.assignments.map(item => [String(item.order_id), item]));
  const active = data.orders.filter(item => !['delivered','cancelled','failed'].includes(item.status));
  const closed = data.orders.filter(item => ['delivered','cancelled','failed'].includes(item.status));
  root.innerHTML = `<p class="section-intro">Manage live order assignment and delivery progress. Manual selection shows only riders who are active, inside an approved shift, marked available and free of another delivery.</p>
    <section class="panel"><div class="panel-head"><div><h2>Live dispatch board</h2><p>${number(active.length)} active order${active.length === 1 ? '' : 's'} · ${number(data.riders.filter(r => r.status === 'active' && r.is_available && r.shift_active && !r.busy).length)} dispatch-eligible riders</p></div></div><div class="panel-body">${active.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Order status</th><th>Rider & delivery</th><th>Control</th></tr></thead><tbody>${active.map(order => dispatchRow(order, data.riders, assignmentsByOrder.get(String(order.id)))).join('')}</tbody></table></div>` : '<div class="empty-state">There are no active orders awaiting dispatch.</div>'}</div></section>
    <section class="panel space-top-md"><div class="panel-head"><div><h2>Recent order history</h2><p>Completed, cancelled and failed orders remain visible for operational review.</p></div></div><div class="panel-body">${ordersTable(closed, false)}</div></section>
    <section class="panel space-top-md"><div class="panel-head"><div><h2>All recent delivery assignments</h2><p>This preserves the former Operations assignment board, including completed and cancelled assignments.</p></div></div><div class="panel-body">${assignmentHistoryTable(data.assignments)}</div></section>`;
}
function dispatchRow(order, riders, assignment) {
  const activeRiders = riders.filter(rider => rider.status === 'active' && rider.is_available && rider.shift_active && !rider.busy);
  const riderOptions = activeRiders.map(rider => `<option value="${attr(rider.id)}">${esc(rider.full_name)} · on shift · available</option>`).join('');
  const assignmentStatuses = ['assigned','accepted','at_restaurant','picked_up','on_the_way','delivered','cancelled'];
  const control = assignment ? `<div class="button-stack"><select class="inline-select" data-assignment-status="${attr(assignment.id)}">${assignmentStatuses.map(status => `<option value="${status}" ${assignment.status === status ? 'selected' : ''}>${esc(status.replaceAll('_',' '))}</option>`).join('')}</select><button class="button button-primary button-small" type="button" data-action="update-assignment" data-id="${attr(assignment.id)}">Update</button></div>` : `<div class="button-stack"><select class="inline-select" data-order-rider="${attr(order.id)}"><option value="">Choose rider</option>${riderOptions}</select><button class="button button-primary button-small" type="button" data-action="assign-rider" data-id="${attr(order.id)}">Assign</button></div>`;
  return `<tr><td><span class="row-title">${esc(order.order_number || order.id)}</span><span class="row-sub">${money(order.total)}</span></td><td>${esc(order.customer_name || 'Customer')}<span class="row-sub">${esc(order.customer_phone || 'No phone')} · ${esc(order.delivery_address || 'No delivery address')}</span></td><td>${badge(order.status)}</td><td>${assignment ? `<span class="row-title">${esc(assignment.rider_name || 'Assigned rider')}</span><span class="row-sub">${badge(assignment.status)}</span>` : '<span class="row-sub">Unassigned</span>'}</td><td>${control}</td></tr>`;
}

function assignmentHistoryTable(items) {
  const statuses=['assigned','accepted','at_restaurant','picked_up','on_the_way','delivered','cancelled'];
  return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Rider</th><th>Delivery address</th><th>Status</th><th>Control</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.order_number || item.order_id || 'Order')}</span></td><td>${esc(item.rider_name || 'Unassigned')}</td><td>${esc(item.delivery_address || '—')}</td><td>${badge(item.status)}</td><td><div class="button-stack"><select class="inline-select" data-assignment-status="${attr(item.id)}">${statuses.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${esc(status.replaceAll('_',' '))}</option>`).join('')}</select><button class="button button-primary button-small" type="button" data-action="update-assignment" data-id="${attr(item.id)}">Update</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No delivery assignments have been created yet.</div>';
}

async function restaurantData() { const [restaurants, partners, accounts, setupSubmissions] = await Promise.all([query('restaurants.adminList', { limit: 100 }), query('operations.adminPartnerApplications', { limit: 100 }), isFullAdmin()?query('portal.adminAccounts', null):Promise.resolve([]), query('portal.adminSetupSubmissions', { status: 'submitted' })]); return { restaurants: asArray(restaurants), partners: asArray(partners), accounts: asArray(accounts), setupSubmissions: asArray(setupSubmissions) }; }
function reviewLine(label,value,options={}){const safe=value===null||value===undefined||String(value).trim()===''?'Not provided':String(value);return `<div class="setup-review-field"><small>${esc(label)}</small><strong ${options.dir?`dir="${attr(options.dir)}"`:''}>${esc(safe)}</strong></div>`}
function reviewBool(label,value){return `<div class="setup-review-field"><small>${esc(label)}</small><strong>${value?'<span class="review-yes">✓ Enabled</span>':'<span class="review-no">Not enabled</span>'}</strong></div>`}
function setupReviewMenu(snapshot){const menu=snapshot?.menu||{},categories=Array.isArray(menu.categories)?menu.categories:[],items=Array.isArray(menu.items)?menu.items:[],names=new Map(categories.map(cat=>[String(cat.id),cat]));if(!items.length)return '<div class="empty-state setup-review-empty">No menu items were included in this submission.</div>';const groups=new Map();for(const item of items){const key=String(item.category_id||'uncategorized');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}return [...groups.entries()].map(([key,group])=>{const category=names.get(key),label=category?(category.name_dari?`${category.name} / ${category.name_dari}`:category.name):'Uncategorized';return `<section class="setup-menu-category"><div class="setup-menu-category-head"><h4>${esc(label)}</h4><span>${number(group.length)} item${group.length===1?'':'s'}</span></div><div class="setup-review-menu-grid">${group.map(item=>{const image=/^https:\/\//i.test(String(item.image_url||''))?`<img src="${attr(item.image_url)}" alt="">`:'<div class="setup-review-menu-placeholder">AE</div>';const flags=[item.is_available!==false?'Available':'Unavailable',item.is_popular?'Popular':'',item.is_vegetarian?'Vegetarian':'',item.is_spicy?'Spicy':''].filter(Boolean);return `<article class="setup-review-menu-item">${image}<div><h5>${esc(item.name||'Unnamed item')}</h5>${item.name_dari?`<p class="setup-dari" dir="rtl">${esc(item.name_dari)}</p>`:''}<p>${esc(item.description||'No English description')}${item.description_dari?`<br><span class="setup-dari" dir="rtl">${esc(item.description_dari)}</span>`:''}</p><div class="setup-menu-meta"><strong>${money(item.price)}</strong><span>${flags.map(flag=>`<i>${esc(flag)}</i>`).join('')}</span></div></div></article>`}).join('')}</div></section>`}).join('')}
function setupReviewWorkspace(item){if(!item)return'';const snapshot=item.snapshot||{},r=snapshot.restaurant||{},hours=r.opening_hours&&typeof r.opening_hours==='object'?r.opening_hours:{},days=[['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']],ownerName=item.registered_owner_name||r.owner_name||'Not provided',ownerEmail=item.registered_owner_email||r.owner_email||item.restaurant_email||r.email||'Not provided',ownerPhone=item.registered_owner_phone||r.owner_phone||r.phone||item.restaurant_phone||'Not provided',whatsapp=item.restaurant_whatsapp||r.whatsapp_number||'Not provided',logo=/^https:\/\//i.test(String(r.logo_url||''))?r.logo_url:'',cover=/^https:\/\//i.test(String(r.cover_image_url||''))?r.cover_image_url:'';
return `<section id="owner-setup-review-workspace" class="panel wide setup-review-workspace">
  <div class="setup-review-toolbar"><button class="button button-secondary button-small" type="button" data-action="close-owner-setup-review">← Back to review queue</button><div><span class="eyebrow">Frozen owner submission</span><h2>${esc(item.restaurant_name||r.name||'Restaurant setup')}</h2><p>Review exactly what the owner submitted before making the final marketplace decision.</p></div>${badge('submitted')}</div>
  <div class="setup-review-body">
    <section class="setup-review-section setup-review-owner"><div class="setup-review-section-head"><div><span class="setup-review-number">1</span><div><h3>Owner & submission</h3><p>Account and registration details linked to this submitted setup.</p></div></div></div>
      <div class="setup-review-fields">${reviewLine('Owner name',ownerName)}${reviewLine('Verified email',ownerEmail,{dir:'ltr'})}${reviewLine('Owner phone',ownerPhone,{dir:'ltr'})}${reviewLine('WhatsApp',whatsapp,{dir:'ltr'})}${reviewLine('Portal username',item.owner_username||'Not provided',{dir:'ltr'})}${reviewLine('Submitted',afghanDate(item.submitted_at||item.created_at))}</div>
      ${item.owner_note?`<div class="setup-owner-note"><b>Owner note</b><p>${esc(item.owner_note)}</p></div>`:''}
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">2</span><div><h3>Restaurant profile</h3><p>Names, description, address and contact information submitted for the public listing.</p></div></div></div>
      <div class="setup-review-fields">${reviewLine('Restaurant name — English',r.name)}${reviewLine('Restaurant name — Dari',r.name_dari)}${reviewLine('District',r.district)}${reviewLine('Neighborhood',r.neighborhood)}${reviewLine('Restaurant phone',r.phone,{dir:'ltr'})}${reviewLine('Restaurant email',r.email||item.restaurant_email,{dir:'ltr'})}</div>
      <div class="setup-review-copy-grid"><div><small>Description — English</small><p>${esc(r.description||'Not provided')}</p></div><div dir="rtl"><small>توضیحات دری</small><p>${esc(r.description_dari||'ارائه نشده')}</p></div><div><small>Street address — English</small><p>${esc(r.address||'Not provided')}</p></div><div dir="rtl"><small>آدرس دری</small><p>${esc(r.address_dari||'ارائه نشده')}</p></div></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">3</span><div><h3>Branding & images</h3><p>Review the exact logo and cover image that will represent the restaurant.</p></div></div></div>
      <div class="setup-review-media"><article><small>Restaurant logo</small>${logo?`<img src="${attr(logo)}" alt="Submitted restaurant logo"><a href="${attr(logo)}" target="_blank" rel="noopener">Open full image ↗</a>`:'<div class="setup-review-image-missing">No logo submitted</div>'}</article><article><small>Cover image</small>${cover?`<img src="${attr(cover)}" alt="Submitted restaurant cover image"><a href="${attr(cover)}" target="_blank" rel="noopener">Open full image ↗</a>`:'<div class="setup-review-image-missing">No cover submitted</div>'}</article></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">4</span><div><h3>Opening hours</h3><p>Weekly hours submitted by the restaurant owner.</p></div></div></div>
      <div class="setup-review-hours">${days.map(([key,label])=>`<div><span>${label}</span><strong dir="ltr">${esc(hours[key]||'Not provided')}</strong></div>`).join('')}</div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">5</span><div><h3>Delivery, pickup & commercial settings</h3><p>Customer fulfilment, timing, fee and minimum-order settings.</p></div></div></div>
      <div class="setup-review-fields">${reviewBool('Delivery enabled',Boolean(r.has_delivery))}${reviewBool('Pickup enabled',Boolean(r.has_takeaway))}${reviewLine('Delivery ETA minimum',r.delivery_time_min!=null?`${r.delivery_time_min} min`:'Not provided')}${reviewLine('Delivery ETA maximum',r.delivery_time_max!=null?`${r.delivery_time_max} min`:'Not provided')}${reviewLine('Delivery fee',r.delivery_fee_min!=null?money(r.delivery_fee_min):'Not provided')}${reviewLine('Minimum order',r.min_order_amount!=null?money(r.min_order_amount):'Not provided')}</div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">6</span><div><h3>Submitted menu</h3><p>Categories, items, descriptions, prices, availability and dish images included in this submission.</p></div></div><span class="setup-review-count">${number(Array.isArray(snapshot.menu?.items)?snapshot.menu.items.length:0)} items</span></div>
      ${setupReviewMenu(snapshot)}
    </section>

    <section class="setup-review-section setup-review-decision"><div class="setup-review-section-head"><div><span class="setup-review-number">7</span><div><h3>Administrator decision</h3><p>Record your review. Request changes when anything above is incomplete, inaccurate or unsuitable for customers.</p></div></div></div>
      <label class="field"><span>Review note for restaurant owner</span><textarea data-setup-review-note="${attr(item.id)}" maxlength="3000" rows="4" placeholder="Required when requesting changes. Add approval notes when useful."></textarea></label>
      <div class="setup-review-decision-bar"><div><b>Final approval activates the public listing.</b><small>Only approve after reviewing every section above.</small></div><div class="button-stack"><button class="button button-secondary" type="button" data-action="review-owner-setup" data-id="${attr(item.id)}" data-name="${attr(item.restaurant_name||r.name||'this restaurant')}" data-decision="changes_requested">Request changes</button><button class="button button-primary" type="button" data-action="review-owner-setup" data-id="${attr(item.id)}" data-name="${attr(item.restaurant_name||r.name||'this restaurant')}" data-decision="approved">Approve & activate listing</button></div></div>
    </section>
  </div>
</section>`}
async function renderRestaurants() {
  const data = await restaurantData(); state.cache.restaurants = data;
  const selected=data.setupSubmissions.find(item=>String(item.id)===String(state.setupReviewId||''))||null;
  const listPartner=data.partners.find(item=>String(item.id)===String(state.partnerReviewId||''))||null;
  const selectedPartner=state.partnerReviewDetail?.application||listPartner;
  const editing=data.restaurants.find(item=>String(item.id)===String(state.restaurantEditId||''))||null;
  if(state.setupReviewId&&!selected)state.setupReviewId=null;
  if(state.partnerReviewId&&!selectedPartner){state.partnerReviewId=null;state.partnerReviewDetail=null;}
  if(state.restaurantEditId&&!editing)state.restaurantEditId=null;
  root.innerHTML = `<p class="section-intro">Manage restaurant applications, listings and operational details. Staff access is limited to restaurant workflows; platform security and customer controls remain restricted.</p><div class="section-grid">
    ${selectedPartner?partnerApplicationReviewWorkspace(state.partnerReviewDetail||selectedPartner):''}
    ${selected?setupReviewWorkspace(selected):''}
    ${editing?`<section id="restaurant-edit-panel" class="panel wide"><div class="panel-head"><div><h2>Edit restaurant</h2><p>Update public identity, contacts, delivery settings and images for ${esc(editing.name)}.</p></div><button class="button button-secondary button-small" type="button" data-action="cancel-restaurant-edit">Cancel</button></div><div class="panel-body">${restaurantEditForm(editing)}</div></section>`:''}
    <section class="panel wide"><div class="panel-head"><div><h2>Owner setup review queue</h2><p>${number(data.setupSubmissions.length)} complete owner setup${data.setupSubmissions.length === 1 ? '' : 's'} awaiting a decision.</p></div></div><div class="panel-body">${setupReviewTable(data.setupSubmissions)}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Restaurant listings</h2><p>Add a safe inactive draft, edit details, or control marketplace listing status.</p></div><button class="button button-primary button-small" type="button" data-action="open-restaurant-create">Add restaurant</button></div><div class="panel-body">${restaurantTable(data.restaurants)}</div></section>
    <section id="restaurant-create-panel" class="panel wide hidden"><div class="panel-head"><div><h2>Add restaurant</h2><p>New restaurants start inactive and closed until operational setup is complete.</p></div><button class="button button-secondary button-small" type="button" data-action="cancel-restaurant-create">Cancel</button></div><div class="panel-body">${restaurantCreateForm()}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Restaurant applications</h2><p>Open the complete dossier before making an onboarding decision.</p></div></div><div class="panel-body">${applicationTable(data.partners, 'partner')}</div></section>
    ${isFullAdmin()?`<section class="panel"><div class="panel-head"><div><h2>Owner portal readiness</h2><p>Approved owners and their portal activation state.</p></div></div><div class="panel-body">${ownerReadiness(data.accounts)}</div></section>`:''}
  </div>`;
}
function restaurantTable(items) { return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Restaurant</th><th>Location</th><th>Listing</th><th>Store</th><th>Control</th></tr></thead><tbody>${items.map(item => { const awaitingOwnerApproval=item.status !== 'active' && item.source_type === 'owner_submitted'; const listing=item.status === 'active' ? `<button class="button button-danger button-small" type="button" data-action="remove-restaurant" data-id="${attr(item.id)}" data-name="${attr(item.name)}">Remove from marketplace</button>` : awaitingOwnerApproval ? `<span class="row-sub">Owner setup approval required</span>` : `<button class="button button-primary button-small" type="button" data-action="toggle-listing" data-id="${attr(item.id)}" data-status="active">Restore listing</button>`; return `<tr><td><span class="row-title">${esc(item.name)}</span><span class="row-sub">${esc(item.category_primary || (item.cuisine_tags || []).join(', ') || 'Restaurant')}</span></td><td>${esc(item.district || item.neighborhood || 'Herat')}</td><td>${badge(item.status)}</td><td>${item.is_open ? badge('open') : badge('closed')}</td><td><div class="button-stack"><button class="button button-secondary button-small" type="button" data-action="edit-restaurant" data-id="${attr(item.id)}">Edit details</button>${listing}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-state">No restaurants were returned by the platform. Use “Add restaurant” to create the first inactive listing.</div>'; }
function setupReviewTable(items) { return items.length ? `<div class="activity-list">${items.map(item => { const snapshot=item.snapshot||{}, restaurant=snapshot.restaurant||{}, menu=snapshot.menu||{}, menuCount=Array.isArray(menu.items)?menu.items.length:0, eta=restaurant.delivery_time_min != null && restaurant.delivery_time_max != null ? `${restaurant.delivery_time_min}–${restaurant.delivery_time_max} min` : 'Not provided', owner=item.registered_owner_name||restaurant.owner_name||item.owner_username||'Owner'; return `<article class="review-card ${String(state.setupReviewId)===String(item.id)?'selected':''}"><div class="review-card-head"><div><h3>${esc(item.restaurant_name || restaurant.name || 'Restaurant')}</h3><p>${esc(owner)} · ${esc(item.registered_owner_email||restaurant.owner_email||'No owner email')} · submitted ${shortDate(item.submitted_at || item.created_at)}</p></div>${badge('submitted')}</div><div class="review-detail-grid"><span><b>Address</b>${esc(restaurant.address || 'Not provided')}${restaurant.district ? ` · ${esc(restaurant.district)}` : ''}</span><span><b>Contact</b>${esc(restaurant.phone || item.restaurant_phone || 'Not provided')}</span><span><b>Delivery</b>${esc(eta)} · ${restaurant.delivery_fee_min != null ? `${money(restaurant.delivery_fee_min)} fee` : 'No fee'}</span><span><b>Menu</b>${number(menuCount)} submitted item${menuCount === 1 ? '' : 's'}</span></div><div class="review-card-action"><span class="row-sub">Approval is available only inside the full submitted-snapshot review.</span><button class="button button-primary button-small" type="button" data-action="open-owner-setup-review" data-id="${attr(item.id)}">Review details</button></div></article>`; }).join('')}</div>` : '<div class="empty-state">No restaurant owner setups are awaiting review.</div>'; }
function checked(value){ return value ? 'checked' : ''; }
function restaurantFields(item={}){
  const tags=Array.isArray(item.cuisine_tags)?item.cuisine_tags.join(', '):(item.category_primary||'');
  return `
    <label class="field"><span>Restaurant name — English</span><input name="name" required maxlength="200" value="${attr(item.name||'')}" autocomplete="organization"></label>
    <label class="field"><span>Restaurant name — Dari</span><input name="nameDari" dir="rtl" maxlength="200" value="${attr(item.name_dari||'')}"></label>
    <label class="field full"><span>Description</span><textarea name="description" maxlength="4000" rows="3">${esc(item.description||'')}</textarea></label>
    <label class="field"><span>Category / cuisine</span><input name="category" maxlength="300" value="${attr(tags)}" placeholder="Afghan, Kebab, Pizza"></label>
    <label class="field"><span>Phone</span><input name="phone" type="tel" maxlength="50" value="${attr(item.phone||'')}"></label>
    <label class="field"><span>WhatsApp</span><input name="whatsapp" type="tel" maxlength="50" value="${attr(item.whatsapp_number||'')}"></label>
    <label class="field"><span>Email</span><input name="email" type="email" maxlength="320" value="${attr(item.email||'')}"></label>
    <label class="field full"><span>Address</span><input name="address" maxlength="1000" value="${attr(item.address||'')}"></label>
    <label class="field"><span>District</span><input name="district" maxlength="100" value="${attr(item.district||'')}" placeholder="Herat City"></label>
    <label class="field"><span>Neighborhood</span><input name="neighborhood" maxlength="100" value="${attr(item.neighborhood||'')}"></label>
    <label class="field"><span>Instagram URL</span><input name="instagramUrl" type="url" maxlength="2000" value="${attr(item.instagram_url||'')}" placeholder="https://…"></label>
    <label class="field"><span>Facebook URL</span><input name="facebookUrl" type="url" maxlength="2000" value="${attr(item.facebook_url||'')}" placeholder="https://…"></label>
    <label class="field"><span>Website URL</span><input name="websiteUrl" type="url" maxlength="2000" value="${attr(item.website_url||'')}" placeholder="https://…"></label>
    <label class="field"><span>Delivery time minimum (minutes)</span><input name="deliveryTimeMin" type="number" min="0" max="600" step="1" value="${attr(item.delivery_time_min??'')}"></label>
    <label class="field"><span>Delivery time maximum (minutes)</span><input name="deliveryTimeMax" type="number" min="0" max="600" step="1" value="${attr(item.delivery_time_max??'')}"></label>
    <label class="field"><span>Delivery fee minimum (AFN)</span><input name="deliveryFeeMin" type="number" min="0" max="100000" step="1" value="${attr(item.delivery_fee_min??'')}"></label>
    <label class="field"><span>Delivery fee maximum (AFN)</span><input name="deliveryFeeMax" type="number" min="0" max="100000" step="1" value="${attr(item.delivery_fee_max??'')}"></label>
    <label class="field"><span>Minimum order (AFN)</span><input name="minOrder" type="number" min="0" max="1000000" step="1" value="${attr(item.min_order_amount??'')}"></label>
    <label class="field"><span>Logo image URL</span><input name="logoUrl" type="url" maxlength="2000" value="${attr(item.logo_url||'')}" placeholder="https://…"></label>
    <label class="field"><span>Cover image URL</span><input name="coverUrl" type="url" maxlength="2000" value="${attr(item.cover_image_url||'')}" placeholder="https://…"></label>
    <label class="switch-row"><span><b>Delivery available</b><small>Restaurant can receive delivery orders.</small></span><span class="switch"><input name="hasDelivery" type="checkbox" ${checked(item.has_delivery!==false)}><span></span></span></label>
    <label class="switch-row"><span><b>Dine-in available</b><small>Show dine-in as an option.</small></span><span class="switch"><input name="hasDineIn" type="checkbox" ${checked(Boolean(item.has_dine_in))}><span></span></span></label>
    <label class="switch-row"><span><b>Takeaway available</b><small>Show pickup as an option.</small></span><span class="switch"><input name="hasTakeaway" type="checkbox" ${checked(Boolean(item.has_takeaway))}><span></span></span></label>
    <label class="field full"><span>Internal operations notes</span><textarea name="internalNotes" maxlength="4000" rows="2">${esc(item.internal_notes||'')}</textarea></label>`;
}
function restaurantCreateForm() { return `<form id="restaurant-create-form" class="form-grid">${restaurantFields({has_delivery:true})}<div class="safety-card full"><strong>Created safely as a draft</strong><p>The restaurant will be inactive and closed by default. It will not accept customer orders until the listing is intentionally activated.</p></div><button class="button button-primary full" type="submit">Create inactive restaurant</button></form>`; }
function restaurantEditForm(item) { return `<form id="restaurant-edit-form" class="form-grid"><input type="hidden" name="restaurantId" value="${attr(item.id)}">${restaurantFields(item)}<div class="safety-card full"><strong>Listing state is preserved</strong><p>Saving these details does not automatically activate or remove the restaurant. Use the listing controls separately.</p></div><button class="button button-primary full" type="submit">Save restaurant changes</button></form>`; }
function restaurantFormPayload(form,d){
  const optionalNumber=value=>{const normalized=String(value??'').trim();return normalized===''?null:Number(normalized);};
  const category=String(d.get('category')||'').trim();
  const email=String(d.get('email')||'').trim();
  return {
    name:String(d.get('name')||'').trim(),
    name_dari:String(d.get('nameDari')||'').trim()||null,
    description:String(d.get('description')||'').trim()||null,
    category_primary:category||null,
    cuisine_tags:category.split(',').map(x=>x.trim()).filter(Boolean),
    phone:String(d.get('phone')||'').trim()||null,
    whatsapp_number:String(d.get('whatsapp')||'').trim()||null,
    email:email||null,
    address:String(d.get('address')||'').trim()||null,
    district:String(d.get('district')||'').trim()||null,
    neighborhood:String(d.get('neighborhood')||'').trim()||null,
    instagram_url:String(d.get('instagramUrl')||'').trim()||null,
    facebook_url:String(d.get('facebookUrl')||'').trim()||null,
    website_url:String(d.get('websiteUrl')||'').trim()||null,
    delivery_time_min:optionalNumber(d.get('deliveryTimeMin')),
    delivery_time_max:optionalNumber(d.get('deliveryTimeMax')),
    delivery_fee_min:optionalNumber(d.get('deliveryFeeMin')),
    delivery_fee_max:optionalNumber(d.get('deliveryFeeMax')),
    min_order_amount:optionalNumber(d.get('minOrder')),
    logo_url:String(d.get('logoUrl')||'').trim()||null,
    cover_image_url:String(d.get('coverUrl')||'').trim()||null,
    has_delivery:form.elements.hasDelivery.checked,
    has_dine_in:form.elements.hasDineIn.checked,
    has_takeaway:form.elements.hasTakeaway.checked,
    internal_notes:String(d.get('internalNotes')||'').trim()||null,
  };
}
function reviewLink(label,value){
  const safe=String(value||'').trim();
  return `<div class="setup-review-field"><small>${esc(label)}</small><strong>${safe&&/^https?:\/\//i.test(safe)?`<a class="dossier-link" href="${attr(safe)}" target="_blank" rel="noopener noreferrer">${esc(safe)} ↗</a>`:esc(safe||'Not provided')}</strong></div>`
}
function reviewList(label,values){
  const list=Array.isArray(values)?values.filter(value=>String(value||'').trim()):[];
  return reviewLine(label,list.length?list.join(' · '):'Not provided')
}
function dossierHours(restaurant){
  const hours=restaurant?.opening_hours&&typeof restaurant.opening_hours==='object'?restaurant.opening_hours:{};
  const days=[['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']];
  const hasHours=days.some(([key])=>String(hours[key]||'').trim());
  return hasHours?`<div class="setup-review-hours">${days.map(([key,label])=>`<div><span>${label}</span><strong dir="ltr">${esc(hours[key]||'Not provided')}</strong></div>`).join('')}</div>`:'<div class="empty-state dossier-empty">No structured weekly opening hours have been provided.</div>'
}
function dossierMedia(restaurant){
  const gallery=Array.isArray(restaurant?.gallery_images)?restaurant.gallery_images.filter(url=>/^https:\/\//i.test(String(url||''))):[];
  const logo=/^https:\/\//i.test(String(restaurant?.logo_url||''))?restaurant.logo_url:'';
  const cover=/^https:\/\//i.test(String(restaurant?.cover_image_url||''))?restaurant.cover_image_url:'';
  const media=(label,url,kind)=>`<article class="${kind||''}"><small>${esc(label)}</small>${url?`<img src="${attr(url)}" alt="${attr(label)}"><a href="${attr(url)}" target="_blank" rel="noopener noreferrer">Open full image ↗</a>`:'<div class="setup-review-image-missing">Not provided</div>'}</article>`;
  return `<div class="setup-review-media dossier-media">${media('Restaurant logo',logo,'dossier-logo')}${media('Cover image',cover,'')}</div>${gallery.length?`<div class="dossier-gallery">${gallery.map((url,index)=>`<a href="${attr(url)}" target="_blank" rel="noopener noreferrer"><img src="${attr(url)}" alt="Gallery image ${index+1}"></a>`).join('')}</div>`:'<div class="empty-state dossier-empty dossier-gallery-empty">No gallery images have been provided.</div>'}`
}
function dossierSubmissionHistory(items){
  const rows=Array.isArray(items)?items:[];
  if(!rows.length)return '<div class="empty-state dossier-empty">No restaurant setup submission has been made yet.</div>';
  return `<div class="dossier-history">${rows.map((item,index)=>`<article><div><strong>${esc(String(item.status||'unknown').replaceAll('_',' '))}</strong><small>${index===0?'Latest setup record':'Earlier setup record'} · ${afghanDate(item.updated_at||item.created_at)}</small></div>${badge(item.status||'unknown')}${item.owner_note?`<p><b>Owner note:</b> ${esc(item.owner_note)}</p>`:''}${item.admin_note?`<p><b>Admin note:</b> ${esc(item.admin_note)}</p>`:''}</article>`).join('')}</div>`
}
function dossierCandidateMatches(items){
  const rows=Array.isArray(items)?items:[];
  if(!rows.length)return '';
  return `<section class="setup-review-section dossier-candidates"><div class="setup-review-section-head"><div><span class="setup-review-number">9</span><div><h3>Possible existing restaurant records</h3><p>The application is not linked to a restaurant record yet. Check these possible matches before approving to avoid duplicates.</p></div></div><span class="setup-review-count">${number(rows.length)} possible match${rows.length===1?'':'es'}</span></div><div class="dossier-candidate-grid">${rows.map(r=>`<article>${r.logo_url?`<img src="${attr(r.logo_url)}" alt="">`:'<div class="dossier-candidate-placeholder">AE</div>'}<div><h4>${esc(r.name||'Restaurant')}</h4>${r.name_dari?`<p dir="rtl">${esc(r.name_dari)}</p>`:''}<p>${esc(r.address||'No address')} · ${esc(r.district||'Herat')}</p><p dir="ltr">${esc(r.phone||r.phone2||r.whatsapp_number||'No phone')}</p><div class="button-stack">${badge(r.status||'unknown')}${badge(r.verification_status||'unknown')}</div></div></article>`).join('')}</div></section>`
}
function partnerApplicationReviewWorkspace(detail){
  const item=detail?.application||detail;
  if(!item)return'';
  const restaurant=detail?.restaurant||null,account=detail?.ownerAccount||null,submissions=Array.isArray(detail?.setupSubmissions)?detail.setupSubmissions:[],menu=detail?.menu||{categories:[],items:[]},candidates=Array.isArray(detail?.candidateMatches)?detail.candidateMatches:[],verified=Boolean(item.email_verified);
  const deliveryLabels={afghan_eats:'Afghan Eats delivery',own_delivery:'Restaurant delivery',both:'Both Afghan Eats and restaurant delivery'};
  const activeCategories=(Array.isArray(menu.categories)?menu.categories:[]).filter(x=>!x.archived_at),activeItems=(Array.isArray(menu.items)?menu.items:[]).filter(x=>!x.archived_at),archivedItems=(Array.isArray(menu.items)?menu.items:[]).filter(x=>x.archived_at);
  const cuisineTags=Array.isArray(restaurant?.cuisine_tags)?restaurant.cuisine_tags:[];
  const portalState=!account?'Not created':account.activated_at?'Activated':account.active?'Invited / awaiting activation':'Inactive';
  const linked=Boolean(restaurant);
  const coords=restaurant?.latitude!=null&&restaurant?.longitude!=null?`${restaurant.latitude}, ${restaurant.longitude}`:'Not provided';
  const ownerConfirmed=restaurant?.owner_confirmed===true;
  return `<section id="partner-application-review-workspace" class="panel wide setup-review-workspace partner-application-review dossier-workspace">
  <div class="setup-review-toolbar"><button class="button button-secondary button-small" type="button" data-action="close-partner-application-review">← Back to applications</button><div><span class="eyebrow">Complete restaurant application dossier</span><h2>${esc(item.restaurant_name||restaurant?.name||'Restaurant application')}</h2><p>Registration, linked marketplace record, contacts, media, fulfilment, menu, owner access and onboarding history in one review.</p></div><div class="dossier-toolbar-badges">${badge(item.status||'pending')}${linked?'<span class="badge badge-active">restaurant record linked</span>':'<span class="badge badge-pending">no linked restaurant record</span>'}</div></div>
  <div class="setup-review-body">
    <div class="dossier-summary"><div><small>Application</small><strong>${esc(item.reference||'—')}</strong></div><div><small>Email</small><strong>${verified?'Verified':'Not verified'}</strong></div><div><small>Restaurant record</small><strong>${linked?'Linked':'Not linked'}</strong></div><div><small>Owner portal</small><strong>${esc(portalState)}</strong></div><div><small>Menu</small><strong>${number(activeItems.length)} active item${activeItems.length===1?'':'s'}</strong></div><div><small>Setup review</small><strong>${esc(submissions[0]?.status?String(submissions[0].status).replaceAll('_',' '):'Not submitted')}</strong></div></div>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">1</span><div><h3>Owner identity & application</h3><p>Everything stored from the restaurant partnership request and its current review state.</p></div></div>${verified?'<span class="badge badge-active">email verified</span>':'<span class="badge badge-suspended">email not verified</span>'}</div>
      <div class="setup-review-fields">${reviewLine('Owner / manager name',item.owner_name)}${reviewLine('Email',item.email,{dir:'ltr'})}${reviewLine('Phone',item.phone,{dir:'ltr'})}${reviewLine('WhatsApp',item.whatsapp||'Not provided',{dir:'ltr'})}${reviewLine('Application reference',item.reference,{dir:'ltr'})}${reviewLine('Application status',String(item.status||'pending').replaceAll('_',' '))}${reviewLine('Submitted',afghanDate(item.created_at))}${reviewLine('Last updated',afghanDate(item.updated_at))}${reviewLine('Linked restaurant ID',item.restaurant_id||'Not linked',{dir:'ltr'})}</div>
      <div class="setup-review-copy-grid"><div><small>Owner registration note</small><p>${esc(item.notes||'No note provided')}</p></div><div><small>Existing administrator note</small><p>${esc(item.admin_notes||'No administrator note recorded')}</p></div></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">2</span><div><h3>Restaurant identity & location</h3><p>Application information plus every identity and location field currently stored in the restaurant record.</p></div></div></div>
      <div class="setup-review-fields">${reviewLine('Application restaurant name',item.restaurant_name)}${reviewLine('Current English name',restaurant?.name||item.restaurant_name)}${reviewLine('Dari name',restaurant?.name_dari)}${reviewLine('Pashto name',restaurant?.name_pashto)}${reviewLine('Application cuisine / specialties',item.cuisine||'Not provided')}${reviewLine('Primary category',restaurant?.category_primary)}${reviewList('Cuisine tags',cuisineTags)}${reviewLine('Application district',item.district)}${reviewLine('Current district',restaurant?.district||item.district)}${reviewLine('Neighborhood',restaurant?.neighborhood)}${reviewLine('Landmark',restaurant?.landmark)}${reviewLine('City',restaurant?.city||'Herat')}${reviewLine('Country',restaurant?.country||'Afghanistan')}${reviewLine('Coordinates',coords,{dir:'ltr'})}</div>
      <div class="setup-review-copy-grid"><div><small>Application address / landmark</small><p>${esc(item.address||'Not provided')}</p></div><div><small>Current restaurant address</small><p>${esc(restaurant?.address||item.address||'Not provided')}</p></div><div dir="rtl"><small>آدرس دری</small><p>${esc(restaurant?.address_dari||'ارائه نشده')}</p></div><div><small>Location notes</small><p>${esc(restaurant?.location_notes||'Not provided')}</p></div><div><small>Description — English</small><p>${esc(restaurant?.description||'Not provided')}</p></div><div dir="rtl"><small>توضیحات دری</small><p>${esc(restaurant?.description_dari||'ارائه نشده')}</p></div></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">3</span><div><h3>Restaurant contact & online presence</h3><p>All restaurant contact channels and public profile links currently stored.</p></div></div></div>
      <div class="setup-review-fields">${reviewLine('Restaurant phone',restaurant?.phone||item.phone,{dir:'ltr'})}${reviewLine('Second phone',restaurant?.phone2,{dir:'ltr'})}${reviewList('All stored phone numbers',restaurant?.phone_numbers)}${reviewLine('Restaurant WhatsApp',restaurant?.whatsapp_number||item.whatsapp,{dir:'ltr'})}${reviewLine('Restaurant email',restaurant?.email||item.email,{dir:'ltr'})}${reviewLink('Instagram',restaurant?.instagram_url)}${reviewLink('Facebook',restaurant?.facebook_url)}${reviewLink('Website',restaurant?.website_url)}</div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">4</span><div><h3>Branding, photographs & media status</h3><p>Logo, cover image, gallery and the current media verification state.</p></div></div>${badge(restaurant?.media_status||'provisional')}</div>
      ${dossierMedia(restaurant)}
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">5</span><div><h3>Opening hours, service & commercial settings</h3><p>How the restaurant intends to serve customers and every current delivery/commercial setting.</p></div></div></div>
      ${dossierHours(restaurant)}
      <div class="setup-review-fields dossier-fields-spaced">${reviewLine('Opening-hours text',restaurant?.opening_hours_text)}${reviewLine('Application delivery model',deliveryLabels[item.delivery_model]||item.delivery_model||'Not provided')}${reviewBool('Delivery enabled',restaurant?Boolean(restaurant.has_delivery):item.delivery_model!=='own_delivery'?true:false)}${reviewBool('Dine-in enabled',restaurant?Boolean(restaurant.has_dine_in):false)}${reviewBool('Takeaway / pickup enabled',restaurant?Boolean(restaurant.has_takeaway):false)}${reviewLine('Store open now',restaurant?restaurant.is_open?'Open':'Closed':'Not available')}${reviewLine('Delivery ETA minimum',restaurant?.delivery_time_min!=null?`${restaurant.delivery_time_min} min`:'Not provided')}${reviewLine('Delivery ETA maximum',restaurant?.delivery_time_max!=null?`${restaurant.delivery_time_max} min`:'Not provided')}${reviewLine('Delivery fee minimum',restaurant?.delivery_fee_min!=null?money(restaurant.delivery_fee_min):'Not provided')}${reviewLine('Delivery fee maximum',restaurant?.delivery_fee_max!=null?money(restaurant.delivery_fee_max):'Not provided')}${reviewLine('Minimum order',restaurant?.min_order_amount!=null?money(restaurant.min_order_amount):'Not provided')}${reviewLine('Service area',restaurant?.service_area)}</div>
      <div class="setup-review-copy-grid"><div><small>Delivery notes</small><p>${esc(restaurant?.delivery_notes||'Not provided')}</p></div><div><small>Application delivery / operational note</small><p>${esc(item.notes||'Not provided')}</p></div></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">6</span><div><h3>Marketplace verification & source record</h3><p>Listing status, verification, partnership, ownership and research/source information.</p></div></div></div>
      <div class="setup-review-fields">${reviewLine('Listing status',restaurant?.status||'No linked listing')}${reviewLine('Provisional listing',restaurant?restaurant.is_provisional?'Yes':'No':'Not available')}${reviewLine('Verification status',restaurant?.verification_status)}${reviewLine('Owner confirmed',restaurant?ownerConfirmed?'Yes':'No':'Not available')}${reviewLine('Owner confirmed at',afghanDate(restaurant?.owner_confirmed_at))}${reviewLine('Last verified at',afghanDate(restaurant?.last_verified_at))}${reviewLine('Partnership status',restaurant?.partnership_status)}${reviewLine('Negotiation status',restaurant?.negotiation_status)}${reviewLine('Agreement status',restaurant?.agreement_status)}${reviewLine('Owner handover status',restaurant?.owner_handover_status)}${reviewLine('Source type',restaurant?.source_type)}${reviewLine('Source label',restaurant?.source_label)}${reviewLink('Source URL',restaurant?.source_url)}${reviewLine('Source checked',afghanDate(restaurant?.source_checked_at))}${reviewLine('Created by',restaurant?.created_by)}${reviewLine('Seeded by',restaurant?.seeded_by)}${reviewLine('Record created',afghanDate(restaurant?.created_at))}${reviewLine('Record updated',afghanDate(restaurant?.updated_at))}${reviewLine('Afghan Eats rating',restaurant?.rating!=null?`${restaurant.rating} / 5`:'Not provided')}${reviewLine('Afghan Eats reviews',restaurant?.total_reviews!=null?restaurant.total_reviews:'Not provided')}${reviewLine('External rating',restaurant?.external_rating!=null?restaurant.external_rating:'Not provided')}${reviewLine('External rating source',restaurant?.external_rating_source)}</div>
      <div class="setup-review-copy-grid"><div><small>Source notes</small><p>${esc(restaurant?.source_notes||'Not provided')}</p></div><div><small>Internal restaurant notes</small><p>${esc(restaurant?.internal_notes||'Not provided')}</p></div><div><small>Field visit notes</small><p>${esc(restaurant?.field_visit_notes||'Not provided')}</p></div><div><small>Pause reason / operational restriction</small><p>${esc(restaurant?.pause_reason||'Not provided')}</p></div></div>
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">7</span><div><h3>Owner portal & onboarding history</h3><p>Owner login state and restaurant setup submissions connected to this restaurant.</p></div></div>${account?badge(account.active?'active':'inactive'):badge('not created')}</div>
      <div class="setup-review-fields">${reviewLine('Portal username',account?.username,{dir:'ltr'})}${reviewLine('Portal account state',portalState)}${reviewLine('Account active',account?account.active?'Yes':'No':'Not created')}${reviewLine('Activated at',afghanDate(account?.activated_at))}${reviewLine('Portal account created',afghanDate(account?.created_at))}${reviewLine('Portal account updated',afghanDate(account?.updated_at))}</div>
      <div class="dossier-submission-title"><b>Restaurant setup review history</b><span>${number(submissions.length)} record${submissions.length===1?'':'s'}</span></div>
      ${dossierSubmissionHistory(submissions)}
    </section>

    <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">8</span><div><h3>Menu & pricing</h3><p>All active menu categories and items currently stored for the linked restaurant.</p></div></div><span class="setup-review-count">${number(activeItems.length)} active · ${number(archivedItems.length)} archived</span></div>
      ${activeItems.length?setupReviewMenu({menu:{categories:activeCategories,items:activeItems}}):'<div class="empty-state dossier-empty">No menu has been added yet.</div>'}
    </section>

    ${dossierCandidateMatches(candidates)}

    <section class="setup-review-section setup-review-decision"><div class="setup-review-section-head"><div><span class="setup-review-number">${candidates.length?'10':'9'}</span><div><h3>Application decision</h3><p>Use the complete dossier above before approving, waitlisting or rejecting this restaurant.</p></div></div></div>
      ${!verified?'<div class="notice notice-error notice-block"><b>Approval is blocked until the owner verifies the registration email.</b></div>':''}
      ${!linked?'<div class="notice notice-warning notice-block"><b>No restaurant record is linked yet.</b> Approval will create the owner-submitted restaurant record and owner portal access. Check the possible-match section first if it appears above.</div>':''}
      <label class="field"><span>Internal / owner-facing review note</span><textarea data-partner-review-note="${attr(item.id)}" maxlength="1500" rows="4" placeholder="Optional for approval; recommended for waitlist/rejection decisions.">${esc(item.admin_notes||'')}</textarea></label>
      <div class="setup-review-decision-bar"><div><b>Approval creates or confirms owner portal access.</b><small>After approval, the owner must still complete restaurant setup and submit it for final marketplace review before customer ordering is activated.</small></div><div class="button-stack"><button class="button button-secondary" type="button" data-action="application-status" data-type="partner" data-id="${attr(item.id)}" data-status="reviewing">Mark reviewing</button><button class="button button-secondary" type="button" data-action="application-status" data-type="partner" data-id="${attr(item.id)}" data-status="waitlisted">Waitlist</button><button class="button button-danger" type="button" data-action="application-status" data-type="partner" data-id="${attr(item.id)}" data-status="rejected">Reject</button><button class="button button-primary" type="button" data-action="application-status" data-type="partner" data-id="${attr(item.id)}" data-status="approved" ${verified?'':'disabled aria-disabled="true"'}>Approve & create owner access</button></div></div>
    </section>
  </div>
</section>`
}
function applicationDetails(item, type) {
  if (type === 'partner') return `<span class="row-sub">${esc(item.owner_name || 'Owner')} · ${esc(item.email || 'No email')}</span><span class="row-sub">${esc(item.phone || 'No phone')} · ${esc(item.district || 'Herat')}</span>`;
  return `<span class="row-sub">${esc(item.phone || 'No phone')} · ${esc(item.vehicle || 'No vehicle')}</span><span class="row-sub">${esc(item.service_area || 'Herat')}</span>`;
}
function applicationTable(items, type) { const reviewItems=items; return reviewItems.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Applicant</th><th>Reference</th><th>State</th><th>Review</th></tr></thead><tbody>${reviewItems.map(item => {const partner=type==='partner';const control=partner?`<button class="button button-primary button-small" data-action="open-partner-application-review" data-id="${attr(item.id)}">Review application</button>`:`<div class="button-stack"><button class="button button-secondary button-small" data-action="application-status" data-type="${type}" data-id="${attr(item.id)}" data-status="reviewing">Reviewing</button><button class="button button-primary button-small" data-action="application-status" data-type="${type}" data-id="${attr(item.id)}" data-status="approved">Approve</button><button class="button button-secondary button-small" data-action="application-status" data-type="${type}" data-id="${attr(item.id)}" data-status="waitlisted">Waitlist</button><button class="button button-danger button-small" data-action="application-status" data-type="${type}" data-id="${attr(item.id)}" data-status="rejected">Reject</button></div>`;return `<tr class="${partner&&String(state.partnerReviewId)===String(item.id)?'is-selected':''}"><td><span class="row-title">${esc(item.restaurant_name || item.full_name)}</span>${applicationDetails(item, type)}</td><td>${esc(item.reference || '—')}</td><td>${badge(item.status)}${partner?(item.email_verified?'<span class="row-sub review-email-ok">Email verified</span>':'<span class="row-sub review-email-warn">Email not verified</span>'):''}</td><td>${control}</td></tr>`}).join('')}</tbody></table></div>` : '<div class="empty-state">No applications have been submitted yet.</div>'; }
function ownerReadiness(accounts) { const owners = accounts.filter(account => account.role === 'owner'); return owners.length ? `<div class="activity-list">${owners.map(account => `<div class="activity-row"><i class="activity-dot"></i><div><p><strong>${esc(account.restaurant_name || 'Restaurant owner')}</strong> ${badge(account.active ? 'active' : 'inactive')}</p><small>${esc(account.username)} · ${account.activated_at ? 'activated' : 'invited'}</small></div></div>`).join('')}</div>` : '<div class="empty-state">No owner portal accounts are available yet.</div>'; }

function riderDocumentLabel(type){return ({profile_photo:'Profile photo',national_id_front:'National ID / Tazkira — front or main page',national_id_back:'National ID — back / second page',driving_license_front:'Driving licence — front',driving_license_back:'Driving licence — back',vehicle_registration:'Vehicle registration'})[type]||String(type||'Document').replaceAll('_',' ')}
function riderDocumentCard(doc,requiredDocuments){
  const required=requiredDocuments.includes(doc.document_type),image=String(doc.mime_type||'').startsWith('image/');
  const preview=image?`<button class="rider-document-preview" type="button" data-action="open-rider-document" data-id="${attr(doc.id)}" aria-label="Open ${attr(riderDocumentLabel(doc.document_type))}"><img src="data:${attr(doc.mime_type)};base64,${attr(doc.base64||'')}" alt="${attr(riderDocumentLabel(doc.document_type))}"></button>`:`<button class="rider-document-preview rider-document-pdf" type="button" data-action="open-rider-document" data-id="${attr(doc.id)}"><span>PDF</span><small>Open document</small></button>`;
  return `<article class="rider-document-card"><div class="rider-document-head"><div><h4>${esc(riderDocumentLabel(doc.document_type))}${required?' <em>Required</em>':''}</h4><p>${esc(doc.file_name||'Document')} · ${number(Math.round(Number(doc.file_size||0)/1024))} KB</p></div>${badge(doc.review_status||'pending')}</div>${preview}${doc.review_note?`<div class="rider-document-review-note"><b>Previous review note</b><p>${esc(doc.review_note)}</p></div>`:''}<label class="field"><span>Document review note</span><textarea data-rider-document-note="${attr(doc.id)}" maxlength="1000" rows="2" placeholder="Required if rejecting this document."></textarea></label><div class="button-stack"><button class="button button-primary button-small" type="button" data-action="review-rider-document" data-id="${attr(doc.id)}" data-status="approved">Approve document</button><button class="button button-danger button-small" type="button" data-action="review-rider-document" data-id="${attr(doc.id)}" data-status="rejected">Reject document</button></div></article>`
}
function riderApplicationReviewWorkspace(detail){
  if(!detail?.application)return'';const a=detail.application,docs=asArray(detail.documents),required=asArray(detail.requiredDocuments),issues=asArray(detail.personalIssues),emailVerified=a.email_verified===true,motorized=['motorcycle','car'].includes(String(a.vehicle||'')),docByType=new Map(docs.map(doc=>[doc.document_type,doc]));
  const missing=required.filter(type=>!docByType.has(type)),notApproved=required.filter(type=>docByType.has(type)&&docByType.get(type).review_status!=='approved');
  return `<section id="rider-application-review-workspace" class="panel wide setup-review-workspace rider-review-workspace">
    <div class="setup-review-toolbar"><button class="button button-secondary button-small" type="button" data-action="close-rider-application-review">← Back to rider queue</button><div><span class="eyebrow">Private rider verification</span><h2>${esc(a.full_name||'Rider application')}</h2><p>Review the applicant’s personal information and private identity/driver documents before final approval.</p></div>${badge(a.status||'pending')}</div>
    <div class="setup-review-body">
      <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">1</span><div><h3>Personal information</h3><p>Compare these details with the profile photo and National ID evidence below.</p></div></div><div class="button-stack">${emailVerified?'<span class="badge badge-active">email verified</span>':'<span class="badge badge-suspended">email not verified</span>'}${a.identity_verified?'<span class="badge badge-active">identity documents approved</span>':'<span class="badge badge-pending">identity review pending</span>'}</div></div>
        <div class="setup-review-fields">
          ${reviewLine('Full name',a.full_name)}${reviewLine("Father's name",a.father_name)}${reviewLine('Date of birth',a.date_of_birth?String(a.date_of_birth).slice(0,10):'Not provided')}
          ${reviewLine('Email',a.email||'Not provided',{dir:'ltr'})}${reviewLine('Phone',a.phone,{dir:'ltr'})}${reviewLine('WhatsApp',a.whatsapp||'Not provided',{dir:'ltr'})}
          ${reviewLine('National ID / Tazkira number',a.national_id_number||'Not provided',{dir:'ltr'})}${reviewLine('Service area',a.service_area||'Not provided')}${reviewLine('Application reference',a.reference,{dir:'ltr'})}
          ${reviewLine('Emergency contact name',a.emergency_contact_name||'Not provided')}${reviewLine('Emergency contact phone',a.emergency_contact_phone||a.emergency_contact||'Not provided',{dir:'ltr'})}${reviewLine('Submitted',afghanDate(a.created_at))}
        </div>
        ${!emailVerified?'<div class="notice notice-error notice-block"><b>Email verification required:</b> The Rider must verify the application email before final approval or portal access can be issued.</div>':''}
        <div class="setup-review-copy-grid"><div><small>Current address</small><p>${esc(a.current_address||'Not provided')}</p></div><div><small>Experience</small><p>${esc(a.experience||'Not provided')}</p></div></div>
        ${a.notes?`<div class="setup-owner-note"><b>Applicant note</b><p>${esc(a.notes)}</p></div>`:''}
      </section>

      <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">2</span><div><h3>Vehicle & driving information</h3><p>Driving licence evidence is mandatory for motorcycle and car riders.</p></div></div>${badge(motorized?'driver':'non-motorized')}</div>
        <div class="setup-review-fields">
          ${reviewLine('Vehicle',String(a.vehicle||'Not provided').replaceAll('_',' '))}${reviewLine('Make / model',a.vehicle_make_model||'Not provided')}${reviewLine('Plate number',a.vehicle_plate||'Not provided',{dir:'ltr'})}
          ${reviewLine('Driving licence number',motorized?(a.driving_license_number||'Not provided'):'Not required',{dir:'ltr'})}${reviewLine('Driving licence expiry',motorized&&a.driving_license_expiry?String(a.driving_license_expiry).slice(0,10):motorized?'Not provided':'Not required')}${reviewLine('Documents verified',a.documents_verified?'Yes':'No')}
        </div>
      </section>

      <section class="setup-review-section"><div class="setup-review-section-head"><div><span class="setup-review-number">3</span><div><h3>Private verification documents</h3><p>Open each image/PDF, compare it with the personal information above, then approve or reject the document individually.</p></div></div><span class="setup-review-count">${number(docs.length)} uploaded</span></div>
        ${missing.length?`<div class="notice notice-error notice-block"><b>Missing required evidence:</b> ${esc(missing.map(riderDocumentLabel).join(', '))}</div>`:''}
        <div class="rider-document-grid">${docs.length?docs.map(doc=>riderDocumentCard(doc,required)).join(''):'<div class="empty-state">No private documents have been uploaded for this application yet.</div>'}</div>
      </section>

      <section class="setup-review-section setup-review-decision"><div class="setup-review-section-head"><div><span class="setup-review-number">4</span><div><h3>Final rider decision</h3><p>Approval creates an active rider record. The rider is still unavailable for dispatch until scheduled and on shift.</p></div></div>${detail.readyForApproval?'<span class="badge badge-active">ready for approval</span>':'<span class="badge badge-pending">verification incomplete</span>'}</div>
        ${!emailVerified?'<div class="notice notice-error notice-block"><b>Email verification incomplete:</b> Approval remains locked until the Rider verifies the submitted email address.</div>':''}
        ${issues.length?`<div class="notice notice-error notice-block"><b>Missing personal information:</b> ${esc(issues.join(', '))}</div>`:''}
        ${notApproved.length?`<div class="safety-card"><strong>Required document review incomplete</strong><p>${esc(notApproved.map(riderDocumentLabel).join(', '))}</p></div>`:''}
        <label class="field"><span>Rider review note</span><textarea data-rider-review-note="${attr(a.id)}" maxlength="1500" rows="4" placeholder="Record relevant verification notes. A reason is required when rejecting the application."></textarea></label>
        <div class="setup-review-decision-bar"><div><b>Do not approve until identity and driver evidence match the applicant.</b><small>Backend verification rules also block incomplete approval attempts.</small></div><div class="button-stack"><button class="button button-secondary" type="button" data-action="application-status" data-type="rider" data-id="${attr(a.id)}" data-status="reviewing">Mark reviewing</button><button class="button button-secondary" type="button" data-action="application-status" data-type="rider" data-id="${attr(a.id)}" data-status="waitlisted">Waitlist</button><button class="button button-danger" type="button" data-action="application-status" data-type="rider" data-id="${attr(a.id)}" data-status="rejected">Reject application</button><button class="button button-primary" type="button" data-action="application-status" data-type="rider" data-id="${attr(a.id)}" data-status="approved" ${detail.readyForApproval?'':'disabled aria-disabled="true"'}>Approve rider</button></div></div>
      </section>
    </div>
  </section>`
}
function riderApplicationTable(items){
  return items.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Applicant</th><th>Vehicle</th><th>Evidence</th><th>State</th><th>Review</th></tr></thead><tbody>${items.map(item=>{const total=Number(item.document_count||0),approved=Number(item.approved_document_count||0),rejected=Number(item.rejected_document_count||0);return `<tr class="${String(state.riderReviewId)===String(item.id)?'is-selected':''}"><td><span class="row-title">${esc(item.full_name)}</span><span class="row-sub">${esc(item.phone||'No phone')} · ${esc(item.email||'No email')}</span><span class="row-sub">${esc(item.reference||'—')}</span></td><td>${esc(String(item.vehicle||'—').replaceAll('_',' '))}<span class="row-sub">${esc(item.service_area||'Herat')}</span></td><td><b>${number(approved)}/${number(total)} approved</b>${rejected?`<span class="row-sub review-email-warn">${number(rejected)} rejected</span>`:''}<span class="row-sub">${item.email_verified?'Email verified':'Email verification pending'}</span><span class="row-sub">${item.identity_verified?'Identity evidence approved':'Identity review incomplete'}</span></td><td>${badge(item.status)}</td><td><button class="button button-primary button-small" type="button" data-action="open-rider-application-review" data-id="${attr(item.id)}">Review application</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty-state">No rider applications have been submitted yet.</div>'
}

async function riderData() {
  const [applications, riders, board, support] = await Promise.all([
    query('operations.adminRiderApplications', { limit: 100 }),
    query('operations.adminRiders', { availableOnly: false }),
    query('riderOperations.adminBoard', null),
    query('riderChat.adminSupportThreads', null),
  ]);
  return { applications: asArray(applications), riders: asArray(riders), board: board || { availability: [], shifts: [], timeOff: [], riders: [] }, support: asArray(support) };
}
async function renderRiders() {
  const data = await riderData(); state.cache.riders = data;
  const pendingAvailability = asArray(data.board.availability).filter(item => item.status === 'pending');
  const openShifts = asArray(data.board.shifts).filter(item => item.status === 'open');
  const scheduledShifts = asArray(data.board.shifts).filter(item => item.status !== 'open');
  const pendingTimeOff = asArray(data.board.timeOff).filter(item => item.status === 'pending');
  root.innerHTML = `<p class="section-intro">Review rider identity and driving evidence before approval, then manage shifts, availability, dispatch readiness and Rider support from the same workspace.</p>
  <div class="section-grid">
    ${state.riderReviewDetail?riderApplicationReviewWorkspace(state.riderReviewDetail):''}
    <section class="panel wide"><div class="panel-head"><div><h2>Rider application review queue</h2><p>Open an application to review personal information, National ID and driving licence evidence before approval.</p></div></div><div class="panel-body">${riderApplicationTable(data.applications)}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Create or publish a Rider shift</h2><p>Leave Rider blank to publish an open spot. Active Riders will be notified and may claim it from Shift planning.</p></div>${badge(openShifts.length ? 'open' : 'ready')}</div><div class="panel-body">${riderShiftForm(asArray(data.board.riders))}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Availability approval queue</h2><p>${number(pendingAvailability.length)} Rider request${pendingAvailability.length === 1 ? '' : 's'} waiting for review. Approval creates the confirmed shift.</p></div></div><div class="panel-body">${riderAvailabilityTable(asArray(data.board.availability))}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Rider fleet & live shift state</h2><p>Dispatch eligibility requires an active shift, Rider availability, and no other live delivery.</p></div></div><div class="panel-body">${riderTable(data.riders, asArray(data.board.riders))}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Open shift spots</h2><p>Published opportunities that Riders can claim in the app.</p></div></div><div class="panel-body">${riderShiftTable(openShifts)}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Scheduled shifts</h2><p>Confirmed, completed and cancelled Rider work periods. Times are Afghanistan time.</p></div></div><div class="panel-body">${riderShiftTable(scheduledShifts)}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Rider time off</h2><p>${number(pendingTimeOff.length)} pending request${pendingTimeOff.length === 1 ? '' : 's'}.</p></div></div><div class="panel-body">${riderTimeOffTable(asArray(data.board.timeOff))}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Rider support inbox</h2><p>Messages sent from the Rider app arrive here.</p></div></div><div class="panel-body">${riderSupportTable(data.support)}</div></section>
    ${state.riderSupportThread ? `<section class="panel wide"><div class="panel-head"><div><h2>Rider support conversation</h2><p>${esc(state.riderSupportThread.thread?.riderName || 'Rider')}</p></div><button class="button button-secondary button-small" type="button" data-action="rider-support-close">Close conversation</button></div><div class="panel-body">${riderSupportConversation(state.riderSupportThread)}</div></section>` : ''}
  </div>`;
}
function riderTable(items, boardRiders = []) {
  const board = new Map(boardRiders.map(item => [String(item.id), item]));
  return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Rider</th><th>Vehicle</th><th>Shift</th><th>Dispatch state</th><th>Control</th></tr></thead><tbody>${items.map(item => {
    const live = board.get(String(item.id)) || {};
    const busy = Boolean(live.busy ?? item.busy), shiftActive = Boolean(live.shiftActive ?? item.shift_active), available = Boolean(item.is_available);
    const eligible = item.status === 'active' && shiftActive && available && !busy;
    const stateLabel = busy ? 'on delivery' : eligible ? 'dispatch ready' : shiftActive ? 'shift active · offline' : 'off shift';
    const canSetAvailable = item.status === 'active' && shiftActive && !busy && !available;
    const control = available ? `<button class="button button-secondary button-small" data-action="rider-availability" data-id="${attr(item.id)}" data-available="false">Set offline</button>` : canSetAvailable ? `<button class="button button-primary button-small" data-action="rider-availability" data-id="${attr(item.id)}" data-available="true">Set available</button>` : '<span class="row-sub">No manual availability action</span>';
    return `<tr><td><span class="row-title">${esc(item.full_name)}</span><span class="row-sub">${esc(item.phone || '—')} · ${number(item.total_deliveries)} deliveries</span></td><td>${esc(item.vehicle || '—')}</td><td>${badge(shiftActive ? 'active' : 'off shift')}</td><td>${badge(eligible ? 'available' : stateLabel)}</td><td>${control}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="empty-state">There are no operational Rider records yet.</div>';
}
function riderShiftForm(riders) {
  const options = riders.map(rider => `<option value="${attr(rider.id)}">${esc(rider.fullName || 'Rider')} · ${esc(rider.vehicle || '')} · ${esc(rider.serviceArea || 'Herat')}</option>`).join('');
  return `<form id="rider-shift-form" class="form-grid"><label class="field"><span>Shift title</span><input name="title" maxlength="180" value="Rider shift"></label><label class="field"><span>Service area</span><input name="serviceArea" maxlength="180" value="Herat city"></label><label class="field"><span>Start · Afghanistan time</span><input name="startsAt" type="datetime-local" required></label><label class="field"><span>End · Afghanistan time</span><input name="endsAt" type="datetime-local" required></label><label class="field full"><span>Rider <small>optional</small></span><select name="riderId"><option value="">Open shift — notify Riders and let one claim it</option>${options}</select></label><label class="field full"><span>Operations note <small>optional</small></span><textarea name="note" maxlength="1000" rows="2"></textarea></label><div class="safety-card full"><strong>Open spot behavior</strong><p>When no Rider is selected, the shift is published to active Riders. The first eligible Rider who claims it gets the spot; overlapping shifts and approved time off are blocked by the server.</p></div><button class="button button-primary full" type="submit">Create shift / publish open spot</button></form>`;
}
function riderAvailabilityTable(items) {
  const visible = items.filter(item => item.status !== 'withdrawn');
  return visible.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Rider</th><th>Requested availability</th><th>State</th><th>Review</th></tr></thead><tbody>${visible.map(item => `<tr><td><span class="row-title">${esc(item.riderName)}</span><span class="row-sub">${esc(item.vehicle || '')} · ${esc(item.serviceArea || '')}</span></td><td>${esc(item.date)}<span class="row-sub">${esc(item.allDay ? 'All day' : `${item.start} – ${item.end}`)} · Afghanistan time</span></td><td>${badge(item.status)}</td><td>${item.status === 'pending' ? `<div class="button-stack"><button class="button button-primary button-small" data-action="rider-availability-review" data-id="${attr(item.id)}" data-status="approved">Approve & schedule</button><button class="button button-danger button-small" data-action="rider-availability-review" data-id="${attr(item.id)}" data-status="rejected">Reject</button></div>` : '<span class="row-sub">Reviewed</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No Rider availability requests have been submitted.</div>';
}
function riderShiftTable(items) {
  return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Shift</th><th>Rider / spot</th><th>Schedule</th><th>State</th><th>Control</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.title || 'Rider shift')}</span><span class="row-sub">${esc(item.serviceArea || 'Herat')}</span></td><td>${esc(item.riderName || 'Open to interested Riders')}</td><td>${esc(afghanDate(item.startsAt))}<span class="row-sub">to ${esc(afghanDate(item.endsAt))}</span></td><td>${badge(item.status)}</td><td>${['open','assigned'].includes(item.status) ? `<button class="button button-danger button-small" data-action="rider-shift-cancel" data-id="${attr(item.id)}">Cancel shift</button>` : '<span class="row-sub">Closed</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No shifts in this section.</div>';
}
function riderTimeOffTable(items) {
  return items.length ? `<div class="activity-list">${items.map(item => `<div class="activity-row"><i class="activity-dot"></i><div class="flex-one"><p><strong>${esc(item.riderName || 'Rider')}</strong> ${badge(item.status)}</p><small>${esc(item.startDate)} → ${esc(item.endDate)} · ${esc(item.reason || '')}${item.note ? ` · ${esc(item.note)}` : ''}</small></div>${item.status === 'pending' ? `<div class="button-stack"><button class="button button-primary button-small" data-action="rider-timeoff-review" data-id="${attr(item.id)}" data-status="approved">Approve</button><button class="button button-danger button-small" data-action="rider-timeoff-review" data-id="${attr(item.id)}" data-status="rejected">Reject</button></div>` : ''}</div>`).join('')}</div>` : '<div class="empty-state">No Rider time-off requests.</div>';
}
function riderSupportTable(items) {
  return items.length ? `<div class="activity-list">${items.map(item => `<div class="activity-row"><i class="activity-dot"></i><div class="flex-one"><p><strong>${esc(item.riderName || 'Rider')}</strong> ${badge(item.status)}</p><small>${esc(item.phone || '')} · ${number(item.messageCount)} messages${item.lastMessageAt ? ` · ${shortDate(item.lastMessageAt)}` : ''}</small></div><button class="button button-secondary button-small" data-action="rider-support-open" data-id="${attr(item.id)}">Open</button></div>`).join('')}</div>` : '<div class="empty-state">No Rider support conversations yet.</div>';
}
function riderSupportConversation(data) {
  const messages = asArray(data.messages);
  return `<div class="activity-list">${messages.length ? messages.map(message => `<div class="activity-row"><i class="activity-dot"></i><div><p><strong>${esc(message.sender || 'message')}</strong></p><p>${esc(message.body)}</p><small>${shortDate(message.createdAt)}</small></div></div>`).join('') : '<div class="empty-state">No messages yet.</div>'}</div><form id="rider-support-reply-form" class="form-grid space-top-md"><input name="threadId" type="hidden" value="${attr(data.thread?.id || '')}"><label class="field full"><span>Reply to Rider</span><textarea name="body" required minlength="1" maxlength="4000" rows="3"></textarea></label><button class="button button-primary full" type="submit">Send reply</button></form>`;
}

async function careersData() { const [positions, applications] = await Promise.all([query('operations.adminCareerPositions', null), query('operations.adminCareerApplications', { limit: 100 })]); return { positions: asArray(positions), applications: asArray(applications) }; }
function careerStatusLabel(status) { return String(status || '').replaceAll('_', ' '); }
function dateInput(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); }
function careerEditForm(position) { const item = position || { employment_type: 'full_time', work_mode: 'on_site', location: 'Herat, Afghanistan', status: 'draft' }; const label = position ? 'Update vacancy' : 'Create vacancy'; return `<form id="career-position-form" class="form-grid"><input name="id" type="hidden" value="${attr(item.id || '')}"><label class="field"><span>Role title — English</span><input name="title" required maxlength="200" value="${attr(item.title || '')}" placeholder="e.g. Operations Coordinator"></label><label class="field"><span>Role title — Dari</span><input name="titleDari" dir="rtl" maxlength="200" value="${attr(item.title_dari || '')}"></label><label class="field"><span>Department</span><input name="department" required maxlength="160" value="${attr(item.department || '')}" placeholder="Operations, Customer experience, Engineering"></label><label class="field"><span>Employment type</span><select name="employmentType">${['full_time','part_time','contract','internship'].map(value => `<option value="${value}" ${item.employment_type === value ? 'selected' : ''}>${esc(careerStatusLabel(value))}</option>`).join('')}</select></label><label class="field"><span>Location</span><input name="location" required maxlength="200" value="${attr(item.location || '')}"></label><label class="field"><span>Work arrangement</span><select name="workMode">${['on_site','hybrid','remote'].map(value => `<option value="${value}" ${item.work_mode === value ? 'selected' : ''}>${esc(careerStatusLabel(value))}</option>`).join('')}</select></label><label class="field"><span>Application deadline <small>optional</small></span><input name="applicationDeadline" type="date" value="${attr(dateInput(item.application_deadline))}"></label><label class="field"><span>Publication state</span><select name="status">${['draft','open','closed'].map(value => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${esc(careerStatusLabel(value))}</option>`).join('')}</select></label><label class="field full"><span>Role summary</span><textarea name="summary" rows="3" required maxlength="2000" placeholder="A clear candidate-facing overview of the role.">${esc(item.summary || '')}</textarea></label><label class="field"><span>Responsibilities <small>one item per line</small></span><textarea name="responsibilities" rows="6" maxlength="6000">${esc(item.responsibilities || '')}</textarea></label><label class="field"><span>Requirements <small>one item per line</small></span><textarea name="requirements" rows="6" maxlength="6000">${esc(item.requirements || '')}</textarea></label><label class="field full"><span>What Afghan Eats offers <small>optional, one item per line</small></span><textarea name="benefits" rows="3" maxlength="3000">${esc(item.benefits || '')}</textarea></label><div class="safety-card full"><strong>Publication control</strong><p>Only roles marked open are visible on the public Careers page. Closing a vacancy preserves applications but stops new candidates from applying.</p></div><div class="button-stack full"><button class="button button-primary" type="submit">${label}</button>${position ? '<button class="button button-secondary" type="button" data-action="cancel-career-edit">Cancel editing</button>' : ''}</div></form>`; }
function careerPositionTable(items) { return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Vacancy</th><th>Team & work</th><th>Deadline</th><th>Applications</th><th>Control</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.title)}</span><span class="row-sub">${esc(item.reference)} · ${badge(item.status)}</span></td><td>${esc(item.department)}<span class="row-sub">${esc(careerStatusLabel(item.employment_type))} · ${esc(item.location)}</span></td><td>${item.application_deadline ? shortDate(item.application_deadline) : 'Until filled'}</td><td>${number(item.application_count)}</td><td><div class="button-stack"><button class="button button-secondary button-small" type="button" data-action="edit-career-position" data-id="${attr(item.id)}">Edit</button><button class="button ${item.status === 'open' ? 'button-danger' : 'button-primary'} button-small" type="button" data-action="toggle-career-position" data-id="${attr(item.id)}" data-status="${item.status === 'open' ? 'closed' : 'open'}">${item.status === 'open' ? 'Close vacancy' : 'Open vacancy'}</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No vacancies have been created. Use the form to create the first draft or open position.</div>'; }
function careerApplicationTable(items) { const statuses = ['pending','reviewing','interview','rejected','hired']; return items.length ? `<div class="activity-list">${items.map(item => `<article class="review-card"><div class="review-card-head"><div><h3>${esc(item.full_name)}</h3><p>${esc(item.position_title)} · ${esc(item.reference)} · submitted ${shortDate(item.created_at)}</p></div>${badge(item.status)}</div><div class="review-detail-grid"><span><b>Contact</b>${esc(item.phone)}${item.email ? ` · ${esc(item.email)}` : ''}</span><span><b>Experience</b>${item.experience_years == null ? 'Not provided' : `${esc(item.experience_years)} years`}${item.current_role ? ` · ${esc(item.current_role)}` : ''}</span><span><b>City</b>${esc(item.city || 'Not provided')}</span><span><b>CV / portfolio</b>${item.resume_url ? `<a href="${attr(item.resume_url)}" target="_blank" rel="noopener noreferrer">Open provided link ↗</a>` : 'Not provided'}</span></div><div class="safety-card"><strong>Application note</strong><p>${esc(item.cover_note || 'No note provided.')}</p></div><label class="field"><span>Internal review note</span><textarea data-career-note="${attr(item.id)}" rows="2" maxlength="3000" placeholder="Required when finalizing as hired or rejected.">${esc(item.admin_note || '')}</textarea></label><div class="button-stack"><select class="inline-select" data-career-status="${attr(item.id)}">${statuses.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${esc(careerStatusLabel(status))}</option>`).join('')}</select><button class="button button-primary button-small" type="button" data-action="review-career-application" data-id="${attr(item.id)}" data-name="${attr(item.full_name)}">Save review</button></div></article>`).join('')}</div>` : '<div class="empty-state">No job applications have been received yet.</div>'; }
async function renderCareers() { const data = await careersData(); state.cache.careers = data; const edit = state.careerEdit ? data.positions.find(item => String(item.id) === String(state.careerEdit)) : null; root.innerHTML = `<p class="section-intro">Publish open Afghan Eats roles, pause applications when a vacancy closes, and review candidate details privately. Do not record sensitive documents or credentials in internal notes.</p><div class="section-grid"><section class="panel wide"><div class="panel-head"><div><h2>${edit ? 'Edit vacancy' : 'Post a new vacancy'}</h2><p>Draft a role first, then mark it open when candidates may apply on afghaneats.net/careers.</p></div></div><div class="panel-body">${careerEditForm(edit)}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Vacancy board</h2><p>${number(data.positions.length)} role${data.positions.length === 1 ? '' : 's'} managed by Afghan Eats.</p></div></div><div class="panel-body">${careerPositionTable(data.positions)}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Candidate applications</h2><p>${number(data.applications.length)} recent application${data.applications.length === 1 ? '' : 's'} available for review.</p></div></div><div class="panel-body">${careerApplicationTable(data.applications)}</div></section></div>`; }

async function customerData() { const [settings, customers] = await Promise.all([query('customer.adminSettings', null), query('customer.adminCustomers', { limit: 100 })]); return { settings: settings || {}, customers: asArray(customers) }; }
async function renderCustomers() { const data = await customerData(); state.cache.customers = data; const settings = data.settings; root.innerHTML = `<p class="section-intro">Manage customer account access and platform loyalty settings. Disabling an account invalidates its customer API session; it does not alter completed orders.</p><div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>Customer accounts</h2><p>${number(data.customers.length)} accounts returned by the platform.</p></div></div><div class="panel-body">${customerTable(data.customers)}</div></section><section class="panel"><div class="panel-head"><div><h2>Rewards controls</h2><p>Server-side settings for loyalty earning and referrals.</p></div></div><div class="panel-body">${rewardsForm(settings)}<div class="safety-card space-top-sm"><strong>Redemption boundary</strong><p>Points earning and referrals can be configured here. Points redemption is not exposed until its transactional checkout flow is implemented.</p></div></div></section></div>`; }
function customerTable(items) { return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Verification</th><th>Orders</th><th>Rewards</th><th>Referral</th><th>Account</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.name || 'Customer')}</span><span class="row-sub">${esc(item.phone || '—')}${item.email ? ` · ${esc(item.email)}` : ''}</span><span class="row-sub">Joined ${shortDate(item.created_at)}</span></td><td>${badge(item.phone_verified ? 'phone verified' : 'phone unverified')}</td><td>${number(item.order_count)} linked</td><td>${number(item.loyalty_balance)} pts</td><td>${esc(item.referral_code || '—')}</td><td><div class="button-stack">${badge(item.active ? 'active' : 'inactive')}<button class="button ${item.active ? 'button-danger' : 'button-primary'} button-small" data-action="customer-active" data-id="${attr(item.id)}" data-active="${item.active ? 'false' : 'true'}">${item.active ? 'Disable' : 'Enable'}</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No customer accounts were returned by the platform.</div>'; }
function rewardsForm(settings) { return `<form id="rewards-form" class="form-grid"><label class="switch-row full"><span><b>Points earning</b><small>Allow customers to earn rewards points after eligible orders.</small></span><span class="switch"><input name="enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span></span></span></label><label class="field"><span>Points per 100 AFN</span><input name="pointsPer100Afn" type="number" min="0" step="1" value="${attr(settings.points_per_100_afn || 0)}"></label><label class="switch-row"><span><b>Referrals</b><small>Enable the referral reward rule.</small></span><span class="switch"><input name="referralEnabled" type="checkbox" ${settings.referral_enabled ? 'checked' : ''}><span></span></span></label><label class="field full"><span>Referral points</span><input name="referralPoints" type="number" min="0" step="1" value="${attr(settings.referral_points || 0)}"></label><button class="button button-primary full" type="submit">Save rewards controls</button></form>`; }

async function accessData() { const [accounts, partners, riders, recoveryRequests] = await Promise.all([query('portal.adminAccounts', null), query('operations.adminPartnerApplications', { limit: 100 }), query('operations.adminRiderApplications', { limit: 100 }), query('portal.adminRecoveryRequests', { status: 'pending' })]); return { accounts: asArray(accounts), partners: asArray(partners), riders: asArray(riders), recoveryRequests: asArray(recoveryRequests) }; }
async function renderAccess() { const data = await accessData(); state.cache.access = data; const approvedPartners = data.partners.filter(item => item.status === 'approved'); const approvedRiders = data.riders.filter(item => item.status === 'approved'); root.innerHTML = `<p class="section-intro">Control owner and rider portal access separately from restaurant listing availability. Once approved, riders and restaurants leave the review queues and appear in Approved portal access. Invitations and recovery links are private, expiring, one-time URLs; display and send them only through a verified trusted channel.</p><div class="section-grid"><section class="panel wide"><div class="panel-head"><div><h2>Account recovery requests</h2><p>Verify the applicant outside the system before issuing a recovery link. The link shows the account username and lets the verified owner or rider set a new password.</p></div></div><div class="panel-body">${recoveryRequestTable(data.recoveryRequests, data.accounts)}${state.recoveryLink ? recoveryLinkPanel(state.recoveryLink) : ''}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Approved portal access</h2><p>Approved restaurants and riders are kept here until their one-time portal activation invite is created.</p></div></div><div class="panel-body">${inviteCandidates(approvedPartners, approvedRiders, data.accounts)}${state.invite ? invitePanel(state.invite) : ''}</div></section><section class="panel"><div class="panel-head"><div><h2>Portal accounts</h2><p>Enable or disable existing owner and rider workspaces.</p></div></div><div class="panel-body">${accessTable(data.accounts)}</div></section></div>`; }
function recoveryRequestTable(items, accounts) { return items.length ? `<div class="activity-list">${items.map(item => { const candidates = accounts.filter(account => account.active && account.role === item.account_type); return `<article class="review-card"><div class="review-card-head"><div><h3>${esc(item.matched_restaurant_name || item.restaurant_name || item.requested_phone)}</h3><p>${esc(item.account_type)} portal · requested ${shortDate(item.created_at)}</p></div>${badge(item.status)}</div><div class="review-detail-grid"><span><b>Submitted phone</b>${esc(item.requested_phone)}</span><span><b>Matched username</b>${esc(item.matched_username || 'No automatic match')}</span><span><b>Requested role</b>${esc(item.account_type)}</span><span><b>Account status</b>${item.matched_account_active ? 'Automatically matched' : 'Administrator selection required'}</span></div>${item.support_note ? `<div class="safety-card"><strong>Applicant note</strong><p>${esc(item.support_note)}</p></div>` : ''}<label class="field"><span>Verified active portal account</span><select data-recovery-account="${attr(item.id)}"><option value="">Select the verified ${esc(item.account_type)} account</option>${candidates.map(account => `<option value="${attr(account.id)}" ${String(item.portal_account_id || '') === String(account.id) ? 'selected' : ''}>${esc(account.restaurant_name || account.rider_name || account.username)} — ${esc(account.username)}</option>`).join('')}</select></label><label class="field"><span>Verification or rejection note</span><textarea data-recovery-note="${attr(item.id)}" maxlength="1500" rows="2" placeholder="Record how you verified identity. Required to issue or reject this request."></textarea></label><div class="button-stack"><button class="button button-primary button-small" type="button" data-action="create-assisted-recovery" data-id="${attr(item.id)}" data-name="${attr(item.matched_restaurant_name || item.restaurant_name || item.requested_phone)}">Create recovery link</button><button class="button button-danger button-small" type="button" data-action="reject-assisted-recovery" data-id="${attr(item.id)}" data-name="${attr(item.matched_restaurant_name || item.restaurant_name || item.requested_phone)}">Reject request</button></div></article>`; }).join('')}</div>` : '<div class="empty-state">No portal account recovery requests are waiting for verification.</div>'; }
function recoveryLinkPanel(link) { return `<div class="notice notice-success notice-block space-top-sm"><strong>One-time recovery link created</strong><p class="compact-copy">Username: <b>${esc(link.username)}</b> · expires in ${esc(link.expiresInHours)} hours. Verify the recipient before sharing this link.</p><textarea id="recovery-link" class="field" readonly aria-label="Secure password recovery link">${esc(link.url)}</textarea><button class="button button-secondary button-small" type="button" data-action="copy-recovery-link">Copy secure link</button></div>`; }
function accessTable(items) { return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Workspace</th><th>Role</th><th>Activation</th><th>Marketplace listing</th><th>Portal control</th></tr></thead><tbody>${items.map(item => { const owner=item.role==='owner' && item.restaurant_id; const listing=owner ? `${badge(item.restaurant_status || 'pending')}<span class="row-sub">Store switch: ${item.restaurant_is_open ? 'open' : 'closed'}</span><button class="button ${item.restaurant_status==='active' ? 'button-danger' : 'button-primary'} button-small" data-action="portal-listing-status" data-id="${attr(item.restaurant_id)}" data-status="${item.restaurant_status==='active' ? 'inactive' : 'active'}">${item.restaurant_status==='active' ? 'Pause listing' : 'Activate listing'}</button>` : '<span class="row-sub">Not applicable</span>'; const activation=item.activated_at ? `<span class="row-title">Activated</span><span class="row-sub">${shortDate(item.activated_at)}</span>` : `<span class="row-title">Not activated</span><span class="row-sub">A new private invite can be issued.</span>${item.active ? `<button class="button button-primary button-small" data-action="reissue-activation-invite" data-id="${attr(item.id)}" data-name="${attr(item.restaurant_name || item.rider_name || item.username)}">Reissue activation link</button>` : '<span class="row-sub">Enable portal first to issue a link.</span>'}`; return `<tr><td><span class="row-title">${esc(item.restaurant_name || item.rider_name || item.username)}</span><span class="row-sub">${esc(item.username)}</span></td><td>${badge(item.role)}</td><td><div class="button-stack">${activation}</div></td><td><div class="button-stack">${listing}</div></td><td><button class="button ${item.active ? 'button-danger' : 'button-primary'} button-small" data-action="portal-active" data-id="${attr(item.id)}" data-active="${item.active ? 'false' : 'true'}">${item.active ? 'Disable portal' : 'Enable portal'}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-state">No owner or rider portal accounts are available.</div>'; }
function inviteCandidates(partners, riders, accounts) { const eligible=(items,type,role,nameKey)=>items.map(item=>({type,id:item.id,name:item[nameKey],phone:item.phone,role})).filter(candidate=>!accounts.some(account=>account.role===candidate.role&&account.username===String(candidate.phone||'').replace(/[^0-9+]/g,'')));const ownerCandidates=eligible(partners,'partner','owner','restaurant_name'),riderCandidates=eligible(riders,'rider','rider','full_name');const group=(title,items)=>`<section class="access-approved-group"><h3>${esc(title)}</h3>${items.length?`<div class="activity-list">${items.map(candidate=>`<div class="activity-row"><i class="activity-dot"></i><div class="flex-one"><p><strong>${esc(candidate.name||candidate.role)}</strong> ${badge(candidate.role)}</p><small>${esc(candidate.phone||'No phone')}</small></div><button class="button button-primary button-small" data-action="create-invite" data-type="${candidate.type}" data-id="${attr(candidate.id)}">Create invite</button></div>`).join('')}</div>`:'<div class="empty-state">No approved people are waiting for portal access.</div>'}</section>`;return `${group('Approved restaurants awaiting owner access',ownerCandidates)}${group('Approved riders awaiting rider access',riderCandidates)}`; }
function invitePanel(invite) { return `<div class="notice notice-success notice-block space-top-sm"><strong>${invite.reissued ? 'Activation link reissued' : `One-time ${esc(invite.role)} activation link created`}</strong><p class="compact-copy">${invite.restaurantName ? `${esc(invite.restaurantName)} · ` : ''}Username: <b>${esc(invite.username)}</b> · expires in ${esc(invite.expiresInHours)} hours. Any older unused activation link is now invalid.</p><textarea id="invite-link" class="field" readonly aria-label="Secure activation link">${esc(invite.url)}</textarea><button class="button button-secondary button-small" type="button" data-action="copy-invite">Copy secure link</button></div>`; }

async function operationsToolsData() {
  const result = await Promise.allSettled([
    query('trust.adminPromotions', null),
    query('trust.adminSupportCases', { limit: 100 }),
    query('trust.adminAudit', { limit: 100 }),
    query('communications.adminProviderStatus', null),
  ]);
  const get = index => result[index].status === 'fulfilled' ? result[index].value : null;
  return { promotions: asArray(get(0)), supportCases: asArray(get(1)), audit: asArray(get(2)), provider: get(3) || {} };
}
async function renderPromotionsView() {
  const data = await operationsToolsData(); state.cache.promotions = data;
  root.innerHTML = `<p class="section-intro">Create, pause and reactivate promotion campaigns. Checkout validates every discount on the server.</p><div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>Create promotion</h2><p>The full campaign controls from the former Operations portal are preserved here.</p></div></div><div class="panel-body">${promotionForm()}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Promotion campaigns</h2><p>Review discount type, value, minimum order, usage and activation state.</p></div></div><div class="panel-body">${promotionTable(data.promotions)}</div></section></div>`;
}
async function renderCommunicationsView() {
  const data = await operationsToolsData(); state.cache.communications = data;
  root.innerHTML = `<p class="section-intro">Send server-recorded in-app service announcements and opt-in promotional broadcasts.</p><section class="panel wide"><div class="panel-head"><div><h2>Customer communications</h2><p>Promotional messages remain limited to customers who explicitly opted in.</p></div>${badge(data.provider.configured ? 'enabled' : 'inactive')}</div><div class="panel-body"><div class="safety-card"><strong>${data.provider.configured ? 'External messaging provider configured' : 'External SMS / WhatsApp provider not configured'}</strong><p>${data.provider.configured ? `Provider: ${esc(data.provider.providerName || 'configured')} · ${esc(asArray(data.provider.channels).join(', '))}` : 'In-app messaging remains available. External channels cannot report success unless a real backend provider is configured.'}</p></div>${broadcastForm()}</div></section>`;
}
async function renderSupportView() {
  const data = await operationsToolsData(); state.cache.support = data;
  root.innerHTML = `<p class="section-intro">Review customer cases linked to verified order records and move them through the support workflow.</p><section class="panel wide"><div class="panel-head"><div><h2>Customer support queue</h2><p>New, in-progress, waiting-customer, resolved and closed states are preserved from the former Operations portal.</p></div></div><div class="panel-body">${customerSupportTable(data.supportCases)}</div></section>`;
}
function staffRoleLabel(role){
  return ({restaurant_staff:'Restaurant staff',rider_staff:'Rider operations staff',operations_staff:'Restaurant + rider operations',staff_pending:'Pending Google request',staff_rejected:'Rejected Google request'})[role]||title(String(role||'staff').replaceAll('_',' '));
}
function staffCreateForm(){
  return `<form id="staff-create-form" class="form-grid"><label class="field"><span>Username</span><input name="username" required minlength="3" maxlength="64" autocomplete="off" placeholder="e.g. herat.ops1"></label><label class="field"><span>Email</span><input name="email" type="email" required maxlength="320" autocomplete="off"></label><label class="field"><span>Access role</span><select name="role"><option value="restaurant_staff">Restaurant staff — restaurants only</option><option value="rider_staff">Rider staff — riders, shifts and support</option><option value="operations_staff">Operations staff — restaurants + riders</option></select></label><label class="field"><span>Temporary password</span><input name="password" type="password" required minlength="14" maxlength="200" autocomplete="new-password"></label><div class="safety-card full"><strong>Restricted by the server</strong><p>Staff accounts cannot access customers, finance, promotions, careers, audit, platform master controls, portal recovery, or administrator management. Changing a role or disabling an account invalidates its active sessions.</p></div><button class="button button-primary full" type="submit">Create restricted staff account</button></form>`;
}
function staffTable(items){
  if(!items.length)return '<div class="empty-state">No staff accounts or Google access requests yet.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Account</th><th>Access</th><th>Status</th><th>Last sign-in</th><th>Controls</th></tr></thead><tbody>${items.map(item=>{
    const pending=item.role==='staff_pending',rejected=item.role==='staff_rejected';
    const roleSelect=`<select class="inline-select" data-staff-role="${attr(item.id)}"><option value="restaurant_staff" ${item.role==='restaurant_staff'?'selected':''}>Restaurant staff</option><option value="rider_staff" ${item.role==='rider_staff'?'selected':''}>Rider staff</option><option value="operations_staff" ${item.role==='operations_staff'?'selected':''}>Restaurant + rider</option></select>`;
    if(pending||rejected){
      return `<tr><td><span class="row-title">${esc(item.username)}</span><span class="row-sub">${esc(item.email)}</span></td><td>${roleSelect}</td><td>${badge(pending?'pending':'rejected')}<span class="row-sub">Google staff request</span></td><td>—</td><td><div class="button-stack"><button class="button button-primary button-small" type="button" data-action="staff-google-approve" data-id="${attr(item.id)}">${rejected?'Approve now':'Approve access'}</button>${pending?'<button class="button button-danger button-small" type="button" data-action="staff-google-reject" data-id="'+attr(item.id)+'">Reject</button>':''}</div></td></tr>`;
    }
    return `<tr><td><span class="row-title">${esc(item.username)}</span><span class="row-sub">${esc(item.email)}</span></td><td>${roleSelect}</td><td>${badge(item.is_active?'active':'inactive')}<span class="row-sub">${esc(staffRoleLabel(item.role))}</span></td><td>${shortDate(item.last_login_at)}</td><td><div class="button-stack"><button class="button button-secondary button-small" type="button" data-action="staff-role-save" data-id="${attr(item.id)}">Save role</button><button class="button ${item.is_active?'button-danger':'button-primary'} button-small" type="button" data-action="staff-active" data-id="${attr(item.id)}" data-active="${item.is_active?'false':'true'}">${item.is_active?'Disable':'Enable'}</button></div><div class="button-stack space-top-sm"><input class="inline-select" data-staff-password="${attr(item.id)}" type="password" minlength="14" maxlength="200" autocomplete="new-password" placeholder="New strong password"><button class="button button-secondary button-small" type="button" data-action="staff-reset-password" data-id="${attr(item.id)}">Reset password</button></div></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
async function renderSecurityView() {
  const staff=isFullAdmin()?asArray(await query('auth.staffList',null)):[];
  root.innerHTML = `<p class="section-intro">${isFullAdmin()?'Manage your administrator password and restricted staff access.':'Manage your own Control Center password. Your operational permissions are assigned by an administrator.'}</p>
    <div class="section-grid">
      <section class="panel"><div class="panel-head"><div><h2>My account security</h2><p>Changing your password invalidates earlier sessions.</p></div></div><div class="panel-body">${adminPasswordForm()}</div></section>
      ${isFullAdmin()?`<section class="panel"><div class="panel-head"><div><h2>Create staff access</h2><p>Create least-privilege accounts for restaurant and Rider operations.</p></div></div><div class="panel-body">${staffCreateForm()}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Staff access</h2><p>${number(staff.length)} restricted account${staff.length===1?'':'s'}. Role and status changes take effect immediately.</p></div></div><div class="panel-body">${staffTable(staff)}</div></section>`:''}
    </div>`;
}
async function renderAuditView() {
  const data = await operationsToolsData(); state.cache.audit = data;
  root.innerHTML = `<p class="section-intro">Review administrator actions, affected entities, timestamps and recorded action details.</p><section class="panel wide"><div class="panel-head"><div><h2>Operations audit</h2><p>Campaign, support, portal-access, rewards, broadcast and marketplace-control actions are recorded here.</p></div></div><div class="panel-body">${auditTable(data.audit)}</div></section>`;
}

async function renderOperationsTools() {
  const data = await operationsToolsData(); state.cache.ops = data;
  root.innerHTML = `<p class="section-intro">Functions from the former Operations portal are consolidated here so admin.afghaneats.net remains the single Afghan Eats administrator workspace.</p><div class="section-grid">
    <section class="panel wide"><div class="panel-head"><div><h2>Customer support queue</h2><p>Review verified customer cases and update their workflow state.</p></div></div><div class="panel-body">${customerSupportTable(data.supportCases)}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Create promotion</h2><p>Discounts are validated server-side at checkout.</p></div></div><div class="panel-body">${promotionForm()}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Promotion campaigns</h2><p>Activate or pause existing offers.</p></div></div><div class="panel-body">${promotionTable(data.promotions)}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Customer communications</h2><p>Send in-app service announcements or opt-in promotional broadcasts.</p></div>${badge(data.provider.configured ? 'enabled' : 'inactive')}</div><div class="panel-body"><div class="safety-card"><strong>${data.provider.configured ? 'External messaging provider configured' : 'External SMS / WhatsApp provider not configured'}</strong><p>${data.provider.configured ? `Provider: ${esc(data.provider.providerName || 'configured')} · ${esc(asArray(data.provider.channels).join(', '))}` : 'The Control Center will not claim an external SMS or WhatsApp send without a configured backend provider.'}</p></div>${broadcastForm()}</div></section>
    <section class="panel wide"><div class="panel-head"><div><h2>Administrator audit</h2><p>Recent administrative changes and security-sensitive control actions.</p></div></div><div class="panel-body">${auditTable(data.audit)}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Administrator security</h2><p>Change your password and invalidate earlier admin sessions.</p></div></div><div class="panel-body">${adminPasswordForm()}</div></section>
  </div>`;
}
function customerSupportTable(items) {
  const statuses = ['new','in_progress','waiting_customer','resolved','closed'];
  return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Case</th><th>Details</th><th>State</th><th>Control</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.reference)}</span><span class="row-sub">${esc(item.order_number || '')}</span></td><td>${esc(item.category || 'other')}<span class="row-sub">${esc(item.details || '')}</span></td><td>${badge(item.status)}<span class="row-sub">${esc(item.priority || '')}</span></td><td><div class="button-stack"><select class="inline-select" data-support-status="${attr(item.id)}">${statuses.map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${esc(status.replaceAll('_',' '))}</option>`).join('')}</select><button class="button button-primary button-small" data-action="customer-support-update" data-id="${attr(item.id)}">Update</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No customer support cases.</div>';
}
function promotionForm() {
  return `<form id="promotion-form" class="form-grid"><label class="field"><span>Code</span><input name="code" required maxlength="50" placeholder="HERAT10"></label><label class="field"><span>Campaign title</span><input name="title" required maxlength="240"></label><label class="field"><span>Discount type</span><select name="discountType"><option value="fixed">Fixed AFN</option><option value="percent">Percent</option><option value="free_delivery">Free delivery</option></select></label><label class="field"><span>Discount value</span><input name="discountValue" type="number" min="0" step="1" required value="0"></label><label class="field"><span>Maximum discount</span><input name="maxDiscount" type="number" min="0" step="1"></label><label class="field"><span>Minimum order</span><input name="minOrder" type="number" min="0" step="1" value="0"></label><label class="field"><span>Usage limit</span><input name="usageLimit" type="number" min="1" step="1"></label><label class="field full"><span>Description</span><textarea name="description" maxlength="1000" rows="2"></textarea></label><button class="button button-primary full" type="submit">Create campaign</button></form>`;
}
function promotionTable(items) {
  return items.length ? `<div class="activity-list">${items.map(item => `<div class="activity-row"><i class="activity-dot"></i><div class="flex-one"><p><strong>${esc(item.code)}</strong> · ${esc(item.title)}</p><small>${esc(item.discount_type)} · value ${number(item.discount_value)} · minimum ${money(item.min_order || 0)} · ${number(item.usage_count || 0)} uses${item.usage_limit ? ` / ${number(item.usage_limit)} limit` : ''}</small>${item.description ? `<small>${esc(item.description)}</small>` : ''}</div>${badge(item.active ? 'active' : 'inactive')}<button class="button button-secondary button-small" data-action="promotion-toggle" data-id="${attr(item.id)}" data-active="${item.active ? 'false' : 'true'}">${item.active ? 'Pause' : 'Activate'}</button></div>`).join('')}</div>` : '<div class="empty-state">No promotions have been created.</div>';
}
function broadcastForm() {
  return `<form id="broadcast-form" class="form-grid space-top-md"><label class="field"><span>Message type</span><select name="type"><option value="service_announcement">Service announcement</option><option value="promotion">Promotion</option></select></label><label class="field"><span>Audience</span><select name="audience"><option value="all_customers">All active customers</option><option value="promotions_opt_in">Promotions opt-in only</option></select></label><label class="field"><span>English title</span><input name="title" required maxlength="240"></label><label class="field"><span>Dari title</span><input name="titleDari" dir="rtl" maxlength="240"></label><label class="field full"><span>English message</span><textarea name="body" required minlength="3" maxlength="2000" rows="4"></textarea></label><label class="field full"><span>Dari message</span><textarea name="bodyDari" dir="rtl" maxlength="2000" rows="4"></textarea></label><button class="button button-primary full" type="submit">Send in-app broadcast</button></form>`;
}
function auditDetails(value) { try { const serialized=JSON.stringify(value || {}); return serialized==='{}' ? '—' : serialized; } catch { return '—'; } }
function auditTable(items) {
  return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Action</th><th>Entity</th><th>Administrator</th><th>Details</th><th>Time</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.action)}</span></td><td>${esc(item.entity_type || '')}<span class="row-sub">${esc(item.entity_id || '')}</span></td><td>${esc(item.admin_username || 'system')}</td><td><span class="row-sub">${esc(auditDetails(item.details))}</span></td><td>${shortDate(item.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No audit activity returned.</div>';
}
function adminPasswordForm() {
  return `<form id="admin-password-form" class="form-grid"><label class="field full"><span>Current password</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field full"><span>New password</span><input name="newPassword" type="password" minlength="14" maxlength="200" autocomplete="new-password" required></label><label class="field full"><span>Confirm new password</span><input name="confirmPassword" type="password" minlength="14" maxlength="200" autocomplete="new-password" required></label><div class="safety-card full"><strong>Password requirements</strong><p>At least 14 characters with uppercase and lowercase letters, a number and a symbol.</p></div><button class="button button-danger full" type="submit">Change admin password</button></form>`;
}

async function websiteData() { return query('platform.adminStatus', null); }
async function renderWebsite() { const data = await websiteData(); state.cache.website = data || {}; const controls = data?.controls || {}; const incidents = asArray(data?.incidents); root.innerHTML = `<p class="section-intro">Control only public operating state from this workspace. Pausing new orders is server-enforced and preserves browsing, order tracking, support, owner/rider portals, and active deliveries.</p><div class="section-grid"><section class="panel"><div class="panel-head"><div><h2>Marketplace reliability</h2><p>Checkout availability and public service banner.</p></div></div><div class="panel-body">${websiteForm(controls)}</div></section><section class="panel"><div class="panel-head"><div><h2>Incident history</h2><p>Resolve a public incident only after service recovery is verified.</p></div></div><div class="panel-body">${incidentList(incidents)}</div></section><section class="panel wide"><div class="panel-head"><div><h2>Customer website</h2><p>Public Afghan Eats storefront and the source repository used for feature releases.</p></div></div><div class="panel-body"><div class="button-stack"><a class="button button-secondary" href="https://afghaneats.net" target="_blank" rel="noopener noreferrer">Open public site ↗</a><a class="button button-secondary" href="https://github.com/abqaderahmadi214-ux/afghan-eats-website" target="_blank" rel="noopener noreferrer">Open website source ↗</a></div><div class="safety-card space-top-sm"><strong>Publication boundary</strong><p>This control center manages runtime marketplace operations. Website layout, copy, and release changes remain source-controlled in the Afghan Eats website repository and deploy through its connected Netlify project.</p></div></div></section></div>`; }
function websiteForm(c) { return `<form id="website-form" class="form-grid"><label class="switch-row full"><span><b>New customer ordering</b><small>When paused, existing orders and support remain online.</small></span><span class="switch"><input name="orderingEnabled" type="checkbox" ${c.ordering_enabled !== false ? 'checked' : ''}><span></span></span></label><label class="field"><span>Public banner severity</span><select name="bannerLevel"><option value="info" ${c.banner_level === 'info' ? 'selected' : ''}>Info</option><option value="warning" ${c.banner_level === 'warning' ? 'selected' : ''}>Warning</option><option value="critical" ${c.banner_level === 'critical' ? 'selected' : ''}>Critical</option></select></label><label class="switch-row"><span><b>Public service banner</b><small>Show an informational service notice on the customer site.</small></span><span class="switch"><input name="bannerEnabled" type="checkbox" ${c.banner_enabled ? 'checked' : ''}><span></span></span></label><label class="field"><span>Ordering pause message — English</span><textarea name="orderingMessageEn">${esc(c.ordering_message_en || '')}</textarea></label><label class="field"><span>Ordering pause message — Dari</span><textarea name="orderingMessageDari" dir="rtl">${esc(c.ordering_message_dari || '')}</textarea></label><label class="field"><span>Banner title — English</span><input name="bannerTitleEn" value="${attr(c.banner_title_en || '')}"></label><label class="field"><span>Banner title — Dari</span><input name="bannerTitleDari" dir="rtl" value="${attr(c.banner_title_dari || '')}"></label><label class="field"><span>Banner message — English</span><textarea name="bannerBodyEn">${esc(c.banner_body_en || '')}</textarea></label><label class="field"><span>Banner message — Dari</span><textarea name="bannerBodyDari" dir="rtl">${esc(c.banner_body_dari || '')}</textarea></label><button class="button button-primary full" type="submit">Save website reliability controls</button></form>`; }
function incidentList(items) { const active = items.filter(item => item.status !== 'resolved'); return active.length ? `<div class="activity-list">${active.map(item => `<div class="activity-row"><i class="activity-dot"></i><div class="flex-one"><p><strong>${esc(item.title_en || 'Service incident')}</strong> ${badge(item.severity)}</p><small>${esc(item.message_en || '')} · ${shortDate(item.started_at)}</small></div><button class="button button-secondary button-small" data-action="incident-status" data-id="${attr(item.id)}" data-status="resolved">Resolve</button></div>`).join('')}</div>` : '<div class="empty-state">No active incidents are recorded.</div>'; }
function ordersTable(items, includeControls) { return items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th>${includeControls ? '<th>Control</th>' : ''}</tr></thead><tbody>${items.map(item => `<tr><td><span class="row-title">${esc(item.order_number || item.id)}</span><span class="row-sub">${shortDate(item.created_at)}</span></td><td>${esc(item.customer_name || 'Customer')}<span class="row-sub">${esc(item.customer_phone || 'No phone')} · ${esc(item.delivery_address || '')}</span></td><td>${money(item.total)}</td><td>${badge(item.status)}</td>${includeControls ? '<td>Open Dispatch</td>' : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No orders were returned by the platform.</div>'; }

async function action(event) {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const type = target.dataset.action; const id = target.dataset.id;
  if (type === 'refresh-view') return renderView();
  if (type === 'market-toggle') {
    const open = target.dataset.open === 'true', controls = state.cache.overview?.platform?.controls || state.cache.website?.controls || {};
    const payload = {
      orderingEnabled: open,
      orderingMessageEn: open ? null : (controls.ordering_message_en || 'Ordering is temporarily paused by Afghan Eats operations. Please try again later.'),
      orderingMessageDari: open ? null : (controls.ordering_message_dari || 'ثبت سفارش به طور موقت از سوی عملیات افغان ایتس متوقف شده است. لطفاً بعداً دوباره تلاش کنید.'),
      bannerEnabled: Boolean(controls.banner_enabled), bannerLevel: controls.banner_level || 'info',
      bannerTitleEn: controls.banner_title_en || null, bannerTitleDari: controls.banner_title_dari || null,
      bannerBodyEn: controls.banner_body_en || null, bannerBodyDari: controls.banner_body_dari || null,
    };
    return openConfirm(open ? 'Open Afghan Eats market' : 'Close Afghan Eats market', open ? 'Allow new customer checkout and order creation now?' : 'Stop all new customer checkout now? Existing orders, tracking, support and active deliveries will continue.', async () => { await mutate('platform.adminUpdateControls', payload); toast(open ? 'Afghan Eats market is open.' : 'Afghan Eats market is closed.'); renderView(); });
  }
  if (type === 'auto-dispatch-toggle') {
    const enabled = target.dataset.enabled === 'true';
    return openConfirm(enabled ? 'Enable automatic Rider assignment' : 'Disable automatic Rider assignment', enabled ? 'New eligible delivery orders may be assigned automatically to a free Rider who is inside an active approved shift.' : 'Stop automatic Rider assignment. Manual dispatch remains available.', async () => { await mutate('dispatch.adminUpdateSettings', { autoDispatchEnabled: enabled }); toast(`Automatic dispatch ${enabled ? 'enabled' : 'disabled'}.`); renderView(); }, enabled ? false : true);
  }
  if (type === 'staff-google-approve') { const role=document.querySelector(`[data-staff-role="${CSS.escape(id)}"]`)?.value; if(!role)return; return openConfirm('Approve Google staff access',`Approve this Google account as ${staffRoleLabel(role)}? The account will be able to sign in immediately after approval.`,async()=>{await mutate('auth.staffApprove',{id:Number(id),role});toast('Google staff access approved.');renderView();},false); }
  if (type === 'staff-google-reject') { return openConfirm('Reject Google staff request','Reject this pending Google staff access request? The account will not be able to enter the Control Center.',async()=>{await mutate('auth.staffReject',{id:Number(id)});toast('Google staff request rejected.');renderView();},true); }
  if (type === 'staff-role-save') { const role=document.querySelector(`[data-staff-role="${CSS.escape(id)}"]`)?.value; if(!role)return; return openConfirm('Change staff access',`Change this account to ${staffRoleLabel(role)}? Active sessions for the account will be invalidated.`,async()=>{await mutate('auth.staffUpdate',{id:Number(id),role});toast('Staff access role updated.');renderView();},false); }
  if (type === 'staff-active') { const active=target.dataset.active==='true'; return openConfirm(active?'Enable staff account':'Disable staff account',active?'Restore this restricted staff account?':'Disable this staff account immediately and invalidate its active sessions?',async()=>{await mutate('auth.staffUpdate',{id:Number(id),active});toast(`Staff account ${active?'enabled':'disabled'}.`);renderView();},!active); }
  if (type === 'staff-reset-password') { const input=document.querySelector(`[data-staff-password="${CSS.escape(id)}"]`),newPassword=String(input?.value||''); const strong=newPassword.length>=14&&/[a-z]/.test(newPassword)&&/[A-Z]/.test(newPassword)&&/\d/.test(newPassword)&&/[^A-Za-z0-9]/.test(newPassword); if(!strong)return toast('Use at least 14 characters with uppercase and lowercase letters, a number and a symbol.','error'); return openConfirm('Reset staff password','Set this new password and invalidate all active sessions for the staff account?',async()=>{await mutate('auth.staffResetPassword',{id:Number(id),newPassword});toast('Staff password reset.');renderView();}); }
  if (type === 'rider-availability-review') {
    const status = target.dataset.status;
    return openConfirm(status === 'approved' ? 'Approve Rider availability' : 'Reject Rider availability', status === 'approved' ? 'Approve this availability block and create the confirmed Rider shift?' : 'Reject this Rider availability request?', async () => { await mutate('riderOperations.adminReviewAvailability', { id, status }); toast(`Rider availability ${status}.`); renderView(); }, status !== 'approved');
  }
  if (type === 'rider-shift-cancel') return openConfirm('Cancel Rider shift', 'Cancel this open or assigned Rider shift? It will no longer make the Rider eligible for new jobs.', async () => { await mutate('riderOperations.adminCancelShift', { id }); toast('Rider shift cancelled.'); renderView(); });
  if (type === 'rider-timeoff-review') {
    const status = target.dataset.status;
    return openConfirm(`${title(status)} Rider time off`, `${title(status)} this Rider time-off request?`, async () => { await mutate('riderOperations.adminReviewTimeOff', { id, status }); toast(`Time-off request ${status}.`); renderView(); }, status !== 'approved');
  }
  if (type === 'rider-support-open') { state.riderSupportThread = await query('riderChat.adminSupportThread', { threadId: id }); return renderView(); }
  if (type === 'rider-support-close') { state.riderSupportThread = null; return renderView(); }
  if (type === 'customer-support-update') {
    const status = document.querySelector(`[data-support-status="${CSS.escape(id)}"]`)?.value; if (!status) return;
    return openConfirm('Update customer support case', `Set this case to “${status.replaceAll('_',' ')}”?`, async () => { await mutate('trust.adminUpdateSupportCase', { id, status }); toast('Support case updated.'); renderView(); }, false);
  }
  if (type === 'promotion-toggle') {
    const active = target.dataset.active === 'true';
    return openConfirm(active ? 'Activate promotion' : 'Pause promotion', active ? 'Activate this promotion for eligible checkout requests?' : 'Pause this promotion for new checkout requests?', async () => { await mutate('trust.adminUpdatePromotion', { id, active }); toast(`Promotion ${active ? 'activated' : 'paused'}.`); renderView(); }, !active);
  }
  if (type === 'assign-rider') { const select = document.querySelector(`[data-order-rider="${CSS.escape(id)}"]`); if (!select?.value) return toast('Choose a rider before assigning.', 'error'); return openConfirm('Assign rider', 'Assign this rider to the active order?', async () => { await mutate('operations.adminAssignRider', { orderId: id, riderId: select.value }); toast('Rider assigned.'); renderView(); }, false); }
  if (type === 'update-assignment') { const select = document.querySelector(`[data-assignment-status="${CSS.escape(id)}"]`); if (!select?.value) return; return openConfirm('Update delivery status', `Set this delivery assignment to “${select.value.replaceAll('_', ' ')}”?`, async () => { await mutate('operations.adminUpdateAssignment', { id, status: select.value }); toast('Delivery status updated.'); renderView(); }, false); }
  if (type === 'edit-restaurant') { state.restaurantEditId=id; await renderRestaurants(); document.getElementById('restaurant-edit-panel')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
  if (type === 'cancel-restaurant-edit') { state.restaurantEditId=null; return renderRestaurants(); }
  if (type === 'open-restaurant-create') { const panel = document.getElementById('restaurant-create-panel'); panel?.classList.remove('hidden'); panel?.scrollIntoView({ behavior: 'smooth', block: 'start' }); window.setTimeout(() => document.querySelector('#restaurant-create-form [name="name"]')?.focus(), 180); return; }
  if (type === 'cancel-restaurant-create') { const panel = document.getElementById('restaurant-create-panel'); document.getElementById('restaurant-create-form')?.reset(); panel?.classList.add('hidden'); return; }
  if (type === 'open-owner-setup-review') { state.partnerReviewId=null; state.setupReviewId=id; await renderRestaurants(); document.getElementById('owner-setup-review-workspace')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
  if (type === 'close-owner-setup-review') { state.setupReviewId=null; await renderRestaurants(); document.querySelector('.review-card')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  if (type === 'open-partner-application-review') {
    state.setupReviewId=null; state.partnerReviewId=id; state.partnerReviewDetail=null;
    loading('Loading complete restaurant dossier…');
    try {
      state.partnerReviewDetail=await query('operations.adminPartnerApplicationDetail',{id});
      await renderRestaurants();
      document.getElementById('partner-application-review-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {
      state.partnerReviewId=null; state.partnerReviewDetail=null;
      setNotice(error.message||'Restaurant application dossier could not be loaded.');
    }
    return;
  }
  if (type === 'close-partner-application-review') { state.partnerReviewId=null; state.partnerReviewDetail=null; await renderRestaurants(); document.querySelector('[data-action="open-partner-application-review"]')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  if (type === 'review-owner-setup') { const decision = target.dataset.decision; const name = target.dataset.name || 'this restaurant'; const note = String(document.querySelector(`[data-setup-review-note="${CSS.escape(id)}"]`)?.value || '').trim(); if (decision === 'changes_requested' && !note) return toast('Explain the required changes before returning this setup to the restaurant owner.', 'error'); const approve = decision === 'approved'; return openConfirm(approve ? 'Approve and activate restaurant' : 'Request restaurant setup changes', approve ? `Approve ${name}'s submitted profile, menu, pricing, delivery and images, then activate its public listing for customer ordering?` : `Return ${name}'s submitted setup to the owner with your required changes. The restaurant will remain inactive until it is corrected and resubmitted.`, async () => { const result = await mutate('portal.adminReviewSetupSubmission', { id, decision, adminNote: note || null, activateListing: approve }); state.setupReviewId=null; toast(result?.listingActivated ? 'Restaurant setup approved and public listing activated.' : 'Restaurant setup returned for changes.'); renderView(); }); }
  if (type === 'remove-restaurant') { const name = target.dataset.name || 'this restaurant'; return openConfirm('Remove restaurant from marketplace', `Remove ${name} from customer ordering? This safely deactivates its public listing and preserves historical orders and operational records.`, async () => { await mutate('restaurants.adminToggleStatus', { id, status: 'inactive' }); toast('Restaurant removed from customer ordering.'); renderView(); }); }
  if (type === 'toggle-listing') { const next = target.dataset.status; return openConfirm('Restore public listing', 'Make this restaurant available for customer ordering after its menu, pricing, delivery and owner setup have been checked.', async () => { await mutate('restaurants.adminToggleStatus', { id, status: next }); toast('Restaurant listing restored.'); renderView(); }); }
  if (type === 'open-rider-application-review') {
    state.riderReviewId=id;
    loading('Loading private rider verification…');
    try {
      state.riderReviewDetail=await query('operations.adminRiderApplicationDetail',{id});
      await renderRiders();
      document.getElementById('rider-application-review-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {
      state.riderReviewId=null;
      state.riderReviewDetail=null;
      setNotice(error.message||'Rider verification could not be loaded.');
    }
    return;
  }
  if (type === 'close-rider-application-review') {
    state.riderReviewId=null;
    state.riderReviewDetail=null;
    await renderRiders();
    return;
  }
  if (type === 'open-rider-document') {
    const doc=asArray(state.riderReviewDetail?.documents).find(item=>String(item.id)===String(id));
    try { openPrivateRiderDocument(doc); } catch(error) { toast(error.message||'Private document could not be opened.','error'); }
    return;
  }
  if (type === 'review-rider-document') {
    const status=target.dataset.status;
    const note=String(document.querySelector(`[data-rider-document-note="${CSS.escape(id)}"]`)?.value||'').trim();
    if(status==='rejected'&&!note)return toast('Explain why this rider document is being rejected.','error');
    const doc=asArray(state.riderReviewDetail?.documents).find(item=>String(item.id)===String(id));
    const label=riderDocumentLabel(doc?.document_type);
    return openConfirm(
      status==='approved'?'Approve rider document':'Reject rider document',
      status==='approved'
        ?`Confirm that you reviewed ${label} and it matches the applicant information.`
        :`Reject ${label} and record the reason for the applicant/operations record.`,
      async()=>{
        await mutate('operations.adminReviewRiderDocument',{id,status,note:note||undefined});
        state.riderReviewDetail=await query('operations.adminRiderApplicationDetail',{id:state.riderReviewId});
        toast(`${label} marked ${status}.`,status==='approved'?'success':'error');
        await renderRiders();
        document.getElementById('rider-application-review-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
      },
      status==='rejected'
    );
  }
  if (type === 'application-status') { const status=target.dataset.status,isPartner=target.dataset.type==='partner',isRider=target.dataset.type==='rider',domain=isPartner?'restaurant application':'rider application',endpoint=isPartner?'operations.adminUpdatePartnerApplication':'operations.adminUpdateRiderApplication'; const note=isPartner?String(document.querySelector(`[data-partner-review-note="${CSS.escape(id)}"]`)?.value||'').trim():isRider?String(document.querySelector(`[data-rider-review-note="${CSS.escape(id)}"]`)?.value||'').trim():''; if(isRider&&status==='rejected'&&!note)return toast('Record why the rider application is being rejected.','error'); return openConfirm(`${title(status)} ${domain}`,status==='approved'&&isRider?'Approve this Rider only after confirming the verified email, personal information, National ID and required driving licence evidence. A secure Rider portal activation email will be issued automatically.':`Confirm that this ${domain} should be marked “${status}”.`,async()=>{ const result=await mutate(endpoint,{id,status,adminNotes:note||undefined}); if(isPartner){if(status==='approved'&&result?.ownerAccess){const access=result.ownerAccess;toast(access.emailSent?(access.alreadyActivated?'Restaurant approved. Owner was notified by email and can sign in with the existing portal password.':'Restaurant approved. Owner activation email sent with username and secure set-password link.'):'Restaurant approved and owner portal access created, but the approval email was not delivered. Reissue the activation link from Portal access.',access.emailSent?'success':'error')}else toast(`${title(domain)} updated.`);if(status==='reviewing'&&state.partnerReviewId){state.partnerReviewDetail=await query('operations.adminPartnerApplicationDetail',{id:state.partnerReviewId})}else{state.partnerReviewId=null;state.partnerReviewDetail=null;}}else if(isRider){if(status==='approved'&&result?.riderAccess){const access=result.riderAccess;toast(access.alreadyActivated?'Rider approved. Existing Rider portal access remains active.':access.emailSent?'Rider approved. Secure portal activation email sent with the Rider username and set-password link.':'Rider approved and portal access created, but the activation email was not delivered. Reissue the activation invite from Portal access.',access.alreadyActivated||access.emailSent?'success':'error')}else toast(`${title(domain)} updated.`);if(status==='reviewing'&&state.riderReviewId){state.riderReviewDetail=await query('operations.adminRiderApplicationDetail',{id:state.riderReviewId})}else{state.riderReviewId=null;state.riderReviewDetail=null}}else toast(`${title(domain)} updated.`);renderView();},status!=='reviewing'); }
  if (type === 'rider-availability') { const available = target.dataset.available === 'true'; return openConfirm(available ? 'Set rider available' : 'Set rider busy', available ? 'This rider will become selectable for appropriate dispatch assignments.' : 'This rider will not be presented as available for new dispatch assignments.', async () => { await mutate('operations.adminUpdateRider', { id, isAvailable: available }); toast(`Rider set ${available ? 'available' : 'busy'}.`); renderView(); }, false); }
  if (type === 'customer-active') { const active = target.dataset.active === 'true'; return openConfirm(active ? 'Enable customer account' : 'Disable customer account', active ? 'Restore this customer’s ability to use authenticated account services.' : 'Disable this customer account and invalidate its customer API session.', async () => { await mutate('customer.adminSetActive', { userId: Number(id), active }); toast(`Customer account ${active ? 'enabled' : 'disabled'}.`); renderView(); }); }
  if (type === 'portal-active') { const active = target.dataset.active === 'true'; return openConfirm(active ? 'Enable portal account' : 'Disable portal account', active ? 'Restore this owner or rider workspace.' : 'Disable this owner or rider workspace. The person will no longer be able to use the portal.', async () => { await mutate('portal.adminSetAccountActive', { id, active }); toast(`Portal account ${active ? 'enabled' : 'disabled'}.`); renderView(); }); }
  if (type === 'portal-listing-status') { const status = target.dataset.status; return openConfirm(status === 'active' ? 'Activate restaurant listing' : 'Pause restaurant listing', status === 'active' ? 'Make this owner restaurant available for customer ordering after menu, pricing and delivery setup have been checked?' : 'Remove this owner restaurant from new customer ordering while preserving historical orders.', async () => { await mutate('restaurants.adminToggleStatus', { id, status }); toast(status === 'active' ? 'Restaurant listing activated.' : 'Restaurant listing paused.'); renderView(); }, status !== 'active'); }
  if (type === 'create-assisted-recovery') { const note = String(document.querySelector(`[data-recovery-note="${CSS.escape(id)}"]`)?.value || '').trim(); const accountId = String(document.querySelector(`[data-recovery-account="${CSS.escape(id)}"]`)?.value || ''); if (!accountId) return toast('Select the verified active portal account before creating a recovery link.', 'error'); if (note.length < 3) return toast('Record how you verified the applicant before creating a recovery link.', 'error'); const name = target.dataset.name || 'this applicant'; return openConfirm('Create private recovery link', `Confirm that you verified ${name} outside the system and selected the correct active portal account. The one-time link will show the portal username and allow a new password to be set. Send it only through a trusted channel.`, async () => { const result = await mutate('portal.adminCreateAssistedRecoveryLink', { requestId: id, portalAccountId: accountId, verificationNote: note }); state.recoveryLink = { ...result, url: `https://afghaneats.net/portal-recovery?token=${encodeURIComponent(result.recoveryToken)}` }; toast('Private one-time recovery link created.'); renderView(); }); }
  if (type === 'reject-assisted-recovery') { const note = String(document.querySelector(`[data-recovery-note="${CSS.escape(id)}"]`)?.value || '').trim(); if (note.length < 3) return toast('Record why this recovery request cannot be verified.', 'error'); const name = target.dataset.name || 'this applicant'; return openConfirm('Reject recovery request', `Reject ${name}'s recovery request? Record only operational verification information; do not include passwords or secrets.`, async () => { await mutate('portal.adminRejectAssistedRecovery', { requestId: id, adminNote: note }); toast('Recovery request rejected.'); renderView(); }); }
  if (type === 'copy-recovery-link') { const text = state.recoveryLink?.url || ''; if (!text) return; await navigator.clipboard.writeText(text); return toast('Secure recovery link copied to the clipboard.'); }
  if (type === 'create-invite') { const candidateType = target.dataset.type; return openConfirm('Create secure activation invite', 'Create a one-time, time-limited invitation for this approved person. Send the activation link only through a private trusted channel.', async () => { const result = await mutate('portal.adminCreateInvite', { type: candidateType, applicationId: id }); if(!/^[a-f0-9]{64}$/i.test(String(result.activationToken||''))) throw new Error('The backend did not return a valid activation token.'); state.invite = { ...result, url: `https://afghaneats.net/activate.html?token=${encodeURIComponent(result.activationToken)}` }; toast(result.emailSent?'Secure activation invite created and emailed.':'Secure activation invite created. Email was not delivered; copy the private link and send it through a trusted channel.',result.emailSent?'success':'error'); renderView(); }); }
  if (type === 'reissue-activation-invite') { const name = target.dataset.name || 'this portal account'; return openConfirm('Reissue activation link', `Create a fresh 72-hour activation link for ${name}? Any older unused activation invitation for this account will immediately expire.`, async () => { const result = await mutate('portal.adminReissueActivationInvite', { accountId: id }); if(!/^[a-f0-9]{64}$/i.test(String(result.activationToken||''))) throw new Error('The backend did not return a valid activation token.'); state.invite = { ...result, reissued: true, url: `https://afghaneats.net/activate.html?token=${encodeURIComponent(result.activationToken)}` }; toast(result.emailSent?'Fresh activation link created and emailed. Older unused links were expired.':'Fresh activation link created, but email was not delivered. Older unused links were expired; copy the new private link and send it through a trusted channel.',result.emailSent?'success':'error'); renderView(); }, false); }
  if (type === 'copy-invite') { const text = state.invite?.url || ''; if (!text) return; await navigator.clipboard.writeText(text); return toast('Secure activation link copied to the clipboard.'); }
  if (type === 'edit-career-position') { state.careerEdit = id; return renderView(); }
  if (type === 'cancel-career-edit') { state.careerEdit = null; return renderView(); }
  if (type === 'toggle-career-position') { const nextStatus = target.dataset.status; const position = state.cache.careers?.positions?.find(item => String(item.id) === String(id)); const name = position?.title || 'this vacancy'; return openConfirm(nextStatus === 'open' ? 'Open vacancy publicly' : 'Close vacancy to new applicants', nextStatus === 'open' ? `Publish ${name} on the public Afghan Eats Careers page so candidates can apply.` : `Close ${name} to new applications. Existing applications will be preserved for review.`, async () => { await mutate('operations.adminUpdateCareerPosition', { id: position.id, title: position.title, titleDari: position.title_dari || undefined, department: position.department, employmentType: position.employment_type, location: position.location, workMode: position.work_mode, summary: position.summary, responsibilities: position.responsibilities || undefined, requirements: position.requirements || undefined, benefits: position.benefits || undefined, applicationDeadline: position.application_deadline ? new Date(position.application_deadline).toISOString() : null, status: nextStatus }); toast(nextStatus === 'open' ? 'Vacancy is now live on the Careers page.' : 'Vacancy closed to new applications.'); renderView(); }, nextStatus !== 'open'); }
  if (type === 'review-career-application') { const status = String(document.querySelector(`[data-career-status="${CSS.escape(id)}"]`)?.value || ''); const note = String(document.querySelector(`[data-career-note="${CSS.escape(id)}"]`)?.value || '').trim(); if (['rejected','hired'].includes(status) && note.length < 1) return toast('Add an internal note before finalizing this candidate decision.', 'error'); const name = target.dataset.name || 'this candidate'; return openConfirm('Save candidate review', `Save the ${status.replaceAll('_', ' ')} status for ${name}? Keep internal notes professional and do not record passwords or identity-document numbers.`, async () => { await mutate('operations.adminReviewCareerApplication', { id, status, adminNote: note || undefined }); toast('Candidate review saved.'); renderView(); }, ['rejected','hired'].includes(status)); }
  if (type === 'incident-status') { return openConfirm('Resolve public incident', 'Mark this incident resolved only after the service issue has been verified as recovered.', async () => { await mutate('platform.adminUpdateIncident', { id, status: target.dataset.status }); toast('Incident marked resolved.'); renderView(); }); }
}

root.addEventListener('click', action);
root.addEventListener('submit', event => {
  const form = event.target;
  const formId = form?.getAttribute?.('id') || '';
  if (formId === 'rider-shift-form') {
    event.preventDefault(); const d = new FormData(form);
    let startsAt, endsAt; try { startsAt = kabulIso(d.get('startsAt')); endsAt = kabulIso(d.get('endsAt')); } catch (error) { return setNotice(error.message); }
    if (new Date(endsAt) <= new Date(startsAt)) return setNotice('Shift end must be after shift start.');
    const riderId = String(d.get('riderId') || '').trim() || null;
    const payload = { title: String(d.get('title') || 'Rider shift').trim() || 'Rider shift', serviceArea: String(d.get('serviceArea') || '').trim() || undefined, startsAt, endsAt, riderId, note: String(d.get('note') || '').trim() || undefined };
    return openConfirm(riderId ? 'Schedule Rider shift' : 'Publish open Rider shift', riderId ? 'Create this confirmed shift for the selected Rider? The Rider will be notified.' : 'Publish this open shift to active Riders so an interested eligible Rider can claim it?', async () => { await mutate('riderOperations.adminCreateShift', payload); toast(riderId ? 'Rider shift scheduled and Rider notified.' : 'Open shift published and Riders notified.'); form.reset(); renderView(); }, false);
  }
  if (formId === 'rider-support-reply-form') {
    event.preventDefault(); const d = new FormData(form), threadId = String(d.get('threadId') || ''), body = String(d.get('body') || '').trim();
    if (!threadId || !body) return;
    return openConfirm('Send Rider support reply', 'Send this message to the Rider support conversation?', async () => { await mutate('riderChat.adminSupportReply', { threadId, body }); state.riderSupportThread = await query('riderChat.adminSupportThread', { threadId }); toast('Reply sent to Rider support.'); renderView(); }, false);
  }
  if (formId === 'promotion-form') {
    event.preventDefault(); const d = new FormData(form);
    const payload = { code: String(d.get('code') || '').trim(), title: String(d.get('title') || '').trim(), description: String(d.get('description') || '').trim(), discountType: String(d.get('discountType') || 'fixed'), discountValue: Number(d.get('discountValue') || 0), maxDiscount: d.get('maxDiscount') ? Number(d.get('maxDiscount')) : undefined, minOrder: Number(d.get('minOrder') || 0), usageLimit: d.get('usageLimit') ? Number(d.get('usageLimit')) : undefined };
    return openConfirm('Create promotion campaign', `Create promotion ${payload.code} with server-side checkout validation?`, async () => { await mutate('trust.adminCreatePromotion', payload); toast('Promotion created.'); form.reset(); renderView(); }, false);
  }
  if (formId === 'broadcast-form') {
    event.preventDefault(); const d = new FormData(form), type = String(d.get('type') || 'service_announcement');
    const payload = { type, audience: type === 'promotion' ? 'promotions_opt_in' : String(d.get('audience') || 'all_customers'), title: String(d.get('title') || '').trim(), titleDari: String(d.get('titleDari') || '').trim(), body: String(d.get('body') || '').trim(), bodyDari: String(d.get('bodyDari') || '').trim() };
    return openConfirm('Send in-app customer broadcast', type === 'promotion' ? 'Send this only to customers who opted in to promotions?' : 'Send this service announcement to the selected active customer audience?', async () => { const result = await mutate('communications.adminBroadcast', payload); toast(`Broadcast queued for ${number(result?.recipientCount || 0)} customer account(s).`); form.reset(); renderView(); }, false);
  }
  if (formId === 'admin-password-form') {
    event.preventDefault(); const d = new FormData(form), currentPassword = String(d.get('currentPassword') || ''), newPassword = String(d.get('newPassword') || ''), confirmPassword = String(d.get('confirmPassword') || '');
    const strong = newPassword.length >= 14 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
    if (!strong) return setNotice('Use at least 14 characters with uppercase and lowercase letters, a number and a symbol.');
    if (newPassword !== confirmPassword) return setNotice('The new passwords do not match.');
    if (newPassword === currentPassword) return setNotice('Choose a new password that is different from the current password.');
    return openConfirm('Change administrator password', 'Change your administrator password and invalidate earlier admin sessions?', async () => { await mutate('auth.changePassword', { currentPassword, newPassword }); form.reset(); logout(false); const loginError = document.getElementById('login-error'); loginError.textContent = 'Password updated. Sign in again with the new password.'; loginError.className = 'notice notice-success'; }, true);
  }
  if (formId === 'career-position-form') { event.preventDefault(); const d = new FormData(form); const existingId = String(d.get('id') || ''); const deadline = String(d.get('applicationDeadline') || '').trim(); const payload = { title: String(d.get('title') || '').trim(), titleDari: String(d.get('titleDari') || '').trim() || undefined, department: String(d.get('department') || '').trim(), employmentType: String(d.get('employmentType') || 'full_time'), location: String(d.get('location') || '').trim(), workMode: String(d.get('workMode') || 'on_site'), summary: String(d.get('summary') || '').trim(), responsibilities: String(d.get('responsibilities') || '').trim() || undefined, requirements: String(d.get('requirements') || '').trim() || undefined, benefits: String(d.get('benefits') || '').trim() || undefined, applicationDeadline: deadline ? new Date(`${deadline}T23:59:59.999Z`).toISOString() : null, status: String(d.get('status') || 'draft') }; if (!payload.title || !payload.department || !payload.location || !payload.summary) return setNotice('Complete the role title, department, location and role summary before saving.'); return openConfirm(existingId ? 'Update vacancy' : 'Create vacancy', existingId ? `Save the updated details and publication state for ${payload.title}?` : `Create ${payload.title} as a ${payload.status} vacancy? Only open vacancies appear publicly on Afghan Eats Careers.`, async () => { if (existingId) await mutate('operations.adminUpdateCareerPosition', { id: existingId, ...payload }); else await mutate('operations.adminCreateCareerPosition', payload); state.careerEdit = null; toast(existingId ? 'Vacancy updated.' : 'Vacancy created.'); renderView(); }, payload.status !== 'draft'); }
  if (formId === 'staff-create-form') { event.preventDefault(); const d=new FormData(form),password=String(d.get('password')||''); const strong=password.length>=14&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password); if(!strong)return setNotice('Staff password must be at least 14 characters and include uppercase and lowercase letters, a number and a symbol.'); const payload={username:String(d.get('username')||'').trim(),email:String(d.get('email')||'').trim(),role:String(d.get('role')||'restaurant_staff'),password}; return openConfirm('Create restricted staff account',`Create ${payload.username} with ${staffRoleLabel(payload.role)} access?`,async()=>{await mutate('auth.staffCreate',payload);form.reset();toast('Restricted staff account created.');renderView();},false); }
  if (formId === 'restaurant-create-form') { event.preventDefault(); const d=new FormData(form),payload=restaurantFormPayload(form,d); if(!payload.name)return setNotice('Restaurant name is required.'); if(payload.delivery_time_min!==null&&payload.delivery_time_max!==null&&payload.delivery_time_max<payload.delivery_time_min)return setNotice('Delivery time maximum must be equal to or greater than the minimum.'); return openConfirm('Create inactive restaurant',`Create ${payload.name} as an inactive, closed restaurant draft?`,async()=>{await mutate('restaurants.adminCreate',payload);toast('Inactive restaurant draft created.');form.reset();renderView();},false); }
  if (formId === 'restaurant-edit-form') { event.preventDefault(); const d=new FormData(form),id=String(d.get('restaurantId')||''),payload=restaurantFormPayload(form,d); if(!id||!payload.name)return setNotice('Restaurant identity and name are required.'); if(payload.delivery_time_min!==null&&payload.delivery_time_max!==null&&payload.delivery_time_max<payload.delivery_time_min)return setNotice('Delivery time maximum must be equal to or greater than the minimum.'); return openConfirm('Save restaurant changes',`Save the updated details for ${payload.name}? The listing status will not be changed.`,async()=>{await mutate('restaurants.adminUpdate',{id,...payload});state.restaurantEditId=null;toast('Restaurant details updated.');renderView();},false); }
  if (formId === 'rewards-form') { event.preventDefault(); const d = new FormData(form); return openConfirm('Save rewards controls', 'Apply the new loyalty earning and referral settings for customer accounts.', async () => { await mutate('customer.adminUpdateSettings', { enabled: form.elements.enabled.checked, pointsPer100Afn: Number(d.get('pointsPer100Afn') || 0), referralEnabled: form.elements.referralEnabled.checked, referralPoints: Number(d.get('referralPoints') || 0) }); toast('Rewards controls saved.'); renderView(); }, false); }
  if (formId === 'website-form') { event.preventDefault(); const d = new FormData(form); const payload = { orderingEnabled: form.elements.orderingEnabled.checked, orderingMessageEn: String(d.get('orderingMessageEn') || '') || null, orderingMessageDari: String(d.get('orderingMessageDari') || '') || null, bannerEnabled: form.elements.bannerEnabled.checked, bannerLevel: String(d.get('bannerLevel') || 'info'), bannerTitleEn: String(d.get('bannerTitleEn') || '') || null, bannerTitleDari: String(d.get('bannerTitleDari') || '') || null, bannerBodyEn: String(d.get('bannerBodyEn') || '') || null, bannerBodyDari: String(d.get('bannerBodyDari') || '') || null }; const paused = state.cache.website?.controls?.ordering_enabled !== false && !payload.orderingEnabled; return openConfirm(paused ? 'Pause all new customer ordering' : 'Save public-site controls', paused ? 'This server-enforced action stops new checkout only. Existing orders, browsing, tracking, support, and active deliveries remain available.' : 'Publish the new public service-banner and marketplace-reliability controls.', async () => { await mutate('platform.adminUpdateControls', payload); toast('Public-site controls saved.'); renderView(); }); }
}, true);

document.getElementById('login-form').addEventListener('submit', async event => { event.preventDefault(); const error = document.getElementById('login-error'); error.className = 'notice notice-error hidden'; const button = event.currentTarget.querySelector('button'); button.disabled = true; button.textContent = 'Signing in…'; try { const fd = new FormData(event.currentTarget); const response = await request('auth.login', { username: String(fd.get('username') || ''), password: String(fd.get('password') || '') }, 'POST', false); if (!response?.token) throw new Error('Sign-in did not return a valid session.'); saveSession(response.token, response.admin || response.user || {}); await verifySession(); setShell(); setView(location.hash.slice(1) || 'overview'); } catch (err) { error.textContent = err.message || 'Sign-in failed.'; error.classList.remove('hidden'); } finally { button.disabled = false; button.textContent = 'Sign in securely'; } });
document.getElementById('logout-button').addEventListener('click', () => logout());
document.getElementById('refresh-button').addEventListener('click', () => renderView());
window.addEventListener('hashchange', () => setView(location.hash.slice(1) || 'overview'));

document.addEventListener('DOMContentLoaded', async () => { if (!state.token) { initGoogleStaffSignIn(); return; } try { await verifySession(); setShell(); setView(state.view); } catch { logout(false); document.getElementById('login-error').textContent = 'Your session has expired. Please sign in again.'; document.getElementById('login-error').classList.remove('hidden'); initGoogleStaffSignIn(); } });
