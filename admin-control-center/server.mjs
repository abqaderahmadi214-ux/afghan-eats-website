import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://afghaneats-api.onrender.com; img-src 'self' data: https:; style-src 'self'; script-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendHeaders(res, status, contentType, cacheControl) {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });
}

function resolveRequestPath(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, "https://admin.afghaneats.net").pathname);
  } catch {
    return null;
  }
  if (pathname === "/" || pathname === "/index.html") return path.join(root, "index.html");
  const relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.includes("\0")) return null;
  const candidate = path.resolve(root, relative);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!candidate.startsWith(rootPrefix)) return null;
  return candidate;
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !["GET", "HEAD"].includes(req.method || "")) {
    sendHeaders(res, 405, "text/plain; charset=utf-8", "no-store");
    res.end("Method Not Allowed");
    return;
  }

  const requestUrl = new URL(req.url, "https://admin.afghaneats.net");
  if (requestUrl.pathname === "/health") {
    sendHeaders(res, 200, "application/json; charset=utf-8", "no-store");
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok", service: "Afghan Eats Control Center" }));
    return;
  }

  const filePath = resolveRequestPath(req.url);
  if (!filePath) {
    sendHeaders(res, 400, "text/plain; charset=utf-8", "no-store");
    res.end("Bad Request");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not-file");
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const cacheControl = ext === ".html" ? "no-store" : "public, max-age=300, must-revalidate";
    const body = req.method === "HEAD" ? undefined : await readFile(filePath);
    sendHeaders(res, 200, contentType, cacheControl);
    res.end(body);
  } catch {
    sendHeaders(res, 404, "text/plain; charset=utf-8", "no-store");
    res.end("Not Found");
  }
});

server.listen(port, host, () => {
  console.log(`[Admin Control Center] listening on ${host}:${port}`);
});
