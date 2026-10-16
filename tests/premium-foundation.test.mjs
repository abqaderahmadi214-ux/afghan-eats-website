import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { canRefresh, createFreshness } = require('../admin-control-center/assets/freshness.js');
const ready = { token: 'session', hidden: false, online: true, busy: false, dirty: false, editing: false, dialogOpen: false, view: 'dispatch' };
test('refresh never interrupts edits, confirmation or a request, and stays off private/non-live views', () => {
  assert.equal(canRefresh(ready), true);
  for (const patch of [{ token: '' }, { hidden: true }, { online: false }, { busy: true }, { dirty: true }, { editing: true }, { dialogOpen: true }, { view: 'finance' }]) assert.equal(canRefresh({ ...ready, ...patch }), false);
});
test('partial refresh does not claim current data; drafts survive polling; recovery refreshes', () => {
  const target = { dataset: {} }, events = {};
  let tick, updates = 0;
  const doc = { hidden: false, activeElement: null, getElementById: () => target, querySelector: () => null, addEventListener: (name, fn) => events[name] = fn };
  const fresh = createFreshness({ document: doc, navigator: { onLine: true }, getState: () => ready, refresh: () => updates++, now: () => 1000, setTimer: fn => tick = fn });
  fresh.begin(); fresh.failed(); fresh.end(true);
  assert.equal(target.dataset.freshness, 'error');
  fresh.begin(); fresh.end(true);
  assert.equal(target.dataset.freshness, 'current');
  events.input({ target: { closest: () => true } }); tick();
  assert.equal(updates, 0);
  assert.equal(fresh.isDirty(), true);
  fresh.clearDirty(); tick(); assert.equal(updates, 1);
  fresh.reset(); assert.equal(target.dataset.freshness, 'stale');
});
test('clean and html routes load identical capability modules', () => {
  const code = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  function modules(pathname) {
    const out = [];
    const context = { window: {}, location: { pathname }, localStorage: { getItem: () => null }, document: { documentElement: { dataset: {} }, querySelector: () => null, createElement: () => ({ dataset: {} }), head: { appendChild: s => out.push(s.src) }, addEventListener() {} } };
    vm.runInNewContext(code, context);
    return out;
  }
  for (const route of ['restaurants', 'restaurant', 'checkout', 'owner', 'rider-portal', 'help', 'account']) {
    assert.deepEqual(modules(`/${route}`), modules(`/${route}.html`));
    assert.deepEqual(modules(`/${route}/`), modules(`/${route}.html`));
  }
});
const financeCode = readFileSync(new URL('../admin-control-center/assets/finance-workspace.js', import.meta.url), 'utf8');
function financeContext(data = {}) {
  const calls = [], commands = [], handlers = {}, root = { innerHTML: '', addEventListener: (event, fn) => handlers[event] = fn, querySelectorAll: () => [] };
  const esc = v => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const context = vm.createContext({ root, renderTarget: () => 'innerHTML', state: { view: 'finance' }, isFullAdmin: () => true, query: async (route, input) => { calls.push([route, input]); if (data[route] instanceof Error) throw data[route]; return data[route] || {}; }, mutate: (...args) => commands.push(args), openConfirm() {}, esc, attr: esc, money: v => `AFN ${v}`, number: v => String(v || 0), badge: esc, afghanDate: esc, window: {}, document: { getElementById: () => ({ innerHTML: '', scrollIntoView() {} }) } });
  vm.runInContext(financeCode, context);
  return { context, root, calls, commands, handlers };
}
test('finance rendering uses existing query contracts, escapes records, and never mutates', async () => {
  const f = financeContext({ 'merchantFinance.adminOverview': { statements: [{ id: 's1', reference: '<img onerror=alert(1)>', restaurant_name: 'Restaurant', status: 'draft', payout_hold: true }] } });
  await vm.runInContext('renderFinanceWorkspace()', f.context);
  assert.equal(f.calls.length, 4); assert.equal(f.commands.length, 0);
  assert.match(f.root.innerHTML, /&lt;img/); assert.doesNotMatch(f.root.innerHTML, /<img/);
  assert.match(f.root.innerHTML, /not rider earnings/);
});
test('a finance source failure is explicit and never renders an invented zero balance', async () => {
  const f = financeContext({ 'finance.adminOverview': new Error('unavailable') });
  await vm.runInContext('renderFinanceWorkspace()', f.context);
  assert.match(f.root.innerHTML, /Cash records could not be loaded/);
  assert.doesNotMatch(f.root.innerHTML, /data-finance-form="deposit"/);
});
test('restricted staff cannot query finance or safety', async () => {
  const f = financeContext(); f.context.isFullAdmin = () => false;
  await assert.rejects(vm.runInContext('renderFinanceWorkspace()', f.context), /administrator/);
  await assert.rejects(vm.runInContext('renderSafetyWorkspace()', f.context), /administrator/);
  assert.equal(f.calls.length, 0);
});
test('held statements never offer approval or payment actions', async () => {
  const f = financeContext({ 'merchantFinance.adminStatement': { statement: { id: 's1', status: 'approved', payout_hold: true }, totals: {} } });
  let html;
  f.context.document.getElementById = () => ({ set innerHTML(v) { html = v; }, scrollIntoView() {} });
  await vm.runInContext('showFinanceStatement("s1")', f.context);
  assert.doesNotMatch(html, /data-finance-form="paid"|approve-statement/);
});
