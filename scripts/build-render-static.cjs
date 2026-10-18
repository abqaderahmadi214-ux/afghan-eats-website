// Publish only browser assets, never repository tooling or the admin server.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (!String(process.env.GOOGLE_MAPS_API_KEY || '').trim()) {
  throw new Error('GOOGLE_MAPS_API_KEY is required for the Render storefront build.');
}
for (const script of ['write-release.cjs', 'inject-google-maps-config.cjs', 'render-association-assets.cjs', 'validate-association-assets.cjs']) {
  execFileSync(process.execPath, [path.join(__dirname, script)], { cwd: root, stdio: 'inherit', env: { ...process.env, CONTEXT: 'production' } });
}
const out = path.join(root, 'render-public');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of fs.readdirSync(root)) {
  if ((name.endsWith('.html') && name !== 'operations.html') || ['config.js', 'customer-app-config.json', 'manifest.json', 'robots.txt', 'sitemap.xml'].includes(name)) {
    fs.copyFileSync(path.join(root, name), path.join(out, name));
  }
}
for (const dir of ['assets', 'data', '.well-known']) {
  fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true, filter: source => !source.endsWith('.template') });
}
console.log('Render storefront assets prepared in render-public.');
