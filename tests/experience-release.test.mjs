import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const csv=require('../admin-control-center/assets/csv-export.js');
test('CSV preserves real negative numbers but neutralizes formula-like external text',()=>{
 assert.equal(csv.cell(-100),'-100');
 for(const input of ['=1+1','+93700000123','  @SUM(A1)','\t=2+2','-cmd']) assert.ok(csv.cell(input).startsWith("'"));
 assert.equal(csv.cell('name,"quote"'),'"name,""quote"""');
 assert.equal(csv.cell(null),'');assert.equal(csv.cell(NaN),'');
 assert.ok(csv.serialize([['Dari','دری'],['amount',0]]).startsWith('\uFEFF'));
});
test('admin and public share identical component tokens',()=>{
 assert.equal(readFileSync('assets/platform-foundation.css','utf8'),readFileSync('admin-control-center/assets/platform-foundation.css','utf8'));
});
test('sign out sends the captured bearer token; a failure is recorded without retaining it',async()=>{
 const writes=[], storage=new Map();
 const context={window:{},document:{documentElement:{dataset:{}},querySelector:()=>null,createElement:()=>({dataset:{}}),head:{appendChild(){}},addEventListener(){}},location:{pathname:'/account'},localStorage:{getItem:()=>null},sessionStorage:{setItem:(k,v)=>storage.set(k,v)},AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{writes.push({url,options});return{ok:true};}};
 vm.runInNewContext(readFileSync('config.js','utf8'),context);
 assert.equal(await context.window.aeEndSession('test-token'),true);
 assert.equal(writes[0].options.headers.Authorization,'Bearer test-token');
 assert.ok(writes[0].url.endsWith('/sessions.logout'));
 context.fetch=async()=>{throw Error('offline')};
 assert.equal(await context.window.aeEndSession('test-token'),false);
 assert.equal(storage.get('ae_logout_unconfirmed'),'1');
 assert.equal([...storage.values()].includes('test-token'),false);
});
test('a delayed admin logout cannot clear a newly signed-in session',async()=>{
 const source=readFileSync('admin-control-center/assets/control-center.js','utf8');
 const start=source.indexOf('async function logout('),end=source.indexOf('function userLabel()',start);
 assert.ok(start>=0&&end>start);
 for(const signInAgain of [true,false]) {
  let finish;const changes=[];const storage=new Map([['token','old'],['user','old-user']]);
  const state={token:'old',user:{username:'old'},cache:{}};
  const context={state,API_BASE:'https://api.example',TOKEN_KEY:'token',USER_KEY:'user',AbortSignal,
   fetch:(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer old');return new Promise(resolve=>{finish=resolve;});},
   window:{adminFreshness:{reset:()=>changes.push('refresh-reset')}},financeState:{},sessionStorage:{removeItem:key=>storage.delete(key)},root:{replaceChildren:()=>changes.push('root-cleared')},appShell:{classList:{add:()=>changes.push('app-hidden')}},loginView:{classList:{remove:()=>changes.push('login-shown')}},toast:()=>changes.push('toast')};
  vm.runInNewContext(source.slice(start,end)+'\nthis.endSession=logout;',context);
  const pending=context.endSession();
  if(signInAgain){state.token='new';state.user={username:'new'};storage.set('token','new');storage.set('user','new-user');}
  finish({ok:true});await pending;
  if(signInAgain){assert.equal(state.token,'new');assert.equal(state.user.username,'new');assert.equal(storage.get('token'),'new');assert.deepEqual(changes,[]);}
  else{assert.equal(state.token,'');assert.equal(storage.has('token'),false);assert.ok(changes.includes('root-cleared'));}
 }
});
