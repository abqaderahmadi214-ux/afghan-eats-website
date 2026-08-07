const AEIntel={quote:null,quoteTimer:null};
function intelEsc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function intelText(en,fa){return typeof lang!=='undefined'&&lang==='fa'?fa:en}

const intelBaseTotals=window.totals;
if(typeof intelBaseTotals==='function'){
  window.totals=function(){
    const x=intelBaseTotals();
    const selected=document.querySelector('input[name=fulfillment]:checked')?.value||mode||'delivery';
    if(selected==='pickup'){
      x.total=Math.max(0,x.total-x.delivery);
      x.delivery=0;
      return x;
    }
    if(AEIntel.quote){
      const fee=sessionStorage.getItem('ae_free_delivery')==='1'?0:Number(AEIntel.quote.deliveryFee||0);
      x.total=Math.max(0,x.total-x.delivery+fee);
      x.delivery=fee;
    }
    return x;
  }
}

async function requestDeliveryQuote(){
  const box=document.getElementById('deliveryQuote');
  if(!box||!cart?.length)return;
  const restaurantId=cart[0].restaurantId;
  const fulfillment=document.querySelector('input[name=fulfillment]:checked')?.value||mode||'delivery';
  const area=document.querySelector('select[name=district]')?.value||'';
  const address=document.querySelector('input[name=address]')?.value||'';
  try{
    const q=await trpcQuery('intelligence.quote',{restaurantId,fulfillment,deliveryArea:area,deliveryAddress:address});
    AEIntel.quote=q;
    sessionStorage.setItem('ae_zone_delivery_fee',String(q.deliveryFee||0));
    sessionStorage.setItem('ae_zone_min_order',String(q.minimumOrder||0));
    const zoneName=q.zone?(lang==='fa'&&q.zone.nameDari?q.zone.nameDari:q.zone.name):intelText('Standard restaurant delivery','ارسال استاندارد رستورانت');
    const eta=q.etaMin!=null&&q.etaMax!=null?`${q.etaMin}–${q.etaMax} ${t('min')}`:'—';
    box.className='quote-card';
    box.innerHTML=`<div><b>📍 ${intelEsc(zoneName)}</b><small>${intelText(q.source==='zone'?'Zone-based delivery quote':'Current delivery estimate',q.source==='zone'?'هزینه ارسال بر اساس ساحه':'تخمین فعلی ارسال')} · ${intelText('ETA','زمان')}: ${intelEsc(eta)} · ${intelText('Minimum order','حداقل سفارش')}: ${money(q.minimumOrder||0)}</small></div><div class="quote-price">${q.fulfillment==='pickup'?intelText('Pickup','دریافت حضوری'):money(q.deliveryFee||0)}</div>`;
    if(typeof renderCart==='function')renderCart();
    if(typeof aeRefreshCheckoutTotal==='function')aeRefreshCheckoutTotal();
  }catch(e){box.className='notice error';box.textContent=e.message||intelText('Delivery quote unavailable.','تخمین ارسال در دسترس نیست.');AEIntel.quote=null}
}
window.requestDeliveryQuote=requestDeliveryQuote;
function scheduleDeliveryQuote(){clearTimeout(AEIntel.quoteTimer);AEIntel.quoteTimer=setTimeout(requestDeliveryQuote,350)}

async function loadOwnerIntelligence(){
  const stats=document.getElementById('ownerIntelligenceStats'),top=document.getElementById('ownerTopItems');
  if(!stats||typeof portalQuery!=='function'||!AEPortal?.token)return;
  try{
    const d=await portalQuery('intelligence.ownerPerformance');
    stats.innerHTML=[
      [intelText('Orders · 30 days','سفارش · ۳۰ روز'),d.orders30d||0],
      [intelText('Delivered GMV · 30 days','فروش تحویل‌شده · ۳۰ روز'),portalMoney(d.gmv30d||0)],
      [intelText('Average order','میانگین سفارش'),portalMoney(d.averageOrder30d||0)],
      [intelText('Cancellation rate','نرخ لغو'),`${Number(d.cancellationRate30d||0).toFixed(1)}%`],
      [intelText('Average prep time','میانگین آماده‌سازی'),d.averagePrepMinutes30d==null?'—':`${d.averagePrepMinutes30d} min`],
      [intelText('Delivered · 30 days','تحویل‌شده · ۳۰ روز'),d.delivered30d||0],
      [intelText('Orders · 7 days','سفارش · ۷ روز'),d.orders7d||0],
      [intelText('Menu intelligence','تحلیل منو'),`${(d.topItems||[]).length} ${intelText('top items','قلم برتر')}`],
    ].map(([label,value])=>`<div class="intel-stat"><small>${intelEsc(label)}</small><strong>${intelEsc(value)}</strong></div>`).join('');
    if(top)top.innerHTML=(d.topItems||[]).length?(d.topItems||[]).map((x,i)=>`<div class="top-item"><div><b>${i+1}. ${intelEsc(x.name)}</b></div><span>${Number(x.quantity||0)} sold</span><b>${portalMoney(x.revenue||0)}</b></div>`).join(''):`<div class="portal-empty">${intelText('More completed orders are needed for item intelligence.','برای تحلیل اقلام به سفارش‌های تکمیل‌شده بیشتری نیاز است.')}</div>`;
  }catch(e){stats.innerHTML=`<div class="notice error">${intelEsc(e.message)}</div>`}
}
window.loadOwnerIntelligence=loadOwnerIntelligence;

async function loadIntelligenceAdmin(){
  if(typeof opsQuery!=='function'||typeof AEOPS==='undefined'||!AEOPS.token)return;
  const stats=document.getElementById('marketIntelligenceStats'),zones=document.getElementById('deliveryZones'),orders=document.getElementById('recommendOrders');
  if(!stats&&!zones&&!orders)return;
  try{
    const [analytics,zoneList,orderData]=await Promise.all([
      opsQuery('intelligence.adminMarketplaceAnalytics',null,true),
      opsQuery('intelligence.adminZones',null,true),
      opsQuery('orders.adminList',{limit:50,offset:0},true),
    ]);
    if(stats)stats.innerHTML=[
      ['Orders · 7d',analytics.orders7d],['Orders · 30d',analytics.orders30d],['Delivered GMV · 30d',`؋ ${Number(analytics.deliveredGmv30d||0).toLocaleString()}`],['Cancellation rate',`${Number(analytics.cancellationRate30d||0).toFixed(1)}%`],
      ['Active orders',analytics.activeOrders],['Available riders',`${analytics.availableRiders}/${analytics.activeRiders}`],['Active zones',analytics.activeZones],['Delivered · 30d',analytics.delivered30d],
    ].map(([l,v])=>`<div class="intel-stat"><small>${intelEsc(l)}</small><strong>${intelEsc(v)}</strong></div>`).join('');
    if(zones)renderDeliveryZones(zoneList||[]);
    if(orders){const active=(orderData.orders||[]).filter(o=>!['picked_up','on_the_way','delivered','cancelled','failed'].includes(o.status));orders.innerHTML=active.length?active.map(o=>`<div class="recommend-card"><div class="portal-order-head"><div><b>${intelEsc(o.order_number)}</b><div class="muted">${intelEsc(o.delivery_address||'')}</div></div><span class="status-badge status-${intelEsc(o.status)}">${intelEsc(o.status)}</span></div><button class="btn btn-light btn-sm" style="margin-top:9px" onclick="recommendRidersForOrder('${intelEsc(o.id)}')">✦ Recommend riders</button><div id="recommend-${intelEsc(o.id)}" class="recommend-result"></div></div>`).join(''):'<div class="empty-state">No assignable orders right now.</div>'}
  }catch(e){if(stats)stats.innerHTML=`<div class="notice error">${intelEsc(e.message)}</div>`}
}
window.loadIntelligenceAdmin=loadIntelligenceAdmin;
function zoneTerms(value){if(Array.isArray(value))return value.join(', ');try{const x=JSON.parse(value);return Array.isArray(x)?x.join(', '):''}catch{return''}}
function renderDeliveryZones(items){const el=document.getElementById('deliveryZones');if(!el)return;el.innerHTML=items.length?items.map(z=>`<div class="zone-row"><div><b>${intelEsc(z.name)}</b><small>${intelEsc(z.city)} · ${intelEsc(zoneTerms(z.match_terms))}</small></div><div><b>${portalMoney(z.delivery_fee)}</b><small>Min ${portalMoney(z.minimum_order)}</small></div><div><b>+${Number(z.eta_buffer_min||0)} min</b><small>Priority ${Number(z.priority||0)}</small></div><div class="portal-actions"><span class="status-badge ${z.active?'status-approved':'status-inactive'}">${z.active?'active':'inactive'}</span><button class="btn btn-light btn-sm" onclick="toggleDeliveryZone('${intelEsc(z.id)}',${!z.active})">${z.active?'Pause':'Activate'}</button></div></div>`).join(''):'<div class="empty-state">No delivery zones configured. Checkout will continue using each restaurant’s existing fallback delivery fee.</div>'}
window.createDeliveryZone=async function(event){event.preventDefault();const f=new FormData(event.currentTarget),terms=String(f.get('matchTerms')||'').split(',').map(x=>x.trim()).filter(Boolean);try{await opsMutation('intelligence.adminCreateZone',{city:String(f.get('city')||'Herat'),name:String(f.get('name')||''),nameDari:String(f.get('nameDari')||''),matchTerms:terms,deliveryFee:Number(f.get('deliveryFee')||0),minimumOrder:Number(f.get('minimumOrder')||0),etaBufferMin:Number(f.get('etaBufferMin')||0),priority:Number(f.get('priority')||0)},true);event.currentTarget.reset();await loadIntelligenceAdmin()}catch(e){alert(e.message)}}
window.toggleDeliveryZone=async function(id,active){try{await opsMutation('intelligence.adminUpdateZone',{id,active},true);await loadIntelligenceAdmin()}catch(e){alert(e.message)}}
window.recommendRidersForOrder=async function(orderId){const el=document.getElementById(`recommend-${orderId}`);if(el)el.innerHTML='<span class="muted">Scoring available riders…</span>';try{const list=await opsQuery('intelligence.adminRecommendRiders',{orderId},true);if(el)el.innerHTML=list.length?list.slice(0,6).map((r,i)=>`<div class="rider-recommendation"><div><b>${i===0?'★ ':''}${intelEsc(r.fullName)}</b><small style="display:block;color:var(--muted)">${intelEsc(r.vehicle)} · ${intelEsc((r.reasons||[]).join(' · '))}</small></div><div class="rider-score">${Number(r.score).toFixed(1)}</div></div>`).join(''):'<div class="notice">No available rider matches right now.</div>'}catch(e){if(el)el.innerHTML=`<div class="notice error">${intelEsc(e.message)}</div>`}}

document.addEventListener('DOMContentLoaded',()=>{
  const checkout=document.querySelector('form[onsubmit*="placeOrder"]');
  if(checkout){
    const area=checkout.querySelector('select[name=district]'),address=checkout.querySelector('input[name=address]');
    area?.addEventListener('change',scheduleDeliveryQuote);address?.addEventListener('input',scheduleDeliveryQuote);
    checkout.querySelectorAll('input[name=fulfillment]').forEach(x=>x.addEventListener('change',scheduleDeliveryQuote));
    setTimeout(requestDeliveryQuote,500);
  }
  if(document.getElementById('ownerIntelligenceStats'))setTimeout(loadOwnerIntelligence,800);
  if(document.getElementById('marketIntelligenceStats'))setTimeout(loadIntelligenceAdmin,900);
});
