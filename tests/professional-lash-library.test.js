'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ProfessionalLashLibrary = require('../professional-lash-library.js');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const domainSource = fs.readFileSync(path.join(root, 'lash-design-domain.js'), 'utf8');
const { library, getDefinition, getSnapshot } = ProfessionalLashLibrary;
const allDefinitions = () => library.registryNames.flatMap(name => Object.values(library.registries[name]));

test('schema/version and every separate professional registry exist', () => {
  assert.strictEqual(library.libraryVersion, 1);
  assert.strictEqual(library.schemaVersion, 1);
  assert.deepStrictEqual(library.registryNames, [
    'geometries', 'techniques', 'constructionRecipes', 'directionStrategies',
    'curlStrategies', 'fanConstructions', 'presets',
  ]);
  for (const name of library.registryNames) assert.ok(library.registries[name] && typeof library.registries[name] === 'object', name);
  assert.strictEqual(library.schema.normalizedGeometry.peakPosition, 'NORMALIZED_RANGE');
  assert.strictEqual(library.schema.templateMm.separateFromNormalizedGeometry, true);
  assert.deepStrictEqual(library.schema.textureConstruction.primitives, ['SPIKE', 'RAY', 'TENTACLE', 'CLOSED_FAN', 'LAYER']);
});

test('validation states are explicit and only reviewed Squirrel, Doll, and Fox contain professional structure', () => {
  assert.deepStrictEqual(library.validationStates, ['UNVALIDATED', 'DRAFT', 'EXPERT_REVIEWED', 'VALIDATED', 'SCHOOL_DEPENDENT']);
  for (const definition of allDefinitions()) {
    assert.ok(library.validationStates.includes(definition.validation.status), definition.id);
    if(['geometry.squirrel','geometry.doll','geometry.fox'].includes(definition.id)){
      assert.strictEqual(definition.validation.status,'EXPERT_REVIEWED');
      assert.ok(definition.professionalDefinition);
      assert.strictEqual(definition.validation.evidence[0].numericClaims,false);
    }else{
      assert.strictEqual(definition.professionalDefinition, null, `${definition.id} must not contain invented professional content`);
      assert.deepStrictEqual(definition.validation.evidence, []);
      assert.deepStrictEqual(definition.validation.provenance, []);
      assert.deepStrictEqual(definition.validation.reviewers, []);
    }
  }
});

test('all 15 target identities exist once with globally unique stable canonical IDs', () => {
  const expected = ['Natural','Classic','Doll','Cat','Fox','Squirrel','Eyeliner','Wispy','Kim K','Angel','Wet','Rays','Anime','Jellyfish','American'];
  assert.deepStrictEqual(library.targetInventory.map(item => item.name), expected);
  const inventoryIds = library.targetInventory.map(item => item.canonicalId);
  const definitionIds = allDefinitions().map(item => item.id);
  assert.strictEqual(new Set(inventoryIds).size, 15);
  assert.strictEqual(new Set(definitionIds).size, definitionIds.length);
  assert.ok(inventoryIds.every(id => definitionIds.includes(id)));
});

test('domain identity separations are explicit and legacy aliases do not collapse effects', () => {
  assert.notStrictEqual(getDefinition('geometry.natural').id, getDefinition('technique.classic-one-to-one').id);
  assert.strictEqual(getDefinition('geometry.natural').kind, 'MAPPING_GEOMETRY');
  assert.strictEqual(getDefinition('technique.classic-one-to-one').kind, 'APPLICATION_TECHNIQUE');
  assert.notStrictEqual(getDefinition('construction.rays').id, getDefinition('construction.kim-k').id);
  assert.strictEqual(getDefinition('construction.rays').legacyReference.relationship, 'INDEPENDENT_IDENTITY_DESPITE_LEGACY_KIM_ALIAS');
  assert.strictEqual(getDefinition('construction.jellyfish').id, 'construction.jellyfish');
  assert.notStrictEqual(getDefinition('construction.anime').id, 'manga');
  assert.strictEqual(getDefinition('construction.anime').legacyReference.relationship, 'INDEPENDENT_IDENTITY_FROM_LEGACY_COMBINED_LABEL');
  assert.ok(allDefinitions().every(definition => definition.aliases.length === 0), 'aliases must not create canonical identities');
});

test('American is school-dependent unresolved identity, not universal validated truth', () => {
  const american = getDefinition('preset.american');
  assert.strictEqual(american.validation.status, 'SCHOOL_DEPENDENT');
  assert.strictEqual(american.school, 'UNRESOLVED');
  assert.strictEqual(american.unresolved, true);
  assert.strictEqual(american.professionalDefinition, null);
});

test('legacyReference is isolated and cannot masquerade as validated professional data', () => {
  const forbiddenNumericFields = ['normalizedGeometry','templateMm','scoreCoefficients','spikeDeltas','textureFrequencies','curlLiftStrength','techniqueDiameters'];
  for (const definition of allDefinitions()) {
    if(!['geometry.squirrel','geometry.doll','geometry.fox'].includes(definition.id))for (const field of forbiddenNumericFields) assert.strictEqual(definition.legacyReference[field], null, `${definition.id}/${field}`);
    assert.notStrictEqual(definition.validation.status,'VALIDATED', definition.id);
  }
  const squirrel=getDefinition('geometry.squirrel');
  assert.ok(!JSON.stringify(squirrel.professionalDefinition).includes('0.62'));
  assert.strictEqual(squirrel.legacyReference.normalizedGeometry.peakPosition,0.62);
  const doll=getDefinition('geometry.doll');
  assert.ok(!JSON.stringify(doll.professionalDefinition).includes('[0,0.24,0.46,0.6,1]'));
  assert.deepStrictEqual(doll.legacyReference.topology.zonePositions,[0,.24,.46,.60,1]);
  const fox=getDefinition('geometry.fox');
  assert.ok(!JSON.stringify(fox.professionalDefinition).includes('0.66'));
  assert.strictEqual(fox.legacyReference.normalizedGeometry.peakPosition,0.66);
});

test('activation architecture is explicit, single-effect, rollback-capable, and inactive', () => {
  assert.deepStrictEqual(library.activation, {
    productionEnabled: false,
    defaultState: 'INACTIVE',
    keyType: 'CANONICAL_ID_ONLY',
    aliasActivationAllowed: false,
    maxActiveDefinitions: 1,
    activeDefinitionIds: [],
    rollbackTarget: 'LEGACY_BEHAVIOR',
  });
});

test('library is deterministic, JSON-safe, and defensively immutable', () => {
  const first = getSnapshot(), second = getSnapshot();
  assert.deepStrictEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
  assert.ok(Object.isFrozen(library));
  assert.ok(Object.isFrozen(library.registries.geometries));
  const natural = getDefinition('geometry.natural');
  assert.ok(Object.isFrozen(natural));
  assert.throws(() => { natural.displayName = 'changed'; }, TypeError);
  assert.strictEqual(getDefinition('geometry.natural').displayName, 'Natural');
  assert.strictEqual(getDefinition('missing.effect'), null);
});

test('production is isolated: no loader, import, override, or ClientLashDesign coupling exists', () => {
  assert.ok(!indexSource.includes('professional-lash-library.js'));
  assert.ok(!indexSource.includes('ProfessionalLashLibrary'));
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(library.activation.productionEnabled, false);
  assert.deepStrictEqual(library.activation.activeDefinitionIds, []);
});

test('production source parity protects Recommendation, PHOTO, DIAGRAM, Plan, ranking, primary, and all 21 IDs', () => {
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(indexSource), '51a6c0871b4113ac5a133381690eaa7b376ea9bbf5b301a8af0fb08104347f39');
  assert.strictEqual(digest(domainSource), '992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  assert.ok(indexSource.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'));
  assert.ok(indexSource.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
  const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = '),catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart);
  const catalog=new Function('const clampScore=n=>n;'+indexSource.slice(catalogStart,catalogEnd)+';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(entry=>entry.id), ['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
});
