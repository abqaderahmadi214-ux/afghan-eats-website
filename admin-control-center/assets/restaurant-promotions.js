'use strict';
(() => {
  function mount() {
    if (!state.token || !isFullAdmin() || !['promotions','restaurants'].includes(state.view) || root.querySelector('#restaurant-campaigns')) return;
    const session = state.token;
    const panel = document.createElement('section');
    panel.id = 'restaurant-campaigns'; panel.className = 'panel wide space-top-md';
    panel.innerHTML = `<div class="panel-head"><div><h2>Restaurant offers</h2><p>Create an offer for a restaurant and publish it on the customer website and app.</p></div><button type="button" class="button button-secondary" data-campaign-refresh>Refresh offers</button></div>
      <div class="panel-body"><p data-campaign-status role="status">Loading restaurant offers…</p>
      <form data-campaign-create class="form-grid"><fieldset data-campaign-fields class="full form-grid">
        <label class="field full"><span>Restaurant</span><select name="restaurantId" required disabled><option value="">Loading restaurants…</option></select></label>
        <label class="field full"><span>Offer title</span><input name="name" required minlength="3" maxlength="160" placeholder="Weekend savings"></label>
        <label class="field"><span>Discount type</span><select name="campaignType"><option value="percent_discount">Percentage discount</option><option value="fixed_discount">Fixed AFN discount</option><option value="free_delivery">Free delivery</option></select></label>
        <label class="field"><span data-campaign-value-label>Discount percentage</span><input name="discountValue" type="number" min="1" max="100" step="0.01" required></label>
        <label class="field"><span>Apply to</span><select name="scopeType"><option value="order">Restaurant orders</option><option value="items" disabled>Orders containing selected dishes (fixed AFN only)</option></select></label>
        <label class="field"><span>Promotion code (optional)</span><input name="code" minlength="3" maxlength="50" pattern="[A-Za-z0-9_-]{3,50}" placeholder="Leave blank to generate"></label>
        <div data-campaign-items class="full hidden"><p>Select the dishes that qualify an order for this fixed AFN discount.</p><div data-campaign-item-list>Choose a restaurant first.</div></div>
        <label class="field"><span>Minimum order (AFN)</span><input name="minOrder" type="number" min="0" max="1000000" step="0.01" value="0" required></label>
        <label class="field"><span>Maximum discount per order (AFN, optional)</span><input name="maxDiscount" type="number" min="0.01" max="100000" step="0.01"></label>
        <label class="field"><span>Daily discount budget (AFN, optional)</span><input name="dailyBudget" type="number" min="0.01" max="10000000" step="0.01"></label>
        <label class="field"><span>Total discount budget (AFN, optional)</span><input name="totalBudget" type="number" min="0.01" max="100000000" step="0.01"></label>
        <label class="field"><span>Starts at (Kabul time, optional)</span><input name="startsAt" type="datetime-local"></label>
        <label class="field"><span>Ends at (Kabul time, optional)</span><input name="endsAt" type="datetime-local"></label>
        <label class="field full"><span>Publication</span><select name="publication"><option value="active">Publish to customers</option><option value="draft">Save as draft</option></select></label>
        <p class="full">Restaurant-funded: applied discounts are deducted from the restaurant’s settlement. Blank budgets have no campaign cap. Published offers appear in <a href="https://afghaneats.net/#aeGrowthMarketplace" target="_blank" rel="noopener noreferrer">Offers from restaurants</a>, the restaurant page and the customer app when their dates and budget allow. Drafts stay private.</p>
        <button type="submit" class="button button-primary full" disabled>Create and publish offer</button>
      </fieldset></form><div data-campaign-list class="space-top-md"></div></div>`;
    if (state.view === 'promotions') root.prepend(panel); else root.append(panel);
    const status = panel.querySelector('[data-campaign-status]');
    const form = panel.querySelector('[data-campaign-create]');
    let busy = false, restaurants = [], campaigns = [], menuGeneration = 0;
    const active = () => root.contains(panel) && state.token === session && isFullAdmin();
    const selectedId = () => form.elements.restaurantId.value;
    function syncFields() {
      const type = form.elements.campaignType.value, free = type === 'free_delivery';
      const selectedOption = form.elements.scopeType.querySelector('[value=items]'); selectedOption.disabled = type !== 'fixed_discount';
      if (type !== 'fixed_discount') form.elements.scopeType.value = 'order';
      form.elements.discountValue.disabled = free; form.elements.discountValue.required = !free;
      form.elements.discountValue.max = type === 'percent_discount' ? '100' : '100000';
      form.elements.discountValue.min = '0.01';
      form.elements.maxDiscount.disabled = free;
      form.querySelector('[data-campaign-value-label]').textContent = type === 'percent_discount' ? 'Discount percentage' : 'Discount amount (AFN)';
      panel.querySelector('[data-campaign-items]').classList.toggle('hidden', form.elements.scopeType.value !== 'items');
      form.querySelector('button[type=submit]').textContent = form.elements.publication.value === 'active' ? 'Create and publish offer' : 'Create draft offer';
    }
    function renderCampaigns() {
      const id = selectedId(), data = id ? campaigns.filter(c => c.restaurant_id === id) : campaigns;
      panel.querySelector('[data-campaign-list]').innerHTML = data.length ? data.map(c => `<article class="review-card"><h3>${esc(c.restaurant_name)} · ${esc(c.name)}</h3>
        <p>${esc(c.campaign_type.replaceAll('_',' '))} · ${esc(c.status)}${c.code ? ` · <strong>${esc(c.code)}</strong>` : ''}</p>
        ${c.campaign_type !== 'sponsored_listing' ? `<p>${c.campaign_type === 'percent_discount' ? `${number(c.discount_value)}% off` : c.campaign_type === 'free_delivery' ? 'Free delivery' : `${money(c.discount_value)} off`} · Minimum order ${money(c.min_order || 0)}${c.max_discount == null ? '' : ` · Maximum discount ${money(c.max_discount)}`}</p>` : ''}
        <p>Starts: ${esc(c.starts_at ? new Date(c.starts_at).toLocaleString('en-GB',{timeZone:'Asia/Kabul'}) : 'Immediately')} · Ends: ${esc(c.ends_at ? new Date(c.ends_at).toLocaleString('en-GB',{timeZone:'Asia/Kabul'}) : 'No end date')} (Kabul)</p>
        <p>Spent ${money(c.spent_amount || 0)} · Daily budget ${c.daily_budget == null ? 'Not capped' : money(c.daily_budget)} · Total budget ${c.total_budget == null ? 'Not capped' : money(c.total_budget)}</p>
        ${c.restaurant_status && c.restaurant_status !== 'active' ? '<p>Hidden from customers: restaurant listing is not active.</p>' : ''}
        ${c.campaign_type !== 'sponsored_listing' ? `<div class="button-stack">${['draft','paused'].includes(c.status) ? `<button type="button" class="button button-primary" data-campaign-id="${attr(c.id)}" data-status="active">Activate</button>` : ''}${c.status === 'active' ? `<button type="button" class="button button-secondary" data-campaign-id="${attr(c.id)}" data-status="paused">Pause</button>` : ''}${!['ended','rejected'].includes(c.status) ? `<button type="button" class="button button-secondary" data-campaign-id="${attr(c.id)}" data-status="ended">End</button>` : ''}</div>` : '<p>Sponsored placement requires a separate sponsorship review.</p>'}
      </article>`).join('') : '<p>No restaurant offers for this selection yet.</p>';
    }
    async function loadCampaigns() {
      const data = await query('growth.adminCampaigns',{limit:150}); if (!active()) return;
      campaigns = data; renderCampaigns();
    }
    async function loadMenu() {
      const generation = ++menuGeneration, id = selectedId(), target = panel.querySelector('[data-campaign-item-list]');
      target.textContent = id ? 'Loading dishes…' : 'Choose a restaurant first.'; if (!id) return;
      try {
        const data = await query('restaurants.adminMenu',{restaurantId:id}); if (!active() || generation !== menuGeneration) return;
        target.innerHTML = data.items.length ? data.items.map(i => `<label class="campaign-dish"><input type="checkbox" name="eligibleItem" value="${attr(i.id)}"><span>${esc(i.name)} · ${money(i.price)}${i.is_available ? '' : ' · Currently unavailable'}</span></label>`).join('') : 'This restaurant has no current dishes. Use an order-wide discount or add menu items first.';
      } catch (error) { if (active() && generation === menuGeneration) target.textContent = 'Could not load dishes. Select the restaurant again to retry.'; }
    }
    async function loadRestaurants() {
      restaurants = await query('restaurants.adminList',{}); if (!active()) return;
      form.elements.restaurantId.innerHTML = '<option value="">Choose a restaurant</option>' + restaurants.map(r => `<option value="${attr(r.id)}">${esc(r.name)}${r.status === 'active' ? '' : ` (${esc(r.status)} — draft only)`}</option>`).join('');
      form.elements.restaurantId.disabled = false;
      if (state.restaurantEditId && restaurants.some(r => r.id === String(state.restaurantEditId))) form.elements.restaurantId.value = String(state.restaurantEditId);
      form.querySelector('button[type=submit]').disabled = false;
      renderCampaigns(); if (selectedId()) void loadMenu();
    }
    async function command(fn) {
      if (busy) return; busy = true;
      form.querySelector('[data-campaign-fields]').disabled = true;
      panel.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await fn(); } catch (error) { if (active()) status.textContent = error.message || 'Could not save the offer. Your entered details have been kept.'; }
      finally { busy = false; if (active()) { form.querySelector('[data-campaign-fields]').disabled = false; panel.querySelectorAll('button').forEach(b => b.disabled = false); form.querySelector('button[type=submit]').disabled = !restaurants.length; syncFields(); } }
    }
    form.addEventListener('change', event => {
      syncFields(); if (event.target.name === 'restaurantId') { renderCampaigns(); void loadMenu(); }
    });
    form.addEventListener('submit', event => {
      event.preventDefault(); if (busy) return;
      const d = new FormData(form), optionalNumber = name => String(d.get(name) || '').trim() === '' ? null : Number(d.get(name));
      const date = name => d.get(name) ? new Date(String(d.get(name)) + '+04:30').toISOString() : null;
      void command(async () => {
        const publishNow = d.get('publication') === 'active', restaurant = restaurants.find(r => r.id === d.get('restaurantId'));
        if (!restaurant) throw Error('Choose a restaurant.');
        if (publishNow && restaurant.status !== 'active') throw Error('This restaurant is not active. Choose Save as draft until its listing is activated.');
        const type = String(d.get('campaignType')), scope = String(d.get('scopeType'));
        const eligibleItemIds = scope === 'items' ? d.getAll('eligibleItem').map(String) : [];
        if (scope === 'items' && !eligibleItemIds.length) throw Error('Choose at least one qualifying dish.');
        const payload = {restaurantId:restaurant.id,name:String(d.get('name')).trim(),campaignType:type,scopeType:scope,eligibleItemIds,code:String(d.get('code') || '').trim() || undefined,discountValue:type === 'free_delivery' ? undefined : Number(d.get('discountValue')),maxDiscount:type === 'free_delivery' ? null : optionalNumber('maxDiscount'),minOrder:Number(d.get('minOrder')),dailyBudget:optionalNumber('dailyBudget'),totalBudget:optionalNumber('totalBudget'),startsAt:date('startsAt'),endsAt:date('endsAt'),publishNow};
        const created = await mutate('growth.adminCreate',payload); if (!active()) return;
        form.reset(); form.elements.restaurantId.value = restaurant.id; syncFields(); void loadMenu();
        status.textContent = created.status === 'active' ? `Offer published for ${restaurant.name}. Code: ${created.code}. It appears on the website and app while its dates and budget allow.` : `Draft saved for ${restaurant.name}. Code: ${created.code}. Activate it when ready to show it to customers.`;
        try { await loadCampaigns(); } catch { if (active()) status.textContent += " The offer was saved, but the list could not refresh. Use Refresh offers; do not create it again."; }
      });
    });
    panel.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button || busy) return;
      if (button.hasAttribute('data-campaign-refresh')) return void command(async () => { if (!restaurants.length) await loadRestaurants(); await loadCampaigns(); if (active()) status.textContent = 'Offers refreshed. Current form details preserved.'; });
      if (!button.dataset.campaignId) return;
      void command(async () => { await mutate('growth.adminSetStatus',{campaignId:button.dataset.campaignId,status:button.dataset.status}); await loadCampaigns(); if (active()) status.textContent = 'Offer status updated.'; });
    });
    syncFields();
    void (async () => { const results = await Promise.allSettled([loadRestaurants(),loadCampaigns()]); if (!active()) return; status.textContent = results.some(r => r.status === 'rejected') ? 'Some offer data could not load. Refresh to retry.' : 'Create a restaurant offer below, or manage an existing one. Nothing is published until you submit.'; })();
  }
  new MutationObserver(mount).observe(root,{childList:true}); mount();
})();
