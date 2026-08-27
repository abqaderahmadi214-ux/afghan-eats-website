# Afghan Eats Control Center

**Canonical administrator workspace:** https://admin.afghaneats.net/

This directory is the source-controlled production admin application. Publish this directory as the root of the Netlify site that serves `admin.afghaneats.net` / `admin-afghaneats.netlify.app`.

The former `/operations` and `/operations.html` administrator entry points are retired and redirect here. Owner and Rider portals remain separate scoped workspaces; they are not administrator portals.

The Control Center now consolidates marketplace open/close control, dispatch, restaurants, Rider applications and fleet, Rider availability approvals, open and assigned shifts, Rider support, customer accounts/rewards, promotions, customer support, communications, audit/security, portal access, Careers, and public-site reliability.

No credentials, API tokens, private keys, or production secrets belong in this directory.
