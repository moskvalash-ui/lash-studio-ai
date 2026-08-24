// ============================================================
// PHYSICAL EYE NORMALIZATION — production integration regression tests.
// ------------------------------------------------------------
// Two techniques, matching this project's existing pattern for code
// that lives inside index.html's non-modular script (not requirable
// like lash-scan-core.js):
//   1. Behavioral tests (A-F, I, J, L) extract the REAL
//      normalizeEyePoints/normalizeBrowPoints/getPhysicalEyeLandmarks
//      function bodies straight out of the current index.html source
//      and eval them — so these tests exercise the actual shipped
//      code, not a hand-maintained duplicate that could drift.
//   2. Source-guard tests (C, D, G, H, K, M) regex-check index.html's
//      text to prove specific call sites are wired the way they must
//      be (same technique already used by tests/camera-preview.test.js).
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
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---- Extract the real, currently-shipped normalization boundary ----
const startMarker = '    function normalizeEyePoints(raw, source) {';
const endMarker = '\n    function computeHeadPose(landmarks) {';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not locate the normalizeEyePoints..getPhysicalEyeLandmarks block in index.html — has it moved or been renamed? Update the markers above.');
}
const helperSource = src.slice(startIdx, endIdx);
// Function constructor (not the vm module): runs in the SAME realm as
// the rest of this file, so arrays/objects it creates are ordinary
// Array/Object instances — vm.createContext's separate realm would
// make assert.deepStrictEqual fail on structurally-identical values
// purely because their Array/Object constructors differ cross-realm.
const { normalizeEyePoints, normalizeBrowPoints, getPhysicalEyeLandmarks } = new Function(
  helperSource + '\nreturn { normalizeEyePoints, normalizeBrowPoints, getPhysicalEyeLandmarks };'
)();

test('setup: extracted real getPhysicalEyeLandmarks from index.html successfully', () => {
  assert.strictEqual(typeof getPhysicalEyeLandmarks, 'function');
  assert.strictEqual(typeof normalizeEyePoints, 'function');
  assert.strictEqual(typeof normalizeBrowPoints, 'function');
});

// Same real fixture used in tests/eye-normalization.test.js (happy.jpg,
// face-api.js@0.22.2, captured live during the audit).
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
function nearerToNose(p, q) { return dist(p, FIXTURE.noseCenter) < dist(q, FIXTURE.noseCenter) ? p : q; }

// ================================================================
// A/B — UI physical side selects the correct raw face-api source
// ================================================================
test('A. UI LEFT selects physical left eye (sources from getRightEye, per proven contract)', () => {
  const result = getPhysicalEyeLandmarks(fakeLandmarks, 'left');
  assert.deepStrictEqual(result.eye, FIXTURE.getRightEye);
});
test('B. UI RIGHT selects physical right eye (sources from getLeftEye, permuted)', () => {
  const result = getPhysicalEyeLandmarks(fakeLandmarks, 'right');
  assert.deepStrictEqual(result.eye, [
    FIXTURE.getLeftEye[3], FIXTURE.getLeftEye[2], FIXTURE.getLeftEye[1],
    FIXTURE.getLeftEye[0], FIXTURE.getLeftEye[5], FIXTURE.getLeftEye[4],
  ]);
});

// ================================================================
// C/D — leftProfile/rightProfile receive the correctly-sided
// observation (NaturalLashScanScreen wiring, source-guard)
// ================================================================
test('C/D. NaturalLashScanScreen sources eyePts/browPts from the physical-side helper, and files sd into the matching profile', () => {
  assert.ok(
    /const \{ eye: eyePts, brow: browPts \} = getPhysicalEyeLandmarks\(det\.landmarks, sd\);/.test(src),
    'NaturalLashScanScreen no longer sources eyePts/browPts from getPhysicalEyeLandmarks(det.landmarks, sd)'
  );
  assert.ok(
    /if \(sd === 'left'\) setLeftProfile\(obs\); else setRightProfile\(obs\);/.test(src),
    'obs is no longer filed into leftProfile/rightProfile by sd — since sd is now proven to equal the physical side used to build obs, this line correctly stores physical-left/right data'
  );
});

// ================================================================
// E/F — INNER is nasal / OUTER is temporal for BOTH physical eyes
// (independent reference: distance to the fixture's own nose centroid)
// ================================================================
test('E. canonical[0] (INNER) is nasal for both physical eyes', () => {
  const left = getPhysicalEyeLandmarks(fakeLandmarks, 'left').eye;
  const right = getPhysicalEyeLandmarks(fakeLandmarks, 'right').eye;
  assert.deepStrictEqual(nearerToNose(left[0], left[3]), left[0]);
  assert.deepStrictEqual(nearerToNose(right[0], right[3]), right[0]);
});
test('F. canonical[3] (OUTER) is temporal for both physical eyes', () => {
  const left = getPhysicalEyeLandmarks(fakeLandmarks, 'left').eye;
  const right = getPhysicalEyeLandmarks(fakeLandmarks, 'right').eye;
  assert.notDeepStrictEqual(left[3], nearerToNose(left[0], left[3]));
  assert.notDeepStrictEqual(right[3], nearerToNose(right[0], right[3]));
});

// ================================================================
// G/H — LiveScan overlay: 'L' uses the physical-left source, 'R' uses
// physical-right (source-guard over the full wiring chain: lastDetRef
// -> smoothed state -> eyeOf -> drawEyeTarget label)
// ================================================================
test('G/H. LiveScanScreen overlay: physicalLeftEye/physicalRightEye are captured from the helper and feed the L/R eyeOf() calls, not the raw mesh points', () => {
  assert.ok(/physicalLeftEye: physicalLeft\.eye\.map/.test(src), 'lastDetRef.current.physicalLeftEye is not sourced from physicalLeft.eye');
  assert.ok(/physicalRightEye: physicalRight\.eye\.map/.test(src), 'lastDetRef.current.physicalRightEye is not sourced from physicalRight.eye');
  assert.ok(/const physicalLeft = getPhysicalEyeLandmarks\(det\.landmarks, 'left'\);/.test(src), 'physicalLeft is not built via getPhysicalEyeLandmarks');
  assert.ok(/const physicalRight = getPhysicalEyeLandmarks\(det\.landmarks, 'right'\);/.test(src), 'physicalRight is not built via getPhysicalEyeLandmarks');
  assert.ok(/s\.physicalLeftEye = smoothAll\(s\.physicalLeftEye, mapAll\(d\.physicalLeftEye\)/.test(src), 'overlay smoothing of s.physicalLeftEye is missing');
  assert.ok(/s\.physicalRightEye = smoothAll\(s\.physicalRightEye, mapAll\(d\.physicalRightEye\)/.test(src), 'overlay smoothing of s.physicalRightEye is missing');
  assert.ok(
    /const le = eyeOf\(s\.physicalLeftEye\), re = eyeOf\(s\.physicalRightEye\);/.test(src),
    'le/re (which feed the L/R drawEyeTarget calls) are not built from the physical/canonical points'
  );
  // The raw s.leftEye/s.rightEye must still feed buildFaceMesh, untouched.
  assert.ok(
    /buildFaceMesh\(d && d\.jaw \? \{ jaw: s\.jaw, leftBrow: s\.leftBrow, rightBrow: s\.rightBrow, nose: s\.nose, leftEye: s\.leftEye, rightEye: s\.rightEye, mouth: s\.mouth \} : null\)/.test(src),
    'buildFaceMesh no longer reads the raw (unnormalized) s.leftEye/s.rightEye/s.leftBrow/s.rightBrow — the purely-visual mesh should stay on raw face-api ordering'
  );
});

// ================================================================
// I/J — mirrored preview / rear-camera display mode cannot alter
// anatomical normalization: the extracted helper's own source must
// contain no reference to mirror/facingMode/screen-coordinate state,
// and computeHeadPose/computeEyeSideMetrics (which DO carry physical-
// side meaning) must not reference facingMode either.
// ================================================================
test('I/J. getPhysicalEyeLandmarks has zero dependency on mirror/facingMode/display state', () => {
  assert.ok(!/mirror|facingMode|scaleX|videoW|videoH|dispW|dispH/i.test(helperSource),
    'the extracted helper unexpectedly references mirror/facingMode/display-coordinate state');
});
test('I/J2. computeHeadPose and computeEyeSideMetrics take no facingMode/mirror input', () => {
  const headPoseSrc = src.slice(src.indexOf('function computeHeadPose('), src.indexOf('function computeEAR('));
  const metricsSrc = src.slice(src.indexOf('function computeEyeSideMetrics('), src.indexOf('function computeEyeSideMetrics(') + 4000);
  assert.ok(!/facingMode|mirror/i.test(headPoseSrc), 'computeHeadPose unexpectedly references facingMode/mirror');
  assert.ok(!/facingMode|mirror/i.test(metricsSrc.slice(0, metricsSrc.indexOf('return {'))), 'computeEyeSideMetrics unexpectedly references facingMode/mirror before its return');
});

// ================================================================
// K — Eye Geometry inner/outer metrics use canonical corners.
// computeEyeSideMetrics's `inner = eye[0], outer = eye[3]` line was
// NOT changed by this integration (only how eye/brow are SOURCED
// was changed, to getPhysicalEyeLandmarks) — so its correctness
// follows directly from E/F above (eye[0]/eye[3] ARE now the true
// inner/outer corners for both physical sides). Confirmed here by
// source-guard that the formula line itself is untouched/still present.
// ================================================================
test('K. computeEyeSideMetrics still derives inner/outer as eye[0]/eye[3] (now genuinely canonical, per E/F)', () => {
  assert.ok(/const \{ eye, brow \} = getPhysicalEyeLandmarks\(landmarks, side\);\s*\n\s*const inner = eye\[0\], outer = eye\[3\];/.test(src),
    'computeEyeSideMetrics no longer sources eye/brow from getPhysicalEyeLandmarks, or no longer derives inner/outer as eye[0]/eye[3]');
});

// ================================================================
// L — tilt sign is anatomically consistent for mirrored synthetic
// LEFT/RIGHT geometry. Uses a mirror-invariant definition of
// "upturned" (outer corner has smaller/higher Y than inner corner)
// rather than comparing raw angle() values directly — a real,
// symmetric face's two eyes legitimately point in opposite X
// directions (inner->outer), so raw angle() magnitudes are NOT
// expected to match between sides; only the vertical (Y) relationship
// anatomically means "upturned" for both.
// ================================================================
test('L. mirrored synthetic left/right eyes: normalized outer corner is consistently higher than inner (upturned) for both', () => {
  const canonicalRight = { // physical LEFT eye (already canonical, getRightEye order)
    inner: { x: 400, y: 110 }, upperInner: { x: 408, y: 104 }, upperOuter: { x: 422, y: 98 },
    outer: { x: 430, y: 100 }, lowerOuter: { x: 422, y: 108 }, lowerInner: { x: 408, y: 114 },
  };
  const rawGetRightEye = [canonicalRight.inner, canonicalRight.upperInner, canonicalRight.upperOuter,
    canonicalRight.outer, canonicalRight.lowerOuter, canonicalRight.lowerInner];
  const MIDLINE_X = 300;
  const mirror = (p) => ({ x: 2 * MIDLINE_X - p.x, y: p.y });
  const rawGetLeftEye = [
    mirror(canonicalRight.outer), mirror(canonicalRight.upperOuter), mirror(canonicalRight.upperInner),
    mirror(canonicalRight.inner), mirror(canonicalRight.lowerInner), mirror(canonicalRight.lowerOuter),
  ];
  const leftPhysical = normalizeEyePoints(rawGetRightEye, 'getRightEye');
  const rightPhysical = normalizeEyePoints(rawGetLeftEye, 'getLeftEye');
  // Both physical eyes: outer.y < inner.y (outer sits higher = upturned), consistently.
  assert.ok(leftPhysical[3].y < leftPhysical[0].y, 'physical LEFT eye: outer should be higher (smaller y) than inner');
  assert.ok(rightPhysical[3].y < rightPhysical[0].y, 'physical RIGHT eye: outer should be higher (smaller y) than inner');
});

// ================================================================
// M — no application-semantic consumer bypasses normalization with
// raw face-api left/right getters. Codifies the manual audit into a
// regression test: every remaining getLeftEye()/getRightEye()/
// getLeftEyeBrow()/getRightEyeBrow() call site must be inside the
// helper's own definition, OR inside one of the two documented
// buildFaceMesh-feeding locations (LiveScanScreen's raw lastDetRef
// storage, ResultMeshOverlay).
// ================================================================
test('M. every remaining raw getLeftEye/getRightEye/getLeftEyeBrow/getRightEyeBrow call is inside the helper or a documented buildFaceMesh feed', () => {
  const callRegex = /landmarks\.get(Left|Right)Eye(Brow)?\(\)/g;
  const allCalls = [...src.matchAll(callRegex)];
  assert.ok(allCalls.length > 0, 'sanity: expected to find at least the helper\'s own raw calls');
  // Robust "which top-level function is this call inside" lookup —
  // find every top-level `function NAME(` declaration's start offset,
  // then for a given call position, take the NAME of the nearest one
  // before it (rather than a fixed character-distance window, which
  // is fragile against unrelated comment-length changes).
  const fnDeclRegex = /\n {4}function (\w+)\(/g;
  const fnStarts = [...src.matchAll(fnDeclRegex)].map(m => ({ name: m[1], pos: m.index }));
  function enclosingFunctionName(pos) {
    let best = null;
    for (const f of fnStarts) { if (f.pos <= pos) best = f; else break; }
    return best ? best.name : null;
  }
  // Every legitimate raw-getter-using function outside the helper
  // itself must feed buildFaceMesh only, and must carry a doc comment
  // saying so (checked separately, not by fixed distance).
  const DOCUMENTED_RAW_CONSUMERS = ['LiveScanScreen', 'ResultMeshOverlay'];
  for (const m of allCalls) {
    const pos = m.index;
    const insideHelper = pos >= startIdx && pos < endIdx;
    const fnName = enclosingFunctionName(pos);
    assert.ok(insideHelper || DOCUMENTED_RAW_CONSUMERS.includes(fnName),
      `undocumented raw getter call at offset ${pos} inside "${fnName}": "${src.slice(pos, pos + 40)}" — either route it through getPhysicalEyeLandmarks or add "${fnName}" to DOCUMENTED_RAW_CONSUMERS with a buildFaceMesh doc comment nearby`);
  }
  // And each documented consumer must actually carry a doc comment
  // explaining the exemption somewhere in its own body.
  for (const name of DOCUMENTED_RAW_CONSUMERS) {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start !== -1, `expected to find function ${name}(`);
    const nextFn = fnStarts.find(f => f.pos > start);
    const body = src.slice(Math.max(0, start - 1200), nextFn ? nextFn.pos : start + 6000);
    assert.ok(/buildFaceMesh/.test(body) && /raw|unchanged|exempt/i.test(body),
      `${name} is listed as a documented raw-getter consumer but no buildFaceMesh exemption comment was found near it`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
