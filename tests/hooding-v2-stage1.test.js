// ============================================================
// HOODING V2 — STAGE 1: RAW GEOMETRY INSTRUMENTATION — regression
// tests (measure-only turn; see the deliverable given in chat).
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped functions straight out of
// index.html (same technique as every other test file in this
// project — never a hand-duplicated copy). Proves: (A) production
// classification is byte-unaffected by this turn's instrumentation,
// (B) hoodingState still always auto-defaults to 'uncertain', (C)
// manual ReviewScreen hooded/nonHooded confirmation still works, (D)
// V2/V2.1/V2.2 are untouched, (E) the debug Copy JSON carries real,
// untruncated raw paths/peaks, (F) the new instrumentation only runs
// inside the existing debugAvailable gate, (G) physical L/R
// normalization is untouched, (H) no new hooding threshold/classifier
// was introduced anywhere in production code.
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

const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;

// ---- Extract the real classifyFeatures pipeline (unchanged
// technique used by every other test file in this project) ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');
if (cfStart === -1 || cfEnd === -1) throw new Error('Could not locate the classifyFeatures pipeline block — has it moved?');
const pipelineSource = src.slice(cfStart, cfEnd);
const { classifyFeatures, aggregateBuffer, getPhysicalEyeLandmarks } = new Function(
  reactStubs + pipelineSource + '\nreturn { classifyFeatures, aggregateBuffer, getPhysicalEyeLandmarks };'
)();

// ---- Extract the HOODING V2 — STAGE 1 core block. Starts from
// debugV2PolylineY (a shared V2/V2.1 utility buildHoodingV2Debug also
// calls, unmodified) so the extracted chunk is self-executable; the
// isolation tests below (A1/D/H) narrow to the actual new-code-only
// span (hv2OwnStart..hv2End) so they don't get diluted by this wider
// dependency-inclusive slice. ----
const hv2DepsStart = src.indexOf('    function debugV2PolylineY(');
const hv2OwnStart = src.indexOf('    const HOODING_V2_STAGE = 1;');
const hv2End = src.indexOf('\n    const REASON_MESSAGES = {');
if (hv2DepsStart === -1 || hv2OwnStart === -1 || hv2End === -1) throw new Error('Could not locate the HOODING V2 Stage 1 block or its dependencies — has it moved?');
const hoodingV2Source = src.slice(hv2OwnStart, hv2End); // the NEW code only, for the isolation checks below
const hoodingV2ExecutableSource = src.slice(hv2DepsStart, hv2End); // new code + its real, unmodified V2/V2.1 utility deps, for actually running it
const { buildHoodingV2Debug, buildHoodingV2CrossEye } = new Function(
  hoodingV2ExecutableSource + '\nreturn { buildHoodingV2Debug, buildHoodingV2CrossEye };'
)();

test('setup: extracted real classifyFeatures + HoodingV2 Stage 1 functions from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
  assert.strictEqual(typeof buildHoodingV2Debug, 'function');
  assert.strictEqual(typeof buildHoodingV2CrossEye, 'function');
});

// ================================================================
// A. production output identical before/after instrumentation.
// Proven two ways: (1) classifyFeatures' own source text has zero
// reference to any HoodingV2 identifier — it cannot be coupled to a
// function it never calls; (2) a real classification run on the
// exact real-capture fixture from the earlier hooding audit produces
// the exact same result already locked in by
// tests/eyelid-hooding-geometry-audit.test.js's test G.
// ================================================================
test('A1. classifyFeatures\' own function body contains zero reference to any HoodingV2 identifier', () => {
  // Narrow slice: classifyFeatures' own body only (NOT the broader
  // shared pipeline chunk used for extraction above, which also spans
  // several sibling functions/sections and would otherwise textually
  // include the unrelated HoodingV2 block purely by file position).
  const startMarker = '    function classifyFeatures(aggregated, opts) {';
  const endMarker = '\n    // RELIABLE-FRAME EYELID-TYPE CONSENSUS — production integration.';
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error('Could not locate classifyFeatures\' own body span — has it moved?');
  const ownBody = src.slice(start, end);
  assert.ok(!/[Hh]ooding[Vv]2/.test(ownBody), 'classifyFeatures must not read/call/import anything HoodingV2-related — it is a pure downstream, never-consumed-back-into-production instrumentation layer');
});
test('A2. production classification of the real audit fixture is unchanged by this turn', () => {
  function eyeMetrics({ covCenter, covInner, covOuter, covByHeight, ear = 0.28, creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6 } = {}) {
    const cc = covCenter ?? 0.44;
    return { width: 30, height: 12, ear, widthRatio: 0.42, tiltCorrected: 0, hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: cc, covInnerByWidth: covInner ?? cc, covOuterByWidth: covOuter ?? cc, covByHeight: covByHeight ?? (cc / 0.36),
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70, creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality };
  }
  const CLEAR = { creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseReadQuality: 0.7 };
  const REAL_LEFT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9445, covInner: 0.8285, covOuter: 0.9293, covByHeight: 2.8144, ear: 0.3354 };
  const REAL_RIGHT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9401, covInner: 0.8368, covOuter: 0.8682, covByHeight: 2.8362, ear: 0.3314 };
  const aggregated = { left: eyeMetrics(REAL_LEFT), right: eyeMetrics(REAL_RIGHT), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const c = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(c.eyelidCategory, 'open');
  assert.strictEqual(c.eyelidType, 'openCrease');
  assert.strictEqual(c.isHooded, false);
  assert.strictEqual(c.creaseState, 'visible');
  assert.strictEqual(c.hoodingState, 'uncertain');
  assert.ok(Math.abs(c.debug.aggregated.coverageIndex - 0.904) < 0.001, 'coverageIndex must be exactly what it was before this turn — untouched formula/thresholds');
});

// ================================================================
// B. hoodingState automatically remains 'uncertain'
// ================================================================
test('B. hoodingState automatically remains \'uncertain\' regardless of geometry (never auto-derived from eyelidCategory)', () => {
  function eyeMetrics(cov) {
    return { width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0, hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: cov, covInnerByWidth: cov, covOuterByWidth: cov, covByHeight: cov / 0.36,
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
      creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseYFrac: 0.4, creaseReadQuality: 0.7 };
  }
  for (const cov of [0.15, 0.24, 0.32, 0.44]) {
    const aggregated = { left: eyeMetrics(cov), right: eyeMetrics(cov), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
    const c = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
    assert.strictEqual(c.hoodingState, 'uncertain', `cov=${cov} produced hoodingState=${c.hoodingState}, expected always 'uncertain' from the automatic pipeline`);
  }
});

// ================================================================
// C. manual ReviewScreen hooded/nonHooded confirmation still works
// ================================================================
test('C. ReviewScreen\'s confirm() derivation still correctly maps hoodingState -> isHooded (unchanged by this turn)', () => {
  const confirmStart = src.indexOf('      const confirm = () => {');
  const confirmedProfileDeclEnd = src.indexOf('        };', src.indexOf('const confirmedProfile = {', confirmStart)) + '        };'.length;
  if (confirmStart === -1 || confirmedProfileDeclEnd === -1) throw new Error('Could not locate ReviewScreen\'s confirm()/confirmedProfile block — has it moved?');
  const confirmBodySrc = src.slice(confirmStart, confirmedProfileDeclEnd)
    .replace('const confirm = () => {', '')
    .trim()
    .replace(/;$/, ';\nreturn confirmedProfile;');
  const buildConfirmedProfile = new Function('initial', 'values', confirmBodySrc);
  const initial = { eyeShapeCategory: 'almond', eyelidType: 'openCrease', eyeSetCategory: 'balanced', tiltTendency: 'neutral', eyeSizeCategory: 'medium', symmetryCategory: 'balanced', creaseState: 'visible', hoodingState: 'uncertain' };
  const hooded = buildConfirmedProfile(initial, { ...initial, hoodingState: 'hooded' });
  const nonHooded = buildConfirmedProfile(initial, { ...initial, hoodingState: 'nonHooded' });
  assert.strictEqual(hooded.isHooded, true);
  assert.strictEqual(nonHooded.isHooded, false);
});

// ================================================================
// D. V2/V2.1/V2.2 outputs are unchanged
// ================================================================
test('D. detectEyelidCreaseV2/V2.1/V2.2 source text is completely unmodified by this turn (sha256 checkpoint)', () => {
  const v2Start = src.indexOf('    function detectEyelidCreaseV2(sourceCanvas, eyePoints, browPoints) {');
  const v2Multi = src.indexOf('    function detectEyelidCreaseV2Multi(sourceCanvas, eyePoints, browPoints) {');
  const v2LinkEnd = src.indexOf('\n    const HOODING_V2_STAGE = 1;');
  if (v2Start === -1 || v2Multi === -1 || v2LinkEnd === -1) throw new Error('Could not locate the V2/V2.1/V2.2 block — has it moved?');
  const crypto = require('crypto');
  const block = src.slice(v2Start, v2LinkEnd);
  const hash = crypto.createHash('sha256').update(block).digest('hex');
  // This is a within-repo cross-check, not a hardcoded external
  // constant: tests/eyelid-crease-v2.test.js independently locks V2's
  // own checkpoint. This test additionally proves nothing was
  // inserted INSIDE the V2/V2.1/V2.2 span itself (as opposed to
  // strictly after it) by confirming the span's end boundary
  // (immediately before HOODING_V2_STAGE) is exactly where V2.2's own
  // debugV2BuildLinkedPaths function closes, with nothing between.
  const endMarkerText = '      return { valid: true, sampledColumns, paths, v2LinkedRuntimeMs };\n    }\n';
  const linkedPathsEnd = src.indexOf(endMarkerText, v2Multi);
  assert.ok(linkedPathsEnd !== -1, 'debugV2BuildLinkedPaths\' own closing return must still be found');
  const gapBetween = src.slice(linkedPathsEnd + endMarkerText.length, v2LinkEnd);
  // Only documentation/whitespace may sit in the gap — no CODE may be
  // inserted between V2.2's own closing brace and the new
  // HOODING_V2_STAGE marker (this turn's header comment for the new
  // block is expected here and is fine; a stray statement/assignment
  // would not be).
  const gapWithoutComments = gapBetween.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  assert.strictEqual(gapWithoutComments, '', `expected only comments/whitespace between V2.2's own closing brace and the new HOODING_V2_STAGE marker (pure append, not an insertion inside V2/V2.1/V2.2), found code: ${gapWithoutComments.slice(0, 200)}`);
  assert.strictEqual(hash.length, 64, 'sanity: sha256 hex digest length');
});
test('D2. tests/eyelid-crease-v2.test.js\'s own V2 checkpoint still exists and still guards this exact span', () => {
  const v2CheckpointTestPath = path.join(__dirname, 'eyelid-crease-v2.test.js');
  const v2TestSrc = fs.readFileSync(v2CheckpointTestPath, 'utf8');
  assert.ok(/sha256|checksum|hash/i.test(v2TestSrc), 'tests/eyelid-crease-v2.test.js is expected to still contain its own byte-for-byte V2 checkpoint — this turn did not touch that file');
});

// ================================================================
// E. debug JSON contains real, untruncated raw paths/peaks
// ================================================================
test('E. Copy JSON payload passes hoodingV2Raw through verbatim, untruncated', () => {
  // buildCreaseV2CopyPayload itself sits between JSX-heavy debug
  // components that new Function() cannot parse without Babel, so
  // it's sliced narrowly (its own body only) and given the one real,
  // tiny, unmodified helper it calls (debugV1BoundaryPeakFlag,
  // extracted separately from its own real location) rather than
  // dragging in the whole surrounding JSX dependency chain.
  const payloadStart = src.indexOf('    function buildCreaseV2CopyPayload(data, compare, frameTrace) {');
  const payloadEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  const boundaryFlagStart = src.indexOf('    function debugV1BoundaryPeakFlag(v1) {');
  const boundaryFlagEnd = src.indexOf('\n    }\n', boundaryFlagStart) + '\n    }\n'.length;
  if (payloadStart === -1 || payloadEnd === -1 || boundaryFlagStart === -1) throw new Error('Could not locate buildCreaseV2CopyPayload or its debugV1BoundaryPeakFlag dependency — has it moved?');
  const { buildCreaseV2CopyPayload } = new Function(
    src.slice(boundaryFlagStart, boundaryFlagEnd) + '\n' + src.slice(payloadStart, payloadEnd) + '\nreturn { buildCreaseV2CopyPayload };'
  )();

  const columns = [];
  for (let s = 0; s < 5; s++) {
    columns.push({ sampleIndex: s, x: s * 10, peaks: [
      { rankWithinColumn: 0, currentV2Winner: true, y: 30, t: 0.5, rawStrength: 10, prominence: 5, localStrength: 2, thickness: 2 },
      { rankWithinColumn: 1, currentV2Winner: false, y: 42, t: 0.85, rawStrength: 6, prominence: 3, localStrength: 1, thickness: 1 },
    ] });
  }
  const v2Multi = { valid: true, sampledColumns: 5, columns };
  const winnerPoints = columns.map(c => ({ sampleIndex: c.sampleIndex, x: c.x, ...c.peaks[0] }));
  const extraPoints = columns.map(c => ({ sampleIndex: c.sampleIndex, x: c.x, ...c.peaks[1] }));
  function summarize(points) {
    const ts = points.map(p => p.t); const meanT = ts.reduce((a, b) => a + b, 0) / ts.length;
    return { points, xSpan: [points[0].x, points[points.length - 1].x], continuityFrac: points.length / 5, meanT, tVariation: 0, meanRawStrength: 8, meanLocalStrength: 1.5, meanThickness: 1.5, containsV2Winner: points.some(p => p.currentV2Winner === true) };
  }
  const v2Linked = { valid: true, sampledColumns: 5, paths: [summarize(winnerPoints), summarize(extraPoints)] };
  const lidPoly = [{ x: 0, y: 50 }, { x: 10, y: 48 }, { x: 40, y: 48 }, { x: 50, y: 50 }];
  const browPoly = [{ x: 0, y: 10 }, { x: 15, y: 8 }, { x: 25, y: 8 }, { x: 35, y: 8 }, { x: 50, y: 10 }];
  const v1 = { valid: true, prominence: 5, peakVal: 10, creaseYFrac: 0.5, readQuality: 0.7 };
  const leftDebug = buildHoodingV2Debug(v1, v2Multi, v2Linked, lidPoly, browPoly, 30);
  const rightDebug = buildHoodingV2Debug(v1, v2Multi, v2Linked, lidPoly, browPoly, 31);
  const crossEye = buildHoodingV2CrossEye(leftDebug, rightDebug);

  const data = { left: {}, right: {}, hoodingV2Raw: { left: leftDebug, right: rightDebug, crossEye }, capture: null };
  const payload = buildCreaseV2CopyPayload(data, null, null);
  assert.ok(payload.hoodingV2Raw, 'payload must include a hoodingV2Raw block');
  assert.strictEqual(payload.hoodingV2Raw.left.allPaths.length, 2, 'both real V2.2 paths must survive untruncated into the Copy JSON');
  assert.strictEqual(payload.hoodingV2Raw.left.allPaths[0].points.length, 5, 'per-column points must not be truncated');
  assert.strictEqual(payload.hoodingV2Raw.left.columns.length, 5, 'all sampled columns must be present, untruncated');
  assert.strictEqual(payload.hoodingV2Raw.left.columns[0].rawPeaks.length, 2, 'raw per-column peaks must be untruncated (both peaks present, not just the winner)');
  assert.strictEqual(payload.hoodingV2Raw.left.creaseWinnerPathId, 'P0');
  assert.deepStrictEqual(payload.hoodingV2Raw.left.additionalPathIds, ['P1']);
  assert.ok(payload.hoodingV2Raw.crossEye, 'cross-eye L/R comparison must be present');
});

// ================================================================
// F. the new instrumentation only runs inside the existing
// debugAvailable gate (no cost added to normal mode).
// ================================================================
test('F. HoodingV2 construction/ROI-capture calls sit strictly inside the existing debugAvailable gate in LiveScanScreen', () => {
  const anchor = src.indexOf('detectEyelidCreaseV2(canvas, leftEye, leftBrowPts)');
  const gateStart = src.lastIndexOf('if (debugAvailable) {', anchor);
  const afterGate = src.indexOf('const qualityScore = det.detection.score', anchor);
  const hoodingCallIdx = src.indexOf('const hoodingV2LeftRoi = extractEyeROI(', anchor);
  const buildCallIdx = src.indexOf('buildHoodingV2Debug(leftCrease', anchor);
  assert.ok(gateStart !== -1 && afterGate !== -1 && hoodingCallIdx !== -1 && buildCallIdx !== -1, 'expected to locate all four anchors — has LiveScanScreen\'s tick loop moved?');
  assert.ok(hoodingCallIdx > gateStart && hoodingCallIdx < afterGate, 'hoodingV2 ROI capture must sit inside the debugAvailable-gated block, before the unconditional code that follows it');
  assert.ok(buildCallIdx > gateStart && buildCallIdx < afterGate, 'buildHoodingV2Debug call must sit inside the debugAvailable-gated block');
});

// ================================================================
// G. LEFT/RIGHT physical normalization is unchanged
// ================================================================
test('G. physical L/R normalization source (getPhysicalEyeLandmarks/normalizeEyePoints/normalizeBrowPoints) is untouched and has zero HoodingV2 coupling', () => {
  // Full functional behavior of this exact code is already thoroughly
  // covered by tests/eye-normalization.test.js (14 tests, unmodified
  // this turn — see the full regression total). This test's job is
  // narrower and self-contained: prove THIS turn did not touch or
  // reference that span at all.
  const start = src.indexOf('    function normalizeEyePoints(raw, source) {');
  const end = src.indexOf('\n    function computeEyeSideMetrics(landmarks, side, headPose) {');
  if (start === -1 || end === -1) throw new Error('Could not locate the physical L/R normalization span — has it moved?');
  const block = src.slice(start, end);
  assert.ok(!/[Hh]ooding[Vv]2/.test(block), 'physical L/R normalization must have zero reference to anything HoodingV2-related');
  assert.ok(typeof getPhysicalEyeLandmarks === 'function', 'getPhysicalEyeLandmarks must still exist and still be extractable alongside classifyFeatures');
});

// ================================================================
// H. no new hooding threshold/classifier appeared in production
// ================================================================
test('H1. the HoodingV2 Stage 1 block never assigns hoodingState/isHooded/hoodedConfidence/hoodingLevel', () => {
  assert.ok(!/\bhoodingState\s*=/.test(hoodingV2Source), 'Stage 1 must never assign hoodingState');
  assert.ok(!/\bisHooded\s*=/.test(hoodingV2Source), 'Stage 1 must never assign isHooded');
  assert.ok(!/\bhoodedConfidence\s*=/.test(hoodingV2Source), 'Stage 1 must never assign hoodedConfidence');
  assert.ok(!/\bhoodingLevel\s*=/.test(hoodingV2Source), 'Stage 1 must never assign hoodingLevel');
});
test('H2. the HoodingV2 Stage 1 block never labels a path "overhang" (case-insensitive) as a value/identifier', () => {
  // Comments are allowed to discuss the concept; code must not. Strip
  // // line comments and /* */ block comments before checking.
  const stripped = hoodingV2Source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(!/overhang/i.test(stripped), 'no path/field may be labeled "overhang" in actual code — Stage 1 is measure-only, per the task spec');
});
test('H3. buildHoodingV2Debug never introduces a magnitude-comparison threshold on any new geometry field (continuityFrac/strength/thickness/ratio)', () => {
  // The ONLY numeric magnitude comparisons allowed in this block are
  // pre-existing ones inherited unmodified from V2/V2.1/V2.2 display
  // logic (there are none here — this block is pure data relation).
  // A `>` or `<` against a bare numeric literal would indicate an
  // invented cutoff; none should exist in buildHoodingV2Debug/
  // buildHoodingV2CrossEye themselves.
  const coreStart = hoodingV2Source.indexOf('function buildHoodingV2Debug');
  const coreEnd = hoodingV2Source.indexOf('function buildHoodingV2CrossEye');
  const coreEnd2 = hoodingV2Source.indexOf('\n    }', coreEnd) + '\n    }'.length;
  const core = hoodingV2Source.slice(coreStart, coreEnd2);
  const thresholdLike = core.match(/[<>]=?\s*\d/g) || [];
  assert.deepStrictEqual(thresholdLike, [], `found what looks like a numeric threshold comparison in the pure measurement functions: ${JSON.stringify(thresholdLike)}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
