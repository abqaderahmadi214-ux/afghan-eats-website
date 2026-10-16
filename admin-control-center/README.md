# Afghan Eats Control Center

**Maintained administrator workspace:** https://afghan-eats-admin.onrender.com/

This directory is the source-controlled production admin application. Render runs `node admin-control-center/server.mjs` from the main branch. The legacy Netlify custom domain still needs a hosting/DNS migration; do not treat an old manual upload as the current release.

The former `/operations` and `/operations.html` administrator entry points are retired and redirect here. Owner and Rider portals remain separate scoped workspaces; they are not administrator portals.

The Control Center now consolidates marketplace open/close control, dispatch, restaurants, Rider applications and fleet, Rider availability approvals, open and assigned shifts, Rider support, customer accounts/rewards, promotions, customer support, communications, audit/security, portal access, Careers, and public-site reliability.

No credentials, API tokens, private keys, or production secrets belong in this directory.

See [platform operations](../docs/platform-operations.md) for release checks and financial control boundaries.
