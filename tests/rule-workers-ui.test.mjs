import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

function setup(view = 'support', snapshot = {}) {
  const calls = [], result = {}, button = { addEventListener: (_, fn) => { button.click = fn; } };
  let mounted = false, observer;
  const panel = { querySelector: selector => selector === '[data-workers-result]' ? result : button };
  const root = { querySelector: () => mounted ? panel : null, appendChild() { mounted = true; }, contains: () => true };
  const context = { root, state: { view }, document: { createElement: () => panel }, MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
    esc: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), shortDate: () => 'now',
    query: async path => { calls.push(path); return { enabled: true, lastSuccessAt: new Date().toISOString(), summary: {}, findings: [], showingAtMost: 300, ...snapshot }; },
    mutate: async path => { calls.push(path); return { skipped: false }; } };
  vm.runInNewContext(readFileSync(new URL('../admin-control-center/assets/rule-workers.js', import.meta.url), 'utf8'), context);
  return { calls, button, result, observer: () => observer(), mounted: () => mounted };
}
test('dashboard loads the internal snapshot once and manual checks refresh it', async () => {
  const ui = setup(); await setImmediate();
  assert.match(ui.result.innerHTML, /Active/);
  ui.observer(); assert.equal(ui.calls.length, 1);
  ui.button.click(); await setImmediate();
  assert.deepEqual(ui.calls, ['ruleWorkers.snapshot','ruleWorkers.runNow','ruleWorkers.snapshot']);
});
test('unrelated screens do not fetch worker data', async () => {
  const ui = setup('finance'); await setImmediate(); assert.equal(ui.mounted(), false); assert.equal(ui.calls.length, 0);
});
test('stale snapshots are labeled and findings are escaped', async () => {
  const ui = setup('overview', { lastSuccessAt: '2000-01-01T00:00:00Z', findings: [{ worker: 'support', entity_type: 'support_case', title: '<script>', detail: '<img>', reference: 'AES-1' }] });
  await setImmediate(); assert.match(ui.result.innerHTML, /Awaiting a fresh check/); assert.doesNotMatch(ui.result.innerHTML, /<script>|<img>/);
});
