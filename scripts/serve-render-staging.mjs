import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 10000);
const apiBase = String(process.env.AFGHAN_EATS_STAGING_API_BASE_URL || '').replace(/\/$/, '');
const basicUser = process.env.STAGING_BASIC_USER || '';
const basicPass = process.env.STAGING_BASIC_PASS || '';

if (!apiBase) throw new Error('AFGHAN_EATS_STAGING_API_BASE_URL is required');
if (!basicUser || !basicPass) throw new Error('STAGING_BASIC_USER and STAGING_BASIC_PASS are required');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function authorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    return split >= 0 && decoded.slice(0, split) === basicUser && decoded.slice(split + 1) === basicPass;
  } catch {
    return false;
  }
}

function commonHeaders(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

async function proxyApi(req, res, url) {
  const target = `${apiBase}${url.pathname}${url.search}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(lower)) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const chunks = [];
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    for await (const chunk of req) chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  });
  res.statusCode = upstream.status;
  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lower)) continue;
    res.setHeader(key, value);
  }
  commonHeaders(res);
  if (req.method === 'HEAD') return res.end();
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('\0')) throw new Error('Invalid path');
  const clean = normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = join(root, clean);
  if (!filePath.startsWith(root)) throw new Error('Invalid path');

  let finalPath = filePath;
  try {
    const info = await stat(finalPath);
    if (info.isDirectory()) finalPath = join(finalPath, 'index.html');
  } catch {
    if (!extname(finalPath)) finalPath += '.html';
  }

  let data = await readFile(finalPath);
  if (url.pathname === '/config.js') {
    const source = data.toString('utf8').replace(
      /apiBaseUrl:\s*['\"][^'\"]*['\"]/, 
      'apiBaseUrl: window.location.origin'
    );
    data = Buffer.from(source, 'utf8');
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes.get(extname(finalPath).toLowerCase()) || 'application/octet-stream');
  commonHeaders(res);
  if (req.method === 'HEAD') return res.end();
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  commonHeaders(res);
  if (!authorized(req)) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Afghan Eats staging"');
    return res.end('Authentication required');
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/_ready') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ status: 'ok', environment: 'staging', apiProxy: apiBase }));
    }
    if (url.pathname.startsWith('/api/')) return await proxyApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error('[Staging web]', error instanceof Error ? error.message : error);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Afghan Eats website staging] listening on ${port}`);
  console.log(`[Afghan Eats website staging] API proxy -> ${apiBase}`);
});
