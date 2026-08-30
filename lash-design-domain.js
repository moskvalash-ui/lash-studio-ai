// ============================================================
// CLIENT LASH DESIGN DOMAIN — Phase 1 additive foundation.
// ------------------------------------------------------------
// This module wraps an already-computed legacy design result. It does
// not score, personalize, choose a peak, calculate millimeters, or
// make safety decisions. Production consumers continue to use the
// legacy result during Phase 1; this canonical representation exists
// only for parity validation and future adapters.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LashDesignDomain = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CLIENT_LASH_DESIGN_VERSION = 2;
  const ZONE_NAMES = ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER'];
  const UNAVAILABLE_NATURAL_LASH_EVIDENCE = [
    'NATURAL_LENGTH_MM',
    'NATURAL_DIAMETER',
    'STRENGTH',
    'LOAD_CAPACITY',
    'SAFE_FAN_WEIGHT',
    'GROWTH_PHASE',
  ];

  // Compatibility metadata only. Ordering deliberately matches the
  // current DESIGN_CATALOG and must not be used to reorder it.
  const LEGACY_TAXONOMY = [
    ['natural', 'naturalContour', 'classicOneToOne', 'smooth', 'KEEP'],
    ['naturalRounded', 'roundedNatural', 'classicOneToOne', 'smooth', 'KEEP'],
    ['naturalElongated', 'elongatedNatural', 'classicOneToOne', 'smooth', 'KEEP'],
    ['angel', 'legacyAngel', 'lightVolume2D', 'angelAiry', 'RECLASSIFY'],
    ['doll', 'centralOpen', 'volume3D', 'smooth', 'KEEP'],
    ['rounded', 'centralRounded', 'lightVolume2D', 'smooth', 'KEEP'],
    ['squirrel', 'outerLift', 'lightVolume2D', 'smooth', 'KEEP'],
    ['kitten', 'compactOuterLift', 'lightVolume2D', 'smooth', 'KEEP'],
    ['cat', 'catElongation', 'lightVolume2D', 'smooth', 'KEEP'],
    ['softcat', 'softCatElongation', 'lightVolume2D', 'smooth', 'KEEP'],
    ['fox', 'foxElongation', 'lightVolume2D', 'smooth', 'KEEP'],
    ['softfox', 'softFoxElongation', 'lightVolume2D', 'smooth', 'KEEP'],
    ['eyeliner', 'legacyEyeliner', 'volume3D', 'rootDefinition', 'RECLASSIFY'],
    ['wispy', 'legacyWispy', 'lightVolume2D', 'wispy', 'LEGACY_PRESET'],
    ['wispycat', 'legacyWispyCat', 'lightVolume2D', 'wispy', 'LEGACY_PRESET'],
    ['wispydoll', 'legacyWispyDoll', 'volume3D', 'wispy', 'LEGACY_PRESET'],
    ['kim', 'legacyKim', 'volume3D', 'kimK', 'RECLASSIFY'],
    ['manga', 'legacyManga', 'volume3D', 'animeManga', 'RECLASSIFY'],
    ['wet', 'legacyWet', 'wetSetTechnique', 'wet', 'RECLASSIFY'],
    ['reverse', 'reverseBalance', 'lightVolume2D', 'smooth', 'KEEP'],
    ['correction', 'asymmetryCorrectionBase', 'classicOneToOne', 'smooth', 'LEGACY_PRESET'],
  ].map(([legacyId, geometryId, techniqueId, textureRecipeId, migrationAction]) => ({
    legacyId, geometryId, techniqueId, textureRecipeId, migrationAction,
  }));

  const LEGACY_TAXONOMY_BY_ID = Object.fromEntries(LEGACY_TAXONOMY.map(item => [item.legacyId, item]));

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
    }
    return value;
  }

  function inferredField(value, confidence, unit) {
    return {
      value: value ?? null,
      confidence: Number.isFinite(confidence) ? confidence : null,
      provenance: 'INFERRED_FROM_IMAGE',
      ...(unit ? { unit } : {}),
    };
  }

  function naturalEyeEvidence(observation) {
    if (!observation || observation.hasData !== true) {
      return { availability: 'UNAVAILABLE', quality: { overallConfidence: null, factors: {} } };
    }
    const zones = observation.zones || {};
    const publicZones = Object.fromEntries(Object.entries(zones).map(([name, zone]) => [name, {
      visibleOccupancy: inferredField(zone.occupancyLevel ?? zone.density, zone.confidence),
      relativeVisibleLength: inferredField(zone.visibleLengthLevel, zone.confidence, 'RELATIVE_TO_EYE_GEOMETRY'),
      directionHint: inferredField(zone.direction, zone.confidence),
      sparseArea: {
        value: zone.sparseArea ?? null,
        confidence: Number.isFinite(zone.confidence) ? zone.confidence : null,
        provenance: 'INFERRED_FROM_IMAGE',
      },
    }]));
    return {
      availability: 'AVAILABLE',
      visibleOccupancy: inferredField(observation.visualDensity ?? observation.occupancyLevel, observation.confidence),
      relativeVisibleLength: inferredField(observation.overallLenBucket, observation.confidence, 'RELATIVE_TO_EYE_GEOMETRY'),
      directionHint: inferredField(observation.dominantDirection, observation.confidence),
      distribution: {
        gapZones: cloneValue(observation.gapZones || []),
        condition: cloneValue(observation.condition || null),
        provenance: 'INFERRED_FROM_IMAGE',
      },
      zones: publicZones,
      quality: {
        framesUsed: observation.framesUsed ?? null,
        overallConfidence: Number.isFinite(observation.confidence) ? observation.confidence : null,
        factors: cloneValue(observation.confidenceFactors || {}),
      },
    };
  }

  function buildNaturalLashEvidence(profile) {
    const hasAny = !!(profile && (profile.left?.hasData || profile.right?.hasData));
    return {
      availability: hasAny ? 'PARTIAL' : 'UNAVAILABLE',
      eyes: {
        left: naturalEyeEvidence(profile?.left),
        right: naturalEyeEvidence(profile?.right),
      },
      comparison: profile?.comparison?.hasComparison ? {
        availability: 'AVAILABLE',
        occupancyDifference: profile.comparison.occupancyDiff ?? null,
        conditionDifferences: cloneValue(profile.comparison.conditionComparison || {}),
        provenance: 'INFERRED_FROM_IMAGE',
      } : { availability: 'INSUFFICIENT_EVIDENCE' },
      unavailable: [...UNAVAILABLE_NATURAL_LASH_EVIDENCE],
    };
  }

  function legacyToClientLashDesign(options) {
    const input = options || {};
    const design = input.design;
    const catalogEntry = input.catalogEntry;
    const expandSectors = input.expandSectors;
    if (!design || !catalogEntry || typeof expandSectors !== 'function') {
      throw new TypeError('design, catalogEntry, and expandSectors are required');
    }
    if (design.id !== catalogEntry.id) throw new TypeError('legacy design and catalog entry IDs must match');
    const taxonomy = LEGACY_TAXONOMY_BY_ID[design.id];
    if (!taxonomy) throw new TypeError(`unsupported legacy design ID: ${design.id}`);

    const curve = cloneValue(design.curve || {
      zonePositions: catalogEntry.zonePositions || null,
      postPeakShape: catalogEntry.postPeakShape || 'linear',
      plateauShape: catalogEntry.plateauShape || 'linear',
    });
    const leftMm = cloneValue(design.leftZones);
    const rightMm = cloneValue(design.rightZones);
    const leftSectors = cloneValue(expandSectors(leftMm, design.leftPeakZone, curve));
    const rightSectors = cloneValue(expandSectors(rightMm, design.rightPeakZone, curve));
    const textureDescriptor = cloneValue(design.texture ?? null);

    return {
      version: CLIENT_LASH_DESIGN_VERSION,
      presetId: design.id,
      legacyDesignId: design.id,
      taxonomy: cloneValue(taxonomy),
      display: {
        name: design.name,
        ruName: design.ruName,
        enName: design.enName,
        category: design.category,
        aliases: cloneValue(design.aliases || []),
      },
      mapping: {
        geometryId: taxonomy.geometryId,
        legacyGeometryId: design.id,
        sourceZoneNames: [...ZONE_NAMES],
        template: {
          baseZones: cloneValue(catalogEntry.baseZones),
          peakZone: catalogEntry.peakZone,
          topology: curve,
        },
        physicalEyes: {
          left: {
            side: 'left', sourceZones: cloneValue(leftMm), finalMm: leftMm,
            peakZone: design.leftPeakZone, derivedSectors: leftSectors,
          },
          right: {
            side: 'right', sourceZones: cloneValue(rightMm), finalMm: rightMm,
            peakZone: design.rightPeakZone, derivedSectors: rightSectors,
          },
        },
      },
      application: {
        techniqueId: taxonomy.techniqueId,
        legacyLabel: design.defaultTechnique,
      },
      texture: {
        recipeId: taxonomy.textureRecipeId,
        legacyDescriptor: textureDescriptor,
        primitives: [],
      },
      direction: {
        strategyId: null,
        status: 'UNSPECIFIED',
        legacyIntent: design.correctionGoal ?? null,
      },
      curl: {
        global: design.curlRec?.primary ?? design.baseCurl ?? null,
        byZone: null,
        transitions: [],
        alternatives: cloneValue(design.curlRec?.alternatives || []),
        reason: design.curlRec?.reason ?? null,
        source: 'LEGACY_RECOMMENDATION',
      },
      volume: {
        intent: null,
        densitySetting: null,
        fanConstruction: null,
        verificationStatus: 'ARTIST_VERIFICATION_REQUIRED',
      },
      personalization: {
        method: 'LEGACY_CALCULATE_EYE_LASH_MAP',
        left: { peakZone: design.leftPeakZone, correctionMm: design.leftCorrectionMm ?? 0 },
        right: { peakZone: design.rightPeakZone, correctionMm: design.rightCorrectionMm ?? 0 },
        manualPhotoAdjustment: null,
      },
      evidence: {
        measured: {},
        inferred: {},
        manuallyConfirmed: input.eyeProfile?.artistConfirmed ? { eyeProfile: true } : {},
        applicationPlanProfile: {
          compositeAsymmetry: input.eyeProfile?.compositeAsymmetry,
          isHooded: input.eyeProfile?.isHooded,
          isCloseSet: input.eyeProfile?.isCloseSet,
          isWideSet: input.eyeProfile?.isWideSet,
          tiltTendency: input.eyeProfile?.tiltTendency,
          provenance: 'LEGACY_CLIENT_PROFILE',
        },
        naturalLashes: buildNaturalLashEvidence(input.naturalLashProfile || null),
        unavailable: [...UNAVAILABLE_NATURAL_LASH_EVIDENCE],
      },
      presentation: {
        photo: { manualAdjustment: null },
        diagram: {},
        localizedText: {
          whyItWorks: design.whyItWorks ?? null,
          correctionGoal: design.correctionGoal ?? null,
          limitations: cloneValue(design.limitations || []),
        },
      },
      recommendation: {
        score: design.score,
        rank: input.rank ?? null,
      },
      verification: {
        status: 'ARTIST_VERIFICATION_REQUIRED',
        automatedSafetyClaim: false,
        missingEvidence: [...UNAVAILABLE_NATURAL_LASH_EVIDENCE],
      },
    };
  }

  // Phase 2A: create an immutable canonical view of the CURRENT Lash
  // Map editor selections for the Application Plan only. This copies
  // existing runtime values verbatim; it does not derive or validate
  // zones, curl, technique, texture, or spike geometry.
  function withApplicationPlanRuntime(clientDesign, runtime) {
    if (!clientDesign || clientDesign.version !== CLIENT_LASH_DESIGN_VERSION) {
      throw new TypeError('ClientLashDesign v2 is required');
    }
    const input = runtime || {};
    const result = cloneValue(clientDesign);
    result.mapping.applicationPlan = {
      activeSide: input.activeSide,
      active: { finalMm: cloneValue(input.zones) },
      other: { finalMm: cloneValue(input.otherZones) },
      topology: cloneValue(input.curve),
    };
    result.application.selectedTechnique = input.technique;
    result.curl.selected = input.curl;
    result.texture.runtimeDescriptor = cloneValue(input.textureDescriptor ?? null);
    result.texture.spikeGeometry = cloneValue(input.spikeGeometry ?? null);
    return result;
  }

  return {
    CLIENT_LASH_DESIGN_VERSION,
    ZONE_NAMES,
    UNAVAILABLE_NATURAL_LASH_EVIDENCE,
    LEGACY_TAXONOMY,
    legacyToClientLashDesign,
    buildNaturalLashEvidence,
    withApplicationPlanRuntime,
  };
});
