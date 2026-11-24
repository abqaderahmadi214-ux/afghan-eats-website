import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const partner=read('department-partner.html'),owner=read('department-owner.html');
const partnerJs=read('assets/department-partner.js'),ownerJs=read('assets/department-owner.js');
const adminHtml=read('admin-control-center/index.html'),adminJs=read('admin-control-center/assets/retail-departments.js');
const adminCore=read('admin-control-center/assets/control-center.js'),redirects=read('_redirects');
const verifyHtml=read('verify-email.html'),verifyJs=read('assets/verify-email.js');
const homeTests=read('tests/home-browse-preview.spec.js'),journeyTests=read('tests/customer-journey.spec.js');
const ids=['groceries','health-beauty','convenience','gifts','electronics','pet-supplies'];

test('partner page has distinct retail applications and reference/email status lookup',()=>{
  const selector=partner.match(/<select id="departmentKey"[\s\S]*?<\/select>/)?.[0]||'';
  assert.deepEqual([...selector.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]).filter(Boolean),ids);
  assert.match(partner,/Separate from Restaurants|never part of Restaurants/);
  assert.match(partner,/Public orders remain paused/);
  assert.match(partner,/<fieldset id="application-fields" disabled/);
  assert.match(partner,/name="email" type="email"/);
  assert.match(partner,/id="application-status"/);
  assert.match(partnerJs,/departmentRetail\.submitApplication/);
  assert.match(partnerJs,/departmentRetail\.applicationStatus/);
  assert.match(partnerJs,/departmentRetail\.resendApplicationVerification/);
  assert.match(partnerJs,/department_key/);
  assert.match(redirects,/\/department-partner \/department-partner\.html 200/);
});

test('closed department gate prevents application POST while gate query still works',async()=>{
  const idsInResponse=ids.map(department_key=>({department_key,applications_open:false}));
  const gate={textContent:'',dataset:{},setAttribute(name,value){this[name]=value;}};
  const pill={textContent:'',classList:{toggle(){}}};
  const fields={disabled:false};
  const submit={disabled:false};
  const appMessage={textContent:''},appResult={hidden:true,textContent:'',classList:{toggle(){}}};
  const department={value:'',addEventListener(name,fn){listeners[`department:${name}`]=fn;}};
  const form={addEventListener(name,fn){listeners[`interest:${name}`]=fn;}};
  const statusForm={elements:{reference:{value:''},email:{value:''}},addEventListener(name,fn){listeners[`status:${name}`]=fn;}};
  const resend={hidden:true,disabled:false,addEventListener(name,fn){listeners[`resend:${name}`]=fn;}};
  const language={textContent:'',addEventListener(name,fn){listeners[`lang:${name}`]=fn;}};
  const nodes={'gate-summary':gate,'application-gate-state':pill,'application-fields':fields,'application-submit':submit,'interest-message':appMessage,'application-result':appResult,'departmentKey':department,'department-interest-form':form,'status-lookup-form':statusForm,'status-result':{hidden:false,textContent:'',classList:{toggle(){}}},'resend-verification':resend,'dr-language':language};
  const listeners={},calls=[];
  const context={window:{AFGHAN_EATS_CONFIG:{apiBaseUrl:'https://api.example'}},document:{documentElement:{},querySelectorAll:()=>[],getElementById:id=>nodes[id]||null},localStorage:{getItem:()=> 'en',setItem(){}},AbortSignal,FormData:class{get(name){return name==='departmentKey'?'groceries':''}},fetch:async url=>{calls.push(url);return{ok:true,text:async()=>JSON.stringify({result:{data:{json:idsInResponse}}})};}};
  vm.runInNewContext(partnerJs,context);await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls.length,1);assert.match(calls[0],/departmentRetail\.departmentGates/);
  assert.match(gate.textContent,/All 6/);assert.equal(fields.disabled,true);assert.equal(submit.disabled,true);
  department.value='groceries';listeners['department:change']();assert.equal(fields.disabled,true);
  let prevented=false;listeners['interest:submit']({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  assert.equal(calls.length,1,'the closed-gate path sends no application mutation');
});

test('verification and invitation links route to the department-specific pages',()=>{
  assert.match(verifyJs,/department-retail/);
  assert.match(verifyJs,/departmentRetail\.verifyApplicationEmail/);
  assert.match(verifyJs,/department-partner\.html#application-status/);
  assert.match(verifyHtml,/retail department application/);
  assert.match(ownerJs,/owner-activate-form/);
  assert.match(ownerJs,/history\.replaceState/);
  assert.match(redirects,/\/department-owner \/department-owner\.html 200/);
});

test('owner UI sends typed backend contracts and exposes the full store operations set',()=>{
  for(const procedure of ['ownerLogin','ownerActivate','ownerMe','ownerDashboard','ownerSaveProfile','ownerUpsertCategory','ownerUpsertProduct','ownerSetInventory','ownerSetAvailability','ownerSetHours','ownerSetFulfillment','ownerSetPolicies','ownerListOrders','ownerUpdateOrderStatus','ownerRequestLaunchReview'])assert.match(ownerJs,new RegExp(`'${procedure}'|\\.${procedure}\\b|\\b${procedure}\\b`));
  assert.match(ownerJs,/ownerLogin',\{username,password\}/);
  assert.match(ownerJs,/departmentId:get\('departmentId'\)\|\|null/);
  assert.match(ownerJs,/quantityAvailable:Number\(get\('quantityAvailable'\)\)/);
  assert.match(ownerJs,/acceptsOrders:false/);
  assert.match(ownerJs,/onlinePaymentEnabled:false/);
  assert.match(ownerJs,/placed:\['confirmed','cancelled','failed'\]/);
  assert.match(ownerJs,/ownerRequestLaunchReview';payload=\{notes:get\('notes'\)\}/);
  assert.match(owner,/name="username"/);
  assert.match(owner,/data-owner-tab="policies"/);
  assert.match(owner,/restaurant menus are not available here/);
  assert.doesNotMatch(ownerJs,/restaurants\.(getMenu|list|owner)/);
});

test('admin portal uses admin-scoped retail routes while keeping public listing and ordering gates separate',()=>{
  assert.match(adminHtml,/data-view="retail-departments" href="#retail-departments"/);
  assert.match(adminCore,/'retail-departments': \(\) => window\.AdminRetailDepartments\.render\(\)/);
  for(const procedure of ['departmentGates','adminApplications','adminApplicationDetail','adminReviewApplication','adminReissueOwnerInvite','adminMerchants','adminMerchantDetail','adminReviewMerchantSetup','adminReviewLaunch','adminSetMerchantStatus','adminSetDepartmentGate','adminOrders','adminUpdateOrderStatus'])assert.match(adminJs,new RegExp(`'${procedure}'|\\.${procedure}\\b|\\b${procedure}\\b`));
  assert.match(adminJs,/Authorization:`Bearer/);
  assert.match(adminJs,/department_key/);
  assert.match(adminJs,/applicationsOpen/);
  assert.match(adminJs,/ordering gate remains off/);
  assert.match(adminJs,/No retail orders/);
  assert.match(adminJs,/data-launch-review-form/);
  assert.match(adminJs,/Choose a decision/);
  assert.doesNotMatch(adminJs,/operations\.adminPartner|orders\.adminList|adminSetDepartmentGate.*orderingEnabled/);
  assert.match(adminJs,/fullAdmin\(\)/);
});

test('existing homepage top-level departments, photos, labels and separate restaurant flow remain covered',()=>{
  assert.match(homeTests,/Coming soon/);assert.match(journeyTests,/Coming soon/);
  const homepage=read('index.html');
  for(const id of ids){assert.match(homepage,new RegExp(`data-department="${id}"`));assert.match(homepage,new RegExp(`/assets/department-images/${id}\\.jpg`));}
  assert.match(homepage,/data-department="restaurants"/);assert.doesNotMatch(homepage,/data-department="alcohol"/);
});
