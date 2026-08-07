const AEReliability={requestKey:null};
function relText(en,fa){return typeof lang!=='undefined'&&lang==='fa'?fa:en}
function relEsc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function relRequestKey(){
  let key=sessionStorage.getItem('ae_order_request_id');
  if(!key){key=globalThis.crypto?.randomUUID?.()||`ae-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem('ae_order_request_id',key)}
  return key;
}
const relBaseMutation=window.trpcMutation;
if(typeof relBaseMutation==='function'){
  window.trpcMutation=async function(path,input){
    if(path==='orders.place'){
      const payload={...input,clientRequestId:relRequestKey()};
      const result=await relBaseMutation(path,payload);
      if(result?.success)sessionStorage.removeItem('ae_order_request_id');
      return result;
    }
    return relBaseMutation(path,input);
  }
}

function renderCancelControl(order){
  const host=document.getElementById('orderCancelControl');if(!host)return;
  if(!order?.can_cancel){host.innerHTML='';return}
  host.innerHTML=`<div class="cancel-card"><div><b>${relText('Need to cancel?','نیاز به لغو دارید؟')}</b><p class="muted">${relText('You can cancel online only before the restaurant confirms the order.','فقط پیش از تأیید رستورانت می‌توانید سفارش را آنلاین لغو کنید.')}</p></div><button class="btn btn-light" onclick="cancelCurrentOrder()">${relText('Cancel order','لغو سفارش')}</button></div>`;
}
window.cancelCurrentOrder=async function(){
  const id=new URLSearchParams(location.search).get('id'),phone=String(document.getElementById('trackPhone')?.value||'').trim();
  if(!id||phone.length<9){alert(relText('Verify the order phone first.','ابتدا شماره تماس سفارش را تأیید کنید.'));return}
  const reason=prompt(relText('Optional: tell us why you are cancelling.','اختیاری: دلیل لغو سفارش را بنویسید.'));
  if(reason===null)return;
  if(!confirm(relText('Cancel this order now? This cannot be undone.','این سفارش اکنون لغو شود؟ این عمل قابل بازگشت نیست.')))return;
  try{await trpcMutation('orders.cancel',{orderId:id,customerPhone:phone,reason:String(reason||'').slice(0,300)});if(typeof trackOrderWithLiveRider==='function')await trackOrderWithLiveRider();else if(typeof secureTrackOrder==='function')await secureTrackOrder();alert(relText('Order cancelled.','سفارش لغو شد.'))}catch(e){alert(e?.message||relText('Cancellation failed.','لغو سفارش انجام نشد.'))}
}
const relBaseRenderTracking=window.renderAdvancedTracking;
if(typeof relBaseRenderTracking==='function'){
  window.renderAdvancedTracking=function(order){relBaseRenderTracking(order);renderCancelControl(order)}
}

document.addEventListener('DOMContentLoaded',()=>{
  if(document.querySelector('form[onsubmit*="placeOrder"]')) relRequestKey();
});
