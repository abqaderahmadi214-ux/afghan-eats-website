const AECITY = {
  catalog: [],
  context: null,
  key: localStorage.getItem('ae_city') || 'herat',
};

function cText(en, fa) {
  return typeof lang !== 'undefined' && lang === 'fa' ? (fa || en) : en;
}
function cEsc(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function cBase() {
  return (window.AFGHAN_EATS_CONFIG || {}).apiBaseUrl || '';
}
function cApiError(raw, status) {
  try {
    const j = JSON.parse(raw);
    return j?.error?.json?.message || j?.error?.message || `Request failed (${status})`;
  } catch {
    return raw || `Request failed (${status})`;
  }
}
async function cQuery(path, input, token = '') {
  const base = cBase();
  const q = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/api/trpc/${path}?input=${q}`, { headers });
  const raw = await response.text();
  if (!response.ok) throw new Error(cApiError(raw, response.status));
  const j = JSON.parse(raw);
  return j?.result?.data?.json ?? j?.result?.data ?? j;
}
function cityName(city) {
  return cText(city?.name_en || '', city?.name_dari || '');
}
function currentAreas() {
  return AECITY.context?.areas || [];
}

function installCityStyles() {
  if (document.getElementById('aeCityStyles')) return;
  const style = document.createElement('style');
  style.id = 'aeCityStyles';
  style.textContent = `
    .ae-city-select{border:1px solid #ddd5cf;background:#fff;border-radius:10px;padding:9px 11px;font-weight:800;max-width:165px}
    .ae-city-note{padding:11px;border-radius:12px;background:#fff5d8;color:#714b00;margin:10px 0}
    .city-admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .city-admin-card{border:1px solid #e5ded8;border-radius:15px;padding:14px;background:#fff}
    .city-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:.75rem;font-weight:900;background:#eee}
    .city-status.live{background:#eaf8ef;color:#17643a}.city-status.private{background:#f2efed;color:#625a55}
    .city-area-row{display:flex;gap:9px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eee}
    .city-restaurant-row{display:grid;grid-template-columns:1fr 180px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #eee}
    .city-actions{display:flex;gap:8px;flex-wrap:wrap}
    @media(max-width:800px){.city-admin-grid{grid-template-columns:1fr}.city-restaurant-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function mountCitySelector() {
  if (!AECITY.catalog.length || document.getElementById('aeCitySelect')) return;
  const actions = document.querySelector('.header .actions');
  if (!actions) return;
  const select = document.createElement('select');
  select.id = 'aeCitySelect';
  select.className = 'ae-city-select';
  select.setAttribute('aria-label', 'Afghan Eats city');
  select.innerHTML = AECITY.catalog.map(city => {
    const suffix = city.ordering_enabled ? '' : ` · ${cText('Coming soon', 'به‌زودی')}`;
    return `<option value="${cEsc(city.city_key)}" ${city.city_key === AECITY.key ? 'selected' : ''}>📍 ${cEsc(cityName(city))}${cEsc(suffix)}</option>`;
  }).join('');
  select.addEventListener('change', () => selectAfghanEatsCity(select.value));
  actions.insertBefore(select, actions.firstChild);
}

window.selectAfghanEatsCity = function selectAfghanEatsCity(key) {
  if (key === AECITY.key) return;
  let hasCart = false;
  try { hasCart = typeof cart !== 'undefined' && cart.length > 0; } catch {}
  if (hasCart && !confirm(cText('Changing city will clear your current basket and saved delivery address. Continue?', 'تغییر شهر سبد فعلی و آدرس ذخیره‌شده را پاک می‌کند. ادامه می‌دهید؟'))) {
    const select = document.getElementById('aeCitySelect');
    if (select) select.value = AECITY.key;
    return;
  }
  try {
    if (typeof cart !== 'undefined') {
      cart = [];
      if (typeof saveCart === 'function') saveCart();
    }
  } catch {}
  localStorage.removeItem('ae_address');
  localStorage.setItem('ae_city', key);
  location.reload();
};

function applyCityText() {
  const city = AECITY.context;
  if (!city) return;
  const name = cityName(city);
  document.querySelectorAll('.topbar .container').forEach(container => {
    const first = container.children[0];
    if (first) first.innerHTML = `📍 ${cEsc(name)}, Afghanistan`;
  });
  const hero = document.querySelector('[data-i18n="hero"]');
  if (hero) hero.textContent = cText(`Food you love, delivered across ${name}`, `غذای مورد علاقه شما، در سراسر ${name}`);
  const kicker = document.querySelector('.hero-kicker');
  if (kicker) {
    const en = kicker.querySelector('.en-copy');
    const fa = kicker.querySelector('.fa-copy');
    if (en) en.textContent = `Delivering across ${city.name_en}`;
    if (fa) fa.textContent = `ارسال در سراسر ${city.name_dari || city.name_en}`;
  }
  const footer = document.querySelector('.footer-bottom');
  if (footer) footer.textContent = `© 2026 Afghan Eats · ${name}, Afghanistan`;
}

function applyCityAreas() {
  const areas = currentAreas();
  if (!areas.length) return;
  const datalist = document.getElementById('heratAreas');
  if (datalist) datalist.innerHTML = areas.map(area => `<option value="${cEsc(cText(area.name_en, area.name_dari))}"></option>`).join('');
  const select = document.querySelector('select[name="district"]');
  if (select) {
    const oldValue = select.value;
    select.innerHTML = areas.map(area => `<option value="${cEsc(area.name_en)}">${cEsc(cText(area.name_en, area.name_dari))}</option>`).join('');
    if ([...select.options].some(option => option.value === oldValue)) select.value = oldValue;
  }
}

function applyCityOrdering() {
  if (!AECITY.context) return;
  const form = document.querySelector('form[onsubmit*="placeOrder"]');
  const button = form?.querySelector('button[type="submit"]');
  let note = document.getElementById('aeCityOrderingNote');
  if (AECITY.context.ordering_enabled === false) {
    if (button) {
      button.disabled = true;
      button.dataset.cityPaused = '1';
    }
    if (form && !note) {
      note = document.createElement('div');
      note.id = 'aeCityOrderingNote';
      note.className = 'ae-city-note';
      button?.insertAdjacentElement('beforebegin', note);
    }
    if (note) {
      note.textContent = cText(
        AECITY.context.launch_note_en || `Afghan Eats ordering is not yet open in ${AECITY.context.name_en}.`,
        AECITY.context.launch_note_dari || `سفارش افغان ایتس هنوز در ${AECITY.context.name_dari || AECITY.context.name_en} فعال نشده است.`
      );
    }
  } else {
    if (button?.dataset.cityPaused === '1') {
      button.disabled = false;
      delete button.dataset.cityPaused;
    }
    note?.remove();
  }
}

function filterRestaurantsForSelectedCity() {
  if (!AECITY.context || typeof restaurants === 'undefined' || !Array.isArray(restaurants)) return false;
  const allowed = new Set(AECITY.context.restaurantIds || []);
  if (!allowed.size) {
    restaurants = [];
  } else {
    restaurants = restaurants.filter(r => allowed.has(r.id));
  }
  if (typeof renderRestaurantList === 'function') renderRestaurantList();
  if (document.getElementById('homeRestaurants') && typeof renderCards === 'function') {
    const home = restaurants.filter(r =>
      (typeof isOrderableRestaurant === 'function' ? isOrderableRestaurant(r) : r.status === 'active') &&
      (typeof modeEligible !== 'function' || modeEligible(r))
    );
    if (typeof compareRecommended === 'function') home.sort(compareRecommended);
    renderCards('#homeRestaurants', home.slice(0, 6));
  }
  return true;
}

async function loadCityPublic() {
  try {
    AECITY.catalog = await cQuery('cities.publicCatalog', null);
    if (!Array.isArray(AECITY.catalog) || !AECITY.catalog.length) return;
    let selected = AECITY.catalog.find(city => city.city_key === AECITY.key);
    if (!selected) {
      selected = AECITY.catalog[0];
      AECITY.key = selected.city_key;
      localStorage.setItem('ae_city', AECITY.key);
    }
    AECITY.context = await cQuery('cities.publicContext', { cityKey: AECITY.key });
    mountCitySelector();
    applyCityText();
    applyCityAreas();
    applyCityOrdering();

    let attempts = 0;
    const wait = setInterval(() => {
      attempts += 1;
      mountCitySelector();
      applyCityText();
      applyCityAreas();
      applyCityOrdering();
      if (typeof restaurants !== 'undefined' && Array.isArray(restaurants) && restaurants.length > 0) {
        filterRestaurantsForSelectedCity();
      }
      if (attempts >= 24) clearInterval(wait);
    }, 250);
  } catch (error) {
    console.warn('City catalog unavailable; keeping current Herat fallback', error);
  }
}

function mountCityAdmin() {
  if (!location.pathname.toLowerCase().includes('operations') || document.getElementById('panelCities')) return;
  const tabs = document.querySelector('.ops-tabs');
  const adminConsole = document.getElementById('adminConsole');
  if (!tabs || !adminConsole) return;
  const button = document.createElement('button');
  button.className = 'ops-tab';
  button.textContent = 'Cities';
  button.onclick = () => { showOpsTab('panelCities', button); loadCityAdmin(); };
  tabs.insertBefore(button, tabs.lastElementChild);

  const panel = document.createElement('section');
  panel.id = 'panelCities';
  panel.className = 'ops-panel hidden';
  panel.innerHTML = `<div class="ops-panel-head"><div><h2>Cities & expansion</h2><p class="muted">Prepare a city privately, verify restaurants and areas, make it public, and only then enable ordering.</p></div><button class="btn btn-light" onclick="loadCityAdmin()">↻</button></div><div id="cityAdminError" class="notice error hidden"></div><div id="cityAdminCards" class="city-admin-grid"></div><div class="grid2" style="margin-top:15px"><section class="portal-card"><h3>Create future city</h3><p class="muted">New cities start private with ordering disabled.</p><form onsubmit="createServiceCity(event)" class="campaign-form"><input name="cityKey" required pattern="[a-z0-9-]+" placeholder="city-key"><input name="nameEn" required placeholder="English name"><input name="nameDari" dir="rtl" placeholder="Dari name"><input name="provinceEn" placeholder="Province"><input name="provinceDari" dir="rtl" placeholder="Province Dari"><textarea class="wide" name="launchNoteEn" placeholder="Optional coming-soon note"></textarea><textarea class="wide" name="launchNoteDari" dir="rtl" placeholder="یادداشت اختیاری"></textarea><button class="btn btn-primary wide" type="submit">Create private city</button></form></section><section class="portal-card"><h3>Add service area</h3><form onsubmit="createCityArea(event)" class="campaign-form"><select name="cityKey" id="cityAreaCity" required></select><input name="nameEn" required placeholder="English area name"><input name="nameDari" dir="rtl" placeholder="Dari area name"><input class="wide" name="matchTerms" placeholder="Matching terms, comma separated"><button class="btn btn-primary wide" type="submit">Add area</button></form><div id="cityAreas" style="margin-top:12px"></div></section></div><section class="portal-card" style="margin-top:15px"><h3>Restaurant city assignments</h3><p class="muted">Orders are blocked at the database layer if a restaurant is unassigned, private-city, or ordering-disabled.</p><div id="cityRestaurantAssignments"></div></section>`;
  adminConsole.appendChild(panel);
}

window.loadCityAdmin = async function loadCityAdmin() {
  if (typeof AEOPS === 'undefined' || !AEOPS.token || typeof opsQuery !== 'function') return;
  mountCityAdmin();
  const errorBox = document.getElementById('cityAdminError');
  try {
    const [cityData, restaurantsData] = await Promise.all([
      opsQuery('cities.adminCities', null, true),
      opsQuery('cities.adminRestaurantAssignments', null, true),
    ]);
    const cities = cityData.cities || [];
    const areas = cityData.areas || [];
    errorBox?.classList.add('hidden');
    document.getElementById('cityAdminCards').innerHTML = cities.map(city => `<article class="city-admin-card"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>${cEsc(city.name_en)}</b><div class="muted">${cEsc(city.name_dari || '')} · ${cEsc(city.city_key)}</div></div><span class="city-status ${city.ordering_enabled ? 'live' : city.is_public ? '' : 'private'}">${city.ordering_enabled ? 'ORDERING' : city.is_public ? 'PUBLIC' : 'PRIVATE'}</span></div><p>${Number(city.restaurant_count || 0)} restaurants · ${Number(city.active_area_count || 0)} active areas</p><div class="city-actions"><button class="btn btn-light btn-sm" onclick="toggleCityPublic('${cEsc(city.city_key)}',${!city.is_public})">${city.is_public ? 'Make private' : 'Make public'}</button><button class="btn ${city.ordering_enabled ? 'btn-light' : 'btn-primary'} btn-sm" onclick="toggleCityOrdering('${cEsc(city.city_key)}',${!city.ordering_enabled},${!!city.is_public})">${city.ordering_enabled ? 'Stop ordering' : 'Enable ordering'}</button></div></article>`).join('');
    const citySelect = document.getElementById('cityAreaCity');
    if (citySelect) citySelect.innerHTML = cities.map(city => `<option value="${cEsc(city.city_key)}">${cEsc(city.name_en)}</option>`).join('');
    document.getElementById('cityAreas').innerHTML = areas.map(area => `<div class="city-area-row"><div><b>${cEsc(area.name_en)}</b><small class="muted"> · ${cEsc(area.city_key)}</small></div><button class="btn btn-light btn-sm" onclick="toggleCityArea('${cEsc(area.id)}',${!area.active})">${area.active ? 'Disable' : 'Enable'}</button></div>`).join('') || '<div class="portal-empty">No service areas.</div>';
    document.getElementById('cityRestaurantAssignments').innerHTML = (restaurantsData || []).map(row => `<div class="city-restaurant-row"><div><b>${cEsc(row.name)}</b><small class="muted"> · legacy city: ${cEsc(row.city || '—')}</small></div><select onchange="assignRestaurantCity('${cEsc(row.id)}',this.value)"><option value="">Unassigned</option>${cities.map(city => `<option value="${cEsc(city.city_key)}" ${row.service_city_key === city.city_key ? 'selected' : ''}>${cEsc(city.name_en)}</option>`).join('')}</select></div>`).join('');
  } catch (error) {
    if (errorBox) {
      errorBox.className = 'notice error';
      errorBox.textContent = error.message;
    }
  }
};

window.createServiceCity = async function createServiceCity(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const d = new FormData(form);
  try {
    await opsMutation('cities.adminCreateCity', {
      cityKey: String(d.get('cityKey') || ''),
      nameEn: String(d.get('nameEn') || ''),
      nameDari: String(d.get('nameDari') || '') || undefined,
      provinceEn: String(d.get('provinceEn') || '') || undefined,
      provinceDari: String(d.get('provinceDari') || '') || undefined,
      launchNoteEn: String(d.get('launchNoteEn') || '') || undefined,
      launchNoteDari: String(d.get('launchNoteDari') || '') || undefined,
    }, true);
    form.reset();
    await loadCityAdmin();
  } catch (error) { alert(error.message); }
};
window.toggleCityPublic = async function toggleCityPublic(cityKey, isPublic) {
  if (!isPublic && !confirm('Make this city private? Customers will no longer see it.')) return;
  try {
    await opsMutation('cities.adminUpdateCity', { cityKey, isPublic, orderingEnabled: isPublic ? undefined : false }, true);
    await loadCityAdmin();
  } catch (error) { alert(error.message); }
};
window.toggleCityOrdering = async function toggleCityOrdering(cityKey, orderingEnabled, isPublic) {
  if (orderingEnabled && !isPublic) { alert('Make the city public first.'); return; }
  if (orderingEnabled && !confirm('Enable REAL customer ordering for this city? Confirm restaurants, service areas, delivery zones and operations are ready first.')) return;
  try {
    await opsMutation('cities.adminUpdateCity', { cityKey, orderingEnabled }, true);
    await loadCityAdmin();
  } catch (error) { alert(error.message); }
};
window.createCityArea = async function createCityArea(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const d = new FormData(form);
  const matchTerms = String(d.get('matchTerms') || '').split(',').map(x => x.trim()).filter(Boolean);
  try {
    await opsMutation('cities.adminCreateArea', {
      cityKey: String(d.get('cityKey') || ''),
      nameEn: String(d.get('nameEn') || ''),
      nameDari: String(d.get('nameDari') || '') || undefined,
      matchTerms,
    }, true);
    form.reset();
    await loadCityAdmin();
  } catch (error) { alert(error.message); }
};
window.toggleCityArea = async function toggleCityArea(id, active) {
  try { await opsMutation('cities.adminUpdateArea', { id, active }, true); await loadCityAdmin(); } catch (error) { alert(error.message); }
};
window.assignRestaurantCity = async function assignRestaurantCity(restaurantId, cityKey) {
  try { await opsMutation('cities.adminAssignRestaurant', { restaurantId, cityKey: cityKey || null }, true); } catch (error) { alert(error.message); await loadCityAdmin(); }
};

function cityBoot() {
  installCityStyles();
  loadCityPublic();
  mountCityAdmin();
  let attempts = 0;
  const wait = setInterval(() => {
    attempts += 1;
    mountCitySelector();
    mountCityAdmin();
    applyCityText();
    applyCityAreas();
    applyCityOrdering();
    if (typeof AEOPS !== 'undefined' && AEOPS.token && document.getElementById('panelCities') && attempts > 3) {
      loadCityAdmin();
      clearInterval(wait);
    } else if (attempts > 20) {
      clearInterval(wait);
    }
  }, 650);
}

document.addEventListener('DOMContentLoaded', cityBoot);
if (document.readyState !== 'loading') cityBoot();
