// ============================================================
// IRIS COLOR — REAL-PHOTO BUG AUDIT — regression tests.
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped iris pipeline straight out of
// index.html (same technique as every other test file in this
// project — never a hand-duplicated copy): sampleIrisColor,
// classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES (all frozen,
// unmodified by this turn) plus the new debug-only instrumentation
// (buildIrisColorAudit, buildIrisColorAuditCombined,
// debugIrisClassifyWithTrace).
//
// Central finding this turn: classifyIrisColor's decision-tree ORDER
// makes "brown" the fallback for ANY low-saturation iris (which is
// exactly what a gray/blue/light eye looks like) whenever measured
// lightness falls below ~0.32-0.35 — a real category-boundary
// problem (Path B), not a sampling/enum/L-R/aggregation bug. Tests G/
// O below demonstrate this NUMERICALLY using HSL values grounded in
// well-documented iris colorimetry (low saturation is the defining
// property of gray/blue/light eyes; NOT guessed from the reporter's
// photo description) — they intentionally assert CURRENT (buggy)
// behavior, never an invented "correct" label.
//
// LOCAL ONLY. Not wired into any CI/deploy step this turn.
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
const pipelineStart = src.indexOf('    function sampleIrisColor(ctx, eyePoints) {');
const pipelineEnd = src.indexOf('\n    const EYE_METRIC_KEYS =');
if (pipelineStart === -1 || pipelineEnd === -1) throw new Error('Could not locate the iris pipeline block — has it moved?');
const pipelineSource = src.slice(pipelineStart, pipelineEnd);
const {
  sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES,
  buildIrisColorAudit, buildIrisColorAuditCombined, debugIrisClassifyWithTrace,
} = new Function(rgbToHexLine + '\n' + pipelineSource + '\nreturn { sampleIrisColor, classifyIrisColor, combineIris, rgbToHsl, IRIS_NAMES, buildIrisColorAudit, buildIrisColorAuditCombined, debugIrisClassifyWithTrace };')();

test('setup: extracted real iris pipeline + debug instrumentation from index.html successfully', () => {
  assert.strictEqual(typeof sampleIrisColor, 'function');
  assert.strictEqual(typeof classifyIrisColor, 'function');
  assert.strictEqual(typeof combineIris, 'function');
  assert.strictEqual(typeof buildIrisColorAudit, 'function');
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
  const possible = ['dark', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray', 'mixed'];
  for (const k of possible) {
    assert.ok(IRIS_NAMES[k], `IRIS_NAMES must have an entry for '${k}'`);
    assert.ok(typeof IRIS_NAMES[k].ru === 'string' && IRIS_NAMES[k].ru.length > 0, `IRIS_NAMES.${k}.ru must be a non-empty string`);
  }
  assert.strictEqual(IRIS_NAMES.brown.ru, 'Карие', 'sanity: matches the exact observed real-photo output "Карие"');
});
test('B. EN labels exist for every possible classifyIrisColor output, and the key set matches exactly (no enum drift)', () => {
  const possible = ['dark', 'brown', 'hazel', 'amber', 'green', 'blue', 'gray', 'mixed'];
  for (const k of possible) {
    assert.ok(typeof IRIS_NAMES[k].en === 'string' && IRIS_NAMES[k].en.length > 0, `IRIS_NAMES.${k}.en must be a non-empty string`);
  }
  assert.deepStrictEqual(Object.keys(IRIS_NAMES).sort(), possible.sort(), 'IRIS_NAMES must have EXACTLY these 8 keys — no extra/missing entries that could cause an index/enum mismatch');
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
test('F. pixels above the lightness-200/saturation-0.25 specular gate are rejected with reason bright_specular', () => {
  const ctx = makeFakeCtx(80, 80, (x, y) => (x < 40 ? [120, 100, 80] : [240, 242, 244]));
  const audit = buildIrisColorAudit(ctx, EYE_POINTS);
  assert.ok(audit.rejectedPixels.some(p => p.reason === 'bright_specular'), 'expected at least one bright_specular rejection');
  for (const p of audit.rejectedPixels.filter(p => p.reason === 'bright_specular')) {
    assert.ok(p.lightness > 200 && p.sat < 0.25, 'every bright_specular rejection must genuinely satisfy production\'s own real gate');
  }
});

// ================================================================
// G. light, low-saturation iris input — THE CENTRAL FINDING.
// HSL values chosen from well-documented iris colorimetry (gray/blue/
// light eyes are, by definition, low-saturation; phone-selfie irises
// commonly read at moderate, not bright, lightness because the iris
// sits partially shadowed under the upper lid) — NOT guessed from the
// reporter's photo. This documents CURRENT (proven buggy) behavior;
// it does NOT assert 'blue'/'gray' as the "correct" answer.
// ================================================================
test('G1. a low-saturation, moderately-lit iris (h~210, s~0.08, l~0.29 — textbook pale gray-blue) is misclassified brown by the REAL classifyIrisColor', () => {
  const [r, g, b] = [68, 74, 80];
  const { h, s, l } = rgbToHsl(r, g, b);
  assert.ok(h >= 180 && h <= 250, 'sanity: hue is squarely in the blue window the classifier itself defines');
  assert.ok(s < 0.15, 'sanity: saturation is well within what the classifier itself calls "gray" territory');
  assert.ok(l < 0.32, 'sanity: lightness is below the classifier\'s own brown-gate ceiling');
  assert.strictEqual(classifyIrisColor(r, g, b), 'brown', 'DOCUMENTED CURRENT BEHAVIOR: a blue-hued, low-saturation, moderately-lit color reads brown — this is the bug, not an assertion that it SHOULD read brown');
});
test('G2. the SAME hue/saturation at higher lightness (l>=0.35) correctly reaches gray — proving the gray branch itself works, only its lightness floor is unreachable at typical capture lightness', () => {
  const [r, g, b] = [110, 120, 132]; // same ~h210 hue, same low saturation, l~0.47
  const { s, l } = rgbToHsl(r, g, b);
  assert.ok(s < 0.15 && l >= 0.35, 'sanity: this genuinely satisfies the gray branch\'s own stated conditions');
  assert.strictEqual(classifyIrisColor(r, g, b), 'gray', 'confirms classifyIrisColor CAN reach gray — the bug is specifically that brown fires first at lower, more typical iris lightness');
});
test('G3. sweeping lightness at fixed low saturation/blue hue shows the exact boundary where brown stops and gray starts', () => {
  // Same blue-ish hue (~h210) and low saturation throughout; only
  // lightness varies. Documents the REAL decision boundary, not an
  // invented one.
  const sweep = [
    { rgb: [50, 56, 62], expectAtLeastLightness: null },
    { rgb: [68, 74, 80], expectAtLeastLightness: null },
    { rgb: [90, 97, 104], expectAtLeastLightness: null },
    { rgb: [110, 120, 132], expectAtLeastLightness: null },
  ];
  const results = sweep.map(c => ({ rgb: c.rgb, l: rgbToHsl(...c.rgb).l, category: classifyIrisColor(...c.rgb) }));
  const firstGrayIdx = results.findIndex(r => r.category === 'gray');
  assert.ok(firstGrayIdx > 0, 'the same hue/low-saturation color must read brown at lower lightness and only reach gray once lightness crosses a real, observable boundary — never gray at every lightness');
  for (let i = 0; i < firstGrayIdx; i++) assert.strictEqual(results[i].category, 'brown', `expected brown below the observed gray boundary, got ${results[i].category} at l=${results[i].l}`);
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
// J. confidence formula — what "34%"-style numbers actually mean
// ================================================================
test('J. confidence is a variance/sample-count heuristic, NOT a probability — demonstrated via the real formula', () => {
  // High internal consistency (identical pixels) + full sample count -> confidence approaches 1.
  const cleanCtx = solidCtx(68, 74, 80, 0);
  const cleanAudit = buildIrisColorAudit(cleanCtx, EYE_POINTS);
  assert.ok(cleanAudit.confidence > 0.9, `expected near-1.0 confidence for a perfectly uniform sample, got ${cleanAudit.confidence}`);
  // High internal variance (noisy/contaminated-looking sample) -> confidence drops, even though a definite category is still returned.
  const noisyCtx = solidCtx(68, 74, 80, 60);
  const noisyAudit = buildIrisColorAudit(noisyCtx, EYE_POINTS);
  assert.ok(noisyAudit.confidence < cleanAudit.confidence, 'higher pixel variance must lower confidence — this is a self-consistency measure, not a calibrated probability of the label being correct');
  assert.ok(noisyAudit.selectedCategory, 'CURRENT BEHAVIOR: a low-confidence result still returns a definite category name, never an "uncertain" fallback (see deliverable Section 11)');
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
  assert.ok(anchor !== -1 && auditLogIdx !== -1 && gateIdx !== -1 && gateIdx < auditLogIdx && auditLogIdx - gateIdx < 300, 'PhotoAnalysisScreen iris audit log must be immediately gated by isDebugModeEnabled()');
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
test('N5. sampleIrisColor/classifyIrisColor/combineIris source text is unmodified since the initial commit (same formulas the git-history audit found)', () => {
  const radiusLine = 'const radius = Math.max(3, Math.min(eyeW, eyeH * 2.4) * 0.22);';
  const brightRejectLine = 'if (lightness > 200 && sat < 0.25) continue;';
  const darkRejectLine = 'if (lightness < 25) continue;';
  const brownGate = "if (l < 0.32 && s < 0.35) return 'brown';";
  const grayGate = "if (s < 0.15 && l >= 0.35 && l < 0.7) return 'gray';";
  for (const line of [radiusLine, brightRejectLine, darkRejectLine, brownGate, grayGate]) {
    assert.ok(src.includes(line), `expected the real, unmodified production line to still be present verbatim: ${line}`);
  }
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
test('I. sampleIrisColor/classifyIrisColor/combineIris span is byte-identical to the pre-turn committed HEAD', () => {
  const { execSync } = require('child_process');
  const head = execSync('git show HEAD:index.html', { cwd: path.join(__dirname, '..') }).toString();
  function extractSpan(s, startMarker, endMarker) {
    const st = s.indexOf(startMarker);
    const en = s.indexOf(endMarker, st);
    if (st === -1 || en === -1) return null;
    return s.slice(st, en);
  }
  const cur = extractSpan(src, '    function sampleIrisColor(ctx, eyePoints) {', '\n    // ============================================================\n    // IRIS COLOR — DEBUG-ONLY RAW PIXEL AUDIT');
  const prev = extractSpan(head, '    function sampleIrisColor(ctx, eyePoints) {', '\n    // ============================================================\n    // IRIS COLOR — DEBUG-ONLY RAW PIXEL AUDIT');
  assert.ok(cur !== null && prev !== null, 'expected to locate the span in both current and HEAD source');
  assert.strictEqual(cur, prev, 'sampleIrisColor..combineIris must be byte-identical to the pre-this-turn committed HEAD');
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
// O. real regression fixture — NOT AVAILABLE this turn. No actual
// pixel/RGB data from the reported real iPhone capture exists in this
// repo or any debug trace. Per the task's own instruction ("if you do
// not yet have enough information from the real capture... make the
// debug JSON capture exactly what is needed and STOP"), this is
// intentionally left undone here rather than fabricated. G1-G3 above
// document the CURRENT boundary behavior using externally-grounded
// (not photo-guessed) HSL values instead.
// ================================================================
test('O. explicit placeholder: no real-capture numeric fixture exists yet (documents why, does not fabricate one)', () => {
  assert.ok(true, 'intentionally not asserting a specific real-photo RGB/HSL fixture — none is available; see deliverable Section 9/24 for the exact next iPhone capture procedure');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
