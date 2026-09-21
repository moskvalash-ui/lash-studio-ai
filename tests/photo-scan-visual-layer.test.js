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

// ------------------------------------------------------------
// PHOTO SCAN HANG FIX — shared extraction/harness for C/I/K below.
// Rather than pattern-matching the exact shape of the completion
// plumbing (which legitimately changed with the hang fix), these
// extract the REAL, unmodified finish()/watchdog-callback/
// completion-gate source out of PhotoAnalysisScreen (same
// extract-and-eval technique this repo already uses throughout,
// e.g. analyze() above) and execute it against a fake harness to
// prove the actual runtime invariants: onComplete is idempotent,
// reduced-motion/animationBroken skip the decorative wait, and
// cancellation/finished guards really do block late completions.
// A real source-shape drift (renamed marker, restructured block)
// fails these loudly via the assert.ok index checks below, so this
// isn't weaker than a literal match -- it's a match on behavior
// instead of on incidental formatting.
// ------------------------------------------------------------
function extractBetween(markerStart, markerEnd, fromIndex) {
  const start = photoScreenBlock.indexOf(markerStart, fromIndex || 0);
  assert.ok(start >= 0, `expected to find marker in PhotoAnalysisScreen: ${markerStart}`);
  const end = photoScreenBlock.indexOf(markerEnd, start);
  assert.ok(end > start, `expected to find end marker in PhotoAnalysisScreen: ${markerEnd}`);
  return photoScreenBlock.slice(start, end);
}

// finish() itself, real and unmodified.
const finishSrc = extractBetween(
  'const finish = () => {',
  '\n        };\n\n        // PHOTO SCAN HANG FIX — final safety net,'
) + '\n        };';

// The watchdog's real setTimeout callback body (without the
// `setTimeout(() => {` wrapper -- reused as a bare function body).
const watchdogBodySrc = extractBetween(
  'const watchdogTimer = setTimeout(() => {',
  '\n        }, WATCHDOG_MS);'
).replace('const watchdogTimer = setTimeout(() => {', '');

// The real completion-gate decision block at the end of frame() --
// decides whether/when finish() gets called for the current frame.
const gateSrc = extractBetween(
  'const revealSatisfied = geomElapsed >= REVEAL_MS || elapsed >= GEOM_FALLBACK_MS;',
  '\n          scanRafRef.current = requestAnimationFrame(frame);\n        };\n        scanRafRef.current = requestAnimationFrame(frame);'
);

// Real MIN_MS/REVEAL_MS/COLLAPSE_MS/WATCHDOG_MS/GEOM_FALLBACK_MS
// values, extracted rather than hardcoded, so the gate scenarios
// below stay honest if the real constants ever change.
const minMsMatch = photoScreenBlock.match(/const MIN_MS = (\d+), REVEAL_MS = (\d+), COLLAPSE_MS = (\d+);/);
assert.ok(minMsMatch, 'expected to find the real MIN_MS/REVEAL_MS/COLLAPSE_MS declaration');
const MIN_MS = Number(minMsMatch[1]), REVEAL_MS = Number(minMsMatch[2]), COLLAPSE_MS = Number(minMsMatch[3]);
const watchdogMsMatch = photoScreenBlock.match(/const WATCHDOG_MS = (\d+);/);
assert.ok(watchdogMsMatch, 'expected to find the real WATCHDOG_MS declaration');
const WATCHDOG_MS = Number(watchdogMsMatch[1]);
const geomFallbackMatch = photoScreenBlock.match(/const GEOM_FALLBACK_MS = REVEAL_MS \+ (\d+);/);
assert.ok(geomFallbackMatch, 'expected to find the real GEOM_FALLBACK_MS declaration');
const GEOM_FALLBACK_MS = REVEAL_MS + Number(geomFallbackMatch[1]);

// Builds ONE harness where finish() and the watchdog callback share
// the SAME `finished`/cancelledRef/analysisResultRef closures, exactly
// as they do in production (both are declared inside the same
// useEffect body) -- required to prove real cross-callback races
// (e.g. "watchdog fires after finish() already completed").
function makeFinishWatchdogHarness({ finishedInit = false, cancelled = false, rec = null } = {}) {
  const calls = { onComplete: [], setState: [] };
  const cancelledRef = { current: cancelled };
  const analysisResultRef = { current: rec };
  const scanRafRef = { current: 123 };
  const onComplete = (r) => calls.onComplete.push(r);
  const setState = (s) => calls.setState.push(s);
  const cancelAnimationFrame = () => {};
  const fakeConsole = { error: () => {} };
  const harnessSrc =
    'let finished = finishedInit;\n' + finishSrc + '\n' +
    'const watchdogCallback = () => {\n' + watchdogBodySrc + '\n};\n' +
    'return { finish, watchdogCallback, getFinished: () => finished };';
  // eslint-disable-next-line no-new-func
  const build = new Function('cancelledRef', 'analysisResultRef', 'scanRafRef', 'onComplete', 'setState', 'console', 'WATCHDOG_MS', 'cancelAnimationFrame', 'finishedInit', harnessSrc);
  const { finish, watchdogCallback, getFinished } = build(cancelledRef, analysisResultRef, scanRafRef, onComplete, setState, fakeConsole, WATCHDOG_MS, cancelAnimationFrame, finishedInit);
  return { calls, cancelledRef, analysisResultRef, finish, watchdogCallback, getFinished };
}

// Executes the real completion-gate block for one simulated frame.
function runGate({ reduceMotion, animationBroken, analysisDone, elapsed, geomElapsed, collapseStartInit = null }) {
  const calls = [];
  const finish = () => calls.push('finish');
  const src = 'let collapseStart = collapseStartInit;\n' + gateSrc + '\nreturn collapseStart;';
  // eslint-disable-next-line no-new-func
  const build = new Function('reduceMotion', 'animationBroken', 'analysisDone', 'elapsed', 'geomElapsed', 'MIN_MS', 'REVEAL_MS', 'GEOM_FALLBACK_MS', 'COLLAPSE_MS', 'time', 'collapseStartInit', 'finish', src);
  const collapseStart = build(reduceMotion, animationBroken, analysisDone, elapsed, geomElapsed, MIN_MS, REVEAL_MS, GEOM_FALLBACK_MS, COLLAPSE_MS, elapsed, collapseStartInit, finish);
  return { finishCalled: calls.includes('finish'), collapseStart };
}

test('C. onComplete can only fire through finish()\'s idempotent guard: never without a ready result, never twice, never after cancellation', () => {
  const code = stripLineComments(photoScreenBlock);
  const totalOnCompleteCalls = (code.match(/\bonComplete\(/g) || []).length;
  assert.strictEqual(totalOnCompleteCalls, 1, 'expected exactly one onComplete( call site in PhotoAnalysisScreen\'s actual code');
  const onCompleteCallsInFinish = (stripLineComments(finishSrc).match(/\bonComplete\(/g) || []).length;
  assert.strictEqual(onCompleteCallsInFinish, 1, 'the one onComplete( call site must live inside finish() itself, not scattered elsewhere');

  // Real finish(), executed: no result yet -> never calls onComplete.
  let h = makeFinishWatchdogHarness({ rec: null });
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 0, 'finish() must not call onComplete before a real analysis result exists');

  // Real finish(), executed: result ready -> calls onComplete exactly
  // once, with that exact result.
  const rec = { some: 'result' };
  h = makeFinishWatchdogHarness({ rec });
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 1, 'finish() must call onComplete once a real result exists');
  assert.strictEqual(h.calls.onComplete[0], rec, 'onComplete must receive the real analysisResultRef value, unmodified');
  assert.strictEqual(h.getFinished(), true, 'finish() must mark itself finished after completing');

  // Calling the real finish() again (simulating a second trigger --
  // e.g. a late rAF frame racing the watchdog) must NOT call
  // onComplete a second time.
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 1, 'a second finish() call must be a no-op once already finished -- onComplete must fire at most once');

  // Cancelled (unmounted/navigated away) -> finish() must never call
  // onComplete even with a ready result.
  h = makeFinishWatchdogHarness({ rec, cancelled: true });
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 0, 'finish() must never call onComplete after cancellation, even with a ready result');
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

test('I. reduced-motion and the animation-exception fallback both skip the decorative MIN_MS/REVEAL_MS wait and complete the instant analysis is done; the normal path still waits for both', () => {
  // Reduced motion: analysisDone alone is enough, even at elapsed=0 /
  // geomElapsed=0 (far below MIN_MS/REVEAL_MS) -- no artificial wait.
  let r = runGate({ reduceMotion: true, animationBroken: false, analysisDone: true, elapsed: 0, geomElapsed: 0 });
  assert.strictEqual(r.finishCalled, true, 'reduced-motion must complete as soon as analysisDone is true, with no MIN_MS/REVEAL_MS gate');

  // animationBroken (the new hang-fix fallback) must use the exact
  // same fast path as reduced-motion, not wait on the dead animation.
  r = runGate({ reduceMotion: false, animationBroken: true, analysisDone: true, elapsed: 0, geomElapsed: 0 });
  assert.strictEqual(r.finishCalled, true, 'animationBroken must complete as soon as analysisDone is true, exactly like reduced-motion');

  // Neither fast path may skip waiting on the real analysis result
  // itself -- analysisDone=false must never complete, however long
  // elapsed/geomElapsed are.
  r = runGate({ reduceMotion: true, animationBroken: false, analysisDone: false, elapsed: 999999, geomElapsed: 999999 });
  assert.strictEqual(r.finishCalled, false, 'reduced-motion must still wait for a real analysis result, never complete on elapsed time alone');
  r = runGate({ reduceMotion: false, animationBroken: true, analysisDone: false, elapsed: 999999, geomElapsed: 999999 });
  assert.strictEqual(r.finishCalled, false, 'animationBroken must still wait for a real analysis result, never complete on elapsed time alone');

  // The NORMAL (happy) path must be unaffected by the fix: it still
  // requires both floors (elapsed>=MIN_MS AND geomElapsed>=REVEAL_MS)
  // before it will even start the collapse countdown, and does not
  // complete on the same frame it starts collapsing.
  r = runGate({ reduceMotion: false, animationBroken: false, analysisDone: true, elapsed: 0, geomElapsed: 0 });
  assert.strictEqual(r.finishCalled, false, 'the normal path must NOT complete before MIN_MS/REVEAL_MS have elapsed');
  assert.strictEqual(r.collapseStart, null, 'the normal path must not even start collapsing before both floors clear');

  r = runGate({ reduceMotion: false, animationBroken: false, analysisDone: true, elapsed: MIN_MS, geomElapsed: REVEAL_MS });
  assert.strictEqual(r.finishCalled, false, 'the normal path must not complete on the very frame collapse starts -- COLLAPSE_MS must still elapse');
  assert.strictEqual(r.collapseStart, MIN_MS, 'the normal path must start the collapse countdown once both floors clear');

  r = runGate({ reduceMotion: false, animationBroken: false, analysisDone: true, elapsed: MIN_MS + COLLAPSE_MS, geomElapsed: REVEAL_MS, collapseStartInit: MIN_MS });
  assert.strictEqual(r.finishCalled, true, 'the normal path must complete once COLLAPSE_MS has elapsed since collapseStart');

  // GEOM_FALLBACK_MS still lets the normal path complete even if
  // geometry itself never satisfied REVEAL_MS, once the generous
  // extra margin has passed -- REVEAL_MS is no longer an absolute
  // blocker (this is the other half of the hang fix).
  r = runGate({ reduceMotion: false, animationBroken: false, analysisDone: true, elapsed: GEOM_FALLBACK_MS, geomElapsed: 0 });
  assert.strictEqual(r.collapseStart, GEOM_FALLBACK_MS, 'once GEOM_FALLBACK_MS has passed with no satisfied reveal, the normal path must still be able to start collapsing');
});

test('J. photo-appropriate label text ("ЛИЦО РАСПОЗНАНО"/"FACE DETECTED") is used in the scan animation, never the live-tracking-implying "SUBJECT LOCKED" string', () => {
  assert.ok(src.includes("photoFaceDetected: {ru:'ЛИЦО РАСПОЗНАНО', en:'FACE DETECTED', ar:'تم رصد الوجه'},"));
  assert.ok(photoScreenBlock.includes("t('photoFaceDetected', langRef.current)"));
  assert.ok(!photoScreenBlock.includes('stageSubjectLocked'), 'PhotoAnalysisScreen must never reuse the live-tracking-implying SUBJECT LOCKED string');
});

test('K. cancellation (unmount/back navigation) and the finished guard really do block late completion, including a watchdog that fires after Results was already reached', () => {
  // Structural: a real unmount cleanup sets cancelledRef, and the
  // animation effect's own cleanup independently clears the watchdog
  // timer and cancels any pending frame -- both must exist as real
  // cleanup code, not just be implied by the behavioral checks below.
  assert.ok(photoScreenBlock.includes('cancelledRef.current = true;'), 'expected an unmount cleanup that sets cancelledRef');
  assert.ok(photoScreenBlock.includes('clearTimeout(watchdogTimer);'), 'expected the animation effect\'s cleanup to clear the watchdog timer, so it can never fire after this effect instance is gone');

  // Behavioral, via the real extracted finish()/watchdogCallback,
  // sharing one `finished` flag exactly as in production:

  // 1. Unmount/back-navigation (cancelledRef=true) must block a late
  //    finish() even with a ready result -- no late onComplete.
  let h = makeFinishWatchdogHarness({ cancelled: true, rec: { r: 1 } });
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 0, 'a cancelled (unmounted) screen must never receive a late onComplete via finish()');

  // 2. Unmount/back-navigation must also block a late watchdog fire
  //    from surfacing an error state on a screen that's gone.
  h = makeFinishWatchdogHarness({ cancelled: true, rec: null });
  h.watchdogCallback();
  assert.strictEqual(h.calls.setState.length, 0, 'a cancelled (unmounted) screen must never be pushed into the error state by a late watchdog fire');
  assert.strictEqual(h.calls.onComplete.length, 0, 'a cancelled (unmounted) screen must never receive onComplete via a late watchdog fire');

  // 3. The watchdog must never demote an already-successful Results
  //    screen back to the error state -- this is the core race the
  //    finished flag exists to prevent.
  h = makeFinishWatchdogHarness({ finishedInit: true, rec: null });
  h.watchdogCallback();
  assert.strictEqual(h.calls.setState.length, 0, 'the watchdog must never call setState(\'error\') once finish() already completed successfully');

  // 4. The watchdog genuinely works when the analyzer is truly stuck
  //    (not merely inert) -- proves scenario 3 isn't passing only
  //    because the watchdog never does anything.
  h = makeFinishWatchdogHarness({ finishedInit: false, cancelled: false, rec: null });
  h.watchdogCallback();
  assert.strictEqual(h.calls.setState.length, 1, 'the watchdog must surface the error state exactly once when no result exists and nothing has completed yet');
  assert.strictEqual(h.calls.setState[0], 'error', 'the watchdog\'s failure state must be \'error\'');

  // 5. A result that only became ready right as the watchdog fires
  //    must still complete normally via finish(), never be treated
  //    as an error.
  const rec = { r: 2 };
  h = makeFinishWatchdogHarness({ finishedInit: false, cancelled: false, rec });
  h.watchdogCallback();
  assert.strictEqual(h.calls.onComplete.length, 1, 'the watchdog must complete via finish() when a result is already ready, not error out');
  assert.deepStrictEqual(h.calls.onComplete[0], rec, 'the watchdog-triggered completion must hand finish() the real ready result');
  assert.strictEqual(h.calls.setState.length, 0, 'a result that is ready must never be treated as a watchdog error');

  // 6. The actual race: normal completion reaches Results first, THEN
  //    the watchdog fires afterward (in the same shared harness, so
  //    both see the same `finished` flag) -- must never double-fire
  //    onComplete and must never bounce Results back to an error.
  h = makeFinishWatchdogHarness({ finishedInit: false, cancelled: false, rec });
  h.finish();
  assert.strictEqual(h.calls.onComplete.length, 1, 'normal completion must reach Results first');
  h.watchdogCallback();
  assert.strictEqual(h.calls.onComplete.length, 1, 'a watchdog firing after normal completion must not call onComplete a second time');
  assert.strictEqual(h.calls.setState.length, 0, 'a watchdog firing after normal completion must not bounce the app into the error state');
});

test('L. LEFT/RIGHT-affecting and mirroring production functions are never referenced by the new visual-layer code beyond the read-only physicalLeft/physicalRight values analyze() already computed', () => {
  const animStart = photoScreenBlock.indexOf('useEffect(() => {\n        if (state !== \'analyzing\') return;');
  assert.ok(animStart >= 0, 'expected to locate the scan-animation effect');
  const animBlock = photoScreenBlock.slice(animStart);
  for (const forbidden of ['getPhysicalEyeLandmarks(', 'normalizeEyePoints(', 'normalizeBrowPoints(', 'facingMode', 'getUserMedia', 'ctx.scale(-1', 'ctx.translate(']) {
    assert.ok(!animBlock.includes(forbidden), `the scan-animation effect must never call/reference ${forbidden}`);
  }
});
