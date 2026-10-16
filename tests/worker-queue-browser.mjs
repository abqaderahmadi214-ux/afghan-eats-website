import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=spawn(process.execPath,['admin-control-center/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8140'},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exited ${code}`)));});
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,headless:true,args:['--no-sandbox']});
let writes=[],snapshotReads=[],failNextCommand=false,failSnapshot=false,holdHistory=false,pendingHistory=null,lastCompletedFailed=false;
const issue={worker:'orders',entity_type:'order',entity_id:'order-test',rule:'rider_unassigned',reference:'AE-TEST',title:'Delivery needs attention',detail:'Review dispatch <img src=x onerror=alert(1)>',severity:'high',issue_id:'11111111-1111-4111-8111-111111111111',revision:1,owner_admin_id:null,first_seen_at:new Date().toISOString()};
const second={...issue,issue_id:'22222222-2222-4222-8222-222222222222',reference:'AE-SECOND'};
const event={kind:'claim',actor_username:'test',owner_username:'test',note:'Follow up <script>bad()</script>',created_at:new Date().toISOString()};
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{sessionStorage.setItem('ae_control_center_token','test-session');sessionStorage.setItem('ae_control_center_user',JSON.stringify({id:1,username:'test',role:'admin'}));});
 await context.route('https://accounts.google.com/**',r=>r.abort());
 await context.route('https://afghaneats-api.onrender.com/**',async route=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},req=route.request(),method=req.method(),url=new URL(req.url());
  if(method==='OPTIONS')return route.fulfill({status:204,headers});
  const path=url.pathname.split('/').at(-1),input=method==='POST'?JSON.parse(req.postData()).json:JSON.parse(url.searchParams.get('input')||'{"json":null}').json;
  let data={};
  if(path==='auth.me')data={id:1,username:'test',role:'admin'};
  if(path==='ruleWorkers.snapshot'){
   snapshotReads.push(input);if(failSnapshot)return route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Snapshot unavailable'}}})});
   const items=input?.offset?[second]:[issue];
   data={enabled:true,lastSuccessAt:new Date().toISOString(),snapshotAt:new Date().toISOString(),findings:items,recentlyCleared:[{issue_id:'33333333-3333-4333-8333-333333333333',reference:'AE-CLEARED',title:'Old flag',resolved_at:new Date().toISOString()}],counts:{total:51,needs_owner:issue.owner_admin_id?50:51,unassigned:issue.owner_admin_id?50:51,mine:issue.owner_admin_id?1:0},totalMatching:51,offset:input?.offset||0,showingAtMost:50,owners:[{id:1,username:'test'},{id:2,username:'second.admin'}],lastCompletedRun:{status:lastCompletedFailed?'failure':'success'},runs:[{status:lastCompletedFailed?'skipped':'success',finished_at:new Date().toISOString(),finding_count:51,duration_ms:125},{status:'failure',finished_at:new Date().toISOString(),finding_count:null,duration_ms:100,stage:'snapshot',error_code:'40001'}]};
  }
  if(path==='ruleWorkers.triage'){
   writes.push({path,input});
   if(failNextCommand){failNextCommand=false;return route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Response could not be confirmed'}}})});}
   issue.owner_admin_id=1;issue.owner_username='test';issue.owner_active=true;issue.revision=2;data={success:true,revision:2};
  }
  if(path==='ruleWorkers.history'){
   if(holdHistory){pendingHistory=route;return;}
   data={issue:{...issue,resolved_at:input.issueId==='33333333-3333-4333-8333-333333333333'?new Date().toISOString():null},events:[event],showingAtMost:50};
  }
  if(path==='ruleWorkers.runNow'){writes.push({path,input});data={skipped:false,findingCount:51};}
  return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({result:{data:{json:data}}})});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8140/#dispatch');
 await page.getByRole('heading',{name:'Website workers',exact:true}).waitFor();await page.getByText('Delivery needs attention',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Worker queue',exact:false}).click();
 await page.waitForFunction(()=>document.getElementById('page-title').textContent==='Website workers');
 await page.getByText('Delivery needs attention',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).hash,'#workers');
 assert.equal(writes.length,0,'rendering and polling do not mutate records');
 assert.match(await page.locator('#rule-worker-dashboard').innerText(),/All flags: 51/);
 assert.equal(await page.locator('#rule-worker-dashboard img').count(),0);
 await page.locator('[data-worker-filter]').selectOption('orders');
 await page.waitForFunction(()=>!document.querySelector('[data-worker-filter]').disabled);
 assert.equal(snapshotReads.at(-1).worker,'orders');assert.equal(await page.evaluate(()=>window.adminFreshness.isDirty()),false,'queue filters do not pause refresh as unsaved edits');
 await page.locator('[data-worker-next]').click();await page.getByText('AE-SECOND',{exact:false}).first().waitFor();assert.equal(snapshotReads.at(-1).offset,50);
 await page.locator('[data-worker-prev]').click();await page.getByText('AE-TEST',{exact:false}).first().waitFor();
 await page.getByRole('button',{name:'Take ownership',exact:true}).click();await page.locator('#worker-queue-dialog[open]').waitFor();
 await page.locator('#worker-triage-form [name="note"]').fill('I will contact dispatch');
 // A background refresh cannot replace an open triage form.
 await page.evaluate(()=>renderView(true));assert.equal(await page.locator('#worker-triage-form [name="note"]').inputValue(),'I will contact dispatch');
 await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(writes.length,0,'cancel does not claim the issue');
 await page.getByRole('button',{name:'Take ownership',exact:true}).click();await page.locator('#worker-triage-form [name="note"]').fill('I will contact dispatch');
 failNextCommand=true;await page.getByRole('button',{name:'Save queue update'}).click();await page.locator('[data-worker-error]:not(.hidden)').waitFor();
 await page.getByRole('button',{name:'Save queue update'}).click();await page.locator('#worker-queue-dialog').waitFor({state:'hidden'});
 assert.equal(writes.length,2);assert.equal(writes[0].input.requestKey,writes[1].input.requestKey);assert.equal(writes[0].input.expectedRevision,1);assert.equal(writes[0].input.action,'claim');
 await page.getByRole('button',{name:'Manage flag',exact:true}).waitFor();
 await page.getByText('Recently cleared flags',{exact:true}).click();await page.getByRole('button',{name:'View cleared history',exact:true}).click();await page.getByText(/Cleared in the latest successful check/).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByText('Follow up <script>bad()</script>',{exact:true}).waitFor();assert.equal(await page.locator('#worker-queue-dialog script').count(),0);
 mkdirSync('visual-proof/premium',{recursive:true});await page.screenshot({path:'visual-proof/premium/worker-history-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 failSnapshot=true;await page.locator('[data-workers-refresh]').click();await page.getByText('Update unavailable · previous queue retained',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Manage flag',exact:true}).count(),1);
 failSnapshot=false;await page.locator('[data-workers-refresh]').click();await page.getByText(/Checks current/).waitFor();
 lastCompletedFailed=true;await page.locator('[data-workers-refresh]').click();await page.getByText(/Latest check failed · previous flags retained/).waitFor();
 lastCompletedFailed=false;await page.locator('[data-workers-refresh]').click();await page.getByText(/Checks current/).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByText('Recent worker checks',{exact:true}).click();await page.getByRole('cell',{name:'failure',exact:false}).waitFor();
 await page.screenshot({path:'visual-proof/premium/worker-queue-mobile.png',fullPage:true});
 const before=writes.length;await page.locator('[data-workers-run]').click();await page.waitForFunction(()=>!document.querySelector('[data-workers-run]').disabled);assert.equal(writes.length,before+1);assert.equal(writes.at(-1).path,'ruleWorkers.runNow');
 // A late private history response must not reopen a dialog after logout.
 holdHistory=true;await page.getByRole('button',{name:'History',exact:true}).click();
 for(let i=0;i<20&&!pendingHistory;i++)await new Promise(r=>setTimeout(r,25));assert.ok(pendingHistory);
 await page.evaluate(()=>logout(false));await pendingHistory.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({result:{data:{json:{issue,events:[event],showingAtMost:50}}}})});
 await page.locator('#login-username').waitFor({state:'visible'});assert.equal(await page.locator('#worker-queue-dialog').isVisible(),false);assert.equal(await page.locator('[data-worker-dialog-body]').innerText(),'');
 // A restricted account never queries or mounts the full-admin queue.
 await page.evaluate(()=>{saveSession('staff-session',{id:3,username:'staff',role:'operations_staff'});setShell();setView('restaurants');});
 assert.equal(await page.locator('#rule-worker-dashboard').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: queue pagination/filtering, no render writes, cancel, stable retry key, note preservation, escaped history, failed-refresh retention, run history, mobile layout, manual checks, logout and late private response.');
 await context.close();
}finally{await browser.close();server.kill();}
