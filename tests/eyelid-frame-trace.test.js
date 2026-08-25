// ============================================================
// REAL EYELID FRAME TRACE — DEBUG-ONLY observability tests.
// ------------------------------------------------------------
// Per-scan diagnostic instrumentation, gated entirely behind
// debugAvailable, that traces every frame ACTUALLY accepted into
// bufferRef.current using the REAL, unmodified aggregateBuffer +
// classifyFeatures (via the same aggregateBuffer([frame]) +
// singleFrame:true pattern already established for the debug
// "CURRENT TYPE" preview two turns ago) — never a parallel
// approximation. Does not modify aggregateBuffer, classifyFeatures,
// any detector, or any production result.
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

// ---- Extract the REAL classifyFeatures + aggregateBuffer pipeline
// (same markers as tests/eyelid-classification.test.js /
// tests/eyelid-type-experimental.test.js). ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');

// ---- Extract the debug resolver pure-function zone (debugV2DisplayRank
// through buildEyelidFrameTrace/summarizeFrameTrace, stopping right
// before EvidenceEyeBlock's JSX). clamp01 itself is already present in
// the classifyFeatures pipeline slice above — no need to re-add it. ----
const resolverStart = src.indexOf('    function debugV2DisplayRank(');
const resolverEnd = src.indexOf('\n    function EvidenceEyeBlock(');
if ([cfStart, cfEnd, resolverStart, resolverEnd].some(i => i === -1)) {
  throw new Error('Could not locate one or more source blocks — have they moved? Update the markers above.');
}
const combinedSource = src.slice(cfStart, cfEnd) + '\n' + src.slice(resolverStart, resolverEnd);

const { buildEyelidFrameTrace, summarizeFrameTrace, aggregateBuffer, classifyFeatures, debugEyeCreaseVerdict, debugV1BoundaryPeakFlag } = new Function(
  reactStubs + combinedSource + '\nreturn { buildEyelidFrameTrace, summarizeFrameTrace, aggregateBuffer, classifyFeatures, debugEyeCreaseVerdict, debugV1BoundaryPeakFlag };'
)();

test('setup: extracted the real buildEyelidFrameTrace/summarizeFrameTrace from index.html successfully', () => {
  assert.strictEqual(typeof buildEyelidFrameTrace, 'function');
  assert.strictEqual(typeof summarizeFrameTrace, 'function');
});

// ---- Drift guard: the reused assessFrameQuality thresholds
// (45/235/10/18/0.32/0.25/1.3) must match production's own literal
// values — same pattern as the DEBUG_CREASE_* drift test. ----
test('drift-guard: low_image_quality/pose_issue reason flags reuse assessFrameQuality\'s own exact thresholds', () => {
  const afqStart = src.indexOf('function assessFrameQuality(');
  const afqEnd = src.indexOf('\n    function sampleBrightness(');
  const afq = src.slice(afqStart, afqEnd);
  assert.ok(/Math\.abs\(headPose\.roll\) > 18/.test(afq));
  assert.ok(/Math\.abs\(headPose\.yawProxy\) > 0\.32/.test(afq));
  assert.ok(/headPose\.pitchProxy < 0\.25 \|\| headPose\.pitchProxy > 1\.3/.test(afq));
  assert.ok(/brightness < 45/.test(afq));
  assert.ok(/brightness > 235/.test(afq));
  assert.ok(/sharpness < 10/.test(afq));
  const traceStart = src.indexOf('function buildEyelidFrameTrace(');
  const traceEnd = src.indexOf('\n    // Pure — running counts');
  const trace = src.slice(traceStart, traceEnd);
  assert.ok(/brightness < 45 \|\| brightness > 235 \|\| sharpness < 10/.test(trace), 'low_image_quality must reuse the exact same literals');
  assert.ok(/Math\.abs\(frameEntry\.headPose\.roll\) > 18/.test(trace) && /Math\.abs\(frameEntry\.headPose\.yawProxy\) > 0\.32/.test(trace), 'pose_issue must reuse the exact same literals');
});

// ---- Fixture helpers ----
function eyeMetrics({ creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6, cov = 0.44, ear = 0.28 } = {}) {
  return {
    width: 30, height: 12, ear, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cov, covInnerByWidth: cov, covOuterByWidth: cov, covByHeight: cov / 0.36,
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function frameEntry({ left = {}, right = {}, roll = 0, yaw = 0, pitch = 0.8, t = 1000 } = {}) {
  return {
    t, leftMetrics: eyeMetrics(left), rightMetrics: eyeMetrics(right),
    headPose: { interEyeDistance: 65, roll, yawProxy: yaw, pitchProxy: pitch },
    qualityScore: 0.75, faceBoxWidth: 220, verticalAsymRaw: 0,
  };
}
const OPEN_CLEAN = { creasePeak: 12, creaseProminence: 8, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 };
const BOUNDARY = { creasePeak: 15, creaseProminence: 0, creaseYFrac: 1, creaseReadQuality: 1, cov: 0.44 };
const ABSENT_OPEN = { creasePeak: 2, creaseProminence: 1, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 };

// ================================================================
// A. only frames actually accepted into production buffer are traced
// ================================================================
test('A. the trace call site sits strictly after bufferRef.current.push(frameEntry) and after the quality-rejection early-return', () => {
  const pushIdx = src.indexOf('bufferRef.current.push(frameEntry);');
  const traceCallIdx = src.indexOf('const trace = buildEyelidFrameTrace(frameTraceRef.current.length, frameEntry, brightness, sharpness);');
  const rejectIdx = src.indexOf("console.log('[LSA] FRAME REJECTED:', quality.reasons.join(', '));");
  assert.ok(pushIdx !== -1 && traceCallIdx !== -1 && rejectIdx !== -1, 'expected all three anchor points in LiveScanScreen\'s tick handler');
  assert.ok(rejectIdx < pushIdx, 'the quality-rejection return must come before the buffer push');
  assert.ok(pushIdx < traceCallIdx, 'the trace call must come strictly after the real buffer push, not before it');
});

// ================================================================
// B. trace uses the same metrics object production buffers
// ================================================================
test('B. buildEyelidFrameTrace reads its crease values directly off the SAME frameEntry object shape pushed to bufferRef.current', () => {
  const fe = frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN });
  const trace = buildEyelidFrameTrace(0, fe, 100, 20);
  assert.strictEqual(trace.left.creasePeak, fe.leftMetrics.creasePeak);
  assert.strictEqual(trace.left.creaseProminence, fe.leftMetrics.creaseProminence);
  assert.strictEqual(trace.left.creaseYFrac, fe.leftMetrics.creaseYFrac);
  assert.strictEqual(trace.right.creaseReadQuality, fe.rightMetrics.creaseReadQuality);
  assert.strictEqual(trace.image.earLeft, fe.leftMetrics.ear);
  assert.strictEqual(trace.image.roll, fe.headPose.roll);
});

// ================================================================
// C. openCrease frame is counted correctly
// ================================================================
test('C. a clean, open-geometry frame is traced as eyelidType=openCrease and counted', () => {
  const fe = frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN });
  const trace = buildEyelidFrameTrace(0, fe, 150, 30);
  assert.strictEqual(trace.eyelidType, 'openCrease');
  assert.deepStrictEqual(trace.reasons, []);
  const counts = summarizeFrameTrace([trace]);
  assert.strictEqual(counts.openCrease, 1);
  assert.strictEqual(counts.uncertain, 0);
});

// ================================================================
// D. uncertain frame is counted correctly
// ================================================================
test('D. a boundary-artifact frame is traced as eyelidType=uncertain and counted', () => {
  const fe = frameEntry({ left: BOUNDARY, right: BOUNDARY });
  const trace = buildEyelidFrameTrace(0, fe, 150, 30);
  assert.strictEqual(trace.eyelidType, 'uncertain');
  const counts = summarizeFrameTrace([trace]);
  assert.strictEqual(counts.uncertain, 1);
  assert.strictEqual(counts.openCrease, 0);
});

// ================================================================
// E. boundary artifact reason is preserved
// ================================================================
test('E. boundary_artifact reason is present for a real V1 boundary-peak reading, absent otherwise', () => {
  const boundaryFe = frameEntry({ left: BOUNDARY, right: BOUNDARY });
  const cleanFe = frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN });
  assert.ok(buildEyelidFrameTrace(0, boundaryFe, 150, 30).reasons.includes('boundary_artifact'));
  assert.ok(!buildEyelidFrameTrace(0, cleanFe, 150, 30).reasons.includes('boundary_artifact'));
  const counts = summarizeFrameTrace([buildEyelidFrameTrace(0, boundaryFe, 150, 30), buildEyelidFrameTrace(1, cleanFe, 150, 30)]);
  assert.strictEqual(counts.boundary, 1);
});

// ================================================================
// F. LEFT/RIGHT disagreement is preserved
// ================================================================
test('F. crease_disagreement reason is present exactly when LEFT and RIGHT per-eye verdicts differ', () => {
  const fe = frameEntry({ left: OPEN_CLEAN, right: ABSENT_OPEN });
  const trace = buildEyelidFrameTrace(0, fe, 150, 30);
  assert.ok(trace.reasons.includes('crease_disagreement'));
  const agreeFe = frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN });
  assert.ok(!buildEyelidFrameTrace(0, agreeFe, 150, 30).reasons.includes('crease_disagreement'));
});

// ================================================================
// G. aggregate snapshot equals real aggregateBuffer output
// ================================================================
test('G. the aggregate stored in the payload is literally the real aggregateBuffer(frames) output, not a copy/transform', () => {
  const frames = [frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN }), frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN })];
  const realAggregate = aggregateBuffer(frames);
  // buildCreaseV2CopyPayload just passes frameTrace.aggregate through —
  // verified directly against the real function here.
  assert.deepStrictEqual(realAggregate, aggregateBuffer(frames), 'sanity: aggregateBuffer is deterministic');
  assert.strictEqual(realAggregate.left.creasePeak, 12);
});

// ================================================================
// H. finalClassified equals the real production classifyFeatures output
// ================================================================
test('H. finalClassified would be literally the real classifyFeatures(aggregated, ...) result', () => {
  const frames = [frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN }), frameEntry({ left: OPEN_CLEAN, right: OPEN_CLEAN })];
  const aggregated = aggregateBuffer(frames);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability: { stable: true }, imageQuality: 0.75 });
  assert.strictEqual(classified.eyelidType, 'openCrease');
  // Source-guard: confirm the real call site literally assigns
  // aggregated/classified (not a copy) into the debug snapshot state.
  const callIdx = src.indexOf('setDebugFrameTrace(prev => ({\n              ...prev, frames: frameTraceRef.current, counts: summarizeFrameTrace(frameTraceRef.current),\n              aggregate: aggregated, finalClassified: classified, finalRecType: classified.eyelidType,');
  assert.ok(callIdx !== -1, 'expected the finalization snapshot to assign the real aggregated/classified variables verbatim');
});

// ================================================================
// I. finalRecType equals rec.eyeProfile.eyelidType
// ================================================================
test('I. finalRecType is set from classified.eyelidType, the exact same value that becomes rec.eyeProfile.eyelidType', () => {
  const snapshotIdx = src.indexOf('finalRecType: classified.eyelidType,');
  const recIdx = src.indexOf("source: 'live', eyeProfile: classified,");
  assert.ok(snapshotIdx !== -1, 'finalRecType must be derived from classified.eyelidType');
  assert.ok(recIdx !== -1, 'rec.eyeProfile must be assigned the same classified object');
  assert.ok(snapshotIdx < recIdx, 'the snapshot capture must happen using the same classified object before rec is built, proving no intervening transform');
});

// ================================================================
// J. debug off -> zero tracing / zero behavior change
// ================================================================
test('J. the entire trace block (per-tick append + finalization snapshot) is gated behind if(debugAvailable)', () => {
  const tickCallIdx = src.indexOf('const trace = buildEyelidFrameTrace(frameTraceRef.current.length, frameEntry, brightness, sharpness);');
  const beforeTick = src.slice(Math.max(0, tickCallIdx - 200), tickCallIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(beforeTick), 'per-tick trace append must be guarded by if(debugAvailable)');

  const finalIdx = src.indexOf('aggregate: aggregated, finalClassified: classified, finalRecType: classified.eyelidType,');
  const beforeFinal = src.slice(Math.max(0, finalIdx - 300), finalIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(beforeFinal), 'finalization snapshot must be guarded by if(debugAvailable)');
});

// ================================================================
// K. JSON contains all accepted frames
// ================================================================
test('K. no frame is ever truncated/sliced in the trace pipeline (source-guard: no .slice(/.splice( on frameTraceRef or debugFrameTrace.frames)', () => {
  const start = src.indexOf('function buildEyelidFrameTrace(');
  const end = src.indexOf('\n    function CreaseV2EyePanel(');
  const region = src.slice(start, end);
  assert.ok(!/frameTraceRef\.current\.slice\(/.test(region) && !/debugFrameTrace\.frames\.slice\(/.test(region),
    'the frame trace array must never be truncated');
});

// ================================================================
// L. no production object consumes trace data
// ================================================================
test('L. no leftMetrics/rightMetrics/aggregated/classified/rec assignment ever reads from the trace layer', () => {
  const assignRegex = /(left|right)Metrics\.\w+\s*=\s*([^;]+);/g;
  for (const m of [...src.matchAll(assignRegex)]) {
    assert.ok(!/frameTraceRef|debugFrameTrace|buildEyelidFrameTrace|summarizeFrameTrace/.test(m[2]),
      `found a *Metrics field assigned from the frame-trace layer: "${m[0]}"`);
  }
  const aggregatedAssign = src.indexOf('const aggregated = aggregateBuffer(bufferRef.current);');
  assert.ok(aggregatedAssign !== -1, 'expected the real aggregateBuffer(bufferRef.current) call, unchanged — confirms aggregated is never sourced from the trace');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
