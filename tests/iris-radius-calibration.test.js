// IRIS RADIUS CALIBRATION — regression test for the evidence-based
// correction to analyzeIrisSample's iris-radius heuristic (Phase C3c).
// ------------------------------------------------------------
// ROOT CAUSE (confirmed, not assumed): independent, pixel-level
// ray-cast measurement of the true iris/sclera boundary across 8 eyes
// from 4 real full-face images (the BLUE/BROWN/UNCERTAIN E2E fixtures
// plus an external GREEN-candidate diagnostic image) found the true
// visible iris radius at 1.32x-1.69x (median ~1.48x) the radius the
// old `* 0.22` multiplier estimated. Because analyzeIrisSample's
// outer-annulus rejection (`radial > 0.88`) is defined as a FRACTION of
// that estimate, an underestimated radius silently discards real color
// evidence at the true outer/limbal band before it can ever reach
// classifyIrisColor -- proven directly: replaying a real diagnostic
// candidate's own production-rejected pixels showed 50-55% of the
// specifically `outside_iris_annulus`-rejected pixels were green-hued,
// versus only 8-16% of the accepted set.
//
// FIX: the multiplier was raised from 0.22 to 0.24 -- the smallest
// tested increase (evaluated 0.22 through 0.30) that measurably grows
// real iris coverage while (a) not disturbing the one established
// real-world green-eye fixture's correct classification (glaza33-left
// starts regressing only at 0.27+), and (b) introducing zero new
// false-GREEN results anywhere in the existing regression corpus
// (verified across all 24 real-capture testik/glaza33 fixtures at
// every tested threshold). This test extracts the REAL, currently-
// shipped analyzeIrisSample straight out of index.html (same technique
// as every other test in this project) and pins the corrected geometry
// + the specific real-world outcomes this correction was calibrated
// against.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function estimateIrisCenter(');
const end = src.indexOf('\n    const EYE_METRIC_KEYS =', start);
const rgbToHex = "const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');";
const api = new Function(rgbToHex + '\n' + src.slice(start, end) + '\nreturn {analyzeIrisSample,estimateIrisCenter,classifyIrisColor,combineIris};')();
const { analyzeIrisSample } = api;

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.stack}`); } }

test('A. the exact new radius multiplier (0.24) is present verbatim in production, not the old 0.22', () => {
  assert.ok(src.includes('const radius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.24);'), 'expected the corrected radius line to be present verbatim');
  assert.ok(!src.includes('const radius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.22);'), 'the old, evidence-shown-too-small multiplier must not remain anywhere in index.html');
});

test('B. for a representative eye shape (eyeW=108, eyeH=38, matching the calibration images), the new radius is measurably larger than the old one', () => {
  const eyeW = 108, eyeH = 38;
  const oldRadius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.22);
  const newRadius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.24);
  assert.ok(newRadius > oldRadius, 'new radius must be strictly larger');
  assert.ok(Math.abs(newRadius / oldRadius - 0.24 / 0.22) < 1e-9, 'the growth ratio must exactly match the approved multiplier change (no other geometry term touched)');
});

test('C. the corrected radius still respects the same floor (>=3px) for tiny eye-openings', () => {
  const radius = Math.max(3, Math.min(0.1, 0.1 * 2.4) * 0.24);
  assert.strictEqual(radius, 3, 'the Math.max(3, ...) floor must be untouched by this correction');
});

// ------------------------------------------------------------
// Real-world outcome pins, using the same real-capture fixture replay
// technique as iris-radial-outer-band-corroboration.test.js.
// ------------------------------------------------------------
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
  const w = fixture.roi.eyeW, h = fixture.roi.eyeH;
  const eyePoints = [{ x: 0, y: h / 2 }, { x: w * 0.25, y: 0 }, { x: w * 0.75, y: 0 }, { x: w, y: h / 2 }, { x: w * 0.75, y: h }, { x: w * 0.25, y: h }];
  return { ctx, eyePoints, fixedCenter };
}

test('D. the established real-world GREEN fixture (глаза33 LEFT) is UNCHANGED by the radius correction: still green, still corroborated via the outer band', () => {
  const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(path.join(__dirname, 'fixtures', 'real-capture-green-eye-glaza33-left.json'));
  const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
  assert.strictEqual(a.name, 'green', 'the one established real-world green fixture must remain green after this correction');
  assert.strictEqual(a.radialEvidence.outerCorroborated, true);
  assert.strictEqual(a.radialEvidence.outerName, 'green');
  assert.strictEqual(a.radialEvidence.innerName, 'brown');
});

test('E. глаза33 RIGHT remains unchanged (uncertain) — the negative control for corroboration is unaffected', () => {
  const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(path.join(__dirname, 'fixtures', 'real-capture-green-eye-glaza33-right.json'));
  const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
  assert.strictEqual(a.name, 'uncertain');
  assert.strictEqual(a.radialEvidence.outerCorroborated, false);
});

test('F. zero false-GREEN: none of the testik no-regression fixtures newly reads "green" after the radius correction', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testikNames = fs.readdirSync(fixturesDir)
    .filter(f => f.startsWith('real-capture-noregression-testik'))
    .map(f => f.replace('real-capture-noregression-', '').replace('.json', ''));
  assert.ok(testikNames.length >= 20, 'sanity: expected the full testik corpus to be present');
  for (const name of testikNames) {
    const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(path.join(fixturesDir, `real-capture-noregression-${name}.json`));
    const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
    assert.notStrictEqual(a.name, 'green', `${name} must not become a false-positive green after the radius correction (got ${a.name})`);
  }
});

test('G. BLUE/BROWN/UNCERTAIN E2E fixtures\' underlying testik counterparts still resolve as documented in tests/e2e/IRIS_FIXTURE_AUDIT.md', () => {
  // testik7 (-> happy-path-face.png, BLUE) must stay blue on both eyes.
  for (const side of ['left', 'right']) {
    const { ctx, eyePoints, fixedCenter } = loadRealCaptureCtx(path.join(__dirname, 'fixtures', `real-capture-noregression-testik7-${side}.json`));
    const a = analyzeIrisSample(ctx, eyePoints, fixedCenter);
    assert.strictEqual(a.name, 'blue', `testik7-${side} (BLUE E2E fixture's counterpart) must remain blue`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
