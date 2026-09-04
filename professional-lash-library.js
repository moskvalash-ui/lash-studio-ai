// ============================================================
// PROFESSIONAL LASH LIBRARY — Phase 1A infrastructure only.
// ------------------------------------------------------------
// This module is deliberately production-inactive. It contains schema
// capacity and canonical identities, not validated professional rules.
// Legacy behavior remains owned by the existing production pipeline.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ProfessionalLashLibrary = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const LIBRARY_VERSION = 1;
  const SCHEMA_VERSION = 1;
  const VALIDATION_STATES = Object.freeze([
    'UNVALIDATED',
    'DRAFT',
    'EXPERT_REVIEWED',
    'VALIDATED',
    'SCHOOL_DEPENDENT',
  ]);
  const REGISTRY_NAMES = Object.freeze([
    'geometries',
    'techniques',
    'constructionRecipes',
    'directionStrategies',
    'curlStrategies',
    'fanConstructions',
    'presets',
  ]);

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
    }
    return value;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  const emptyValidation = status => ({
    status,
    evidence: [],
    provenance: [],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: [],
  });

  const identity = (id, displayName, kind, options = {}) => ({
    id,
    displayName,
    kind,
    validation: emptyValidation(options.status || 'UNVALIDATED'),
    professionalDefinition: null,
    compatibility: { compatibleIds: [], incompatibleIds: [], conditions: [] },
    variants: [],
    school: options.school || null,
    unresolved: options.unresolved === true,
    aliases: [],
    legacyReference: {
      legacyIds: options.legacyIds || [],
      legacyAliases: options.legacyAliases || [],
      relationship: options.legacyRelationship || 'NONE',
      normalizedGeometry: null,
      templateMm: null,
      scoreCoefficients: null,
      spikeDeltas: null,
      textureFrequencies: null,
      curlLiftStrength: null,
      techniqueDiameters: null,
    },
    // Deliberately NOT defaulted here (unlike legacyReference above): most
    // existing identities never carry one, and giving every identity an
    // explicit `referenceTemplate: null` would change the JSON shape (and
    // therefore the whole-definition byte-identity hash guards) of every
    // untouched pre-existing definition in this file for no functional
    // reason. Only the specific identities that actually need one (see
    // schema.referenceTemplate below) get it assigned after construction,
    // exactly like legacyReference is already overridden ad hoc per
    // definition elsewhere in this file.
  });

  // Phase 1B reviewed structure only. The supplied review establishes the
  // identity and qualitative topology, but provides no reviewed numeric
  // peak range or millimeter template. Those fields stay explicitly
  // unresolved; current production numbers live only in legacyReference.
  const squirrelDefinition = identity('geometry.squirrel', 'Squirrel', 'MAPPING_GEOMETRY', {
    status: 'EXPERT_REVIEWED', legacyIds: ['squirrel'],
  });
  squirrelDefinition.professionalDefinition = {
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE',
      numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_PRE_OUTER_MAXIMUM' },
        { region: 'BODY', relationship: 'BUILDS_TOWARD_PRE_OUTER_MAXIMUM' },
        { region: 'PRE_OUTER', relationship: 'MAXIMUM_REGION' },
        { region: 'OUTER', relationship: 'CONTROLLED_DECREASE_FROM_MAXIMUM' },
      ],
    },
    peak: {
      positionRange: {
        unit: 'NORMALIZED_LASH_LINE', min: null, max: null,
        region: 'PRE_OUTER', resolution: 'NUMERIC_RANGE_UNRESOLVED',
      },
      zoneRange: { regions: ['PRE_OUTER'], resolution: 'QUALITATIVE_REGION_ONLY' },
      plateauAllowed: { value: null, resolution: 'UNRESOLVED' },
    },
    topology: {
      rise: 'BUILDS_TOWARD_PRE_OUTER_MAXIMUM',
      shoulder: 'UNRESOLVED',
      postPeak: 'CONTROLLED_DECREASE',
      outerBehavior: 'LOWER_THAN_PRE_OUTER_MAXIMUM',
    },
    primaryIntent: 'OUTER_LIFT',
    crossEffectComparison: {
      'geometry.cat': {
        squirrelPeakRegion: 'PRE_OUTER', squirrelOuterBehavior: 'CONTROLLED_DECREASE', squirrelIntent: 'OUTER_LIFT',
        otherDefinitionStatus: 'UNRESOLVED_PENDING_CAT_PROFESSIONAL_DEFINITION', otherIntentClass: 'ELONGATION',
      },
      'geometry.fox': {
        squirrelPeakRegion: 'PRE_OUTER', squirrelOuterBehavior: 'CONTROLLED_DECREASE', squirrelIntent: 'OUTER_LIFT',
        otherDefinitionStatus: 'UNRESOLVED_PENDING_FOX_PROFESSIONAL_DEFINITION', otherIntentClass: 'ELONGATION',
      },
    },
  };
  squirrelDefinition.templateMm = {
    purpose: 'STARTING_TEMPLATE_ONLY', universal: false, values: null,
    resolution: 'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED',
  };
  squirrelDefinition.compatibility = {
    compatibleTechniqueIds: [], compatibleConstructionRecipeIds: [],
    incompatibleIds: [], conditions: [], resolution: 'UNRESOLVED',
  };
  squirrelDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1b-squirrel-structure', type: 'REVIEWED_PROFESSIONAL_STRUCTURE',
      scope: ['MAPPING_GEOMETRY_IDENTITY', 'PRE_OUTER_MAXIMUM', 'CONTROLLED_OUTER_DECREASE', 'OUTER_LIFT_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1B_APPROVED_PROFESSIONAL_BRIEF', scope: 'STRUCTURAL_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1B_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Numeric peak range, normalized samples, template mm, compatibility, and variants remain unresolved.'],
  };
  squirrelDefinition.legacyReference = {
    legacyIds: ['squirrel'], legacyAliases: ['Soft Squirrel'], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakPosition: 0.62 },
    templateMm: [7, 8, 10, 11, 10],
    topology: { zonePositions: [0, 0.20, 0.46, 0.62, 1], plateauShape: 'shoulder', postPeakShape: 'gradual' },
    scoreCoefficients: null, spikeDeltas: null, textureFrequencies: null,
    curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1C reviewed structure only. The supplied review establishes a
  // central/open-eye topology with a broad maximum or plateau, but does not
  // establish numeric boundaries, millimeter values, curls, or construction
  // rules. Current production numbers remain isolated in legacyReference.
  const dollDefinition = identity('geometry.doll', 'Doll', 'MAPPING_GEOMETRY', {
    status: 'EXPERT_REVIEWED', legacyIds: ['doll'],
  });
  dollDefinition.professionalDefinition = {
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE',
      numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'CONTROLLED_REDUCTION_FROM_CENTRAL_MAXIMUM' },
        { region: 'CENTRAL', relationship: 'BROAD_MAXIMUM_OR_PLATEAU_REGION' },
        { region: 'OUTER', relationship: 'CONTROLLED_REDUCTION_FROM_CENTRAL_MAXIMUM' },
      ],
    },
    peak: {
      positionRange: {
        unit: 'NORMALIZED_LASH_LINE', min: null, max: null,
        region: 'CENTRAL', resolution: 'NUMERIC_RANGE_UNRESOLVED',
      },
      zoneRange: { regions: ['CENTRAL'], resolution: 'QUALITATIVE_REGION_ONLY' },
      plateauAllowed: { value: true, boundaries: null, resolution: 'QUALITATIVE_ONLY' },
    },
    topology: {
      rise: 'CONTROLLED_RISE_TOWARD_CENTRAL_MAXIMUM_OR_PLATEAU',
      shoulder: 'BROAD_CENTRAL_MAXIMUM_OR_PLATEAU_ALLOWED',
      postPeak: 'CONTROLLED_REDUCTION_TOWARD_OUTER',
      outerBehavior: 'LOWER_THAN_CENTRAL_MAXIMUM_OR_PLATEAU',
    },
    primaryIntent: 'OPEN_EYE_CENTRAL_EMPHASIS',
    crossEffectComparison: {
      'geometry.natural': {
        dollEmphasis: 'CENTRAL', dollPlateauIntent: 'OPEN_EYE', dollOuterBehavior: 'CONTROLLED_REDUCTION',
        dollIntentClass: 'OPENING', otherDefinitionStatus: 'UNRESOLVED_PENDING_NATURAL_PROFESSIONAL_DEFINITION',
        otherIntentClass: 'NATURAL_DISTRIBUTION',
      },
      'geometry.squirrel': {
        dollEmphasis: 'CENTRAL', dollPlateauIntent: 'OPEN_EYE', dollOuterBehavior: 'CONTROLLED_REDUCTION',
        dollIntentClass: 'OPENING', otherDefinitionStatus: 'EXPERT_REVIEWED', otherIntentClass: 'OUTER_LIFT',
      },
      'geometry.cat': {
        dollEmphasis: 'CENTRAL', dollPlateauIntent: 'OPEN_EYE', dollOuterBehavior: 'CONTROLLED_REDUCTION',
        dollIntentClass: 'OPENING', otherDefinitionStatus: 'UNRESOLVED_PENDING_CAT_PROFESSIONAL_DEFINITION',
        otherIntentClass: 'ELONGATION',
      },
      'geometry.fox': {
        dollEmphasis: 'CENTRAL', dollPlateauIntent: 'OPEN_EYE', dollOuterBehavior: 'CONTROLLED_REDUCTION',
        dollIntentClass: 'OPENING', otherDefinitionStatus: 'UNRESOLVED_PENDING_FOX_PROFESSIONAL_DEFINITION',
        otherIntentClass: 'ELONGATION',
      },
    },
  };
  dollDefinition.templateMm = {
    purpose: 'STARTING_TEMPLATE_ONLY', universal: false, values: null,
    resolution: 'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED',
  };
  dollDefinition.compatibility = {
    compatibleTechniqueIds: [], compatibleConstructionRecipeIds: [],
    incompatibleIds: [], conditions: [], resolution: 'UNRESOLVED',
  };
  dollDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1c-doll-structure', type: 'REVIEWED_PROFESSIONAL_STRUCTURE',
      scope: ['MAPPING_GEOMETRY_IDENTITY', 'CENTRAL_MAXIMUM_OR_PLATEAU', 'CONTROLLED_INNER_OUTER_REDUCTION', 'OPEN_EYE_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1C_APPROVED_PROFESSIONAL_BRIEF', scope: 'STRUCTURAL_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1C_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Numeric peak and plateau boundaries, normalized samples, template mm, compatibility, and variants remain unresolved.'],
  };
  dollDefinition.legacyReference = {
    legacyIds: ['doll'], legacyAliases: ['Soft Doll', 'Central Peak'], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 2 },
    templateMm: [8, 9, 10, 10, 9],
    topology: { zonePositions: [0, 0.24, 0.46, 0.60, 1], plateauShape: 'shoulder', postPeakShape: 'gradual' },
    scoreCoefficients: null, spikeDeltas: null, textureFrequencies: null,
    curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1D reviewed structure only. The supplied review establishes late
  // outer emphasis and temporal elongation with a controlled outer tail, but
  // provides no reviewed coordinate, millimeter template, drop amount, curl,
  // volume, or direction angle. Production numbers remain legacy-only.
  const foxDefinition = identity('geometry.fox', 'Fox', 'MAPPING_GEOMETRY', {
    status: 'EXPERT_REVIEWED', legacyIds: ['fox'],
  });
  foxDefinition.professionalDefinition = {
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE',
      numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_LATE_OUTER_EMPHASIS' },
        { region: 'BODY', relationship: 'BUILDS_TOWARD_LATE_OUTER_EMPHASIS' },
        { region: 'LATE_OUTER', relationship: 'EMPHASIS_REGION' },
        { region: 'OUTER_TAIL', relationship: 'CONTROLLED_TAIL_BEHAVIOR' },
      ],
    },
    peak: {
      positionRange: {
        unit: 'NORMALIZED_LASH_LINE', min: null, max: null,
        region: 'LATE_OUTER', resolution: 'NUMERIC_RANGE_UNRESOLVED',
      },
      zoneRange: { regions: ['LATE_OUTER'], resolution: 'QUALITATIVE_REGION_ONLY' },
      plateauAllowed: { value: null, resolution: 'UNRESOLVED' },
    },
    topology: {
      rise: 'BUILDS_TOWARD_LATE_OUTER_EMPHASIS',
      shoulder: 'UNRESOLVED',
      postPeak: 'CONTROLLED_OUTER_TAIL',
      outerBehavior: 'CONTROLLED_TAIL_AFTER_LATE_OUTER_EMPHASIS',
    },
    primaryIntent: 'HORIZONTAL_TEMPORAL_ELONGATION',
    // PHASE_1Q DOMAIN-AUTHORITY REVISION — resolves the SHAPE of the
    // outer-corner rule qualitatively, without resolving an exact
    // numeric position (peak.positionRange/zoneRange/plateauAllowed
    // above are left completely untouched, still UNRESOLVED, on
    // purpose). Kept as a SEPARATE block rather than folded into
    // `peak`/`topology` above so the still-unresolved numeric fields
    // remain visibly, structurally unresolved rather than silently
    // padded with new keys.
    outerCornerRule: {
      // The maximum must sit in the outer/pre-outer portion of the
      // map, not centrally — same LATE_OUTER region as `peak.zoneRange`
      // above, restated explicitly in the domain authority's own
      // vocabulary for this revision.
      peakDirectionality: 'OUTER_SHIFTED_PRE_OUTER',
      // The peak is explicitly NOT the final OUTER control point: the
      // extreme outer corner must read lower than the peak, i.e. a
      // real, visible taper/drop is required at the extreme outer
      // corner, not a plateau and not continued growth to the edge.
      extremeOuterVsPeak: 'EXTREME_OUTER_LOWER_THAN_PEAK',
      postPeakDecline: 'REQUIRED',
      // Comparative, not absolute: the peak must sit later than the
      // CURRENT production Fox peak (legacyReference.normalizedGeometry
      // .peakPosition = 0.66) -- a direction, not a number.
      relativeToCurrentProductionPeak: 'LATER_THAN_CURRENT_PRODUCTION_FOX_PEAK',
      // Fox and Cat must remain two visually distinguishable effects;
      // this does not resolve crossEffectComparison['geometry.cat']'s
      // own relativePeakOrder/relativeSharpness fields below, which
      // stay UNRESOLVED on purpose -- this only forbids collapsing the
      // two into the same silhouette.
      relativeToCat: 'DISTINCT_FROM_CAT_PEAK_REQUIRED',
      resolution: 'QUALITATIVE_RULE_RESOLVED_NUMERIC_RANGE_STILL_UNRESOLVED',
    },
    crossEffectComparison: {
      'geometry.cat': {
        foxPeakRegion: 'LATE_OUTER', foxOuterBehavior: 'CONTROLLED_TAIL', foxIntentClass: 'TEMPORAL_ELONGATION',
        foxDeclineOrPlateau: 'UNRESOLVED', otherDefinitionStatus: 'UNRESOLVED_PENDING_CAT_PROFESSIONAL_DEFINITION',
        distinction: 'RELATIVE_PEAK_AND_TAIL_CHARACTER_REMAINS_QUALITATIVE_PENDING_CAT_REVIEW',
      },
      'geometry.squirrel': {
        foxPeakRegion: 'LATE_OUTER', foxOuterBehavior: 'CONTROLLED_TAIL', foxIntentClass: 'TEMPORAL_ELONGATION',
        otherDefinitionStatus: 'EXPERT_REVIEWED', otherPeakRegion: 'PRE_OUTER', otherIntentClass: 'OUTER_LIFT',
        distinction: 'ELONGATION_VERSUS_LIFT_WITH_PRE_OUTER_MAXIMUM_AND_CONTROLLED_DECREASE',
      },
      'geometry.doll': {
        foxPeakRegion: 'LATE_OUTER', foxOuterBehavior: 'CONTROLLED_TAIL', foxIntentClass: 'TEMPORAL_ELONGATION',
        otherDefinitionStatus: 'EXPERT_REVIEWED', otherPeakRegion: 'CENTRAL', otherIntentClass: 'OPENING',
        distinction: 'TEMPORAL_ELONGATION_VERSUS_CENTRAL_OPENING',
      },
    },
  };
  foxDefinition.templateMm = {
    purpose: 'STARTING_TEMPLATE_ONLY', universal: false, values: null,
    resolution: 'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED',
  };
  foxDefinition.compatibility = {
    compatibleTechniqueIds: [], compatibleConstructionRecipeIds: [],
    incompatibleIds: [], conditions: [], resolution: 'UNRESOLVED',
  };
  foxDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1d-fox-structure', type: 'REVIEWED_PROFESSIONAL_STRUCTURE',
      scope: ['MAPPING_GEOMETRY_IDENTITY', 'LATE_OUTER_EMPHASIS', 'CONTROLLED_OUTER_TAIL', 'TEMPORAL_ELONGATION_INTENT'],
      numericClaims: false,
    }, {
      id: 'phase-1q-fox-outer-corner-rule', type: 'REVIEWED_QUALITATIVE_RULE',
      scope: ['OUTER_CORNER_PEAK_DIRECTIONALITY', 'POST_PEAK_DECLINE_REQUIREMENT', 'RELATIVE_TO_CURRENT_PRODUCTION_PEAK', 'RELATIVE_TO_CAT'],
      numericClaims: false,
    }],
    provenance: [
      { source: 'PHASE_1D_APPROVED_PROFESSIONAL_BRIEF', scope: 'STRUCTURAL_ONLY' },
      { source: 'PHASE_1Q_DOMAIN_AUTHORITY_OUTER_CORNER_DECISION', scope: 'OUTER_CORNER_RULE_QUALITATIVE_ONLY' },
    ],
    reviewers: [
      { role: 'DOMAIN_REVIEW', identifier: 'PHASE_1D_APPROVAL' },
      { role: 'DOMAIN_REVIEW', identifier: 'PHASE_1Q_APPROVAL' },
    ],
    reviewedAt: null,
    revision: 2,
    notes: [
      'Numeric peak range, normalized samples, plateau, tail drop, template mm, compatibility, and variants remain unresolved.',
      'PHASE_1Q resolves the outer-corner rule qualitatively (peak is outer-shifted/pre-outer, extreme outer corner reads lower than the peak, a post-peak decline is required, the peak must sit later than the current production Fox peak, and Fox must remain distinct from Cat) without resolving an exact numeric position -- see outerCornerRule.',
    ],
  };
  foxDefinition.legacyReference = {
    legacyIds: ['fox'], legacyAliases: ['Fox-inspired'], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakPosition: 0.66, peakZone: 3 },
    templateMm: [6, 7, 9, 12, 11],
    topology: { zonePositions: [0, 0.20, 0.44, 0.66, 1], plateauShape: 'linear', postPeakShape: 'gradual' },
    scoreCoefficients: null, spikeDeltas: null, textureFrequencies: null,
    curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1E reviewed structure only. The supplied review establishes a
  // pronounced late/outer feline emphasis with controlled physical-OUTER
  // behavior, but does not establish an exact coordinate, slope, drop,
  // template, curl, volume, or direction angle. Production values stay
  // isolated in legacyReference.
  const catDefinition = identity('geometry.cat', 'Cat', 'MAPPING_GEOMETRY', {
    status: 'EXPERT_REVIEWED', legacyIds: ['cat'],
  });
  catDefinition.professionalDefinition = {
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE',
      numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_PRONOUNCED_LATE_OUTER_EMPHASIS' },
        { region: 'BODY', relationship: 'BUILDS_TOWARD_PRONOUNCED_LATE_OUTER_EMPHASIS' },
        { region: 'LATE_OUTER', relationship: 'PRONOUNCED_EMPHASIS_REGION' },
        { region: 'PHYSICAL_OUTER', relationship: 'CONTROLLED_OUTER_BEHAVIOR' },
      ],
    },
    peak: {
      positionRange: {
        unit: 'NORMALIZED_LASH_LINE', min: null, max: null,
        region: 'LATE_OUTER', resolution: 'NUMERIC_RANGE_UNRESOLVED',
      },
      zoneRange: { regions: ['LATE_OUTER'], resolution: 'QUALITATIVE_REGION_ONLY' },
      plateauAllowed: { value: null, resolution: 'UNRESOLVED' },
    },
    topology: {
      rise: 'BUILDS_TOWARD_PRONOUNCED_LATE_OUTER_EMPHASIS',
      shoulder: 'UNRESOLVED',
      postPeak: 'CONTROLLED_BEHAVIOR_TOWARD_PHYSICAL_OUTER',
      outerBehavior: 'CONTROLLED_AT_PHYSICAL_OUTER',
    },
    primaryIntent: 'STRONGER_FELINE_OUTER_ELONGATION',
    crossEffectComparison: {
      'geometry.fox': {
        catPeakRegion: 'LATE_OUTER', foxPeakRegion: 'LATE_OUTER', relativePeakOrder: 'UNRESOLVED',
        relativeSharpness: 'UNRESOLVED', catOuterBehavior: 'CONTROLLED_AT_PHYSICAL_OUTER',
        foxOuterBehavior: 'CONTROLLED_OUTER_TAIL', tailDeclineOrPlateauDifference: 'UNRESOLVED',
        catIntentClass: 'STRONGER_FELINE_OUTER_EMPHASIS', foxIntentClass: 'HORIZONTAL_TEMPORAL_ELONGATION',
        directionDependency: {
          status: 'UNRESOLVED_NEEDS_DIRECTION_STRATEGY_VALIDATION',
          note: 'Mapping geometry alone may not fully distinguish the visual effects.',
        },
        numericLegacyComparisonUsed: false,
      },
      'geometry.squirrel': {
        catPeakRegion: 'LATE_OUTER', catIntentClass: 'OUTER_ELONGATION', catOuterBehavior: 'CONTROLLED_AT_PHYSICAL_OUTER',
        otherDefinitionStatus: 'EXPERT_REVIEWED', otherPeakRegion: 'PRE_OUTER', otherIntentClass: 'OUTER_LIFT',
        distinction: 'ELONGATION_VERSUS_PRE_OUTER_LIFT_WITH_CONTROLLED_DECREASE',
      },
      'geometry.doll': {
        catPeakRegion: 'LATE_OUTER', catIntentClass: 'OUTER_ELONGATION', catOuterBehavior: 'CONTROLLED_AT_PHYSICAL_OUTER',
        otherDefinitionStatus: 'EXPERT_REVIEWED', otherPeakRegion: 'CENTRAL', otherIntentClass: 'OPENING',
        distinction: 'OUTER_ELONGATION_VERSUS_CENTRAL_OPENING',
      },
    },
  };
  catDefinition.templateMm = {
    purpose: 'STARTING_TEMPLATE_ONLY', universal: false, values: null,
    resolution: 'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED',
  };
  catDefinition.compatibility = {
    compatibleTechniqueIds: [], compatibleConstructionRecipeIds: [],
    incompatibleIds: [], conditions: [], resolution: 'UNRESOLVED',
  };
  catDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1e-cat-structure', type: 'REVIEWED_PROFESSIONAL_STRUCTURE',
      scope: ['MAPPING_GEOMETRY_IDENTITY', 'PRONOUNCED_LATE_OUTER_EMPHASIS', 'CONTROLLED_PHYSICAL_OUTER_BEHAVIOR', 'FELINE_OUTER_ELONGATION_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1E_APPROVED_PROFESSIONAL_BRIEF', scope: 'STRUCTURAL_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1E_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Numeric peak range, normalized samples, outer drop and slope, template mm, compatibility, variants, and direction-strategy distinction remain unresolved.'],
  };
  catDefinition.legacyReference = {
    legacyIds: ['cat'], legacyAliases: [], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakPosition: 0.78, peakZone: 3 },
    templateMm: [7, 8, 10, 12, 10],
    topology: { zonePositions: [0, 0.22, 0.48, 0.78, 1], plateauShape: 'linear', postPeakShape: 'frontLoaded' },
    scoreCoefficients: null, spikeDeltas: null, textureFrequencies: null,
    curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1F direction foundation. Direction remains a separate professional
  // layer from mapping geometry and curl. Only reviewed qualitative intent is
  // represented; angles, vectors, curls, and zone boundaries stay unresolved.
  const catDirectionDefinition = identity('direction.cat', 'Cat Direction', 'DIRECTION_STRATEGY', {
    status: 'EXPERT_REVIEWED',
  });
  catDirectionDefinition.professionalDefinition = {
    directionalIntent: 'FELINE_OUTER_LIFT',
    dominantAxis: 'UPWARD_OUTER',
    outerOrientation: 'OUTER_FOCUSED',
    visualBehavior: 'COMPARATIVELY_UPWARD_CURVED',
    liftVsElongation: 'LIFT_WITH_OUTER_EMPHASIS',
    directionDependency: {
      role: 'MEANINGFUL_CONTRIBUTOR',
      universality: 'UNRESOLVED',
    },
    mappingDirectionRelationship: {
      geometryId: 'geometry.cat',
      layers: ['MAPPING_GEOMETRY', 'DIRECTION_STRATEGY'],
      relationship: 'COMPOSITE_CONTRIBUTOR',
      directionAloneDefinesEffect: false,
      universalComposition: 'UNRESOLVED',
    },
    numericAngles: null,
    directionVectors: null,
    zoneBoundaries: null,
    curlInteraction: { relationship: 'MAY_INTERACT', exactCurl: null, resolution: 'UNRESOLVED' },
    schoolDependency: { status: 'UNRESOLVED' },
    crossEffectComparison: {
      'direction.fox': {
        catAxis: 'UPWARD_OUTER', foxAxis: 'TEMPORAL_OUTWARD',
        catVisualBehavior: 'COMPARATIVELY_UPWARD_CURVED', foxVisualBehavior: 'COMPARATIVELY_OUTWARD_LINEAR',
        relativeDirectionDependency: 'FOX_STRONGER_THAN_CAT', exactDependencyMagnitude: 'UNRESOLVED',
      },
    },
    unresolved: ['EXACT_ANGLES', 'EXACT_VECTORS', 'EXACT_CURL', 'EXACT_FAN_DIRECTION', 'EXACT_ZONE_BOUNDARIES', 'UNIVERSAL_DIRECTION_DEPENDENCY'],
  };
  catDirectionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1f-cat-direction-structure', type: 'REVIEWED_PROFESSIONAL_DIRECTION_STRUCTURE',
      scope: ['FELINE_OUTER_LIFT', 'UPWARD_CURVED_VISUAL_BEHAVIOR', 'MAPPING_DIRECTION_COMPOSITE'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1F_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_DIRECTION_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1F_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Universality, exact execution, numeric angles, curl interaction, and school variants remain unresolved.'],
  };

  const foxDirectionDefinition = identity('direction.fox', 'Fox Direction', 'DIRECTION_STRATEGY', {
    status: 'EXPERT_REVIEWED',
  });
  foxDirectionDefinition.professionalDefinition = {
    directionalIntent: 'TEMPORAL_HORIZONTAL_ELONGATION',
    dominantAxis: 'TEMPORAL_OUTWARD',
    outerOrientation: 'OUTWARD_TEMPORAL',
    visualBehavior: 'COMPARATIVELY_OUTWARD_LINEAR',
    liftVsElongation: 'HORIZONTAL_TEMPORAL_ELONGATION',
    directionDependency: {
      role: 'STRONG_CONTRIBUTOR',
      universality: 'UNRESOLVED',
    },
    mappingDirectionRelationship: {
      geometryId: 'geometry.fox',
      layers: ['MAPPING_GEOMETRY', 'DIRECTION_STRATEGY'],
      relationship: 'COMPOSITE_CONTRIBUTOR',
      directionAloneDefinesEffect: false,
      universalComposition: 'UNRESOLVED',
    },
    numericAngles: null,
    directionVectors: null,
    zoneBoundaries: null,
    curlInteraction: { relationship: 'MAY_INTERACT', exactCurl: null, resolution: 'UNRESOLVED' },
    schoolDependency: { status: 'UNRESOLVED' },
    crossEffectComparison: {
      'direction.cat': {
        foxAxis: 'TEMPORAL_OUTWARD', catAxis: 'UPWARD_OUTER',
        foxVisualBehavior: 'COMPARATIVELY_OUTWARD_LINEAR', catVisualBehavior: 'COMPARATIVELY_UPWARD_CURVED',
        relativeDirectionDependency: 'FOX_STRONGER_THAN_CAT', exactDependencyMagnitude: 'UNRESOLVED',
      },
    },
    unresolved: ['EXACT_ANGLES', 'EXACT_VECTORS', 'EXACT_CURL', 'EXACT_FAN_DIRECTION', 'EXACT_ZONE_BOUNDARIES', 'UNIVERSAL_DIRECTION_DEPENDENCY'],
  };
  foxDirectionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1f-fox-direction-structure', type: 'REVIEWED_PROFESSIONAL_DIRECTION_STRUCTURE',
      scope: ['TEMPORAL_HORIZONTAL_ELONGATION', 'OUTWARD_LINEAR_VISUAL_BEHAVIOR', 'STRONG_DIRECTION_CONTRIBUTION', 'MAPPING_DIRECTION_COMPOSITE'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1F_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_DIRECTION_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1F_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Universality, exact execution, numeric angles, curl interaction, and school variants remain unresolved.'],
  };

  // Phase 1G Eyeliner foundation. The reviewed invariant is the visible
  // root-line outcome, not one universal physical execution method.
  const rootDefinitionConstruction = identity('construction.root-definition', 'Root Definition', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED',
  });
  rootDefinitionConstruction.professionalDefinition = {
    outcomeType: 'ROOT_LINE_DEFINITION',
    invariantOutcome: {
      visualResult: 'DEFINED_DARKER_LINER_LIKE_ROOT_LINE',
      continuity: 'VISUALLY_MORE_CONTINUOUS_ROOT_APPEARANCE',
      separateFromVisibleSilhouette: true,
    },
    executionMethods: {
      universalMethod: null,
      status: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
      possibleMethodClasses: ['DENSE_ROOT_PLACEMENT', 'CLOSED_FANS', 'NARROW_FANS', 'LAYERING', 'WET_LINE_CONSTRUCTION'],
      possibleMethodsAreRequirements: false,
    },
    exactDensity: null,
    exactFanWidth: null,
    exactFanClosure: null,
    exactVolume: null,
    exactDiameter: null,
    exactLayerCount: null,
    exactSpacing: null,
    exactLashCount: null,
    exactMillimeters: null,
    schoolDependency: { status: 'UNRESOLVED' },
    unresolved: ['EXECUTION_METHOD', 'DENSITY', 'FAN_WIDTH', 'FAN_CLOSURE', 'VOLUME', 'DIAMETER', 'LAYER_COUNT', 'SPACING', 'LASH_COUNT', 'MILLIMETERS', 'SCHOOL_VARIANTS'],
  };
  rootDefinitionConstruction.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1g-root-definition-outcome', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_OUTCOME',
      scope: ['ROOT_LINE_DEFINITION', 'DARKER_CONTINUOUS_LINER_LIKE_ROOT_APPEARANCE', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1G_APPROVED_PROFESSIONAL_BRIEF', scope: 'OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1G_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Physical execution methods and every numeric construction parameter remain unresolved or variant-dependent.'],
  };

  // This is a direction slot, not a universal Eyeliner direction rule. The
  // qualitative contribution is draft because orientation varies by variant.
  const eyelinerDirectionDefinition = identity('direction.eyeliner', 'Eyeliner Direction', 'DIRECTION_STRATEGY', {
    status: 'DRAFT', unresolved: true,
  });
  eyelinerDirectionDefinition.professionalDefinition = {
    directionalIntent: 'LINER_LIKE_ELONGATION',
    dominantAxis: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
    outerOrientation: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
    visualContributions: ['MAY_SUPPORT_ELONGATION', 'MAY_SUPPORT_LINE_CONTINUITY', 'MAY_SUPPORT_OUTER_EXTENSION'],
    appearanceModes: ['FLAT', 'TEMPORAL', 'LIFTED'],
    appearanceModesAreUniversalRequirements: false,
    directionDependency: { role: 'COMPOSITE_CONTRIBUTOR', universality: 'UNRESOLVED' },
    mappingDirectionRelationship: {
      presetId: 'preset.eyeliner',
      layers: ['MAPPING_GEOMETRY', 'DIRECTION_STRATEGY'],
      relationship: 'SEPARATE_COMPOSITE_LAYERS',
      directionAloneDefinesEffect: false,
    },
    numericAngles: null,
    directionVectors: null,
    zoneBoundaries: null,
    outerTailAngle: null,
    universalHorizontalRequirement: false,
    curlInteraction: { relationship: 'MAY_INTERACT', exactCurl: null, resolution: 'SCHOOL_OR_VARIANT_DEPENDENT' },
    schoolDependency: { status: 'UNRESOLVED' },
    unresolved: ['UNIVERSAL_ORIENTATION', 'EXACT_ANGLES', 'EXACT_VECTORS', 'DIRECTIONAL_ZONE_BOUNDARIES', 'OUTER_TAIL_ANGLE', 'SCHOOL_VARIANTS'],
  };
  eyelinerDirectionDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1g-eyeliner-direction-slot', type: 'REVIEWED_COMPOSITE_SLOT_WITH_UNRESOLVED_STRATEGY',
      scope: ['DIRECTION_AS_SEPARATE_LAYER', 'POTENTIAL_LINE_CONTINUITY_AND_ELONGATION_CONTRIBUTION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1G_APPROVED_PROFESSIONAL_BRIEF', scope: 'DIRECTION_SLOT_AND_UNCERTAINTY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1G_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['No universal Eyeliner direction orientation or execution has been established.'],
  };

  const eyelinerPresetDefinition = identity('preset.eyeliner', 'Eyeliner', 'COMPOSITE_PRESET', {
    status: 'EXPERT_REVIEWED', legacyIds: ['eyeliner'],
  });
  eyelinerPresetDefinition.professionalDefinition = {
    invariant: {
      rootDefinitionOutcome: 'REQUIRED',
      visualResult: 'DEFINED_DARKER_LINER_LIKE_ROOT_LINE',
      constructionId: 'construction.root-definition',
    },
    layers: {
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'COMPOSITE_CONTRIBUTOR',
        strategySlotId: 'direction.eyeliner', universalStrategy: 'UNRESOLVED',
      },
      construction: {
        domain: 'CONSTRUCTION_RECIPE', role: 'MANDATORY_CORE_OUTCOME',
        constructionId: 'construction.root-definition', universalExecutionMethod: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'OPTIONAL_SCHOOL_DEPENDENT_COMPATIBILITY', strategyId: null,
        exactCurl: null, contributions: ['MAY_AFFECT_FLATNESS', 'MAY_AFFECT_LIFT', 'MAY_AFFECT_DIRECTIONAL_CONTINUITY', 'MAY_AFFECT_OUTER_EXTENSION', 'MAY_AFFECT_ROOT_LINE_VISIBILITY'],
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
      },
      layering: { role: 'OPTIONAL_VARIANT_SPECIFIC', universalMethod: null },
      fanConstruction: { domain: 'FAN_CONSTRUCTION', role: 'VARIANT_SPECIFIC', constructionId: null },
    },
    invariantVsExecution: {
      invariant: 'DEFINED_DARKER_LINER_LIKE_ROOT_LINE',
      executionMethodStatus: 'UNRESOLVED_SCHOOL_OR_VARIANT_DEPENDENT',
      differentMethodsMayShareCanonicalIdentity: true,
    },
    schoolDependency: { status: 'UNRESOLVED' },
    unresolved: ['GEOMETRY_SELECTION', 'UNIVERSAL_DIRECTION', 'EXACT_CURL', 'APPLICATION_TECHNIQUE', 'LAYERING_METHOD', 'FAN_CONSTRUCTION', 'EXECUTION_VARIANTS', 'SCHOOL_VARIANTS'],
  };
  eyelinerPresetDefinition.compatibility = {
    geometryIds: [], directionIds: ['direction.eyeliner'], constructionIds: ['construction.root-definition'],
    curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [], conditions: [], resolution: 'UNRESOLVED_EXCEPT_REQUIRED_ROOT_OUTCOME',
  };
  eyelinerPresetDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1g-eyeliner-composite-foundation', type: 'REVIEWED_PROFESSIONAL_COMPOSITE_FOUNDATION',
      scope: ['COMPOSITE_PRESET_IDENTITY', 'REQUIRED_ROOT_DEFINITION_OUTCOME', 'SEPARATE_PROFESSIONAL_LAYERS', 'EXECUTION_METHOD_UNCERTAINTY'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1G_APPROVED_PROFESSIONAL_BRIEF', scope: 'COMPOSITE_STRUCTURE_AND_ROOT_OUTCOME' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1G_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Only the liner-like root-definition outcome and composite architecture are reviewed; execution and compatibility remain unresolved.'],
  };
  eyelinerPresetDefinition.legacyReference = {
    legacyIds: ['eyeliner'], legacyAliases: ['Arrow Effect'], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 3 }, templateMm: [8, 8, 9, 10, 9],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    applicationTechnique: 'Volume 3D', curl: { base: 'CC', options: ['CC', 'D'] },
    scoreCoefficients: { base: 40, closeSetBonus: 10, asymmetryThreshold: 0.08, asymmetryBonus: 10, hoodedBonus: 6 },
    spikeDeltas: null, textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1H Wet foundation. The reviewed identity is the visible grouped
  // construction outcome. Physical fan building and every numeric execution
  // choice remain explicitly variant- or school-dependent.
  const wetConstructionDefinition = identity('construction.wet', 'Wet', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['wet'],
  });
  wetConstructionDefinition.professionalDefinition = {
    outcomeType: 'WET_GROUPED_DEFINITION',
    invariantOutcome: {
      grouping: { role: 'ESSENTIAL_QUALITATIVE_OUTCOME', result: 'MASCARA_LIKE_GROUPED_DEFINITION' },
      visibleStructure: 'VISIBLE_SEPARATED_COLUMNS',
      openness: 'REDUCED_FLUFFINESS',
      repetition: 'CONTROLLED_REPETITION_OF_DEFINED_GROUPS',
      finish: {
        role: 'ESSENTIAL_VISUAL_DESCRIPTOR', result: 'WET_LOOK_VISUAL_FINISH',
        perceivedAppearanceOnly: true, literalGlossProduct: false,
        coatingOrChemicalTreatmentRequired: false, appliedWetSubstanceRequired: false,
      },
      dramaticLengthContrastRequired: false,
      kimStyleRaysRequired: false,
      wispyAccentStructureRequired: false,
    },
    outcomeVsExecution: {
      invariant: 'GROUPED_DEFINED_MASCARA_LIKE_REDUCED_FLUFFINESS_WET_LOOK',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT',
      universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
    },
    relationships: {
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'ESSENTIAL_CONTRIBUTOR',
        selection: 'VARIANT_OR_SCHOOL_DEPENDENT', constructionId: null,
        allowedMethodClasses: ['CLOSED_FANS', 'NARROW_OR_NEARLY_CLOSED_FANS', 'PARTIALLY_CLOSED_CONSTRUCTIONS', 'GROUPED_BUNDLES_OR_SPIKES'],
        allowedMethodClassesAreUniversalRequirements: false,
        wideOpenFluffyFansPartOfCoreInvariant: false,
      },
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_CONTRIBUTOR', strategyId: null,
        maySupport: ['CLEAN_SEPARATED_COLUMNS', 'VISUAL_RHYTHM', 'AVOIDANCE_OF_CROSSING', 'SELECTED_MAPPING_READABILITY'],
        numericAngles: null, directionVectors: null, directionalZones: null, universalSweep: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'SEPARATE_VARIANT_DEPENDENT_UNRESOLVED', strategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
      },
    },
    densityIntent: 'VARIANT_DEPENDENT',
    intensity: 'VARIANT_DEPENDENT',
    exactFanCount: null,
    exactFanWidth: null,
    exactDensity: null,
    exactDiameter: null,
    exactVolume: null,
    exactSpacing: null,
    exactColumnCount: null,
    exactSpikeFrequency: null,
    exactLayerCount: null,
    exactMillimeters: null,
    crossEffectBoundaries: {
      angel: 'ANGEL_BOUNDARY_REQUIRES_SEPARATE_REVIEW',
      wispy: 'COMBINATION_MUST_BE_VARIANT_OR_COMPOSITION',
      kimK: 'COMBINATION_MUST_BE_VARIANT_OR_COMPOSITION',
    },
    futureVariantNamespace: {
      status: 'REQUIRES_SEPARATE_REVIEW',
      potentialClasses: ['CLOSED_FAN_WET', 'NARROW_FAN_WET', 'SOFT_WET', 'DARK_DEFINED_WET', 'WISPY_WET', 'HYBRID_GROUPED_WET'],
      canonicalVariantIdsCreated: false,
    },
    unresolved: ['EXACT_FAN_CONSTRUCTION', 'EXECUTION_METHOD', 'GEOMETRY_COMPATIBILITY', 'DIRECTION_EXECUTION', 'CURL_SELECTION', 'APPLICATION_TECHNIQUE', 'DENSITY_INTENT', 'INTENSITY', 'SCHOOL_VARIANTS', 'ANGEL_BOUNDARY'],
  };
  wetConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  wetConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1h-wet-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['GROUPED_MASCARA_LIKE_DEFINITION', 'VISIBLE_SEPARATED_COLUMNS', 'REDUCED_FLUFFINESS', 'PERCEIVED_WET_LOOK_FINISH', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1H_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_CONSTRUCTION_OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1H_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Exact fan construction, geometry compatibility, direction, curl, technique, density, intensity, school variants, and the Angel boundary remain unresolved.'],
  };
  wetConstructionDefinition.legacyReference = {
    legacyIds: ['wet'], legacyAliases: ['Soft Wet', 'Mascara Effect', 'Defined Wet', 'Eyeliner Wet'],
    relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 3 }, templateMm: [7, 8, 9, 9, 8],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    applicationTechnique: 'Wet Technique / Wet Set', curl: { base: 'B', options: ['J', 'B', 'C'] },
    scoreCoefficients: { base: 44, neutralTiltCoefficient: 10, nonNeutralFallback: 2, asymmetryThreshold: 0.06, asymmetryBonus: 6 },
    spikeDeltas: null, textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: ['0.05–0.10 mm'],
    narrativeClaims: ['MINIMAL_ROOT_DENSITY', 'DELIBERATELY_SPARSE', 'FILL_FREQUENCY_CLAIM'],
  };
  // Phase 1R candidate reference template only (see the Anime template below
  // for the full disclaimer -- identical status here). "Wet Look": compact
  // base, prominent rays/spikes, exactly as transcribed by the requester.
  // Deliberately kept OFF wetConstructionDefinition itself (assigned into
  // the separate library.referenceTemplates map below instead) so every
  // pre-existing byte-identity guard on the reviewed Wet definition's exact
  // shape stays untouched -- see the map's own comment for why.
  const wetReferenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    baseProfile: [
      { order: 0, position: 'INNER', lengthMm: 7 },
      { order: 1, position: 'INNER_BODY', lengthMm: 8 },
      { order: 2, position: 'BODY', lengthMm: 9 },
      { order: 3, position: 'OUTER', lengthMm: 10 },
    ],
    spikes: [
      { order: 0, position: 'INNER', lengthMm: 8 },
      { order: 1, position: 'INNER_BODY', lengthMm: 10 },
      { order: 2, position: 'BODY', lengthMm: 10 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 12 },
      { order: 4, position: 'OUTER', lengthMmRange: [13, 14] },
    ],
    correctionGoal: null,
    notes: [
      'Compact base 7-10mm, prominent rays ~8/10/10/12/13-14mm, per the requester\'s transcription.',
      'The base has fewer points than the spike/ray layer (4 vs 5) exactly as given; spikes are not forced into a 1:1 index alignment with baseProfile here because the source gave them as separately-counted layers -- do not silently pad one array to match the other\'s length.',
    ],
  };

  // Phase 1I Angel foundation. The reviewed boundary from Wet is visual
  // intent only; physical fan building remains school- or variant-dependent.
  const angelConstructionDefinition = identity('construction.angel', 'Angel', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['angel'],
  });
  angelConstructionDefinition.professionalDefinition = {
    outcomeType: 'ANGEL_AIRY_FEATHERED_DEFINITION',
    invariantOutcome: {
      definition: 'AIRY_FEATHERED_DEFINITION',
      texture: 'SOFT_SEPARATED_TEXTURE',
      movement: 'FLUTTERY_VISUAL_MOVEMENT',
      finish: {
        role: 'ESSENTIAL_VISUAL_DESCRIPTOR', result: 'LIGHT_NON_COMPACT_FINISH',
        perceivedAppearanceOnly: true, technicalWeightClaim: false,
        numericDensityClaim: false, safetyOrLoadClaim: false,
      },
      wispySeparatedMovement: { role: 'ESSENTIAL_VISUAL_OUTCOME' },
      transparentAppearanceRequired: false,
      kimStyleDramaticSpikeBaseContrastRequired: false,
    },
    visualBoundaryWithWet: {
      wetConstructionId: 'construction.wet',
      wetVisualIntent: ['COMPACT_GROUPED_MASCARA_LIKE_DEFINITION', 'VISIBLE_SEPARATED_COLUMNS_OR_GROUPS', 'REDUCED_FLUFFINESS', 'CONTROLLED_GROUPED_REPETITION', 'PERCEIVED_WET_LOOK_FINISH'],
      angelVisualIntent: ['AIRY_FEATHERED_DEFINITION', 'SOFT_SEPARATED_TEXTURE', 'FLUTTERY_VISUAL_MOVEMENT', 'LIGHT_NON_COMPACT_FINISH'],
      differentiator: 'VISUAL_OUTCOME_INTENT',
      exactTechnicalSeparation: 'SCHOOL_DEPENDENT',
      terminologyOverlap: 'PRESENT_IN_SOME_SCHOOLS',
      sharedMethodClassesAllowed: ['NARROW_FANS', 'CLOSED_FANS'],
      universalPhysicalFanDifference: false,
    },
    outcomeVsExecution: {
      invariant: 'AIRY_FEATHERED_SOFT_SEPARATED_FLUTTERY_NON_COMPACT_VISUAL_RESULT',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT',
      universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
    },
    relationships: {
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'ESSENTIAL_CONTRIBUTOR',
        selection: 'SCHOOL_OR_VARIANT_DEPENDENT', constructionId: null,
        recognizedMethodClasses: ['CLOSED_FANS', 'NARROW_OR_NEARLY_CLOSED_FANS', 'OPEN_SUPPORTING_FANS', 'MIXED_OPEN_CLOSED_CONSTRUCTIONS', 'CLASSIC_ASSISTED_CONSTRUCTIONS', 'LAYERED_COMBINATIONS'],
        recognizedMethodClassesAreUniversalRequirements: false,
      },
      spikeWisp: {
        domain: 'SPIKE_WISP_CONSTRUCTION', role: 'COMMON_CONTRIBUTOR_SCHOOL_DEPENDENT',
        universalSpikePlan: null, constructionId: null,
      },
      layering: { role: 'OPTIONAL_OR_SCHOOL_DEPENDENT', universalLayeringMethod: null },
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', strategyId: null,
        maySupport: ['SEPARATION', 'FEATHERED_MOVEMENT', 'AVOIDANCE_OF_CROSSING', 'GEOMETRY_READABILITY'],
        numericAngles: null, directionVectors: null, directionalZones: null, universalSweep: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'SEPARATE_VARIANT_DEPENDENT', strategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
      },
    },
    densityFinish: {
      supportedVisualOutcomes: ['AIRY', 'LIGHT', 'SOFT', 'FEATHERED', 'FLUTTERY', 'VISUALLY_SEPARATED'],
      exactDensity: null, intensity: 'VARIANT_DEPENDENT',
      rootDarkness: 'UNRESOLVED_OR_SCHOOL_DEPENDENT', transparentMandatory: false,
    },
    exactFanCount: null,
    exactFanWidth: null,
    exactDiameter: null,
    exactVolume: null,
    exactFanClosurePercentage: null,
    exactLashCount: null,
    exactSpikeCount: null,
    exactSpikeFrequency: null,
    exactSpikeSpacing: null,
    exactSpikeHierarchy: null,
    exactLengthDelta: null,
    exactPlacement: null,
    exactLayerCount: null,
    exactMillimeters: null,
    crossEffectRelationships: {
      wispy: {
        family: 'RELATED_WISPY_TEXTURED_CONSTRUCTION_FAMILY',
        taxonomyBoundary: 'SCHOOL_DEPENDENT_OVERLAP',
        subtypeInSomeSchools: true,
        distinctWetRelatedConstructionInOtherSchools: true,
      },
      kimK: {
        comparisonStatus: 'PROVISIONAL_UNTIL_KIM_K_REVIEW',
        dramaticSpikeBaseContrastRequired: false,
      },
    },
    futureVariantNamespace: {
      status: 'REQUIRES_SEPARATE_REVIEW',
      potentialDimensions: ['CLOSED_FAN_ANGEL', 'NARROW_FAN_ANGEL', 'LAYERED_ANGEL', 'CLASSIC_ASSISTED_ANGEL', 'MIXED_FAN_ANGEL', 'SOFT_MINIMAL_ANGEL', 'MORE_DEFINED_ANGEL', 'ANGEL_WET_OVERLAP', 'ANGEL_WISPY_COMPOSITION', 'GEOMETRY_CARRIER_CHOICE'],
      canonicalVariantIdsCreated: false,
    },
    unresolved: ['UNIVERSAL_FAN_METHOD', 'SPIKE_HIERARCHY', 'LAYERING_REQUIREMENT', 'EXACT_DENSITY', 'ROOT_DARKNESS', 'GEOMETRY_COMPATIBILITY', 'TECHNICAL_ANGEL_WET_SEPARATION', 'ANGEL_WISPY_TAXONOMY_BOUNDARY', 'NUMERIC_EXECUTION_PARAMETERS'],
  };
  angelConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  angelConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1i-angel-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['AIRY_FEATHERED_DEFINITION', 'SOFT_SEPARATED_TEXTURE', 'FLUTTERY_VISUAL_MOVEMENT', 'LIGHT_NON_COMPACT_FINISH', 'VISUAL_BOUNDARY_FROM_WET', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1I_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_VISUAL_CONSTRUCTION_OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1I_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Fan method, spike hierarchy, layering, density, root darkness, geometry compatibility, technical Angel/Wet separation, Angel/Wispy taxonomy, and numeric execution remain unresolved or school-dependent.'],
  };
  angelConstructionDefinition.legacyReference = {
    legacyIds: ['angel'], legacyAliases: ['Airy Effect', 'Feathered', 'Soft Volume Styling'],
    relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 2 }, templateMm: [6, 7, 8, 8, 7],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    applicationTechnique: 'Light Volume 2D', curl: { base: 'B', options: ['J', 'B', 'C'] },
    scoreCoefficients: { base: 40, lowConfidenceThreshold: 0.5, lowConfidenceBonus: 10, tiltThresholdDegrees: 3, tiltBonus: 12, asymmetryThreshold: 0.05, asymmetryBonus: 8 },
    spikeDeltas: null, textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
    narrativeClaims: ['VERY_LIGHT_AIRY_COVERAGE', 'LOW_WEIGHT_LANGUAGE', 'BARELY_THERE_SOFTNESS'],
  };

  // Phase 1J Wispy foundation. The canonical identity is the visible accent-
  // to-support texture outcome; every physical and numeric execution choice
  // remains explicitly variant- or school-dependent.
  const wispyConstructionDefinition = identity('construction.wispy', 'Wispy', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['wispy'],
  });
  wispyConstructionDefinition.professionalDefinition = {
    outcomeType: 'WISPY_ACCENT_TO_SUPPORT_TEXTURE',
    invariantOutcome: {
      visibleLengthVariation: 'CONTROLLED_VISIBLE_LENGTH_VARIATION',
      accentArchitecture: 'REPEATED_ACCENT_WISPS',
      topLine: 'BROKEN_NON_UNIFORM_TOP_LINE',
      textureContrast: 'ACCENT_TO_SUPPORT_TEXTURE_CONTRAST',
      finish: 'DIMENSIONAL_TEXTURED_FINISH',
    },
    outcomeVsExecution: {
      invariant: 'CONTROLLED_REPEATED_ACCENT_WISPS_OVER_SUPPORT_WITH_BROKEN_DIMENSIONAL_TOP_LINE',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT', universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
    },
    spikeWispArchitecture: {
      canonicalTerm: 'ACCENT_WISPS_OR_PIECES',
      spikeTermScope: 'PHYSICAL_EXECUTION_CLASS_ONLY',
      accentPieces: 'ESSENTIAL',
      visibleLengthHierarchy: 'ESSENTIAL_QUALITATIVE',
      brokenTopLine: 'ESSENTIAL',
      supportingFieldRelationship: 'ESSENTIAL_CONCEPTUAL',
      exactHierarchy: null,
      regularity: 'VARIANT_DEPENDENT',
      clustering: null,
      exactSpikeConstruction: 'SCHOOL_DEPENDENT',
      universalSpikePlan: null,
    },
    supportingField: {
      role: 'ESSENTIAL_CONCEPT',
      continuousBase: 'NOT_UNIVERSALLY_REQUIRED',
      baseDensity: 'VARIANT_DEPENDENT',
      layeredSpikeOverBase: 'COMMON_SCHOOL_DEPENDENT_METHOD',
      mixedLengthsIntegrated: 'LEGITIMATE_ALTERNATIVE',
      universalLayerCount: null,
    },
    relationships: {
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'EXECUTION_CONTRIBUTOR',
        selection: 'SCHOOL_OR_VARIANT_DEPENDENT', constructionId: null,
        recognizedMethodClasses: ['OPEN_FANS', 'CLOSED_FANS', 'NARROW_FANS', 'MIXED_FANS', 'CLASSIC_CONSTRUCTIONS', 'HYBRID_CONSTRUCTIONS', 'CLOSED_FAN_ACCENTS'],
        recognizedMethodClassesAreUniversalRequirements: false, universalFanMethod: null,
      },
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      layering: {
        role: 'SCHOOL_DEPENDENT', discreteSpikeOverBase: 'COMMON_NON_UNIVERSAL_METHOD',
        mixedIntegratedLengths: 'LEGITIMATE_ALTERNATIVE', universalLayeringMethod: null, universalLayerCount: null,
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', strategyId: null,
        maySupport: ['ACCENT_SEPARATION', 'VISUAL_RHYTHM', 'PRESENTATION', 'AVOIDANCE_OF_CROSSING', 'GEOMETRY_READABILITY'],
        identityDefining: false, numericAngles: null, directionVectors: null, directionalZones: null, universalSweep: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'NOT_PART_OF_EFFECT', selection: 'VARIANT_DEPENDENT',
        strategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
      },
    },
    densityFinish: {
      qualitativeIntent: ['TEXTURED', 'BROKEN_NON_UNIFORM_TOP_LINE', 'DIMENSIONAL', 'VISIBLE_ACCENT_VARIATION'],
      variantDimensions: ['AIRY', 'SOFT', 'BOLD', 'FLUFFY', 'SEPARATED', 'DENSE', 'GRAPHIC'],
      exactDensity: null, lightOrAiryMandatory: false,
    },
    visualBoundaryWithAngel: {
      angelConstructionId: 'construction.angel',
      strongerVisibleAccentToSupportContrast: 'SUPPORTED',
      moreExplicitAccentWisps: 'SUPPORTED',
      moreTopLineArchitecture: 'SUPPORTED',
      controlledIrregularOrVariableRhythm: 'SUPPORTED',
      lessUniformlySoft: 'SCHOOL_DEPENDENT',
      separateBaseAndSpikeLayers: 'SCHOOL_DEPENDENT',
      angelAsWispySubtype: 'SCHOOL_DEPENDENT_OR_SEMANTIC',
      taxonomyBoundary: 'SCHOOL_DEPENDENT_OVERLAP', mutuallyExclusive: false,
    },
    relationshipWithKimK: {
      kimKConstructionId: 'construction.kim-k',
      status: 'PROVISIONAL_SCHOOL_DEPENDENT_RELATIONSHIP',
      possibleStructuredBoldSubtypeInSomeSchools: true,
      canonicalSubtypeClaim: false, universalHierarchy: null,
    },
    futureVariantNamespace: {
      status: 'REQUIRES_SEPARATE_REVIEW',
      potentialDimensions: ['SOFT', 'BOLD', 'CLASSIC', 'HYBRID', 'VOLUME', 'OPEN_FAN', 'CLOSED_FAN_ACCENT', 'LAYERED', 'MIXED_LENGTH', 'ORGANIC_RHYTHM', 'STRUCTURED_RHYTHM', 'ANGEL_OVERLAP', 'KIM_K_RELATIONSHIP', 'GEOMETRY_CARRIER_CHOICE'],
      canonicalVariantIdsCreated: false,
    },
    exactAccentCount: null,
    exactAccentFrequency: null,
    exactAccentSpacing: null,
    exactLengthHierarchy: null,
    exactLengthDelta: null,
    exactPlacement: null,
    exactFanCount: null,
    exactFanWidth: null,
    exactDiameter: null,
    exactVolume: null,
    exactLayerCount: null,
    exactMillimeters: null,
    unresolved: ['EXACT_ACCENT_HIERARCHY', 'EXACT_REGULARITY', 'CLUSTERING', 'UNIVERSAL_SPIKE_CONSTRUCTION', 'UNIVERSAL_FAN_METHOD', 'BASE_LAYER_EXECUTION', 'UNIVERSAL_LAYERING_METHOD', 'EXACT_DENSITY', 'GEOMETRY_COMPATIBILITY', 'ANGEL_WISPY_TAXONOMY_BOUNDARY', 'KIM_K_WISPY_TAXONOMY_BOUNDARY', 'NUMERIC_EXECUTION_PARAMETERS'],
  };
  wispyConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  wispyConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1j-wispy-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['CONTROLLED_VISIBLE_LENGTH_VARIATION', 'REPEATED_ACCENT_WISPS', 'BROKEN_NON_UNIFORM_TOP_LINE', 'ACCENT_TO_SUPPORT_TEXTURE_CONTRAST', 'DIMENSIONAL_TEXTURED_FINISH', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1J_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_CONSTRUCTION_OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1J_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Accent hierarchy, regularity, clustering, spike and fan construction, base/layer execution, density, geometry compatibility, Angel and Kim K taxonomy boundaries, and all numeric execution remain unresolved or school-dependent.'],
  };
  wispyConstructionDefinition.legacyReference = {
    legacyIds: ['wispy', 'wispycat', 'wispydoll'], legacyAliases: [],
    relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    records: [
      { legacyId: 'wispy', templateMm: [7, 8, 9, 10, 8], peakZone: 3, applicationTechnique: 'Light Volume 2D' },
      { legacyId: 'wispycat', templateMm: [7, 8, 9, 11, 9], peakZone: 3, applicationTechnique: 'Light Volume 2D' },
      { legacyId: 'wispydoll', templateMm: [7, 9, 10, 10, 8], peakZone: 2, applicationTechnique: 'Volume 3D' },
    ],
    topology: { plateauShape: 'linear', postPeakShape: 'linear' },
    curlOptions: ['B', 'C', 'CC', 'D', 'L'],
    textureExecution: { pattern: 'uniform', frequency: 2, deltas: [1.5, 2, 1.5], deterministicJitter: true, tallAlternation: true, shortMultiplier: 0.35 },
    scoring: 'LEGACY_PRODUCTION_ONLY',
    normalizedGeometry: null, templateMm: null, scoreCoefficients: null, spikeDeltas: null,
    textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
  };
  // Phase 1R candidate reference template only (see the Anime template below
  // for the full disclaimer -- identical status here). Wispy: an explicit
  // full 6-point base layer plus a full 6-point peak/spike layer, 1:1
  // positionally aligned, exactly as transcribed by the requester.
  // Deliberately kept OFF wispyConstructionDefinition itself (see the Wet
  // template above for why -- same reasoning, same library.referenceTemplates
  // destination).
  const wispyReferenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    baseProfile: [
      { order: 0, position: 'INNER', lengthMm: 7 },
      { order: 1, position: 'INNER_BODY', lengthMm: 8 },
      { order: 2, position: 'BODY', lengthMm: 8 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 9 },
      { order: 4, position: 'PEAK', lengthMm: 10 },
      { order: 5, position: 'OUTER', lengthMm: 12 },
    ],
    spikes: [
      { order: 0, position: 'INNER', lengthMm: 10 },
      { order: 1, position: 'INNER_BODY', lengthMm: 11 },
      { order: 2, position: 'BODY', lengthMm: 11 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 12 },
      { order: 4, position: 'PEAK', lengthMm: 13 },
      { order: 5, position: 'OUTER', lengthMm: 15 },
    ],
    correctionGoal: null,
    notes: [
      'Base 7→8→8→9→10→12, separate peaks 10→11→11→12→13→15, per the requester\'s transcription -- two explicit, equal-length, positionally-aligned layers.',
      'Unlike the pre-existing legacyReference.textureExecution delta-generator above (uniform deltas applied to a single flat templateMm array), this template stores the base and peak layers as two independent explicit arrays -- the data-model gap the audit for this phase specifically identified.',
    ],
  };

  // Phase 1K Kim K foundation. The reviewed identity is the qualitative
  // structured accent hierarchy; physical execution and its relationship to
  // Wispy and Rays remain explicitly school- or variant-dependent.
  const kimKConstructionDefinition = identity('construction.kim-k', 'Kim K', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['kim'], legacyAliases: ['Rays', 'Spikes', 'Soft Rays', 'Textured Effect'],
  });
  kimKConstructionDefinition.professionalDefinition = {
    outcomeType: 'KIM_K_STRUCTURED_ACCENT_HIERARCHY',
    invariantOutcome: {
      hierarchy: 'DELIBERATELY_STRUCTURED_ACCENT_HIERARCHY',
      accentArchitecture: 'REPEATED_VISIBLE_ACCENT_SPIKES_OR_WISPS',
      supportRelationship: 'ACCENT_TO_SUPPORT_HIERARCHY',
      topLine: 'SEGMENTED_BROKEN_TOP_LINE',
      finish: 'DIMENSIONAL_INTENTIONALLY_STYLED_TEXTURE',
      rhythm: 'READABLE_REPEATED_ACCENT_RHYTHM',
    },
    outcomeVsExecution: {
      invariant: 'STRUCTURED_REPEATED_VISIBLE_ACCENT_HIERARCHY_OVER_SUPPORT_WITH_SEGMENTED_DIMENSIONAL_TOP_LINE',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT', universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
    },
    spikeWispHierarchy: {
      primaryVisibleAccents: 'ESSENTIAL',
      supportingField: 'ESSENTIAL_CONCEPT',
      qualitativeAccentHierarchy: 'ESSENTIAL',
      repeatedPattern: 'ESSENTIAL_QUALITATIVE',
      secondaryAccentTier: 'OPTIONAL_OR_SCHOOL_DEPENDENT',
      variableProminence: 'COMMON_VARIANT',
      exactAlternatingPattern: 'NOT_UNIVERSAL',
      clustering: 'SCHOOL_DEPENDENT',
      controlledIrregularity: 'SCHOOL_DEPENDENT',
      universalHierarchy: null,
      universalSpikePlan: null,
    },
    spacingRhythm: {
      qualitativeRequirement: 'INTENTIONALLY_PLACED_REPEATED_ACCENTS_MAINTAIN_READABLE_HIERARCHY',
      exactRhythm: 'SCHOOL_DEPENDENT_UNRESOLVED',
      equalSpacingRequired: false,
      semiRegularSpacingRequired: false,
      organicSpacingRequired: false,
      clusteringRequired: false,
      symmetricalIntervalsRequired: false,
      exactSpacing: null,
    },
    supportingFieldBase: {
      visuallyDistinctSupportingField: 'ESSENTIAL_CONCEPT',
      shorterBase: 'COMMON_VARIANT',
      spikeOverBaseConstruction: 'COMMON_SCHOOL_DEPENDENT_METHOD',
      integratedMixedLengths: 'LEGITIMATE_ALTERNATIVE',
      separatePhysicalLayers: 'SCHOOL_DEPENDENT',
      exactBaseDensity: null,
      universalBaseConstruction: null,
    },
    relationships: {
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'EXECUTION_CONTRIBUTOR', constructionId: null,
        closedFanSpikes: 'COMMON_PRIMARY_VARIANT',
        narrowOrNearlyClosedSpikes: 'COMMON_PRIMARY_VARIANT',
        openSupportingFans: 'COMMON_VARIANT',
        classicSingleAccents: 'COMMON_VARIANT',
        mixedFans: 'COMMON_VARIANT',
        layeredCombinations: 'COMMON_VARIANT',
        universalFanConstruction: null,
      },
      layering: {
        role: 'SCHOOL_DEPENDENT',
        spikeOverBaseLayering: 'COMMON_SCHOOL_DEPENDENT_METHOD',
        integratedMixedLengthConstruction: 'LEGITIMATE_ALTERNATIVE',
        universalLayeringMethod: null, universalLayerCount: null,
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', strategyId: null,
        maySupport: ['CLEAN_ACCENT_SEPARATION', 'SPIKE_READABILITY', 'AVOIDANCE_OF_CROSSING', 'DELIBERATE_RHYTHM', 'PRESERVATION_OF_SELECTED_GEOMETRY'],
        numericAngles: null, directionVectors: null, directionalZones: null, universalSweep: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'NOT_PART_OF_EFFECT', selection: 'VARIANT_DEPENDENT',
        strategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
        recognizedVariantClasses: ['CLASSIC_ASSISTED', 'HYBRID', 'VOLUME', 'MIXED_EXECUTION'],
        recognizedVariantClassesAreUniversalRequirements: false,
      },
    },
    relationshipWithWispy: {
      wispyConstructionId: 'construction.wispy',
      relationship: 'SCHOOL_DEPENDENT_RELATIONSHIP',
      strongerSpikeHierarchy: 'SUPPORTED',
      strongerAccentToSupportContrast: 'SUPPORTED',
      moreIntentionalAccentPlacement: 'SUPPORTED',
      moreStructuredRhythm: 'SUPPORTED_WITH_SCHOOL_DEPENDENT_EXACT_REGULARITY',
      graphicEditorialFinish: 'SCHOOL_DEPENDENT',
      clearerSpikeOverBaseRelationship: 'SCHOOL_DEPENDENT',
      predictableAccentRepetition: 'SCHOOL_DEPENDENT',
      alwaysBolderThanWispy: 'SCHOOL_DEPENDENT',
      alwaysWispySubtype: 'SEMANTIC_OR_SCHOOL_DEPENDENT',
      universallySeparateFromWispy: 'UNRESOLVED',
      mutuallyExclusive: false,
    },
    relationshipWithRays: {
      raysConstructionId: 'construction.rays',
      relationship: 'SCHOOL_DEPENDENT_OVERLAP',
      professionallyIdentical: false,
      possibleTermScopes: ['ACCENT_OR_SPIKE_PRIMITIVE', 'BROADER_NAMED_FAMILY', 'SCHOOL_SPECIFIC_TERMINOLOGY'],
      exactTaxonomy: 'UNRESOLVED_PENDING_RAYS_SPECIFIC_AUDIT',
      canonicalAliasRelationship: false,
    },
    densityFinish: {
      essential: ['TEXTURED', 'DIMENSIONAL', 'VISIBLY_ACCENTED', 'SEGMENTED_TOP_LINE'],
      graphic: 'COMMON_VARIANT', bold: 'COMMON_VARIANT', dramatic: 'COMMON_VARIANT',
      dense: 'VARIANT_DEPENDENT', airy: 'VARIANT_DEPENDENT', editorial: 'VARIANT_DEPENDENT',
      exactDensity: null,
    },
    futureVariantNamespace: {
      status: 'REQUIRES_SEPARATE_REVIEW',
      potentialDimensions: ['SOFT_KIM_K', 'BOLD_GRAPHIC_KIM_K', 'CLASSIC_ASSISTED_KIM_K', 'HYBRID_KIM_K', 'VOLUME_KIM_K', 'OPEN_SUPPORTING_FAN_KIM_K', 'CLOSED_NARROW_SPIKE_KIM_K', 'LAYERED_SPIKE_OVER_BASE_KIM_K', 'INTEGRATED_MIXED_LENGTH_KIM_K', 'REGULAR_RHYTHM', 'ORGANIC_RHYTHM', 'CLUSTERED_ACCENTS', 'WISPY_OVERLAP_INTERPRETATION', 'RAYS_OVERLAP_INTERPRETATION', 'GEOMETRY_CARRIER_SELECTION'],
      canonicalVariantIdsCreated: false,
    },
    exactSpikeCount: null,
    exactWispCount: null,
    exactFrequency: null,
    exactSpacing: null,
    exactMillimeters: null,
    exactLengthDelta: null,
    exactFanCount: null,
    exactFanWidth: null,
    exactDiameter: null,
    exactVolume: null,
    exactFanClosurePercentage: null,
    exactLayerCount: null,
    exactPlacementCoordinates: null,
    unresolved: ['EXACT_KIM_K_WISPY_TAXONOMY_BOUNDARY', 'EXACT_KIM_K_RAYS_TAXONOMY_BOUNDARY', 'MINIMUM_HIERARCHY_DISTINGUISHING_KIM_K_FROM_GENERAL_WISPY', 'EXACT_RHYTHM_OR_REGULARITY', 'CLUSTERING', 'UNIVERSAL_BASE_CONSTRUCTION', 'UNIVERSAL_LAYERING_METHOD', 'UNIVERSAL_FAN_METHOD', 'EXACT_DENSITY_OR_INTENSITY', 'GEOMETRY_COMPATIBILITY', 'DIRECTION_EXECUTION', 'CURL_SELECTION', 'APPLICATION_TECHNIQUE', 'ALL_NUMERIC_EXECUTION_PARAMETERS', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS'],
  };
  kimKConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  kimKConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1k-kim-k-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['DELIBERATELY_STRUCTURED_ACCENT_HIERARCHY', 'REPEATED_VISIBLE_ACCENT_SPIKES_OR_WISPS', 'ACCENT_TO_SUPPORT_HIERARCHY', 'SEGMENTED_BROKEN_TOP_LINE', 'DIMENSIONAL_INTENTIONALLY_STYLED_TEXTURE', 'READABLE_REPEATED_ACCENT_RHYTHM', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1K_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_CONSTRUCTION_OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1K_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Kim K remains a separate named identity with school-dependent relationships to Wispy and Rays; all execution methods, compatibility, taxonomy precision, and numeric parameters remain unresolved or school-dependent.'],
  };
  kimKConstructionDefinition.legacyReference = {
    legacyIds: ['kim'], legacyAliases: ['Rays', 'Spikes', 'Soft Rays', 'Textured Effect'],
    relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 3 }, templateMm: [6, 10, 7, 11, 8],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    applicationTechnique: 'Volume 3D', curl: { base: 'C', options: ['C', 'CC', 'D'] },
    textureExecution: { pattern: 'kim', frequency: 3, baseToSpikeDiff: 3, alternation: 'TALL_SHORT_TALL', shortPieceMultiplier: 0.35, derivedShortDelta: 1.05, generatedPieces: 12, countedTallSpikes: 8, placement: 'QUARTER_INTERVAL', jitter: 'NONE', mainSpikeZone: 'DERIVED', rounding: 'ONE_DECIMAL' },
    scoreCoefficients: { base: 35, wideSetBonus: 12, confidenceThreshold: 0.55, confidenceBonus: 14, almondCoefficient: 8 },
    applicationPlanClaims: ['UNIVERSAL_TWO_LAYER_LANGUAGE', 'RUNTIME_DERIVED_EXACT_BASE_SPIKE_RANGES_AND_COUNTS'],
    spikeDeltas: null, textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1M Natural foundation. The reviewed record expresses only a
  // qualitative mapping silhouette; technique, curl, construction, density,
  // numeric templates, and all client personalization remain separate.
  const naturalDefinition = identity('geometry.natural', 'Natural', 'MAPPING_GEOMETRY', {
    status: 'EXPERT_REVIEWED', legacyIds: ['natural', 'naturalRounded', 'naturalElongated'],
  });
  naturalDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'GRADUAL_BALANCED_LENGTH_PROGRESSION',
      maximum: 'BROAD_MODEST_CENTRAL_TO_NEAR_CENTRAL_MAXIMUM',
      innerRise: 'SMOOTH_INNER_TO_BODY_RISE',
      outerFinish: 'CONTROLLED_NON_ABRUPT_OUTER_FINISH',
      silhouette: 'BALANCED_NON_DRAMATIC_SILHOUETTE',
      intent: 'PRESERVE_OR_SOFTLY_ENHANCE_NATURAL_EYE_IMPRESSION',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_MAXIMUM' },
        { region: 'TRANSITION', relationship: 'GRADUAL_CONTROLLED_RISE' },
        { region: 'BODY', relationship: 'APPROACHES_BROAD_MODEST_MAXIMUM' },
        { region: 'CENTRAL_OR_NEAR_CENTRAL', relationship: 'MAXIMUM_REGION' },
        { region: 'OUTER', relationship: 'CONTROLLED_REDUCTION_OR_MILD_TAPER' },
      ],
    },
    maximum: {
      region: 'BROAD_CENTRAL_TO_NEAR_CENTRAL', prominence: 'MODEST',
      exactPosition: null, anatomyDependent: true, plateauAllowed: 'UNRESOLVED',
      exactPlateauBoundaries: null,
    },
    topology: {
      rise: 'GRADUAL_ORGANIC', shoulder: 'BROAD_SOFT_MAXIMUM_ALLOWED_PENDING_PLATEAU_REVIEW',
      postPeak: 'CONTROLLED_NON_ABRUPT_TRANSITION',
      outerBehavior: 'NON_DRAMATIC_ANATOMY_DEPENDENT_FINISH',
    },
    innerBehavior: {
      relationshipToMaximum: 'BELOW_MAXIMUM', transition: 'GRADUAL_CONTROLLED_RISE',
      exactLength: null, exactSlope: null, personalization: 'REQUIRED',
      absoluteShortestRequired: false,
    },
    outerBehavior: {
      relationshipToMaximum: 'CONTROLLED_REDUCTION_OR_MILD_TAPER', tailIntent: 'NON_DRAMATIC',
      exactDrop: null, exactSlope: null, personalization: 'REQUIRED',
      anatomyDependentLengthPreservationAllowed: true,
    },
    primaryIntent: 'PRESERVE_OR_SOFTLY_ENHANCE_NATURAL_EYE_IMPRESSION',
    excludedDefiningIntents: ['CENTRAL_OPENING', 'PRE_OUTER_LIFT', 'FELINE_OUTER_LIFT', 'TEMPORAL_HORIZONTAL_ELONGATION'],
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'SEPARATE_LAYER', curlStrategyId: null },
      fanConstruction: { domain: 'FAN_CONSTRUCTION', selection: 'SEPARATE_LAYER', fanConstructionId: null },
      constructionRecipe: { domain: 'CONSTRUCTION_RECIPE', selection: 'SEPARATE_LAYER', constructionId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: null },
    },
    densityFinish: { exactDensity: null, exactDiameter: null, exactVolume: null, exactLayerCount: null },
    crossEffectComparison: {
      doll: {
        geometryId: 'geometry.doll', dollIntent: 'EXPLICIT_CENTRAL_OPENING',
        dollMaximum: 'MORE_PROMINENT_CENTRAL_MAXIMUM_OR_PLATEAU',
        dollComposition: 'STRONGER_SYMMETRICAL_OPENING',
        naturalMaximum: 'MODEST_BROAD_CENTRAL_OR_NEAR_CENTRAL',
        naturalRelationship: 'MORE_ANATOMY_FOLLOWING', naturalCentralOpeningDefining: false,
        distinctionStatus: 'SUPPORTED', exactBoundary: 'UNRESOLVED', naturalUniversallyForbidsPlateau: 'UNRESOLVED',
      },
      squirrel: {
        geometryId: 'geometry.squirrel', squirrelMaximum: 'PRE_OUTER', squirrelIntent: 'OUTER_LIFT',
        squirrelOuterBehavior: 'CONTROLLED_DECLINE_TOWARD_PHYSICAL_OUTER',
        naturalMaximum: 'BROAD_CENTRAL_OR_NEAR_CENTRAL', naturalPreOuterLiftDefining: false,
        naturalOuterFinish: 'GENTLER_NON_DRAMATIC', exactBoundaryCoordinates: null,
      },
      cat: {
        geometryId: 'geometry.cat', naturalLateOuterMaximumDefining: false,
        naturalFelineLiftRequired: false, naturalTemporalElongationRequired: false,
        naturalStrongTailIdentity: false, directionDependency: 'LOWER_THAN_CAT',
      },
      fox: {
        geometryId: 'geometry.fox', naturalLateOuterMaximumDefining: false,
        naturalFelineLiftRequired: false, naturalTemporalElongationRequired: false,
        naturalStrongTailIdentity: false, directionDependency: 'LOWER_THAN_FOX',
      },
    },
    variants: {
      canonicalVariantIdsCreated: false, taxonomyStatus: 'UNRESOLVED',
      legacyRoles: 'LEGACY_REFERENCE_VARIANT_AND_PERSONALIZATION_EVIDENCE_ONLY',
      potentialDimensions: ['ROUNDED_NATURAL', 'ELONGATED_NATURAL', 'CENTRAL_SOFT_NATURAL', 'NEAR_CENTRAL_NATURAL', 'OUTER_PRESERVING_NATURAL', 'STRONGER_TAPER_NATURAL', 'ANATOMY_MATCHED_NATURAL'],
    },
    personalizationBoundary: {
      canonicalFields: ['GRADUAL_BALANCED_PROGRESSION', 'MODEST_BROAD_CENTRAL_OR_NEAR_CENTRAL_MAXIMUM', 'SMOOTH_RISE', 'CONTROLLED_OUTER_FINISH', 'NATURAL_EYE_IMPRESSION_INTENT'],
      clientOwnedFields: ['ROUNDED_OR_ELONGATED_PRESENTATION', 'EXACT_PEAK_SHIFT', 'EXACT_PLATEAU_WIDTH', 'OUTER_TAPER_STRENGTH', 'MAXIMUM_LENGTH', 'INNER_STARTING_LENGTH', 'ASYMMETRY_ADJUSTMENT', 'EYE_SHAPE_ADAPTATION', 'HOODING_VISIBILITY', 'DIRECTION_REFINEMENTS', 'NATURAL_LASH_CONDITION_CONSTRAINTS'],
    },
    unresolved: ['EXACT_MAXIMUM_REGION', 'PLATEAU_ALLOWANCE', 'MAXIMUM_PROMINENCE_BOUNDARY_WITH_DOLL', 'NATURAL_SQUIRREL_EXACT_BOUNDARY', 'NATURAL_CAT_FOX_SOFT_BOUNDARY', 'OUTER_TAPER_VS_LENGTH_PRESERVATION', 'INNER_TRANSITION_VARIATION', 'ROUNDED_ELONGATED_VARIANT_TAXONOMY', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY', 'TECHNIQUE_COMPATIBILITY', 'CURL_SELECTION', 'DENSITY_OR_FINISH', 'NATURAL_LASH_PERSONALIZATION', 'ASYMMETRY_PERSONALIZATION', 'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS'],
  };
  naturalDefinition.templateMm = {
    purpose: 'STARTING_TEMPLATE_ONLY', universal: false, values: null,
    resolution: 'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED',
  };
  naturalDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  naturalDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1m-natural-geometry-foundation', type: 'REVIEWED_PROFESSIONAL_GEOMETRY_FOUNDATION',
      scope: ['GRADUAL_BALANCED_LENGTH_PROGRESSION', 'BROAD_MODEST_CENTRAL_TO_NEAR_CENTRAL_MAXIMUM', 'SMOOTH_INNER_TO_BODY_RISE', 'CONTROLLED_NON_ABRUPT_OUTER_FINISH', 'BALANCED_NON_DRAMATIC_SILHOUETTE', 'PRESERVE_OR_SOFTLY_ENHANCE_NATURAL_EYE_IMPRESSION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1M_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_MAPPING_GEOMETRY_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1M_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Natural is reviewed only as qualitative mapping geometry; maximum precision, variants, compatibility, personalization, and all numeric templates remain unresolved.'],
  };
  naturalDefinition.legacyReference = {
    legacyIds: ['natural', 'naturalRounded', 'naturalElongated'],
    legacyAliases: ['Natural Correction', 'Classic Natural', 'Rounded Natural', 'Elongated Natural'],
    relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    records: [
      { legacyId: 'natural', templateMm: [7, 8, 9, 9, 8], peakZone: 3, applicationTechnique: 'Classic 1:1', curl: { base: 'C', options: ['B', 'C', 'CC'] } },
      { legacyId: 'naturalRounded', templateMm: [6, 8, 9, 9, 7], peakZone: 2, applicationTechnique: 'Classic 1:1', curl: { base: 'C', options: ['B', 'C', 'CC'] } },
      { legacyId: 'naturalElongated', templateMm: [7, 8, 9, 10, 9], peakZone: 3, applicationTechnique: 'Classic 1:1', curl: { base: 'C', options: ['B', 'C', 'CC'] } },
    ],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    scoring: 'LEGACY_PRODUCTION_ONLY', runtimePersonalization: 'LEGACY_PRODUCTION_ONLY', textureAssignment: 'smooth',
    normalizedGeometry: null, templateMm: null, scoreCoefficients: null, spikeDeltas: null,
    textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
  };

  // Phase 1N Classic foundation. The reviewed invariant is a pure application
  // technique — one single extension applied to one isolated, suitable
  // natural lash. Classic is not a mapping geometry, fan strategy, preset,
  // fixed curl, fixed diameter, or fixed density, and it does not require
  // geometry.natural. Attachment conventions, the manufactured split/Y/forked
  // product boundary, direction, and every numeric safety limit remain
  // school-dependent or unresolved.
  const classicTechniqueDefinition = identity('technique.classic-one-to-one', 'Classic', 'APPLICATION_TECHNIQUE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['classic'], legacyAliases: ['Classic 1:1'],
  });
  classicTechniqueDefinition.professionalDefinition = {
    outcomeType: 'ONE_TO_ONE_APPLICATION_TECHNIQUE',
    coreInvariant: {
      unit: 'ONE_SINGLE_EXTENSION_APPLIED_TO_ONE_ISOLATED_SUITABLE_NATURAL_LASH',
      extensionsPerNaturalLash: 'EXACTLY_ONE',
      dependency: 'NOT_SCHOOL_DEPENDENT',
    },
    excludedDefiningTraits: {
      isMappingGeometry: false,
      isFanStrategy: false,
      isPreset: false,
      isNaturalGeometry: false,
      hasFixedCurl: false,
      hasFixedDiameter: false,
      hasFixedDensity: false,
    },
    attachment: {
      isolatedNaturalLashRequired: true,
      everyNaturalLashMustBeExtended: false,
      suitabilityAssessmentRequired: true,
      numericCoverageRequirement: null,
      coverageTerminology: 'SCHOOL_OR_VARIANT_DEPENDENT_UNRESOLVED',
    },
    fanConstructionBoundary: {
      pureClassicUnit: 'ONE_SINGLE_EXTENSION',
      fanConstructionId: null,
      multiExtensionVolumeFansExcludedFromPureUnit: true,
      classicFanStrategyCreated: false,
      manufacturedExtensionClassification: 'UNRESOLVED_SPLIT_Y_FORKED_BOUNDARY',
    },
    geometryRelationship: {
      domain: 'MAPPING_GEOMETRY', role: 'SEPARATE_CARRIER_SLOT',
      geometryId: null, universalCompatibleIds: [], requiresNaturalGeometry: false,
    },
    curl: { domain: 'CURL_STRATEGY', role: 'SEPARATE_LAYER', curlStrategyId: null, exactCurl: null },
    diameter: { role: 'CLIENT_LASH_DEPENDENT', exactValue: null },
    densityFinish: { exactDensity: null, fullCoverageRequired: false, naturalFinishRequired: false },
    direction: {
      domain: 'DIRECTION_STRATEGY', role: 'SEPARATE_SECONDARY_LAYER', strategyId: null,
      numericAngles: null, directionVectors: null, classicDirectionIdentityCreated: false,
    },
    safetySuitability: {
      automaticSafetyClaim: false,
      clientSpecificAssessmentRequired: true,
      universalNumericLimits: null,
    },
    crossEffectComparison: {
      volume: {
        classicUnit: 'ONE_SINGLE_EXTENSION',
        volumeUnit: 'MULTIPLE_EXTENSIONS_FORMING_A_FAN',
        sharedTarget: 'ONE_ISOLATED_SUITABLE_NATURAL_LASH',
        distinction: 'QUALITATIVE_ONLY',
        volumeProfessionalDefinitionCreated: false,
      },
      hybrid: {
        status: 'UNRESOLVED',
        canonicalHybridDomainEstablished: false,
        ratios: null, patterns: null, density: null,
      },
    },
    schoolDependency: {
      coreInvariant: 'NOT_SCHOOL_DEPENDENT',
      detailedExecutionProtocol: 'SCHOOL_DEPENDENT',
      status: 'PARTIALLY_SCHOOL_DEPENDENT',
    },
    unresolved: [
      'ATTACHMENT_CONVENTIONS', 'SPLIT_Y_FORKED_PRODUCT_BOUNDARY', 'COVERAGE_TERMINOLOGY',
      'TEXTURED_CLASSIC_TERMINOLOGY', 'SINGLE_BASED_WET_TERMINOLOGY', 'GEOMETRY_COMPATIBILITY',
      'DIRECTION_CONVENTIONS', 'SUITABILITY_PROTOCOL', 'PRODUCT_MASS_SHAPE_DIAMETER_MATERIAL_EFFECTS',
      'REGIONAL_TERMINOLOGY', 'HYBRID_CANONICAL_DOMAIN', 'NUMERIC_SAFETY_LIMITS',
    ],
  };
  classicTechniqueDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  classicTechniqueDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1n-classic-technique-foundation', type: 'REVIEWED_PROFESSIONAL_APPLICATION_TECHNIQUE_FOUNDATION',
      scope: ['ONE_SINGLE_EXTENSION_PER_ISOLATED_SUITABLE_NATURAL_LASH', 'APPLICATION_TECHNIQUE_IDENTITY', 'SEPARATE_FROM_MAPPING_GEOMETRY_FAN_CURL_DIAMETER_DENSITY', 'SUITABILITY_ASSESSMENT_REQUIRED'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1N_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_APPLICATION_TECHNIQUE_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1N_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Classic is reviewed only as a qualitative one-to-one application technique; attachment conventions, the manufactured split/Y/forked product boundary, geometry/direction/curl/diameter/density compatibility, suitability protocol, and the Volume/Hybrid canonical domains remain unresolved or school-dependent.'],
  };
  classicTechniqueDefinition.legacyReference = {
    legacyIds: ['classic'], legacyAliases: ['Classic 1:1'], relationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: null, templateMm: null, scoreCoefficients: null, spikeDeltas: null,
    textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: ['0.15–0.20 mm'],
  };

  // Phase 1O Anime foundation. The reviewed identity is a complete
  // texture/construction outcome — pronounced elongated accent spikes held
  // visibly separate from shorter supporting structure, producing a
  // deliberately segmented, graphic top-line result. Physical execution,
  // exact hierarchy, rhythm, spacing, supporting-base construction, and the
  // boundaries with Kim K, Wispy, and the not-yet-reviewed Jellyfish remain
  // explicitly unresolved or school-dependent. RAY may participate as a
  // reusable, non-universal execution primitive; it does not define Anime,
  // and Anime remains a complete construction, never a primitive.
  const animeConstructionDefinition = identity('construction.anime', 'Anime', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyIds: ['manga'], legacyAliases: ['Manga / Anime', 'Doll Anime', 'Spiky Anime'],
    legacyRelationship: 'INDEPENDENT_IDENTITY_FROM_LEGACY_COMBINED_LABEL',
  });
  animeConstructionDefinition.professionalDefinition = {
    outcomeType: 'ANIME_GRAPHIC_SEPARATED_ACCENT_DEFINITION',
    invariantOutcome: {
      accentArchitecture: 'PRONOUNCED_ELONGATED_ACCENT_STRUCTURE',
      accentToSupportHierarchy: 'VISIBLE_ACCENT_TO_SUPPORT_HIERARCHY',
      accentSeparation: 'CLEARLY_SEPARATED_ACCENT_PRESENTATION',
      topLine: 'INTENTIONAL_TOP_LINE_SEGMENTATION',
      finish: {
        role: 'ESSENTIAL_VISUAL_DESCRIPTOR', result: 'GRAPHIC_DEFINED_TEXTURE_OUTCOME',
        perceivedAppearanceOnly: true, numericContrastClaim: false,
      },
      contrast: 'CONTROLLED_CONTRAST_BETWEEN_DOMINANT_ACCENTS_AND_SUPPORTING_STRUCTURE',
      universallyLargestContrastInFamily: false,
      universalMillimeterDifference: null,
    },
    outcomeVsExecution: {
      invariant: 'PRONOUNCED_SEPARATED_ELONGATED_ACCENTS_OVER_SUPPORTING_STRUCTURE_WITH_SEGMENTED_GRAPHIC_TOP_LINE',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT',
      universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
    },
    spikeAccentArchitecture: {
      dominantElongatedAccents: 'ESSENTIAL_QUALITATIVE',
      accentSeparationFromSupport: 'ESSENTIAL_QUALITATIVE',
      exactSpikeCount: null,
      exactSpikeFrequency: null,
      exactSpacing: null,
      exactRegularity: 'UNRESOLVED',
      exactAlternation: 'UNRESOLVED',
      exactAccentWidth: null,
      exactFanConstruction: null,
      exactSpikeConstructionMethod: 'SCHOOL_DEPENDENT_UNRESOLVED',
      everyDivisionPointCarriesAccent: 'UNRESOLVED',
      primarySecondaryTierArchitecture: 'UNRESOLVED_SCHOOL_DEPENDENT',
    },
    hierarchy: {
      requirement: 'DOMINANT_ELONGATED_ACCENTS_MUST_REMAIN_VISIBLY_DISTINGUISHABLE_FROM_SUPPORTING_STRUCTURE',
      exactTierCount: 'UNRESOLVED',
      singleAccentTierUniversal: false,
      twoTierUniversal: false,
      secondaryAccentsUniversallyRequired: false,
      secondaryAccentsUniversallyExcluded: false,
      detailedTierArchitecture: 'UNRESOLVED_SCHOOL_DEPENDENT',
    },
    rhythmSpacing: {
      regularSpacingUniversal: false,
      irregularSpacingUniversal: false,
      exactRhythm: 'UNRESOLVED_SCHOOL_DEPENDENT',
      exactInterval: null,
      exactRepetition: null,
      clustering: 'UNRESOLVED_SCHOOL_DEPENDENT',
      exactRegularity: 'UNRESOLVED_SCHOOL_DEPENDENT',
    },
    supportingField: {
      role: 'ESSENTIAL_VISUAL_RELATIONSHIP_CONCEPT',
      universalBaseConstruction: null,
      continuousBaseUniversal: false,
      fanBaseUniversal: false,
      classicBaseUniversal: false,
      closedFanBaseUniversal: false,
      volumeBaseUniversal: false,
      universalLayerCount: null,
    },
    negativeSpace: {
      role: 'PROFESSIONALLY_RELEVANT_TO_GRAPHIC_OUTCOME',
      visibleSeparationBetweenDominantAccents: 'QUALITATIVELY_RELEVANT',
      universalNumericGap: null,
      universalGapPatternRequired: false,
      exactGapArchitecture: 'UNRESOLVED',
    },
    relationships: {
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', strategyId: null,
        maySupport: ['ACCENT_SEPARATION', 'GRAPHIC_PRESENTATION', 'AVOIDANCE_OF_CROSSING', 'GEOMETRY_READABILITY'],
        numericAngles: null, directionVectors: null, directionalZones: null, universalSweep: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'NOT_PART_OF_EFFECT', selection: 'VARIANT_DEPENDENT',
        strategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
      },
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'EXECUTION_CONTRIBUTOR', constructionId: null,
        recognizedMethodClasses: ['CLOSED_FAN_ACCENTS', 'NARROW_OR_NEARLY_CLOSED_FANS', 'CLASSIC_ASSISTED_ACCENTS', 'LAYERED_SPIKE_OVER_BASE', 'MIXED_CONSTRUCTIONS'],
        recognizedMethodClassesAreUniversalRequirements: false,
        universalFanConstruction: null,
      },
      layering: { role: 'SCHOOL_DEPENDENT', universalLayeringMethod: null, universalLayerCount: null },
    },
    rayPrimitiveRelationship: {
      primitiveId: 'RAY', role: 'POSSIBLE_NON_UNIVERSAL_EXECUTION_METHOD',
      required: false, usingRayAutomaticallyCreatesAnime: false, animeUniversallyRequiresRay: false,
      animeIsCompleteConstruction: true, rayIsReusablePrimitiveOnly: true,
    },
    densityFinish: {
      qualitativeIntent: ['GRAPHIC', 'DEFINED', 'SEGMENTED', 'BOLD_STATEMENT'],
      exactDensity: null, exactDiameter: null, exactVolume: null, exactFanWidth: null,
      exactLayerCount: null, exactExtensionCount: null, exactMaximumLength: null,
      exactBaseLength: null, exactSpikeLength: null,
    },
    crossEffectComparison: {
      kimK: {
        constructionId: 'construction.kim-k', status: 'SCHOOL_DEPENDENT_PROVISIONAL_UNRESOLVED_BOUNDARY',
        commonDistinguishingPresentation: 'ANIME_COMMONLY_PRESENTS_STRONGER_GRAPHIC_SPIKE_SEPARATION',
        universalNumericContrastDifference: false, mutuallyExclusive: false,
      },
      wispy: {
        constructionId: 'construction.wispy', status: 'SCHOOL_DEPENDENT_PROVISIONAL',
        commonDistinguishingPresentation: 'ANIME_COMMONLY_MORE_GRAPHIC_AND_PRONOUNCED_WHILE_WISPY_IS_SOFTER_AIRY_FEATHERED',
        numericThreshold: null, mutuallyExclusive: false,
      },
      jellyfish: {
        constructionId: 'construction.jellyfish', status: 'SCHOOL_DEPENDENT_POSSIBLE_TERMINOLOGY_OVERLAP_WITH_ANIME_MANGA',
        boundaryResolved: false, universalDistinctionFromAnime: false,
      },
    },
    futureVariantNamespace: {
      status: 'REQUIRES_SEPARATE_REVIEW',
      potentialDimensions: ['GRAPHIC_ANIME', 'SOFT_ANIME', 'DOLL_ANIME', 'SPIKY_ANIME', 'ANIME_KIM_K_OVERLAP', 'ANIME_WISPY_OVERLAP', 'GEOMETRY_CARRIER_CHOICE'],
      canonicalVariantIdsCreated: false,
    },
    exactSpikeCount: null,
    exactSpikeFrequency: null,
    exactSpacing: null,
    exactAccentWidth: null,
    exactFanCount: null,
    exactFanWidth: null,
    exactDiameter: null,
    exactVolume: null,
    exactLayerCount: null,
    exactExtensionCount: null,
    exactMillimeters: null,
    exactLengthDelta: null,
    unresolved: [
      'ANIME_VS_MANGA_TERMINOLOGY_BOUNDARY', 'EXACT_SPIKE_CONSTRUCTION', 'EXACT_HIERARCHY_OR_TIERING',
      'EXACT_RHYTHM', 'EXACT_SPACING', 'EXACT_REGULARITY', 'SUPPORTING_BASE_CONSTRUCTION', 'LAYERING',
      'FAN_CONSTRUCTION', 'GEOMETRY_COMPATIBILITY', 'DIRECTION_COMPATIBILITY', 'CURL_SELECTION',
      'TECHNIQUE_COMPATIBILITY', 'DENSITY', 'DIAMETER', 'VOLUME', 'NEGATIVE_SPACE_ARCHITECTURE',
      'ANIME_KIM_K_BOUNDARY', 'ANIME_WISPY_BOUNDARY', 'ANIME_JELLYFISH_BOUNDARY', 'REGIONAL_OR_SCHOOL_TERMINOLOGY',
    ],
  };
  animeConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  animeConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1o-anime-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['PRONOUNCED_ELONGATED_ACCENT_STRUCTURE', 'VISIBLE_ACCENT_TO_SUPPORT_HIERARCHY', 'CLEARLY_SEPARATED_ACCENT_PRESENTATION', 'INTENTIONAL_TOP_LINE_SEGMENTATION', 'GRAPHIC_DEFINED_TEXTURE_OUTCOME', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1O_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_CONSTRUCTION_OUTCOME_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1O_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Exact spike construction, hierarchy/tiering, rhythm, spacing, supporting-base construction, layering, fan construction, geometry/direction/curl/technique compatibility, density, negative-space architecture, and the Anime/Kim K/Wispy/Jellyfish/Manga terminology boundaries remain unresolved or school-dependent.'],
  };
  animeConstructionDefinition.legacyReference = {
    legacyIds: ['manga'], legacyAliases: ['Manga / Anime', 'Doll Anime', 'Spiky Anime'],
    relationship: 'INDEPENDENT_IDENTITY_FROM_LEGACY_COMBINED_LABEL',
    numericDataRelationship: 'CURRENT_PRODUCTION_COMPARISON_ONLY',
    normalizedGeometry: { peakZone: 3 }, templateMm: [6, 9, 7, 12, 7],
    topology: { zonePositions: null, plateauShape: 'linear', postPeakShape: 'linear' },
    applicationTechnique: 'Volume 3D', curl: { base: 'D', options: ['CC', 'D', 'L+'] },
    textureExecution: { pattern: 'manga', frequency: 2, baseToSpikeDiff: 4, alternation: 'ALL_SEGMENTS_ACCENTED', jitter: 'NONE' },
    category: 'creative',
    scoreCoefficients: { base: 30, relativeEyeSizeThreshold: 0.36, relativeEyeSizeBonus: 16, confidenceThreshold: 0.5, confidenceBonus: 10 },
    spikeDeltas: null, textureFrequencies: null, curlLiftStrength: null, techniqueDiameters: null,
  };
  // Phase 1R candidate reference template only -- NOT a domain-reviewed
  // numeric claim (animeConstructionDefinition.professionalDefinition and
  // its EXPERT_REVIEWED status above are completely untouched by this
  // addition). Captures an explicit base-layer + spike-layer numeric split
  // from a single user-supplied visual reference: base is a continuous
  // shorter supporting curve, spikes are discrete accents positionally
  // aligned to the base at/above its length. Sequence taken exactly as
  // transcribed by the requester and assumed already expressed physical
  // INNER-to-OUTER (order ascending) -- this assumption is NOT independently
  // verified against the source image and should be confirmed before any
  // production use.
  //
  // Kept OFF animeConstructionDefinition itself, and off wetConstruction-
  // Definition/wispyConstructionDefinition above, on purpose: those three
  // objects are exactly what several pre-existing tests (Angel/Classic/
  // Jellyfish/Kim K/RAY/Wispy's own cross-effect tests) hash or
  // deepStrictEqual as proof that an unrelated phase left them byte-
  // identical. Mutating them in place would force a mechanical hash update
  // across every one of those files -- legitimate in principle (CLAUDE.md's
  // established process for exactly this), but avoidable entirely by
  // storing this phase's candidate numbers in a separate, parallel
  // `library.referenceTemplates` map instead (defined right after
  // `registries` below) keyed by the same canonical id, rather than
  // mutating the reviewed identity objects those guards already protect.
  const animeReferenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    baseProfile: [
      { order: 0, position: 'INNER', lengthMm: 8 },
      { order: 1, position: 'INNER_BODY', lengthMm: 9 },
      { order: 2, position: 'BODY', lengthMm: 10 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 11 },
      { order: 4, position: 'OUTER', lengthMm: 12 },
    ],
    spikes: [
      { order: 0, position: 'INNER', lengthMm: 9 },
      { order: 1, position: 'INNER_BODY', lengthMm: 10 },
      { order: 2, position: 'BODY', lengthMm: 12 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 13 },
      { order: 4, position: 'OUTER', lengthMm: 14 },
    ],
    correctionGoal: null,
    notes: [
      'Base ~8-12mm, distinct spikes at ~9/10/12/13/14mm, per the requester\'s transcription.',
      'Spikes are indexed 1:1 to baseProfile by `order`/`position`, matching the already-reviewed spikeAccentArchitecture relationship above (accent-to-support hierarchy) -- this template only adds numbers to that already-EXPERT_REVIEWED qualitative shape.',
    ],
  };

  // Phase 1P Jellyfish foundation. Unlike every other reviewed construction,
  // Jellyfish has NO repository production precedent — no legacy ID, no
  // legacy geometry, curl, technique, texture, or scoring ever existed for
  // it in this codebase. The candidate identity below rests on a single
  // detailed external professional source plus inference from adjacent
  // already-reviewed constructions, not on repository legacy data or
  // corroborated multi-source consensus, and is recorded as materially
  // lower-confidence than Wet/Angel/Wispy/Kim K/Anime. Its boundary with
  // Anime/Manga is explicitly left unresolved — at least one external
  // source treats the terms as overlapping or synonymous.
  const jellyfishConstructionDefinition = identity('construction.jellyfish', 'Jellyfish', 'CONSTRUCTION_RECIPE', {
    status: 'EXPERT_REVIEWED', legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  jellyfishConstructionDefinition.professionalDefinition = {
    outcomeType: 'JELLYFISH_IRREGULAR_SEPARATED_ACCENT_DEFINITION',
    identityConfidence: {
      basis: 'SINGLE_DETAILED_EXTERNAL_SOURCE_PLUS_ADJACENT_CONSTRUCTION_INFERENCE',
      repositoryProductionPrecedent: false,
      multiSourceCorroboration: false,
      resolution: 'LOW_CONFIDENCE_CANDIDATE_IDENTITY_PENDING_BROADER_REVIEW',
    },
    invariantOutcome: {
      accentArchitecture: 'SEPARATED_ELONGATED_DOMINANT_ACCENTS',
      hierarchy: 'STRONG_LONG_VS_SHORT_VISUAL_HIERARCHY',
      supportingFieldCharacter: 'COMPARATIVELY_SPARSE_OR_SOFT_SUPPORTING_FIELD',
      negativeSpace: 'VISIBLE_NEGATIVE_SPACE',
      composition: 'INTENTIONALLY_IRREGULAR_CONTROLLED_COMPOSITION',
      visualReference: 'POSSIBLE_TENTACLE_LIKE_PRESENTATION',
      finish: {
        role: 'CANDIDATE_VISUAL_DESCRIPTOR', result: 'CONTROLLED_ARTISTIC_IRREGULAR_TEXTURE_OUTCOME',
        perceivedAppearanceOnly: true, numericClaim: false, literalChaosClaim: false,
      },
    },
    outcomeVsExecution: {
      invariant: 'SEPARATED_ELONGATED_ACCENTS_OVER_SPARSE_SUPPORTING_FIELD_WITH_VISIBLE_NEGATIVE_SPACE_AND_CONTROLLED_IRREGULAR_COMPOSITION',
      executionMethodStatus: 'SCHOOL_OR_VARIANT_DEPENDENT',
      universalMethod: null,
      differentMethodsMayShareCanonicalIdentity: true,
      universallyRequiresClosedFans: false,
      universallyRequiresNarrowFans: false,
      universallyRequiresRay: false,
      universallyRequiresSpecificLayering: false,
      universallyRequiresSpecificFanConstruction: false,
      universallyRequiresSpecificVolume: false,
      universallyRequiresSpecificDensity: false,
      universallyRequiresSpecificApplicationTechnique: false,
    },
    spikeAccentArchitecture: {
      dominantElongatedAccents: 'ESSENTIAL_QUALITATIVE_CANDIDATE',
      exactSpikeCount: null,
      exactSpacing: null,
      exactRegularity: 'UNRESOLVED',
      exactSpikeWidth: null,
      exactLengthDelta: null,
      exactAlternation: 'UNRESOLVED',
      exactSpikeConstructionMethod: 'SCHOOL_DEPENDENT_UNRESOLVED',
    },
    hierarchy: {
      requirement: 'DOMINANT_ELONGATED_ACCENTS_OVER_SHORTER_SUPPORTING_FIELD',
      exactTierCount: 'UNRESOLVED',
      alternationPattern: 'UNRESOLVED',
      rhythm: 'UNRESOLVED_SCHOOL_DEPENDENT',
      exactLengthDelta: null,
    },
    supportingField: {
      role: 'CANDIDATE_QUALITATIVE_CONCEPT',
      candidateTraits: ['SOFT', 'COMPARATIVELY_SPARSE', 'SUBORDINATE_TO_DOMINANT_ACCENTS'],
      universalBaseConstruction: null,
      continuousBaseUniversal: false,
      fanBaseUniversal: false,
      closedFanBaseUniversal: false,
      universalLayerCount: null,
    },
    negativeSpace: {
      role: 'PROFESSIONALLY_RELEVANT_CANDIDATE_TRAIT',
      visibleGapsBetweenAccents: 'QUALITATIVELY_RELEVANT',
      universalNumericGap: null,
      exactInterval: null,
      exactFrequency: null,
      mandatoryRepeatingPattern: false,
      exactGapArchitecture: 'UNRESOLVED',
    },
    relationships: {
      geometry: {
        domain: 'MAPPING_GEOMETRY', role: 'MANDATORY_CARRIER_SLOT',
        selection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
      },
      direction: {
        domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', directionStrategyId: null,
        numericAngles: null, directionVectors: null, universalDirectionStrategy: null,
      },
      curl: {
        domain: 'CURL_STRATEGY', role: 'NOT_PART_OF_EFFECT', selection: 'VARIANT_DEPENDENT',
        curlStrategyId: null, exactCurl: null,
      },
      applicationTechnique: {
        domain: 'APPLICATION_TECHNIQUE', role: 'SCHOOL_OR_VARIANT_DEPENDENT', techniqueId: null,
        defaultsToClassic: false, defaultsToVolume: false, defaultsToWet: false,
      },
      fanConstruction: {
        domain: 'FAN_CONSTRUCTION', role: 'EXECUTION_CONTRIBUTOR', constructionId: null,
        possibleMethodClasses: ['CLOSED_OR_NARROW_SPIKE_LIKE_FANS', 'MIXED_CONSTRUCTIONS'],
        possibleMethodClassesAreUniversalRequirements: false,
        universalFanConstruction: null,
      },
      layering: { role: 'SCHOOL_DEPENDENT_OPTIONAL_UNRESOLVED', universalLayeringMethod: null, universalLayerCount: null },
    },
    rayPrimitiveRelationship: {
      primitiveId: 'RAY', role: 'POSSIBLE_NON_UNIVERSAL_EXECUTION_METHOD',
      required: false, mandatory: false,
      jellyfishIsCompleteConstruction: true, rayIsReusablePrimitiveOnly: true,
    },
    densityFinish: {
      qualitativeIntent: ['IRREGULAR', 'SPARSE_ACCENTED', 'GRAPHIC', 'NEGATIVE_SPACE_FORWARD'],
      exactDensity: null, exactDiameter: null, exactVolume: null, exactFanWidth: null,
      exactLayerCount: null, exactExtensionCount: null, exactMillimeters: null,
    },
    crossEffectComparison: {
      anime: {
        constructionId: 'construction.anime',
        status: 'SCHOOL_DEPENDENT_POSSIBLE_TERMINOLOGY_OVERLAP_WITH_ANIME_MANGA',
        universalDistinctionAsserted: false, possibleSynonymInSomeSources: true, mutuallyExclusive: false,
      },
      wispy: {
        constructionId: 'construction.wispy', status: 'SCHOOL_DEPENDENT_PROVISIONAL',
        commonDistinguishingPresentation: 'JELLYFISH_COMMONLY_MORE_PRONOUNCED_HIERARCHY_AND_NEGATIVE_SPACE_WHILE_WISPY_IS_SOFTER_AIRY_FEATHERED',
        universalNumericRegularityDifference: false, mutuallyExclusive: false,
      },
      kimK: {
        constructionId: 'construction.kim-k', status: 'SCHOOL_DEPENDENT_PROVISIONAL',
        commonDistinguishingPresentation: 'KIM_K_COMMONLY_MORE_STRUCTURED_ACCENT_DISTRIBUTION_WHILE_JELLYFISH_COMMONLY_MORE_IRREGULAR_AND_NEGATIVE_SPACE_FORWARD',
        universalNumericRegularityDifference: false, mutuallyExclusive: false,
      },
      wet: {
        constructionId: 'construction.wet', status: 'PROVISIONAL_POSSIBLE_EXECUTION_OVERLAP_WITHOUT_IDENTITY_COLLAPSE',
        possibleSharedExecution: 'CLOSED_OR_NARROW_SPIKE_LIKE_FAN_CONSTRUCTIONS',
        outcomeDistinction: 'WET_IS_COMPACT_GROUPED_COLUMNAR_TEXTURE_WHILE_JELLYFISH_IS_SPARSER_ACCENT_HIERARCHY_WITH_STRONGER_NEGATIVE_SPACE',
        identityCollapse: false, mutuallyExclusive: false,
      },
    },
    unresolved: [
      'JELLYFISH_VS_ANIME_MANGA_TERMINOLOGY_BOUNDARY', 'EXACT_SPIKE_CONSTRUCTION', 'EXACT_HIERARCHY_OR_TIERING',
      'EXACT_RHYTHM', 'EXACT_SPACING', 'EXACT_REGULARITY', 'SUPPORTING_BASE_CONSTRUCTION', 'LAYERING',
      'FAN_CONSTRUCTION', 'GEOMETRY_COMPATIBILITY', 'DIRECTION_COMPATIBILITY', 'CURL_SELECTION',
      'TECHNIQUE_COMPATIBILITY', 'DENSITY', 'DIAMETER', 'VOLUME', 'NEGATIVE_SPACE_ARCHITECTURE',
      'JELLYFISH_KIM_K_BOUNDARY', 'JELLYFISH_WISPY_BOUNDARY', 'JELLYFISH_WET_BOUNDARY', 'JELLYFISH_ANGEL_RELATIONSHIP_EXISTENCE',
      'REGIONAL_OR_SCHOOL_TERMINOLOGY', 'CORE_IDENTITY_CONFIDENCE_PENDING_BROADER_SOURCING',
    ],
    exactSpikeCount: null, exactSpacing: null, exactRegularity: null, exactSpikeWidth: null,
    exactLengthDelta: null, exactMillimeters: null, exactDensity: null, exactVolume: null,
    exactFanWidth: null, exactLayerCount: null, exactDiameter: null, exactExtensionCount: null,
  };
  jellyfishConstructionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], techniqueIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT',
  };
  jellyfishConstructionDefinition.validation = {
    status: 'EXPERT_REVIEWED',
    evidence: [{
      id: 'phase-1p-jellyfish-construction-foundation', type: 'REVIEWED_PROFESSIONAL_CONSTRUCTION_FOUNDATION',
      scope: ['SEPARATED_ELONGATED_DOMINANT_ACCENTS', 'STRONG_LONG_VS_SHORT_HIERARCHY', 'COMPARATIVELY_SPARSE_SUPPORTING_FIELD', 'VISIBLE_NEGATIVE_SPACE', 'INTENTIONALLY_IRREGULAR_CONTROLLED_COMPOSITION', 'OUTCOME_EXECUTION_SEPARATION'],
      numericClaims: false,
      evidenceBasis: 'SINGLE_DETAILED_EXTERNAL_SOURCE_NOT_MULTI_SOURCE_CONSENSUS',
      repositoryProductionPrecedent: false,
    }],
    provenance: [{ source: 'PHASE_1P_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_CONSTRUCTION_OUTCOME_ONLY_LOW_EVIDENCE_BASE' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1P_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: [
      'Jellyfish has no repository production precedent; every legacy field remains empty/null rather than manufactured.',
      'The candidate identity rests on a single detailed external source, not corroborated multi-source professional consensus, and must not be treated as equivalent in evidentiary weight to the reviewed Wet/Angel/Wispy/Kim K/Anime foundations.',
      'The Jellyfish/Anime/Manga terminology boundary is explicitly unresolved: at least one external source treats these as overlapping or synonymous, so Jellyfish must never be asserted as universally distinct from Anime.',
      'Exact spike construction, hierarchy/tiering, rhythm, spacing, supporting-base construction, layering, fan construction, geometry/direction/curl/technique compatibility, density, and negative-space architecture remain unresolved or school-dependent.',
    ],
  };

  // ============================================================
  // Phase 1R — six brand-new candidate mapping geometries, added while
  // expanding the professional Lash Map library with additional strategies
  // referenced from a user-supplied visual reference set. Unlike Phases
  // 1A-1P, no domain-authority review event produced these; each rests
  // solely on the requester's own transcription of a reference image and
  // (for Mega Volume / Long Curved Fox / Multi-Curl Volume Fox / Hybrid Cat
  // Eye) comparison against the already-EXPERT_REVIEWED Fox/Cat structural
  // foundations above. All six are therefore explicitly DRAFT, not
  // EXPERT_REVIEWED -- lower confidence even than Jellyfish (Phase 1P),
  // which at least had one detailed external written source. Every zone
  // number lives only in referenceTemplate (isolated from
  // professionalDefinition exactly like legacyReference is -- see
  // schema.referenceTemplate). professionalDefinition itself stays strictly
  // qualitative, matching every other reviewed geometry in this file.
  //
  // Per CLAUDE.md: these definitions must never encode SWANIYA branding,
  // imagery, or copyrighted design -- only the underlying length/curl/
  // layering *concepts*, expressed in this library's own existing
  // vocabulary and structure.
  //
  // referenceTemplate.zones sequences are taken exactly as transcribed by
  // the requester and are ASSUMED to already be given in physical
  // INNER-to-OUTER order (order ascending, order:0 = physical INNER,
  // order:last = physical OUTER) -- this assumption is NOT independently
  // verifiable from a text transcription alone and has not been checked
  // against the source images. See the final report's data-model section.
  // ============================================================

  // Phase 1R-1: Dense Full / Mega Volume. Distinguished from Fox not by a
  // different peak *region* but by a fuller, denser body -- Fox's defining
  // trait (per its own outerCornerRule above) is a late-outer peak with a
  // required post-peak decline; Mega Volume instead keeps building density
  // and length through the body with no post-peak decline at all.
  const megaVolumeDenseDefinition = identity('geometry.mega-volume-dense', 'Dense Full / Mega Volume', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  megaVolumeDenseDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'CONTINUOUS_BUILD_WITH_NO_POST_PEAK_DECLINE',
      bodyCharacter: 'FULLER_DENSER_CENTRAL_TO_BODY_COVERAGE_THAN_TAPERED_ELONGATION_FAMILIES',
      silhouette: 'MAXIMUM_DENSE_ELONGATION',
      intent: 'DRAMATIC_FULL_COVERAGE_LENGTH_AND_DENSITY',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_BODY' },
        { region: 'BODY', relationship: 'FULLER_DENSER_THAN_TAPERED_FAMILIES_CONTINUES_BUILDING' },
        { region: 'OUTER', relationship: 'MAXIMUM_REGION_NO_REQUIRED_DECLINE' },
      ],
    },
    topology: {
      rise: 'CONTINUOUS_BUILD_TOWARD_OUTER', shoulder: 'UNRESOLVED',
      postPeak: 'NOT_APPLICABLE_NO_DECLINE_REQUIRED', outerBehavior: 'MAXIMUM_REGION',
    },
    primaryIntent: 'DRAMATIC_FULL_COVERAGE_LENGTH_AND_DENSITY',
    excludedDefiningIntents: ['LATE_OUTER_TAIL_DECLINE', 'PRE_OUTER_LIFT_WITH_CONTROLLED_DECREASE'],
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'SEPARATE_LAYER', curlStrategyId: null },
      constructionRecipe: { domain: 'CONSTRUCTION_RECIPE', selection: 'SEPARATE_LAYER', constructionId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: null },
    },
    densityFinish: {
      qualitativeIntent: ['DENSE', 'FULL', 'MAXIMUM_COVERAGE'],
      bodyDensity: 'FULLER_THAN_FOX_OR_SQUIRREL_BODY', exactDensity: null, exactDiameter: null, exactVolume: null,
    },
    crossEffectComparison: {
      'geometry.fox': {
        megaVolumeDistinction: 'NO_REQUIRED_POST_PEAK_DECLINE_AND_FULLER_BODY_DENSITY',
        foxOuterCornerRule: 'REQUIRED_POST_PEAK_DECLINE_PER_OUTER_CORNER_RULE',
        mutuallyExclusive: false, notSimplyFox: true,
      },
    },
    unresolved: [
      'EXACT_DENSITY_OR_DIAMETER', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY',
      'CURL_SELECTION', 'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS',
    ],
  };
  megaVolumeDenseDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  megaVolumeDenseDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-mega-volume-dense-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['CONTINUOUS_BUILD_NO_POST_PEAK_DECLINE', 'FULLER_DENSER_BODY_THAN_TAPERED_FAMILIES', 'DRAMATIC_FULL_COVERAGE_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: [
      'No domain-authority review has occurred for this identity; it rests solely on the requester\'s own transcription of a reference image, unlike Phases 1A-1P.',
      'Numeric zone data lives only in referenceTemplate, never in professionalDefinition, matching the isolation discipline already established for legacyReference elsewhere in this file.',
    ],
  };
  megaVolumeDenseDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'INNER', lengthMmRange: [7, 8] },
      { order: 1, position: 'INNER_BODY', lengthMm: 8 },
      { order: 2, position: 'BODY', lengthMm: 9 },
      { order: 3, position: 'PRE_PEAK', lengthMm: 10 },
      { order: 4, position: 'PRE_OUTER', lengthMm: 12 },
      { order: 5, position: 'OUTER', lengthMm: 14 },
    ],
    baseProfile: null, spikes: null, correctionGoal: null,
    notes: [
      '7-8 → 8 → 9 → 10 → 12 → 14, per the requester\'s transcription.',
      'The requester\'s "fuller central body, not simply Fox" note is modeled as a densityFinish/topology distinction (no required post-peak decline, denser body coverage), not as a different length sequence -- the zone lengths alone are, in fact, monotonically increasing like several other families; the distinguishing trait is the absence of Fox\'s required post-peak decline plus the fuller body density claim.',
    ],
  };

  // Phase 1R-2: Long Curved Fox. A Fox-family variant elaborated with
  // explicit per-zone curl (J at the inner root, escalating through C to a
  // dramatic L toward the outer tail) -- data the reviewed geometry.fox
  // definition above deliberately never encodes (curl is a separate layer
  // there, never resolved to an exact value). This is the first identity in
  // this file to carry an explicit curl-per-zone value at all.
  const longCurvedFoxDefinition = identity('geometry.long-curved-fox', 'Long Curved Fox', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  longCurvedFoxDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'GRADUAL_BUILD_WITH_ESCALATING_CURL_TOWARD_OUTER',
      curlCharacter: 'PER_ZONE_CURL_ESCALATION_FLATTER_INNER_TO_DRAMATIC_OUTER',
      silhouette: 'ELONGATED_OUTER_SWEEP_WITH_VISIBLE_CURL_TRANSITION',
      intent: 'HORIZONTAL_ELONGATION_WITH_DRAMATIC_OUTER_CURL_LIFT',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_BODY_FLATTEST_CURL' },
        { region: 'BODY', relationship: 'BUILDS_TOWARD_OUTER_CURL_BEGINS_ESCALATING' },
        { region: 'OUTER', relationship: 'MAXIMUM_LENGTH_AND_MOST_DRAMATIC_CURL' },
      ],
    },
    topology: {
      rise: 'GRADUAL', shoulder: 'UNRESOLVED', postPeak: 'NOT_APPLICABLE_MAXIMUM_AT_OUTER',
      outerBehavior: 'MAXIMUM_LENGTH_AND_CURL_AT_PHYSICAL_OUTER',
    },
    curlTopology: {
      rule: 'CURL_ESCALATES_BY_ZONE_TOWARD_PHYSICAL_OUTER',
      innerCurl: 'FLATTEST', outerCurl: 'MOST_DRAMATIC',
      requiresPerZoneCurlRepresentation: true,
      distinctFromSingleBaseCurlModel: true,
    },
    primaryIntent: 'HORIZONTAL_ELONGATION_WITH_DRAMATIC_OUTER_CURL_LIFT',
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'PER_ZONE_NOT_SINGLE_VALUE', curlStrategyId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: 'direction.fox' },
    },
    densityFinish: { qualitativeIntent: ['ELONGATED', 'DRAMATIC_OUTER_CURL'], exactDensity: null, exactDiameter: null },
    crossEffectComparison: {
      'geometry.fox': {
        longCurvedFoxDistinction: 'EXPLICIT_PER_ZONE_CURL_ESCALATION_NOT_PRESENT_IN_REVIEWED_FOX_DEFINITION',
        sharedTrait: 'LATE_OUTER_TEMPORAL_ELONGATION_FAMILY', mutuallyExclusive: false,
        relationship: 'FOX_FAMILY_VARIANT_WITH_ADDED_CURL_DATA_NOT_A_REPLACEMENT_FOR_GEOMETRY_FOX',
      },
    },
    unresolved: [
      'EXACT_CURL_LETTER_SYSTEM_CROSS_CHECK', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY',
      'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS',
    ],
  };
  longCurvedFoxDefinition.compatibility = {
    geometryIds: ['geometry.fox'], directionIds: ['direction.fox'], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  longCurvedFoxDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-long-curved-fox-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['PER_ZONE_CURL_ESCALATION', 'FOX_FAMILY_ELONGATION', 'DRAMATIC_OUTER_CURL_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: [
      'No domain-authority review has occurred for this identity.',
      'This is the first identity in this file needing an explicit per-zone curl value; the existing curl.exactCurl-per-definition schema (a single value per identity) is not sufficient -- see referenceTemplate.zones[].curl and the final report\'s data-model section.',
    ],
  };
  longCurvedFoxDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'INNER', lengthMm: 6, curl: 'J' },
      { order: 1, position: 'INNER_BODY', lengthMmRange: [6, 8], curl: 'C' },
      { order: 2, position: 'BODY', lengthMm: 10, curl: 'C' },
      { order: 3, position: 'PRE_PEAK', lengthMm: 11, curl: 'L' },
      { order: 4, position: 'PEAK', lengthMm: 12, curl: 'L' },
      { order: 5, position: 'OUTER', lengthMm: 13, curl: 'L' },
    ],
    baseProfile: null, spikes: null, correctionGoal: null,
    notes: [
      '6J, 6-8C, 10C, 11L, 12L, 13L, per the requester\'s transcription -- curl letters preserved exactly as given, not cross-checked against a specific curl-letter standard.',
      'Curl transitions BY ZONE from J (flattest, inner) through C (body) to L (most dramatic, outer) -- the data model change this identity specifically requires is a per-zone curl field, not a single design-wide curl.',
    ],
  };

  // Phase 1R-3: Soft Volume Gradient. Distinct topology from every other
  // geometry in this file: a smooth monotonic build with NO plateau,
  // NO late-outer peak-and-decline, and explicitly no spike architecture --
  // every other reviewed geometry here (natural/doll/squirrel/cat/fox) has
  // some form of maximum region followed by a controlled reduction or tail;
  // this one simply keeps building to the physical outer with none.
  const softVolumeGradientDefinition = identity('geometry.soft-volume-gradient', 'Soft Volume Gradient', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  softVolumeGradientDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'SMOOTH_CONTINUOUS_GRADIENT_NO_PLATEAU_NO_DECLINE',
      spikeArchitecture: 'NONE',
      silhouette: 'EVEN_UNBROKEN_GRADIENT',
      intent: 'SOFT_PROGRESSIVE_VOLUME_BUILD_WITHOUT_A_DEFINED_PEAK_REGION',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'SHORTEST_STARTING_POINT' },
        { region: 'BODY', relationship: 'SMOOTH_CONTINUOUS_INCREASE_NO_PLATEAU' },
        { region: 'OUTER', relationship: 'LONGEST_POINT_NO_DECLINE_NO_TAPER' },
      ],
    },
    topology: {
      rise: 'SMOOTH_CONTINUOUS', shoulder: 'NONE_NO_PLATEAU',
      postPeak: 'NOT_APPLICABLE_NO_PEAK_REGION_DEFINED', outerBehavior: 'MAXIMUM_AT_PHYSICAL_OUTER_NO_DECLINE',
    },
    primaryIntent: 'SOFT_PROGRESSIVE_VOLUME_BUILD_WITHOUT_A_DEFINED_PEAK_REGION',
    excludedDefiningIntents: ['SPIKE_OR_ACCENT_ARCHITECTURE', 'CENTRAL_OR_PRE_OUTER_PEAK_WITH_DECLINE'],
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'SEPARATE_LAYER', curlStrategyId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: null },
    },
    densityFinish: { qualitativeIntent: ['SOFT', 'EVEN', 'PROGRESSIVE'], exactDensity: null, exactDiameter: null },
    crossEffectComparison: {
      'geometry.natural': {
        distinction: 'NATURAL_HAS_A_BROAD_MODEST_MAXIMUM_REGION_WITH_CONTROLLED_OUTER_REDUCTION_THIS_HAS_NEITHER',
        mutuallyExclusive: false,
      },
    },
    unresolved: [
      'EXACT_GRADIENT_STEEPNESS', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY',
      'CURL_SELECTION', 'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS',
    ],
  };
  softVolumeGradientDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  softVolumeGradientDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-soft-volume-gradient-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['SMOOTH_CONTINUOUS_GRADIENT_NO_PLATEAU_NO_DECLINE', 'NO_SPIKE_ARCHITECTURE', 'SOFT_PROGRESSIVE_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: ['No domain-authority review has occurred for this identity.'],
  };
  softVolumeGradientDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'INNER', lengthMm: 8 },
      { order: 1, position: 'INNER_BODY', lengthMm: 9 },
      { order: 2, position: 'BODY', lengthMm: 10 },
      { order: 3, position: 'PRE_OUTER', lengthMm: 12 },
      { order: 4, position: 'OUTER_TRANSITION', lengthMm: 13 },
      { order: 5, position: 'OUTER', lengthMm: 14 },
    ],
    baseProfile: null, spikes: null, correctionGoal: null,
    notes: ['8 → 9 → 10 → 12 → 13 → 14, per the requester\'s transcription -- monotonically increasing with no spike architecture, as specified.'],
  };

  // Phase 1R-4: Downturned-Eye Correction / Hybrid Natural. The requester
  // explicitly flagged the physical-orientation risk for this one: a
  // descending profile must mean descending from the ANATOMICAL inner
  // corner to the ANATOMICAL outer corner, never from whatever appeared on
  // the left side of a screenshot. This identity has NO relationship to
  // DESIGN_CATALOG's existing 'correction' entry (an asymmetry-balancing
  // map with an ascending-then-descending profile, peakZone 3) -- the two
  // solve different problems and must not be conflated.
  const downturnedEyeCorrectionDefinition = identity('geometry.downturned-eye-correction', 'Downturned-Eye Correction / Hybrid Natural', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  downturnedEyeCorrectionDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'DESCENDING_FROM_PHYSICAL_INNER_TO_PHYSICAL_OUTER',
      maximum: 'AT_PHYSICAL_INNER_NOT_CENTRAL_NOT_LATE_OUTER',
      silhouette: 'INNER_WEIGHTED_TAPERING_TOWARD_OUTER',
      intent: 'OPTICALLY_COUNTERACT_A_DOWNTURNED_OUTER_CORNER_BY_SHIFTING_VISUAL_WEIGHT_INWARD',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'PHYSICAL_INNER', relationship: 'MAXIMUM_REGION' },
        { region: 'BODY', relationship: 'CONTROLLED_DESCENT_FROM_INNER_MAXIMUM' },
        { region: 'PHYSICAL_OUTER', relationship: 'MINIMUM_REGION' },
      ],
    },
    topology: {
      rise: 'NOT_APPLICABLE_MAXIMUM_STARTS_AT_INNER', shoulder: 'UNRESOLVED',
      postPeak: 'CONTROLLED_DESCENT_ACROSS_ENTIRE_PROFILE', outerBehavior: 'MINIMUM_AT_PHYSICAL_OUTER',
    },
    physicalOrientationRule: {
      requirement: 'PROFILE_MUST_BE_INTERPRETED_BY_ANATOMICAL_INNER_OUTER_NEVER_BY_SCREEN_OR_IMAGE_LEFT_RIGHT',
      rationale: 'A DESCENDING_PROFILE_ENCODED_BY_SCREEN_SIDE_INSTEAD_OF_ANATOMY_WOULD_SILENTLY_REVERSE_ON_ONE_PHYSICAL_EYE',
      relatedProtectedContracts: ['B', 'H'],
      resolution: 'STRUCTURALLY_ENFORCED_BY_STORING_A_SINGLE_PHYSICAL_ORDER_ARRAY_SEE_REFERENCETEMPLATE',
    },
    primaryIntent: 'OPTICALLY_COUNTERACT_A_DOWNTURNED_OUTER_CORNER_BY_SHIFTING_VISUAL_WEIGHT_INWARD',
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'SEPARATE_LAYER', curlStrategyId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: null },
    },
    densityFinish: { qualitativeIntent: ['CORRECTIVE', 'INNER_WEIGHTED'], exactDensity: null, exactDiameter: null },
    crossEffectComparison: {
      'geometry.natural': {
        distinction: 'NATURAL_HAS_A_BROAD_CENTRAL_OR_NEAR_CENTRAL_MAXIMUM_THIS_HAS_AN_INNER_MAXIMUM_WITH_CONTINUOUS_DESCENT',
        mutuallyExclusive: false,
      },
    },
    unresolved: [
      'CLINICAL_EFFECTIVENESS_OF_INNER_WEIGHTED_DESCENT_FOR_DOWNTURNED_EYES', 'EXACT_DESCENT_SLOPE',
      'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY', 'CURL_SELECTION',
      'NUMERIC_TEMPLATES', 'RELATIONSHIP_TO_DESIGN_CATALOG_CORRECTION_ENTRY_BEYOND_SHARED_CATEGORY_NAME',
    ],
  };
  downturnedEyeCorrectionDefinition.compatibility = {
    geometryIds: [], directionIds: [], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  downturnedEyeCorrectionDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-downturned-eye-correction-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['DESCENDING_INNER_TO_OUTER_PROFILE', 'INNER_MAXIMUM', 'CORRECTIVE_INTENT_FOR_DOWNTURNED_OUTER_CORNER'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: [
      'No domain-authority review has occurred for this identity, and its actual corrective effectiveness for downturned eyes has not been clinically validated -- treat as a structural candidate only.',
      'Explicitly distinct from DESIGN_CATALOG\'s existing "correction" entry (asymmetry balancing, ascending-then-descending profile, peakZone 3) -- this identity solves a different problem (a monotonic inner-to-outer descent) and legacyIds is deliberately left empty rather than borrowing that unrelated production entry\'s identity.',
    ],
  };
  downturnedEyeCorrectionDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'PHYSICAL_INNER', lengthMm: 13 },
      { order: 1, position: 'INNER_BODY', lengthMm: 12 },
      { order: 2, position: 'BODY', lengthMm: 11 },
      { order: 3, position: 'PRE_OUTER', lengthMm: 10 },
      { order: 4, position: 'OUTER_TRANSITION', lengthMm: 9 },
      { order: 5, position: 'PHYSICAL_OUTER', lengthMm: 8 },
    ],
    baseProfile: null, spikes: null,
    correctionGoal: 'OPTICALLY_LIFT_A_DOWNTURNED_OUTER_CORNER_BY_PLACING_MAXIMUM_LENGTH_AT_THE_PHYSICAL_INNER_CORNER_AND_TAPERING_TOWARD_THE_PHYSICAL_OUTER_CORNER',
    notes: [
      '13 → 12 → 11 → 10 → 9 → 8, per the requester\'s transcription, encoded with order:0 fixed to PHYSICAL_INNER and order:5 fixed to PHYSICAL_OUTER regardless of which side of the source screenshot the numbers appeared on.',
      'The requester explicitly warned against blindly encoding this sequence by screenshot left-to-right direction; `order` here is anatomical, not screen-side, matching Protected Contracts B and H, and is proven mirror-safe by construction (a single array serves both physical eyes -- see the dedicated mirror-safety test).',
    ],
  };

  // Phase 1R-5: Multi-Curl Volume Fox. A second Fox-family variant (see
  // Long Curved Fox / 1R-2 above) with BOTH length and curl changing across
  // zones -- curl letters preserved exactly as transcribed, including one
  // ('M') that does not match this codebase's other observed curl letters
  // (J/B/C/CC/D/L/L+) and has not been cross-checked against a specific
  // curl-system standard.
  const multiCurlVolumeFoxDefinition = identity('geometry.multi-curl-volume-fox', 'Multi-Curl Volume Fox', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  multiCurlVolumeFoxDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'BUILD_TOWARD_OUTER_WITH_BOTH_LENGTH_AND_CURL_ESCALATING_BY_ZONE',
      curlCharacter: 'PER_ZONE_CURL_ESCALATION_INDEPENDENT_OF_BUT_CORRELATED_WITH_LENGTH',
      silhouette: 'PROGRESSIVE_VOLUME_AND_CURL_BUILD_TOWARD_PHYSICAL_OUTER',
      intent: 'MAXIMUM_OUTER_DRAMA_THROUGH_COMBINED_LENGTH_AND_CURL_PROGRESSION',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'SHORTEST_AND_FLATTEST' },
        { region: 'BODY', relationship: 'BUILDS_LENGTH_AND_CURL_TOGETHER' },
        { region: 'OUTER', relationship: 'LONGEST_AND_MOST_CURLED' },
      ],
    },
    topology: {
      rise: 'GRADUAL', shoulder: 'UNRESOLVED', postPeak: 'NOT_APPLICABLE_MAXIMUM_AT_OUTER',
      outerBehavior: 'MAXIMUM_LENGTH_AND_CURL_AT_PHYSICAL_OUTER',
    },
    curlTopology: {
      rule: 'LENGTH_AND_CURL_BOTH_ESCALATE_BY_ZONE_TOWARD_PHYSICAL_OUTER',
      requiresPerZoneCurlRepresentation: true, distinctFromSingleBaseCurlModel: true,
    },
    primaryIntent: 'MAXIMUM_OUTER_DRAMA_THROUGH_COMBINED_LENGTH_AND_CURL_PROGRESSION',
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'PER_ZONE_NOT_SINGLE_VALUE', curlStrategyId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: 'direction.fox' },
    },
    densityFinish: { qualitativeIntent: ['VOLUME', 'PROGRESSIVE_CURL'], exactDensity: null, exactDiameter: null },
    crossEffectComparison: {
      'geometry.fox': {
        multiCurlVolumeFoxDistinction: 'BOTH_LENGTH_AND_CURL_VARY_BY_ZONE_NOT_JUST_LENGTH',
        sharedTrait: 'LATE_OUTER_TEMPORAL_ELONGATION_FAMILY', mutuallyExclusive: false,
        relationship: 'FOX_FAMILY_VARIANT_WITH_ADDED_CURL_DATA_NOT_A_REPLACEMENT_FOR_GEOMETRY_FOX',
      },
      'geometry.long-curved-fox': {
        distinction: 'LONG_CURVED_FOX_HOLDS_LENGTH_ROUGHLY_FLAT_ACROSS_THE_OUTER_HALF_WHILE_THIS_IDENTITY_CONTINUES_INCREASING_LENGTH_ALONGSIDE_CURL',
        mutuallyExclusive: false,
      },
    },
    unresolved: [
      'EXACT_CURL_LETTER_SYSTEM_CROSS_CHECK_INCLUDING_THE_NON_STANDARD_M_LETTER', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY',
      'DIRECTION_COMPATIBILITY', 'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS',
    ],
  };
  multiCurlVolumeFoxDefinition.compatibility = {
    geometryIds: ['geometry.fox', 'geometry.long-curved-fox'], directionIds: ['direction.fox'], curlStrategyIds: [],
    constructionIds: [], fanConstructionIds: [], conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  multiCurlVolumeFoxDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-multi-curl-volume-fox-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['PER_ZONE_LENGTH_AND_CURL_ESCALATION', 'FOX_FAMILY_ELONGATION', 'MAXIMUM_OUTER_DRAMA_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: [
      'No domain-authority review has occurred for this identity.',
      'The transcribed curl sequence includes the letter "M", which does not match any curl letter observed elsewhere in this file\'s legacyReference records (J/B/C/CC/D/L/L+) -- preserved verbatim rather than silently corrected, and flagged here for the requester to confirm against their source.',
    ],
  };
  multiCurlVolumeFoxDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'INNER', lengthMm: 8, curl: 'B' },
      { order: 1, position: 'INNER_BODY', lengthMm: 8, curl: 'C' },
      { order: 2, position: 'BODY', lengthMm: 10, curl: 'M' },
      { order: 3, position: 'PRE_PEAK', lengthMm: 12, curl: 'M' },
      { order: 4, position: 'PEAK', lengthMm: 13, curl: 'L' },
      { order: 5, position: 'OUTER', lengthMm: 15, curl: 'L' },
    ],
    baseProfile: null, spikes: null, correctionGoal: null,
    notes: ['8B, 8C, 10M, 12M, 13L, 15L, per the requester\'s transcription -- curl letters preserved exactly as given, including the non-standard "M" (see validation notes).'],
  };

  // Phase 1R-6: Hybrid Cat Eye. A Cat-family variant (horizontal elongation
  // with an outer curl transition) elaborated with explicit per-zone curl,
  // holding a steady C through the body and only transitioning to D at the
  // very outer tip -- the reviewed geometry.cat definition above never
  // resolves an exact curl value at all.
  const hybridCatEyeDefinition = identity('geometry.hybrid-cat-eye', 'Hybrid Cat Eye', 'MAPPING_GEOMETRY', {
    status: 'DRAFT', unresolved: true, legacyRelationship: 'NO_CURRENT_PRODUCTION_PRECEDENT',
  });
  hybridCatEyeDefinition.professionalDefinition = {
    invariantOutcome: {
      progression: 'GRADUAL_BUILD_WITH_STEADY_MID_CURL_AND_A_SHARP_OUTER_CURL_TRANSITION',
      curlCharacter: 'STEADY_CURL_THROUGH_BODY_WITH_A_SINGLE_SHARP_TRANSITION_AT_THE_OUTER_TIP',
      silhouette: 'HORIZONTAL_ELONGATION_WITH_OUTER_CURL_TRANSITION',
      intent: 'FELINE_HORIZONTAL_ELONGATION_WITH_A_DEFINED_OUTER_LIFT_ACCENT',
    },
    normalizedProfile: {
      unit: 'RELATIVE_TO_LASH_LINE', numericSamples: null,
      sequence: [
        { region: 'INNER', relationship: 'BELOW_BODY_FLATTEST_CURL' },
        { region: 'BODY', relationship: 'BUILDS_TOWARD_OUTER_STEADY_MID_CURL' },
        { region: 'OUTER_TIP', relationship: 'MAXIMUM_LENGTH_WITH_A_SHARP_CURL_TRANSITION' },
      ],
    },
    topology: {
      rise: 'GRADUAL', shoulder: 'UNRESOLVED', postPeak: 'NOT_APPLICABLE_MAXIMUM_AT_OUTER_TIP',
      outerBehavior: 'MAXIMUM_LENGTH_WITH_SHARP_CURL_TRANSITION_AT_PHYSICAL_OUTER',
    },
    curlTopology: {
      rule: 'STEADY_CURL_THROUGH_BODY_SINGLE_SHARP_TRANSITION_AT_OUTER_TIP',
      requiresPerZoneCurlRepresentation: true, distinctFromSingleBaseCurlModel: true,
      distinctFromGradualEscalation: 'UNLIKE_LONG_CURVED_FOX_AND_MULTI_CURL_VOLUME_FOX_CURL_IS_STEADY_THEN_TRANSITIONS_ONCE_RATHER_THAN_ESCALATING_ACROSS_EVERY_ZONE',
    },
    primaryIntent: 'FELINE_HORIZONTAL_ELONGATION_WITH_A_DEFINED_OUTER_LIFT_ACCENT',
    relationships: {
      applicationTechnique: { domain: 'APPLICATION_TECHNIQUE', selection: 'SEPARATE_LAYER', techniqueId: null },
      curl: { domain: 'CURL_STRATEGY', selection: 'PER_ZONE_NOT_SINGLE_VALUE', curlStrategyId: null },
      direction: { domain: 'DIRECTION_STRATEGY', role: 'SECONDARY_SEPARATE_LAYER', strategyId: 'direction.cat' },
    },
    densityFinish: { qualitativeIntent: ['FELINE', 'ELONGATED', 'OUTER_ACCENTED'], exactDensity: null, exactDiameter: null },
    crossEffectComparison: {
      'geometry.cat': {
        hybridCatEyeDistinction: 'EXPLICIT_PER_ZONE_CURL_WITH_A_SHARP_OUTER_TRANSITION_NOT_PRESENT_IN_REVIEWED_CAT_DEFINITION',
        sharedTrait: 'LATE_OUTER_FELINE_ELONGATION_FAMILY', mutuallyExclusive: false,
        relationship: 'CAT_FAMILY_VARIANT_WITH_ADDED_CURL_DATA_NOT_A_REPLACEMENT_FOR_GEOMETRY_CAT',
      },
    },
    unresolved: [
      'EXACT_CURL_LETTER_SYSTEM_CROSS_CHECK', 'GEOMETRY_CONSTRUCTION_COMPATIBILITY', 'DIRECTION_COMPATIBILITY',
      'NUMERIC_TEMPLATES', 'CROSS_SCHOOL_TERMINOLOGY_CONSENSUS',
    ],
  };
  hybridCatEyeDefinition.compatibility = {
    geometryIds: ['geometry.cat'], directionIds: ['direction.cat'], curlStrategyIds: [], constructionIds: [], fanConstructionIds: [],
    conditions: [], resolution: 'UNRESOLVED_SEPARATE_LAYER_COMPOSITION',
  };
  hybridCatEyeDefinition.validation = {
    status: 'DRAFT',
    evidence: [{
      id: 'phase-1r-hybrid-cat-eye-candidate', type: 'CANDIDATE_STRUCTURE_FROM_UNREVIEWED_REFERENCE_SOURCE',
      scope: ['STEADY_CURL_WITH_SHARP_OUTER_TRANSITION', 'CAT_FAMILY_HORIZONTAL_ELONGATION', 'DEFINED_OUTER_LIFT_ACCENT_INTENT'],
      numericClaims: false,
    }],
    provenance: [{ source: 'PHASE_1R_USER_SUPPLIED_REFERENCE_MATERIAL', scope: 'CANDIDATE_STRUCTURE_AND_REFERENCE_TEMPLATE_ONLY_NOT_DOMAIN_REVIEWED' }],
    reviewers: [],
    reviewedAt: null,
    revision: 1,
    notes: ['No domain-authority review has occurred for this identity.'],
  };
  hybridCatEyeDefinition.referenceTemplate = {
    relationship: 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION',
    isolatedFromProfessionalDefinition: true,
    sourceType: 'USER_SUPPLIED_VISUAL_REFERENCE_CONCEPT_ONLY',
    confidence: 'SINGLE_SOURCE_UNVALIDATED',
    zones: [
      { order: 0, position: 'INNER', lengthMm: 8, curl: 'B' },
      { order: 1, position: 'INNER_BODY', lengthMm: 8, curl: 'C' },
      { order: 2, position: 'BODY', lengthMm: 10, curl: 'C' },
      { order: 3, position: 'PRE_PEAK', lengthMm: 11, curl: 'C' },
      { order: 4, position: 'PEAK', lengthMm: 12, curl: 'C' },
      { order: 5, position: 'PRE_OUTER', lengthMm: 13, curl: 'C' },
      { order: 6, position: 'OUTER_TIP', lengthMmRange: [13, 14], curl: 'D' },
    ],
    baseProfile: null, spikes: null, correctionGoal: null,
    notes: ['8B, 8C, 10C, 11C, 12C, 13C, 14-13D, per the requester\'s transcription -- 7 zones, steady C curl through the body with a single transition to D at the outer tip.'],
  };

  const registries = {
    geometries: {
      'geometry.natural': naturalDefinition,
      'geometry.doll': dollDefinition,
      'geometry.cat': catDefinition,
      'geometry.fox': foxDefinition,
      'geometry.squirrel': squirrelDefinition,
      'geometry.mega-volume-dense': megaVolumeDenseDefinition,
      'geometry.long-curved-fox': longCurvedFoxDefinition,
      'geometry.soft-volume-gradient': softVolumeGradientDefinition,
      'geometry.downturned-eye-correction': downturnedEyeCorrectionDefinition,
      'geometry.multi-curl-volume-fox': multiCurlVolumeFoxDefinition,
      'geometry.hybrid-cat-eye': hybridCatEyeDefinition,
    },
    techniques: {
      'technique.classic-one-to-one': classicTechniqueDefinition,
    },
    constructionRecipes: {
      'construction.wispy': wispyConstructionDefinition,
      'construction.kim-k': kimKConstructionDefinition,
      'construction.angel': angelConstructionDefinition,
      'construction.wet': wetConstructionDefinition,
      'construction.rays': identity('construction.rays', 'Rays', 'CONSTRUCTION_RECIPE', {
        legacyRelationship: 'INDEPENDENT_IDENTITY_DESPITE_LEGACY_KIM_ALIAS',
      }),
      'construction.anime': animeConstructionDefinition,
      'construction.jellyfish': jellyfishConstructionDefinition,
      'construction.root-definition': rootDefinitionConstruction,
    },
    directionStrategies: {
      'direction.cat': catDirectionDefinition,
      'direction.fox': foxDirectionDefinition,
      'direction.eyeliner': eyelinerDirectionDefinition,
    },
    curlStrategies: {},
    fanConstructions: {},
    presets: {
      'preset.eyeliner': eyelinerPresetDefinition,
      'preset.american': identity('preset.american', 'American', 'SCHOOL_DEPENDENT_PRESET', {
        status: 'SCHOOL_DEPENDENT', school: 'UNRESOLVED', unresolved: true,
      }),
    },
  };

  // Phase 1L reviewed RAY primitive metadata. This extends the existing
  // texture-construction primitive layer rather than creating a parallel
  // registry. It is a reusable building block, never a complete effect.
  const rayPrimitiveDefinition = {
    id: 'RAY',
    kind: 'TEXTURE_CONSTRUCTION_PRIMITIVE',
    validation: {
      status: 'EXPERT_REVIEWED',
      evidence: [{
        id: 'phase-1l-ray-primitive-foundation', type: 'REVIEWED_QUALITATIVE_TEXTURE_PRIMITIVE',
        scope: ['VISIBLE_ELONGATED_ACCENT', 'LOCALIZED_TEXTURE', 'ACCENT_SEPARATION', 'TOP_LINE_SEGMENTATION_CONTRIBUTOR', 'REUSABLE_CONSTRUCTION_BUILDING_BLOCK'],
        numericClaims: false,
      }],
      provenance: [{ source: 'PHASE_1L_APPROVED_PROFESSIONAL_BRIEF', scope: 'QUALITATIVE_TEXTURE_CONSTRUCTION_PRIMITIVE_ONLY' }],
      reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1L_APPROVAL' }],
      reviewedAt: null,
      revision: 1,
      notes: ['RAY is a reusable accent primitive; physical construction, repetition, hierarchy, support, layering, compatibility, and all numeric execution remain unresolved or construction-dependent.'],
    },
    professionalDefinition: {
      invariantOutcome: {
        visibleAccent: 'VISIBLE_ELONGATED_ACCENT',
        texture: 'LOCALIZED_TEXTURE',
        separation: 'ACCENT_SEPARATION',
        topLineRole: 'TOP_LINE_SEGMENTATION_CONTRIBUTOR',
        architecturalRole: 'REUSABLE_CONSTRUCTION_BUILDING_BLOCK',
      },
      primitiveBoundary: {
        completeEffectIdentity: false,
        completeConstructionId: 'construction.rays',
        synonymousWithEveryRaysConstruction: false,
        definesMappingGeometry: false,
        definesHierarchy: false,
        definesRhythm: false,
        requiresSupportingBase: false,
        definesCurl: false,
        definesDensity: false,
      },
      reusability: {
        relationship: 'POSSIBLE_NON_UNIVERSAL_CONSTRUCTION_CONTRIBUTOR',
        potentialContainingConstructionIds: ['construction.kim-k', 'construction.wispy', 'construction.anime', 'construction.wet', 'preset.american'],
        otherTexturedConstructionsAllowed: true,
        universalRequirementForContainingConstructions: false,
      },
      hierarchy: {
        visibleAccent: 'ESSENTIAL', primaryTier: 'OPTIONAL',
        secondaryTier: 'OPTIONAL_OR_SCHOOL_DEPENDENT',
        supportingField: 'NOT_INTRINSIC_TO_PRIMITIVE',
        topLineSegmentationContribution: 'ESSENTIAL_QUALITATIVE',
        universalHierarchy: null,
      },
      rhythmSpacing: {
        rhythm: 'NOT_INTRINSIC',
        qualitativeRepetition: 'CONSTRUCTION_DEPENDENT',
        exactRegularity: 'SCHOOL_DEPENDENT', exactSpacing: null, frequency: null,
      },
      supportingFieldRelationships: {
        requirement: 'NOT_INTRINSIC_TO_PRIMITIVE',
        potentialConstructionDependentClasses: ['SHORTER_SUPPORTING_FIELD', 'CONTINUOUS_BASE', 'INTEGRATED_MIXED_LENGTHS', 'SPIKE_OVER_BASE_LAYERING', 'RAY_ONLY_OR_SPARSELY_SUPPORTED_COMPOSITION', 'CONTAINING_CONSTRUCTION_SUPPORT_ARCHITECTURE'],
        universalBaseConstruction: null,
      },
      relationships: {
        geometry: {
          domain: 'MAPPING_GEOMETRY', role: 'NOT_PART_OF_PRIMITIVE',
          completeConstructionCarrierSelection: 'VARIANT_DEPENDENT', geometryId: null, universalCompatibleIds: [],
        },
        fanConstruction: {
          domain: 'PHYSICAL_CONSTRUCTION', role: 'SCHOOL_OR_VARIANT_DEPENDENT',
          closedFanRays: 'COMMON_VARIANT', narrowNearlyClosedFans: 'COMMON_VARIANT',
          classicSingles: 'COMMON_VARIANT', mixedFans: 'SCHOOL_DEPENDENT',
          volumeSpikes: 'COMMON_VARIANT', layeredCombinations: 'SCHOOL_DEPENDENT',
          universalFanMethod: null,
        },
        direction: {
          domain: 'DIRECTION_STRATEGY', role: 'SECONDARY', strategyId: null,
          maySupport: ['ACCENT_SEPARATION', 'CLEAN_PRESENTATION', 'AVOIDANCE_OF_CROSSING', 'GEOMETRY_COMPATIBILITY', 'ACCENT_SILHOUETTE_PRESERVATION'],
          numericAngles: null, directionVectors: null, directionalZones: null,
        },
        curl: { domain: 'CURL_STRATEGY', role: 'NOT_PART_OF_PRIMITIVE', exactCurl: null },
      },
      densityFinish: {
        essential: ['VISIBLE_ACCENT_SEPARATION', 'LOCALIZED_TEXTURE', 'TOP_LINE_SEGMENTATION_CONTRIBUTION'],
        dimensional: 'COMMON_OUTCOME', graphic: 'VARIANT_DEPENDENT', airy: 'VARIANT_DEPENDENT',
        bold: 'VARIANT_DEPENDENT', sparse: 'VARIANT_DEPENDENT', dense: 'VARIANT_DEPENDENT',
        editorial: 'VARIANT_DEPENDENT', exactDensity: null,
      },
      taxonomyRelationships: {
        kimK: {
          constructionId: 'construction.kim-k', relationship: 'POSSIBLE_NON_UNIVERSAL_CONTRIBUTOR',
          primitiveRoleBroaderThanConstruction: true, universallyIdentical: false,
          raysConstructionRelationship: 'SCHOOL_DEPENDENT_OVERLAP',
        },
        wispy: {
          constructionId: 'construction.wispy', relationship: 'POSSIBLE_ACCENT_ARCHITECTURE',
          universallyRequired: false, inheritsCompleteInvariant: false,
          raysConstructionRelationship: 'SCHOOL_DEPENDENT_OVERLAP',
        },
        raysConstruction: {
          constructionId: 'construction.rays', canonicalRole: 'SCHOOL_DEPENDENT_NAMED_CONSTRUCTION_PLACEHOLDER',
          primitiveDependency: 'RAY', universalFinishedEffectInvariant: 'UNRESOLVED',
        },
      },
      exactRayLength: null,
      exactRayCount: null,
      exactSpacing: null,
      exactFrequency: null,
      exactMillimeters: null,
      exactLengthDelta: null,
      exactFanWidth: null,
      exactFanCount: null,
      exactVolume: null,
      exactDiameter: null,
      exactLayerCount: null,
      exactPlacementCoordinates: null,
      unresolved: ['EXACT_PHYSICAL_RAY_CONSTRUCTION', 'FAN_METHOD', 'RAY_WIDTH', 'RAY_LENGTH', 'SPACING', 'REPETITION', 'HIERARCHY', 'SUPPORTING_FIELD_RELATIONSHIP', 'LAYERING', 'DIRECTION_EXECUTION', 'DENSITY_OR_INTENSITY', 'CONTAINING_EFFECT_COMPATIBILITY_RULES', 'CROSS_SCHOOL_TERMINOLOGY'],
    },
  };

  const schema = {
    normalizedGeometry: {
      profile: 'RELATIVE_LENGTH_SAMPLES_OR_RANGES',
      peakPosition: 'NORMALIZED_RANGE',
      topology: 'RISE_SHOULDER_PLATEAU_DECLINE',
      outerBehavior: 'STRUCTURED_DESCRIPTOR',
    },
    templateMm: {
      separateFromNormalizedGeometry: true,
      values: 'OPTIONAL_VALUES_OR_RANGES',
      purpose: 'STARTING_TEMPLATE_NOT_UNIVERSAL_TRUTH',
    },
    applicationTechnique: 'REFERENCE_TO_TECHNIQUES_REGISTRY',
    textureConstruction: {
      recipe: 'REFERENCE_TO_CONSTRUCTION_RECIPES_REGISTRY',
      primitives: ['SPIKE', 'RAY', 'TENTACLE', 'CLOSED_FAN', 'LAYER'],
      primitiveDefinitions: { RAY: rayPrimitiveDefinition },
      outcomeSeparateFromExecutionMethod: true,
    },
    direction: {
      registry: 'REFERENCE_TO_DIRECTION_STRATEGIES_REGISTRY',
      separateFromMappingGeometry: true,
      separateFromCurlStrategy: true,
      qualitativeFields: ['directionalIntent', 'dominantAxis', 'outerOrientation', 'liftVsElongation', 'directionDependency'],
      mappingRelationship: 'EXPLICIT_COMPOSITE_WITHOUT_MERGING_LAYERS',
      numericAngles: 'OPTIONAL_OR_UNRESOLVED',
      schoolDependency: 'EXPLICIT_STATUS',
    },
    curlStrategy: 'REFERENCE_TO_CURL_STRATEGIES_REGISTRY',
    volumeFanConstruction: 'REFERENCE_TO_FAN_CONSTRUCTIONS_REGISTRY',
    compositePreset: {
      separateLayerReferences: ['MAPPING_GEOMETRY', 'DIRECTION_STRATEGY', 'CURL_STRATEGY', 'CONSTRUCTION_RECIPE', 'APPLICATION_TECHNIQUE', 'FAN_CONSTRUCTION'],
      invariantSeparateFromExecutionMethod: true,
      unresolvedSlotsAllowed: true,
    },
    compatibility: 'IDS_CONDITIONS_AND_CONSTRAINTS',
    variants: 'NAMESPACED_DEFINITION_REFERENCES',
    schoolDependent: 'EXPLICIT_SCHOOL_NAMESPACE_OR_UNRESOLVED',
    validation: {
      statuses: VALIDATION_STATES,
      metadata: ['evidence', 'provenance', 'reviewers', 'reviewedAt', 'revision', 'notes'],
    },
    legacyReference: {
      isolatedFromProfessionalDefinition: true,
      mayContain: ['normalizedGeometry', 'templateMm', 'scoreCoefficients', 'spikeDeltas', 'textureFrequencies', 'curlLiftStrength', 'techniqueDiameters'],
    },
    // Phase 1R reference-template capacity. Distinct from legacyReference:
    // legacyReference.relationship is always CURRENT_PRODUCTION_COMPARISON_ONLY
    // (it mirrors an already-shipped DESIGN_CATALOG entry). referenceTemplate
    // instead holds concrete zone/curl/base+spike numbers pulled from a
    // *candidate* source with no such production precedent (e.g. a
    // user-supplied visual reference the artist wants captured as a starting
    // point) -- always isolated from professionalDefinition the same way,
    // never asserted as EXPERT_REVIEWED/VALIDATED truth on its own.
    referenceTemplate: {
      isolatedFromProfessionalDefinition: true,
      purpose: 'CANDIDATE_NUMERIC_DATA_FROM_A_SINGLE_UNVALIDATED_REFERENCE_SOURCE_NOT_PRODUCTION_NOT_MULTI_SOURCE_REVIEWED',
      location: 'library.referenceTemplates[canonicalId] -- a sibling map alongside registries, keyed by the same canonical id; the six brand-new Phase 1R geometries additionally carry it as their own .referenceTemplate property (equivalent content, safe to duplicate since nothing hashed those brand-new objects before this phase). NEVER assigned onto a pre-existing EXPERT_REVIEWED identity object directly -- see the long comment above animeReferenceTemplate for why.',
      mayContain: ['zones', 'baseProfile', 'spikes', 'correctionGoal'],
      zoneShape: '{order (0-based, strictly ascending, physical INNER=0..OUTER=last -- never screen-side-dependent), position (human-readable physical label), lengthMm or lengthMmRange:[min,max], curl (optional, per-zone)}',
      layeredShape: 'baseProfile: zone[] (continuous supporting length curve); spikes: zone[] positionally aligned to baseProfile entries, each an accent length at/above its base',
      mirrorSafety: 'exactly one physical-order array per definition; LEFT and RIGHT read the identical array, mirroring is a rendering-layer concern only (see Protected Contract H), never encoded here',
    },
  };

  const targetInventory = [
    { name: 'Natural', canonicalId: 'geometry.natural' },
    { name: 'Classic', canonicalId: 'technique.classic-one-to-one' },
    { name: 'Doll', canonicalId: 'geometry.doll' },
    { name: 'Cat', canonicalId: 'geometry.cat' },
    { name: 'Fox', canonicalId: 'geometry.fox' },
    { name: 'Squirrel', canonicalId: 'geometry.squirrel' },
    { name: 'Eyeliner', canonicalId: 'preset.eyeliner' },
    { name: 'Wispy', canonicalId: 'construction.wispy' },
    { name: 'Kim K', canonicalId: 'construction.kim-k' },
    { name: 'Angel', canonicalId: 'construction.angel' },
    { name: 'Wet', canonicalId: 'construction.wet' },
    { name: 'Rays', canonicalId: 'construction.rays' },
    { name: 'Anime', canonicalId: 'construction.anime' },
    { name: 'Jellyfish', canonicalId: 'construction.jellyfish' },
    { name: 'American', canonicalId: 'preset.american' },
  ];

  const activation = {
    productionEnabled: false,
    defaultState: 'INACTIVE',
    keyType: 'CANONICAL_ID_ONLY',
    aliasActivationAllowed: false,
    maxActiveDefinitions: 1,
    activeDefinitionIds: [],
    rollbackTarget: 'LEGACY_BEHAVIOR',
  };

  // Phase 1R. Deliberately a SIBLING of `registries`, not a REGISTRY_NAMES
  // member and never consulted by getDefinition()/allDefinitions() -- see
  // schema.referenceTemplate and the long comment above animeReferenceTemplate
  // for why: this keeps every reviewed identity object in `registries`
  // (including construction.wet/wispy/anime, which this phase adds candidate
  // numbers for) completely byte-identical to before this phase, so none of
  // the many pre-existing cross-file "sibling remains untouched" guards need
  // updating. The six brand-new Phase 1R geometries also carry their own
  // `referenceTemplate` property directly (safe -- nothing hashed them
  // before this phase existed); they're listed here too for one consistent
  // lookup surface across all nine.
  const referenceTemplates = deepFreeze({
    'construction.wet': wetReferenceTemplate,
    'construction.wispy': wispyReferenceTemplate,
    'construction.anime': animeReferenceTemplate,
    'geometry.mega-volume-dense': megaVolumeDenseDefinition.referenceTemplate,
    'geometry.long-curved-fox': longCurvedFoxDefinition.referenceTemplate,
    'geometry.soft-volume-gradient': softVolumeGradientDefinition.referenceTemplate,
    'geometry.downturned-eye-correction': downturnedEyeCorrectionDefinition.referenceTemplate,
    'geometry.multi-curl-volume-fox': multiCurlVolumeFoxDefinition.referenceTemplate,
    'geometry.hybrid-cat-eye': hybridCatEyeDefinition.referenceTemplate,
  });

  const library = deepFreeze({
    libraryVersion: LIBRARY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    validationStates: VALIDATION_STATES,
    registryNames: REGISTRY_NAMES,
    schema,
    registries,
    targetInventory,
    activation,
    referenceTemplates,
  });

  function getDefinition(canonicalId) {
    for (const registryName of REGISTRY_NAMES) {
      const definition = library.registries[registryName][canonicalId];
      if (definition) return deepFreeze(cloneValue(definition));
    }
    return null;
  }

  function getSnapshot() {
    return deepFreeze(cloneValue(library));
  }

  return deepFreeze({
    LIBRARY_VERSION,
    SCHEMA_VERSION,
    VALIDATION_STATES,
    REGISTRY_NAMES,
    library,
    getDefinition,
    getSnapshot,
  });
});
