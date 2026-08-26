(function(){
  'use strict';

  const state={timer:null};
  const isFa=()=>localStorage.getItem('ae_lang')==='fa';
  const text=(en,fa)=>isFa()?fa:en;
  const token=()=>sessionStorage.getItem('ae_customer_token')||localStorage.getItem('ae_customer_token')||'';
  const orderId=()=>new URLSearchParams(location.search).get('id')||'';

  async function queryAccountTracking(id,customerToken){
    const base=(window.AFGHAN_EATS_CONFIG||{}).apiBaseUrl||'';
    if(!base)throw new Error('API is not configured');
    const input=encodeURIComponent(JSON.stringify({json:{orderId:id}}));
    const response=await fetch(`${base}/api/trpc/customerDelivery.track?input=${input}`,{
      headers:{Accept:'application/json',Authorization:`Bearer ${customerToken}`},
      credentials:'omit'
    });
    const raw=await response.text();
    if(!response.ok)throw new Error('Account tracking unavailable');
    const payload=JSON.parse(raw);
    return payload?.result?.data?.json??payload?.result?.data??payload;
  }

  function line(parent,label,value){
    if(value==null||value==='')return;
    const p=document.createElement('p');
    const b=document.createElement('b');
    b.textContent=label;
    p.append(b,document.createTextNode(` ${String(value)}`));
    parent.appendChild(p);
  }

  function render(data){
    const panel=document.getElementById('aeAccountDeliveryTracking');
    const body=document.getElementById('aeAccountDeliveryTrackingBody');
    if(!panel||!body)return;
    body.replaceChildren();

    const order=data?.order||{};
    const rider=data?.rider||null;
    const handoff=data?.handoff||{};

    const title=document.createElement('div');
    title.className='ae-location-state';
    const strong=document.createElement('b');
    strong.textContent=order.orderNumber||text('Afghan Eats order','سفارش افغان ایتس');
    title.appendChild(strong);
    if(order.restaurantName||order.status){
      const small=document.createElement('small');
      small.textContent=`\n${[order.restaurantName,order.status].filter(Boolean).join(' · ')}`;
      title.appendChild(small);
    }
    body.appendChild(title);

    if(rider){
      line(body,text('Rider:','پیک:'),[rider.firstName||text('Rider','پیک'),rider.vehicle].filter(Boolean).join(' · '));
      if(rider.liveDistanceKm!=null){
        line(body,text('Approximate distance:','فاصله تقریبی:'),`${Number(rider.liveDistanceKm).toFixed(1)} km${rider.roughEtaMinutes?` · ~${Number(rider.roughEtaMinutes)} ${text('min','دقیقه')}`:''}`);
      }else{
        const note=document.createElement('p');
        note.className='muted';
        note.textContent=text('Approximate distance appears only while the assigned rider has a recent delivery-location update.','فاصله تقریبی فقط زمانی نمایش داده می‌شود که موقعیت اخیر پیک برای این تحویل موجود باشد.');
        body.appendChild(note);
      }
    }

    if(handoff.pinVerified){
      const ok=document.createElement('div');ok.className='ae-proof-ok';ok.textContent=`✓ ${text('Delivery code verified.','کد تحویل تأیید شد.')}`;body.appendChild(ok);
    }else if(handoff.pinEnabled){
      const warning=document.createElement('div');warning.className='ae-proof-warn';warning.textContent=text('Secure delivery code is active. Share it only at handoff.','کد تحویل امن فعال است. آن را فقط هنگام تحویل شریک کنید.');body.appendChild(warning);
    }

    const privacy=document.createElement('p');
    privacy.className='muted';
    privacy.textContent=text('This signed-in view does not expose rider contact details, customer address, or precise rider coordinates.','این نمای حساب، جزئیات تماس پیک، آدرس مشتری یا مختصات دقیق پیک را نمایش نمی‌دهد.');
    body.appendChild(privacy);
    panel.classList.remove('hidden');
  }

  async function load(){
    const customerToken=token(),id=orderId();
    const panel=document.getElementById('aeAccountDeliveryTracking');
    if(!panel||!customerToken||!id){panel?.classList.add('hidden');return;}
    try{render(await queryAccountTracking(id,customerToken));}
    catch{panel.classList.add('hidden');}
  }

  function boot(){
    if(!location.pathname.toLowerCase().includes('order'))return;
    load();
    if(state.timer)clearInterval(state.timer);
    state.timer=setInterval(()=>{if(!document.hidden)load();},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
