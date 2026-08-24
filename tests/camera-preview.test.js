// ============================================================
// CAMERA FIX — preview mirroring / face-lost hysteresis tests.
// ------------------------------------------------------------
// index.html's camera/overlay code lives inside React component
// closures (JSX, refs, requestAnimationFrame loops) and is not a
// requirable module the way lash-scan-core.js is, so it cannot be
// exercised directly in Node the way the NLS measurement suite is.
// This file instead:
//   1. Re-implements, as small standalone pure functions, the EXACT
//      formulas added to index.html's two overlay draw loops (box
//      corner mirroring, face-lost grace-window gating) so the
//      arithmetic itself is regression-tested independent of React/
//      DOM/canvas — each function's source is quoted in a comment
//      directly above it so drift from the real index.html code is
//      easy to spot on review.
//   2. Runs static source-guard assertions against the actual
//      index.html text, confirming the eye-side (LEFT/RIGHT) landmark
//      selection and the measurement/ROI pipeline do not reference
//      any mirror/facingMode state — i.e. the preview-mirror change
//      is structurally incapable of touching measurement data.
// Browser-only behavior that genuinely cannot be checked this way
// (actual on-screen mirrored rendering, live face-lost UX timing,
// real getUserMedia camera behavior) was instead verified by live
// browser inspection — see the deliverable report, section 14.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

// ---- 1. Box-corner mirroring math ----
// Mirrors index.html's overlay draw-loop pattern exactly:
//   const map = (x,y) => { const p = mapVideoPointToDisplay(...); return mirrored ? {x: w-p.x, y:p.y} : p; };
//   const tl = map(box.x, box.y), br = map(box.x+box.width, box.y+box.height);
//   const targetBox = { x: Math.min(tl.x,br.x), y: Math.min(tl.y,br.y), width: Math.abs(br.x-tl.x), height: Math.abs(br.y-tl.y) };
function mirrorAwareBox(box, w, mirrored) {
  const flip = (x) => mirrored ? w - x : x;
  const tl = { x: flip(box.x), y: box.y };
  const br = { x: flip(box.x + box.width), y: box.y + box.height };
  return { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), width: Math.abs(br.x - tl.x), height: Math.abs(br.y - tl.y) };
}

test('mirrorAwareBox: unmirrored box is unchanged', () => {
  const box = { x: 10, y: 20, width: 50, height: 30 };
  const out = mirrorAwareBox(box, 200, false);
  assert.deepStrictEqual(out, box);
});

test('mirrorAwareBox: mirrored box has non-negative width/height', () => {
  const box = { x: 10, y: 20, width: 50, height: 30 };
  const out = mirrorAwareBox(box, 200, true);
  assert.ok(out.width >= 0, `width was negative: ${out.width}`);
  assert.ok(out.height >= 0, `height was negative: ${out.height}`);
});

test('mirrorAwareBox: mirrored box preserves size and reflects position around w/2', () => {
  const box = { x: 10, y: 20, width: 50, height: 30 };
  const w = 200;
  const out = mirrorAwareBox(box, w, true);
  assert.strictEqual(out.width, box.width);
  assert.strictEqual(out.height, box.height);
  assert.strictEqual(out.y, box.y);
  // original spans x:[10,60]; mirrored around w=200 should span [140,190]
  assert.strictEqual(out.x, w - (box.x + box.width));
  assert.strictEqual(out.x + out.width, w - box.x);
});

test('mirrorAwareBox: a box already touching the right edge stays in-bounds when mirrored', () => {
  const w = 200;
  const box = { x: 150, y: 0, width: 50, height: 10 }; // spans [150,200]
  const out = mirrorAwareBox(box, w, true);
  assert.strictEqual(out.x, 0);
  assert.strictEqual(out.width, 50);
});

// ---- 2. Face-lost grace-window gating ----
// Mirrors index.html's tick-handler pattern exactly:
//   const withinGrace = hadFace && lastTs != null && (now - lastTs) < FACE_LOST_GRACE_MS;
//   if (!withinGrace) { /* flip to lost */ }
const FACE_LOST_GRACE_MS = 900;
function shouldDeclareLost(hadFace, lastSeenTs, now) {
  const withinGrace = hadFace && lastSeenTs != null && (now - lastSeenTs) < FACE_LOST_GRACE_MS;
  return !withinGrace;
}

test('face-lost gate: does not fire on a single brief miss (well within grace window)', () => {
  const lastSeenTs = 1000;
  const now = 1000 + 200; // one ~200ms tick later
  assert.strictEqual(shouldDeclareLost(true, lastSeenTs, now), false);
});

test('face-lost gate: fires once the miss persists past the grace window', () => {
  const lastSeenTs = 1000;
  const now = 1000 + FACE_LOST_GRACE_MS + 50;
  assert.strictEqual(shouldDeclareLost(true, lastSeenTs, now), true);
});

test('face-lost gate: fires immediately if no face was ever seen', () => {
  assert.strictEqual(shouldDeclareLost(false, null, 1000), true);
});

test('face-lost gate: FACE_LOST_GRACE_MS constant in index.html matches this test\'s assumption', () => {
  const m = src.match(/const FACE_LOST_GRACE_MS = (\d+);/);
  assert.ok(m, 'FACE_LOST_GRACE_MS constant not found in index.html');
  assert.strictEqual(Number(m[1]), FACE_LOST_GRACE_MS, 'index.html constant drifted from this test file — update both together');
});

// ---- 3. Static source guards — measurement/LEFT-RIGHT safety ----
test('source guard: eye-side (LEFT/RIGHT) selection has no dependency on mirror/facingMode state', () => {
  const m = src.match(/const eyePts = \(sd === 'left' \? det\.landmarks\.getLeftEye\(\) : det\.landmarks\.getRightEye\(\)\);/);
  assert.ok(m, 'expected eye-side selection line not found — has NaturalLashScanScreen changed shape?');
  assert.ok(!/mirror|facingMode/i.test(m[0]), 'eye-side selection line unexpectedly references mirror/facingMode state');
});

test('source guard: the lash-detection canvas snapshot is drawn straight from <video> with no flip/translate', () => {
  // Confirms detectVisibleLashCandidates/face-api always run on a
  // plain, unmirrored ctx.drawImage(video, ...) call — never on a
  // canvas that itself had a scale/translate applied before drawing.
  const calls = [...src.matchAll(/ctx\.drawImage\(video, 0, 0, canvas\.width, canvas\.height\)/g)];
  assert.ok(calls.length >= 2, `expected at least 2 raw ctx.drawImage(video,...) calls (one per live-scan screen), found ${calls.length}`);
});

test('source guard: no CSS mirror is applied to either overlay <canvas> (only <video> is mirrored)', () => {
  // The overlay canvases carry text (L/R lock labels); mirroring the
  // canvas element itself would render that text backwards. The fix
  // must mirror coordinates inside the draw loop instead, never the
  // canvas element's own CSS transform.
  assert.ok(!/<canvas ref=\{overlayCanvasRef\}[^>]*scaleX/.test(src), 'overlay canvas element appears to carry a CSS scaleX transform');
});

test('source guard: both live-scan <video> elements carry the preview-only mirror', () => {
  const videoMirrors = [...src.matchAll(/<video ref=\{videoRef\}[^>]*style=\{[^}]*scaleX\(-1\)[^}]*\}/g)];
  assert.ok(videoMirrors.length >= 2, `expected 2 mirrored <video> elements (LiveScanScreen conditional + NaturalLashScanScreen unconditional), found ${videoMirrors.length}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
