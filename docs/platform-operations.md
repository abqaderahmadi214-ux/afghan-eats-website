# Afghan Eats platform operations

## Production entry points

Use https://afghan-eats-admin.onrender.com for the maintained control centre. Public `/operations`, `/operations.html` and `/admin` redirect there. The old `admin.afghaneats.net` Netlify site is a manual upload and must be migrated separately with hosting/DNS access. Do not distribute it as the current administrator link.

`/data/platform-release.json` identifies repositories, branches and inspected native source versions. API and admin `/health` responses include their deployed Git commit. Native source versions do not verify the installed/store version.

## Daily responsibilities

- Dispatch: review unassigned and delayed orders, check restaurant handoffs and confirm riders have an approved shift.
- Restaurant operations: review onboarding, opening hours, stock and food-safety declaration gaps. Missing declarations never mean allergen-free.
- Support: work the case queue and conversations, verify order/customer records and record the reason for compensation.
- Finance: reconcile received rider cash against receipts; review statement lines, adjustments and disputes before approval; record payments only after they actually happen.

These duties may be combined in a small team. Sensitive financial routes remain restricted to full administrators by the backend; this release does not invent unsupported finance/support roles.

## Session logout and finance exports

Web customer, owner, rider and maintained admin logout requests invalidate the presented server session before removing local credentials. Other independent sessions stay signed in. The API stores only a token hash until expiry. If server logout cannot be confirmed, the web interface says so and still removes credentials from that device. This does not replace MFA or account-wide incident recovery.

The finance workspace exports the selected merchant statement and the latest 100 rider cash-ledger entries. A cash export is not a wage statement or a complete historical ledger. Empty amounts remain empty; unknown values are not converted to zero. CSV downloads neutralize formula-like external text while preserving numeric negatives. Review the record scope and statement lines before reconciliation.

## Control Center two-step verification

In the maintained admin, open **Security → Two-step verification**. Confirm your current password or the Google account linked to the current account. Enter the private setup key in a time-based authenticator (6 digits, 30 seconds), then confirm one code. Protection remains off until confirmation. Download the ten recovery codes and store them securely, separate from the authenticator. Setup expires after ten minutes. Setup keys, challenges and recovery-code plaintext are not saved in browser storage.

Once enabled, both password and Google sign-in require an authenticator code or a single-use recovery code. A sign-in challenge lasts five minutes. Codes allow one adjacent 30-second interval of clock drift; an accepted authenticator code cannot be reused. Five failed codes lock verification for fifteen minutes across new challenges. Keep device time automatic. An enrollment confirmation also consumes that authenticator code; wait for the next code for another immediate sign-in.

Enabling/disabling increments the account's MFA version, so earlier sessions stop authorizing admin routes. Other accounts and customer/owner/rider sessions are unaffected. Disabling requires primary identity confirmation and a valid factor, with a review dialog. Enable/disable actions are audited without keys or codes. MFA is optional per account in this release; enrollment is not proof that every staff member has enabled it. Accounts using the old admin interface should move to the maintained URL before enrollment.

Secrets are encrypted with AES-256-GCM using an account-bound key derived from the existing JWT_SECRET; recovery codes are stored only as hashes. Preserve the current secret with protected database backups. Changing JWT_SECRET also changes the wrapping key: plan a re-enrollment or controlled re-encryption before rotation. Single-use recovery codes remain usable even if the encrypted authenticator key cannot be read. Password reset does not remove MFA. If both authenticator and recovery codes are lost, verify the account holder through an independent trusted channel and use an audited database recovery procedure; no public reset or staff-management bypass is provided. Do not paste keys or recovery codes in tickets or chat. Replacement codes currently require disabling and re-enrolling after identity/factor verification.

## Native production source

Customer native releases use `afghaneats-backend`, branch `customer-production`, preserved from the newer `feat/customer-ota-live-sync-v18` source. The older `customer-staging` remains a separate web staging deployment and must not overwrite this source. Customer release candidate 1.2.4/build19 retains runtime 1.2.3 because its native dependencies are unchanged. Rider releases use `afghan-eats-rider-app`, main, with candidate 1.1.10/build14.

Candidate source versions are not proof of a signed artifact, installed app, store publication or tested background delivery. Record each build result separately. Existing legacy branch workflows are not disabled merely by creating the canonical branch; do not publish production updates from obsolete source.

## Rider pay

Finance & settlements includes fixed monthly salary, fee per completed delivery and salary plus delivery fee. Fixed salary is selected initially. No agreed amount is guessed. Save a draft until rates, effective date and agreement are known. Tips remain unconfigured until agreed.

Policies can apply as the default or to a named rider. A rider override takes precedence over the default. Drafts do not apply. Active policies require the relevant rates. Existing active policies change only from a future Kabul business date; backdating is rejected. History and the actor/reason are retained. Repeated saves with the same request key do not create another policy.

This is a pay-policy register, not a payroll engine. It does not calculate attendance, salary proration, unpaid leave, deductions, wages payable or automatic salary payments. Those need agreed business rules. Cash collected from customers is separate from earnings, and pay-policy changes never rewrite the cash ledger.

## Freshness and changes

Admin overview, dispatch and support can refresh every 30 seconds while visible and online. Refresh pauses during edits, focused form controls, pending requests or a confirmation dialog. It checks again before committing fetched data, so edits started during a request survive. Other administrative forms use manual refresh. Partial failures do not display a successful freshness status.

Restaurant order-list refresh runs every 20 seconds while visible and online, without rewriting menu or profile forms. Order sound requires an explicit user click and a running browser/audio context; keep the order board visible and do not assume background notification delivery. Rider web background refresh avoids in-progress delivery-code and form entry.

Financial commands are never triggered by rendering or polling. Review the confirmation text. If the result of a cash deposit or adjustment is uncertain, refresh and inspect the ledger before retrying; those older endpoints do not all provide a request-key guarantee. Compensation proposals and pay policies keep their request keys across retries.

## Release gates

1. Build the backend and run pay-policy validation/authorization/retry tests and database-backed session-revocation tests.
2. Run frontend syntax, finance/freshness/route tests, existing support tests and browser ordering/portal checks.
3. Verify API and admin health report the intended deployed commit. Check the public website deployment is ready.
4. Exercise one controlled order across customer, restaurant, dispatch and rider roles, including a cancellation or exception. Use test accounts; do not create unsolicited real restaurant work.
5. For native releases: verify package ID, signing, environment and build number; test real notification delivery, RTL, weak signal and interrupted tracking. Test rider active-job location on a locked physical device before promising background continuity.
6. Confirm backup restoration and always-on hosting arrangements before claiming a time-critical service-level guarantee. This release does not purchase hosting or external messaging services.

## Follow-on work from the premium review

The first release establishes operational controls and source corrections. Further work includes completion of component/style consolidation, dedicated finance/support role design, staff-wide MFA enrollment/enforcement, payroll/payment execution, physical-device background-location validation, native distribution, backup-restore evidence, and monitored uptime targets. Keep these as separate verified releases; do not describe them as completed by this foundation release.
