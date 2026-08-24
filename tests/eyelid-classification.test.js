// ============================================================
// CONSERVATIVE EYELID CLASSIFICATION V1 — regression tests.
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped classifyFeatures (and its
// same-section dependencies: computeConfidence, computeEyeSideMetrics,
// computeHeadPose, getPhysicalEyeLandmarks, dist/angle/clamp01/
// gaussianBump, etc.) straight out of index.html and evaluates it —
// same technique as tests/physical-eye-integration.test.js — so these
// tests exercise the actual production decision tree, not a
// hand-maintained duplicate.
//
// detectEyelidCrease itself is NOT exercised here (and is not in the
// extracted range) — these tests operate at the classifyFeatures
// level, feeding synthetic left/right eye-metrics objects with
// crease/geometry fields set directly, exactly like the real
// per-frame pipeline would after detectEyelidCrease has already run.
// This matches the task: detectEyelidCrease, its thresholds, and
// computeEyeSideMetrics's formulas are frozen and must not be
// exercised/changed by this test file either.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

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

// ---- Extract the real, currently-shipped pipeline (dist/angle/
// clamp01/gaussianBump through the end of classifyFeatures) ----
const startMarker = '    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);';
const endMarker = '\n    function extractEyeROI(';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not locate the classifyFeatures pipeline block in index.html — has it moved? Update the markers above.');
}
const pipelineSource = src.slice(startIdx, endIdx);
// The extracted range is interleaved with a couple of top-level React
// setup statements (e.g. `const LangContext = createContext('ru')`)
// that execute unconditionally at definition time even though
// classifyFeatures itself never touches React. Stubbed here purely so
// the extraction evaluates outside a browser — none of these stubs
// are exercised by anything this test file actually calls.
const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;
const { classifyFeatures, computeConfidence } = new Function(
  reactStubs + pipelineSource + '\nreturn { classifyFeatures, computeConfidence };'
)();

test('setup: extracted real classifyFeatures from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
  assert.strictEqual(typeof computeConfidence, 'function');
});

// ---- Synthetic eye-metrics fixture builder ----
// Baseline plausible almond-eye numbers; only crease + coverage fields
// are varied per scenario. covByHeight is set so heightCrossCheck
// exactly matches the intended coverageIndex (perfect signal
// agreement) so eyelidCategory itself reads cleanly/confidently in
// every scenario, isolating the thing under test (the crease-aware
// eyelidType decision) from unrelated geometry-confidence noise.
function coverageForCategory(category) {
  // midpoints of each coverageIndex bucket (thresholds: <0.20 pronounced, <0.28 moderate, <0.36 mild, else open)
  return { pronounced: 0.15, moderate: 0.24, mild: 0.32, open: 0.44 }[category];
}
function eyeMetrics({ cov = 0.44, creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6 } = {}) {
  return {
    width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cov, covInnerByWidth: cov, covOuterByWidth: cov, covByHeight: cov / 0.36,
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function runClassify(leftOverrides, rightOverrides) {
  const left = eyeMetrics(leftOverrides);
  const right = eyeMetrics(rightOverrides || leftOverrides);
  const aggregated = {
    left, right, interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0,
    headPose: { roll: 0 },
  };
  return classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
}

// Shorthand crease presets.
const CLEAR = { creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseReadQuality: 0.7 };
const NONE_HQ = { creaseValid: 1, creasePeak: 0.5, creaseProminence: 0.3, creaseReadQuality: 0.6 }; // clearly no fold, well-read
const NONE_LQ = { creaseValid: 1, creasePeak: 0.5, creaseProminence: 0.3, creaseReadQuality: 0.15 }; // unreadable band
const WEAK = { creaseValid: 1, creasePeak: 6.9, creaseProminence: 4.9, creaseReadQuality: 0.4 }; // narrow miss of the floor

// ================================================================
// 1. clear crease + open geometry -> openCrease
// ================================================================
test('1. clear crease + open geometry -> openCrease', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.4, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'openCrease');
  assert.strictEqual(c.eyelidSignalsConflict, false);
});

// ================================================================
// 2. clear crease + pronounced coverage -> hooded
// ================================================================
test('2. clear crease + pronounced coverage -> hooded', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.4, cov: coverageForCategory('pronounced') });
  assert.strictEqual(c.eyelidType, 'hooded');
  assert.strictEqual(c.isHooded, true);
});

// ================================================================
// 3. weak/borderline crease + open geometry -> uncertain
// ================================================================
test('3. weak/borderline crease (narrow miss) + open geometry -> uncertain', () => {
  const c = runClassify({ ...WEAK, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'uncertain');
});

// ================================================================
// 4. no reliable crease + low readQuality -> uncertain
// ================================================================
test('4. no reliable crease + low readQuality -> uncertain', () => {
  const c = runClassify({ ...NONE_LQ, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'uncertain');
});

// ================================================================
// 5. low crease position + open geometry -> uncertain, NOT hooded
// (the core bug fix — this used to be 'hooded' via the OR condition)
// ================================================================
test('5. low crease position + open geometry -> uncertain, NOT hooded', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.8, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'uncertain');
  assert.notStrictEqual(c.eyelidType, 'hooded');
  assert.strictEqual(c.eyelidSignalsConflict, true);
});

// ================================================================
// 6. low crease position + pronounced geometry -> hooded allowed
// ================================================================
test('6. low crease position + pronounced geometry -> hooded allowed', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.8, cov: coverageForCategory('pronounced') });
  assert.strictEqual(c.eyelidType, 'hooded');
});

// ================================================================
// 7/8. left clear + right weak (either order) -> combined uncertain, NOT monolid
// ================================================================
test('7. left clear + right weak -> combined uncertain, NOT monolid', () => {
  const c = runClassify({ ...CLEAR, cov: coverageForCategory('open') }, { ...NONE_HQ, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'uncertain');
  assert.notStrictEqual(c.eyelidType, 'monolid');
  assert.strictEqual(c.eyelidSignalsConflict, true);
  assert.strictEqual(c.debug.crease.left.verdict, 'detected');
  assert.strictEqual(c.debug.crease.right.verdict, 'confidentlyAbsent');
});
test('8. left weak + right clear -> combined uncertain', () => {
  const c = runClassify({ ...NONE_HQ, cov: coverageForCategory('open') }, { ...CLEAR, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'uncertain');
  assert.strictEqual(c.eyelidSignalsConflict, true);
});

// ================================================================
// 9. geometry/pixel conflict (no reliable crease + non-open geometry) -> uncertain
// ================================================================
test('9. no reliable crease + moderate geometry (conflict) -> uncertain', () => {
  const c = runClassify({ ...NONE_HQ, cov: coverageForCategory('moderate') });
  assert.strictEqual(c.eyelidType, 'uncertain');
  assert.strictEqual(c.eyelidSignalsConflict, true);
});
test('9b. no reliable crease + open geometry -> monolid (genuinely compatible, still allowed)', () => {
  const c = runClassify({ ...NONE_HQ, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'monolid');
  assert.strictEqual(c.eyelidSignalsConflict, false);
});

// ================================================================
// 10. conflict must NOT mutate raw geometric category
// ================================================================
test('10a. hooded-vs-open conflict path does not mutate eyelidCategory (low position + open geometry)', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.8, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidCategory, 'open', 'eyelidCategory must remain the raw geometric read, not be force-overwritten');
});
test('10b. monolid-vs-conflict path does not mutate eyelidCategory (no crease + moderate geometry)', () => {
  const c = runClassify({ ...NONE_HQ, cov: coverageForCategory('moderate') });
  assert.strictEqual(c.eyelidCategory, 'moderate', 'eyelidCategory must remain the raw geometric read, not be force-overwritten to uncertain');
});

// ================================================================
// 11. semantic uncertain must remain uncertain even if global
// computeConfidence is numerically high (proves the dead-gate removal
// is safe — confidence can no longer rescue OR override the decision)
// ================================================================
test('11. eyelidTypeConfidence can be high while eyelidType is still uncertain (confidence never overrides the decision tree)', () => {
  // Same scenario proven in the audit to yield ~0.75 (high-bucket)
  // confidence purely from strong-but-crease-irrelevant factors, with
  // an essentially-zero crease signal.
  const c = runClassify({ creaseValid: 1, creasePeak: 0.1, creaseProminence: 0.1, creaseReadQuality: 0.35, creaseYFrac: 0.4, cov: coverageForCategory('moderate') });
  assert.strictEqual(c.eyelidType, 'uncertain');
  assert.ok(c.eyelidTypeConfidence > 0.6, `expected the underlying confidence to still be numerically high (proving it is not what decided the outcome), got ${c.eyelidTypeConfidence}`);
  // And the master-facing hoodedConfidence must be capped low despite that.
  assert.ok(c.hoodedConfidence <= 0.25, `hoodedConfidence should be capped for an uncertain eyelidType, got ${c.hoodedConfidence}`);
});
test('11b. the old dead <0.32 gate is gone: no code path can flip a decision-tree verdict back and forth based on confidence alone', () => {
  // Directly re-confirms the mathematical floor proven in the audit,
  // independent of classifyFeatures, since the removed gate relied on it.
  const floor = computeConfidence({ measurementAgreement: 0, landmarkStability: 0, imageQuality: 0, lrAgreement: 0, poseQuality: 0 }).score;
  assert.ok(floor > 0.32, `computeConfidence's floor (${floor}) is still above 0.32 — confirms a <0.32 gate would still be dead code, which is why classification safety must not depend on it`);
});

// ================================================================
// 12. existing clearly-valid cases remain unchanged
// ================================================================
test('12a. clear crease, normal position, open geometry -> openCrease (unchanged from before)', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.3, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'openCrease');
});
test('12b. clear crease, pronounced geometry, normal position -> hooded (unchanged from before)', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.3, cov: coverageForCategory('pronounced') });
  assert.strictEqual(c.eyelidType, 'hooded');
  assert.strictEqual(c.hoodingLevel, 'full');
});
test('12c. no crease + open geometry on both eyes (clean, well-read) -> monolid (unchanged from before)', () => {
  const c = runClassify({ ...NONE_HQ, cov: coverageForCategory('open') }, { ...NONE_HQ, cov: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'monolid');
  assert.strictEqual(c.isHooded, false);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
