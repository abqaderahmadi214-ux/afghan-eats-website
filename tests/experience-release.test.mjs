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
