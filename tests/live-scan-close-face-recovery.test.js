const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// LiveScanScreen is a JSX/React closure, not a requirable module — same
// extraction pattern as live-scan-lifecycle.test.js and camera-layout-
// debug.test.js: slice the real, unmodified production text and either
// source-guard it or eval a bounded region via new Function.
const liveScanStart = src.indexOf('    function LiveScanScreen(');
const liveScanEnd = src.indexOf('\n    const NAT_LASH_HINT_KEYS', liveScanStart);
assert.ok(liveScanStart >= 0 && liveScanEnd > liveScanStart, 'LiveScanScreen must be structurally extractable');
const liveScanSource = src.slice(liveScanStart, liveScanEnd);

// ------------------------------------------------------------
// Shared constants — extracted from the real production source, never
// hardcoded here, so a future edit to either value is caught instead of
// silently going stale in this test file.
// ------------------------------------------------------------
const constsStart = src.indexOf('    const FACE_LOST_GRACE_MS = 900;');
const constsEndMarker = 'const TOO_CLOSE_RECOVERY_GRACE_MS = FACE_LOST_GRACE_MS * 2;';
const constsEnd = src.indexOf(constsEndMarker, constsStart) + constsEndMarker.length;
assert.ok(constsStart >= 0 && constsEnd > constsStart, 'FACE_LOST_GRACE_MS/TOO_CLOSE_RECOVERY_GRACE_MS must be structurally extractable');
const { FACE_LOST_GRACE_MS, TOO_CLOSE_RECOVERY_GRACE_MS } = new Function(
  src.slice(constsStart, constsEnd) + '\nreturn { FACE_LOST_GRACE_MS, TOO_CLOSE_RECOVERY_GRACE_MS };'
)();

const minStableMatch = src.match(/const MIN_STABLE_FRAMES = (\d+);/);
assert.ok(minStableMatch, 'MIN_STABLE_FRAMES must be structurally extractable');
const MIN_STABLE_FRAMES = Number(minStableMatch[1]);

test('grace-window constants: TOO_CLOSE_RECOVERY_GRACE_MS is exactly 2x the existing, unmodified FACE_LOST_GRACE_MS — both strictly bounded', () => {
  assert.strictEqual(FACE_LOST_GRACE_MS, 900, 'the pre-existing single-missed-frame grace window must be unchanged');
  assert.strictEqual(TOO_CLOSE_RECOVERY_GRACE_MS, 1800);
  assert.ok(Number.isFinite(TOO_CLOSE_RECOVERY_GRACE_MS) && TOO_CLOSE_RECOVERY_GRACE_MS > FACE_LOST_GRACE_MS,
    'the too-close recovery window must be a real, finite, strictly larger bound — never Infinity/unbounded');
});

// ------------------------------------------------------------
// PART A — no-detection branch, extracted and executed directly (not
// just source-guarded) so grace-window timing/expiry is proven at
// runtime, not merely inferred from reading the code.
// ------------------------------------------------------------
const noDetStartMarker = "if (!det) {\n            console.log('[LSA] FACE DETECTED: false');";
const noDetStart = liveScanSource.indexOf(noDetStartMarker);
assert.ok(noDetStart >= 0, 'no-detection branch must be structurally extractable');
const noDetEndMarker = "setProgress(Math.min(1, bufferRef.current.length / MIN_STABLE_FRAMES));\n            return;\n          }";
const noDetEndIdx = liveScanSource.indexOf(noDetEndMarker, noDetStart);
assert.ok(noDetEndIdx > noDetStart, 'no-detection branch end must be structurally extractable');
const noDetectionBranch = liveScanSource.slice(noDetStart, noDetEndIdx + noDetEndMarker.length);

const runNoDetectionBranch = new Function('ctx', `
  const det = null; // this harness only exercises the (!det) branch itself
  const { hadFaceRef, lastDetRef, stageKeyRef, bufferRef, canvas, hintKey, now,
    MIN_STABLE_FRAMES, FACE_LOST_GRACE_MS, TOO_CLOSE_RECOVERY_GRACE_MS,
    decideStage, setPhase, decideHint, recordDetectorSample, setProgress } = ctx;
  ${noDetectionBranch}
`);

function exerciseNoDetection(overrides) {
  const calls = { decideStage: [], setPhase: [], decideHint: [], recordDetectorSample: [], setProgress: [] };
  const ctx = Object.assign({
    hadFaceRef: { current: true },
    lastDetRef: { current: null },
    stageKeyRef: { current: 'stageRealigning' },
    bufferRef: { current: [] },
    canvas: { width: 640, height: 1138 },
    hintKey: null,
    now: 0,
    MIN_STABLE_FRAMES, FACE_LOST_GRACE_MS, TOO_CLOSE_RECOVERY_GRACE_MS,
    decideStage: k => calls.decideStage.push(k),
    setPhase: k => calls.setPhase.push(k),
    decideHint: k => calls.decideHint.push(k),
    recordDetectorSample: s => calls.recordDetectorSample.push(s),
    setProgress: p => calls.setProgress.push(p),
  }, overrides);
  runNoDetectionBranch(ctx);
  return { calls, ctx };
}

test('1. DETECTED TOO CLOSE -> short NO DETECTION remains in an actionable too-close UI state', () => {
  // FRAME N: a real too_close detection just happened (ts=1000, tooClose
  // recorded). FRAME N+k: no_detection, 1500ms later — past the base
  // FACE_LOST_GRACE_MS (900ms) but well within TOO_CLOSE_RECOVERY_GRACE_MS
  // (1800ms), reproducing the captured real-device sequence.
  const { calls, ctx } = exerciseNoDetection({
    hadFaceRef: { current: true },
    lastDetRef: { current: { hasFace: true, ts: 1000, tooClose: true } },
    stageKeyRef: { current: 'stageRealigning' },
    hintKey: 'hintTooClose',
    now: 1000 + 1500,
  });
  // No lost/searching transition fired — phase/stageKey/hint are left
  // exactly as they were (still showing the too-close guidance).
  assert.deepStrictEqual(calls.decideStage, []);
  assert.deepStrictEqual(calls.setPhase, []);
  assert.deepStrictEqual(calls.decideHint, []);
  assert.strictEqual(ctx.hadFaceRef.current, true, 'hadFaceRef must not be reset while still within the too-close grace window');
  assert.strictEqual(ctx.lastDetRef.current.ts, 1000, 'lastDetRef must be left untouched (not overwritten) during grace');
  const sample = calls.recordDetectorSample[0];
  assert.strictEqual(sample.stageKey, 'stageRealigning', 'diagnostic sample must reflect the held (unchanged) stage');
  assert.strictEqual(sample.hintKey, 'hintTooClose', 'diagnostic sample must reflect the held (unchanged) too-close hint');
});

test('2. NO DETECTION without prior too-close evidence still behaves exactly as before (generic FACE_LOST_GRACE_MS only)', () => {
  // Same elapsed time (1500ms) as test 1, but the last detection was NOT
  // too_close — must fall back to the original 900ms behavior and flip
  // to "lost", proving the new mechanism is inert for the general case.
  const { calls, ctx } = exerciseNoDetection({
    hadFaceRef: { current: true },
    lastDetRef: { current: { hasFace: true, ts: 1000, tooClose: false } },
    stageKeyRef: { current: 'stageFaceDetected' },
    hintKey: 'hintBlurry',
    now: 1000 + 1500,
  });
  assert.deepStrictEqual(calls.decideStage, ['stageLost']);
  assert.deepStrictEqual(calls.setPhase, ['lost']);
  assert.deepStrictEqual(calls.decideHint, [null]);
  assert.strictEqual(ctx.hadFaceRef.current, false);
  assert.strictEqual(calls.recordDetectorSample[0].hintKey, null);
});

test('2b. NO DETECTION with no prior detection at all (lastDetRef null) still goes straight to searching, unaffected', () => {
  const { calls, ctx } = exerciseNoDetection({
    hadFaceRef: { current: false },
    lastDetRef: { current: null },
    stageKeyRef: { current: 'stageSearching' },
    hintKey: null,
    now: 5000,
  });
  assert.deepStrictEqual(calls.decideStage, ['stageSearching']);
  assert.deepStrictEqual(calls.setPhase, ['searching']);
  assert.strictEqual(ctx.lastDetRef.current.hasFace, false);
});

test('3. Prior too-close evidence expires after the bounded grace window — normal lost/searching logic resumes', () => {
  // Same too_close=true evidence as test 1, but now elapsed time exceeds
  // TOO_CLOSE_RECOVERY_GRACE_MS (1800ms) — the extended grace must end and
  // fall through to the exact same lost/searching path as the generic case.
  const { calls, ctx } = exerciseNoDetection({
    hadFaceRef: { current: true },
    lastDetRef: { current: { hasFace: true, ts: 1000, tooClose: true } },
    stageKeyRef: { current: 'stageRealigning' },
    hintKey: 'hintTooClose',
    now: 1000 + 1900,
  });
  assert.deepStrictEqual(calls.decideStage, ['stageLost']);
  assert.deepStrictEqual(calls.setPhase, ['lost']);
  assert.deepStrictEqual(calls.decideHint, [null]);
  assert.strictEqual(ctx.hadFaceRef.current, false, 'stale too-close state must not survive indefinitely');
  assert.strictEqual(calls.recordDetectorSample[0].hintKey, null, 'expired grace must not keep reporting the stale too-close hint');
});

test('3b. grace boundary is strict: exactly at TOO_CLOSE_RECOVERY_GRACE_MS elapsed, grace has already ended', () => {
  const { calls } = exerciseNoDetection({
    hadFaceRef: { current: true },
    lastDetRef: { current: { hasFace: true, ts: 0, tooClose: true } },
    now: TOO_CLOSE_RECOVERY_GRACE_MS,
  });
  assert.deepStrictEqual(calls.decideStage, ['stageLost'], '"< graceWindowMs" is a strict inequality, so the boundary itself is already expired');
});

test('4. no-detection frames during the grace period never enter the stable buffer, never advance completion, and fabricate no face metrics', () => {
  const buffer = [{ t: 500 }];
  const { calls, ctx } = exerciseNoDetection({
    hadFaceRef: { current: true },
    lastDetRef: { current: { hasFace: true, ts: 1000, tooClose: true } },
    bufferRef: { current: buffer },
    now: 1000 + 1000,
  });
  // bufferRef is never pushed to by this branch — only ever filtered
  // upstream by the caller (BUFFER_WINDOW_MS), so it must be the exact
  // same array reference/contents, not grown.
  assert.strictEqual(ctx.bufferRef.current, buffer);
  assert.strictEqual(ctx.bufferRef.current.length, 1);
  assert.deepStrictEqual(calls.setProgress, [1 / MIN_STABLE_FRAMES], 'progress must reflect the real (unchanged) buffer length, never advanced by a no-detection tick');
  const sample = calls.recordDetectorSample[0];
  assert.strictEqual(sample.hasFace, false);
  assert.strictEqual(sample.detectorScore, null);
  assert.strictEqual(sample.faceRatio, null);
  assert.strictEqual(sample.boxX, null);
  assert.strictEqual(sample.boxY, null);
  assert.strictEqual(sample.boxWidth, null);
  assert.strictEqual(sample.boxHeight, null);
  assert.strictEqual(sample.boxClipped, null, '7. boxClipped/boxNearEdge stays null for a genuine no-detection sample, too-close grace or not');
  assert.deepStrictEqual(sample.rejectionReasons, ['no_detection']);
});

// ------------------------------------------------------------
// 5. A genuinely recovered face immediately returns to normal
// current-frame evaluation — proven via the exact line that (re)marks
// lastDetRef.current.tooClose fresh on every real detection, overwriting
// any stale grace-relevant state from a prior frame. The det-truthy code
// path itself is never gated by grace state (structurally: the
// no-detection branch above always `return`s, so nothing past it runs
// unless a real `det` was produced this same tick).
// ------------------------------------------------------------
const tooCloseMarkLine = "if (lastDetRef.current) lastDetRef.current.tooClose = quality.reasons.includes('too_close');";
assert.ok(liveScanSource.includes(tooCloseMarkLine), 'the tooClose marker line must be present, unmodified, in LiveScanScreen');
const markTooClose = new Function('lastDetRef', 'quality', `${tooCloseMarkLine}\nreturn lastDetRef.current.tooClose;`);

test('5. a fresh real detection always recomputes tooClose from THIS frame only, overwriting stale grace state (recovery)', () => {
  const ref = { current: { tooClose: true, ts: 1 } };
  markTooClose(ref, { reasons: ['too_dark'] });
  assert.strictEqual(ref.current.tooClose, false, 'a recovered, no-longer-too-close detection must clear the flag immediately');
  markTooClose(ref, { reasons: [] });
  assert.strictEqual(ref.current.tooClose, false);
  markTooClose(ref, { reasons: ['too_close'] });
  assert.strictEqual(ref.current.tooClose, true);
});

test('5b. the no-detection branch always returns before any det-truthy code — successful detection is never conditioned on grace state', () => {
  const afterBranch = liveScanSource.slice(noDetEndIdx + noDetEndMarker.length, noDetEndIdx + noDetEndMarker.length + 200);
  assert.ok(afterBranch.trimStart().startsWith("markTiming('T8_first_valid_face_detected');"),
    'the very next statement after the no-detection branch closes must be the unconditional det-truthy continuation');
});

// ------------------------------------------------------------
// PART B — rejection-hint priority, a pure standalone function.
// ------------------------------------------------------------
const reasonMessagesStart = src.indexOf('    const REASON_MESSAGES = {');
const hintPriorityEndMarker = '\n    function assessFrameQuality(';
const hintPriorityEnd = src.indexOf(hintPriorityEndMarker, reasonMessagesStart);
assert.ok(reasonMessagesStart >= 0 && hintPriorityEnd > reasonMessagesStart, 'REASON_MESSAGES/pickRejectionHintKey must be structurally extractable');
const { pickRejectionHintKey, REASON_MESSAGES } = new Function(
  src.slice(reasonMessagesStart, hintPriorityEnd) + '\nreturn { pickRejectionHintKey, REASON_MESSAGES };'
)();

test('6. a detected face with [too_dark, too_close] selects hintTooClose under the new priority (was hintTooDark)', () => {
  assert.strictEqual(pickRejectionHintKey(['too_dark', 'too_close'], false), 'hintTooClose');
});

test('6b. [low_face_confidence, too_close] also selects hintTooClose — low-confidence guidance is lighting-flavored, not framing/safety', () => {
  assert.strictEqual(pickRejectionHintKey(['low_face_confidence', 'too_close'], false), 'hintTooClose');
});

test('6c. genuine framing/orientation and safety reasons still outrank too_close', () => {
  assert.strictEqual(pickRejectionHintKey(['head_tilted', 'too_close'], false), 'hintLookStraight');
  assert.strictEqual(pickRejectionHintKey(['head_turned', 'too_close'], false), 'hintLookStraight');
  assert.strictEqual(pickRejectionHintKey(['head_pitch', 'too_close'], false), 'hintLookStraight');
  assert.strictEqual(pickRejectionHintKey(['eyes_closed', 'too_close'], false), 'hintEyesClosed');
});

test('7. boxClipped (genuine center/edge framing) always wins over every reason, too_close included — unchanged from before', () => {
  assert.strictEqual(pickRejectionHintKey(['too_close'], true), 'hintCenterFace');
  assert.strictEqual(pickRejectionHintKey(['too_dark', 'too_close'], true), 'hintCenterFace');
  assert.strictEqual(pickRejectionHintKey([], true), 'hintCenterFace');
});

test('too_close alone still selects hintTooClose (no regression for the simple, single-reason case)', () => {
  assert.strictEqual(pickRejectionHintKey(['too_close'], false), 'hintTooClose');
});

test('reason combinations without too_close fall back to the original reasons[0]-order behavior, byte-for-byte unchanged', () => {
  // Inputs use assessFrameQuality's OWN real push order (low_face_confidence,
  // too_dark, too_bright, blurry, too_far) — the only order it can ever
  // actually produce; pickRejectionHintKey's non-too_close tail preserves
  // that exact relative order.
  assert.strictEqual(pickRejectionHintKey(['too_dark', 'blurry'], false), 'hintTooDark');
  assert.strictEqual(pickRejectionHintKey(['blurry'], false), 'hintBlurry');
  assert.strictEqual(pickRejectionHintKey(['low_face_confidence', 'too_dark'], false), 'hintLowConf');
  assert.strictEqual(pickRejectionHintKey(['too_far'], false), 'hintTooFar');
});

test('REASON_MESSAGES mapping itself is completely untouched by the priority change', () => {
  assert.deepStrictEqual(REASON_MESSAGES, {
    low_face_confidence: 'hintLowConf',
    head_tilted: 'hintLookStraight',
    head_turned: 'hintLookStraight',
    head_pitch: 'hintLookStraight',
    eyes_closed: 'hintEyesClosed',
    too_dark: 'hintTooDark',
    too_bright: 'hintTooBright',
    blurry: 'hintBlurry',
    too_far: 'hintTooFar',
    too_close: 'hintTooClose',
  });
});

// ------------------------------------------------------------
// 8. Existing detector config / thresholds / processing geometry /
// preview geometry / mirror behavior — assertion-equivalent unchanged.
// ------------------------------------------------------------
test('8a. assessFrameQuality (measurement order, both thresholds) is byte-for-byte unchanged by the hint-priority fix', () => {
  assert.ok(src.includes(
`    function assessFrameQuality({ detScore, headPose, leftEAR, rightEAR, brightness, sharpness, canvasWidth, boxWidth }) {
      const reasons = [];
      if (detScore < 0.6) reasons.push('low_face_confidence');
      if (Math.abs(headPose.roll) > 18) reasons.push('head_tilted');
      if (Math.abs(headPose.yawProxy) > 0.32) reasons.push('head_turned');
      if (headPose.pitchProxy < 0.25 || headPose.pitchProxy > 1.3) reasons.push('head_pitch');
      if (leftEAR < 0.15 || rightEAR < 0.15) reasons.push('eyes_closed');
      if (brightness < 45) reasons.push('too_dark');
      if (brightness > 235) reasons.push('too_bright');
      if (sharpness < 10) reasons.push('blurry');
      const faceRatio = boxWidth / Math.max(canvasWidth, 1);
      if (faceRatio < 0.16) reasons.push('too_far');
      if (faceRatio > 0.78) reasons.push('too_close');
      return { ok: reasons.length === 0, reasons };
    }`
  ), 'assessFrameQuality must be untouched: reasons[] push order is a measurement concern, never reordered by the hint-priority fix');
});

test('8b. faceRatio thresholds (>0.78 too_close, <0.16 too_far) occur exactly once each in the whole file — never duplicated/touched elsewhere', () => {
  assert.strictEqual((src.match(/faceRatio > 0\.78/g) || []).length, 1);
  assert.strictEqual((src.match(/faceRatio < 0\.16/g) || []).length, 1);
});

test('8c. TinyFaceDetector config (inputSize/scoreThreshold) and getUserMedia constraints are unchanged', () => {
  assert.strictEqual((src.match(/new faceapi\.TinyFaceDetectorOptions\(\{ inputSize: 320, scoreThreshold: 0\.5 \}\)/g) || []).length, 2);
  assert.ok(src.includes("navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })"));
});

test('8d. processing canvas geometry, drawVideoCover, and mirror semantics are untouched', () => {
  assert.ok(liveScanSource.includes('const scale = Math.min(1, 640 / video.videoWidth);'));
  assert.ok(liveScanSource.includes('canvas.width = Math.max(1, Math.round(video.videoWidth * scale));'));
  assert.ok(liveScanSource.includes('canvas.height = Math.max(1, Math.round(video.videoHeight * scale));'));
  assert.ok(src.includes('function drawVideoCover(ctx, video, dispW, dispH, mirrored) {'));
  assert.ok(liveScanSource.includes("const mirrored = facingModeRef.current === 'user';"));
});

test('8e. boxClipped framing-edge geometry (the only other input to hint selection) is unchanged', () => {
  assert.ok(liveScanSource.includes(
    "const boxClipped = det.detection.box.x < canvas.width*0.02 || det.detection.box.y < canvas.height*0.02 ||\n" +
    "            (det.detection.box.x + det.detection.box.width) > canvas.width*0.98 ||\n" +
    "            (det.detection.box.y + det.detection.box.height) > canvas.height*0.98;"
  ));
});

// ------------------------------------------------------------
// 9. Plain production URL / unrelated-state isolation — this fix is a
// real production behavior change (not gated behind ?cameraLayoutDebug),
// so "plain production URL" here means: it must not touch any state
// transition or system outside the exact too-close/no-detection sequence
// and hint-priority selection it targets.
// ------------------------------------------------------------
test('9a. camera lifecycle (init/cleanup/track-ended/scan-error) source is untouched by this fix', () => {
  assert.ok(liveScanSource.includes('let cancelled = false;'));
  assert.ok(liveScanSource.includes('track.onended = handleTrackEnded'));
  assert.ok(liveScanSource.includes("decideStage('stageScanError')"));
});

test('9b. this fix does not depend on cameraLayoutDebugEnabled — it changes real production UX for every user, gated only on real detection/quality state', () => {
  const graceLineIdx = liveScanSource.indexOf('const graceWindowMs = (lastDetRef.current && lastDetRef.current.tooClose)');
  const nearby = liveScanSource.slice(Math.max(0, graceLineIdx - 400), graceLineIdx);
  assert.ok(!/cameraLayoutDebugEnabled/.test(nearby.slice(-200)), 'the grace-window choice itself must not be conditioned on the debug flag');
  const hintLineIdx = liveScanSource.indexOf('const diagHintKey = pickRejectionHintKey(quality.reasons, boxClipped);');
  assert.ok(hintLineIdx > 0);
});

test('9c. DESIGN_CATALOG / recommendation engine source is unchanged (unrelated-system isolation)', () => {
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const digest = crypto.createHash('sha256').update(src.slice(catalogStart, catalogEnd)).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});
