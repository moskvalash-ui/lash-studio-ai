'use strict';
// ============================================================
// PHOTO-ONLY NO_DETECTION FALLBACK.
// ------------------------------------------------------------
// Real-device evidence (?photoQualityDebug=1) showed a real, large,
// frontal, clearly-visible beauty/lash portrait still returning
// no_detection on Photo Analysis's PRIMARY detection attempt (a 900px-
// capped canvas, TinyFaceDetector inputSize:416, scoreThreshold:0.5).
// PhotoAnalysisScreen's analyze() now retries ONCE, only when the
// primary attempt finds nothing, at a bounded larger resolution
// (1600px-capped canvas, inputSize:608) -- same model, same
// scoreThreshold (0.5, unchanged). This file proves the NEW
// buildAnalysisCanvas()+fallback block in isolation, extracted
// verbatim and eval'd against a mocked faceapi/document (same
// string-extraction convention as the rest of this suite -- see
// photo-quality-debug.test.js) -- never re-implementing the logic.
//
// What this file does NOT re-prove (already covered elsewhere):
// - the final no_detection diagnostic shape/gating -> photo-quality-
//   debug.test.js tests 2a/2b (unchanged by this fix -- see below).
// - assessFrameQuality itself and the quality-evaluated diagnostic
//   branch -> photo-quality-debug.test.js tests 3-13 (this fix's code
//   sits entirely BEFORE those, and never touches them).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const photoStart = src.indexOf('    function PhotoAnalysisScreen(');
const photoEnd = src.indexOf('\n    function isPhotoQualityDebugEnabled(', photoStart);
assert.ok(photoStart >= 0 && photoEnd > photoStart, 'PhotoAnalysisScreen must be structurally extractable');
const photoBlock = src.slice(photoStart, photoEnd);

// ------------------------------------------------------------
// Extract the detection-with-fallback block: from buildAnalysisCanvas's
// declaration through the end of the bounded fallback's own `if (!det)`
// block -- stops BEFORE the separate, untouched final no_detection
// diagnostic block (which stays exactly as it always has been).
// ------------------------------------------------------------
const blockStartMarker = 'const buildAnalysisCanvas = (maxW) => {';
const blockStart = photoBlock.indexOf(blockStartMarker);
assert.ok(blockStart >= 0, 'buildAnalysisCanvas must be structurally extractable');
const blockEndMarker = 'canvas = fb.canvas; ctx = fb.ctx; scale = fb.scale; det = fallbackDet;\n            }\n          }';
const blockEndIdx = photoBlock.indexOf(blockEndMarker, blockStart);
assert.ok(blockEndIdx > blockStart, 'the bounded fallback block must be structurally extractable');
const detectionBlock = photoBlock.slice(blockStart, blockEndIdx + blockEndMarker.length);

// Sanity: this snippet must never reference the final diagnostic/hard-
// block code (that stays a wholly separate, untouched region).
assert.ok(!detectionBlock.includes('photoQualityDebugEnabled'), 'the extracted detection+fallback block must not reach into the separate diagnostic branch');
assert.ok(!detectionBlock.includes("setState('error')"), 'the extracted detection+fallback block must not reach into the separate hard-block branch');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Minimal DOM/face-api mocks. Every mock canvas is tagged with a
// human-readable __id so tests can assert exactly which attempt's
// canvas ended up as the active one, by reference -- not by
// re-deriving expected dimensions and hoping they happen to differ.
function makeMocks({ imgWidth, imgHeight, detectResults }) {
  const img = { width: imgWidth, height: imgHeight };
  const createdCanvases = [];
  const document = {
    createElement: () => {
      const c = {
        width: 0, height: 0,
        __id: createdCanvases.length === 0 ? 'primary' : 'fallback',
        getContext: () => ({ drawImage: () => {} }),
      };
      createdCanvases.push(c);
      return c;
    },
  };
  const detectCalls = [];
  const faceapi = {
    TinyFaceDetectorOptions: function (opts) { return { ...opts, __isTinyFaceDetectorOptions: true }; },
    detectSingleFace: (canvasArg, options) => {
      const callIndex = detectCalls.length;
      detectCalls.push({ canvas: canvasArg, options });
      return { withFaceLandmarks: async () => detectResults[callIndex] };
    },
  };
  return { img, document, faceapi, detectCalls, createdCanvases };
}

async function runDetectionWithFallback(mocks) {
  const body = detectionBlock + '\nreturn { canvas, ctx, scale, det };';
  // PHOTO SCAN VISUAL LAYER: the real detection+fallback block now
  // contains two `if (cancelledRef.current) return;` unmount-safety
  // guards (see tests/photo-scan-visual-layer.test.js for the real,
  // unmodified-code proof of those). This is a real reference this
  // extracted snippet needs in scope -- a plain, never-cancelled stub
  // is the correct mock here, since THIS file's own job is proving the
  // fallback logic, not cancellation (already covered elsewhere).
  const fn = new AsyncFunction('img', 'document', 'faceapi', 'cancelledRef', body);
  return fn(mocks.img, mocks.document, mocks.faceapi, { current: false });
}

// A native iPhone-portrait-like source: wide enough that BOTH the
// primary (900) and fallback (1600) caps actually downscale it, so
// each attempt's canvas dimensions are unambiguous and distinct.
const NATIVE = { imgWidth: 3000, imgHeight: 4000 };

test('1. primary success: fallback is never invoked, and the returned canvas/det are the primary (900px/416) attempt\'s own', async () => {
  const primaryDet = { detection: { score: 0.9, box: { width: 400 } }, landmarks: { fake: 'primary' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [primaryDet] });
  const result = await runDetectionWithFallback(mocks);

  assert.strictEqual(mocks.detectCalls.length, 1, 'fallback detectSingleFace must never be called when the primary attempt already found a face');
  assert.strictEqual(result.canvas.__id, 'primary');
  assert.strictEqual(result.canvas.width, 900, 'primary canvas must still be capped at exactly 900px, unchanged');
  assert.strictEqual(result.canvas.height, 1200);
  assert.strictEqual(result.scale, 900 / 3000);
  assert.strictEqual(result.det, primaryDet);
  assert.strictEqual(mocks.detectCalls[0].options.inputSize, 416, 'primary inputSize must stay exactly 416, unchanged');
  assert.strictEqual(mocks.detectCalls[0].options.scoreThreshold, 0.5, 'primary scoreThreshold must stay exactly 0.5, unchanged');
});

test('2. fallback recovery: primary no_detection, fallback (1600px/608) succeeds -> the recovered face becomes the active detection', async () => {
  const fallbackDet = { detection: { score: 0.72, box: { width: 900 } }, landmarks: { fake: 'fallback' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [null, fallbackDet] });
  const result = await runDetectionWithFallback(mocks);

  assert.strictEqual(mocks.detectCalls.length, 2, 'the bounded fallback must run exactly once after a primary no_detection');
  assert.strictEqual(result.det, fallbackDet);
  assert.strictEqual(mocks.detectCalls[1].options.inputSize, 608, 'fallback inputSize must be exactly 608 (the next TinyYolov2 size step above 416)');
  assert.strictEqual(mocks.detectCalls[1].options.scoreThreshold, 0.5, 'fallback scoreThreshold must stay exactly 0.5 -- never relaxed');
});

test('3. exact chosen fallback dimension: the fallback canvas is capped at exactly 1600px wide, not native/unrestricted and not merely larger-than-900', async () => {
  const fallbackDet = { detection: { score: 0.72, box: { width: 900 } }, landmarks: { fake: 'fallback' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [null, fallbackDet] });
  const result = await runDetectionWithFallback(mocks);

  assert.strictEqual(result.canvas.width, 1600, 'PHOTO_FALLBACK_MAX_W must be exactly 1600 -- documented bound, not native (3000) and not the primary\'s 900');
  assert.strictEqual(result.canvas.height, Math.round(4000 * (1600 / 3000)));
  assert.strictEqual(result.scale, 1600 / 3000);
});

test('4. coordinate consistency: on fallback success, canvas/ctx/scale/det are ALL reassigned together to the SAME fallback build -- never a mix of primary canvas with fallback det, or vice versa', async () => {
  const fallbackDet = { detection: { score: 0.72, box: { width: 900 } }, landmarks: { fake: 'fallback' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [null, fallbackDet] });
  const result = await runDetectionWithFallback(mocks);

  // The canvas actually passed to the SECOND detectSingleFace call must
  // be the exact same object reference returned as the active canvas --
  // proving det/canvas/ctx/scale all came from one consistent build,
  // not an explicit (and therefore riskier) coordinate remap.
  assert.strictEqual(result.canvas, mocks.detectCalls[1].canvas, 'the active canvas must be the literal object the successful detectSingleFace call ran against');
  assert.strictEqual(result.canvas.__id, 'fallback');
  assert.notStrictEqual(result.canvas, mocks.createdCanvases[0], 'the active canvas must not be the discarded primary canvas');
});

test('5. both attempts fail: det stays null, and the active canvas/scale remain the PRIMARY ones (no partial/broken reassignment)', async () => {
  const mocks = makeMocks({ ...NATIVE, detectResults: [null, null] });
  const result = await runDetectionWithFallback(mocks);

  assert.strictEqual(mocks.detectCalls.length, 2, 'both the primary and the one bounded fallback attempt must run');
  assert.strictEqual(result.det, null);
  assert.strictEqual(result.canvas.__id, 'primary', 'a failed fallback must never leave canvas/ctx/scale partially reassigned');
  assert.strictEqual(result.canvas.width, 900);
  assert.strictEqual(result.scale, 900 / 3000);
});

test('6. no second face-detection model is introduced -- both attempts construct options via the SAME faceapi.TinyFaceDetectorOptions', async () => {
  const fallbackDet = { detection: { score: 0.72, box: { width: 900 } }, landmarks: { fake: 'fallback' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [null, fallbackDet] });
  await runDetectionWithFallback(mocks);

  assert.ok(mocks.detectCalls.every(c => c.options.__isTinyFaceDetectorOptions), 'every attempt must build its options via faceapi.TinyFaceDetectorOptions, never a different constructor');
});

test('7. a photo that never needed the fallback still builds only ONE canvas -- the discarded-fallback-canvas machinery never runs when unnecessary', async () => {
  const primaryDet = { detection: { score: 0.9, box: { width: 400 } }, landmarks: { fake: 'primary' } };
  const mocks = makeMocks({ ...NATIVE, detectResults: [primaryDet] });
  await runDetectionWithFallback(mocks);

  assert.strictEqual(mocks.createdCanvases.length, 1, 'buildAnalysisCanvas must be called exactly once when the primary attempt already succeeds');
});

// ------------------------------------------------------------
// Source-level regression guards.
// ------------------------------------------------------------
test('8. scoreThreshold is exactly 0.5 at both Photo Analysis detection sites, and nowhere is it any other value', () => {
  const thresholds = [...photoBlock.matchAll(/scoreThreshold:\s*([\d.]+)/g)].map(m => m[1]);
  assert.deepStrictEqual(thresholds, ['0.5', '0.5'], 'Photo Analysis must have exactly two detectSingleFace call sites (primary + fallback), both scoreThreshold 0.5 -- never relaxed as part of this fix');
});

test('9. inputSize progression is exactly 416 (primary, unchanged) then 608 (fallback) -- never any other value', () => {
  const inputSizes = [...photoBlock.matchAll(/inputSize:\s*(\d+)/g)].map(m => Number(m[1]));
  assert.deepStrictEqual(inputSizes, [416, 608]);
});

test('10. exactly one bounded fallback attempt exists -- only two faceapi.detectSingleFace call sites in PhotoAnalysisScreen', () => {
  const occurrences = (photoBlock.match(/faceapi\.detectSingleFace\(/g) || []).length;
  assert.strictEqual(occurrences, 2, 'exactly the primary attempt and the ONE bounded fallback -- no unbounded retry loop');
});

test('11. no new face-detection model is loaded -- faceapi.nets usage across the whole file is unchanged (still only tinyFaceDetector + faceLandmark68Net)', () => {
  const netsLoaded = [...src.matchAll(/faceapi\.nets\.(\w+)\.load/g)].map(m => m[1]);
  assert.deepStrictEqual(netsLoaded, ['tinyFaceDetector', 'faceLandmark68Net'], 'this fix must not introduce SsdMobilenetv1, MTCNN, or any other model');
});

test('12. Live Scan\'s own detection call/options are byte-identical to git HEAD -- untouched by this Photo-only fix', () => {
  const { execSync } = require('node:child_process');
  const HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  const marker = 'function LiveScanScreen(';
  const curStart = src.indexOf(marker);
  const headStart = HEAD.indexOf(marker);
  assert.ok(curStart >= 0 && headStart >= 0);
  const detLine = "const det = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks();";
  const curDetIdx = src.indexOf(detLine, curStart);
  const headDetIdx = HEAD.indexOf(detLine, headStart);
  assert.ok(curDetIdx >= 0, 'LiveScanScreen\'s detectSingleFace call (inputSize:320, scoreThreshold:0.5) must be present, byte-identical, in the current source');
  assert.ok(headDetIdx >= 0, 'LiveScanScreen\'s detectSingleFace call (inputSize:320, scoreThreshold:0.5) must be present, byte-identical, at git HEAD');
});

test('13. assessFrameQuality is byte-for-byte unchanged by this Photo-only fix', () => {
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
  ));
});

test('14. the recovered (fallback) detection still flows into the SAME, unmodified assessFrameQuality call -- no bypass path exists', () => {
  // The quality-gate call site references canvas/det/leftMetrics/
  // rightMetrics generically (not "primaryCanvas" or "fallbackCanvas"),
  // proving there is exactly one downstream pipeline that both a
  // primary and a fallback detection feed into identically.
  const qualityCallMarker = 'const quality = assessFrameQuality({\n            detScore: det.detection.score, headPose, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n            brightness, sharpness, canvasWidth: canvas.width, boxWidth: det.detection.box.width,\n          });';
  assert.ok(photoBlock.includes(qualityCallMarker), 'assessFrameQuality must still be called with the plain canvas/det bindings -- whichever attempt produced them');
  // And there is no separate "if (usedFallback) skip quality" branch.
  assert.ok(!photoBlock.includes('usedFallback'), 'no fallback-specific bypass flag must exist anywhere in PhotoAnalysisScreen');
});
