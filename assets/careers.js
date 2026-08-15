(() => {
  const API_BASE = 'https://afghaneats-api.onrender.com';
  const jobsRoot = document.getElementById('career-jobs');
  const count = document.getElementById('career-count');
  const dialog = document.getElementById('career-apply-dialog');
  const form = document.getElementById('career-apply-form');
  const message = document.getElementById('career-form-message');
  const submit = document.getElementById('career-submit');
  const languageButton = document.getElementById('career-lang');
  let jobs = [];

  function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function lang() { return localStorage.getItem('ae_career_lang') === 'fa' ? 'fa' : 'en'; }
  function setLang(next) {
    localStorage.setItem('ae_career_lang', next);
    document.documentElement.lang = next === 'fa' ? 'fa' : 'en';
    document.documentElement.dir = next === 'fa' ? 'rtl' : 'ltr';
    languageButton.textContent = next === 'fa' ? 'English' : 'دری';
  }
  function localized(job, key) { return lang() === 'fa' && job[`${key}_dari`] ? job[`${key}_dari`] : job[key]; }
  function trpc(path, input, method = 'GET') {
    let url = `${API_BASE}/api/trpc/${path}`;
    const options = { method, headers: { Accept: 'application/json' } };
    if (method === 'GET') url += `?input=${encodeURIComponent(JSON.stringify({ json: input ?? null }))}`;
    else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({ json: input ?? {} }); }
    return fetch(url, options).then(async response => {
      const payload = await response.json().catch(() => null);
      const error = payload?.error?.json?.message || payload?.error?.message;
      if (!response.ok || error) throw new Error(error || 'The request could not be completed.');
      return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
    });
  }
  function typeLabel(value) { const map = { full_time: ['Full time', 'تمام وقت'], part_time: ['Part time', 'نیمه وقت'], contract: ['Contract', 'قراردادی'], internship: ['Internship', 'کارآموزی'], on_site: ['On site', 'حضوری'], hybrid: ['Hybrid', 'ترکیبی'], remote: ['Remote', 'از راه دور'] }; return map[value]?.[lang() === 'fa' ? 1 : 0] || String(value || '').replaceAll('_', ' '); }
  function deadline(value) { if (!value) return lang() === 'fa' ? 'تا تکمیل ظرفیت' : 'Open until filled'; const date = new Date(value); return `${lang() === 'fa' ? 'مهلت' : 'Deadline'}: ${new Intl.DateTimeFormat(lang() === 'fa' ? 'fa-AF' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}`; }
  function list(value) { return String(value || '').split(/\n|•/).map(item => item.trim()).filter(Boolean); }
  function detail(titleEn, titleFa, value) { const lines = list(value); return lines.length ? `<section class="career-job-detail"><h4><span class="en-copy">${titleEn}</span><span class="fa-copy">${titleFa}</span></h4><ul>${lines.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''; }
  function jobCard(job) {
    const title = localized(job, 'title');
    return `<article class="career-job-card"><div class="career-job-top"><div><div class="career-job-meta"><span>${escapeHtml(job.department)}</span><span>·</span><span>${escapeHtml(typeLabel(job.employment_type))}</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(job.summary)}</p></div><span class="career-deadline">${escapeHtml(deadline(job.application_deadline))}</span></div><div class="career-job-tags"><span>${escapeHtml(job.location)}</span><span>${escapeHtml(typeLabel(job.work_mode))}</span><span>${escapeHtml(job.reference)}</span></div><details class="career-job-more"><summary><span class="en-copy">View role details</span><span class="fa-copy">دیدن جزییات نقش</span></summary><div class="career-job-details">${detail('Responsibilities', 'مسئولیت‌ها', job.responsibilities)}${detail('What we are looking for', 'آنچه ما می‌خواهیم', job.requirements)}${detail('What we offer', 'آنچه ما ارائه می‌کنیم', job.benefits)}</div></details><button class="btn btn-primary career-apply-button" type="button" data-apply-id="${escapeHtml(job.id)}"><span class="en-copy">Apply for this role</span><span class="fa-copy">درخواست برای این نقش</span></button></article>`;
  }
  function render() {
    jobsRoot.setAttribute('aria-busy', 'false');
    if (!jobs.length) { count.textContent = lang() === 'fa' ? '۰ فرصت باز' : '0 open roles'; jobsRoot.innerHTML = `<div class="career-empty"><span>✦</span><h3><span class="en-copy">No openings right now.</span><span class="fa-copy">در حال حاضر فرصتی باز نیست.</span></h3><p><span class="en-copy">Please check again soon. New Afghan Eats roles are posted here as they become available.</span><span class="fa-copy">لطفاً دوباره مراجعه کنید. فرصت‌های جدید افغان ایتس در اینجا نشر می‌شوند.</span></p></div>`; return; }
    count.textContent = lang() === 'fa' ? `${new Intl.NumberFormat('fa').format(jobs.length)} فرصت باز` : `${jobs.length} open role${jobs.length === 1 ? '' : 's'}`;
    jobsRoot.innerHTML = jobs.map(jobCard).join('');
  }
  async function load() {
    try { jobs = await trpc('operations.publicCareerPositions', null); render(); }
    catch (error) { jobsRoot.setAttribute('aria-busy', 'false'); count.textContent = ''; jobsRoot.innerHTML = `<div class="career-empty"><h3><span class="en-copy">Openings are temporarily unavailable.</span><span class="fa-copy">فرصت‌ها موقتاً در دسترس نیستند.</span></h3><p>${escapeHtml(error.message || '')}</p><button class="btn btn-light" id="career-retry" type="button"><span class="en-copy">Try again</span><span class="fa-copy">تلاش دوباره</span></button></div>`; document.getElementById('career-retry')?.addEventListener('click', load); }
  }
  function openApply(id) {
    const job = jobs.find(item => String(item.id) === String(id)); if (!job) return;
    form.reset(); message.textContent = ''; message.className = 'career-form-message'; document.getElementById('career-position-id').value = job.id;
    document.getElementById('career-apply-role').textContent = `${localized(job, 'title')} · ${job.department}`;
    dialog.showModal(); setTimeout(() => form.elements.fullName.focus(), 80);
  }
  jobsRoot.addEventListener('click', event => { const button = event.target.closest('[data-apply-id]'); if (button) openApply(button.dataset.applyId); });
  document.querySelectorAll('[data-career-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(form); const years = String(data.get('experienceYears') || '').trim();
    const payload = { positionId: String(data.get('positionId')), fullName: String(data.get('fullName') || '').trim(), phone: String(data.get('phone') || '').trim(), email: String(data.get('email') || '').trim(), city: String(data.get('city') || '').trim(), experienceYears: years ? Number(years) : undefined, currentRole: String(data.get('currentRole') || '').trim(), coverNote: String(data.get('coverNote') || '').trim(), resumeUrl: String(data.get('resumeUrl') || '').trim() };
    submit.disabled = true; message.textContent = lang() === 'fa' ? 'در حال ارسال…' : 'Submitting…'; message.className = 'career-form-message is-info';
    try { const result = await trpc('operations.applyCareer', payload, 'POST'); message.textContent = lang() === 'fa' ? `درخواست شما ثبت شد. شماره پیگیری: ${result.reference}` : `Your application has been received. Reference: ${result.reference}`; message.className = 'career-form-message is-success'; form.reset(); }
    catch (error) { message.textContent = error.message || (lang() === 'fa' ? 'ارسال درخواست ممکن نشد.' : 'Your application could not be submitted.'); message.className = 'career-form-message is-error'; }
    finally { submit.disabled = false; }
  });
  languageButton.addEventListener('click', () => { setLang(lang() === 'fa' ? 'en' : 'fa'); render(); });
  setLang(lang()); load();
})();
