// ============================================================
// LIVE SCAN CORNER-ANGLE ASYMMETRY — full-pipeline regression tests.
// ------------------------------------------------------------
// Bug report under investigation: real Live Scan showed
// "Angle of corners" (asymmetryBreakdown.tilt) = 167.8 degrees, with
// debug readings LEFT tiltCorrected ~= -5.568, RIGHT tiltCorrected
// ~= -173.385 — while every other L/R metric on the same capture was
// close/normal, implying the 180-degree mirror/direction bug from a
// previous turn (fixed via mirrorReflectDeg, see
// tests/angle-symmetry.test.js) was reproducing again.
//
// Root-cause finding (this turn): it is NOT. Running the two exact
// reported numbers through the CURRENTLY SHIPPED, already-fixed
// composed formula — shortestAngleDiffDeg(left.tiltCorrected,
// mirrorReflectDeg(right.tiltCorrected)) — gives ~1.05 degrees, not
// 167.8. Running the SAME two numbers through the OLD, unmirrored
// formula (shortestAngleDiffDeg(left, right), no mirrorReflectDeg)
// gives 167.817 — matching the reported 167.8 almost exactly. That
// match is the load-bearing evidence: the live app that was actually
// tested was not running the current source (see the accompanying
// report for the stale-deployment/cache explanation). Nothing in the
// current tilt formula needed to change.
//
// This file exists to (a) pin those two exact numbers as a permanent
// regression guard through the REAL, FULL Live Scan aggregation path
// — aggregateBuffer() over a synthetic multi-frame buffer, exactly as
// LiveScanScreen builds it, not just the bare helper functions already
// covered in tests/angle-symmetry.test.js — and (b) prove Live Scan
// and Photo Analysis share the exact same classifyFeatures code path
// (task item 3: no separate/duplicate branch exists for either
// screen).
//
// Extraction technique: identical to
// tests/eyelid-hooding-geometry-audit.test.js — pull the real,
// currently-shipped pipeline block straight out of index.html and
// eval it. Nothing in the extracted range is modified or
// hand-duplicated.
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
function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${a} ~= ${b} (eps=${eps})`);
}

// ---- Same extraction span as tests/eyelid-hooding-geometry-audit.test.js:
// covers dist/angle/shortestAngleDiffDeg/mirrorReflectDeg/median/stdOf/
// aggregateBuffer/computeStability/classifyFeatures/consensus fns. ----
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
const { classifyFeatures, aggregateBuffer, computeStability, shortestAngleDiffDeg, mirrorReflectDeg } = new Function(
  reactStubs + pipelineSource + '\nreturn { classifyFeatures, aggregateBuffer, computeStability, shortestAngleDiffDeg, mirrorReflectDeg };'
)();

test('setup: extracted classifyFeatures/aggregateBuffer/computeStability/shortestAngleDiffDeg/mirrorReflectDeg from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
  assert.strictEqual(typeof aggregateBuffer, 'function');
  assert.strictEqual(typeof computeStability, 'function');
  assert.strictEqual(typeof shortestAngleDiffDeg, 'function');
  assert.strictEqual(typeof mirrorReflectDeg, 'function');
});

// ---- Synthetic per-frame eye-metrics builder — same shape used by
// aggregateBuffer's EYE_METRIC_KEYS. Only tiltCorrected varies across
// tests; every other field is held at a plausible, close/normal L/R
// value (matching the bug report's own description: "width/height and
// remaining L/R metrics close and normal"). ----
function frameMetrics(tiltCorrected) {
  return {
    widthRatio: 0.42, width: 30, height: 12, tiltCorrected,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5, ear: 0.28,
    covCenterByWidth: 0.44, covInnerByWidth: 0.44, covOuterByWidth: 0.44, covByHeight: 1.2,
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid: 1, creaseProminence: 8, creasePeak: 14, creaseYFrac: 0.4, creaseReadQuality: 0.65,
  };
}
// Builds a REAL multi-frame buffer, jittered by +/-0.15 degrees per
// frame around the given LEFT/RIGHT tiltCorrected centers — small
// enough to comfortably pass computeStability's sRt.std/sLt.std < 2.5
// gate (as any buffer LiveScanScreen actually finalizes on must), so
// this genuinely exercises aggregateBuffer's per-frame median() path,
// not just a single repeated frame.
function buildLiveScanBuffer(leftCenter, rightCenter, n = 12) {
  const buffer = [];
  for (let i = 0; i < n; i++) {
    const jitter = ((i % 5) - 2) * 0.06; // deterministic, small, +/-0.12 max
    buffer.push({
      leftMetrics: frameMetrics(leftCenter + jitter),
      rightMetrics: frameMetrics(rightCenter - jitter),
      headPose: { interEyeDistance: 65, roll: 0 },
      faceBoxWidth: 220,
      verticalAsymRaw: 0,
    });
  }
  return buffer;
}
function runLiveScanPipeline(leftCenter, rightCenter) {
  const buffer = buildLiveScanBuffer(leftCenter, rightCenter);
  const stability = computeStability(buffer);
  const aggregated = aggregateBuffer(buffer);
  const classified = classifyFeatures(aggregated, { singleFrame: false, stability, imageQuality: 0.8 });
  return { stability, aggregated, classified };
}

// ================================================================
// 1. THE EXACT REPORTED BUG NUMBERS, through the FULL Live Scan
//    aggregation pipeline (aggregateBuffer -> classifyFeatures), not
//    just the bare helper math.
// ================================================================
test('1. reported bug numbers via bare helpers: naive shortestAngleDiffDeg(-5.568, -173.385) (NO mirror) = 167.817 -- matches the reported "167.8 degrees" almost exactly, confirming this is the signature of the OLD unmirrored formula', () => {
  approx(shortestAngleDiffDeg(-5.568, -173.385), 167.817, 0.001);
});

test('2. same reported numbers through the CURRENT, shipped composed fix (bare helpers): ~1.047 degrees, not 167.8 -- proves the current tilt formula, if it had actually run, could not have produced the reported value', () => {
  const corrected = shortestAngleDiffDeg(-5.568, mirrorReflectDeg(-173.385));
  approx(corrected, 1.047, 0.001);
});

test('3. reported bug numbers through the REAL, FULL Live Scan pipeline (synthetic multi-frame buffer -> aggregateBuffer -> classifyFeatures, exactly as LiveScanScreen finalizes a scan): asymmetryBreakdown.tilt is ~1 degree, not 167.8', () => {
  const { stability, classified } = runLiveScanPipeline(-5.568, -173.385);
  assert.strictEqual(stability.stable, true, 'this buffer must pass the real stability gate (tight per-frame jitter), exactly like any buffer LiveScanScreen would actually finalize on');
  approx(classified.asymmetryBreakdown.tilt, 1.047, 0.05, 'full pipeline result');
  assert.ok(classified.asymmetryBreakdown.tilt < 30, 'sanity bound: nowhere near the reported 167.8');
});

// ================================================================
// 2. Symmetric / near-symmetric case must not produce ~170 degrees
//    (task requirement: a symmetric or near-symmetric capture must
//    not read as ~170 degrees of corner-angle asymmetry).
// ================================================================
test('4. near-symmetric capture (both eyes read close to level, small raw jitter only) resolves to a small asymmetry through the full pipeline, not ~170', () => {
  const { classified } = runLiveScanPipeline(-1.2, -178.9); // physically: both eyes ~level, RIGHT expressed in its mirrored raw convention
  assert.ok(classified.asymmetryBreakdown.tilt < 5, `expected a small asymmetry, got ${classified.asymmetryBreakdown.tilt}`);
});

// ================================================================
// 3. LEFT ~0 degrees / RIGHT ~+/-180 degrees mirror boundary case —
//    exactly the seam mirrorReflectDeg/shortestAngleDiffDeg exist to
//    handle, exercised through the full pipeline this time.
// ================================================================
test('5. LEFT ~0 degrees, RIGHT ~+180 degrees (raw mirror convention, physically level eyes straddling the +/-180 seam) resolves to a small asymmetry, not ~180', () => {
  const { stability, classified } = runLiveScanPipeline(0.1, 179.9);
  assert.strictEqual(stability.stable, true);
  assert.ok(classified.asymmetryBreakdown.tilt < 2, `expected near-zero asymmetry at the mirror seam, got ${classified.asymmetryBreakdown.tilt}`);
});

test('5b. LEFT ~0 degrees, RIGHT ~-180 degrees (the other side of the same seam) also resolves to a small asymmetry', () => {
  const { classified } = runLiveScanPipeline(-0.1, -179.9);
  assert.ok(classified.asymmetryBreakdown.tilt < 2, `expected near-zero asymmetry, got ${classified.asymmetryBreakdown.tilt}`);
});

// ================================================================
// 4. Real directional asymmetry (one eye genuinely more upturned than
//    the other) must still be REPORTED, not zeroed out by the fix —
//    exercised through the full pipeline.
// ================================================================
test('6. genuine opposite-direction asymmetry (LEFT +8 degrees upturned, RIGHT -2 degrees, i.e. a real 10 degree difference) is preserved through the full pipeline, not collapsed to ~0', () => {
  // RIGHT's raw mirrored-convention reading for a -2 degree real upturn is (180 - (-2)) wrapped = ~-178.
  const { classified } = runLiveScanPipeline(8, -178);
  approx(classified.asymmetryBreakdown.tilt, 10, 0.5, 'real asymmetry must be reported close to its true 10 degree magnitude');
});

// ================================================================
// 5. computeStability's raw (non-circular) std-dev gate: documents why
//    aggregateBuffer's plain numeric median() cannot silently corrupt
//    a FINALIZED live scan's tiltCorrected reading even though it is
//    not itself circular-aware — a buffer whose raw per-frame
//    tiltCorrected values genuinely straddle the +/-180 seam in a
//    bimodal way fails this gate loudly (never finalizes) rather than
//    producing a wrong result.
// ================================================================
test('7. a buffer whose RAW per-frame tiltCorrected values straddle the +/-180 seam in a bimodal way fails the stability gate (never finalizes) instead of silently aggregating to a wrong value', () => {
  const buffer = [];
  for (let i = 0; i < 12; i++) {
    const near = i % 2 === 0 ? 179.5 : -179.5; // physically ~1 degree apart, but straddles the seam
    buffer.push({
      leftMetrics: frameMetrics(-5), rightMetrics: frameMetrics(near),
      headPose: { interEyeDistance: 65, roll: 0 }, faceBoxWidth: 220, verticalAsymRaw: 0,
    });
  }
  const stability = computeStability(buffer);
  assert.strictEqual(stability.stable, false, 'a seam-straddling buffer must fail the (non-circular) stability gate rather than finalize on a corrupted median');
});

// ================================================================
// 6. Source-guard (task item 3): Live Scan and Photo Analysis share
//    the exact same classifyFeatures function — no duplicate/second
//    branch exists for either screen's tilt computation.
// ================================================================
test('8. exactly one classifyFeatures DEFINITION exists in index.html (no duplicate/stale branch)', () => {
  const defs = src.match(/function classifyFeatures\(aggregated, opts\)/g) || [];
  assert.strictEqual(defs.length, 1, `expected exactly 1 classifyFeatures definition, found ${defs.length}`);
});

test('9. exactly one asymmetryBreakdown.tilt FORMULA exists in index.html — both LiveScanScreen and PhotoAnalysisScreen flow through the same classifyFeatures call, not separate implementations', () => {
  const occurrences = src.match(/tilt: shortestAngleDiffDeg\(left\.tiltCorrected, mirrorReflectDeg\(right\.tiltCorrected\)\),/g) || [];
  assert.strictEqual(occurrences.length, 1, `expected exactly 1 occurrence of the tilt formula, found ${occurrences.length}`);
});

test('10. LiveScanScreen calls classifyFeatures on aggregateBuffer(bufferRef.current) (the real multi-frame buffer)', () => {
  assert.ok(src.includes('const aggregated = aggregateBuffer(bufferRef.current);'));
  assert.ok(src.includes('const classified = classifyFeatures(aggregated, { singleFrame: false, stability, imageQuality });'));
});

test('11. PhotoAnalysisScreen calls the SAME classifyFeatures, via the SAME aggregateBuffer, on its single-frame-triple ([frame, frame, frame]) — structurally different buffer construction, identically shared classification function', () => {
  assert.ok(src.includes('const aggregated = aggregateBuffer([frame, frame, frame]);'), 'Photo Analysis must still build its aggregated object via aggregateBuffer (shared code), just with a trivial 3x-same-frame buffer');
  assert.ok(src.includes('classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality });'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
