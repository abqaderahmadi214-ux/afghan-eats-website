# Render migration status — 18 October 2026

## Completed
- Inspected deployed Netlify source: main at fdc5af6c007cdc90004b86ac20e0a4d1ff861d55; deploy 6ad2fef69a970e3fc924d7ea.
- Created free Render static site afghaneats-public (srv-dba9it7btjjs73eauhtg), https://afghaneats-public.onrender.com.
- Build: node scripts/build-render-static.cjs; publish: render-public; automatic deploys off during migration.
- Build allowlist excludes admin server, scripts, tests, repository configuration and database variables.
- Translated 20 Netlify routes and installed security/cache headers through Render dashboard. render-static-config.json records intended rules. Render redirects use 301 rather than Netlify forced 302; operations.html is excluded from output so Render can redirect it.
- Kept API URL and existing portals. Added only the exact temporary origin to backend CORS in commit 07fff9c56888780bbb73426c35c14811d3d9a15b.
- Copied only GOOGLE_MAPS_API_KEY to the storefront build. Database variables were not copied or changed.

## Dependency inventory
- Netlify production build uses write-release, Google Maps injection and association-asset scripts.
- No deployed functions or edge functions; no registered Netlify forms. Source has no Netlify form submission, Identity or image-CDN dependency.
- Three Netlify variable names: GOOGLE_MAPS_API_KEY, NETLIFY_DATABASE_URL, NETLIFY_DATABASE_URL_UNPOOLED. Values are intentionally omitted.
- No website source references the Netlify database variables. Backend uses its own DATABASE_URL. Do not delete either database or Neon integration.
- Images use static assets, external URLs and existing API/media services.
- PWA service worker needs Service-Worker-Allowed: / and no-cache behavior. Android assetlinks.json is preserved. Apple team ID is not currently configured on Netlify, so iOS association metadata remains unpublished.
- Netlify project admin-afghaneats also exists; current DNS admin.afghaneats.net already points to afghan-eats-admin.onrender.com. Leave it intact.

## Tests and limits
- HTTP checks: home, restaurants, restaurant, account, checkout, orders, tracking, help, owner and rider portal return 200.
- Admin routes /operations, /operations.html and /admin reach the existing Render admin portal.
- Android association JSON, customer app configuration and fallback catalog return 200.
- Build scripts and admin server paths return 404, as intended.
- Live API returns the exact temporary CORS origin and 43 restaurant records.
- Browser: 41 visible public restaurant listings; Char Fasl live menu; one Shishlik Kebab with Rice added to local basket and retained on checkout navigation (650 AFN subtotal, 20 AFN service fee).
- Login, owner, support and tracking verification forms render. No signed-in customer session or private active order was available; successful login and authenticated tracking remain unverified.
- Discovery page renders public menus and social sources. Full Google map behavior remains unverified on temporary domain; browser-key referrer restrictions may require an explicit preview-domain allowance.
- Promotions: existing growth loader declares AEGROWTH twice on restaurant pages (config.js dynamic loader plus HTML script). This was observed during initial browser inspection; no campaign was changed.
- Automated Playwright suite could not run: browser executable missing, and the official Chromium download returned invalid/truncated ZIPs. These are environment failures, not passing application tests.
- No real order, payment, support ticket, password reset or customer notification was submitted.

## DNS inventory (unchanged)
Netlify hosts the zone on dns1–dns4.p03.nsone.net. Domain registered through Netlify, annual renewal shown as 17.99 USD on 3 February 2027.
- Apex and www: NETLIFY afghaneats.netlify.app (TTL 3600).
- admin: CNAME afghan-eats-admin.onrender.com.
- Zoho MX priorities 10/20/50 to mx.zoho.com / mx2.zoho.com / mx3.zoho.com.
- Preserve SPF, DMARC, Zoho verification, Google verification, Zoho DKIM, Resend DKIM, send and rsend CNAME records.
Do not change nameservers or registration as part of this hosting migration.

## Costs verified
Render dashboard: Hobby; service charges 0; datastore projection 6.30 USD/month. 214 MB of 5 GB bandwidth, 20 of 500 standard build minutes, 1 of 2 included custom-domain allowances used before attachment. Excess usage/domains can incur charges; check the domain attachment UI before saving. No paid plan or payment detail changed.
Netlify overdue-payment warning confirmed; balance and plan not modified.

## Blocking state
DNS has NOT been switched. Custom domains and HTTPS have NOT been attached/verified.
Render custom-domain section remained at Loading after reload; browser subsequently reported credential-protection restrictions and requested a manual user handoff. Connected Render tools do not expose custom-domain or DNS operations. Do not switch DNS until Render domain attachment is usable and remaining tests pass.

## Remaining migration steps
1. Restore dashboard interaction; attach afghaneats.net and www only if included without extra charges.
2. Finish map, promotion and credential-backed login/tracking tests using a dedicated non-notifying test account/order, or clearly agree on the limits of read-only validation.
3. Export Netlify DNS records before editing. Replace only apex/www web records with Render-provided targets; leave mail, admin, registration and nameservers unchanged.
4. Verify both custom domains, HTTPS, canonical redirects, API CORS, basket persistence and portal links.
5. Merge migration code and set Render production source to main with automatic deploys after CI/verification; keep Netlify deployment available.
6. Rollback if needed: restore apex/www to the prior Netlify targets using Netlify domain management; keep original published deployment and browser Maps configuration available.

## Netlify plan cancellation — only after verified cutover
In Netlify Usage & billing, review the team plan and downgrade/cancel the paid hosting plan using the offered billing controls. Do not delete the account, domain, DNS zone, Neon database or old deployment. Keep annual domain renewal separate. The overdue invoice remains payable; migration does not remove it.
