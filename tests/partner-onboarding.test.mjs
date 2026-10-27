import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../assets/partner-onboarding.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../partner-onboarding.html', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

const defaults = {
  restaurantName: '  Saffron House  ',
  ownerName: '  Ahmad Rahimi  ',
  phone: ' +93700000000 ',
  whatsapp: ' +93700000001 ',
  email: ' owner@example.com ',
  district: ' Tank Markaz ',
  address: ' Main road, near the bazaar ',
  cuisine: ' Afghan, kebab ',
  menuItems: ' Kabuli pulao — 250 AFN ',
  menuNotes: ' Family platters ',
  menuUrl: ' https://saffron.example/menu ',
  deliveryZones: ' Tank Markaz, Jebrael ',
  deliveryModel: ' both ',
  payoutMethod: ' cash_settlement ',
  payoutName: ' Ahmad Rahimi ',
  payoutPhone: ' +93700000000 '
};

function trpcResponse(value, ok = true) {
  return { ok, json: async () => value };
}

function setup({ apiBaseUrl = 'https://api.example/', lang = 'en', values = {}, response, fetchError } = {}) {
  const result = { className: '', textContent: '', hidden: true };
  const button = { disabled: false, hidden: false };
  const panels = Array.from({ length: 4 }, () => ({
    hidden: false,
    classList: { toggle() {} },
    querySelectorAll: () => [{ checkValidity: () => true, reportValidity() {} }]
  }));
  const indicators = Array.from({ length: 4 }, () => ({ classList: { toggle() {} }, setAttribute() {} }));
  const events = {};
  const calls = [];
  const form = { values: { ...defaults, ...values }, resetCount: 0, reset() { this.resetCount += 1; } };
  const context = {
    window: { AFGHAN_EATS_CONFIG: { apiBaseUrl } },
    document: {
      querySelectorAll(selector) {
        return selector === '[data-onboarding-step]' ? panels : indicators;
      },
      querySelector: () => ({ scrollIntoView() {} }),
      getElementById(id) {
        if (id === 'partnerOnboardingResult') return result;
        if (id === 'onboardingSubmit') return button;
        return null;
      },
      addEventListener(name, callback) { events[name] = callback; }
    },
    localStorage: { getItem: () => lang === 'fa' ? 'fa' : 'en' },
    FormData: class {
      constructor(target) { this.values = target.values; }
      get(name) { return this.values[name] ?? ''; }
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fetchError) throw fetchError;
      return response ?? trpcResponse({ result: { data: { json: {
        success: true,
        duplicate: false,
        reference: 'AEP-20261027-ABC123',
        emailVerified: false,
        verificationEmailSent: true
      } } } });
    }
  };
  vm.runInNewContext(script, context);
  const event = { preventDefault() {}, currentTarget: form };
  return { context, event, result, button, panels, form, calls, events };
}

test('submits the supported tRPC contract and preserves extended details in notes', async () => {
  const ui = setup();
  await ui.context.window.partnerOnboardingSubmit(ui.event);

  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].url, 'https://api.example/api/trpc/operations.applyPartner');
  assert.equal(ui.calls[0].options.method, 'POST');
  assert.equal(ui.calls[0].options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(ui.calls[0].options.body);
  assert.deepEqual(Object.keys(body), ['json']);
  assert.deepEqual(Object.keys(body.json).sort(), [
    'address', 'cuisine', 'deliveryModel', 'district', 'email', 'notes',
    'ownerName', 'phone', 'restaurantName', 'whatsapp'
  ].sort());
  assert.equal(body.json.restaurantName, 'Saffron House');
  assert.equal(body.json.ownerName, 'Ahmad Rahimi');
  assert.equal(body.json.email, 'owner@example.com');
  assert.equal(body.json.deliveryModel, 'both');
  assert.equal(body.json.notes, [
    'Menu items: Kabuli pulao — 250 AFN',
    'Menu notes: Family platters',
    'Menu link: https://saffron.example/menu',
    'Delivery zones: Tank Markaz, Jebrael',
    'Payout method: cash_settlement',
    'Payout contact name: Ahmad Rahimi',
    'Payout contact phone: +93700000000'
  ].join('\n'));
  assert.match(ui.result.textContent, /AEP-20261027-ABC123/);
  assert.match(ui.result.textContent, /verification link was sent/i);
  assert.equal(ui.result.className, 'notice success');
  assert.equal(ui.form.resetCount, 1);
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.panels[0].hidden, false);
});

test('reports saved application separately when verification email delivery fails', async () => {
  const ui = setup({ response: trpcResponse({ result: { data: { json: {
    success: true, duplicate: false, reference: 'AEP-123', emailVerified: false, verificationEmailSent: false
  } } } }) });
  await ui.context.window.partnerOnboardingSubmit(ui.event);
  assert.equal(ui.result.className, 'notice success');
  assert.match(ui.result.textContent, /application is saved/i);
  assert.match(ui.result.textContent, /could not send the verification email/i);
  assert.equal(ui.form.resetCount, 1);
});

test('identifies an existing verified application without claiming a new submission', async () => {
  const ui = setup({ response: trpcResponse({ result: { data: { json: {
    success: true, duplicate: true, reference: 'AEP-OLD', emailVerified: true, verificationEmailSent: false
  } } } }) });
  await ui.context.window.partnerOnboardingSubmit(ui.event);
  assert.match(ui.result.textContent, /existing application was found/i);
  assert.match(ui.result.textContent, /AEP-OLD/);
  assert.match(ui.result.textContent, /email is already verified/i);
});

test('missing API configuration, network errors, HTTP errors and unconfirmed responses never report success', async () => {
  const cases = [
    setup({ apiBaseUrl: '' }),
    setup({ fetchError: new Error('network is offline') }),
    setup({ response: trpcResponse({ error: { message: 'PRIVATE_DATABASE_DETAIL' } }, false) }),
    setup({ response: trpcResponse({ error: { message: 'PRIVATE_DATABASE_DETAIL' } }) }),
    setup({ response: trpcResponse({ result: { data: { json: { success: false } } } }) })
  ];
  for (const ui of cases) {
    await ui.context.window.partnerOnboardingSubmit(ui.event);
    assert.equal(ui.result.className, 'notice error');
    assert.match(ui.result.textContent, /couldn't confirm/i);
    assert.doesNotMatch(ui.result.textContent, /saved|submitted successfully|PRIVATE_DATABASE_DETAIL/i);
    assert.equal(ui.form.resetCount, 0);
    assert.equal(ui.button.disabled, false);
  }
  assert.equal(cases[0].calls.length, 0);
});

test('does not truncate onboarding details that exceed the backend notes limit', async () => {
  const ui = setup({ values: { menuItems: 'x'.repeat(1001) } });
  await ui.context.window.partnerOnboardingSubmit(ui.event);
  assert.equal(ui.calls.length, 0);
  assert.match(ui.result.textContent, /1,000-character limit/);
  assert.equal(ui.form.resetCount, 0);
});

test('requires the email needed by the backend and links to the bilingual partner privacy notice', () => {
  assert.match(page, /name="email" type="email" required maxlength="320"/);
  assert.match(page, /href="\/privacy#partner-applications"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(privacy, /id="partner-applications"/);
  assert.match(privacy, /Restaurant partner applications/);
  assert.match(privacy, /درخواست‌های همکاری رستورانت/);
  assert.match(privacy, /payout preferences and contact details/);
  assert.match(privacy, /ترجیح پرداخت و معلومات تماس پرداختی/);
});
