window.AFGHAN_EATS_CONFIG = {
  adminUrl: 'https://afghan-eats-admin.onrender.com',
  releaseManifestUrl: '/data/platform-release.json',
  apiBaseUrl: 'https://afghaneats-api.onrender.com',
  supportPhone: '+93 796 851 968',
  supportEmail: 'support@afghaneats.net',
  customerAndroidPackage: 'net.afghaneats.customer',
  customerAndroidVersion: '1.2.0',
  customerAndroidVersionCode: 8,
  riderAndroidPackage: 'net.afghaneats.rider',
  riderAndroidVersion: '1.1.2',
  riderAndroidVersionCode: 4,
  customerAndroidUrl: '',
  customerIosUrl: '',
  launchCity: 'Herat',
  googleMapsApiKey: '__GMAPS_KEY__'
};

function aeRoutePath() { const path = location.pathname.toLowerCase().replace(/\/+$/, '') || '/'; return path !== '/' && !/\.[a-z0-9]+$/.test(path) ? `${path}.html` : path; }

(function prepareCustomerLocale(){const fa=localStorage.getItem('ae_lang')==='fa';document.documentElement.lang=fa?'fa':'en';document.documentElement.dir=fa?'rtl':'ltr';document.documentElement.dataset.aeLocaleReady='1'})();
(function loadAccessibilityV39(){const script=document.createElement('script');script.src='/assets/accessibility.js';script.async=true;script.dataset.aeAccessibilityV39='1';document.head.appendChild(script)})();
(function loadMerchantOperations(){const path=aeRoutePath(),owner=path.endsWith('/owner.html')||path==='/owner',customer=path==='/'||path.endsWith('/index.html')||path.endsWith('/restaurants.html')||path.endsWith('/restaurant.html')||path.endsWith('/checkout.html'),src=owner?'/assets/merchant-owner.js':customer?'/assets/merchant.js?v=20260905-3':'';if(!src)return;const script=document.createElement('script');script.src=src;script.async=true;script.dataset.aeMerchantModule='1';document.head.appendChild(script)})();
(function loadDispatchIntelligence(){const path=aeRoutePath(),enabled=path.endsWith('/operations.html')||path.endsWith('/owner.html')||path.endsWith('/rider-portal.html')||path==='/operations'||path==='/owner'||path==='/rider-portal';if(!enabled)return;const script=document.createElement('script');script.src='/assets/dispatch.js';script.async=true;script.dataset.aeDispatchModule='1';document.head.appendChild(script)})();
(function loadLastMilePrecision(){const path=aeRoutePath(),enabled=path.endsWith('/operations.html')||path.endsWith('/rider-portal.html')||path.endsWith('/order.html')||path==='/operations'||path==='/rider-portal'||path==='/order';if(!enabled)return;const script=document.createElement('script');script.src='/assets/lastmile.js';script.async=true;script.dataset.aeLastMileModule='1';document.head.appendChild(script)})();
(function loadMarketplaceIntegrity(){const path=aeRoutePath();if(!(path.endsWith('/operations.html')||path==='/operations'))return;const script=document.createElement('script');script.src='/assets/integrity.js';script.async=true;script.dataset.aeIntegrityModule='1';document.head.appendChild(script)})();
(function loadPlatformStatus(){const script=document.createElement('script');script.src='/assets/platform-status.js';script.async=true;script.dataset.aePlatformStatus='1';document.head.appendChild(script)})();
(function loadCityContext(){const script=document.createElement('script');script.src='/assets/cities.js?v=20260913-final';script.async=true;script.dataset.aeCityModule='1';document.head.appendChild(script)})();
(function loadMerchantQuality(){const path=aeRoutePath(),enabled=path==='/'||path.endsWith('/index.html')||path.endsWith('/restaurants.html')||path.endsWith('/operations.html')||path.endsWith('/owner.html')||path==='/operations'||path==='/owner';if(!enabled)return;const script=document.createElement('script');script.src='/assets/quality.js';script.async=true;script.dataset.aeMerchantQuality='1';document.head.appendChild(script)})();
(function loadCatalogStudio(){const path=aeRoutePath(),enabled=path.endsWith('/restaurant.html')||path.endsWith('/checkout.html')||path.endsWith('/owner.html')||path==='/restaurant'||path==='/checkout'||path==='/owner';if(!enabled)return;const script=document.createElement('script');script.src='/assets/catalog.js';script.async=true;script.dataset.aeCatalogModule='1';document.head.appendChild(script)})();
(function loadLiveDiscovery(){const path=aeRoutePath(),enabled=path==='/'||path.endsWith('/index.html');if(!enabled)return;const script=document.createElement('script');script.src='/assets/live-search.js?v=20260913-final';script.async=true;script.dataset.aeLiveDiscovery='1';document.head.appendChild(script)})();
(function loadRewardsRedemption(){const path=aeRoutePath(),enabled=path.endsWith('/checkout.html')||path.endsWith('/operations.html')||path==='/checkout'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/rewards.js';script.async=true;script.dataset.aeRewardsModule='1';document.head.appendChild(script)})();
(function loadOrderRecovery(){const path=aeRoutePath(),enabled=path.endsWith('/order.html')||path.endsWith('/owner.html')||path==='/order'||path==='/owner';if(!enabled)return;const script=document.createElement('script');script.src='/assets/recovery.js';script.async=true;script.dataset.aeRecoveryModule='1';document.head.appendChild(script)})();
(function loadGroupOrdering(){const path=aeRoutePath(),enabled=path.endsWith('/restaurant.html')||path.endsWith('/checkout.html')||path.endsWith('/order.html')||path==='/restaurant'||path==='/checkout'||path==='/order';if(!enabled)return;const script=document.createElement('script');script.src='/assets/group-order.js';script.async=true;script.dataset.aeGroupOrderModule='1';document.head.appendChild(script)})();
(function loadRealtimeOrderTimeline(){const path=aeRoutePath(),enabled=path.endsWith('/order.html')||path.endsWith('/owner.html')||path.endsWith('/rider-portal.html')||path.endsWith('/operations.html')||path==='/order'||path==='/owner'||path==='/rider-portal'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/timeline.js';script.async=true;script.dataset.aeTimelineModule='1';document.head.appendChild(script)})();
(function loadSmartScheduling(){const path=aeRoutePath(),enabled=path.endsWith('/checkout.html')||path.endsWith('/owner.html')||path==='/checkout'||path==='/owner';if(!enabled)return;const script=document.createElement('script');script.src='/assets/scheduling.js';script.async=true;script.dataset.aeSchedulingModule='1';document.head.appendChild(script)})();
(function loadPersonalizedHome(){const path=aeRoutePath(),enabled=path==='/'||path.endsWith('/index.html');if(!enabled)return;const script=document.createElement('script');script.src='/assets/personalization.js?v=20260905-2';script.async=true;script.dataset.aePersonalizationModule='1';document.head.appendChild(script)})();
(function loadSupportResolution(){const path=aeRoutePath(),enabled=path.endsWith('/help.html')||path.endsWith('/account.html')||path.endsWith('/operations.html')||path==='/help'||path==='/account'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/support-resolution.js';script.async=true;script.dataset.aeSupportResolution='1';document.head.appendChild(script)})();
(function prepareGrowthLayout(){document.addEventListener('DOMContentLoaded',()=>document.querySelector('.container.menu-layout')?.classList.add('restaurant-layout'))})();
(function loadMerchantGrowth(){const path=aeRoutePath(),enabled=path==='/'||path.endsWith('/index.html')||path.endsWith('/restaurants.html')||path.endsWith('/restaurant.html')||path.endsWith('/checkout.html')||path.endsWith('/owner.html')||path.endsWith('/operations.html')||path==='/restaurants'||path==='/restaurant'||path==='/checkout'||path==='/owner'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/growth.js';script.async=true;script.dataset.aeGrowthModule='1';document.head.appendChild(script)})();
(function loadMerchantFinanceV30(){const path=aeRoutePath(),enabled=path.endsWith('/owner.html')||path.endsWith('/operations.html')||path==='/owner'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/merchant-finance-v30.js';script.async=true;script.dataset.aeMerchantFinanceV30='1';document.head.appendChild(script)})();
(function loadCompensationV31(){const path=aeRoutePath(),enabled=path.endsWith('/help.html')||path.endsWith('/account.html')||path.endsWith('/checkout.html')||path.endsWith('/operations.html')||path==='/help'||path==='/account'||path==='/checkout'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/compensation.js';script.async=true;script.dataset.aeCompensationV31='1';document.head.appendChild(script)})();
(function loadFoodSafetyV32(){const path=aeRoutePath(),enabled=path.endsWith('/restaurant.html')||path.endsWith('/checkout.html')||path.endsWith('/account.html')||path.endsWith('/owner.html')||path.endsWith('/operations.html')||path==='/restaurant'||path==='/checkout'||path==='/account'||path==='/owner'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/food-safety.js';script.async=true;script.dataset.aeFoodSafetyV32='1';document.head.appendChild(script)})();
(function loadKitchenV33(){const path=aeRoutePath(),enabled=path.endsWith('/owner.html')||path.endsWith('/rider-portal.html')||path.endsWith('/operations.html')||path==='/owner'||path==='/rider-portal'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/kitchen.js';script.async=true;script.dataset.aeKitchenV33='1';document.head.appendChild(script)})();
(function loadDemandForecastV34(){const path=aeRoutePath(),enabled=path.endsWith('/owner.html')||path.endsWith('/operations.html')||path==='/owner'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/forecast.js';script.async=true;script.dataset.aeDemandForecastV34='1';document.head.appendChild(script)})();
(function loadInventoryV35(){const path=aeRoutePath(),enabled=path.endsWith('/restaurant.html')||path.endsWith('/checkout.html')||path.endsWith('/owner.html')||path.endsWith('/operations.html')||path==='/restaurant'||path==='/checkout'||path==='/owner'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/inventory.js';script.async=true;script.dataset.aeInventoryV35='1';document.head.appendChild(script)})();
(function loadObservabilityV36(){const path=aeRoutePath();if(!(path.endsWith('/operations.html')||path==='/operations'))return;const script=document.createElement('script');script.src='/assets/observability.js';script.async=true;script.dataset.aeObservabilityV36='1';document.head.appendChild(script)})();
(function loadDataReadinessV37(){const path=aeRoutePath(),enabled=path.endsWith('/account.html')||path.endsWith('/operations.html')||path==='/account'||path==='/operations';if(!enabled)return;const script=document.createElement('script');script.src='/assets/data-readiness.js';script.async=true;script.dataset.aeDataReadinessV37='1';document.head.appendChild(script)})();
(function loadSecurityPostureV38(){const path=aeRoutePath();if(!(path.endsWith('/operations.html')||path==='/operations'))return;const script=document.createElement('script');script.src='/assets/security-posture.js';script.async=true;script.dataset.aeSecurityPostureV38='1';document.head.appendChild(script)})();
(function loadLaunchReadinessV40(){const path=aeRoutePath();if(!(path.endsWith('/operations.html')||path==='/operations'))return;const script=document.createElement('script');script.src='/assets/launch-readiness.js';script.async=true;script.dataset.aeLaunchReadinessV40='1';document.head.appendChild(script)})();
(function loadRestaurantClaimsV48(){const path=aeRoutePath();if(!(path.endsWith('/operations.html')||path==='/operations'))return;const script=document.createElement('script');script.src='/assets/claims.js';script.async=true;script.dataset.aeRestaurantClaimsV48='1';document.head.appendChild(script)})();
(function loadIdentityV53(){const path=aeRoutePath(),enabled=path.endsWith('/account.html')||path.endsWith('/rider.html')||path.endsWith('/rider-portal.html')||path==='/account'||path==='/rider'||path==='/rider-portal';if(!enabled)return;const script=document.createElement('script');script.src='/assets/identity.js';script.defer=true;script.dataset.aeIdentityV53='1';document.head.appendChild(script)})();


(function loadSharedFoundation(){if(document.querySelector('link[data-ae-foundation]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/platform-foundation.css?v=premium-experience-2-mobile-1';link.dataset.aeFoundation='1';document.head.appendChild(link)})();

// Capture the current token for this request; do not read mutable storage after logout.
window.aeEndSession = async function (token) {
  if (!token) return true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${window.AFGHAN_EATS_CONFIG.apiBaseUrl}/api/trpc/sessions.logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ json: {} }), signal: controller.signal, keepalive: true });
    if (!response.ok) throw new Error('Session revocation not confirmed');
    return true;
  } catch { sessionStorage.setItem('ae_logout_unconfirmed', '1'); return false; }
  finally { clearTimeout(timer); }
};
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('ae_logout_unconfirmed') !== '1') return;
  sessionStorage.removeItem('ae_logout_unconfirmed');
  const message = document.createElement('p');
  message.className = 'notice error'; message.setAttribute('role', 'status');
  message.textContent = document.documentElement.lang === 'fa' ? 'از این دستگاه خارج شدید. قطع نشست در سرور تأیید نشد؛ هنگام اتصال دوباره رمز خود را تغییر دهید اگر نشست مشکوک است.' : 'Signed out on this device. Server sign-out could not be confirmed. If you suspect account access, change your password after reconnecting.';
  document.querySelector('main')?.prepend(message);
});
