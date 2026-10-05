const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'https://deploy-preview-96--afghaneats.netlify.app/order.html';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Q1c fetch failed: ${response.status}`);
  const html = await response.text();
  const matches = html.match(/__GMAPS_KEY__|AIza[A-Za-z0-9_-]*/g) || [];
  const placeholders = matches.filter(x => x === '__GMAPS_KEY__').length;
  const aiza = matches.filter(x => x.startsWith('AIza')).length;
  const context = String(process.env.CONTEXT || 'unknown').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const keyState = String(process.env.GOOGLE_MAPS_API_KEY || '').trim() ? 'key-present' : 'key-missing';

  console.log('Q1C_PLACEHOLDER_COUNT=' + placeholders);
  console.log('Q1C_AIZA_COUNT=' + aiza);
  console.log('Q1C_NETLIFY_CONTEXT=' + context);
  console.log('Q1C_KEY_STATE=' + keyState);

  const dir = path.join(__dirname, '..', 'netlify', 'functions');
  fs.mkdirSync(dir, { recursive: true });
  const name = `q1c-placeholder-${placeholders}-aiza-${aiza}-context-${context}-${keyState}.mjs`;
  fs.writeFileSync(path.join(dir, name),
    'export default async () => new Response("Q1c verified", { status: 200 });\n'
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
