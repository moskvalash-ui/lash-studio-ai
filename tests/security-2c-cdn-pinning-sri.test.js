// SECURITY-2C — regression tests for CDN dependency pinning + Subresource
// Integrity (SRI) hardening on the 5 executable third-party <script> tags
// in index.html's <head>. Extracts the real markup straight out of
// index.html (same technique as every other test in this project) --
// never a hand-duplicated copy. The expected SHA-384 hashes below were
// generated during the SECURITY-2C audit by fetching the exact pinned
// URLs and hashing the real served bytes (openssl dgst -sha384) -- they
// are not fabricated, and were independently re-verified stable across
// two separate fetches before being pinned here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.message}`); } }

function extractScriptTag(hostFragment) {
  const idx = src.indexOf('<script src="' + hostFragment);
  assert.ok(idx !== -1, `expected to find a <script src="${hostFragment}...` );
  const end = src.indexOf('</script>', idx) + '</script>'.length;
  return src.slice(idx, end);
}

// ------------------------------------------------------------
// A/G. React: exact-version pinned, no unversioned range URL remains
// ------------------------------------------------------------
test('A. React is loaded from the exact pinned version 18.3.1, not the "@18" range', () => {
  const tag = extractScriptTag('https://unpkg.com/react@18.3.1/umd/react.production.min.js');
  assert.ok(tag.includes('react@18.3.1/umd/react.production.min.js'), 'expected exact-version React URL');
});

test('G1. no unversioned/range React URL remains anywhere in index.html', () => {
  assert.ok(!/unpkg\.com\/react@18\/umd/.test(src), 'the old "@18" range URL must not appear anywhere');
});

// ------------------------------------------------------------
// B/G. ReactDOM: exact-version pinned, no unversioned range URL remains
// ------------------------------------------------------------
test('B. ReactDOM is loaded from the exact pinned version 18.3.1, not the "@18" range', () => {
  const tag = extractScriptTag('https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js');
  assert.ok(tag.includes('react-dom@18.3.1/umd/react-dom.production.min.js'), 'expected exact-version ReactDOM URL');
});

test('G2. no unversioned/range ReactDOM URL remains anywhere in index.html', () => {
  assert.ok(!/unpkg\.com\/react-dom@18\/umd/.test(src), 'the old "@18" range URL must not appear anywhere');
});

// ------------------------------------------------------------
// C. Babel remains exact-version pinned (SECURITY-1 contract)
// ------------------------------------------------------------
test('C. @babel/standalone remains pinned to the exact SECURITY-1 version 8.0.4', () => {
  const tag = extractScriptTag('https://unpkg.com/@babel/standalone@8.0.4/babel.min.js');
  assert.ok(tag.includes('@babel/standalone@8.0.4/babel.min.js'), 'expected exact-version Babel URL unchanged from SECURITY-1');
});

// ------------------------------------------------------------
// D. face-api.js remains exact-version pinned
// ------------------------------------------------------------
test('D. face-api.js remains pinned to the exact version 0.22.2', () => {
  const tag = extractScriptTag('https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js');
  assert.ok(tag.includes('face-api.js@0.22.2/dist/face-api.min.js'), 'expected exact-version face-api.js URL unchanged');
});

// ------------------------------------------------------------
// E/F. Every SRI-eligible script (React, ReactDOM, Babel, face-api.js)
// carries the real, audit-generated integrity hash and crossorigin="anonymous".
// Tailwind is deliberately excluded here -- see H below.
// ------------------------------------------------------------
const SRI_ELIGIBLE = [
  { name: 'React', urlFragment: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js', integrity: 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z' },
  { name: 'ReactDOM', urlFragment: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js', integrity: 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1' },
  { name: 'Babel', urlFragment: 'https://unpkg.com/@babel/standalone@8.0.4/babel.min.js', integrity: 'sha384-bdF7m0Y1IFKt9Q6xC8X9qkXn0OBriQWKyWwZKYsN05zF6P/g9OakjjL0G2Sd4pB4' },
  { name: 'face-api.js', urlFragment: 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js', integrity: 'sha384-gzn2n++arkvyhdNLmUf1s6F5NZ8iAbZ7FhIt+Zw7Jlf1n/vNTmZ3+cYr7S4ogyco' },
];

for (const dep of SRI_ELIGIBLE) {
  test(`E. ${dep.name} <script> carries the expected real integrity="${dep.integrity.slice(0, 24)}..." attribute`, () => {
    const tag = extractScriptTag(dep.urlFragment);
    assert.ok(tag.includes(`integrity="${dep.integrity}"`), `expected exact SRI hash for ${dep.name}`);
  });
  test(`F. ${dep.name} <script> carries crossorigin="anonymous"`, () => {
    const tag = extractScriptTag(dep.urlFragment);
    assert.ok(tag.includes('crossorigin="anonymous"'), `expected crossorigin="anonymous" on ${dep.name} (required for SRI to be enforced at all)`);
  });
}

// ------------------------------------------------------------
// G3. Script ordering / count sanity -- exactly 5 third-party CDN
// <script src="https://..."> tags remain, in the same relative order,
// none newly async/defer.
// ------------------------------------------------------------
test('G3. exactly 5 external CDN <script> tags exist, in the original order, none async/defer', () => {
  const head = src.slice(src.indexOf('<head>'), src.indexOf('</head>'));
  const externalScripts = [...head.matchAll(/<script src="(https:\/\/[^"]+)"[^>]*><\/script>/g)];
  assert.strictEqual(externalScripts.length, 5, 'expected exactly 5 external <script src="https://..."> tags');
  const hosts = externalScripts.map(m => m[1].split('/')[2]);
  assert.deepStrictEqual(hosts, [
    'cdn.tailwindcss.com',
    'unpkg.com',
    'unpkg.com',
    'unpkg.com',
    'unpkg.com',
  ], 'external script order must remain Tailwind, React, ReactDOM, Babel, face-api.js');
  for (const m of externalScripts) {
    assert.ok(!/\basync\b|\bdefer\b/.test(m[0]), `no external script may have gained async/defer: ${m[0]}`);
  }
});

// ------------------------------------------------------------
// H. Tailwind decision (Step 6 of SECURITY-2C): exact-version pinned,
// but explicitly NOT SRI'd -- its CDN response has no
// Access-Control-Allow-Origin header, so integrity/crossorigin would
// break the load entirely (SRI requires a CORS-mode fetch).
// ------------------------------------------------------------
test('H1. Tailwind CDN is pinned to the exact version 3.4.17, not the unversioned URL', () => {
  const tag = extractScriptTag('https://cdn.tailwindcss.com/3.4.17');
  assert.ok(tag.includes('cdn.tailwindcss.com/3.4.17'), 'expected exact-version Tailwind URL');
});

test('H2. the old unversioned Tailwind URL no longer appears anywhere in index.html', () => {
  assert.ok(!/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/.test(src), 'the unversioned Tailwind tag must not remain');
});

test('H3. Tailwind <script> deliberately carries NO integrity/crossorigin (documented CORS limitation, not an oversight)', () => {
  const tag = extractScriptTag('https://cdn.tailwindcss.com/3.4.17');
  assert.ok(!tag.includes('integrity='), 'Tailwind must not carry integrity -- its CDN has no Access-Control-Allow-Origin header, so a CORS-mode fetch would fail and break script loading');
  assert.ok(!tag.includes('crossorigin'), 'Tailwind must not carry crossorigin either, for the same reason');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
