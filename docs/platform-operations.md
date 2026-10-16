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

## Rider pay

Finance & settlements includes fixed monthly salary, fee per completed delivery and salary plus delivery fee. Fixed salary is selected initially. No agreed amount is guessed. Save a draft until rates, effective date and agreement are known. Tips remain unconfigured until agreed.

Policies can apply as the default or to a named rider. A rider override takes precedence over the default. Drafts do not apply. Active policies require the relevant rates. Existing active policies change only from a future Kabul business date; backdating is rejected. History and the actor/reason are retained. Repeated saves with the same request key do not create another policy.

This is a pay-policy register, not a payroll engine. It does not calculate attendance, salary proration, unpaid leave, deductions, wages payable or automatic salary payments. Those need agreed business rules. Cash collected from customers is separate from earnings, and pay-policy changes never rewrite the cash ledger.

## Freshness and changes

Admin overview, dispatch and support can refresh every 30 seconds while visible and online. Refresh pauses during edits, focused form controls, pending requests or a confirmation dialog. It checks again before committing fetched data, so edits started during a request survive. Other administrative forms use manual refresh. Partial failures do not display a successful freshness status.

Restaurant order-list refresh runs every 20 seconds while visible and online, without rewriting menu or profile forms. Order sound requires an explicit user click and a running browser/audio context; keep the order board visible and do not assume background notification delivery. Rider web background refresh avoids in-progress delivery-code and form entry.

Financial commands are never triggered by rendering or polling. Review the confirmation text. If the result of a cash deposit or adjustment is uncertain, refresh and inspect the ledger before retrying; those older endpoints do not all provide a request-key guarantee. Compensation proposals and pay policies keep their request keys across retries.

## Release gates

1. Build the backend and run pay-policy validation/authorization/retry tests.
2. Run frontend syntax, finance/freshness/route tests, existing support tests and browser ordering/portal checks.
3. Verify API and admin health report the intended deployed commit. Check the public website deployment is ready.
4. Exercise one controlled order across customer, restaurant, dispatch and rider roles, including a cancellation or exception. Use test accounts; do not create unsolicited real restaurant work.
5. For native releases: verify package ID, signing, environment and build number; test real notification delivery, RTL, weak signal and interrupted tracking. Test rider active-job location on a locked physical device before promising background continuity.
6. Confirm backup restoration and always-on hosting arrangements before claiming a time-critical service-level guarantee. This release does not purchase hosting or external messaging services.

## Follow-on work from the premium review

The first release establishes operational controls and source corrections. Further work includes a complete component/style consolidation, dedicated finance/support role design, staff MFA/session revocation, payroll/payment execution, physical-device background-location validation, native distribution, backup-restore evidence, and monitored uptime targets. Keep these as separate verified releases; do not describe them as completed by this foundation release.
