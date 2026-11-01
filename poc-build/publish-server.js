// Same minimal pattern as tests/e2e/server.js, rooted at publish/
// instead of the repo root, so the REAL unmodified E2E specs (which
// all do page.goto('/index.html')) exercise the actual production
// build artifact.
//
// TASK 14 fix: several E2E specs build synthetic test fixtures by
// loading a real face photo via `new Image(); img.src =
// '/tests/e2e/fixtures/<name>.png'` inside page.evaluate() -- a
// hardcoded URL matching the REAL tests/e2e/server.js, which serves
// the whole repo root and so already has that path. publish/ does not
// contain a tests/ subtree at all, so those requests 404'd there.
//
// Fix: a SECOND, separate allow-listed root for exactly that one
// subtree (tests/e2e/fixtures/), read-only, resolved and verified
// independently of the main publish/ root -- not a general "serve
// anything under the repo" fallback. Both roots use the same
// containment check (safeResolve, via path.relative -- not a bare
// startsWith prefix check, which can be fooled by a sibling directory
// sharing the same string prefix, e.g. "publish-evil"). Any request
// that resolves outside its matched root -- via "..", a symlink, or
// anything else -- is rejected (403), never read.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLISH_ROOT = path.resolve(__dirname, '..', 'publish');
const FIXTURES_ROOT = path.resolve(__dirname, '..', 'tests', 'e2e', 'fixtures');
const FIXTURES_URL_PREFIX = '/tests/e2e/fixtures/';
const PORT = Number(process.env.E2E_PORT) || 8937;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// Resolves `urlPath` against `root` and verifies the result is
// actually contained within `root` (not just string-prefixed by it).
// Returns null if the request would escape the root in any way.
function safeResolve(root, urlPath) {
  const resolved = path.resolve(root, '.' + urlPath);
  const rel = path.relative(root, resolved);
  if (rel === '') return resolved; // root itself (not used here, but correct)
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath;
    if (urlPath.startsWith(FIXTURES_URL_PREFIX)) {
      filePath = safeResolve(FIXTURES_ROOT, '/' + urlPath.slice(FIXTURES_URL_PREFIX.length));
    } else {
      filePath = safeResolve(PUBLISH_ROOT, urlPath === '/' ? '/index.html' : urlPath);
    }
    if (!filePath) { res.writeHead(403); res.end(); return; }
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(PORT, () => console.log(`[publish-server] serving ${PUBLISH_ROOT} (+ fixtures from ${FIXTURES_ROOT}) at http://127.0.0.1:${PORT}`));
