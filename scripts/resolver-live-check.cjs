const fs = require('fs');
const path = require('path');

(async () => {
  const response = await fetch('https://afghaneats.net/tools/resolve-coordinates.html', { cache: 'no-store' });
  console.log('RESOLVER_HTTP_STATUS=' + response.status);
  const dir = path.join(__dirname, '..', 'netlify', 'functions');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'resolver-live-status-' + response.status + '.mjs';
  fs.writeFileSync(path.join(dir, name), 'export default async () => new Response("ok");\n');
  if (response.status !== 200) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
