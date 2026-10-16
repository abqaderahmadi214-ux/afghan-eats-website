'use strict';

// Secrets and challenges stay in memory/visible setup controls only, never browser storage.
window.AdminMfa = (() => {
  let challenge = null, challengeTimer = null, setupToken = null;
  const loginError = () => document.getElementById('login-error');
  function showLoginError(message) { const node = loginError(); node.textContent = message; node.className = 'notice notice-error'; }
  function cancelLogin(message = '') {
    challenge = null; clearTimeout(challengeTimer);
    document.getElementById('mfa-login-form').reset();
    document.getElementById('mfa-login-form').classList.add('hidden');
    document.getElementById('primary-signin').classList.remove('hidden');
    if (message) showLoginError(message);
  }
  async function finishSignIn(result) {
    if (!result?.token) throw new Error('Sign-in did not return a valid session.');
    saveSession(result.token, result.admin || {});
    await verifySession(); setShell(); setView(location.hash.slice(1) || 'overview');
  }
  async function handleSignInResult(result) {
    if (result?.status !== 'mfa_required') return false;
    cancelLogin(); challenge = result.challenge;
    document.getElementById('login-form').reset();
    document.getElementById('primary-signin').classList.add('hidden');
    document.getElementById('mfa-login-form').classList.remove('hidden');
    loginError().className = 'notice hidden';
    document.getElementById('mfa-login-code').focus();
    challengeTimer = setTimeout(() => cancelLogin('Verification expired. Sign in again.'), 300000);
    return true;
  }
  function panel(status) {
    const enabled = status?.enabled === true;
    return `<section class="panel" id="mfa-panel" data-enabled="${enabled}"><div class="panel-head"><div><h2>Two-step verification</h2><p>${enabled ? 'An authenticator code or single-use recovery code is required after password or Google sign-in.' : 'Add an authenticator app to protect this Control Center account.'}</p></div>${badge(enabled ? 'enabled' : 'not enabled')}</div><div class="panel-body">
      <p>${enabled ? `${number(status.recoveryCodesRemaining)} recovery codes remain. Keep them somewhere safe, separate from your authenticator. To replace the codes, disable and set up verification again.` : 'Use any authenticator supporting time-based codes. No SMS service or paid AI provider is needed. Confirm a code before protection becomes active.'}</p>
      <form id="mfa-primary-form" class="form-grid"><label class="field full"><span>Current password</span><input name="currentPassword" type="password" autocomplete="current-password" maxlength="200"></label>
      ${enabled ? '<label class="field full"><span>Authenticator or recovery code</span><input name="code" autocomplete="one-time-code" maxlength="32" required spellcheck="false" autocapitalize="characters"></label>' : ''}
      <button class="button ${enabled ? 'button-danger' : 'button-primary'} full" type="submit">${enabled ? 'Review disabling verification' : 'Set up with password'}</button></form>
      <p class="space-top-sm">Or confirm with the Google account linked to this account${enabled ? ', after entering your authenticator or recovery code above' : ''}:</p><div id="google-mfa-reauth"></div>
      <p id="mfa-error" class="notice notice-error hidden" role="alert"></p><div id="mfa-setup-region"></div>
    </div></section>`;
  }
  function showError(error) { const node = document.getElementById('mfa-error'); if (node) { node.textContent = error.message || String(error); node.classList.remove('hidden'); } else { toast(error.message || 'Verification failed.', 'error'); } }
  function clearEnrollment() {
    setupToken = null;
    document.getElementById('mfa-setup-region')?.replaceChildren();
    document.getElementById('mfa-primary-form')?.reset();
  }
  function clearSecrets() {
    cancelLogin(); clearEnrollment();
    state.confirmCallback = null;
    if (dialog.open) dialog.close('cancel');
    const modal = document.getElementById('mfa-recovery-dialog');
    if (modal?.open) modal.close();
    document.getElementById('mfa-recovery-codes').textContent = '';
    document.getElementById('mfa-codes-saved').checked = false;
  }
  async function initGoogle(attempt = 0) {
    const mount = document.getElementById('google-mfa-reauth'), token = state.token;
    if (!mount) return;
    if (!window.google?.accounts?.id) {
      if (attempt < 6) return setTimeout(() => initGoogle(attempt + 1), 600);
      mount.textContent = 'Google confirmation is unavailable. Use your current password.'; return;
    }
    try {
      const config = await request('identity.googleConfig', null, 'GET', false);
      const clientId = config.webClientId || config.clientId;
      if (!clientId || !mount.isConnected || state.token !== token || state.view !== 'security') return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: response => { if (mount.isConnected && state.token === token && state.view === 'security') handleGoogleReauth(response); }, auto_select: false, cancel_on_tap_outside: true });
      window.google.accounts.id.renderButton(mount, { theme: 'outline', size: 'large', text: 'continue_with', width: 240 });
    } catch { if (mount.isConnected) mount.textContent = 'Google confirmation is unavailable. Use your current password.'; }
  }
  async function primaryAction(identity) {
    const node = document.getElementById('mfa-panel');
    if (!node || state.view !== 'security') throw new Error('Open account security to manage verification.');
    if (node.dataset.enabled === 'true') {
      const code = String(document.querySelector('#mfa-primary-form [name="code"]').value || '').trim();
      if (!code) throw new Error('Enter your authenticator or recovery code first.');
      return openConfirm('Disable two-step verification', 'Remove the extra sign-in protection for your account? Existing sessions will be invalidated.', async () => {
        const token = state.token;
        const result = await mutate('auth.mfaDisable', { ...identity, code });
        if (state.token !== token) return;
        saveSession(result.token, result.admin); clearEnrollment();
        toast('Two-step verification disabled. Other sessions must sign in again.');
        await renderSecurityView();
      }, true);
    }
    const token = state.token;
    const setup = await mutate('auth.mfaBegin', identity);
    if (state.token !== token || state.view !== 'security') return;
    setupToken = token;
    document.getElementById('mfa-primary-form').reset();
    document.getElementById('mfa-setup-region').innerHTML = `<div class="safety-card space-top-sm"><strong>Add this account to your authenticator</strong><p>Choose “Enter a setup key” in your authenticator. Account: ${esc(setup.account)}. Issuer: Afghan Eats. Type: time based, 6 digits, 30 seconds.</p><label class="field"><span>Setup key — keep private</span><input id="mfa-setup-key" value="${attr(setup.secret)}" readonly autocomplete="off" spellcheck="false"></label><p>Setup expires in 10 minutes. Your account is protected only after confirming a code.</p><form id="mfa-enable-form" class="form-grid"><label class="field full"><span>Six-digit authenticator code</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" required></label><button class="button button-primary full" type="submit">Confirm and enable verification</button><button class="button button-secondary full" id="mfa-cancel-setup" type="button">Clear setup from this screen</button></form></div>`;
    document.querySelector('#mfa-enable-form input').focus();
  }
  function handleGoogleReauth(response) {
    if (!state.token || state.view !== 'security' || !document.getElementById('mfa-panel')) return false;
    primaryAction({ credential: String(response?.credential || '') }).catch(showError);
    return true;
  }
  document.getElementById('mfa-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const current = challenge, button = event.currentTarget.querySelector('button[type="submit"]');
    if (!current) return cancelLogin('Verification expired. Sign in again.');
    button.disabled = true;
    try {
      const result = await request('auth.mfaVerify', { challenge: current, code: document.getElementById('mfa-login-code').value.trim() }, 'POST', false);
      if (challenge !== current) return;
      cancelLogin(); await finishSignIn(result);
    } catch (error) { if (challenge === current) { showLoginError(error.message); document.getElementById('mfa-login-code').value = ''; } }
    finally { button.disabled = false; }
  });
  document.getElementById('mfa-login-cancel').addEventListener('click', () => cancelLogin());
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!['mfa-primary-form', 'mfa-enable-form'].includes(form.id)) return;
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    const error = document.getElementById('mfa-error'); if (error) error.classList.add('hidden');
    try {
      if (form.id === 'mfa-primary-form') {
        const currentPassword = String(new FormData(form).get('currentPassword') || '');
        if (!currentPassword) throw new Error('Enter your current password, or use Google confirmation.');
        await primaryAction({ currentPassword });
      } else {
        if (!setupToken || state.token !== setupToken) throw new Error('Set up verification again in your current session.');
        const token = state.token;
        const result = await mutate('auth.mfaEnable', { code: String(new FormData(form).get('code') || '').trim() });
        if (state.token !== token) return;
        saveSession(result.token, result.admin); clearEnrollment();
        document.getElementById('mfa-recovery-codes').textContent = result.recoveryCodes.join('\n');
        document.getElementById('mfa-codes-saved').checked = false;
        document.getElementById('mfa-recovery-dialog').showModal();
        await renderSecurityView();
      }
    } catch (error) { showError(error); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  document.addEventListener('click', event => { if (event.target.id === 'mfa-cancel-setup') clearEnrollment(); });
  const recoveryDialog = document.getElementById('mfa-recovery-dialog');
  recoveryDialog.addEventListener('cancel', event => event.preventDefault());
  document.getElementById('mfa-recovery-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!document.getElementById('mfa-codes-saved').checked) return;
    recoveryDialog.close(); document.getElementById('mfa-recovery-codes').textContent = '';
  });
  document.getElementById('mfa-download-codes').addEventListener('click', () => {
    const codes = document.getElementById('mfa-recovery-codes').textContent;
    if (!codes) return;
    const text = `Afghan Eats Control Center recovery codes\nAccount: ${state.user?.username || ''}\nEach code works once. Keep this file private and separate from your authenticator.\n\n${codes}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'afghan-eats-recovery-codes.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { handleSignInResult, finishSignIn, panel, initGoogle, handleGoogleReauth, clearEnrollment, clearSecrets };
})();
