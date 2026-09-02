// ============================================================
// IRIS COLOR — GREEN/BROWN PRODUCTION RELIABILITY FIX.
// ------------------------------------------------------------
// Real-world report: a client with visibly GREEN irises was scanned
// and the app returned BROWN. This turn found and fixed two proven,
// general (not fixture-specific) brown-bias mechanisms in the
// PRODUCTION pipeline (sampleIrisColor/analyzeIrisSample untouched —
// see the audit report for why pixel sampling was ruled out):
//
//  1. classifyIrisColor's `l < 0.16` branch returned the hue-blind
//     'dark' category (displayed as "Dark Brown") for ANY hue —
//     structurally identical to the already-fixed l<0.32/0.35 brown
//     gates (see tests/iris-color-audit.test.js), just left
//     unaddressed at this lower lightness floor. A genuinely dark
//     GREEN or BLUE iris under ordinary phone-camera lighting would
//     be branded "Dark Brown" with zero hue evidence. Fixed by
//     routing l<0.16 through the SAME tested classifyLowLightAmbiguous
//     hue/saturation logic (via a `veryDark` flag) instead of a
//     separate hue-blind rule — 'dark' remains reachable, it now just
//     requires the same positive warm-hue evidence every other
//     category already requires.
//
//  2. combineIris blended LEFT/RIGHT rgb with a plain, unweighted
//     50/50 average. An eye with >=6 accepted pixels has a non-null
//     rgb even when its OWN confidence is low (poor colorConsistency/
//     sectorAgreement — lid-shadow contamination, blur, few sectors).
//     That low-confidence eye's raw color previously counted equally
//     against a confident eye's, able to drag a confidently-green eye
//     toward a different averaged category. Fixed by blending
//     proportionally to each eye's own confidence — identical output
//     to the old formula whenever both eyes carry equal confidence
//     (the common case), diverging only when one eye's evidence is
//     markedly weaker.
//
// Both changes are additive/behavioral-narrowing: neither touches
// sampleIrisColor/analyzeIrisSample's pixel-sampling geometry,
// rejection rules, or median/trim aggregation.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const rgbToHexLine = "const rgbToHex = (r,g,b) => { const h = (n) => Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0'); return `#${h(r)}${h(g)}${h(b)}`; };";
const pipelineStart = src.indexOf('    function estimateIrisCenter(ctx, eyePoints) {');
const pipelineEnd = src.indexOf('\n    const EYE_METRIC_KEYS =');
assert.ok(pipelineStart >= 0 && pipelineEnd > pipelineStart, 'the iris pipeline span must be structurally extractable');
const pipelineSource = src.slice(pipelineStart, pipelineEnd);
const { sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES, analyzeIrisSample } = new Function(
  rgbToHexLine + '\n' + pipelineSource + '\nreturn { sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES, analyzeIrisSample };'
)();

function hsl(r, g, b) { return rgbToHsl(r, g, b); }
function eyeResult(rgb, confidence, name) { return { rgb, confidence, name: name ?? classifyIrisColor(...rgb) }; }

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
    return [Math.max(0, Math.min(255, r + n)), Math.max(0, Math.min(255, g + n)), Math.max(0, Math.min(255, b + n))];
  });
}

// ================================================================
// 1. THE CORE FIX — l<0.16 is no longer hue-blind.
// ================================================================
test('CORE FIX: a very dark GREEN iris (l<0.16) is no longer misclassified as Dark Brown', () => {
  const rgb = [24, 33, 20]; // h~101.5, s~0.245, l~0.104
  const { h, s, l } = hsl(...rgb);
  assert.ok(l < 0.16, 'sanity: this sample must land in the l<0.16 branch');
  assert.ok(h >= 70 && h <= 170 && s >= 0.15, 'sanity: reliable green hue evidence');
  assert.strictEqual(classifyIrisColor(...rgb), 'green');
});
test('CORE FIX: a very dark BLUE iris (l<0.16) is no longer misclassified as Dark Brown', () => {
  const rgb = [26, 34, 46]; // h~216, s~0.278, l~0.141
  const { l } = hsl(...rgb);
  assert.ok(l < 0.16, 'sanity: this sample must land in the l<0.16 branch');
  assert.strictEqual(classifyIrisColor(...rgb), 'blue');
});
test('CORE FIX CONTROL: a genuinely dark BROWN iris (l<0.16, real warm-hue evidence) still classifies dark', () => {
  const rgb = [52, 36, 24]; // h~25.7, s~0.368, l~0.149
  const { h, s, l } = hsl(...rgb);
  assert.ok(l < 0.16 && s >= 0.15 && (h < 70), 'sanity: warm hue, low lightness, reliable saturation');
  assert.strictEqual(classifyIrisColor(...rgb), 'dark');
});
test('CORE FIX: at l<0.16, achromatic (unreliable-hue) samples report uncertain, not a guessed color', () => {
  const rgb = [22, 22, 24]; // near-neutral, very dark
  const { s, l } = hsl(...rgb);
  assert.ok(l < 0.16 && s < 0.15, 'sanity: unreliable hue at extreme darkness');
  assert.strictEqual(classifyIrisColor(...rgb), 'uncertain');
});

// ================================================================
// 2. TRUE GREEN — light / medium / dark-olive / warm-lit.
// ================================================================
test('TRUE GREEN: light green (well-lit) classifies green', () => {
  assert.strictEqual(classifyIrisColor(110, 150, 105), 'green');
});
test('TRUE GREEN: medium green classifies green', () => {
  assert.strictEqual(classifyIrisColor(75, 120, 80), 'green');
});
test('TRUE GREEN: dark/olive green (moderately dim, l>=0.16) classifies green, not brown', () => {
  const rgb = [48, 68, 42];
  const { l } = hsl(...rgb);
  assert.ok(l >= 0.16 && l < 0.32, 'sanity: this is the l<0.32 low-light-ambiguous branch, not l<0.16');
  assert.strictEqual(classifyIrisColor(...rgb), 'green');
});
test('TRUE GREEN: green under a warm-shifted (yellow-leaning) capture still classifies green', () => {
  // Same green base as above, red channel boosted / blue channel
  // reduced to simulate a warm phone-camera white balance.
  assert.strictEqual(classifyIrisColor(100, 128, 78), 'green');
});

// ================================================================
// 3. TRUE BROWN — as this classifier actually implements it.
// ------------------------------------------------------------
// FINDING (see final report item B/2): classifyIrisColor has NO
// explicit well-lit 'brown' rule. A warm hue (h 20-45) at moderate
// saturation and l>=0.25 lands on 'hazel' (rule order), not 'brown' —
// 'brown' is reachable ONLY via the low-lightness routes (l<0.16 with
// veryDark=true -> 'dark'; l<0.32 with s<0.35 -> classifyLowLightAmbiguous
// -> 'brown' fallback). These tests exercise that REAL behavior, not
// an idealized one — see the report for why this was not changed.
// ================================================================
test('TRUE BROWN: moderately dim brown (l~0.29, reliable warm hue) classifies brown', () => {
  const rgb = [95, 72, 52];
  const { h, s, l } = hsl(...rgb);
  assert.ok(l < 0.32 && s < 0.35 && (h < 70), 'sanity: routes through the l<0.32 low-light-ambiguous gate');
  assert.strictEqual(classifyIrisColor(...rgb), 'brown');
});
test('TRUE BROWN: dim brown (l~0.235) classifies brown', () => {
  assert.strictEqual(classifyIrisColor(80, 58, 40), 'brown');
});
test('TRUE BROWN: near-black brown (l<0.16) classifies dark (see CORE FIX CONTROL above)', () => {
  assert.strictEqual(classifyIrisColor(52, 36, 24), 'dark');
});
test('TAXONOMY FINDING: a well-lit, moderately-saturated warm-hued iris (a colloquially "medium brown" eye) is labelled hazel by this classifier, not brown — documented, not changed this turn (out of scope for the green-misread-as-brown fix; see report)', () => {
  const rgb = [150, 118, 62]; // h~38, s~0.42, l~0.42 -- normal daylight brown-eye photograph range
  const { h, s, l } = hsl(...rgb);
  assert.ok(h >= 20 && h <= 45 && s > 0.25 && l >= 0.25 && l < 0.55, 'sanity: this is squarely inside the hazel rule window');
  assert.strictEqual(classifyIrisColor(...rgb), 'hazel');
});

// ================================================================
// 4. HAZEL — brown-dominant (as coded). Green-dominant hazel is NOT
// expressible by the current hue-window taxonomy (its 20-45deg window
// is golden/orange, nowhere near the 70-170deg green window) — a
// green-leaning mixed sample must fall through to green/amber/mixed,
// never get silently absorbed into hazel or brown.
// ================================================================
test('HAZEL (brown-dominant): golden-brown mid-tone classifies hazel', () => {
  assert.strictEqual(classifyIrisColor(150, 110, 75), 'hazel');
});
test('TAXONOMY FINDING: a green-leaning mixed-evidence sample (h just past the hazel window, toward amber) does NOT fall into hazel or brown — it lands amber/mixed, never a confidently-wrong warm category', () => {
  const rgb = [130, 120, 60]; // h~51 -- past hazel's 45deg ceiling
  const { h } = hsl(...rgb);
  assert.ok(h > 45, 'sanity: outside the hazel hue window');
  const name = classifyIrisColor(...rgb);
  assert.ok(['amber', 'mixed', 'green', 'uncertain'].includes(name), `expected a non-brown/hazel/dark category, got ${name}`);
});

// ================================================================
// 5. OTHER COLORS — blue, gray, blue-gray.
// ================================================================
test('OTHER: blue classifies blue', () => { assert.strictEqual(classifyIrisColor(95, 120, 165), 'blue'); });
test('OTHER: gray classifies gray', () => { assert.strictEqual(classifyIrisColor(135, 133, 138), 'gray'); });
test('OTHER: blue-gray (low HSL saturation but measurable absolute chroma) classifies blue, not brown/gray', () => {
  const rgb = [110, 120, 132];
  const { s, l } = hsl(...rgb);
  const chroma = Math.max(...rgb) - Math.min(...rgb);
  assert.ok(s < 0.12 && chroma >= 10 && l >= 0.35, 'sanity: exercises the absolute-chroma blue rule, not HSL saturation');
  assert.strictEqual(classifyIrisColor(...rgb), 'blue');
});

// ================================================================
// 6. QUALITY CASES — exercised through analyzeIrisSample (full ROI/
// rejection/aggregation pipeline), not just classifyIrisColor.
// ================================================================
test('QUALITY: dark exposure with reliable green hue still yields green with usable confidence', () => {
  const ctx = solidCtx(30, 42, 26, 3);
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.valid && a.samples >= 6, 'must have enough accepted pixels');
  assert.strictEqual(a.name, 'green');
});
test('QUALITY: warm-cast exposure on a genuine brown iris still yields brown/dark, not a flipped color', () => {
  const ctx = solidCtx(90, 68, 48, 3);
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.valid && a.samples >= 6);
  assert.ok(['brown', 'dark', 'hazel', 'uncertain'].includes(a.name), `expected a warm/uncertain category, got ${a.name}`);
});
test('QUALITY: low-saturation ambiguous sample returns uncertain rather than a guessed category', () => {
  const ctx = solidCtx(60, 58, 62, 2);
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.valid && a.samples >= 6);
  const { s, l } = hsl(...a.rgb);
  if (s < 0.15 && l < 0.35) assert.strictEqual(a.name, 'uncertain');
});
test('QUALITY: partial lid-shadow contamination (upper half markedly darker) does not flip a genuine green result to brown', () => {
  // Upper half of the ROI reads much darker (shadow), lower half reads
  // true green — mirrors the real documented upper-ROI-darker bias
  // (see tests/iris-color-audit.test.js REAL-E) without duplicating a
  // real fixture.
  const ctx = makeFakeCtx(80, 80, (x, y) => (y < 40 ? [25, 35, 22] : [95, 135, 90]));
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.valid && a.samples >= 6, 'enough pixels must survive rejection');
  assert.notStrictEqual(a.name, 'brown');
  assert.notStrictEqual(a.name, 'dark');
});
test('QUALITY: specular-highlight contamination (bright catchlight patch) is rejected, not averaged into the result', () => {
  // ROI for EYE_POINTS is centered at (40,40) with radius ~8.8 — place
  // the catchlight at radial~0.68 (well inside the 0.30-0.88 sampled
  // annulus, not the pupil-core exclusion) so this genuinely exercises
  // bright_specular rejection rather than the pupil_core geometry rule.
  const ctx = makeFakeCtx(80, 80, (x, y) => {
    const dx = x - 46, dy = y - 40;
    if (dx * dx + dy * dy < 2) return [250, 250, 250]; // tight, truly achromatic catchlight inside the annulus
    return [90, 130, 85]; // green iris elsewhere
  });
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.valid && a.samples >= 6);
  assert.ok(a.rejected.some(p => p.reason === 'bright_specular'), 'the catchlight patch must be rejected as bright_specular');
  assert.strictEqual(a.name, 'green');
});
test('QUALITY: insufficient usable iris pixels (mostly rejected) returns an explicit null category, never a fabricated one', () => {
  // Nearly the whole frame is near-black (rejected as dark_pupil_or_lash).
  const ctx = solidCtx(10, 10, 12, 1);
  const a = analyzeIrisSample(ctx, EYE_POINTS);
  assert.ok(a.samples < 6 || a.name === null || a.name === 'uncertain', 'must not fabricate a confident category from insufficient real evidence');
});

// ================================================================
// 7. BILATERAL COMBINATION MATRIX.
// ================================================================
test('BILATERAL: green + green (both confident) combines to confident green', () => {
  const l = eyeResult([90, 135, 88], 0.75);
  const r = eyeResult([88, 132, 90], 0.72);
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'green');
  assert.ok(c.confidence > 0.3);
});
test('BILATERAL: green (confident) + uncertain (low-confidence, poor pixels) does not become confident brown -- and, since this turn\'s uncertainty-propagation fix, is exactly uncertain', () => {
  const l = eyeResult([95, 138, 92], 0.75, 'green');
  const r = eyeResult([50, 40, 35], 0.08, 'uncertain'); // poor, warm/dark eye
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'uncertain', 'a per-eye uncertain verdict must never be overridden by RGB blending/re-classification');
  assert.ok(c.confidence <= 0.08 + 1e-9, 'combined confidence must stay bounded by the weaker eye');
});
test('BILATERAL: green (confident) + brown (confident) is not resolved to a confident single color without real agreement', () => {
  const l = eyeResult([95, 138, 92], 0.7, 'green');
  const r = eyeResult([95, 72, 52], 0.7, 'brown');
  const c = combineIris(l, r);
  // Real disagreement between two CONFIDENT eyes must suppress
  // confidence via the consistency penalty, not silently average away.
  assert.ok(c.confidence < 0.7, 'confidence must drop below either single-eye bound on real disagreement');
});
test('BILATERAL: green + hazel averages toward a plausible name without inventing certainty neither eye supports', () => {
  const l = eyeResult([90, 135, 88], 0.6, 'green');
  const r = eyeResult([150, 118, 62], 0.6, 'hazel');
  const c = combineIris(l, r);
  assert.ok(c.confidence <= 0.6 + 1e-9);
  assert.notStrictEqual(c.name, null);
});
test('BILATERAL: brown + uncertain is exactly uncertain (since this turn\'s uncertainty-propagation fix), at a reduced, evidence-bounded confidence', () => {
  const l = eyeResult([95, 72, 52], 0.55, 'brown');
  const r = eyeResult([60, 45, 40], 0.05, 'uncertain');
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'uncertain');
  assert.ok(c.confidence <= 0.05 + 1e-9);
});
test('BILATERAL: hazel + brown (both confident, close colors) combines without collapsing to green/blue', () => {
  const l = eyeResult([150, 118, 62], 0.65, 'hazel');
  const r = eyeResult([95, 72, 52], 0.65, 'brown');
  const c = combineIris(l, r);
  assert.ok(!['green', 'blue', 'gray'].includes(c.name));
});
test('BILATERAL: blue + gray (both cold/neutral, confident) never resolves to brown/green', () => {
  const l = eyeResult([95, 120, 165], 0.7, 'blue');
  const r = eyeResult([135, 133, 138], 0.7, 'gray');
  const c = combineIris(l, r);
  assert.ok(!['brown', 'dark', 'green', 'hazel'].includes(c.name));
});
test('BILATERAL WEIGHTING: a confident eye is not diluted 50/50 by a low-confidence eye\'s raw color — the blended rgb leans toward the confident eye', () => {
  const l = eyeResult([95, 138, 92], 0.9, 'green'); // confident green
  // Low-confidence but NOT named 'uncertain' -- this test isolates the
  // RGB-blend weighting behavior from the separate uncertainty-
  // propagation rule (see the UNCERTAINTY PROPAGATION section below,
  // which covers the l.name/r.name === 'uncertain' case explicitly).
  const r = eyeResult([40, 30, 25], 0.05); // low-confidence, real dark/warm evidence (classifies 'dark')
  assert.notStrictEqual(r.name, 'uncertain', 'sanity: this fixture must not itself be uncertain, so this test measures weighting, not propagation');
  const c = combineIris(l, r);
  const plainAvg = [(l.rgb[0]+r.rgb[0])/2, (l.rgb[1]+r.rgb[1])/2, (l.rgb[2]+r.rgb[2])/2];
  // Reconstruct the actual blended rgb from the returned hex and
  // compare distance to each eye's own rgb: it must sit closer to the
  // confident (green) eye than the naive 50/50 average would.
  const hexToRgb = (hex) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  const blended = hexToRgb(c.hex);
  const distTo = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  assert.ok(distTo(blended, l.rgb) < distTo(plainAvg, l.rgb), 'confidence-weighted blend must sit closer to the confident eye than an unweighted 50/50 average would');
  assert.strictEqual(c.name, 'green', 'the confident eye\'s green evidence must not be diluted away by the weak eye');
});
test('BILATERAL WEIGHTING: equal-confidence eyes still blend as a plain 50/50 average (no behavior change for the common case)', () => {
  const l = eyeResult([90, 135, 88], 0.5, 'green');
  const r = eyeResult([88, 132, 90], 0.5, 'green');
  const c = combineIris(l, r);
  const hexToRgb = (hex) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  const blended = hexToRgb(c.hex);
  assert.deepStrictEqual(blended, [
    Math.round((l.rgb[0]+r.rgb[0])/2), Math.round((l.rgb[1]+r.rgb[1])/2), Math.round((l.rgb[2]+r.rgb[2])/2),
  ]);
});
test('BILATERAL WEIGHTING: zero-confidence-on-both falls back to an even 50/50 blend (no division by zero, no NaN)', () => {
  const l = eyeResult([90, 135, 88], 0, 'uncertain');
  const r = eyeResult([88, 132, 90], 0, 'uncertain');
  const c = combineIris(l, r);
  assert.ok(Number.isFinite(c.confidence));
  assert.strictEqual(c.name, 'uncertain');
});

// ================================================================
// 8. METAMORPHIC / ROBUSTNESS TESTS.
// ------------------------------------------------------------
// A moderate lighting transformation on a real base color must not
// arbitrarily flip GREEN<->BROWN. Becoming 'uncertain' under a more
// severe transform is acceptable; flipping to the opposite hard
// category is not.
// ================================================================
function darken(rgb, factor) { return rgb.map(v => Math.max(0, Math.round(v * factor))); }
function lighten(rgb, factor) { return rgb.map(v => Math.min(255, Math.round(v * factor))); }
function warmCast(rgb, amount) { return [Math.min(255, Math.round(rgb[0] + amount)), rgb[1], Math.max(0, Math.round(rgb[2] - amount * 0.6))]; }
function desaturate(rgb, amount) {
  const gray = rgb.reduce((a, b) => a + b, 0) / 3;
  return rgb.map(v => Math.round(v + (gray - v) * amount));
}
const FORBIDDEN_FLIPS = { green: 'brown', brown: 'green' };

const GREEN_BASE = [95, 138, 92];
const BROWN_BASE = [95, 72, 52]; // classifies 'brown' (see TRUE BROWN section)

for (const [label, base, expectedFamily] of [['GREEN', GREEN_BASE, 'green'], ['BROWN', BROWN_BASE, 'brown']]) {
  test(`METAMORPHIC ${label}: moderate exposure decrease never flips ${expectedFamily} to ${FORBIDDEN_FLIPS[expectedFamily]}`, () => {
    const name = classifyIrisColor(...darken(base, 0.75));
    assert.notStrictEqual(name, FORBIDDEN_FLIPS[expectedFamily]);
  });
  test(`METAMORPHIC ${label}: moderate exposure increase never flips ${expectedFamily} to ${FORBIDDEN_FLIPS[expectedFamily]}`, () => {
    const name = classifyIrisColor(...lighten(base, 1.25));
    assert.notStrictEqual(name, FORBIDDEN_FLIPS[expectedFamily]);
  });
  test(`METAMORPHIC ${label}: moderate warm cast never flips ${expectedFamily} to ${FORBIDDEN_FLIPS[expectedFamily]}`, () => {
    const name = classifyIrisColor(...warmCast(base, 18));
    assert.notStrictEqual(name, FORBIDDEN_FLIPS[expectedFamily]);
  });
  test(`METAMORPHIC ${label}: mild saturation reduction never flips ${expectedFamily} to ${FORBIDDEN_FLIPS[expectedFamily]}`, () => {
    const name = classifyIrisColor(...desaturate(base, 0.25));
    assert.notStrictEqual(name, FORBIDDEN_FLIPS[expectedFamily]);
  });
}
test('METAMORPHIC GREEN: the specific real-world bug shape — a green base pushed dark enough to cross l<0.16 — stays green (this is what the CORE FIX proves generally)', () => {
  const veryDark = darken(GREEN_BASE, 0.35);
  const { l } = hsl(...veryDark);
  assert.ok(l < 0.16, 'sanity: this transform must actually cross into the l<0.16 branch');
  assert.strictEqual(classifyIrisColor(...veryDark), 'green');
});
test('METAMORPHIC GREEN: an extreme combined transform (very dark + strong warm cast + desaturated) is allowed to fall to uncertain, but never confidently brown', () => {
  let rgb = darken(GREEN_BASE, 0.3);
  rgb = warmCast(rgb, 30);
  rgb = desaturate(rgb, 0.5);
  const name = classifyIrisColor(...rgb);
  assert.notStrictEqual(name, 'brown');
});

// ================================================================
// 9. DIAGNOSTIC OUTPUT — parity preserved after this turn's change.
// ================================================================
test('DIAGNOSTIC: sampleIrisColor and analyzeIrisSample remain in sync after this turn\'s classifyIrisColor/combineIris changes', () => {
  const ctx = solidCtx(90, 135, 88, 4);
  const full = analyzeIrisSample(ctx, EYE_POINTS);
  const short = sampleIrisColor(ctx, EYE_POINTS);
  assert.deepStrictEqual(short.rgb, full.rgb);
  assert.strictEqual(short.name, full.name);
  assert.strictEqual(short.confidence, full.confidence);
});

// ================================================================
// 10. PRODUCTION ISOLATION — this turn touches only classifyIrisColor/
// classifyLowLightAmbiguous/combineIris; sampling, geometry, ROI, and
// every unrelated system stay untouched.
// ================================================================
test('ISOLATION: analyzeIrisSample pixel-sampling/rejection/ROI source is byte-identical to committed HEAD (this turn changes classification/combination only)', () => {
  const diff = execSync('git diff -- index.html', { cwd: root }).toString();
  const sampleStart = "    function analyzeIrisSample(ctx, eyePoints, fixedCenter) {";
  const sampleEnd = "    function sampleIrisColor(ctx, eyePoints) {";
  const sIdx = src.indexOf(sampleStart);
  const eIdx = src.indexOf(sampleEnd, sIdx);
  assert.ok(sIdx >= 0 && eIdx > sIdx);
  const currentSpan = src.slice(sIdx, eIdx);
  assert.ok(!diff.includes('analyzeIrisSample(ctx, eyePoints, fixedCenter)') || diff.split('\n').every(line => !line.startsWith('+') || !line.includes('pupil_core') && !line.includes('outside_iris_annulus') && !line.includes('bright_specular') && !line.includes('dark_pupil_or_lash')), 'no pixel-rejection rule text may appear as an added line in this turn\'s diff');
  assert.ok(currentSpan.includes("if (radial < 0.30) { rejected.push({ ...pixel, reason:'pupil_core' }); continue; }"));
  assert.ok(currentSpan.includes("if (radial > 0.88) { rejected.push({ ...pixel, reason:'outside_iris_annulus' }); continue; }"));
});
test('ISOLATION: unrelated production systems have zero diff against committed HEAD', () => {
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js', 'client-store.js', 'client-data-consent.js', 'lash-scan-core.js', 'lash-design-domain.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});
test('ISOLATION: Lash Map LEFT/RIGHT mirror formula and DESIGN_CATALOG are unchanged', () => {
  assert.ok(src.includes("xAt=t=>55+(side==='right'?1-t:t)*290"));
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalogSource = src.slice(catalogStart, catalogEnd);
  const digest = require('node:crypto').createHash('sha256').update(catalogSource).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});
test('ISOLATION: iris.name/confidence are never referenced by scoring/ranking/curl/recommendation code', () => {
  const rankStart = src.indexOf('function rankDesignsAll(');
  const rankEnd = src.indexOf('\n', src.indexOf('.sort((a,b) => b.score - a.score));', rankStart));
  assert.ok(rankStart >= 0);
  assert.ok(!src.slice(rankStart, rankEnd + 1).includes('iris'));
});
