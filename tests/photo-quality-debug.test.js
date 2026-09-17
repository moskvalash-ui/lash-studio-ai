'use strict';
// ============================================================
// PHOTO QUALITY DEBUG — ?photoQualityDebug=1 diagnostic panel.
// ------------------------------------------------------------
// PhotoAnalysisScreen is a JSX closure, not requirable/executable
// directly in Node without a build step — same structural/string-
// extraction convention already used throughout this suite (see
// results-hero.test.js, live-scan-close-face-recovery.test.js). The
// three diagnostic-construction snippets this phase adds are pure
// object-literal-building code with no JSX/DOM dependency, so each is
// extracted verbatim and eval'd directly against injected mock inputs
// — proving the EXACT mapping formulas (e.g. leftEAR: leftMetrics.ear)
// rather than re-implementing them. Real-browser rendering/behavior
// proof lives in tests/e2e/photo-quality-debug.spec.js.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// isPhotoQualityDebugEnabled/PhotoQualityDebugPanel are defined
// immediately AFTER PhotoAnalysisScreen's own closing brace (not
// before it) — deliberately, so they never land inside any other
// screen's byte-identical-to-HEAD guard span (several existing tests,
// e.g. camera-preview.test.js and consent-manager.test.js's J1, treat
// "the function immediately preceding PhotoAnalysisScreen" as the end
// of LiveScanScreen/NaturalLashScanScreen).
const photoStart = src.indexOf('    function PhotoAnalysisScreen(');
const photoEnd = src.indexOf('\n    function isPhotoQualityDebugEnabled(', photoStart);
assert.ok(photoStart >= 0 && photoEnd > photoStart, 'PhotoAnalysisScreen must be structurally extractable');
const photoBlock = src.slice(photoStart, photoEnd);

// ------------------------------------------------------------
// isPhotoQualityDebugEnabled — extracted and eval'd verbatim.
// ------------------------------------------------------------
const enabledStart = src.indexOf('    function isPhotoQualityDebugEnabled() {');
const enabledEnd = src.indexOf('\n    }', enabledStart) + '\n    }'.length;
assert.ok(enabledStart >= photoEnd, 'isPhotoQualityDebugEnabled must be defined immediately after PhotoAnalysisScreen');
// The real function reads the global `window` directly (no parameter of
// its own) — each call must get a FRESH closure over the desired mock
// window, not one function reused with a baked-in value.
function withSearch(search) {
  return new Function('window', src.slice(enabledStart, enabledEnd) + '\nreturn isPhotoQualityDebugEnabled();')({ location: { search } });
}

test('1a. plain URL: isPhotoQualityDebugEnabled is false (no query, or unrelated query)', () => {
  assert.strictEqual(withSearch(''), false);
  assert.strictEqual(withSearch('?debug=1'), false);
  assert.strictEqual(withSearch('?cameraLayoutDebug=1'), false);
});

test('1b. ?photoQualityDebug=0 and any non-"1" value are false; only exactly "1" is true', () => {
  assert.strictEqual(withSearch('?photoQualityDebug=0'), false);
  assert.strictEqual(withSearch('?photoQualityDebug=true'), false);
  assert.strictEqual(withSearch('?photoQualityDebug=1'), true);
});

// ------------------------------------------------------------
// PART A — the no-detection diagnostic branch.
// ------------------------------------------------------------
const noDetStartMarker = 'if (!det) {\n            if (photoQualityDebugEnabled) {';
const noDetStart = photoBlock.indexOf(noDetStartMarker);
assert.ok(noDetStart >= 0, 'no-detection diagnostic branch must be structurally extractable');
const noDetEndMarker = "setState('error'); return;\n          }";
const noDetEndIdx = photoBlock.indexOf(noDetEndMarker, noDetStart);
assert.ok(noDetEndIdx > noDetStart);
const noDetBranch = photoBlock.slice(noDetStart, noDetEndIdx + noDetEndMarker.length);

function runNoDetectionBranch(photoQualityDebugEnabled) {
  const calls = { setPhotoQualityDebugInfo: [], setState: [] };
  const fn = new Function('det', 'photoQualityDebugEnabled', 'setPhotoQualityDebugInfo', 'setState', noDetBranch);
  fn(null, photoQualityDebugEnabled, info => calls.setPhotoQualityDebugInfo.push(info), s => calls.setState.push(s));
  return calls;
}

test('2a. no-detection branch: when debug is OFF, no diagnostic is recorded, and setState("error") still fires (unchanged production behavior)', () => {
  const calls = runNoDetectionBranch(false);
  assert.deepStrictEqual(calls.setPhotoQualityDebugInfo, []);
  assert.deepStrictEqual(calls.setState, ['error']);
});

test('2b. no-detection branch: when debug is ON, records detectorPresent:false and the correct primary/final-path fields', () => {
  const calls = runNoDetectionBranch(true);
  assert.strictEqual(calls.setPhotoQualityDebugInfo.length, 1);
  const diag = calls.setPhotoQualityDebugInfo[0];
  assert.strictEqual(diag.detectorPresent, false);
  assert.strictEqual(diag.primaryReason, 'no_detection');
  assert.strictEqual(diag.failureBeforeQualityCheck, true);
  assert.strictEqual(diag.failureType, 'no_detection');
  assert.strictEqual(diag.finalHardBlockPath, 'no_detection (before assessFrameQuality)');
  assert.strictEqual(diag.userFacingMessageKey, 'photoErrorQuality');
  assert.deepStrictEqual(diag.allReasons, []);
  assert.strictEqual(diag.qualityOk, null);
  assert.deepStrictEqual(calls.setState, ['error'], 'setState("error") must still fire exactly as before, regardless of debug flag');
  // No forbidden fields anywhere in the recorded object.
  const json = JSON.stringify(diag);
  for (const forbidden of ['landmarks', 'base64', 'data:image', 'toDataURL', 'originalImage']) {
    assert.ok(!json.includes(forbidden), `no-detection diagnostic must never contain "${forbidden}"`);
  }
});

// ------------------------------------------------------------
// PART B — the quality-evaluated diagnostic branch (pass or reject).
// ------------------------------------------------------------
const qualityBlockStartMarker = "console.log('[Photo] quality', quality);";
const qualityBlockStart = photoBlock.indexOf(qualityBlockStartMarker);
assert.ok(qualityBlockStart >= 0, 'quality-evaluated diagnostic branch must be structurally extractable');
// Extends through the Photo-only quality-recovery decision (see
// photo-quality-recovery.test.js for that logic's own dedicated,
// focused coverage) since photoEdgeClipped/photoQualityRecovered/
// photoQualityProceeds are computed here and consumed by both the
// diagnostic object below AND the final hard-block line.
const qualityBlockEndMarker = "if (!photoQualityProceeds) { setState('error'); return; }";
const qualityBlockEndIdx = photoBlock.indexOf(qualityBlockEndMarker, qualityBlockStart);
assert.ok(qualityBlockEndIdx > qualityBlockStart);
const qualityBranch = photoBlock.slice(qualityBlockStart, qualityBlockEndIdx + qualityBlockEndMarker.length);

// Confirms, textually, that the diagnostic's leftEAR/rightEAR/detScore/
// canvasWidth/boxWidth inputs are the EXACT same expressions fed into
// the real assessFrameQuality call just above this branch — not a
// second, independently-derived value.
const productionQualityCallMarker = 'const quality = assessFrameQuality({\n            detScore: det.detection.score, headPose, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n            brightness, sharpness, canvasWidth: canvas.width, boxWidth: det.detection.box.width,\n          });';
test('3. the production assessFrameQuality call site is present, unmodified, immediately before the diagnostic branch', () => {
  assert.ok(photoBlock.includes(productionQualityCallMarker), 'assessFrameQuality call must be byte-for-byte unchanged');
  assert.ok(qualityBranch.includes('leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear'), 'diagnostic must reference the exact same leftMetrics.ear/rightMetrics.ear expressions assessFrameQuality was just called with');
  assert.ok(qualityBranch.includes('allReasons: quality.reasons, qualityOk: quality.ok'), 'diagnostic must read the REAL assessFrameQuality return value directly, not recompute reasons');
});

test('4. assessFrameQuality itself is byte-for-byte unchanged by this diagnostic phase', () => {
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

function runQualityBranch({ photoQualityDebugEnabled, det, headPose, leftMetrics, rightMetrics, brightness, sharpness, canvas, quality, pickRejectionHintKey, leftEye, rightEye, physicalLeft, physicalRight }) {
  const calls = { setPhotoQualityDebugInfo: [], consoleLog: [], setState: [] };
  const fn = new Function('photoQualityDebugEnabled', 'det', 'headPose', 'leftMetrics', 'rightMetrics',
    'brightness', 'sharpness', 'canvas', 'quality', 'pickRejectionHintKey', 'leftEye', 'rightEye', 'physicalLeft', 'physicalRight',
    'setPhotoQualityDebugInfo', 'console', 'setState',
    qualityBranch);
  fn(photoQualityDebugEnabled, det, headPose, leftMetrics, rightMetrics, brightness, sharpness, canvas, quality,
    pickRejectionHintKey, leftEye, rightEye, physicalLeft, physicalRight,
    info => calls.setPhotoQualityDebugInfo.push(info),
    { log: (...args) => calls.consoleLog.push(args) }, s => calls.setState.push(s));
  return calls;
}

// Mock 6-point eye contours / 5-point brow contours, matching face-
// api's real shape -- comfortably centered with wide margins in the
// 900x1200 canvas so requiredEyeRegionClipped is false unless a test
// deliberately overrides these points.
const mockEye = (cx, cy) => [
  { x: cx - 20, y: cy }, { x: cx - 10, y: cy - 6 }, { x: cx + 10, y: cy - 6 },
  { x: cx + 20, y: cy }, { x: cx + 10, y: cy + 6 }, { x: cx - 10, y: cy + 6 },
];
const mockBrow = (cx, cy) => [
  { x: cx - 22, y: cy }, { x: cx - 11, y: cy - 4 }, { x: cx, y: cy - 6 },
  { x: cx + 11, y: cy - 4 }, { x: cx + 22, y: cy },
];

// box/canvas are comfortably non-edge-touching by construction (box
// spans x:[200,500], y:[200,500] inside a 900x1200 canvas, well within
// the 2%/98% margins photoEdgeClipped checks) so baseFixture never
// trips the new clip check unless a test deliberately overrides it.
const baseFixture = {
  det: { detection: { score: 0.91, box: { x: 200, y: 200, width: 300, height: 300 } } },
  headPose: { roll: 3.2, yawProxy: 0.05, pitchProxy: 0.7 },
  leftMetrics: { ear: 0.28 }, rightMetrics: { ear: 0.31 },
  leftEye: mockEye(300, 310), rightEye: mockEye(600, 310),
  physicalLeft: { brow: mockBrow(300, 280) }, physicalRight: { brow: mockBrow(600, 280) },
  brightness: 120, sharpness: 55, canvas: { width: 900, height: 1200 },
  pickRejectionHintKey: () => 'hintUnused',
};

test('5. debug OFF: quality branch records nothing, regardless of pass/fail', () => {
  const calls = runQualityBranch({ ...baseFixture, photoQualityDebugEnabled: false, quality: { ok: true, reasons: [] } });
  assert.deepStrictEqual(calls.setPhotoQualityDebugInfo, []);
});

test('6a. debug ON, quality.ok=true (pass): leftEAR/rightEAR/detectorScore/faceRatio/brightness/sharpness are the EXACT injected production values, unaltered', () => {
  const quality = { ok: true, reasons: [] };
  const calls = runQualityBranch({ ...baseFixture, photoQualityDebugEnabled: true, quality });
  assert.strictEqual(calls.setPhotoQualityDebugInfo.length, 1);
  const diag = calls.setPhotoQualityDebugInfo[0];
  assert.strictEqual(diag.detectorPresent, true);
  assert.strictEqual(diag.detectorScore, baseFixture.det.detection.score);
  assert.strictEqual(diag.leftEAR, baseFixture.leftMetrics.ear);
  assert.strictEqual(diag.rightEAR, baseFixture.rightMetrics.ear);
  assert.strictEqual(diag.roll, baseFixture.headPose.roll);
  assert.strictEqual(diag.yaw, baseFixture.headPose.yawProxy);
  assert.strictEqual(diag.pitch, baseFixture.headPose.pitchProxy);
  assert.strictEqual(diag.brightness, baseFixture.brightness);
  assert.strictEqual(diag.sharpness, baseFixture.sharpness);
  assert.strictEqual(diag.faceRatio, baseFixture.det.detection.box.width / baseFixture.canvas.width);
  assert.strictEqual(diag.qualityOk, true);
  assert.deepStrictEqual(diag.allReasons, []);
  assert.strictEqual(diag.primaryReason, null);
  assert.strictEqual(diag.failureType, 'none');
  assert.strictEqual(diag.userFacingMessageKey, null);
  assert.strictEqual(diag.wouldBeHintKeyIfWired, null);
  // Debug-shadow console log fires on pass (screen unmounts immediately
  // on success) — alongside the pre-existing, untouched
  // console.log('[Photo] quality', quality) this snippet also includes.
  assert.ok(calls.consoleLog.some(args => args[0] === '[PhotoQualityDebug]'), 'expected the debug-shadow log to fire on pass');
});

test('6b. debug ON, quality.ok=false (reject): allReasons/qualityOk/primaryReason equal the REAL assessFrameQuality output exactly, with the real reasons array reference reused verbatim', () => {
  const quality = { ok: false, reasons: ['too_dark', 'eyes_closed'] };
  const calls = runQualityBranch({ ...baseFixture, photoQualityDebugEnabled: true, quality });
  const diag = calls.setPhotoQualityDebugInfo[0];
  assert.strictEqual(diag.allReasons, quality.reasons, 'allReasons must be the SAME array reference as quality.reasons, not a copy/recomputation');
  assert.strictEqual(diag.qualityOk, false);
  assert.strictEqual(diag.primaryReason, 'too_dark');
  assert.strictEqual(diag.failureType, 'quality_rejection');
  assert.strictEqual(diag.finalHardBlockPath, 'assessFrameQuality:too_dark');
  assert.strictEqual(diag.userFacingMessageKey, 'photoErrorQuality');
  assert.strictEqual(diag.wouldBeHintKeyIfWired, 'hintUnused');
  // No [PhotoQualityDebug] debug-shadow log on the reject path (only
  // used for the unmount-before-render pass case) — the pre-existing,
  // untouched console.log('[Photo] quality', quality) still fires.
  assert.ok(!calls.consoleLog.some(args => args[0] === '[PhotoQualityDebug]'), 'debug-shadow log must not fire on reject');
  assert.ok(calls.consoleLog.some(args => args[0] === '[Photo] quality'), 'the pre-existing production quality log must be untouched');
});

test('6c. one-eye-only EAR failure ("eyes_closed" from a single low EAR) is captured with both EAR values intact, proving the diagnostic never masks which side triggered it', () => {
  const quality = { ok: false, reasons: ['eyes_closed'] };
  const asymFixture = { ...baseFixture, leftMetrics: { ear: 0.09 }, rightMetrics: { ear: 0.30 } };
  const calls = runQualityBranch({ ...asymFixture, photoQualityDebugEnabled: true, quality });
  const diag = calls.setPhotoQualityDebugInfo[0];
  assert.strictEqual(diag.leftEAR, 0.09);
  assert.strictEqual(diag.rightEAR, 0.30);
  assert.strictEqual(diag.primaryReason, 'eyes_closed');
});

test('7. boxClipped (generic face-box, diagnostic only) and requiredEyeRegionClipped (the real recovery gate) both report correctly for a comfortably-unclipped fixture — see photo-quality-recovery.test.js for full coverage of the required-region check itself', () => {
  const calls = runQualityBranch({ ...baseFixture, photoQualityDebugEnabled: true, quality: { ok: true, reasons: [] } });
  const diag = calls.setPhotoQualityDebugInfo[0];
  // baseFixture's generic box (x:200,y:200,w:300,h:300 in a 900x1200
  // canvas) is comfortably inside the 2%/98% margins -- not clipped.
  assert.strictEqual(diag.boxClipped, false);
  // baseFixture's eye/brow points are comfortably centered -- the real
  // required-region gate also reports not clipped, on all four edges.
  assert.strictEqual(diag.requiredEyeRegionClipped, false);
  assert.strictEqual(diag.clippedTop, false);
  assert.strictEqual(diag.clippedBottom, false);
  assert.strictEqual(diag.clippedLeft, false);
  assert.strictEqual(diag.clippedRight, false);
});

test('8. no forbidden data (pixels/base64/image URL/landmarks/raw box position) in the quality-branch diagnostic', () => {
  const calls = runQualityBranch({ ...baseFixture, photoQualityDebugEnabled: true, quality: { ok: false, reasons: ['too_close'] } });
  const json = JSON.stringify(calls.setPhotoQualityDebugInfo[0]);
  for (const forbidden of ['landmarks', 'base64', 'data:image', 'toDataURL', 'originalImage', 'previewUrl', '"x":', '"y":']) {
    assert.ok(!json.includes(forbidden), `quality-branch diagnostic must never contain "${forbidden}"`);
  }
});

// ------------------------------------------------------------
// PART C — the exception branch.
// ------------------------------------------------------------
const catchKeywordMarker = "} catch (e) {\n          console.error('[Photo] PIPELINE ERROR', e);";
const catchKeywordIdx = photoBlock.indexOf(catchKeywordMarker);
assert.ok(catchKeywordIdx >= 0, 'exception diagnostic branch must be structurally extractable');
// Depth-count from the catch block's own opening brace to its true
// matching close (same technique as extractObjectLiteral elsewhere in
// this suite) — a plain lastIndexOf('}') would instead land on the
// enclosing analyze() arrow function's own closing brace.
const catchBraceStart = photoBlock.indexOf('{', catchKeywordIdx + '} catch (e) '.length - 1);
let catchDepth = 0, catchBraceEnd = catchBraceStart;
for (; catchBraceEnd < photoBlock.length; catchBraceEnd++) {
  if (photoBlock[catchBraceEnd] === '{') catchDepth++;
  else if (photoBlock[catchBraceEnd] === '}') { catchDepth--; if (catchDepth === 0) break; }
}
assert.ok(catchBraceEnd > catchBraceStart, 'catch block braces must balance');
const catchBody = photoBlock.slice(catchBraceStart + 1, catchBraceEnd);
assert.ok(catchBody.includes("setPhotoQualityDebugInfo({") && catchBody.includes("setState('error');"), 'extracted catch body must contain the real diagnostic + setState calls');

function runExceptionBranch(photoQualityDebugEnabled, err) {
  const calls = { setPhotoQualityDebugInfo: [], setState: [] };
  const fn = new Function('photoQualityDebugEnabled', 'setPhotoQualityDebugInfo', 'setState', 'console', 'e',
    catchBody);
  fn(photoQualityDebugEnabled, info => calls.setPhotoQualityDebugInfo.push(info), s => calls.setState.push(s),
    { error: () => {} }, err);
  return calls;
}

test('9a. exception branch, debug OFF: no diagnostic recorded, setState("error") still fires', () => {
  const calls = runExceptionBranch(false, new TypeError('Failed to fetch'));
  assert.deepStrictEqual(calls.setPhotoQualityDebugInfo, []);
  assert.deepStrictEqual(calls.setState, ['error']);
});

test('9b. exception branch, debug ON: records failureType:"exception" and only a safe name/message, nothing else', () => {
  const calls = runExceptionBranch(true, new TypeError('Failed to fetch'));
  const diag = calls.setPhotoQualityDebugInfo[0];
  assert.strictEqual(diag.failureType, 'exception');
  assert.strictEqual(diag.finalHardBlockPath, 'exception');
  assert.strictEqual(diag.userFacingMessageKey, 'photoErrorQuality');
  assert.deepStrictEqual(diag.exceptionInfo, { name: 'TypeError', message: 'Failed to fetch' });
  assert.deepStrictEqual(calls.setState, ['error']);
  // Every other field is null (no metrics were ever computed on this path).
  for (const field of ['detectorPresent', 'detectorScore', 'faceRatio', 'leftEAR', 'rightEAR', 'roll', 'yaw', 'pitch', 'brightness', 'sharpness']) {
    assert.strictEqual(diag[field], null, `${field} must be null on the exception path`);
  }
});

// ------------------------------------------------------------
// Structural isolation — every new state write is debug-gated; the
// real decision-making calls (setState('error') on rejection/no-face,
// onComplete on success) are untouched and never conditioned on the
// debug flag.
// ------------------------------------------------------------
test('10. every setPhotoQualityDebugInfo call site is inside an `if (photoQualityDebugEnabled)` guard', () => {
  const callSites = [...photoBlock.matchAll(/setPhotoQualityDebugInfo\(/g)];
  // 1 reset (top of analyze) + 3 outcome branches = 4 call sites.
  assert.strictEqual(callSites.length, 4, `expected 4 setPhotoQualityDebugInfo call sites, found ${callSites.length}`);
  assert.ok(photoBlock.includes('if (photoQualityDebugEnabled) setPhotoQualityDebugInfo(null);'), 'reset call must be guarded');
  assert.ok(photoBlock.includes("if (!det) {\n            if (photoQualityDebugEnabled) {\n              setPhotoQualityDebugInfo({"), 'no-detection call must be guarded');
  assert.ok(photoBlock.includes('if (photoQualityDebugEnabled) {\n            // faceRatio here mirrors') && photoBlock.includes('setPhotoQualityDebugInfo(photoQualityDiag);'), 'quality-branch guard must open before the diagnostic is built and set');
  assert.ok(photoBlock.includes("} catch (e) {\n          console.error('[Photo] PIPELINE ERROR', e);\n          if (photoQualityDebugEnabled) {") && photoBlock.includes("exceptionInfo: { name: (e && e.name)"), 'exception-branch guard must open right after the catch, before the diagnostic is built');
});

test('11. the real hard-block decisions are unconditional — never gated behind the debug flag', () => {
  assert.ok(photoBlock.includes("setState('error'); return;\n          }"), 'no-detection setState(error) must be unconditional');
  // Post Photo-only quality recovery: the hard-block now reads
  // photoQualityProceeds (quality.ok || photoQualityRecovered) instead
  // of quality.ok directly -- still unconditional/ungated by the debug
  // flag, and quality.ok/quality.reasons themselves are never rewritten
  // (see photo-quality-recovery.test.js for the recovery logic itself).
  assert.ok(photoBlock.includes("if (!photoQualityProceeds) { setState('error'); return; }"), 'quality-rejection setState(error) must be unconditional and unchanged');
  assert.ok(photoBlock.includes('onComplete(photoRec);'), 'success path onComplete must be unconditional and unchanged');
});

test('12. the debug panel is only ever rendered gated on both the enable flag AND a populated diagnostic', () => {
  assert.ok(photoBlock.includes('{photoQualityDebugEnabled && photoQualityDebugInfo && <PhotoQualityDebugPanel info={photoQualityDebugInfo} />}'));
});

// ------------------------------------------------------------
// PhotoQualityDebugPanel — copies ONLY the info prop, nothing else.
// ------------------------------------------------------------
const panelStart = src.indexOf('    function PhotoQualityDebugPanel(');
const panelEnd = src.indexOf('\n    }', src.indexOf('return (\n        <aside', panelStart)) + '\n    }'.length;
assert.ok(panelStart >= 0 && panelEnd > panelStart, 'PhotoQualityDebugPanel must be structurally extractable');
const panelBlock = src.slice(panelStart, panelEnd);

test('13. PhotoQualityDebugPanel\'s copy() serializes ONLY the info prop — no image/canvas/preview reference anywhere in the component', () => {
  assert.ok(panelBlock.includes('await navigator.clipboard.writeText(JSON.stringify(info, null, 2));'));
  for (const forbidden of ['previewUrl', 'canvas', 'img.', 'toDataURL', 'landmarks', 'getImageData']) {
    assert.ok(!panelBlock.includes(forbidden), `PhotoQualityDebugPanel must never reference "${forbidden}"`);
  }
});

// ------------------------------------------------------------
// Isolation from unrelated production systems.
// ------------------------------------------------------------
const { execSync } = require('node:child_process');
test('14. Live Scan, recommendation engine, Iris classifier, Lash Map, Client Store, VisitSnapshot, Results Hero production files are untouched', () => {
  for (const file of ['lash-scan-core.js', 'lash-design-domain.js', 'professional-lash-library.js', 'client-store.js', 'visit-snapshot.js', 'consent-manager.js', 'client-data-consent.js', 'analytics.js', 'backend/worker.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('15. LiveScanScreen source is untouched by this Photo-only diagnostic phase', () => {
  const liveScanStart = src.indexOf('    function LiveScanScreen(');
  const liveScanEnd = src.indexOf('\n    const NAT_LASH_HINT_KEYS', liveScanStart);
  const liveScanSource = src.slice(liveScanStart, liveScanEnd);
  assert.ok(!liveScanSource.includes('photoQualityDebug'), 'LiveScanScreen must not reference the new Photo-only debug flag');
});

test('16. rankDesignsAll/DESIGN_CATALOG wiring is byte-unchanged', () => {
  assert.ok(src.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'));
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const digest = require('node:crypto').createHash('sha256').update(src.slice(catalogStart, catalogEnd)).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});
