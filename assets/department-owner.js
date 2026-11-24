'use strict';
(() => {
  const apiBase=window.AFGHAN_EATS_CONFIG?.apiBaseUrl||'';
  const TOKEN_KEY='ae_department_owner_token';
  const workspace=document.getElementById('owner-workspace');
  const auth=document.getElementById('owner-auth');
  const content=document.getElementById('owner-tab-content');
  const notice=document.getElementById('owner-notice');
  const state={token:sessionStorage.getItem(TOKEN_KEY)||'',me:null,dashboard:null,orders:[],orderError:'',tab:'overview'};
  let lang=localStorage.getItem('ae_lang')==='fa'?'fa':'en';
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const arr=value=>Array.isArray(value)?value:[];
  const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  const ORDER_STATUSES=['confirmed','preparing','ready_for_pickup','picked_up','on_the_way','delivered','cancelled','failed'];
  const ORDER_NEXT={placed:['confirmed','cancelled','failed'],pending:['confirmed','cancelled','failed'],created:['confirmed','cancelled','failed'],confirmed:['preparing','cancelled','failed'],preparing:['ready_for_pickup','on_the_way','cancelled','failed'],ready_for_pickup:['picked_up','on_the_way','cancelled','failed'],picked_up:['delivered','failed'],on_the_way:['delivered','failed']};
  function localized(en,fa){return lang==='fa'?fa:en;}
  function setNotice(message,error=false){notice.textContent=message;notice.classList.toggle('dr-error',error);}
  function setLanguage(next){lang=next==='fa'?'fa':'en';localStorage.setItem('ae_lang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='fa'?'rtl':'ltr';document.querySelectorAll('[data-en][data-fa]').forEach(node=>{node.textContent=node.dataset[lang];});const button=document.getElementById('dr-language');if(button)button.textContent=lang==='fa'?'English':'دری';}
  async function call(name,input,method='GET'){
    if(!apiBase)throw new Error('API is not configured.');
    const url=`${apiBase}/api/trpc/departmentRetail.${name}${method==='GET'?`?input=${encodeURIComponent(JSON.stringify({json:input??null}))}`:''}`;
    const headers={Accept:'application/json'};if(state.token)headers.Authorization=`Bearer ${state.token}`;
    const options={method,headers,signal:AbortSignal.timeout(20000)};
    if(method!=='GET'){headers['Content-Type']='application/json';options.body=JSON.stringify({json:input??{}});}
    const response=await fetch(url,options),raw=await response.text();let parsed;
    try{parsed=JSON.parse(raw);}catch{throw new Error('The retail API returned an unreadable response.');}
    if(!response.ok||parsed?.error)throw new Error(parsed?.error?.json?.message||parsed?.error?.message||`Request failed (${response.status})`);
    return parsed?.result?.data?.json??parsed?.result?.data??parsed;
  }
  const query=(name,input)=>call(name,input,'GET');
  const mutate=(name,input)=>call(name,input,'POST');
  function authFrom(result){if(!result?.token)throw new Error('The owner API did not return a session token.');state.token=String(result.token);sessionStorage.setItem(TOKEN_KEY,state.token);}
  function merchant(){return state.dashboard?.merchant||{};}
  async function loadWorkspace(){
    try{
      const [me,dashboard]=await Promise.all([query('ownerMe',null),query('ownerDashboard',null)]);
      state.me=me;state.dashboard=dashboard||{};state.orders=[];state.orderError='';
      try{state.orders=arr(await query('ownerListOrders',{limit:100}));}catch(error){state.orderError=error.message||'Order list is not available.';}
      auth.hidden=true;workspace.hidden=false;
      const store=merchant();document.getElementById('owner-store-title').textContent=store.name||'My department store';
      document.getElementById('owner-store-meta').textContent=[label(store.department_key),label(store.status),store.is_open?'Store open':'Store closed','Public ordering paused'].filter(Boolean).join(' · ');
      renderTab();setNotice(localized('Signed in to your department store. Department listing and customer ordering remain gated.','به فروشگاه بخش خود وارد شدید. فهرست بخش و سفارش مشتریان همچنان بسته است.'));
    }catch(error){if(/401|unauthori|expired|session/i.test(error.message)){state.token='';sessionStorage.removeItem(TOKEN_KEY);auth.hidden=false;workspace.hidden=true;}setNotice(error.message||'Could not load the department workspace.',true);}
  }
  function formField(labelText,name,type='text',value='',extra=''){return `<label><span>${esc(labelText)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label>`;}
  function panelTitle(eyebrow,heading,copy=''){return `<div class="dr-panel-head"><div><p class="dr-eyebrow">${esc(eyebrow)}</p><h3>${esc(heading)}</h3>${copy?`<p>${esc(copy)}</p>`:''}</div></div>`;}
  function empty(message){return `<div class="dr-empty">${esc(message)}</div>`;}
  function overview(){
    const d=state.dashboard||{},s=merchant(),blockers=arr(d.launchBlockers);
    const metrics=[['Products',arr(d.products).length],['Categories',arr(d.categories).length],['Orders',state.orders.length],['Store status',label(s.status||'pending')]];
    return `${panelTitle('OVERVIEW','Store readiness','Department-only workspace. The backend scopes records to your approved retail merchant.')}
      <div class="dr-metrics">${metrics.map(([name,value])=>`<article><small>${esc(name)}</small><b>${esc(value)}</b></article>`).join('')}</div>
      <div class="dr-callout"><strong>Public launch remains closed</strong><p>This portal cannot open public listings or customer orders. Once your profile, catalog, policies, stock, hours and fulfillment setup are ready, send a launch-review request with a note for staff.</p><form data-owner-form="launch-review"><label><span>Notes for the Afghan Eats review team</span><textarea name="notes" rows="3" minlength="3" maxlength="3000" required placeholder="Describe what is ready for review"></textarea></label><button class="dr-button" type="submit">Request launch review</button></form></div>
      ${blockers.length?`<h4>Current launch blockers</h4><ul>${blockers.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}`;
  }
  function catalog(){
    const categories=arr(state.dashboard?.categories),products=arr(state.dashboard?.products);
    return `${panelTitle('CATALOG','Products & categories','Retail catalog only; restaurant dishes and menus are never loaded here.')}
      <div class="dr-form-card"><h4>New category</h4><form data-owner-form="category">${formField('Category name','name')}${formField('Category name (Dari)','nameDari')}${formField('Sort order','sortOrder','number','0','step="1"')}<label><span>Active in store catalog</span><input name="isActive" type="checkbox"></label><button class="dr-button" type="submit">Save category</button></form></div>
      <div class="dr-form-card"><h4>New product</h4><form data-owner-form="product">${formField('Product name','name')}${formField('SKU / reference','sku')}
        <label><span>Category</span><select name="departmentId"><option value="">No category</option>${categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
        ${formField('Price (AFN)','price','number','0','min="0" step="0.01" required')}${formField('Unit label','unitLabel','text','')}${formField('Product image URL (HTTPS)','imageUrl','url','')}
        <label><span>Description</span><textarea name="description" rows="2" maxlength="3000"></textarea></label><label><span>Available in catalog</span><input name="isAvailable" type="checkbox"></label>${formField('Sort order','sortOrder','number','0','step="1"')}<button class="dr-button" type="submit">Save product</button><small>New products default to unavailable until explicitly marked available. Department listing remains controlled separately.</small></form></div>
      <h4>Categories</h4>${categories.length?`<div class="dr-list">${categories.map(c=>`<article><div><b>${esc(c.name||'Category')}</b><small>${esc(c.name_dari||'')} · ${c.is_active?'Active':'Inactive'} · ${esc(c.id)}</small></div></article>`).join('')}</div>`:empty('No categories in this department store yet.')}
      <h4>Products</h4>${products.length?`<div class="dr-table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Category</th><th>Catalog state</th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name||'—')}</td><td>${esc(p.sku||'—')}</td><td>${esc(p.price??'—')}</td><td>${esc(p.department_id||'Unassigned')}</td><td>${p.is_available?'Available':'Hidden'}</td></tr>`).join('')}</tbody></table></div>`:empty('No products in this department store yet.')}`;
  }
  function stock(){
    const products=arr(state.dashboard?.products);
    return `${panelTitle('INVENTORY','Stock controls','On-hand quantity is reduced only when goods leave the store; reserved units are held for active retail orders.')}
      ${products.length?`<div class="dr-table-wrap"><table><thead><tr><th>Product</th><th>Inventory tracking</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Low-stock threshold</th><th>Save</th></tr></thead><tbody>${products.map(p=>{const formId=`inventory-${String(p.id).replace(/[^a-zA-Z0-9_-]/g,'')}`,onHand=Number(p.quantity_available||0),reserved=Number(p.quantity_reserved||0);return `<tr><td>${esc(p.name||p.id)}</td><td><form id="${esc(formId)}" data-owner-form="inventory" class="dr-inline-form"><input type="hidden" name="productId" value="${esc(p.id)}"><label><span>Track inventory</span><input type="checkbox" name="trackingEnabled" ${p.tracking_enabled?'checked':''}></label></form></td><td><input form="${esc(formId)}" type="number" name="quantityAvailable" min="${esc(reserved)}" step="1" value="${esc(onHand)}" required aria-label="On-hand quantity for ${esc(p.name||'product')}"></td><td>${esc(reserved)}</td><td>${esc(Math.max(0,onHand-reserved))}</td><td><input form="${esc(formId)}" type="number" name="lowStockThreshold" min="0" step="1" value="${esc(p.low_stock_threshold??0)}" required aria-label="Low-stock threshold for ${esc(p.name||'product')}"></td><td><button form="${esc(formId)}" class="dr-button dr-button-small" type="submit">Save</button></td></tr>`;}).join('')}</tbody></table></div>`:empty('Add a product before setting its stock.')}`;
  }
  function availability(){
    const s=merchant(),hours=s.opening_hours&&typeof s.opening_hours==='object'?s.opening_hours:{};
    return `${panelTitle('STORE HOURS','Availability & operating hours','Store open/closed status and hours are operational settings only; public ordering stays paused.')}
      <form data-owner-form="availability" class="dr-form-card"><h4>Store availability</h4><label><span>Store currently open for operations</span><input name="isOpen" type="checkbox" ${s.is_open?'checked':''}></label><p class="dr-note">Customer acceptance is kept off in this portal. The department and platform ordering gates are still closed.</p><button class="dr-button" type="submit">Save availability</button></form>
      <div class="dr-form-card"><h4>Weekly hours</h4><form data-owner-form="hours">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>{const key=day.toLowerCase(),raw=String(hours[key]||''),match=raw.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);return `<label class="dr-hour-row"><span>${day}</span><input type="checkbox" name="${key}_closed" ${raw.toLowerCase()==='closed'||!raw?'checked':''} aria-label="${day} closed"><span>Closed</span><input type="time" name="${key}_opensAt" value="${esc(match?.[1]||'')}" aria-label="${day} opens"><input type="time" name="${key}_closesAt" value="${esc(match?.[2]||'')}" aria-label="${day} closes"></label>`;}).join('')}<button class="dr-button" type="submit">Save hours</button></form></div>`;
  }
  function fulfillment(){
    const s=merchant(),f=s.fulfillment_config||{},pay=s.payment_config||{},zone=arr(f.zones)[0]||{};
    return `${panelTitle('FULFILLMENT','Delivery, pickup & payment','These choices are submitted for review. They do not enable public checkout.')}
      <form data-owner-form="fulfillment" class="dr-form-card"><h4>Fulfillment options</h4><label><span>Delivery available</span><input name="hasDelivery" type="checkbox" ${s.has_delivery?'checked':''}></label><label><span>Customer pickup available</span><input name="hasPickup" type="checkbox" ${s.has_pickup?'checked':''}></label>
      ${formField('Delivery area / zone name','zoneKey','text',zone.key||'')}${formField('Delivery fee (AFN)','zoneFee','number',zone.fee??'','min="0" step="0.01"')}${formField('Zone notes','zoneNotes','text',zone.notes||'')}
      <label><span>Cash on delivery enabled</span><input name="cashOnDeliveryEnabled" type="checkbox" ${pay.cash_on_delivery_enabled?'checked':''}></label><label><span>Request online payments when a provider is approved</span><input name="onlinePaymentRequested" type="checkbox" ${pay.online_payment_requested?'checked':''}><small>This records interest only. No provider is selected, no online charge can be taken, and the request does not open customer ordering. Online payment may be offered alongside cash after separate provider approval.</small></label>
      <label><span>Fulfillment policy notes</span><textarea name="policyNotes" rows="3" maxlength="3000">${esc(f.policyNotes||'')}</textarea></label><button class="dr-button" type="submit">Submit fulfillment setup for review</button><small>A delivery setup cannot pass review without at least one enabled zone and an explicit fee. Online provider setup remains pending and department gates stay closed.</small></form>`;
  }
  function policies(){
    const s=merchant(),p=s.retail_policy_config||{},pay=s.payout_config||{};
    return `${panelTitle('POLICY & PAYOUT','Department policies and payout notes','Category-specific policies and payout details require staff review before launch.')}
      <form data-owner-form="policies" class="dr-form-card"><h4>Business policies</h4><label><span>Regulated / restricted goods policy</span><textarea name="regulatedGoodsPolicy" rows="3" maxlength="3000">${esc(p.regulated_goods_policy||'')}</textarea></label><label><span>Returns policy</span><textarea name="returnsPolicy" rows="3" maxlength="3000">${esc(p.returns_policy||'')}</textarea></label><label><span>Warranty policy (if applicable)</span><textarea name="warrantyPolicy" rows="3" maxlength="3000">${esc(p.warranty_policy||'')}</textarea></label><label><span>Substitutions policy</span><textarea name="substitutionsPolicy" rows="3" maxlength="3000">${esc(p.substitutions_policy||'')}</textarea></label><label><span>Payout / settlement notes for staff review</span><textarea name="payoutNotes" rows="3" maxlength="3000">${esc(pay.notes||'')}</textarea></label><button class="dr-button" type="submit">Submit policies for staff review</button><small>Review state: ${esc(label(p.review_status||'unset'))} · payout review: ${esc(label(pay.review_status||'unset'))}</small></form>`;
  }
  function orderStatusOptions(current){return (ORDER_NEXT[String(current||'')]||[]).map(status=>`<option value="${status}">${esc(label(status))}</option>`).join('');}
  function orders(){
    const rows=state.orders;
    return `${panelTitle('ORDERS','Department orders','Only orders returned for your department merchant are shown. New orders remain blocked while department, platform and city gates are closed; online-provider integration is pending.')}${state.orderError?`<div class="dr-message dr-error">Order list unavailable: ${esc(state.orderError)}</div>`:''}${rows.length?`<div class="dr-list">${rows.map(o=>{const next=ORDER_NEXT[String(o.status||'')]||[];return `<article class="dr-order"><div><b>Order ${esc(o.order_number||o.number||o.id||'—')}</b><small>${esc(o.created_at||'')} · ${esc(label(o.status||'unknown'))}</small><p>${esc(o.customer_note||o.item_summary||'Order details are returned by the department API.')}</p></div>${next.length?`<form data-owner-form="order-status"><input type="hidden" name="orderId" value="${esc(o.id)}"><select name="status" aria-label="New status for order ${esc(o.id)}">${orderStatusOptions(o.status)}</select><button class="dr-button dr-button-small" type="submit">Update status</button></form>`:'<span>No allowed next status</span>'}</article>`;}).join('')}</div>`:empty('No retail orders have been created. Customer checkout and order creation are prepared behind closed gates. Online payment remains pending provider approval and integration.')}`;
  }
  function profile(){
    const s=merchant();
    return `${panelTitle('STORE PROFILE','Business details','Update the profile fields supported by the retail-owner API.')}
      <form data-owner-form="profile" class="dr-form-card">${formField('Store name','name','text',s.name||'')}${formField('Phone','phone','tel',s.phone||'')}${formField('District','district','text',s.district||'')}${formField('Address','address','text',s.address||'')}${formField('Logo URL (HTTPS)','logoUrl','url',s.logo_url||'')}${formField('Cover image URL (HTTPS)','coverImageUrl','url',s.cover_image_url||'')}<label><span>Business description</span><textarea name="description" rows="3" maxlength="3000">${esc(s.description||'')}</textarea></label><button class="dr-button" type="submit">Save profile</button></form>`;
  }
  function renderTab(){
    document.querySelectorAll('[data-owner-tab]').forEach(button=>button.classList.toggle('active',button.dataset.ownerTab===state.tab));
    const views={overview,catalog,stock,availability,fulfillment,policies,orders,profile};content.innerHTML=(views[state.tab]||overview)();
  }
  async function refresh(){await loadWorkspace();}
  document.getElementById('dr-language')?.addEventListener('click',()=>setLanguage(lang==='fa'?'en':'fa'));
  document.getElementById('owner-login-form').addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(event.currentTarget),username=String(data.get('username')||'').trim(),password=String(data.get('password')||'');try{setNotice('Signing in…');const result=await mutate('ownerLogin',{username,password});authFrom(result);await refresh();}catch(error){setNotice(error.message||'Owner sign-in failed.',true);}});
  document.getElementById('owner-activate-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),token=String(data.get('token')||'').trim(),password=String(data.get('password')||''),confirm=String(data.get('confirmPassword')||'');if(password!==confirm)return setNotice('Passwords do not match.',true);try{setNotice('Activating invitation…');const result=await mutate('ownerActivate',{token,password});if(!result?.success||!result?.username)throw new Error('The activation response was incomplete.');const login=document.getElementById('owner-login-form');login.elements.username.value=result.username;form.reset();history.replaceState({},document.title,location.pathname);setNotice(`Account activated. Sign in using username ${result.username} and the password you just set.`);login.elements.password.focus();}catch(error){setNotice(error.message||'Invitation activation failed.',true);}});
  document.querySelectorAll('[data-owner-tab]').forEach(button=>button.addEventListener('click',()=>{state.tab=button.dataset.ownerTab;renderTab();}));
  document.getElementById('owner-logout').addEventListener('click',()=>{state.token='';state.me=null;state.dashboard=null;state.orders=[];sessionStorage.removeItem(TOKEN_KEY);workspace.hidden=true;auth.hidden=false;setNotice('You have signed out.');});
  content.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-owner-form]');if(!form)return;event.preventDefault();const type=form.dataset.ownerForm,raw=new FormData(form),get=name=>String(raw.get(name)||'').trim(),checked=name=>form.elements[name]?.checked===true;
    let name,payload;
    if(type==='category'){name='ownerUpsertCategory';payload={name:get('name'),nameDari:get('nameDari')||undefined,sortOrder:Number(get('sortOrder')||0),isActive:checked('isActive')};}
    else if(type==='product'){name='ownerUpsertProduct';payload={name:get('name'),sku:get('sku')||undefined,departmentId:get('departmentId')||null,price:Number(get('price')),unitLabel:get('unitLabel')||undefined,imageUrl:get('imageUrl')||undefined,description:get('description')||undefined,isAvailable:checked('isAvailable'),sortOrder:Number(get('sortOrder')||0)};}
    else if(type==='inventory'){name='ownerSetInventory';payload={productId:get('productId'),trackingEnabled:checked('trackingEnabled'),quantityAvailable:Number(get('quantityAvailable')),lowStockThreshold:Number(get('lowStockThreshold'))};}
    else if(type==='availability'){name='ownerSetAvailability';payload={isOpen:checked('isOpen'),acceptsOrders:false};}
    else if(type==='hours'){name='ownerSetHours';payload={hours:Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day=>{const closed=checked(`${day}_closed`),opens=get(`${day}_opensAt`),closes=get(`${day}_closesAt`);return [day,closed?'Closed':opens&&closes?`${opens}-${closes}`:''];}))};}
    else if(type==='fulfillment'){const zoneKey=get('zoneKey'),fee=get('zoneFee');name='ownerSetFulfillment';payload={hasDelivery:checked('hasDelivery'),hasPickup:checked('hasPickup'),zones:zoneKey?[{key:zoneKey,enabled:checked('hasDelivery'),fee:fee===''?null:Number(fee),notes:get('zoneNotes')||undefined}]:[],cashOnDeliveryEnabled:checked('cashOnDeliveryEnabled'),onlinePaymentEnabled:false,onlinePaymentRequested:checked('onlinePaymentRequested'),policyNotes:get('policyNotes')||undefined};}
    else if(type==='policies'){name='ownerSetPolicies';payload={regulatedGoodsPolicy:get('regulatedGoodsPolicy')||null,returnsPolicy:get('returnsPolicy')||null,warrantyPolicy:get('warrantyPolicy')||null,substitutionsPolicy:get('substitutionsPolicy')||null,payoutNotes:get('payoutNotes')||null};}
    else if(type==='profile'){name='ownerSaveProfile';payload={name:get('name'),phone:get('phone')||undefined,district:get('district')||undefined,address:get('address'),logoUrl:get('logoUrl')||undefined,coverImageUrl:get('coverImageUrl')||undefined,description:get('description')||undefined};}
    else if(type==='order-status'){name='ownerUpdateOrderStatus';payload={orderId:get('orderId'),status:get('status')};}
    else if(type==='launch-review'){name='ownerRequestLaunchReview';payload={notes:get('notes')};}
    else return;
    const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try{await mutate(name,payload);setNotice(type==='launch-review'?'Launch review request submitted. Public listings and ordering remain closed.':'Saved. Refreshing your department data…');await refresh();}
    catch(error){setNotice(error.message||'This retail operation could not be completed.',true);if(button)button.disabled=false;}
  });
  setLanguage(lang);
  const inviteToken=new URLSearchParams(location.search).get('token');if(inviteToken){document.querySelector('#owner-activate-form [name="token"]').value=inviteToken;history.replaceState({},document.title,location.pathname);}
  if(state.token)void refresh();
})();
