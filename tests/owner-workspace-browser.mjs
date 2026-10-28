import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

async function assertOwnerDescriptionLabels(page, locale) {
 const labels=[
  ['description','English description','توضیحات انگلیسی'],
  ['descriptionDari','Dari description','توضیحات دری'],
 ];
 for(const [field,english,dari] of labels){
  const label=page.locator(`#ownerProfileForm textarea[name="${field}"]`).locator('xpath=..');
  const active=locale==='fa'?'.fa-copy':'.en-copy',inactive=locale==='fa'?'.en-copy':'.fa-copy';
  assert.equal(await label.locator(active).isVisible(),true,`${field} ${locale} label should be visible`);
  assert.equal((await label.locator(active).textContent()).trim(),locale==='fa'?dari:english);
  assert.equal(await label.locator(inactive).isVisible(),false,`${field} inactive-language label should be hidden`);
 }
}

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
  if(path==='cities.publicCatalog')data=[{city_key:'herat',name_en:'Herat',name_dari:'هرات',ordering_enabled:true}];
  if(path==='cities.publicContext')data={city:{city_key:'herat',name_en:'Herat',name_dari:'هرات',ordering_enabled:true},areas:[]};
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
 assert.equal(await page.getByRole('navigation',{name:'Restaurant workspace'}).count(),1,'English navigation landmark should have a localized name');
 for(const name of ['Menu','Store & profile','Business tools'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1,`${name} should use its visible English label`);
 assert.equal(await page.getByRole('button',{name:'Refresh dashboard',exact:true}).count(),1,'refresh control should have a descriptive English name');
 assert.equal(await page.getByRole('button',{name:'Open item editor',exact:true}).count(),2,'menu shortcuts should preserve their distinct English accessible name');
 assert.equal(await page.getByRole('region',{name:'Kitchen queue'}).count(),1,'kitchen queue should have a named region');
 assert.deepEqual(await page.locator('#ownerServiceSummary button strong').allTextContents(),['1','2','1']);
 await page.screenshot({path:'visual-proof/owner/desktop.png',fullPage:true});
 await page.locator('[data-owner-panel=ownerStorePanel]').click();await assertOwnerDescriptionLabels(page,'en');
 assert.equal(await page.getByLabel('Monday opening time',{exact:true}).count(),1,'English opening-hours input should have a descriptive accessible name');
 assert.equal(await page.getByLabel('Monday closing time',{exact:true}).count(),1,'English closing-hours input should have a descriptive accessible name');
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();
 await page.locator('[data-owner-panel=ownerOrdersPanel]').click();
 assert.equal(await page.getByRole('group',{name:'Filter orders'}).count(),1,'order filter group should have a localized accessible name');
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();
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
 assert.equal(await page.locator('#ownerCategoryForm').getByRole('spinbutton',{name:'Display order',exact:true}).count(),1,'category display order should have a named input');
 await page.locator('#ownerMenuSearch').fill('منتو');assert.equal(await page.locator('#ownerMenu .owner-menu-card').count(),1);
 await page.locator('#ownerMenuAvailability').selectOption('available');assert.match(await page.locator('#ownerMenu').innerText(),/No matching dishes/);
 await page.locator('#ownerMenuSearch').fill('');await page.locator('#ownerMenuAvailability').selectOption('all');
 await page.locator('#ownerMenu .owner-menu-actions button').first().click();assert.equal(await page.locator('#ownerItemForm input[name=name]').inputValue(),'Kabuli pulao');
 await page.locator('#ownerItemForm input[name=name]').fill('Unsaved dish');await page.locator('[data-owner-panel=ownerOrdersPanel]').click();await page.locator('[data-owner-panel=ownerMenuPanel]').click();
 assert.equal(await page.locator('#ownerItemForm input[name=name]').inputValue(),'Unsaved dish');
 const panels=['ownerOverviewPanel','ownerOrdersPanel','ownerMenuPanel','ownerStorePanel','ownerToolsPanel'];
 for(const width of [320,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const panel of panels){await page.locator(`[data-owner-panel=${panel}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${panel} overflow at ${width}: ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(-15)))}`)}
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-owner-panel=ownerOverviewPanel]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'visual-proof/owner/mobile.png',fullPage:true});
 await page.evaluate(()=>localStorage.setItem('ae_lang','fa'));await page.reload();await page.locator('#ownerServiceSummary button').first().waitFor();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 await page.locator('[data-owner-panel=ownerStorePanel]').click();await assertOwnerDescriptionLabels(page,'fa');
 assert.equal(await page.getByLabel('ساعت شروع دوشنبه',{exact:true}).count(),1,'Dari opening-hours input should have a localized accessible name');
 assert.equal(await page.getByLabel('ساعت پایان دوشنبه',{exact:true}).count(),1,'Dari closing-hours input should have a localized accessible name');
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();
 assert.equal(await page.getByRole('navigation',{name:'فضای کاری رستورانت'}).count(),1,'Dari navigation landmark should have a localized name');
 for(const name of ['منو و آیتم‌ها','تنظیمات رستورانت','ابزارهای کسب‌وکار'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1,`${name} should use its visible Dari label`);
 assert.equal(await page.getByRole('button',{name:'به‌روزرسانی داشبورد',exact:true}).count(),1,'refresh control should have a descriptive Dari name');
 assert.equal(await page.getByRole('button',{name:'باز کردن ویرایشگر منو',exact:true}).count(),2,'menu shortcuts should have a distinct Dari accessible name');
 assert.equal(await page.getByRole('region',{name:'صف آشپزخانه'}).count(),1,'kitchen queue should have a Dari region name');
 await page.locator('[data-owner-panel=ownerOrdersPanel]').click();assert.equal(await page.getByRole('group',{name:'فیلتر سفارش‌ها'}).count(),1,'order filter group should have a Dari name');
 await page.locator('[data-owner-panel=ownerMenuPanel]').click();assert.equal(await page.locator('#ownerCategoryForm').getByRole('spinbutton',{name:'ترتیب نمایش',exact:true}).count(),1,'category display order should have a Dari name');
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();
 for(const panel of panels){await page.locator(`[data-owner-panel=${panel}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`RTL ${panel} overflow`)}
 await page.locator('[data-owner-panel=ownerOverviewPanel]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'visual-proof/owner/dari-mobile.png',fullPage:true});
 fail=true;await page.evaluate(()=>refreshOwnerOrders());assert.equal(await page.locator('#ownerDataStatus').getAttribute('data-state'),'stale');assert.equal(writes.length,1);assert.deepEqual(errors,[]);
 const signedOut=await browser.newPage({viewport:{width:375,height:812}});await signedOut.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await signedOut.goto('http://127.0.0.1:4173/owner.html');assert.equal(await signedOut.locator('#ownerAuth').isVisible(),true);assert.equal(await signedOut.locator('#ownerDashboard').isVisible(),false);await signedOut.screenshot({path:'visual-proof/owner/sign-in.png',fullPage:true});
 await signedOut.waitForFunction(()=>typeof window.openSecurityRecovery==='function'&&typeof window.openPortalRecovery==='function');
 const recoveryControls=signedOut.locator('#ownerAuth .owner-forgot-link, #ownerAuth #aeForgotPassword');
 assert.equal(await signedOut.locator('html').getAttribute('lang'),'en');assert.equal(await recoveryControls.count(),1,'English owner sign-in should show one recovery control');assert.equal((await recoveryControls.first().innerText()).trim(),'Forgot username or password?');
 await recoveryControls.first().click();assert.equal(await signedOut.locator('#ownerRecoveryPanel').isVisible(),true,'English recovery button should open the owner recovery panel');
 await signedOut.evaluate(()=>localStorage.setItem('ae_lang','fa'));await signedOut.reload();await signedOut.waitForFunction(()=>typeof window.openSecurityRecovery==='function'&&typeof window.openPortalRecovery==='function');
 assert.equal(await signedOut.locator('html').getAttribute('lang'),'fa');assert.equal(await recoveryControls.count(),1,'Dari owner sign-in should show one recovery control');assert.equal((await recoveryControls.first().innerText()).trim(),'نام کاربری یا رمز را فراموش کرده‌اید؟');
 await recoveryControls.first().click();assert.equal(await signedOut.locator('#ownerRecoveryPanel').isVisible(),true,'Dari recovery button should open the owner recovery panel');
 console.log('PASS: queue filters, menu search, Dari, draft retention, cancellation guard, exact command, polling focus, stale state, signed-out gate, six viewports across all panels; one mocked mutation only.');
}finally{await browser.close();server.kill()}
