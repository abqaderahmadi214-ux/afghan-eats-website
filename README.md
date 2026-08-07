# Afghan Eats Website

Public marketplace frontend for **afghaneats.net**.

This repository contains the Netlify-ready Afghan Eats web application for Herat, Afghanistan. The website is intentionally separated from the API backend (`afghaneats-backend`) so frontend deployment and backend operations can evolve independently.

## Deployment

Netlify should deploy the repository root from the `main` branch. No build command is required for the current static application.

## Backend

The production API is expected to be configured through `config.js`. The site also ships with bundled fallback restaurant/menu data so discovery remains available if the API is temporarily unavailable.

Never commit private API secrets, database passwords, JWT secrets, or Supabase service-role keys to this repository.
