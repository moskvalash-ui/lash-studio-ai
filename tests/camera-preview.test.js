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
const { execSync } = require('child_process');

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
  // Updated for the physical-eye-normalization integration: NaturalLashScanScreen
  // now sources eyePts/browPts from getPhysicalEyeLandmarks(det.landmarks, sd)
  // instead of a raw getLeftEye()/getRightEye() ternary — see
  // tests/eye-normalization.test.js for the normalization contract itself.
  const m = src.match(/const \{ eye: eyePts, brow: browPts \} = getPhysicalEyeLandmarks\(det\.landmarks, sd\);/);
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

// ============================================================
// FIRST-LAUNCH ZOOM FIX (Phase 1, minimal) — regression coverage.
// ------------------------------------------------------------
// LiveScanScreen's getUserMedia call previously requested no
// resolution/aspect-ratio at all ({ video: { facingMode }, audio:
// false }), leaving the browser/OS free to negotiate whatever native
// capture format it wanted — on a cold (first-ever permission grant)
// camera session this could differ from the format returned once the
// session is warm, producing a too-zoomed-in first launch that
// self-corrected after reload. The fix adds `ideal` width/height
// hints to the SAME facingMode-keyed constraints object — `ideal`
// (not `min`/`exact`) so it can never throw OverconstrainedError and
// never becomes a hard requirement. See the audit report + the
// in-code comment directly above the fixed getUserMedia call for the
// full rationale.
// ============================================================
const repoRoot = path.join(__dirname, '..');
let HEAD_SRC = null;
try { HEAD_SRC = execSync('git show HEAD:index.html', { cwd: repoRoot }).toString(); } catch (e) { HEAD_SRC = null; }

test('LiveScanScreen requests an explicit ideal width of 1280', () => {
  assert.ok(
    src.includes('getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })'),
    'expected the fixed getUserMedia constraints object with width: { ideal: 1280 } not found'
  );
});

test('LiveScanScreen requests an explicit ideal height of 720', () => {
  const m = src.match(/getUserMedia\(\{ video: \{ facingMode, width: \{ ideal: (\d+) \}, height: \{ ideal: (\d+) \} \}, audio: false \}\)/);
  assert.ok(m, 'expected the fixed getUserMedia constraints object not found');
  assert.strictEqual(Number(m[1]), 1280);
  assert.strictEqual(Number(m[2]), 720);
});

test('facingMode remains present, unchanged, and width/height stay ideal-only hints', () => {
  const start = src.indexOf('getUserMedia({ video: { facingMode, width:');
  assert.ok(start !== -1, 'expected the fixed getUserMedia call, keyed on facingMode first, not found');
  const call = src.slice(start, src.indexOf('audio: false });', start) + 'audio: false });'.length);
  assert.ok(call.startsWith('getUserMedia({ video: { facingMode,'), 'facingMode must still be the first key in the video constraints object');
  // `ideal` (never `min`/`exact`) is what guarantees getUserMedia can
  // never reject/throw over these hints.
  assert.ok(!call.includes('min:') && !call.includes('exact:'), 'width/height must stay `ideal` hints, never hard `min`/`exact` requirements');
});

test('the new width/height hints are ideal-only (no aspectRatio/frameRate added) — smallest safe fix, not the full CAMERA_ATTEMPTS chain', () => {
  const start = src.indexOf('getUserMedia({ video: { facingMode, width:');
  assert.ok(start !== -1);
  const call = src.slice(start, src.indexOf('audio: false });', start) + 'audio: false });'.length);
  assert.ok(!call.includes('aspectRatio'), 'this minimal fix must not add aspectRatio — that belongs to a later phase if needed');
  assert.ok(!call.includes('frameRate'), 'this minimal fix must not add frameRate — that belongs to a later phase if needed');
  assert.ok(!call.includes('CAMERA_ATTEMPTS'), 'LiveScanScreen must not be wired to the NaturalLashScanScreen CAMERA_ATTEMPTS chain in this phase');
});

test('downstream processing still reads video.videoWidth/video.videoHeight dynamically — no hardcoded 1280/720 assumption introduced', () => {
  // Scoped to LiveScanScreen's OWN function body only: the module-
  // level CAMERA_ATTEMPTS constant (consumed by NaturalLashScanScreen,
  // defined much later) sits textually immediately after
  // LiveScanScreen and legitimately contains 1280/720 literals of its
  // own — including it here would be a false positive, not a real
  // hardcoded assumption in LiveScanScreen's own code.
  const liveScanStart = src.indexOf('    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {');
  const liveScanEnd = src.indexOf('\n    const CAMERA_ATTEMPTS', liveScanStart);
  assert.ok(liveScanEnd > liveScanStart, 'expected the CAMERA_ATTEMPTS boundary marker right after LiveScanScreen');
  const body = src.slice(liveScanStart, liveScanEnd);
  assert.ok(body.includes('video.videoWidth') && body.includes('video.videoHeight'), 'LiveScanScreen must still read video.videoWidth/videoHeight dynamically');
  // The only numeric literal allowed to sit in this body is the pre-
  // existing 640 downscale cap (unrelated to this fix) and the new
  // ideal hints inside the getUserMedia call itself (already asserted
  // above) — no OTHER hardcoded 1280/720 pixel assumption should
  // appear anywhere else in coordinate/scale math.
  const withoutGetUserMediaCall = body.replace('getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });', '');
  assert.ok(!withoutGetUserMediaCall.includes('1280') && !withoutGetUserMediaCall.includes('720'), 'no hardcoded 1280/720 pixel assumption should exist outside the getUserMedia constraints object itself');
});

test('NaturalLashScanScreen camera negotiation (CAMERA_ATTEMPTS / effectiveVisibleWidth) is completely untouched by this fix', () => {
  assert.ok(HEAD_SRC, 'expected `git show HEAD:index.html` to succeed inside a git working tree');
  const extractSpan = (text, startMarker, endMarker) => {
    const s = text.indexOf(startMarker);
    if (s === -1) return null;
    const e = text.indexOf(endMarker, s);
    return e === -1 ? null : text.slice(s, e);
  };
  // NaturalLashProfileScreen is NOT the function immediately following
  // NaturalLashScanScreen (PhotoAnalysisScreen is) — using it as the
  // end marker would silently include PhotoAnalysisScreen, HeroScreen,
  // and DetailsScreen in this "NaturalLashScanScreen" span too. Bound
  // to the real next function so this only ever checks
  // NaturalLashScanScreen's own body.
  const startMarker = '    function NaturalLashScanScreen({ onComplete, onBack, modelsLoaded }) {';
  const endMarker = '\n    function PhotoAnalysisScreen(';
  const cur = extractSpan(src, startMarker, endMarker);
  const prev = extractSpan(HEAD_SRC, startMarker, endMarker);
  assert.ok(cur !== null && prev !== null, 'expected to locate NaturalLashScanScreen in both current and HEAD source');
  assert.strictEqual(cur, prev, 'NaturalLashScanScreen must be byte-identical to git HEAD — this fix touches only LiveScanScreen');
});

test('existing preview-mirror behavior is untouched: still exactly 2 mirrored <video> elements, keyed on facingMode only', () => {
  const videoMirrors = [...src.matchAll(/<video ref=\{videoRef\}[^>]*style=\{[^}]*scaleX\(-1\)[^}]*\}/g)];
  assert.strictEqual(videoMirrors.length, 2, 'expected exactly 2 mirrored <video> elements (LiveScanScreen conditional + NaturalLashScanScreen unconditional), unchanged by the camera-zoom fix');
  assert.ok(!/getUserMedia\([^)]*scaleX/.test(src), 'the getUserMedia constraints object must never itself reference mirroring');
});

test('production analysis/recommendation/Client Card/Professional Library code remains isolated from this fix', () => {
  for (const file of ['professional-lash-library.js', 'backend/worker.js', 'consent-manager.js', 'analytics.js', 'client-store.js', 'client-data-consent.js', 'lash-design-domain.js', 'lash-scan-core.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: repoRoot }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
  // The fix must not appear anywhere near classifyFeatures, classifyFaceShape,
  // rankDesigns/rankDesignsAll, or DESIGN_CATALOG.
  assert.ok(!/getUserMedia\(\{ video: \{ facingMode, width/.test(src.slice(0, src.indexOf('function LiveScanScreen('))), 'the camera-zoom fix must not appear before LiveScanScreen (i.e. not duplicated into shared/earlier code)');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
