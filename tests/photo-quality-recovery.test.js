'use strict';
// ============================================================
// PHOTO-ONLY QUALITY RECOVERY.
// ------------------------------------------------------------
// Real-device evidence (?photoQualityDebug=1) showed a real, fully-
// visible, frontal face (every landmark recovered by the existing
// Photo-only no_detection fallback; EAR/pose/brightness/sharpness all
// comfortably passing) still hard-rejected by assessFrameQuality
// purely on low_face_confidence and/or too_close -- two reasons that
// are pure detector-confidence/box-size PROXIES, not evidence that any
// real content is missing (see the read-only audit this fix responds
// to). PhotoAnalysisScreen's analyze() now computes a REAL geometric
// edge-touch check (the same 2%/98% margins Live Scan's own
// boxClipped already proves safe for its own hint-selection) and, only
// when EVERY reported reason is low_face_confidence/too_close AND the
// box does not actually touch the frame edge, proceeds instead of
// hard-blocking.
//
// assessFrameQuality itself, its thresholds, and LiveScanScreen's own
// call to it are completely unchanged -- extracted and eval'd verbatim
// here, never re-implemented (same string-extraction convention as the
// rest of this suite -- see photo-detection-fallback.test.js).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const photoStart = src.indexOf('    function PhotoAnalysisScreen(');
const photoEnd = src.indexOf('\n    function isPhotoQualityDebugEnabled(', photoStart);
assert.ok(photoStart >= 0 && photoEnd > photoStart, 'PhotoAnalysisScreen must be structurally extractable');
const photoBlock = src.slice(photoStart, photoEnd);

// ------------------------------------------------------------
// 1. assessFrameQuality is byte-for-byte unchanged.
// ------------------------------------------------------------
test('1. assessFrameQuality implementation is byte-identical to HEAD (and to the source of truth checked by photo-quality-debug.test.js)', () => {
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
  const HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  const curFn = src.slice(src.indexOf('    function assessFrameQuality('), src.indexOf('\n    }\n', src.indexOf('    function assessFrameQuality(')) + '\n    }\n'.length);
  const headFn = HEAD.slice(HEAD.indexOf('    function assessFrameQuality('), HEAD.indexOf('\n    }\n', HEAD.indexOf('    function assessFrameQuality(')) + '\n    }\n'.length);
  assert.strictEqual(curFn, headFn, 'assessFrameQuality must be byte-identical to git HEAD');
});

// ------------------------------------------------------------
// 2. LiveScanScreen's own assessFrameQuality call site and boxClipped
// computation are byte-identical to HEAD -- untouched by this
// Photo-only fix.
// ------------------------------------------------------------
test('2. LiveScanScreen quality call site and its own boxClipped are byte-identical to git HEAD', () => {
  const HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  const marker = 'function LiveScanScreen(';
  const curStart = src.indexOf(marker), headStart = HEAD.indexOf(marker);
  assert.ok(curStart >= 0 && headStart >= 0);
  const qualityCallMarker = "          const quality = assessFrameQuality({\n            detScore: det.detection.score, headPose, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n            brightness, sharpness, canvasWidth: canvas.width, boxWidth: det.detection.box.width,\n          });";
  assert.ok(src.indexOf(qualityCallMarker, curStart) >= 0, 'LiveScanScreen quality call must be present, byte-identical, in the current source');
  assert.ok(HEAD.indexOf(qualityCallMarker, headStart) >= 0, 'LiveScanScreen quality call must be present, byte-identical, at git HEAD');
  const boxClippedMarker = 'const boxClipped = det.detection.box.x < canvas.width*0.02 || det.detection.box.y < canvas.height*0.02 ||\n            (det.detection.box.x + det.detection.box.width) > canvas.width*0.98 ||\n            (det.detection.box.y + det.detection.box.height) > canvas.height*0.98;';
  assert.ok(src.indexOf(boxClippedMarker, curStart) >= 0, 'LiveScanScreen boxClipped must be present, byte-identical, in the current source (this fix must never modify or refactor it)');
  assert.ok(HEAD.indexOf(boxClippedMarker, headStart) >= 0, 'LiveScanScreen boxClipped must be present, byte-identical, at git HEAD');
});

// ------------------------------------------------------------
// Extract the recovery-decision snippet in isolation: pure computation
// on det/canvas/quality/leftEye/rightEye/physicalLeft/physicalRight,
// no React/DOM dependency, no side effects -- eval'd directly to get
// { photoEdgeClipped, requiredEyeRegionClipped, clippedTop,
// clippedBottom, clippedLeft, clippedRight, photoQualityRecovered,
// photoQualityProceeds } as outputs.
// ------------------------------------------------------------
const recoveryStartMarker = 'const photoEdgeClipped = det.detection.box.x';
const recoveryStart = photoBlock.indexOf(recoveryStartMarker);
assert.ok(recoveryStart >= 0, 'the recovery-decision snippet must be structurally extractable');
const recoveryEndMarker = 'const photoQualityProceeds = quality.ok || photoQualityRecovered;';
const recoveryEndIdx = photoBlock.indexOf(recoveryEndMarker, recoveryStart);
assert.ok(recoveryEndIdx > recoveryStart);
const recoverySnippet = photoBlock.slice(recoveryStart, recoveryEndIdx + recoveryEndMarker.length);

function runRecoveryDecision({ det, canvas, quality, leftEye, rightEye, physicalLeft, physicalRight }) {
  const fn = new Function('det', 'canvas', 'quality', 'leftEye', 'rightEye', 'physicalLeft', 'physicalRight',
    recoverySnippet + '\nreturn { photoEdgeClipped, requiredEyeRegionClipped, clippedTop, clippedBottom, clippedLeft, clippedRight, photoQualityRecovered, photoQualityProceeds };');
  return fn(det, canvas, quality, leftEye, rightEye, physicalLeft, physicalRight);
}

// A comfortably non-edge-touching GENERIC box: x:[200,500], y:[200,500]
// inside a 900x1200 canvas -- well within the 2%/98% margins. Used only
// for photoEdgeClipped (diagnostic-only) fixtures below; the recovery
// gate itself no longer reads this box.
const CANVAS = { width: 900, height: 1200 };
const SAFE_BOX = { x: 200, y: 200, width: 300, height: 300 };
const det = (box = SAFE_BOX) => ({ detection: { box } });

// Mock 6-point eye contours / 5-point brow contours -- same shape and
// margin convention as photo-quality-debug.test.js's mockEye/mockBrow,
// comfortably centered by default (safe = requiredEyeRegionClipped
// false) so a test only needs to override the ONE side it's probing.
const mockEye = (cx, cy) => [
  { x: cx - 20, y: cy }, { x: cx - 10, y: cy - 6 }, { x: cx + 10, y: cy - 6 },
  { x: cx + 20, y: cy }, { x: cx + 10, y: cy + 6 }, { x: cx - 10, y: cy + 6 },
];
const mockBrow = (cx, cy) => [
  { x: cx - 22, y: cy }, { x: cx - 11, y: cy - 4 }, { x: cx, y: cy - 6 },
  { x: cx + 11, y: cy - 4 }, { x: cx + 22, y: cy },
];
const SAFE_LEFT_EYE = mockEye(300, 310), SAFE_LEFT_BROW = mockBrow(300, 280);
const SAFE_RIGHT_EYE = mockEye(600, 310), SAFE_RIGHT_BROW = mockBrow(600, 280);
const safeEyes = () => ({
  leftEye: SAFE_LEFT_EYE, rightEye: SAFE_RIGHT_EYE,
  physicalLeft: { brow: SAFE_LEFT_BROW }, physicalRight: { brow: SAFE_RIGHT_BROW },
});

test('3. the Photo recovery allowlist is exactly low_face_confidence and too_close -- no other reason is ever eligible', () => {
  const allReasons = ['low_face_confidence', 'head_tilted', 'head_turned', 'head_pitch', 'eyes_closed', 'too_dark', 'too_bright', 'blurry', 'too_far', 'too_close'];
  const allowlisted = ['low_face_confidence', 'too_close'];
  for (const reason of allReasons) {
    const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: [reason] }, ...safeEyes() });
    const shouldRecover = allowlisted.includes(reason);
    assert.strictEqual(result.photoQualityRecovered, shouldRecover, `reason "${reason}" recovery eligibility must be ${shouldRecover}`);
  }
});

test('4. low_face_confidence + too_close together, required eye regions intact => proceeds', () => {
  const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['low_face_confidence', 'too_close'] }, ...safeEyes() });
  assert.strictEqual(result.requiredEyeRegionClipped, false);
  assert.strictEqual(result.photoQualityRecovered, true);
  assert.strictEqual(result.photoQualityProceeds, true);
});

test('5. low_face_confidence alone, required eye regions intact => proceeds', () => {
  const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['low_face_confidence'] }, ...safeEyes() });
  assert.strictEqual(result.photoQualityRecovered, true);
  assert.strictEqual(result.photoQualityProceeds, true);
});

test('6. too_close alone, required eye regions intact => proceeds', () => {
  const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] }, ...safeEyes() });
  assert.strictEqual(result.photoQualityRecovered, true);
  assert.strictEqual(result.photoQualityProceeds, true);
});

test('7. CORE AUDIT FINDING: the generic face-detector box is genuinely edge-clipped (photoEdgeClipped=true), but BOTH required eye/periocular regions are intact => recovery still proceeds', () => {
  // Box touches the right edge: x + width = 900 = canvas.width (>98% margin) --
  // this is exactly the real-device shape (a tight beauty/lash portrait
  // whose generic forehead/jaw/ear box overshoots the frame while both
  // eyes remain fully visible).
  const clippedBox = { x: 600, y: 200, width: 300, height: 300 };
  const result = runRecoveryDecision({ det: det(clippedBox), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] }, ...safeEyes() });
  assert.strictEqual(result.photoEdgeClipped, true, 'the generic face box IS clipped in this fixture (diagnostic-only, no longer gates recovery)');
  assert.strictEqual(result.requiredEyeRegionClipped, false, 'the real required eye regions are NOT clipped');
  assert.strictEqual(result.photoQualityRecovered, true, 'recovery must proceed -- generic box clipping alone must never block it');
  assert.strictEqual(result.photoQualityProceeds, true);
});

test('7b. genuinely LEFT required-eye-region clipping (left eye pushed to the frame edge) hard-rejects, even though the generic face box and every reason are otherwise fine', () => {
  const clippedLeftEye = mockEye(20, 310), clippedLeftBrow = mockBrow(20, 280);
  const result = runRecoveryDecision({
    det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] },
    leftEye: clippedLeftEye, rightEye: SAFE_RIGHT_EYE,
    physicalLeft: { brow: clippedLeftBrow }, physicalRight: { brow: SAFE_RIGHT_BROW },
  });
  assert.strictEqual(result.clippedLeft, true, 'the LEFT eye/periocular region must be detected as touching the frame\'s left edge');
  assert.strictEqual(result.requiredEyeRegionClipped, true);
  assert.strictEqual(result.photoQualityRecovered, false, 'genuine left-eye-region clipping must deny recovery');
  assert.strictEqual(result.photoQualityProceeds, false);
});

test('7c. genuinely RIGHT required-eye-region clipping (right eye pushed to the frame edge) hard-rejects', () => {
  const clippedRightEye = mockEye(880, 310), clippedRightBrow = mockBrow(880, 280);
  const result = runRecoveryDecision({
    det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['low_face_confidence'] },
    leftEye: SAFE_LEFT_EYE, rightEye: clippedRightEye,
    physicalLeft: { brow: SAFE_LEFT_BROW }, physicalRight: { brow: clippedRightBrow },
  });
  assert.strictEqual(result.clippedRight, true, 'the RIGHT eye/periocular region must be detected as touching the frame\'s right edge');
  assert.strictEqual(result.requiredEyeRegionClipped, true);
  assert.strictEqual(result.photoQualityRecovered, false, 'genuine right-eye-region clipping must deny recovery');
  assert.strictEqual(result.photoQualityProceeds, false);
});

test('7d. top and bottom edges of the required region are independently detected too (vertical clipping, e.g. brow/lower-lid cut off by a very tight crop)', () => {
  const topEye = mockEye(300, 40), topBrow = mockBrow(300, 10);
  const topResult = runRecoveryDecision({
    det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] },
    leftEye: topEye, rightEye: SAFE_RIGHT_EYE,
    physicalLeft: { brow: topBrow }, physicalRight: { brow: SAFE_RIGHT_BROW },
  });
  assert.strictEqual(topResult.clippedTop, true);
  assert.strictEqual(topResult.requiredEyeRegionClipped, true);
  assert.strictEqual(topResult.photoQualityRecovered, false);

  const bottomEye = mockEye(300, 1180), bottomBrow = mockBrow(300, 1150);
  const bottomResult = runRecoveryDecision({
    det: det(), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] },
    leftEye: bottomEye, rightEye: SAFE_RIGHT_EYE,
    physicalLeft: { brow: bottomBrow }, physicalRight: { brow: SAFE_RIGHT_BROW },
  });
  assert.strictEqual(bottomResult.clippedBottom, true);
  assert.strictEqual(bottomResult.requiredEyeRegionClipped, true);
  assert.strictEqual(bottomResult.photoQualityRecovered, false);
});

test('7e. photoEdgeClipped (generic face-box, diagnostic-only) still independently reports each edge, reusing Live Scan\'s own proven 2%/98% margins -- untouched by this fix', () => {
  const cases = {
    left: { x: 0, y: 200, width: 300, height: 300 },
    top: { x: 200, y: 0, width: 300, height: 300 },
    right: { x: 601, y: 200, width: 300, height: 300 },
    bottom: { x: 200, y: 901, width: 300, height: 300 },
  };
  for (const [edge, box] of Object.entries(cases)) {
    const result = runRecoveryDecision({ det: det(box), canvas: CANVAS, quality: { ok: false, reasons: ['too_close'] }, ...safeEyes() });
    assert.strictEqual(result.photoEdgeClipped, true, `${edge}-edge generic box must still be detected as clipped (diagnostic only)`);
    assert.strictEqual(result.requiredEyeRegionClipped, false, `${edge}-edge GENERIC box clipping alone must not clip the real required region`);
  }
});

const OTHER_REASONS = ['head_tilted', 'head_turned', 'head_pitch', 'eyes_closed', 'too_dark', 'too_bright', 'blurry', 'too_far'];
test('8. every other individual quality reason still hard-rejects Photo (never eligible for recovery), even with required eye regions intact', () => {
  for (const reason of OTHER_REASONS) {
    const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: [reason] }, ...safeEyes() });
    assert.strictEqual(result.photoQualityRecovered, false, `"${reason}" alone must never be recoverable`);
    assert.strictEqual(result.photoQualityProceeds, false, `"${reason}" alone must still hard-reject`);
  }
});

test('9. a mix of an allowlisted reason with ANY non-allowlisted reason still hard-rejects -- no partial credit', () => {
  for (const other of OTHER_REASONS) {
    for (const allowlisted of ['low_face_confidence', 'too_close']) {
      const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: false, reasons: [allowlisted, other] }, ...safeEyes() });
      assert.strictEqual(result.photoQualityRecovered, false, `[${allowlisted}, ${other}] must not be recoverable`);
      assert.strictEqual(result.photoQualityProceeds, false, `[${allowlisted}, ${other}] must still hard-reject`);
    }
  }
});

test('10. quality.ok=true short-circuits recovery entirely (recovery is only ever evaluated for an actual rejection)', () => {
  const result = runRecoveryDecision({ det: det(), canvas: CANVAS, quality: { ok: true, reasons: [] }, ...safeEyes() });
  assert.strictEqual(result.photoQualityRecovered, false);
  assert.strictEqual(result.photoQualityProceeds, true, 'a real pass must still proceed, via quality.ok, not recovery');
});

test('11. quality.ok/quality.reasons are never rewritten by the recovery decision -- the real assessFrameQuality verdict stays intact', () => {
  const quality = { ok: false, reasons: ['too_close'] };
  runRecoveryDecision({ det: det(), canvas: CANVAS, quality, ...safeEyes() });
  assert.strictEqual(quality.ok, false, 'quality.ok must not be mutated to true');
  assert.deepStrictEqual(quality.reasons, ['too_close'], 'quality.reasons must not be mutated');
});

// ------------------------------------------------------------
// Preserve quality degradation: imageQuality still multiplies in the
// REAL (possibly low) det.detection.score unconditionally -- a
// recovered marginal photo's reported confidence must still reflect
// that it was marginal, never silently upgraded to "perfect".
// ------------------------------------------------------------
test('12. imageQuality is still computed from the real det.detection.score, unconditionally, for a recovered photo -- source-level proof the formula is untouched', () => {
  const marker = 'const imageQuality = clamp01(det.detection.score * (1 - Math.min(1, Math.abs(headPose.roll)/30)) * (1 - Math.min(1, Math.abs(headPose.yawProxy)/0.4)));';
  assert.ok(photoBlock.includes(marker), 'imageQuality formula must be byte-identical -- no special-cased "recovered" branch');
  // It must appear strictly AFTER the recovery decision and the final
  // hard-block line -- i.e. only on the path that actually proceeds,
  // exactly as before this fix (recovery does not skip past it or feed
  // it a synthetic/boosted score).
  const recoveryIdx = photoBlock.indexOf(recoveryEndMarker);
  const hardBlockIdx = photoBlock.indexOf("if (!photoQualityProceeds) { setState('error'); return; }");
  const imageQualityIdx = photoBlock.indexOf(marker);
  assert.ok(recoveryIdx < hardBlockIdx && hardBlockIdx < imageQualityIdx, 'imageQuality must be computed after the recovery decision and the hard-block check, on the proceeding path only');
});

test('13. functional proof: a marginal (low detScore) recovered photo yields a LOWER imageQuality than an equivalent strong-detection photo -- degradation is real, not bypassed', () => {
  const marker = 'const imageQuality = clamp01(det.detection.score * (1 - Math.min(1, Math.abs(headPose.roll)/30)) * (1 - Math.min(1, Math.abs(headPose.yawProxy)/0.4)));';
  const start = photoBlock.indexOf(marker);
  assert.ok(start >= 0);
  const snippet = photoBlock.slice(start, start + marker.length) + '\nreturn imageQuality;';
  const computeImageQuality = (detScore, headPose) => new Function('det', 'headPose', 'clamp01', snippet)(
    { detection: { score: detScore } }, headPose, v => Math.max(0, Math.min(1, v))
  );
  const headPose = { roll: 3.0, yawProxy: 0.05 };
  const marginal = computeImageQuality(0.503, headPose); // the real device's own low detScore
  const strong = computeImageQuality(0.95, headPose);
  assert.ok(marginal < strong, `a recovered marginal detScore (0.503) must yield lower imageQuality (${marginal}) than a strong detection (0.95 -> ${strong})`);
  assert.ok(marginal > 0, 'imageQuality must degrade, never zero out, a recovered photo');
});

// ------------------------------------------------------------
// 10 (E2E requirement mirrored at unit level): the primary detection
// and 1600/608 fallback machinery from the prior phase are completely
// unaffected by this addition.
// ------------------------------------------------------------
test('14. existing primary Photo detection (900px/416) and bounded fallback (1600px/608) call sites are unchanged', () => {
  assert.ok(photoBlock.includes("let { canvas, ctx, scale } = buildAnalysisCanvas(900);"));
  assert.ok(photoBlock.includes("new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })"));
  assert.ok(photoBlock.includes('const PHOTO_FALLBACK_MAX_W = 1600;'));
  assert.ok(photoBlock.includes("new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 })"));
  const inputSizes = [...photoBlock.matchAll(/inputSize:\s*(\d+)/g)].map(m => Number(m[1]));
  assert.deepStrictEqual(inputSizes, [416, 608], 'exactly the primary and one bounded fallback attempt, unchanged');
  const thresholds = [...photoBlock.matchAll(/scoreThreshold:\s*([\d.]+)/g)].map(m => m[1]);
  assert.deepStrictEqual(thresholds, ['0.5', '0.5'], 'scoreThreshold must remain 0.5 in both attempts');
});

// ------------------------------------------------------------
// No bypass: a recovered photo continues through the SAME downstream
// pipeline -- no duplicate code path, no synthetic landmarks.
// ------------------------------------------------------------
test('15. no duplicate/synthetic downstream path exists for a recovered photo -- there is exactly one real onComplete/classifyFeatures/rankDesigns call site in PhotoAnalysisScreen', () => {
  assert.strictEqual((photoBlock.match(/^\s*onComplete\(photoRec\);\s*$/gm) || []).length, 1, 'exactly one real onComplete(photoRec) call -- no special recovered-photo path');
  assert.strictEqual((photoBlock.match(/classifyFeatures\(aggregated,/g) || []).length, 1, 'exactly one real classifyFeatures call');
  assert.strictEqual((photoBlock.match(/rankDesigns\(classified, lang\)/g) || []).length, 1, 'exactly one real rankDesigns call');
  assert.ok(!photoBlock.includes('fabricat'), 'no fabricated-landmark/quality machinery must exist');
});

test('16. no forbidden data in the recovery mechanism itself -- source-level check for the two new fields exposed via debug', () => {
  assert.ok(photoBlock.includes('photoRecoveryEligible: photoQualityRecovered,'));
  assert.ok(photoBlock.includes('photoRecoveryApplied: photoQualityRecovered,'));
});

// ------------------------------------------------------------
// Isolation from unrelated production systems (same convention as
// photo-detection-fallback.test.js / photo-quality-debug.test.js).
// ------------------------------------------------------------
test('17. Live Scan, Iris, recommendation/scoring, Lash Map, Client Store, VisitSnapshot, Results Hero production files are untouched', () => {
  for (const file of ['lash-scan-core.js', 'lash-design-domain.js', 'professional-lash-library.js', 'client-store.js', 'visit-snapshot.js', 'consent-manager.js', 'client-data-consent.js', 'analytics.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});
