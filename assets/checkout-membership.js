(function(){
  var host=document.getElementById('checkoutIdentity');
  if(!host)return;
  function tx(en,fa){return (localStorage.getItem('ae_lang')==='fa')?fa:en;}
  function esc(v){return String(v==null?'':v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");}
  function token(){return sessionStorage.getItem('ae_customer_token')||localStorage.getItem('ae_customer_token')||'';}
  function guest(){
    host.className='checkout-identity-card guest';
    host.innerHTML='<div class="checkout-identity-main"><span class="checkout-identity-icon">✓</span><div><b>'+tx('Continue as guest','ادامه به‌عنوان مهمان')+'</b><p>'+tx('No account is required. Enter your contact and delivery details below and place your order.','برای سفارش حساب لازم نیست. معلومات تماس و تحویل را در پایین وارد کنید و سفارش دهید.')+'</p></div></div><div class="checkout-member-actions"><a class="btn btn-light" href="/account?return=%2Fcheckout&auth=login">'+tx('Sign in','ورود')+'</a><a class="btn btn-primary" href="/account?return=%2Fcheckout&auth=register">'+tx('Create account','ساخت حساب')+'</a></div>';
  }
  async function member(){
    var base=(window.AFGHAN_EATS_CONFIG||{}).apiBaseUrl||'';
    var q=encodeURIComponent(JSON.stringify({json:null}));
    try{
      var r=await fetch(base+'/api/trpc/customer.me?input='+q,{headers:{Accept:'application/json',Authorization:'Bearer '+token()}});
      var raw=await r.text();
      if(!r.ok)throw new Error(raw);
      var j=JSON.parse(raw);
      var d=(j&&j.result&&j.result.data&&(j.result.data.json||j.result.data))||null;
      if(!d)throw new Error('No customer data');
      var p=d.profile||{},lo=d.loyalty||{},balance=Number(lo.balance||0);
      var reward=(lo.enabled&&Number(lo.points_per_100_afn||0)>0)
        ?tx(Number(lo.points_per_100_afn)+' points per 100 AFN after delivered member orders.',Number(lo.points_per_100_afn)+' امتیاز به ازای هر ۱۰۰ افغانی پس از سفارش تحویل‌شده عضو.')
        :tx('Eligible rewards and member offers appear when active.','امتیازها و پیشنهادهای واجد شرایط زمانی نمایش داده می‌شوند که فعال باشند.');
      host.className='checkout-identity-card member';
      host.innerHTML='<div class="checkout-identity-main"><span class="checkout-identity-icon">★</span><div><b>'+tx('Member checkout','سفارش عضو')+' · '+esc(p.name||'')+'</b><p>'+esc(reward)+'</p></div></div><div class="checkout-member-balance"><span>'+tx('Current points','امتیاز فعلی')+'</span><strong>'+balance.toLocaleString()+'</strong></div>';
    }catch(e){guest();}
  }
  document.addEventListener('DOMContentLoaded',function(){if(token())member();else guest();});
})();