/* Restaurant-only presentation layer. Existing portal authentication and commands remain authoritative. */
(() => {
  if (!document.getElementById('ownerDashboard')) return;
  const text = portalText, esc = portalEsc;
  window.portalMoney = value => `${Number(value || 0).toLocaleString()} ${text("AFN", "افغانی")}`;
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/>',
    orders:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 12h6M9 17h4"/>',
    menu:'<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-4 10 0 10"/>',
    store:'<path d="M3 10h18l-2-7H5Zm2 0v11h14V10M9 21v-7h6v7"/>',
    tools:'<path d="M4 20V10m8 10V4m8 16v-7M2 20h20"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    plate:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.plate}</svg>`;
  document.querySelectorAll('.owner-nav-item').forEach((el,i) => { el.firstElementChild.innerHTML=icon(['home','orders','menu','store','tools'][i]); el.firstElementChild.setAttribute('aria-hidden','true'); });
  document.querySelector('.owner-nav-item.active')?.setAttribute('aria-current','page');
  const filterLabels = {
    all: ['All orders','همه سفارش‌ها'], placed:['New','جدید'],
    preparing:['In kitchen','در آشپزخانه'], ready_for_pickup:['Ready','آماده']
  };
  let orderFilter='all';
  const matches=(o,filter)=>filter==='all'||(filter==='preparing'?['confirmed','preparing'].includes(o.status):o.status===filter);
  const listRenderer=window.renderOwnerOrderList;
  window.renderOwnerOrderList=function(orders) {
    const filters=document.getElementById('ownerOrderFilters');
    // Keep filter nodes stable during polling so keyboard focus is never discarded.
    if (!filters.children.length) {
      Object.entries(filterLabels).forEach(([key,labels])=>{
        const button=document.createElement('button');button.type='button';button.dataset.filter=key;
        button.addEventListener('click',()=>{orderFilter=key;window.renderOwnerOrderList(AEOwner.orders||[])});
        filters.append(button);
      });
    }
    filters.querySelectorAll('button').forEach(button=>{
      const key=button.dataset.filter, count=orders.filter(o=>matches(o,key)).length;
      button.innerHTML=`${esc(text(...filterLabels[key]))} <span>${count}</span>`;
      button.setAttribute('aria-pressed',String(key===orderFilter));
    });
    const filtered=orders.filter(o=>matches(o,orderFilter));
    listRenderer(filtered);
    if (!filtered.length && orders.length) document.getElementById('ownerOrders').innerHTML=`<div class="portal-empty">${icon('check')}<h3>${esc(text('You’re all caught up here','در این بخش سفارشی باقی نمانده است'))}</h3><p>${esc(text('Choose another filter to see more orders.','برای دیدن سفارش‌های دیگر، فیلتر را تغییر دهید.'))}</p></div>`;
    const summary=document.getElementById('ownerServiceSummary');
    summary.innerHTML=`<div class="owner-service-title"><span class="owner-card-kicker">${esc(text('Kitchen queue','صف سفارش‌ها'))}</span><h2>${esc(text('Ready for a great service.','آماده برای یک خدمت عالی.'))}</h2><p>${esc(text('Your next orders, one clear step at a time.','سفارش‌های بعدی، گام‌به‌گام.'))}</p></div><div class="owner-queue-steps">${['placed','preparing','ready_for_pickup'].map((key,i)=>`<button type="button" data-queue="${key}"><span class="owner-queue-icon">${icon(['orders','clock','check'][i])}</span><strong>${orders.filter(o=>matches(o,key)).length}</strong><span>${esc(text(...filterLabels[key]))}</span></button>`).join('')}</div>`;
    summary.querySelectorAll('[data-queue]').forEach(button=>button.addEventListener('click',()=>{
      orderFilter=button.dataset.queue;window.renderOwnerOrderList(AEOwner.orders||[]);ownerGoPanel('ownerOrdersPanel');
      filters.querySelector(`[data-filter="${orderFilter}"]`)?.focus({preventScroll:true});
    }));
    // The server remains responsible for which transitions are permitted.
    document.querySelectorAll('#ownerOrders .portal-actions button').forEach(button=>{
      const state=button.textContent.trim();
      const labels={confirmed:['Accept order','پذیرش سفارش'],preparing:['Start cooking','شروع آماده‌سازی'],'ready for pickup':['Mark ready','آماده شد'],cancelled:['Cancel order','لغو سفارش']};
      if(labels[state])button.textContent=text(...labels[state]);
    });
  };
  const menuRenderer=window.renderOwnerMenu;
  function filterMenu() {
    const query=document.getElementById('ownerMenuSearch').value.trim().toLocaleLowerCase();
    const availability=document.getElementById('ownerMenuAvailability').value;
    const items=AEOwner.items.filter(i=>!i.archived_at);
    const shown=items.filter(i=>(`${i.name||''} ${i.name_dari||''}`).toLocaleLowerCase().includes(query)&&(availability==='all'||(availability==='available'?i.is_available!==false:i.is_available===false)));
    const list=document.getElementById('ownerMenu');
    list.innerHTML=shown.length?shown.map(i=>ownerMenuCard(i)).join(''):`<div class="portal-empty">${icon('menu')}<h3>${esc(text(items.length?'No matching dishes':'Your menu starts here',items.length?'غذایی پیدا نشد':'منوی شما از اینجا شروع می‌شود'))}</h3><p>${esc(text(items.length?'Try another name or choose All dishes.':'Choose New item to add your first dish.',items.length?'نام دیگری جستجو کنید یا همه غذاها را انتخاب کنید.':'برای افزودن نخستین غذا، آیتم جدید را انتخاب کنید.'))}</p></div>`;
    document.getElementById('ownerMenuResults').textContent=text(`${shown.length} of ${items.length} dishes`,`${shown.length} از ${items.length} غذا`);
    list.querySelectorAll('.owner-menu-thumb').forEach(el=>el.innerHTML=icon('plate'));
  }
  window.renderOwnerMenu=function(){
    menuRenderer();filterMenu();
    document.querySelectorAll('#ownerStats .owner-kpi-icon').forEach((el,i)=>{el.innerHTML=icon(['orders','check','tools','menu','clock','store'][i]);el.setAttribute('aria-hidden','true')});
    const labels=document.querySelectorAll('#ownerStats small');
    if(labels[1])labels[1].textContent=text('Delivered order value today','ارزش سفارش‌های تحویل‌شده امروز');
    if(labels[3])labels[3].textContent=text('Available dishes','غذاهای موجود');
    document.querySelectorAll('#ownerOverviewMenu .owner-preview-placeholder').forEach(el=>{el.innerHTML=icon('plate');el.setAttribute('aria-hidden','true')});
    document.querySelectorAll('#ownerBusinessSnapshot .owner-business-list>div>span').forEach(el=>{el.innerHTML=icon('store');el.setAttribute('aria-hidden','true')});
  };
  document.getElementById('ownerMenuSearch').addEventListener('input',filterMenu);
  document.getElementById('ownerMenuAvailability').addEventListener('change',filterMenu);
  // Keep order submission feedback local and prevent duplicate taps. Never retry a mutation automatically.
  const updateOrder=window.ownerOrderStatus;
  let updatingOrder=false;
  window.ownerOrderStatus=async function(id,status){
    if(updatingOrder)return;
    if(status==='cancelled'&&!window.confirm(text('Cancel this order? This cannot be undone here.','این سفارش لغو شود؟ این کار در اینجا قابل بازگشت نیست.')))return;
    updatingOrder=true;
    const buttons=[...document.querySelectorAll('#ownerOrders .portal-actions button')];
    buttons.forEach(b=>b.disabled=true);
    try{await updateOrder(id,status)}finally{updatingOrder=false;buttons.forEach(b=>b.disabled=false)}
  };
  const panelNames=['ownerOverviewPanel','ownerOrdersPanel','ownerMenuPanel','ownerStorePanel','ownerToolsPanel'];
  const showPanel=window.showOwnerPanel;
  window.showOwnerPanel=function(id,button){
    if(!panelNames.includes(id))return;
    showPanel(id,button);
    document.getElementById('ownerDashboard').dataset.panel=id;
    history.replaceState(null,'',`#${id.replace('owner','').replace('Panel','').toLowerCase()}`);
  };
  const requested=panelNames.find(id=>`#${id.replace('owner','').replace('Panel','').toLowerCase()}`===location.hash);
  if(requested)ownerGoPanel(requested);
})();
