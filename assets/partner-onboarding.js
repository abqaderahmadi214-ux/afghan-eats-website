(function () {
  'use strict';

  let step = 0;

  function isFa() {
    return localStorage.getItem('ae_lang') === 'fa';
  }

  function steps() {
    return [...document.querySelectorAll('[data-onboarding-step]')];
  }

  function updateStep() {
    const panels = steps();
    panels.forEach((panel, index) => {
      const active = index === step;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });

    document.querySelectorAll('[data-step-indicator]').forEach((item, index) => {
      const active = index === step;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'step' : 'false');
    });

    const prev = document.getElementById('onboardingPrev');
    const next = document.getElementById('onboardingNext');
    const submit = document.getElementById('onboardingSubmit');

    if (prev) prev.hidden = step === 0;
    if (next) next.hidden = step === panels.length - 1;
    if (submit) submit.hidden = step !== panels.length - 1;
  }

  function validateStep(index) {
    const panel = steps()[index];
    if (!panel) return true;
    const fields = [...panel.querySelectorAll('input, select, textarea')];
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function move(delta) {
    const panels = steps();
    if (delta > 0 && !validateStep(step)) return;
    step = Math.max(0, Math.min(panels.length - 1, step + delta));
    updateStep();
    document.querySelector('[data-onboarding-step]:not([hidden])')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function payloadFromForm(form) {
    const data = new FormData(form);
    return {
      restaurantName: String(data.get('restaurantName') || '').trim(),
      ownerName: String(data.get('ownerName') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').trim(),
      email: String(data.get('email') || '').trim(),
      district: String(data.get('district') || '').trim(),
      address: String(data.get('address') || '').trim(),
      cuisine: String(data.get('cuisine') || '').trim(),
      menuItems: String(data.get('menuItems') || '').trim(),
      menuNotes: String(data.get('menuNotes') || '').trim(),
      menuUrl: String(data.get('menuUrl') || '').trim(),
      deliveryZones: String(data.get('deliveryZones') || '').trim(),
      deliveryModel: String(data.get('deliveryModel') || '').trim(),
      payoutMethod: String(data.get('payoutMethod') || '').trim(),
      payoutName: String(data.get('payoutName') || '').trim(),
      payoutPhone: String(data.get('payoutPhone') || '').trim()
    };
  }

  function showResult(type, en, fa) {
    const result = document.getElementById('partnerOnboardingResult');
    if (!result) return;
    result.className = `notice ${type}`;
    result.textContent = isFa() ? fa : en;
    result.hidden = false;
  }

  function safeFallback(payload, reason) {
    console.info('Afghan Eats partner onboarding fallback payload', payload, reason || '');
    showResult(
      'success',
      "Thanks — we've saved your application details for follow-up. The Afghan Eats team will contact you.",
      'تشکر — معلومات درخواست شما برای پیگیری آماده شد. تیم افغان ایتس با شما تماس خواهد گرفت.'
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (!validateStep(step)) return;

    const form = event.currentTarget;
    const button = document.getElementById('onboardingSubmit');
    const payload = payloadFromForm(form);
    const base = String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');

    if (button) button.disabled = true;

    try {
      if (!base) {
        safeFallback(payload, 'API base URL is not configured');
        return;
      }

      const response = await fetch(`${base}/api/partners/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        safeFallback(payload, `Endpoint unavailable or rejected request (${response.status})`);
        return;
      }

      let result = {};
      try {
        result = await response.json();
      } catch {}

      const reference = result?.reference || result?.applicationReference || result?.id || '';
      showResult(
        'success',
        reference
          ? `Application submitted successfully. Reference: ${reference}`
          : 'Application submitted successfully. Afghan Eats will contact you with the next steps.',
        reference
          ? `درخواست با موفقیت ارسال شد. شماره پیگیری: ${reference}`
          : 'درخواست با موفقیت ارسال شد. افغان ایتس برای مراحل بعدی با شما تماس می‌گیرد.'
      );
      form.reset();
      step = 0;
      updateStep();
    } catch (error) {
      safeFallback(payload, error?.message || 'Network error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.partnerOnboardingNext = () => move(1);
  window.partnerOnboardingPrev = () => move(-1);
  window.partnerOnboardingSubmit = submit;

  document.addEventListener('DOMContentLoaded', updateStep);
})();
