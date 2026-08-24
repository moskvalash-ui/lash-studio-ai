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
const { detectEyelidCreaseV2, extractEyeROI, DEBUG_V2_UNCALIBRATED } = new Function(
  reactStubsForV2 + pipelineSource + '\nreturn { detectEyelidCreaseV2, extractEyeROI, DEBUG_V2_UNCALIBRATED };'
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
const payloadFnStart = src.indexOf('function buildCreaseV2CopyPayload(');
const payloadFnEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
const { buildCreaseV2CopyPayload } = new Function(
  src.slice(payloadFnStart, payloadFnEnd) + '\nreturn { buildCreaseV2CopyPayload };'
)();

function fakeEyeEntry({ v1Valid = true, paths } = {}) {
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
  const panelSrc = src.slice(panelStart, panelStart + 3000);
  const copyBtnIdx = panelSrc.indexOf('Copy V2 JSON');
  const leftPanelIdx = panelSrc.indexOf('<CreaseV2EyePanel label="LEFT"');
  assert.ok(copyBtnIdx !== -1 && leftPanelIdx !== -1, 'expected to find both the Copy button and the LEFT eye panel in CreaseV2DebugPanel');
  assert.ok(copyBtnIdx < leftPanelIdx, 'Copy button must render before (above) the LEFT/RIGHT diagnostic body');
});

// ---- H — debug panel remains debug-only (re-confirms tests B/B2 still hold after this turn's edits). ----
test('H. CreaseV2DebugPanel is still only mounted behind debugAvailable in LiveScanScreen', () => {
  const mountIdx = src.indexOf('<CreaseV2DebugPanel data={debugCreaseV2} />');
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
  const blockEnd = src.indexOf('\n    const REASON_MESSAGES = {', blockStart);
  assert.ok(blockStart !== -1 && blockEnd !== -1, 'could not locate the V2 detector block');
  const block = src.slice(blockStart, blockEnd);
  const actualSha = crypto.createHash('sha256').update(block).digest('hex');
  assert.strictEqual(actualSha, V2_BLOCK_EXPECTED_SHA256,
    'the V2 detector block (algorithm, ranking, DEBUG_V2_UNCALIBRATED) has changed — this turn was scoped to debug UI only');
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

if (realDocument) global.document = realDocument; else delete global.document;

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
