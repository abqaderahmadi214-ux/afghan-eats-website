import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function setup({ error, lang = 'en' } = {}) {
  const elements = { supportResult: {}, supportStatusResult: {}, supportReference: {} };
  const trackingPhone = {}, button = {}, calls = [];
  const context = { lang, window: {}, document: { getElementById: id => elements[id] || null, querySelector: () => trackingPhone, addEventListener() {} }, localStorage: { setItem() {} }, FormData: class { get(key) { return { orderId: ' ae-20261016-1234 ', phone: ' +93700000000 ', category: 'late_order', details: 'My order is late.' }[key]; } }, trpcMutation: async (path, input) => { calls.push({ path, input }); if (error) throw Error(error); return { reference: 'AES-20261016-ABC123' }; }, trpcQuery: async () => { throw Error(error); } };
  vm.runInNewContext(readFileSync(new URL('../assets/trust.js', import.meta.url), 'utf8'), context);
  const event = { preventDefault() {}, currentTarget: { querySelector: () => button } };
  return { context, elements, trackingPhone, button, calls, event };
}

test('submits trimmed order number and fills support tracking with the new AES reference', async () => {
  const ui = setup(); await ui.context.window.submitSupportCase(ui.event);
  assert.equal(ui.calls[0].input.orderId, 'ae-20261016-1234');
  assert.equal(ui.calls[0].input.phone, '+93700000000');
  assert.equal(ui.elements.supportReference.value, 'AES-20261016-ABC123');
  assert.equal(ui.trackingPhone.value, '+93700000000');
  assert.equal(ui.button.disabled, false);
});

test('raw validation and database errors are never rendered to customers', async () => {
  for (const error of ['[{"code":"invalid_format","format":"uuid","message":"Invalid UUID"}]', 'Database error SELECT * FROM orders']) {
    const ui = setup({ error }); await ui.context.window.submitSupportCase(ui.event);
    assert.match(ui.elements.supportResult.textContent, /Check the form details/);
    assert.doesNotMatch(ui.elements.supportResult.textContent, /uuid|SELECT|invalid_format/);
    assert.equal(ui.button.disabled, false);
  }
});

test('tracking explains that an AES case reference is required', async () => {
  const ui = setup({ error: 'Support case not found or phone verification failed' });
  await ui.context.window.checkSupportCase(ui.event);
  assert.match(ui.elements.supportStatusResult.textContent, /AES-/);
});

test('Dari customers receive translated verification guidance', async () => {
  const ui = setup({ error: 'Order not found or checkout phone verification failed.', lang: 'fa' });
  await ui.context.window.submitSupportCase(ui.event);
  assert.match(ui.elements.supportResult.textContent, /شماره تماس/);
});
