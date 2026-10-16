'use strict';

window.WorkerQueue = (() => {
  const filters = { worker: 'all', ownership: 'all', offset: 0, limit: 50 };
  let modalState = null;
  const modal = document.createElement('dialog');
  modal.id = 'worker-queue-dialog'; modal.className = 'confirm-dialog worker-queue-dialog';
  modal.setAttribute('aria-labelledby', 'worker-dialog-title');
  modal.innerHTML = '<div class="panel-head"><h2 id="worker-dialog-title">Worker flag</h2><button type="button" class="button button-secondary button-small" data-worker-close>Close</button></div><div class="panel-body" data-worker-dialog-body></div>';
  document.body.appendChild(modal);
  const body = modal.querySelector('[data-worker-dialog-body]');
  const label = value => value == null ? '—' : number(value);
  const workerBadge = value => `<span class="badge ${['high','failure'].includes(value) ? 'badge-suspended' : value === 'success' ? 'badge-active' : 'badge-neutral'}">${esc(title(value))}</span>`;
  const active = panel => Boolean(state.token && isFullAdmin() && root.contains(panel));
  function reset() {
    modalState = null; if (modal.open) modal.close(); body.replaceChildren();
    filters.worker = 'all'; filters.ownership = 'all'; filters.offset = 0;
  }
  function closeModal() { if (modalState?.busy) return; modalState = null; modal.close(); body.replaceChildren(); }
  modal.querySelector('[data-worker-close]').addEventListener('click', closeModal);
  modal.addEventListener('cancel', event => { if (modalState?.busy) event.preventDefault(); });
  modal.addEventListener('close', () => { if (modal.open) return; modalState = null; body.replaceChildren(); });
  function reviewLink(item) {
    return item.worker === 'orders' ? '#dispatch' : item.worker === 'support' ? '#support' : item.entity_type === 'rider_application' ? '#riders' : '#restaurants';
  }
  function renderFindings(data) {
    if (!data.findings?.length) return `<div class="empty-state">${!data.lastSuccessAt ? 'No successful check recorded yet. The current queue is unknown.' : data.totalMatching ? 'This page changed. Use Previous or refresh the queue.' : 'No flags match these filters in the last successful check.'}</div>`;
    return `<div class="worker-issue-list">${data.findings.map(item => `<article class="worker-issue"><div><strong>${esc(item.title)}</strong> ${workerBadge(item.severity)}<p>${esc(item.reference)} · ${esc(item.worker)} · ${esc(String(item.rule || '').replaceAll('_', ' '))}</p><p>${esc(item.detail)}</p><p><b>Owner:</b> ${item.owner_admin_id ? `${esc(item.owner_username || 'Administrator')}${(item.owner_eligible === false || item.owner_active === false) ? ' · access unavailable; handoff needed' : ''}` : 'Unassigned'}${item.first_seen_at ? ` · Detected ${esc(afghanDate(item.first_seen_at))} Kabul` : ''}</p></div><div class="button-stack"><a class="button button-secondary button-small" href="${reviewLink(item)}">Review record</a>${item.issue_id ? `<button type="button" class="button button-primary button-small" data-worker-manage="${attr(item.issue_id)}">${item.owner_admin_id ? 'Manage flag' : 'Take ownership'}</button><button type="button" class="button button-secondary button-small" data-worker-history="${attr(item.issue_id)}">History</button>` : '<small>Ownership will be available after a successful worker check.</small>'}</div></article>`).join('')}</div>`;
  }
  function renderRuns(runs) {
    if (!runs?.length) return '<p>No run history recorded yet.</p>';
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Check finished (Kabul)</th><th>Result</th><th>Flags</th><th>Duration</th></tr></thead><tbody>${runs.map(run => `<tr><td>${esc(afghanDate(run.finished_at))}</td><td>${workerBadge(run.status)}${run.status !== 'success' ? `<span class="row-sub">${esc(String(run.stage || '').replaceAll('_', ' '))}${run.error_code ? ` · code ${esc(run.error_code)}` : ''}</span>` : ''}</td><td>${run.finding_count == null ? '—' : label(run.finding_count)}</td><td>${Number.isFinite(Number(run.duration_ms)) ? `${(Number(run.duration_ms) / 1000).toFixed(1)}s` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function openManage(item, owners, reload) {
    const session = { token: state.token, item, reload, busy: false, retry: null };
    modalState = session;
    document.getElementById('worker-dialog-title').textContent = `Manage ${item.reference}`;
    body.innerHTML = `<p>${esc(item.title)}</p><p>Taking ownership records who will follow up. It does not resolve the flag or change an order, support case or application.</p><form id="worker-triage-form" class="form-grid"><label class="field full"><span>Action</span><select name="action">${!item.owner_admin_id ? '<option value="claim">Take ownership myself</option>' : ''}<option value="note">Add progress note</option><option value="assign">Assign / hand off</option>${item.owner_admin_id ? '<option value="release">Return to unassigned</option>' : ''}</select></label><label class="field full" data-worker-owner-field><span>New owner</span><select name="ownerAdminId"><option value="">Choose an administrator</option>${owners.map(owner => `<option value="${attr(owner.id)}">${esc(owner.username)}</option>`).join('')}</select><small>Only active full administrators can access this queue.</small></label><label class="field full"><span>Progress or handoff note</span><textarea name="note" rows="4" maxlength="1000" placeholder="Next action, contact attempt or handoff reason. Keep passwords, codes and payment details out of notes."></textarea></label><p class="notice notice-error full hidden" data-worker-error role="alert"></p><button type="submit" class="button button-primary full">Save queue update</button></form>`;
    const form = body.querySelector('form');
    function setFields() { const assign = form.elements.action.value === 'assign'; form.querySelector('[data-worker-owner-field]').classList.toggle('hidden', !assign); form.elements.ownerAdminId.disabled = !assign; form.elements.ownerAdminId.required = assign; form.elements.note.required = form.elements.action.value !== 'claim'; form.elements.note.minLength = form.elements.note.required ? 3 : 0; }
    form.elements.action.addEventListener('change', setFields); setFields();
    modal.showModal(); form.elements.action.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (session.busy || modalState !== session) return;
      const action = form.elements.action.value, note = form.elements.note.value.trim();
      const input = { issueId: item.issue_id, expectedRevision: item.revision, action, note };
      if (action === 'assign') input.ownerAdminId = Number(form.elements.ownerAdminId.value);
      const signature = JSON.stringify(input);
      if (!session.retry || session.retry.signature !== signature) session.retry = { signature, key: crypto.randomUUID() };
      session.busy = true; form.querySelector('button[type="submit"]').disabled = true;
      const error = form.querySelector('[data-worker-error]'); error.classList.add('hidden');
      try {
        await mutate('ruleWorkers.triage', { ...input, requestKey: session.retry.key });
        if (modalState !== session || state.token !== session.token) return;
        session.busy = false; closeModal(); toast('Queue update saved. The underlying flag remains monitored.'); await reload();
      } catch (failure) {
        if (modalState !== session || state.token !== session.token) return;
        error.textContent = `${failure.message || 'Update could not be confirmed.'} An unchanged retry uses the same request key. If another update changed the flag, close this dialog and refresh the queue.`;
        error.classList.remove('hidden');
      } finally {
        if (modalState === session) { session.busy = false; form.querySelector('button[type="submit"]').disabled = false; }
      }
    });
  }
  async function openHistory(item) {
    const session = { token: state.token, busy: false }; modalState = session;
    document.getElementById('worker-dialog-title').textContent = `History · ${item.reference}`;
    body.textContent = 'Loading history…'; modal.showModal();
    try {
      const data = await query('ruleWorkers.history', { issueId: item.issue_id });
      if (modalState !== session || state.token !== session.token) return;
      const names = { detected: 'Detected by a successful check', cleared: 'Cleared by a successful check', reopened: 'Detected again; ownership reset', claim: 'Ownership taken', assign: 'Handed off', release: 'Returned to unassigned', note: 'Progress note' };
      body.innerHTML = `<p>${esc(data.issue.reference)} · ${data.issue.resolved_at ? 'Cleared in the latest successful check' : 'Still flagged in the latest successful check'}</p><div class="activity-list">${data.events.map(entry => `<div class="worker-history-event"><strong>${esc(names[entry.kind] || entry.kind)}</strong><p>${esc(entry.actor_username || 'Monitoring worker')}${entry.owner_username ? ` → ${esc(entry.owner_username)}` : ''} · ${esc(afghanDate(entry.created_at))} Kabul</p>${entry.note ? `<p class="worker-note">${esc(entry.note)}</p>` : ''}</div>`).join('')}</div>${data.events.length >= data.showingAtMost ? `<p>Showing the latest ${number(data.showingAtMost)} history entries.</p>` : ''}`;
    } catch (error) { if (modalState === session) body.textContent = error.message || 'History could not be loaded.'; }
  }
  function mount() {
    if (!state.token) { reset(); return; }
    if (!isFullAdmin() || !['overview', 'dispatch', 'support', 'ops', 'workers'].includes(state.view) || root.querySelector('#rule-worker-dashboard')) return;
    const panel = document.createElement('section'); panel.id = 'rule-worker-dashboard'; panel.className = 'panel wide space-top-md';
    panel.innerHTML = '<div class="panel-head"><div><h2>Website workers</h2><p>Support · Order monitoring · Onboarding</p><strong data-worker-status role="status">Loading worker status…</strong></div><div class="button-stack"><button type="button" class="button button-secondary" data-workers-refresh>Refresh queue</button><button type="button" class="button button-secondary" data-workers-run>Run checks now</button></div></div><div class="panel-body"><p>Checks run about every 5 minutes while the API service is running. Ownership and notes are staff records; they do not resolve the underlying problem. Prepared replies use fixed templates, with no AI API calls.</p><div class="worker-filters"><label class="field"><span>Worker</span><select data-worker-filter><option value="all">All workers</option><option value="orders">Orders</option><option value="support">Support</option><option value="onboarding">Onboarding</option></select></label><label class="field"><span>Ownership</span><select data-worker-ownership><option value="all">All flags</option><option value="unassigned">Unassigned</option><option value="needs_owner">Needs an eligible owner</option><option value="mine">Mine</option></select></label></div><p data-worker-counts></p><div data-workers-result>Loading queue…</div><div class="button-stack space-top-sm"><button type="button" class="button button-secondary" data-worker-prev>Previous</button><span data-worker-page></span><button type="button" class="button button-secondary" data-worker-next>Next</button></div><details class="space-top-sm"><summary>24-hour order snapshot</summary><p data-worker-cohort></p></details><details class="space-top-sm"><summary>Recently cleared flags</summary><div data-worker-cleared></div><p>Latest 10 cleared flags across all workers. Detection and staff history remain available.</p></details><details class="space-top-sm"><summary>Recent worker checks</summary><div data-worker-runs></div><p>Latest 10 attempts shown; run records are retained for 30 days. A sleeping or unavailable host cannot record a check.</p></details></div>';
    root.appendChild(panel);
    const worker = panel.querySelector('[data-worker-filter]'), ownership = panel.querySelector('[data-worker-ownership]');
    worker.value = filters.worker; ownership.value = filters.ownership;
    // Read-only queue filters are not unsaved operational edits.
    for (const type of ['input','change']) panel.querySelector('.worker-filters').addEventListener(type, event => event.stopPropagation());
    let busy = false, data = null, failed = false, lastAttempt = 0, receivedAt = 0;
    const status = panel.querySelector('[data-worker-status]');
    function paint() {
      if (navigator.onLine === false) { status.textContent = 'Offline · showing the previously loaded queue'; return; }
      if (busy) { status.textContent = 'Updating worker queue…'; return; }
      if (failed) { status.textContent = 'Update unavailable · previous queue retained'; return; }
      if (!data) return;
      const good = data.lastSuccessAt && Number.isFinite(new Date(data.lastSuccessAt).getTime());
      const serverNow = new Date(data.snapshotAt || data.lastSuccessAt).getTime();
      const age = good ? Math.max(0, serverNow - new Date(data.lastSuccessAt).getTime()) + Math.max(0, Date.now() - receivedAt) : Infinity;
      status.textContent = !data.enabled ? 'Workers paused · previous flags retained' : data.runs?.[0]?.status === 'failure' ? 'Latest check failed · previous flags retained' : age > 15 * 60000 ? 'Awaiting a fresh successful check' : 'Checks current';
      if (good) status.textContent += ` · Last success ${afghanDate(data.lastSuccessAt)} Kabul`;
    }
    const allowed = () => active(panel) && !document.hidden && navigator.onLine !== false && !document.querySelector('dialog[open]') && !document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]') && !window.adminFreshness?.isDirty();
    async function load(run = false, background = false) {
      if (busy || !active(panel) || (background && !allowed())) return;
      const token = state.token, selection = JSON.stringify(filters); busy = true; lastAttempt = Date.now();
      panel.querySelectorAll('button,select').forEach(node => node.disabled = true); paint();
      try {
        if (run) await mutate('ruleWorkers.runNow', {});
        const result = await query('ruleWorkers.snapshot', { ...filters });
        if (!active(panel) || token !== state.token || selection !== JSON.stringify(filters) || (background && (document.querySelector('dialog[open]') || window.adminFreshness?.isDirty() || document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')))) return;
        data = result; failed = false; receivedAt = Date.now();
        panel.querySelector('[data-workers-result]').innerHTML = renderFindings(data);
        panel.querySelector('[data-worker-counts]').textContent = `All flags: ${label(data.counts?.total)} · Unassigned: ${label(data.counts?.unassigned)} · Mine: ${label(data.counts?.mine)} · Needs eligible owner: ${label(data.counts?.needs_owner)}`;
        panel.querySelector('[data-worker-page]').textContent = `${data.totalMatching ? number(data.offset + 1) : '0'}–${number(Math.min(data.offset + data.findings.length, data.totalMatching || 0))} of ${label(data.totalMatching)} matching flags`;
        panel.querySelector('[data-worker-runs]').innerHTML = renderRuns(data.runs);
        const summary = data.summary || {};
        panel.querySelector('[data-worker-cohort]').textContent = data.lastSuccessAt ? `Orders created in the 24 hours before the last successful check: ${label(summary.orders_24h)} · Delivered: ${label(summary.delivered_24h)} · Cancelled: ${label(summary.cancelled_24h)} · Value of those delivered orders: AFN ${label(summary.delivered_value_afn_24h)}. Statuses are as recorded at that check.` : 'A successful check is needed before this snapshot is available.';
        panel.querySelector('[data-worker-cleared]').innerHTML = data.recentlyCleared?.length ? data.recentlyCleared.map(item => `<div class="worker-history-event"><strong>${esc(item.reference)} · ${esc(item.title)}</strong><p>Cleared ${esc(afghanDate(item.resolved_at))} Kabul</p><button type="button" class="button button-secondary button-small" data-worker-history="${attr(item.issue_id)}">View cleared history</button></div>`).join('') : '<p>No cleared flags recorded yet.</p>';
        return true;
      } catch (error) {
        if (!active(panel) || token !== state.token) return;
        failed = true;
        if (!data) panel.querySelector('[data-workers-result]').textContent = 'Worker queue could not be loaded. Refresh to retry; existing operational tools remain available.';
        return false;
      } finally {
        busy = false;
        if (active(panel)) { panel.querySelectorAll('button,select').forEach(node => node.disabled = false); panel.querySelector('[data-worker-prev]').disabled = filters.offset === 0; panel.querySelector('[data-worker-next]').disabled = !data || data.offset + data.findings.length >= data.totalMatching; paint(); }
      }
    }
    worker.addEventListener('change', () => { filters.worker = worker.value; filters.offset = 0; void load(); });
    ownership.addEventListener('change', () => { filters.ownership = ownership.value; filters.offset = 0; void load(); });
    panel.querySelector('[data-workers-refresh]').addEventListener('click', () => void load());
    panel.querySelector('[data-workers-run]').addEventListener('click', () => void load(true));
    panel.querySelector('[data-worker-prev]').addEventListener('click', () => { filters.offset = Math.max(0, filters.offset - filters.limit); void load(); });
    panel.querySelector('[data-worker-next]').addEventListener('click', () => { filters.offset += filters.limit; void load(); });
    panel.addEventListener('click', event => {
      const manage = event.target.closest('[data-worker-manage]'), history = event.target.closest('[data-worker-history]');
      const id = manage?.dataset.workerManage || history?.dataset.workerHistory;
      const item = [...(data?.findings || []), ...(data?.recentlyCleared || [])].find(item => item.issue_id === id); if (!item) return;
      if (manage) openManage(item, data.owners || [], () => load()); else if (history) void openHistory(item);
    });
    const interval = setInterval(() => { if (!active(panel)) { clearInterval(interval); return; } paint(); if (Date.now() - lastAttempt >= 60000 && allowed()) void load(false, true); }, 15000);
    return load();
  }
  async function renderPage() {
    root[renderTarget()] = '<p class="section-intro">Review monitored exceptions, record an owner and keep a clear progress or handoff history. Only a successful worker check can clear a flag.</p>';
    if (await mount() === false) window.adminFreshness?.failed();
  }
  new MutationObserver(mount).observe(root, { childList: true });
  mount();
  return { reset, renderPage };
})();
