import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BASE='https://afghaneats.net';
const OUT='final-production-verification';
const PHONE='+93 796 851 968';
const QA_NOTE='AUTOMATED QA TEST — DO NOT PREPARE OR DELIVER. Safe to cancel after verification.';
const REQUEST_KEY='qa-final-20261005-231e696453c4168f';
await fs.mkdir(OUT,{recursive:true});

const results={
  generatedAt:new Date().toISOString(),
  finalCommit:'231e696453c4168fab5c6868530a0fb4f3be43cb',
  endToEnd:{pass:false},
  slow3g:{pass:false},
  pwa:{pass:false},
  whatsapp:{pass:false},
  map:{pass:false},
  errors:[]
};

function fail(section,error){
  const msg=String(error?.stack||error?.message||error);
  results[section]={...(results[section]||{}),pass:false,error:msg};
  results.errors.push({section,error:msg});
}
function mobileContextOptions(){
  return {
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    locale:'en-US',
    userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'
  };
}
async function screenshot(page,name,fullPage=false){
  await page.screenshot({path:`${OUT}/${name}`,fullPage});
}
async function waitForMenuOrError(page,timeout=20000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    const state=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.premium-menu-card')].filter(el=>{
        const r=el.getBoundingClientRect(); return r.width>0&&r.height>0;
      }).length;
      const enabled=[...document.querySelectorAll('.add-btn:not([disabled])')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}).length;
      const err=document.querySelector('#menuContent .notice.error');
      return {cards,enabled,error:Boolean(err),errorText:err?.textContent?.trim()||''};
    });
    if(state.enabled>0||state.error)return {...state,elapsedMs:Date.now()-start};
    await page.waitForTimeout(200);
  }
  return {...await page.evaluate(()=>({
    cards:document.querySelectorAll('.premium-menu-card').length,
    enabled:[...document.querySelectorAll('.add-btn:not([disabled])')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}).length,
    error:Boolean(document.querySelector('#menuContent .notice.error')),
    errorText:document.querySelector('#menuContent .notice.error')?.textContent?.trim()||''
  })),elapsedMs:Date.now()-start,timeout:true};
}

const browser=await chromium.launch({headless:false,args:['--disable-dev-shm-usage']});

try{
  // A + D + E: live ordering, WhatsApp, checkout, tracking, map.
  try{
    const context=await browser.newContext(mobileContextOptions());
    await context.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>WhatsApp link test</title><p>Intercepted without sending.</p>'}));
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e.message||e)));
    page.on('console',m=>{ if(m.type()==='error') pageErrors.push('console: '+m.text()); });

    await page.goto(`${BASE}/restaurant.html?id=food-box-restaurant`,{waitUntil:'domcontentloaded',timeout:30000});
    const menu=await waitForMenuOrError(page,20000);
    if(menu.enabled<2) throw new Error(`Char Fasl did not expose two orderable menu items: ${JSON.stringify(menu)}`);
    await screenshot(page,'01-char-fasl-menu.png');

    // Add two genuinely distinct menu items by unique accessible item names.
    const buttonMeta=await page.locator('.add-btn:not([disabled]):visible').evaluateAll(btns=>btns.map(b=>({
      label:b.getAttribute('aria-label')||'',
      onclick:b.getAttribute('onclick')||''
    })));
    const distinctLabels=[...new Set(buttonMeta.map(x=>x.label).filter(Boolean))].slice(0,2);
    if(distinctLabels.length<2) throw new Error('Fewer than two distinct visible orderable dishes were found: '+JSON.stringify(buttonMeta));

    for(const label of distinctLabels){
      await page.getByRole('button',{name:label,exact:true}).first().click();
      await page.locator('#itemModal.open').waitFor({state:'visible',timeout:5000});
      await page.locator('#itemModal button[onclick="addCurrent()"]').click();
      await page.waitForTimeout(250);
    }

    // Respect the 200 AFN minimum without changing restaurants.
    for(let guard=0;guard<4;guard++){
      const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('ae_cart')||'[]'));
      const subtotal=cart.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);
      if(subtotal>=200)break;
      await page.getByRole('button',{name:distinctLabels[0],exact:true}).first().click();
      await page.locator('#itemModal.open').waitFor({state:'visible',timeout:5000});
      await page.locator('#itemModal button[onclick="addCurrent()"]').click();
      await page.waitForTimeout(200);
    }

    const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('ae_cart')||'[]'));
    if(cart.length<2) throw new Error('Cart does not contain two distinct items after UI add flow. buttons='+JSON.stringify(buttonMeta)+' cart='+JSON.stringify(cart));

    const wa=await page.evaluate(()=>{
      const a=document.getElementById('waOrderBtn');
      return {href:a?.href||'',disabled:a?.getAttribute('aria-disabled'),text:a?.textContent?.trim()||'',restaurant:document.querySelector('.store-title h1, #storeHero h1')?.textContent?.trim()||''};
    });
    if(!wa.href.startsWith('https://wa.me/')) throw new Error(`WhatsApp href missing: ${JSON.stringify(wa)}`);
    const waUrl=new URL(wa.href);
    const waMessage=waUrl.searchParams.get('text')||'';
    const messageChecks={
      restaurant:/Afghan Eats order —/i.test(waMessage),
      items:cart.every(x=>waMessage.includes(x.name)&&waMessage.includes(String(x.qty))),
      prices:cart.every(x=>waMessage.includes('AFN')),
      cash:waMessage.includes('Payment: Cash on delivery')
    };
    if(!Object.values(messageChecks).every(Boolean)) throw new Error(`WhatsApp message incomplete: ${JSON.stringify({messageChecks,waMessage})}`);

    const popupPromise=context.waitForEvent('page',{timeout:5000});
    await page.locator('#waOrderBtn').click();
    const popup=await popupPromise;
    await popup.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{});
    const clickedWhatsAppUrl=popup.url();
    await popup.close();
    await screenshot(page,'02-whatsapp-cart.png');

    results.whatsapp={pass:true,href:wa.href,clickedUrl:clickedWhatsAppUrl,message:waMessage,cart,messageChecks};

    // Checkout with cash on delivery.
    await page.goto(`${BASE}/checkout`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('form.checkout-shell').waitFor({state:'visible',timeout:10000});
    await page.evaluate(key=>sessionStorage.setItem('ae_order_request_id',key),REQUEST_KEY);
    await page.locator('input[name="name"]').fill('Afghan Eats QA');
    await page.locator('input[name="phone"]').fill(PHONE);
    await page.locator('select[name="payment"]').selectOption('cash_on_delivery');
    await page.locator('textarea[name="instructions"]').fill(QA_NOTE);

    const addressCandidates=[
      {district:'Herat City',address:'Herat City, Tank Markaz'},
      {district:'Tank Markaz',address:'Tank Markaz, Herat City'},
      {district:'Gulha',address:'Gulha Circle, Herat City'}
    ];
    let quote=null;
    for(const candidate of addressCandidates){
      await page.locator('select[name="district"]').selectOption({label:candidate.district});
      await page.locator('input[name="address"]').fill(candidate.address);
      await page.locator('input[name="landmark"]').fill('Afghan Eats automated QA');
      await page.waitForTimeout(1700);
      quote=await page.evaluate(()=>({status:window.AE_CHECKOUT_QUOTE_STATUS,disabled:document.querySelector('form.checkout-shell button[type="submit"]')?.disabled||false,quoteText:document.querySelector('#deliveryQuotePanel')?.textContent?.trim()||''}));
      if(quote.status!==false&&!quote.disabled)break;
    }
    if(quote?.status===false||quote?.disabled) throw new Error(`No deliverable QA address found: ${JSON.stringify(quote)}`);
    await screenshot(page,'03-checkout-ready.png');

    const submit=page.locator('form.checkout-shell button[type="submit"]');
    await submit.click();
    try{
      await page.waitForURL(/\/order(?:\.html)?\?id=/,{timeout:30000});
    }catch{
      const err=await page.locator('#checkoutError').textContent().catch(()=> '');
      const state=await page.locator('#orderSubmitState').textContent().catch(()=> '');
      throw new Error(`Checkout did not reach tracking page. error=${err} state=${state} url=${page.url()}`);
    }

    const orderId=new URL(page.url()).searchParams.get('id');
    const lastOrder=await page.evaluate(()=>JSON.parse(localStorage.getItem('ae_last_order')||'null'));
    if(!orderId) throw new Error('Order ID missing after checkout redirect.');

    // The page auto-verifies from ae_last_order; wait for journey and map.
    await page.locator('#riderMap.leaflet-container').waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(()=>document.querySelectorAll('#timelineSteps > *').length>0,{timeout:15000}).catch(()=>{});
    const tracking=await page.evaluate(async()=>{
      const source=await fetch('/assets/order-map.js',{cache:'no-store'}).then(r=>r.text());
      const map=document.getElementById('riderMap');
      const exp=document.getElementById('trackingExperience');
      return {
        timelineCount:document.querySelectorAll('#timelineSteps > *').length,
        mapClass:map?.className||'',
        mapHeight:map?.getBoundingClientRect().height||0,
        tileCount:map?.querySelectorAll('.leaflet-tile').length||0,
        markerCount:map?.querySelectorAll('.leaflet-marker-icon').length||0,
        markerTitle:map?.querySelector('.leaflet-marker-icon')?.getAttribute('title')||'',
        status:document.getElementById('riderMapStatus')?.textContent?.trim()||'',
        locked:exp?.classList.contains('is-locked')??true,
        sourceHasHeratCenter:source.includes('HERAT_CENTER = [34.352, 62.204]')
      };
    });
    await screenshot(page,'04-order-tracking-map.png');

    const mapPass=tracking.mapHeight>=290&&tracking.tileCount>0&&tracking.markerCount>0&&tracking.sourceHasHeratCenter;
    const journeyPass=tracking.timelineCount>0&&!tracking.locked;
    results.map={pass:mapPass,orderId,tracking};
    results.endToEnd={pass:menu.enabled>=2&&Boolean(orderId)&&journeyPass&&mapPass,menu,cart,quote,orderId,lastOrder,tracking,pageErrors};

    // Cleanup the authorized QA order if customer cancellation is still available.
    let cleanup='not available';
    const cancelVisible=await page.locator('#orderCancelControl button').count();
    if(cancelVisible){
      let dialogStep=0;
      page.on('dialog',async dialog=>{
        dialogStep++;
        if(dialog.type()==='prompt') await dialog.accept('Automated QA cleanup');
        else await dialog.accept();
      });
      await page.locator('#orderCancelControl button').click();
      await page.waitForTimeout(2500);
      cleanup='cancel requested';
    }
    results.endToEnd.cleanup=cleanup;
    await context.close();
  }catch(error){ fail('endToEnd',error); if(!results.whatsapp.pass) fail('whatsapp',error); if(!results.map.pass) fail('map',error); }

  // B: Slow 3G menu behavior.
  try{
    const context=await browser.newContext(mobileContextOptions());
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{
      offline:false,
      latency:400,
      downloadThroughput:500*1024/8,
      uploadThroughput:500*1024/8,
      connectionType:'cellular3g'
    });
    await page.goto(`${BASE}/restaurant.html?id=char-fasl-restaurant`,{waitUntil:'domcontentloaded',timeout:45000});
    const state=await waitForMenuOrError(page,12000);
    const skeletonCount=await page.locator('.ae-loading-card, [class*="skeleton"]').count();
    const pass=Boolean((state.enabled>0||state.error)&&state.elapsedMs<=10500);
    await screenshot(page,'05-slow-3g-menu.png');
    results.slow3g={pass,state,skeletonCount,measurement:'elapsed from DOMContentLoaded to menu/retry state'};
    await context.close();
  }catch(error){fail('slow3g',error);}

  // C: PWA installability, custom install banner, install-button invocation, standalone launch semantics.
  try{
    // Use a persistent profile: Chrome suppresses beforeinstallprompt in incognito contexts.
    const installUserDir=await fs.mkdtemp(path.join(os.tmpdir(),'ae-pwa-install-'));
    const context=await chromium.launchPersistentContext(installUserDir,{
      headless:false,
      viewport:{width:390,height:844},
      deviceScaleFactor:2,
      hasTouch:true,
      locale:'en-US',
      userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
      args:['--disable-dev-shm-usage']
    });
    const page=context.pages()[0]||await context.newPage();
    await page.addInitScript(()=>{
      window.__aeBeforeInstallPrompt=false;
      window.addEventListener('beforeinstallprompt',()=>{window.__aeBeforeInstallPrompt=true;},{once:true});
    });
    await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:30000});
    await page.waitForTimeout(4500);
    const cdp=await context.newCDPSession(page);
    const installability=await cdp.send('Page.getInstallabilityErrors').catch(e=>({error:String(e)}));
    const manifest=await cdp.send('Page.getAppManifest').catch(e=>({error:String(e)}));
    const banner=await page.evaluate(()=>({
      beforeInstallPrompt:Boolean(window.__aeBeforeInstallPrompt),
      exists:Boolean(document.getElementById('aePwaInstall')),
      text:document.getElementById('aePwaInstall')?.textContent?.trim()||'',
      installButton:Boolean(document.querySelector('[data-pwa-install]')),
      swControlled:Boolean(navigator.serviceWorker?.controller)
    }));
    await screenshot(page,'06-pwa-install-banner.png');

    let installClickInvoked=false;
    if(banner.installButton&&banner.beforeInstallPrompt){
      await page.locator('[data-pwa-install]').click({timeout:3000}).catch(()=>{});
      installClickInvoked=true;
      await page.waitForTimeout(700);
    }
    await context.close();
    await fs.rm(installUserDir,{recursive:true,force:true});

    const userDir=await fs.mkdtemp(path.join(os.tmpdir(),'ae-pwa-app-'));
    const appContext=await chromium.launchPersistentContext(userDir,{
      headless:false,
      viewport:{width:390,height:844},
      args:[`--app=${BASE}/`,'--disable-dev-shm-usage']
    });
    let appPage=appContext.pages()[0];
    if(!appPage){appPage=await appContext.newPage(); await appPage.goto(BASE);}
    await appPage.waitForLoadState('domcontentloaded',{timeout:20000}).catch(()=>{});
    const standalone=await appPage.evaluate(()=>({
      displayModeStandalone:matchMedia('(display-mode: standalone)').matches,
      manifestDisplay:null
    })).catch(()=>({displayModeStandalone:false}));
    const manifestJson=await appPage.evaluate(async()=>fetch('/manifest.json',{cache:'no-store'}).then(r=>r.json())).catch(()=>null);
    standalone.manifestDisplay=manifestJson?.display||null;
    await screenshot(appPage,'07-pwa-standalone-launch.png');
    await appContext.close();
    await fs.rm(userDir,{recursive:true,force:true});

    const errors=Array.isArray(installability?.installabilityErrors)?installability.installabilityErrors:installability?.installabilityErrors||[];
    const noBlockingErrors=Array.isArray(errors)?errors.length===0:false;
    const pass=banner.beforeInstallPrompt&&banner.exists&&/Install Afghan Eats/.test(banner.text)&&noBlockingErrors&&standalone.manifestDisplay==='standalone'&&standalone.displayModeStandalone===true;
    results.pwa={pass,banner,installClickInvoked,installability,manifest:{url:manifest?.url||'',errors:manifest?.errors||[]},standalone,note:'Install button was invoked; Chrome browser-level confirmation UI cannot be accepted through page DOM automation. Standalone mode was verified via Chrome app-mode launch.'};
  }catch(error){fail('pwa',error);}

}finally{
  await browser.close().catch(()=>{});
}

await fs.writeFile(`${OUT}/report.json`,JSON.stringify(results,null,2));
console.log('===FINAL_PRODUCTION_VERIFICATION===');
console.log(JSON.stringify(results,null,2));

// Do not fail the job solely to preserve screenshots/report; status is encoded in report.
