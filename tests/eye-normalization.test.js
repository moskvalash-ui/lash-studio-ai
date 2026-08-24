// ============================================================
// EYE NORMALIZATION CONTRACT — proof-of-concept, NOT wired into
// runtime code. index.html does not require or reference this file.
// ------------------------------------------------------------
// Proves the exact permutation needed to turn face-api.js's raw
// getLeftEye()/getRightEye()/getLeftEyeBrow()/getRightEyeBrow()
// output into one canonical, physical-side-correct representation:
//
//   physicalSide = 'left' | 'right'
//   canonical eye  = [INNER_CORNER, UPPER_INNER, UPPER_OUTER,
//                     OUTER_CORNER, LOWER_OUTER, LOWER_INNER]
//   canonical brow = [INNER_END, mid, CENTER, mid, OUTER_END]
//
// Facts this file's assertions depend on (proven empirically this
// session against face-api.js@0.22.2, 3 independent real photos,
// using each photo's own nose-centroid as an independent inner/
// outer reference — see the audit conversation for the full method
// and per-photo tables; the raw fixture below is one of those three
// captures, happy.jpg, kept verbatim):
//
//   getLeftEye() (indices 36-41)  = image-left cluster  = physical
//     RIGHT eye. Raw point roles: [0]=OUTER corner, [1]=upper/near-
//     outer, [2]=upper/near-inner, [3]=INNER corner, [4]=lower/
//     near-inner, [5]=lower/near-outer.
//   getRightEye() (indices 42-47) = image-right cluster = physical
//     LEFT eye. Raw point roles: [0]=INNER corner, [1]=upper/near-
//     inner, [2]=upper/near-outer, [3]=OUTER corner, [4]=lower/
//     near-outer, [5]=lower/near-inner.
//   getRightEye()'s raw order is therefore ALREADY canonical
//   (identity permutation) — it happens to match the standard
//   Soukupová-Čech EAR 6-point layout (P1..P6 = corner, upper,
//   upper, corner, lower, lower) exactly, corner-for-corner.
//   getLeftEye() is the SAME anatomical layout starting from the
//   opposite corner — NOT a plain reverse (that would scramble
//   which lower point pairs with which upper point). The point-for-
//   point correspondence that preserves upper/lower pairing is:
//     canonical = [raw[3], raw[2], raw[1], raw[0], raw[5], raw[4]]
//   (self-inverse: applying it twice returns the original array.)
//
//   getLeftEyeBrow() (17-21)  = outer-to-inner (raw[0] farthest from
//     nose, raw[4] nearest). getRightEyeBrow() (22-26) = inner-to-
//     outer already (raw[0] nearest to nose). Brows have no upper/
//     lower structure to preserve, so a plain reverse is correct
//     (and sufficient) for getLeftEyeBrow() only.
// ============================================================
const assert = require('assert');

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
function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${a} ~= ${b} (eps=${eps})`);
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---- The proposed normalization boundary (prototype only) ----
function normalizeEyePoints(raw, source) {
  if (source === 'getRightEye') return raw.slice();
  if (source === 'getLeftEye') return [raw[3], raw[2], raw[1], raw[0], raw[5], raw[4]];
  throw new Error('unknown eye source: ' + source);
}
function normalizeBrowPoints(raw, source) {
  if (source === 'getRightEyeBrow') return raw.slice();
  if (source === 'getLeftEyeBrow') return raw.slice().reverse();
  throw new Error('unknown brow source: ' + source);
}
// Conceptual boundary API (PART 3). `landmarks` is anything exposing
// the same 4 face-api getter methods (duck-typed — a real
// FaceLandmarks68 instance works unchanged). Preview CSS mirroring
// never enters this function at all: it only ever reads from
// `landmarks`, which is built from the raw, un-mirrored processing
// canvas upstream — there is no code path here that could be
// affected by the <video> element's CSS transform.
function getPhysicalEyeLandmarks(landmarks, physicalSide) {
  if (physicalSide === 'left') {
    return {
      eye: normalizeEyePoints(landmarks.getRightEye(), 'getRightEye'),
      brow: normalizeBrowPoints(landmarks.getRightEyeBrow(), 'getRightEyeBrow'),
    };
  }
  if (physicalSide === 'right') {
    return {
      eye: normalizeEyePoints(landmarks.getLeftEye(), 'getLeftEye'),
      brow: normalizeBrowPoints(landmarks.getLeftEyeBrow(), 'getLeftEyeBrow'),
    };
  }
  throw new Error('unknown physicalSide: ' + physicalSide);
}

// ---- Real fixture — face-api.js@0.22.2 detectSingleFace().withFaceLandmarks()
// on face-api.js's own bundled examples/images/happy.jpg, captured live
// in-browser during this audit (unpkg CDN, same version this project loads). ----
const FIXTURE = {
  getLeftEye: [
    { x: 275.54, y: 117.67 }, { x: 280.39, y: 113.50 }, { x: 289.77, y: 112.07 },
    { x: 298.71, y: 114.85 }, { x: 291.39, y: 118.62 }, { x: 282.11, y: 119.32 },
  ],
  getRightEye: [
    { x: 338.11, y: 109.02 }, { x: 345.56, y: 103.47 }, { x: 355.32, y: 102.54 },
    { x: 363.55, y: 105.56 }, { x: 356.05, y: 109.17 }, { x: 346.06, y: 109.48 },
  ],
  getLeftEyeBrow: [
    { x: 260.50, y: 105.11 }, { x: 265.60, y: 96.24 }, { x: 275.41, y: 91.03 },
    { x: 285.66, y: 89.48 }, { x: 295.30, y: 91.47 },
  ],
  getRightEyeBrow: [
    { x: 330.96, y: 86.44 }, { x: 340.92, y: 81.79 }, { x: 352.32, y: 79.24 },
    { x: 366.33, y: 81.08 }, { x: 377.81, y: 88.10 },
  ],
  noseCenter: { x: 317.51, y: 140.01 },
};
const fakeLandmarks = {
  getLeftEye: () => FIXTURE.getLeftEye,
  getRightEye: () => FIXTURE.getRightEye,
  getLeftEyeBrow: () => FIXTURE.getLeftEyeBrow,
  getRightEyeBrow: () => FIXTURE.getRightEyeBrow,
};

// ================================================================
// A/B — physical side maps to the correct raw face-api source
// ================================================================
test('A. physicalSide=left reads from getRightEye/getRightEyeBrow (physical left eye)', () => {
  const result = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  // getRightEye's raw order is already canonical (identity) — the
  // returned eye array must be exactly the raw getRightEye fixture.
  assert.deepStrictEqual(result.eye, FIXTURE.getRightEye);
  assert.deepStrictEqual(result.brow, FIXTURE.getRightEyeBrow);
});

test('B. physicalSide=right reads from getLeftEye/getLeftEyeBrow (physical right eye)', () => {
  const result = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  // getLeftEye needs the [3,2,1,0,5,4] permutation; brow needs a reverse.
  assert.deepStrictEqual(result.eye, [
    FIXTURE.getLeftEye[3], FIXTURE.getLeftEye[2], FIXTURE.getLeftEye[1],
    FIXTURE.getLeftEye[0], FIXTURE.getLeftEye[5], FIXTURE.getLeftEye[4],
  ]);
  assert.deepStrictEqual(result.brow, FIXTURE.getLeftEyeBrow.slice().reverse());
});

// ================================================================
// C/D — canonical index 0 is INNER, index 3 is OUTER, for BOTH eyes
// (checked against an independent reference: distance to the
// fixture's own nose centroid — not against the permutation's own
// logic, so this is a real check, not a tautology)
// ================================================================
function nearerToNose(p, q) { return dist(p, FIXTURE.noseCenter) < dist(q, FIXTURE.noseCenter) ? p : q; }

test('C. canonical[0] is the corner nearer the nose (INNER) for physical LEFT eye', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'left'); // physical left -> getRightEye source
  assert.deepStrictEqual(nearerToNose(eye[0], eye[3]), eye[0], 'canonical[0] should be nearer to the nose than canonical[3]');
});
test('C2. canonical[0] is the corner nearer the nose (INNER) for physical RIGHT eye', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'right'); // physical right -> getLeftEye source
  assert.deepStrictEqual(nearerToNose(eye[0], eye[3]), eye[0]);
});
test('D. canonical[3] is the corner farther from the nose (OUTER) for physical LEFT eye', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  assert.deepStrictEqual(nearerToNose(eye[0], eye[3]), eye[0]);
  assert.notDeepStrictEqual(eye[3], nearerToNose(eye[0], eye[3]));
});
test('D2. canonical[3] is the corner farther from the nose (OUTER) for physical RIGHT eye', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  assert.notDeepStrictEqual(eye[3], nearerToNose(eye[0], eye[3]));
});

// ================================================================
// E/F — upper-lid points stay upper, lower-lid points stay lower
// (independent reference: raw Y-coordinate — smaller Y = higher on
// screen = upper lid, for both raw fixtures)
// ================================================================
test('E/F. physical LEFT eye: canonical[1],[2] are upper (smaller Y) and [4],[5] are lower (larger Y)', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  const upperAvgY = (eye[1].y + eye[2].y) / 2, lowerAvgY = (eye[4].y + eye[5].y) / 2;
  assert.ok(upperAvgY < lowerAvgY, `upper avgY ${upperAvgY} should be < lower avgY ${lowerAvgY}`);
});
test('E/F. physical RIGHT eye: canonical[1],[2] are upper (smaller Y) and [4],[5] are lower (larger Y)', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  const upperAvgY = (eye[1].y + eye[2].y) / 2, lowerAvgY = (eye[4].y + eye[5].y) / 2;
  assert.ok(upperAvgY < lowerAvgY, `upper avgY ${upperAvgY} should be < lower avgY ${lowerAvgY}`);
});

// ================================================================
// G — EAR/aperture pairings remain anatomically valid: canonical[1]
// must pair with canonical[5] (both near the INNER corner) and
// canonical[2] with canonical[4] (both near the OUTER corner) — the
// exact Soukupová-Čech P2/P6, P3/P5 structure — for BOTH physical
// eyes, checked against an independent reference (which corner each
// lid point is nearer to by raw X-distance).
// ================================================================
function nearerCorner(p, inner, outer) {
  return Math.abs(p.x - inner.x) < Math.abs(p.x - outer.x) ? 'inner' : 'outer';
}
test('G. physical LEFT eye: canonical[1]/[5] pair near INNER, [2]/[4] pair near OUTER', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  const [inner, outer] = [eye[0], eye[3]];
  assert.strictEqual(nearerCorner(eye[1], inner, outer), 'inner');
  assert.strictEqual(nearerCorner(eye[5], inner, outer), 'inner');
  assert.strictEqual(nearerCorner(eye[2], inner, outer), 'outer');
  assert.strictEqual(nearerCorner(eye[4], inner, outer), 'outer');
});
test('G2. physical RIGHT eye: canonical[1]/[5] pair near INNER, [2]/[4] pair near OUTER', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  const [inner, outer] = [eye[0], eye[3]];
  assert.strictEqual(nearerCorner(eye[1], inner, outer), 'inner');
  assert.strictEqual(nearerCorner(eye[5], inner, outer), 'inner');
  assert.strictEqual(nearerCorner(eye[2], inner, outer), 'outer');
  assert.strictEqual(nearerCorner(eye[4], inner, outer), 'outer');
});

// ================================================================
// H — identical geometry, mirrored across the face midline, produces
// EQUIVALENT normalized metrics for LEFT and RIGHT. Distances are
// mirror-invariant, so width/aperture must match exactly regardless
// of which physical side. Construct the physical-LEFT eye's raw
// getRightEye()-shaped array directly (canonical order, since
// getRightEye is already canonical), mirror it about an arbitrary
// midline to get the true physical-RIGHT eye's real-world geometry,
// then re-express THAT in getLeftEye()'s raw index convention
// (proven above: [outer,upperOuter,upperInner,inner,lowerInner,
// lowerOuter]) — i.e. build what face-api would actually hand back
// for a perfectly symmetric face — and confirm normalization
// recovers matching magnitudes.
// ================================================================
test('H. mirrored synthetic eyes normalize to equal width/aperture magnitudes', () => {
  const canonicalRight = { // physical LEFT eye, already canonical (getRightEye order)
    inner: { x: 400, y: 105 }, upperInner: { x: 408, y: 100 }, upperOuter: { x: 422, y: 100 },
    outer: { x: 430, y: 105 }, lowerOuter: { x: 422, y: 110 }, lowerInner: { x: 408, y: 110 },
  };
  const rawGetRightEye = [canonicalRight.inner, canonicalRight.upperInner, canonicalRight.upperOuter,
    canonicalRight.outer, canonicalRight.lowerOuter, canonicalRight.lowerInner];
  const MIDLINE_X = 300;
  const mirror = (p) => ({ x: 2 * MIDLINE_X - p.x, y: p.y });
  // Physical RIGHT eye = mirror image of the same real-world shape.
  // Re-expressed in getLeftEye()'s raw index convention: raw[0]=outer,
  // raw[1]=upperOuter, raw[2]=upperInner, raw[3]=inner, raw[4]=lowerInner, raw[5]=lowerOuter.
  const rawGetLeftEye = [
    mirror(canonicalRight.outer), mirror(canonicalRight.upperOuter), mirror(canonicalRight.upperInner),
    mirror(canonicalRight.inner), mirror(canonicalRight.lowerInner), mirror(canonicalRight.lowerOuter),
  ];
  const leftPhysical = normalizeEyePoints(rawGetRightEye, 'getRightEye');   // physical LEFT
  const rightPhysical = normalizeEyePoints(rawGetLeftEye, 'getLeftEye');    // physical RIGHT

  const width = (e) => dist(e[0], e[3]);
  const apertureA = (e) => dist(e[1], e[5]);
  const apertureB = (e) => dist(e[2], e[4]);
  approx(width(leftPhysical), width(rightPhysical), 1e-9, 'width mismatch between mirrored eyes');
  approx(apertureA(leftPhysical), apertureA(rightPhysical), 1e-9, 'apertureA mismatch');
  approx(apertureB(leftPhysical), apertureB(rightPhysical), 1e-9, 'apertureB mismatch');
});

// ================================================================
// I — tilt sign: proves the CURRENT (buggy) code inverts the tilt
// vector's direction for whichever eye is sourced from getLeftEye(),
// and that normalization recovers the true direction. Uses a single
// physically-upturned synthetic eye (outer corner higher — smaller Y
// — than inner corner) expressed as raw getLeftEye() output.
// ================================================================
test('I. normalization fixes a 180-degree tilt-vector inversion for the getLeftEye() source', () => {
  // Raw getLeftEye()-shaped array for a physically upturned eye:
  // raw[0]=OUTER (higher, smaller y), raw[3]=INNER (lower, larger y).
  const rawGetLeftEye = [
    { x: 170, y: 100 }, // [0] outer corner (upturned: higher)
    { x: 178, y: 98 },  // [1] upper/near-outer
    { x: 192, y: 103 }, // [2] upper/near-inner
    { x: 200, y: 110 }, // [3] inner corner (lower)
    { x: 192, y: 115 }, // [4] lower/near-inner
    { x: 178, y: 112 }, // [5] lower/near-outer
  ];
  const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  // CURRENT (buggy) code's assumption: inner=raw[0], outer=raw[3] — see
  // computeEyeSideMetrics, index.html:463 ("const inner = eye[0], outer = eye[3];").
  const buggyAngle = angle(rawGetLeftEye[0], rawGetLeftEye[3]);
  // Normalized: true inner=canonical[0], true outer=canonical[3].
  const canonical = normalizeEyePoints(rawGetLeftEye, 'getLeftEye');
  const fixedAngle = angle(canonical[0], canonical[3]);
  // The two vectors point in exactly opposite directions (180 degrees
  // apart) — the current code doesn't just mislabel the corners, it
  // reverses the entire tilt vector for this eye.
  const diff = ((buggyAngle - fixedAngle + 540) % 360) - 180; // normalize to (-180,180]
  approx(Math.abs(diff), 180, 1e-6, `expected a 180-degree inversion, got buggy=${buggyAngle} fixed=${fixedAngle}`);
});

// ================================================================
// J — INNER/CENTER/OUTER zoning (t=0..1 along canonical[0..3])
// starts at the true nasal/inner corner for BOTH physical eyes —
// the exact property detectLashLine + lash-scan-core.js's zoneOf(t)
// depend on. Reuses the same independent nose-distance reference as C/D.
// ================================================================
test('J. lash-line start (t=0, INNER zone anchor) is the true inner/nasal corner — physical LEFT', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  const lashLineStart = eye[0], lashLineEnd = eye[3]; // detectLashLine uses eyeLocal[0..3] directly
  assert.deepStrictEqual(nearerToNose(lashLineStart, lashLineEnd), lashLineStart);
});
test('J2. lash-line start (t=0, INNER zone anchor) is the true inner/nasal corner — physical RIGHT', () => {
  const { eye } = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  const lashLineStart = eye[0], lashLineEnd = eye[3];
  assert.deepStrictEqual(nearerToNose(lashLineStart, lashLineEnd), lashLineStart);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
