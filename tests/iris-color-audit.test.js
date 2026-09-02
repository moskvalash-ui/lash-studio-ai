// ============================================================
// IRIS COLOR — REAL-PHOTO BUG AUDIT — regression tests.
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped iris pipeline straight out of
// index.html (same technique as every other test file in this
// project — never a hand-duplicated copy): sampleIrisColor,
// classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES, plus the
// debug-only instrumentation (buildIrisColorAudit,
// buildIrisColorAuditCombined, debugIrisClassifyWithTrace).
//
// THIS TURN: a real iPhone failure capture with full iris debug JSON
// became available (tests/fixtures/real-capture-2026-08-25.json —
// the exact irisColorAudit the earlier synthetic-only audit below
// could not obtain). Investigation (8 phases, see the deliverable)
// against the REAL acceptedPixels arrays found:
//
//  - ROI/sampling (sampleIrisColor's own rejection rules) is UNCHANGED
//    and NOT the primary cause: removing the one real, common,
//    both-eyes spatial bias found (the upper portion of each ROI
//    reads darker/more-saturated than the lower portion — consistent
//    with eyelid-crease/lash shadow, see Phase 3/5) does not flip the
//    result. sampleIrisColor is therefore left untouched.
//  - Aggregation is NOT the cause either: median-RGB (production),
//    mean-RGB, per-pixel scalar-mean HSL, and a proper circular-mean
//    hue all agree on the same classification for both real eyes (see
//    Phase 6 in the deliverable) — swapping aggregation strategy does
//    not change the outcome, so aggregation was left untouched too.
//  - The proven cause is classifyIrisColor's decision-tree ORDER: its
//    first low-lightness gate (originally `l<0.32 && s<0.35 -> brown`)
//    and its final fallback (originally `l<0.35 -> brown`) matched on
//    lightness/saturation ALONE, with NO hue check — a full 0-360°
//    hue sweep at the REAL captured lightness/saturation of both eyes
//    (test 'REAL2' below) proves EVERY hue, including textbook blue
//    and green, produced 'brown' under the old rule.
//
// THE FIX (Case C — classification only, applied this turn):
// classifyIrisColor's two low-lightness gates now route by hue instead
// of defaulting to brown unconditionally, via classifyLowLightAmbiguous
// — reusing the SAME hue windows already used below for green/blue, and
// reusing production's own pre-existing `s < 0.15` "achromatic" bar
// (already how this same function defines 'gray' two lines below) to
// decide whether hue is trustworthy enough to route on at all. Below
// that bar (hue unreliable) it returns the new 'uncertain' category —
// the SAME pattern this codebase already uses elsewhere for low-
// confidence classification (see eyeShapeCategory / eyelidCategory
// 'uncertain') — rather than guessing brown OR a light color.
// sampleIrisColor and combineIris are UNCHANGED (frozen, verified by
// test 'PROTECT-1' below); only classifyIrisColor + IRIS_NAMES + the
// new classifyLowLightAmbiguous helper changed.
//
// Tests G1-G3 below (originally written against synthetic HSL values
// because no real capture existed yet) now document the FIXED
// behavior; the REAL-* tests use the actual real-capture fixture.
//
// LOCAL ONLY. Not wired into any CI/deploy step this turn. NOT
// committed/pushed/deployed — pending explicit review.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

// ---- Extract the real, contiguous iris pipeline: sampleIrisColor ->
// rgbToHsl -> IRIS_NAMES -> classifyIrisColor -> combineIris -> [NEW]
// debug instrumentation. All in one unbroken span (verified: nothing
// but this pipeline sits between sampleIrisColor and EYE_METRIC_KEYS). ----
const rgbToHexLine = "    const rgbToHex = (r,g,b) => { const h = (n) => Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0'); return `#${h(r)}${h(g)}${h(b)}`; };";
const pipelineStart = src.indexOf('    function estimateIrisCenter(ctx, eyePoints) {');
const pipelineEnd = src.indexOf('\n    const EYE_METRIC_KEYS =');
if (pipelineStart === -1 || pipelineEnd === -1) throw new Error('Could not locate the iris pipeline block — has it moved?');
const pipelineSource = src.slice(pipelineStart, pipelineEnd);
const {
  sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES,
  buildIrisColorAudit, buildIrisColorAuditCombined, debugIrisClassifyWithTrace,
  debugIrisPupilCandidate, debugIrisRegionStats, debugIrisSurroundingRef, debugIrisRoiSnapshot,
} = new Function(rgbToHexLine + '\n' + pipelineSource + '\nreturn { sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES, buildIrisColorAudit, buildIrisColorAuditCombined, debugIrisClassifyWithTrace, debugIrisPupilCandidate, debugIrisRegionStats, debugIrisSurroundingRef, debugIrisRoiSnapshot };')();

test('setup: extracted real iris pipeline + debug instrumentation from index.html successfully', () => {
  assert.strictEqual(typeof sampleIrisColor, 'function');
  assert.strictEqual(typeof classifyIrisColor, 'function');
  assert.strictEqual(typeof combineIris, 'function');
  assert.strictEqual(typeof buildIrisColorAudit, 'function');
});

// ---- The REAL regression fixture: the exact irisColorAudit JSON from the
// reported real iPhone failure (LEFT medianRgb 87/67/67, RIGHT medianRgb
// 82/62/59, combined brown @ ~34%). Untouched/unreduced — full real
// acceptedPixels/rejectedPixels arrays, not a synthetic RGB restatement. ----
const REAL_FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'real-capture-2026-08-25.json'), 'utf8'));
function median(arr) { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

test('setup3: real fixture file loaded and has the expected shape', () => {
  assert.ok(REAL_FIXTURE.irisColorAudit && REAL_FIXTURE.irisColorAudit.left && REAL_FIXTURE.irisColorAudit.right);
  assert.strictEqual(REAL_FIXTURE.irisColorAudit.left.acceptedPixels.length, 411, 'LEFT real acceptedPixels count must be preserved exactly');
  assert.strictEqual(REAL_FIXTURE.irisColorAudit.right.acceptedPixels.length, 377, 'RIGHT real acceptedPixels count must be preserved exactly');
  assert.strictEqual(REAL_FIXTURE.productionResult.irisColor, 'brown', 'sanity: this is the real documented false-brown capture');
});

// ---- Fake canvas 2D context over a synthetic solid-ish image, for
// exercising sampleIrisColor/buildIrisColorAudit without a real DOM. ----
function makeFakeCtx(w, h, fillFn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = fillFn(x, y);
    const idx = (y * w + x) * 4; data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
  }
  return {
    getImageData: (x0, y0, w2, h2) => {
      const out = new Uint8ClampedArray(w2 * h2 * 4);
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
        const sx = x0 + x, sy = y0 + y;
        const idx = (y * w2 + x) * 4;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) { out[idx] = 128; out[idx + 1] = 128; out[idx + 2] = 128; out[idx + 3] = 255; continue; }
        const sidx = (sy * w + sx) * 4;
        out[idx] = data[sidx]; out[idx + 1] = data[sidx + 1]; out[idx + 2] = data[sidx + 2]; out[idx + 3] = 255;
      }
      return { data: out };
    },
  };
}
const EYE_POINTS = [{ x: 20, y: 40 }, { x: 30, y: 30 }, { x: 50, y: 30 }, { x: 60, y: 40 }, { x: 50, y: 50 }, { x: 30, y: 50 }];
function solidCtx(r, g, b, noiseAmp) {
  return makeFakeCtx(80, 80, (x, y) => {
    const n = noiseAmp ? ((x * 7 + y * 13) % (noiseAmp * 2)) - noiseAmp : 0;
    return [r + n, g + n, b + n];
  });
}

// ================================================================
// A/B. RU/EN label mapping
// ================================================================
test('A. RU labels exist for every possible classifyIrisColor output', () => {
  const possible = ['dark', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray', 'mixed', 'uncertain'];
  for (const k of possible) {
    assert.ok(IRIS_NAMES[k], `IRIS_NAMES must have an entry for '${k}'`);
    assert.ok(typeof IRIS_NAMES[k].ru === 'string' && IRIS_NAMES[k].ru.length > 0, `IRIS_NAMES.${k}.ru must be a non-empty string`);
  }
  assert.strictEqual(IRIS_NAMES.brown.ru, 'Карие', 'sanity: matches the exact observed real-photo output "Карие"');
});
test('B. EN labels exist for every possible classifyIrisColor output, and the key set matches exactly (no enum drift)', () => {
  const possible = ['dark', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray', 'mixed', 'uncertain'];
  for (const k of possible) {
    assert.ok(typeof IRIS_NAMES[k].en === 'string' && IRIS_NAMES[k].en.length > 0, `IRIS_NAMES.${k}.en must be a non-empty string`);
  }
  assert.deepStrictEqual(Object.keys(IRIS_NAMES).sort(), possible.sort(), 'IRIS_NAMES must have EXACTLY these 9 keys (8 original + this turn\'s new "uncertain") — no extra/missing entries that could cause an index/enum mismatch');
});
test('B2. every possible classifyIrisColor() return value has a matching IRIS_NAMES entry (sweep, not just the known 9)', () => {
  const seen = new Set();
  for (let r = 0; r <= 255; r += 5) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 23) seen.add(classifyIrisColor(r, g, b));
  for (const name of seen) assert.ok(IRIS_NAMES[name], `classifyIrisColor returned '${name}' but IRIS_NAMES has no entry for it — would crash IRIS_NAMES[name].ru/.en at the real call sites`);
});

// ================================================================
// C. LEFT/RIGHT independence
// ================================================================
test('C. buildIrisColorAudit for LEFT and RIGHT are computed fully independently (no shared/cross-contaminated state)', () => {
  const ctxLeft = solidCtx(60, 45, 35, 3); // brown-ish
  const ctxRight = solidCtx(70, 130, 150, 3); // blue-ish, distinctly different
  const leftAudit = buildIrisColorAudit(ctxLeft, EYE_POINTS);
  const rightAudit = buildIrisColorAudit(ctxRight, EYE_POINTS);
  assert.notStrictEqual(leftAudit.selectedCategory, rightAudit.selectedCategory, 'two genuinely different eye images must not collapse to the same result');
  assert.notDeepStrictEqual(leftAudit.classifierInput, rightAudit.classifierInput);
});

// ================================================================
// D. production pixel inclusion logic — parity with the REAL,
// unmodified sampleIrisColor/classifyIrisColor (proves the debug
// audit is a faithful observer, not a second detector).
// ================================================================
test('D. buildIrisColorAudit is byte-exact parity with the real sampleIrisColor + classifyIrisColor for identical input', () => {
  const cases = [
    solidCtx(60, 45, 35, 4),
    solidCtx(110, 120, 132, 5),
    solidCtx(68, 74, 80, 3),
    solidCtx(180, 150, 90, 6),
  ];
  for (const ctx of cases) {
    const real = sampleIrisColor(ctx, EYE_POINTS);
    const audit = buildIrisColorAudit(ctx, EYE_POINTS);
    assert.strictEqual(audit.selectedCategory, real.name, 'audit selectedCategory must equal real sampleIrisColor.name exactly');
    assert.ok(Math.abs(audit.confidence - real.confidence) < 1e-9, `audit confidence must equal real confidence exactly, got ${audit.confidence} vs ${real.confidence}`);
    if (real.rgb) {
      assert.strictEqual(audit.classifierInput.r, real.rgb[0]);
      assert.strictEqual(audit.classifierInput.g, real.rgb[1]);
      assert.strictEqual(audit.classifierInput.b, real.rgb[2]);
    }
  }
});
test('D2. debugIrisClassifyWithTrace\'s matched category always equals the real classifyIrisColor for the same RGB', () => {
  const rgbCases = [[60, 45, 35], [110, 120, 132], [68, 74, 80], [180, 150, 90], [40, 130, 60], [90, 60, 140]];
  for (const [r, g, b] of rgbCases) {
    const trace = debugIrisClassifyWithTrace(r, g, b);
    const real = classifyIrisColor(r, g, b);
    assert.strictEqual(trace.name, real, `decision trace must match real classifyIrisColor(${r},${g},${b}) exactly`);
  }
});

// ================================================================
// E. dark/pupil contamination
// ================================================================
test('E. pixels below the lightness-25 floor are rejected with reason dark_pupil_or_lash', () => {
  // Half the ROI genuinely iris-colored, half near-black (simulating
  // pupil/eyelash contamination inside the sampling circle).
  const ctx = makeFakeCtx(80, 80, (x, y) => (x < 40 ? [120, 100, 80] : [10, 10, 10]));
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  assert.ok(audit.rejectedPixels.some(p => p.reason === 'dark_pupil_or_lash'), 'expected at least one dark_pupil_or_lash rejection');
  for (const p of audit.rejectedPixels.filter(p => p.reason === 'dark_pupil_or_lash')) {
    assert.ok(p.lightness < 25, 'every dark_pupil_or_lash rejection must genuinely have lightness < 25 (production\'s own real threshold)');
  }
});

// ================================================================
// F. bright/specular contamination
// ================================================================
test('F. only near-white/near-achromatic catchlights are rejected as bright_specular', () => {
  const ctx = makeFakeCtx(80, 80, (x, y) => (x < 40 ? [120, 100, 80] : [250, 250, 250]));
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  assert.ok(audit.rejectedPixels.some(p => p.reason === 'bright_specular'), 'expected at least one bright_specular rejection');
  for (const p of audit.rejectedPixels.filter(p => p.reason === 'bright_specular')) {
    assert.ok(p.lightness > 235 && p.sat < 0.12, 'every bright_specular rejection must satisfy the narrow catchlight gate');
  }
});

// ================================================================
// G. light, low-saturation iris input — THE CENTRAL FINDING, UPDATED
// THIS TURN with the fix applied. G1/G3 originally asserted the
// PROVEN-BUGGY old behavior (brown regardless of hue) because no real
// capture existed yet to test a real fix against. Now that
// classifyIrisColor has been corrected (see file header), these
// assert the NEW, evidence-justified behavior instead. HSL values are
// still chosen from well-documented iris colorimetry, not guessed
// from any reporter's photo.
// ================================================================
test('G1. a low-saturation, moderately-lit iris (h~210, s~0.08, l~0.29 — textbook pale gray-blue) now returns "uncertain", not a confidently-wrong "brown"', () => {
  const [r, g, b] = [68, 74, 80];
  const { h, s, l } = rgbToHsl(r, g, b);
  assert.ok(h >= 180 && h <= 250, 'sanity: hue is squarely in the blue window the classifier itself defines');
  assert.ok(s < 0.15, 'sanity: saturation is below the reliable-hue bar this function now uses (same bar the gray rule already used)');
  assert.ok(l < 0.32, 'sanity: lightness is below the low-light gate ceiling');
  assert.strictEqual(classifyIrisColor(r, g, b), 'uncertain', 'FIXED BEHAVIOR: saturation this low gives no reliable hue signal, so the function now reports uncertainty instead of guessing brown');
});
test('G1b. the SAME low lightness but with RELIABLE (>=0.15) saturation in the blue hue window now correctly returns "blue", not "brown"', () => {
  const [r, g, b] = [60, 75, 95]; // h~214, s~0.23 (>=0.15 reliability bar), l~0.30 (<0.32)
  const { h, s, l } = rgbToHsl(r, g, b);
  assert.ok(h > 170 && h <= 250 && s >= 0.15 && l < 0.32, 'sanity: reliable blue hue at low lightness');
  assert.strictEqual(classifyIrisColor(r, g, b), 'blue', 'FIXED BEHAVIOR: a real, measurable blue hue at low lightness is no longer forced into brown');
});
test('G1c. the SAME low lightness but with RELIABLE saturation in the green hue window now correctly returns "green"', () => {
  const [r, g, b] = [60, 95, 70]; // h~137, s~0.23, l~0.30
  const { h, s, l } = rgbToHsl(r, g, b);
  assert.ok(h >= 70 && h <= 170 && s >= 0.15 && l < 0.32, 'sanity: reliable green hue at low lightness');
  assert.strictEqual(classifyIrisColor(r, g, b), 'green', 'FIXED BEHAVIOR: a real, measurable green hue at low lightness is no longer forced into brown');
});
test('G2. pale cold color with measurable absolute chroma reaches blue at normal lightness', () => {
  const [r, g, b] = [110, 120, 132]; // same ~h210 hue, same low saturation, l~0.47
  const { s, l } = rgbToHsl(r, g, b);
  assert.ok(s < 0.15 && l >= 0.35, 'sanity: this genuinely satisfies the gray branch\'s own stated conditions');
  assert.strictEqual(classifyIrisColor(r, g, b), 'blue');
});
test('G3. low-saturation cold samples remain uncertain when dim, then become blue once luminance makes chroma reliable', () => {
  // Same blue-ish hue (~h210) and low (<0.15) saturation throughout; only
  // lightness varies. Documents the NEW, fixed decision boundary.
  const sweep = [[50, 56, 62], [68, 74, 80], [90, 97, 104], [110, 120, 132]];
  const results = sweep.map(rgb => ({ rgb, l: rgbToHsl(...rgb).l, category: classifyIrisColor(...rgb) }));
  const firstBlueIdx = results.findIndex(r => r.category === 'blue');
  assert.ok(firstBlueIdx > 0);
  for (let i = 0; i < firstBlueIdx; i++) {
    assert.strictEqual(results[i].category, 'uncertain', `expected uncertain (FIXED — no longer brown) below the gray boundary at unreliable saturation, got ${results[i].category} at l=${results[i].l}`);
  }
});
test('G3b. sweeping lightness at fixed RELIABLE (>=0.15) saturation/blue hue reads "blue" continuously across the l=0.32/0.35 internal boundaries — no discontinuity into brown/gray at the seam', () => {
  const sweep = [[58, 73, 93], [67, 84, 107], [76, 95, 121]]; // h~214, s~0.23 throughout; l ~0.30, ~0.34, ~0.39 -- straddles both internal gates
  const results = sweep.map(rgb => ({ rgb, l: rgbToHsl(...rgb).l, category: classifyIrisColor(...rgb) }));
  for (const r of results) assert.strictEqual(r.category, 'blue', `expected 'blue' continuously across the low-light/gray boundary, got ${r.category} at l=${r.l}`);
});

// ================================================================
// H. brown control input — a genuinely dark/brown iris must remain
// classified brown (proves this isn't a blanket regression risk).
// ================================================================
test('H. a genuine dark-brown iris (h~25, s~0.26, l~0.19) still classifies brown, unaffected by this turn\'s instrumentation', () => {
  const [r, g, b] = [60, 45, 35];
  assert.strictEqual(classifyIrisColor(r, g, b), 'brown');
  const ctx = solidCtx(r, g, b, 4);
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  assert.strictEqual(audit.selectedCategory, 'brown');
});
test('H2. CONTROL — a very dark, near-black genuine iris (l<0.16) with real warm-hue evidence still classifies dark (a LATER turn made this branch hue-routed too — see N5d/N5e below — but a genuinely warm-hued very-dark sample must still land on dark)', () => {
  assert.strictEqual(classifyIrisColor(25, 18, 14), 'dark');
});
test('H3. CONTROL — a genuine medium-brown iris (h~24, s~0.27, l~0.31 — reliable warm hue, just under the 0.32 gate) still classifies brown', () => {
  const [r, g, b] = [100, 75, 58];
  const { h, s, l } = rgbToHsl(r, g, b);
  assert.ok(s >= 0.15 && (h > 250 || h < 70) && l < 0.32, 'sanity: reliable warm hue, low lightness');
  assert.strictEqual(classifyIrisColor(r, g, b), 'brown');
});
test('H4. CONTROL — hazel does not regress (this turn only touches the l<0.32/l<0.35 gates; hazel\'s own l>=0.25 branch is untouched)', () => {
  assert.strictEqual(classifyIrisColor(150, 110, 60), 'hazel');
});
test('H5. CONTROL — green does not regress at its existing (well-lit) branch', () => {
  assert.strictEqual(classifyIrisColor(90, 140, 100), 'green');
});
test('H6. CONTROL — blue does not regress at its existing (well-lit) branch', () => {
  assert.strictEqual(classifyIrisColor(90, 120, 160), 'blue');
});
test('H7. CONTROL — gray does not regress at its existing (well-lit) branch', () => {
  assert.strictEqual(classifyIrisColor(140, 140, 145), 'gray');
});
test('H8. CONTROL — amber does not regress at its existing (well-lit) branch', () => {
  assert.strictEqual(classifyIrisColor(161, 153, 69), 'amber');
});

// ================================================================
// I. aggregation (combineIris) behavior — real formula, both branches
// ================================================================
test('I1. combineIris: L/R agreement raises combined confidence above either single-eye confidence bound implied by consistency=1', () => {
  const l = { rgb: [68, 74, 80], hex: '#444a50', name: 'brown', confidence: 0.5 };
  const r = { rgb: [68, 74, 80], hex: '#444a50', name: 'brown', confidence: 0.4 };
  const combined = combineIris(l, r);
  assert.strictEqual(combined.confidence, Math.min(l.confidence, r.confidence) * 1, 'perfect L/R agreement (diff=0) must yield consistency=1, i.e. confidence = min(l,r) exactly');
});
test('I2. combineIris: L/R disagreement lowers combined confidence below min(l,r)', () => {
  const l = { rgb: [68, 74, 80], hex: '#444a50', name: 'brown', confidence: 0.6 };
  const r = { rgb: [180, 60, 40], hex: '#b43c28', name: 'brown', confidence: 0.6 };
  const combined = combineIris(l, r);
  assert.ok(combined.confidence < Math.min(l.confidence, r.confidence), 'disagreeing eyes must reduce confidence below the minimum single-eye confidence');
});
test('I3. combineIris: one eye missing falls back to the other eye at a fixed 0.7 penalty (real formula, not invented here)', () => {
  const r = { rgb: [68, 74, 80], hex: '#444a50', name: 'gray', confidence: 0.5 };
  const combined = combineIris({ rgb: null }, r);
  assert.strictEqual(combined.confidence, r.confidence * 0.7);
  assert.strictEqual(combined.name, r.name);
});

// ================================================================
// J. confidence formula — robust color + spatial consistency
// ================================================================
test('J. confidence is a robust dispersion/sector-consistency measure, not a probability', () => {
  // High internal consistency (identical pixels) + full sample count -> confidence approaches 1.
  const cleanCtx = solidCtx(68, 74, 80, 0);
  const cleanAudit = buildIrisColorAudit(cleanCtx, EYE_POINTS);
  assert.ok(cleanAudit.confidence > 0.9, `expected near-1.0 confidence for a perfectly uniform sample, got ${cleanAudit.confidence}`);
  // High internal dispersion/noisy sectors -> confidence drops.
  const noisyCtx = solidCtx(68, 74, 80, 60);
  const noisyAudit = buildIrisColorAudit(noisyCtx, EYE_POINTS);
  assert.ok(noisyAudit.confidence < cleanAudit.confidence, 'lower robust color/sector consistency must lower confidence');
  assert.ok(noisyAudit.selectedCategory, 'the sample must still produce an explicit category, including uncertain when sectors disagree');
});

// ================================================================
// K. debug instrumentation cannot modify production output
// ================================================================
test('K. calling buildIrisColorAudit does not alter what sampleIrisColor/classifyIrisColor subsequently return for the same input', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const before = sampleIrisColor(ctx, EYE_POINTS);
  buildIrisColorAudit(ctx, EYE_POINTS);
  buildIrisColorAudit(ctx, EYE_POINTS);
  const after = sampleIrisColor(ctx, EYE_POINTS);
  assert.deepStrictEqual(before, after, 'repeated debug audit calls must have zero observable effect on production sampleIrisColor');
});
test('K2. the iris debug instrumentation source never assigns to leftIris/rightIris/iris (production identifiers)', () => {
  const debugStart = src.indexOf('    function debugIrisRgbToHsl(');
  const debugEnd = src.indexOf('\n    const EYE_METRIC_KEYS =');
  const debugSrc = src.slice(debugStart, debugEnd);
  assert.ok(!/\bleftIris\s*=(?!=)/.test(debugSrc), 'must never assign to leftIris');
  assert.ok(!/\brightIris\s*=(?!=)/.test(debugSrc), 'must never assign to rightIris');
  assert.ok(!/\biris\s*=(?!=)/.test(debugSrc), 'must never assign to iris');
});

// ================================================================
// L. debug data only constructed inside debug mode
// ================================================================
test('L1. LiveScanScreen: iris audit construction sits strictly inside the existing debugAvailable gate', () => {
  const anchor = src.indexOf("leftIris: sampleIrisColor(ctx, leftEye),");
  const gateStart = src.lastIndexOf('if (!bestFrameRef.current', anchor);
  const auditCallIdx = src.indexOf('debugIrisAuditRef.current = {', anchor);
  const auditGateIdx = src.lastIndexOf('if (debugAvailable) {', auditCallIdx);
  assert.ok(anchor !== -1 && auditCallIdx !== -1 && auditGateIdx !== -1, 'expected to locate the bestFrameRef/iris-audit anchors — has LiveScanScreen moved?');
  assert.ok(auditGateIdx > gateStart && auditGateIdx < auditCallIdx, 'buildIrisColorAudit construction must be gated by its own if(debugAvailable) inside the bestFrameRef update block');
});
test('L2. LiveScanScreen: the finalization setDebugIrisAudit call is also gated by debugAvailable', () => {
  const anchor = src.indexOf('const iris = combineIris(best.leftIris, best.rightIris);');
  const setCallIdx = src.indexOf('setDebugIrisAudit(irisColorAuditForRec)', anchor);
  const gateIdx = src.lastIndexOf('if (debugAvailable && debugIrisAuditRef.current)', setCallIdx);
  assert.ok(anchor !== -1 && setCallIdx !== -1 && gateIdx !== -1 && gateIdx < setCallIdx, 'setDebugIrisAudit must be gated by debugAvailable at finalization');
});
test('L3. PhotoAnalysisScreen: iris audit console.log is gated by isDebugModeEnabled()', () => {
  const anchor = src.indexOf('const leftIris = sampleIrisColor(ctx, leftEye), rightIris = sampleIrisColor(ctx, rightEye);');
  const auditLogIdx = src.indexOf("'[Photo] IRIS COLOR AUDIT", anchor);
  const gateIdx = src.lastIndexOf('if (isDebugModeEnabled()) {', auditLogIdx);
  const gateEnd = src.indexOf('\n          }', auditLogIdx);
  assert.ok(anchor !== -1 && auditLogIdx !== -1 && gateIdx !== -1 && gateIdx < auditLogIdx && gateEnd > auditLogIdx, 'PhotoAnalysisScreen iris audit log must remain inside isDebugModeEnabled()');
});

// ================================================================
// M. Copy JSON serialization
// ================================================================
test('M. Copy JSON payload includes irisColorAudit.left/.right/.combined and survives JSON.stringify', () => {
  const boundaryFlagStart = src.indexOf('    function debugV1BoundaryPeakFlag(v1) {');
  const boundaryFlagEnd = src.indexOf('\n    }\n', boundaryFlagStart) + '\n    }\n'.length;
  const payloadStart = src.indexOf('    function buildCreaseV2CopyPayload(data, compare, frameTrace, irisAudit) {');
  const payloadEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  if (boundaryFlagStart === -1 || payloadStart === -1 || payloadEnd === -1) throw new Error('Could not locate buildCreaseV2CopyPayload — has it moved?');
  const { buildCreaseV2CopyPayload } = new Function(
    src.slice(boundaryFlagStart, boundaryFlagEnd) + '\n' + src.slice(payloadStart, payloadEnd) + '\nreturn { buildCreaseV2CopyPayload };'
  )();
  const ctxL = solidCtx(68, 74, 80, 4), ctxR = solidCtx(70, 76, 82, 4);
  const leftAudit = buildIrisColorAudit(ctxL, EYE_POINTS);
  const rightAudit = buildIrisColorAudit(ctxR, EYE_POINTS);
  const leftReal = sampleIrisColor(ctxL, EYE_POINTS), rightReal = sampleIrisColor(ctxR, EYE_POINTS);
  const combinedReal = combineIris(leftReal, rightReal);
  const combinedAudit = buildIrisColorAuditCombined(leftAudit, rightAudit, leftReal, rightReal, combinedReal);
  const data = { left: {}, right: {}, capture: null };
  const payload = buildCreaseV2CopyPayload(data, null, null, { left: leftAudit, right: rightAudit, combined: combinedAudit });
  assert.ok(payload.irisColorAudit, 'payload must include irisColorAudit');
  assert.strictEqual(payload.irisColorAudit.left.selectedCategory, leftAudit.selectedCategory);
  assert.strictEqual(payload.irisColorAudit.right.selectedCategory, rightAudit.selectedCategory);
  assert.strictEqual(payload.irisColorAudit.combined.selectedCategory, combinedReal.name);
  let jsonStr;
  assert.doesNotThrow(() => { jsonStr = JSON.stringify(payload); }, 'the full payload including irisColorAudit must survive JSON.stringify');
  assert.ok(jsonStr.length > 0);
});

// ================================================================
// N. protected eyelid/Hooding code unchanged
// ================================================================
test('N1. classifyFeatures\' own body contains zero reference to any iris-audit identifier', () => {
  const start = src.indexOf('    function classifyFeatures(aggregated, opts) {');
  const end = src.indexOf('\n    // RELIABLE-FRAME EYELID-TYPE CONSENSUS — production integration.', start);
  const body = src.slice(start, end);
  assert.ok(!/[Ii]risColorAudit|debugIris/.test(body), 'classifyFeatures must have zero coupling to the iris audit layer');
});
test('N2. Hooding V2 Stage 1 + Stage 2B core spans are untouched by this turn (still zero iris-audit reference, still the same span boundaries)', () => {
  const hv2Start = src.indexOf('    const HOODING_V2_STAGE = 1;');
  const hv2End = src.indexOf('\n    const REASON_MESSAGES = {');
  assert.ok(hv2Start !== -1 && hv2End !== -1, 'Hooding V2 span markers must still be found unmoved');
  const hv2Span = src.slice(hv2Start, hv2End);
  assert.ok(!/[Ii]risColorAudit|debugIris/.test(hv2Span), 'Hooding V2 Stage 1/2B must have zero coupling to the iris audit layer');
});
test('N3. V1/V2/V2.1/V2.2 crease detector span is untouched by this turn', () => {
  const v1Start = src.indexOf('    function detectEyelidCrease(sourceCanvas, eyePoints, browPoints) {');
  const v2LinkEnd = src.indexOf('      return { valid: true, sampledColumns, paths, v2LinkedRuntimeMs };\n    }\n', v1Start) + '      return { valid: true, sampledColumns, paths, v2LinkedRuntimeMs };\n    }\n'.length;
  const span = src.slice(v1Start, v2LinkEnd);
  assert.ok(!/[Ii]risColorAudit|debugIris|sampleIrisColor|classifyIrisColor/.test(span), 'crease detector span must have zero reference to anything iris-related');
});
test('N4. physical L/R normalization span is untouched by this turn', () => {
  const start = src.indexOf('    function normalizeEyePoints(raw, source) {');
  const end = src.indexOf('\n    function computeEyeSideMetrics(landmarks, side, headPose) {');
  const span = src.slice(start, end);
  assert.ok(!/[Ii]risColorAudit|debugIris/.test(span), 'physical L/R normalization must have zero coupling to the iris audit layer');
});
test('N5. iris sampling uses the annular mask and narrow catchlight gate', () => {
  const radiusLine = 'const radius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.22);';
  const brightRejectLine = "if (lightness > 235 && sat < 0.12) { rejected.push({ ...pixel, reason:'bright_specular' }); continue; }";
  const darkRejectLine = "if (lightness < 25) { rejected.push({ ...pixel, reason:'dark_pupil_or_lash' }); continue; }";
  const grayGate = "if (chroma < 10 && l >= 0.35 && l < 0.7) return 'gray';";
  for (const line of [radiusLine, brightRejectLine, darkRejectLine, grayGate]) {
    assert.ok(src.includes(line), `expected the real, unmodified production line to still be present verbatim: ${line}`);
  }
});
test('N5b. classifyIrisColor WAS intentionally changed this turn (Case C fix) — the old, proven-buggy unconditional-brown gates are GONE...', () => {
  const oldBrownGate = "if (l < 0.32 && s < 0.35) return 'brown';";
  const oldFallbackGate = "if (l < 0.35) return 'brown';";
  assert.ok(!src.includes(oldBrownGate), 'the old hue-blind low-lightness brown gate must no longer be present verbatim — it was replaced by classifyLowLightAmbiguous(h, s)');
  assert.ok(!src.includes(oldFallbackGate), 'the old hue-blind low-lightness fallback must no longer be present verbatim — it was replaced by classifyLowLightAmbiguous(h, s)');
});
test('N5c. ...and replaced by the new hue-aware low-lightness routing, present verbatim exactly once each', () => {
  // A later turn (green-misread-as-brown follow-up) also routed the
  // l<0.16 branch through this same helper via a `veryDark` flag — see
  // N5d/N5e below — so both low-lightness gates now pass `false`
  // explicitly (the l<0.16 call site passes `true`, checked separately).
  const newGate1 = "if (l < 0.32 && s < 0.35) return classifyLowLightAmbiguous(h, s, false);";
  const newGate2 = "if (l < 0.35) return classifyLowLightAmbiguous(h, s, false);";
  const helperSig = 'function classifyLowLightAmbiguous(h, s, veryDark) {';
  for (const line of [newGate1, newGate2, helperSig]) {
    const first = src.indexOf(line);
    assert.ok(first !== -1, `expected the new production line to be present verbatim: ${line}`);
    assert.strictEqual(src.indexOf(line, first + 1), -1, `expected exactly one occurrence of: ${line}`);
  }
});
test('N5d. the l<0.16 gate now also routes by hue (veryDark=true) instead of being hue-blind', () => {
  const newVeryDarkGate = "if (l < 0.16) return classifyLowLightAmbiguous(h, s, true);";
  assert.ok(src.includes(newVeryDarkGate), 'expected the l<0.16 branch to route through classifyLowLightAmbiguous(h, s, true)');
  assert.ok(!src.includes("if (l < 0.16) return 'dark';"), 'the old unconditional hue-blind dark gate must be gone');
});
test('N5e. classifyLowLightAmbiguous only returns \'dark\' (never \'brown\') when veryDark is true, and vice versa', () => {
  assert.strictEqual(classifyIrisColor(60, 45, 35), 'brown', 'sanity: this exact RGB is the H test above, l>=0.16, must stay brown not dark');
  assert.strictEqual(classifyIrisColor(25, 18, 14), 'dark', 'sanity: this exact RGB is the H2 test above, l<0.16 with warm hue, must stay dark');
});

// ================================================================
// RESULTS-SCREEN DEBUG DATA ACCESS — regression tests (this turn).
// ------------------------------------------------------------
// LiveScanScreen/PhotoAnalysisScreen previously computed irisColorAudit
// (debug-only) but only ever stored it in local component state,
// discarded the moment the screen unmounted on navigation to
// ReviewScreen. This turn attaches the SAME already-computed audit
// object onto rec.irisColorAudit (debug-only, additive) so it
// survives ReviewScreen's confirm() (which spreads ...result before
// overriding only eyeProfile/designs/originalAIProfile/
// artistConfirmed) all the way to ResultsScreen (HeroScreen), where a
// new debug-only CopyIrisDebugButton reads it — no second sample, no
// second classification, nothing recomputed.
// ================================================================

// Extract CopyIrisDebugButton's real payload-construction logic
// (the exact source text between `const audit = result.irisColorAudit;`
// and the closing of the `payload` object literal) as a standalone,
// testable function — setState/setTimeout stubbed as no-ops (their
// calls don't affect the early `return;` control flow the real code
// already has for the "no audit" case).
const copyPayloadLogicStart = src.indexOf('        const audit = result.irisColorAudit;');
const copyPayloadLogicEnd = src.indexOf('\n        };\n', src.indexOf('const payload = {', copyPayloadLogicStart)) + '\n        };\n'.length;
if (copyPayloadLogicStart === -1 || copyPayloadLogicEnd === -1) throw new Error('Could not locate CopyIrisDebugButton\'s payload-construction logic — has it moved?');
const copyPayloadLogicSrc = src.slice(copyPayloadLogicStart, copyPayloadLogicEnd);
const buildIrisDebugCopyPayload = new Function('result', 'setState', 'setTimeout',
  copyPayloadLogicSrc + '\nreturn payload;'
);
function extractCopyPayload(result) {
  return buildIrisDebugCopyPayload(result, () => {}, () => {});
}

test('setup2: extracted the real CopyIrisDebugButton payload-construction logic from index.html successfully', () => {
  assert.strictEqual(typeof buildIrisDebugCopyPayload, 'function');
});

// ================================================================
// A. ResultsScreen can access the exact irisColorAudit produced by
// the scan (via rec.irisColorAudit, unchanged through ReviewScreen).
// ================================================================
test('A1. LiveScanScreen attaches irisColorAudit to rec only when debugAvailable, using the SAME object already built for the debug panel (no recomputation)', () => {
  const finalizeSrc = src.slice(src.indexOf('const iris = combineIris(best.leftIris, best.rightIris);'), src.indexOf('setTimeout(() => onCompleteRef.current(rec), 1000);'));
  assert.ok(/let irisColorAuditForRec = null;/.test(finalizeSrc));
  assert.ok(/if \(debugAvailable && debugIrisAuditRef\.current\) \{/.test(finalizeSrc));
  assert.ok(/setDebugIrisAudit\(irisColorAuditForRec\)/.test(finalizeSrc), 'the debug panel state and rec.irisColorAudit must be set from the SAME variable, not two separately-built objects');
  assert.ok(/if \(irisColorAuditForRec\) rec\.irisColorAudit = irisColorAuditForRec;/.test(finalizeSrc));
});
test('A2. PhotoAnalysisScreen attaches irisColorAudit to its rec only when isDebugModeEnabled(), using the SAME object already logged to console', () => {
  const finalizeSrc = src.slice(src.indexOf('const leftIris = sampleIrisColor(ctx, leftEye), rightIris = sampleIrisColor(ctx, rightEye);'), src.indexOf('onComplete(photoRec);') + 'onComplete(photoRec);'.length);
  assert.ok(/let irisColorAuditForRec = null;/.test(finalizeSrc));
  assert.ok(/if \(isDebugModeEnabled\(\)\) \{/.test(finalizeSrc));
  assert.ok(/console\.log\('\[Photo\] IRIS COLOR AUDIT \(debug shadow, not used in production\)', irisColorAuditForRec\);/.test(finalizeSrc));
  assert.ok(/if \(irisColorAuditForRec\) photoRec\.irisColorAudit = irisColorAuditForRec;/.test(finalizeSrc));
});
test('A3. ReviewScreen\'s confirm() spreads ...result BEFORE overriding fields, so irisColorAudit passes through untouched', () => {
  const start = src.indexOf('        onConfirm({');
  const end = src.indexOf('\n      };', start);
  const block = src.slice(start, end);
  assert.ok(/onConfirm\(\{\s*\.\.\.result,/.test(block), 'onConfirm must spread ...result first — this is what carries rec.irisColorAudit through unmodified');
  assert.ok(!/irisColorAudit/.test(block), 'ReviewScreen must not explicitly reference/override irisColorAudit at all — it passes through purely via the spread');
});

// ================================================================
// B. the copied payload contains left/right/combined
// ================================================================
test('B. the copied payload contains irisColorAudit.left/.right/.combined', () => {
  const fakeAudit = { left: { selectedCategory: 'brown', confidence: 0.34 }, right: { selectedCategory: 'brown', confidence: 0.3 }, combined: { selectedCategory: 'brown', confidence: 0.32 } };
  const result = { irisColorAudit: fakeAudit, iris: { name: 'brown', confidence: 0.34 } };
  const payload = extractCopyPayload(result);
  assert.ok(payload.irisColorAudit.left && payload.irisColorAudit.right && payload.irisColorAudit.combined);
});

// ================================================================
// C. classifierInput/classifierTrace survive unchanged
// ================================================================
test('C. classifierInput and classifierTrace survive into the copied payload byte-for-byte', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  const result = { irisColorAudit: { left: audit, right: audit, combined: { selectedCategory: audit.selectedCategory, confidence: audit.confidence } }, iris: { name: audit.selectedCategory, confidence: audit.confidence } };
  const payload = extractCopyPayload(result);
  assert.deepStrictEqual(payload.irisColorAudit.left.classifierInput, audit.classifierInput);
  assert.deepStrictEqual(payload.irisColorAudit.left.classifierTrace, audit.classifierTrace);
});

// ================================================================
// D. acceptedPixels/rejectedPixels survive unchanged, untruncated
// ================================================================
test('D. acceptedPixels/rejectedPixels survive into the copied payload untruncated', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  const result = { irisColorAudit: { left: audit, right: audit, combined: {} }, iris: { name: audit.selectedCategory, confidence: audit.confidence } };
  const payload = extractCopyPayload(result);
  assert.strictEqual(payload.irisColorAudit.left.acceptedPixels.length, audit.acceptedPixels.length);
  assert.strictEqual(payload.irisColorAudit.left.rejectedPixels.length, audit.rejectedPixels.length);
  assert.deepStrictEqual(payload.irisColorAudit.left.acceptedPixels, audit.acceptedPixels);
});

// ================================================================
// E. production iris result can coexist with the debug audit
// ================================================================
test('E. result.iris (production) and result.irisColorAudit (debug) coexist independently on the same object', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  const real = sampleIrisColor(ctx, EYE_POINTS);
  const result = { iris: { color: true, hex: real.hex, name: real.name, confidence: real.confidence }, irisColorAudit: { left: audit, right: audit, combined: {} } };
  const payload = extractCopyPayload(result);
  assert.strictEqual(payload.productionResult.irisColor, result.iris.name);
  assert.strictEqual(payload.productionResult.irisConfidence, result.iris.confidence);
  assert.ok(payload.irisColorAudit.left, 'the debug audit must still be present alongside the production result fields');
});
test('E2. missing irisColorAudit produces an explicit null return, never a silently-copied {}', () => {
  const result = { iris: { name: 'brown', confidence: 0.34 } }; // no irisColorAudit at all
  const payload = extractCopyPayload(result);
  assert.strictEqual(payload, undefined, 'the real copy() function returns early (undefined) when audit is missing — the UI branch shows IRIS DEBUG DATA UNAVAILABLE instead of copying anything, see the component source directly');
});

// ================================================================
// F. button is debug-only
// ================================================================
test('F. CopyIrisDebugButton is only rendered in HeroScreen behind isDebugModeEnabled()', () => {
  const start = src.indexOf('function HeroScreen(');
  const end = src.indexOf('\n    function AllDesignsScreen(');
  const heroSrc = src.slice(start, end);
  assert.ok(/\{isDebugModeEnabled\(\) && <CopyIrisDebugButton result=\{result\} lang=\{lang\} \/>\}/.test(heroSrc), 'CopyIrisDebugButton must be gated by isDebugModeEnabled() in HeroScreen\'s JSX');
});

// ================================================================
// G. normal mode does not retain the new Results debug UI / field
// ================================================================
test('G1. rec.irisColorAudit is only ever assigned inside a debugAvailable-gated block (LiveScanScreen) — absent entirely in normal mode', () => {
  const finalizeSrc = src.slice(src.indexOf('const iris = combineIris(best.leftIris, best.rightIris);'), src.indexOf('setTimeout(() => onCompleteRef.current(rec), 1000);'));
  const varDeclIdx = finalizeSrc.indexOf('let irisColorAuditForRec = null;');
  const gateIdx = finalizeSrc.indexOf('if (debugAvailable && debugIrisAuditRef.current) {');
  const assignIdx = finalizeSrc.indexOf('irisColorAuditForRec = {', gateIdx);
  const recAssignIdx = finalizeSrc.indexOf('if (irisColorAuditForRec) rec.irisColorAudit = irisColorAuditForRec;');
  assert.ok(varDeclIdx !== -1 && varDeclIdx < gateIdx, 'irisColorAuditForRec must default to null before the debug gate');
  assert.ok(assignIdx > gateIdx, 'the audit object is only ever built inside the debugAvailable gate');
  assert.ok(recAssignIdx > assignIdx, 'rec.irisColorAudit is only assigned when the (possibly-still-null) variable is truthy — absent in normal mode');
});
test('G2. HeroScreen never renders CopyIrisDebugButton or any iris-debug text unconditionally', () => {
  const start = src.indexOf('function HeroScreen(');
  const end = src.indexOf('\n    function AllDesignsScreen(');
  const heroSrc = src.slice(start, end);
  const unconditional = heroSrc.replace(/\{isDebugModeEnabled\(\) && <CopyIrisDebugButton[^}]*\}\}?/, '');
  assert.ok(!/<CopyIrisDebugButton/.test(unconditional), 'no unconditional CopyIrisDebugButton render should remain once the one guarded instance is stripped out');
});

// ================================================================
// H. no second call to sampleIrisColor/classifyIrisColor introduced
// by ResultsScreen
// ================================================================
test('H. HeroScreen/CopyIrisDebugButton never call sampleIrisColor or classifyIrisColor', () => {
  const buttonStart = src.indexOf('function CopyIrisDebugButton(');
  const heroEnd = src.indexOf('\n    function AllDesignsScreen(');
  const span = src.slice(buttonStart, heroEnd);
  assert.ok(!/sampleIrisColor\(/.test(span), 'ResultsScreen must never re-sample the iris');
  assert.ok(!/classifyIrisColor\(/.test(span), 'ResultsScreen must never re-classify the iris');
});

// ================================================================
// I. sampleIrisColor/classifyIrisColor/combineIris unchanged (re-
// confirmed this turn specifically, independent of test N5 above)
// ================================================================
test('I. sampleIrisColor delegates to the one shared analyzeIrisSample implementation', () => {
  const start = src.indexOf('    function sampleIrisColor(ctx, eyePoints) {');
  const end = src.indexOf('\n    function rgbToHsl', start);
  const body = src.slice(start,end);
  assert.ok(body.includes('const a = analyzeIrisSample(ctx, eyePoints);'));
  assert.strictEqual((src.match(/function analyzeIrisSample\(/g)||[]).length,1);
});
test('I2. combineIris preserves bilateral spatial ambiguity', () => {
  const uncertain = {rgb:[150,155,160],name:'uncertain',confidence:0.4,hex:'#969ba0'};
  assert.strictEqual(combineIris(uncertain,uncertain).name,'uncertain');
});
// I3 used to assert that classifyIrisColor/IRIS_NAMES textually
// DIFFERED from `git show HEAD:index.html` — a check for "this turn's
// fix was actually applied, not just documented". Now that the fix is
// itself the committed HEAD, current source trivially equals HEAD and
// that comparison is tautologically false forever after — it was
// testing turn-over-turn history, not a property of the code. N5b/N5c
// above already give a HEAD-independent static guarantee that the old
// buggy gates are gone and the new ones are present verbatim; this
// replaces I3 with the matching BEHAVIORAL guarantee (calling the
// real, extracted classifyIrisColor — not a re-implementation) that
// the low-light-ambiguous fix's actual observable contract holds, and
// keeps holding regardless of git history:
//   - a low-light, hue-reliable, non-brown-hue sample must never
//     collapse to 'brown' (the exact real-world bug this fixed);
//   - IRIS_NAMES.uncertain exists with both locales, since
//     classifyLowLightAmbiguous can return it.
test('I3. the low-light-ambiguous fix\'s contract holds NOW (durable, HEAD-independent): a dim reliable-hue blue/green sample never collapses to "brown", and "uncertain" is a real, localized category', () => {
  // Local, self-contained HSL->RGB (same standard formula used by the
  // other real-fixture hue-sweep tests in this file) — not a
  // production function, purely to construct realistic test inputs.
  function hslToRgbForTest(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs(hp % 2 - 1));
    let r1, g1, b1;
    if (hp < 1) [r1, g1, b1] = [c, x, 0]; else if (hp < 2) [r1, g1, b1] = [x, c, 0]; else if (hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp < 4) [r1, g1, b1] = [0, x, c]; else if (hp < 5) [r1, g1, b1] = [x, 0, c]; else [r1, g1, b1] = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
  }
  const dimReliableBlue = classifyIrisColor(...hslToRgbForTest(210, 0.3, 0.28));
  const dimReliableGreen = classifyIrisColor(...hslToRgbForTest(120, 0.3, 0.28));
  assert.notStrictEqual(dimReliableBlue, 'brown', 'a dim but hue-reliable BLUE sample must never be forced to brown');
  assert.notStrictEqual(dimReliableGreen, 'brown', 'a dim but hue-reliable GREEN sample must never be forced to brown');
  assert.strictEqual(dimReliableBlue, 'blue');
  assert.strictEqual(dimReliableGreen, 'green');

  assert.ok(IRIS_NAMES.uncertain, 'IRIS_NAMES must define an "uncertain" category — classifyLowLightAmbiguous can return it');
  assert.strictEqual(typeof IRIS_NAMES.uncertain.ru, 'string');
  assert.strictEqual(typeof IRIS_NAMES.uncertain.en, 'string');
  assert.ok(IRIS_NAMES.uncertain.ru.length > 0 && IRIS_NAMES.uncertain.en.length > 0, 'uncertain must be localized in both RU and EN, not a placeholder');
});

// ================================================================
// J. existing hooding debug payloads remain unaffected
// ================================================================
test('J. Hooding V2 Stage 1/2B core span is byte-identical to the pre-turn committed HEAD', () => {
  const { execSync } = require('child_process');
  const head = execSync('git show HEAD:index.html', { cwd: path.join(__dirname, '..') }).toString();
  function extractSpan(s, startMarker, endMarker) {
    const st = s.indexOf(startMarker);
    const en = s.indexOf(endMarker, st);
    if (st === -1 || en === -1) return null;
    return s.slice(st, en);
  }
  const cur = extractSpan(src, '    const HOODING_V2_STAGE = 1;', '\n    const REASON_MESSAGES = {');
  const prev = extractSpan(head, '    const HOODING_V2_STAGE = 1;', '\n    const REASON_MESSAGES = {');
  assert.ok(cur !== null && prev !== null);
  assert.strictEqual(cur, prev, 'Hooding V2 Stage 1/2B must be byte-identical to the pre-this-turn committed HEAD');
});

// ================================================================
// O/REAL. real regression fixture — NOW AVAILABLE (this turn).
// tests/fixtures/real-capture-2026-08-25.json is the exact irisColorAudit
// JSON from the reported real iPhone failure, untouched (full real
// acceptedPixels/rejectedPixels arrays, not reduced to a synthetic RGB
// restatement). REAL1-REAL9 below: (A/B) exercise the real LEFT/RIGHT
// acceptedPixels fixtures directly, (C) reproduce the OLD (pre-this-
// turn) pipeline's brown result from them, (D) show the CORRECTED
// pipeline's result from the SAME real pixels, (M) determinism, (N)
// no-fabricated-certainty, (O) debug-audit parity remains functional.
// ================================================================
const REAL_LEFT = REAL_FIXTURE.irisColorAudit.left;
const REAL_RIGHT = REAL_FIXTURE.irisColorAudit.right;

// A frozen, explicitly-labeled HISTORICAL SNAPSHOT of classifyIrisColor's
// pre-this-turn logic (hand-copied from the pre-turn committed HEAD,
// cross-checked against N5/I above which prove the live source no longer
// contains these exact lines). Used ONLY to prove what the OLD pipeline
// produced on the real fixture (test REAL3/REAL4) — never used to decide
// anything about the NEW pipeline's correctness.
function legacyClassifyIrisColor(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l < 0.16) return 'dark';
  if (l < 0.32 && s < 0.35) return 'brown';
  if (h >= 20 && h <= 45 && s > 0.25 && l >= 0.25 && l < 0.55) return 'hazel';
  if (h >= 40 && h <= 70 && s > 0.15 && l >= 0.35) return 'amber';
  if (h >= 70 && h <= 170 && s > 0.15) return 'green';
  if (h >= 180 && h <= 250 && s > 0.12) return 'blue';
  if (s < 0.15 && l >= 0.35 && l < 0.7) return 'gray';
  if (l < 0.35) return 'brown';
  return 'mixed';
}

test('REAL-A. exact real LEFT acceptedPixels fixture: recomputing median RGB from the raw pixel array reproduces the recorded rawColorStats/classifierInput byte-for-byte', () => {
  const px = REAL_LEFT.acceptedPixels;
  assert.strictEqual(px.length, 411);
  const rMed = median(px.map(p => p.r)), gMed = median(px.map(p => p.g)), bMed = median(px.map(p => p.b));
  assert.strictEqual(rMed, REAL_LEFT.rawColorStats.medianRgb.r);
  assert.strictEqual(gMed, REAL_LEFT.rawColorStats.medianRgb.g);
  assert.strictEqual(bMed, REAL_LEFT.rawColorStats.medianRgb.b);
  assert.strictEqual(rMed, REAL_LEFT.classifierInput.r);
  assert.strictEqual(gMed, REAL_LEFT.classifierInput.g);
  assert.strictEqual(bMed, REAL_LEFT.classifierInput.b);
  const hsl = rgbToHsl(rMed, gMed, bMed);
  assert.ok(Math.abs(hsl.l - REAL_LEFT.classifierInput.l) < 1e-9);
  assert.ok(Math.abs(hsl.s - REAL_LEFT.classifierInput.s) < 1e-9);
});
test('REAL-B. exact real RIGHT acceptedPixels fixture: recomputing median RGB from the raw pixel array reproduces the recorded rawColorStats/classifierInput byte-for-byte', () => {
  const px = REAL_RIGHT.acceptedPixels;
  assert.strictEqual(px.length, 377);
  const rMed = median(px.map(p => p.r)), gMed = median(px.map(p => p.g)), bMed = median(px.map(p => p.b));
  assert.strictEqual(rMed, REAL_RIGHT.rawColorStats.medianRgb.r);
  assert.strictEqual(gMed, REAL_RIGHT.rawColorStats.medianRgb.g);
  assert.strictEqual(bMed, REAL_RIGHT.rawColorStats.medianRgb.b);
  assert.strictEqual(rMed, REAL_RIGHT.classifierInput.r);
  assert.strictEqual(gMed, REAL_RIGHT.classifierInput.g);
  assert.strictEqual(bMed, REAL_RIGHT.classifierInput.b);
});
test('REAL-C. OLD pipeline reproduction: legacyClassifyIrisColor on the exact real median RGB for both eyes reproduces the documented false "brown" result', () => {
  assert.strictEqual(legacyClassifyIrisColor(REAL_LEFT.classifierInput.r, REAL_LEFT.classifierInput.g, REAL_LEFT.classifierInput.b), 'brown');
  assert.strictEqual(legacyClassifyIrisColor(REAL_RIGHT.classifierInput.r, REAL_RIGHT.classifierInput.g, REAL_RIGHT.classifierInput.b), 'brown');
  assert.strictEqual(REAL_LEFT.selectedCategory, 'brown', 'sanity: matches what production actually recorded for this real capture');
  assert.strictEqual(REAL_RIGHT.selectedCategory, 'brown');
});
test('REAL-C2. OLD pipeline generalization proof: a full 0-360deg hue sweep at the REAL captured lightness/saturation of BOTH eyes forces "brown" for every single hue under the legacy rule — this is why the bug is not subject-specific', () => {
  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs(hp % 2 - 1));
    let r1, g1, b1;
    if (hp < 1) [r1, g1, b1] = [c, x, 0]; else if (hp < 2) [r1, g1, b1] = [x, c, 0]; else if (hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp < 4) [r1, g1, b1] = [0, x, c]; else if (hp < 5) [r1, g1, b1] = [x, 0, c]; else [r1, g1, b1] = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
  }
  for (const eye of [REAL_LEFT, REAL_RIGHT]) {
    for (let h = 0; h < 360; h += 15) {
      const [r, g, b] = hslToRgb(h, eye.classifierInput.s, eye.classifierInput.l);
      assert.strictEqual(legacyClassifyIrisColor(r, g, b), 'brown', `legacy rule must force 'brown' at h=${h} for this eye's real l/s — proving hue was never consulted`);
    }
  }
});
test('REAL-D. CORRECTED pipeline, SAME real pixels: LEFT (saturation below the reliable-hue bar) now returns "uncertain" instead of a confidently-wrong "brown"', () => {
  const ci = REAL_LEFT.classifierInput;
  assert.ok(ci.s < 0.15, 'sanity: this real eye\'s own captured saturation is genuinely below the reliability bar — not assumed');
  assert.strictEqual(classifyIrisColor(ci.r, ci.g, ci.b), 'uncertain');
});
test('REAL-D2. CORRECTED pipeline, SAME real pixels: RIGHT (saturation above the reliable-hue bar, hue is warm) still returns "brown" — the fix does not invent a light color the real pixel evidence does not support', () => {
  const ci = REAL_RIGHT.classifierInput;
  assert.ok(ci.s >= 0.15 && (ci.h > 250 || ci.h < 70), 'sanity: this real eye\'s own captured hue/saturation genuinely support brown');
  assert.strictEqual(classifyIrisColor(ci.r, ci.g, ci.b), 'brown');
});
test('REAL-D3. CORRECTED combined result: combineIris on the real LEFT/RIGHT rgb now reports "uncertain" (not a confidently-wrong "brown", and not a fabricated light color) — confidence heuristic itself is unchanged (0.3419847...), only the category changed', () => {
  const l = { rgb: [REAL_LEFT.classifierInput.r, REAL_LEFT.classifierInput.g, REAL_LEFT.classifierInput.b], confidence: REAL_LEFT.confidence, hex: null, name: REAL_LEFT.selectedCategory };
  const r = { rgb: [REAL_RIGHT.classifierInput.r, REAL_RIGHT.classifierInput.g, REAL_RIGHT.classifierInput.b], confidence: REAL_RIGHT.confidence, hex: null, name: REAL_RIGHT.selectedCategory };
  const combined = combineIris(l, r);
  assert.strictEqual(combined.name, 'uncertain');
  assert.ok(Math.abs(combined.confidence - REAL_FIXTURE.irisColorAudit.combined.confidence) < 1e-9, 'confidence formula itself must be byte-identical to the recorded real confidence — this turn only changed the category decision, never the confidence heuristic');
});
test('REAL-E. spatial finding, real data: BOTH eyes independently show the same upper-ROI-darker-and-more-saturated / lower-ROI-lighter-and-less-saturated bias (consistent with eyelid-crease/lash shadow) — computed live from the real fixture, not hardcoded', () => {
  for (const eye of [REAL_LEFT, REAL_RIGHT]) {
    const cy = eye.roi.cy;
    const upper = eye.acceptedPixels.filter(p => p.y - cy < 0);
    const lower = eye.acceptedPixels.filter(p => p.y - cy >= 0);
    const meanL = arr => arr.reduce((a, p) => a + rgbToHsl(p.r, p.g, p.b).l, 0) / arr.length;
    const meanS = arr => arr.reduce((a, p) => a + rgbToHsl(p.r, p.g, p.b).s, 0) / arr.length;
    assert.ok(meanL(upper) < meanL(lower), 'upper portion must read darker than lower portion');
    assert.ok(meanS(upper) > meanS(lower), 'upper portion must read more saturated than lower portion');
  }
});
test('REAL-E2. spatial finding does NOT fully explain the false result: even the LOWER (less-contaminated) half of each eye\'s real accepted pixels still lands in the low-lightness zone (l<0.35) — proving ROI/sampling contamination alone would not have fixed this without also fixing classifyIrisColor', () => {
  for (const eye of [REAL_LEFT, REAL_RIGHT]) {
    const cy = eye.roi.cy;
    const lower = eye.acceptedPixels.filter(p => p.y - cy >= 0);
    const rMed = median(lower.map(p => p.r)), gMed = median(lower.map(p => p.g)), bMed = median(lower.map(p => p.b));
    const { l } = rgbToHsl(rMed, gMed, bMed);
    assert.ok(l < 0.35, `expected the cleaner lower-half-only aggregate to still be in the ambiguous low-light zone, got l=${l}`);
  }
});
test('REAL-M. LEFT/RIGHT classification is deterministic across repeated calls on the same real pixel data', () => {
  const ci = REAL_LEFT.classifierInput;
  const results = new Set();
  for (let i = 0; i < 20; i++) results.add(classifyIrisColor(ci.r, ci.g, ci.b));
  assert.strictEqual(results.size, 1, 'repeated classification of identical real input must always produce the identical result');
});
test('REAL-N. missing/poor samples still return an explicit null (never a fabricated category) — unchanged, pre-existing sampleIrisColor behavior, unaffected by this turn', () => {
  // Uniformly bright/near-white ROI: every in-circle pixel is rejected by
  // the (unchanged) bright_specular gate, so stage-1 accepted count is 0
  // (<6) and sampleIrisColor must fall back to its existing null-name path
  // rather than fabricate a category from nothing.
  const tinyCtx = makeFakeCtx(80, 80, () => [250, 250, 250]);
  const result = sampleIrisColor(tinyCtx, EYE_POINTS);
  assert.strictEqual(result.rgb, null, 'insufficient real samples must never produce a fabricated rgb');
  assert.strictEqual(result.name, null, 'insufficient real samples must never produce a fabricated category');
});
test('REAL-O. debug audit parity remains functional after this turn\'s classifyIrisColor change: a broad RGB sweep shows debugIrisClassifyWithTrace.name === real classifyIrisColor for every combination (incl. the new "uncertain" branches)', () => {
  let checked = 0;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 31) for (let b = 0; b <= 255; b += 41) {
    checked++;
    const real = classifyIrisColor(r, g, b);
    const trace = debugIrisClassifyWithTrace(r, g, b);
    assert.strictEqual(trace.name, real, `debug trace/real mismatch at rgb(${r},${g},${b}): trace=${trace.name} real=${real}`);
  }
  assert.ok(checked > 500, 'sanity: the sweep actually covered a meaningful number of combinations');
});

// ================================================================
// FOLLOW-UP INSTRUMENTATION — regression tests (this turn, part 2).
// ------------------------------------------------------------
// User-approved the classifyIrisColor fix but asked for one more
// upstream investigation into WHY the real capture reaches the
// classifier this warm/dark, WITHOUT further tuning classifyIrisColor.
// Four new debug-only helpers were added to buildIrisColorAudit's
// output (pupilCandidate, regionStats, surroundingRef, roiSnapshot) —
// purely descriptive, none read by classification. sampleIrisColor,
// combineIris, and classifyIrisColor/classifyLowLightAmbiguous
// themselves are NOT touched this part (re-confirmed by INSTR-1/2/9
// below, reusing the same byte-identity technique as tests I/I2/I3).
// ================================================================
test('INSTR-1. production sampler and debug audit both use analyzeIrisSample', () => {
  assert.ok(src.includes('const a = analyzeIrisSample(ctx, eyePoints);'));
  assert.strictEqual((src.match(/const a = analyzeIrisSample\(ctx, eyePoints\);/g)||[]).length,1, 'production sampleIrisColor must keep its direct shared-pipeline call');
  assert.ok(src.includes('const a = fixedCenter ? analyzeIrisSample(ctx, eyePoints, fixedCenter) : analyzeIrisSample(ctx, eyePoints);'), 'debug audit may supply only the mapped native center while retaining the same sampler');
});
test('INSTR-2. combineIris and classifyIrisColor/classifyLowLightAmbiguous remain unchanged while uncertain uses non-retry wording', () => {
  const classifyBlockStart = src.indexOf('    const IRIS_NAMES = {');
  const classifyBlockEnd = src.indexOf('\n    function debugIrisRgbToHsl(');
  const block = src.slice(classifyBlockStart, classifyBlockEnd);
  // Classification logic remains pinned; only the user-facing wording of
  // its inconclusive outcome changed because it is not a quality rejection.
  for (const line of [
    "uncertain: {ru:'Оттенок не определён', en:'Color inconclusive'},",
    'function classifyLowLightAmbiguous(h, s, veryDark) {',
    "if (l < 0.32 && s < 0.35) return classifyLowLightAmbiguous(h, s, false);",
    "if (l < 0.35) return classifyLowLightAmbiguous(h, s, false);",
    'function combineIris(l, r) {',
  ]) {
    assert.ok(block.includes(line) || src.includes(line), `expected the previously-approved line to still be present verbatim: ${line}`);
  }
});
test('INSTR-3. buildIrisColorAudit output (REAL fixture, both eyes) now includes exposure/pupilCandidate/regionStats/surroundingRef/roiSnapshot fields', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  for (const key of ['exposure', 'pupilCandidate', 'regionStats', 'surroundingRef', 'roiSnapshot']) {
    assert.ok(key in audit, `expected buildIrisColorAudit to return a '${key}' field`);
  }
  assert.ok(typeof audit.exposure.candidateMeanLightness === 'number');
  assert.ok(audit.regionStats.upper && audit.regionStats.lower, 'regionStats must summarize both halves for a normal, well-populated ROI');
});
test('INSTR-4. roiSnapshot gracefully returns null in this Node test environment (no `document`) — never throws', () => {
  assert.strictEqual(typeof document, 'undefined', 'sanity: this test environment genuinely has no document, same as production Node-side tooling would');
  assert.strictEqual(debugIrisRoiSnapshot(new Uint8ClampedArray(16), 2, 2), null);
});
test('INSTR-5. debugIrisPupilCandidate reproduces the REAL fixture\'s dark-cluster geometry: LEFT is far off-center (lash/lid-like), RIGHT is nearly centered (pupil-like) — computed live from the real fixture, not hardcoded', () => {
  const leftPupil = debugIrisPupilCandidate(REAL_LEFT.rejectedPixels, REAL_LEFT.roi);
  const rightPupil = debugIrisPupilCandidate(REAL_RIGHT.rejectedPixels, REAL_RIGHT.roi);
  assert.ok(Math.abs(leftPupil.centerOffset.dx) > 0.5, `LEFT dark-cluster centroid must be far off-center (lash/lid-like), got dx=${leftPupil.centerOffset.dx}`);
  assert.ok(Math.sqrt(rightPupil.centerOffset.dx ** 2 + rightPupil.centerOffset.dy ** 2) < 0.3, `RIGHT dark-cluster centroid must be close to the ROI center (pupil-like), got ${JSON.stringify(rightPupil.centerOffset)}`);
});
test('INSTR-6. debugIrisRegionStats on the REAL fixture reproduces last turn\'s manual upper/lower finding: upper darker+more saturated than lower, for BOTH eyes', () => {
  for (const eye of [REAL_LEFT, REAL_RIGHT]) {
    const stats = debugIrisRegionStats(eye.acceptedPixels, eye.roi);
    assert.ok(stats.upper.meanHsl.l < stats.lower.meanHsl.l, 'upper must read darker than lower');
    assert.ok(stats.upper.meanHsl.s > stats.lower.meanHsl.s, 'upper must read more saturated than lower');
  }
});
test('INSTR-7. debugIrisSurroundingRef never throws and returns a well-formed shape even when the annulus goes out of the available image bounds', () => {
  const ctx = solidCtx(68, 74, 80, 4); // 80x80 fake canvas — the 1.4x-2.2x annulus around a small ROI comfortably fits
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  assert.ok('pixelCount' in audit.surroundingRef);
  // Deliberately tiny canvas so the annulus request goes out of bounds —
  // must degrade gracefully (never throw up into buildIrisColorAudit).
  const tinyCtx = makeFakeCtx(10, 10, () => [80, 80, 80]);
  assert.doesNotThrow(() => buildIrisColorAudit(tinyCtx, EYE_POINTS));
});
test('INSTR-8. calling the new debug-only helpers does not alter what sampleIrisColor subsequently returns for the same input (extends test K to the new instrumentation)', () => {
  const ctx = solidCtx(68, 74, 80, 4);
  const before = sampleIrisColor(ctx, EYE_POINTS);
  buildIrisColorAudit(ctx, EYE_POINTS); // now also computes exposure/pupilCandidate/regionStats/surroundingRef/roiSnapshot internally
  const after = sampleIrisColor(ctx, EYE_POINTS);
  assert.deepStrictEqual(before, after, 'production sampleIrisColor must be completely unaffected by the new debug-only instrumentation');
});
test('INSTR-9. the full buildIrisColorAudit payload (including the new fields) still survives JSON.stringify (extends test M)', () => {
  const ctxL = solidCtx(68, 74, 80, 4);
  const audit = buildIrisColorAudit(ctxL, EYE_POINTS);
  let jsonStr;
  assert.doesNotThrow(() => { jsonStr = JSON.stringify(audit); });
  assert.ok(jsonStr.length > 0);
  const parsed = JSON.parse(jsonStr);
  assert.ok(parsed.pupilCandidate && parsed.regionStats && parsed.surroundingRef && ('roiSnapshot' in parsed));
});
test('INSTR-10. real-capture pupilCandidate/regionStats findings are reported as investigation findings only — classifyIrisColor itself still ignores them entirely (no wiring introduced)', () => {
  const classifyBlockStart = src.indexOf('    function classifyIrisColor(r,g,b) {');
  const classifyBlockEnd = src.indexOf('\n\n    // ============================================================\n    // IRIS COLOR — DEBUG-ONLY RAW PIXEL AUDIT');
  const block = src.slice(classifyBlockStart, classifyBlockEnd);
  assert.ok(!/pupilCandidate|regionStats|surroundingRef|roiSnapshot/.test(block), 'classifyIrisColor must not reference any of the new investigation-only fields');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
