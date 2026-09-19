'use strict';
// ============================================================
// PHOTO SCAN VISUAL LAYER — non-regression + structural coverage.
// ------------------------------------------------------------
// The Photo Analysis premium scan animation (canvas overlay: subject
// lock, scan beam, progressive face mesh, eye targeting, iris micro-
// scan) is presentation-only. This file proves, using this repo's own
// established technique (real source extraction, byte-identical-to-
// HEAD comparison with an explicit, symmetric normalizer for the
// approved additions — same pattern as consent-manager.test.js's J1/J2),
// that PhotoAnalysisScreen's real analytical code (detection, quality
// gate, computeHeadPose/computeEyeSideMetrics/getPhysicalEyeLandmarks/
// detectEyelidCrease/aggregateBuffer/classifyFeatures/classifyFaceShape/
// sampleIrisColor/combineIris/rankDesigns, and the photoRec object it
// builds) is completely unchanged — only WHEN onComplete(photoRec)
// fires changed, never what it is called with or how it was computed.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let HEAD = null;
try { HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 20 }).toString(); } catch (e) { HEAD = null; }
assert.ok(HEAD, 'expected `git show HEAD:index.html` to succeed');

const photoScreenStart = src.indexOf('    function PhotoAnalysisScreen(');
const photoScreenEnd = src.indexOf('\n    function isPhotoQualityDebugEnabled()', photoScreenStart);
assert.ok(photoScreenStart >= 0 && photoScreenEnd > photoScreenStart, 'expected to locate PhotoAnalysisScreen (bounded by the next real top-level function, isPhotoQualityDebugEnabled)');
const photoScreenBlock = src.slice(photoScreenStart, photoScreenEnd);

function stripLineComments(s) {
  return s.split('\n').map((line) => {
    let inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inSingle) { if (c === '\\') { i++; continue; } if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '\\') { i++; continue; } if (c === '"') inDouble = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

const analyzeMarker = 'const analyze = async (file) => {';
const curAnalyzeStart = src.indexOf(analyzeMarker, photoScreenStart);
const prevAnalyzeStart = HEAD.indexOf(analyzeMarker);
assert.ok(curAnalyzeStart >= 0 && prevAnalyzeStart >= 0, 'expected to locate analyze() in both current and HEAD source');
const curAnalyzeEnd = src.indexOf('\n      };\n', curAnalyzeStart) + '\n      };'.length;
const prevAnalyzeEnd = HEAD.indexOf('\n      };\n', prevAnalyzeStart) + '\n      };'.length;
const curAnalyze = src.slice(curAnalyzeStart, curAnalyzeEnd);
const prevAnalyze = HEAD.slice(prevAnalyzeStart, prevAnalyzeEnd);

// Approved PHOTO SCAN VISUAL LAYER patch: six small, precise additions
// to analyze(), all either (a) an unmount-safety guard clause that
// returns before any further work, or (b) a read-only assignment onto
// scanDataRef/analysisResultRef that never touches an existing
// variable's value. Stripped from BOTH sides identically (symmetric —
// a no-op on the HEAD side, which has none of these lines) so this
// stays a real guard against any OTHER, unrelated drift in analyze().
function omitPhotoScanVisualLayerAdditions(span) {
  return span
    // 1. unmount guard right after the photo decodes + scanDataRef seed
    .replace(
      "          const img = await faceapi.fetchImage(url);\n" +
      "          if (cancelledRef.current) return;\n" +
      "          // Photo is now decoded and paintable — the scan animation\n" +
      "          // (started by the useEffect below, keyed on state==='analyzing')\n" +
      "          // can show it immediately, before detection has even run.\n" +
      "          scanDataRef.current = { img };\n",
      "          const img = await faceapi.fetchImage(url);\n"
    )
    // 2. unmount guard right after the primary detection attempt
    .replace(
      "          let det = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })).withFaceLandmarks();\n" +
      "          if (cancelledRef.current) return;\n",
      "          let det = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })).withFaceLandmarks();\n"
    )
    // 3. unmount guard right after the fallback detection attempt
    .replace(
      "            const fallbackDet = await faceapi.detectSingleFace(fb.canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 })).withFaceLandmarks();\n" +
      "            if (cancelledRef.current) return;\n",
      "            const fallbackDet = await faceapi.detectSingleFace(fb.canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 })).withFaceLandmarks();\n"
    )
    // 4. scanDataRef geometry population (read-only reuse of physicalLeft/
    //    physicalRight/det.landmarks already computed on the lines just above)
    .replace(
      "          const leftEye = physicalLeft.eye, rightEye = physicalRight.eye;\n" +
      "          // PHOTO SCAN VISUAL LAYER — presentation only, read-only.\n" +
      "          // Every field below is either a DIRECT reference to a value\n" +
      "          // already computed above for real analysis (physicalLeft.eye/\n" +
      "          // physicalRight.eye) or a fresh call to one of det.landmarks'\n" +
      "          // OWN getters (the identical object LiveScanScreen's tick\n" +
      "          // reads via d.jaw/d.leftBrow/etc. for its own, equally\n" +
      "          // read-only, buildFaceMesh call) — never a new measurement,\n" +
      "          // never fed back into det/classified/anything below. `scale`\n" +
      "          // is the SAME analysis-canvas-to-native-image ratio already\n" +
      "          // established above (buildAnalysisCanvas); toNative lets the\n" +
      "          // animation loop map these analysis-canvas-space points onto\n" +
      "          // the native-resolution `img` it paints via drawImageCover.\n" +
      "          scanDataRef.current = {\n" +
      "            ...scanDataRef.current,\n" +
      "            toNative: 1 / scale,\n" +
      "            box: det.detection.box,\n" +
      "            jaw: det.landmarks.getJawOutline(),\n" +
      "            leftBrow: det.landmarks.getLeftEyeBrow(),\n" +
      "            rightBrow: det.landmarks.getRightEyeBrow(),\n" +
      "            nose: det.landmarks.getNose(),\n" +
      "            leftEye: det.landmarks.getLeftEye(),\n" +
      "            rightEye: det.landmarks.getRightEye(),\n" +
      "            mouth: det.landmarks.getMouth(),\n" +
      "            physicalLeftEye: physicalLeft.eye,\n" +
      "            physicalRightEye: physicalRight.eye,\n" +
      "          };\n",
      "          const leftEye = physicalLeft.eye, rightEye = physicalRight.eye;\n"
    )
    // 5. onComplete(photoRec) -> analysisResultRef.current = photoRec
    //    (photoRec's own construction, just above this, is untouched —
    //    only how it's handed off changes)
    .replace(
      "          // Debug-only, additive field — absent entirely in normal mode.\n" +
      "          if (irisColorAuditForRec) photoRec.irisColorAudit = irisColorAuditForRec;\n" +
      "          // PHOTO SCAN VISUAL LAYER: onComplete(photoRec) is deliberately\n" +
      "          // NOT called here anymore. photoRec itself is byte-for-byte\n" +
      "          // the same, real, fully computed result as before this\n" +
      "          // change — only WHEN the app navigates to Results changes.\n" +
      "          // The scan-animation effect below owns calling the real,\n" +
      "          // unmodified onComplete once both the real analysis (this\n" +
      "          // ref) and the minimum visual sequence are done.\n" +
      "          if (cancelledRef.current) return;\n" +
      "          analysisResultRef.current = photoRec;\n",
      "          // Debug-only, additive field — absent entirely in normal mode.\n" +
      "          if (irisColorAuditForRec) photoRec.irisColorAudit = irisColorAuditForRec;\n" +
      "          onComplete(photoRec);\n"
    )
    // 6. unmount guard at the very top of the catch block
    .replace(
      "        } catch (e) {\n" +
      "          if (cancelledRef.current) return;\n" +
      "          console.error('[Photo] PIPELINE ERROR', e);\n",
      "        } catch (e) {\n" +
      "          console.error('[Photo] PIPELINE ERROR', e);\n"
    );
}

test('A. analyze()\'s real analytical code (detection, quality gate, computeHeadPose/computeEyeSideMetrics/getPhysicalEyeLandmarks/detectEyelidCrease/aggregateBuffer/classifyFeatures/classifyFaceShape/sampleIrisColor/combineIris/rankDesigns, and photoRec\'s own construction) is byte-identical to git HEAD outside the 6 approved, purely-additive visual-layer hooks', () => {
  const curNorm = omitPhotoScanVisualLayerAdditions(curAnalyze);
  const prevNorm = omitPhotoScanVisualLayerAdditions(prevAnalyze);
  assert.strictEqual(curNorm, prevNorm, 'analyze() must be byte-identical to HEAD outside the approved cancelledRef/scanDataRef/analysisResultRef hooks');
});

test('B. photoRec itself (the object actually handed to onComplete) is untouched — onComplete only moved, never gained/lost a field or changed a computed value', () => {
  // The photoRec object LITERAL (source: 'photo', eyeProfile, iris,
  // designs, originalImage, landmarks, imageWidth, imageHeight,
  // confidence, faceShapeProfile, nativeImage) must appear verbatim —
  // this is the exact same literal shipped in the PostHog-verified,
  // previously-audited "Fix mobile Lash Map annotation safe area" /
  // "Polish professional Lash Map photo rendering" commits.
  assert.ok(src.includes(
    "const photoRec = {\n" +
    "            source: 'photo', eyeProfile: classified, iris, designs,\n" +
    "            originalImage: canvas.toDataURL('image/jpeg', 0.92), landmarks: det.landmarks,\n" +
    "            imageWidth: canvas.width, imageHeight: canvas.height, confidence: classified.overallConfidence,\n" +
    "            faceShapeProfile,"
  ), 'photoRec\'s construction must be byte-identical to before this visual-layer change');
  assert.ok(src.includes('nativeImage: url,'), 'nativeImage field must be unchanged');
});

test('C. onComplete is called exactly once in PhotoAnalysisScreen\'s CODE, from the scan-animation effect\'s finish(), never from inside analyze() itself anymore', () => {
  const code = stripLineComments(photoScreenBlock);
  const onCompleteCalls = (code.match(/\bonComplete\(/g) || []).length;
  assert.strictEqual(onCompleteCalls, 1, 'expected exactly one onComplete( call in PhotoAnalysisScreen\'s actual code (comments may still name it for documentation)');
  assert.ok(code.includes('if (rec) onComplete(rec);'), 'the one real call site must be finish()\'s own, guarded by cancelledRef and a real analysisResultRef value');
});

test('D. the scan animation reuses the EXISTING top-level LiveScanScreen visual primitives verbatim — none are redefined/duplicated inside PhotoAnalysisScreen', () => {
  const reused = ['drawScanBeam', 'buildFaceMesh', 'drawFaceMeshV3', 'drawDust', 'drawScanFrame', 'drawSubjectLock', 'drawEyeTarget', 'drawIrisMicroScan', 'drawDataFlow', 'drawDataFlowFan', 'drawCenterLabel', 'mapVideoPointToDisplay'];
  for (const fn of reused) {
    assert.ok(photoScreenBlock.includes(fn + '('), `PhotoAnalysisScreen must call the real, shared ${fn}(...)`);
    // Each of these function NAMEs must still be declared exactly once
    // in the whole file (its one real top-level definition) -- proves
    // PhotoAnalysisScreen calls it rather than shadowing/redefining it.
    const defCount = (src.match(new RegExp('function ' + fn + '\\(', 'g')) || []).length;
    assert.strictEqual(defCount, 1, `${fn} must still have exactly one real definition in the whole file (not duplicated for PhotoAnalysisScreen)`);
  }
});

test('E. drawImageCover exists exactly once, right beside drawVideoCover, is pure (no video/getUserMedia/mirror reference), and never mirrors', () => {
  const defCount = (src.match(/function drawImageCover\(/g) || []).length;
  assert.strictEqual(defCount, 1, 'expected exactly one drawImageCover definition');
  const start = src.indexOf('function drawImageCover(');
  const end = src.indexOf('\n    function drawCornerBracket(', start);
  assert.ok(start >= 0 && end > start, 'expected to locate drawImageCover\'s full body');
  const body = src.slice(start, end);
  for (const forbidden of ['video', 'getUserMedia', 'mirrored', 'facingMode', 'translate', 'ctx.scale(']) {
    assert.ok(!body.includes(forbidden), `drawImageCover must never reference "${forbidden}"`);
  }
  assert.ok(body.includes('Math.max(dispW / iw, dispH / ih)'), 'must use the same object-fit:cover formula as mapVideoPointToDisplay/drawVideoCover');
});

test('F. cover-math preserves aspect ratio and centers the image for both a wider-than-display and a taller-than-display source (unit-level proof)', () => {
  const start = src.indexOf('function drawImageCover(');
  const end = src.indexOf('\n    function drawCornerBracket(', start);
  const drawImageCover = new Function(src.slice(start, end) + '\nreturn drawImageCover;')();
  function fakeCtx() {
    const calls = [];
    return { calls, drawImage: (...args) => calls.push(args) };
  }
  // Landscape source (1448x1086, the repo's own real fixture ratio) into a portrait display.
  let ctx = fakeCtx();
  drawImageCover(ctx, { width: 1448, height: 1086 }, 390, 500);
  assert.strictEqual(ctx.calls.length, 1);
  let [, dx, dy, dw, dh] = ctx.calls[0];
  assert.ok(dw >= 390 - 0.01 && dh >= 500 - 0.01, 'scaled image must fully cover the display box');
  assert.ok(Math.abs(dw / dh - 1448 / 1086) < 0.001, 'aspect ratio must be preserved (no stretching)');
  assert.ok(dx <= 0.01, 'wider source must be centered horizontally (negative or zero x offset)');
  // Portrait source into a landscape display.
  ctx = fakeCtx();
  drawImageCover(ctx, { width: 1086, height: 1448 }, 500, 300);
  [, dx, dy, dw, dh] = ctx.calls[0];
  assert.ok(dw >= 500 - 0.01 && dh >= 300 - 0.01, 'scaled image must fully cover the display box');
  assert.ok(Math.abs(dw / dh - 1086 / 1448) < 0.001, 'aspect ratio must be preserved (no stretching)');
  assert.ok(dy <= 0.01, 'taller source must be centered vertically (negative or zero y offset)');
});

test('G. the animation loop\'s geometry mapping uses physicalLeft.eye/physicalRight.eye (canonical LEFT/RIGHT) for eye targeting, never the raw image-side eye arrays', () => {
  assert.ok(photoScreenBlock.includes('physicalLeftEye: physicalLeft.eye,'));
  assert.ok(photoScreenBlock.includes('physicalRightEye: physicalRight.eye,'));
  assert.ok(photoScreenBlock.includes('data.physicalLeftEye'));
  assert.ok(photoScreenBlock.includes('data.physicalRightEye'));
});

test('H. the reduced-motion path never calls the sweeping/particle primitives (drawScanBeam/drawDust/drawDataFlow/drawIrisMicroScan/drawSubjectLock), and the full-motion path does', () => {
  const reduceStart = photoScreenBlock.indexOf('if (reduceMotion) {');
  const reduceEnd = photoScreenBlock.indexOf('} else {', reduceStart);
  assert.ok(reduceStart >= 0 && reduceEnd > reduceStart, 'expected to locate the reduceMotion branch inside the animation frame function');
  const reduceBlock = photoScreenBlock.slice(reduceStart, reduceEnd);
  for (const forbidden of ['drawScanBeam(', 'drawDust(', 'drawDataFlow(', 'drawIrisMicroScan(', 'drawSubjectLock(']) {
    assert.ok(!reduceBlock.includes(forbidden), `reduced-motion path must never call ${forbidden}`);
  }
  const fullMotionBlock = photoScreenBlock.slice(reduceEnd, reduceEnd + 3000);
  for (const expected of ['drawScanBeam(', 'drawDust(', 'drawSubjectLock(']) {
    assert.ok(fullMotionBlock.includes(expected), `full-motion path must call ${expected}`);
  }
});

test('I. reduced-motion completion is gated ONLY on real analysis being done (no artificial minimum-duration wait), matching "proceed normally after the required processing completes"', () => {
  const reduceCompletion = photoScreenBlock.match(/if \(reduceMotion\) \{\s*if \(analysisDone\) \{ finish\(\); return; \}\s*\}/);
  assert.ok(reduceCompletion, 'reduced-motion completion must fire as soon as analysisDone is true, with no MIN_MS/geomElapsed gate');
});

test('J. photo-appropriate label text ("ЛИЦО РАСПОЗНАНО"/"FACE DETECTED") is used in the scan animation, never the live-tracking-implying "SUBJECT LOCKED" string', () => {
  assert.ok(src.includes("photoFaceDetected: {ru:'ЛИЦО РАСПОЗНАНО', en:'FACE DETECTED'},"));
  assert.ok(photoScreenBlock.includes("t('photoFaceDetected', langRef.current)"));
  assert.ok(!photoScreenBlock.includes('stageSubjectLocked'), 'PhotoAnalysisScreen must never reuse the live-tracking-implying SUBJECT LOCKED string');
});

test('K. no state update or onComplete can fire after unmount: cancelledRef is set in a cleanup effect and checked at every resume-from-await point and at the top of every animation frame', () => {
  assert.ok(photoScreenBlock.includes('cancelledRef.current = true;'), 'expected an unmount cleanup that sets cancelledRef');
  const cancelledChecks = (photoScreenBlock.match(/if \(cancelledRef\.current\)/g) || []).length;
  // 5 inside analyze() (after img fetch, after primary detect, after
  // fallback detect, before analysisResultRef assignment, top of catch
  // -- see the byte-identical test above) + 1 at the top of finish() +
  // 1 at the top of every animation frame = 7.
  assert.strictEqual(cancelledChecks, 7, `expected exactly 7 cancelledRef.current checks, found ${cancelledChecks}`);
});

test('L. LEFT/RIGHT-affecting and mirroring production functions are never referenced by the new visual-layer code beyond the read-only physicalLeft/physicalRight values analyze() already computed', () => {
  const animStart = photoScreenBlock.indexOf('useEffect(() => {\n        if (state !== \'analyzing\') return;');
  assert.ok(animStart >= 0, 'expected to locate the scan-animation effect');
  const animBlock = photoScreenBlock.slice(animStart);
  for (const forbidden of ['getPhysicalEyeLandmarks(', 'normalizeEyePoints(', 'normalizeBrowPoints(', 'facingMode', 'getUserMedia', 'ctx.scale(-1', 'ctx.translate(']) {
    assert.ok(!animBlock.includes(forbidden), `the scan-animation effect must never call/reference ${forbidden}`);
  }
});
