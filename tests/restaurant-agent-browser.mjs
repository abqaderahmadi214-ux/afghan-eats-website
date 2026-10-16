import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=spawn(process.execPath,['admin-control-center/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8141'},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
let enabled=true,undone=false,held=false,writes=[],reads=0,pending=null,delay=false;
const snapshot=()=>({settings:{enabled,last_success_at:new Date().toISOString(),last_status:'success',summary:{checked:2,changed:1}},totals:{checked:2,total:2,flagged:1,held:held?1:0},profiles:[{restaurant_id:'test',name:'Kitchen <img src=x>',checked_at:new Date().toISOString(),issues:['Missing phone; verify with restaurant.'],hold_edits:held}],changes:[{id:'11111111-1111-4111-8111-111111111111',restaurant_name:'Kitchen <script>bad()</script>',created_at:new Date().toISOString(),before_fields:{name:' Kitchen '},after_fields:{name:'Kitchen'},undone_at:undone?new Date().toISOString():null}],limits:{profiles:100,changes:30}});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{sessionStorage.setItem('ae_control_center_token','test');sessionStorage.setItem('ae_control_center_user',JSON.stringify({id:1,username:'admin',role:'admin'}))});
 await context.route('https://accounts.google.com/**',r=>r.abort());
 await context.route('https://afghaneats-api.onrender.com/**',async r=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},req=r.request();if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
  const path=new URL(req.url()).pathname.split('/').at(-1);let data=[];
  if(path==='auth.me')data={id:1,username:'admin',role:'admin'};
  if(path==='restaurantAgent.snapshot'){reads++;if(delay){pending=r;return;}data=snapshot()}
  if(path.startsWith('restaurantAgent.')&&path!=='restaurantAgent.snapshot'){const input=JSON.parse(req.postData()).json;writes.push({path,input});if(path.endsWith('setEnabled'))enabled=input.enabled;if(path.endsWith('undo')){undone=true;held=true}if(path.endsWith('resumeProfile'))held=false;data={success:true};}
  return r.fulfill({headers,json:{result:{data:{json:data}}}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8141/#restaurants');
 await page.getByRole('button',{name:'Pause agent',exact:true}).waitFor();assert.equal(writes.length,0,'render does not mutate');
 await page.getByText('Restaurants needing attention',{exact:true}).click();await page.getByText('Kitchen <img src=x>',{exact:true}).waitFor();assert.equal(await page.locator('#restaurant-agent-panel img').count(),0);
 await page.getByText('Automatic edit history',{exact:true}).click();await page.getByText('Kitchen <script>bad()</script>',{exact:true}).waitFor();assert.equal(await page.locator('#restaurant-agent-panel script').count(),0);
 await page.locator('[data-agent-toggle]').click();await page.getByRole('button',{name:'Enable agent',exact:true}).waitFor();assert.deepEqual(writes.at(-1),{path:'restaurantAgent.setEnabled',input:{enabled:false}});
 await page.locator('[data-agent-run]').click();await page.waitForFunction(()=>!document.querySelector('[data-agent-run]').disabled);assert.equal(writes.at(-1).path,'restaurantAgent.runNow');
 await page.locator('[data-agent-undo]').click();await page.getByText(/Automatic edits paused after undo/).waitFor();assert.equal(writes.at(-1).input.changeId,'11111111-1111-4111-8111-111111111111');
 await page.locator('[data-agent-resume]').click();await page.waitForFunction(()=>!document.querySelector('[data-agent-run]').disabled);assert.equal(writes.at(-1).path,'restaurantAgent.resumeProfile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 // Private responses arriving after logout must not reinsert private profile/history content.
 delay=true;await page.locator('[data-agent-refresh]').click();for(let i=0;i<20&&!pending;i++)await new Promise(r=>setTimeout(r,25));assert.ok(pending);
 await page.evaluate(()=>logout(false));await pending.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{result:{data:{json:snapshot()}}}});await page.locator('#login-username').waitFor({state:'visible'});assert.equal(await page.locator('#restaurant-agent-panel').count(),0);
 const before=reads;await page.evaluate(()=>{saveSession('staff',{id:2,username:'staff',role:'restaurant_staff'});setShell();setView('restaurants')});await page.waitForTimeout(300);assert.equal(reads,before);assert.equal(await page.locator('#restaurant-agent-panel').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS restaurant agent controls, escaped history, mobile layout, no render writes, logout isolation and restricted staff.');
 await context.close();
}finally{await browser.close();server.kill();}
