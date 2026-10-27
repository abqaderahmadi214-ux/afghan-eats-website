# Restaurant workspace redesign

Restaurant-only visual and usability update to owner.html. Built on main f9df5fc6f2adae1a20360a82aede538f58bd0f4b. No backend, admin portal, rider, billing, database, or marketplace configuration changes.

- Warm cream and forest-green workspace, larger readable controls, responsive cards and five-destination mobile navigation.
- Kitchen queue shortcuts and order filters: New (placed), In kitchen (confirmed/preparing), Ready (ready_for_pickup), All orders. Counts cover the orders returned by the existing owner endpoint, not an unlimited history.
- Menu search supports English and Dari names; availability filters preserve the underlying menu/editor commands.
- English/Dari layout and existing local Dari font. Plain AFN/افغانی labels avoid unsupported currency glyphs.
- Clear action labels, cancellation confirmation, duplicate-tap suppression while an order command is pending. No automatic mutation retries.
- Existing portal authentication and server-side permissions remain authoritative. Presentation wrappers load only on the restaurant page. Existing polling, offline/stale messages and opt-in sound are retained.
- Removed owner.html's duplicate growth script: config.js already loads it. Existing business tools remain available.

## Validation

Run `node tests/owner-workspace-browser.mjs` after installing Playwright Chromium. The test starts tests/server.mjs on 127.0.0.1:4173; all external requests are mocked. No production account, real order or real mutation is used.

Covers queue counts, filters, menu search in Dari, availability, empty results, edit form population, unsaved draft retention across panels, cancellation dismissal, exact existing order command payload, filter focus during polling, stale feedback, signed-out gate, and all five panels at 375/390/768/1024/1440 pixels. Dari RTL checked on mobile. Screenshots generated under visual-proof/owner. Local Node 24.22.1 with packaged Chromium passed on 28 October 2026. JavaScript syntax and duplicate HTML ID checks passed.

## Release

This PR is reviewable source work. It has not been deployed or verified on the production restaurant portal. Keep required checks intact. Deployment should target the service serving owner.html; do not redeploy the separate admin service as a substitute. After release verify both new versioned workspace assets load, authenticated owner-only access, English/Dari desktop/mobile layouts and read-only navigation without changing real orders/settings.
