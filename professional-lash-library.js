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

  const registries = {
    geometries: {
      'geometry.natural': naturalDefinition,
      'geometry.doll': dollDefinition,
      'geometry.cat': catDefinition,
      'geometry.fox': foxDefinition,
      'geometry.squirrel': squirrelDefinition,
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
