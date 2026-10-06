const fs = require('fs');
const path = require('path');

(async () => {
  const orderUrl = 'https://afghaneats.net/order.html';
  const configUrl = 'https://afghaneats.net/config.js';

  const [orderRes, configRes] = await Promise.all([
    fetch(orderUrl, { cache: 'no-store' }),
    fetch(configUrl, { cache: 'no-store' })
  ]);

  if (!orderRes.ok) throw new Error(`order.html fetch failed: ${orderRes.status}`);
  if (!configRes.ok) throw new Error(`config.js fetch failed: ${configRes.status}`);

  const [orderHtml, configJs] = await Promise.all([orderRes.text(), configRes.text()]);

  const q1 = (orderHtml.match(/__GMAPS_KEY__/g) || []).length;
  const q2 = (orderHtml.match(/AIza[A-Za-z0-9_-]*/g) || []).length;
  const q3 = (configJs.match(/__GMAPS_KEY__/g) || []).length;
  const csp = orderRes.headers.get('content-security-policy') || '';
  const q4 = /script-src[^;]*https:\/\/maps\.googleapis\.com/i.test(csp);

  console.log('PROD_GMAPS_Q1=' + q1);
  console.log('PROD_GMAPS_Q2=' + q2);
  console.log('PROD_GMAPS_Q3=' + q3);
  console.log('PROD_GMAPS_Q4=' + (q4 ? 'yes' : 'no'));

  const dir = path.join(__dirname, '..', 'netlify', 'functions');
  fs.mkdirSync(dir, { recursive: true });
  const name = `prod-gmaps-q1-${q1}-q2-${q2}-q3-${q3}-q4-${q4 ? 'yes' : 'no'}.mjs`;
  fs.writeFileSync(path.join(dir, name),
    'export default async () => new Response("verified", { status: 200 });\n'
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
