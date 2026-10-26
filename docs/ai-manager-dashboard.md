# AI General Manager dashboard

Open the Control Center and select **AI General Manager** (`#manager`). Only full administrators see this view; the backend independently enforces authentication, role, account status, session revocation and MFA.

This view depends on backend PR abqaderahmadi214-ux/afghaneats-backend#126. Release that validated backend before the dashboard. An absent endpoint, failed request or malformed response shows an unavailable message, never fabricated zero totals. This PR does not deploy either repository.

The dashboard uses only `GET aiManager.report` with `language: en | fa`. It shares the existing tab-only session and sign-in flow. There is no new credential storage, external AI service, scheduler, outgoing communication, payment or action executor. Reports are not persisted by this component. Refresh is manual; the report timestamp is shown in Kabul time. The surrounding admin shell remains English; the manager content supports Dari and right-to-left layout.

Specialist cards display stored evidence and lead to the existing worker queue or restaurant workspace. A recent record does not prove a worker is running. Review flags are operational follow-up, not financial/legal approval requests. The backend report explains delivery-time value, cancellation cohort and rolling-window semantics.

## Verification

`node --check admin-control-center/assets/ai-manager.js`

`node tests/ai-manager-browser.mjs` (requires Playwright Chromium). CI runs this suite against a local server with all external requests intercepted. Coverage includes English/Dari, text escaping, failed/unavailable specialist records, Kabul time, mobile/tablet/desktop overflow, keyboard refresh, unavailable/malformed backend responses, late-response isolation after logout, staff navigation and zero mutation requests. Backend authentication is covered separately in PR #126.

Remaining phases: controlled action execution with durable audit/idempotency, automatic report delivery and optional voice/outreach integrations. None is represented as enabled or running by this dashboard.
