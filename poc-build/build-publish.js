// ============================================================
// LASH STUDIO AI — PRODUCTION-READY BUILD (TASK 10)
// ------------------------------------------------------------
// Extends poc-build/build-precompile.js (TASK 09) with:
//   1. A full publish-directory assembly (relative paths intact —
//      every local script is a SIBLING of index.html, matching the
//      project's existing relative <script src="foo.js"> convention,
//      which already works correctly under the GitHub Pages project
//      subpath moskvalash-ui.github.io/lash-studio-ai/).
//   2. A build manifest (publish/.build-manifest.json) recording the
//      exact source hash of the extracted JSX block at build time, so
//      staleness can be detected later without re-running Babel.
//   3. A hard verification gate: the generated index.html must still
//      contain both TASK 03 fix markers, or the build FAILS LOUDLY
//      rather than silently shipping a regressed build.
//
// index.html is NEVER written here. Still read-only w.r.t. source.
//
// COMPILER NOTE (TASK 11 — RESOLVED): this build now uses a real,
// declared, exact-pinned local install (poc-build/package.json +
// package-lock.json, @babel/core@8.0.1 + @babel/preset-react@8.0.1,
// installed via `npm install --save-exact`). No npx cache, no
// unpinned/incidental dependency. `npm ci` against the committed
// lockfile reproduces this exact node_modules on any machine.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const babel = require('@babel/core');
const babelCoreVersion = require('@babel/core/package.json').version;
const babelPresetReactVersion = require('@babel/preset-react/package.json').version;

const REPO_ROOT = path.join(__dirname, '..');
const SRC_PATH = path.join(REPO_ROOT, 'index.html');
const PUBLISH_DIR = path.join(REPO_ROOT, 'publish');

const OPEN_TAG = '<script type="text/babel">';
const CLOSE_TAG = '</script>';
const BABEL_CDN_LINE = '  <script src="https://unpkg.com/@babel/standalone@8.0.4/babel.min.js" crossorigin="anonymous" integrity="sha384-bdF7m0Y1IFKt9Q6xC8X9qkXn0OBriQWKyWwZKYsN05zF6P/g9OakjjL0G2Sd4pB4"></script>\n';

// Local, dependency-free scripts that ship AS-IS (no JSX, not
// transformed) — siblings of index.html, relative <script src> paths
// already correct for the GH Pages project subpath.
const LOCAL_SCRIPTS = [
  'analytics.js', 'auto-lash-fit-hybrid-c.js', 'client-data-consent.js',
  'client-store.js', 'consent-manager.js', 'lash-design-domain.js',
  'lash-scan-core.js', 'photo-lash-preview.js', 'professional-lash-library.js',
  'visit-snapshot.js',
];

// TASK 03 fix markers — must survive the transform verbatim. If either
// is missing, the build must fail rather than silently ship a
// regressed artifact.
const REQUIRED_MARKERS = [
  { file: 'index.html (compiled)', text: 'const tiltBoundaryDampening = ' },
  { file: 'index.html (compiled)', text: 'const TILT_BOUNDARY_DEG = 4;' },
];
const REQUIRED_LOCAL_SCRIPT_MARKERS = [
  { file: 'lash-scan-core.js', text: 'MIN_SPARSE_CONFIDENCE' },
];

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function main() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');

  const openIdx = src.indexOf(OPEN_TAG);
  if (openIdx === -1) throw new Error('Could not find <script type="text/babel"> in index.html.');
  const bodyStart = openIdx + OPEN_TAG.length;
  const closeIdx = src.indexOf(CLOSE_TAG, bodyStart);
  if (closeIdx === -1) throw new Error('Could not find closing </script> for the babel block.');
  const jsxSource = src.slice(bodyStart, closeIdx);
  const sourceHash = sha256(jsxSource);

  console.log(`Compiler: @babel/core@${babelCoreVersion}, @babel/preset-react@${babelPresetReactVersion} (pinned, poc-build/package-lock.json)`);
  console.log(`Source JSX block: ${jsxSource.length} chars, sha256=${sourceHash.slice(0, 16)}...`);

  const result = babel.transformSync(jsxSource, {
    cwd: __dirname, // resolve presets relative to poc-build/node_modules, not process.cwd()
    presets: [['@babel/preset-react', { runtime: 'classic', throwIfNamespace: false }]],
    babelrc: false, configFile: false, comments: true, retainLines: true, compact: false, sourceType: 'script',
  });
  if (!result || typeof result.code !== 'string') throw new Error('Babel transform produced no output.');
  if (/^\s*(import|export)\s/m.test(result.code)) {
    throw new Error('SAFETY CHECK FAILED: output contains import/export.');
  }

  // Verify TASK 03 fix #1 (tiltConfidence dampening) survived.
  for (const m of REQUIRED_MARKERS) {
    if (!result.code.includes(m.text)) {
      throw new Error(`BUILD FAILED: required marker missing from ${m.file}: "${m.text}" — TASK 03 fix #1 may have been lost in transform.`);
    }
  }

  const compiledHtml = src.slice(0, openIdx) + '<script>' + result.code + CLOSE_TAG + src.slice(closeIdx + CLOSE_TAG.length);
  const finalHtml = compiledHtml.replace(BABEL_CDN_LINE, '');
  if (finalHtml === compiledHtml) {
    throw new Error('BUILD FAILED: Babel CDN script tag line not found/removed — index.html structure may have changed; update BABEL_CDN_LINE.');
  }

  // Assemble publish/ directory.
  fs.rmSync(PUBLISH_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLISH_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLISH_DIR, 'index.html'), finalHtml, 'utf8');

  for (const name of LOCAL_SCRIPTS) {
    const srcFile = path.join(REPO_ROOT, name);
    if (!fs.existsSync(srcFile)) throw new Error(`BUILD FAILED: expected local script missing: ${name}`);
    const content = fs.readFileSync(srcFile);
    // Verify TASK 03 fix #2 (zoneDirection confidence gate) survived
    // the verbatim copy (it should, trivially — but check anyway).
    for (const m of REQUIRED_LOCAL_SCRIPT_MARKERS) {
      if (m.file === name && !content.toString('utf8').includes(m.text)) {
        throw new Error(`BUILD FAILED: required marker missing from ${name}: "${m.text}" — TASK 03 fix #2 may be missing.`);
      }
    }
    fs.copyFileSync(srcFile, path.join(PUBLISH_DIR, name));
  }

  // Relative-path sanity: zero leading-slash local references in the
  // published index.html (GH Pages project-subpath safety).
  const leadingSlashRefs = [...finalHtml.matchAll(/(?:src|href)="\/(?!\/)/g)];
  if (leadingSlashRefs.length > 0) {
    throw new Error(`BUILD FAILED: ${leadingSlashRefs.length} root-relative (leading "/") asset reference(s) found — would break under the GH Pages project subpath.`);
  }

  const manifest = {
    builtAt: new Date().toISOString(),
    sourceJsxSha256: sourceHash,
    compiler: { babelCore: babelCoreVersion, babelPresetReact: babelPresetReactVersion, pinned: true, source: 'poc-build/package.json + package-lock.json (npm install --save-exact)' },
    requiredMarkersVerified: [...REQUIRED_MARKERS.map(m => m.text), ...REQUIRED_LOCAL_SCRIPT_MARKERS.map(m => m.text)],
    localScriptsCopied: LOCAL_SCRIPTS,
    outputDir: PUBLISH_DIR,
  };
  fs.writeFileSync(path.join(PUBLISH_DIR, '.build-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\nBUILD OK. publish/ assembled: index.html + ${LOCAL_SCRIPTS.length} local scripts + manifest.`);
  console.log(`Both TASK 03 fix markers verified present.`);
  console.log(`index.html (source): UNCHANGED.`);
}

main();
