# Render migration status — 18 October 2026

## Production cutover
- Public website: https://afghaneats.net, served by the free Render static site afghaneats-public (srv-dba9it7btjjs73eauhtg).
- Render verifies both afghaneats.net and www.afghaneats.net and reports Certificate Issued for each. HTTPS requests return 200; www redirects to the apex domain.
- Replaced only the apex and www Netlify web records: apex A 216.24.57.1 and www CNAME afghaneats-public.onrender.com, TTL 300.
- Exported the zone before and after the change. All 12 other records and all four dns1–dns4.p03.nsone.net nameservers are unchanged. Registration remains at Netlify.
- Preserved admin CNAME, Zoho MX priorities 10/20/50, SPF, DMARC, verification records, Zoho/Resend DKIM and send/rsend records.
- The original Netlify deployment remains available for rollback. No billing plan, payment, database, account or domain registration was deleted or changed.

## Deployment configuration
- Build: node scripts/build-render-static.cjs; publish: render-public.
- The allowlist excludes admin server, scripts, tests, repository configuration and database variables.
- render-static-config.json records the 20 routes and security/cache headers configured in Render. Admin routes redirect to the existing Render admin portal; operations.html is excluded from the static output.
- Preserve https://afghaneats-api.onrender.com and existing portals. Backend commit 07fff9c56888780bbb73426c35c14811d3d9a15b added only the exact temporary Render origin to CORS.
- Only GOOGLE_MAPS_API_KEY was copied to the storefront build. Database variables were not copied or changed.
- After this migration PR passes checks and merges, set the Render branch to main and enable automatic deploys. Verify the resulting deployment before considering the migration fully settled.

## Dependency inventory
- The build uses write-release, Google Maps injection and association-asset scripts.
- No deployed Netlify Functions or Edge Functions, registered Netlify forms, Identity or image-CDN dependency was found.
- No website source references NETLIFY_DATABASE_URL or NETLIFY_DATABASE_URL_UNPOOLED. Backend uses its own DATABASE_URL. Preserve both databases and the Neon integration.
- Images use static assets, external URLs and existing API/media services.
- Preserve PWA Service-Worker-Allowed: / and no-cache behavior. Android assetlinks.json remains published. Apple team ID was not configured on Netlify; iOS association metadata remains unpublished.
- Leave the separate admin-afghaneats Netlify project intact.

## Verification and limits
- Production HTTPS HTTP checks passed for home, restaurants, restaurant, account, checkout, orders, tracking, help, privacy, terms, data-deletion, owner, rider portal and discovery pages.
- /operations, /operations.html and /admin redirect to the existing Render admin portal.
- Android association JSON and customer app configuration return 200. Build scripts, admin server, .env and .git/config return 404.
- HTML responses have CSP and nosniff headers.
- API health returns 200 and exact allowed origins for both production domains. A first request timed out during API cold start, then succeeded.
- Production browser loaded 41 restaurant listings. Earlier preview inspection loaded Char Fasl's menu and retained a 650 AFN dish plus 20 AFN service fee in the local basket through checkout navigation.
- Login, owner, support and tracking forms render. No signed-in customer session or private active order was available; successful login and authenticated tracking remain unverified.
- Full Google Maps interaction remains unverified. Existing map-key and production referrer configuration were preserved.
- Existing growth loader declares AEGROWTH twice on restaurant pages; this was observed before cutover and is outside the hosting change.
- Earlier automated Playwright suite could not run because the browser executable was missing and Chromium downloads were truncated; this is not a passing test.
- No real order, payment, support ticket, password reset or customer notification was submitted.

## Rollback
Restore only the apex and www web targets to the prior Netlify deployment afghaneats.netlify.app using Netlify domain management and the saved DNS export. Do not change mail/admin records, nameservers, registration or databases. Keep the old published deployment and Maps configuration available.

## Netlify paid hosting plan
After production verification, review Netlify Usage & billing and downgrade/cancel only the paid hosting plan through its billing controls. Preserve the account, domain, DNS zone, Neon integration and old deployment. Domain renewal is separate. Migration does not remove any overdue invoice. No paid plan or payment details were changed during this work.
