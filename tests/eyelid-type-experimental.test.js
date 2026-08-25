// ============================================================
// EXPERIMENTAL EYELID TYPE INTEGRATION — LOCAL PROTOTYPE tests.
// ------------------------------------------------------------
// Production classifyFeatures (untouched) still decides eyelidType
// from V1 crease evidence alone — see tests/eyelid-classification.test.js
// for its own, separately-verified regression suite (still green,
// unmodified, after this turn's work).
//
// This file tests a NEW, separate, debug-only layer:
//   resolveEyelidCreaseEvidence(v1, v2Linked) — per-eye DESCRIPTIVE
//     evidence (state/confidence/selectedPath/alternativePaths/reasons),
//     never an eyelid-type label itself.
//   computeExperimentalEyelidType(leftEvidence, rightEvidence, eyelidCategory)
//     — combines two per-eye evidences using the SAME bilateral-
//     agreement rule and decision-tree branches classifyFeatures'
//     own eyelidType block already uses, reading (never mutating)
//     the REAL eyelidCategory passed in.
// Neither function is wired into classifyFeatures, leftMetrics/
// rightMetrics, or any production result — see tests G/H below and
// the source-guard tests confirming this.
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

// ---- Extract the real, currently-shipped resolver block straight out
// of index.html: clamp01 (a single pure line, extracted separately —
// the huge JSX-heavy screen components sitting textually BETWEEN
// clamp01 and this block make a single contiguous slice impossible)
// plus debugV2DisplayRank through the end of the experimental resolver
// block (right before CreaseV2EyePanel's JSX starts). ----
const clamp01Line = '    const clamp01 = (n) => Math.max(0, Math.min(1, n));';
if (src.indexOf(clamp01Line) === -1) {
  throw new Error('Could not locate the clamp01 definition in index.html — has it moved/changed? Update the marker above.');
}
const resolverStart = src.indexOf('    function debugV2DisplayRank(');
// Stops right before EvidenceEyeBlock (added in a later turn) — that's
// a JSX component sitting between computeExperimentalEyelidType and
// CreaseV2EyePanel, which a plain `new Function` extraction can't parse.
const resolverEnd = src.indexOf('\n    function EvidenceEyeBlock(');
if (resolverStart === -1 || resolverEnd === -1) {
  throw new Error('Could not locate the experimental resolver block in index.html — has it moved? Update the markers above.');
}
const resolverSource = clamp01Line + '\n' + src.slice(resolverStart, resolverEnd);
const {
  resolveEyelidCreaseEvidence, computeExperimentalEyelidType, debugEyeCreaseVerdict, debugEvidenceToVerdict,
  DEBUG_CREASE_PEAK_FLOOR, DEBUG_CREASE_PROMINENCE_FLOOR, DEBUG_CREASE_ABSENCE_MARGIN, DEBUG_CREASE_READABLE_FLOOR,
} = new Function(
  reactStubs + resolverSource + '\nreturn { resolveEyelidCreaseEvidence, computeExperimentalEyelidType, debugEyeCreaseVerdict, debugEvidenceToVerdict, DEBUG_CREASE_PEAK_FLOOR, DEBUG_CREASE_PROMINENCE_FLOOR, DEBUG_CREASE_ABSENCE_MARGIN, DEBUG_CREASE_READABLE_FLOOR };'
)();

test('setup: extracted the real experimental resolver functions from index.html successfully', () => {
  assert.strictEqual(typeof resolveEyelidCreaseEvidence, 'function');
  assert.strictEqual(typeof computeExperimentalEyelidType, 'function');
  assert.strictEqual(typeof debugEyeCreaseVerdict, 'function');
});

// ---- Extract the REAL, unmodified classifyFeatures separately (same
// markers as tests/eyelid-classification.test.js) for parity/
// equivalence tests against the experimental layer. ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');
const { classifyFeatures } = new Function(reactStubs + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();

// ---- Drift guard: the resolver's DEBUG_CREASE_* constants must match
// production's own CREASE_PEAK_FLOOR/CREASE_PROMINENCE_FLOOR/
// CREASE_ABSENCE_MARGIN/0.28-readable-floor exactly — same pattern as
// camera-preview.test.js's FACE_LOST_GRACE_MS drift test. ----
test('drift-guard: DEBUG_CREASE_* constants match production classifyFeatures\' own CREASE_* constants', () => {
  const peakM = src.match(/const CREASE_PEAK_FLOOR = (\d+);/);
  const promM = src.match(/const CREASE_PROMINENCE_FLOOR = (\d+);/);
  const marginM = src.match(/const CREASE_ABSENCE_MARGIN = ([\d.]+);/);
  const readableM = src.match(/m\.creaseReadQuality > (0\.\d+);/);
  assert.ok(peakM && promM && marginM && readableM, 'could not find one or more production CREASE_* constants — have they moved?');
  assert.strictEqual(DEBUG_CREASE_PEAK_FLOOR, Number(peakM[1]));
  assert.strictEqual(DEBUG_CREASE_PROMINENCE_FLOOR, Number(promM[1]));
  assert.strictEqual(DEBUG_CREASE_ABSENCE_MARGIN, Number(marginM[1]));
  assert.strictEqual(DEBUG_CREASE_READABLE_FLOOR, Number(readableM[1]));
});

// ---- Fixture helpers ----
function fakeV1({ valid = true, peakVal = 12.3, prominence = 8.1, creaseYFrac = 0.42, readQuality = 0.6 } = {}) {
  return valid ? { valid: true, peakVal, prominence, creaseYFrac, readQuality } : { valid: false };
}
function fakeLinkedPath({ meanT = 0.5, continuityFrac = 0.75, tVariation = 0.02, meanRawStrength = 25, meanLocalStrength = 2.5, meanThickness = 5, points } = {}) {
  const pts = points || Array.from({ length: 9 }, (_, i) => ({ sampleIndex: i, x: i * 10, y: 20, t: meanT, rawStrength: meanRawStrength, prominence: 10, localStrength: meanLocalStrength, thickness: meanThickness, currentV2Winner: false }));
  return { points: pts, xSpan: [pts[0].x, pts[pts.length - 1].x], continuityFrac, meanT, tVariation, meanRawStrength, meanLocalStrength, meanThickness, containsV2Winner: false };
}
function fakeV2Linked(paths) {
  return { valid: true, sampledColumns: 12, v2LinkedRuntimeMs: 1, paths: paths || [] };
}
const NO_LINKED = fakeV2Linked([]);
const GOOD_LINKED = fakeV2Linked([fakeLinkedPath({ meanT: 0.5, continuityFrac: 0.75 })]);

// ================================================================
// A. V1 boundaryPeak=true + good V2.2 crease evidence
// ================================================================
test('A. V1 boundaryPeak=true + good V2.2 evidence -> defers to V2.2, state=crease_detected', () => {
  const v1 = fakeV1({ peakVal: 15.25, prominence: 0, creaseYFrac: 1, readQuality: 1 }); // exact real-capture LEFT numbers
  const ev = resolveEyelidCreaseEvidence(v1, GOOD_LINKED);
  assert.strictEqual(ev.v1Unreliable, true);
  assert.ok(ev.reasons.some(r => /boundary/i.test(r)), 'expected a reason mentioning the boundary artifact');
  assert.strictEqual(ev.state, 'crease_detected');
  assert.ok(ev.selectedPath, 'expected V2.2\'s top-ranked path to be selected');
});

// ================================================================
// B. V1 prominence=0 (non-boundary) + good V2.2 evidence
// ================================================================
test('B. V1 prominence=0 without a boundary creaseYFrac + good V2.2 evidence -> still deferred, still unreliable', () => {
  const v1 = fakeV1({ peakVal: 9, prominence: 0, creaseYFrac: 0.5, readQuality: 0.7 }); // NOT at yFrac 0/1
  const ev = resolveEyelidCreaseEvidence(v1, GOOD_LINKED);
  assert.strictEqual(ev.v1Unreliable, true);
  assert.ok(!ev.reasons.some(r => /search-band boundary/i.test(r)), 'this case must NOT be attributed to the boundary artifact');
  assert.ok(ev.reasons.some(r => /prominence is exactly 0/i.test(r)));
  assert.strictEqual(ev.state, 'crease_detected');
});

// ================================================================
// C. V1 and V2.2 agree
// ================================================================
test('C. V1 reliable + detected, V2.2 also has a path -> state=crease_detected, reasons note agreement', () => {
  const v1 = fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4, readQuality: 0.6 }); // clears CREASE_PEAK_FLOOR/PROMINENCE_FLOOR
  const ev = resolveEyelidCreaseEvidence(v1, GOOD_LINKED);
  assert.strictEqual(ev.v1Unreliable, false);
  assert.strictEqual(ev.v1Verdict, 'detected');
  assert.strictEqual(ev.state, 'crease_detected');
  assert.ok(ev.reasons.some(r => /agrees on existence/i.test(r)));
});

// ================================================================
// D. V1 and V2.2 conflict
// ================================================================
test('D. V1 reliable + confidentlyAbsent, V2.2 finds a persistent path -> state=conflicting', () => {
  const v1 = fakeV1({ peakVal: 2, prominence: 1, creaseYFrac: 0.4, readQuality: 0.6 }); // below CREASE_ABSENCE_MARGIN floors
  const ev = resolveEyelidCreaseEvidence(v1, GOOD_LINKED);
  assert.strictEqual(ev.v1Verdict, 'confidentlyAbsent');
  assert.strictEqual(ev.state, 'conflicting');
  assert.ok(ev.reasons.some(r => /conflicting evidence/i.test(r)));
});

// ================================================================
// E. V2.2 has multiple plausible paths
// ================================================================
test('E. multiple V2.2 paths -> selectedPath is the top-ranked one, rest are alternativePaths', () => {
  const strong = fakeLinkedPath({ meanT: 0.5, continuityFrac: 0.75, meanLocalStrength: 3 });
  const weak = fakeLinkedPath({ meanT: 0.1, continuityFrac: 0.25, meanLocalStrength: 1 });
  const ev = resolveEyelidCreaseEvidence(fakeV1({ valid: false }), fakeV2Linked([weak, strong]));
  assert.strictEqual(ev.selectedPath, strong, 'expected the higher continuityFrac*strength path to be selected regardless of input order');
  assert.strictEqual(ev.alternativePaths.length, 1);
  assert.strictEqual(ev.alternativePaths[0], weak);
});

// ================================================================
// F. no reliable evidence
// ================================================================
test('F. no reliable evidence anywhere (V1 invalid, V2.2 empty) -> state=unreliable', () => {
  const ev = resolveEyelidCreaseEvidence(fakeV1({ valid: false }), NO_LINKED);
  assert.strictEqual(ev.state, 'unreliable');
  assert.strictEqual(ev.selectedPath, null);
});

// ================================================================
// G. geometry says open but crease evidence exists -> openCrease
// ================================================================
test('G. crease detected on both eyes, geometry reads open -> experimental eyelidType=openCrease', () => {
  const leftEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 }), NO_LINKED);
  const rightEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 }), NO_LINKED);
  const result = computeExperimentalEyelidType(leftEv, rightEv, 'open');
  assert.strictEqual(result.combined, 'detected');
  assert.strictEqual(result.eyelidType, 'openCrease');
});

// ================================================================
// H. geometry says moderate/pronounced and crease evidence exists -> hooded
// ================================================================
test('H. crease detected on both eyes, geometry reads moderate -> experimental eyelidType=hooded', () => {
  const leftEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 }), NO_LINKED);
  const rightEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 }), NO_LINKED);
  const result = computeExperimentalEyelidType(leftEv, rightEv, 'moderate');
  assert.strictEqual(result.eyelidType, 'hooded');
});

// ================================================================
// I. monolid must require STRONG absence evidence, not merely
// failure to find a crease.
// ================================================================
test('I. no evidence found (unreliable) on both eyes + open geometry -> uncertain, NEVER monolid', () => {
  const leftEv = resolveEyelidCreaseEvidence(fakeV1({ valid: false }), NO_LINKED);
  const rightEv = resolveEyelidCreaseEvidence(fakeV1({ valid: false }), NO_LINKED);
  assert.strictEqual(leftEv.state, 'unreliable');
  const result = computeExperimentalEyelidType(leftEv, rightEv, 'open');
  assert.notStrictEqual(result.eyelidType, 'monolid', 'a mere absence of evidence must never be read as a confident monolid claim');
  assert.strictEqual(result.eyelidType, 'uncertain');
});
test('I2. genuinely confidently-absent evidence + open geometry DOES produce monolid (the one case that should)', () => {
  const v1 = fakeV1({ peakVal: 2, prominence: 1, creaseYFrac: 0.4, readQuality: 0.6 });
  const leftEv = resolveEyelidCreaseEvidence(v1, NO_LINKED);
  const rightEv = resolveEyelidCreaseEvidence(v1, NO_LINKED);
  assert.strictEqual(leftEv.state, 'crease_not_detected');
  const result = computeExperimentalEyelidType(leftEv, rightEv, 'open');
  assert.strictEqual(result.eyelidType, 'monolid');
});

// ================================================================
// J. uncertain remains the fallback when evidence conflicts
// ================================================================
test('J. left/right evidence disagree -> combined=uncertain, experimental eyelidType=uncertain', () => {
  const detectedEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 }), NO_LINKED);
  const absentEv = resolveEyelidCreaseEvidence(fakeV1({ peakVal: 2, prominence: 1, creaseYFrac: 0.4 }), NO_LINKED);
  const result = computeExperimentalEyelidType(detectedEv, absentEv, 'open');
  assert.strictEqual(result.combined, 'uncertain');
  assert.strictEqual(result.eyelidType, 'uncertain');
  assert.ok(/disagree/i.test(result.why));
});

// ================================================================
// Real-capture reproduction — the exact LEFT V1 numbers from the
// approved real-iPhone diagnostics.
// ================================================================
test('real-capture: LEFT V1 (peakVal=15.25, prominence=0, creaseYFrac=1, readQuality=1) is flagged unreliable, not treated as strong evidence', () => {
  const v1 = fakeV1({ peakVal: 15.25, prominence: 0, creaseYFrac: 1, readQuality: 1 });
  const ev = resolveEyelidCreaseEvidence(v1, NO_LINKED);
  assert.strictEqual(ev.v1Unreliable, true);
  assert.strictEqual(ev.state, 'unreliable', 'with no V2.2 corroboration, this specific V1 read alone must not resolve to any confident state');
});

// ================================================================
// Parity/equivalence — when V1 is reliable on both eyes and V2.2 adds
// no NEW corroboration (no paths), the experimental result must
// exactly match what the REAL, unmodified classifyFeatures itself
// would decide from the identical V1 metrics — proving this is a
// minimum-safe-change layered ON TOP of, not a replacement for,
// production's own logic.
// ================================================================
function eyeMetricsForCF({ creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6, cov = 0.44 } = {}) {
  return {
    width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cov, covInnerByWidth: cov, covOuterByWidth: cov, covByHeight: cov / 0.36,
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid: 1, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function runParityCase(label, { creasePeak, creaseProminence, creaseYFrac, creaseReadQuality, cov }) {
  test(`parity: ${label}`, () => {
    const aggregated = {
      left: eyeMetricsForCF({ creasePeak, creaseProminence, creaseYFrac, creaseReadQuality, cov }),
      right: eyeMetricsForCF({ creasePeak, creaseProminence, creaseYFrac, creaseReadQuality, cov }),
      interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 },
    };
    const production = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
    const v1 = fakeV1({ peakVal: creasePeak, prominence: creaseProminence, creaseYFrac, readQuality: creaseReadQuality });
    const leftEv = resolveEyelidCreaseEvidence(v1, NO_LINKED);
    const rightEv = resolveEyelidCreaseEvidence(v1, NO_LINKED);
    const experimental = computeExperimentalEyelidType(leftEv, rightEv, production.eyelidCategory);
    assert.strictEqual(experimental.eyelidType, production.eyelidType,
      `experimental (${experimental.eyelidType}) must match production (${production.eyelidType}) when V2.2 adds no new corroboration`);
  });
}
runParityCase('open geometry + clear fold -> openCrease', { creasePeak: 12, creaseProminence: 8, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 });
runParityCase('moderate geometry + clear fold -> hooded', { creasePeak: 12, creaseProminence: 8, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.24 });
runParityCase('open geometry + confidently absent -> monolid', { creasePeak: 2, creaseProminence: 1, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.44 });
runParityCase('moderate geometry + confidently absent -> uncertain (conflict)', { creasePeak: 2, creaseProminence: 1, creaseYFrac: 0.4, creaseReadQuality: 0.6, cov: 0.24 });

// ================================================================
// Source-guards — proving this layer cannot reach production.
// ================================================================
test('source-guard: computeExperimentalEyelidType never assigns to its eyelidCategory parameter (reads it, never mutates it)', () => {
  const fnStart = src.indexOf('function computeExperimentalEyelidType(');
  const fnEnd = src.indexOf('\n    function CreaseV2EyePanel(');
  const fnSrc = src.slice(fnStart, fnEnd);
  assert.ok(!/eyelidCategory\s*=[^=]/.test(fnSrc), 'eyelidCategory must never be assigned to — only compared');
});

test('source-guard: the experimental debug computation is only reached inside if(debugAvailable)', () => {
  const callIdx = src.indexOf('const leftEvidence = resolveEyelidCreaseEvidence(leftCrease, v2LeftLinked);');
  assert.ok(callIdx !== -1, 'expected the experimental resolver call site in LiveScanScreen');
  // Window widened (was 4200) to comfortably cover the HOODING V2 —
  // STAGE 1 instrumentation added to this same debugAvailable block —
  // still well short of the PREVIOUS `if (debugAvailable) {` guard
  // further up (a different, unrelated debug block), so this remains
  // a real proof, not a loosened one.
  const before = src.slice(Math.max(0, callIdx - 7000), callIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(before), 'resolveEyelidCreaseEvidence call is not visibly guarded by "if (debugAvailable)"');
});

test('source-guard: the debug "currentClassified"/"experimental" comparison never feeds rec/onComplete', () => {
  const callIdx = src.indexOf('const currentClassified = classifyFeatures(debugAggregated');
  assert.ok(callIdx !== -1, 'expected the debug-only extra classifyFeatures call site');
  const after = src.slice(callIdx, callIdx + 1200);
  assert.ok(!/rec\.|onCompleteRef\.current\(/.test(after), 'the debug-only classification/comparison must not be wired into rec or onComplete');
  assert.ok(/setDebugEyelidCompare\(/.test(after), 'expected the result to be stored only in the debug-only setDebugEyelidCompare state');
});

test('source-guard: setDebugEyelidCompare\'s value is never read by any *Metrics assignment or the production classifyFeatures call sites', () => {
  const assignRegex = /(left|right)Metrics\.\w+\s*=\s*([^;]+);/g;
  const matches = [...src.matchAll(assignRegex)];
  for (const m of matches) {
    assert.ok(!/debugEyelidCompare|currentClassified|experimental|leftEvidence|rightEvidence/.test(m[2]),
      `found a *Metrics field assigned from the experimental layer: "${m[0]}"`);
  }
});

// ================================================================
// DEPLOYMENT-TURN ADDITIONS — Copy V2 JSON now includes the full
// experimental evidence breakdown per the real-iPhone UI requirement.
// buildCreaseV2CopyPayload is a pure function (no JSX) — extracted the
// same way tests/eyelid-crease-v2.test.js does.
// ================================================================
const payloadFnStart = src.indexOf('function buildCreaseV2CopyPayload(');
const payloadFnEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
const { buildCreaseV2CopyPayload } = new Function(
  resolverSource + '\n' + src.slice(payloadFnStart, payloadFnEnd) + '\nreturn { buildCreaseV2CopyPayload };'
)();

function fakeDebugCreaseV2Data(leftV1, rightV1) {
  return {
    left: { v1: leftV1, v2: { valid: false }, v2Multi: { valid: false }, v2Linked: NO_LINKED },
    right: { v1: rightV1, v2: { valid: false }, v2Multi: { valid: false }, v2Linked: NO_LINKED },
    capture: { ear: { left: 0.3, right: 0.3 }, roll: 0, yaw: 0, pitch: 0, brightness: 100, sharpness: 100 },
  };
}

test('copy-payload: experimentalEyelidType includes CURRENT/EXPERIMENTAL/GEOMETRY/COMBINED/WHY plus full per-eye evidence', () => {
  const leftV1 = fakeV1({ peakVal: 15.25, prominence: 0, creaseYFrac: 1, readQuality: 1 }); // real capture
  const rightV1 = fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 });
  const leftEvidence = resolveEyelidCreaseEvidence(leftV1, GOOD_LINKED);
  const rightEvidence = resolveEyelidCreaseEvidence(rightV1, NO_LINKED);
  const experimental = computeExperimentalEyelidType(leftEvidence, rightEvidence, 'open');
  const compare = {
    currentType: 'uncertain', currentCategory: 'open',
    experimentalType: experimental.eyelidType, why: experimental.why, combined: experimental.combined,
    leftEvidence, rightEvidence,
  };
  const payload = buildCreaseV2CopyPayload(fakeDebugCreaseV2Data(leftV1, rightV1), compare);
  const exp = payload.experimentalEyelidType;
  assert.strictEqual(exp.currentType, 'uncertain');
  assert.strictEqual(exp.experimentalType, experimental.eyelidType);
  assert.strictEqual(exp.geometryCategory, 'open');
  assert.strictEqual(exp.combinedEvidence, experimental.combined);
  assert.strictEqual(typeof exp.why, 'string');
  // LEFT: the real-capture boundary-artifact case
  assert.strictEqual(exp.left.v1BoundaryArtifact, true);
  assert.strictEqual(exp.left.v1Reliable, false);
  assert.strictEqual(exp.left.v2SelectedPath.meanT, GOOD_LINKED.paths[0].meanT);
  assert.strictEqual(exp.left.resolvedState, 'crease_detected');
  assert.ok(Array.isArray(exp.left.reasons) && exp.left.reasons.length > 0);
  // RIGHT: reliable, no V2.2 path
  assert.strictEqual(exp.right.v1BoundaryArtifact, false);
  assert.strictEqual(exp.right.v1Reliable, true);
  assert.strictEqual(exp.right.v2SelectedPath, null);
  assert.strictEqual(exp.right.resolvedState, 'crease_detected');
});

test('copy-payload: missing compare (undefined) -> experimentalEyelidType is all-null, never throws or invents 0', () => {
  const payload = buildCreaseV2CopyPayload(fakeDebugCreaseV2Data(fakeV1(), fakeV1()));
  const exp = payload.experimentalEyelidType;
  assert.strictEqual(exp.currentType, null);
  assert.strictEqual(exp.experimentalType, null);
  assert.strictEqual(exp.geometryCategory, null);
  assert.strictEqual(exp.combinedEvidence, null);
  assert.strictEqual(exp.left.v1Reliable, null);
  assert.strictEqual(exp.left.v2SelectedPath, null);
  assert.strictEqual(exp.left.resolvedState, null);
});

test('copy-payload: the full payload including experimentalEyelidType is JSON-serializable and round-trips', () => {
  const v1 = fakeV1({ peakVal: 12, prominence: 8, creaseYFrac: 0.4 });
  const evidence = resolveEyelidCreaseEvidence(v1, GOOD_LINKED);
  const experimental = computeExperimentalEyelidType(evidence, evidence, 'open');
  const compare = { currentType: 'openCrease', currentCategory: 'open', experimentalType: experimental.eyelidType, why: experimental.why, combined: experimental.combined, leftEvidence: evidence, rightEvidence: evidence };
  const payload = buildCreaseV2CopyPayload(fakeDebugCreaseV2Data(v1, v1), compare);
  const json = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.experimentalEyelidType.left.resolvedState, 'crease_detected');
  console.log(`        (measured payload size with experimentalEyelidType: ${json.length} bytes)`);
});

// ---- Source-guard: EvidenceEyeBlock actually renders every field the
// real-iPhone UI requirement asks for. ----
test('source-guard: EvidenceEyeBlock renders every required per-eye field label', () => {
  const blockStart = src.indexOf('function EvidenceEyeBlock(');
  const blockEnd = src.indexOf('\n    function CreaseV2EyePanel(');
  const blockSrc = src.slice(blockStart, blockEnd);
  for (const label of [
    'V1 peak/prom/yFrac', 'V1 reliable', 'V1 boundary artifact', 'V1 verdict',
    'V2.2 selected path', 'V2.2 meanT', 'V2.2 continuity', 'resolved crease evidence', 'reason',
  ]) {
    assert.ok(blockSrc.includes(label), `EvidenceEyeBlock is missing the required "${label}" field label`);
  }
});
test('source-guard: CreaseV2DebugPanel renders CURRENT/EXPERIMENTAL TYPE, GEOMETRY CATEGORY, COMBINED EVIDENCE, WHY, and mounts EvidenceEyeBlock for both eyes', () => {
  const panelStart = src.indexOf('function CreaseV2DebugPanel(');
  const panelSrc = src.slice(panelStart, panelStart + 4500);
  for (const label of ['CURRENT TYPE', 'EXPERIMENTAL TYPE', 'GEOMETRY CATEGORY', 'COMBINED EVIDENCE', 'WHY']) {
    assert.ok(panelSrc.includes(label), `CreaseV2DebugPanel is missing the required "${label}" label`);
  }
  assert.ok(/<EvidenceEyeBlock label="LEFT"/.test(panelSrc));
  assert.ok(/<EvidenceEyeBlock label="RIGHT"/.test(panelSrc));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
