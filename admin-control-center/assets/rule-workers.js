'use strict';

// Mount inside the existing staff workspace; no new login, hosting or paid API.
function mountRuleWorkerDashboard() {
  if (!['overview','support','ops'].includes(state.view) || root.querySelector('#rule-worker-dashboard')) return;
  const panel = document.createElement('section');
  panel.id = 'rule-worker-dashboard'; panel.className = 'panel wide space-top-md';
  panel.innerHTML = '<div class="panel-head"><div><h2>Website workers</h2><p>Support · Order monitoring · Onboarding</p></div><button type="button" class="button button-secondary" data-workers-refresh>Run checks now</button></div><div class="panel-body" data-workers-result>Loading worker status…</div>';
  root.appendChild(panel);
  const result = panel.querySelector('[data-workers-result]');
  const button = panel.querySelector('[data-workers-refresh]');
  const load = async (run = false) => {
    button.disabled = true;
    try {
      if (run) await mutate('ruleWorkers.runNow', {});
      const data = await query('ruleWorkers.snapshot', null);
      if (!root.contains(panel)) return;
      const summary = data.summary || {}, counts = summary.findings || {};
      const last = data.lastSuccessAt ? new Date(data.lastSuccessAt) : null;
      const stale = !last || Date.now() - last.getTime() > 15 * 60000;
      const status = !data.enabled ? 'Paused' : stale ? 'Awaiting a fresh check' : 'Active';
      const links = { support: '#support', orders: '#dispatch', onboarding: '#restaurants' };
      result.innerHTML = `<p><strong>${esc(status)}</strong> · ${last ? `Last successful check: ${esc(shortDate(last))}` : 'First check pending'}</p><p>Runs about every 5 minutes while the API service is running. Prepared replies use fixed templates; no AI API calls.</p><div class="summary-grid"><p><strong>Support:</strong> ${esc(counts.support || 0)} flags</p><p><strong>Orders:</strong> ${esc(counts.orders || 0)} flags</p><p><strong>Onboarding:</strong> ${esc(counts.onboarding || 0)} applications</p></div><p>Last 24 hours: ${esc(summary.orders_24h || 0)} orders · ${esc(summary.delivered_24h || 0)} delivered · ${esc(summary.cancelled_24h || 0)} cancelled · delivered value AFN ${esc(summary.delivered_value_afn_24h || '0')}</p><div class="activity-list">${data.findings.length ? data.findings.map(item => `<div class="activity-row"><div class="flex-one"><strong>${esc(item.title)}</strong><p>${esc(item.reference)} · ${esc(item.worker)}</p><p>${esc(item.detail)}</p></div><a class="button button-secondary button-small" href="${item.entity_type === 'rider_application' ? '#riders' : links[item.worker] || '#overview'}">Review</a></div>`).join('') : '<p>No outstanding flags in the latest snapshot.</p>'}</div>${data.findings.length >= data.showingAtMost ? '<p>Showing the first 300 flags. Review the individual queues for all records.</p>' : ''}`;
    } catch {
      result.textContent = 'Worker status could not be loaded. Try Run checks now; existing staff tools remain available.';
    } finally { button.disabled = false; }
  };
  button.addEventListener('click', () => void load(true));
  void load();
  const refresh = setInterval(() => {
    if (!root.contains(panel)) { clearInterval(refresh); return; }
    if (!document.hidden && navigator.onLine !== false && !button.disabled) void load();
  }, 60000);
}
new MutationObserver(mountRuleWorkerDashboard).observe(root, { childList: true });
mountRuleWorkerDashboard();
