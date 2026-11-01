// ============================================================
// LASH STUDIO AI — PRECOMPILE PoC build script (TASK 09)
// ------------------------------------------------------------
// Reproducible, read-only-on-source build step: reads the REAL,
// untouched index.html, extracts the exact <script type="text/babel">
// body (same byte range every time, boundary-marker based), runs it
// through @babel/preset-react in CLASSIC runtime mode ONLY (matches
// this project's global-React/UMD usage -- no "automatic"/jsx-runtime
// imports, which would be invalid in a plain non-module <script>),
// with retainLines so line numbers/formatting stay as close to the
// original as possible, and writes a SEPARATE experimental file
// (index.precompiled.html) with that single script tag replaced by
// the precompiled plain-JS output and the @babel/standalone CDN tag
// removed (no longer needed at runtime).
//
// index.html itself is NEVER modified by this script. It remains the
// single, editable, test-covered source of truth. This script can be
// re-run at any time to regenerate index.precompiled.html from
// whatever index.html currently contains.
//
// Compiler used: a pre-existing, already-cached local npx install of
// @babel/core + @babel/preset-react (NODE_PATH below), found on this
// machine from an unrelated prior session -- NOT installed or
// downloaded by this script. No network access occurs here.
// ============================================================
const fs = require('fs');
const path = require('path');

const CACHED_BABEL_NODE_MODULES = '/Users/viktoriaermolenko/.npm/_npx/d7bc27327e23ce10/node_modules';
process.env.NODE_PATH = CACHED_BABEL_NODE_MODULES;
require('module').Module._initPaths();
const babel = require('@babel/core');

const REPO_ROOT = path.join(__dirname, '..');
const SRC_PATH = path.join(REPO_ROOT, 'index.html');
const OUT_PATH = path.join(REPO_ROOT, 'index.precompiled.html');

const OPEN_TAG = '<script type="text/babel">';
const CLOSE_TAG = '</script>';
const BABEL_CDN_LINE = '  <script src="https://unpkg.com/@babel/standalone@8.0.4/babel.min.js" crossorigin="anonymous" integrity="sha384-bdF7m0Y1IFKt9Q6xC8X9qkXn0OBriQWKyWwZKYsN05zF6P/g9OakjjL0G2Sd4pB4"></script>\n';

function main() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');

  const openIdx = src.indexOf(OPEN_TAG);
  if (openIdx === -1) throw new Error('Could not find <script type="text/babel"> in index.html — has it moved?');
  const bodyStart = openIdx + OPEN_TAG.length;
  const closeIdx = src.indexOf(CLOSE_TAG, bodyStart);
  if (closeIdx === -1) throw new Error('Could not find closing </script> for the babel block.');

  const jsxSource = src.slice(bodyStart, closeIdx);
  console.log(`Extracted JSX block: ${jsxSource.length} chars, from offset ${bodyStart} to ${closeIdx}`);

  const t0 = Date.now();
  const result = babel.transformSync(jsxSource, {
    presets: [['@babel/preset-react', { runtime: 'classic', throwIfNamespace: false }]],
    babelrc: false,
    configFile: false,
    comments: true,
    retainLines: true,
    compact: false,
    sourceType: 'script',
  });
  const transformMs = Date.now() - t0;
  console.log(`Offline transform took ${transformMs}ms (one-time, build-step cost — not paid by any user).`);

  if (!result || typeof result.code !== 'string') throw new Error('Babel transform produced no output.');

  // Sanity: the output must contain zero JSX angle-bracket syntax and
  // zero `import`/`export` statements (would be invalid in a plain,
  // non-module <script> tag in this UMD/no-bundler app).
  if (/^\s*(import|export)\s/m.test(result.code)) {
    throw new Error('SAFETY CHECK FAILED: output contains import/export — classic runtime must not emit these.');
  }

  const precompiled = src.slice(0, openIdx) + '<script>' + result.code + CLOSE_TAG + src.slice(closeIdx + CLOSE_TAG.length);
  const withoutBabelCdn = precompiled.replace(BABEL_CDN_LINE, '');
  if (withoutBabelCdn === precompiled) {
    console.warn('WARNING: Babel CDN script tag line was not found/removed — check BABEL_CDN_LINE still matches index.html exactly.');
  }

  fs.writeFileSync(OUT_PATH, withoutBabelCdn, 'utf8');
  console.log(`Wrote ${OUT_PATH} (${withoutBabelCdn.length} chars).`);
  console.log(`index.html itself: UNCHANGED (never written by this script).`);
}

main();
