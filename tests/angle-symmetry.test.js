// ============================================================
// L/R OUTER-CORNER ANGLE ASYMMETRY -- circular-distance + mirror fix.
// ------------------------------------------------------------
// Bug report: live debug data showed LEFT tiltCorrectedDeg=-4.471,
// RIGHT tiltCorrectedDeg=-174.806, and the UI's "Corner angle"
// asymmetry field (asymmetryBreakdown.tilt) reported 170.3 degrees
// while every other L/R asymmetry metric on the same capture was
// small (width 0.9%, height 1.4%, eye opening 2.3%, eyelid visibility
// 0.3%, vertical position 0.1%).
//
// Two separate, composed fixes:
//   1. shortestAngleDiffDeg(a,b) -- shortest circular distance mod 360,
//      normalized to [0,180]. Protects against the classic +/-180 seam
//      case (179 vs -179 = 2 degrees, not 358). Does NOT by itself
//      explain the real sample above (170.335 either way -- see test A)
//      because those two particular readings don't straddle that seam.
//   2. mirrorReflectDeg(deg) -- the actual root-cause fix. Physical
//      LEFT/RIGHT eye landmarks are read from horizontally mirrored
//      image regions (getPhysicalEyeLandmarks), so rawTilt's
//      inner->outer vector points toward +x for LEFT and -x for RIGHT
//      for the SAME real-world corner-tilt direction -- RIGHT's angle
//      is systematically ~180 degrees offset from LEFT's by
//      construction, for every subject, not just this one capture.
//      mirrorReflectDeg reflects RIGHT's angle (180-x, wrapped) back
//      into LEFT's coordinate frame before the two are compared.
//
// Same two-technique pattern as tests/physical-eye-integration.test.js:
//   1. Extract the REAL shortestAngleDiffDeg/mirrorReflectDeg function
//      bodies straight out of the current index.html source and eval
//      them, so these tests exercise the actual shipped code.
//   2. Source-guard tests proving the L/R tilt asymmetry call site uses
//      exactly shortestAngleDiffDeg(left.tiltCorrected,
//      mirrorReflectDeg(right.tiltCorrected)) -- RIGHT mirror-reflected,
//      LEFT untouched, no other asymmetryBreakdown field changed.
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
function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${a} ~= ${b} (eps=${eps})`);
}

// ---- Extract the real, currently-shipped helpers (both together --
// mirrorReflectDeg is defined immediately after shortestAngleDiffDeg) ----
const startMarker = '    const shortestAngleDiffDeg = (a, b) => {';
const endMarker = '\n    const median = (arr)';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not locate shortestAngleDiffDeg/mirrorReflectDeg in index.html -- has it moved or been renamed? Update the markers above.');
}
const helperSource = src.slice(startIdx, endIdx);
const { shortestAngleDiffDeg, mirrorReflectDeg } = new Function(
  helperSource + '\nreturn { shortestAngleDiffDeg, mirrorReflectDeg };'
)();

test('setup: extracted the real shortestAngleDiffDeg from index.html successfully', () => {
  assert.strictEqual(typeof shortestAngleDiffDeg, 'function');
});
test('setup: extracted the real mirrorReflectDeg from index.html successfully', () => {
  assert.strictEqual(typeof mirrorReflectDeg, 'function');
});

// Rebuilds a raw inner->outer vector angle from a chosen "physical
// upturn" angle phi (positive = outer corner higher/upturned, same
// real-world meaning for both eyes), mirrored the same way
// getPhysicalEyeLandmarks mirrors LEFT vs RIGHT (dx negated between
// sides, dy unchanged) -- this makes tests G/H a genuine simulation of
// the actual bug, not just algebra on the two literal reported numbers.
function simulateRawTilt(physicalSide, phiUpturnDeg) {
  const rad = phiUpturnDeg * Math.PI / 180;
  const dx = (physicalSide === 'left' ? 1 : -1) * Math.cos(rad);
  const dy = -Math.sin(rad);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

// ================================================================
// A. shortestAngleDiffDeg alone (kept from the previous stage)
// ================================================================
test('A. real sample via shortestAngleDiffDeg ALONE (no mirror): LEFT=-4.471 vs RIGHT=-174.806 stays 170.335 -- these two readings do not straddle the +/-180 seam relative to each other, so the circular-distance fix by itself does not explain the bug', () => {
  const result = shortestAngleDiffDeg(-4.471, -174.806);
  approx(result, 170.335, 0.001);
  assert.ok(result >= 0 && result <= 180, 'result must always be normalized into [0, 180]');
});

test('A2. the real sample is symmetric under argument order (a,b) === (b,a)', () => {
  approx(shortestAngleDiffDeg(-4.471, -174.806), shortestAngleDiffDeg(-174.806, -4.471), 1e-9);
});

test('B. +/-180 seam wraparound: 179 vs -179 is 2 degrees apart, not 358 -- the concrete bug a naive Math.abs(a-b) gets wrong', () => {
  const naive = Math.abs(179 - (-179));
  assert.strictEqual(naive, 358, 'sanity check: confirms the OLD naive formula really did misreport this case');
  approx(shortestAngleDiffDeg(179, -179), 2, 1e-9);
});

test('B2. the seam case also holds with the arguments reversed', () => {
  approx(shortestAngleDiffDeg(-179, 179), 2, 1e-9);
});

test('B3. values straddling the seam by a larger margin (170 vs -175) resolve to the true short way around (15), not the long way (345)', () => {
  approx(shortestAngleDiffDeg(170, -175), 15, 1e-9);
});

test('B4. exactly at the boundary: 180 vs -180 are the same angle -- distance 0', () => {
  approx(shortestAngleDiffDeg(180, -180), 0, 1e-9);
});

test('C. ordinary non-wrapping angles (30 vs 45) -- plain 15, unaffected by the circular fix', () => {
  approx(shortestAngleDiffDeg(30, 45), 15, 1e-9);
});

test('C2. ordinary non-wrapping negative angles (-30 vs -45) -- plain 15', () => {
  approx(shortestAngleDiffDeg(-30, -45), 15, 1e-9);
});

test('C3. ordinary angles spanning zero (-10 vs 10) -- plain 20', () => {
  approx(shortestAngleDiffDeg(-10, 10), 20, 1e-9);
});

test('D. identical angles (any value) always yield exactly 0', () => {
  assert.strictEqual(shortestAngleDiffDeg(0, 0), 0);
  assert.strictEqual(shortestAngleDiffDeg(-4.471, -4.471), 0);
  assert.strictEqual(shortestAngleDiffDeg(179.999, 179.999), 0);
});

test('E. shortestAngleDiffDeg result is always within [0, 180] and always matches the naive formula whenever the naive formula is already <= 180', () => {
  const samples = [-180, -170, -90, -45, -10, -1, 0, 1, 10, 45, 90, 170, 180, -4.471, -174.806, 179, -179];
  for (const a of samples) {
    for (const b of samples) {
      const result = shortestAngleDiffDeg(a, b);
      assert.ok(result >= 0 && result <= 180, `shortestAngleDiffDeg(${a}, ${b}) = ${result} must be within [0,180]`);
      const naive = Math.abs(a - b);
      if (naive <= 180) {
        approx(result, naive, 1e-9, `when the naive delta is already <=180 the circular fix must agree with it (a=${a}, b=${b})`);
      }
    }
  }
});

// ================================================================
// F. mirrorReflectDeg -- reflection identity + boundary behavior
// ================================================================
test('F. mirrorReflectDeg(0) = 180 and mirrorReflectDeg(180) = 0 -- reflecting a 0 degree line lands on the 180 degree seam and vice versa', () => {
  approx(mirrorReflectDeg(0), 180, 1e-9);
  approx(mirrorReflectDeg(180), 0, 1e-9);
});

test('F2. mirrorReflectDeg(-180) = 0 -- -180 and 180 are the same angle, both reflect to 0', () => {
  approx(mirrorReflectDeg(-180), 0, 1e-9);
});

test('F3. mirrorReflectDeg is its own inverse (applying it twice returns the original angle) across a sweep of values, including the real sample', () => {
  const samples = [-179.999, -174.806, -90, -45, -4.471, 0, 4.471, 45, 90, 174.806, 179.999];
  samples.forEach((d) => approx(mirrorReflectDeg(mirrorReflectDeg(d)), d, 1e-6, `double-reflection of ${d} must return to ${d}`));
});

test('F4. mirrorReflectDeg always returns a value in (-180, 180]', () => {
  const samples = [-180, -170, -90, -45, -10, -1, 0, 1, 10, 45, 90, 170, 180, -4.471, -174.806, 179, -179];
  samples.forEach((d) => {
    const r = mirrorReflectDeg(d);
    assert.ok(r > -180 && r <= 180, `mirrorReflectDeg(${d}) = ${r} must be in (-180, 180]`);
  });
});

// ================================================================
// G. the composed fix (shortestAngleDiffDeg + mirrorReflectDeg) --
// the actual production formula, on the real sample and on simulated
// physically-symmetric / physically-asymmetric captures.
// ================================================================
test('G. real sample, composed fix: shortestAngleDiffDeg(-4.471, mirrorReflectDeg(-174.806)) is approximately 0.723 degrees -- not 170.3 -- matching the scale of every other L/R asymmetry metric on the same capture', () => {
  const corrected = shortestAngleDiffDeg(-4.471, mirrorReflectDeg(-174.806));
  approx(corrected, 0.723, 0.001);
});

test('G2. simulated PHYSICALLY SYMMETRIC capture (both eyes upturned by the same 4.7 degrees, mirrored raw geometry) resolves to ~0 degrees asymmetry after the fix', () => {
  const rawLeft = simulateRawTilt('left', 4.7);
  const rawRight = simulateRawTilt('right', 4.7);
  const corrected = shortestAngleDiffDeg(rawLeft, mirrorReflectDeg(rawRight));
  approx(corrected, 0, 1e-6);
});

test('G3. simulated PHYSICALLY SYMMETRIC capture with a moderate shared upturn (20 degrees) also resolves to ~0 -- not just for small angles', () => {
  const rawLeft = simulateRawTilt('left', 20);
  const rawRight = simulateRawTilt('right', 20);
  const corrected = shortestAngleDiffDeg(rawLeft, mirrorReflectDeg(rawRight));
  approx(corrected, 0, 1e-6);
});

test('H. simulated OPPOSITE-DIRECTION asymmetry (LEFT upturned +5.71, RIGHT downturned -5.71 -- a real, genuine asymmetry) is correctly reported as ~11.42 degrees by the composed fix', () => {
  const rawLeft = simulateRawTilt('left', 5.71);
  const rawRight = simulateRawTilt('right', -5.71);
  const corrected = shortestAngleDiffDeg(rawLeft, mirrorReflectDeg(rawRight));
  approx(corrected, 11.42, 0.01);
});

test('H2. regression guard: a magnitude-only comparison (|fold90(left)| vs |fold90(right)|, the discarded alternative from the analysis step) would have reported ~0 for the same opposite-direction case above -- proving the composed fix is necessary, not just cosmetic', () => {
  const fold90 = (x) => (x > 90 ? x - 180 : x < -90 ? x + 180 : x);
  const rawLeft = simulateRawTilt('left', 5.71);
  const rawRight = simulateRawTilt('right', -5.71);
  const magnitudeOnly = Math.abs(Math.abs(fold90(rawLeft)) - Math.abs(fold90(rawRight)));
  assert.ok(magnitudeOnly < 0.001, `sanity check: confirms the magnitude-only alternative really would have missed this asymmetry (got ${magnitudeOnly})`);
});

// ================================================================
// I. Source guard -- only RIGHT is mirror-reflected at the tilt site;
// nothing else in asymmetryBreakdown or elsewhere was touched.
// ================================================================
test('I. the L/R "tilt" asymmetry field (UI: Corner angle / Угол уголков) is computed via shortestAngleDiffDeg(left.tiltCorrected, mirrorReflectDeg(right.tiltCorrected)) -- exactly LEFT bare, RIGHT mirror-reflected', () => {
  assert.ok(
    src.includes('tilt: shortestAngleDiffDeg(left.tiltCorrected, mirrorReflectDeg(right.tiltCorrected)),'),
    'expected asymmetryBreakdown.tilt to be computed via shortestAngleDiffDeg(left.tiltCorrected, mirrorReflectDeg(right.tiltCorrected))'
  );
  assert.ok(
    !src.includes('tilt: Math.abs(left.tiltCorrected - right.tiltCorrected)'),
    'the old naive Math.abs(...) formula must no longer be present'
  );
  assert.ok(
    !src.includes('tilt: shortestAngleDiffDeg(left.tiltCorrected, right.tiltCorrected)'),
    'the previous (unmirrored) intermediate formula must no longer be present -- RIGHT must now be mirror-reflected'
  );
});

test('I2. mirrorReflectDeg is applied to RIGHT only -- LEFT is never wrapped in mirrorReflectDeg anywhere in the tilt call site', () => {
  assert.ok(!src.includes('mirrorReflectDeg(left.tiltCorrected)'), 'LEFT must not be mirror-reflected');
});

test('I3. rawTilt / tiltCorrected themselves are unchanged -- still angle(inner, outer) and rawTilt - headPose.roll, no mirroring baked into their own definitions', () => {
  assert.ok(src.includes('const rawTilt = angle(inner, outer);'), 'rawTilt must still be computed exactly as before');
  assert.ok(src.includes('const tiltCorrected = rawTilt - headPose.roll;'), 'tiltCorrected must still be computed exactly as before');
});

test('I4. no other asymmetryBreakdown field (width/height/openness/hooding/vertical) was touched by this fix -- still plain Math.abs(...) ratios, untouched', () => {
  assert.ok(src.includes('width: Math.abs(left.width - right.width) / Math.max(left.width, right.width),'));
  assert.ok(src.includes('height: Math.abs(left.height - right.height) / Math.max(left.height, right.height),'));
  assert.ok(src.includes('openness: opennessDiff / Math.max(left.ear, right.ear, 0.01),'));
  assert.ok(src.includes('hooding: Math.abs(left.hoodingRatio - right.hoodingRatio) / Math.max(left.hoodingRatio, right.hoodingRatio, 0.01),'));
  assert.ok(src.includes('vertical: Math.abs(verticalAsymRaw || 0),'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
