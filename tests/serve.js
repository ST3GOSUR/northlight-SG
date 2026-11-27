// Tiny static file server for the tests (no dependencies). Serves the repo root on 127.0.0.1 only.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400).end('Bad request'); return; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(root, '.' + p);
  const blocked = !file.startsWith(root + path.sep) || /(^|[\\/])(\.[^\\/]+|node_modules)([\\/]|$)/.test(path.relative(root, file));
  if (blocked) { res.writeHead(403).end('Forbidden'); return; } // no path traversal, no dotfiles, no node_modules
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
