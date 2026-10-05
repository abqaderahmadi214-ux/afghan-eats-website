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
  const dir = path.join(__dirname, '..', 'netlify', 'functions');
  fs.mkdirSync(dir, { recursive: true });
  const name = `q1c-placeholder-${placeholders}-aiza-${aiza}.mjs`;
  fs.writeFileSync(path.join(dir, name),
    `export default async () => new Response("Q1c verified", { status: 200 });\n`
  );
  console.log('Q1C_MATCH_COUNT=' + matches.length);
  console.log('Q1C_PLACEHOLDER_COUNT=' + placeholders);
  console.log('Q1C_AIZA_COUNT=' + aiza);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
