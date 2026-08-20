const { test, expect } = require('@playwright/test');

function trpc(data){return JSON.stringify({result:{data:{json:data}}})}

test('a signed-in customer can view a privacy-safe delivery summary without entering a checkout phone', async ({page})=>{
  let authorization='';
  await page.addInitScript(()=>sessionStorage.setItem('ae_customer_token','customer-account-token'));
  await page.route('https://afghaneats-api.onrender.com/api/trpc/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/customerDelivery.track')){
      authorization=route.request().headers().authorization||'';
      await route.fulfill({status:200,contentType:'application/json',body:trpc({
        order:{id:'33333333-3333-4333-8333-333333333333',orderNumber:'AE-2090',restaurantName:'Herat Kitchen',status:'on_the_way'},
        rider:{firstName:'Farid',vehicle:'motorcycle',status:'on_the_way',liveDistanceKm:1.4,roughEtaMinutes:8},
        handoff:{customerLocationShared:true,pinEnabled:true,pinVerified:false},
      })});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:trpc([])});
  });
  await page.goto('/order.html?id=33333333-3333-4333-8333-333333333333');
  await expect(page.locator('#aeAccountDeliveryTracking')).toContainText('AE-2090');
  await expect(page.locator('#aeAccountDeliveryTracking')).toContainText('Farid');
  await expect(page.locator('#aeAccountDeliveryTracking')).toContainText('1.4 km');
  await expect(page.locator('#aeAccountDeliveryTracking')).not.toContainText('+93');
  await expect(page.locator('#aeAccountDeliveryTracking')).not.toContainText('latitude');
  expect(authorization).toBe('Bearer customer-account-token');
});
