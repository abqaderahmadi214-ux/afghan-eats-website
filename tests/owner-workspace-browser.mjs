import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const server=spawn(process.execPath,['tests/server.mjs'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{server.once('error',reject);const check=()=>fetch('http://127.0.0.1:4173/owner.html').then(resolve).catch(()=>setTimeout(check,100));check()});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
mkdirSync('visual-proof/owner',{recursive:true});
const orders=['placed','confirmed','preparing','ready_for_pickup','delivered'].map((status,i)=>({id:`order-${i}`,order_number:`AE-${100+i}`,status,created_at:'2026-10-28T08:00:00Z',total:450+i*50,items:[{name:'Kabuli pulao',quantity:2}],delivery_phone:'0700000000',delivery_address:'Test address'}));
const items=[{id:'dish-1',name:'Kabuli pulao',name_dari:'قابلی پلو',description:'Fragrant rice with carrots and raisins',price:280,is_available:true},{id:'dish-2',name:'Mantu',name_dari:'منتو',price:220,is_available:false}];
let fail=false,writes=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{sessionStorage.setItem('ae_portal_token','fixture-only');sessionStorage.setItem('ae_portal_role','owner')});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
  const path=url.pathname.split('/').at(-1);let data=[];
  if(path==='portal.me')data={role:'owner',restaurant_id:'r1'};
  if(path==='portal.ownerDashboard'){
   if(fail)return route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'});
   data={restaurant:{id:'r1',name:'Herat Kitchen',name_dari:'آشپزخانه هرات',status:'active',is_open:true,phone:'0700000000',district:'Test district'},stats:{orders_today:5,delivered_gmv:650,cancelled_today:0},orders};
  }
  if(path==='portal.ownerMenu')data={categories:[],items};
  if(path==='portal.ownerSetupSubmission')data={submission:{status:'approved'}};
  if(req.method()==='POST'){writes.push({path,input:JSON.parse(req.postData()).json});data={success:true};await new Promise(r=>setTimeout(r,200))}
  return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({result:{data:{json:data}}})});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/owner.html');
 await page.locator('#ownerServiceSummary button').first().waitFor();
 assert.equal(await page.locator('#ownerError').isVisible(),false);
 assert.deepEqual(await page.locator('#ownerServiceSummary button strong').allTextContents(),['1','2','1']);
 await page.screenshot({path:'visual-proof/owner/desktop.png',fullPage:true});
 await page.locator('[data-queue="placed"]').click();
 assert.equal(await page.locator('#ownerOrders .portal-order').count(),1);
 assert.equal(new URL(page.url()).hash,'#orders');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Cancel order',exact:true}).click();assert.equal(writes.length,0);
 await page.getByRole('button',{name:'Accept order',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#ownerOrders button:disabled'));
 assert.deepEqual(writes,[{path:'portal.ownerUpdateOrderStatus',input:{orderId:'order-0',status:'confirmed'}}]);
 await page.locator('[data-filter=preparing]').click();assert.equal(await page.locator('#ownerOrders .portal-order').count(),2);
 await page.evaluate(()=>renderOwnerOrderList(AEOwner.orders));
 assert.equal(await page.locator('[data-filter=preparing]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-filter=preparing]').evaluate(el=>el===document.activeElement),true);
 await page.locator('[data-owner-panel=ownerMenuPanel]').click();
 await page.locator('#ownerMenuSearch').fill('منتو');assert.equal(await page.locator('#ownerMenu .owner-menu-card').count(),1);
 await page.locator('#ownerMenuAvailability').selectOption('available');assert.match(await page.locator('#ownerMenu').innerText(),/No matching dishes/);
 await page.locator('#ownerMenuSearch').fill('');await page.locator('#ownerMenuAvailability').selectOption('all');
 await page.locator('#ownerMenu .owner-menu-actions button').first().click();assert.equal(await page.locator('#ownerItemForm input[name=name]').inputValue(),'Kabuli pulao');
 await page.locator('#ownerItemForm input[name=name]').fill('Unsaved dish');await page.locator('[data-owner-panel=ownerOrdersPanel]').click();await page.locator('[data-owner-panel=ownerMenuPanel]').click();
 assert.equal(await page.locator('#ownerItemForm input[name=name]').inputValue(),'Unsaved dish');
 const panels=['ownerOverviewPanel','ownerOrdersPanel','ownerMenuPanel','ownerStorePanel','ownerToolsPanel'];
 for(const width of [375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const panel of panels){await page.locator(`[data-owner-panel=${panel}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${panel} overflow at ${width}: ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(-15)))}`)}
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-owner-panel=ownerOverviewPanel]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'visual-proof/owner/mobile.png',fullPage:true});
 await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));await page.reload();await page.locator('#ownerServiceSummary button').first().waitFor();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 for(const panel of panels){await page.locator(`[data-owner-panel=${panel}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`RTL ${panel} overflow`)}
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'visual-proof/owner/dari-mobile.png',fullPage:true});
 fail=true;await page.evaluate(()=>refreshOwnerOrders());assert.equal(await page.locator('#ownerDataStatus').getAttribute('data-state'),'stale');assert.equal(writes.length,1);assert.deepEqual(errors,[]);
 const signedOut=await browser.newPage({viewport:{width:375,height:812}});await signedOut.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await signedOut.goto('http://127.0.0.1:4173/owner.html');assert.equal(await signedOut.locator('#ownerAuth').isVisible(),true);assert.equal(await signedOut.locator('#ownerDashboard').isVisible(),false);await signedOut.screenshot({path:'visual-proof/owner/sign-in.png',fullPage:true});
 console.log('PASS: queue filters, menu search, Dari, draft retention, cancellation guard, exact command, polling focus, stale state, signed-out gate, five viewports across all panels; one mocked mutation only.');
}finally{await browser.close();server.kill()}
