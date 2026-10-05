/*
 * REQUIRED NETLIFY CONFIGURATION:
 *   Site settings → Environment variables → GOOGLE_MAPS_API_KEY
 *   - Scope: Production (deploy previews will use the fallback)
 *   - Value: Google Cloud browser key, referrer-restricted to afghaneats.net/*
 *
 * If the key is scoped to Preview instead of Production, deploy previews will
 * successfully inject the key BUT the production deploy will FAIL. This is
 * intentional — a broken production map is worse than a broken preview.
 *
 * If you need previews to also have a working map, add a second env var
 * GOOGLE_MAPS_API_KEY_PREVIEW with a separate Google Cloud key restricted to
 * deploy-preview-*.afghaneats.netlify.app/*
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
const marker = '__GMAPS_KEY__';
const targets = ['config.js', 'order.html'];
const isProduction = process.env.CONTEXT === 'production';

if (!key) {
  if (isProduction) {
    console.error('[Afghan Eats] FATAL: GOOGLE_MAPS_API_KEY is not set in the production build context.');
    console.error('[Afghan Eats] Refusing to ship order.html with __GMAPS_KEY__ placeholder.');
    console.error('[Afghan Eats] Set the env var in Netlify site settings → Environment variables → scope Production.');
    process.exit(1);
  }
  console.warn('[Afghan Eats] GOOGLE_MAPS_API_KEY missing in non-production context (' + (process.env.CONTEXT || 'unknown') + '). Google Maps will use the fallback for this deploy.');
  process.exit(0);
}

for (const relative of targets) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(marker)) {
    throw new Error(`Google Maps key marker not found in ${relative}`);
  }
  fs.writeFileSync(file, source.split(marker).join(key), 'utf8');
}

for (const relative of targets) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(marker)) {
    throw new Error(`FATAL: Google Maps key marker still present in ${relative} after injection.`);
  }
}

console.log('[Afghan Eats] Google Maps browser key injected from the Netlify environment.');
