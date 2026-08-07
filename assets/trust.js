function trustEsc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function trustText(en,fa){return (typeof lang!=='undefined'&&lang==='fa')?fa:en}

window.applyPromo=async function(){
  const input=document.getElementById('promo'),msg=document.getElementById('promoMsg');
  const code=(input?.value||'').trim().toUpperCase(),subtotal=typeof totals==='function'?totals().subtotal:0;
  if(!code){if(msg)msg.textContent=trustText('Enter a promo code.','کد تخفیف را وارد کنید.');return}
  if(msg)msg.textContent=trustText('Checking campaign…','در حال بررسی تخفیف…');
  try{
    const result=await trpcQuery('trust.validatePromo',{code,subtotal});
    if(!result?.valid)throw new Error(result?.reason||'Invalid promo');
    sessionStorage.setItem('ae_discount',String(result.discount||0));
    sessionStorage.setItem('ae_promo',result.code||code);
    sessionStorage.setItem('ae_free_delivery',result.discountType==='free_delivery'?'1':'0');
    if(msg){
      const benefit=result.discountType==='free_delivery'?trustText('Free delivery will be applied by the server.','ارسال رایگان توسط سرور اعمال می‌شود.'):`${trustText('Verified discount','تخفیف تأییدشده')}: ${money(result.discount||0)}`;
      msg.textContent=`✓ ${result.title||result.code} · ${benefit}`;
    }
    if(typeof renderCart==='function')renderCart();
    if(typeof aeRefreshCheckoutTotal==='function')aeRefreshCheckoutTotal();
  }catch(error){
    sessionStorage.removeItem('ae_discount');sessionStorage.removeItem('ae_promo');sessionStorage.removeItem('ae_free_delivery');
    if(msg)msg.textContent=error?.message||trustText('Promo code is not available.','کد تخفیف در دسترس نیست.');
    if(typeof renderCart==='function')renderCart();
  }
}

function reviewStars(n){return '★'.repeat(Math.max(0,Math.min(5,Number(n)||0)))+'☆'.repeat(Math.max(0,5-(Number(n)||0)))}
async function trustLoadReviews(){
  if(!document.getElementById('menuContent'))return;
  for(let i=0;i<20&&!window.currentRestaurant;i++)await new Promise(r=>setTimeout(r,100));
  const r=window.currentRestaurant;if(!r)return;
  let reviews=[];try{reviews=await trpcQuery('trust.reviewsList',{restaurantId:r.id,limit:30})}catch{}
  const host=document.getElementById('menuContent');if(!host||document.getElementById('verifiedReviews'))return;
  const last=JSON.parse(localStorage.getItem('ae_last_order')||'null');
  const prefill=last?.restaurantId===r.id?last:null;
  const box=document.createElement('section');box.id='verifiedReviews';box.className='review-hub';
  box.innerHTML=`<div class="review-head"><div><span class="eyebrow">✓ ${trustText('Verified-order reviews','نظرهای سفارش تأییدشده')}</span><h2>${trustText('What customers say','نظر مشتریان')}</h2><p class="muted">${trustText('Reviews submitted through Afghan Eats require a delivered order and matching checkout phone.','نظرهای ثبت‌شده در افغان ایتس نیاز به سفارش تحویل‌شده و شماره تماس مطابق دارند.')}</p></div><div class="review-score"><strong>${reviews.length?Number(reviews.reduce((s,x)=>s+Number(x.rating||0),0)/reviews.length).toFixed(1):'—'}</strong><span>${reviews.length?reviewStars(Math.round(reviews.reduce((s,x)=>s+Number(x.rating||0),0)/reviews.length)):'No reviews yet'}</span></div></div><div class="review-list">${reviews.length?reviews.slice(0,8).map(x=>`<article class="review-card"><div class="review-stars">${reviewStars(x.rating)}</div><p>${trustEsc(x.comment)}</p><small>${x.verified?'✓ '+trustText('Verified order','سفارش تأییدشده'):trustText('Customer review','نظر مشتری')} · ${new Date(x.created_at).toLocaleDateString()}</small></article>`).join(''):`<div class="empty-state">${trustText('Be the first verified Afghan Eats customer to review this restaurant.','اولین مشتری تأییدشده افغان ایتس باشید که نظر می‌دهد.')}</div>`}</div><details class="review-form-wrap" ${prefill?.status==='delivered'?'open':''}><summary>${trustText('Ordered here? Leave a verified review','از اینجا سفارش داده‌اید؟ نظر تأییدشده ثبت کنید')}</summary><form class="review-form grid2" onsubmit="submitVerifiedReview(event,'${trustEsc(r.id)}')"><label class="field"><span>${trustText('Order ID','شناسه سفارش')}</span><input name="orderId" required value="${trustEsc(prefill?.orderId||'')}"></label><label class="field"><span>${trustText('Checkout phone','شماره تماس سفارش')}</span><input name="phone" required value="${trustEsc(prefill?.customerPhone||'')}"></label><label class="field"><span>${trustText('Rating','امتیاز')}</span><select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select></label><label class="field full"><span>${trustText('Your review','نظر شما')}</span><textarea name="comment" required minlength="3" maxlength="1200" rows="4"></textarea></label><button class="btn btn-primary field full" type="submit">${trustText('Publish verified review','ثبت نظر تأییدشده')}</button><div class="review-result field full"></div></form></details>`;
  host.appendChild(box);
}

window.submitVerifiedReview=async function(event){
  event.preventDefault();const form=event.currentTarget,out=form.querySelector('.review-result'),f=new FormData(form),button=form.querySelector('button[type=submit]');
  if(button)button.disabled=true;
  try{
    await trpcMutation('trust.reviewsCreate',{orderId:String(f.get('orderId')||''),phone:String(f.get('phone')||''),rating:Number(f.get('rating')||5),comment:String(f.get('comment')||'')});
    out.className='notice success review-result field full';out.textContent=trustText('✓ Your verified review is published.','✓ نظر تأییدشده شما ثبت شد.');
    setTimeout(()=>location.reload(),900);
  }catch(error){out.className='notice error review-result field full';out.textContent=error?.message||trustText('Review could not be submitted.','نظر ثبت نشد.');if(button)button.disabled=false}
}

window.submitSupportCase=async function(event){
  event.preventDefault();const form=event.currentTarget,out=document.getElementById('supportResult'),f=new FormData(form),button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
  try{
    const data=await trpcMutation('trust.supportCreate',{orderId:String(f.get('orderId')||''),phone:String(f.get('phone')||''),category:String(f.get('category')||'other'),details:String(f.get('details')||'')});
    out.className='notice success';out.innerHTML=`✓ ${trustText('Support case created','درخواست پشتیبانی ثبت شد')}: <b>${trustEsc(data.reference)}</b><br>${trustText('Keep this reference to check progress.','این شماره پیگیری را برای بررسی وضعیت نگه دارید.')}`;localStorage.setItem('ae_support_reference',data.reference);form.reset();
  }catch(error){out.className='notice error';out.textContent=error?.message||trustText('Support case could not be created.','درخواست پشتیبانی ثبت نشد.');}finally{if(button)button.disabled=false}
}
window.checkSupportCase=async function(event){
  event.preventDefault();const form=event.currentTarget,out=document.getElementById('supportStatusResult'),f=new FormData(form);
  try{const data=await trpcQuery('trust.supportStatus',{reference:String(f.get('reference')||''),phone:String(f.get('phone')||'')});out.className='notice success';out.innerHTML=`<b>${trustEsc(data.reference)}</b> · <span class="status-badge status-${trustEsc(data.status)}">${trustEsc(data.status)}</span><br>${trustText('Category','دسته')}: ${trustEsc(data.category)} · ${trustText('Priority','اولویت')}: ${trustEsc(data.priority)}`}
  catch(error){out.className='notice error';out.textContent=error?.message||trustText('Support case not found.','درخواست پیدا نشد.')}
}

async function trustAdminData(){
  if(typeof AEOPS==='undefined'||!AEOPS.token)return;
  try{
    const [promos,cases,audit]=await Promise.all([opsQuery('trust.adminPromotions',null,true),opsQuery('trust.adminSupportCases',{limit:100},true),opsQuery('trust.adminAudit',{limit:100},true)]);
    renderPromotions(promos||[]);renderSupportCases(cases||[]);renderAudit(audit||[]);
  }catch(error){console.warn('Trust admin data unavailable',error)}
}
window.loadTrustAdmin=trustAdminData;
function renderPromotions(items){const el=document.getElementById('opsPromotions');if(!el)return;el.innerHTML=items.length?items.map(p=>`<div class="ops-row"><div><b>${trustEsc(p.code)}</b><div>${trustEsc(p.title)}</div><small>${trustEsc(p.discount_type)} · ${Number(p.discount_value)} · min ؋${Number(p.min_order||0).toLocaleString()}</small></div><div><span class="status-badge ${p.active?'status-approved':'status-inactive'}">${p.active?'active':'inactive'}</span><div>${Number(p.usage_count||0)} uses${p.usage_limit?` / ${Number(p.usage_limit)}`:''}</div></div><div class="ops-actions"><button class="btn btn-light btn-sm" onclick="togglePromotion('${trustEsc(p.id)}',${!p.active})">${p.active?'Pause':'Activate'}</button></div></div>`).join(''):'<div class="empty-state">No promotions.</div>'}
window.togglePromotion=async function(id,active){try{await opsMutation('trust.adminUpdatePromotion',{id,active},true);await trustAdminData()}catch(e){alert(e.message)}}
window.createPromotion=async function(event){event.preventDefault();const f=new FormData(event.currentTarget);try{await opsMutation('trust.adminCreatePromotion',{code:String(f.get('code')||''),title:String(f.get('title')||''),description:String(f.get('description')||''),discountType:String(f.get('discountType')||'fixed'),discountValue:Number(f.get('discountValue')||0),maxDiscount:f.get('maxDiscount')?Number(f.get('maxDiscount')):undefined,minOrder:Number(f.get('minOrder')||0),usageLimit:f.get('usageLimit')?Number(f.get('usageLimit')):undefined},true);event.currentTarget.reset();await trustAdminData()}catch(e){alert(e.message)}}
function renderSupportCases(items){const el=document.getElementById('opsSupport');if(!el)return;const statuses=['new','in_progress','waiting_customer','resolved','closed'];el.innerHTML=items.length?items.map(c=>`<div class="ops-row ops-row-wide"><div><b>${trustEsc(c.reference)}</b><div>${trustEsc(c.order_number)} · ${trustEsc(c.category)}</div><small>${trustEsc(c.details)}</small></div><div><span class="status-badge status-${trustEsc(c.status)}">${trustEsc(c.status)}</span><div>${trustEsc(c.priority)}</div></div><div class="ops-actions"><select id="support-${trustEsc(c.id)}">${statuses.map(s=>`<option value="${s}" ${s===c.status?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select><button class="btn btn-primary btn-sm" onclick="updateSupport('${trustEsc(c.id)}')">Update</button></div></div>`).join(''):'<div class="empty-state">No support cases.</div>'}
window.updateSupport=async function(id){const status=document.getElementById(`support-${id}`)?.value;if(!status)return;try{await opsMutation('trust.adminUpdateSupportCase',{id,status},true);await trustAdminData()}catch(e){alert(e.message)}}
function renderAudit(items){const el=document.getElementById('opsAudit');if(!el)return;el.innerHTML=items.length?items.map(a=>`<div class="ops-row"><div><b>${trustEsc(a.action)}</b><div>${trustEsc(a.entity_type)} · ${trustEsc(a.entity_id||'')}</div><small>${new Date(a.created_at).toLocaleString()}</small></div><div>${trustEsc(a.admin_username||'system')}</div><div><small>${trustEsc(JSON.stringify(a.details||{}))}</small></div></div>`).join(''):'<div class="empty-state">No audit activity yet.</div>'}

document.addEventListener('DOMContentLoaded',()=>{trustLoadReviews();if(document.getElementById('adminConsole')&&typeof verifyAdminSession==='function')setTimeout(trustAdminData,500)});
