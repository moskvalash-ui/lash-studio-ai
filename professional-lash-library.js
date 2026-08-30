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

  const registries = {
    geometries: {
      'geometry.natural': identity('geometry.natural', 'Natural', 'MAPPING_GEOMETRY', { legacyIds: ['natural'] }),
      'geometry.doll': identity('geometry.doll', 'Doll', 'MAPPING_GEOMETRY', { legacyIds: ['doll'] }),
      'geometry.cat': identity('geometry.cat', 'Cat', 'MAPPING_GEOMETRY', { legacyIds: ['cat'] }),
      'geometry.fox': identity('geometry.fox', 'Fox', 'MAPPING_GEOMETRY', { legacyIds: ['fox'] }),
      'geometry.squirrel': identity('geometry.squirrel', 'Squirrel', 'MAPPING_GEOMETRY', { legacyIds: ['squirrel'] }),
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
