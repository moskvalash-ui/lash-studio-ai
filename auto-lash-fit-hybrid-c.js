// ============================================================
// AUTO LASH FIT — HYBRID MVP C (production). Approved architecture:
// the landmark-derived baseline (buildProfessionalPhotoLine's existing
// eyeWidth*.055 chord-normal offset) remains the anatomical prior/
// topology. Pixel evidence is NEVER allowed to replace it or pick a
// different anatomical structure -- it may only apply a LOCAL,
// monotone-cubic-smoothed, HARD-BOUNDED correction on top of it, never
// exceeding corridorBoundFrac * eyeWidth in either direction. If no
// usable pixel evidence exists inside that corridor, the existing
// landmark baseline is returned completely untouched.
//
// This is a TRIMMED, production-only port of the already-validated
// ROOT-SIGNAL B + corridor-bound pipeline from auto-lash-fit-
// diagnostic.js (this project's own diagnostic/experimentation module,
// never loaded by production). Ported here, not imported, for the same
// self-containment reason every other per-file module in this project
// follows (lash-scan-core.js, client-store.js, etc.) -- zero runtime
// dependency between production and the diagnostic tooling. Every
// constant/formula below is copied byte-for-byte from the validated
// diagnostic source, not re-derived:
//   - corridorBoundFrac = 0.05 -- APPROVED, CLOSED for this MVP (see
//     this project's own 7-value, 2-real-photo sensitivity validation).
//     Not re-tuned here.
//   - the DP continuity/curvature/evidence weights, the local-outlier +
//     triangular-kernel regularization, and the candidate-detection
//     (gradient/prominence/confidence) math are UNCHANGED from the
//     validated diagnostic pipeline.
//   - the diagnostic's eye-opening gate, ROOT-SIGNAL A, and every
//     EXPERIMENTAL (not-yet-validated) threshold are DELIBERATELY NOT
//     included here -- only the single, closed, approved corridor-bound
//     mechanism ships to production.
//
// GEOMETRY NOTE: the search direction here is the chord-normal frame
// (inner->outer perpendicular), matching exactly how the diagnostic's
// own NORMAL/ROOT-SIGNAL B geometry was validated -- NOT production's
// plain vertical (screen-Y) CURRENT offset direction. The resulting
// correction is applied as a 2D vector in that same chord-normal
// direction (see applyHybridCRefinement in index.html), not forced to
// be vertical. For the eyes this was validated against (a few degrees
// of roll), chord-normal and vertical are nearly identical; for a
// significantly tilted eye they would diverge slightly. This is the
// same geometry convention the validated pipeline used throughout, kept
// consistent rather than mixed.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SEARCH_SAMPLE_COUNT = 11;
  const CORRIDOR_HALF_WIDTH_FRACTION = 0.12;
  const PROFILE_SMOOTH_WINDOW_PX = 3;
  const CONFIDENCE_PROMINENCE_SCALE = 20;
  const DARK_BAND_HALF_WINDOW_PX = 6;
  const REGULARIZE_WINDOW = 2;
  const LOCAL_OUTLIER_FRACTION = 0.5;
  const ROOT_SIGNAL_B_MAX_CANDIDATES_PER_RAY = 3;
  const ROOT_SIGNAL_B_CONTINUITY_WEIGHT = 1.5;
  const ROOT_SIGNAL_B_CURVATURE_WEIGHT = 0.75;
  const ROOT_SIGNAL_B_EVIDENCE_WEIGHT = 2;
  const ROOT_SIGNAL_B_FALLBACK_CONFIDENCE = 0.05;
  // APPROVED, CLOSED for this MVP -- see module header comment.
  const CORRIDOR_BOUND_FRAC = 0.05;

  function sampleT(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(i / (n - 1));
    return out;
  }

  function evalCubicBezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  }

  // Chord frame: inner->outer direction and its perpendicular, oriented
  // to point "up" (negative screen-Y) for small roll -- identical to
  // the validated diagnostic's computeChordFrame.
  function computeChordFrame(inner, outer) {
    const vx = outer.x - inner.x, vy = outer.y - inner.y, length = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / length, uy = vy / length;
    let nx = -uy, ny = ux;
    if (ny > 0) { nx = -nx; ny = -ny; }
    return { ux, uy, nx, ny, length };
  }

  function buildGrayFromRoi(roi) {
    if (!(roi && roi.ctx && roi.w && roi.h)) return { gray: null, w: 0, h: 0 };
    const w = roi.w, h = roi.h;
    const data = roi.ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    return { gray, w, h };
  }

  function samplePixelProfile(gray, w, h, origin, axis, halfWidth, stepPx) {
    const profile = [];
    for (let s = -halfWidth; s <= halfWidth; s += stepPx) {
      const x = origin.x + axis.nx * s, y = origin.y + axis.ny * s;
      const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
      const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
      profile.push({ s, v: gray[yi * w + xi] });
    }
    return profile;
  }

  function smoothProfile(profile, windowPx) {
    return profile.map((p, i) => {
      let sum = 0, n = 0;
      for (let k = -windowPx; k <= windowPx; k++) {
        const j = i + k;
        if (j >= 0 && j < profile.length) { sum += profile[j].v; n++; }
      }
      return { s: p.s, v: n ? sum / n : p.v };
    });
  }

  // Multiple local-maximum candidate transitions per ray (not a single
  // whole-corridor blended centroid) -- identical math to the validated
  // diagnostic's findCandidateTransitions.
  function findCandidateTransitions(smoothed, edgeMargin) {
    const margin = Math.max(1, edgeMargin || 1);
    const grads = [], gradPositions = [], gradSigns = [];
    for (let i = 1; i < smoothed.length; i++) {
      if (i < margin || i > smoothed.length - 1 - margin) continue;
      const diff = smoothed[i].v - smoothed[i - 1].v;
      grads.push(Math.abs(diff));
      gradPositions.push((smoothed[i].s + smoothed[i - 1].s) / 2);
      gradSigns.push(diff === 0 ? 0 : diff > 0 ? 1 : -1);
    }
    if (!grads.length) return [];
    const n = grads.length;
    const localMaxIdx = [];
    for (let i = 0; i < n; i++) {
      const leftOk = i === 0 || grads[i] >= grads[i - 1];
      const rightOk = i === n - 1 || grads[i] >= grads[i + 1];
      if (leftOk && rightOk && grads[i] > 0) localMaxIdx.push(i);
    }
    return localMaxIdx.map(peakIdx => {
      const lo = Math.max(0, peakIdx - 1), hi = Math.min(n - 1, peakIdx + 1);
      let wSum = 0, pSum = 0;
      for (let i = lo; i <= hi; i++) { wSum += grads[i]; pSum += grads[i] * gradPositions[i]; }
      const position = wSum > 1e-9 ? pSum / wSum : gradPositions[peakIdx];
      let minLeft = Infinity; for (let i = 0; i <= peakIdx; i++) minLeft = Math.min(minLeft, grads[i]);
      let minRight = Infinity; for (let i = peakIdx; i < n; i++) minRight = Math.min(minRight, grads[i]);
      const prominence = grads[peakIdx] - Math.max(minLeft, minRight);
      const confidence = Math.max(0, Math.min(1, prominence / CONFIDENCE_PROMINENCE_SCALE));
      return { position, confidence, sign: gradSigns[peakIdx] };
    }).sort((a, b) => b.confidence - a.confidence);
  }

  function computeMultiCandidateSamples(roi, controlPoints, frame, eyeWidth) {
    const corridorHalfWidth = Math.max(2, eyeWidth * CORRIDOR_HALF_WIDTH_FRACTION);
    const { gray, w, h } = buildGrayFromRoi(roi);
    const searchTs = sampleT(SEARCH_SAMPLE_COUNT);
    const rays = searchTs.map(t => {
      const origin = evalCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], t);
      if (!gray) return { t, origin, frame, candidates: [] };
      const profile = samplePixelProfile(gray, w, h, origin, frame, corridorHalfWidth, 1);
      const smoothed = smoothProfile(profile, PROFILE_SMOOTH_WINDOW_PX);
      const candidates = findCandidateTransitions(smoothed, PROFILE_SMOOTH_WINDOW_PX + 1);
      return { t, origin, frame, candidates };
    });
    return { rays, corridorHalfWidth };
  }

  // Unconditional hard cap: a candidate farther than corridorBoundFrac *
  // eyeWidth from the landmark baseline is never eligible for the path,
  // regardless of confidence or whether a "better" alternative exists.
  function gateCandidatesByCorridorBound(rays, eyeWidth) {
    const bound = CORRIDOR_BOUND_FRAC * eyeWidth;
    return rays.map(ray => {
      if (!ray.candidates || !ray.candidates.length) return ray;
      const kept = ray.candidates.filter(c => Math.abs(c.position) <= bound);
      if (kept.length === ray.candidates.length) return ray;
      return { ...ray, candidates: kept };
    });
  }

  // Small deterministic DP / shortest-path solver choosing one coherent
  // sequence across all rays -- identical math to the validated
  // diagnostic's selectCoherentPath (diagnostic-only cost-breakdown
  // fields omitted; not needed in production).
  function selectCoherentPath(rays, corridorHalfWidth) {
    const maxK = ROOT_SIGNAL_B_MAX_CANDIDATES_PER_RAY;
    const continuityWeight = ROOT_SIGNAL_B_CONTINUITY_WEIGHT;
    const curvatureWeight = ROOT_SIGNAL_B_CURVATURE_WEIGHT;
    const evidenceWeight = ROOT_SIGNAL_B_EVIDENCE_WEIGHT;
    const fallbackConfidence = ROOT_SIGNAL_B_FALLBACK_CONFIDENCE;

    const rayOptions = rays.map(ray => {
      const top = ray.candidates.slice(0, maxK).map(c => ({ position: c.position, confidence: c.confidence, isFallback: false }));
      top.push({ position: 0, confidence: fallbackConfidence, isFallback: true });
      return top;
    });

    const n = rays.length;
    const dp = new Array(n);
    dp[0] = rayOptions[0].map(c => ({ cost: -evidenceWeight * c.confidence, backK: -1 }));
    for (let i = 1; i < n; i++) {
      dp[i] = rayOptions[i].map(c => {
        let best = Infinity, bestK = 0;
        for (let kp = 0; kp < rayOptions[i - 1].length; kp++) {
          const prevPos = rayOptions[i - 1][kp].position;
          let cost = dp[i - 1][kp].cost + continuityWeight * Math.abs(c.position - prevPos) / corridorHalfWidth;
          if (i >= 2) {
            const prevBackK = dp[i - 1][kp].backK;
            if (prevBackK >= 0) {
              const prevPrevPos = rayOptions[i - 2][prevBackK].position;
              const curvature = (c.position - prevPos) - (prevPos - prevPrevPos);
              cost += curvatureWeight * Math.abs(curvature) / corridorHalfWidth;
            }
          }
          if (cost < best) { best = cost; bestK = kp; }
        }
        return { cost: best - evidenceWeight * c.confidence, backK: bestK };
      });
    }
    let bestFinalK = 0, bestFinalCost = Infinity;
    for (let k = 0; k < dp[n - 1].length; k++) if (dp[n - 1][k].cost < bestFinalCost) { bestFinalCost = dp[n - 1][k].cost; bestFinalK = k; }
    const chosenK = new Array(n);
    chosenK[n - 1] = bestFinalK;
    for (let i = n - 1; i > 0; i--) chosenK[i - 1] = dp[i][chosenK[i]].backK;

    return rays.map((ray, i) => {
      const chosen = rayOptions[i][chosenK[i]];
      if (chosen.isFallback) return { t: ray.t, offset: 0, confidence: chosen.confidence };
      return { t: ray.t, offset: chosen.position, confidence: chosen.confidence };
    });
  }

  // Local outlier rejection + confidence-weighted triangular-kernel
  // smoothing of the displacement field -- identical math to the
  // validated diagnostic's regularizeDisplacementField.
  function regularizeDisplacementField(rawSamples, corridorHalfWidth) {
    const window = REGULARIZE_WINDOW;
    const localOutlierThreshold = corridorHalfWidth * LOCAL_OUTLIER_FRACTION;
    const n = rawSamples.length;

    const afterLocalRejection = rawSamples.map(s => ({ ...s }));
    for (let i = 0; i < n; i++) {
      if (afterLocalRejection[i].offset === 0) continue;
      const neighborOffsets = [];
      for (let k = Math.max(0, i - window); k <= Math.min(n - 1, i + window); k++) {
        if (k !== i && afterLocalRejection[k].offset !== 0) neighborOffsets.push(afterLocalRejection[k].offset);
      }
      if (!neighborOffsets.length) continue;
      const sorted = neighborOffsets.slice().sort((a, b) => a - b);
      const localMedian = sorted[Math.floor(sorted.length / 2)];
      if (Math.abs(afterLocalRejection[i].offset - localMedian) > localOutlierThreshold) {
        afterLocalRejection[i] = { ...afterLocalRejection[i], offset: 0 };
      }
    }

    return afterLocalRejection.map((s, i) => {
      let weightSum = 0, valueSum = 0;
      for (let k = Math.max(0, i - window); k <= Math.min(n - 1, i + window); k++) {
        const dist = Math.abs(i - k);
        const kernel = 1 - dist / (window + 1);
        const weight = kernel * Math.max(0, afterLocalRejection[k].confidence);
        weightSum += weight;
        valueSum += weight * afterLocalRejection[k].offset;
      }
      const offset = weightSum > 1e-6 ? valueSum / weightSum : 0;
      return { t: s.t, offset, confidence: s.confidence };
    });
  }

  // ------------------------------------------------------------
  // Public entry point. `roi` must be shaped exactly like the project's
  // existing mockRoi/extractEyeROI pattern:
  //   { w, h, ctx: { getImageData(x,y,ww,hh){ return {data:Uint8ClampedArray} } } }
  // `upper` = the SAME 4 physical-eye control points buildProfessionalPhotoLine
  // uses ([eye[0],eye[1],eye[2],eye[3]]), in the SAME coordinate space as
  // `roi` (caller's responsibility to shift by roi.x0/roi.y0 first).
  // Returns { samples: [{t,offset}, ...11], frame, corridorBoundPx,
  // usedPixelEvidence }. When no usable pixel evidence exists at all
  // (no roi, or every sample falls back), every offset is exactly 0 and
  // usedPixelEvidence is false -- the caller should then leave the
  // existing landmark baseline completely untouched.
  // ------------------------------------------------------------
  function computeHybridCDisplacementSamples(roi, upper, eyeWidth) {
    const frame = computeChordFrame(upper[0], upper[3]);
    const baselineOffset = Math.max(1, eyeWidth * 0.055);
    const controlPoints = upper.map(p => ({ x: p.x + frame.nx * baselineOffset, y: p.y + frame.ny * baselineOffset }));

    const multi = computeMultiCandidateSamples(roi, controlPoints, frame, eyeWidth);
    const gated = gateCandidatesByCorridorBound(multi.rays, eyeWidth);
    const path = selectCoherentPath(gated, multi.corridorHalfWidth);
    const regularized = regularizeDisplacementField(path, multi.corridorHalfWidth);

    const bound = CORRIDOR_BOUND_FRAC * eyeWidth;
    // Defensive, redundant clamp -- the math above already guarantees
    // this by construction, but production correctness of "never exceeds
    // the corridor" is asserted explicitly here too, not only trusted
    // upstream.
    const samples = regularized.map(s => ({ t: s.t, offset: Math.max(-bound, Math.min(bound, s.offset)) }));
    const usedPixelEvidence = samples.some(s => s.offset !== 0);

    return { samples, frame, corridorBoundPx: bound, usedPixelEvidence };
  }

  return {
    CORRIDOR_BOUND_FRAC,
    computeChordFrame,
    computeHybridCDisplacementSamples,
    // exported for focused unit testing only -- not part of the
    // production call surface used by index.html:
    gateCandidatesByCorridorBound,
    selectCoherentPath,
    regularizeDisplacementField,
    findCandidateTransitions,
    computeMultiCandidateSamples,
  };
});
