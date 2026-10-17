import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import {existsSync} from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=spawn(process.execPath,['admin-control-center/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8144'},stdio:'pipe'});
await new Promise((ok,no)=>{server.stdout.once('data',ok);server.once('error',no)});
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
let writes=[],campaigns=[],failCreate=false,reads=0;
const restaurants=[{id:'r1',name:'Kitchen <script>bad()</script>',status:'active'},{id:'r2',name:'Inactive kitchen',status:'inactive'}];
try{
 const context=await browser.newContext({viewport:{width:320,height:844}});
 await context.addInitScript(()=>{sessionStorage.setItem('ae_control_center_token','test');sessionStorage.setItem('ae_control_center_user',JSON.stringify({id:1,username:'admin',role:'admin'}));});
 await context.route('https://accounts.google.com/**',route=>route.abort());
 await context.route('https://afghaneats-api.onrender.com/**',async route=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const path=new URL(route.request().url()).pathname.split('/').at(-1);let data=[];
  if(path==='auth.me')data={id:1,username:'admin',role:'admin'};
  if(path==='restaurants.adminList')data=restaurants;
  if(path==='restaurants.adminMenu')data={items:[{id:'dish1',name:'Rice <script>bad()</script>',price:250,is_available:true}]};
  if(path==='growth.adminCampaigns'){reads++;data=campaigns;}
  if(path==='growth.adminCreate'){
   const input=route.request().postDataJSON().json;writes.push({path,input});
   if(failCreate)return route.fulfill({status:400,headers,json:{error:{json:{message:'That promotion code is already in use'}}}});
   const id='00000000-0000-4000-8000-'+String(writes.length).padStart(12,'0');
   const c={id,restaurant_id:input.restaurantId,restaurant_name:restaurants.find(r=>r.id===input.restaurantId).name,restaurant_status:restaurants.find(r=>r.id===input.restaurantId).status,name:input.name,campaign_type:input.campaignType,status:input.publishNow?'active':'draft',code:input.code||'GENERATED',discount_value:input.discountValue||0,min_order:input.minOrder,max_discount:input.maxDiscount,daily_budget:input.dailyBudget,total_budget:input.totalBudget,starts_at:input.startsAt,ends_at:input.endsAt};
   campaigns.unshift(c);data={id,code:c.code,status:c.status,success:true};
  }
  if(path==='growth.adminSetStatus'){const input=route.request().postDataJSON().json;writes.push({path,input});campaigns.find(c=>c.id===input.campaignId).status=input.status;data={success:true};}
  return route.fulfill({headers,json:{result:{data:{json:data}}}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8144/#promotions');
 const panel=page.locator('#restaurant-campaigns'),form=panel.locator('[data-campaign-create]');
 await form.locator('[name=restaurantId]:enabled').waitFor();assert.equal(writes.length,0);
 await form.locator('[name=restaurantId]').selectOption('r1');await form.locator('[name=name]').fill('Weekend savings');await form.locator('[name=discountValue]').fill('15');await form.locator('[name=code]').fill('SAVE15');
 await form.locator('[name=minOrder]').fill('300');await form.locator('[name=maxDiscount]').fill('100');await form.locator('[name=totalBudget]').fill('5000');
 await form.locator('[name=startsAt]').fill('2030-01-01T10:00');await form.locator('[name=endsAt]').fill('2030-01-05T10:00');await form.locator('button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent.startsWith('Offer published'));
 assert.equal(writes[0].path,'growth.adminCreate');assert.equal(writes[0].input.publishNow,true);assert.equal(writes[0].input.restaurantId,'r1');assert.equal(writes[0].input.discountValue,15);assert.equal(writes[0].input.startsAt,'2030-01-01T05:30:00.000Z');assert.equal(writes[0].input.maxDiscount,100);
 assert.equal(await panel.locator('script').count(),0);await panel.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent==='Offer status updated.');assert.equal(writes.at(-1).input.status,'paused');
 failCreate=true;await form.locator('[name=name]').fill('Keep my draft');await form.locator('[name=discountValue]').fill('20');await form.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent.includes('already in use'));assert.equal(await form.locator('[name=name]').inputValue(),'Keep my draft');
 const before=writes.length;await form.locator('[name=restaurantId]').selectOption('r2');await form.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent.includes('not active'));assert.equal(writes.length,before);
 failCreate=false;await form.locator('[name=publication]').selectOption('draft');await form.locator('[name=campaignType]').selectOption('free_delivery');assert.equal(await form.locator('[name=discountValue]').isDisabled(),true);await form.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent.startsWith('Draft saved'));assert.equal(writes.at(-1).input.publishNow,false);assert.equal(writes.at(-1).input.campaignType,'free_delivery');assert.equal(writes.at(-1).input.discountValue,undefined);
 await form.locator('[name=restaurantId]').selectOption('r1');await form.locator('[name=name]').fill('Rice savings');await form.locator('[name=campaignType]').selectOption('fixed_discount');await form.locator('[name=scopeType]').selectOption('items');await form.locator('[name=eligibleItem]').check();await form.locator('[name=discountValue]').fill('50');await form.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-campaign-status]').textContent.startsWith('Offer published'));assert.deepEqual(writes.at(-1).input.eligibleItemIds,['dish1']);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 const beforeReads=reads;await page.evaluate(()=>{logout(false);saveSession('staff',{id:2,username:'staff',role:'restaurant_staff'});setShell();setView('restaurants');});await page.waitForTimeout(200);assert.equal(reads,beforeReads);assert.equal(await page.locator('#restaurant-campaigns').count(),0);
 console.log('PASS admin offer creation/publishing, Kabul dates, selected dishes, inactive drafts, retained errors, pause, source escaping, mobile layout and restricted access');await context.close();
}finally{await browser.close();server.kill();}
