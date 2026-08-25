// ============================================================
// FINAL EYELID BUG FIX — regression tests.
// ------------------------------------------------------------
// PART A: the Copy button's payload must never show stale
// (pre-finalization) null aggregate/finalClassified/finalRecType,
// regardless of React render/commit timing — fixed by reading a ref
// (updated synchronously at the exact point production computes these
// values) instead of a React state prop at click time.
//
// PART B: RELIABLE-FRAME EYELID-TYPE CONSENSUS — a new, PRODUCTION
// (not debug-gated) integration layer. Real-iPhone frame-trace
// evidence proved detectEyelidCrease V1 sometimes locks onto its own
// search-band boundary on a SUBSET of accepted frames within one
// scan; those frames already correctly read eyelidType='uncertain'
// when classified individually (existing, unmodified classifyFeatures
// logic). This layer classifies each accepted frame individually (the
// same aggregateBuffer([frame])+singleFrame:true pattern already used
// throughout this project's debug tooling) and, when the RELIABLE
// (non-uncertain) per-frame votes unanimously agree on one type,
// trusts that over the naive field-median aggregate. Introduces NO
// new numeric threshold — no percentage, no minimum count.
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

const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;

// ---- Extract the real classifyFeatures + aggregateBuffer + the new
// consensus functions (all sit inside the same dist...extractEyeROI
// range, since the consensus functions were inserted immediately
// after classifyFeatures and before extractEyeROI). ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');
if (cfStart === -1 || cfEnd === -1) throw new Error('Could not locate the classifyFeatures/consensus pipeline block — has it moved?');
const { classifyFeatures, aggregateBuffer, resolveReliableFrameConsensus, applyReliableFrameConsensus, classifyFrameForConsensus } = new Function(
  reactStubs + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures, aggregateBuffer, resolveReliableFrameConsensus, applyReliableFrameConsensus, classifyFrameForConsensus };'
)();

test('setup: extracted the real reliable-frame consensus functions from index.html successfully', () => {
  assert.strictEqual(typeof resolveReliableFrameConsensus, 'function');
  assert.strictEqual(typeof applyReliableFrameConsensus, 'function');
  assert.strictEqual(typeof classifyFrameForConsensus, 'function');
});

// ---- Extract buildCreaseV2CopyPayload (+ its debugV1BoundaryPeakFlag
// dependency) for the Part-A payload test — same technique already
// established in tests/eyelid-type-experimental.test.js. ----
const boundaryFlagStart = src.indexOf('function debugV1BoundaryPeakFlag(');
const boundaryFlagEnd = src.indexOf('\n    // ============================================================\n    // EXPERIMENTAL EYELID-TYPE INTEGRATION — DEBUG-ONLY LOCAL PROTOTYPE.', boundaryFlagStart);
const payloadFnStart = src.indexOf('function buildCreaseV2CopyPayload(');
const payloadFnEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
const { buildCreaseV2CopyPayload, summarizeFrameTrace } = new Function(
  src.slice(boundaryFlagStart, boundaryFlagEnd) + '\n' +
  src.slice(src.indexOf('function summarizeFrameTrace('), src.indexOf('\n    // DEBUG-UI-ONLY display of one eye\'s resolveEyelidCreaseEvidence')) + '\n' +
  src.slice(payloadFnStart, payloadFnEnd) +
  '\nreturn { buildCreaseV2CopyPayload, summarizeFrameTrace };'
)();

// ================================================================
// PART A — Copy V2 JSON must never see stale nulls.
// ================================================================
test('Part-A. CreaseV2DebugPanel\'s copy() reads frameTraceRef.current (the ref) at click time, not the frameTrace state prop', () => {
  const panelStart = src.indexOf('function CreaseV2DebugPanel(');
  const panelEnd = src.indexOf('\n    function LiveScanScreen(');
  const panelSrc = src.slice(panelStart, panelEnd);
  assert.ok(/const latestFrameTrace = frameTraceRef \? frameTraceRef\.current : frameTrace;/.test(panelSrc),
    'copy() must prefer the ref over the possibly-stale state prop');
  assert.ok(/buildCreaseV2CopyPayload\(data, compare, latestFrameTrace\)/.test(panelSrc),
    'copy() must build the payload from latestFrameTrace (the ref-sourced value), not the raw frameTrace prop');
});

test('Part-A. the finalization snapshot is written to the ref BEFORE setDebugFrameTrace (state) is called, so the ref is never behind the state', () => {
  const finalIdx = src.indexOf('debugFrameTraceSnapshotRef.current = {\n              frames: frameTraceRef.current, counts: summarizeFrameTrace(frameTraceRef.current),\n              aggregate: aggregated, finalClassified: finalProfile, finalRecType: finalProfile.eyelidType,\n            };');
  const setStateIdx = src.indexOf('setDebugFrameTrace(debugFrameTraceSnapshotRef.current);', finalIdx);
  assert.ok(finalIdx !== -1, 'expected the finalization ref assignment');
  assert.ok(setStateIdx !== -1 && setStateIdx > finalIdx, 'setDebugFrameTrace must be called with the ref\'s value, after the ref itself was updated');
});

test('Part-A. a finalization snapshot, once captured, yields the correct finalRecType through the real payload builder (simulating "Copy pressed via the ref")', () => {
  const refSnapshot = {
    frames: [], counts: summarizeFrameTrace([]),
    aggregate: { left: {}, right: {} },
    finalClassified: { eyelidType: 'openCrease' },
    finalRecType: 'openCrease',
  };
  const panelData = { left: { v1: { valid: false } }, right: { v1: { valid: false } } };
  const payload = buildCreaseV2CopyPayload(panelData, null, refSnapshot);
  assert.strictEqual(payload.productionEyelidTrace.finalRecType, 'openCrease');
  assert.strictEqual(payload.productionEyelidTrace.finalClassified.eyelidType, 'openCrease');
  assert.ok(payload.productionEyelidTrace.aggregate);
});

test('Part-A. reset on mount/camera-restart clears the ref, matching bufferRef\'s own lifecycle exactly', () => {
  const resetIdx = src.indexOf('debugFrameTraceSnapshotRef.current = { frames: [], counts: summarizeFrameTrace([]), aggregate: null, finalClassified: null, finalRecType: null };');
  const bufferResetIdx = src.indexOf('bufferRef.current = [];', src.indexOf('useEffect(() => {\n        let stream;'));
  assert.ok(resetIdx !== -1, 'expected the ref reset in the mount/camera-restart effect');
  assert.ok(bufferResetIdx !== -1 && bufferResetIdx < resetIdx, 'the ref reset must sit in the same effect, after the (already-existing) bufferRef reset');
});

// ================================================================
// PART B — fixtures
// ================================================================
function eyeMetrics({ creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6, cov = 0.44 } = {}) {
  return {
    width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cov, covInnerByWidth: cov, covOuterByWidth: cov, covByHeight: cov / 0.36,
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function frameEntry({ left = {}, right = {}, roll = 0, yaw = 0.02, pitch = 0.8, qualityScore = 0.8 } = {}) {
  return {
    t: 1000, leftMetrics: eyeMetrics(left), rightMetrics: eyeMetrics(right),
    headPose: { interEyeDistance: 65, roll, yawProxy: yaw, pitchProxy: pitch },
    qualityScore, faceBoxWidth: 220, verticalAsymRaw: 0,
  };
}
const OPEN_CLEAN = { creasePeak: 12, creaseProminence: 8, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 };
const BOUNDARY = { creasePeak: 15, creaseProminence: 0, creaseYFrac: 1, creaseReadQuality: 1, cov: 0.44 };
const HOODED_CLEAN = { creasePeak: 12, creaseProminence: 8, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.24 };
const MONOLID_CLEAN = { creasePeak: 2, creaseProminence: 1, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 };

function bufferOf(n, overrides) { return Array.from({ length: n }, () => frameEntry({ left: overrides, right: overrides })); }

// ================================================================
// STRICT-MAJORITY SUPPORT RULE — tests A-J exactly as specified.
// supportCount(type) > totalAcceptedFrames / 2. Unreliable/uncertain
// frames cast no vote but DO count toward the denominator.
// ================================================================

// A. 9 openCrease reliable + 6 unreliable -> openCrease (9 > 7.5) —
// the exact real-device trace.
test('A. real trace pattern: 9 reliable openCrease + 6 unreliable (15 total) -> openCrease (9 > 7.5)', () => {
  const buffer = bufferOf(9, OPEN_CLEAN).concat(bufferOf(6, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'openCrease');
  assert.strictEqual(consensus.reliableCount, 9);
  assert.strictEqual(consensus.totalCount, 15);
  assert.strictEqual(consensus.conflict, false);
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  assert.strictEqual(finalProfile.eyelidType, 'openCrease');
});

test('Part-A. end-to-end: finalize a real scan -> ref snapshot -> Copy payload -> aggregate/finalClassified/finalRecType are all non-null (simulates the transition toward ReviewScreen, where the panel itself would otherwise be gone)', () => {
  const buffer = bufferOf(9, OPEN_CLEAN).concat(bufferOf(6, BOUNDARY));
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  const consensus = resolveReliableFrameConsensus(buffer);
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  // This is exactly what the finalization code writes into
  // debugFrameTraceSnapshotRef.current — captured here as a plain
  // object standing in for the ref's value at the moment Copy is
  // pressed, regardless of whether LiveScanScreen has since started
  // transitioning toward ReviewScreen.
  const refSnapshot = {
    frames: [], counts: summarizeFrameTrace([]),
    aggregate: aggregated, finalClassified: finalProfile, finalRecType: finalProfile.eyelidType,
  };
  const panelData = { left: { v1: { valid: false } }, right: { v1: { valid: false } } };
  const payload = buildCreaseV2CopyPayload(panelData, null, refSnapshot);
  assert.notStrictEqual(payload.productionEyelidTrace.aggregate, null, 'aggregate must not be null');
  assert.notStrictEqual(payload.productionEyelidTrace.finalClassified, null, 'finalClassified must not be null');
  assert.notStrictEqual(payload.productionEyelidTrace.finalRecType, null, 'finalRecType must not be null');
  assert.strictEqual(payload.productionEyelidTrace.finalRecType, 'openCrease');
});

// B. 8 openCrease reliable + 7 unreliable -> openCrease (8 > 7.5)
test('B. 8 reliable openCrease + 7 unreliable (15 total) -> openCrease (8 > 7.5)', () => {
  const buffer = bufferOf(8, OPEN_CLEAN).concat(bufferOf(7, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'openCrease');
  assert.strictEqual(consensus.reliableCount, 8);
  assert.strictEqual(consensus.totalCount, 15);
});

// C. 7 openCrease reliable + 8 unreliable -> uncertain (7 is NOT > 7.5)
test('C. 7 reliable openCrease + 8 unreliable (15 total) -> uncertain (7 is not > 7.5)', () => {
  const buffer = bufferOf(7, OPEN_CLEAN).concat(bufferOf(8, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.strictEqual(consensus.conflict, false, 'only one candidate type was present, just short of majority — insufficient support, not a conflict');
});

// D. 1 openCrease reliable + 14 unreliable -> uncertain
test('D. 1 reliable openCrease + 14 unreliable (15 total) -> uncertain — a single reliable-looking frame can never dominate a scan', () => {
  const buffer = bufferOf(1, OPEN_CLEAN).concat(bufferOf(14, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.strictEqual(consensus.reliableCount, 1);
});

// E. 2 openCrease reliable + 10 unreliable -> uncertain. This is a
// DELIBERATE REVERSAL of an earlier local demo/test that treated this
// exact split as a successful "recovery" to openCrease — that behavior
// was unsafe (a small reliable minority dominating a mostly-unreliable
// scan) and has been removed.
test('E. 2 reliable openCrease + 10 unreliable (12 total) -> uncertain (2 is not > 6) — the earlier "recovery" behavior for this split is REMOVED as unsafe', () => {
  const buffer = bufferOf(2, OPEN_CLEAN).concat(bufferOf(10, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.notStrictEqual(consensus.type, 'openCrease', 'recovering a confident type from a 2-of-12 minority must never happen');
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  assert.strictEqual(finalProfile.eyelidType, 'uncertain');
});

// F. reliable openCrease and hooded votes, neither has strict majority -> uncertain
test('F. reliable openCrease AND reliable hooded votes present, neither reaches strict majority -> uncertain (conflict)', () => {
  const buffer = bufferOf(5, OPEN_CLEAN).concat(bufferOf(5, HOODED_CLEAN));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.strictEqual(consensus.conflict, true, 'two distinct reliable types were present — this is a genuine conflict, not mere insufficient evidence');
});
test('F2. even when one type is close, TWO reliable types present with neither at strict majority still resolves to uncertain', () => {
  // 6 openCrease + 6 hooded + 3 unreliable = 15 total; neither 6 nor 6 is >7.5.
  const buffer = bufferOf(6, OPEN_CLEAN).concat(bufferOf(6, HOODED_CLEAN)).concat(bufferOf(3, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.strictEqual(consensus.conflict, true);
});

// G. all unreliable -> uncertain
test('G. all frames unreliable/boundary -> uncertain, zero reliable votes, no conflict', () => {
  const buffer = bufferOf(8, BOUNDARY);
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'uncertain');
  assert.strictEqual(consensus.reliableCount, 0);
  assert.strictEqual(consensus.conflict, false);
});

// H. strict-majority monolid only works when those frames are
// genuinely classified monolid by existing production semantics.
test('H. strict-majority monolid: the winning frames are genuinely classified monolid by the REAL classifyFrameForConsensus, not an invented shortcut', () => {
  assert.strictEqual(classifyFrameForConsensus(frameEntry({ left: MONOLID_CLEAN, right: MONOLID_CLEAN })).eyelidType, 'monolid',
    'sanity: a single MONOLID_CLEAN frame must genuinely classify as monolid via real production logic');
  const buffer = bufferOf(8, MONOLID_CLEAN).concat(bufferOf(7, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'monolid');
  assert.strictEqual(consensus.representative.eyelidType, 'monolid');
});

// I. boundary/unreliable detector failures NEVER count as monolid.
test('I. boundary/unreliable frames never individually classify as monolid, and can never accumulate into a monolid majority on their own', () => {
  assert.notStrictEqual(classifyFrameForConsensus(frameEntry({ left: BOUNDARY, right: BOUNDARY })).eyelidType, 'monolid');
  const buffer = bufferOf(15, BOUNDARY);
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.notStrictEqual(consensus.type, 'monolid');
  assert.strictEqual(consensus.type, 'uncertain');
});

// J. strict-majority hooded retains the existing geometry-consistent coupled fields.
test('J. strict-majority hooded (9 reliable + 6 unreliable) retains geometry-consistent coupled fields', () => {
  const buffer = bufferOf(9, HOODED_CLEAN).concat(bufferOf(6, BOUNDARY));
  const consensus = resolveReliableFrameConsensus(buffer);
  assert.strictEqual(consensus.type, 'hooded');
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  assert.strictEqual(finalProfile.eyelidType, 'hooded');
  assert.strictEqual(finalProfile.isHooded, true);
  assert.ok(finalProfile.hoodingLevel === 'partial' || finalProfile.hoodingLevel === 'full');
  // Eye Geometry (Signal B) untouched.
  assert.strictEqual(finalProfile.eyelidCategory, classified.eyelidCategory);
  assert.strictEqual(finalProfile.eyelidCategoryConfidence, classified.eyelidCategoryConfidence);
});

// ================================================================
// Structural properties (retained from the prior turn, renamed to
// avoid colliding with the A-J majority-semantics tests above).
// ================================================================
test('reset. consensus has no cross-scan state of its own: two independent buffers never share any result, and the underlying buffer is already reset every scan', () => {
  const bufferA = bufferOf(9, OPEN_CLEAN).concat(bufferOf(6, BOUNDARY));
  const bufferB = bufferOf(15, BOUNDARY);
  assert.strictEqual(resolveReliableFrameConsensus(bufferA).type, 'openCrease');
  assert.strictEqual(resolveReliableFrameConsensus(bufferB).type, 'uncertain');
  assert.ok(src.indexOf('bufferRef.current = [];') !== -1, 'bufferRef must still be reset on mount/camera-restart (pre-existing, unmodified)');
});

test('gating. reliable-frame consensus computation is NOT gated behind if(debugAvailable) — it is production logic', () => {
  const consensusIdx = src.indexOf('const eyelidConsensus = resolveReliableFrameConsensus(bufferRef.current);');
  assert.ok(consensusIdx !== -1);
  const before = src.slice(Math.max(0, consensusIdx - 60), consensusIdx);
  assert.ok(!/if\s*\(debugAvailable\)\s*\{[^}]*$/.test(before), 'consensus must not be inside an if(debugAvailable) block');
});
test('gating2. the debug-only trace snapshot itself remains gated behind if(debugAvailable)', () => {
  const snapshotIdx = src.indexOf('debugFrameTraceSnapshotRef.current = {\n              frames: frameTraceRef.current');
  const before = src.slice(Math.max(0, snapshotIdx - 40), snapshotIdx);
  assert.ok(/if\s*\(debugAvailable\)\s*\{/.test(before));
});

test('isolation. the consensus layer (classifyFrameForConsensus/resolveReliableFrameConsensus/applyReliableFrameConsensus) never references any V2/V2.1/V2.2 identifier', () => {
  const start = src.indexOf('function classifyFrameForConsensus(');
  const end = src.indexOf('\n    // ============================================================\n    // NATURAL LASH SCAN');
  assert.ok(start !== -1 && end !== -1);
  const region = src.slice(start, end);
  assert.ok(!/detectEyelidCreaseV2|v2Multi|v2Linked|V2LinkedShadow|resolveEyelidCreaseEvidence|computeExperimentalEyelidType/.test(region));
});

test('enum. applyReliableFrameConsensus never produces an eyelidType value outside the existing 4-value enum ResultsScreen already handles', () => {
  const buffer = bufferOf(9, OPEN_CLEAN).concat(bufferOf(6, BOUNDARY));
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  const consensus = resolveReliableFrameConsensus(buffer);
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  assert.ok(['uncertain', 'hooded', 'monolid', 'openCrease'].includes(finalProfile.eyelidType));
});

// ================================================================
// Coupled-fields — the six fields proven semantically linked to
// eyelidType must always move together, correctly.
// ================================================================
test('coupled-fields. overriding TO a confident type (via direct function inputs) borrows all six coupled fields from one real representative frame; Eye Geometry and every unrelated field stay untouched', () => {
  // Direct, targeted test of the override mechanism itself — using
  // hand-constructed inputs where classified/consensus deliberately
  // differ, rather than searching for a real-data coincidence where
  // the naive aggregate happens to disagree with an achieved majority.
  const fakeClassified = {
    eyelidType: 'uncertain', eyelidTypeConfidence: 0.3, eyelidSignalsConflict: false,
    eyelidCategory: 'open', eyelidCategoryConfidence: 0.8,
    isHooded: false, hoodedConfidence: 0.8, hoodingLevel: 'none',
    eyeShapeCategory: 'almond', overallConfidence: 0.6, someUnrelatedField: 'unchanged',
  };
  const representative = {
    eyelidType: 'openCrease', eyelidTypeConfidence: 0.75, eyelidSignalsConflict: false,
    isHooded: false, hoodedConfidence: 0.8, hoodingLevel: 'none',
  };
  const consensus = { type: 'openCrease', reliableCount: 9, totalCount: 15, conflict: false, representative };
  const finalProfile = applyReliableFrameConsensus(fakeClassified, consensus);
  assert.strictEqual(finalProfile.eyelidType, 'openCrease');
  assert.strictEqual(finalProfile.eyelidTypeConfidence, 0.75);
  assert.strictEqual(finalProfile.isHooded, false);
  assert.strictEqual(finalProfile.eyelidSignalsConflict, false);
  // Eye Geometry (Signal B) and every unrelated field pass through untouched.
  assert.strictEqual(finalProfile.eyelidCategory, 'open');
  assert.strictEqual(finalProfile.eyelidCategoryConfidence, 0.8);
  assert.strictEqual(finalProfile.eyeShapeCategory, 'almond');
  assert.strictEqual(finalProfile.overallConfidence, 0.6);
  assert.strictEqual(finalProfile.someUnrelatedField, 'unchanged');
});

test('coupled-fields. overriding TO uncertain recomputes isHooded/hoodedConfidence/hoodingLevel from the SAME geometry-only baseline formula classifyFeatures itself already uses, not a new heuristic', () => {
  const fakeClassified = {
    eyelidType: 'hooded', eyelidTypeConfidence: 0.7, eyelidSignalsConflict: false,
    eyelidCategory: 'moderate', eyelidCategoryConfidence: 0.6,
    isHooded: true, hoodedConfidence: 0.7, hoodingLevel: 'partial',
    someUnrelatedField: 'unchanged',
  };
  const consensus = { type: 'uncertain', reliableCount: 4, totalCount: 8, conflict: true, representative: null };
  const result = applyReliableFrameConsensus(fakeClassified, consensus);
  assert.strictEqual(result.eyelidType, 'uncertain');
  assert.strictEqual(result.eyelidSignalsConflict, true);
  assert.strictEqual(result.isHooded, true, 'isHooded derives from eyelidCategory=moderate alone (unchanged Signal B), matching classifyFeatures\' own baseline');
  assert.strictEqual(result.hoodedConfidence, 0.25, 'capped at 0.25 — the same convention classifyFeatures itself already uses for uncertain');
  assert.strictEqual(result.hoodingLevel, 'partial');
  assert.strictEqual(result.someUnrelatedField, 'unchanged');
});

test('coupled-fields. no override at all when the aggregate already agrees with the reliable consensus (identity short-circuit)', () => {
  const buffer = bufferOf(9, OPEN_CLEAN).concat(bufferOf(6, BOUNDARY));
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.8 });
  assert.strictEqual(classified.eyelidType, 'openCrease', 'sanity: with a 9:6 majority, the naive aggregate already agrees (see the mathematical proof in the prior audit)');
  const consensus = resolveReliableFrameConsensus(buffer);
  const finalProfile = applyReliableFrameConsensus(classified, consensus);
  assert.strictEqual(finalProfile, classified, 'when consensus.type === classified.eyelidType, the exact same object must be returned, not a copy');
});

// ================================================================
// Threshold audit — proves no calibrated numeric threshold was
// introduced. "> half" (strict majority) is the one comparison
// against totalCount/2, which is the parameter-free mathematical
// definition of majority, not a tuned confidence percentage.
// ================================================================
test('threshold-audit. resolveReliableFrameConsensus contains no calibrated percentage/fraction/minimum-count constant — only the plain totalCount/2 majority comparison', () => {
  const start = src.indexOf('function resolveReliableFrameConsensus(');
  const end = src.indexOf('\n    // Pure. Applies the consensus verdict');
  const region = src.slice(start, end);
  assert.ok(!/0\.\d/.test(region), 'expected zero decimal-fraction literals anywhere in the consensus rule');
  assert.ok(region.includes('supportCounts[t] > totalCount / 2'), 'expected the literal, parameter-free ">totalCount/2" strict-majority comparison');
  assert.strictEqual((region.match(/totalCount \/ 2/g) || []).length, 1, 'expected exactly one majority comparison, not multiple differently-tuned thresholds');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
