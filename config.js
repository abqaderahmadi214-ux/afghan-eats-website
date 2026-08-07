window.AFGHAN_EATS_CONFIG = {
  apiBaseUrl: 'https://afghaneats-api.onrender.com',
  supportPhone: '+93 796 851 968',
  supportEmail: 'support@afghaneats.net',
  launchCity: 'Herat'
};

(function loadMerchantOperations(){
  const path=location.pathname.toLowerCase();
  const owner=path.endsWith('/owner.html')||path==='/owner';
  const customer=path==='/'||path.endsWith('/index.html')||path.endsWith('/restaurants.html')||path.endsWith('/restaurant.html')||path.endsWith('/checkout.html');
  const src=owner?'/assets/merchant-owner.js':customer?'/assets/merchant.js':'';
  if(!src)return;
  const script=document.createElement('script');script.src=src;script.async=true;script.dataset.aeMerchantModule='1';document.head.appendChild(script);
})();

(function loadDispatchIntelligence(){
  const path=location.pathname.toLowerCase();
  const enabled=path.endsWith('/operations.html')||path.endsWith('/owner.html')||path.endsWith('/rider-portal.html')||path.endsWith('/order.html')||path==='/operations'||path==='/owner'||path==='/rider-portal'||path==='/order';
  if(!enabled)return;
  const script=document.createElement('script');script.src='/assets/dispatch.js';script.async=true;script.dataset.aeDispatchModule='1';document.head.appendChild(script);
})();

(function loadLastMilePrecision(){
  const path=location.pathname.toLowerCase();
  const enabled=path.endsWith('/operations.html')||path.endsWith('/rider-portal.html')||path.endsWith('/order.html')||path==='/operations'||path==='/rider-portal'||path==='/order';
  if(!enabled)return;
  const script=document.createElement('script');script.src='/assets/lastmile.js';script.async=true;script.dataset.aeLastMileModule='1';document.head.appendChild(script);
})();
