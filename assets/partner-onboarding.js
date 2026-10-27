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
    const value = name => String(data.get(name) || '').trim();
    const noteSections = [
      ['Menu items', 'menuItems'],
      ['Menu notes', 'menuNotes'],
      ['Menu link', 'menuUrl'],
      ['Delivery zones', 'deliveryZones'],
      ['Payout method', 'payoutMethod'],
      ['Payout contact name', 'payoutName'],
      ['Payout contact phone', 'payoutPhone']
    ];
    const notes = noteSections
      .map(([label, name]) => [label, value(name)])
      .filter(([, content]) => content)
      .map(([label, content]) => `${label}: ${content}`)
      .join('\n');

    return {
      restaurantName: value('restaurantName'),
      ownerName: value('ownerName'),
      phone: value('phone'),
      whatsapp: value('whatsapp'),
      email: value('email'),
      district: value('district'),
      address: value('address'),
      deliveryModel: value('deliveryModel') || 'afghan_eats',
      cuisine: value('cuisine'),
      notes
    };
  }

  function showResult(type, en, fa) {
    const result = document.getElementById('partnerOnboardingResult');
    if (!result) return;
    result.className = `notice ${type}`;
    result.textContent = isFa() ? fa : en;
    result.hidden = false;
  }

  function showSubmissionFailure() {
    showResult(
      'error',
      "We couldn't confirm that your application was received. Don't assume it was submitted. Please try again later or contact support@afghaneats.net.",
      'دریافت درخواست شما تأیید نشد؛ فرض نکنید که درخواست ارسال شده است. لطفاً بعداً دوباره تلاش کنید یا با support@afghaneats.net تماس بگیرید.'
    );
  }

  function successMessage(result) {
    const reference = result.reference.trim();
    const openingEn = result.duplicate
      ? `An existing application was found. Reference: ${reference}. `
      : `Your application was submitted. Reference: ${reference}. `;
    const openingFa = result.duplicate
      ? `درخواست قبلی شما پیدا شد. شماره پیگیری: ${reference}. `
      : `درخواست شما ارسال شد. شماره پیگیری: ${reference}. `;

    if (result.emailVerified) {
      return [openingEn + 'Your email is already verified.', openingFa + 'ایمیل شما قبلاً تأیید شده است.'];
    }
    if (result.verificationEmailSent) {
      return [
        openingEn + 'A verification link was sent to your email; please verify it before approval.',
        openingFa + 'لینک تأیید به ایمیل شما فرستاده شد؛ لطفاً پیش از تأیید درخواست، ایمیل را تأیید کنید.'
      ];
    }
    return [
      openingEn + 'The application is saved, but we could not send the verification email yet. Contact support if you need help.',
      openingFa + 'درخواست ثبت شده است، اما فعلاً ایمیل تأیید فرستاده نشد. در صورت نیاز با پشتیبانی تماس بگیرید.'
    ];
  }

  async function submit(event) {
    event.preventDefault();
    if (!validateStep(step)) return;

    const form = event.currentTarget;
    const button = document.getElementById('onboardingSubmit');
    const payload = payloadFromForm(form);

    if (payload.notes.length > 1000) {
      showResult(
        'error',
        'The extra menu, delivery and payout notes exceed the 1,000-character limit. Shorten them before submitting.',
        'یادداشت‌های منو، ارسال و پرداخت بیش از حد ۱۰۰۰ نویسه است. پیش از ارسال، آن‌ها را کوتاه کنید.'
      );
      return;
    }

    const base = String(window.AFGHAN_EATS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
    if (!base) {
      showSubmissionFailure();
      return;
    }

    if (button) button.disabled = true;

    try {
      const response = await fetch(`${base}/api/trpc/operations.applyPartner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ json: payload })
      });
      if (!response.ok) throw new Error('Request failed');

      const body = await response.json();
      const result = body?.result?.data?.json ?? body?.result?.data;
      if (result?.success !== true || typeof result.reference !== 'string' || !result.reference.trim()) {
        throw new Error('Application receipt could not be confirmed');
      }

      const [en, fa] = successMessage(result);
      showResult('success', en, fa);
      form.reset();
      step = 0;
      updateStep();
    } catch {
      showSubmissionFailure();
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.partnerOnboardingNext = () => move(1);
  window.partnerOnboardingPrev = () => move(-1);
  window.partnerOnboardingSubmit = submit;

  document.addEventListener('DOMContentLoaded', updateStep);
})();
