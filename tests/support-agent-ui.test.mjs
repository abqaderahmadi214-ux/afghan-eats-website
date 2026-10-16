import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function setup(mutate) {
  let open, submit, generate, confirm;
  const body = { value: '', focus() {} };
  const language = { value: 'fa' };
  const draftButton = {}, sendButton = {}, status = {};
  draftButton.addEventListener = (_, fn) => { generate = fn; };
  const form = { elements: { namedItem: name => name === 'body' ? body : language }, querySelector: selector => selector === '[data-draft-reply]' ? draftButton : selector === '[type="submit"]' ? sendButton : status, addEventListener: (_, fn) => { submit = fn; } };
  const panel = { querySelector: () => form, remove() {} };
  const root = { addEventListener: (_, fn) => { open = fn; }, contains: () => true, querySelector: () => null, appendChild() {} };
  const ctx = { root, query: async () => ({ case: { id: 'case-1', reference: 'AES-123', status: 'new', category: 'late_order' }, messages: [] }), mutate, esc: String, shortDate: String, document: { createElement: () => panel }, window: { confirm: () => true }, openConfirm: (_title, _copy, fn) => { confirm = fn; }, toast() {}, setNotice: message => { throw Error(message); } };
  vm.runInNewContext(readFileSync(new URL('../admin-control-center/assets/support-agent.js', import.meta.url), 'utf8'), ctx);
  return { body, status, draftButton, sendButton, open: () => open({ target: { closest: () => ({ dataset: { supportConversation: 'case-1' } }) } }), generate: () => generate(), submit: () => submit({ preventDefault() {} }), confirm: () => confirm() };
}

test('drafting does not send; edited reply sends only after staff confirmation', async () => {
  const calls = [];
  const ui = setup(async (path, input) => { calls.push({ path, input }); return { body: '<b>Draft text</b>', requiresHumanReview: true }; });
  await ui.open(); await ui.generate();
  assert.equal(ui.body.value, '<b>Draft text</b>');
  assert.deepEqual(calls.map(c => c.path), ['ruleWorkers.supportDraft']);
  ui.body.value = 'Staff checked and edited this reply.';
  ui.submit();
  assert.equal(calls.length, 1);
  await ui.confirm();
  assert.equal(calls[1].path, 'support.adminReply');
  assert.equal(calls[1].input.body, ui.body.value);
});

test('provider failure keeps manual text and re-enables sending', async () => {
  const ui = setup(async () => { throw Error('unavailable'); });
  await ui.open(); ui.body.value = 'Manual reply'; await ui.generate();
  assert.equal(ui.body.value, 'Manual reply');
  assert.equal(ui.sendButton.disabled, false);
  assert.match(ui.status.textContent, /manual reply/);
});

test('a slow draft never overwrites edits made while it was generating', async () => {
  let complete;
  const ui = setup(() => new Promise(resolve => { complete = resolve; }));
  await ui.open(); const pending = ui.generate();
  ui.body.value = 'New staff edit'; complete({ body: 'Old AI draft' }); await pending;
  assert.equal(ui.body.value, 'New staff edit');
  assert.equal(ui.draftButton.disabled, false);
});

