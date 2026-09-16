# Afghan Eats Website

Public marketplace frontend for **afghaneats.net**.

This repository contains the Netlify-ready Afghan Eats web application for Herat, Afghanistan. The website is intentionally separated from the API backend (`afghaneats-backend`) so frontend deployment and backend operations can evolve independently.

## Deployment

Netlify deploys the repository root from the `main` branch. The configured build step renders platform association metadata before publishing the static site.

## Backend

The production API is expected to be configured through `config.js`. The site also ships with bundled fallback restaurant/menu data so discovery remains available if the API is temporarily unavailable.

Never commit private API secrets, database passwords, JWT secrets, or Supabase service-role keys to this repository.


## Current mobile releases

- Customer Android: `net.afghaneats.customer` — version `1.2.0`, versionCode `5`
- Rider Android: `net.afghaneats.rider` — version `1.1.2`, versionCode `4`
- Production API: `https://afghaneats-api.onrender.com`

Keep website app metadata, mobile release identifiers and public policy/support links aligned with these production identities.
