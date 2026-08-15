(function(){
  'use strict';

  const PATCH_INTERVAL_MS=250;
  const PATCH_WINDOW_MS=15000;
  const startedAt=Date.now();

  function isFa(){return document.documentElement.lang==='fa'||document.documentElement.dir==='rtl'||localStorage.getItem('ae_lang')==='fa'}
  function txt(en,fa){return isFa()?fa:en}
  function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function appRestaurants(){try{return typeof restaurants!=='undefined'&&Array.isArray(restaurants)?restaurants:[]}catch{return[]}}
  function appCart(){try{return typeof cart!=='undefined'&&Array.isArray(cart)?cart:[]}catch{return[]}}
  function currentMode(){try{return typeof mode!=='undefined'?mode:(localStorage.getItem('ae_mode')||'delivery')}catch{return localStorage.getItem('ae_mode')||'delivery'}}
  function restaurantIsOpen(r){return Boolean(r&&r.status==='active'&&r.is_open!==false)}
  function cartRestaurant(){const c=appCart(),list=appRestaurants();return c.length?list.find(r=>String(r.id)===String(c[0].restaurantId))||null:null}
  function pageRestaurant(){try{return typeof currentRestaurant!=='undefined'&&currentRestaurant?currentRestaurant:cartRestaurant()}catch{return cartRestaurant()}}
  function closedMessage(){return txt('This restaurant is currently closed. You can review or remove items, but checkout is unavailable until it reopens.','این رستورانت فعلاً بسته است. می‌توانید اقلام را مرور یا حذف کنید، اما تا زمان بازشدن رستورانت پرداخت در دسترس نیست.')}
  function unverifiedAddressMessage(){return txt('Delivery availability and fee cannot be confirmed for this address yet. Choose a recognized address or switch to pickup if available.','موجودیت ارسال و هزینه آن برای این آدرس هنوز تأیید نشده است. یک آدرس شناخته‌شده را انتخاب کنید یا در صورت امکان دریافت حضوری را انتخاب کنید.')}

  function ensureStyles(){if(document.getElementById('aeV51Styles'))return;const style=document.createElement('style');style.id='aeV51Styles';style.textContent=`
    button,.btn,.lang,.chip,.saved-address-chip,.add-btn,.qty button,.mobile-nav a{min-height:44px}
    .qty button,.fav,.modal-close{min-width:44px}
    .ae-v51-block{border:1px solid #d8a0a0;background:#fff4f4;color:#7b1e1e;border-radius:12px;padding:12px;margin:10px 0;line-height:1.45}
    .ae-v51-inline{display:block;margin-top:8px;font-size:.85rem;color:#7b1e1e}
    .ae-v51-disabled-link{pointer-events:none;opacity:.55}
    .catalog-group.ae-v51-empty-required{border-color:#d8a0a0;background:#fff8f8}
    [aria-disabled="true"]{cursor:not-allowed}
  `;document.head.appendChild(style)}

  function liveRegion(el,role='status'){if(!el)return;el.setAttribute('role',role);el.setAttribute('aria-live',role==='alert'?'assertive':'polite');el.setAttribute('aria-atomic','true')}

  function enhanceAccessibility(root=document){
    ensureStyles();
    root.querySelectorAll?.('.cart-count').forEach(el=>{el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true')});
    root.querySelectorAll?.('.lang').forEach(btn=>{btn.setAttribute('aria-label',txt('Switch language to Dari','تغییر زبان به انگلیسی'));btn.setAttribute('title',btn.getAttribute('aria-label'))});
    root.querySelectorAll?.('.mode-tabs button').forEach(btn=>{btn.setAttribute('aria-pressed',String(btn.classList.contains('active')));btn.setAttribute('role','button')});
    root.querySelectorAll?.('.chip').forEach(btn=>{if(btn.tagName==='BUTTON'){btn.setAttribute('aria-pressed',String(btn.classList.contains('active')))}});
    root.querySelectorAll?.('.status-pill').forEach(el=>{el.setAttribute('role','status');const t=el.textContent?.trim();if(t)el.setAttribute('aria-label',t)});
    root.querySelectorAll?.('#checkoutError').forEach(el=>liveRegion(el,'alert'));
    root.querySelectorAll?.('#deliveryQuotePanel,#orderSubmitState,#aeConnectivity').forEach(el=>liveRegion(el,'status'));
    root.querySelectorAll?.('.qty button').forEach(btn=>{if(btn.getAttribute('aria-label'))return;const row=btn.closest('.cart-row'),name=row?.querySelector('b')?.textContent?.trim()||txt('item','قلم'),minus=btn.textContent?.includes('−')||btn.textContent?.trim()==='-';btn.setAttribute('aria-label',minus?txt(`Decrease ${name} quantity`,`کاهش تعداد ${name}`):txt(`Increase ${name} quantity`,`افزایش تعداد ${name}`))});
    root.querySelectorAll?.('.fav').forEach(btn=>{btn.setAttribute('aria-pressed',String(btn.classList.contains('on')))});
    root.querySelectorAll?.('[role="dialog"]').forEach(dialog=>{if(!dialog.hasAttribute('tabindex'))dialog.setAttribute('tabindex','-1')});
  }

  function announceClosedState(){
    const r=pageRestaurant();
    const closed=Boolean(r&&!restaurantIsOpen(r));
    const cartPanel=document.querySelector('.cart-panel');
    let notice=document.getElementById('aeV51ClosedNotice');
    if(closed&&cartPanel){
      if(!notice){notice=document.createElement('div');notice.id='aeV51ClosedNotice';notice.className='ae-v51-block';notice.setAttribute('role','alert');cartPanel.prepend(notice)}
      notice.textContent=closedMessage();
    }else notice?.remove();

    if(closed){
      document.querySelectorAll('.add-btn').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.setAttribute('title',closedMessage())});
      document.querySelectorAll('a[href="/checkout"],a[href="/checkout.html"]').forEach(a=>{if(a.closest('.header')||a.closest('.mobile-nav'))return;a.setAttribute('aria-disabled','true');a.classList.add('ae-v51-disabled-link');a.setAttribute('title',closedMessage())});
    }else{
      document.querySelectorAll('a.ae-v51-disabled-link').forEach(a=>{a.removeAttribute('aria-disabled');a.classList.remove('ae-v51-disabled-link');a.removeAttribute('title')});
    }
  }

  function guardEmptyModifierGroups(){
    const modal=document.getElementById('itemModal'),box=document.getElementById('catalogModifiers');
    if(!modal||!box||!modal.classList.contains('open'))return;
    let blocked=false;
    box.querySelectorAll('.catalog-group').forEach(group=>{
      const required=Boolean(group.querySelector('.catalog-required'));
      const inputs=group.querySelectorAll('input[type="radio"],input[type="checkbox"]');
      group.querySelector('.ae-v51-inline')?.remove();
      group.classList.remove('ae-v51-empty-required');
      if(inputs.length)return;
      if(!required){group.remove();return}
      blocked=true;group.classList.add('ae-v51-empty-required');
      const msg=document.createElement('span');msg.className='ae-v51-inline';msg.setAttribute('role','alert');msg.textContent=txt('This required choice has not been configured yet. This item cannot be added until the restaurant completes its options.','این انتخاب ضروری هنوز تنظیم نشده است. تا زمانی که رستورانت گزینه‌ها را تکمیل نکند، این قلم قابل افزودن نیست.');group.appendChild(msg)
    });
    const add=modal.querySelector('button[onclick="addCurrent()"]');
    if(add){const closed=Boolean(pageRestaurant()&&!restaurantIsOpen(pageRestaurant()));add.disabled=blocked||closed;add.setAttribute('aria-disabled',String(add.disabled));if(blocked)add.setAttribute('title',txt('Required item options are not configured','گزینه‌های ضروری این قلم تنظیم نشده است'));else if(!closed)add.removeAttribute('title')}
  }

  function patchRequestDeliveryQuote(){
    if(typeof window.requestDeliveryQuote!=='function'||window.requestDeliveryQuote.__aeV51)return;
    const base=window.requestDeliveryQuote;
    const wrapped=async function(r,opts={}){
      const fulfillment=opts.fulfillment||currentMode();
      if(!restaurantIsOpen(r))throw new Error(txt('Restaurant is currently closed','رستورانت فعلاً بسته است'));
      const quote=await base.apply(this,arguments);
      if(fulfillment==='delivery'&&quote?.source!=='zone')throw new Error('Delivery coverage and fee are not confirmed for this address');
      return quote
    };
    wrapped.__aeV51=true;wrapped.__aeV51Base=base;window.requestDeliveryQuote=wrapped
  }

  function patchTotals(){
    if(typeof window.totals!=='function'||window.totals.__aeV51)return;
    const wrapped=function(){
      const c=appCart();
      const subtotal=c.reduce((sum,item)=>sum+Number(item.price||0)*Math.max(1,Number(item.qty||1)),0);
      const r=cartRestaurant();
      const fulfillment=currentMode();
      const quote=r?._deliveryQuote;
      const validated=fulfillment==='pickup'||Boolean(quote&&quote.source==='zone');
      const delivery=fulfillment==='pickup'?0:validated?Number(quote.deliveryFee||0):0;
      const deliveryUnknown=fulfillment==='delivery'&&!validated;
      const service=Math.round(subtotal*.03),discount=0;
      return{subtotal,delivery,deliveryUnknown,service,discount,total:Math.max(0,subtotal+delivery+service)}
    };
    wrapped.__aeV51=true;window.totals=wrapped
  }

  function patchRefreshCheckoutQuote(){
    if(typeof window.refreshCheckoutDeliveryQuote!=='function'||window.refreshCheckoutDeliveryQuote.__aeV51)return;
    const base=window.refreshCheckoutDeliveryQuote;
    const wrapped=async function(){
      const result=await base.apply(this,arguments);
      const form=document.querySelector('form[onsubmit*="placeOrder"]');
      const fulfillment=String(form?.querySelector('input[name=fulfillment]:checked')?.value||currentMode());
      const r=cartRestaurant();
      if(fulfillment==='delivery'){
        if(!restaurantIsOpen(r)){
          window.AE_CHECKOUT_QUOTE_STATUS=false;
          if(r)delete r._deliveryQuote;
          const panel=document.getElementById('deliveryQuotePanel');if(panel){panel.className='delivery-quote-panel notice error';panel.textContent=closedMessage()}
        }else if(window.AE_CHECKOUT_QUOTE_STATUS!==true||r?._deliveryQuote?.source!=='zone'){
          window.AE_CHECKOUT_QUOTE_STATUS=false;
          if(r)delete r._deliveryQuote;
          const panel=document.getElementById('deliveryQuotePanel');if(panel){panel.className='delivery-quote-panel notice error';panel.textContent=unverifiedAddressMessage()}
        }
      }
      if(typeof window.renderCart==='function')window.renderCart();
      if(typeof window.syncCheckoutButton==='function')window.syncCheckoutButton();
      return result
    };
    wrapped.__aeV51=true;wrapped.__aeV51Base=base;window.refreshCheckoutDeliveryQuote=wrapped
  }

  function patchSyncCheckoutButton(){
    if(typeof window.syncCheckoutButton!=='function'||window.syncCheckoutButton.__aeV51)return;
    const wrapped=function(){
      const form=document.querySelector('form[onsubmit*="placeOrder"]'),button=form?.querySelector('button[type=submit]');if(!button)return;
      const fulfillment=form.querySelector('input[name=fulfillment]:checked')?.value||currentMode();
      const hasCart=appCart().length>0,r=cartRestaurant(),open=restaurantIsOpen(r),quoteOk=fulfillment==='pickup'||window.AE_CHECKOUT_QUOTE_STATUS===true;
      button.disabled=!hasCart||!open||!quoteOk;button.setAttribute('aria-disabled',String(button.disabled));
      if(!open)button.setAttribute('title',closedMessage());else if(fulfillment==='delivery'&&!quoteOk)button.setAttribute('title',unverifiedAddressMessage());else button.removeAttribute('title')
    };
    wrapped.__aeV51=true;window.syncCheckoutButton=wrapped
  }

  function patchPlaceOrder(){
    if(typeof window.placeOrder!=='function'||window.placeOrder.__aeV51)return;
    const base=window.placeOrder;
    const wrapped=async function(event){
      const form=event?.currentTarget||event?.target||document.querySelector('form[onsubmit*="placeOrder"]');
      const fulfillment=form?String(new FormData(form).get('fulfillment')||currentMode()):currentMode();
      const r=cartRestaurant();
      if(!restaurantIsOpen(r)){
        event?.preventDefault?.();const er=document.getElementById('checkoutError');if(er){er.textContent=closedMessage();er.classList.remove('hidden');liveRegion(er,'alert')}return
      }
      if(fulfillment==='delivery'&&window.AE_CHECKOUT_QUOTE_STATUS!==true){
        event?.preventDefault?.();const er=document.getElementById('checkoutError');if(er){er.textContent=unverifiedAddressMessage();er.classList.remove('hidden');liveRegion(er,'alert')}return
      }
      return base.apply(this,arguments)
    };
    wrapped.__aeV51=true;wrapped.__aeV51Base=base;window.placeOrder=wrapped
  }

  function patchOpenItem(){
    if(typeof window.openItem!=='function'||window.openItem.__aeV51)return;
    const base=window.openItem;
    const wrapped=function(){const r=appRestaurants().find(x=>String(x.id)===String(arguments[0]))||pageRestaurant();if(!restaurantIsOpen(r)){alert(closedMessage());return}const out=base.apply(this,arguments);setTimeout(()=>{guardEmptyModifierGroups();enhanceAccessibility(document.getElementById('itemModal')||document)},0);setTimeout(guardEmptyModifierGroups,500);return out};
    wrapped.__aeV51=true;wrapped.__aeV51Base=base;window.openItem=wrapped
  }

  function patchModeState(){
    if(typeof window.setMode!=='function'||window.setMode.__aeV51)return;
    const base=window.setMode;const wrapped=function(){const out=base.apply(this,arguments);queueMicrotask(()=>{enhanceAccessibility();announceClosedState();if(typeof window.syncCheckoutButton==='function')window.syncCheckoutButton()});return out};wrapped.__aeV51=true;wrapped.__aeV51Base=base;window.setMode=wrapped
  }

  function trapDialogFocus(event){
    if(event.key!=='Tab')return;const dialog=[...document.querySelectorAll('[role="dialog"]')].reverse().find(d=>d.getAttribute('aria-hidden')!=='true'&&getComputedStyle(d).display!=='none');if(!dialog)return;const focusable=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }

  function blockDisabledCheckoutLinks(event){const link=event.target?.closest?.('a[aria-disabled="true"]');if(!link)return;event.preventDefault();event.stopPropagation();const notice=document.getElementById('aeV51ClosedNotice');notice?.focus?.()}

  function patchAll(){
    ensureStyles();patchRequestDeliveryQuote();patchTotals();patchRefreshCheckoutQuote();patchSyncCheckoutButton();patchPlaceOrder();patchOpenItem();patchModeState();enhanceAccessibility();announceClosedState();guardEmptyModifierGroups();
  }

  document.addEventListener('keydown',trapDialogFocus,true);
  document.addEventListener('click',blockDisabledCheckoutLinks,true);
  const observer=new MutationObserver(mutations=>{for(const mutation of mutations){for(const node of mutation.addedNodes){if(node.nodeType===1)enhanceAccessibility(node)}}announceClosedState();guardEmptyModifierGroups();if(typeof window.syncCheckoutButton==='function')window.syncCheckoutButton()});
  function boot(){patchAll();observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-hidden']});const timer=setInterval(()=>{patchAll();if(Date.now()-startedAt>PATCH_WINDOW_MS)clearInterval(timer)},PATCH_INTERVAL_MS)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();