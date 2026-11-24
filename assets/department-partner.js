'use strict';
(() => {
  const ids = ['groceries','health-beauty','convenience','gifts','electronics','pet-supplies'];
  const labels = { groceries:'Groceries', 'health-beauty':'Health & Beauty', convenience:'Convenience', gifts:'Gifts', electronics:'Electronics', 'pet-supplies':'Pet Supplies' };
  const apiBase = window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '';
  const form = document.getElementById('department-interest-form');
  const fields = document.getElementById('application-fields');
  const department = document.getElementById('departmentKey');
  const gateSummary = document.getElementById('gate-summary');
  const gateHeadline = document.getElementById('gate-headline');
  const gatePill = document.getElementById('application-gate-state');
  const appMessage = document.getElementById('interest-message');
  const appResult = document.getElementById('application-result');
  const statusForm = document.getElementById('status-lookup-form');
  const statusPanel = document.getElementById('application-status');
  if (statusPanel && window.location.hash === '#application-status') statusPanel.open = true;
  const statusResult = document.getElementById('status-result');
  const resendButton = document.getElementById('resend-verification');
  let lang = localStorage.getItem('ae_lang') === 'fa' ? 'fa' : 'en';
  let gates = new Map();
  let gateStatus = 'loading';
  let gateError = null;
  let lookedUp = null;
  function text(en, fa) { return lang === 'fa' ? fa : en; }
  function refreshGateSummary() {
    if (!gateSummary) return;
    const known=ids.filter(id=>gates.has(id)).length;
    const openCount=ids.filter(gateOpen).length;
    const complete=known===ids.length;
    if (gateStatus==='loading') {
      gateSummary.textContent=text('Checking department availability…','دسترسی بخش‌ها در حال بررسی است…');
      gateSummary.dataset.state='loading';
    } else if (gateStatus==='error') {
      gateSummary.textContent=gateError==='api-unavailable'?text('Availability API unavailable · applications unavailable','API در دسترس نیست · درخواست‌ها غیرفعال است'):text('Gate status unverified · applications unavailable','وضعیت دروازه تأیید نشد · درخواست‌ها غیرفعال است');
      gateSummary.dataset.state='unknown';
    } else if (!complete) {
      gateSummary.textContent=text(`${known} of 6 department gates verified · ${openCount} open · remaining unverified`,`وضعیت ${known} از ۶ دروازه تأیید شد · ${openCount} باز · بقیه تأییدنشده`);
      gateSummary.dataset.state='unknown';
    } else if (openCount) {
      gateSummary.textContent=text(`${openCount} application gate(s) open · only selected departments accept submissions`,`دروازهٔ ${openCount} بخش باز است · فقط همان بخش‌ها درخواست می‌پذیرند`);
      gateSummary.dataset.state='open';
    } else {
      gateSummary.textContent=text('All 6 department application gates closed','دروازهٔ درخواست هر شش بخش بسته است');
      gateSummary.dataset.state='closed';
    }
  }
  function setLanguage(next) {
    lang = next === 'fa' ? 'fa' : 'en'; localStorage.setItem('ae_lang', lang);
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-en][data-fa]').forEach(node => { node.textContent = node.dataset[lang]; });
    const button = document.getElementById('dr-language'); if (button) button.textContent = lang === 'fa' ? 'English' : 'دری';
    refreshGateSummary();
    refreshSelectedGate();
  }
  async function call(path, input, method = 'GET') {
    if (!apiBase) throw new Error(text('The department application service is not configured.','خدمات درخواست بخش تنظیم نشده است.'));
    const url = `${apiBase}/api/trpc/${path}${method === 'GET' ? `?input=${encodeURIComponent(JSON.stringify({json:input ?? null}))}` : ''}`;
    const options = { method, headers:{Accept:'application/json'}, signal:AbortSignal.timeout(15000) };
    if (method !== 'GET') { options.headers['Content-Type']='application/json'; options.body=JSON.stringify({json:input ?? {}}); }
    const response = await fetch(url, options), raw = await response.text(); let parsed;
    try { parsed=JSON.parse(raw); } catch { throw new Error(text('The application service returned an unreadable response.','خدمات درخواست پاسخ قابل‌خواندن نداد.')); }
    if (!response.ok || parsed?.error) throw new Error(parsed?.error?.json?.message || parsed?.error?.message || `Request failed (${response.status})`);
    return parsed?.result?.data?.json ?? parsed?.result?.data ?? parsed;
  }
  const query = (path,input) => call(path,input,'GET');
  const mutate = (path,input) => call(path,input,'POST');
  function gateFor(id) { return gates.get(id) || null; }
  function gateOpen(id) { const g=gateFor(id); return g?.applications_open === true; }
  function refreshSelectedGate() {
    const id=department?.value || '';
    const known=ids.filter(key=>gates.has(key)).length;
    const openCount=ids.filter(gateOpen).length;
    const complete=known===ids.length;
    const open=Boolean(id && gateOpen(id));
    if (fields) fields.disabled=!open;
    const button=document.getElementById('application-submit');
    if (button) {
      button.disabled=!open;
      button.textContent=open?text('Submit application','ارسال درخواست'):!id?text('Choose a department','یک بخش انتخاب کنید'):gateStatus==='loading'?text('Checking availability','بررسی دسترسی'):gateStatus==='error'||!gates.has(id)?text('Availability unverified','دسترسی تأیید نشد'):text('Applications closed','درخواست‌ها بسته است');
    }
    if (gatePill) {
      gatePill.textContent=id?(open?text('Applications open','درخواست‌ها باز است'):gateStatus==='loading'?text('Checking','در حال بررسی'):gateStatus==='error'||!gates.has(id)?text('Unverified','تأییدنشده'):text('Closed','بسته')):gateStatus==='loading'?text('Checking','در حال بررسی'):gateStatus==='error'?text('Unverified','تأییدنشده'):openCount?text(`${openCount} of 6 open`,`${openCount} از ۶ باز`):complete?text('All closed','همه بسته'):text('Unverified','تأییدنشده');
      gatePill.classList.toggle('dr-pill-muted',!open);
    }

    if (gateHeadline) {
      if (gateStatus==='loading') gateHeadline.textContent=text('Checking application availability…','وضعیت دسترسی درخواست در حال بررسی است…');
      else if (gateStatus==='error') gateHeadline.textContent=text('Department availability could not be verified','دسترسی بخش‌ها تأیید نشد');
      else if (!complete) gateHeadline.textContent=text(`Availability confirmed for ${known} of 6 departments · ${openCount} open`,`دسترسی ${known} از ۶ بخش تأیید شد · ${openCount} باز`);
      else if (!openCount) gateHeadline.textContent=text('Applications are closed for all six departments','درخواست‌ها برای هر شش بخش بسته است');
      else if (openCount===ids.length) gateHeadline.textContent=text('Applications are open for all six departments','درخواست‌ها برای هر شش بخش باز است');
      else gateHeadline.textContent=text(`Applications are open for ${openCount} of 6 departments`,`درخواست‌ها برای ${openCount} از ۶ بخش باز است`);
    }

    if (!id) {
      if (gateStatus==='loading') appMessage.textContent=text('Checking department availability. Applications remain unavailable until a selected department gate is confirmed open.','دسترسی بخش‌ها در حال بررسی است. تا تأیید بازبودن دروازهٔ بخش انتخاب‌شده، درخواست‌ها غیرفعال می‌مانند.');
      else if (gateStatus==='error') appMessage.textContent=text('Department availability could not be confirmed. Applications remain unavailable; no application will be submitted. Applying does not itself activate public listings or ordering.','دسترسی بخش‌ها تأیید نشد. درخواست‌ها غیرفعال می‌مانند و هیچ درخواستی ارسال نمی‌شود. ارسال درخواست به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند.');
      else if (!complete) appMessage.textContent=text(`Availability is confirmed for ${known} of 6 departments; ${openCount} application gate(s) open. Remaining gates are unverified and treated as closed. Choose a confirmed open department to continue. Applying does not itself activate public listings or ordering.`,`دسترسی ${known} از ۶ بخش تأیید شده و دروازهٔ درخواست ${openCount} بخش باز است. وضعیت دروازه‌های دیگر تأیید نشده و بسته در نظر گرفته می‌شود. برای ادامه یک بخش با دروازهٔ بازشده انتخاب کنید. ارسال درخواست به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند.`);
      else if (!openCount) appMessage.textContent=text('Applications are closed for all six departments. The form will become available only when the selected department’s application gate is explicitly opened.','درخواست‌ها برای هر شش بخش بسته است. فورم تنها زمانی فعال می‌شود که دروازهٔ درخواست بخش انتخاب‌شده رسماً باز شود.');
      else appMessage.textContent=text(`${openCount} of 6 department application gates are open. Choose an open department to continue. Submitting creates a review request only; it does not itself activate public listings or ordering.`,`${openCount} دروازهٔ درخواست از ۶ بخش باز است. برای ادامه یک بخش باز را انتخاب کنید. ارسال فقط درخواست بررسی می‌سازد و به‌تنهایی فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند.`);
    } else if (gateStatus==='loading') appMessage.textContent=text(`Availability for ${labels[id] || 'this department'} is being checked. The form stays unavailable until its gate is confirmed open.`,`دسترسی ${labels[id] || 'این بخش'} در حال بررسی است. فورم تا تأیید بازبودن دروازه غیرفعال می‌ماند.`);
    else if (gateStatus==='error'||!gates.has(id)) appMessage.textContent=text(`Availability for ${labels[id] || 'this department'} could not be confirmed. No application can be submitted unless its gate is confirmed open.`,`دسترسی ${labels[id] || 'این بخش'} تأیید نشد. تا تأیید بازبودن دروازه، درخواست ارسال نمی‌شود.`);
    else if (open) appMessage.textContent=text(`The ${labels[id]} application gate is open. Submitting creates a review request only; it does not activate a public listing or ordering.`,`دروازهٔ درخواست ${labels[id]} باز است. ارسال فقط درخواست بررسی می‌سازد؛ فهرست عمومی یا سفارش‌دهی را فعال نمی‌کند.`);
    else appMessage.textContent=text(`Applications for ${labels[id] || 'this department'} are closed. No application can be submitted unless its gate is explicitly opened.`,`درخواست‌های ${labels[id] || 'این بخش'} بسته است. تا بازشدن رسمی دروازه، درخواست ارسال نمی‌شود.`);
  }
  async function loadGates() {
    if (!apiBase) { gateStatus='error'; gateError='api-unavailable'; refreshGateSummary(); refreshSelectedGate(); return; }
    try {
      const response=await query('departmentRetail.departmentGates',null);
      const list=Array.isArray(response)?response:(Array.isArray(response?.gates)?response.gates:Array.isArray(response?.departments)?response.departments:[]);
      gates=new Map(list.map(item=>[String(item?.department_key ?? item?.departmentKey ?? item?.departmentId ?? item?.department_id ?? item?.id ?? ''),item]));
      const open=ids.filter(id=>gateOpen(id));
      gateStatus='loaded';
      gateError=null;
      refreshGateSummary();
      refreshSelectedGate();
    } catch(error) {
      gates=new Map(); gateStatus='error'; gateError='query-failed'; refreshGateSummary();
      refreshSelectedGate();
    }
  }
  function setResult(node,message,error=false) { node.hidden=false; node.textContent=message; node.classList.toggle('dr-error',error); }
  document.getElementById('dr-language')?.addEventListener('click',()=>setLanguage(lang==='fa'?'en':'fa'));
  department?.addEventListener('change',refreshSelectedGate);
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=new FormData(form),departmentKey=String(data.get('departmentKey')||'');
    if(!ids.includes(departmentKey)||!gateOpen(departmentKey)){ refreshSelectedGate(); return setResult(appResult,text('Applications are closed for the selected department. Nothing was submitted.','درخواست‌های بخش انتخاب‌شده بسته است؛ چیزی ارسال نشد.'),true); }
    const address=[String(data.get('district')||'').trim(),String(data.get('address')||'').trim()].filter(Boolean).join(' — ');
    const details=[['Products',data.get('productSummary')],['Fulfillment',data.get('fulfillment')],['Operating hours',data.get('hours')]].filter(([,value])=>String(value||'').trim()).map(([label,value])=>`${label}: ${String(value).trim()}`).join('\n').slice(0,2000);
    const submit=document.getElementById('application-submit'); submit.disabled=true;
    try {
      const result=await mutate('departmentRetail.submitApplication',{departmentKey,businessName:String(data.get('businessName')||'').trim(),ownerName:String(data.get('ownerName')||'').trim(),phone:String(data.get('phone')||'').trim(),email:String(data.get('email')||'').trim(),cityKey:String(data.get('cityKey')||'herat'),address,description:details||undefined});
      lookedUp={reference:result.reference,email:String(data.get('email')||'').trim()};
      setResult(appResult,result.duplicate?text(`A recent application already exists. Reference: ${result.reference}. Check its status below.`,`یک درخواست تازه موجود است. شماره پیگیری: ${result.reference}. وضعیت را پایین بررسی کنید.`):text(`Application received for ${labels[departmentKey]}. Reference: ${result.reference}. ${result.verificationEmailSent?'Check your email to verify the address.':'The application was recorded, but the verification email could not be confirmed; use status lookup to retry.'}`,`درخواست ${labels[departmentKey]} دریافت شد. شماره پیگیری: ${result.reference}. ${result.verificationEmailSent?'برای تأیید ایمیل خود را بررسی کنید.':'درخواست ثبت شد؛ ایمیل تأیید را نتوانستیم تأیید کنیم، از بررسی وضعیت برای ارسال دوباره استفاده کنید.'}`));
      if (statusPanel) statusPanel.open = true;
      statusForm.elements.reference.value=result.reference; statusForm.elements.email.value=lookedUp.email; statusForm.scrollIntoView({behavior:'smooth',block:'center'}); await lookupStatus();
      if(!result.duplicate)form.reset();
    } catch(error) { setResult(appResult,error.message||text('Application could not be submitted.','درخواست ارسال نشد.'),true); }
    finally { refreshSelectedGate(); }
  });
  async function lookupStatus() {
    const reference=String(statusForm.elements.reference.value||'').trim(),email=String(statusForm.elements.email.value||'').trim();
    resendButton.hidden=true; lookedUp={reference,email};
    try {
      const app=await query('departmentRetail.applicationStatus',{reference,email});
      const status=String(app.status||'pending').replaceAll('_',' ');
      setResult(statusResult,text(`Application ${app.reference} · ${labels[app.department_key]||app.department_key} · ${status}${app.email_verified?' · email verified':' · email not verified'}`,`درخواست ${app.reference} · ${labels[app.department_key]||app.department_key} · ${status}${app.email_verified?' · ایمیل تأیید شده':' · ایمیل تأیید نشده'}`));
      resendButton.hidden=app.email_verified===true;
    } catch(error) { setResult(statusResult,error.message||text('Application status could not be loaded.','وضعیت درخواست دریافت نشد.'),true); }
  }
  statusForm?.addEventListener('submit',event=>{event.preventDefault();void lookupStatus();});
  resendButton?.addEventListener('click',async()=>{
    if(!lookedUp?.reference||!lookedUp?.email)return;
    resendButton.disabled=true;
    try { const result=await mutate('departmentRetail.resendApplicationVerification',lookedUp); setResult(statusResult,result.alreadyVerified?text('This application email is already verified.','ایمیل این درخواست قبلاً تأیید شده است.'):result.verificationEmailSent?text('A new verification email has been sent.','ایمیل تأیید تازه ارسال شد.'):text('The application is saved, but the verification email could not be confirmed. Please try again later.','درخواست ثبت شده، اما ارسال ایمیل تأیید تأیید نشد. بعداً دوباره تلاش کنید.'),!result.verificationEmailSent&&!result.alreadyVerified); }
    catch(error) { setResult(statusResult,error.message||text('Verification email could not be resent.','ایمیل تأیید دوباره ارسال نشد.'),true); }
    finally { resendButton.disabled=false; }
  });
  setLanguage(lang); void loadGates();
})();
