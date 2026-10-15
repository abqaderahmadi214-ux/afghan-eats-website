'use strict';

// Classic script loaded after control-center.js; reuse its authenticated API helpers.
let supportConversationRequest = 0;
root.addEventListener('click', async event => {
  const button = event.target.closest('[data-support-conversation]');
  if (!button) return;
  const requestId = ++supportConversationRequest;
  button.disabled = true;
  try {
    const data = await query('support.adminCase', { id: button.dataset.supportConversation });
    if (requestId !== supportConversationRequest || !root.contains(button)) return;
    root.querySelector('#support-conversation-panel')?.remove();
    const panel = document.createElement('section');
    panel.id = 'support-conversation-panel';
    panel.className = 'panel wide space-top-md';
    const closed = ['closed', 'resolved'].includes(data.case.status);
    panel.innerHTML = `<div class="panel-head"><div><h2>Support conversation · ${esc(data.case.reference)}</h2><p>${esc(data.case.status)} · ${esc(data.case.category)}</p></div></div><div class="panel-body"><p>${esc(data.case.details || '')}</p><div class="activity-list">${data.messages.map(message => `<div class="activity-row"><div><strong>${esc(message.sender)}</strong><p style="white-space:pre-wrap">${esc(message.body)}</p><small>${esc(shortDate(message.createdAt))}</small></div></div>`).join('')}</div>${closed ? '<p>Reopen this case before drafting or sending a reply.</p>' : '<form id="support-agent-reply-form" class="form-grid space-top-md"><label class="field"><span>Reply language</span><select name="language"><option value="fa">دری — Dari</option><option value="en">English</option></select></label><div class="field"><button type="button" class="button button-secondary" data-draft-reply>Draft reply with AI</button></div><label class="field full"><span>Reply — review all facts before sending</span><textarea name="body" dir="auto" rows="6" required maxlength="4000"></textarea></label><p class="full" role="status" data-draft-status>AI drafts can contain mistakes. You can also write a reply manually.</p><button type="submit" class="button button-primary full">Review and send reply</button></form>'}</div>`;
    root.appendChild(panel);
    const form = panel.querySelector('form');
    if (!form) return;
    const body = form.elements.namedItem('body');
    const language = form.elements.namedItem('language');
    const draftButton = form.querySelector('[data-draft-reply]');
    const sendButton = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-draft-status]');
    draftButton.addEventListener('click', async () => {
      if (body.value.trim() && !window.confirm('Replace the current reply with a new AI draft?')) return;
      const original = body.value;
      draftButton.disabled = true;
      sendButton.disabled = true;
      status.textContent = 'Preparing a draft… You can continue editing.';
      try {
        const draft = await mutate('supportAgent.draft', { caseId: data.case.id, language: language.value });
        if (!root.contains(panel)) return;
        if (body.value !== original) {
          status.textContent = 'Your reply changed while drafting. It has been kept; request another draft if needed.';
          return;
        }
        body.value = draft.body;
        status.textContent = 'AI draft ready. Review and edit it before sending. Nothing has been sent.';
        body.focus();
      } catch {
        status.textContent = 'AI drafting is unavailable. Write and send a manual reply instead.';
      } finally {
        draftButton.disabled = false;
        sendButton.disabled = false;
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const reply = body.value.trim();
      if (!reply) return;
      openConfirm('Send customer support reply', 'Have you checked the facts and reviewed this reply? Send it to the customer now?', async () => {
        sendButton.disabled = true;
        try {
          await mutate('support.adminReply', { id: data.case.id, body: reply, waitForCustomer: true });
          toast('Customer support reply sent.');
          panel.remove();
        } finally { sendButton.disabled = false; }
      }, false);
    });
  } catch (error) {
    setNotice(error.message || 'The support conversation could not be loaded.');
  } finally { button.disabled = false; }
});
