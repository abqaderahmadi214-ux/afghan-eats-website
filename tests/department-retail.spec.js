const { test, expect } = require('@playwright/test');

const API='https://afghaneats-api.onrender.com/api/trpc/';
const envelope=data=>({result:{data:{json:data}}});
const departments=['groceries','health-beauty','convenience','gifts','electronics','pet-supplies'];

function tRPCPath(url){return new URL(url).pathname.split('/api/trpc/')[1]||'';}
function getInput(url){try{return JSON.parse(new URL(url).searchParams.get('input')||'{}').json}catch{return null}}

test('availability stays pending while loading, then accurately describes all-open gates and language changes',async({page})=>{
  let releaseGate;
  const gateResponse=new Promise(resolve=>{releaseGate=resolve;});
  const requests=[];
  await page.route(`${API}**`,async route=>{
    const request=route.request(),path=tRPCPath(request.url());requests.push({path,method:request.method()});
    if(path==='departmentRetail.departmentGates'){await gateResponse;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:true,listing_enabled:false,ordering_enabled:false}))))});}
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'unexpected API call'}})});
  });
  await page.goto('/department-partner');
  await expect(page.locator('#gate-headline')).toHaveText('Checking application availability…');
  await expect(page.locator('#interest-message')).toContainText('Checking department availability');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
  releaseGate();
  await expect(page.locator('#gate-headline')).toHaveText('Applications are open for all six departments');
  await expect(page.locator('#interest-message')).toContainText('6 of 6 department application gates are open');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-headline')).toHaveText('درخواست‌ها برای هر شش بخش باز است');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-headline')).toHaveText('Applications are open for all six departments');
  await page.locator('#departmentKey').selectOption('groceries');
  await expect(page.locator('#application-fields')).toBeEnabled();
  await expect(page.locator('#interest-message')).toContainText('The Groceries application gate is open');
  expect(requests.filter(request=>request.path.startsWith('departmentRetail.'))).toEqual([{path:'departmentRetail.departmentGates',method:'GET'}]);
});

test('gate summary and application wording stay bilingual and accurate through every availability state',async({page})=>{
  let mode='loading',releaseGate;
  const gateResponse=new Promise(resolve=>{releaseGate=resolve;});
  await page.route(`${API}**`,async route=>{
    if(tRPCPath(route.request().url())!=='departmentRetail.departmentGates')return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'unexpected API call'}})});
    if(mode==='loading')await gateResponse;
    if(mode==='error')return route.abort();
    const gates=mode==='incomplete'?[{department_key:'groceries',applications_open:true},{department_key:'health-beauty',applications_open:false}]:departments.map(department_key=>({department_key,applications_open:department_key==='groceries'}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(gates))});
  });

  await page.goto('/department-partner');
  await expect(page.locator('#gate-summary')).toHaveText('Checking department availability…');
  await expect(page.locator('#gate-summary')).toHaveAttribute('data-state','loading');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-summary')).toHaveText('دسترسی بخش‌ها در حال بررسی است…');
  releaseGate();
  await expect(page.locator('#gate-summary')).toHaveText('دروازهٔ 1 بخش باز است · فقط همان بخش‌ها درخواست می‌پذیرند');
  await expect(page.locator('#gate-summary')).toHaveAttribute('data-state','open');
  await expect(page.locator('#interest-message')).toContainText('ارسال فقط درخواست بررسی می‌سازد و به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-summary')).toHaveText('1 application gate(s) open · only selected departments accept submissions');
  await expect(page.locator('#interest-message')).toContainText('Submitting creates a review request only; it does not itself activate public listings or ordering');
  await expect(page.locator('#interest-message')).not.toContainText('remain closed');

  mode='incomplete';
  await page.reload();
  await expect(page.locator('#gate-summary')).toHaveText('2 of 6 department gates verified · 1 open · remaining unverified');
  await expect(page.locator('#gate-summary')).toHaveAttribute('data-state','unknown');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-summary')).toHaveText('وضعیت 2 از ۶ دروازه تأیید شد · 1 باز · بقیه تأییدنشده');
  await expect(page.locator('#interest-message')).toContainText('ارسال درخواست به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند');
  await expect(page.locator('#interest-message')).not.toContainText('فهرست عمومی و سفارش‌دهی بسته است');

  mode='error';
  await page.reload();
  await expect(page.locator('#gate-summary')).toHaveText('وضعیت دروازه تأیید نشد · درخواست‌ها غیرفعال است');
  await expect(page.locator('#gate-summary')).toHaveAttribute('data-state','unknown');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-summary')).toHaveText('Gate status unverified · applications unavailable');
  await page.getByRole('button',{name:'Change language'}).click();
  await expect(page.locator('#gate-summary')).toHaveText('وضعیت دروازه تأیید نشد · درخواست‌ها غیرفعال است');
  await expect(page.locator('#interest-message')).toContainText('ارسال درخواست به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند');
});

test('partially open gates are described correctly with no selection and a closed selection',async({page})=>{
  await page.route(`${API}**`,async route=>{
    const path=tRPCPath(route.request().url());
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:department_key==='groceries',listing_enabled:false,ordering_enabled:false}))))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'unexpected API call'}})});
  });
  await page.goto('/department-partner');
  await expect(page.locator('#gate-headline')).toHaveText('Applications are open for 1 of 6 departments');
  await expect(page.locator('#interest-message')).toContainText('1 of 6 department application gates are open');
  await page.locator('#departmentKey').selectOption('health-beauty');
  await expect(page.locator('#interest-message')).toContainText('Applications for Health & Beauty are closed');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
});

test('incomplete gate response reports unknown departments and keeps them unavailable',async({page})=>{
  await page.route(`${API}**`,async route=>{
    if(tRPCPath(route.request().url())==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([{department_key:'groceries',applications_open:true},{department_key:'health-beauty',applications_open:false}]))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'unexpected API call'}})});
  });
  await page.goto('/department-partner');
  await expect(page.locator('#gate-headline')).toHaveText('Availability confirmed for 2 of 6 departments · 1 open');
  await expect(page.locator('#gate-summary')).toContainText('2 of 6 department gates verified · 1 open · remaining unverified');
  await expect(page.locator('#interest-message')).toContainText('Remaining gates are unverified and treated as closed');
  await page.locator('#departmentKey').selectOption('convenience');
  await expect(page.locator('#interest-message')).toContainText('Availability for Convenience could not be confirmed');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
});

test('gate API errors and missing API configuration are explicitly unverified and fail closed',async({page})=>{
  const requests=[];
  await page.route(`${API}**`,async route=>{requests.push(route.request().url());return route.abort();});
  await page.goto('/department-partner');
  await expect(page.locator('#gate-headline')).toHaveText('Department availability could not be verified');
  await expect(page.locator('#gate-summary')).toContainText('Gate status unverified · applications unavailable');
  await expect(page.locator('#interest-message')).toContainText('Department availability could not be confirmed');
  await page.locator('#departmentKey').selectOption('groceries');
  await expect(page.locator('#interest-message')).toContainText('Availability for Groceries could not be confirmed');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
  expect(requests.filter(url=>url.includes('/api/trpc/departmentRetail.'))).toHaveLength(1);
  expect(requests.some(url=>url.includes('/api/trpc/departmentRetail.')&&!url.includes('departmentRetail.departmentGates'))).toBe(false);

  await page.unroute(`${API}**`);
  await page.route('**/config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.AFGHAN_EATS_CONFIG={apiBaseUrl:""};'}));
  await page.goto('/department-partner');
  await expect(page.locator('#gate-headline')).toHaveText('Department availability could not be verified');
  await expect(page.locator('#gate-summary')).toContainText('Availability API unavailable · applications unavailable');
  await expect(page.locator('#interest-message')).toContainText('Department availability could not be confirmed');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
});

test('retail application intake and status lookup stay read-only while every gate is closed',async({page})=>{
  const requests=[];
  await page.route(`${API}**`,async route=>{
    const path=tRPCPath(route.request().url());requests.push({path,method:route.request().method()});
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:false,listing_enabled:false,ordering_enabled:false}))))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'unexpected API call'}})});
  });
  await page.goto('/department-partner');
  await expect(page.getByRole('heading',{name:'Tell us about your business'})).toBeVisible();
  await expect(page.locator('#gate-headline')).toHaveText('Applications are closed for all six departments');
  await expect(page.locator('#interest-message')).toContainText('Applications are closed for all six departments');
  await expect(page.locator('#gate-summary')).toContainText('All 6 department application gates closed');
  await expect(page.locator('#departmentKey')).toBeEnabled();
  await page.locator('#departmentKey').selectOption('groceries');
  await expect(page.locator('#application-fields [name="businessName"]')).toBeDisabled();
  await expect(page.locator('#application-submit')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Check status'})).toBeEnabled();
  await page.locator('#department-interest-form').evaluate(form=>form.requestSubmit());
  expect(requests.filter(item=>item.path.startsWith('departmentRetail.'))).toEqual([{path:'departmentRetail.departmentGates',method:'GET'}]);
});

test('open department application uses backend field names and supports email-based status lookup',async({page})=>{
  const calls=[];
  await page.route(`${API}**`,async route=>{
    const request=route.request(),path=tRPCPath(request.url()),input=request.method()==='GET'?getInput(request.url()):request.postDataJSON()?.json;
    calls.push({path,method:request.method(),input});
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:department_key==='groceries',listing_enabled:false,ordering_enabled:false}))))});
    if(path==='departmentRetail.submitApplication')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,duplicate:false,reference:'AEM-20261124-A1B2C3',status:'pending',emailVerified:false,verificationEmailSent:true}))});
    if(path==='departmentRetail.applicationStatus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({reference:'AEM-20261124-A1B2C3',department_key:'groceries',business_name:'Test Market',status:'pending',email_verified:false,created_at:'2026-11-24T00:00:00Z'}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/department-partner');
  await page.locator('#departmentKey').selectOption('groceries');
  await expect(page.locator('#application-fields')).toBeEnabled();
  await page.getByLabel('Business / store name').fill('Test Market');
  await page.getByLabel('Owner’s full name').fill('Test Owner');
  await page.getByLabel('Contact phone').fill('+937000000000');
  await page.getByLabel('Email for verification').fill('owner@example.com');
  await page.getByLabel('District / area').fill('Center');
  await page.getByLabel('Store address').fill('Main street');
  await page.getByLabel('Products you carry and other application notes').fill('Fresh produce');
  await page.getByLabel(/I understand this is an application/).check();
  await page.locator('#application-submit').click();
  await expect(page.locator('#application-result')).toContainText('AEM-20261124-A1B2C3');
  await expect(page.locator('#status-result')).toContainText('pending');
  const call=calls.find(item=>item.path==='departmentRetail.submitApplication');
  expect(call.method).toBe('POST');
  expect(calls.some(item=>item.path==='departmentRetail.apply')).toBe(false);
  expect(call.input).toMatchObject({departmentKey:'groceries',businessName:'Test Market',ownerName:'Test Owner',phone:'+937000000000',email:'owner@example.com',cityKey:'herat',address:'Center — Main street'});
  expect(call.input.description).toContain('Products: Fresh produce');
  const statusCall=calls.find(item=>item.path==='departmentRetail.applicationStatus');
  expect(statusCall.input).toEqual({reference:'AEM-20261124-A1B2C3',email:'owner@example.com'});
  expect(calls.some(item=>item.path.includes('restaurants.'))).toBe(false);
});

test('applicant can resend email verification using the reference and email contract',async({page})=>{
  const calls=[];
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:false}))))});
    if(path==='departmentRetail.applicationStatus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({reference:'AEM-20261124-A1B2C3',department_key:'groceries',business_name:'Test Market',status:'pending',email_verified:false}))});
    if(path==='departmentRetail.resendApplicationVerification')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,alreadyVerified:false,verificationEmailSent:true}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/department-partner');
  await page.getByLabel('Application reference').fill('AEM-20261124-A1B2C3');
  await page.getByLabel('Email used on application').fill('owner@example.com');
  await page.getByRole('button',{name:'Check status'}).click();
  await expect(page.getByRole('button',{name:'Resend verification email'})).toBeVisible();
  await page.getByRole('button',{name:'Resend verification email'}).click();
  await expect(page.locator('#status-result')).toContainText('new verification email has been sent');
  expect(calls.find(item=>item.path==='departmentRetail.resendApplicationVerification').input).toEqual({reference:'AEM-20261124-A1B2C3',email:'owner@example.com'});
});

test('department owner activation uses the invite link, then signs in with the returned username',async({page})=>{
  let activationInput;
  await page.route(`${API}departmentRetail.ownerActivate`,async route=>{activationInput=route.request().postDataJSON().json;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,username:'market-owner-123'}))});});
  await page.goto('/department-owner?token=0123456789abcdef0123456789abcdef');
  await expect(page.getByRole('heading',{name:'Set up your password'})).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  await page.getByLabel('New password').fill('Example-password-123');
  await page.getByLabel('Confirm password').fill('Example-password-123');
  await page.getByRole('button',{name:'Activate account'}).click();
  await expect(page.locator('#owner-notice')).toContainText('Account activated');
  await expect(page.locator('#owner-login-form [name="username"]')).toHaveValue('market-owner-123');
  expect(activationInput).toEqual({token:'0123456789abcdef0123456789abcdef',password:'Example-password-123'});
  await expect(page.locator('#owner-workspace')).toBeHidden();
});

test('department owner login sends username and consumes the merchant dashboard contract',async({page})=>{
  const calls=[];
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='departmentRetail.ownerLogin')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({token:'owner-token',account:{id:'a',username:'market-user',merchantId:'m'}}))});
    if(path==='departmentRetail.ownerMe')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({id:'a',username:'market-user',merchantId:'m'}))});
    if(path==='departmentRetail.ownerDashboard')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({merchant:{id:'m',name:'Demo Store',department_key:'groceries',status:'pending',is_open:false,accepts_orders:false,opening_hours:{},fulfillment_config:{},payment_config:{}},categories:[],products:[],launchBlockers:['department listing gate must be explicitly enabled']}))});
    if(path==='departmentRetail.ownerListOrders')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([{id:'order-uuid',order_number:'R-001',status:'placed',created_at:'2026-11-24T00:00:00Z'}]))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/department-owner');
  await page.getByLabel('Username').fill('market-user');
  await page.getByLabel('Password',{exact:true}).fill('Example-password-123');
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.locator('#owner-workspace')).toBeVisible();
  await expect(page.locator('#owner-store-title')).toHaveText('Demo Store');
  await expect(page.locator('#owner-tab-content')).toContainText('Current launch blockers');
  await page.getByRole('button',{name:'Orders',exact:true}).click();
  const orderOptions=await page.locator('[data-owner-form="order-status"] select[name="status"] option').evaluateAll(options=>options.map(option=>option.value));
  expect(orderOptions).toEqual(['confirmed','cancelled','failed']);
  expect(calls.find(item=>item.path==='departmentRetail.ownerLogin').input).toEqual({username:'market-user',password:'Example-password-123'});
  expect(calls.some(item=>item.path.startsWith('restaurants.'))).toBe(false);
});

test('Control Center retail queue requires full admin and sends a retail-only review mutation',async({page})=>{
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(()=>{sessionStorage.setItem('ae_control_center_token','mock-token');sessionStorage.setItem('ae_control_center_user',JSON.stringify({role:'admin',username:'reviewer'}));});
  const calls=[];
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='auth.me')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({id:1,role:'admin',username:'reviewer'}))});
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:false,listing_enabled:false,ordering_enabled:false}))))});
    if(path==='departmentRetail.adminApplications')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([{id:'app-uuid',reference:'AEM-20261124-A1B2C3',department_key:'groceries',business_name:'Demo Store',owner_name:'Demo Owner',email:'owner@example.com',phone:'+937000000000',city_key:'herat',address:'Main Street',status:'pending',email_verified:true,created_at:'2026-11-24T00:00:00Z'}]))});
    if(path==='departmentRetail.adminApplicationDetail')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({id:'app-uuid',reference:'AEM-20261124-A1B2C3',department_key:'groceries',business_name:'Demo Store',owner_name:'Demo Owner',email:'owner@example.com',phone:'+937000000000',city_key:'herat',address:'Main Street',business_description:'Groceries',status:'pending',email_verified:true,created_at:'2026-11-24T00:00:00Z'}))});
    if(path==='departmentRetail.adminMerchants'||path==='departmentRetail.adminOrders'||path==='orders.adminList')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([]))});
    if(path==='departmentRetail.adminReviewApplication')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,status:'approved',merchantId:'merchant-uuid',merchantStatus:'pending',isOpen:false,acceptsOrders:false,inviteSent:true}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/admin-control-center/index.html#retail-departments');
  await expect(page.getByRole('heading',{name:'Department onboarding and operations'})).toBeVisible();
  await expect(page.getByText('Demo Store')).toBeVisible();
  await page.getByRole('button',{name:'Open',exact:true}).first().click();
  await expect(page.getByText('AEM-20261124-A1B2C3',{exact:true})).toBeVisible();
  const reviewForm=page.locator('[data-app-review-form="app-uuid"]');
  await expect(reviewForm.locator('[name="decision"]')).toHaveValue('');
  await reviewForm.locator('[name="decision"]').selectOption('approved');
  await reviewForm.locator('[name="adminNotes"]').fill('Verified business details.');
  await reviewForm.getByRole('button',{name:'Save review decision'}).click();
  const mutation=calls.find(item=>item.path==='departmentRetail.adminReviewApplication');
  expect(mutation.input).toEqual({id:'app-uuid',decision:'approved',adminNotes:'Verified business details.'});
  expect(calls.some(item=>item.path==='operations.adminPartnerApplications')).toBe(false);
});

test('admin launch review records a decision without opening department gates or merchant orders',async({page})=>{
  page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(()=>{sessionStorage.setItem('ae_control_center_token','mock-token');sessionStorage.setItem('ae_control_center_user',JSON.stringify({role:'admin',username:'reviewer'}));});
  const calls=[],merchant={id:'merchant-uuid',name:'Demo Store',department_key:'groceries',city_key:'herat',status:'pending',is_open:false,accepts_orders:false,listing_enabled:false,ordering_enabled:false,launch_review_required:true,launch_review_requested_at:'2026-11-24T00:00:00Z',launch_review_notes:'Profile, stock and hours are ready.',launch_review_admin_notes:null,setup_reviewed_at:'2026-11-24T00:00:00Z',username:'market-owner',email:'owner@example.com',activated_at:'2026-11-24T00:00:00Z',has_delivery:true,has_pickup:false,fulfillment_config:{zones:[{key:'center',enabled:true,fee:10}]},payment_config:{cash_on_delivery_enabled:true},retail_policy_config:{},payout_config:{}};
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='auth.me')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({id:1,role:'admin',username:'reviewer'}))});
    if(path==='departmentRetail.departmentGates')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(departments.map(department_key=>({department_key,applications_open:false,listing_enabled:false,ordering_enabled:false}))))});
    if(path==='departmentRetail.adminApplications')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([]))});
    if(path==='departmentRetail.adminMerchants')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([merchant]))});
    if(path==='departmentRetail.adminOrders')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([]))});
    if(path==='departmentRetail.adminMerchantDetail')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({merchant,categories:[],products:[{id:'product-1',name:'Rice',quantity_available:10,quantity_reserved:3}]}))});
    if(path==='departmentRetail.adminReviewLaunch')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,decision:'approved',launchReviewComplete:true,isOpen:false,acceptsOrders:false}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/admin-control-center/index.html#retail-departments');
  await page.getByRole('button',{name:'Merchants & readiness'}).click();
  await expect(page.getByText('Demo Store')).toBeVisible();
  await page.locator('[data-open-merchant="merchant-uuid"]').click();
  await expect(page.getByText('Inventory by product')).toBeVisible();
  const inventoryRow=page.getByRole('row',{name:/Rice/});
  await expect(inventoryRow.getByRole('cell').nth(1)).toHaveText('10');
  await expect(inventoryRow.getByRole('cell').nth(2)).toHaveText('3');
  await expect(inventoryRow.getByRole('cell').nth(3)).toHaveText('7');
  const form=page.locator('[data-launch-review-form="merchant-uuid"]');
  await expect(form).toBeVisible();
  await form.locator('[name="decision"]').selectOption('approved');
  await form.locator('[name="reviewNotes"]').fill('Readiness reviewed; public access remains gated.');
  await form.getByRole('button',{name:'Save launch-review decision'}).click();
  expect(calls.find(item=>item.path==='departmentRetail.adminReviewLaunch').input).toEqual({merchantId:'merchant-uuid',decision:'approved',reviewNotes:'Readiness reviewed; public access remains gated.'});
  expect(calls.some(item=>item.path==='departmentRetail.adminSetDepartmentGate')).toBe(false);
  expect(calls.some(item=>item.path==='departmentRetail.adminSetMerchantStatus')).toBe(false);
});

test('closed retail gate keeps checkout unavailable and never posts an order',async({page})=>{
  const merchantId='00000000-0000-4000-8000-000000000001',calls=[];
  await page.addInitScript(({merchantId})=>{
    localStorage.setItem(`ae_retail_cart_v1:${merchantId}`,JSON.stringify({merchantId,departmentKey:'groceries',items:[{id:'product-1',name:'Rice',price:'10.00',quantity:1}]}));
  },{merchantId});
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url());calls.push({path,method:req.method()});
    if(path==='departmentRetail.publicStorefront')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({available:false,reason:'department_coming_soon',merchant:null,categories:[],products:[]}))});
    if(path==='departmentRetail.quoteOrder')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({available:false,reason:'department_coming_soon',paymentMethods:{cashOnDelivery:{available:false},online:{available:false,reason:'provider_not_configured'}}}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto(`/retail-checkout.html?departmentKey=groceries&cityKey=herat&merchantId=${merchantId}`);
  await expect(page.getByText('This department is coming soon. No order has been or can be placed.')).toBeVisible();
  await expect(page.locator('#retailCheckoutForm')).toBeHidden();
  await page.locator('#retailCheckoutForm').evaluate(form=>{form.removeAttribute('hidden');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  expect(calls.find(item=>item.path==='departmentRetail.publicStorefront')).toBeTruthy();
  expect(calls.find(item=>item.path==='departmentRetail.quoteOrder')).toBeTruthy();
  expect(calls.some(item=>item.path==='departmentRetail.placeOrder'&&item.method==='POST')).toBe(false);
});

test('retail buyer catalog uses its own basket, server quote and retail-only order endpoint',async({page})=>{
  const merchantId='00000000-0000-4000-8000-000000000002',calls=[];
  const storefront={available:true,reason:null,orderingAvailable:true,merchant:{id:merchantId,name:'Demo Market',address:'Main Street',hasDelivery:true,hasPickup:true,deliveryZones:[{key:'center',name:'Center',fee:'5.00'}]},categories:[],products:[{id:'product-2',department_id:null,name:'Rice',name_dari:'برنج',description:'Premium rice',unit_label:'kg',price:'20.00',image_url:null,in_stock:true}]};
  await page.addInitScript(()=>localStorage.setItem('ae_cart','existing-restaurant-cart'));
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='departmentRetail.publicStorefront')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(storefront))});
    if(path==='departmentRetail.quoteOrder')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({available:true,reason:null,items:[{id:'product-2',name:'Rice',quantity:1,unitPrice:'20.00',lineTotal:'20.00'}],subtotal:'20.00',deliveryFee:'5.00',total:'25.00',paymentMethods:{cashOnDelivery:{available:true},online:{available:false,reason:'provider_not_configured'}}}))});
    if(path==='departmentRetail.placeOrder')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,replayed:false,orderId:'order-retail',orderNumber:'AR-261124-1234AB',status:'placed',total:'25.00',paymentMethod:'cash_on_delivery',paymentStatus:'pending'}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto(`/retail-store.html?departmentKey=groceries&cityKey=herat&merchantId=${merchantId}`);
  await expect(page.getByRole('heading',{name:'Demo Market'})).toBeVisible();
  await page.getByRole('button',{name:'Add to basket'}).click();
  await expect(page.locator('[data-retail-cart-count]').first()).toHaveText('1');
  expect(await page.evaluate(()=>localStorage.getItem('ae_cart'))).toBe('existing-restaurant-cart');
  await page.locator('[data-retail-checkout-link]').first().click();
  await expect(page.locator('#retailCheckoutForm')).toBeVisible();
  await page.getByLabel('Delivery address').fill('Main Street, Herat');
  await page.getByLabel('Your name').fill('Test Customer');
  await page.getByLabel('Contact phone').fill('+937000000000');
  await expect(page.locator('#retailQuoteTotal')).toHaveText('؋ 25.00');
  await expect(page.locator('#retailPlaceOrder')).toBeEnabled();
  await page.getByRole('button',{name:'Place retail order'}).click();
  await expect(page.locator('#retailOrderResult')).toContainText('AR-261124-1234AB');
  const quote=calls.find(item=>item.path==='departmentRetail.quoteOrder');
  expect(quote.input).toMatchObject({merchantId,departmentKey:'groceries',fulfillmentMethod:'delivery',zoneKey:'center',deliveryAddress:'Main Street, Herat',items:[{id:'product-2',quantity:1}]});
  const order=calls.find(item=>item.path==='departmentRetail.placeOrder');
  expect(order.method).toBe('POST');
  expect(order.input).toMatchObject({merchantId,departmentKey:'groceries',customerName:'Test Customer',customerPhone:'+937000000000',paymentMethod:'cash_on_delivery',items:[{id:'product-2',quantity:1}]});
  expect(order.input.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  expect(await page.evaluate(()=>localStorage.getItem('ae_cart'))).toBe('existing-restaurant-cart');
  expect(await page.evaluate(({merchantId})=>JSON.parse(localStorage.getItem(`ae_retail_cart_v1:${merchantId}`)).items.length,{merchantId})).toBe(0);
});

test('retail checkout ignores a late quote after delivery details change and submits only the fresh quote',async({page})=>{
  const merchantId='00000000-0000-4000-8000-000000000004',calls=[],quoteInputs=[];
  const storefront={available:true,reason:null,orderingAvailable:true,merchant:{id:merchantId,name:'Demo Market',address:'Main Street',hasDelivery:true,hasPickup:false,deliveryZones:[{key:'center',name:'Center',fee:'5.00'}]},categories:[],products:[]};
  await page.addInitScript(({merchantId})=>localStorage.setItem(`ae_retail_cart_v1:${merchantId}`,JSON.stringify({merchantId,departmentKey:'groceries',items:[{id:'product-3',name:'Rice',price:'20.00',quantity:1}]})),{merchantId});
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='departmentRetail.publicStorefront')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(storefront))});
    if(path==='departmentRetail.quoteOrder'){
      quoteInputs.push(input);
      if(input.deliveryAddress.startsWith('First'))await new Promise(resolve=>setTimeout(resolve,1200));
      const deliveryFee=input.deliveryAddress.startsWith('First')?'5.00':'7.00';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({available:true,reason:null,items:[{id:'product-3',name:'Rice',quantity:1,unitPrice:'20.00',lineTotal:'20.00'}],subtotal:'20.00',deliveryFee,total:deliveryFee==='5.00'?'25.00':'27.00',paymentMethods:{cashOnDelivery:{available:true},online:{available:false,reason:'provider_not_configured'}}}))});
    }
    if(path==='departmentRetail.placeOrder')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,replayed:false,orderId:'order-retail-fresh',orderNumber:'AR-261124-FRESH',status:'placed',total:'27.00',paymentMethod:'cash_on_delivery',paymentStatus:'pending'}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto(`/retail-checkout.html?departmentKey=groceries&cityKey=herat&merchantId=${merchantId}`);
  await expect(page.locator('#retailCheckoutForm')).toBeVisible();
  await page.getByLabel('Delivery address').fill('First Road, Herat');
  await expect.poll(()=>quoteInputs.length).toBe(1);
  await page.getByLabel('Delivery address').fill('Second Road, Herat');
  await expect(page.locator('#retailPlaceOrder')).toBeDisabled();
  await expect(page.locator('#retailQuoteTotals')).toBeHidden();
  await expect.poll(()=>quoteInputs.length).toBe(2);
  await expect(page.locator('#retailPlaceOrder')).toBeEnabled();
  await expect(page.locator('#retailQuoteTotal')).toHaveText('؋ 27.00');
  await page.waitForTimeout(1000);
  await expect(page.locator('#retailQuoteTotal')).toHaveText('؋ 27.00');
  await page.getByLabel('Your name').fill('Test Customer');
  await page.getByLabel('Contact phone').fill('+937000000000');
  await page.getByRole('button',{name:'Place retail order'}).click();
  await expect(page.locator('#retailOrderResult')).toContainText('Server-confirmed total: ؋ 27.00');
  const order=calls.find(item=>item.path==='departmentRetail.placeOrder');
  expect(order.input).toMatchObject({deliveryAddress:'Second Road, Herat',customerName:'Test Customer',customerPhone:'+937000000000'});
});

test('department owner sees reserved inventory and can request a future online option without enabling it',async({page})=>{
  const calls=[],product={id:'00000000-0000-4000-8000-000000000003',name:'Test Rice',sku:'RICE-1',price:'20.00',department_id:null,is_available:true,tracking_enabled:true,quantity_available:10,quantity_reserved:4,low_stock_threshold:2};
  const dashboard={merchant:{id:'merchant-uuid',name:'Demo Market',department_key:'groceries',status:'active',is_open:false,accepts_orders:false,opening_hours:{},fulfillment_config:{zones:[{key:'center',enabled:true,fee:'5.00'}]},payment_config:{cash_on_delivery_enabled:true,online_payment_enabled:false,online_payment_requested:false},has_delivery:true,has_pickup:true},categories:[],products:[product],launchBlockers:['department listing gate must be explicitly enabled']};
  await page.route(`${API}**`,async route=>{
    const req=route.request(),path=tRPCPath(req.url()),input=req.method()==='GET'?getInput(req.url()):req.postDataJSON()?.json;calls.push({path,method:req.method(),input});
    if(path==='departmentRetail.ownerLogin')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({token:'owner-token',account:{id:'a',username:'market-user',merchantId:'merchant-uuid'}}))});
    if(path==='departmentRetail.ownerMe')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({id:'a',username:'market-user',merchantId:'merchant-uuid'}))});
    if(path==='departmentRetail.ownerDashboard')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope(dashboard))});
    if(path==='departmentRetail.ownerListOrders')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope([]))});
    if(path==='departmentRetail.ownerSetInventory'||path==='departmentRetail.ownerSetFulfillment')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope({success:true,requiresAdminReview:true,onlinePaymentEnabled:false}))});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:`unexpected ${path}`}})});
  });
  await page.goto('/department-owner.html');
  await page.getByLabel('Username').fill('market-user');
  await page.getByLabel('Password',{exact:true}).fill('Example-password-123');
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByRole('button',{name:'Inventory'}).click();
  const row=page.getByRole('row',{name:/Test Rice/});
  await expect(row.locator('td').nth(2).locator('input[name="quantityAvailable"]')).toHaveValue('10');
  await expect(row.getByRole('cell').nth(3)).toHaveText('4');
  await expect(row.getByRole('cell').nth(4)).toHaveText('6');
  await row.getByRole('spinbutton',{name:'On-hand quantity for Test Rice'}).fill('11');
  await row.getByRole('button',{name:'Save'}).click();
  await expect.poll(()=>calls.some(call=>call.path==='departmentRetail.ownerSetInventory')).toBe(true);
  const stockCall=calls.find(call=>call.path==='departmentRetail.ownerSetInventory');
  expect(stockCall.input).toMatchObject({productId:product.id,trackingEnabled:true,quantityAvailable:11,lowStockThreshold:2});
  await page.getByRole('button',{name:'Fulfillment'}).click();
  await page.locator('[data-owner-form="fulfillment"] [name="onlinePaymentRequested"]').check();
  await page.getByRole('button',{name:'Submit fulfillment setup for review'}).click();
  await expect.poll(()=>calls.some(call=>call.path==='departmentRetail.ownerSetFulfillment')).toBe(true);
  const fulfillmentCall=calls.find(call=>call.path==='departmentRetail.ownerSetFulfillment');
  expect(fulfillmentCall.input).toMatchObject({cashOnDeliveryEnabled:true,onlinePaymentRequested:true,onlinePaymentEnabled:false,hasDelivery:true,hasPickup:true});
  expect(calls.some(call=>call.path==='departmentRetail.placeOrder')).toBe(false);
});
