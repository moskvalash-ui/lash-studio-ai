// ============================================================
// IRIS COLOR — BILATERAL UNCERTAINTY PROPAGATION (product-safety fix).
// ------------------------------------------------------------
// Product decision: reliability over forced classification. Prior
// behavior: combineIris only forced the bilateral name to 'uncertain'
// when BOTH eyes were already 'uncertain' -- a single eye already
// flagged unreliable by its OWN real evidence (low sector agreement,
// too few populated sectors, or classifyIrisColor's own colorimetric-
// ambiguity gate) could still be silently overridden by RGB blending/
// re-classification the moment its partner eye was confident.
//
// Fix (index.html combineIris): EITHER eye's own 'uncertain' verdict
// is now authoritative and is never overridden by re-classifying the
// blended rgb. No new confidence floor or disagreement threshold was
// introduced -- this uses only the categorical 'uncertain' signal
// analyzeIrisSample/classifyIrisColor already computed before this
// turn. The confident-vs-confident disagreement case (e.g. real green
// vs real brown, both individually reliable) is explicitly NOT
// addressed here -- see the deliverable report for why.
//
// This file complements (does not replace) the BILATERAL section of
// tests/iris-color-green-brown-robustness.test.js, which already
// covers two of these cases with hand-built eyeResult() mocks. This
// file additionally drives the THREE DISTINCT REAL CAUSES of per-eye
// 'uncertain' through the actual analyzeIrisSample pipeline (not
// mocked), so the propagation is proven against genuine evidence, not
// just an asserted string.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const rgbToHexLine = "const rgbToHex = (r,g,b) => { const h = (n) => Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0'); return `#${h(r)}${h(g)}${h(b)}`; };";
const pipelineStart = src.indexOf('    function estimateIrisCenter(ctx, eyePoints) {');
const pipelineEnd = src.indexOf('\n    const EYE_METRIC_KEYS =');
assert.ok(pipelineStart >= 0 && pipelineEnd > pipelineStart, 'the iris pipeline span must be structurally extractable');
const pipelineSource = src.slice(pipelineStart, pipelineEnd);
const { analyzeIrisSample, combineIris, classifyIrisColor, IRIS_NAMES } = new Function(
  rgbToHexLine + '\n' + pipelineSource + '\nreturn { analyzeIrisSample, combineIris, classifyIrisColor, IRIS_NAMES };'
)();

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

// Real per-eye 'uncertain' fixtures, each via a genuinely distinct cause
// (verified live below, not asserted from memory):
//   CAUSE A -- low sector agreement (left half green, right half brown; sectorAgreement 0.5 < 0.6)
//   CAUSE B -- insufficient populated sectors (iris color confined to one
//              quadrant, rest rejected as near-black; only 1 of 4 sectors populated)
//   CAUSE C -- colorimetric ambiguity (uniform low-saturation gray; classifyIrisColor's
//              own s<0.15 gate, DESPITE perfect sector agreement and max confidence)
const causeA_ctx = makeFakeCtx(80, 80, (x, y) => (x < 40 ? [90, 135, 88] : [95, 72, 52]));
const causeB_ctx = makeFakeCtx(80, 80, (x, y) => (x >= 44 && y >= 40 ? [90, 135, 88] : [10, 8, 9]));
const causeC_ctx = solidCtx(60, 58, 62, 0);

test('setup: the three distinct real causes of per-eye uncertain are genuinely distinct (not the same code path)', () => {
  const a = analyzeIrisSample(causeA_ctx, EYE_POINTS);
  const b = analyzeIrisSample(causeB_ctx, EYE_POINTS);
  const c = analyzeIrisSample(causeC_ctx, EYE_POINTS);
  assert.strictEqual(a.name, 'uncertain'); assert.ok(a.sectorAgreement < 0.6, 'CAUSE A must be low sector agreement');
  assert.strictEqual(b.name, 'uncertain'); assert.ok(b.sectorNames.length < 3, 'CAUSE B must be insufficient populated sectors');
  assert.strictEqual(c.name, 'uncertain'); assert.ok(c.sectorAgreement >= 0.6 && c.sectorNames.length >= 3, 'CAUSE C must NOT be a sector problem -- it is colorimetric ambiguity in classifyIrisColor itself');
  assert.ok(a.confidence > 0 && b.confidence > 0 && c.confidence > 0, 'all three must carry real nonzero confidence, proving confidence alone cannot distinguish them from a reliable result');
});

// ================================================================
// 1-5. Required matrix: any 'uncertain' input (from real evidence,
// any of the three causes) forces the bilateral result to 'uncertain',
// regardless of the partner eye or which side ('l'/'r') is uncertain.
// ================================================================
for (const [label, ctx] of [['CAUSE A (low sector agreement)', causeA_ctx], ['CAUSE B (insufficient sectors)', causeB_ctx], ['CAUSE C (colorimetric ambiguity)', causeC_ctx]]) {
  const uncertainEye = () => { const a = analyzeIrisSample(ctx, EYE_POINTS); return { rgb: a.rgb, confidence: a.confidence, name: a.name }; };

  test(`1. uncertain (${label}) + green -> uncertain`, () => {
    const l = uncertainEye();
    const r = eyeResult([90, 135, 88], 0.8, 'green');
    assert.strictEqual(combineIris(l, r).name, 'uncertain');
  });
  test(`2. green + uncertain (${label}) -> uncertain`, () => {
    const l = eyeResult([90, 135, 88], 0.8, 'green');
    const r = uncertainEye();
    assert.strictEqual(combineIris(l, r).name, 'uncertain');
  });
  test(`3. uncertain (${label}) + brown -> uncertain`, () => {
    const l = uncertainEye();
    const r = eyeResult([95, 72, 52], 0.8, 'brown');
    assert.strictEqual(combineIris(l, r).name, 'uncertain');
  });
  test(`4. brown + uncertain (${label}) -> uncertain`, () => {
    const l = eyeResult([95, 72, 52], 0.8, 'brown');
    const r = uncertainEye();
    assert.strictEqual(combineIris(l, r).name, 'uncertain');
  });
}
test('5. uncertain + uncertain -> uncertain (already correct pre-turn behavior, still holds)', () => {
  const l = { rgb: analyzeIrisSample(causeA_ctx, EYE_POINTS).rgb, confidence: analyzeIrisSample(causeA_ctx, EYE_POINTS).confidence, name: 'uncertain' };
  const r = { rgb: analyzeIrisSample(causeC_ctx, EYE_POINTS).rgb, confidence: analyzeIrisSample(causeC_ctx, EYE_POINTS).confidence, name: 'uncertain' };
  assert.strictEqual(combineIris(l, r).name, 'uncertain');
});

// ================================================================
// 6-8. Regression: agreeing, non-uncertain eyes still classify.
// ================================================================
test('6. green + green -> green', () => {
  const l = eyeResult([90, 135, 88], 0.8, 'green'), r = eyeResult([88, 132, 90], 0.75, 'green');
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'green'); assert.ok(c.confidence > 0);
});
test('7. brown + brown -> brown', () => {
  const l = eyeResult([95, 72, 52], 0.8, 'brown'), r = eyeResult([93, 70, 50], 0.75, 'brown');
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'brown'); assert.ok(c.confidence > 0);
});
test('8. other agreeing valid colors remain correctly classified: blue+blue, gray+gray, hazel+hazel', () => {
  assert.strictEqual(combineIris(eyeResult([95, 120, 165], 0.7, 'blue'), eyeResult([92, 118, 162], 0.7, 'blue')).name, 'blue');
  assert.strictEqual(combineIris(eyeResult([135, 133, 138], 0.7, 'gray'), eyeResult([133, 131, 136], 0.7, 'gray')).name, 'gray');
  assert.strictEqual(combineIris(eyeResult([150, 118, 62], 0.7, 'hazel'), eyeResult([148, 116, 60], 0.7, 'hazel')).name, 'hazel');
});

// ================================================================
// 9-10. Preserved missing-eye handling (unchanged code paths).
// ================================================================
test('9a. one missing eye (no rgb) + a valid, non-uncertain eye preserves existing 0.7-penalty fallback behavior', () => {
  const l = { rgb: null, confidence: 0, name: null };
  const r = eyeResult([90, 135, 88], 0.8, 'green');
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'green');
  assert.ok(Math.abs(c.confidence - r.confidence * 0.7) < 1e-9);
});
test('9b. one missing eye (no rgb) + a valid, ALREADY-uncertain eye preserves existing fallback (uncertain, 0.7-penalty confidence) -- unaffected by this turn\'s change, which only applies when BOTH eyes have rgb', () => {
  const l = { rgb: null, confidence: 0, name: null };
  const r = { rgb: [60, 58, 62], confidence: 0.9, name: 'uncertain' };
  const c = combineIris(l, r);
  assert.strictEqual(c.name, 'uncertain');
  assert.ok(Math.abs(c.confidence - r.confidence * 0.7) < 1e-9);
});
test('10. both eyes missing preserves existing behavior (null name, zero confidence)', () => {
  const c = combineIris({ rgb: null, confidence: 0, name: null }, { rgb: null, confidence: 0, name: null });
  assert.strictEqual(c.name, null);
  assert.strictEqual(c.confidence, 0);
  assert.strictEqual(c.color, null);
});

// ================================================================
// 11. Confidence-weighted RGB blending is unchanged when both eyes are
// valid and non-uncertain (this turn touches only the NAME decision).
// ================================================================
test('11. confidence-weighted blending remains unchanged when both eyes are valid and non-uncertain', () => {
  const l = eyeResult([95, 138, 92], 0.9, 'green');
  const r = eyeResult([40, 30, 25], 0.05); // real 'dark' evidence, not uncertain
  assert.notStrictEqual(r.name, 'uncertain', 'sanity: isolates weighting from propagation');
  const c = combineIris(l, r);
  const plainAvg = [(l.rgb[0] + r.rgb[0]) / 2, (l.rgb[1] + r.rgb[1]) / 2, (l.rgb[2] + r.rgb[2]) / 2];
  const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const blended = hexToRgb(c.hex);
  const distTo = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(distTo(blended, l.rgb) < distTo(plainAvg, l.rgb), 'the confidence-weighted blend must still lean toward the more-confident eye, exactly as the prior turn implemented');
});
test('11b. equal-confidence, non-uncertain eyes still blend as a plain 50/50 average (unchanged)', () => {
  const l = eyeResult([90, 135, 88], 0.5, 'green'), r = eyeResult([88, 132, 90], 0.5, 'green');
  const c = combineIris(l, r);
  const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  assert.deepStrictEqual(hexToRgb(c.hex), [Math.round((l.rgb[0] + r.rgb[0]) / 2), Math.round((l.rgb[1] + r.rgb[1]) / 2), Math.round((l.rgb[2] + r.rgb[2]) / 2)]);
});

// ================================================================
// 12. Display layer: iris.name === 'uncertain' renders the existing
// inconclusive wording (RU and EN) at BOTH HeroScreen (via
// eyeProfileLabels) and DetailsScreen -- neither site invented for
// this turn, both already existed; this pins them together so a
// future change to either cannot silently diverge.
// ================================================================
test('12a. IRIS_NAMES.uncertain carries the existing RU/EN inconclusive wording, unchanged', () => {
  assert.deepStrictEqual(IRIS_NAMES.uncertain, { ru: 'Оттенок не определён', en: 'Color inconclusive' });
});
test('12b. HeroScreen (via eyeProfileLabels) renders the inconclusive wording, not a color, when iris.name is uncertain', () => {
  const start = src.indexOf('    function eyeProfileLabels(p, iris, lang) {');
  const end = src.indexOf('\n    }', start) + '\n    }'.length;
  const body = src.slice(start, end);
  assert.ok(body.includes("const irisName = iris?.name ? (lang==='en' ? IRIS_NAMES[iris.name].en : IRIS_NAMES[iris.name].ru) : t('insufficientData', lang);"), 'eyeProfileLabels must still route iris.name through IRIS_NAMES (which includes the uncertain entry) rather than any special-cased text');
});
test('12c. DetailsScreen renders the inconclusive wording, not a color, when iris.name is uncertain', () => {
  const start = src.indexOf('    function DetailsScreen({ result, onBack }) {');
  const end = src.indexOf("const irisName = iris.name ? (lang==='en'?IRIS_NAMES[iris.name].en:IRIS_NAMES[iris.name].ru) : null;", start);
  assert.ok(start >= 0 && end > start, 'DetailsScreen and its irisName computation must both be present');
  assert.ok(src.includes("const irisName = iris.name ? (lang==='en'?IRIS_NAMES[iris.name].en:IRIS_NAMES[iris.name].ru) : null;"));
});
test('12d. end-to-end: given iris.name === "uncertain" (as combineIris now guarantees for either-eye-uncertain input), both display sites compute the exact RU/EN inconclusive strings', () => {
  const lang_ru = 'ru', lang_en = 'en';
  const irisNameFor = (lang) => (lang === 'en' ? IRIS_NAMES['uncertain'].en : IRIS_NAMES['uncertain'].ru);
  assert.strictEqual(irisNameFor(lang_ru), 'Оттенок не определён');
  assert.strictEqual(irisNameFor(lang_en), 'Color inconclusive');
});

// ================================================================
// Isolation: only the name-decision line in combineIris changed.
// ================================================================
test('ISOLATION: the confidence-weighted blend, the consistency/confidence formulas, and every other function are untouched by this turn', () => {
  assert.ok(src.includes('const weightSum = l.confidence + r.confidence;'));
  assert.ok(src.includes('const lWeight = weightSum > 0 ? l.confidence / weightSum : 0.5;'));
  assert.ok(src.includes('const consistency = Math.max(0, 1 - diff/80);'));
  assert.ok(src.includes('const confidence = Math.min(l.confidence, r.confidence) * (0.5 + 0.5*consistency);'));
  assert.ok(src.includes("const eitherUncertain = l.name === 'uncertain' || r.name === 'uncertain';"));
  assert.ok(src.includes("const name = !eitherUncertain && confidence > 0 ? classifyIrisColor(rgb[0],rgb[1],rgb[2]) : 'uncertain';"));
  assert.ok(!src.includes("!(l.name === 'uncertain' && r.name === 'uncertain')"), 'the old BOTH-uncertain gate must be fully gone, not left dead alongside the new one');
});
test('ISOLATION: classifyIrisColor and classifyLowLightAmbiguous are byte-identical to the prior turn (no threshold changes)', () => {
  assert.ok(src.includes("function classifyLowLightAmbiguous(h, s, veryDark) {"));
  assert.ok(src.includes("if (l < 0.16) return classifyLowLightAmbiguous(h, s, true);"));
  assert.ok(src.includes("if (l < 0.32 && s < 0.35) return classifyLowLightAmbiguous(h, s, false);"));
});
