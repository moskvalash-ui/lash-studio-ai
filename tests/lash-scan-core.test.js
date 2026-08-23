// ============================================================
// NLS-1 — Natural Lash Scan measurement foundation tests.
// ------------------------------------------------------------
// No external test framework — the project has none (confirmed by
// audit) and adding one would require build tooling this project
// deliberately does not have. This is a small, dependency-free
// assert-based runner requiring lash-scan-core.js directly (Node
// CommonJS export path in that file's UMD wrapper).
//
// Run with:  node tests/lash-scan-core.test.js
// ============================================================
const assert = require('assert');
const path = require('path');
const {
  LASH_ZONE_NAMES,
  lashLineSegmentLengths,
  lashLineArcLengthPointAt,
  detectVisibleLashCandidates,
  aggregateLashFrames,
  computeLashObservations,
  compareNaturalLashes,
  computeNaturalLashCondition,
} = require(path.join(__dirname, '..', 'lash-scan-core.js'));

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}
function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} expected ${a} ~= ${b} (eps=${eps})`);
}

// ---- minimal canvas-2D-context mock (no node-canvas dependency) ----
function mockRoi(w, h, bg) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { buf[i*4]=bg; buf[i*4+1]=bg; buf[i*4+2]=bg; buf[i*4+3]=255; }
  const ctx = {
    fillRect(x, y, ww, hh, gray) {
      for (let yy = Math.max(0,Math.round(y)); yy < Math.min(h, Math.round(y+hh)); yy++) {
        for (let xx = Math.max(0,Math.round(x)); xx < Math.min(w, Math.round(x+ww)); xx++) {
          const o = (yy*w+xx)*4; buf[o]=gray; buf[o+1]=gray; buf[o+2]=gray;
        }
      }
    },
    getImageData(x, y, ww, hh) {
      // full-frame reads only (x=0,y=0,ww=w,hh=h) — sufficient for detectVisibleLashCandidates
      return { data: buf };
    },
  };
  return { w, h, ctx };
}

console.log('=== Arc-length zoning ===');

test('1. Four equally spaced points -> thirds match naive expectation', () => {
  const pts = [{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:30,y:0}];
  const p13 = lashLineArcLengthPointAt(pts, 1/3);
  const p23 = lashLineArcLengthPointAt(pts, 2/3);
  approx(p13.x, 10, 1e-9, 's=1/3 x');
  approx(p23.x, 20, 1e-9, 's=2/3 x');
});

test('2. Highly unequal segments -> zones follow cumulative distance, not landmark index', () => {
  // p0->p1 short(10), p1->p2 long(60), p2->p3 short(10); total=80
  const pts = [{x:0,y:0},{x:10,y:0},{x:70,y:0},{x:80,y:0}];
  const lens = lashLineSegmentLengths(pts);
  assert.deepStrictEqual(lens, [10,60,10]);
  const p13 = lashLineArcLengthPointAt(pts, 1/3);
  const p23 = lashLineArcLengthPointAt(pts, 2/3);
  approx(p13.x, 80/3, 1e-9, 'arc-length s=1/3 must be at real x=80/3, NOT at landmark index boundary x=10');
  approx(p23.x, 160/3, 1e-9, 'arc-length s=2/3 must be at real x=160/3, NOT at landmark index boundary x=70');
  // a point physically inside the first third (x=15, real distance 15/80=0.1875 < 1/3)
  // must resolve to s < 1/3, even though x=15 falls in the SECOND landmark
  // segment (p1->p2 spans x=10..70) -- this is exactly the bug being fixed.
  // Find s by bisection since we only have point-at-s, not s-at-point.
  let lo=0, hi=1;
  for (let iter=0; iter<40; iter++) { const mid=(lo+hi)/2; if (lashLineArcLengthPointAt(pts,mid).x < 15) lo=mid; else hi=mid; }
  assert.ok(lo < 1/3, `x=15 should resolve to s<1/3 (inner third), got s~=${lo.toFixed(4)}`);
});

test('3. Scale invariance: 2x coordinates -> same normalized s assignment', () => {
  const pts = [{x:0,y:0},{x:10,y:0},{x:70,y:0},{x:80,y:0}];
  const pts2x = pts.map(p => ({x:p.x*2, y:p.y*2}));
  const s = 0.4123;
  const p1 = lashLineArcLengthPointAt(pts, s);
  const p2 = lashLineArcLengthPointAt(pts2x, s);
  approx(p2.x, p1.x*2, 1e-9, 'scaled point-at-s must scale proportionally, same relative fraction');
});

test('4. Rotation invariance: rotated geometry -> same normalized s assignment', () => {
  const pts = [{x:0,y:0},{x:10,y:0},{x:70,y:0},{x:80,y:0}];
  const theta = 37 * Math.PI/180;
  const rot = (p) => ({ x: p.x*Math.cos(theta)-p.y*Math.sin(theta), y: p.x*Math.sin(theta)+p.y*Math.cos(theta) });
  const ptsRot = pts.map(rot);
  const s = 0.4123;
  const p1 = lashLineArcLengthPointAt(pts, s);
  const p2 = lashLineArcLengthPointAt(ptsRot, s);
  const p1r = rot(p1);
  approx(p2.x, p1r.x, 1e-9, 'rotated point-at-s must equal the rotation of the unrotated point-at-s');
  approx(p2.y, p1r.y, 1e-9, 'rotated point-at-s must equal the rotation of the unrotated point-at-s');
});

test('5. Degenerate geometry: coincident points do not produce NaN/Infinity', () => {
  const pts = [{x:5,y:5},{x:5,y:5},{x:5,y:5},{x:5,y:5}];
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const p = lashLineArcLengthPointAt(pts, s);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `s=${s} must be finite, got (${p.x},${p.y})`);
  }
  // one zero-length segment among real ones
  const pts2 = [{x:0,y:0},{x:0,y:0},{x:50,y:0},{x:100,y:0}];
  for (const s of [0,0.1,0.5,0.9,1]) {
    const p = lashLineArcLengthPointAt(pts2, s);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `zero-length segment case s=${s} must be finite`);
  }
});

console.log('=== Occupancy / density semantics ===');

function fakeAgg(tsWithLen, framesUsed) {
  // tsWithLen: [{t, direction, lengthPx, support?}] already-"stable"
  // candidates. `support` defaults to framesUsed (found in every
  // buffered frame) unless a test explicitly overrides it — the real
  // aggregateLashFrames() always sets a real integer support on every
  // stable cluster, so tests must too (a missing/undefined support
  // silently poisons computeLashConfidence with NaN, which is exactly
  // what exposed the NaN-safety gap fixed in lash-scan-core.js).
  const fu = framesUsed || 8;
  const stable = tsWithLen.map(c => ({ support: fu, ...c }));
  return { stable, framesUsed: fu, perFrameCounts: [tsWithLen.length,tsWithLen.length,tsWithLen.length] };
}

test('6. zoneOccupancy uses only samples belonging to that zone', () => {
  const steps = 30, eyeH = 20;
  // 3 candidates, one squarely in each third
  const agg = fakeAgg([
    { t: 0.10, direction: 0, lengthPx: 10 },
    { t: 0.50, direction: 0, lengthPx: 10 },
    { t: 0.90, direction: 0, lengthPx: 10 },
  ]);
  const obs = computeLashObservations(agg, steps, eyeH, 'medium', { sharpness:150, widthFrac:0.12, roiWidth:120, roiHeight:120 });
  assert.strictEqual(obs.zones.inner.estimatedCount, 1);
  assert.strictEqual(obs.zones.center.estimatedCount, 1);
  assert.strictEqual(obs.zones.outer.estimatedCount, 1);
  // each zone's own step-count denominator must be roughly steps/3, independently
  const total = obs.zones.inner.occupancy + 0; // just sanity it's a ratio, not raw count
  assert.ok(obs.zones.inner.occupancy > 0 && obs.zones.inner.occupancy <= 1);
});

test('7. occupancyLevel boundaries behave correctly (0.20 / 0.38)', () => {
  // Build agg to hit specific overall occupancy values via n/steps.
  const steps = 100;
  const mk = (n) => fakeAgg(Array.from({length:n},(_,i)=>({t:i/(n+1), direction:0, lengthPx:10})));
  const below = computeLashObservations(mk(19), steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120}); // 0.19 -> low
  const mid   = computeLashObservations(mk(30), steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120}); // 0.30 -> medium
  const high  = computeLashObservations(mk(40), steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120}); // 0.40 -> high
  assert.strictEqual(below.occupancyLevel, 'low');
  assert.strictEqual(mid.occupancyLevel, 'medium');
  assert.strictEqual(high.occupancyLevel, 'high');
});

test('8. legacy density alias exactly matches occupancy-derived level', () => {
  const steps = 30, eyeH = 20;
  const agg = fakeAgg([
    {t:0.05,direction:0,lengthPx:10},{t:0.10,direction:0,lengthPx:10},
    {t:0.45,direction:0,lengthPx:10},
    {t:0.95,direction:0,lengthPx:10},{t:0.90,direction:0,lengthPx:10},{t:0.85,direction:0,lengthPx:10},
  ]);
  const obs = computeLashObservations(agg, steps, eyeH, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});
  assert.strictEqual(obs.visualDensity, obs.occupancyLevel, 'top-level legacy alias must equal canonical level');
  LASH_ZONE_NAMES.forEach((name,i) => {
    assert.strictEqual(obs.zoneDensity[i], obs.zoneOccupancyLevel[i], `zone ${name} legacy density must equal occupancyLevel`);
    assert.strictEqual(obs.zones[name].density, obs.zones[name].occupancyLevel, `zones.${name}.density must equal .occupancyLevel`);
  });
});

console.log('=== Sparse-area confidence gating ===');

test('9. Low occupancy + high confidence -> sparseArea true', () => {
  const steps = 60, eyeH = 20;
  // outer third gets ZERO candidates (occupancy=0 < 0.10), plenty of samples land there (steps=60 -> ~20/zone), good quality
  const agg = fakeAgg([{t:0.10,direction:0,lengthPx:10},{t:0.15,direction:0,lengthPx:10},{t:0.20,direction:0,lengthPx:10},
                        {t:0.45,direction:0,lengthPx:10},{t:0.50,direction:0,lengthPx:10},{t:0.55,direction:0,lengthPx:10}]);
  const obs = computeLashObservations(agg, steps, eyeH, 'high', {sharpness:150,widthFrac:0.13,roiWidth:150,roiHeight:150});
  assert.strictEqual(obs.zones.outer.sparseArea, true);
  assert.ok(obs.zones.outer.confidence >= 0.35, 'sparse assertion requires confidence above the gate');
});

test('10. Low occupancy + low confidence -> unknown (null), not false', () => {
  const steps = 60, eyeH = 20;
  // outer zone has zero candidates. Every confidence factor is made
  // deliberately poor (weak support, inconsistent per-frame counts,
  // bad image quality/distance/resolution) so the OVERALL scan
  // confidence itself is genuinely low, not just this one zone's
  // sample count.
  const agg = {
    stable: [
      { t: 0.10, direction: 0, lengthPx: 10, support: 3 },
      { t: 0.15, direction: 0, lengthPx: 10, support: 3 },
    ],
    framesUsed: 8,
    perFrameCounts: [0, 5, 1, 4, 0, 5, 1, 4], // highly inconsistent frame-to-frame -> low consistency factor
  };
  const obs = computeLashObservations(agg, steps, eyeH, 'low', { sharpness: 2, widthFrac: 0.081, roiWidth: 61, roiHeight: 61 });
  // computeLashConfidence can never mathematically go below 0.35 (see
  // MIN_SPARSE_CONFIDENCE comment in lash-scan-core.js) — this setup
  // reaches the realistic worst case, comfortably below the 0.45 gate.
  assert.ok(obs.confidence < 0.45, `test setup must produce confidence below the sparse-area gate, got ${obs.confidence}`);
  assert.strictEqual(obs.zones.outer.sparseArea, null, 'insufficient confidence must report null, not a confident false/true');
  assert.strictEqual(obs.zones.outer.gaps, false, 'legacy boolean must conservatively collapse null to false, never overclaim a gap');
});

test('11. Adequate occupancy -> not sparse (false, not null)', () => {
  const steps = 60, eyeH = 20;
  const agg = fakeAgg(Array.from({length:30},(_,i)=>({t:i/29, direction:0, lengthPx:10})));
  const obs = computeLashObservations(agg, steps, eyeH, 'high', {sharpness:150,widthFrac:0.13,roiWidth:150,roiHeight:150});
  LASH_ZONE_NAMES.forEach(name => assert.strictEqual(obs.zones[name].sparseArea, false));
});

console.log('=== Visible length ===');

test('12. Same relative geometry at different pixel scale -> same visibleLengthRatio', () => {
  const steps = 30;
  const agg1 = fakeAgg([{t:0.5,direction:0,lengthPx:11}]);
  const agg2 = fakeAgg([{t:0.5,direction:0,lengthPx:22}]); // 2x lengthPx
  const obs1 = computeLashObservations(agg1, steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});   // eyeH=20
  const obs2 = computeLashObservations(agg2, steps, 40, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});   // eyeH=40 (2x)
  approx(obs1.zones.center.visibleLengthRatio, obs2.zones.center.visibleLengthRatio, 1e-9, 'ratio must be scale-invariant when both lengthPx and eyeH scale together');
});

test('13. No valid candidates in a zone -> unknown, not fabricated', () => {
  const steps = 30;
  const agg = fakeAgg([{t:0.5,direction:0,lengthPx:10}]); // only center has data
  const obs = computeLashObservations(agg, steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});
  assert.strictEqual(obs.zones.inner.visibleLengthRatio, null);
  assert.strictEqual(obs.zones.inner.visibleLengthLevel, 'unknown');
  assert.strictEqual(obs.zones.outer.visibleLengthRatio, null);
});

console.log('=== Count semantics ===');

test('14. Internal candidate-cluster count is not exposed as an exact lash count', () => {
  const steps = 30;
  const agg = fakeAgg([{t:0.1,direction:0,lengthPx:10},{t:0.5,direction:0,lengthPx:10},{t:0.9,direction:0,lengthPx:10}]);
  const obs = computeLashObservations(agg, steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});
  assert.ok(!('lashCount' in obs), 'observation contract must never expose a field literally named lashCount');
  assert.ok(obs.diagnostics && typeof obs.diagnostics.candidateClusterCount === 'number', 'raw cluster count must live under diagnostics, clearly internal');
  assert.strictEqual(obs.diagnostics.candidateClusterCount, 3);
  assert.strictEqual(obs.diagnostics.candidateClusterCountLow, 2);
  assert.strictEqual(obs.diagnostics.candidateClusterCountHigh, 4);
});

test('14b. REGRESSION — the master-facing (top-level) observation contract contains no lash-count-like measurement at all', () => {
  const steps = 30;
  const agg = fakeAgg([{t:0.1,direction:0,lengthPx:10},{t:0.5,direction:0,lengthPx:10},{t:0.9,direction:0,lengthPx:10}]);
  const obs = computeLashObservations(agg, steps, 20, 'medium', {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120});
  const topLevelKeys = Object.keys(obs).filter(k => k !== 'diagnostics');
  const countLikePattern = /count/i;
  const offenders = topLevelKeys.filter(k => countLikePattern.test(k));
  assert.deepStrictEqual(offenders, [], `top-level observation contract must contain no count-like field; found: ${offenders.join(', ')}`);
  // same check per-zone (zones.inner/center/outer must not carry a
  // count-like field either — estimatedCount lives there today as an
  // explicitly-commented internal-diagnostic field; assert it stays
  // that way and nothing count-like leaks into the zone object beyond it)
  Object.keys(obs.zones).forEach(zoneName => {
    const zoneKeys = Object.keys(obs.zones[zoneName]);
    const zoneOffenders = zoneKeys.filter(k => countLikePattern.test(k) && k !== 'estimatedCount');
    assert.deepStrictEqual(zoneOffenders, [], `zones.${zoneName} must contain no count-like field besides the explicitly-diagnostic estimatedCount; found: ${zoneOffenders.join(', ')}`);
  });
});

console.log('=== L/R comparison ===');

test('15. Symmetric synthetic eyes -> no meaningful occupancy difference', () => {
  const steps = 30;
  const mkSame = () => fakeAgg(Array.from({length:20},(_,i)=>({t:i/19, direction:0, lengthPx:10})));
  const q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const left = computeLashObservations(mkSame(), steps, 20, 'high', q);
  const right = computeLashObservations(mkSame(), steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.strictEqual(cmp.occupancyDiff, 0);
  assert.strictEqual(cmp.notableZone, null);
});

test('16. Meaningful occupancy difference -> comparison reports it', () => {
  const steps = 30;
  const q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const left = computeLashObservations(fakeAgg(Array.from({length:25},(_,i)=>({t:i/24,direction:0,lengthPx:10}))), steps, 20, 'high', q);
  const right = computeLashObservations(fakeAgg(Array.from({length:6},(_,i)=>({t:i/5,direction:0,lengthPx:10}))), steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.ok(cmp.occupancyDiff > 0, `expected a positive, reported occupancy difference, got ${cmp.occupancyDiff}`);
});

test('17. Tiny difference within noise/dead-zone -> ignored (occupancyDiff=0)', () => {
  const steps = 60;
  const q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const left = computeLashObservations(fakeAgg(Array.from({length:20},(_,i)=>({t:i/19,direction:0,lengthPx:10}))), steps, 20, 'high', q);
  const right = computeLashObservations(fakeAgg(Array.from({length:21},(_,i)=>({t:i/20,direction:0,lengthPx:10}))), steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.strictEqual(cmp.occupancyDiff, 0, `a 1-candidate/60-step (~0.017) difference must fall inside the dead zone, got ${cmp.occupancyDiff}`);
});

console.log('=== Pixel-level integration (arc-length fix through the real detector) ===');

test('18. detectVisibleLashCandidates classifies a real-position candidate using arc-length t, not landmark index', () => {
  const pts = [{x:0,y:45},{x:10,y:45},{x:70,y:45},{x:80,y:45}]; // same unequal-segment geometry as test 2
  const roi = mockRoi(90, 60, 160);
  roi.ctx.fillRect(14, 30, 2, 20, 100); // dark streak at real x=15 (physically in the inner third of an 80px line)
  const det = detectVisibleLashCandidates(roi, pts);
  assert.ok(det.candidates.length >= 1, 'expected at least one candidate to be detected');
  const t = det.candidates[0].t;
  assert.ok(t < 1/3, `real x=15 (inner third of 80px line) must resolve to t<1/3, got t=${t.toFixed(3)}`);
});

// ============================================================
// NLS-2 — Natural Lash Condition tests.
// ============================================================
console.log('\n=== NLS-2: Occupancy Uniformity ===');

// computeNaturalLashCondition(agg, zoneOccupancy, zoneConfidence, zoneRelLenRaw, sparseAreaTri, eyeH, consistency)
function candAt(t, lengthPx) { return { t, direction: 0, lengthPx }; }
function aggOf(cands) { return { stable: cands }; }

test('N1. Equal confident zones -> EVEN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.6,0.6,0.6], [false,false,false], 20, 0.9);
  assert.strictEqual(c.occupancyUniformity.level, 'EVEN');
});

test('N2. One substantially lower zone -> UNEVEN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.35,0.35,0.05], [0.8,0.8,0.8], [0.6,0.6,0.6], [false,false,true], 20, 0.9);
  assert.strictEqual(c.occupancyUniformity.level, 'UNEVEN');
});

test('N3. Insufficient confident zones -> UNKNOWN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.05], [0.8,0.2,0.2], [0.6,0.6,0.6], [false,null,null], 20, 0.9);
  assert.strictEqual(c.occupancyUniformity.level, 'UNKNOWN');
});

test('N4. Low-confidence extreme value must not create false unevenness', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.03], [0.8,0.8,0.1], [0.6,0.6,null], [false,false,null], 20, 0.9);
  assert.strictEqual(c.occupancyUniformity.level, 'EVEN', 'the low-confidence outer=0.03 must be excluded from the spread calc entirely');
});

console.log('=== NLS-2: Visible Length Uniformity ===');

test('N5. Similar relative lengths -> EVEN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.60,0.62,0.58], [false,false,false], 20, 0.9);
  assert.strictEqual(c.visibleLengthUniformity.level, 'EVEN');
});

test('N6. Meaningful variation -> UNEVEN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.40,0.90,0.45], [false,false,false], 20, 0.9);
  assert.strictEqual(c.visibleLengthUniformity.level, 'UNEVEN');
});

test('N7. No valid length -> UNKNOWN', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.30,0.30], [0.8,0.8,0.8], [null,null,null], [false,false,false], 20, 0.9);
  assert.strictEqual(c.visibleLengthUniformity.level, 'UNKNOWN');
});

test('N8. Scale-equivalent inputs (2x lengthPx and eyeH) produce the same normalized zoneRelLenRaw / level', () => {
  const steps = 30, q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const agg1 = fakeAgg([{t:0.1,lengthPx:12},{t:0.5,lengthPx:20},{t:0.9,lengthPx:14}]);
  const agg2 = fakeAgg([{t:0.1,lengthPx:24},{t:0.5,lengthPx:40},{t:0.9,lengthPx:28}]); // 2x lengthPx
  const obs1 = computeLashObservations(agg1, steps, 20, 'medium', q);   // eyeH=20
  const obs2 = computeLashObservations(agg2, steps, 40, 'medium', q);   // eyeH=40 (2x)
  assert.strictEqual(obs1.condition.visibleLengthUniformity.level, obs2.condition.visibleLengthUniformity.level);
  approx(obs1.condition.visibleLengthUniformity.dispersion, obs2.condition.visibleLengthUniformity.dispersion, 1e-9);
});

console.log('=== NLS-2: Local Thinning / Reduced Occupancy ===');

test('N9. One zone meaningfully below same-eye baseline -> reduced', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.35,0.35,0.08], [0.8,0.8,0.8], [0.6,0.6,0.6], [false,false,true], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, true);
});

test('N10. Tiny difference -> no flag', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.30,0.31,0.29], [0.8,0.8,0.8], [0.6,0.6,0.6], [false,false,false], 20, 0.9);
  LASH_ZONE_NAMES.forEach(name => assert.strictEqual(c.zones[name].locallyReducedOccupancy, false));
});

test('N11. Low-confidence zone -> UNKNOWN, not asserted', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.35,0.35,0.08], [0.8,0.8,0.1], [0.6,0.6,null], [false,false,null], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, null);
});

test('N12. Globally but evenly sparse eye must NOT label one zone locally reduced', () => {
  const c = computeNaturalLashCondition(aggOf([]), [0.08,0.09,0.07], [0.8,0.8,0.8], [0.6,0.6,0.6], [true,true,true], 20, 0.9);
  LASH_ZONE_NAMES.forEach(name => assert.strictEqual(c.zones[name].locallyReducedOccupancy, false, `${name} must not be flagged just because the whole eye is uniformly sparse`));
});

console.log('=== NLS-2: Relative Short-Lash Concentration ===');

function buildShortConcentrationAgg() {
  // 10 "normal" candidates (mild natural jitter ~0.9-1.1) split across inner/center,
  // 5 "short" candidates (0.15) concentrated in outer.
  const normal = [0.90,0.95,1.00,1.05,1.10,0.92,0.98,1.02,1.08,0.96];
  const cands = [];
  normal.slice(0,5).forEach((v,i) => cands.push(candAt(0.05+i*0.03, v*20))); // inner, eyeH=20 -> lengthPx = ratio*eyeH
  normal.slice(5).forEach((v,i) => cands.push(candAt(0.40+i*0.03, v*20)));   // center
  for (let i=0;i<5;i++) cands.push(candAt(0.70+i*0.05, 0.15*20));            // outer, short
  return cands;
}

test('N13. Sufficient candidate support + extreme short concentration -> flag', () => {
  const cands = buildShortConcentrationAgg();
  const c = computeNaturalLashCondition(aggOf(cands), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.6,0.6,0.15], [false,false,false], 20, 0.9);
  assert.strictEqual(c.zones.outer.shortLashConcentration, true);
  assert.ok(c.zones.outer.shortCandidateFraction >= 0.6);
});

test('N14. Insufficient candidates -> UNKNOWN', () => {
  const cands = [candAt(0.75, 0.15*20), candAt(0.80, 0.15*20)]; // only 2, below MIN_SHORT_SUPPORT=4
  const c = computeNaturalLashCondition(aggOf(cands), [0.30,0.30,0.10], [0.8,0.8,0.8], [0.6,0.6,0.15], [false,false,true], 20, 0.9);
  assert.strictEqual(c.zones.outer.shortLashConcentration, null);
});

test('N15. Scaling all geometry (lengthPx and eyeH) -> same relative short-concentration result', () => {
  const cands1 = buildShortConcentrationAgg();
  const cands2 = cands1.map(c => ({ ...c, lengthPx: c.lengthPx * 3 })); // 3x lengthPx
  const c1 = computeNaturalLashCondition(aggOf(cands1), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.6,0.6,0.15], [false,false,false], 20, 0.9);
  const c2 = computeNaturalLashCondition(aggOf(cands2), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.6,0.6,0.15], [false,false,false], 60, 0.9); // eyeH also x3
  assert.strictEqual(c1.zones.outer.shortLashConcentration, c2.zones.outer.shortLashConcentration);
  approx(c1.zones.outer.shortCandidateFraction, c2.zones.outer.shortCandidateFraction, 1e-9);
});

test('N16. Naturally (mildly) shorter inner candidates must NOT trigger short concentration', () => {
  // inner mildly shorter (~0.75x) than center/outer (~1.0), not extreme -- must not cross the 1.5-MAD bar
  const cands = [];
  const innerLens = [0.72,0.78,0.75,0.80,0.74];
  const otherLens = [0.98,1.02,1.00,0.96,1.04,1.01,0.99,1.03,0.97,1.00];
  innerLens.forEach((v,i) => cands.push(candAt(0.05+i*0.03, v*20)));
  otherLens.slice(0,5).forEach((v,i) => cands.push(candAt(0.40+i*0.03, v*20)));
  otherLens.slice(5).forEach((v,i) => cands.push(candAt(0.75+i*0.03, v*20)));
  const c = computeNaturalLashCondition(aggOf(cands), [0.30,0.30,0.30], [0.8,0.8,0.8], [0.75,1.0,1.0], [false,false,false], 20, 0.9);
  assert.strictEqual(c.zones.inner.shortLashConcentration, false, 'mild, natural inner shortening must not be flagged as an unusual concentration');
});

console.log('=== NLS-2: Visible Irregular Area ===');

test('N17. Occupancy evidence only -> NOT irregular', () => {
  // outer: reduced occupancy (vs baseline), but length is uniform and not short.
  // Normal-zone lengths are mildly jittered (not all identical) so the
  // whole-eye MAD is genuinely nonzero -- an all-identical distribution
  // degenerates to MAD=0 -> shortLashConcentration correctly reports
  // null/insufficient-signal rather than false, which would otherwise
  // make this setup untestable (null is a different, also-safe outcome
  // handled by N20, not what this test is targeting).
  const cands = [];
  const innerLens = [0.93,0.97,0.95,0.98,0.94];
  const centerLens = [0.94,0.96,0.99,0.93,0.97];
  innerLens.forEach((v,i) => cands.push(candAt(0.05+i*0.03, v*20)));
  centerLens.forEach((v,i) => cands.push(candAt(0.40+i*0.03, v*20)));
  // 6 (not the bare MIN_SHORT_SUPPORT=4 floor) so shortConcentrationConfidence
  // clears the assessment gate -- 4 exactly sits right at a support level
  // whose confidence (0.8*4/8=0.4) falls just under the 0.45 bar, which
  // would make this zone correctly UNKNOWN rather than the confident
  // false this test is targeting.
  for (let i=0;i<6;i++) cands.push(candAt(0.75+i*0.02, 0.90*20));  // outer: fewer candidates (reduced occupancy), but uniform, NOT short
  const c = computeNaturalLashCondition(aggOf(cands), [0.35,0.35,0.15], [0.8,0.8,0.8], [0.6,0.6,0.6], [false,false,false], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, true, 'setup check: occupancy evidence must be present');
  assert.strictEqual(c.zones.outer.withinZoneLengthIrregular, false, 'setup check: length evidence must be absent');
  assert.strictEqual(c.zones.outer.shortLashConcentration, false, 'setup check: no short concentration either');
  assert.strictEqual(c.zones.outer.visibleIrregularArea, false);
});

test('N18. Length evidence only -> NOT irregular', () => {
  // outer: occupancy is fine (not reduced, not sparse) but length is highly irregular within the zone
  const cands = [];
  for (let i=0;i<5;i++) cands.push(candAt(0.05+i*0.03, 0.95*20));
  for (let i=0;i<5;i++) cands.push(candAt(0.40+i*0.03, 0.95*20));
  const irregular = [0.3,1.6,0.35,1.55,0.4,1.5]; // wildly alternating -> high CV
  irregular.forEach((v,i) => cands.push(candAt(0.75+i*0.02, v*20)));
  const c = computeNaturalLashCondition(aggOf(cands), [0.32,0.32,0.32], [0.8,0.8,0.8], [0.6,0.6,0.9], [false,false,false], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, false, 'setup check: occupancy evidence must be absent');
  assert.strictEqual(c.zones.outer.withinZoneLengthIrregular, true, 'setup check: length evidence must be present');
  assert.strictEqual(c.zones.outer.visibleIrregularArea, false);
});

test('N19. Occupancy + independent length evidence -> irregular', () => {
  const cands = [];
  for (let i=0;i<5;i++) cands.push(candAt(0.05+i*0.03, 0.95*20));
  for (let i=0;i<5;i++) cands.push(candAt(0.40+i*0.03, 0.95*20));
  const irregular = [0.3,1.6,0.35,1.55]; // high CV, only 4 (reduced occupancy AND irregular)
  irregular.forEach((v,i) => cands.push(candAt(0.75+i*0.03, v*20)));
  const c = computeNaturalLashCondition(aggOf(cands), [0.35,0.35,0.14], [0.8,0.8,0.8], [0.6,0.6,0.95], [false,false,false], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, true, 'setup check: occupancy evidence present');
  assert.strictEqual(c.zones.outer.withinZoneLengthIrregular, true, 'setup check: length evidence present');
  assert.strictEqual(c.zones.outer.visibleIrregularArea, true);
});

test('N20. Low confidence in either evidence family -> UNKNOWN, not asserted', () => {
  // outer: occupancy evidence present, but too few candidates to say anything about length
  const cands = [];
  for (let i=0;i<5;i++) cands.push(candAt(0.05+i*0.03, 0.95*20));
  for (let i=0;i<5;i++) cands.push(candAt(0.40+i*0.03, 0.95*20));
  cands.push(candAt(0.80, 0.5*20)); // only 1 candidate in outer -- below both MIN_SHORT_SUPPORT and MIN_WITHIN_ZONE_SUPPORT
  const c = computeNaturalLashCondition(aggOf(cands), [0.35,0.35,0.03], [0.8,0.8,0.8], [0.6,0.6,0.5], [false,false,true], 20, 0.9);
  assert.strictEqual(c.zones.outer.locallyReducedOccupancy, true, 'setup check: occupancy evidence present');
  assert.strictEqual(c.zones.outer.withinZoneLengthIrregular, null, 'setup check: length evidence unknown (insufficient support)');
  assert.strictEqual(c.zones.outer.visibleIrregularArea, null);
});

console.log('=== NLS-2: L/R condition comparison ===');

test('N21. Equivalent condition -> no meaningful difference', () => {
  const steps = 30, q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const mk = () => fakeAgg(Array.from({length:24},(_,i)=>({t:i/23, direction:0, lengthPx: 20})));
  const left = computeLashObservations(mk(), steps, 20, 'high', q);
  const right = computeLashObservations(mk(), steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.strictEqual(cmp.conditionComparison.occupancyUniformityDiff, 0);
  assert.strictEqual(cmp.conditionComparison.lengthUniformityDiff, 0);
  assert.deepStrictEqual(cmp.conditionComparison.reducedOccupancyDiff, []);
  assert.deepStrictEqual(cmp.conditionComparison.irregularAreaDiff, []);
});

test('N22. Meaningful confident difference -> comparison flag', () => {
  const steps = 30, q = {sharpness:150,widthFrac:0.13,roiWidth:150,roiHeight:150};
  // left: even occupancy across zones. right: strongly uneven (concentrated in center only).
  const leftAgg = fakeAgg(Array.from({length:24},(_,i)=>({t:i/23, direction:0, lengthPx:20})));
  const rightAgg = fakeAgg(Array.from({length:16},(_,i)=>({t: 0.4+ (i/15)*0.2, direction:0, lengthPx:20}))); // all packed into center
  const left = computeLashObservations(leftAgg, steps, 20, 'high', q);
  const right = computeLashObservations(rightAgg, steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.notStrictEqual(cmp.conditionComparison.occupancyUniformityDiff, null, 'both sides must be confident enough to compare');
  assert.notStrictEqual(cmp.conditionComparison.occupancyUniformityDiff, 0, 'a genuinely large uniformity difference must be reported');
});

test('N23. Tiny/noisy difference -> ignored (categorical diff stays 0)', () => {
  const steps = 30, q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  // SAME candidate count and t-positions on both sides, only a tiny
  // per-candidate jitter (+-0.01 in t) -- isolates genuine "scan noise"
  // from "meaningfully different candidate distribution", which a
  // differing total count (as an earlier version of this test used)
  // can accidentally produce even from two comparably-even scans.
  let seed = 7;
  const rnd = () => { seed = (seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  const baseT = Array.from({length:24},(_,i)=>i/23);
  const leftCands = baseT.map(t => ({ t: clamp01Local(t), direction: 0, lengthPx: 20 }));
  const rightCands = baseT.map(t => ({ t: clamp01Local(t + (rnd()-0.5)*0.02), direction: 0, lengthPx: 20 }));
  function clamp01Local(x){ return Math.max(0, Math.min(1, x)); }
  const left = computeLashObservations(fakeAgg(leftCands), steps, 20, 'high', q);
  const right = computeLashObservations(fakeAgg(rightCands), steps, 20, 'high', q);
  const cmp = compareNaturalLashes(left, right);
  assert.strictEqual(cmp.conditionComparison.occupancyUniformityDiff, 0, 'two comparably-even scans differing only by small per-candidate jitter must not report a spurious uniformity difference');
});

console.log('=== NLS-2: Safety vocabulary / public contract ===');

test('N24. Public condition contract contains no health/damage/load/count/mm claims', () => {
  const steps = 30, q = {sharpness:150,widthFrac:0.12,roiWidth:120,roiHeight:120};
  const obs = computeLashObservations(fakeAgg(buildShortConcentrationAgg()), steps, 20, 'medium', q);
  const forbidden = /health|damag|broken|weak|strong|hydrat|brittle|overprocess|follicle|anagen|catagen|telogen|growth.?phase|safe.?load|safe.?fan|safe.?weight|\bmm\b|millimet/i;
  const seen = new Set();
  (function walk(obj, pathStr) {
    if (obj === null || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const p = pathStr + '.' + k;
      assert.ok(!forbidden.test(k), `field name looks unsupported/biological: ${p}`);
      if (typeof v === 'string') assert.ok(!forbidden.test(v), `string value looks unsupported/biological at ${p}: "${v}"`);
      if (typeof v === 'object' && v !== null && !seen.has(v)) { seen.add(v); walk(v, p); }
    }
  })(obs, 'obs');
  // also explicitly confirm no exact/estimated count field anywhere at top level or in condition
  assert.ok(!('countLow' in obs) && !('countHigh' in obs));
  assert.ok(!('countLow' in obs.condition) && !('countHigh' in obs.condition));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
