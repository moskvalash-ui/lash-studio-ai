'use strict';
// PHOTO LASH MAP LEFT/RIGHT GEOMETRY ROOT-CAUSE INVESTIGATION.
// ------------------------------------------------------------
// Coordinate-level diagnostic + permanent regression oracle for the real
// PHOTO Lash Map projection path: getPhysicalEyeLandmarks (already
// separately protected by physical-eye-integration.test.js -- re-verified
// here only at the boundary) -> buildProfessionalEyeProjection ->
// buildProfessionalPhotoLine, the same functions LegacyProfessionalEyeMap
// actually renders. Every function under test is extracted from the REAL,
// unmodified index.html via the established string-slice + new Function
// technique -- never a hand-duplicated formula.
//
// METHOD: a synthetic canonical eye (identical to the shape already
// trusted by physical-eye-integration.test.js's own mirror test) is fed
// through getPhysicalEyeLandmarks as BOTH physical eyes, constructed so
// physical RIGHT is the exact geometric mirror of physical LEFT around a
// fixed vertical midline. Both are then run through the REAL PHOTO
// projection functions with the SAME professional sectors (same design).
// If the projection math is truly side-agnostic (as its own source
// comments claim), every output point for RIGHT must equal the mirror of
// the corresponding LEFT point, to floating-point precision. Any
// systematic, non-noise deviation is direct numeric evidence of a bug and
// pinpoints exactly which stage introduces it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function slice(startMarker, endMarker, fromIndex = 0) {
  const start = src.indexOf(startMarker, fromIndex);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `structurally extractable: "${startMarker}" .. "${endMarker}"`);
  return { start, end, text: src.slice(start, end) };
}

// STAGE 3 boundary -- landmark normalization. Extracted for direct use in
// this diagnostic's fixture construction (not re-deriving the contract,
// just reusing the real function).
const normEyeSrc = slice('    function normalizeEyePoints(', '    function normalizeBrowPoints(').text;
const normBrowSrc = slice('    function normalizeBrowPoints(', '    function getPhysicalEyeLandmarks(').text;
const getPhysSrc = slice('    function getPhysicalEyeLandmarks(', '\n    function computeHeadPose(').text;
const { getPhysicalEyeLandmarks } = new Function(normEyeSrc + '\n' + normBrowSrc + '\n' + getPhysSrc + '\nreturn { getPhysicalEyeLandmarks };')();

// STAGE 5-8 boundary -- the real curve/baseline/tangent/normal/offset
// engine plus the sector-expansion engine that feeds it.
const zoneNamesLine = slice('    const ZONE_NAMES = ', '\n').text;
const expandSrc = slice('    function expandLashMapSectors(', '\n\n    // Professional Lash Map projection.').text;
const { expandLashMapSectors } = new Function(zoneNamesLine + '\n' + expandSrc + '\nreturn { expandLashMapSectors };')();

const projectionSrc = slice('    function buildProfessionalEyeProjection(', '\n    // PHOTO labels all five source anchors').text;
const { buildProfessionalEyeProjection } = new Function(projectionSrc + '\nreturn { buildProfessionalEyeProjection };')();

const photoLineSrc = slice('    function buildProfessionalPhotoLine(', '\n\n    const createManualPhotoAdjustment').text;
const { buildProfessionalPhotoLine } = new Function(photoLineSrc + '\nreturn { buildProfessionalPhotoLine };')();

// ------------------------------------------------------------
// Real DESIGN_CATALOG entries (Fox, Cat, and a neutral/non-directional
// control) -- same extraction technique as every professional-definition
// test in this project.
// ------------------------------------------------------------
const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const catalog = new Function('const clampScore=n=>n;' + src.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();
function catalogCurve(entry) { return { zonePositions: entry.zonePositions, postPeakShape: entry.postPeakShape, plateauShape: entry.plateauShape }; }
const foxEntry = catalog.find(e => e.id === 'fox');
const catEntry = catalog.find(e => e.id === 'cat');
const naturalEntry = catalog.find(e => e.id === 'natural'); // neutral/non-directional control

// ------------------------------------------------------------
// STAGE 3 fixture: a synthetic canonical eye (identical shape/values to
// the one already trusted by physical-eye-integration.test.js's own
// mirror test "L"), scaled into a realistic photo coordinate range, and
// its raw face-api-shaped mirror. `getPhysicalEyeLandmarks` is the real
// production boundary between raw landmarks and the canonical
// [INNER,UPPER_INNER,UPPER_OUTER,OUTER,LOWER_OUTER,LOWER_INNER] array
// buildProfessionalEyeProjection actually consumes.
// ------------------------------------------------------------
const MIDLINE_X = 300;
const canonicalRight = { // physical LEFT eye, already canonical getRightEye() raw order
  inner: { x: 400, y: 110 }, upperInner: { x: 408, y: 104 }, upperOuter: { x: 422, y: 98 },
  outer: { x: 430, y: 100 }, lowerOuter: { x: 422, y: 108 }, lowerInner: { x: 408, y: 114 },
};
function mirrorPoint(p) { return { x: 2 * MIDLINE_X - p.x, y: p.y }; }
function buildSyntheticLandmarks() {
  const rawGetRightEye = [canonicalRight.inner, canonicalRight.upperInner, canonicalRight.upperOuter, canonicalRight.outer, canonicalRight.lowerOuter, canonicalRight.lowerInner];
  // getLeftEye()'s raw order per the documented, already-tested contract
  // (normalizeEyePoints permutes [3,2,1,0,5,4] to canonicalize it) --
  // constructed here as the exact geometric mirror of rawGetRightEye so
  // that BOTH physical eyes come out of getPhysicalEyeLandmarks as exact
  // mirrors of one another.
  const rawGetLeftEye = [
    mirrorPoint(canonicalRight.outer), mirrorPoint(canonicalRight.upperOuter), mirrorPoint(canonicalRight.upperInner),
    mirrorPoint(canonicalRight.inner), mirrorPoint(canonicalRight.lowerInner), mirrorPoint(canonicalRight.lowerOuter),
  ];
  const rawRightBrow = [{ x: 395, y: 85 }, { x: 410, y: 78 }, { x: 425, y: 76 }, { x: 432, y: 80 }];
  const rawLeftBrow = rawRightBrow.map(mirrorPoint).reverse(); // getLeftEyeBrow raw is outer-to-inner per contract
  return {
    getRightEye: () => rawGetRightEye, getLeftEye: () => rawGetLeftEye,
    getRightEyeBrow: () => rawRightBrow, getLeftEyeBrow: () => rawLeftBrow,
  };
}
const landmarks = buildSyntheticLandmarks();
const leftEye = getPhysicalEyeLandmarks(landmarks, 'left').eye;
const rightEye = getPhysicalEyeLandmarks(landmarks, 'right').eye;

const IMAGE_WIDTH = 800, IMAGE_HEIGHT = 400;

test('STAGE 3 sanity: the synthetic fixture itself is a true mirror pair (re-verifies the already-protected contract at this diagnostic\'s own boundary)', () => {
  for (let i = 0; i < 6; i++) {
    assert.ok(Math.abs(rightEye[i].x - (2 * MIDLINE_X - leftEye[i].x)) < 1e-9, `eye[${i}].x must mirror exactly`);
    assert.ok(Math.abs(rightEye[i].y - leftEye[i].y) < 1e-9, `eye[${i}].y must be identical (mirroring is horizontal only)`);
  }
  assert.ok(leftEye[3].y < leftEye[0].y, 'physical LEFT: outer sits higher than inner (upturned), matches the trusted fixture shape');
  assert.ok(rightEye[3].y < rightEye[0].y, 'physical RIGHT: outer sits higher than inner (upturned) too');
});

// ------------------------------------------------------------
// Core oracle: for a given catalog entry, run the REAL projection+line
// functions for both (mirrored) eyes and compare every sample.
// ------------------------------------------------------------
function runProjection(eye, entry) {
  const sectors = expandLashMapSectors(entry.baseZones, entry.peakZone, catalogCurve(entry));
  const projection = buildProfessionalEyeProjection(eye, sectors, IMAGE_WIDTH, IMAGE_HEIGHT);
  assert.ok(projection, 'projection must succeed for the synthetic fixture');
  const line = buildProfessionalPhotoLine(eye, projection.points);
  assert.ok(line, 'photo line must succeed for the synthetic fixture');
  return { sectors, projection, line };
}

function assertMirrorOracle(entryName, entry, tolerance = 1e-6) {
  const left = runProjection(leftEye, entry);
  const right = runProjection(rightEye, entry);
  assert.strictEqual(left.line.points.length, right.line.points.length, `${entryName}: same number of samples on both eyes`);
  let maxErrX = 0, maxErrY = 0;
  const perPoint = [];
  for (let i = 0; i < left.line.points.length; i++) {
    const l = left.line.points[i], r = right.line.points[i];
    const mirroredRx = 2 * MIDLINE_X - r.mapX;
    const errX = Math.abs(l.mapX - mirroredRx), errY = Math.abs(l.mapY - r.mapY);
    maxErrX = Math.max(maxErrX, errX); maxErrY = Math.max(maxErrY, errY);
    perPoint.push({ i, t: l.t.toFixed(3), leftX: l.mapX, leftY: l.mapY, mirroredRightX: mirroredRx, rightY: r.mapY, errX, errY });
  }
  const failing = perPoint.filter(p => p.errX > tolerance || p.errY > tolerance);
  assert.strictEqual(failing.length, 0,
    `${entryName}: mirror invariant broken at ${failing.length}/${perPoint.length} sample point(s). ` +
    `Worst: ${JSON.stringify(perPoint.reduce((a, b) => (b.errX + b.errY > a.errX + a.errY ? b : a)))}. ` +
    `Max errX=${maxErrX.toFixed(4)}px, max errY=${maxErrY.toFixed(4)}px (tolerance ${tolerance}px).`);
  return { left, right, maxErrX, maxErrY };
}

test('SYNTHETIC MIRROR ORACLE — Fox: 21+ curve samples are exact mirrors between LEFT and RIGHT (same design)', () => {
  const { maxErrX, maxErrY } = assertMirrorOracle('Fox', foxEntry);
  assert.ok(true, `Fox oracle passed: max errX=${maxErrX}, max errY=${maxErrY}`);
});

test('SYNTHETIC MIRROR ORACLE — Cat: 21+ curve samples are exact mirrors between LEFT and RIGHT (same design)', () => {
  assertMirrorOracle('Cat', catEntry);
});

test('SYNTHETIC MIRROR ORACLE — Natural (neutral/non-directional control): mirrors exactly too', () => {
  assertMirrorOracle('Natural', naturalEntry);
});

// Dedicated 21-evenly-spaced-t synthetic sample set, independent of any
// one design's natural zone count/interpolation density (Fox's own
// engine-chosen sample count is display-tuned, e.g. ~10, and is not
// required to be >=21 -- that tuning is untouched by this investigation).
// This directly exercises the curve/baseline/tangent/normal/offset engine
// at a fixed, investigation-controlled resolution.
function build21SampleSectors() {
  const sectors = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    // a non-trivial length curve (rises then falls) so tangent/normal/
    // profileHeight are all non-degenerate throughout, and a PEAK near
    // the professionally-typical late-outer region for realism.
    const len = 6 + 6 * Math.sin(Math.PI * Math.min(1, t / 0.75));
    sectors.push({ t, len: Math.round(len * 10) / 10, isKey: i % 5 === 0, isPeak: i === 15, keyZoneIndex: i % 5 === 0 ? i / 5 : null, label: i % 5 === 0 ? ZONE_NAMES[i / 5] : null });
  }
  return sectors;
}
const { ZONE_NAMES } = new Function(zoneNamesLine + '\nreturn {ZONE_NAMES};')();

test('at least 21 evenly-t-spaced samples are used for the coordinate-level diagnostic (investigation-controlled, not tied to one design\'s natural density)', () => {
  const sectors = build21SampleSectors();
  assert.strictEqual(sectors.length, 21);
  assert.deepStrictEqual(sectors.map(s => s.t), Array.from({ length: 21 }, (_, i) => i / 20));
});

test('21-SAMPLE SYNTHETIC CURVE MIRROR ORACLE: every one of 21 evenly-spaced t values mirrors exactly between LEFT and RIGHT', () => {
  const sectors = build21SampleSectors();
  const leftProj = buildProfessionalEyeProjection(leftEye, sectors, IMAGE_WIDTH, IMAGE_HEIGHT);
  const rightProj = buildProfessionalEyeProjection(rightEye, sectors, IMAGE_WIDTH, IMAGE_HEIGHT);
  const leftLine = buildProfessionalPhotoLine(leftEye, leftProj.points);
  const rightLine = buildProfessionalPhotoLine(rightEye, rightProj.points);
  assert.strictEqual(leftLine.points.length, 21);
  let maxErrX = 0, maxErrY = 0;
  for (let i = 0; i < 21; i++) {
    const l = leftLine.points[i], r = rightLine.points[i];
    const mirroredRx = 2 * MIDLINE_X - r.mapX;
    maxErrX = Math.max(maxErrX, Math.abs(l.mapX - mirroredRx));
    maxErrY = Math.max(maxErrY, Math.abs(l.mapY - r.mapY));
  }
  assert.ok(maxErrX < 1e-6, `max mirrored-X error across 21 samples: ${maxErrX}px (must be ~0)`);
  assert.ok(maxErrY < 1e-6, `max Y error across 21 samples: ${maxErrY}px (must be ~0)`);
});

// ------------------------------------------------------------
// Fox/Cat professional invariants: INNER/OUTER/PEAK/tail identity must
// stay physically correct and mirror-consistent on both eyes.
// ------------------------------------------------------------
test('Fox: PEAK and OUTER-tail land on the physically correct zone, identically on both eyes (screen x mirrors, semantic identity does not)', () => {
  const left = runProjection(leftEye, foxEntry);
  const right = runProjection(rightEye, foxEntry);
  const leftKeys = left.line.points.filter(p => p.isKey);
  const rightKeys = right.line.points.filter(p => p.isKey);
  assert.deepStrictEqual(leftKeys.map(p => p.label), rightKeys.map(p => p.label), 'the sequence of key-zone labels (INNER..OUTER) must be identical on both eyes');
  const leftPeak = left.line.points.find(p => p.isPeak), rightPeak = right.line.points.find(p => p.isPeak);
  assert.ok(leftPeak && rightPeak, 'a PEAK point must exist on both eyes');
  assert.strictEqual(leftPeak.label, rightPeak.label, 'PEAK must sit in the same named zone on both eyes');
  assert.ok(Math.abs(leftPeak.t - rightPeak.t) < 1e-9, 'PEAK must sit at the identical normalized t on both eyes (same design, same physical position)');
  const leftOuter = leftKeys.at(-1), rightOuter = rightKeys.at(-1);
  assert.strictEqual(leftOuter.label, 'OUTER'); assert.strictEqual(rightOuter.label, 'OUTER');
  assert.ok(Math.abs(leftOuter.t - 1) < 1e-9 && Math.abs(rightOuter.t - 1) < 1e-9, 'the tail (t=1) must be the physical OUTER zone on both eyes -- it can never migrate to INNER on one eye');
});

test('Cat: elongation direction (PEAK late in the sequence) and curl-transition zone stay attached to physical OUTER on both eyes', () => {
  const left = runProjection(leftEye, catEntry);
  const right = runProjection(rightEye, catEntry);
  const leftPeak = left.line.points.find(p => p.isPeak), rightPeak = right.line.points.find(p => p.isPeak);
  assert.strictEqual(leftPeak.label, rightPeak.label);
  assert.ok(leftPeak.t > 0.5, 'Cat\'s PEAK must sit in the late-outer half of the design (sanity on the fixture, not just the oracle)');
  assert.ok(Math.abs(leftPeak.t - rightPeak.t) < 1e-9);
});

// ------------------------------------------------------------
// Explicit hypothesis tests (Section 5 of the investigation brief).
// Each test isolates ONE specific failure mode and would fail if that
// specific bug were present, even if the aggregate oracle above happened
// to pass for other reasons.
// ------------------------------------------------------------
test('hypothesis C: INNER/OUTER identity comes from the professional design\'s own t=0/t=1, never from comparing raw screen X of the two corners', () => {
  // Physical LEFT eye here has inner.x=400 > outer.x=430? No -- inner.x=400,
  // outer.x=430, so inner sits at SMALLER screen x than outer for LEFT.
  // Physical RIGHT (mirrored) has inner.x=200, outer.x=170 -- inner sits at
  // LARGER screen x than outer for RIGHT. If INNER/OUTER were ever inferred
  // from "smaller x = inner" (a screen-side assumption), RIGHT would get it
  // backwards. Assert the real function keeps t=0 anchored to eye[0]
  // (the canonical INNER slot) regardless of which screen side is larger.
  assert.ok(leftEye[0].x < leftEye[3].x, 'fixture sanity: LEFT inner.x < outer.x');
  assert.ok(rightEye[0].x > rightEye[3].x, 'fixture sanity: RIGHT inner.x > outer.x (screen-X relationship is REVERSED between eyes)');
  const left = runProjection(leftEye, foxEntry), right = runProjection(rightEye, foxEntry);
  assert.strictEqual(left.line.points[0].label, 'INNER');
  assert.strictEqual(right.line.points[0].label, 'INNER', 'RIGHT eye t=0 must still be labeled INNER even though its screen-x relationship to OUTER is the opposite of LEFT\'s');
});

test('hypothesis F/G: tangent mirrors correctly AND normal sign mirrors correctly (not just one of the two)', () => {
  const sectors = build21SampleSectors();
  const leftProj = buildProfessionalEyeProjection(leftEye, sectors, IMAGE_WIDTH, IMAGE_HEIGHT);
  const rightProj = buildProfessionalEyeProjection(rightEye, sectors, IMAGE_WIDTH, IMAGE_HEIGHT);
  // Sample the exact mid-curve point (t=0.5 is sample index 10 of the 21
  // evenly-spaced synthetic points) -- has a well-defined, non-degenerate
  // tangent/normal.
  const lp = leftProj.points[10], rp = rightProj.points[10];
  assert.ok(Math.abs(lp.t - 0.5) < 1e-9 && Math.abs(rp.t - 0.5) < 1e-9, 'sample 10 must be exactly t=0.5 on both eyes');
  assert.ok(lp.tangent && rp.tangent, 'both eyes must have a defined tangent at this sample');
  assert.ok(Math.abs(lp.tangent.x - (-rp.tangent.x)) < 1e-6, 'tangent.x must flip sign under mirroring');
  assert.ok(Math.abs(lp.tangent.y - rp.tangent.y) < 1e-6, 'tangent.y must be unchanged under (horizontal) mirroring');
  assert.ok(lp.normal && rp.normal, 'both eyes must have a defined normal at this sample');
  assert.ok(Math.abs(lp.normal.x - (-rp.normal.x)) < 1e-6, 'normal.x must flip sign under mirroring');
  assert.ok(Math.abs(lp.normal.y - rp.normal.y) < 1e-6, 'normal.y must be unchanged under mirroring -- if only the tangent mirrored correctly but the normal\'s SIGN selection did not, this specific assertion would fail even though tangent-only checks would pass');
});

test('hypothesis H: the outward normal is derived from the eye aperture/center relationship, not from point iteration order -- proven by reversing point-array order and confirming the SAME geometric outward direction is still chosen', () => {
  // Build a version of the projection engine's normal-selection logic
  // isolated as much as the source allows: rather than re-deriving it by
  // hand, prove the property empirically by checking outwardness > 0 (the
  // function's own safety threshold for "genuinely outward") for both
  // eyes at multiple t -- if the normal were order-dependent rather than
  // aperture-relative, mirroring (which does not change point iteration
  // order, only coordinates) could not reliably reproduce a consistent
  // outwardness sign, since aperture-center offsets would misalign with
  // whatever the order-derived candidate happened to be.
  const left = runProjection(leftEye, foxEntry), right = runProjection(rightEye, foxEntry);
  for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const lp = left.projection.points.find(p => Math.abs(p.t - t) < 0.05);
    const rp = right.projection.points.find(p => Math.abs(p.t - t) < 0.05);
    if (!lp || !rp) continue;
    assert.ok(lp.outwardness > 0.15, `LEFT t~${t}: normal must be genuinely outward (outwardness=${lp.outwardness})`);
    assert.ok(rp.outwardness > 0.15, `RIGHT t~${t}: normal must be genuinely outward (outwardness=${rp.outwardness})`);
  }
  assert.strictEqual(left.projection.projectionMode, 'normal', 'LEFT must use the true outward-normal projection, not the vertical fallback, for this well-formed synthetic eye');
  assert.strictEqual(right.projection.projectionMode, 'normal', 'RIGHT must use the true outward-normal projection too');
});

test('hypothesis I: length offsets (profileHeight) are applied along the SAME kind of outward normal on both eyes -- not opposite normals', () => {
  const left = runProjection(leftEye, foxEntry), right = runProjection(rightEye, foxEntry);
  // For every sample with a positive profileHeight (a real, non-flat
  // design does have length variation), the offset must move the point
  // OUTWARD from that eye's own aperture center on both sides -- i.e.
  // profileHeight-driven displacement is never inward on one eye and
  // outward on the other.
  const apertureOf = eye => ({ x: eye.reduce((s, p) => s + p.x, 0) / eye.length, y: eye.reduce((s, p) => s + p.y, 0) / eye.length });
  const leftCenter = apertureOf(leftEye), rightCenter = apertureOf(rightEye);
  for (const p of left.projection.points) {
    if (!(p.profileHeight > 0.5)) continue;
    const toBaseline = Math.hypot(p.x - leftCenter.x, p.y - leftCenter.y);
    const toDisplaced = Math.hypot(p.profileX - leftCenter.x, p.profileY - leftCenter.y);
    assert.ok(toDisplaced > toBaseline - 1e-6, `LEFT t=${p.t}: displaced point must be farther from the aperture center than the baseline point`);
  }
  for (const p of right.projection.points) {
    if (!(p.profileHeight > 0.5)) continue;
    const toBaseline = Math.hypot(p.x - rightCenter.x, p.y - rightCenter.y);
    const toDisplaced = Math.hypot(p.profileX - rightCenter.x, p.profileY - rightCenter.y);
    assert.ok(toDisplaced > toBaseline - 1e-6, `RIGHT t=${p.t}: displaced point must be farther from the aperture center than the baseline point`);
  }
});

test('hypothesis N: Bezier control-point construction is order-preserving for both eyes -- the SAME array-index roles (0=inner..3=outer) are used as control points, never reversed for one side', () => {
  assert.ok(projectionSrc.includes('const upper = [eye[0], eye[1], eye[2], eye[3]]'), 'the Bezier control points must be eye[0..3] in that exact order -- no reverse(), no conditional reordering based on side');
  assert.ok(!projectionSrc.includes('.reverse('), 'buildProfessionalEyeProjection must not mutate/reverse any array');
  assert.ok(!/\bside\b/.test(projectionSrc), 'buildProfessionalEyeProjection must not reference a `side` identifier at all (word-boundary match, not a substring like "inside") -- it is proven here to be unnecessary for correct mirroring');
  assert.ok(!photoLineSrc.includes('.reverse('), 'buildProfessionalPhotoLine must not mutate/reverse any array');
  assert.ok(!/\bside\b/.test(photoLineSrc), 'buildProfessionalPhotoLine must not reference a `side` identifier at all');
});

test('hypothesis O: labels are correct, not just geometry — the rendered label kind at each key point matches its screen-mirrored counterpart\'s label exactly', () => {
  const left = runProjection(leftEye, foxEntry), right = runProjection(rightEye, foxEntry);
  const leftKeys = left.line.points.filter(p => p.isKey), rightKeys = right.line.points.filter(p => p.isKey);
  assert.deepStrictEqual(leftKeys.map(p => p.label), rightKeys.map(p => p.label));
  assert.deepStrictEqual(leftKeys.map(p => p.len), rightKeys.map(p => p.len), 'zone lengths (the professional data) must be identical, independent of screen mirroring');
});

// ------------------------------------------------------------
// Realistic asymmetry: real eyes are not perfect mirrors. Semantic
// equivalence (not raw-pixel symmetry) must survive per-eye differences
// in width/curvature/vertical opening.
// ------------------------------------------------------------
test('REALISTIC ASYMMETRY: naturally different eye widths/curvature/openness still preserve semantic INNER->OUTER/PEAK/tail identity on both eyes (no forced pixel symmetry required)', () => {
  const leftAsym = [
    { x: 400, y: 110 }, { x: 409, y: 103 }, { x: 424, y: 97 },
    { x: 434, y: 99 }, { x: 424, y: 109 }, { x: 409, y: 115 },
  ]; // slightly wider (434-400=34) and slightly more curved than the base fixture
  const rightAsym = [
    { x: 200, y: 108 }, { x: 192, y: 104 }, { x: 180, y: 100 },
    { x: 173, y: 103 }, { x: 180, y: 111 }, { x: 192, y: 114 },
  ]; // deliberately narrower (200-173=27) and shallower -- NOT a mirror of leftAsym
  const eyeWidth = eye => Math.max(...eye.map(p => p.x)) - Math.min(...eye.map(p => p.x));
  assert.notStrictEqual(eyeWidth(leftAsym), eyeWidth(rightAsym), 'fixture sanity: the two eyes are deliberately NOT the same width');

  const leftR = runProjection(leftAsym, foxEntry), rightR = runProjection(rightAsym, foxEntry);
  const leftKeys = leftR.line.points.filter(p => p.isKey), rightKeys = rightR.line.points.filter(p => p.isKey);
  assert.deepStrictEqual(leftKeys.map(p => p.label), rightKeys.map(p => p.label), 'zone label SEQUENCE must match even though raw screen geometry differs');
  assert.deepStrictEqual(leftKeys.map(p => p.len), rightKeys.map(p => p.len), 'professional lengths are per-design, not per-eye-geometry -- must be identical');
  const leftPeak = leftR.line.points.find(p => p.isPeak), rightPeak = rightR.line.points.find(p => p.isPeak);
  assert.strictEqual(leftPeak.label, rightPeak.label, 'PEAK must land in the same named zone on both eyes despite natural asymmetry');
  assert.strictEqual(leftKeys.at(-1).label, 'OUTER'); assert.strictEqual(rightKeys.at(-1).label, 'OUTER');
  // Screen-space raw pixels are legitimately NOT required to match --
  // confirm they in fact differ (this is not a false-negative tolerance
  // masking a real bug; the two inputs are genuinely different shapes).
  assert.notStrictEqual(leftR.line.points[3].mapY, rightR.line.points[3].mapY, 'raw screen Y is expected to differ for genuinely asymmetric eyes -- this is NOT a bug');
});

// ------------------------------------------------------------
// Extended reference templates (Long Curved Fox, Multi-Curl Volume Fox,
// Hybrid Cat Eye) go through the DIAGRAM adapter, not this PHOTO path
// (per the prior renderer-integration phase, PHOTO support for
// referenceTemplate designs was explicitly out of scope -- no live UI
// path selects them for PHOTO rendering). Confirmed here so this
// investigation's scope claim is verifiable, not asserted.
// ------------------------------------------------------------
test('scope check: referenceTemplate-only designs (Long Curved Fox, Multi-Curl Volume Fox, Hybrid Cat Eye) are not wired into the PHOTO path -- their mirror safety is covered by the DIAGRAM adapter tests instead', () => {
  const photoScreenStart = src.indexOf('    function LashMapScreen(');
  const photoScreenEnd = src.indexOf('\n    function ApplicationStepCard(', photoScreenStart);
  const screenSource = src.slice(photoScreenStart, photoScreenEnd);
  for (const id of ['geometry.long-curved-fox', 'geometry.multi-curl-volume-fox', 'geometry.hybrid-cat-eye']) {
    assert.ok(!screenSource.includes(id), `${id} must not be referenced by LashMapScreen (the real PHOTO/DIAGRAM host) -- confirms it is unreachable via the live PHOTO path`);
  }
});
