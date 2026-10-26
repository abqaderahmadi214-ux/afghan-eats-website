'use strict';
(function () {
  let language = 'en';
  const routes = { operations: 'workers', restaurant_maintenance: 'restaurants', restaurant_discovery: 'restaurants' };
  const states = new Set(['unavailable', 'unconfigured', 'paused', 'failed', 'partial', 'no_record', 'future_record', 'stale_record', 'recent_record']);
  const labels = {
    en: { title: 'Your operations briefing', subtitle: 'A rolling 24-hour report and recorded specialist activity.', language: 'Report language', refresh: 'Refresh report', records: 'Specialist records', report: '24-hour report', review: 'Review needed', recent: 'Recent record', work: 'Open workspace', at: 'Report snapshot (Kabul)', reference: 'Recorded activity (Kabul)', none: 'Not recorded', note: 'Read-only briefing. Stored activity does not prove a worker is running. Legal commitments and financial decisions remain with you.', error: 'The manager report is unavailable. Check your access and that the manager backend has been released, then try again. No report totals are shown.', empty: 'No specialist records were returned.' },
    fa: { title: 'گزارش عملیاتی شما', subtitle: 'گزارش ۲۴ ساعت گذشته و سوابق فعالیت بخش‌های تخصصی.', language: 'زبان گزارش', refresh: 'تازه‌سازی گزارش', records: 'سوابق بخش‌های تخصصی', report: 'گزارش ۲۴ ساعته', review: 'نیاز به بررسی', recent: 'سابقهٔ اخیر', work: 'باز کردن بخش کاری', at: 'زمان گزارش (کابل)', reference: 'فعالیت ثبت‌شده (کابل)', none: 'ثبت نشده', note: 'این گزارش فقط برای مشاهده است. سوابق فعالیت ثابت نمی‌کند که بخش‌ها اکنون فعال‌اند. تعهدات حقوقی و تصمیم‌های مالی با شما باقی می‌ماند.', error: 'گزارش مدیر در دسترس نیست. دسترسی حساب و انتشار بخش مدیر در سرور بررسی شود؛ سپس دوباره تلاش کنید. مجموع سفارش‌ها نمایش داده نمی‌شود.', empty: 'هیچ سابقه‌ای از بخش‌های تخصصی دریافت نشد.' },
  };
  function time(value, lang) {
    if (!value || !Number.isFinite(Date.parse(value))) return labels[lang].none;
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-AF' : 'en-GB', { timeZone: 'Asia/Kabul', calendar: 'gregory', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value));
  }
  function valid(report, lang) {
    return report && report.language === lang && typeof report.text === 'string' && report.text.trim() && Number.isFinite(Date.parse(report.snapshotAt)) && Array.isArray(report.specialists) && report.specialists.every(s => s && Object.hasOwn(routes, s.id) && states.has(s.state) && typeof s.name === 'string' && typeof s.message === 'string');
  }
  async function render() {
    if (!isFullAdmin() || !state.token || state.view !== 'manager') return;
    const token = state.token, lang = language, t = labels[lang];
    let report = null;
    try {
      report = await query('aiManager.report', { language: lang });
      if (!valid(report, lang)) report = null;
    } catch {
      // Do not expose raw proxy/database errors or substitute zero totals.
    }
    if (token !== state.token || state.view !== 'manager' || !isFullAdmin()) return;
    const target = renderTarget();
    if (!report) window.adminFreshness?.failed();
    root[target] = `<section class="manager-page" lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}">
      <header class="panel manager-intro"><div><h2>${t.title}</h2><p>${t.subtitle}</p></div><div class="manager-controls"><label for="manager-language">${t.language}</label><select id="manager-language"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="fa" ${lang === 'fa' ? 'selected' : ''}>دری</option></select><button type="button" class="button button-primary" data-manager-refresh>${t.refresh}</button></div></header>
      <p class="notice notice-info">${t.note}</p>
      ${report ? `<p class="manager-snapshot">${t.at}: <time datetime="${attr(report.snapshotAt)}">${esc(time(report.snapshotAt, lang))}</time></p>
      <h2>${t.records}</h2><div class="manager-grid">${report.specialists.map(s => `<article class="panel manager-specialist"><span class="badge ${s.state === 'recent_record' ? 'badge-neutral' : 'badge-pending'}">${s.state === 'recent_record' ? t.recent : t.review}</span><h3>${esc(s.name)}</h3><p>${esc(s.message)}</p><p class="manager-reference">${t.reference}: ${esc(time(s.referenceAt, lang))}</p><a class="button button-secondary" href="#${routes[s.id]}">${t.work}</a></article>`).join('') || `<p>${t.empty}</p>`}</div>
      <section class="panel manager-report" aria-labelledby="manager-report-heading"><h2 id="manager-report-heading">${t.report}</h2><pre id="manager-report-text">${esc(report.text)}</pre></section>` : `<p class="notice notice-error" role="alert">${t.error}</p>`}
    </section>`;
  }
  root.addEventListener('change', event => {
    if (event.target.id !== 'manager-language' || !isFullAdmin() || state.view !== 'manager') return;
    language = event.target.value === 'fa' ? 'fa' : 'en';
    window.adminFreshness?.clearDirty();
    void renderView();
  });
  root.addEventListener('click', event => {
    if (event.target.closest?.('[data-manager-refresh]') && state.view === 'manager' && isFullAdmin()) void renderView();
  });
  window.AIManager = { render };
})();
