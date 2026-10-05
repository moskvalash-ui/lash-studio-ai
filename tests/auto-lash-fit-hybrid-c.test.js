'use strict';
// ============================================================
// AUTO LASH FIT — HYBRID MVP C (production module) focused regression
// coverage. Covers auto-lash-fit-hybrid-c.js ONLY -- a standalone,
// dependency-free, production module (loaded by index.html via a plain
// <script> tag, same pattern as lash-scan-core.js). This is the
// approved, CLOSED-parameter (corridorBoundFrac=0.05) production port
// of the already-validated diagnostic Hybrid C pipeline.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const H = require('../auto-lash-fit-hybrid-c.js');

function mockRoi(w, h, bg) {
  const buf = new Uint8ClampedArray(w * h * 4).fill(bg === undefined ? 255 : bg);
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
  return { w, h, buf, ctx: { getImageData() { return { data: buf }; } } };
}

function paintBand(roi, upperPoints, frame, bandOffset, contrast, bg) {
  for (let x = 0; x < roi.w; x++) {
    let best = upperPoints[0], bd = Infinity;
    for (const p of upperPoints) { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; best = p; } }
    for (let dy = bandOffset - 5; dy <= bandOffset + 5; dy++) {
      const yy = Math.round(best.y - dy);
      if (yy >= 0 && yy < roi.h) { const o = (yy * roi.w + x) * 4; const v = (bg || 200) - contrast; roi.buf[o] = v; roi.buf[o + 1] = v; roi.buf[o + 2] = v; }
    }
  }
}

const UPPER = [{ x: 0, y: 150 }, { x: 96, y: 92.4 }, { x: 224, y: 86 }, { x: 320, y: 150 }];
const EYE_WIDTH = 320;

test('1. no roi -- exact fallback: every sample offset is 0, usedPixelEvidence is false (existing production baseline preserved)', () => {
  const r = H.computeHybridCDisplacementSamples(null, UPPER, EYE_WIDTH);
  assert.strictEqual(r.samples.length, 11);
  assert.ok(r.samples.every(s => s.offset === 0));
  assert.strictEqual(r.usedPixelEvidence, false);
});

test('2. a blank/uniform photo (no real contrast anywhere) also falls back to the baseline -- not just a missing roi', () => {
  const roi = mockRoi(420, 300, 200); // uniform background, no bands painted
  const r = H.computeHybridCDisplacementSamples(roi, UPPER, EYE_WIDTH);
  assert.ok(r.samples.every(s => s.offset === 0));
  assert.strictEqual(r.usedPixelEvidence, false);
});

test('3. a candidate within +-0.05*eyeWidth is allowed through gateCandidatesByCorridorBound', () => {
  const bound = H.CORRIDOR_BOUND_FRAC * EYE_WIDTH; // 16px
  const ray = { candidates: [{ position: bound - 0.5, confidence: 0.9 }] };
  const gated = H.gateCandidatesByCorridorBound([ray], EYE_WIDTH);
  assert.strictEqual(gated[0].candidates.length, 1);
});

test('4. a candidate outside +-0.05*eyeWidth is removed unconditionally, even as the sole/strongest candidate', () => {
  const bound = H.CORRIDOR_BOUND_FRAC * EYE_WIDTH;
  const ray = { candidates: [{ position: bound + 0.5, confidence: 1.0 }] };
  const gated = H.gateCandidatesByCorridorBound([ray], EYE_WIDTH);
  assert.strictEqual(gated[0].candidates.length, 0);
});

test('5. real pixel evidence inside the corridor produces a non-zero, bounded correction', () => {
  const frame = H.computeChordFrame(UPPER[0], UPPER[3]);
  const roi = mockRoi(420, 300, 200);
  paintBand(roi, UPPER, frame, 10, 150, 200); // well inside the 16px corridor for this eyeWidth
  const r = H.computeHybridCDisplacementSamples(roi, UPPER, EYE_WIDTH);
  assert.strictEqual(r.usedPixelEvidence, true);
  assert.ok(r.samples.some(s => s.offset !== 0));
});

test('6. the final displacement can NEVER exceed +-0.05*eyeWidth, even when the only real pixel evidence sits far outside the corridor', () => {
  const frame = H.computeChordFrame(UPPER[0], UPPER[3]);
  const roi = mockRoi(420, 300, 200);
  paintBand(roi, UPPER, frame, 60, 150, 200); // 60px >> 16px bound -- must never leak through
  const r = H.computeHybridCDisplacementSamples(roi, UPPER, EYE_WIDTH);
  const bound = H.CORRIDOR_BOUND_FRAC * EYE_WIDTH;
  for (const s of r.samples) assert.ok(Math.abs(s.offset) <= bound + 1e-6, `offset ${s.offset} exceeded bound ${bound} at t=${s.t}`);
  // with evidence only far outside the corridor, every ray should fall
  // back to the baseline (0) -- not invent a clamped-but-wrong position.
  assert.ok(r.samples.every(s => s.offset === 0), 'with no evidence inside the corridor, every sample must fall back to baseline, not clamp a far-away candidate into range');
});

test('7. LEFT and RIGHT physical eyes use identical canonical logic -- running on a true geometric mirror produces an equivalently bounded result (no side-specific branching exists anywhere in this module)', () => {
  const w = 320;
  const leftUpper = UPPER;
  const rightUpper = UPPER.map(p => ({ x: w - p.x, y: p.y }));
  const leftFrame = H.computeChordFrame(leftUpper[0], leftUpper[3]);
  const rightFrame = H.computeChordFrame(rightUpper[0], rightUpper[3]);
  const leftRoi = mockRoi(420, 300, 200), rightRoi = mockRoi(420, 300, 200);
  paintBand(leftRoi, leftUpper, leftFrame, 10, 150, 200);
  paintBand(rightRoi, rightUpper, rightFrame, 10, 150, 200);
  const leftR = H.computeHybridCDisplacementSamples(leftRoi, leftUpper, w);
  const rightR = H.computeHybridCDisplacementSamples(rightRoi, rightUpper, w);
  const bound = H.CORRIDOR_BOUND_FRAC * w;
  for (const s of leftR.samples) assert.ok(Math.abs(s.offset) <= bound + 1e-6);
  for (const s of rightR.samples) assert.ok(Math.abs(s.offset) <= bound + 1e-6);
  assert.strictEqual(leftR.usedPixelEvidence, true);
  assert.strictEqual(rightR.usedPixelEvidence, true);
});

test('8. computeChordFrame matches the validated "point up" convention (ny<0) for a normally-oriented eye', () => {
  const frame = H.computeChordFrame(UPPER[0], UPPER[3]);
  assert.ok(frame.ny < 0, 'normal must point up (negative screen-Y) for a near-horizontal eye');
});

test('9. corridorBoundPx scales proportionally with eyeWidth (scale-normalized, not a raw-pixel constant)', () => {
  const r1 = H.computeHybridCDisplacementSamples(null, UPPER, 100);
  const r2 = H.computeHybridCDisplacementSamples(null, UPPER.map(p => ({ x: p.x * 2, y: p.y })), 200);
  assert.strictEqual(r1.corridorBoundPx, 5);
  assert.strictEqual(r2.corridorBoundPx, 10);
});

test('10. the regularizer does not crash and returns finite values on a realistic multi-band photo (continuity/regularization intact)', () => {
  const frame = H.computeChordFrame(UPPER[0], UPPER[3]);
  const roi = mockRoi(420, 300, 200);
  paintBand(roi, UPPER, frame, 8, 120, 200);
  paintBand(roi, UPPER, frame, -5, 60, 200);
  const r = H.computeHybridCDisplacementSamples(roi, UPPER, EYE_WIDTH);
  assert.ok(r.samples.every(s => Number.isFinite(s.offset)));
});
