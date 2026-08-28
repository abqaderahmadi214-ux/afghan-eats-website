(function(){
  var host=document.getElementById('orderHistory');
  var membership=document.getElementById('ordersMembership');
  var countEl=document.getElementById('ordersCount');
  var titleEl=document.getElementById('ordersListTitle');
  if(!host||!membership)return;

  function tx(en,fa){return (typeof lang!=='undefined'&&lang==='fa')?fa:en;}
  function esc(v){return String(v==null?'':v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");}
  function token(){return sessionStorage.getItem('ae_customer_token')||localStorage.getItem('ae_customer_token')||'';}
  function localOrders(){
    var a=[];
    try{a=JSON.parse(localStorage.getItem('ae_orders')||'[]');}catch{}
    if(!Array.isArray(a)||!a.length){
      try{var x=JSON.parse(localStorage.getItem('ae_last_order')||'null');if(x)a=[x];}catch{}
    }
    return Array.isArray(a)?a:[];
  }
  function moneyText(n){return (typeof money==='function')?money(n):('؋ '+Number(n||0).toLocaleString());}
  function statusLabel(value){
    var m={placed:['Received','دریافت شد'],confirmed:['Confirmed','تأیید شد'],preparing:['Preparing','در حال آماده‌سازی'],ready_for_pickup:['Ready','آماده'],picked_up:['Picked up','تحویل پیک شد'],on_the_way:['On the way','در راه'],delivered:['Delivered','تحویل شد'],cancelled:['Cancelled','لغو شد'],failed:['Failed','ناموفق']};
    var pair=m[value]||[String(value||'').replaceAll('_',' '),String(value||'')];
    return tx(pair[0],pair[1]);
  }
  function reorderLocal(i){
    var o=localOrders()[i];
    if(!o||!Array.isArray(o.items))return;
    var rid=o.restaurantId||o.restaurant_id;
    var c=o.items.map(function(x){
      return {id:x.id,restaurantId:rid,restaurantName:o.restaurantName||'',name:x.name||x.name_dari||tx('Item','قلم'),price:Number(x.price||0),qty:Number(x.quantity||x.qty||1)};
    }).filter(function(x){return x.price>0;});
    if(!c.length)return;
    localStorage.setItem('ae_cart',JSON.stringify(c));
    location.href='/restaurant?id='+encodeURIComponent(rid);
  }
  window.reorderLocal=reorderLocal;

  function card(o,localIndex){
    var id=o.orderId||o.id||'';
    var num=o.orderNumber||o.order_number||tx('Order','سفارش');
    var restaurant=o.restaurantName||o.restaurant_name||'';
    var rawDate=o.createdAt||o.created_at||'';
    var when=rawDate?new Date(rawDate).toLocaleString((typeof lang!=='undefined'&&lang==='fa')?'fa-AF':'en-US'):'';
    var total=(o.pricing&&o.pricing.total!=null)?o.pricing.total:(o.total||0);
    var html='<article class="order-card"><div class="order-card-head"><div><b>'+esc(num)+'</b><div class="muted">'+esc(restaurant)+(when?' · '+esc(when):'')+'</div></div><span class="order-status">'+esc(statusLabel(o.status||'placed'))+'</span></div>';
    html+='<div class="order-card-meta"><span>'+tx('Total','مجموع')+': <b>'+moneyText(total)+'</b></span></div><div class="order-card-actions">';
    if(id)html+='<a class="btn btn-primary btn-sm" href="/order?id='+encodeURIComponent(id)+'">'+tx('Track order','پیگیری سفارش')+'</a>';
    if(localIndex!=null)html+='<button class="btn btn-light btn-sm" type="button" onclick="reorderLocal('+localIndex+')">'+tx('Order again','سفارش دوباره')+'</button>';
    return html+'</div></article>';
  }

  function renderGuest(){
    var local=localOrders();
    membership.innerHTML='<div class="orders-member-card guest"><div class="orders-member-copy"><span class="orders-member-icon">✓</span><div><b>'+tx('Guest ordering','سفارش مهمان')+'</b><p>'+tx('You can order without creating an account. Orders placed on this device stay available here for tracking and reordering.','بدون ساخت حساب هم می‌توانید سفارش دهید. سفارش‌های این دستگاه برای پیگیری و سفارش دوباره در همین‌جا می‌مانند.')+'</p><div class="orders-benefit-line">'+tx('Sign in for account-wide order history, saved addresses, rewards and eligible member offers.','برای سابقه سفارش در همه دستگاه‌ها، آدرس‌های ذخیره‌شده، امتیازها و پیشنهادهای واجد شرایط وارد شوید.')+'</div></div></div><div class="orders-member-actions"><a class="btn btn-light" href="/account?auth=login">'+tx('Sign in','ورود')+'</a><a class="btn btn-primary" href="/account?auth=register">'+tx('Create account','ساخت حساب')+'</a></div></div>';
    if(titleEl)titleEl.innerHTML=tx('Orders on this device','سفارش‌های این دستگاه');
    if(countEl)countEl.textContent=local.length+' '+tx('orders','سفارش');
    host.innerHTML=local.length?local.map(function(o,i){return card(o,i);}).join(''):'<div class="orders-empty"><b>'+tx('No orders yet','هنوز سفارشی ندارید')+'</b><p>'+tx('Your guest orders will appear here after checkout.','سفارش‌های مهمان شما پس از پرداخت در اینجا نمایش داده می‌شود.')+'</p></div>';
  }

  async function queryCustomer(){
    var base=(window.AFGHAN_EATS_CONFIG||{}).apiBaseUrl||'';
    var q=encodeURIComponent(JSON.stringify({json:null}));
    var r=await fetch(base+'/api/trpc/customer.me?input='+q,{headers:{Accept:'application/json',Authorization:'Bearer '+token()}});
    var raw=await r.text();
    if(!r.ok)throw new Error(raw||'Customer account unavailable');
    var j=JSON.parse(raw);
    return (j&&j.result&&j.result.data&&(j.result.data.json||j.result.data))||null;
  }

  async function renderMember(){
    try{
      var data=await queryCustomer();
      if(!data)throw new Error('No customer data');
      var p=data.profile||{},lo=data.loyalty||{},orders=Array.isArray(data.orders)?data.orders:[],balance=Number(lo.balance||0);
      var rewardLine=(lo.enabled&&Number(lo.points_per_100_afn||0)>0)
        ?tx(Number(lo.points_per_100_afn)+' points per 100 AFN on delivered member orders.',Number(lo.points_per_100_afn)+' امتیاز به ازای هر ۱۰۰ افغانی در سفارش‌های تحویل‌شده عضو.')
        :tx('Rewards and eligible member offers appear when they are activated.','امتیازها و پیشنهادهای واجد شرایط زمانی نمایش داده می‌شوند که فعال باشند.');
      membership.innerHTML='<div class="orders-member-card member"><div class="orders-member-copy"><span class="orders-member-icon">★</span><div><b>'+tx('Member account','حساب عضو')+' · '+esc(p.name||'')+'</b><p>'+esc(rewardLine)+'</p><div class="orders-benefit-line">'+tx('Use your registered account phone at checkout so orders and rewards stay linked to this account.','در پرداخت از شماره ثبت‌شده حساب استفاده کنید تا سفارش‌ها و امتیازها به همین حساب وصل بمانند.')+'</div></div></div><div class="orders-member-stats"><div class="orders-mini-stat"><small>'+tx('Orders','سفارش‌ها')+'</small><strong>'+orders.length+'</strong></div><div class="orders-mini-stat"><small>'+tx('Reward points','امتیازها')+'</small><strong>'+balance.toLocaleString()+'</strong></div></div></div>';
      if(titleEl)titleEl.innerHTML=tx('Account order history','سابقه سفارش حساب');
      if(countEl)countEl.textContent=orders.length+' '+tx('orders','سفارش');
      host.innerHTML=orders.length?orders.map(function(o){return card(o,null);}).join(''):'<div class="orders-empty"><b>'+tx('No account orders yet','هنوز سفارشی در حساب نیست')+'</b><p>'+tx('Place your next order while signed in and it will appear here.','سفارش بعدی را در حالت ورود ثبت کنید تا اینجا نمایش داده شود.')+'</p></div>';
    }catch(e){
      renderGuest();
    }
  }

  document.addEventListener('DOMContentLoaded',function(){if(token())renderMember();else renderGuest();});
})();