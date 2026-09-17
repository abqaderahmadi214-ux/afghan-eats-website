# Afghan Eats Control Center

**Canonical administrator workspace:** https://admin.afghaneats.net/

This directory is the only source-controlled Afghan Eats administrator application.

## Production deployment

- Source: `abqaderahmadi214-ux/afghan-eats-website` → `main` → `admin-control-center/`
- Hardened Render service: `afghan-eats-admin`
- Verified deployment host: https://afghan-eats-admin.onrender.com/
- Final custom domain: https://admin.afghaneats.net/

The Render host is configured to auto-deploy from `main` and serves the Control Center through `server.mjs`, which applies CSP, HSTS, frame blocking, permissions policy, no-store HTML and other security headers. The older standalone Netlify admin deployment is transitional only and should be retired after the custom domain is moved to the Render service.

The former `/operations`, `/operations.html` and `/admin` administrator entry points are retired and redirect to the canonical admin domain. Owner and Rider portals remain separate scoped workspaces; they are not administrator portals.

The Control Center consolidates marketplace open/close control, automatic and manual dispatch, restaurants, Rider applications and fleet, Rider availability approvals, open and assigned shifts, Rider time off, Rider support, customer accounts/rewards, promotions, customer support, communications, audit/security, portal access, Careers, and public-site reliability.

No credentials, API tokens, private keys, or production secrets belong in this directory.
