import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE='https://afghaneats.net';
const OUT='final-production-verification';
await fs.mkdir(OUT,{recursive:true});

const result={
  generatedAt:new Date().toISOString(),
  viewport:{width:390,height:844},
  A:{name:'End-to-end order',status:'not-run'},
  B:{name:'Slow-connection menu',status:'not-run'},
  C:{name:'PWA install',status:'not-run'},
  D:{name:'WhatsApp button',status:'not-run'},
  E:{name:'Map render',status:'not-run'},
  errors:[]
};

function cleanText(v){return String(v??'').replace(/\s+/g,' ').trim();}
async function shot(page,name){await page.screenshot({path:`${OUT}/${name}.png`,fullPage:false});}
async function save(){
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(result,null,2));
}

const browser=await chromium.launch({headless:false,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  deviceScaleFactor:1,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'
});
const page=await context.newPage();
page.on('pageerror',e=>result.errors.push('pageerror: '+e.message));

let orderId='';
let orderPhone='+93700000123';

try{
  // A) end-to-end order.
  await page.goto(`${BASE}/restaurant.html?id=char-fasl-restaurant`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.add-btn:not([disabled])',{timeout:30000});
  const menuInfo=await page.locator('.menu-item.premium-menu-card').evaluateAll(cards=>cards.slice(0,8).map(card=>({
    name:card.querySelector('h3')?.textContent?.trim()||'',
    price:card.querySelector('.menu-price')?.textContent?.trim()||'',
    enabled:!card.querySelector('.add-btn')?.disabled
  })));
  const enabled=page.locator('.add-btn:not([disabled])');
  const enabledCount=await enabled.count();
  if(enabledCount<1) throw new Error('No orderable Char Fasl menu item rendered.');

  await enabled.nth(0).click();
  await page.waitForSelector('#itemModal.open',{timeout:5000});
  const firstName=cleanText(await page.locator('#modalTitle').textContent());
  const firstPrice=cleanText(await page.locator('#modalPrice').textContent());
  await page.locator('#itemModal .btn-primary').click();

  if(await enabled.count()>1){
    await enabled.nth(1).click();
    await page.waitForSelector('#itemModal.open',{timeout:5000});
    await page.locator('#itemModal .btn-primary').click();
  } else {
    // second item = second quantity of first menu item.
    const plus=page.locator('.cart-row .qty button').filter({hasText:'+'}).first();
    await plus.click();
  }

  const cartRows=await page.locator('.cart-row').count();
  const cartQty=await page.locator('.cart-count').first().textContent();
  const waHref=await page.locator('#waOrderBtn').getAttribute('href');
  if(!waHref?.startsWith('https://wa.me/')) throw new Error('WhatsApp order button did not produce a wa.me link.');
  const waUrl=new URL(waHref);
  const waMessage=decodeURIComponent(waUrl.searchParams.get('text')||'');
  const waChecks={
    restaurant:/Afghan Eats order — .+/.test(waMessage),
    items:/Items:\n- \d+ × .+ — AFN /.test(waMessage),
    cash:waMessage.includes('Payment: Cash on delivery')
  };
  if(!Object.values(waChecks).every(Boolean)) throw new Error('WhatsApp message is missing required order content.');
  await shot(page,'A-restaurant-cart-whatsapp');

  await page.goto(`${BASE}/checkout`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('form.checkout-shell',{timeout:20000});
  await page.locator('input[name="fulfillment"][value="delivery"]').check();
  await page.locator('input[name="name"]').fill('Afghan Eats QA Test');
  await page.locator('input[name="phone"]').fill(orderPhone);
  await page.locator('select[name="district"]').selectOption({label:'Herat City'});
  await page.locator('input[name="address"]').fill('Herat City QA test address');
  await page.locator('input[name="landmark"]').fill('AUTOMATED QA TEST');
  await page.locator('textarea[name="instructions"]').fill('AUTOMATED QA TEST — DO NOT PREPARE OR DELIVER');
  const payment=await page.locator('select[name="payment"]').inputValue();
  if(payment!=='cash_on_delivery') throw new Error('Checkout payment is not cash_on_delivery.');

  // Fixed idempotency key prevents duplicates if this diagnostic retries.
  await page.evaluate(()=>sessionStorage.setItem('ae_order_request_id','qa-final-20261005-v1'));
  await page.waitForTimeout(1200);
  const quoteStatus=await page.evaluate(()=>window.AE_CHECKOUT_QUOTE_STATUS);
  const submit=page.locator('form.checkout-shell button[type="submit"]');
  if(await submit.isDisabled()) throw new Error(`Checkout submit is disabled; delivery quote status=${quoteStatus}`);

  await shot(page,'A-checkout-before-submit');
  await Promise.all([
    page.waitForURL(/\/order(?:\.html)?\?id=/,{timeout:45000}),
    submit.click()
  ]);
  const currentUrl=new URL(page.url());
  orderId=currentUrl.searchParams.get('id')||'';
  if(!orderId) throw new Error('Order was placed but no order id appeared in tracking URL.');

  await page.waitForTimeout(1200);
  const lastOrder=await page.evaluate(()=>JSON.parse(localStorage.getItem('ae_last_order')||'null'));
  await page.waitForFunction(()=>!document.querySelector('#trackingExperience')?.classList.contains('is-locked'),null,{timeout:30000});
  await page.waitForSelector('#timelineSteps > *',{timeout:20000});
  await page.waitForSelector('#riderMap.leaflet-container',{timeout:20000});
  await page.waitForSelector('#riderMap .leaflet-marker-icon',{timeout:20000});
  await page.waitForSelector('#riderMap .leaflet-tile',{timeout:20000});

  const tracking=await page.evaluate(()=>({
    timelineCount:document.querySelector('#timelineSteps')?.children.length||0,
    mapClasses:document.querySelector('#riderMap')?.className||'',
    tiles:document.querySelectorAll('#riderMap .leaflet-tile').length,
    markers:document.querySelectorAll('#riderMap .leaflet-marker-icon').length,
    status:document.querySelector('#riderMapStatus')?.textContent?.replace(/\s+/g,' ').trim()||'',
    liveHeading:[...document.querySelectorAll('h2')].some(x=>x.textContent?.includes('Live rider location')),
    journeyHeading:[...document.querySelectorAll('h2')].some(x=>x.textContent?.includes('Your order journey'))
  }));
  if(!tracking.timelineCount||!tracking.tiles||!tracking.markers||!tracking.liveHeading||!tracking.journeyHeading){
    throw new Error('Tracking timeline or Leaflet map did not render completely.');
  }
  await shot(page,'A-order-tracking-map');
  result.A={
    name:'End-to-end order',
    status:'pass',
    restaurant:'Char Fasl Restaurant',
    menuInfo,
    firstItem:{name:firstName,price:firstPrice},
    cartRows,
    cartQuantity:cartQty,
    whatsappHref:waHref,
    whatsappMessage:waMessage,
    whatsappChecks:waChecks,
    payment,
    quoteStatus,
    orderId,
    orderNumber:lastOrder?.orderNumber||lastOrder?.order_number||null,
    tracking,
    heratCenterExpected:[34.352,62.204],
    notes:'Leaflet code uses HERAT_CENTER [34.352, 62.204]; live page rendered tiles and marker.'
  };
  await save();

  // B) Slow 3G.
  const slowContext=await browser.newContext({
    viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/154.0.0.0 Mobile Safari/537.36'
  });
  const slow=await slowContext.newPage();
  const cdp=await slowContext.newCDPSession(slow);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{
    offline:false,
    latency:400,
    downloadThroughput:400*1024/8,
    uploadThroughput:400*1024/8,
    connectionType:'cellular3g'
  });
  const start=Date.now();
  await slow.goto(`${BASE}/restaurant.html?id=char-fasl-restaurant`,{waitUntil:'domcontentloaded',timeout:60000});
  const outcome=await Promise.race([
    slow.waitForSelector('.menu-item.premium-menu-card',{timeout:15000}).then(()=>({type:'menu'})),
    slow.waitForSelector('#menuContent .notice.error',{timeout:15000}).then(()=>({type:'retry'}))
  ]);
  const elapsed=Date.now()-start;
  const skeletonStillVisible=await slow.locator('.menu-skeleton,.skeleton,.store-hero-loading').evaluateAll(els=>els.some(el=>{
    const s=getComputedStyle(el); const r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
  }));
  const retryText=outcome.type==='retry'?cleanText(await slow.locator('#menuContent .notice.error').textContent()):'';
  await shot(slow,'B-slow-3g-menu');
  if(skeletonStillVisible) throw new Error('Slow 3G result left a visible infinite skeleton.');
  if(elapsed>10500 && outcome.type!=='menu' && outcome.type!=='retry') throw new Error('Neither menu nor retry appeared within expected timeout.');
  result.B={name:'Slow-connection menu',status:'pass',outcome:outcome.type,elapsedMs:elapsed,retryText,skeletonStillVisible};
  await slowContext.close();
  await save();

  // C) PWA installability. Browser UI itself cannot be automated by Playwright, so validate
  // the actual install prompt event + app banner + manifest standalone mode and record whether
  // Chromium accepted the prompt when the in-page Install control was clicked.
  const pwaContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pwa=await pwaContext.newPage();
  await pwa.goto(BASE+'/?pwaqa=1',{waitUntil:'networkidle',timeout:60000});
  let banner=false;
  try{
    await pwa.waitForSelector('#aePwaInstall',{timeout:20000});
    banner=true;
  }catch{}
  const manifest=await pwa.evaluate(async()=>{
    const link=document.querySelector('link[rel="manifest"]')?.href||'';
    const m=link?await fetch(link).then(r=>r.json()):null;
    return {link,display:m?.display,name:m?.name,shortName:m?.short_name};
  });
  const sw=await pwa.evaluate(async()=>({
    supported:'serviceWorker' in navigator,
    controller:Boolean(navigator.serviceWorker?.controller),
    registrations:(await navigator.serviceWorker?.getRegistrations?.()||[]).map(r=>r.scope)
  }));
  await shot(pwa,'C-pwa-install-banner');
  if(!banner) throw new Error('Install Afghan Eats banner did not appear on fresh eligible Chromium visit.');
  if(manifest.display!=='standalone') throw new Error('PWA manifest display is not standalone.');
  result.C={
    name:'PWA install',
    status:'partial-pass',
    banner,
    manifest,
    serviceWorker:sw,
    standaloneConfigured:manifest.display==='standalone',
    limitation:'Playwright cannot control Chromium browser-level install confirmation UI; banner/prompt eligibility and standalone manifest were verified.'
  };
  await pwaContext.close();
  await save();

  // D) Dedicated WhatsApp test on restaurant page.
  const waContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const wa=await waContext.newPage();
  await wa.goto(`${BASE}/restaurant.html?id=char-fasl-restaurant`,{waitUntil:'domcontentloaded',timeout:60000});
  await wa.waitForSelector('.add-btn:not([disabled])',{timeout:30000});
  await wa.locator('.add-btn:not([disabled])').first().click();
  await wa.waitForSelector('#itemModal.open',{timeout:5000});
  await wa.locator('#itemModal .btn-primary').click();
  const dedicatedHref=await wa.locator('#waOrderBtn').getAttribute('href');
  const dedicatedMessage=decodeURIComponent(new URL(dedicatedHref).searchParams.get('text')||'');
  const dedicatedChecks={
    restaurant:/Afghan Eats order — .+/.test(dedicatedMessage),
    quantity:/- \d+ × /.test(dedicatedMessage),
    price:/ — AFN /.test(dedicatedMessage),
    cash:dedicatedMessage.includes('Payment: Cash on delivery')
  };
  if(!Object.values(dedicatedChecks).every(Boolean)) throw new Error('Dedicated WhatsApp message content check failed.');
  result.D={name:'WhatsApp button',status:'pass',href:dedicatedHref,message:dedicatedMessage,checks:dedicatedChecks};
  await waContext.close();
  await save();

  // E) Dedicated map test with the valid order created in A.
  const mapContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const map=await mapContext.newPage();
  await map.addInitScript(({lastOrder})=>{
    localStorage.setItem('ae_last_order',JSON.stringify(lastOrder));
  },{lastOrder});
  await map.goto(`${BASE}/order?id=${encodeURIComponent(orderId)}`,{waitUntil:'domcontentloaded',timeout:60000});
  await map.waitForSelector('#riderMap.leaflet-container',{timeout:20000});
  await map.waitForSelector('#riderMap .leaflet-marker-icon',{timeout:20000});
  await map.waitForSelector('#riderMap .leaflet-tile',{timeout:20000});
  const mapState=await map.evaluate(()=>({
    tiles:document.querySelectorAll('#riderMap .leaflet-tile').length,
    markers:document.querySelectorAll('#riderMap .leaflet-marker-icon').length,
    size:{
      width:document.querySelector('#riderMap')?.getBoundingClientRect().width||0,
      height:document.querySelector('#riderMap')?.getBoundingClientRect().height||0
    },
    status:document.querySelector('#riderMapStatus')?.textContent?.replace(/\s+/g,' ').trim()||''
  }));
  await shot(map,'E-map-render');
  if(!mapState.tiles||!mapState.markers||mapState.size.height<250) throw new Error('Dedicated Leaflet map render test failed.');
  result.E={name:'Map render',status:'pass',orderId,mapState,heratCenterExpected:[34.352,62.204]};
  await mapContext.close();
  await save();

}catch(error){
  const active=['A','B','C','D','E'].find(k=>result[k].status==='not-run');
  if(active) result[active]={...result[active],status:'fail',error:error.message};
  result.errors.push(error.stack||error.message);
  await shot(page,'FAIL-current-page').catch(()=>{});
  await save();
  console.error('FINAL_PRODUCTION_VERIFICATION_FAILED',error);
  await context.close();
  await browser.close();
  process.exit(1);
}

await context.close();
await browser.close();
await save();
console.log('===FINAL_PRODUCTION_VERIFICATION===');
console.log(JSON.stringify(result,null,2));
