// IRIS COLOR — PERCENTAGE COMPOSITION MODEL (Phase C3d) — regression
// tests. Extracts the REAL, currently-shipped composition functions
// straight out of index.html (same technique as every other test in
// this project) -- classifyIrisColorFamilyWeights, computeIrisColorComposition,
// combineIrisColorComposition, deriveIrisColorCompositionLabel,
// formatIrisColorCompositionBreakdown, resolveIrisColorLabel, plus the
// existing, UNTOUCHED analyzeIrisSample/classifyIrisColor/combineIris/
// sampleIrisColor pipeline these compose with.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function estimateIrisCenter(');
const end = src.indexOf('\n    const EYE_METRIC_KEYS =', start);
const rgbToHex = "const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');";
const api = new Function(rgbToHex + '\n' + src.slice(start, end) + `
return {
  analyzeIrisSample, classifyIrisColor, combineIris, sampleIrisColor, rgbToHsl,
  classifyIrisColorFamilyWeights, computeIrisColorComposition, combineIrisColorComposition,
  deriveIrisColorCompositionLabel, formatIrisColorCompositionBreakdown, resolveIrisColorLabel,
  IRIS_NAMES, IRIS_FAMILY_NAMES, IRIS_COMBO_NAMES,
};`)();
const {
  analyzeIrisSample, sampleIrisColor,
  classifyIrisColorFamilyWeights, computeIrisColorComposition, combineIrisColorComposition,
  deriveIrisColorCompositionLabel, formatIrisColorCompositionBreakdown, resolveIrisColorLabel,
  IRIS_NAMES, IRIS_FAMILY_NAMES, IRIS_COMBO_NAMES,
} = api;

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.stack}`); } }

// ------------------------------------------------------------
// Synthetic single-eye contexts, matching the pattern already used by
// iris-radial-outer-band-corroboration.test.js's own synthetic tests.
// ------------------------------------------------------------
const EYE = [{ x: 20, y: 50 }, { x: 35, y: 38 }, { x: 65, y: 38 }, { x: 80, y: 50 }, { x: 65, y: 62 }, { x: 35, y: 62 }];
function solidCtx(rgb) {
  return {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x0 + x, py = y0 + y, absRad = Math.hypot(px - 50, py - 50);
        const c = absRad < 4 ? [10, 10, 10] : rgb;
        const i = (y * w + x) * 4; data[i] = c[0]; data[i+1] = c[1]; data[i+2] = c[2]; data[i+3] = 255;
      }
      return { data };
    },
  };
}
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
        const i = (y * w + x) * 4; data[i] = rgb[0]; data[i+1] = rgb[1]; data[i+2] = rgb[2]; data[i+3] = 255;
      }
      return { data };
    },
  };
  const fixedCenter = { x: fixture.roi.cx, y: fixture.roi.cy, method: fixture.roi.centerMethod, contrast: fixture.roi.centerContrast };
  const w = fixture.roi.eyeW, h = fixture.roi.eyeH;
  const eyePoints = [{ x: 0, y: h/2 }, { x: w*0.25, y: 0 }, { x: w*0.75, y: 0 }, { x: w, y: h/2 }, { x: w*0.75, y: h }, { x: w*0.25, y: h }];
  return { ctx, eyePoints, fixedCenter };
}

// ------------------------------------------------------------
// A. Normalization
// ------------------------------------------------------------
test('A1. composition percentages always sum to 1.0 (100%) for a real, well-populated eye', () => {
  const a = analyzeIrisSample(solidCtx([75, 125, 78]), EYE); // green
  const comp = computeIrisColorComposition(a.accepted, a.roi);
  const sum = Object.values(comp).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `expected composition to sum to 1, got ${sum}`);
});

test('A2. combineIrisColorComposition also sums to 1.0 after a confidence-weighted blend', () => {
  const l = analyzeIrisSample(solidCtx([75, 125, 78]), EYE);
  const r = analyzeIrisSample(solidCtx([80, 45, 30]), EYE);
  const lComp = computeIrisColorComposition(l.accepted, l.roi);
  const rComp = computeIrisColorComposition(r.accepted, r.roi);
  const combined = combineIrisColorComposition(lComp, l.confidence, rComp, r.confidence);
  const sum = Object.values(combined).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `expected combined composition to sum to 1, got ${sum}`);
});

// ------------------------------------------------------------
// B. Breakdown formatting
// ------------------------------------------------------------
test('B1. formatIrisColorCompositionBreakdown hides zero-percent families and rounds to whole numbers', () => {
  const rows = formatIrisColorCompositionBreakdown({ green: 0.472, gray: 0.339, brown: 0.189, amber: 0, blue: 0 });
  assert.strictEqual(rows.length, 3, 'expected exactly 3 non-zero families (amber/blue rounded/actual zero must be hidden)');
  assert.ok(rows.every(([, pct]) => Number.isInteger(pct)), 'percentages must be whole numbers, never fake decimal precision');
  assert.ok(rows.every(([, pct]) => pct > 0), 'no 0% entry may be returned');
});

test('B2. formatIrisColorCompositionBreakdown returns at most the top 4 families, largest first', () => {
  const rows = formatIrisColorCompositionBreakdown({ green: 0.30, gray: 0.25, brown: 0.20, amber: 0.15, blue: 0.10 });
  assert.strictEqual(rows.length, 4, 'must cap at top 4, dropping the smallest (blue)');
  const pcts = rows.map(([, pct]) => pct);
  assert.deepStrictEqual([...pcts].sort((a, b) => b - a), pcts, 'must be sorted largest-first');
  assert.ok(!rows.some(([family]) => family === 'blue'), 'the 5th-largest family must be dropped, not the 5th-listed');
});

test('B3. a rounds-to-zero family (e.g. 0.3%) is correctly hidden, not shown as "0%"', () => {
  const rows = formatIrisColorCompositionBreakdown({ green: 0.994, gray: 0.003, brown: 0.003, amber: 0, blue: 0 });
  assert.ok(!rows.some(([, pct]) => pct === 0), 'a family rounding to 0% must never appear in the breakdown');
});

// ------------------------------------------------------------
// C. Low-chroma pixels must not falsely dominate real color evidence
// ------------------------------------------------------------
test('C1. low-chroma pixels do not overwhelm strong, unambiguous color evidence', () => {
  // Same pattern as classifyIrisColorFamilyWeights' own design intent:
  // a solidly-colored (chroma>=20) synthetic iris must read overwhelmingly
  // as its own family, not diluted toward gray.
  const a = analyzeIrisSample(solidCtx([75, 125, 78]), EYE); // green, chroma=50
  const comp = computeIrisColorComposition(a.accepted, a.roi);
  assert.ok(comp.green > 0.85, `expected green to dominate a solidly-colored synthetic iris, got green=${comp.green}`);
  assert.ok(comp.gray < 0.15, `expected gray to stay a small minority for strong color evidence, got gray=${comp.gray}`);
});

test('C2. a genuinely low-chroma (near-achromatic) pixel population correctly reads mostly as gray, not forced into a hue family', () => {
  const weights = classifyIrisColorFamilyWeights(100, 102, 99); // chroma=3, effectively neutral
  assert.ok(weights.gray > 0.9, `expected a near-achromatic pixel to read almost entirely gray, got gray=${weights.gray}`);
});

test('C3. hue reliability ramps smoothly (no hard cliff) around the classifyIrisColor gray boundary (chroma=10)', () => {
  const atBoundary = classifyIrisColorFamilyWeights(105, 100, 95); // chroma=10 -> hueReliability=0 (all gray)
  const midRamp = classifyIrisColorFamilyWeights(107, 100, 94); // chroma=13 -> partway up the ramp
  const fullyReliable = classifyIrisColorFamilyWeights(108, 100, 92); // chroma=16 -> hueReliability=1 (no gray)
  assert.strictEqual(atBoundary.gray, 1, 'sanity: exactly at classifyIrisColor\'s own gray cutoff, all weight is gray');
  assert.strictEqual(fullyReliable.gray, 0, 'sanity: comfortably above the ramp, weight is fully in the hue family');
  assert.ok(midRamp.gray > 0 && midRamp.gray < 1, `expected a genuine intermediate value on the ramp, got gray=${midRamp.gray} (a hard cliff would only ever produce exactly 0 or 1)`);
});

// ------------------------------------------------------------
// D. Known-category compositions (real E2E fixture behavior, verified
// live against the real production app during implementation; pinned
// here at the unit level via the same solid-color synthetic pattern
// iris-radial-outer-band-corroboration.test.js already established for
// BROWN/GREEN/BLUE single-color sanity checks).
// ------------------------------------------------------------
test('D1. BLUE composition: a solidly blue iris composes as clearly Blue-dominant, matching canonical category', () => {
  const a = analyzeIrisSample(solidCtx([95, 145, 195]), EYE); // already-verified 'blue' fixture (iris-sampling-regression.test.js)
  assert.strictEqual(a.name, 'blue', 'sanity: canonical category must still be blue, unchanged by this phase');
  const comp = computeIrisColorComposition(a.accepted, a.roi);
  assert.ok(comp.blue >= 0.60, `expected blue to clear the strong-dominant threshold, got ${comp.blue}`);
  const label = deriveIrisColorCompositionLabel(comp, a.name);
  assert.strictEqual(label, 'blue');
  assert.deepStrictEqual(resolveIrisColorLabel(label), IRIS_NAMES.blue, 'a strong-dominant label must resolve to the existing, protected IRIS_NAMES.blue entry');
});

test('D2. BROWN composition: a solidly brown iris composes as clearly Brown-dominant, matching canonical category', () => {
  const a = analyzeIrisSample(solidCtx([80, 45, 30]), EYE); // already-verified 'brown' fixture
  assert.strictEqual(a.name, 'brown');
  const comp = computeIrisColorComposition(a.accepted, a.roi);
  assert.ok(comp.brown >= 0.60, `expected brown to clear the strong-dominant threshold, got ${comp.brown}`);
  const label = deriveIrisColorCompositionLabel(comp, a.name);
  assert.strictEqual(label, 'brown');
});

test('D3. GREEN composition: a solidly green iris composes as clearly Green-dominant, matching canonical category', () => {
  const a = analyzeIrisSample(solidCtx([75, 125, 78]), EYE); // already-verified 'green' fixture
  assert.strictEqual(a.name, 'green');
  const comp = computeIrisColorComposition(a.accepted, a.roi);
  assert.ok(comp.green >= 0.60, `expected green to clear the strong-dominant threshold, got ${comp.green}`);
  const label = deriveIrisColorCompositionLabel(comp, a.name);
  assert.strictEqual(label, 'green');
});

// ------------------------------------------------------------
// E. Two-family combination labels
// ------------------------------------------------------------
// NOTE: per the C3d consistency fix, a composition-derived combo/mixture
// label can only ever emerge when the CANONICAL category is 'mixed' --
// for any other confident single-color canonical category (including
// 'green'/'blue' below), the canonical category itself is always the
// primary label, unconditionally (see section G3/G4). These two tests
// therefore use canonical='mixed' deliberately, to exercise the combo-
// derivation logic itself in the one case it's actually reachable.
test('E1. gray-green composition produces the "grayGreen" combo label with a real (non-synthetic) two-family split, when canonical category is mixed', () => {
  const comp = { green: 0.47, gray: 0.34, brown: 0.10, amber: 0.06, blue: 0.03 };
  const label = deriveIrisColorCompositionLabel(comp, 'mixed');
  assert.strictEqual(label, 'grayGreen');
  assert.deepStrictEqual(resolveIrisColorLabel(label), IRIS_COMBO_NAMES.grayGreen);
  assert.strictEqual(IRIS_COMBO_NAMES.grayGreen.ru, 'Серо-зелёный оттенок');
  assert.strictEqual(IRIS_COMBO_NAMES.grayGreen.en, 'Gray-green');
});

test('E2. blue-gray composition produces the "blueGray" combo label, when canonical category is mixed', () => {
  const comp = { blue: 0.55, gray: 0.35, brown: 0.05, amber: 0.03, green: 0.02 };
  const label = deriveIrisColorCompositionLabel(comp, 'mixed');
  assert.strictEqual(label, 'blueGray');
});

test('E3. a roughly-balanced green+brown/amber mixture UNDER A MIXED CANONICAL CATEGORY reads as the "hazel" idiom, not a bare Green-brown label', () => {
  const comp = { green: 0.42, brown: 0.38, gray: 0.12, amber: 0.05, blue: 0.03 };
  const label = deriveIrisColorCompositionLabel(comp, 'mixed');
  assert.strictEqual(label, 'hazel', 'a roughly-balanced (42/38) green/brown split must read as hazel, per the documented balance rule');
  assert.deepStrictEqual(resolveIrisColorLabel(label), IRIS_NAMES.hazel, 'hazel must reuse the existing, protected IRIS_NAMES.hazel entry, not a new one');
});

test('E3b. that SAME composition, if the canonical category were already the confident single-color "hazel" (not mixed), must stay hazel directly via passthrough -- not re-derived', () => {
  const comp = { green: 0.42, brown: 0.38, gray: 0.12, amber: 0.05, blue: 0.03 };
  const label = deriveIrisColorCompositionLabel(comp, 'hazel');
  assert.strictEqual(label, 'hazel');
});

test('E4. a LOPSIDED green+amber mixture (one side clearly dominant WITHIN THE PAIR, but not strong enough to be a pure single-family label on its own) reads as the specific "Green-amber" label instead of overclaiming hazel', () => {
  // amber=0.55 deliberately stays BELOW the 0.60 strong-dominant bar
  // (so this exercises the two-family branch, not the simpler single-
  // dominant branch), while still being lopsided WITHIN the pair itself
  // (0.55 / (0.55+0.20) = 73%, above the 70% balance cutoff).
  const comp = { amber: 0.55, green: 0.20, gray: 0.15, brown: 0.07, blue: 0.03 };
  const label = deriveIrisColorCompositionLabel(comp, 'mixed');
  assert.strictEqual(label, 'greenAmber', 'a lopsided (55/20) pair must not be reported as balanced hazel');
});

test('E5. UNDER A MIXED CANONICAL CATEGORY, a family that is already strong-dominant on its own (>=60%) is reported as that pure family, even if a second family also independently clears the two-family minimum', () => {
  const comp = { amber: 0.65, green: 0.20, gray: 0.10, brown: 0.03, blue: 0.02 };
  const label = deriveIrisColorCompositionLabel(comp, 'mixed');
  assert.strictEqual(label, 'amber', 'the single strong-dominant threshold takes priority over the two-family combo logic');
});

// ------------------------------------------------------------
// G. Canonical category is the SOLE authority for the primary label
// (Phase C3d consistency fix): only 'mixed' ever lets the composition
// propose the primary label; every other confident named category
// passes through unconditionally, and 'uncertain' always wins.
// ------------------------------------------------------------
test('G3. canonical GREEN can NEVER be relabeled Hazel (or anything else) by composition, no matter how the raw percentages split -- this is the exact глаза33 real-world scenario (amber 47.5% > green 34.6%, canonical green)', () => {
  const comp = { amber: 0.475, green: 0.346, brown: 0.062, gray: 0.117, blue: 0.0 };
  const label = deriveIrisColorCompositionLabel(comp, 'green');
  assert.strictEqual(label, 'green', 'canonical green must remain the primary label even when amber has a higher raw composition percentage');
  assert.deepStrictEqual(resolveIrisColorLabel(label), IRIS_NAMES.green);
});

test('G4. canonical BLUE/BROWN/AMBER/GRAY/DARK all pass through unconditionally, regardless of composition shape', () => {
  const adversarialComp = { blue: 0.05, brown: 0.05, amber: 0.05, gray: 0.05, green: 0.80 };
  for (const category of ['blue', 'brown', 'amber', 'gray', 'dark']) {
    assert.strictEqual(deriveIrisColorCompositionLabel(adversarialComp, category), category, `canonical '${category}' must remain the primary label even against a wildly contradicting composition`);
  }
});

test('G5. canonical UNCERTAIN always wins over any composition, including one that looks strongly single-colored', () => {
  const stronglyGreenComp = { green: 0.95, gray: 0.05, blue: 0, brown: 0, amber: 0 };
  assert.strictEqual(deriveIrisColorCompositionLabel(stronglyGreenComp, 'uncertain'), 'uncertain', 'the existing quality gate\'s uncertain verdict must never be overridden by a confident-looking composition');
});

test('G6. only canonical MIXED allows the composition to genuinely drive the primary label away from a bare passthrough', () => {
  const comp = { green: 0.42, brown: 0.38, gray: 0.12, amber: 0.05, blue: 0.03 };
  assert.strictEqual(deriveIrisColorCompositionLabel(comp, 'mixed'), 'hazel');
  assert.notStrictEqual(deriveIrisColorCompositionLabel(comp, 'green'), 'hazel', 'the identical composition must NOT produce hazel when canonical is a confident named category');
});

// ------------------------------------------------------------
// F. UNCERTAIN gating
// ------------------------------------------------------------
test('F1. UNCERTAIN category always yields the "uncertain" composition label, regardless of what the raw composition looks like', () => {
  const comp = { green: 0.40, brown: 0.35, gray: 0.15, amber: 0.06, blue: 0.04 };
  const label = deriveIrisColorCompositionLabel(comp, 'uncertain');
  assert.strictEqual(label, 'uncertain', 'the new percentage model must never manufacture confidence the existing quality gate withheld');
  assert.deepStrictEqual(resolveIrisColorLabel(label), IRIS_NAMES.uncertain);
});

test('F2. real bilateral combineIris uncertainty propagation (eitherUncertain) still gates the composition label end-to-end', () => {
  const confidentGreen = sampleIrisColor(solidCtx([75, 125, 78]), EYE);
  const uncertainCtx = solidCtx([100, 100, 98]); // near-achromatic -> low confidence/uncertain
  const uncertainEye = sampleIrisColor(uncertainCtx, EYE);
  const combined = api.combineIris(confidentGreen, uncertainEye);
  const combinedComposition = combineIrisColorComposition(confidentGreen.colorComposition, confidentGreen.confidence, uncertainEye.colorComposition, uncertainEye.confidence);
  const label = deriveIrisColorCompositionLabel(combinedComposition, combined.name);
  if (combined.name === 'uncertain') assert.strictEqual(label, 'uncertain', 'if the existing, protected eitherUncertain rule forces the bilateral category to uncertain, the composition label must follow it');
});

// ------------------------------------------------------------
// G. Canonical category compatibility (backward compatibility)
// ------------------------------------------------------------
test('G1. sampleIrisColor still returns the exact same rgb/hex/name/confidence/samples fields as before -- colorComposition is purely additive', () => {
  const result = sampleIrisColor(solidCtx([80, 45, 30]), EYE);
  for (const key of ['rgb', 'hex', 'name', 'confidence', 'samples']) assert.ok(key in result, `expected sampleIrisColor to still return '${key}'`);
  assert.ok('colorComposition' in result, 'expected the new additive colorComposition field');
});

test('G2. analyzeIrisSample/classifyIrisColor/combineIris source is untouched by this phase (isolation)', () => {
  const sampleStart = "    function analyzeIrisSample(ctx, eyePoints, fixedCenter) {";
  const sampleEnd = "    function sampleIrisColor(ctx, eyePoints) {";
  const sIdx = src.indexOf(sampleStart);
  const eIdx = src.indexOf(sampleEnd, sIdx);
  const span = src.slice(sIdx, eIdx);
  // Same pixel-rejection literals iris-color-green-brown-robustness.test.js already pins.
  assert.ok(span.includes("if (radial < 0.30) { rejected.push({ ...pixel, reason:'pupil_core' }); continue; }"));
  assert.ok(span.includes("if (radial > 0.88) { rejected.push({ ...pixel, reason:'outside_iris_annulus' }); continue; }"));
  assert.ok(span.includes("const radius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.24);"), 'the Phase C3c calibrated radius must be unchanged by this phase');
});

// ------------------------------------------------------------
// H. RU/EN localization structure
// ------------------------------------------------------------
test('H1. every IRIS_FAMILY_NAMES entry has both ru and en, non-empty, distinct', () => {
  for (const [family, names] of Object.entries(IRIS_FAMILY_NAMES)) {
    assert.ok(names.ru && names.en, `expected both ru/en for family '${family}'`);
    assert.notStrictEqual(names.ru, names.en, `ru/en must be real distinct translations for '${family}'`);
  }
});

test('H2. every IRIS_COMBO_NAMES entry has both ru and en, and the RU wording carries the "оттенок" suffix used throughout this feature', () => {
  for (const [combo, names] of Object.entries(IRIS_COMBO_NAMES)) {
    assert.ok(names.ru && names.en, `expected both ru/en for combo '${combo}'`);
    assert.ok(names.ru.includes('оттенок'), `expected RU combo label to end in "оттенок" for '${combo}', got "${names.ru}"`);
  }
});

test('H3. resolveIrisColorLabel falls back to IRIS_NAMES.uncertain for an unrecognized key (never throws, never renders blank)', () => {
  assert.deepStrictEqual(resolveIrisColorLabel('not-a-real-key'), IRIS_NAMES.uncertain);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
