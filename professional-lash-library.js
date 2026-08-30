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
    }],
    provenance: [{ source: 'PHASE_1D_APPROVED_PROFESSIONAL_BRIEF', scope: 'STRUCTURAL_ONLY' }],
    reviewers: [{ role: 'DOMAIN_REVIEW', identifier: 'PHASE_1D_APPROVAL' }],
    reviewedAt: null,
    revision: 1,
    notes: ['Numeric peak range, normalized samples, plateau, tail drop, template mm, compatibility, and variants remain unresolved.'],
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

  const registries = {
    geometries: {
      'geometry.natural': identity('geometry.natural', 'Natural', 'MAPPING_GEOMETRY', { legacyIds: ['natural'] }),
      'geometry.doll': dollDefinition,
      'geometry.cat': catDefinition,
      'geometry.fox': foxDefinition,
      'geometry.squirrel': squirrelDefinition,
    },
    techniques: {
      'technique.classic-one-to-one': identity('technique.classic-one-to-one', 'Classic', 'APPLICATION_TECHNIQUE', { legacyAliases: ['Classic 1:1'] }),
    },
    constructionRecipes: {
      'construction.wispy': identity('construction.wispy', 'Wispy', 'CONSTRUCTION_RECIPE', { legacyIds: ['wispy'] }),
      'construction.kim-k': identity('construction.kim-k', 'Kim K', 'CONSTRUCTION_RECIPE', { legacyIds: ['kim'], legacyAliases: ['Rays', 'Soft Rays'] }),
      'construction.angel': identity('construction.angel', 'Angel', 'CONSTRUCTION_RECIPE', { legacyIds: ['angel'] }),
      'construction.wet': identity('construction.wet', 'Wet', 'CONSTRUCTION_RECIPE', { legacyIds: ['wet'] }),
      'construction.rays': identity('construction.rays', 'Rays', 'CONSTRUCTION_RECIPE', {
        legacyRelationship: 'INDEPENDENT_IDENTITY_DESPITE_LEGACY_KIM_ALIAS',
      }),
      'construction.anime': identity('construction.anime', 'Anime', 'CONSTRUCTION_RECIPE', {
        legacyIds: ['manga'], legacyAliases: ['Manga / Anime'],
        legacyRelationship: 'INDEPENDENT_IDENTITY_FROM_LEGACY_COMBINED_LABEL',
      }),
      'construction.jellyfish': identity('construction.jellyfish', 'Jellyfish', 'CONSTRUCTION_RECIPE'),
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

  const library = deepFreeze({
    libraryVersion: LIBRARY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    validationStates: VALIDATION_STATES,
    registryNames: REGISTRY_NAMES,
    schema,
    registries,
    targetInventory,
    activation,
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
