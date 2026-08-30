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

  const registries = {
    geometries: {
      'geometry.natural': identity('geometry.natural', 'Natural', 'MAPPING_GEOMETRY', { legacyIds: ['natural'] }),
      'geometry.doll': identity('geometry.doll', 'Doll', 'MAPPING_GEOMETRY', { legacyIds: ['doll'] }),
      'geometry.cat': identity('geometry.cat', 'Cat', 'MAPPING_GEOMETRY', { legacyIds: ['cat'] }),
      'geometry.fox': identity('geometry.fox', 'Fox', 'MAPPING_GEOMETRY', { legacyIds: ['fox'] }),
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
    },
    directionStrategies: {},
    curlStrategies: {},
    fanConstructions: {},
    presets: {
      'preset.eyeliner': identity('preset.eyeliner', 'Eyeliner', 'COMPOSITE_PRESET', { legacyIds: ['eyeliner'] }),
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
    },
    direction: 'REFERENCE_TO_DIRECTION_STRATEGIES_REGISTRY',
    curlStrategy: 'REFERENCE_TO_CURL_STRATEGIES_REGISTRY',
    volumeFanConstruction: 'REFERENCE_TO_FAN_CONSTRUCTIONS_REGISTRY',
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
