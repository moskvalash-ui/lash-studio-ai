// Minimal static file server for E2E: serves the REAL, unmodified repo
// root (so index.html and any relative asset references resolve exactly
// as they do in production) over plain HTTP. Deliberately dependency-free
// (Node's built-in http/fs only) -- this repo has no build step and no
// other runtime dependency, and this server shouldn't be the first one.
// Started/stopped automatically by Playwright's webServer config
// (playwright.config.js); not meant to be run standalone in normal use,
// though `node server.js` works for manual debugging.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // repository root
const PORT = Number(process.env.E2E_PORT) || 8934;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const requested = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(ROOT, requested);
    // Never serve anything outside the repository root.
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-server] serving ${ROOT} at http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
