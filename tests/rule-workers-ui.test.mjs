import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

function setup(view = 'support', snapshot = {}) {
  const calls = [];
  const nodes = new Map();
  let mounted = false, observer;

  const createNode = () => {
    const listeners = new Map();
    return {
      disabled: false,
      value: '',
      innerHTML: '',
      textContent: '',
      addEventListener(type, listener) { listeners.set(type, listener); },
      click() { listeners.get('click')?.({ target: this }); }
    };
  };

  const result = createNode();
  nodes.set('[data-workers-result]', result);
  const panel = {
    id: '',
    className: '',
    innerHTML: '',
    addEventListener() {},
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, createNode());
      return nodes.get(selector);
    },
    querySelectorAll() { return [...nodes.values()]; }
  };
  const root = {
    querySelector: () => mounted ? panel : null,
    appendChild() { mounted = true; },
    contains: () => true
  };
  const modalBody = { replaceChildren() {} };
  const modalClose = { addEventListener() {} };
  const modal = {
    open: false,
    setAttribute() {},
    addEventListener() {},
    querySelector(selector) {
      return selector === '[data-worker-dialog-body]' ? modalBody : modalClose;
    },
    close() { this.open = false; },
    showModal() { this.open = true; }
  };
  const document = {
    body: { appendChild() {} },
    hidden: false,
    activeElement: null,
    createElement: tag => tag === 'dialog' ? modal : panel,
    querySelector: () => null
  };
  const context = {
    root,
    state: { view, token: 'test-admin-session' },
    document,
    navigator: { onLine: true },
    MutationObserver: class {
      constructor(callback) { observer = callback; }
      observe() {}
    },
    isFullAdmin: () => true,
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    attr: value => String(value),
    title: value => String(value),
    number: value => String(value),
    afghanDate: () => 'now',
    setInterval: () => 1,
    clearInterval() {},
    query: async path => {
      calls.push(path);
      return {
        enabled: true,
        lastSuccessAt: new Date().toISOString(),
        snapshotAt: new Date().toISOString(),
        summary: {},
        counts: {},
        offset: 0,
        totalMatching: 0,
        findings: [],
        recentlyCleared: [],
        runs: [],
        showingAtMost: 300,
        ...snapshot
      };
    },
    mutate: async path => { calls.push(path); return { skipped: false }; }
  };
  context.window = context;
  vm.runInNewContext(readFileSync(new URL('../admin-control-center/assets/rule-workers.js', import.meta.url), 'utf8'), context);

  return {
    calls,
    result,
    status: panel.querySelector('[data-worker-status]'),
    button: panel.querySelector('[data-workers-run]'),
    observer: () => observer(),
    mounted: () => mounted
  };
}

test('dashboard loads the internal snapshot once and manual checks refresh it', async () => {
  const ui = setup();
  await setImmediate();
  assert.match(ui.result.innerHTML, /No flags match/);
  ui.observer();
  assert.equal(ui.calls.length, 1);
  ui.button.click();
  await setImmediate();
  assert.deepEqual(ui.calls, ['ruleWorkers.snapshot', 'ruleWorkers.runNow', 'ruleWorkers.snapshot']);
});

test('unrelated screens do not fetch worker data', async () => {
  const ui = setup('finance');
  await setImmediate();
  assert.equal(ui.mounted(), false);
  assert.equal(ui.calls.length, 0);
});

test('stale snapshots are labeled and findings are escaped', async () => {
  const ui = setup('overview', {
    lastSuccessAt: '2000-01-01T00:00:00Z',
    findings: [{ worker: 'support', entity_type: 'support_case', title: '<script>', detail: '<img>', reference: 'AES-1' }]
  });
  await setImmediate();
  assert.match(ui.status.textContent, /Awaiting a fresh successful check/);
  assert.doesNotMatch(ui.result.innerHTML, /<script>|<img>/);
});
