const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
const marker = '__GMAPS_KEY__';
const targets = ['config.js', 'order.html'];

if (!key) {
  console.warn('[Afghan Eats] GOOGLE_MAPS_API_KEY is not available in this build context. Google Maps will use the bilingual fallback.');
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

console.log('[Afghan Eats] Google Maps browser key injected from the Netlify environment.');
