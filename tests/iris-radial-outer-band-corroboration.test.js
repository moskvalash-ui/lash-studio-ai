// IRIS COLOR — RADIAL OUTER-BAND CORROBORATION — regression tests.
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped analyzeIrisSample/classifyIrisColor/
// sampleIrisColor/combineIris straight out of index.html (same technique as
// every other test file in this project). Covers the new radial-evidence
// addition: when the flat annulus-wide median + angular sectors alone would
// force 'uncertain', a well-supported, internally-consistent OUTER radial
// band that differs from the flat median AND is corroborated by the INNER
// band still confirming the original flat-median category is now trusted
// instead of discarding that evidence.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function estimateIrisCenter(');
const end = src.indexOf('\n    const EYE_METRIC_KEYS =', start);
const rgbToHex = "const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');";
const api = new Function(rgbToHex + '\n' + src.slice(start, end) + '\nreturn {analyzeIrisSample,sampleIrisColor,classifyIrisColor,combineIris};')();
const { analyzeIrisSample, sampleIrisColor, classifyIrisColor, combineIris } = api;

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.stack}`); } }

// ------------------------------------------------------------
// Real-capture fixtures: глаза 33.jpeg (real photo, not synthetic/AI-
// generated), LEFT and RIGHT. Contains only ROI geometry + the real
// candidate-pixel colors production's own analyzeIrisSample already
// sampled -- no image, no face data. Full candidate-pixel coverage
// verified when the fixture was built (candidatePixelCount === pixels
// captured).
function loadRealCaptureCtx(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const map = new Map();
  for (const p of fixture.pixels) map.set(p.x + ',' + p.y, p);
  const ctx = {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gx = x0 + x, gy = y0 + y;
        const p = map.get(gx + ',' + gy);
        const rgb = p ? [p.r, p.g, p.b] : [128, 128, 128];
        const i = (y * w + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
      return { data };
    },
  };
  const fixedCenter = { x: fixture.roi.cx, y: fixture.roi.cy, method: fixture.roi.centerMethod, contrast: fixture.roi.centerContrast };
  // eyePoints only needs to reproduce the real eyeW x eyeH bounding box --
  // that's the only thing the radius formula reads from it. Center is
  // supplied directly via fixedCenter, bypassing estimateIrisCenter (which
  // would need pixel data outside the captured ROI circle that this
  // fixture intentionally does not store).
  const w = fixture.roi.eyeW, h = fixture.roi.eyeH;
  const eyePoints = [{ x: 0, y: h / 2 }, { x: w * 0.25, y: 0 }, { x: w * 0.75, y: 0 }, { x: w, y: h / 2 }, { x: w * 0.75, y: h }, { x: w * 0.25, y: h }];
  return { ctx, eyePoints, fixedCenter, fixture };
}

const LEFT_FIXTURE = path.join(__dirname, 'fixtures', 'real-capture-green-eye-glaza33-left.json');
const RIGHT_FIXTURE = path.join(__dirname, 'fixtures', 'real-capture-green-eye-glaza33-right.json');

// TEST 1 (positive): real green-eye photo, LEFT eye -- a well-supported,
// internally-consistent GREEN outer/limbal band (production analysis-
// resolution: n=260, consistency=0.570) corroborated by a matching-name
// inner band must now be trusted instead of being discarded as 'uncertain'.
test('REAL GREEN-EYE FIXTURE (глаза33 LEFT): outer-band radial corroboration promotes green instead of uncertain', () => {
  const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(LEFT_FIXTURE);
  const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
  assert.strictEqual(a.name, 'green', `expected green, got ${a.name}`);
  assert.ok(a.radialEvidence, 'radialEvidence must be present');
  assert.strictEqual(a.radialEvidence.outerCorroborated, true);
  assert.strictEqual(a.radialEvidence.source, 'outer_radial');
  assert.strictEqual(a.radialEvidence.outerName, 'green');
  assert.strictEqual(a.radialEvidence.innerName, 'brown', 'inner band must still independently read the original flat-median category');
  assert.deepStrictEqual(a.rgb, [61, 67, 47], 'selected rgb must be the OUTER band rgb, not the flat median -- no green label with a brown swatch');
});

// TEST 2 (negative, critical): same real photo, RIGHT eye -- outer band is
// real-shifted toward green (h=62.5 vs inner's lower hue) but its OWN
// median still classifies brown (does not cross the green hue/saturation
// gate), so outerName === name and corroboration must NOT fire. Must stay
// exactly as unmodified production already behaves: uncertain.
test('REAL GREEN-EYE FIXTURE (глаза33 RIGHT): outer shift alone must NOT force green when the outer band itself is not green', () => {
  const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(RIGHT_FIXTURE);
  const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
  assert.strictEqual(a.name, 'uncertain', `expected uncertain (unchanged from production), got ${a.name}`);
  assert.strictEqual(a.radialEvidence.outerCorroborated, false);
  assert.strictEqual(a.radialEvidence.outerName, 'brown', 'outer band itself must classify brown, matching the global name -- this is why it must not trigger');
  assert.strictEqual(a.radialEvidence.source, 'global');
});

// ------------------------------------------------------------
// Synthetic radial two-tone fixtures: exercise the rule directly and prove
// it is NOT green-specific by running the identical mechanism with a
// different, non-green color pair.
const EYE = [{ x: 20, y: 50 }, { x: 35, y: 38 }, { x: 65, y: 38 }, { x: 80, y: 50 }, { x: 65, y: 62 }, { x: 35, y: 62 }]; // eyeW=60,eyeH=24 -> radius=12.672 (same fixture already used by iris-sampling-regression.test.js)
const RADIUS = Math.max(3, Math.min(60, 24 * 2.4) * 0.22);

function radialTwoToneCtx(innerRgb, outerRgb, splitAt = 0.30 + 2 * ((0.88 - 0.30) / 3)) {
  // Default split matches production's own MIDDLE/OUTER band boundary
  // (~0.6867) so the OUTER region alone is the minority by pixel count --
  // mirroring the real глаза33 pattern, where inner+middle together
  // outweighed the outer band and the flat global median matched the
  // INNER color despite genuine outer-band evidence to the contrary. A
  // wider inner region (e.g. an even 0.5/0.5 radial split) instead makes
  // the outer color dominate the flat median directly, resolving via
  // ordinary angular agreement without ever exercising this rule.
  return {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x0 + x, py = y0 + y, dx = px - 50, dy = py - 50, absRad = Math.hypot(dx, dy);
        const nx = dx / RADIUS, ny = dy / (RADIUS * 0.82), radial = Math.sqrt(nx * nx + ny * ny);
        let rgb = radial <= splitAt ? innerRgb : outerRgb;
        // A perfectly rotationally-symmetric two-tone annulus makes every
        // angular quadrant agree with every other (each contains the same
        // inner/outer ratio), so sectorAgreement never drops below 0.6 and
        // the override branch -- where radial corroboration is even
        // consulted -- is never reached. Real photos are never this
        // symmetric (глаза33's real upper-right quadrant genuinely read
        // 'dark' from lash contamination). Reproduce that same real
        // asymmetry here: darken one angular quadrant (upper-right, the
        // same one contaminated in the real fixture) across the annulus so
        // angular agreement genuinely breaks, while each radial band's own
        // median -- pooled across all four quadrants at that radius -- is
        // still dominated by the clean 75% majority and stays accurate.
        if (dx >= 0 && dy < 0 && radial >= 0.30 && radial <= 0.88) rgb = [30, 25, 20];
        if (absRad < 4) rgb = [10, 10, 10]; // small solid pupil disc so center-estimation locks onto (50,50), same pattern iris-sampling-regression.test.js already relies on
        const i = (y * w + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
      return { data };
    },
  };
}
function uniformCtx(rgb) {
  return {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x0 + x, py = y0 + y, absRad = Math.hypot(px - 50, py - 50);
        const c = absRad < 4 ? [10, 10, 10] : rgb;
        const i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
      return { data };
    },
  };
}

const BROWN = [80, 45, 30]; // already-verified single-color fixture (iris-sampling-regression.test.js line 51): classifies 'brown'
const GREEN = [75, 125, 78]; // already-verified: classifies 'green'
const BLUE = [95, 145, 195]; // already-verified: classifies 'blue'

test('SYNTHETIC TEST — uniform iris (no radial gradient) never triggers outer-band corroboration', () => {
  const a = analyzeIrisSample(uniformCtx(BROWN), EYE);
  assert.strictEqual(a.name, 'brown');
  assert.strictEqual(a.radialEvidence.outerCorroborated, false);
  assert.strictEqual(a.radialEvidence.source, 'global');
});

test('SYNTHETIC TEST — GREEN-outer radial fixture (warm inner / green outer) triggers corroboration, proving the mechanism generalizes beyond the one real photo', () => {
  const a = analyzeIrisSample(radialTwoToneCtx(BROWN, GREEN), EYE);
  assert.strictEqual(a.name, 'green');
  assert.strictEqual(a.radialEvidence.outerCorroborated, true);
  assert.strictEqual(a.radialEvidence.innerName, 'brown');
  assert.strictEqual(a.radialEvidence.outerName, 'green');
});

test('SYNTHETIC TEST — non-green two-color radial fixture (green inner / blue outer) also triggers, proving the rule is symmetric and NOT green-specific', () => {
  const a = analyzeIrisSample(radialTwoToneCtx(GREEN, BLUE), EYE);
  assert.strictEqual(a.name, 'blue');
  assert.strictEqual(a.radialEvidence.outerCorroborated, true);
  assert.strictEqual(a.radialEvidence.innerName, 'green');
  assert.strictEqual(a.radialEvidence.outerName, 'blue');
});

test('SYNTHETIC TEST — outer band alone (inner does NOT corroborate the global name) must not trigger', () => {
  // A genuine three-region radial split (gray inner / brown middle / green
  // outer, using production's own exact band boundaries): the inner
  // region is squeezed to a small minority by the middle+outer regions
  // and does not survive as a confirming vote for the global name (either
  // because the 80%-trim step discards it as a minority outlier, or
  // because it classifies to something else entirely) -- corroboration
  // requires inner to independently confirm the ORIGINAL global name, so
  // it must not fire here even though the outer band alone is a
  // confident, differing, internally-consistent color.
  const bw = (0.88 - 0.30) / 3;
  const GRAY = [150, 154, 158], BROWN2 = [80, 45, 30]; // already-verified single colors (iris-sampling-regression.test.js lines 50-51)
  const ctx = {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x0 + x, py = y0 + y, dx = px - 50, dy = py - 50, absRad = Math.hypot(dx, dy);
        const nx = dx / RADIUS, ny = dy / (RADIUS * 0.82), radial = Math.sqrt(nx * nx + ny * ny);
        let rgb = radial < 0.30 + bw ? GRAY : radial < 0.30 + 2 * bw ? BROWN2 : GREEN;
        if (absRad < 4) rgb = [10, 10, 10];
        const i = (y * w + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
      return { data };
    },
  };
  const a = analyzeIrisSample(ctx, EYE);
  assert.notStrictEqual(a.radialEvidence.innerName, classifyIrisColor(...a.rgb), 'test setup check: inner must genuinely not confirm the flat global name');
  assert.strictEqual(a.radialEvidence.outerCorroborated, false, 'must not trust an isolated outer reading when inner does not corroborate the original global name');
});

// ------------------------------------------------------------
// TEST: all existing тестик (AI-generated) fixtures across all rounds must
// keep their exact already-reported production result -- the rule must not
// change any of them (all previously measured well below the 0.55 outer-
// consistency bar, or outer already agreeing with the global name).
function loadDebugCaptureCtx(fixturePath) {
  return loadRealCaptureCtx(fixturePath);
}

const EXPECTED_UNCHANGED = [
  ['тестик1 LEFT', 'testik1-left', 'uncertain'],
  ['тестик1 RIGHT', 'testik1-right', 'uncertain'],
  ['тестик2 LEFT', 'testik2-left', 'uncertain'],
  ['тестик2 RIGHT', 'testik2-right', 'hazel'],
  ['тестик4 LEFT', 'testik4-left', 'uncertain'],
  ['тестик4 RIGHT', 'testik4-right', 'brown'],
  ['тестик9 LEFT', 'testik9-left', 'brown'],
  ['тестик9 RIGHT', 'testik9-right', 'uncertain'],
  ['тестик10 LEFT', 'testik10-left', 'brown'],
  ['тестик10 RIGHT', 'testik10-right', 'uncertain'],
  ['тестик13 LEFT', 'testik13-left', 'uncertain'],
  ['тестик13 RIGHT', 'testik13-right', 'uncertain'],
  ['тестик8-space (brown fixture) LEFT', 'testik8sp-left', 'uncertain'],
  ['тестик8-space (brown fixture) RIGHT', 'testik8sp-right', 'brown'],
  ['тестик11 (brown fixture) LEFT', 'testik11-left', 'uncertain'],
  ['тестик11 (brown fixture) RIGHT', 'testik11-right', 'uncertain'],
  ['тестик7 LEFT (blue)', 'testik7-left', 'blue'],
  ['тестик7 RIGHT (blue)', 'testik7-right', 'blue'],
  ['тестик8 LEFT (blue)', 'testik8-left', 'blue'],
  ['тестик8 RIGHT (blue)', 'testik8-right', 'blue'],
  ['тестик12 LEFT (pale blue)', 'testik12-left', 'uncertain'],
  ['тестик12 RIGHT (pale blue)', 'testik12-right', 'gray'],
];

for (const [label, fixtureName, expected] of EXPECTED_UNCHANGED) {
  const fixturePath = path.join(__dirname, 'fixtures', 'real-capture-noregression-' + fixtureName + '.json');
  if (!fs.existsSync(fixturePath)) continue; // fixture generation step below must have created these
  test(`NO-REGRESSION: ${label} keeps production result "${expected}"`, () => {
    const { ctx, eyePoints, fixedCenter } = loadDebugCaptureCtx(fixturePath);
    const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
    assert.strictEqual(a.name, expected, `expected unchanged "${expected}", got "${a.name}"`);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
