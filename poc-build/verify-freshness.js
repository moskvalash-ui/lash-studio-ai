// Standalone staleness + TASK-03-fix-preservation check (TASK 10 item
// 4). Does NOT invoke Babel — just compares hashes/markers, so it is
// cheap enough to run before every test/deploy step.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '..');
const SRC_PATH = path.join(REPO_ROOT, 'index.html');
const MANIFEST_PATH = path.join(REPO_ROOT, 'publish', '.build-manifest.json');
const OPEN_TAG = '<script type="text/babel">';
const CLOSE_TAG = '</script>';

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('FAIL: no publish/.build-manifest.json found — run poc-build/build-publish.js first.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const openIdx = src.indexOf(OPEN_TAG);
  const bodyStart = openIdx + OPEN_TAG.length;
  const closeIdx = src.indexOf(CLOSE_TAG, bodyStart);
  const currentHash = sha256(src.slice(bodyStart, closeIdx));

  let ok = true;
  if (currentHash !== manifest.sourceJsxSha256) {
    console.error(`STALE: index.html's JSX block has changed since the last build.`);
    console.error(`  built against: ${manifest.sourceJsxSha256.slice(0, 16)}...`);
    console.error(`  current:       ${currentHash.slice(0, 16)}...`);
    console.error(`  -> re-run poc-build/build-publish.js`);
    ok = false;
  } else {
    console.log('OK: publish/ matches the current index.html JSX source exactly (sha256 match).');
  }

  const publishedHtml = fs.readFileSync(path.join(REPO_ROOT, 'publish', 'index.html'), 'utf8');
  const publishedLashScanCore = fs.readFileSync(path.join(REPO_ROOT, 'publish', 'lash-scan-core.js'), 'utf8');
  const checks = [
    ['TASK 03 fix #1 (tiltConfidence dampening)', publishedHtml.includes('const tiltBoundaryDampening = ')],
    ['TASK 03 fix #1 boundary constant', publishedHtml.includes('const TILT_BOUNDARY_DEG = 4;')],
    ['TASK 03 fix #2 (zoneDirection confidence gate)', publishedLashScanCore.includes('MIN_SPARSE_CONFIDENCE')],
  ];
  for (const [label, pass] of checks) {
    console.log(`${pass ? 'OK  ' : 'FAIL'}: ${label}`);
    if (!pass) ok = false;
  }

  console.log(`\nBuilt at: ${manifest.builtAt}`);
  console.log(`Compiler: @babel/core@${manifest.compiler.babelCore}, @babel/preset-react@${manifest.compiler.babelPresetReact} (pinned=${manifest.compiler.pinned})`);

  process.exit(ok ? 0 : 1);
}
main();
