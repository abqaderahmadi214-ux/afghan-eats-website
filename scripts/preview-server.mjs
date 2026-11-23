import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const liveApi = 'https://afghaneats-api.onrender.com';
const publicProcedures = new Map([
  ['platform.publicStatus', 'null'],
  ['restaurants.list', 'empty-object'],
  ['restaurants.listBrowsePreviews', 'empty-object'],
  ['restaurants.getBrowseMenu', 'restaurant-id'],
  ['restaurants.getMenu', 'restaurant-id'],
  ['restaurants.getById', 'restaurant-key']
]);
const publicPages = new Set([
  'about.html', 'account.html', 'activate.html', 'careers.html', 'checkout.html',
  'claim.html', 'data-deletion.html', 'discover.html', 'help.html', 'index.html',
  'order.html', 'orders.html', 'partner-onboarding.html', 'partner.html',
  'portal-recovery.html', 'privacy.html', 'restaurant.html', 'restaurants.html',
  'rider-portal.html', 'rider.html', 'terms.html', 'verify-email.html'
]);
const publicRootFiles = new Set([
  'config.js', 'customer-app-config.json', 'manifest.json', 'robots.txt', 'sitemap.xml'
]);
const publicDataFiles = new Set([
  'fallback-restaurants.json', 'menu-item-images.json', 'platform-release.json',
  'public-herat-directory.json', 'researched-herat-restaurants.json', 'restaurant-research.json'
]);
const publicAssetExtensions = new Set([
  '.css', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.png', '.svg',
  '.txt', '.webp', '.woff', '.woff2', '.xml'
]);
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};
const maxApiResponseBytes = 8 * 1024 * 1024;

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(text);
}

function isValidPublicInput(procedure, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'json')) return false;
  const value = input.json;
  const shape = publicProcedures.get(procedure);
  if (shape === 'null') return value === null;
  if (shape === 'empty-object') return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  if (shape === 'restaurant-id') {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 1 && typeof value.restaurantId === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value.restaurantId);
  }
  if (shape === 'restaurant-key') {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 1 && typeof value.id === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value.id);
  }
  return false;
}

function publicStaticPath(pathname) {
  if (pathname === '/') return 'index.html';
  if (pathname.endsWith('/')) {
    if (pathname === '/organizations/') return 'organizations/index.html';
    return null;
  }
  if (pathname.startsWith('/assets/')) {
    const file = pathname.slice(1);
    return publicAssetExtensions.has(extname(file).toLowerCase()) ? file : null;
  }
  if (pathname.startsWith('/data/')) {
    const file = pathname.slice('/data/'.length);
    return publicDataFiles.has(file) && !file.includes('/') ? `data/${file}` : null;
  }
  if (pathname === '/organizations' || pathname === '/organizations/index.html') return 'organizations/index.html';
  if (pathname.startsWith('/organizations/')) return null;
  const file = pathname.slice(1);
  if (publicPages.has(file)) return file;
  if (publicRootFiles.has(file)) return file;
  if (!file.includes('.') && publicPages.has(`${file}.html`)) return `${file}.html`;
  return null;
}

function decodeSafePath(rawPath) {
  if (/%(?:2f|5c|2e)/i.test(rawPath) || rawPath.includes('\\')) return null;
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return null; }
  if (decoded.includes('\\') || decoded.includes('\0')) return null;
  const segments = decoded.split('/');
  if (segments.some(segment => segment === '.' || segment === '..' || segment.startsWith('.'))) return null;
  return decoded;
}

function isInside(root, file) {
  const fromRoot = relative(root, file);
  return fromRoot === '' || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !fromRoot.startsWith(sep));
}

export function createPreviewServer({ root = process.cwd(), fetchImpl = fetch } = {}) {
  const rootPath = resolve(root);
  let rootReal;
  const rootPromise = realpath(rootPath).then(path => { rootReal = path; return path; });

  async function proxyPublicApi(req, res, url, rawPath) {
    if (req.method !== 'GET') return sendText(res, 405, 'Method not allowed', { Allow: 'GET' });
    if (/%(?:2f|5c|2e)/i.test(rawPath) || rawPath.includes('\\')) return sendText(res, 404, 'Not found');
    const match = /^\/api\/trpc\/([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){1,3})$/.exec(rawPath);
    const procedure = match?.[1];
    if (!procedure || !publicProcedures.has(procedure)) return sendText(res, 404, 'Not found');

    const params = [...url.searchParams.entries()];
    if (params.length !== 1 || params[0][0] !== 'input' || params[0][1].length > 8192) return sendText(res, 400, 'Invalid public query');
    let parsedInput;
    try { parsedInput = JSON.parse(params[0][1]); } catch { return sendText(res, 400, 'Invalid public query'); }
    if (!isValidPublicInput(procedure, parsedInput)) return sendText(res, 400, 'Invalid public query');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      // Do not forward caller headers, cookies, authorization, or request bodies.
      const upstream = await fetchImpl(`${liveApi}${rawPath}?input=${encodeURIComponent(params[0][1])}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal
      });
      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return sendText(res, 502, 'Invalid public API response');
      const body = Buffer.from(await upstream.arrayBuffer());
      if (body.byteLength > maxApiResponseBytes) return sendText(res, 502, 'Public API response too large');
      res.writeHead(upstream.status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(body);
    } catch {
      sendText(res, 502, 'Public API unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const target = req.url || '/';
      const rawPath = target.split('?', 1)[0];
      if (rawPath === '/api/trpc' || rawPath.startsWith('/api/trpc/')) {
        const url = new URL(target, 'http://preview.local');
        return await proxyPublicApi(req, res, url, rawPath);
      }
      if (!['GET', 'HEAD'].includes(req.method || '')) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end('Method not allowed');
      }
      const decodedPath = decodeSafePath(rawPath);
      if (decodedPath === null) return sendText(res, 404, 'Not found');
      const relativeFile = publicStaticPath(decodedPath);
      if (!relativeFile) return sendText(res, 404, 'Not found');
      const file = resolve(rootPath, relativeFile);
      await rootPromise;
      const fileReal = await realpath(file);
      if (!isInside(rootReal, fileReal)) return sendText(res, 404, 'Not found');
      const metadata = await stat(fileReal);
      if (!metadata.isFile()) return sendText(res, 404, 'Not found');
      let body = await readFile(fileReal);
      if (relativeFile === 'config.js') {
        body = Buffer.from(body.toString('utf8').replace(
          /apiBaseUrl:\s*(['"])https:\/\/afghaneats-api\.onrender\.com\1/,
          'apiBaseUrl: window.location.origin'
        ));
      }
      const headers = {
        'Cache-Control': 'no-store',
        'Content-Type': types[extname(fileReal).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff'
      };
      if (relativeFile === 'assets/sw.js') headers['Service-Worker-Allowed'] = '/';
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      sendText(res, 404, 'Not found');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4174);
  const host = process.env.HOST || '0.0.0.0';
  createPreviewServer().listen(port, host, () => {
    console.log(`Afghan Eats review preview listening on http://${host}:${port}`);
  });
}
