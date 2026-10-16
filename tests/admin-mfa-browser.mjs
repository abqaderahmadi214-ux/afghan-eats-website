import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = spawn(process.execPath,['admin-control-center/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'8139'},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`server exited ${code}`)));});
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,headless:true,args:['--no-sandbox']});
const codes=Array.from({length:10},(_,i)=>`ABCD-EFAB-CDEF-1234-000${i}`);
let enabled=true, writes=[], pendingVerify=null, holdVerify=false;
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(() => {
  window.google = { accounts: { id: { initialize(options) { window.testGoogleCallback = options.callback; }, renderButton(mount) { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Test Google confirmation'; button.addEventListener('click', () => window.testGoogleCallback({credential:'test-google-credential'})); mount.append(button); } } } };
 });
 await context.route('https://accounts.google.com/**',r=>r.abort());
 await context.route('https://afghaneats-api.onrender.com/**',async route=>{
  const method=route.request().method();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
  if(method==='OPTIONS')return route.fulfill({status:204,headers});
  const path=new URL(route.request().url()).pathname.split('/').at(-1),input=method==='POST'?JSON.parse(route.request().postData()).json:null;
  if(method==='POST')writes.push({path,input});
  let data={};
  if(path==='auth.login'||path==='auth.googleStaffSignIn')data={status:'mfa_required',challenge:'c'.repeat(43)};
  if(path==='auth.mfaVerify'){
   if(holdVerify){pendingVerify=route;return;}
   if(input.code==='000000')return route.fulfill({status:400,headers,contentType:'application/json',body:JSON.stringify({error:{json:{message:'Verification failed'}}})});
   data={token:'verified-test-session',admin:{id:1,username:'test',role:'admin'}};
  }
  if(path==='identity.googleConfig')data={webClientId:'test-client'};
  if(path==='auth.me')data={id:1,username:'test',role:'admin'};
  if(path==='auth.staffList')data=[];
  if(path==='auth.mfaStatus')data={enabled,recoveryCodesRemaining:10};
  if(path==='auth.mfaBegin')data={secret:'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',account:'test'};
  if(path==='auth.mfaEnable'){enabled=true;data={token:'enabled-test-session',admin:{id:1,username:'test',role:'admin'},recoveryCodes:codes};}
  if(path==='auth.mfaDisable'){enabled=false;data={token:'disabled-test-session',admin:{id:1,username:'test',role:'admin'}};}
  return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({result:{data:{json:data}}})});
 });
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8139/#security');
 await page.locator('#login-username').fill('test');await page.locator('#login-password').fill('test-password');await page.getByRole('button',{name:'Sign in securely',exact:true}).click();
 await page.locator('#mfa-login-code').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ae_control_center_token')),null);
 assert.equal(await page.locator('#login-password').inputValue(),'');
 await page.locator('#mfa-login-code').fill('000000');await page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
 await page.getByText('Verification failed',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('ae_control_center_token')),null);
 await page.getByRole('button',{name:'Back to sign-in'}).click();
 await page.locator('#google-staff-signin button').click();
 await page.locator('#mfa-login-code').waitFor({state:'visible'});
 await page.locator('#mfa-login-code').fill('123456');await page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
 await page.getByRole('heading',{name:'Two-step verification',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ae_control_center_token')),'verified-test-session');
 const form=page.locator('#mfa-primary-form');await form.locator('[name="currentPassword"]').fill('test-password');await form.locator('[name="code"]').fill(codes[0]);
 await page.getByRole('button',{name:'Review disabling verification'}).click();await page.locator('#confirm-dialog[open]').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(writes.filter(w=>w.path==='auth.mfaDisable').length,0);
 await page.getByRole('button',{name:'Review disabling verification'}).click();await page.locator('#confirm-action').click();
 await page.getByRole('button',{name:'Set up with password'}).waitFor();assert.equal(writes.filter(w=>w.path==='auth.mfaDisable').length,1);
 await page.locator('#mfa-primary-form [name="currentPassword"]').fill('test-password');await page.getByRole('button',{name:'Set up with password'}).click();
 await page.locator('#mfa-setup-key').waitFor();
 assert.equal(await page.evaluate(()=>Object.values(sessionStorage).join('|').includes('JBSWY3')),false);
 await page.locator('#mfa-enable-form [name="code"]').fill('123456');await page.getByRole('button',{name:'Confirm and enable verification'}).click();
 await page.locator('#mfa-recovery-dialog[open]').waitFor();assert.equal(await page.locator('#mfa-recovery-codes').innerText(),codes.join('\n'));
 assert.equal(await page.evaluate(()=>Object.values(sessionStorage).join('|').includes('ABCD-EFAB')),false);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download recovery codes'}).click();assert.equal((await download).suggestedFilename(),'afghan-eats-recovery-codes.txt');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 mkdirSync('visual-proof/premium',{recursive:true});await page.screenshot({path:'visual-proof/premium/admin-mfa-recovery-mobile.png',fullPage:true});
 assert.equal(await page.locator('#google-mfa-reauth button').count(),1,'one Google confirmation control after enrollment');
 await page.locator('#mfa-codes-saved').check();await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('#mfa-recovery-codes').innerText(),'');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#login-username').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ae_control_center_token')),null);
 // A user cancels while second-factor verification is in flight.
 holdVerify=true;await page.evaluate(()=>window.handleGoogleStaffCredential({credential:'test-google-credential'}));await page.locator('#mfa-login-code').fill('123456');await page.getByRole('button',{name:'Verify and sign in',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#mfa-login-form button[type="submit"]').disabled);
 for(let i=0;i<20&&!pendingVerify;i++)await new Promise(r=>setTimeout(r,25));assert.ok(pendingVerify);
 await page.getByRole('button',{name:'Back to sign-in'}).click();
 await pendingVerify.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify({result:{data:{json:{token:'must-not-be-saved',admin:{id:1,username:'test',role:'admin'}}}}})});
 await page.waitForFunction(()=>!document.querySelector('#mfa-login-form button[type="submit"]').disabled);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('ae_control_center_token')),null);
 assert.deepEqual(errors,[]);
 console.log('PASS: password/Google MFA challenge, failed code, no premature session, enrollment, recovery download/clearing, mobile layout, disable confirmation/cancel, logout and canceled in-flight verification.');
 await context.close();
} finally {await browser.close();server.kill();}
