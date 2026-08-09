import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8' };
http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    if (!extname(path)) path += '.html';
    const local = normalize(join(root, path));
    if (!local.startsWith(root)) throw new Error('Invalid path');
    const body = await readFile(local);
    res.writeHead(200, {'Content-Type':types[extname(local)]||'application/octet-stream'});res.end(body);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');
  }
}).listen(4173,'127.0.0.1');
