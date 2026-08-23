// ============================================================
// NATURAL LASH SCAN — CORE MEASUREMENT MODULE (NLS-1)
// ------------------------------------------------------------
// Pure, DOM/canvas/React-independent detection + aggregation +
// observation logic for Natural Lash Scan. Extracted out of index.html
// specifically so it can be loaded two ways with ZERO duplication:
//   1. as a plain global <script> in index.html (no build step —
//      matches the project's existing architecture exactly, same as
//      the face-api/React CDN <script> tags already there);
//   2. via require() from tests/lash-scan-core.test.js (Node).
// Every helper below (clamp01/dist/stdOf) is a LOCAL copy of the
// equivalent global already defined in index.html — intentionally
// duplicated (they are trivial, stable one-liners) so this module has
// zero dependency on index.html's global scope and can be required in
// Node in total isolation. Do NOT import index.html's globals here.
//
// Eye Geometry / Generative Geometry Engine code is NOT part of this
// module and was not touched by NLS-1.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function stdOf(arr) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    return { mean: m, std: Math.sqrt(v) };
  }

  const LASH_ZONE_NAMES = ['inner', 'center', 'outer'];

  // ------------------------------------------------------------
  // ARC-LENGTH REPARAMETERIZATION (NLS-1 fix)
  // ------------------------------------------------------------
  // The lash line is 4 landmark-derived points (p0..p3). The OLD
  // curvePointAt(pts, t) split t into 3 EQUAL-t segments regardless of
  // each segment's real pixel length — so INNER/CENTER/OUTER (thirds
  // of t) were NOT thirds of the actual lash-line length whenever the
  // 4 landmark points aren't evenly spaced (the common case). Fix:
  // walk the real cumulative distance instead of the index.
  function lashLineSegmentLengths(pts) {
    const lens = [];
    for (let i = 0; i < pts.length - 1; i++) lens.push(dist(pts[i], pts[i + 1]));
    return lens;
  }

  // s=0 -> pts[0] exactly. s=1 -> pts[last] exactly. Continuous,
  // defensive against degenerate (near-zero-length) segments or a
  // fully collapsed curve (total length ~0) — falls back to plain
  // index interpolation rather than dividing by zero or returning NaN.
  function lashLineArcLengthPointAt(pts, s) {
    const sc = clamp01(s);
    if (pts.length < 2) return pts[0] ? { x: pts[0].x, y: pts[0].y } : { x: 0, y: 0 };
    const segLens = lashLineSegmentLengths(pts);
    const total = segLens.reduce((a, b) => a + b, 0);
    if (total < 1e-6) {
      // Degenerate geometry (all points coincide): fall back to
      // index-uniform interpolation so callers never see NaN/Infinity.
      const seg = sc * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(seg));
      const f = seg - i;
      const a = pts[i], b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    const target = sc * total;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      const segLen = segLens[i];
      const isLast = i === segLens.length - 1;
      if (target <= acc + segLen || isLast) {
        const f = segLen < 1e-6 ? 0 : clamp01((target - acc) / segLen);
        const a = pts[i], b = pts[i + 1];
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
      acc += segLen;
    }
    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y };
  }

  // ------------------------------------------------------------
  // Candidate detection — Stage 1.1 baseline/NMS logic, UNCHANGED,
  // with the arc-length fix applied at its 2 sampling call sites
  // (previously curvePointAt(lashLinePts, i/(steps-1))). Because the
  // stored `t` on each candidate is still literally i/(steps-1), and
  // that index fraction is now genuinely arc-length-uniform (since the
  // point lookup itself is arc-length-aware), every downstream zone
  // computation that reads candidate.t is correct with NO further
  // change required — zoneOf(t) below did not need to change at all.
  // ------------------------------------------------------------
  function detectVisibleLashCandidates(roi, lashLinePts) {
    const { w, h } = roi;
    const eyeH = Math.max(6, h * 0.55);
    let gray;
    try {
      const data = roi.ctx.getImageData(0, 0, w, h).data;
      gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) { const o = i * 4; gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; }
    } catch (e) { return { candidates: [], steps: 0 }; }
    const at = (x, y) => {
      const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
      const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
      return gray[yi * w + xi];
    };
    const steps = Math.max(24, Math.min(72, Math.round(w * 0.6)));
    const bandLen = Math.max(5, Math.round(h * 0.22));
    const REF_GAP = 2;
    const refBandLen = Math.max(4, Math.round(h * 0.15));
    const profile = new Float32Array(steps), localRef = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const p = lashLineArcLengthPointAt(lashLinePts, i / (steps - 1));
      let minV = 255;
      for (let dy = 1; dy <= bandLen; dy++) { const v = at(p.x, p.y - dy); if (v < minV) minV = v; }
      profile[i] = minV;
      let refSum = 0, refN = 0;
      for (let dy = bandLen + REF_GAP; dy < bandLen + REF_GAP + refBandLen; dy++) { refSum += at(p.x, p.y - dy); refN++; }
      localRef[i] = refN ? refSum / refN : 255;
    }
    const baseline = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      let s = 0, n = 0;
      for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < steps) { s += localRef[j]; n++; } }
      baseline[i] = n ? s / n : localRef[i];
    }
    const CONTRAST_T = 12;
    const ANGLES = [-25, 0, 25];
    const raw = [];
    for (let i = 1; i < steps - 1; i++) {
      const isLocalMin = profile[i] <= profile[i - 1] && profile[i] <= profile[i + 1];
      const contrast = baseline[i] - profile[i];
      if (!isLocalMin || contrast <= CONTRAST_T) continue;
      const p = lashLineArcLengthPointAt(lashLinePts, i / (steps - 1));
      let best = { angle: 0, darkness: -Infinity, length: 0 };
      for (const deg of ANGLES) {
        const rad = deg * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
        let sum = 0, cnt = 0, extent = 0;
        const maxRay = Math.round(eyeH * 0.6);
        for (let s = 1; s <= maxRay; s++) {
          const v = at(p.x + dx * s, p.y + dy * s);
          if (s <= bandLen) { sum += (255 - v); cnt++; }
          if (baseline[i] - v > CONTRAST_T * 0.5) extent = s;
        }
        const darkness = cnt ? sum / cnt : -Infinity;
        if (darkness > best.darkness) best = { angle: deg, darkness, length: extent };
      }
      raw.push({ t: i / (steps - 1), contrast, direction: best.angle, lengthPx: best.length, x: p.x, y: p.y });
    }
    const MIN_LASH_PX = 2;
    const kept = [];
    for (const c of raw) {
      const last = kept[kept.length - 1];
      if (last && Math.hypot(c.x - last.x, c.y - last.y) < MIN_LASH_PX) {
        if (c.contrast > last.contrast) kept[kept.length - 1] = c;
        continue;
      }
      kept.push(c);
    }
    const candidates = kept.map(c => ({ t: c.t, contrast: c.contrast, direction: c.direction, lengthPx: c.lengthPx }));
    return { candidates, steps, eyeH };
  }

  // Temporal stabilization — Stage 1.1, unchanged.
  function aggregateLashFrames(frameSets) {
    if (frameSets.length === 0) return { stable: [], framesUsed: 0, perFrameCounts: [] };
    const TOL = 0.025;
    const MIN_SUPPORT_FRAC = 0.35;
    const OLD_SUPPORT_FRAC = 0.6;
    const INCLUDE_SCORE = 0.55;
    const all = [];
    frameSets.forEach(f => f.candidates.forEach(c => all.push(c)));
    all.sort((a, b) => a.t - b.t);
    const clusters = [];
    for (const c of all) {
      let cl = clusters.find(cl => Math.abs(cl.center - c.t) < TOL);
      if (!cl) { cl = { center: c.t, members: [] }; clusters.push(cl); }
      cl.members.push(c);
      cl.center = cl.members.reduce((a, m) => a + m.t, 0) / cl.members.length;
    }
    const stepsHint = (frameSets[0] && frameSets[0].steps) || 40;
    const CLUSTER_MERGE_TOL = 1.4 / (stepsHint - 1);
    clusters.sort((a, b) => a.center - b.center);
    const merged = [];
    for (const cl of clusters) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(cl.center - last.center) < CLUSTER_MERGE_TOL) {
        const lastC = last.members.reduce((a, m) => a + m.contrast, 0) / last.members.length;
        const clC = cl.members.reduce((a, m) => a + m.contrast, 0) / cl.members.length;
        if (cl.members.length > last.members.length || (cl.members.length === last.members.length && clC > lastC)) merged[merged.length - 1] = cl;
        continue;
      }
      merged.push(cl);
    }
    const stable = merged.filter(cl => {
      const supportRatio = cl.members.length / frameSets.length;
      if (supportRatio < MIN_SUPPORT_FRAC) return false;
      if (supportRatio >= OLD_SUPPORT_FRAC) return true;
      const contrasts = cl.members.map(m => m.contrast);
      const cStats = stdOf(contrasts);
      const contrastStability = clamp01(1 - cStats.std / Math.max(cStats.mean, 1e-6));
      return (0.6 * supportRatio + 0.4 * contrastStability) >= INCLUDE_SCORE;
    }).map(cl => ({
      t: cl.center, support: cl.members.length,
      direction: cl.members.reduce((a, m) => a + m.direction, 0) / cl.members.length,
      lengthPx: cl.members.reduce((a, m) => a + m.lengthPx, 0) / cl.members.length,
    }));
    return { stable, framesUsed: frameSets.length, perFrameCounts: frameSets.map(f => f.candidates.length) };
  }

  // Same "no fake 100%" geometric-mean pattern as computeConfidence()
  // (Eye Geometry) — unchanged from Stage 1.
  function computeLashConfidence(factors) {
    const f = {
      support: clamp01(factors.support ?? 0.5),
      imageQuality: clamp01(factors.imageQuality ?? 0.5),
      distance: clamp01(factors.distance ?? 0.5),
      resolution: clamp01(factors.resolution ?? 0.5),
      consistency: clamp01(factors.consistency ?? 0.5),
    };
    const rescaled = Object.values(f).map(v => 0.35 + v * 0.65);
    const score = clamp01(rescaled.reduce((a, b) => a * b, 1) ** (1 / rescaled.length));
    return { score, factors: f };
  }

  // ------------------------------------------------------------
  // computeLashObservations — NLS-1 changes vs Stage 1.1:
  //   1. zoneOf(t) unchanged in FORMULA, but the `t` it receives is
  //      now genuinely arc-length-uniform (fixed upstream) — so
  //      INNER/CENTER/OUTER are now real thirds of lash-line length.
  //   2. occupancy/density semantics made explicit: `occupancyLevel`
  //      is the new canonical name for the bucketed label;
  //      `visualDensity`/`zoneDensity` are KEPT as compatibility
  //      aliases (identical values) because LashEyeCard already reads
  //      them by these names — never treat them as an independent
  //      measurement from occupancy, they are the same number.
  //   3. per-zone `occupancy` (raw ratio) and `visibleLengthRatio`
  //      (raw ratio, was computed and discarded before) are now
  //      actually exposed, not just bucketed away.
  //   4. `zoneConfidence` + confidence-gated `sparseArea` tri-state
  //      (true/false/null) added — `gaps` kept as a legacy boolean
  //      that conservatively collapses null -> false (never claims a
  //      gap it isn't confident about, but also never claims "not
  //      sparse" with unwarranted confidence at the raw boolean level
  //      — callers who need the honest tri-state must read
  //      `zones[name].sparseArea`, not the legacy `gaps` boolean).
  //   5. Follow-up product-safety fix: countLow/countHigh (the
  //      candidate-cluster count RANGE) are no longer part of the
  //      top-level, master-facing observation object at all — the
  //      audit concluded stable candidate clusters are not a
  //      defensible individual-lash estimate, and keeping a count-
  //      range on the public contract risked a future UI silently
  //      re-exposing it. They now live ONLY under `diagnostics`
  //      (candidateClusterCountLow/High), alongside the raw cluster
  //      count. `compareNaturalLashes` (internal use only) reads them
  //      from there. occupancy/occupancyLevel remain the sole master-
  //      facing representation of the visible lash base.
  // ------------------------------------------------------------
  // ============================================================
  // NLS-2 — NATURAL LASH CONDITION
  // ------------------------------------------------------------
  // Describes observable DISTRIBUTION of the visible lash base —
  // never biological health, damage, growth-phase, or strength.
  // Every constant below is labeled EMPIRICAL (a conservative
  // starting hypothesis awaiting real-capture calibration),
  // INHERITED (reused from an already-established NLS-1 constant),
  // or DERIVED (follows mathematically, not chosen by hand). Every
  // axis returns UNKNOWN/null rather than a confident answer when
  // support is insufficient — false and unknown are never conflated
  // (Kleene tri-state logic throughout, see triAnd/triOr below).
  //
  // Short-lash concentration (`shortLashConcentration`) approach
  // decision (requirement 7's inner-zone trap): of the three
  // candidate methods —
  //   A. global same-eye median/MAD reference
  //   B. zone-relative baseline (compare a zone only to itself)
  //   C. expected positional trend along arc length
  // — C needs real calibration data we don't have (would be an
  // invented model, exactly what's forbidden). B is close to
  // self-referential for small per-zone candidate counts (a
  // distribution is always ~half below its own median) and doesn't
  // answer "is this zone short" at all. We use A (whole-eye median/
  // MAD), but deliberately conservative: the cutoff is 1.5 MAD below
  // the whole-eye median (not just "below median"), AND a strong
  // majority (>=60%) of the zone's own candidates must individually
  // clear that extreme line, AND a minimum candidate-support floor
  // applies. This is still A, not a special-cased "ignore inner"
  // rule — the conservatism is in the extremity of the bar, verified
  // by an explicit test (see tests/lash-scan-core.test.js) that a
  // mildly-shorter-but-normal inner zone does NOT trigger it. This
  // remains an EMPIRICAL choice pending real-capture validation of
  // whether it is conservative enough or too conservative.
  // ============================================================
  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const n = s.length;
    if (n === 0) return null;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function madOf(arr, med) {
    const m = med != null ? med : median(arr);
    if (m == null) return null;
    return median(arr.map(v => Math.abs(v - m)));
  }
  // Kleene tri-state logic: false is absorbing (false AND/OR-ed with
  // anything, including unknown, stays decisively false/whatever OR
  // needs); unknown only propagates when it can't be overridden by a
  // decisive value on the other side.
  function triAnd(a, b) {
    if (a === false || b === false) return false;
    if (a === true && b === true) return true;
    return null;
  }
  function triOr(a, b) {
    if (a === true || b === true) return true;
    if (a === false && b === false) return false;
    return null;
  }

  const OCC_UNIFORMITY_EVEN = 0.10; // EMPIRICAL
  const OCC_UNIFORMITY_MILD = 0.20; // EMPIRICAL
  const LEN_UNIFORMITY_EVEN = 0.12; // EMPIRICAL (visibleLengthRatio units)
  const LEN_UNIFORMITY_MILD = 0.22; // EMPIRICAL
  const LOCAL_REDUCTION_DEAD_ZONE_BASE = 0.12; // EMPIRICAL
  const MIN_SHORT_SUPPORT = 4;          // EMPIRICAL — min candidates in a zone to assess short concentration at all
  const SHORT_MAD_Z = 1.5;              // EMPIRICAL — MAD-based cutoff (see decision note above)
  // EMPIRICAL, and load-bearing for the inner-zone trap (requirement
  // 7): a pure whole-eye MAD z-score is NOT enough on its own — when
  // both the "short" and "normal" sub-populations are individually
  // tight (low internal variance), a genuinely mild, natural ~20-25%
  // inner-zone shortening can sit >1.5 MAD away from the median even
  // though it isn't an unusual concentration at all (verified by an
  // explicit test). shortThreshold below therefore requires BOTH the
  // MAD-based cutoff AND a real, substantial relative drop from the
  // whole-eye median — whichever is STRICTER (lower) wins.
  const MIN_SHORT_RELATIVE_DROP = 0.40; // EMPIRICAL — candidate must be >=40% below the whole-eye median, not just a statistical outlier
  const SHORT_FRACTION_THRESHOLD = 0.6; // EMPIRICAL — fraction of a zone's own candidates that must clear the cutoff
  const WITHIN_ZONE_CV_THRESHOLD = 0.35; // EMPIRICAL — coefficient-of-variation cutoff for within-zone length irregularity
  const MIN_WITHIN_ZONE_SUPPORT = 4;    // EMPIRICAL — min candidates to assess within-zone dispersion

  const MIN_ZONE_SAMPLES = 6; // below this many sampled positions in a zone, zone-level reads are not trusted at all (sampleAdequacy -> 0)
  const GAP_OCCUPANCY = 0.10;
  // computeLashConfidence's floor-then-multiply design means its
  // score can MATHEMATICALLY NEVER go below 0.35 (every factor floors
  // at 0.35 before multiplying, so the geometric mean of all-floored
  // factors is exactly 0.35 in the worst case) — a gate set AT 0.35
  // would therefore never fire from poor scan quality alone, only
  // from low sampleAdequacy. Set comfortably above that unreachable
  // floor so a genuinely poor (but not sample-starved) scan can also
  // suppress a sparse-area claim, per "prefer conservative confidence".
  const MIN_SPARSE_CONFIDENCE = 0.45;
  // INHERITED — reuses the exact same "is this zone-level read
  // trustworthy at all" bar established for sparseArea in NLS-1,
  // rather than introducing a second, near-duplicate confidence floor.
  const MIN_ZONE_CONFIDENCE_FOR_CONDITION = MIN_SPARSE_CONFIDENCE;

  // ------------------------------------------------------------
  // computeNaturalLashCondition — pure, independently testable. Takes
  // exactly the already-computed per-zone arrays computeLashObservations
  // builds (nothing recomputed, nothing new measured) plus the raw
  // stable-candidate list for candidate-level (within-zone) signals.
  // ------------------------------------------------------------
  function computeNaturalLashCondition(agg, zoneOccupancy, zoneConfidence, zoneRelLenRaw, sparseAreaTri, eyeH, consistency) {
    const zoneOf = (t) => t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
    const zoneCandidates = [[], [], []];
    agg.stable.forEach(c => { zoneCandidates[zoneOf(c.t)].push(c); });

    const validZone = (i) => zoneConfidence[i] >= MIN_ZONE_CONFIDENCE_FOR_CONDITION;
    const validIdx = [0, 1, 2].filter(validZone);

    // ---- A. Occupancy Uniformity (same-eye, confidence-gated zones only) ----
    let occupancyUniformity;
    if (validIdx.length < 2) {
      occupancyUniformity = { level: 'UNKNOWN', spread: null, confidence: 0 };
    } else {
      const vals = validIdx.map(i => zoneOccupancy[i]);
      const spread = Math.max(...vals) - Math.min(...vals);
      const level = spread < OCC_UNIFORMITY_EVEN ? 'EVEN' : spread < OCC_UNIFORMITY_MILD ? 'MILDLY_UNEVEN' : 'UNEVEN';
      const confidence = clamp01((validIdx.length / 3) * (validIdx.reduce((a, i) => a + zoneConfidence[i], 0) / validIdx.length));
      occupancyUniformity = { level, spread: +spread.toFixed(4), confidence };
    }

    // ---- B. Visible Length Uniformity (zone-to-zone, whole-eye, DESCRIPTIVE not diagnostic — see module doc) ----
    const lenValidIdx = validIdx.filter(i => zoneRelLenRaw[i] !== null);
    let visibleLengthUniformity;
    if (lenValidIdx.length < 2) {
      visibleLengthUniformity = { level: 'UNKNOWN', dispersion: null, confidence: 0 };
    } else {
      const vals = lenValidIdx.map(i => zoneRelLenRaw[i]);
      const dispersion = Math.max(...vals) - Math.min(...vals);
      const level = dispersion < LEN_UNIFORMITY_EVEN ? 'EVEN' : dispersion < LEN_UNIFORMITY_MILD ? 'MILDLY_UNEVEN' : 'UNEVEN';
      const confidence = clamp01((lenValidIdx.length / 3) * (lenValidIdx.reduce((a, i) => a + zoneConfidence[i], 0) / lenValidIdx.length));
      visibleLengthUniformity = { level, dispersion: +dispersion.toFixed(4), confidence };
    }

    // ---- whole-eye robust reference distribution for short-lash concentration (see decision note above) ----
    const allLens = agg.stable.map(c => c.lengthPx / eyeH);
    const globalMedian = median(allLens);
    const globalMad = madOf(allLens, globalMedian);
    const madScaled = globalMad != null ? globalMad * 1.4826 : null; // DERIVED — standard MAD->std-equivalent scale factor
    const madBasedThreshold = (madScaled != null && madScaled > 1e-6) ? globalMedian - SHORT_MAD_Z * madScaled : null;
    const relativeDropThreshold = globalMedian != null ? globalMedian * (1 - MIN_SHORT_RELATIVE_DROP) : null;
    // STRICTER (lower) of the two wins — see MIN_SHORT_RELATIVE_DROP comment above for why the MAD bar alone is insufficient.
    const shortThreshold = (madBasedThreshold != null && relativeDropThreshold != null)
      ? Math.min(madBasedThreshold, relativeDropThreshold)
      : null;

    const zones = {};
    LASH_ZONE_NAMES.forEach((name, i) => {
      const zc = zoneConfidence[i];
      const isValid = validZone(i);
      const cands = zoneCandidates[i];

      // ---- C. Local Thinning / Reduced Occupancy — relative to the SAME-EYE baseline (mean of the OTHER valid zones), never an absolute floor. This is why a globally-but-evenly-sparse eye does not trigger it (see test). ----
      let locallyReducedOccupancy = null, relativeOccupancyReduction = null;
      if (isValid) {
        const otherIdx = validIdx.filter(j => j !== i);
        if (otherIdx.length > 0) {
          const baseline = otherIdx.reduce((a, j) => a + zoneOccupancy[j], 0) / otherIdx.length;
          relativeOccupancyReduction = +(baseline - zoneOccupancy[i]).toFixed(4);
          // dead zone widens when frame-to-frame consistency was poor — same noise-accounting principle as NLS-1's L/R occDeadZone.
          const deadZone = LOCAL_REDUCTION_DEAD_ZONE_BASE + (1 - clamp01(consistency ?? 0.5)) * 0.08;
          const localReductionConfidence = clamp01(zc * clamp01(otherIdx.length / 2));
          locallyReducedOccupancy = localReductionConfidence >= MIN_ZONE_CONFIDENCE_FOR_CONDITION
            ? relativeOccupancyReduction >= deadZone
            : null;
        }
      }

      // ---- D. Relative Short-Lash Concentration ----
      let shortLashConcentration = null, shortCandidateFraction = null, shortConcentrationConfidence = 0;
      if (shortThreshold != null && isValid) {
        shortConcentrationConfidence = clamp01(zc * clamp01(cands.length / (MIN_SHORT_SUPPORT * 2)));
        if (cands.length >= MIN_SHORT_SUPPORT) {
          const shortCount = cands.filter(c => (c.lengthPx / eyeH) < shortThreshold).length;
          shortCandidateFraction = +(shortCount / cands.length).toFixed(3);
          shortLashConcentration = shortConcentrationConfidence >= MIN_ZONE_CONFIDENCE_FOR_CONDITION
            ? shortCandidateFraction >= SHORT_FRACTION_THRESHOLD
            : null;
        }
      }

      // ---- within-zone length irregularity (candidate-level dispersion INSIDE this zone — distinct from B's zone-to-zone comparison, requirement 4) ----
      let withinZoneLengthIrregular = null;
      if (isValid && cands.length >= MIN_WITHIN_ZONE_SUPPORT) {
        const lens = cands.map(c => c.lengthPx / eyeH);
        const m = lens.reduce((a, b) => a + b, 0) / lens.length;
        const sd = Math.sqrt(lens.reduce((a, b) => a + (b - m) ** 2, 0) / lens.length);
        const cv = m > 1e-6 ? sd / m : null;
        withinZoneLengthIrregular = cv != null ? cv >= WITHIN_ZONE_CV_THRESHOLD : null;
      }

      // ---- E. Visible Irregular Area — evidence-group composite (requirement 8). sparseArea and
      // locallyReducedOccupancy are RELATED, not independent evidence — both belong to the SAME
      // "occupancy evidence" family (triOr, not two separate votes). Same for the two length signals.
      // Requires BOTH families independently true; a single family, however strong, is NOT enough.
      const occupancyEvidence = triOr(sparseAreaTri[i], locallyReducedOccupancy);
      const lengthEvidence = triOr(withinZoneLengthIrregular, shortLashConcentration);
      const visibleIrregularArea = triAnd(occupancyEvidence, lengthEvidence);
      const irregularAreaConfidence = Math.min(zc, shortConcentrationConfidence || zc);

      zones[name] = {
        locallyReducedOccupancy, relativeOccupancyReduction,
        shortLashConcentration, shortCandidateFraction,
        withinZoneLengthIrregular,
        visibleIrregularArea,
        confidence: zc,
        shortConcentrationConfidence,
        irregularAreaConfidence: visibleIrregularArea === null ? irregularAreaConfidence : zc,
      };
    });

    return { occupancyUniformity, visibleLengthUniformity, zones };
  }

  function computeLashObservations(agg, steps, eyeH, qualityLevel, quality) {
    const n = agg.stable.length;
    if (steps === 0 || n === 0) {
      return { hasData: false, framesUsed: agg.framesUsed };
    }
    const occupancy = n / steps;
    const occupancyLevel = occupancy > 0.38 ? 'high' : occupancy > 0.20 ? 'medium' : 'low';
    const visualDensity = occupancyLevel; // compatibility alias — SAME value as occupancyLevel, not an independent measurement
    const spreadFrac = qualityLevel === 'high' ? 0.12 : qualityLevel === 'medium' ? 0.22 : 0.35;
    const countLow = Math.max(0, Math.round(n * (1 - spreadFrac)));
    const countHigh = Math.round(n * (1 + spreadFrac));

    // t is now arc-length-normalized (fixed upstream in
    // detectVisibleLashCandidates) — this formula is unchanged, but
    // its correctness now depends on that upstream guarantee.
    const zoneOf = (t) => t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
    const zoneCounts = [0, 0, 0], zoneDirSum = [0, 0, 0], zoneLenSum = [0, 0, 0];
    agg.stable.forEach(c => { const z = zoneOf(c.t); zoneCounts[z]++; zoneDirSum[z] += c.direction; zoneLenSum[z] += c.lengthPx; });

    const zoneStepCounts = [0, 0, 0];
    for (let i = 0; i < steps; i++) { zoneStepCounts[zoneOf(steps > 1 ? i / (steps - 1) : 0)]++; }
    const zoneOccupancy = zoneCounts.map((cnt, i) => zoneStepCounts[i] > 0 ? cnt / zoneStepCounts[i] : 0);
    const zoneOccupancyLevel = zoneOccupancy.map(occ => occ > 0.38 ? 'high' : occ > 0.20 ? 'medium' : 'low');
    const zoneDensity = zoneOccupancyLevel; // compatibility alias, read directly by LashEyeCard — same values, not independent

    const zoneDirection = zoneCounts.map((cnt, i) => {
      if (cnt === 0) return 'unknown';
      const avg = zoneDirSum[i] / cnt;
      return avg < -8 ? 'upward' : avg > 8 ? 'downward' : 'straight';
    });
    const zoneRelLenRaw = zoneCounts.map((cnt, i) => cnt === 0 ? null : (zoneLenSum[i] / cnt) / eyeH);
    const zoneRelLen = zoneRelLenRaw.map(v => v === null ? 'unknown' : v > 0.85 ? 'long' : v > 0.55 ? 'medium' : 'short');
    const overallLenBucket = (() => {
      const vals = zoneRelLen.filter(v => v !== 'unknown');
      if (vals.length === 0) return 'unknown';
      const uniq = new Set(vals);
      return uniq.size > 1 ? 'mixed' : vals[0];
    })();

    const dirValues = zoneDirection.filter(d => d !== 'unknown');
    const dominantDirection = dirValues.length === 0 ? 'unknown' : (new Set(dirValues).size > 1 ? 'mixed' : dirValues[0]);

    const avgSupportRatio = agg.stable.reduce((a, c) => a + c.support / Math.max(agg.framesUsed, 1), 0) / n;
    const frameCounts = agg.perFrameCounts && agg.perFrameCounts.length ? agg.perFrameCounts : [n];
    const frameStats = stdOf(frameCounts);
    const consistency = clamp01(1 - frameStats.std / Math.max(frameStats.mean, 1));
    const roiMinDim = quality ? Math.min(quality.roiWidth || 0, quality.roiHeight || 0) : 0;
    const conf = computeLashConfidence({
      support: avgSupportRatio,
      imageQuality: quality ? clamp01(quality.sharpness / 150) : 0.5,
      distance: quality ? clamp01((quality.widthFrac - 0.08) / (0.12 - 0.08)) : 0.5,
      resolution: clamp01((roiMinDim - 60) / 60),
      consistency,
    });

    // Per-zone confidence: the SAME overall-confidence factors
    // (nothing invented) multiplicatively dampened by how many of the
    // sampled positions actually fell in that zone — a zone sampled
    // with too few points is never trusted regardless of how good the
    // overall scan was. Deliberately conservative, not a calibrated
    // probability.
    const zoneConfidence = zoneStepCounts.map(cnt => {
      const sampleAdequacy = clamp01(cnt / MIN_ZONE_SAMPLES);
      return clamp01(conf.score * sampleAdequacy);
    });

    // Sparse-area is now a tri-state: true (confidently sparse),
    // false (confidently not sparse), or null (not enough confidence
    // to assert either way — NEVER silently reported as "not sparse").
    const sparseAreaTri = zoneOccupancy.map((occ, i) => {
      // `!(x >= threshold)` rather than `x < threshold`: a NaN
      // confidence (malformed/edge-case input) must fail SAFE into
      // "unknown", not silently fail OPEN into a confident boolean —
      // `NaN < threshold` is false in JS, which would otherwise let a
      // broken confidence value slip past this gate undetected.
      if (!(zoneConfidence[i] >= MIN_SPARSE_CONFIDENCE)) return null;
      return occ < GAP_OCCUPANCY;
    });
    const gapZones = sparseAreaTri.map((v, i) => v === true ? i : null).filter(v => v !== null);

    const zones = {};
    LASH_ZONE_NAMES.forEach((name, i) => {
      zones[name] = {
        // raw
        occupancy: zoneOccupancy[i],
        visibleLengthRatio: zoneRelLenRaw[i],
        confidence: zoneConfidence[i],
        // categorical
        occupancyLevel: zoneOccupancyLevel[i],
        visibleLengthLevel: zoneRelLen[i],
        // tri-state sparse flag + legacy boolean alias
        sparseArea: sparseAreaTri[i],
        gaps: sparseAreaTri[i] === true, // legacy boolean — collapses null (unknown) to false, never overclaims
        // hint-only, never an automatic decision input (see module doc)
        direction: zoneDirection[i],
        // internal diagnostic only — NOT an individual lash count
        estimatedCount: zoneCounts[i],
        // legacy alias, identical value to occupancyLevel — kept for LashEyeCard compatibility
        density: zoneDensity[i],
      };
    });

    return {
      hasData: true, framesUsed: agg.framesUsed,
      // NOTE: no countLow/countHigh (or any count-range field) at this
      // level on purpose — see the comment above computeLashObservations.
      // Candidate-cluster count range lives ONLY under `diagnostics`.
      visualDensity, occupancy, occupancyLevel,
      zoneDensity, zoneOccupancy, zoneOccupancyLevel, zoneConfidence,
      zoneDirection, zoneRelLen, overallLenBucket, gapZones,
      dominantDirection,
      confidence: conf.score, confidenceFactors: conf.factors,
      zones,
      // NLS-2 — Natural Lash Condition: observable distribution only,
      // never a biological health/damage claim. See module doc above
      // computeNaturalLashCondition for the full contract and the
      // short-lash-concentration approach decision.
      condition: computeNaturalLashCondition(agg, zoneOccupancy, zoneConfidence, zoneRelLenRaw, sparseAreaTri, eyeH, consistency),
      // Internal-only diagnostics — never render as a product measurement.
      diagnostics: { candidateClusterCount: n, candidateClusterCountLow: countLow, candidateClusterCountHigh: countHigh, stepsUsed: steps },
    };
  }

  // ------------------------------------------------------------
  // compareNaturalLashes — NLS-1 adds a consistency-gated dead zone
  // for raw occupancy comparison (`occupancyDiff`), alongside the
  // existing bucketed-rank comparison (`densityDiff`/`notableZone`,
  // unchanged — that comparison already had an implicit dead zone,
  // since it only reacts to a full high/medium/low bucket difference).
  // ------------------------------------------------------------
  const OCC_DEAD_ZONE_BASE = 0.05;
  const MIN_COMPARE_CONFIDENCE = 0.5; // EMPIRICAL — bar for trusting a condition axis enough to compare across eyes at all
  // EMPIRICAL — a categorical level (EVEN/MILDLY_UNEVEN/UNEVEN) can
  // still flip across its own boundary from a genuinely tiny
  // underlying difference (verified by an explicit test: two nearly
  // identical scans landed on opposite sides of the EVEN/MILDLY_UNEVEN
  // line). The categorical rank alone is therefore NOT sufficient
  // noise-gating on its own — also require the raw metric itself to
  // differ by more than this dead zone before trusting a rank diff.
  const UNIFORMITY_RAW_DEAD_ZONE = 0.06;
  // Hoisted to module scope (from inside compareNaturalLashes) only so
  // the NLS2 validation build can display real runtime threshold
  // values instead of a hand-copied duplicate. Same constants, same
  // values, same call site below — no behavior change.

  function compareNaturalLashes(left, right) {
    if (!left?.hasData || !right?.hasData) return { hasComparison: false };
    // countDiff is an internal diagnostic value only (never rendered)
    // — reads from diagnostics.* now that countLow/countHigh are no
    // longer part of the top-level observation object.
    const countDiff = ((left.diagnostics.candidateClusterCountLow + left.diagnostics.candidateClusterCountHigh) / 2)
      - ((right.diagnostics.candidateClusterCountLow + right.diagnostics.candidateClusterCountHigh) / 2);
    const densityRank = { low: 0, medium: 1, high: 2 };
    const densityDiff = densityRank[left.visualDensity] - densityRank[right.visualDensity];
    const zoneDiffs = LASH_ZONE_NAMES.map((_, i) => densityRank[left.zoneDensity[i]] - densityRank[right.zoneDensity[i]]);
    const maxDiffIdx = zoneDiffs.reduce((best, d, i) => Math.abs(d) > Math.abs(zoneDiffs[best]) ? i : best, 0);
    const gapDiff = LASH_ZONE_NAMES.map((name, i) => {
      const l = left.gapZones.includes(i), r = right.gapZones.includes(i);
      return l !== r ? { zone: name, side: l ? 'left' : 'right' } : null;
    }).filter(Boolean);

    // Consistency-gated raw-occupancy dead zone: widens when either
    // eye's scan was less frame-to-frame consistent (uses the SAME
    // consistency factor already computed and exposed via
    // confidenceFactors — nothing new measured).
    const consistencyFloor = Math.min(
      left.confidenceFactors?.consistency ?? 0.5,
      right.confidenceFactors?.consistency ?? 0.5
    );
    const occDeadZone = OCC_DEAD_ZONE_BASE + (1 - consistencyFloor) * 0.10;
    const rawOccDiff = left.occupancy - right.occupancy;
    const occupancyDiff = Math.abs(rawOccDiff) >= occDeadZone ? rawOccDiff : 0;

    // ---- NLS-2: condition L/R comparison — confidence-gated, only
    // structural (categorical/boolean) diffs, never raw noisy numbers.
    // A pair is compared only when BOTH sides clear a real confidence
    // bar for that specific axis — never one confident side vs one
    // guessed side.
    const uniformityRank = { EVEN: 0, MILDLY_UNEVEN: 1, UNEVEN: 2 };
    const rankedLevelDiff = (l, r, rawField) => {
      if (l.level === 'UNKNOWN' || r.level === 'UNKNOWN') return null;
      if (l.confidence < MIN_COMPARE_CONFIDENCE || r.confidence < MIN_COMPARE_CONFIDENCE) return null;
      if (Math.abs(l[rawField] - r[rawField]) < UNIFORMITY_RAW_DEAD_ZONE) return 0;
      const d = uniformityRank[l.level] - uniformityRank[r.level];
      return d === 0 ? 0 : d;
    };
    const occupancyUniformityDiff = rankedLevelDiff(left.condition.occupancyUniformity, right.condition.occupancyUniformity, 'spread');
    const lengthUniformityDiff = rankedLevelDiff(left.condition.visibleLengthUniformity, right.condition.visibleLengthUniformity, 'dispersion');

    // Structural per-zone diffs: only counted when BOTH sides made a
    // confident (non-null) call for that zone — a null (unknown) on
    // either side means "not enough support to compare", not "no
    // difference" and not "a difference".
    const structuralZoneDiff = (field) => LASH_ZONE_NAMES.map((name, i) => {
      const l = left.condition.zones[name][field], r = right.condition.zones[name][field];
      if (l === null || r === null) return null;
      return l !== r ? { zone: name, side: l ? 'left' : 'right' } : null;
    }).filter(v => v !== null);
    const reducedOccupancyDiff = structuralZoneDiff('locallyReducedOccupancy');
    const irregularAreaDiff = structuralZoneDiff('visibleIrregularArea');

    return {
      hasComparison: true,
      countDiff, densityDiff,
      occupancyDiff, occupancyDeadZone: occDeadZone,
      notableZone: Math.abs(zoneDiffs[maxDiffIdx]) >= 1 ? maxDiffIdx : null,
      notableZoneLowerSide: zoneDiffs[maxDiffIdx] < 0 ? 'left' : 'right',
      gapDiff,
      // NLS-2 — condition comparison. null on any field = insufficient
      // confident support on at least one side to compare that axis,
      // NOT "no difference".
      conditionComparison: {
        occupancyUniformityDiff, lengthUniformityDiff,
        reducedOccupancyDiff, irregularAreaDiff,
      },
    };
  }

  return {
    LASH_ZONE_NAMES,
    lashLineSegmentLengths,
    lashLineArcLengthPointAt,
    detectVisibleLashCandidates,
    aggregateLashFrames,
    computeLashConfidence,
    computeLashObservations,
    compareNaturalLashes,
    // NLS-2 — exported for direct, isolated axis testing (does not
    // require building a full ROI/pixel pipeline for every test).
    computeNaturalLashCondition,
    triAnd, triOr, median, madOf,
    // NLS2 VALIDATION DIAGNOSTIC — read-only snapshot of the actual
    // runtime threshold constants, for the debug-only "current
    // empirical thresholds" panel. Not used by any measurement code
    // path itself; purely a display convenience so the panel can never
    // drift out of sync with the real values above.
    NLS2_THRESHOLDS: {
      OCC_UNIFORMITY_EVEN, OCC_UNIFORMITY_MILD,
      LEN_UNIFORMITY_EVEN, LEN_UNIFORMITY_MILD,
      LOCAL_REDUCTION_DEAD_ZONE_BASE,
      SHORT_MAD_Z, MIN_SHORT_RELATIVE_DROP, SHORT_FRACTION_THRESHOLD, MIN_SHORT_SUPPORT,
      WITHIN_ZONE_CV_THRESHOLD, MIN_WITHIN_ZONE_SUPPORT,
      MIN_ZONE_CONFIDENCE_FOR_CONDITION, MIN_SPARSE_CONFIDENCE,
      OCC_DEAD_ZONE_BASE, MIN_COMPARE_CONFIDENCE, UNIFORMITY_RAW_DEAD_ZONE,
    },
  };
});
