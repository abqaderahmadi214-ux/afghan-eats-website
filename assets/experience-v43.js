(function(){
  const path=location.pathname.toLowerCase();
  const isHome=()=>path==='/'||path.endsWith('/index.html');
  const isRestaurants=()=>path.endsWith('/restaurants.html')||path==='/restaurants';
  const isRestaurant=()=>path.endsWith('/restaurant.html')||path==='/restaurant';
  const fa=()=>localStorage.getItem('ae_lang')==='fa'||document.documentElement.lang==='fa'||document.body.classList.contains('rtl');
  const copy=(en,dari)=>fa()?dari:en;
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  const getRestaurants=()=>{try{return Array.isArray(restaurants)?restaurants:null}catch{return null}};
  const getCurrentRestaurant=()=>{try{return currentRestaurant||null}catch{return null}};

  function skeletons(count=6){return Array.from({length:count},()=>'<div class="ae-loading-card" aria-hidden="true"><div class="ae-loading-media"></div><div class="ae-loading-body"><div class="ae-loading-line"></div><div class="ae-loading-line"></div><div class="ae-loading-line short"></div></div></div>').join('')}
  function mountSkeleton(selector){const grid=document.querySelector(selector);if(!grid||grid.children.length)return;grid.setAttribute('aria-busy','true');grid.innerHTML=skeletons()}
  function finishLoading(grid){if(grid?.querySelector('.restaurant-card'))grid.removeAttribute('aria-busy')}

  function updateListingLabels(root=document){
    root.querySelectorAll?.('.verify.provisional').forEach(el=>{const desired=`ℹ ${copy('Details being confirmed','جزئیات در حال تأیید')}`;if(el.textContent.trim()!==desired)el.textContent=desired});
    root.querySelectorAll?.('.fav').forEach(button=>button.setAttribute('aria-label',button.classList.contains('on')?copy('Remove favorite','حذف از علاقه‌مندی‌ها'):copy('Save favorite','ذخیره در علاقه‌مندی‌ها')));
  }

  function localizeChrome(){
    if(!fa())return;
    const location=document.querySelector('.topbar .container > span:first-child');
    if(location&&location.textContent.trim()!=='📍 هرات، افغانستان')location.textContent='📍 هرات، افغانستان';
    const footer=document.querySelector('.footer-bottom');if(footer&&footer.textContent.trim()!=='© 2026 Afghan Eats · هرات، افغانستان')footer.textContent='© 2026 Afghan Eats · هرات، افغانستان';
    document.querySelectorAll('[aria-label="Cart"]').forEach(el=>el.setAttribute('aria-label','سبد سفارش'));
    const city=document.querySelector('select[aria-label="Afghan Eats city"]');if(city)city.setAttribute('aria-label','شهر افغان ایتس');
  }

  function streamlineHome(){
    if(!isHome())return;
    ['#smartPicks','#fastestPicks'].forEach(selector=>{const section=document.querySelector(selector)?.closest('section');if(section){section.classList.add('hidden');section.setAttribute('aria-hidden','true')}});
    document.querySelector('.marketplace-band')?.classList.add('hidden');
    mountSkeleton('#homeRestaurants');
    const grid=document.querySelector('#homeRestaurants');
    if(grid)new MutationObserver(()=>{finishLoading(grid);updateListingLabels(grid)}).observe(grid,{childList:true,subtree:true});
    const input=document.querySelector('#smartSearchInput');
    const button=document.querySelector('.smart-search .btn');
    if(input){input.placeholder=copy('Try kebab, Qabeli, pizza or burger…','کباب، قابلی، پیتزا یا برگر را جستجو کنید…');input.setAttribute('aria-label',copy('Search dishes, restaurants or cuisines','جستجوی غذا، رستورانت یا دسته غذایی'));input.addEventListener('keydown',e=>{if(e.key!=='Enter'||document.querySelector('.suggestion.active'))return;e.preventDefault();window.aeSubmitHomeSearch?.()},{capture:true})}
    if(button)button.setAttribute('onclick','aeSubmitHomeSearch()');
    const terms=[['Kebab','Kebab','کباب'],['Qabeli','Qabeli','قابلی'],['Pizza','Pizza','پیتزا'],['Burger','Burger','برگر'],['Shinwari','Shinwari','شینواری'],['Sweets','Desserts','شیرینی']];
    document.querySelectorAll('.popular-searches button').forEach((button,i)=>{const term=terms[i];if(!term||button.dataset.aeV43)return;button.dataset.aeV43='1';button.removeAttribute('onclick');button.innerHTML=`<span class="en-copy">${term[1]}</span><span class="fa-copy">${term[2]}</span>`;button.addEventListener('click',()=>{location.href=`/restaurants.html?q=${encodeURIComponent(term[0])}`})});
    const pizza=document.querySelector('.cuisine[href*="c=Pizza"] b');if(pizza)pizza.innerHTML='<span class="en-copy">Pizza</span><span class="fa-copy">پیتزا</span>';
  }

  window.aeSubmitHomeSearch=function(){const input=document.querySelector('#smartSearchInput'),query=(input?.value||'').trim();if(query.length<2){input?.focus();return}location.href=`/restaurants.html?q=${encodeURIComponent(query)}`};

  function refreshRestaurantFilters(){
    if(!isRestaurants())return;
    const list=getRestaurants();if(!list?.length)return;
    const free=document.querySelector('[data-filter="free"]');
    if(free)free.classList.toggle('hidden',!list.some(r=>r.delivery_fee_min!=null&&Number(r.delivery_fee_min)===0));
    const grid=document.querySelector('#restaurantGrid');finishLoading(grid);updateListingLabels(grid||document);
  }

  function prepareRestaurants(){
    if(!isRestaurants())return;
    mountSkeleton('#restaurantGrid');
    const input=document.querySelector('#search');if(input){input.placeholder=copy('Search restaurant, dish, area or cuisine','رستورانت، غذا، محله یا دسته غذایی را جستجو کنید');input.setAttribute('aria-label',copy('Search restaurants and dishes','جستجوی رستورانت‌ها و غذاها'))}
    const rating=document.querySelector('#sort option[value="rating"]');if(rating)rating.textContent=copy('Rating','امتیاز');
    const grid=document.querySelector('#restaurantGrid');if(grid)new MutationObserver(refreshRestaurantFilters).observe(grid,{childList:true,subtree:true});
    refreshRestaurantFilters();
  }

  function deliveryFeeText(r){if(!r)return copy('Fee at checkout','هزینه هنگام ثبت سفارش');if(r.has_delivery===false)return copy('Pickup','دریافت حضوری');if(r.delivery_fee_min==null)return copy('Fee at checkout','هزینه هنگام ثبت سفارش');return Number(r.delivery_fee_min)===0?copy('Free delivery','ارسال رایگان'):`؋ ${Number(r.delivery_fee_min).toLocaleString()}`}
  function refreshRestaurantHero(){
    if(!isRestaurant())return;
    const r=getCurrentRestaurant(),title=document.querySelector('#storeHero .store-title');if(!r||!title)return;
    updateListingLabels(title);
    const feeLine=[...title.querySelectorAll('p')].find(p=>p.textContent.trim().startsWith('★'));
    if(feeLine){const rating=Number(r.rating??r.external_rating??0),desired=`${rating?`★ ${rating.toFixed(1)} · `:''}${deliveryFeeText(r)}`;if(feeLine.textContent.trim()!==desired)feeLine.textContent=desired}
  }

  function syncCartState(){
    const panel=document.querySelector('.cart-panel');if(!panel)return;
    const hasItems=!!panel.querySelector('.cart-row'),checkout=panel.querySelector('a[href="/checkout.html"],a[href="/checkout"]');
    if(checkout){checkout.classList.toggle('disabled',!hasItems);checkout.setAttribute('aria-disabled',String(!hasItems));checkout.tabIndex=hasItems?0:-1}
    const fee=document.querySelector('#cartDelivery');if(fee&&!hasItems&&fee.textContent.trim()!=='—')fee.textContent='—';
    updateListingLabels(panel);
  }

  function prepareRestaurant(){
    if(!isRestaurant())return;
    const hero=document.querySelector('#storeHero');if(hero)new MutationObserver(refreshRestaurantHero).observe(hero,{childList:true,subtree:true});
    const panel=document.querySelector('.cart-panel');if(panel)new MutationObserver(syncCartState).observe(panel,{childList:true,subtree:true,characterData:true});
    refreshRestaurantHero();syncCartState();
  }

  ready(()=>{document.body.classList.add('ae-v43');streamlineHome();prepareRestaurants();prepareRestaurant();updateListingLabels();localizeChrome();const topbar=document.querySelector('.topbar');if(topbar)new MutationObserver(localizeChrome).observe(topbar,{childList:true,subtree:true,characterData:true})});
})();
