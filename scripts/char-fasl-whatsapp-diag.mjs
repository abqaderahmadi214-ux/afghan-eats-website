import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/154.0 Mobile Safari/537.36'});
const page=await context.newPage();
await page.goto('https://afghaneats.net/restaurant.html?id=char-fasl-restaurant',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>[...document.querySelectorAll('.add-btn:not([disabled])')].some(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}),{timeout:15000});
const label=await page.locator('.add-btn:not([disabled]):visible').first().getAttribute('aria-label');
await page.getByRole('button',{name:label,exact:true}).first().click();
await page.locator('#itemModal.open').waitFor({state:'visible',timeout:5000});
await page.locator('#itemModal button[onclick="addCurrent()"]').click();
await page.waitForTimeout(500);
const state=await page.evaluate(async()=>{
  const cart=JSON.parse(localStorage.getItem('ae_cart')||'[]');
  const btn=document.getElementById('waOrderBtn');
  const before={href:btn?.href||'',disabled:btn?.getAttribute('aria-disabled')||'',pointer:btn?.style.pointerEvents||'',opacity:btn?.style.opacity||''};
  const restaurant=window.currentRestaurant||null;
  let lexical=null;
  try{lexical=currentRestaurant}catch{}
  const hook=window.AfghanEatsWhatsApp;
  let manualLink='';
  if(hook?.updateButton){
    manualLink=hook.updateButton({restaurant,restaurantName:restaurant?.name||'',items:cart});
  }
  const after={href:btn?.href||'',disabled:btn?.getAttribute('aria-disabled')||'',pointer:btn?.style.pointerEvents||'',opacity:btn?.style.opacity||''};
  const appText=await fetch('/assets/app.js?v=20261004-menu-timeout-1',{cache:'no-store'}).then(r=>r.text());
  const waText=await fetch('/assets/whatsapp-order.js',{cache:'no-store'}).then(r=>r.text());
  return {
    cart,
    before,
    after,
    manualLink,
    hookType:typeof hook,
    updateType:typeof hook?.updateButton,
    syncType:typeof syncWhatsAppOrderButton,
    restaurant:restaurant?{id:restaurant.id,name:restaurant.name,phone:restaurant.phone||null,whatsapp:restaurant.whatsapp||null,whatsapp_number:restaurant.whatsapp_number||null,public_slug:restaurant.public_slug||null,slug:restaurant.slug||null}:null,
    lexical:lexical?{id:lexical.id,name:lexical.name,phone:lexical.phone||null,whatsapp:lexical.whatsapp||null,whatsapp_number:lexical.whatsapp_number||null}:null,
    appHasSync:appText.includes('syncWhatsAppOrderButton'),
    appHasHookCall:appText.includes('AfghanEatsWhatsApp?.updateButton'),
    waHasPhoneFallback:waText.includes("restaurant?.phone")
  };
});
console.log('===CHAR_FASL_WHATSAPP_DIAG===');
console.log(JSON.stringify(state,null,2));
await browser.close();
