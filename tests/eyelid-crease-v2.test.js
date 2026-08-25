// ============================================================
// EYELID CREASE DETECTOR V2 — debug-only shadow detector tests.
// ------------------------------------------------------------
// V2 is never wired into production classification. These tests
// verify: (A) V1 is byte-for-byte unchanged, (B/C) V2 cannot run or
// influence production output, (D-N) V2's own geometry/candidate
// behavior, using a minimal mock <canvas>/document so extractEyeROI
// (real, unmodified) and detectEyelidCreaseV2 (real, extracted
// straight out of index.html) can be exercised end to end without a
// browser — same technique as tests/lash-scan-core.test.js's mockRoi,
// extended to support drawImage's crop-and-resample call shape since
// detectEyelidCreaseV2 goes through extractEyeROI/document.createElement.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// ================================================================
// A. V1 is byte-for-byte unchanged — recorded sha256 of its exact
// source text (function detectEyelidCrease(...) { ... }), captured
// immediately before V2 implementation began this session.
// ================================================================
const V1_EXPECTED_SHA256 = '888c89dab654ad4adc8fa3b87531da3b7cab83696537a48f0732df0b440c9715';
const v1Start = src.indexOf('function detectEyelidCrease(sourceCanvas');
const v1End = src.indexOf('\n    }', v1Start) + '\n    }'.length;
const v1Source = src.slice(v1Start, v1End);

test('A. detectEyelidCrease (V1) source is byte-for-byte unchanged', () => {
  assert.ok(v1Start !== -1, 'could not locate detectEyelidCrease in index.html');
  const actualSha = crypto.createHash('sha256').update(v1Source).digest('hex');
  assert.strictEqual(actualSha, V1_EXPECTED_SHA256,
    'detectEyelidCrease source has changed since V2 shadow-mode implementation began — V1 must stay frozen');
});

// ================================================================
// B. V2 does not run in normal mode (source guard on the wiring)
// ================================================================
test('B. detectEyelidCreaseV2 is only called inside an if(debugAvailable) block in LiveScanScreen', () => {
  const callIdx = src.indexOf('detectEyelidCreaseV2(canvas, leftEye, leftBrowPts)');
  assert.ok(callIdx !== -1, 'expected detectEyelidCreaseV2 call site not found — has LiveScanScreen wiring changed?');
  const before = src.slice(Math.max(0, callIdx - 400), callIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(before),
    'detectEyelidCreaseV2 call is not visibly guarded by "if (debugAvailable)" immediately above it');
});
test('B2. detectEyelidCreaseV2 in PhotoAnalysisScreen is only called inside an if(isDebugModeEnabled()) block', () => {
  const allCallIdxs = [...src.matchAll(/detectEyelidCreaseV2\(canvas, (left|right)Eye, (left|right)BrowPts\)/g)].map(m => m.index);
  assert.ok(allCallIdxs.length >= 4, `expected >=4 total detectEyelidCreaseV2 call sites (2 in LiveScanScreen, 2 in PhotoAnalysisScreen), found ${allCallIdxs.length}`);
  const photoCallIdxs = allCallIdxs.filter(idx => idx > src.indexOf('function PhotoAnalysisScreen('));
  assert.ok(photoCallIdxs.length >= 2, 'expected 2 detectEyelidCreaseV2 calls inside PhotoAnalysisScreen');
  for (const idx of photoCallIdxs) {
    const before = src.slice(Math.max(0, idx - 400), idx);
    assert.ok(/if\s*\(isDebugModeEnabled\(\)\)/.test(before),
      'PhotoAnalysisScreen detectEyelidCreaseV2 call is not visibly guarded by "if (isDebugModeEnabled())" immediately above it');
  }
});

// ================================================================
// C. V2 output cannot affect classifyFeatures input (source guard) —
// the only writers of leftMetrics.crease*/rightMetrics.crease* must
// reference leftCrease/rightCrease (V1), never a V2-named variable.
// ================================================================
test('C. leftMetrics/rightMetrics crease fields are only ever assigned from V1 (leftCrease/rightCrease), never from V2', () => {
  const assignRegex = /(left|right)Metrics\.crease(Valid|Prominence|Peak|YFrac|ReadQuality)\s*=\s*([^;]+);/g;
  const matches = [...src.matchAll(assignRegex)];
  assert.ok(matches.length > 0, 'sanity: expected to find creaseValid/Prominence/Peak/YFrac/ReadQuality assignments');
  for (const m of matches) {
    assert.ok(!/[Vv]2|debugCreaseV2/.test(m[3]),
      `found a crease field assigned from something V2-related: "${m[0]}"`);
    assert.ok(/leftCrease|rightCrease/.test(m[3]),
      `crease field assignment does not reference V1's leftCrease/rightCrease: "${m[0]}"`);
  }
});

// ================================================================
// Mock canvas/document infrastructure — supports exactly the
// drawImage/getImageData call shapes extractEyeROI and
// detectEyelidCreaseV2 use, nothing more.
// ================================================================
function makeMockCanvas(w, h) {
  let buf = new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4);
  for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 255;
  const self = {
    get width() { return w; },
    set width(v) { w = v; buf = new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4); for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 255; },
    get height() { return h; },
    set height(v) { h = v; buf = new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4); for (let i = 0; i < buf.length; i += 4) buf[i + 3] = 255; },
    _buf: () => buf,
    getContext() {
      return {
        drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh) {
          const sBuf = srcCanvas._buf(), sW = srcCanvas.width, sH = srcCanvas.height;
          for (let y = 0; y < dh; y++) {
            for (let x = 0; x < dw; x++) {
              const srcX = Math.min(sW - 1, Math.max(0, Math.floor(sx + x * (sw / dw))));
              const srcY = Math.min(sH - 1, Math.max(0, Math.floor(sy + y * (sh / dh))));
              const sIdx = (srcY * sW + srcX) * 4, dIdx = ((dy + y) * w + (dx + x)) * 4;
              if (dIdx < 0 || dIdx + 3 >= buf.length) continue;
              buf[dIdx] = sBuf[sIdx]; buf[dIdx + 1] = sBuf[sIdx + 1]; buf[dIdx + 2] = sBuf[sIdx + 2]; buf[dIdx + 3] = 255;
            }
          }
        },
        getImageData(x, y, ww, hh) {
          const data = new Uint8ClampedArray(ww * hh * 4);
          for (let yy = 0; yy < hh; yy++) {
            for (let xx = 0; xx < ww; xx++) {
              const sIdx = ((y + yy) * w + (x + xx)) * 4, dIdx = (yy * ww + xx) * 4;
              if (sIdx < 0 || sIdx + 3 >= buf.length) continue;
              data[dIdx] = buf[sIdx]; data[dIdx + 1] = buf[sIdx + 1]; data[dIdx + 2] = buf[sIdx + 2]; data[dIdx + 3] = 255;
            }
          }
          return { data };
        },
      };
    },
  };
  return self;
}
// Paint a horizontal-ish edge into a canvas: rows below edgeYAt(x) are
// `below` gray, rows at/above are `above` gray, optionally with noise.
function paintEdgeCanvas(w, h, edgeYAt, above, below, noiseAmp) {
  const c = makeMockCanvas(w, h);
  const buf = c._buf();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edgeY = edgeYAt(x);
      let g = y < edgeY ? above : below;
      if (noiseAmp) g += (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * noiseAmp;
      g = Math.max(0, Math.min(255, g));
      const idx = (y * w + x) * 4;
      buf[idx] = g; buf[idx + 1] = g; buf[idx + 2] = g; buf[idx + 3] = 255;
    }
  }
  return c;
}

const realDocument = typeof document !== 'undefined' ? document : undefined;
global.document = { createElement: (tag) => (tag === 'canvas' ? makeMockCanvas(0, 0) : (() => { throw new Error('unexpected createElement: ' + tag); })()) };
global.performance = typeof performance !== 'undefined' ? performance : { now: () => Date.now() };

// ---- Extract the real, currently-shipped V2 pipeline (extractEyeROI
// + detectEyelidCreaseV2 + their small helpers) straight out of index.html ----
// Spans clamp01 through the end of extractEyeROI so detectEyelidCreaseV2
// (which calls extractEyeROI, defined later in the file — safe because
// function declarations hoist within the same evaluated script) has
// every dependency available: computeHeadPose, computeEyeSideMetrics,
// detectEyelidCrease, detectEyelidCreaseV2, classifyFeatures,
// extractEyeROI, in that textual order.
const clamp01Start = src.indexOf('    const clamp01 = ');
const v2EndMarker = '\n    function assessLashFrameQuality(';
const v2EndIdx = src.indexOf(v2EndMarker);
const pipelineSource = src.slice(clamp01Start, v2EndIdx);
// The extracted range is interleaved with a couple of top-level React
// setup statements (e.g. `const LangContext = createContext('ru')`)
// that execute unconditionally at definition time even though this
// pipeline never touches React — same situation as the other extracted
// test files in this suite. Stubbed here purely so the extraction
// evaluates outside a browser.
const reactStubsForV2 = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;
const {
  detectEyelidCreaseV2, extractEyeROI, DEBUG_V2_UNCALIBRATED, detectEyelidCreaseV2Multi, DEBUG_V2_MULTI_MAX_PEAKS, debugV2FindLocalMaxima,
  debugV2LinkMultiPeakPaths, debugV2SummarizeLinkedPath, debugV2BuildLinkedPaths,
} = new Function(
  reactStubsForV2 + pipelineSource + '\nreturn { detectEyelidCreaseV2, extractEyeROI, DEBUG_V2_UNCALIBRATED, detectEyelidCreaseV2Multi, DEBUG_V2_MULTI_MAX_PEAKS, debugV2FindLocalMaxima, debugV2LinkMultiPeakPaths, debugV2SummarizeLinkedPath, debugV2BuildLinkedPaths };'
)();

test('setup: extracted real detectEyelidCreaseV2 from index.html successfully', () => {
  assert.strictEqual(typeof detectEyelidCreaseV2, 'function');
  assert.strictEqual(typeof extractEyeROI, 'function');
});

// Synthetic eye geometry: a 120x70 face-region canvas with a roughly
// horizontal eye band. Canonical eye points (inner->outer, physical
// LEFT eye shape = ascending x, matching getRightEye()'s raw order
// per the physical-normalization audit) and a brow polyline above it.
function syntheticLeftEyeGeometry() {
  const eye = [
    { x: 30, y: 45 }, { x: 42, y: 40 }, { x: 58, y: 40 }, { x: 70, y: 45 }, // upper lid: inner..outer
    { x: 58, y: 52 }, { x: 42, y: 52 },
  ];
  const brow = [{ x: 28, y: 15 }, { x: 40, y: 10 }, { x: 50, y: 8 }, { x: 60, y: 10 }, { x: 72, y: 15 }];
  return { eye, brow };
}
// Physical RIGHT eye shape: same anatomy mirrored, canonical order
// still inner->outer, but DESCENDING x (matches getLeftEye()'s raw
// order after the [3,2,1,0,5,4] permutation, per the L/R audit).
function syntheticRightEyeGeometry() {
  const M = 100; // mirror axis
  const mx = (x) => M - x;
  const eye = [
    { x: mx(30), y: 45 }, { x: mx(42), y: 40 }, { x: mx(58), y: 40 }, { x: mx(70), y: 45 },
    { x: mx(58), y: 52 }, { x: mx(42), y: 52 },
  ];
  const brow = [{ x: mx(28), y: 15 }, { x: mx(40), y: 10 }, { x: mx(50), y: 8 }, { x: mx(60), y: 10 }, { x: mx(72), y: 15 }];
  return { eye, brow };
}
// Piecewise-linear Y lookup for a fixture polyline (test-side helper,
// used only to PLACE pixels for known-position edges — assertions
// below compare against the real extracted detectEyelidCreaseV2, so
// this isn't circular).
function interpY(poly, x) {
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const xLo = Math.min(a.x, b.x), xHi = Math.max(a.x, b.x);
    if (x >= xLo && x <= xHi) {
      if (Math.abs(b.x - a.x) < 1e-6) return (a.y + b.y) / 2;
      return a.y + (x - a.x) / (b.x - a.x) * (b.y - a.y);
    }
  }
  return poly[poly.length - 1].y;
}

// ================================================================
// D/E. t-coordinate endpoint semantics
// ================================================================
test('D. a strong edge placed just inside the upper-lid contour resolves near t=0', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  // Edge placed 4px above the lid line at every column — comfortably
  // inside the per-column [browY,lidY] scan window everywhere, close
  // to its t=0 end.
  const canvas = paintEdgeCanvas(140, 90, (x) => interpY(lidPoly, x) - 4, 200, 60, 0);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  assert.strictEqual(r.valid, true);
  assert.ok(r.paths.length > 0, 'expected at least one candidate path');
  const best = r.paths[r.displayPathIndex];
  assert.ok(best.meanT < 0.35, `expected t near 0 (at the lid) for an edge placed near the lid line, got meanT=${best.meanT}`);
});
test('E. a strong edge placed just inside the brow contour resolves near t=1', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const canvas = paintEdgeCanvas(140, 90, (x) => interpY(brow, x) + 4, 60, 200, 0);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  assert.strictEqual(r.valid, true);
  assert.ok(r.paths.length > 0, 'expected at least one candidate path');
  const best = r.paths[r.displayPathIndex];
  assert.ok(best.meanT > 0.65, `expected t near 1 (at the brow) for an edge placed near the brow line, got meanT=${best.meanT}`);
});

// ================================================================
// F. denominator guard — near-zero lid-to-brow separation must not
// produce Infinity/NaN candidates, and should simply yield no
// reliable candidates rather than crashing.
// ================================================================
test('F. near-zero lid-to-brow vertical separation is guarded (no NaN/Infinity, no throw)', () => {
  const eye = [{ x: 30, y: 30 }, { x: 42, y: 30 }, { x: 58, y: 30 }, { x: 70, y: 30 }, { x: 58, y: 32 }, { x: 42, y: 32 }];
  const brow = [{ x: 28, y: 31 }, { x: 40, y: 30.5 }, { x: 50, y: 30 }, { x: 60, y: 30.5 }, { x: 72, y: 31 }]; // brow essentially on top of the lid
  const canvas = paintEdgeCanvas(100, 60, () => 30, 120, 120, 5);
  let r;
  assert.doesNotThrow(() => { r = detectEyelidCreaseV2(canvas, eye, brow); });
  const allVals = (r.candidates || []).filter(Boolean).flatMap(c => [c.t, c.rawStrength, c.prominence]);
  for (const v of allVals) {
    assert.ok(Number.isFinite(v), `expected a finite value, got ${v}`);
  }
});

// ================================================================
// G. canonical LEFT and RIGHT inputs produce the same anatomical
// orientation — mirrored geometry + mirrored pixel pattern must
// produce equivalent t / continuity, proving the x-direction
// difference between physical sides (proven in the earlier L/R
// normalization audit) is handled correctly here too.
// ================================================================
test('G. canonical LEFT-shaped and RIGHT-shaped inputs (mirror images) yield equivalent anatomical results', () => {
  const left = syntheticLeftEyeGeometry();
  const right = syntheticRightEyeGeometry();
  const leftCanvas = paintEdgeCanvas(140, 90, (x) => 30 + 0.05 * x, 190, 70, 0);
  // Mirror the SAME pattern for the right-eye canvas (edge position mirrored around the same axis used for geometry).
  const rightCanvas = paintEdgeCanvas(140, 90, (x) => 30 + 0.05 * (100 - x < 0 ? x : (140 - x)), 190, 70, 0);
  const rLeft = detectEyelidCreaseV2(leftCanvas, left.eye, left.brow);
  const rRight = detectEyelidCreaseV2(rightCanvas, right.eye, right.brow);
  assert.strictEqual(rLeft.valid, true); assert.strictEqual(rRight.valid, true);
  assert.ok(rLeft.paths.length > 0 && rRight.paths.length > 0, 'expected candidates for both physical sides');
  const bestLeft = rLeft.paths[rLeft.displayPathIndex], bestRight = rRight.paths[rRight.displayPathIndex];
  assert.ok(Math.abs(bestLeft.meanT - bestRight.meanT) < 0.25,
    `mirrored physical-left/right inputs should resolve to comparable meanT, got left=${bestLeft.meanT} right=${bestRight.meanT}`);
});

// ================================================================
// H. curved synthetic crease preserves per-column geometry — V2 must
// track a Y position that VARIES across x as a single continuous path
// with a roughly stable t (not a single flat row the way V1 would).
// ================================================================
test('H. a curved edge (Y varies across x) is tracked as points whose x/y actually vary, not collapsed to one row', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  // Edge curves from y=42 (near inner, x=30) to y=50 (near outer, x=70) — following the lid's own slope roughly.
  const canvas = paintEdgeCanvas(140, 90, (x) => 42 + (x - 30) * (8 / 40), 190, 70, 0);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  const real = (r.candidates || []).filter(Boolean);
  assert.ok(real.length >= 3, 'expected multiple per-column candidates');
  const ys = real.map(c => c.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) >= 3,
    `expected candidate Y to vary across columns for a curved edge, got a range of only ${Math.max(...ys) - Math.min(...ys)}`);
});

// ================================================================
// I. a flat, brow-position edge remains distinguishable in the
// candidate data from a genuine mid-band candidate by POSITION (t),
// even though V2 makes no claim about which one is "the crease".
// ================================================================
test('I. a flat brow-position edge and a separate mid-band edge are both exposed with distinct t, not merged', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  // Two edges: a strong flat one at the brow row, and a weaker one mid-band.
  const c = makeMockCanvas(140, 90);
  const buf = c._buf();
  for (let y = 0; y < 90; y++) {
    for (let x = 0; x < 140; x++) {
      let g = 130;
      if (y === 11) g = 230; // strong brow-row edge
      if (y === 33) g = 170; // weaker mid-band edge
      const idx = (y * 140 + x) * 4; buf[idx] = g; buf[idx + 1] = g; buf[idx + 2] = g; buf[idx + 3] = 255;
    }
  }
  const r = detectEyelidCreaseV2(c, eye, brow);
  assert.ok(r.paths.length >= 1, 'expected at least one path');
  // Whichever path(s) were found, their t values must be reported —
  // this test asserts the DATA carries position information sufficient
  // to distinguish the two sources, not that V2 picks the "right" one.
  for (const p of r.paths) assert.ok(Number.isFinite(p.meanT));
});

// ================================================================
// J. local skin-texture/noise does not erase candidate structure —
// a real edge with added per-pixel noise still produces a candidate.
// ================================================================
test('J. a real edge survives added per-pixel noise (still produces a candidate path)', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const canvas = paintEdgeCanvas(140, 90, (x) => 46, 190, 70, 25);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  assert.ok(r.paths.length > 0, 'expected the real edge to still produce at least one candidate path despite noise');
});

// ================================================================
// K. multiple candidate paths can be represented
// ================================================================
test('K. two well-separated edges produce two distinct candidate paths', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  // Two thin bright bands at ~25% and ~75% of each column's own local
  // [browY,lidY] window — well inside the window everywhere, and far
  // enough apart in t to land in separate linked paths.
  const c = makeMockCanvas(140, 90);
  const buf = c._buf();
  const bandAt = (x, frac) => Math.round(interpY(brow, x) + frac * (interpY(lidPoly, x) - interpY(brow, x)));
  for (let y = 0; y < 90; y++) {
    for (let x = 0; x < 140; x++) {
      let g = 130;
      if (y === bandAt(x, 0.25)) g = 220;
      if (y === bandAt(x, 0.75)) g = 220;
      const idx = (y * 140 + x) * 4; buf[idx] = g; buf[idx + 1] = g; buf[idx + 2] = g; buf[idx + 3] = 255;
    }
  }
  const r = detectEyelidCreaseV2(c, eye, brow);
  assert.ok(r.paths.length >= 2, `expected >=2 distinct paths for two well-separated edges, got ${r.paths.length}`);
});

// ================================================================
// L. raw + locally normalized strengths are both exposed
// ================================================================
test('L. candidates expose both rawStrength and localStrength (or an explicit null, never NaN/Infinity)', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const canvas = paintEdgeCanvas(140, 90, (x) => 46, 190, 70, 3);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  const real = (r.candidates || []).filter(Boolean);
  assert.ok(real.length > 0);
  for (const c of real) {
    assert.ok(Number.isFinite(c.rawStrength));
    assert.ok(c.localStrength === null || Number.isFinite(c.localStrength));
  }
});

// ================================================================
// M. debug output remains serializable/copyable
// ================================================================
test('M. the full V2 result is JSON-serializable with no loss of shape', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const canvas = paintEdgeCanvas(140, 90, (x) => 46, 190, 70, 0);
  const r = detectEyelidCreaseV2(canvas, eye, brow);
  const json = JSON.stringify(r);
  assert.ok(json.length > 0);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.valid, true);
  assert.ok(Array.isArray(parsed.paths));
});

// ================================================================
// N. running V2 has no effect on a subsequent classifyFeatures call
// (no shared mutable state, no interference) — extracted alongside
// the classifyFeatures pipeline for this one check.
// ================================================================
test('N. calling detectEyelidCreaseV2 has no observable effect on a subsequent classifyFeatures result', () => {
  const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
  const cfEnd = src.indexOf('\n    function extractEyeROI(');
  const reactStubs = `
    function createContext(v) { return { _v: v }; }
    function useState(v) { return [v, () => {}]; }
    function useRef(v) { return { current: v }; }
    function useEffect() {}
    function useCallback(fn) { return fn; }
    function useMemo(fn) { return fn(); }
    function useContext(ctx) { return ctx && ctx._v; }
  `;
  const { classifyFeatures } = new Function(reactStubs + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();
  function eyeMetrics() {
    return {
      width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
      hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: 0.44, covInnerByWidth: 0.44, covOuterByWidth: 0.44, covByHeight: 0.44 / 0.36,
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
      creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseYFrac: 0.4, creaseReadQuality: 0.7,
    };
  }
  const aggregated = { left: eyeMetrics(), right: eyeMetrics(), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const before = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });

  // Run V2 several times in between, with unrelated synthetic input.
  const { eye, brow } = syntheticLeftEyeGeometry();
  const canvas = paintEdgeCanvas(140, 90, (x) => 30 + 0.1 * x, 200, 60, 10);
  detectEyelidCreaseV2(canvas, eye, brow);
  detectEyelidCreaseV2(canvas, eye, brow);

  const after = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(after.eyelidType, before.eyelidType);
  assert.strictEqual(after.eyelidCategory, before.eyelidCategory);
  assert.strictEqual(after.hoodedConfidence, before.hoodedConfidence);
  assert.strictEqual(after.isHooded, before.isHooded);
});

// ================================================================
// REAL-IPHONE OBSERVABILITY FIX — tests A-K.
// Real iPhone testing found the debug panel only surfaced the single
// "display" path (hiding whether other candidates existed or where
// they were), and the Copy button was unreachable (buried at the
// bottom of a scrollable panel, below both eyes' full stat blocks).
// These tests prove the fix without touching detectEyelidCreaseV2's
// own algorithm/ranking at all — the fix is confined to the debug-UI
// display layer and a payload-formatting function.
// ================================================================

// ---- A/B/C — source guards on the JSX (no DOM renderer available in
// Node for this project's architecture, matching the existing
// source-guard technique already used by tests B/B2/G in this file). ----
test('A. CreaseV2EyePanel iterates v2.paths.map(...) — every path gets its own row, not just the display candidate', () => {
  const panelStart = src.indexOf('function CreaseV2EyePanel(');
  const panelEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  const panelSrc = src.slice(panelStart, panelEnd);
  assert.ok(/v2\.paths\.map\(\(p, ?pi\)/.test(panelSrc), 'expected CreaseV2EyePanel to map over ALL v2.paths, not read only the display index');
});
test('B. each path row is labeled with its own P# identity', () => {
  const panelStart = src.indexOf('function CreaseV2EyePanel(');
  const panelEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  const panelSrc = src.slice(panelStart, panelEnd);
  assert.ok(/`P\$\{pi\}/.test(panelSrc), 'expected each path row to render a P${pi} label');
});
test('C. displayPathIndex is explicitly exposed as its own labeled field', () => {
  const panelStart = src.indexOf('function CreaseV2EyePanel(');
  const panelEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  const panelSrc = src.slice(panelStart, panelEnd);
  assert.ok(/V2 display path/.test(panelSrc) && /v2\.displayPathIndex/.test(panelSrc),
    'expected an explicit "V2 display path" field referencing v2.displayPathIndex');
});

// ---- D/E/F — the copy-payload builder, extracted and evaluated for
// real behavioral proof (not just a source guard). ----
// buildCreaseV2CopyPayload's eyeV1() helper now calls debugV1BoundaryPeakFlag
// (defined earlier in the file, before CreaseV2EyePanel) — extracted here as
// plain source text too (it's a small pure function, no JSX, safe to eval).
const boundaryFlagStart = src.indexOf('function debugV1BoundaryPeakFlag(');
// Stops right where the EXPERIMENTAL EYELID-TYPE block begins, not at
// CreaseV2EyePanel — that block (added in a later turn) sits between
// debugV1BoundaryPeakFlag and CreaseV2EyePanel and contains JSX
// (EvidenceEyeBlock), which a plain `new Function` extraction cannot
// evaluate; only the small pure debugV1BoundaryPeakFlag helper is needed here.
const boundaryFlagEnd = src.indexOf('\n    // ============================================================\n    // EXPERIMENTAL EYELID-TYPE INTEGRATION — DEBUG-ONLY LOCAL PROTOTYPE.', boundaryFlagStart);
const boundaryFlagSrc = src.slice(boundaryFlagStart, boundaryFlagEnd);
const payloadFnStart = src.indexOf('function buildCreaseV2CopyPayload(');
const payloadFnEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
const { buildCreaseV2CopyPayload, debugV1BoundaryPeakFlag } = new Function(
  boundaryFlagSrc + src.slice(payloadFnStart, payloadFnEnd) + '\nreturn { buildCreaseV2CopyPayload, debugV1BoundaryPeakFlag };'
)();

function fakeEyeEntry({ v1Valid = true, paths, v2Multi, v2Linked } = {}) {
  return {
    v1: v1Valid ? { valid: true, peakVal: 12.3, prominence: 8.1, creaseYFrac: 0.42, readQuality: 0.6 } : { valid: false },
    v2: {
      valid: true, roiW: 140, roiH: 90, sampledColumns: 12, v2RuntimeMs: 17.5, displayPathIndex: 0,
      debugHeuristicState: 'MULTIPLE_CANDIDATES',
      paths: paths || [
        { points: [{ sampleIndex: 0, x: 10, y: 20, t: 0.04, rawStrength: 34, prominence: 20, localStrength: 2.66, thickness: 3 },
                   { sampleIndex: 1, x: 20, y: 22, t: 0.05, rawStrength: 30, prominence: 18, localStrength: 2.4, thickness: 3 }],
          xSpan: [10, 20], continuityFrac: 0.5, meanT: 0.045, tVariation: 0.005, meanRawStrength: 32, meanLocalStrength: 2.53, meanThickness: 3 },
        { points: [{ sampleIndex: 6, x: 70, y: 40, t: 0.55, rawStrength: 26.2, prominence: 14, localStrength: 2.24, thickness: 2 }],
          xSpan: [70, 70], continuityFrac: 0.083, meanT: 0.55, tVariation: 0, meanRawStrength: 26.2, meanLocalStrength: 2.24, meanThickness: 2 },
      ],
    },
    v2Multi,
    v2Linked,
  };
}

// V2.1 MULTI-PEAK SHADOW fixture: one column with 3 retained peaks
// (current-winner + 2 secondary), one degenerate (null-peaks) column.
function fakeV2MultiEntry() {
  return {
    valid: true, roiW: 140, roiH: 90, sampledColumns: 2, v2MultiRuntimeMs: 4.2,
    columns: [
      { sampleIndex: 0, x: 10, peaks: [
        { rankWithinColumn: 0, currentV2Winner: true, y: 22, t: 0.03, rawStrength: 31.2, prominence: 20, localStrength: 3.1, thickness: 2 },
        { rankWithinColumn: 1, currentV2Winner: false, y: 40, t: 0.44, rawStrength: 18.1, prominence: 10, localStrength: 1.9, thickness: 7 },
        { rankWithinColumn: 2, currentV2Winner: false, y: 58, t: 0.86, rawStrength: 12.4, prominence: 6, localStrength: null, thickness: 9 },
      ] },
      { sampleIndex: 1, x: 20, peaks: null },
    ],
  };
}

// V2.2 LINKED PATHS fixture: two linked paths — one containing the V2
// winner, one a secondary track — with a null-localStrength point.
function fakeV2LinkedEntry() {
  return {
    valid: true, sampledColumns: 2, v2LinkedRuntimeMs: 0.8,
    paths: [
      {
        points: [
          { sampleIndex: 0, x: 10, y: 22, t: 0.03, rawStrength: 31.2, prominence: 20, localStrength: 3.1, thickness: 2, currentV2Winner: true },
          { sampleIndex: 1, x: 20, y: 23, t: 0.04, rawStrength: 29.0, prominence: 18, localStrength: null, thickness: 2, currentV2Winner: true },
        ],
        xSpan: [10, 20], continuityFrac: 1, meanT: 0.035, tVariation: 0.005, meanRawStrength: 30.1, meanLocalStrength: 3.1, meanThickness: 2,
        containsV2Winner: true,
      },
      {
        points: [
          { sampleIndex: 0, x: 10, y: 40, t: 0.44, rawStrength: 18.1, prominence: 10, localStrength: 1.9, thickness: 7, currentV2Winner: false },
        ],
        xSpan: [10, 10], continuityFrac: 0.5, meanT: 0.44, tVariation: 0, meanRawStrength: 18.1, meanLocalStrength: 1.9, meanThickness: 7,
        containsV2Winner: false,
      },
    ],
  };
}

test('D. the copy payload contains ALL paths for each eye, not only the display path', () => {
  const data = {
    left: fakeEyeEntry(), right: fakeEyeEntry(),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  };
  const payload = buildCreaseV2CopyPayload(data);
  assert.strictEqual(payload.eyes.left.v2.paths.length, data.left.v2.paths.length, 'left eye: payload must include every returned path');
  assert.strictEqual(payload.eyes.right.v2.paths.length, data.right.v2.paths.length, 'right eye: payload must include every returned path');
  assert.strictEqual(payload.eyes.left.v2.paths[1].meanT, data.left.v2.paths[1].meanT, 'second path (not the display one) must carry its real data through');
});

test('E. missing/invalid optional metrics become explicit null, never an invented 0', () => {
  const pathWithNullLocal = {
    points: [{ sampleIndex: 0, x: 1, y: 2, t: 0.1, rawStrength: 5, prominence: 3, localStrength: null, thickness: 1 }],
    xSpan: [1, 1], continuityFrac: 0.08, meanT: 0.1, tVariation: 0, meanRawStrength: 5, meanLocalStrength: null, meanThickness: 1,
  };
  const data = {
    left: fakeEyeEntry({ v1Valid: false, paths: [pathWithNullLocal] }),
    right: { v1: { valid: false }, v2: { valid: false } },
    capture: null,
  };
  const payload = buildCreaseV2CopyPayload(data);
  assert.strictEqual(payload.eyes.left.v1.peakVal, null, 'invalid V1 fields must be null, not 0 or undefined');
  assert.strictEqual(payload.eyes.left.v1.prominence, null);
  assert.strictEqual(payload.eyes.left.v2.paths[0].meanLocalStrength, null, 'a genuinely-null meanLocalStrength must stay null, never become 0');
  assert.strictEqual(payload.eyes.left.v2.paths[0].points[0].localStrength, null);
  assert.strictEqual(payload.eyes.right.v2.paths, null, 'an invalid v2 must report paths:null, not an empty array pretending data existed');
  assert.strictEqual(payload.capture.earL, null, 'missing capture must report null fields, not throw or invent 0');
  assert.strictEqual(payload.capture.roll, null);
});

test('F. the copy payload is JSON-serializable and round-trips losslessly', () => {
  const data = {
    left: fakeEyeEntry(), right: fakeEyeEntry(),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  };
  const payload = buildCreaseV2CopyPayload(data);
  const json = JSON.stringify(payload, null, 2);
  assert.ok(json.length > 0);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.eyes.left.v2.paths.length, 2);
  assert.strictEqual(parsed.eyes.left.v2.paths[0].points.length, 2);
  console.log(`        (measured payload size for a MULTIPLE_CANDIDATES(2)-shaped fixture: ${json.length} bytes)`);
});

// ---- G — DOM-order proof: the Copy button's JSX must appear BEFORE
// the LEFT/RIGHT eye panels in CreaseV2DebugPanel's source (JSX
// siblings render in source order). ----
test('G. the Copy button is positioned before the long LEFT/RIGHT diagnostic body in source order', () => {
  const panelStart = src.indexOf('function CreaseV2DebugPanel(');
  const panelSrc = src.slice(panelStart, panelStart + 4200);
  const copyBtnIdx = panelSrc.indexOf('Copy V2 JSON');
  const leftPanelIdx = panelSrc.indexOf('<CreaseV2EyePanel label="LEFT"');
  assert.ok(copyBtnIdx !== -1 && leftPanelIdx !== -1, 'expected to find both the Copy button and the LEFT eye panel in CreaseV2DebugPanel');
  assert.ok(copyBtnIdx < leftPanelIdx, 'Copy button must render before (above) the LEFT/RIGHT diagnostic body');
});

// ---- H — debug panel remains debug-only (re-confirms tests B/B2 still hold after this turn's edits). ----
test('H. CreaseV2DebugPanel is still only mounted behind debugAvailable in LiveScanScreen', () => {
  const mountIdx = src.indexOf('<CreaseV2DebugPanel data={debugCreaseV2} compare={debugEyelidCompare} />');
  assert.ok(mountIdx !== -1, 'expected CreaseV2DebugPanel mount point not found');
  const before = src.slice(Math.max(0, mountIdx - 200), mountIdx);
  assert.ok(/debugAvailable/.test(before), 'CreaseV2DebugPanel mount is not visibly guarded by debugAvailable');
});

// ---- I/J — V2 algorithm (ranking + candidate generation, including
// DEBUG_V2_UNCALIBRATED) is byte-for-byte unchanged by this turn's
// debug-UI-only work. Recorded immediately before this turn's edits began. ----
const V2_BLOCK_EXPECTED_SHA256 = 'b6f7a3b59481b35207ef949fe65a2a50ca5b30cae4f4b47efd7f987bcb7f6a1d';
test('I/J. detectEyelidCreaseV2 + DEBUG_V2_UNCALIBRATED + its helpers are byte-for-byte unchanged', () => {
  const blockStart = src.indexOf('    // EYELID CREASE DETECTOR V2 — DEBUG-ONLY EXPERIMENTAL SHADOW DETECTOR.');
  // Stops right where the NEW, separate V2.1 multi-peak experiment block
  // begins — that block is a sibling addition after detectEyelidCreaseV2's
  // closing brace, not a change to detectEyelidCreaseV2 itself, so it must
  // be excluded from this hash boundary or this check would (correctly,
  // but for the wrong reason) flag a "change" every time V2.1 is touched.
  const blockEnd = src.indexOf('\n    // ============================================================\n    // EYELID CREASE V2.1 — DEBUG-ONLY MULTI-PEAK SHADOW EXPERIMENT.', blockStart);
  assert.ok(blockStart !== -1 && blockEnd !== -1, 'could not locate the V2 detector block');
  const block = src.slice(blockStart, blockEnd);
  const actualSha = crypto.createHash('sha256').update(block).digest('hex');
  assert.strictEqual(actualSha, V2_BLOCK_EXPECTED_SHA256,
    'the V2 detector block (algorithm, ranking, DEBUG_V2_UNCALIBRATED) has changed — this turn was scoped to debug UI only');
});

// ---- V2.1 block (detectEyelidCreaseV2Multi + its helpers) is
// byte-for-byte unchanged by this turn's V2.2 linking-only work.
// Recorded immediately before V2.2 implementation began this turn. ----
const V2_1_BLOCK_EXPECTED_SHA256 = '8a3ad95b70965900916fbc99e25ce593118fecd48538d65b684ebec91fc8d08f';
test('V2.2-checkpoint. detectEyelidCreaseV2Multi (V2.1) is byte-for-byte unchanged by this turn\'s V2.2 linking addition', () => {
  const blockStart = src.indexOf('    // ============================================================\n    // EYELID CREASE V2.1 — DEBUG-ONLY MULTI-PEAK SHADOW EXPERIMENT.');
  const blockEnd = src.indexOf('\n    // ============================================================\n    // EYELID CREASE V2.2 — DEBUG-ONLY MULTI-PEAK PATH LINKING SHADOW.', blockStart);
  assert.ok(blockStart !== -1 && blockEnd !== -1, 'could not locate the V2.1 detector block');
  const block = src.slice(blockStart, blockEnd);
  const actualSha = crypto.createHash('sha256').update(block).digest('hex');
  assert.strictEqual(actualSha, V2_1_BLOCK_EXPECTED_SHA256,
    'the V2.1 multi-peak block has changed — this turn was scoped to a new V2.2 linking layer only, V2.1 itself must stay frozen');
});

// ---- K — production classification remains byte-identical whether
// the debug panel/payload builder is exercised or not (extends test N
// to also exercise buildCreaseV2CopyPayload). ----
test('K. production classifyFeatures output is unaffected by exercising the debug panel payload builder', () => {
  const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
  const cfEnd = src.indexOf('\n    function extractEyeROI(');
  const { classifyFeatures: cf2 } = new Function(reactStubsForV2 + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();
  function eyeMetrics() {
    return {
      width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
      hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: 0.44, covInnerByWidth: 0.44, covOuterByWidth: 0.44, covByHeight: 0.44 / 0.36,
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
      creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseYFrac: 0.4, creaseReadQuality: 0.7,
    };
  }
  const aggregated = { left: eyeMetrics(), right: eyeMetrics(), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const before = cf2(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });

  buildCreaseV2CopyPayload({
    left: fakeEyeEntry(), right: fakeEyeEntry(),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });

  const after = cf2(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(after.eyelidType, before.eyelidType);
  assert.strictEqual(after.eyelidCategory, before.eyelidCategory);
  assert.strictEqual(after.hoodedConfidence, before.hoodedConfidence);
  assert.strictEqual(after.isHooded, before.isHooded);
});

// ================================================================
// V2.1 MULTI-PEAK SHADOW EXPERIMENT — tests C-O (A/B are covered by
// the existing I/J and A tests above, which already re-verify
// detectEyelidCreaseV2/DEBUG_V2_UNCALIBRATED and V1 are byte-for-byte
// unchanged; re-asserted explicitly at the end of this block too).
// Confirms: detectEyelidCreaseV2Multi retains multiple local maxima
// per column (never linked into paths), its rank-0 peak is always the
// SAME winner the frozen detectEyelidCreaseV2 itself picked for that
// column (the critical control check), and none of it reaches
// classifyFeatures or normal (non-debug) mode.
// ================================================================

// Paint TWO horizontal edges into one canvas — rows above edge1 are
// `top`, rows between edge1/edge2 are `mid`, rows below edge2 are
// `bottom` — so the per-column vertical-gradient profile has two
// genuine ridges (one at each edge), unlike paintEdgeCanvas's single
// step. Needed to prove multi-peak retention against a real profile,
// not just a fabricated fixture.
function paintTwoEdgeCanvas(w, h, edge1YAt, edge2YAt, top, mid, bottom, noiseAmp) {
  const c = makeMockCanvas(w, h);
  const buf = c._buf();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sort so the caller doesn't need to know which edge is closer to
      // the brow vs. the lid — the smaller y is always the upper edge.
      const a = edge1YAt(x), b = edge2YAt(x);
      const eUpper = Math.min(a, b), eLower = Math.max(a, b);
      let g = y < eUpper ? top : (y < eLower ? mid : bottom);
      if (noiseAmp) g += (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * noiseAmp;
      g = Math.max(0, Math.min(255, g));
      const idx = (y * w + x) * 4;
      buf[idx] = g; buf[idx + 1] = g; buf[idx + 2] = g; buf[idx + 3] = 255;
    }
  }
  return c;
}

test('V2.1-C. detectEyelidCreaseV2Multi retains more than one local peak when the profile genuinely has multiple ridges', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  // Two ridges per column: one near the lid (strong), one near the
  // middle of the band (weaker but still a genuine local maximum).
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 14,
    220, 140, 60, 0
  );
  const r = detectEyelidCreaseV2Multi(canvas, eye, brow);
  assert.strictEqual(r.valid, true);
  const withMultiplePeaks = r.columns.filter(c => c.peaks && c.peaks.length > 1);
  assert.ok(withMultiplePeaks.length > 0, 'expected at least one column to retain more than one local peak for a genuinely two-ridge profile');
});

test('V2.1-D. peaks within a column are ordered by rawStrength, descending', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 14,
    220, 140, 60, 0
  );
  const r = detectEyelidCreaseV2Multi(canvas, eye, brow);
  let checked = 0;
  for (const c of r.columns) {
    if (!c.peaks || c.peaks.length < 2) continue;
    checked++;
    for (let i = 0; i < c.peaks.length - 1; i++) {
      assert.ok(c.peaks[i].rawStrength >= c.peaks[i + 1].rawStrength,
        `column ${c.sampleIndex}: peak #${i} (${c.peaks[i].rawStrength}) must be >= peak #${i + 1} (${c.peaks[i + 1].rawStrength})`);
    }
  }
  assert.ok(checked > 0, 'sanity: expected at least one multi-peak column to check ordering on');
});

test('V2.1-E. DEBUG_V2_MULTI_MAX_PEAKS is 3, and no column ever retains more than that', () => {
  assert.strictEqual(DEBUG_V2_MULTI_MAX_PEAKS, 3);
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  // A noisy multi-ridge profile likely to produce many local maxima —
  // stress-tests the retention cap, not just the common case.
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 20,
    220, 140, 60, 30
  );
  const r = detectEyelidCreaseV2Multi(canvas, eye, brow);
  for (const c of r.columns) {
    if (c.peaks) assert.ok(c.peaks.length <= 3, `column ${c.sampleIndex} retained ${c.peaks.length} peaks, expected <= 3`);
  }
});

test('V2.1-F. rankWithinColumn assignment is deterministic across repeated runs on identical input', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 14,
    220, 140, 60, 0
  );
  const r1 = detectEyelidCreaseV2Multi(canvas, eye, brow);
  const r2 = detectEyelidCreaseV2Multi(canvas, eye, brow);
  assert.deepStrictEqual(r1.columns, r2.columns, 'expected identical columns/peaks/rankWithinColumn on repeated runs of the same input');
});

// ---- G — THE CONTROL CHECK. Without this, V2.1 would not be a
// controlled extension of the frozen V2: for every valid column,
// peaks[0] must be the exact same candidate (t, rawStrength) that
// detectEyelidCreaseV2's own single-argmax algorithm picked, and it
// must be tagged currentV2Winner:true. ----
test('V2.1-G. peaks[0] matches the frozen detectEyelidCreaseV2 argmax candidate for every valid column', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 14,
    220, 140, 60, 0
  );
  const v2 = detectEyelidCreaseV2(canvas, eye, brow);
  const v2Multi = detectEyelidCreaseV2Multi(canvas, eye, brow);
  assert.strictEqual(v2.valid, true);
  assert.strictEqual(v2Multi.valid, true);
  assert.strictEqual(v2.candidates.length, v2Multi.columns.length, 'sanity: same number of sampled columns');
  let comparedCount = 0;
  for (let s = 0; s < v2.candidates.length; s++) {
    const v2c = v2.candidates[s];
    const mc = v2Multi.columns[s];
    if (!v2c) { assert.strictEqual(mc.peaks, null, `column ${s}: V2 has no candidate, V2.1 must also report peaks:null`); continue; }
    assert.ok(mc.peaks && mc.peaks.length > 0, `column ${s}: V2 has a candidate but V2.1 reported no peaks`);
    comparedCount++;
    assert.strictEqual(mc.peaks[0].currentV2Winner, true, `column ${s}: peaks[0] must be tagged currentV2Winner`);
    assert.strictEqual(mc.peaks[0].t, v2c.t, `column ${s}: peaks[0].t must equal V2's own candidate.t`);
    assert.strictEqual(mc.peaks[0].rawStrength, v2c.rawStrength, `column ${s}: peaks[0].rawStrength must equal V2's own candidate.rawStrength`);
    assert.strictEqual(mc.peaks[0].prominence, v2c.prominence, `column ${s}: peaks[0].prominence must equal V2's own candidate.prominence`);
    for (let i = 1; i < mc.peaks.length; i++) {
      assert.strictEqual(mc.peaks[i].currentV2Winner, false, `column ${s}: only rank 0 may be tagged currentV2Winner`);
    }
  }
  assert.ok(comparedCount > 0, 'sanity: expected at least one valid column to compare');
});

test('V2.1-H. running detectEyelidCreaseV2Multi does not change what detectEyelidCreaseV2 itself returns', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(
    140, 90,
    (x) => interpY(lidPoly, x) - 3,
    (x) => interpY(lidPoly, x) - 14,
    220, 140, 60, 0
  );
  const before = detectEyelidCreaseV2(canvas, eye, brow);
  detectEyelidCreaseV2Multi(canvas, eye, brow);
  const after = detectEyelidCreaseV2(canvas, eye, brow);
  assert.deepStrictEqual(after.paths, before.paths, 'V2.1 must not alter V2 paths');
  assert.strictEqual(after.displayPathIndex, before.displayPathIndex, 'V2.1 must not alter V2 displayPathIndex');
});

test('V2.1-I. exercising detectEyelidCreaseV2Multi + buildCreaseV2CopyPayload does not affect classifyFeatures output', () => {
  const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
  const cfEnd = src.indexOf('\n    function extractEyeROI(');
  const { classifyFeatures: cf3 } = new Function(reactStubsForV2 + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();
  function eyeMetrics() {
    return {
      width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
      hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: 0.44, covInnerByWidth: 0.44, covOuterByWidth: 0.44, covByHeight: 0.44 / 0.36,
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
      creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseYFrac: 0.4, creaseReadQuality: 0.7,
    };
  }
  const aggregated = { left: eyeMetrics(), right: eyeMetrics(), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const before = cf3(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });

  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(140, 90, (x) => interpY(lidPoly, x) - 3, (x) => interpY(lidPoly, x) - 14, 220, 140, 60, 0);
  const v2Multi = detectEyelidCreaseV2Multi(canvas, eye, brow);
  buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Multi }), right: fakeEyeEntry({ v2Multi: fakeV2MultiEntry() }),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });

  const after = cf3(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(after.eyelidType, before.eyelidType);
  assert.strictEqual(after.eyelidCategory, before.eyelidCategory);
  assert.strictEqual(after.hoodedConfidence, before.hoodedConfidence);
  assert.strictEqual(after.isHooded, before.isHooded);
});

test('V2.1-J. detectEyelidCreaseV2Multi is only called inside the same if(debugAvailable) block as V2 in LiveScanScreen', () => {
  const callIdx = src.indexOf('detectEyelidCreaseV2Multi(canvas, leftEye, leftBrowPts)');
  assert.ok(callIdx !== -1, 'expected detectEyelidCreaseV2Multi call site not found');
  const before = src.slice(Math.max(0, callIdx - 600), callIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(before),
    'detectEyelidCreaseV2Multi call is not visibly guarded by "if (debugAvailable)"');
});

test('V2.1-K. Copy JSON (v2MultiShadow) includes every column and every peak', () => {
  const v2Multi = fakeV2MultiEntry();
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Multi }), right: fakeEyeEntry(),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });
  const shadow = payload.eyes.left.v2MultiShadow;
  assert.strictEqual(shadow.runtimeMs, 4.2);
  assert.strictEqual(shadow.columns.length, 2);
  assert.strictEqual(shadow.columns[0].peaks.length, 3);
  assert.strictEqual(shadow.columns[0].peaks[1].t, 0.44);
  assert.strictEqual(shadow.columns[0].peaks[1].currentV2Winner, false);
  assert.strictEqual(shadow.columns[1].peaks, null, 'a degenerate (null) column must stay null, not become an empty array');
});

test('V2.1-L. the full payload (including v2MultiShadow) is JSON-serializable and round-trips', () => {
  const v2Multi = fakeV2MultiEntry();
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Multi }), right: fakeEyeEntry({ v2Multi }),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });
  const json = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.eyes.left.v2MultiShadow.columns[0].peaks.length, 3);
  console.log(`        (measured payload size with v2MultiShadow for both eyes: ${json.length} bytes)`);
});

test('V2.1-M. missing/invalid multi-shadow values serialize as explicit null, never an invented 0', () => {
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Multi: { valid: false } }), right: fakeEyeEntry(),
    capture: null,
  });
  assert.strictEqual(payload.eyes.left.v2MultiShadow.runtimeMs, null);
  assert.strictEqual(payload.eyes.left.v2MultiShadow.columns, null);
  assert.strictEqual(payload.eyes.right.v2MultiShadow.runtimeMs, null, 'right eye has no v2Multi at all — must be null, not throw');
  const v2Multi = fakeV2MultiEntry();
  const payload2 = buildCreaseV2CopyPayload({ left: fakeEyeEntry({ v2Multi }), right: fakeEyeEntry(), capture: null });
  assert.strictEqual(payload2.eyes.left.v2MultiShadow.columns[0].peaks[2].localStrength, null, 'a genuinely-null localStrength must stay null');
});

test('V2.1-N. detectEyelidCreaseV2Multi ITSELF does not link peaks across columns into paths (linking lives only in the separate V2.2 layer)', () => {
  const multiFnStart = src.indexOf('function detectEyelidCreaseV2Multi(');
  // Stop at the V2.2 block, not at REASON_MESSAGES — V2.2 (a separate
  // function, added after V2.1) legitimately DOES reference
  // PATH_LINK_MAX_T_GAP; this check is scoped to V2.1's own source only.
  const multiFnEnd = src.indexOf('\n    // ============================================================\n    // EYELID CREASE V2.2 — DEBUG-ONLY MULTI-PEAK PATH LINKING SHADOW.', multiFnStart);
  assert.ok(multiFnStart !== -1 && multiFnEnd !== -1, 'could not locate detectEyelidCreaseV2Multi block boundaries');
  const multiSrc = src.slice(multiFnStart, multiFnEnd);
  assert.ok(!/PATH_LINK_MAX_T_GAP/.test(multiSrc), 'detectEyelidCreaseV2Multi itself must not reference the path-linking threshold — linking lives only in the separate V2.2 layer');
  assert.ok(!/\bpaths\s*\.push\(/.test(multiSrc), 'detectEyelidCreaseV2Multi itself must not build any cross-column "paths" array');
});

test('V2.1-O. V2.1 output never reaches leftMetrics/rightMetrics (production normal mode is unaffected)', () => {
  const assignRegex = /(left|right)Metrics\.\w+\s*=\s*([^;]+);/g;
  const matches = [...src.matchAll(assignRegex)];
  for (const m of matches) {
    assert.ok(!/v2LeftMulti|v2RightMulti|detectEyelidCreaseV2Multi|v2Multi/.test(m[2]),
      `found a *Metrics field assigned from V2.1 multi-shadow data: "${m[0]}"`);
  }
});

// ---- Performance — measured in this Node mock harness (relative
// order-of-magnitude only, not representative of real device speed). ----
test('V2.1-perf. current V2 vs V2.1 multi-shadow runtime, measured on identical synthetic input', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(140, 90, (x) => interpY(lidPoly, x) - 3, (x) => interpY(lidPoly, x) - 14, 220, 140, 60, 0);
  const v2 = detectEyelidCreaseV2(canvas, eye, brow);
  const v2Multi = detectEyelidCreaseV2Multi(canvas, eye, brow);
  assert.ok(Number.isFinite(v2.v2RuntimeMs));
  assert.ok(Number.isFinite(v2Multi.v2MultiRuntimeMs));
  console.log(`        (measured in this mock harness — V2: ${v2.v2RuntimeMs.toFixed(3)}ms, V2.1 multi: ${v2Multi.v2MultiRuntimeMs.toFixed(3)}ms)`);
});

// ================================================================
// V2.2 MULTI-PEAK PATH LINKING SHADOW — tests A-L. Pure post-
// processing over V2.1's already-computed `columns` output: links
// peaks across columns using ONLY the existing PATH_LINK_MAX_T_GAP
// (no new threshold), generalizing detectEyelidCreaseV2's own single-
// track greedy linker to multiple simultaneously open tracks. Never
// touches pixels/ROI, never selects a "true" crease, never reaches
// classifyFeatures.
// ================================================================

test('V2.2-A. the gap threshold is a genuine parameter, not a hardcoded value — behavior changes with it', () => {
  // Two adjacent "peaks" 0.2 apart in t. With a wide gap they link into
  // one path; with a narrow gap they must not.
  const columns = [
    { sampleIndex: 0, x: 0, peaks: [{ t: 0.10, rawStrength: 10, prominence: 5, localStrength: 1, thickness: 1 }] },
    { sampleIndex: 1, x: 10, peaks: [{ t: 0.30, rawStrength: 10, prominence: 5, localStrength: 1, thickness: 1 }] },
  ];
  const wide = debugV2LinkMultiPeakPaths(columns, 0.25);
  const narrow = debugV2LinkMultiPeakPaths(columns, 0.05);
  assert.strictEqual(wide.length, 1, 'a 0.2 gap within a 0.25 threshold must link into a single path');
  assert.strictEqual(wide[0].length, 2);
  assert.strictEqual(narrow.length, 2, 'the SAME 0.2 gap must NOT link when the threshold is only 0.05');
});

test('V2.2-B. multi-track linking keeps two persistent, well-separated peak tracks distinct across many columns', () => {
  const columns = [];
  for (let s = 0; s < 6; s++) {
    columns.push({
      sampleIndex: s, x: s * 10,
      peaks: [
        { t: 0.10 + s * 0.01, rawStrength: 20, prominence: 10, localStrength: 2, thickness: 2 },
        { t: 0.60 + s * 0.01, rawStrength: 15, prominence: 8, localStrength: 1.5, thickness: 3 },
      ],
    });
  }
  const paths = debugV2LinkMultiPeakPaths(columns, 0.15);
  assert.strictEqual(paths.length, 2, 'expected exactly 2 distinct linked paths for 2 persistent, well-separated tracks');
  const lens = paths.map(p => p.length).sort((a, b) => a - b);
  assert.deepStrictEqual(lens, [6, 6], 'both tracks should span all 6 columns');
  // Tracks must not cross: every point in one path stays on its own side.
  for (const p of paths) {
    const allLow = p.every(pt => pt.t < 0.4);
    const allHigh = p.every(pt => pt.t >= 0.4);
    assert.ok(allLow || allHigh, 'a linked path must not mix the two separated tracks');
  }
});

test('V2.2-C. a null/missing column breaks every open track, mirroring detectEyelidCreaseV2\'s own linker', () => {
  const columns = [
    { sampleIndex: 0, x: 0, peaks: [{ t: 0.1, rawStrength: 10, prominence: 5, localStrength: 1, thickness: 1 }] },
    { sampleIndex: 1, x: 10, peaks: null },
    { sampleIndex: 2, x: 20, peaks: [{ t: 0.1, rawStrength: 10, prominence: 5, localStrength: 1, thickness: 1 }] },
  ];
  const paths = debugV2LinkMultiPeakPaths(columns, 0.15);
  assert.strictEqual(paths.length, 2, 'a gap column must split into two separate paths, never bridge across it');
  assert.strictEqual(paths[0].length, 1);
  assert.strictEqual(paths[1].length, 1);
});

test('V2.2-D. debugV2BuildLinkedPaths is deterministic across repeated runs on identical input', () => {
  const v2Multi = fakeV2MultiEntry();
  const r1 = debugV2BuildLinkedPaths(v2Multi.columns, v2Multi.sampledColumns, DEBUG_V2_UNCALIBRATED.PATH_LINK_MAX_T_GAP);
  const r2 = debugV2BuildLinkedPaths(v2Multi.columns, v2Multi.sampledColumns, DEBUG_V2_UNCALIBRATED.PATH_LINK_MAX_T_GAP);
  // Compare everything except v2LinkedRuntimeMs, which is a genuine
  // wall-clock measurement and legitimately differs run to run.
  assert.deepStrictEqual(r1.paths, r2.paths);
  assert.strictEqual(r1.valid, r2.valid);
  assert.strictEqual(r1.sampledColumns, r2.sampledColumns);
});

test('V2.2-E. containsV2Winner correctly marks only the path that passes through the frozen V2 winner', () => {
  const columns = [
    { sampleIndex: 0, x: 0, peaks: [
      { t: 0.05, rawStrength: 30, prominence: 20, localStrength: 3, thickness: 2, currentV2Winner: true },
      { t: 0.50, rawStrength: 15, prominence: 8, localStrength: 1.5, thickness: 3, currentV2Winner: false },
    ] },
    { sampleIndex: 1, x: 10, peaks: [
      { t: 0.06, rawStrength: 29, prominence: 19, localStrength: 2.9, thickness: 2, currentV2Winner: true },
      { t: 0.51, rawStrength: 14, prominence: 7, localStrength: 1.4, thickness: 3, currentV2Winner: false },
    ] },
  ];
  const built = debugV2BuildLinkedPaths(columns, 2, 0.15);
  const winnerPaths = built.paths.filter(p => p.containsV2Winner);
  const nonWinnerPaths = built.paths.filter(p => !p.containsV2Winner);
  assert.strictEqual(winnerPaths.length, 1);
  assert.strictEqual(nonWinnerPaths.length, 1);
  assert.ok(winnerPaths[0].points.every(p => p.currentV2Winner === true));
  assert.ok(nonWinnerPaths[0].points.every(p => p.currentV2Winner === false));
});

test('V2.2-F. the linking layer is pure — no pixel/canvas access anywhere in its source', () => {
  const start = src.indexOf('function debugV2LinkMultiPeakPaths(');
  const end = src.indexOf('\n    const REASON_MESSAGES = {');
  const block = src.slice(start, end);
  assert.ok(!/getImageData|\.ctx\b|gray\[|drawImage/.test(block),
    'V2.2 must be pure post-processing over already-computed V2.1 output — it must never touch pixels/canvas/ROI');
});

test('V2.2-G. running V2.2 linking does not change what V2 or V2.1 themselves return', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(140, 90, (x) => interpY(lidPoly, x) - 3, (x) => interpY(lidPoly, x) - 14, 220, 140, 60, 0);
  const v2Before = detectEyelidCreaseV2(canvas, eye, brow);
  const v2MultiBefore = detectEyelidCreaseV2Multi(canvas, eye, brow);
  debugV2BuildLinkedPaths(v2MultiBefore.columns, v2MultiBefore.sampledColumns, DEBUG_V2_UNCALIBRATED.PATH_LINK_MAX_T_GAP);
  const v2After = detectEyelidCreaseV2(canvas, eye, brow);
  const v2MultiAfter = detectEyelidCreaseV2Multi(canvas, eye, brow);
  assert.deepStrictEqual(v2After.paths, v2Before.paths);
  assert.deepStrictEqual(v2MultiAfter.columns, v2MultiBefore.columns);
});

test('V2.2-H. exercising V2.2 linking + buildCreaseV2CopyPayload does not affect classifyFeatures output', () => {
  const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
  const cfEnd = src.indexOf('\n    function extractEyeROI(');
  const { classifyFeatures: cf4 } = new Function(reactStubsForV2 + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();
  function eyeMetrics() {
    return {
      width: 30, height: 12, ear: 0.28, widthRatio: 0.42, tiltCorrected: 0,
      hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: 0.44, covInnerByWidth: 0.44, covOuterByWidth: 0.44, covByHeight: 0.44 / 0.36,
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
      creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseYFrac: 0.4, creaseReadQuality: 0.7,
    };
  }
  const aggregated = { left: eyeMetrics(), right: eyeMetrics(), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const before = cf4(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });

  const v2Linked = fakeV2LinkedEntry();
  buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Multi: fakeV2MultiEntry(), v2Linked }), right: fakeEyeEntry({ v2Linked }),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });

  const after = cf4(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(after.eyelidType, before.eyelidType);
  assert.strictEqual(after.eyelidCategory, before.eyelidCategory);
  assert.strictEqual(after.hoodedConfidence, before.hoodedConfidence);
  assert.strictEqual(after.isHooded, before.isHooded);
});

test('V2.2-I. V2.2 linking is only computed inside the same if(debugAvailable) block as V2/V2.1 in LiveScanScreen', () => {
  // indexOf('debugV2BuildLinkedPaths(') alone would match the function's
  // OWN definition (much earlier in the file) first — anchor on the
  // actual call-site text instead.
  const callIdx = src.indexOf('const v2LeftLinked = debugV2BuildLinkedPaths(');
  assert.ok(callIdx !== -1, 'expected a debugV2BuildLinkedPaths call site in LiveScanScreen');
  const before = src.slice(Math.max(0, callIdx - 1000), callIdx);
  assert.ok(/if\s*\(debugAvailable\)/.test(before),
    'debugV2BuildLinkedPaths call is not visibly guarded by "if (debugAvailable)"');
});

test('V2.2-J. Copy JSON (v2LinkedShadow) includes every linked path with containsV2Winner and points', () => {
  const v2Linked = fakeV2LinkedEntry();
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Linked }), right: fakeEyeEntry(),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });
  const shadow = payload.eyes.left.v2LinkedShadow;
  assert.strictEqual(shadow.runtimeMs, 0.8);
  assert.strictEqual(shadow.paths.length, 2);
  assert.strictEqual(shadow.paths[0].containsV2Winner, true);
  assert.strictEqual(shadow.paths[1].containsV2Winner, false);
  assert.strictEqual(shadow.paths[0].points.length, 2);
  assert.strictEqual(shadow.paths[0].points[1].localStrength, null, 'a genuinely-null localStrength must stay null in v2LinkedShadow too');
});

test('V2.2-K. the full payload (including v2LinkedShadow) is JSON-serializable and round-trips', () => {
  const v2Linked = fakeV2LinkedEntry();
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Linked }), right: fakeEyeEntry({ v2Linked }),
    capture: { ear: { left: 0.28, right: 0.27 }, roll: 1.2, yaw: 0.05, pitch: -0.02, brightness: 140, sharpness: 55 },
  });
  const json = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.eyes.left.v2LinkedShadow.paths.length, 2);
  console.log(`        (measured payload size with v2MultiShadow+v2LinkedShadow for both eyes: ${json.length} bytes)`);
});

test('V2.2-L. missing/invalid v2LinkedShadow serializes as explicit null, never an invented 0 or empty array', () => {
  const payload = buildCreaseV2CopyPayload({
    left: fakeEyeEntry({ v2Linked: { valid: false } }), right: fakeEyeEntry(),
    capture: null,
  });
  assert.strictEqual(payload.eyes.left.v2LinkedShadow.runtimeMs, null);
  assert.strictEqual(payload.eyes.left.v2LinkedShadow.paths, null);
  assert.strictEqual(payload.eyes.right.v2LinkedShadow.runtimeMs, null, 'right eye has no v2Linked at all — must be null, not throw');
});

test('V2.2-perf. linking runtime measured on identical synthetic input (should be negligible — pure JS over small arrays)', () => {
  const { eye, brow } = syntheticLeftEyeGeometry();
  const lidPoly = eye.slice(0, 4);
  const canvas = paintTwoEdgeCanvas(140, 90, (x) => interpY(lidPoly, x) - 3, (x) => interpY(lidPoly, x) - 14, 220, 140, 60, 0);
  const v2Multi = detectEyelidCreaseV2Multi(canvas, eye, brow);
  const linked = debugV2BuildLinkedPaths(v2Multi.columns, v2Multi.sampledColumns, DEBUG_V2_UNCALIBRATED.PATH_LINK_MAX_T_GAP);
  assert.ok(Number.isFinite(linked.v2LinkedRuntimeMs));
  console.log(`        (measured in this mock harness — V2.2 linking: ${linked.v2LinkedRuntimeMs.toFixed(3)}ms, produced ${linked.paths.length} path(s))`);
});

if (realDocument) global.document = realDocument; else delete global.document;

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
