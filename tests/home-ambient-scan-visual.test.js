// ============================================================
// HOME AMBIENT SCAN VISUAL — regression tests.
// ------------------------------------------------------------
// AmbientScanVisual is a purely decorative HomeScreen component (static
// SVG + CSS animation, no props, no tracking/analysis data). It is
// deliberately separate from the real V2 scanner overlay module
// (drawFaceMeshV3/drawScanBeam/drawIrisMicroScan/etc.) used by
// LiveScanScreen/PhotoAnalysisScreen.
//
// Since it's JSX inside a closure (not a requirable module), this file
// follows the established pattern used elsewhere in this repo
// (camera-preview.test.js etc.): static source-guard assertions against
// the real index.html text, string-sliced between named markers.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

function slice(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end !== -1, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

const ambientComponentSrc = slice(
  'function AmbientScanVisual() {',
  'function ConsentToggleRow('
);

const homeScreenSrc = slice(
  'function HomeScreen({ onLive, onPhoto, modelsLoaded, loadError, onRetry, onClients, onLibrary }) {',
  'function CreaseV2Plot('
);

test('A. AmbientScanVisual is defined exactly once, taking no props', () => {
  const matches = src.match(/function AmbientScanVisual\(\s*\)\s*\{/g) || [];
  assert.strictEqual(matches.length, 1, 'AmbientScanVisual should be defined exactly once');
  assert.ok(/function AmbientScanVisual\(\s*\)\s*\{/.test(ambientComponentSrc), 'AmbientScanVisual should take zero parameters');
});

test('B. AmbientScanVisual references no tracking/analysis identifiers (structurally decoration-only)', () => {
  const forbidden = [
    'modelsLoaded', 'landmarks', 'physicalLeft', 'physicalRight', 'getUserMedia',
    'requestAnimationFrame', 'videoRef', 'canvasRef', 'getContext', 'classifyFeatures',
    'rankDesigns', 'sampleIrisColor', 'combineIris', 'onComplete', 'analyze(',
  ];
  for (const token of forbidden) {
    assert.ok(!ambientComponentSrc.includes(token), `AmbientScanVisual must not reference "${token}"`);
  }
});

test('C. AmbientScanVisual root element pins dir="ltr" (RTL geometry isolation convention)', () => {
  assert.ok(/<div dir="ltr" aria-hidden="true" className="ambient-scan-visual/.test(ambientComponentSrc));
});

test('D. AmbientScanVisual reuses the existing .scan-line sweep and design tokens only (no new color literals)', () => {
  assert.ok(ambientComponentSrc.includes('scan-line'), 'should reuse the existing .scan-line sweep class');
  assert.ok(ambientComponentSrc.includes('className="ambient-scan-glow'), 'glow layer present');
  assert.ok(ambientComponentSrc.includes('className="ambient-scan-mesh'), 'mesh layer present');
  // Only reuses already-established token hex values (accent #0A8CFF / rgba forms), introduces none new.
  const hexLiterals = ambientComponentSrc.match(/#[0-9A-Fa-f]{6}/g) || [];
  assert.deepStrictEqual(hexLiterals, [], 'no raw new hex colors — must use text-accent/text-cyan tokens or rgba(10,140,255,...) derived from the accent token');
});

test('E. CSS defines ambientPulse/ambientMeshFade keyframes and a prefers-reduced-motion override', () => {
  assert.ok(src.includes('@keyframes ambientPulse'), 'ambientPulse keyframes missing');
  assert.ok(src.includes('@keyframes ambientMeshFade'), 'ambientMeshFade keyframes missing');
  const reduceMotionBlock = slice(
    '@media (prefers-reduced-motion: reduce) {\n      .ambient-scan-visual .ambient-scan-glow,',
    '}\n    @keyframes fadeIn'
  );
  assert.ok(reduceMotionBlock.includes('.ambient-scan-visual .ambient-scan-glow'));
  assert.ok(reduceMotionBlock.includes('.ambient-scan-visual .ambient-scan-mesh'));
  assert.ok(reduceMotionBlock.includes('.ambient-scan-visual.scan-line::after'));
  assert.ok(reduceMotionBlock.includes('animation: none'));
});

test('F. HomeScreen renders AmbientScanVisual exactly once, with no props, inside the centered hero block', () => {
  const matches = homeScreenSrc.match(/<AmbientScanVisual\s*\/>/g) || [];
  assert.strictEqual(matches.length, 1, 'HomeScreen should render <AmbientScanVisual /> exactly once');
  const heroBlockIdx = homeScreenSrc.indexOf('flex-1 flex flex-col justify-center');
  const visualIdx = homeScreenSrc.indexOf('<AmbientScanVisual />');
  const headingIdx = homeScreenSrc.indexOf("t('heroHeadingL1', lang)");
  assert.ok(heroBlockIdx !== -1 && visualIdx > heroBlockIdx, 'AmbientScanVisual should be inside the centered hero block');
  assert.ok(visualIdx < headingIdx, 'AmbientScanVisual should render before the hero heading, not after');
});

test('G. HomeScreen\'s existing modelsLoaded gating on the Live Scan / Photo Analysis CTAs is unchanged', () => {
  assert.ok(homeScreenSrc.includes("onClick={onLive} disabled={!modelsLoaded}"));
  assert.ok(homeScreenSrc.includes("onClick={onPhoto} disabled={!modelsLoaded}"));
});

test('H. HomeScreen\'s onboarding dialog wiring is unchanged', () => {
  assert.ok(homeScreenSrc.includes('{onboardingOpen && <OnboardingDialog onClose={closeOnboarding} onStart={onLive} modelsLoaded={modelsLoaded} loadError={loadError} onRetry={onRetry} />}'));
});

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
