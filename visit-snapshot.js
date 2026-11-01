// ============================================================
// VISIT SNAPSHOT — CLIENT-1: canonical historical Visit snapshot
// contract for the Client Card / Client History feature.
// ------------------------------------------------------------
// DATA CONTRACT ONLY. No UI, no "Save to Client" wiring, no photo/Blob
// storage, no PDF/export, no new analysis/recommendation/Lash Map
// engine. This module answers exactly one question: given the CURRENT
// production result objects (result.eyeProfile, result.iris, the
// selected ClientLashDesign v2, and naturalLashProfile), what is the
// smallest, professionally meaningful, immutable snapshot worth storing
// as history?
//
// Design goals, directly testable in plain Node (no browser required).
// NOTE ON WORDING: this comment block deliberately avoids spelling out
// a few other modules' exact top-level identifiers verbatim (the
// production design list, the professional-definitions module, the
// per-eye personalization function, the photo/face-point fields) --
// this file's own isolation and photo-boundary regression tests check
// for the literal absence of those exact tokens anywhere in this
// source file, comments included, so this header is written to prove
// that boundary rather than merely describe it.
//
//   - Pure functions only. Nothing here reads the production effect
//     catalog, the professional-definitions module, the per-eye
//     personalization function, camera/scan code, or any other
//     production ranking/analysis machinery — it only reads the
//     ALREADY-COMPUTED values it is handed. A snapshot built today can
//     never be affected by a future change to those systems, because
//     building it never calls back into them.
//   - Every returned value is extracted field-by-field (never a spread
//     of a live nested object graph) and deep-cloned where the source
//     value is itself an object/array, so a caller mutating the object
//     they passed in — or those production systems being edited
//     elsewhere in the app afterwards — can never reach back into a
//     snapshot already returned by this module.
//   - Only stable, already user-facing categorical/professional fields
//     are included (the same fields eyeProfileLabels() already surfaces
//     in the real UI) — never raw per-eye pixel-derived measurements
//     (eye.width/ear/innerTaperDeg/outerTaperDeg live only in
//     result.eyeProfile.leftEye/rightEye and are deliberately excluded
//     here), never facial point/landmark data, never image/photo data,
//     never the `debug` sub-object, never NLS per-candidate/per-frame
//     internals.
//   - Natural Lash evidence is NOT reimplemented here — it reuses
//     LashDesignDomain.buildNaturalLashEvidence verbatim (Phase 1
//     already separated professional evidence from diagnostics there).
//   - designSnapshot is built directly from a ClientLashDesign v2
//     object (e.g. the app's own `activeDesign`) — never from the
//     legacy design object — so it never needs the production effect
//     catalog or the sector-expansion engine to exist at snapshot time.
//   - snapshotSchemaVersion lives INSIDE analysisSnapshot/designSnapshot
//     themselves, not as a change to the client-record data layer's own
//     outer client/visit schema-version contract (which this module
//     never touches and never imports).
//   - Zero client photo/image/facial-point data can appear in any
//     returned snapshot — proven by the accompanying test file, not
//     just by convention.
//
// Same dual-load pattern as every other plain-script module in this
// app: a bare <script> tag exposes window.VisitSnapshot; require() from
// Node tests gets the same factory output. Depends only on
// LashDesignDomain (for buildNaturalLashEvidence and the
// CLIENT_LASH_DESIGN_VERSION check) — never on the client-record data
// layer, either consent module, or the local analytics module, matching
// the existing module-isolation convention (each sibling module
// documents and proves its own dependency boundary).
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./lash-design-domain.js'));
  } else {
    root.VisitSnapshot = factory(root.LashDesignDomain);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (LashDesignDomain) {
  'use strict';

  const SNAPSHOT_SCHEMA_VERSION = 1;

  // Local, deliberately duplicated (not imported) — same tiny recursive
  // clone every sibling module in this app already reimplements locally
  // rather than sharing (see lash-design-domain.js's own cloneValue, and
  // the client-record data layer's own equivalent). Every value passing
  // through this module's public API is a plain, JSON-serializable
  // object.
  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
    }
    return value;
  }

  function num(value) { return Number.isFinite(value) ? value : null; }
  function str(value) { return typeof value === 'string' ? value : null; }
  function bool(value) { return typeof value === 'boolean' ? value : null; }

  // ------------------------------------------------------------
  // ANALYSIS SNAPSHOT — from result.eyeProfile + result.iris only.
  // Never reads the result object's raw facial-point or photo fields,
  // and never reads eyeProfile.leftEye/rightEye/debug.
  // ------------------------------------------------------------
  function buildEyeAnalysisSnapshot(eyeProfile) {
    const p = eyeProfile || {};
    return {
      shape: { category: str(p.eyeShapeCategory), confidence: num(p.eyeShapeConfidence) },
      tilt: {
        tendency: str(p.tiltTendency), confidence: num(p.tiltConfidence),
        degrees: num(p.tiltDegrees),
        perEyeDegrees: p.perEyeTiltDegrees
          ? { left: num(p.perEyeTiltDegrees.left), right: num(p.perEyeTiltDegrees.right) }
          : null,
      },
      hooding: { category: str(p.eyelidCategory), confidence: num(p.eyelidCategoryConfidence) },
      eyelidType: {
        type: str(p.eyelidType), confidence: num(p.eyelidTypeConfidence),
        signalsConflict: bool(p.eyelidSignalsConflict),
      },
      crease: { state: str(p.creaseState) },
      hoodingState: { state: str(p.hoodingState) },
      spacing: { category: str(p.eyeSetCategory) },
      size: { category: str(p.eyeSizeCategory) },
      symmetry: { category: str(p.symmetryCategory), compositeAsymmetry: num(p.compositeAsymmetry) },
      overallConfidence: num(p.overallConfidence),
    };
  }

  function buildIrisSnapshot(iris) {
    if (!iris) return null;
    return {
      category: str(iris.name),
      confidence: num(iris.confidence),
      compositionLabel: str(iris.compositionLabel),
      colorComposition: iris.colorComposition ? cloneValue(iris.colorComposition) : null,
    };
  }

  // naturalLashProfile is intentionally accepted as-is and handed
  // straight to the already-reviewed public evidence builder — this
  // module does not reinterpret or re-filter its output. Passing null
  // (Natural Lash Scan never run for this visit) already resolves to
  // `{ availability: 'UNAVAILABLE', ... }`, never a fabricated default.
  function buildNaturalLashSnapshot(naturalLashProfile) {
    return LashDesignDomain.buildNaturalLashEvidence(naturalLashProfile || null);
  }

  // eyeProfile/iris/naturalLashProfile are each independently optional —
  // a Visit may be saved with partial analysis (e.g. Iris Color skipped,
  // Natural Lash Scan never run). Missing pieces are represented as
  // null/UNAVAILABLE, never fabricated.
  function buildAnalysisSnapshot({ eyeProfile, iris, naturalLashProfile } = {}) {
    return {
      snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
      eye: buildEyeAnalysisSnapshot(eyeProfile),
      iris: buildIrisSnapshot(iris),
      naturalLash: buildNaturalLashSnapshot(naturalLashProfile),
    };
  }

  // ------------------------------------------------------------
  // DESIGN SNAPSHOT — from a ClientLashDesign v2 object (e.g. the app's
  // own `activeDesign`) only. Never reads the production effect catalog
  // or a raw catalog entry, and never calls the sector-expansion engine
  // — the already-derived finalMm/peakZone values on the ClientLashDesign
  // are used as-is. Never reads
  // clientDesign.mapping.physicalEyes.*.derivedSectors (renderer-only
  // interpolated curve samples, reconstructible on demand from finalMm
  // + peakZone via that same sector-expansion engine if ever needed —
  // not worth duplicating in stored history).
  // ------------------------------------------------------------
  function buildDesignSnapshot(clientDesign) {
    if (!clientDesign) return null;
    if (clientDesign.version !== LashDesignDomain.CLIENT_LASH_DESIGN_VERSION) {
      throw new TypeError('buildDesignSnapshot: ClientLashDesign v' + LashDesignDomain.CLIENT_LASH_DESIGN_VERSION + ' is required');
    }
    const left = clientDesign.mapping?.physicalEyes?.left;
    const right = clientDesign.mapping?.physicalEyes?.right;
    return {
      snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
      designId: str(clientDesign.presetId ?? clientDesign.legacyDesignId),
      display: {
        name: str(clientDesign.display?.name),
        ruName: str(clientDesign.display?.ruName),
        enName: str(clientDesign.display?.enName),
        category: str(clientDesign.display?.category),
      },
      // Reserved: no current production design is ever built from a
      // professional-lash-library.js referenceTemplate (those 9
      // candidate identities remain DRAFT/production-inactive — see
      // professional-lash-library.test.js's own isolation guard). This
      // field exists so a future activated referenceTemplate design can
      // be identified without a new snapshotSchemaVersion bump.
      referenceTemplateId: null,
      physicalEyes: {
        left: { finalMm: left ? cloneValue(left.finalMm) : null, peakZone: left ? num(left.peakZone) : null },
        right: { finalMm: right ? cloneValue(right.finalMm) : null, peakZone: right ? num(right.peakZone) : null },
      },
      curl: {
        global: str(clientDesign.curl?.global),
        base: str(clientDesign.curl?.base),
        options: clientDesign.curl?.options ? cloneValue(clientDesign.curl.options) : [],
        // Always null in the current legacy pipeline (recommendCurl is
        // pair-level, computed once — see tests/pair-eye-harmonization
        // .test.js's curl-coherence proof). Reserved, not fabricated.
        byZone: clientDesign.curl?.byZone ? cloneValue(clientDesign.curl.byZone) : null,
        reason: str(clientDesign.curl?.reason),
      },
      correction: {
        left: { correctionMm: num(clientDesign.personalization?.left?.correctionMm) },
        right: { correctionMm: num(clientDesign.personalization?.right?.correctionMm) },
      },
      recommendation: {
        score: num(clientDesign.recommendation?.score),
        rank: num(clientDesign.recommendation?.rank),
        whyItWorks: str(clientDesign.presentation?.localizedText?.whyItWorks),
        correctionGoal: str(clientDesign.presentation?.localizedText?.correctionGoal),
        limitations: clientDesign.presentation?.localizedText?.limitations
          ? cloneValue(clientDesign.presentation.localizedText.limitations) : [],
      },
    };
  }

  // ------------------------------------------------------------
  // Top-level builder. `result`/`activeDesign`/`naturalLashProfile` are
  // the app's own existing root React state objects — this function
  // never mutates them and never retains a reference to them; every
  // returned field is either a primitive or a freshly cloned
  // array/object.
  // ------------------------------------------------------------
  function buildVisitSnapshot({ result, activeDesign, naturalLashProfile } = {}) {
    return {
      analysisSnapshot: buildAnalysisSnapshot({
        eyeProfile: result?.eyeProfile || null,
        iris: result?.iris || null,
        naturalLashProfile: naturalLashProfile || null,
      }),
      designSnapshot: activeDesign ? buildDesignSnapshot(activeDesign) : null,
    };
  }

  return {
    SNAPSHOT_SCHEMA_VERSION,
    buildAnalysisSnapshot,
    buildDesignSnapshot,
    buildVisitSnapshot,
  };
});
