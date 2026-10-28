import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

function makeNode() {
  const listeners = new Map();
  return {
    innerHTML: '', textContent: '', value: 'all', disabled: false, open: false,
    dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, callback) { listeners.set(type, callback); },
    click() { listeners.get('click')?.({ target: this }); },
    dispatch(type, event = {}) { listeners.get(type)?.(event); },
    setAttribute() {}, appendChild() {}, replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
    querySelector() { return makeNode(); }, querySelectorAll() { return []; },
    matches() { return false; }, close() { this.open = false; }, showModal() { this.open = true; }
  };
}

function setup(view = 'support', snapshot = {}) {
  const calls = [];
  let mounted = false, observer;
  const result = makeNode(), status = makeNode(), runButton = makeNode();
  const workerFilter = makeNode(), ownershipFilter = makeNode(), filters = makeNode();
  const panelNodes = new Map([
    ['[data-workers-result]', result], ['[data-worker-status]', status],
    ['[data-worker-filter]', workerFilter], ['[data-worker-ownership]', ownershipFilter],
    ['.worker-filters', filters], ['[data-workers-run]', runButton]
  ]);
  const panel = makeNode();
  panel.querySelector = selector => panelNodes.get(selector) || makeNode();
  const root = {
    querySelector: selector => selector === '#rule-worker-dashboard' && mounted ? panel : null,
    appendChild() { mounted = true; }, contains: () => true
  };
  const modal = makeNode();
  const closeButton = makeNode(), dialogBody = makeNode();
  modal.querySelector = selector => selector === '[data-worker-close]' ? closeButton : dialogBody;
  const document = {
    hidden: false, activeElement: makeNode(), body: { appendChild() {} },
    createElement: tag => tag === 'dialog' ? modal : panel,
    getElementById: () => makeNode(), querySelector: () => null
  };
  const context = {
    root, state: { view, token: 'test-token' }, document, navigator: { onLine: true }, window: {},
    isFullAdmin: () => true,
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    attr: value => String(value), title: value => String(value ?? ''), number: value => String(value ?? 0),
    afghanDate: value => String(value), setInterval: () => 1, clearInterval() {}, toast() {},
    query: async path => {
      calls.push(path);
      return {
        enabled: true, lastSuccessAt: new Date().toISOString(), snapshotAt: new Date().toISOString(),
        counts: {}, summary: {}, findings: [], runs: [], recentlyCleared: [], owners: [],
        offset: 0, totalMatching: 0, showingAtMost: 300, ...snapshot
      };
    },
    mutate: async path => { calls.push(path); return { skipped: false }; }
  };
  const source = readFileSync(new URL('../admin-control-center/assets/rule-workers.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);
  return { calls, result, status, runButton, observer: () => observer(), mounted: () => mounted };
}

test('dashboard loads one snapshot and manual checks refresh it', async () => {
  const ui = setup();
  await setImmediate();
  assert.match(ui.status.textContent, /Checks current/);
  ui.observer();
  assert.deepEqual(ui.calls, ['ruleWorkers.snapshot']);
  ui.runButton.click();
  await setImmediate();
  assert.deepEqual(ui.calls, ['ruleWorkers.snapshot', 'ruleWorkers.runNow', 'ruleWorkers.snapshot']);
});

test('unrelated screens do not mount or fetch worker data', async () => {
  const ui = setup('finance');
  await setImmediate();
  assert.equal(ui.mounted(), false);
  assert.deepEqual(ui.calls, []);
});

test('stale snapshots are labeled and findings are escaped', async () => {
  const ui = setup('overview', {
    lastSuccessAt: '2000-01-01T00:00:00Z',
    findings: [{ worker: 'support', entity_type: 'support_case', title: '<script>', detail: '<img>', reference: 'AES-1' }]
  });
  await setImmediate();
  assert.match(ui.status.textContent, /Awaiting a fresh successful check/);
  assert.match(ui.result.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(ui.result.innerHTML, /<script>|<img>/);
});
