'use strict';

// Uses the control centre's authenticated API client and confirmation dialog.
// Financial commands are never run by refresh or page rendering.
const financeState = { data: {}, statement: null, busy: false };
const financeRoutes = {
  settlements: ['merchantFinance.adminOverview', { limit: 150 }],
  cash: ['finance.adminOverview', null],
  pay: ['riderPay.adminOverview', null],
  compensation: ['compensation.adminOverview', { limit: 150 }],
};
function financePanel(heading, body, copy = '') {
  return `<section class="panel space-top"><div class="panel-head"><div><h2>${esc(heading)}</h2>${copy ? `<p>${esc(copy)}</p>` : ''}</div></div><div class="panel-body">${body}</div></section>`;
}
function financeTable(headings, rows) {
  return rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr>${headings.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<p class="empty-state">No records returned.</p>';
}
function financeButton(action, id, label) {
  return `<button class="button button-secondary button-small" type="button" data-finance-action="${attr(action)}" data-id="${attr(id)}">${esc(label)}</button>`;
}
function financeField(name, label, extra = '') {
  return `<label class="field"><span>${esc(label)}</span><input name="${attr(name)}" ${extra}></label>`;
}
function financeForm(kind, id, fields, label) {
  return `<form data-finance-form="${attr(kind)}" data-id="${attr(id)}" class="form-grid">${fields}<button class="button button-primary full" type="submit">${esc(label)}</button></form>`;
}
function financeError(label) {
  return `<p class="notice notice-error">${esc(label)} could not be loaded. Refresh to retry. No balance or total has been assumed.</p>`;
}
async function renderFinanceWorkspace() {
  if (!isFullAdmin()) throw new Error('Finance access requires an administrator account.');
  const results = await Promise.allSettled(Object.entries(financeRoutes).map(async ([key, [route, input]]) => [key, await query(route, input)]));
  financeState.data = {};
  for (const result of results) if (result.status === 'fulfilled') financeState.data[result.value[0]] = result.value[1];
  root[renderTarget()] = '<p class="section-intro">Merchant statements, customer compensation and rider cash records. All amounts are AFN. Recording a payment does not send money.</p>' +
    '<nav class="button-stack" aria-label="Finance sections"><button class="button button-secondary" type="button" data-finance-scroll="finance-statements">Statements</button><button class="button button-secondary" type="button" data-finance-scroll="finance-cash">Rider cash</button><button class="button button-secondary" type="button" data-finance-scroll="finance-compensation">Compensation</button></nav>' +
    '<div id="finance-statement-detail"></div>' +
    `<div id="finance-statements">${renderFinanceStatements(financeState.data.settlements)}</div>` +
    renderRiderPayPolicy(financeState.data.pay, financeState.data.cash) +
    `<div id="finance-cash">${renderFinanceCash(financeState.data.cash)}</div>` +
    `<div id="finance-compensation">${renderFinanceCompensation(financeState.data.compensation)}</div>`;
}
function renderFinanceStatements(data) {
  if (!data) return financePanel('Merchant statements', financeError('Statements'));
  const rows = (data.statements || []).map(s => `<tr><td><strong>${esc(s.reference)}</strong><span class="row-sub">${esc(s.restaurant_name)} · ${esc(String(s.period_start || '—').slice(0, 10))} – ${esc(String(s.period_end || '—').slice(0, 10))}</span></td><td>${money(s.final_payable_amount ?? s.payable_amount)}</td><td>${badge(s.status)} ${s.payout_hold ? badge('payout hold') : ''}<span class="row-sub">${number(s.active_disputes)} active disputes</span></td><td>${financeButton('statement', s.id, 'Review statement')}</td></tr>`);
  const restaurants = (data.restaurants || []).map(r => `<option value="${attr(r.id)}">${esc(r.name)}</option>`).join('');
  return financePanel('Merchant statements', financeTable(['Statement', 'Final payable', 'Status', 'Review'], rows), 'Review order lines and adjustments before approval. Active disputes block payout.') +
    financePanel('Create a settlement draft', financeForm('preview', '', `<label class="field"><span>Restaurant</span><select name="restaurantId" required><option value="">Select restaurant</option>${restaurants}</select></label>${financeField('startDate', 'First financial date (Kabul)', 'type="date" required')}${financeField('endDate', 'Last financial date (Kabul)', 'type="date" required')}`, 'Preview eligible orders'));
}
function renderFinanceCash(data) {
  if (!data) return financePanel('Rider cash', financeError('Cash records'));
  const rows = (data.riders || []).map(r => `<tr><td>${esc(r.full_name)}<span class="row-sub">${badge(r.status)}</span></td><td>${money(r.cash_balance)}</td></tr>`);
  const options = (data.riders || []).map(r => `<option value="${attr(r.id)}">${esc(r.full_name)} · ${money(r.cash_balance)}</option>`).join('');
  const ledger = (data.recentCash || []).map(l => `<tr><td>${esc(l.rider_name)}<span class="row-sub">${afghanDate(l.created_at)}</span></td><td>${esc(l.entry_type)}<span class="row-sub">${esc(l.order_number || '')}</span></td><td>${money(l.amount)}</td><td>${esc(l.reference || '—')}</td></tr>`);
  return financePanel('Rider cash held', financeTable(['Rider', 'Cash balance'], rows), 'Cash collected for Afghan Eats is not rider earnings. Positive balances represent cash held; investigate negative balances.') +
    financePanel('Record cash received', financeForm('deposit', '', `<label class="field"><span>Rider</span><select name="riderId" required><option value="">Select rider</option>${options}</select></label>${financeField('amount', 'Amount received (AFN)', 'type="number" min="0.01" max="10000000" step="0.01" required')}${financeField('reference', 'Receipt / handover reference', 'minlength="2" maxlength="120" required')}${financeField('notes', 'Handover note', 'maxlength="800"')}`, 'Review cash deposit'), 'Record only cash physically received and checked. This writes an audited ledger entry.') +
    financePanel('Recent cash ledger (latest 100)', financeTable(['Rider / time', 'Entry', 'AFN change', 'Reference'], ledger));
}
function renderFinanceCompensation(data) {
  if (!data) return financePanel('Customer compensation', financeError('Compensation'));
  const rows = (data.compensations || []).map(c => `<tr><td><strong>${esc(c.reference)}</strong><span class="row-sub">${esc(c.support_reference)} · ${esc(c.order_number)} · ${esc(c.restaurant_name)}</span><p>${esc(c.reason)}</p></td><td>${money(c.amount)}<span class="row-sub">${esc(c.compensation_type)}</span></td><td>${badge(c.status)}</td><td>${c.status === 'proposed' ? financeButton('approve-compensation', c.id, 'Review approval') + financeButton('reject-compensation', c.id, 'Reject') : c.compensation_type === 'cash_refund' && c.status === 'approved' ? financeForm('cash-refund', c.id, financeField('payoutReference', 'Actual payout reference', 'minlength="2" maxlength="180" required'), 'Review refund paid') : esc(c.fulfillment_reference || '—')}</td></tr>`);
  return financePanel('Customer compensation (latest 150)', financeTable(['Case / reason', 'Amount / type', 'Status', 'Action'], rows), 'Approval may issue credit or a voucher and send a case message. Backend approval limits and second-administrator rules remain enforced.') +
    financePanel('Propose compensation', financeForm('propose', '', `${financeField('caseId', 'Verified support case UUID', 'required') }<label class="field"><span>Compensation type</span><select name="type"><option value="cash_refund">Cash refund</option><option value="account_credit">Account credit</option><option value="voucher">Voucher</option></select></label>${financeField('amount', 'Amount (AFN)', 'type="number" min="0.01" max="1000000" step="0.01" required')}${financeField('reason', 'Verified reason', 'minlength="5" maxlength="3000" required')}${financeField('restaurantPercent', 'Restaurant responsibility (%)', 'type="number" min="0" max="100" step="0.01" value="0" required')}${financeField('riderPercent', 'Rider responsibility (%)', 'type="number" min="0" max="100" step="0.01" value="0" required')}${financeField('platformPercent', 'Platform responsibility (%)', 'type="number" min="0" max="100" step="0.01" value="100" required')}`, 'Review proposal'), 'Use the internal case ID from Customer support. Responsibility must total 100%. A proposal alone does not issue compensation.');
}
async function showFinanceStatement(id) {
  const d = await query('merchantFinance.adminStatement', { settlementId: id });
  if (state.view !== 'finance') return;
  financeState.statement = d;
  const s = d.statement;
  const actions = s.status === 'draft' && !s.payout_hold ? financeButton('approve-statement', id, 'Review approval') : '';
  const lines = (d.orderLines || []).map(l => `<tr><td>${esc(l.order_number)}</td><td>${money(l.food_subtotal)}</td><td>${money(l.discount_amount)}</td><td>${money(l.commission_amount)}</td><td>${money(l.payable_contribution)}</td></tr>`);
  const adjustments = (d.adjustments || []).map(a => `<tr><td>${esc(a.description)}</td><td>${esc(a.reference || '—')}</td><td>${money(a.amount)}</td></tr>`);
  const disputes = (d.disputes || []).map(x => `<article class="safety-card"><strong>${esc(x.category)}</strong> ${badge(x.status)}<p>${esc(x.message)}</p>${['open', 'reviewing'].includes(x.status) ? financeForm('dispute', x.id, '<label class="field"><span>Decision</span><select name="decision"><option value="resolved">Resolve</option><option value="rejected">Reject</option></select></label>' + financeField('resolutionNote', 'Resolution reason', 'minlength="3" maxlength="3000" required') + financeField('creditAmount', 'Merchant credit (AFN)', 'type="number" min="0" max="10000000" step="0.01" value="0" required'), 'Review dispute decision') : esc(x.resolution_note || '')}</article>`).join('');
  document.getElementById('finance-statement-detail').innerHTML = financePanel(`${s.reference} · ${s.restaurant_name}`, `<div class="button-stack">${financeButton('close-statement', '', 'Close detail')}${actions}</div><p>Base ${money(d.totals.basePayable)} · Adjustments ${money(d.totals.adjustmentTotal)} · <strong>Final ${money(d.totals.finalPayable)}</strong> · ${badge(s.status)} ${s.payout_hold ? badge('payout hold') : ''}</p>${financeTable(['Order', 'Food', 'Discount', 'Commission', 'Base contribution'], lines)}<h3>Adjustments</h3>${financeTable(['Reason', 'Reference', 'AFN'], adjustments)}${s.status === 'draft' ? financeForm('adjustment', id, financeField('amount', 'Signed adjustment (AFN)', 'type="number" min="-10000000" max="10000000" step="0.01" required') + financeField('description', 'Adjustment reason', 'minlength="3" maxlength="1500" required'), 'Review adjustment') : ''}${s.status === 'approved' && !s.payout_hold ? financeForm('paid', id, financeField('paymentReference', 'Actual payment reference', 'minlength="2" maxlength="160" required'), 'Review payment record') : ''}<h3>Disputes</h3>${disputes || '<p>No disputes recorded.</p>'}`);
  document.getElementById('finance-statement-detail').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
async function renderSafetyWorkspace() {
  if (!isFullAdmin()) throw new Error('Food safety access requires an administrator account.');
  const data = await query('foodSafety.adminCompleteness', null);
  const rows = (data.restaurants || []).map(r => `<tr><td>${esc(r.name)} ${badge(r.status)}</td><td>${number(r.item_declared)} / ${number(r.item_total)}</td><td>${number(r.option_declared)} / ${number(r.option_total)}</td><td>${number(r.cross_contact_items)}</td></tr>`);
  root[renderTarget()] = '<p class="section-intro">Declarations are provided by restaurants. Missing information must never be interpreted as allergen-free.</p>' + financePanel('Declaration coverage', financeTable(['Restaurant', 'Declared dishes', 'Declared options', 'Cross-contact flagged dishes'], rows), 'Contact the restaurant to correct missing or inaccurate declarations. Coverage alone is not a safety certification.');
}
function financeConfirm(label, copy, route, input, after) {
  if (financeState.busy) return;
  openConfirm(label, copy, async () => {
    if (financeState.busy) return;
    financeState.busy = true;
    root.querySelectorAll('[data-finance-action], [data-finance-form] button').forEach(b => b.disabled = true);
    try {
      await mutate(route, input);
      window.adminFreshness?.clearDirty();
      toast('Financial record saved.');
      await renderView();
      if (after && state.view === 'finance') await after();
    } catch (error) {
      // Never automatically retry a financial command with an uncertain outcome.
      setNotice(`${error.message || 'The result could not be confirmed.'} Refresh and verify the ledger before retrying.`);
    } finally {
      financeState.busy = false;
      root.querySelectorAll('[data-finance-action], [data-finance-form] button').forEach(b => b.disabled = false);
    }
  });
}
root.addEventListener('click', async event => {
  const section = event.target.closest('[data-finance-scroll]');
  if (section) document.getElementById(section.dataset.financeScroll)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const button = event.target.closest('[data-finance-action]');
  if (!button || state.view !== 'finance' || !isFullAdmin() || financeState.busy) return;
  const { financeAction: action, id } = button.dataset;
  button.disabled = true;
  try {
    if (action === 'statement') await showFinanceStatement(id);
    if (action === 'close-statement') { financeState.statement = null; document.getElementById('finance-statement-detail').innerHTML = ''; }
    if (action === 'approve-statement') {
      const s = financeState.statement?.statement;
      if (!s || s.id !== id) throw new Error('Reopen the statement before approval.');
      financeConfirm('Approve merchant statement', `Approve ${s.reference} for ${money(financeState.statement.totals.finalPayable)}? Confirm the order lines, adjustments and dispute status first.`, 'merchantFinance.adminApprove', { settlementId: id });
    }
    if (action === 'approve-compensation') {
      const c = financeState.data.compensation?.compensations?.find(c => c.id === id);
      if (!c) throw new Error('Refresh the compensation record first.');
      financeConfirm('Approve customer compensation', `Approve ${money(c.amount)} as ${c.compensation_type} for ${c.reference}? This can issue credit or a voucher and notify the customer.`, 'compensation.adminApprove', { id });
    }
    if (action === 'reject-compensation') {
      const reason = window.prompt('Record the reason for rejecting this proposal:');
      if (reason?.trim().length >= 3) financeConfirm('Reject compensation proposal', reason.trim(), 'compensation.adminReject', { id, reason: reason.trim() });
    }
  } catch (error) { setNotice(error.message || 'Could not open this financial record.'); }
  finally { button.disabled = false; }
});
root.addEventListener('submit', async event => {
  const form = event.target.closest('[data-finance-form]');
  if (!form) return;
  event.preventDefault();
  if (state.view !== 'finance' || !isFullAdmin() || financeState.busy || !form.reportValidity()) return;
  const d = new FormData(form), kind = form.dataset.financeForm, id = form.dataset.id;
  const text = name => String(d.get(name) || '').trim();
  const numeric = name => { const n = Number(text(name)); if (!Number.isFinite(n)) throw new Error('Enter a valid amount.'); return n; };
  try {
    if (kind === 'pay-policy') {
      const optionalAmount = name => text(name) ? numeric(name) : null;
      form.dataset.policyRequestKey ||= crypto.randomUUID();
      const input = { riderId: text('riderId') || null, model: text('model'), status: text('status'), monthlySalaryAfn: optionalAmount('monthlySalaryAfn'), deliveryFeeAfn: optionalAmount('deliveryFeeAfn'), tipsPolicy: text('tipsPolicy'), effectiveFrom: text('effectiveFrom'), reason: text('reason'), requestKey: form.dataset.policyRequestKey };
      financeConfirm(input.status === 'active' ? 'Activate rider pay policy' : 'Save draft rider pay policy', `${input.model.replaceAll('_',' ')} from ${input.effectiveFrom}. Monthly salary: ${input.monthlySalaryAfn == null ? 'unconfigured' : money(input.monthlySalaryAfn)}; fee per delivery: ${input.deliveryFeeAfn == null ? 'unconfigured' : money(input.deliveryFeeAfn)}. This records the agreed policy; it does not pay wages or calculate payroll.`, 'riderPay.adminSavePolicy', input);
    }
    if (kind === 'preview') {
      const input = { restaurantId: text('restaurantId'), startDate: text('startDate'), endDate: text('endDate') };
      if (input.endDate < input.startDate) throw new Error('The last date must not be before the first date.');
      const preview = await query('finance.adminSettlementPreview', input);
      if (state.view !== 'finance' || !form.isConnected) return;
      financeConfirm('Create settlement draft', `Create a draft for ${preview.restaurant?.name || 'this restaurant'} covering ${input.startDate} to ${input.endDate}: ${number(preview.totals.orderCount)} eligible orders, base payable ${money(preview.totals.payableAmount)}? The server recalculates eligible orders at creation.`, 'finance.adminCreateSettlement', input);
    }
    if (kind === 'deposit') financeConfirm('Record received rider cash', `Record receipt ${text('reference')} for ${money(numeric('amount'))}? Confirm you physically received this cash.`, 'finance.adminRecordRiderDeposit', { riderId: text('riderId'), amount: numeric('amount'), reference: text('reference'), notes: text('notes') || undefined });
    if (kind === 'adjustment') financeConfirm('Add statement adjustment', `Apply ${money(numeric('amount'))}: ${text('description')}? This changes the final payable amount.`, 'merchantFinance.adminAddAdjustment', { settlementId: id, amount: numeric('amount'), description: text('description') });
    if (kind === 'paid') financeConfirm('Record completed merchant payment', `Record this statement as paid using ${text('paymentReference')}? This does not transfer money; confirm payment has already completed.`, 'merchantFinance.adminMarkPaid', { settlementId: id, paymentReference: text('paymentReference') });
    if (kind === 'cash-refund') financeConfirm('Record completed customer refund', `Confirm cash was already returned to the customer. Payout reference: ${text('payoutReference')}.`, 'compensation.adminRecordCashRefund', { id, payoutReference: text('payoutReference') });
    if (kind === 'dispute') {
      if (text('decision') === 'rejected' && numeric('creditAmount') !== 0) throw new Error('A rejected dispute cannot receive credit.');
      financeConfirm('Resolve merchant dispute', `${text('decision')}: ${text('resolutionNote')}. Merchant credit: ${money(numeric('creditAmount'))}.`, 'merchantFinance.adminResolveDispute', { disputeId: id, decision: text('decision'), resolutionNote: text('resolutionNote'), creditAmount: numeric('creditAmount') });
    }
    if (kind === 'propose') {
      const input = { caseId: text('caseId'), type: text('type'), amount: numeric('amount'), reason: text('reason'), restaurantPercent: numeric('restaurantPercent'), riderPercent: numeric('riderPercent'), platformPercent: numeric('platformPercent') };
      if (Math.abs(input.restaurantPercent + input.riderPercent + input.platformPercent - 100) > 0.01) throw new Error('Responsibility must total 100%.');
      // Keep this key on the same form across retries to avoid duplicate proposals.
      form.dataset.proposalKey ||= crypto.randomUUID();
      input.proposalKey = form.dataset.proposalKey;
      financeConfirm('Create compensation proposal', `Propose ${money(input.amount)} as ${input.type} for case ${input.caseId}? Reason: ${input.reason}. Approval is a separate action.`, 'compensation.adminPropose', input);
    }
  } catch (error) { setNotice(error.message || 'Could not prepare the financial action.'); }
});

function renderRiderPayPolicy(data, cash) {
  if (!data) return financePanel('Rider pay policy', financeError('Pay policies'));
  const riders = (cash?.riders || []).map(r => `<option value="${attr(r.id)}">${esc(r.full_name)}</option>`).join('');
  const rows = (data.policies || []).map(p => `<tr><td>${esc(p.rider_name || 'Default for riders without an override')}<span class="row-sub">${esc(p.effective_from)}</span></td><td>${esc(p.model.replaceAll('_',' '))}<span class="row-sub">Salary ${p.monthly_salary_afn == null ? 'unconfigured' : money(p.monthly_salary_afn)} / month · Delivery ${p.delivery_fee_afn == null ? 'unconfigured' : money(p.delivery_fee_afn)}</span></td><td>${badge(p.status)}<span class="row-sub">${esc(p.tips_policy.replaceAll('_',' '))}</span></td><td>${esc(p.reason)}</td></tr>`);
  return financePanel('Rider pay policy', '<p>Start with fixed monthly salary. Switch to a delivery fee or combine both when agreed. Rider-specific policies override the default. Future policies take effect on the chosen Kabul business date. Cash held stays separate.</p>' + financeForm('pay-policy', '', `<label class="field"><span>Apply to</span><select name="riderId"><option value="">Default policy</option>${riders}</select></label><label class="field"><span>Payment model</span><select name="model"><option value="fixed_salary" selected>Fixed monthly salary</option><option value="per_delivery">Fee per completed delivery</option><option value="hybrid">Salary + delivery fee</option></select></label>${financeField('monthlySalaryAfn', 'Agreed monthly salary (AFN)', 'type="number" min="0.01" max="10000000" step="0.01"')}${financeField('deliveryFeeAfn', 'Agreed fee per completed delivery (AFN)', 'type="number" min="0.01" max="10000000" step="0.01" disabled')}<label class="field"><span>Tips policy</span><select name="tipsPolicy"><option value="unconfigured">Not yet agreed</option><option value="rider_keeps_all">Rider keeps all tips</option></select></label><label class="field"><span>Save as</span><select name="status"><option value="draft">Draft (does not apply)</option><option value="active">Active from effective date</option></select></label>${financeField('effectiveFrom', 'Effective date (Kabul)', `type="date" min="${attr(data.today)}" required`)}${financeField('reason', 'Agreement / reason for change', 'minlength="5" maxlength="1500" required')}`, 'Review pay policy') + '<p class="row-sub">Rates are not guessed. Active policies need the applicable agreed amounts. Payroll, attendance, salary proration and wage payments are not calculated by this policy register.</p>' + financeTable(['Scope / effective date','Model / agreed rates','Status / tips','Agreement'], rows), 'Policy history is preserved; existing cash or payment records are never rewritten.');
}

root.addEventListener('change', event => {
  const select = event.target.closest('[data-finance-form="pay-policy"] select[name="model"]');
  if (!select) return;
  const form = select.form;
  form.elements.monthlySalaryAfn.disabled = select.value === 'per_delivery';
  form.elements.deliveryFeeAfn.disabled = select.value === 'fixed_salary';
});
