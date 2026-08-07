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
