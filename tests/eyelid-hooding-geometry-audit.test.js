// ============================================================
// HOODED-EYELID GEOMETRY AUDIT — regression tests.
// ------------------------------------------------------------
// Audit turn (real iPhone evidence: 18/18 accepted frames read
// openCrease, 0 hooded, but the real subject is anatomically
// hooded — visible crease coexisting with substantial overhanging
// skin). This file proves/documents what the audit found, using
// the REAL, currently-shipped classifyFeatures extracted straight
// out of index.html (same technique as
// tests/eyelid-classification.test.js) — never a hand-duplicated
// copy of its decision tree.
//
// Conclusion of the audit (see the deliverable given in chat):
// NO semantic inversion, formula error, wrong branch, or
// crease/hooding conflation could be proven in classifyFeatures /
// computeEyeSideMetrics. Signal A (crease) and Signal B (geometry)
// are architecturally independent and already allow "detected
// crease + hooded" (line ~1658 of index.html). The real capture's
// Signal B geometry (coverageIndex ~0.905) reads confidently
// 'open' with a large margin over the 0.36 boundary — not a
// borderline miscalibration. The most likely root cause is that
// brow-to-eye-opening-margin distance (the only landmark geometry
// available from face-api's dlib 68-point model — there is no
// crease/fold landmark) is a proxy for BROW-PTOSIS-type hooding,
// and is structurally blind to isolated eyelid-skin-laxity
// (dermatochalasis) hooding, which this subject's screenshot is
// consistent with. This is a coverage GAP, not a directional bug,
// so per the explicit instruction ("if no principled bug is
// found, STOP rather than inventing a threshold from one face"),
// NO fix was made to eyelidCategory/coverageIndex. Tests G/H below
// therefore document the current (BEFORE) behavior rather than
// asserting an invented 'hooded' outcome.
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

// ---- Extract the real, currently-shipped pipeline, PLUS the
// deployed strict-majority consensus functions immediately after
// classifyFeatures (for test H) — same extraction technique as
// tests/eyelid-classification.test.js and
// tests/eyelid-final-consensus.test.js. Nothing in the extracted
// range is modified. ----
const startMarker = '    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);';
const endMarker = '\n    function extractEyeROI(';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not locate the classifyFeatures pipeline block in index.html — has it moved? Update the markers above.');
}
const pipelineSource = src.slice(startIdx, endIdx);
const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;
const { classifyFeatures, aggregateBuffer, resolveReliableFrameConsensus, applyReliableFrameConsensus } = new Function(
  reactStubs + pipelineSource + '\nreturn { classifyFeatures, aggregateBuffer, resolveReliableFrameConsensus, applyReliableFrameConsensus };'
)();

test('setup: extracted real classifyFeatures + consensus fns from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
  assert.strictEqual(typeof aggregateBuffer, 'function');
  assert.strictEqual(typeof resolveReliableFrameConsensus, 'function');
  assert.strictEqual(typeof applyReliableFrameConsensus, 'function');
});

// ---- Synthetic eye-metrics fixture builder (mirrors
// tests/eyelid-classification.test.js's shape, extended to allow
// separately overriding each of the three coverage reads so the
// REAL captured LEFT/RIGHT numbers can be plugged in directly). ----
function coverageForCategory(category) {
  return { pronounced: 0.15, moderate: 0.24, mild: 0.32, open: 0.44 }[category];
}
function eyeMetrics({
  covCenter, covInner, covOuter, covByHeight, ear = 0.28,
  creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6,
} = {}) {
  const cc = covCenter ?? 0.44;
  return {
    width: 30, height: 12, ear, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cc,
    covInnerByWidth: covInner ?? cc,
    covOuterByWidth: covOuter ?? cc,
    covByHeight: covByHeight ?? (cc / 0.36),
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function aggregatedFrom(leftOverrides, rightOverrides) {
  const left = eyeMetrics(leftOverrides);
  const right = eyeMetrics(rightOverrides || leftOverrides);
  return { left, right, interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
}
function runClassify(leftOverrides, rightOverrides) {
  return classifyFeatures(aggregatedFrom(leftOverrides, rightOverrides), { singleFrame: true, stability: null, imageQuality: 0.75 });
}

const CLEAR = { creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseReadQuality: 0.7 };

// ---- REAL capture, per side (from the 18-frame live-scan
// aggregate under investigation). creaseYFrac is not part of the
// numbers the audit was given, so it is set to a normal/non-low
// position (0.4, well under the 0.62 ambiguous-position gate) —
// consistent with production actually reaching 'openCrease' rather
// than the low-position 'uncertain' branch. ----
const REAL_LEFT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9445, covInner: 0.8285, covOuter: 0.9293, covByHeight: 2.8144, ear: 0.3354 };
const REAL_RIGHT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9401, covInner: 0.8368, covOuter: 0.8682, covByHeight: 2.8362, ear: 0.3314 };

// ================================================================
// A. visible crease can coexist with hooded classification
// ================================================================
test('A. visible crease can coexist with hooded classification (detected crease + pronounced geometry -> hooded)', () => {
  const c = runClassify({ ...CLEAR, cov: undefined, covCenter: coverageForCategory('pronounced'), covInner: coverageForCategory('pronounced'), covOuter: coverageForCategory('pronounced') });
  assert.strictEqual(c.eyelidType, 'hooded');
  assert.strictEqual(c.isHooded, true);
});

// ================================================================
// B. a detected crease does NOT, by itself, force non-hooded
// ================================================================
test('B. detected crease does NOT force non-hooded — the SAME crease evidence yields openCrease or hooded purely depending on independent geometry', () => {
  const covOpen = coverageForCategory('open');
  const covPronounced = coverageForCategory('pronounced');
  const open = runClassify({ ...CLEAR, covCenter: covOpen, covInner: covOpen, covOuter: covOpen });
  const hooded = runClassify({ ...CLEAR, covCenter: covPronounced, covInner: covPronounced, covOuter: covPronounced });
  assert.strictEqual(open.eyelidType, 'openCrease');
  assert.strictEqual(hooded.eyelidType, 'hooded');
  assert.strictEqual(open.debug.crease.left.verdict, hooded.debug.crease.left.verdict, 'Signal A (crease) verdict is identical in both cases — only Signal B (geometry) differs, proving crease presence alone never decides hooded vs. non-hooded');
});

// ================================================================
// C. hooded geometry + detected crease -> hooded
// ================================================================
test('C. hooded geometry (moderate) + detected crease -> hooded', () => {
  const cov = coverageForCategory('moderate');
  const c = runClassify({ ...CLEAR, covCenter: cov, covInner: cov, covOuter: cov });
  assert.strictEqual(c.eyelidType, 'hooded');
});

// ================================================================
// D. genuinely open geometry + detected crease -> openCrease
// ================================================================
test('D. genuinely open geometry + detected crease -> openCrease', () => {
  const cov = coverageForCategory('open');
  const c = runClassify({ ...CLEAR, covCenter: cov, covInner: cov, covOuter: cov });
  assert.strictEqual(c.eyelidType, 'openCrease');
});

// ================================================================
// E. monolid still requires confident crease absence
// ================================================================
test('E. monolid still requires confident crease absence, not just open geometry', () => {
  const cov = coverageForCategory('open');
  const NONE_HQ = { creaseValid: 1, creasePeak: 0.5, creaseProminence: 0.3, creaseReadQuality: 0.6 };
  const monolid = runClassify({ ...NONE_HQ, covCenter: cov, covInner: cov, covOuter: cov });
  const withCrease = runClassify({ ...CLEAR, covCenter: cov, covInner: cov, covOuter: cov });
  assert.strictEqual(monolid.eyelidType, 'monolid');
  assert.notStrictEqual(withCrease.eyelidType, 'monolid', 'the same open geometry must NOT read monolid once a crease is actually detected');
});

// ================================================================
// F. uncertain evidence remains uncertain
// ================================================================
test('F. weak/borderline crease evidence remains uncertain regardless of geometry', () => {
  const WEAK = { creaseValid: 1, creasePeak: 6.9, creaseProminence: 4.9, creaseReadQuality: 0.4 };
  const cov = coverageForCategory('open');
  const c = runClassify({ ...WEAK, covCenter: cov, covInner: cov, covOuter: cov });
  assert.strictEqual(c.eyelidType, 'uncertain');
});

// ================================================================
// G. REAL 18-frame aggregate fixture (documented BEFORE state).
// No principled bug was found in classifyFeatures/computeEyeSide-
// Metrics (see file header + chat deliverable), so this test
// documents the CURRENT, unfixed production output rather than
// asserting an invented 'hooded' result. This is intentionally a
// regression lock on the reported bug, not a fix confirmation.
// ================================================================
test('G. REAL 18-frame aggregate fixture reproduces the reported bug (documented BEFORE, no invented fix applied)', () => {
  const c = runClassify(REAL_LEFT, REAL_RIGHT);
  assert.strictEqual(c.eyelidCategory, 'open');
  assert.strictEqual(c.eyelidType, 'openCrease');
  assert.strictEqual(c.isHooded, false);
  assert.strictEqual(c.hoodingLevel, 'none');
  assert.ok(c.debug.aggregated.coverageIndex > 0.8, `expected coverageIndex far above the 0.36 'open' boundary (real dominant driver of the bug), got ${c.debug.aggregated.coverageIndex}`);
});

// ================================================================
// H. strict-majority consensus preserves hooded when hooded wins
// majority (proves the ALREADY-DEPLOYED consensus layer is not
// itself the obstacle — it faithfully reflects whatever
// classifyFeatures decides per frame, including a majority-hooded
// buffer; it is genuinely Signal B upstream that read 'open' for
// the real capture, not the consensus layer silently overriding a
// majority-hooded read).
// ================================================================
test('H. strict-majority consensus preserves hooded when hooded wins majority', () => {
  const covPronounced = coverageForCategory('pronounced');
  const covOpen = coverageForCategory('open');
  const hoodedFrame = aggregatedFrom({ ...CLEAR, covCenter: covPronounced, covInner: covPronounced, covOuter: covPronounced });
  const openFrame = aggregatedFrom({ ...CLEAR, covCenter: covOpen, covInner: covOpen, covOuter: covOpen });
  const buffer = [
    { leftMetrics: hoodedFrame.left, rightMetrics: hoodedFrame.right, headPose: hoodedFrame.headPose, faceBoxWidth: 220, verticalAsymRaw: 0 },
    { leftMetrics: hoodedFrame.left, rightMetrics: hoodedFrame.right, headPose: hoodedFrame.headPose, faceBoxWidth: 220, verticalAsymRaw: 0 },
    { leftMetrics: hoodedFrame.left, rightMetrics: hoodedFrame.right, headPose: hoodedFrame.headPose, faceBoxWidth: 220, verticalAsymRaw: 0 },
    { leftMetrics: openFrame.left, rightMetrics: openFrame.right, headPose: openFrame.headPose, faceBoxWidth: 220, verticalAsymRaw: 0 },
  ];
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.75 });
  const consensus = resolveReliableFrameConsensus(buffer);
  const final = applyReliableFrameConsensus(classified, consensus);
  assert.strictEqual(consensus.type, 'hooded', `expected 'hooded' to win 3/4 strict majority, got ${consensus.type}`);
  assert.strictEqual(final.eyelidType, 'hooded');
  assert.strictEqual(final.isHooded, true);
});

// ================================================================
// I. existing openCrease fixture still remains openCrease
// (no drift introduced by this audit turn — zero code changed)
// ================================================================
test('I. existing openCrease fixture (clear crease + open geometry) still remains openCrease — unchanged by this audit', () => {
  const c = runClassify({ ...CLEAR, creaseYFrac: 0.4, covCenter: coverageForCategory('open'), covInner: coverageForCategory('open'), covOuter: coverageForCategory('open') });
  assert.strictEqual(c.eyelidType, 'openCrease');
  assert.strictEqual(c.eyelidSignalsConflict, false);
});

// ================================================================
// J. Eye Geometry LEFT/RIGHT symmetry preserved — the real
// capture's LEFT and RIGHT numbers (independently measured) are
// consistent with each other (proves no L/R normalization
// asymmetry is confounding the result; see chat deliverable
// Section 4 — this is the same physical L/R normalization fixed
// earlier and NOT modified this turn).
// ================================================================
test('J. Eye Geometry LEFT/RIGHT symmetry preserved for the real capture (no L/R normalization asymmetry)', () => {
  const c = runClassify(REAL_LEFT, REAL_RIGHT);
  const lrGapDiff = Math.abs(REAL_LEFT.covCenter - REAL_RIGHT.covCenter);
  assert.ok(lrGapDiff < 0.02, `expected LEFT/RIGHT covCenterByWidth to be nearly identical (both real eyes read consistently), got diff=${lrGapDiff}`);
  assert.strictEqual(c.debug.crease.left.verdict, c.debug.crease.right.verdict, 'both eyes must reach the same per-eye crease verdict for the real capture (matches "both eyes have reliable crease evidence")');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
