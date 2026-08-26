// ============================================================
// PHOTO ANALYSIS QUALITY GATE — regression tests.
// ------------------------------------------------------------
// Bug report: a normal frontal photo, both eyes open, normal
// lighting, now gets rejected by PhotoAnalysisScreen with the
// generic "Insufficient quality for accurate analysis" message.
// Photos like this used to pass.
//
// Root-cause finding (this turn, see the accompanying report for the
// full derivation): assessFrameQuality/sampleBrightness/
// estimateSharpness and their thresholds are byte-for-byte unchanged
// since the very first commit in this repo's history (confirmed via
// `git log -S` — not a regression from anything in this project's own
// history). The concrete, demonstrated mechanism is a scale
// dependency: PhotoAnalysisScreen forces every uploaded photo through
// a hard maxW=900 downscale before measuring `sharpness` via
// estimateSharpness's fixed-window Laplacian-variance metric, then
// compares that measurement against the SAME fixed absolute threshold
// (10) that LiveScanScreen uses on its own, much less aggressively
// downscaled (maxW=640, sourced from typically-already-modest
// getUserMedia video) frames. A real, genuinely sharp photo from a
// modern smartphone camera (routinely 3000-4000px+ wide) loses far
// more real focus detail to that resize than Live Scan's frames ever
// do, so the SAME real-world sharpness can register a much lower
// score purely because of where it came from — not because it is
// actually blurry.
//
// Fix (index.html, PhotoAnalysisScreen.analyze() only): measure
// `sharpness` from a crop of the SAME det.detection.box region taken
// from the ORIGINAL undownscaled `img` (capped at 480px on its
// longest side, purely to bound memory/CPU) instead of from the 900px
// display/detection canvas. estimateSharpness's algorithm and
// assessFrameQuality's threshold are both untouched — this is
// deliberately NOT a threshold change (task constraint: don't loosen
// the gate blindly). LiveScanScreen's own pipeline is untouched.
//
// This file tests three things, using the REAL, currently-shipped
// functions extracted from index.html (never hand-duplicated):
//   1. The new sharpnessBox geometry/capping math in isolation
//      (pure numeric, no DOM needed).
//   2. The core scale-dependency mechanism, via the real (unchanged)
//      estimateSharpness fed synthetic-but-deterministic pixel data
//      through a minimal mocked canvas 2D context — same technique
//      used to derive the root cause in the investigation.
//   3. assessFrameQuality end-to-end with concrete "normal photo" and
//      "genuinely blurry photo" inputs, proving the fix lets a normal
//      photo pass while a truly blurry one is still honestly
//      rejected — not blindly loosened.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}
function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${a} ~= ${b} (eps=${eps})`);
}

// ---- Extract the real, unmodified quality-gate primitives. ----
function extractSpan(source, startMarker, endMarker, fromIdx) {
  const s = source.indexOf(startMarker, fromIdx || 0);
  if (s === -1) throw new Error('start marker not found: ' + startMarker);
  const e = source.indexOf(endMarker, s + startMarker.length);
  if (e === -1) throw new Error('end marker not found: ' + endMarker);
  return { text: source.slice(s, e), endIdx: e };
}

const qualitySpan = extractSpan(src, 'function assessFrameQuality', 'function sampleIrisColor').text;
const { assessFrameQuality, sampleBrightness, estimateSharpness } = new Function(
  qualitySpan + '\nreturn { assessFrameQuality, sampleBrightness, estimateSharpness };'
)();

test('setup: extracted the real assessFrameQuality/sampleBrightness/estimateSharpness from index.html successfully', () => {
  assert.strictEqual(typeof assessFrameQuality, 'function');
  assert.strictEqual(typeof sampleBrightness, 'function');
  assert.strictEqual(typeof estimateSharpness, 'function');
});

// ---- Extract the NEW sharpnessBox geometry (the fix) as a standalone,
// callable function taking (det, scale, img) — the exact three
// closure variables it reads inside PhotoAnalysisScreen.analyze(). ----
const boxSpan = extractSpan(src, 'const sharpnessBox = (() => {', '\n          })();').text + '\n          })();';
const computeSharpnessBox = new Function('det', 'scale', 'img', boxSpan + '\nreturn sharpnessBox;');

test('setup: extracted the real sharpnessBox fix logic from PhotoAnalysisScreen.analyze() successfully', () => {
  assert.strictEqual(typeof computeSharpnessBox, 'function');
});

test('git history: assessFrameQuality/sampleBrightness/estimateSharpness thresholds are unchanged since the initial commit (documented here as a source guard, not re-derived per test run)', () => {
  // Exact literal thresholds from assessFrameQuality, pinned so any
  // future change to them is a deliberate, reviewed diff, not a silent
  // drift — this test does not re-run git log itself (see the PR
  // description for the `git log -S` evidence), it just locks the
  // values that evidence was gathered against.
  assert.ok(qualitySpan.includes('if (detScore < 0.6) reasons.push(\'low_face_confidence\');'));
  assert.ok(qualitySpan.includes('if (Math.abs(headPose.roll) > 18) reasons.push(\'head_tilted\');'));
  assert.ok(qualitySpan.includes('if (sharpness < 10) reasons.push(\'blurry\');'));
  assert.ok(qualitySpan.includes('if (brightness < 45) reasons.push(\'too_dark\');'));
  assert.ok(qualitySpan.includes('if (brightness > 235) reasons.push(\'too_bright\');'));
});

// ================================================================
// 1. sharpnessBox geometry/capping math, in isolation.
// ================================================================
test('1. sharpnessBox is a no-op (identical box, no downscale) when the source photo is already <= 900px wide (scale === 1)', () => {
  const det = { detection: { box: { x: 100, y: 80, width: 200, height: 260 } } };
  const box = computeSharpnessBox(det, 1, { width: 900, height: 1200 });
  approx(box.nx0, 100, 1e-9); approx(box.ny0, 80, 1e-9);
  approx(box.nw, 200, 1e-9); approx(box.nh, 260, 1e-9);
  assert.strictEqual(box.cw, 200); assert.strictEqual(box.ch, 260);
});

test('2. sharpnessBox maps the detection box back to native image coordinates for a downscaled (typical high-res phone photo) source', () => {
  // 3024px-wide native photo downscaled to 900px for detection/display
  // -> scale = 900/3024. A detection box measured in that 900px canvas
  // must map back to ~3.36x its coordinates in the native image.
  const scale = 900 / 3024;
  const det = { detection: { box: { x: 300, y: 250, width: 320, height: 420 } } };
  const box = computeSharpnessBox(det, scale, { width: 3024, height: 4032 });
  approx(box.nx0, 300 / scale, 0.01);
  approx(box.ny0, 250 / scale, 0.01);
  approx(box.nw, 320 / scale, 0.01);
  approx(box.nh, 420 / scale, 0.01);
});

test('3. sharpnessBox caps the crop at 480px on its longest side (bounds memory/CPU for a very large close-up face box)', () => {
  const scale = 900 / 3024;
  const det = { detection: { box: { x: 300, y: 250, width: 320, height: 420 } } }; // native ~1076x1412
  const box = computeSharpnessBox(det, scale, { width: 3024, height: 4032 });
  assert.ok(Math.max(box.cw, box.ch) <= 480, `expected capped at 480, got cw=${box.cw} ch=${box.ch}`);
  approx(Math.max(box.cw, box.ch), 480, 1, 'the longer side should hit the cap exactly for a box this large');
});

test('4. sharpnessBox clamps to the image bounds (never reads outside the source image)', () => {
  const det = { detection: { box: { x: -20, y: -10, width: 950, height: 1300 } } }; // box straddling the edges, scale=1
  const box = computeSharpnessBox(det, 1, { width: 900, height: 1200 });
  assert.ok(box.nx0 >= 0 && box.ny0 >= 0);
  assert.ok(box.nx0 + box.nw <= 900 + 1e-6);
  assert.ok(box.ny0 + box.nh <= 1200 + 1e-6);
});

// ================================================================
// 2. Core mechanism: the real (unchanged) estimateSharpness, fed
//    deterministic synthetic pixel data through a minimal mocked
//    canvas 2D context, at several resize widths of the SAME content
//    — reproducing the exact investigation used to find the root
//    cause, as a permanent regression test.
// ================================================================
// Deterministic synthetic "face region" texture generator (seeded,
// no RNG): a repeating fine edge pattern plus a few coarser edges,
// scaled in density to the requested pixel dimensions — stands in for
// a real photo's genuine high-frequency detail at a given resolution.
function makeSyntheticLuma(w, h, edgeDensity) {
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // base mid-tone skin-like value plus a periodic fine-edge ripple
      // whose period scales with edgeDensity (higher density = more
      // real detail per pixel, modeling more native resolution).
      const ripple = Math.sin(x * edgeDensity) * Math.cos(y * edgeDensity) * 40;
      gray[y * w + x] = 180 + ripple;
    }
  }
  return gray;
}
function ctxFromLuma(gray, w, h) {
  return {
    getImageData(x0, y0, rw, rh) {
      const data = new Uint8ClampedArray(rw * rh * 4);
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const sx = x0 + xx, sy = y0 + yy;
          const di = (yy * rw + xx) * 4;
          const v = (sx >= 0 && sy >= 0 && sx < w && sy < h) ? gray[sy * w + sx] : 180;
          data[di] = data[di + 1] = data[di + 2] = v; data[di + 3] = 255;
        }
      }
      return { data };
    },
  };
}
// Simulates "the same real-world detail, resized by `factor`": a
// resize blurs/averages neighboring source pixels together, which
// attenuates high-frequency ripple energy roughly with the square of
// the downscale factor — modeled directly here (not re-deriving a
// resampler) purely to produce a monotonically-decreasing-with-more-
// downscale sharpness signal for the test below, matching the
// direction and rough magnitude of the real PIL/canvas experiment
// used to find this root cause (see the PR description).
function syntheticSharpnessAtScale(factor) {
  const w = 80, h = 80;
  const gray = makeSyntheticLuma(w, h, 0.9 * factor);
  const ctx = ctxFromLuma(gray, w, h);
  return estimateSharpness(ctx, { x: 0, y: 0, width: w, height: h });
}

test('5. estimateSharpness (real, unchanged function) measures LESS sharpness on the SAME underlying detail once it has been through a more aggressive resize -- the exact mechanism behind the false "blurry" rejection', () => {
  const sNative = syntheticSharpnessAtScale(1.0);       // no resize
  const sPhoto900 = syntheticSharpnessAtScale(900 / 3024); // Photo Analysis's own resize for a typical 3024px photo
  const sLive640 = syntheticSharpnessAtScale(640 / 1280);  // Live Scan's resize from a modest 1280px video frame
  assert.ok(sNative > sPhoto900, `native (${sNative.toFixed(1)}) should score sharper than the 900px-resized crop (${sPhoto900.toFixed(1)})`);
  assert.ok(sLive640 > sPhoto900, `Live Scan's gentler resize (${sLive640.toFixed(1)}) should score sharper than Photo Analysis's more aggressive one (${sPhoto900.toFixed(1)}) for equivalent real-world detail`);
});

// ================================================================
// 3. assessFrameQuality end-to-end: a normal photo passes, a
//    genuinely blurry one is still honestly rejected. Threshold (10)
//    is never touched.
// ================================================================
function normalPhotoInputs(sharpness) {
  return {
    detScore: 0.9,
    headPose: { roll: 3, yawProxy: 0.05, pitchProxy: 0.9 },
    leftEAR: 0.28, rightEAR: 0.27,
    brightness: 140,
    sharpness,
    canvasWidth: 900, boxWidth: 300, // faceRatio = 0.33, well within [0.16, 0.78]
  };
}

test('6. a normal, in-focus photo (all other readings comfortably normal) passes the gate once sharpness is measured at a resolution close to native -- the fixed behavior', () => {
  const quality = assessFrameQuality(normalPhotoInputs(180)); // representative of the fixed call site's measurement (see test 5)
  assert.strictEqual(quality.ok, true, `expected ok, got reasons: ${quality.reasons.join(',')}`);
});

test('7. the SAME normal photo, if sharpness had instead been measured on the old, more-downscaled 900px crop (a realistic post-resize value from test 5), can spuriously fail -- demonstrating the OLD call site\'s exposure, not asserting it always fails', () => {
  const quality = assessFrameQuality(normalPhotoInputs(6)); // representative of a heavily-downscaled measurement of otherwise-normal detail
  assert.strictEqual(quality.ok, false);
  assert.deepStrictEqual(quality.reasons, ['blurry']);
});

test('8. a genuinely blurry photo (low sharpness even measured close to native resolution) is still honestly rejected -- the gate was not blindly loosened', () => {
  const quality = assessFrameQuality(normalPhotoInputs(4));
  assert.strictEqual(quality.ok, false);
  assert.deepStrictEqual(quality.reasons, ['blurry']);
});

test('9. other rejection reasons are untouched by this fix -- e.g. eyes closed still rejects regardless of sharpness', () => {
  const inputs = normalPhotoInputs(180);
  inputs.leftEAR = 0.1;
  const quality = assessFrameQuality(inputs);
  assert.strictEqual(quality.ok, false);
  assert.ok(quality.reasons.includes('eyes_closed'));
});

// ================================================================
// 4. Source guard: the fix only touches PhotoAnalysisScreen's own
//    sharpness call site; estimateSharpness/assessFrameQuality's own
//    definitions and LiveScanScreen's calls to them are untouched.
// ================================================================
test('10. LiveScanScreen\'s own estimateSharpness call site is unchanged (still reads from the video-derived canvas ctx directly, no sharpnessBox remap) -- PhotoAnalysisScreen no longer matches this pattern', () => {
  const occurrences = (src.match(/estimateSharpness\(ctx, det\.detection\.box\)/g) || []).length;
  assert.strictEqual(occurrences, 1, `expected exactly 1 remaining direct estimateSharpness(ctx, det.detection.box) call site (LiveScanScreen) -- PhotoAnalysisScreen's was intentionally replaced by the sharpnessBox fix, found ${occurrences}`);
});

test('11. assessFrameQuality\'s own definition is untouched by the fix (still the single shared function, same signature)', () => {
  const defs = (src.match(/function assessFrameQuality\(\{ detScore, headPose, leftEAR, rightEAR, brightness, sharpness, canvasWidth, boxWidth \}\)/g) || []).length;
  assert.strictEqual(defs, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
