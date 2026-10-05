'use strict';
// ============================================================
// AUTO LASH FIT — HYBRID MVP C production integration regression
// coverage. Covers the actual production glue inside index.html
// (applyHybridCRefinement) and its wiring into buildPhotoPreviewEyes /
// its 4 call sites, using the SAME established string-slice +
// new Function extraction pattern every other index.html test in this
// repo already uses (see photo-canonical.test.js, photo-lash-map-
// mirror-oracle.test.js). Does not touch production; read-only.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const HybridC = require(path.join(root, 'auto-lash-fit-hybrid-c.js'));

function slice(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start !== -1, `could not find "${startMarker}"`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `could not find end marker "${endMarker}" after "${startMarker}"`);
  return src.slice(start, end);
}

const monotoneSrc = slice('    function monotoneCubicValue(nodes,values,t) {', '\n    // Presentation-only cubic deformation');
const hybridSrc = slice('    function applyHybridCRefinement(points,eye,pixelSource,imageWidth,imageHeight) {', '    function buildProfessionalPhotoCrop(');
const { applyHybridCRefinement } = new Function(`
${monotoneSrc}
${hybridSrc}
return { applyHybridCRefinement };
`)();

// Faithful simulation of the real browser environment: in production,
// computeHybridCDisplacementSamples lands as a bare global via the
// <script src="auto-lash-fit-hybrid-c.js"> tag (see index.html's own
// loading comment) -- same technique lash-scan-core.js's functions use.
global.computeHybridCDisplacementSamples = HybridC.computeHybridCDisplacementSamples;

function mockCanvasCtx(buf, w, h) {
  return { getImageData() { return { data: buf }; } };
}

function makeMockDocument(roiBuf, roiW, roiH, drawImageCalls) {
  return {
    createElement() {
      return {
        width: 0, height: 0,
        getContext() { return { ...mockCanvasCtx(roiBuf, roiW, roiH), drawImage(...args) { if (drawImageCalls) drawImageCalls.push(args); } }; },
      };
    },
  };
}

function paintBand(buf, w, h, upperPoints, roiX0, roiY0, frame, bandOffset, contrast, bg) {
  for (let x = 0; x < w; x++) {
    let best = upperPoints[0], bd = Infinity;
    for (const p of upperPoints) { const dd = Math.abs((p.x - roiX0) - x); if (dd < bd) { bd = dd; best = p; } }
    for (let dy = bandOffset - 5; dy <= bandOffset + 5; dy++) {
      const yy = Math.round((best.y - roiY0) - dy);
      if (yy >= 0 && yy < h) { const o = (yy * w + x) * 4; const v = bg - contrast; buf[o] = v; buf[o + 1] = v; buf[o + 2] = v; }
    }
  }
}

const UPPER_EYE = [{ x: 0, y: 150 }, { x: 96, y: 92.4 }, { x: 224, y: 86 }, { x: 320, y: 150 }];
const EYE_WIDTH = 320;
const POINTS = Array.from({ length: 21 }, (_, i) => { const t = i / 20; return { t, x: t * 320, y: 150 - 40 * Math.sin(Math.PI * t) }; });
const VALID_IMG = { complete: true, naturalWidth: 1000, naturalHeight: 800 };

test('1. existing baseline is preserved when no pixelSource is supplied (required test #1)', () => {
  const result = applyHybridCRefinement(POINTS, UPPER_EYE, undefined);
  assert.strictEqual(result, POINTS, 'must return the EXACT same array reference, not a copy -- true no-op');
});

test('1b. existing baseline is preserved when pixelSource has not finished loading (image not ready)', () => {
  const notReady = { complete: false, naturalWidth: 0 };
  const result = applyHybridCRefinement(POINTS, UPPER_EYE, notReady);
  assert.strictEqual(result, POINTS);
});

test('1c. existing baseline is preserved when document/canvas access throws (e.g. a tainted-canvas security error) -- safe fallback at a real system boundary', () => {
  global.document = { createElement() { throw new Error('simulated tainted canvas'); } };
  try {
    const result = applyHybridCRefinement(POINTS, UPPER_EYE, VALID_IMG);
    assert.strictEqual(result, POINTS);
  } finally { delete global.document; }
});

test('1d. existing baseline is preserved when no real pixel evidence exists (uniform/blank photo)', () => {
  const w = 420, h = 300;
  const buf = new Uint8ClampedArray(w * h * 4).fill(200);
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
  global.document = makeMockDocument(buf, w, h);
  try {
    const result = applyHybridCRefinement(POINTS, UPPER_EYE, VALID_IMG);
    assert.strictEqual(result, POINTS, 'no usable pixel evidence must mean the baseline is returned unchanged');
  } finally { delete global.document; }
});

test('2. Hybrid correction can never exceed +-0.05*eyeWidth (required test #2), verified on the REAL production points with real pixel evidence', () => {
  const w = 420, h = 300;
  const buf = new Uint8ClampedArray(w * h * 4).fill(200);
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
  const drawImageCalls = [];
  global.document = makeMockDocument(buf, w, h, drawImageCalls);
  try {
    // paint a real band (approximate ROI offset: margin ~= eyeWidth*.5 in x, generous in y)
    const marginFrac = .5;
    const xs = UPPER_EYE.map(p => p.x), ys = UPPER_EYE.map(p => p.y);
    const w0 = Math.max(...xs) - Math.min(...xs), h0 = Math.max(1, Math.max(...ys) - Math.min(...ys));
    const mx = w0 * marginFrac, my = Math.max(h0 * marginFrac * 4, w0 * marginFrac);
    const roiX0 = Math.max(0, Math.round(Math.min(...xs) - mx)), roiY0 = Math.max(0, Math.round(Math.min(...ys) - my));
    const frame = HybridC.computeChordFrame(UPPER_EYE[0], UPPER_EYE[3]);
    paintBand(buf, w, h, UPPER_EYE, roiX0, roiY0, frame, 10, 150, 200);

    const result = applyHybridCRefinement(POINTS, UPPER_EYE, VALID_IMG);
    const bound = 0.05 * EYE_WIDTH;
    assert.notStrictEqual(result, POINTS, 'sanity: real pixel evidence must actually produce a different (refined) array');
    for (let i = 0; i < result.length; i++) {
      const dx = result[i].x - POINTS[i].x, dy = result[i].y - POINTS[i].y;
      const displacement = Math.hypot(dx, dy);
      assert.ok(displacement <= bound + 1e-6, `point ${i} displaced ${displacement.toFixed(3)}px, exceeding bound ${bound.toFixed(3)}px`);
    }
  } finally { delete global.document; }
});

test('3. LEFT and RIGHT physical eyes produce correctly bounded, canonical results -- no side-specific branching exists in applyHybridCRefinement (it only ever reads eye[0..3]/points, never a side label)', () => {
  assert.ok(!hybridSrc.includes("side==='left'") && !hybridSrc.includes("side==='right'") && !hybridSrc.includes('physicalSide'), 'applyHybridCRefinement must be side-agnostic -- canonical for both LEFT and RIGHT by construction, not by a branch');
  const w = 420, h = 300;
  const rightEye = UPPER_EYE.map(p => ({ x: 320 - p.x, y: p.y }));
  const rightPoints = POINTS.map(p => ({ ...p, x: 320 - p.x }));
  for (const [upper, points] of [[UPPER_EYE, POINTS], [rightEye, rightPoints]]) {
    const buf = new Uint8ClampedArray(w * h * 4).fill(200);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
    global.document = makeMockDocument(buf, w, h);
    try {
      const xs = upper.map(p => p.x), ys = upper.map(p => p.y);
      const marginFrac = .5;
      const w0 = Math.max(...xs) - Math.min(...xs), h0 = Math.max(1, Math.max(...ys) - Math.min(...ys));
      const mx = w0 * marginFrac, my = Math.max(h0 * marginFrac * 4, w0 * marginFrac);
      const roiX0 = Math.max(0, Math.round(Math.min(...xs) - mx)), roiY0 = Math.max(0, Math.round(Math.min(...ys) - my));
      const frame = HybridC.computeChordFrame(upper[0], upper[3]);
      paintBand(buf, w, h, upper, roiX0, roiY0, frame, 10, 150, 200);
      const result = applyHybridCRefinement(points, upper, VALID_IMG);
      const bound = 0.05 * 320;
      for (let i = 0; i < result.length; i++) {
        const displacement = Math.hypot(result[i].x - points[i].x, result[i].y - points[i].y);
        assert.ok(displacement <= bound + 1e-6);
      }
    } finally { delete global.document; }
  }
});

test('4. manual photo adjustment ordering: buildPhotoPreviewEyes applies Hybrid C AFTER applyManualPhotoAdjustment + applyPhotoWidthScale, never before -- a user\'s existing manual adjustment is never overridden by the automatic pixel refinement', () => {
  const previewStart = src.indexOf('    function buildPhotoPreviewEyes(');
  const previewEnd = src.indexOf('    function PhotoLashPreviewPanel(', previewStart);
  const preview = src.slice(previewStart, previewEnd);
  const manualIdx = preview.indexOf('applyManualPhotoAdjustment(');
  const widthScaleIdx = preview.indexOf('applyPhotoWidthScale(');
  const hybridIdx = preview.indexOf('applyHybridCRefinement(');
  assert.ok(manualIdx !== -1 && widthScaleIdx !== -1 && hybridIdx !== -1);
  assert.ok(manualIdx < widthScaleIdx && widthScaleIdx < hybridIdx, 'order must be: manual adjustment -> width scale -> Hybrid C (Hybrid C refines whatever the user already has, never the reverse)');
});

test('5. all 4 real call sites of buildPhotoPreviewEyes in index.html pass pixelSource -- the Lash Map -> Photo Preview flow and every render path (main panel, auto-focus, editor render, WYSIWYG overlay) are wired consistently', () => {
  // (no \s* after the first comma -- deliberately excludes the function
  // DECLARATION itself, "function buildPhotoPreviewEyes(result, clientDesign, options)",
  // which uses a space there; every real CALL site in this file does not.)
  const calls = [...src.matchAll(/buildPhotoPreviewEyes\(result,clientDesign[^)]*\)/g)].map(m => m[0]);
  assert.strictEqual(calls.length, 4, `expected exactly 4 call sites, found ${calls.length}: ${JSON.stringify(calls)}`);
  for (const call of calls) assert.ok(call.includes('pixelSource'), `call site must pass pixelSource: ${call}`);
});

test('6a. curl/effect/fiber rendering is unchanged: PhotoLashPreview.buildFibers is still called with the SAME eyeWidth (Math.hypot inner/outer), curl, and renderVariant signature as before -- Hybrid C never touches fiber length/curl/texture/density computation', () => {
  const previewStart = src.indexOf('    function buildPhotoPreviewEyes(');
  const previewEnd = src.indexOf('    function PhotoLashPreviewPanel(', previewStart);
  const preview = src.slice(previewStart, previewEnd);
  assert.ok(preview.includes('const eyeWidth=Math.hypot(eye[3].x-eye[0].x,eye[3].y-eye[0].y);'), 'buildFibers\' own eyeWidth computation must be byte-identical to before');
  assert.ok(preview.includes('const fibers=PhotoLashPreview.buildFibers(points,eyeWidth,props.curl,renderVariant?{variant:renderVariant}:undefined);'));
});

test('6b. photo-lash-preview.js (fiber rendering/curl/texture/density engine) is completely untouched by this integration', () => {
  const photoLashPreviewSrc = fs.readFileSync(path.join(root, 'photo-lash-preview.js'), 'utf8');
  assert.ok(!photoLashPreviewSrc.includes('HybridC') && !photoLashPreviewSrc.includes('corridorBound') && !photoLashPreviewSrc.includes('applyHybridCRefinement'), 'the renderer must have zero knowledge of Hybrid C -- it only ever receives already-resolved points, same as before');
});

test('7. Hybrid C is wired as a SEPARATE, additive layer -- buildProfessionalPhotoLine and applyManualPhotoAdjustment source text is untouched (same locality/no-overshoot/manual-correctness properties already proven about them remain valid)', () => {
  const photoLineSrc = slice('    function buildProfessionalPhotoLine(eye, points) {', '    const createManualPhotoAdjustment');
  assert.ok(photoLineSrc.includes("offset=Math.max(1,eyeW*.055)"), 'the landmark baseline formula itself must be byte-identical to before');
  assert.ok(!photoLineSrc.includes('HybridC') && !photoLineSrc.includes('pixelSource') && !photoLineSrc.includes('applyHybridCRefinement'), 'buildProfessionalPhotoLine must have zero knowledge of Hybrid C -- it remains the pure, untouched anatomical prior');
});

test('8. the new module is loaded as a plain, dependency-free script, same pattern as every other per-file module, AFTER photo-lash-preview.js', () => {
  const scriptIdx = src.indexOf('<script src="auto-lash-fit-hybrid-c.js"></script>');
  const photoLashPreviewIdx = src.indexOf('<script src="photo-lash-preview.js"></script>');
  assert.ok(scriptIdx !== -1 && photoLashPreviewIdx !== -1 && scriptIdx > photoLashPreviewIdx);
});

test('9. corridorBoundFrac is explicitly 0.05 in the shipped production module (the approved, CLOSED value) -- not re-derived or re-tuned in index.html', () => {
  assert.strictEqual(HybridC.CORRIDOR_BOUND_FRAC, 0.05);
  // index.html may MENTION the value in an explanatory comment/prose (it
  // does, twice) but must never itself DECLARE a variable for it -- the
  // single source of truth stays the module.
  assert.ok(!/\b(?:const|let|var)\s+CORRIDOR_BOUND_FRAC\b/.test(src), 'index.html itself must not define its own copy of this constant -- it only consumes the module\'s own closed value');
});

// ------------------------------------------------------------
// COORDINATE SPACE regression: eye/points live in the ANALYSIS image
// space (result.imageWidth/Height), while pixelSource is the
// native-resolution photo. The ROI must be computed in analysis space
// and its drawImage SOURCE rect mapped analysis -> native with
// independent sx/sy (sx=naturalWidth/imageWidth, sy=naturalHeight/
// imageHeight); the DESTINATION rect stays in analysis units so the
// detector's geometry (eyeWidth, corridor bound) is unchanged.
// ------------------------------------------------------------
const SHIFTED_EYE = UPPER_EYE.map(p => ({ x: p.x + 400, y: p.y + 300 }));
const SHIFTED_POINTS = POINTS.map(p => ({ ...p, x: p.x + 400, y: p.y + 300 }));
function expectedAnalysisRoi(upper, analysisW, analysisH) {
  const xs = upper.map(p => p.x), ys = upper.map(p => p.y);
  const w0 = Math.max(...xs) - Math.min(...xs), h0 = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const mx = w0 * .5, my = Math.max(h0 * .5 * 4, w0 * .5);
  const x0 = Math.max(0, Math.round(Math.min(...xs) - mx)), y0 = Math.max(0, Math.round(Math.min(...ys) - my));
  const x1 = Math.min(analysisW, Math.round(Math.max(...xs) + mx)), y1 = Math.min(analysisH, Math.round(Math.max(...ys) + my));
  return { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}
function captureDrawImage(native, analysisW, analysisH) {
  const roi = expectedAnalysisRoi(SHIFTED_EYE, analysisW, analysisH);
  const buf = new Uint8ClampedArray(roi.w * roi.h * 4).fill(200);
  const calls = [];
  global.document = makeMockDocument(buf, roi.w, roi.h, calls);
  try {
    applyHybridCRefinement(SHIFTED_POINTS, SHIFTED_EYE, { complete: true, naturalWidth: native.w, naturalHeight: native.h }, analysisW, analysisH);
  } finally { delete global.document; }
  assert.strictEqual(calls.length, 1, 'exactly one ROI read');
  return { args: calls[0].slice(1), roi };
}

test('10a. ROI source rect is mapped analysis -> native (native 2x analysis): nativeX=analysisX*sx, nativeY=analysisY*sy; destination stays in analysis units', () => {
  const { args, roi } = captureDrawImage({ w: 2000, h: 1600 }, 1000, 800);
  assert.deepStrictEqual(args, [roi.x0 * 2, roi.y0 * 2, roi.w * 2, roi.h * 2, 0, 0, roi.w, roi.h]);
  assert.ok(roi.x0 > 0 && roi.y0 > 0, 'sanity: the fixture ROI is not clamped at the origin, so a missing scale would be detectable');
});

test('10b. independent sx/sy: a non-uniformly scaled native image (sx=3, sy=1.5) maps each axis with its own factor', () => {
  const { args, roi } = captureDrawImage({ w: 3000, h: 1200 }, 1000, 800);
  assert.deepStrictEqual(args, [roi.x0 * 3, roi.y0 * 1.5, roi.w * 3, roi.h * 1.5, 0, 0, roi.w, roi.h]);
});

test('10c. identity: when native and analysis resolutions are equal, the source rect equals the analysis ROI exactly', () => {
  const { args, roi } = captureDrawImage({ w: 1000, h: 800 }, 1000, 800);
  assert.deepStrictEqual(args, [roi.x0, roi.y0, roi.w, roi.h, 0, 0, roi.w, roi.h]);
});

test('10d. ROI bounds are clamped in ANALYSIS space (not native): a native image much larger than analysis never lets the ROI extend past the analysis frame', () => {
  const { args, roi } = captureDrawImage({ w: 4000, h: 3200 }, 700, 500);
  assert.ok(roi.x0 + roi.w <= 700 && roi.y0 + roi.h <= 500);
  assert.ok(args[0] + args[2] <= 4000 + 1e-9 && args[1] + args[3] <= 3200 + 1e-9, 'mapped source rect stays inside the native image');
  const sx = 4000 / 700, sy = 3200 / 500;
  assert.deepStrictEqual(args, [roi.x0 * sx, roi.y0 * sy, roi.w * sx, roi.h * sy, 0, 0, roi.w, roi.h]);
});

test('10e. buildPhotoPreviewEyes passes the analysis resolution (result.imageWidth/imageHeight) into applyHybridCRefinement', () => {
  const previewStart = src.indexOf('    function buildPhotoPreviewEyes(');
  const previewEnd = src.indexOf('    function PhotoLashPreviewPanel(', previewStart);
  const preview = src.slice(previewStart, previewEnd);
  assert.ok(preview.includes('applyHybridCRefinement(widthScaledPoints,eye,options&&options.pixelSource,result.imageWidth,result.imageHeight)'));
});
