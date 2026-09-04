'use strict';
const test=require('node:test');
const assert=require('node:assert');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const Library=require('../professional-lash-library.js');

const root=path.join(__dirname,'..');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const domainSource=fs.readFileSync(path.join(root,'lash-design-domain.js'),'utf8');
const classic=Library.getDefinition('technique.classic-one-to-one');
const professional=classic.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('technique.classic-one-to-one is the populated, expert-reviewed, non-numeric, production-inactive canonical identity',()=>{
  assert.strictEqual(classic.id,'technique.classic-one-to-one');
  assert.strictEqual(classic.kind,'APPLICATION_TECHNIQUE');
  assert.ok(professional);
  assert.strictEqual(classic.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(classic.validation.status,'VALIDATED');
  assert.strictEqual(classic.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('core invariant is one single extension applied to one isolated suitable natural lash',()=>{
  assert.strictEqual(professional.coreInvariant.unit,'ONE_SINGLE_EXTENSION_APPLIED_TO_ONE_ISOLATED_SUITABLE_NATURAL_LASH');
  assert.strictEqual(professional.coreInvariant.extensionsPerNaturalLash,'EXACTLY_ONE');
  assert.strictEqual(professional.coreInvariant.dependency,'NOT_SCHOOL_DEPENDENT');
});

test('Classic is not mapping geometry, fan strategy, preset, Natural geometry, or a fixed curl/diameter/density rule',()=>{
  assert.deepStrictEqual(professional.excludedDefiningTraits,{
    isMappingGeometry:false,isFanStrategy:false,isPreset:false,isNaturalGeometry:false,
    hasFixedCurl:false,hasFixedDiameter:false,hasFixedDensity:false,
  });
});

test('attachment requires an isolated suitable natural lash and a suitability assessment, without a numeric coverage requirement',()=>{
  assert.strictEqual(professional.attachment.isolatedNaturalLashRequired,true);
  assert.strictEqual(professional.attachment.everyNaturalLashMustBeExtended,false);
  assert.strictEqual(professional.attachment.suitabilityAssessmentRequired,true);
  assert.strictEqual(professional.attachment.numericCoverageRequirement,null);
});

test('the pure Classic unit excludes multi-extension volume fans and creates no Classic fan strategy',()=>{
  assert.strictEqual(professional.fanConstructionBoundary.pureClassicUnit,'ONE_SINGLE_EXTENSION');
  assert.strictEqual(professional.fanConstructionBoundary.fanConstructionId,null);
  assert.strictEqual(professional.fanConstructionBoundary.multiExtensionVolumeFansExcludedFromPureUnit,true);
  assert.strictEqual(professional.fanConstructionBoundary.classicFanStrategyCreated,false);
  assert.ok(professional.fanConstructionBoundary.manufacturedExtensionClassification.includes('UNRESOLVED'));
});

test('geometry.natural is unchanged and Classic does not require it, carrying geometry as a separate slot',()=>{
  const natural=Library.getDefinition('geometry.natural');
  assert.strictEqual(natural.kind,'MAPPING_GEOMETRY');
  assert.strictEqual(digest(JSON.stringify(natural)),'805e701d0fc611c6bcaa946b23f36d6d428422026ae31f6800a286b8f280fcd9');
  assert.strictEqual(professional.geometryRelationship.domain,'MAPPING_GEOMETRY');
  assert.strictEqual(professional.geometryRelationship.role,'SEPARATE_CARRIER_SLOT');
  assert.strictEqual(professional.geometryRelationship.geometryId,null);
  assert.deepStrictEqual(professional.geometryRelationship.universalCompatibleIds,[]);
  assert.strictEqual(professional.geometryRelationship.requiresNaturalGeometry,false);
});

test('curl, diameter, and density/finish remain separate client- and layer-dependent slots with no fixed values',()=>{
  assert.strictEqual(professional.curl.curlStrategyId,null);
  assert.strictEqual(professional.curl.exactCurl,null);
  assert.strictEqual(professional.diameter.exactValue,null);
  assert.strictEqual(professional.diameter.role,'CLIENT_LASH_DEPENDENT');
  assert.strictEqual(professional.densityFinish.exactDensity,null);
  assert.strictEqual(professional.densityFinish.fullCoverageRequired,false);
  assert.strictEqual(professional.densityFinish.naturalFinishRequired,false);
});

test('direction is a separate secondary layer with no numeric angles and no direction.classic identity',()=>{
  assert.strictEqual(professional.direction.strategyId,null);
  assert.strictEqual(professional.direction.numericAngles,null);
  assert.strictEqual(professional.direction.directionVectors,null);
  assert.strictEqual(professional.direction.classicDirectionIdentityCreated,false);
  assert.strictEqual(Library.getDefinition('direction.classic'),null);
});

test('safety and suitability require client-specific assessment, never an automatic or universal numeric claim',()=>{
  assert.strictEqual(professional.safetySuitability.automaticSafetyClaim,false);
  assert.strictEqual(professional.safetySuitability.clientSpecificAssessmentRequired,true);
  assert.strictEqual(professional.safetySuitability.universalNumericLimits,null);
});

test('Classic vs Volume is a qualitative boundary only, and no Volume professional definition is created',()=>{
  const volume=professional.crossEffectComparison.volume;
  assert.strictEqual(volume.classicUnit,'ONE_SINGLE_EXTENSION');
  assert.strictEqual(volume.volumeUnit,'MULTIPLE_EXTENSIONS_FORMING_A_FAN');
  assert.strictEqual(volume.sharedTarget,'ONE_ISOLATED_SUITABLE_NATURAL_LASH');
  assert.strictEqual(volume.distinction,'QUALITATIVE_ONLY');
  assert.strictEqual(volume.volumeProfessionalDefinitionCreated,false);
  assert.strictEqual(Library.getDefinition('technique.volume'),null);
  assert.strictEqual(Library.getDefinition('geometry.volume'),null);
});

test('Hybrid remains unresolved with no ratios, patterns, density, or canonical Hybrid domain',()=>{
  const hybrid=professional.crossEffectComparison.hybrid;
  assert.strictEqual(hybrid.status,'UNRESOLVED');
  assert.strictEqual(hybrid.canonicalHybridDomainEstablished,false);
  assert.strictEqual(hybrid.ratios,null);
  assert.strictEqual(hybrid.patterns,null);
  assert.strictEqual(hybrid.density,null);
});

test('school dependency separates the not-school-dependent core invariant from the school-dependent execution protocol',()=>{
  assert.strictEqual(professional.schoolDependency.coreInvariant,'NOT_SCHOOL_DEPENDENT');
  assert.strictEqual(professional.schoolDependency.detailedExecutionProtocol,'SCHOOL_DEPENDENT');
});

test('reviewed Wet, Angel, Wispy, Kim K, and RAY definitions remain byte-identical and untouched by Classic',()=>{
  const wet=Library.getDefinition('construction.wet');
  const angel=Library.getDefinition('construction.angel');
  const wispy=Library.getDefinition('construction.wispy');
  const kimK=Library.getDefinition('construction.kim-k');
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.strictEqual(digest(JSON.stringify(wet)),'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff');
  assert.strictEqual(digest(JSON.stringify(angel)),'ba6f01a6e7745f4fb17c29af90d5c38e3870da0cb0aef5af9787196c3bbc7dae');
  assert.strictEqual(digest(JSON.stringify(wispy)),'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86');
  assert.strictEqual(digest(JSON.stringify(kimK)),'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3');
  assert.strictEqual(digest(JSON.stringify(ray)),'3e23c055de03aa7c238df7182c808983475d5d46e89062743d06066caa48aefb');
  assert.strictEqual(ray.id,'RAY');
  assert.strictEqual(ray.validation.status,'EXPERT_REVIEWED');
});

test('legacy Classic 1:1 diameter and IDs remain isolated legacy-only comparison data',()=>{
  assert.deepStrictEqual(classic.legacyReference.legacyIds,['classic']);
  assert.deepStrictEqual(classic.legacyReference.legacyAliases,['Classic 1:1']);
  assert.strictEqual(classic.legacyReference.relationship,'CURRENT_PRODUCTION_COMPARISON_ONLY');
  assert.deepStrictEqual(classic.legacyReference.techniqueDiameters,['0.15–0.20 mm']);
  const json=JSON.stringify(professional);
  assert.ok(!json.includes('0.15'));
  assert.ok(!json.includes('0.20'));
  assert.ok(!json.includes('mm'));
});

test('validation includes provenance, review, revision, and explicit unresolved metadata',()=>{
  assert.ok(classic.validation.evidence.length&&classic.validation.provenance.length&&classic.validation.reviewers.length&&classic.validation.notes.length);
  assert.strictEqual(classic.validation.revision,1);
  for(const item of ['ATTACHMENT_CONVENTIONS','SPLIT_Y_FORKED_PRODUCT_BOUNDARY','COVERAGE_TERMINOLOGY','TEXTURED_CLASSIC_TERMINOLOGY','SINGLE_BASED_WET_TERMINOLOGY','GEOMETRY_COMPATIBILITY','DIRECTION_CONVENTIONS','SUITABILITY_PROTOCOL','PRODUCT_MASS_SHAPE_DIAMETER_MATERIAL_EFFECTS','REGIONAL_TERMINOLOGY','HYBRID_CANONICAL_DOMAIN','NUMERIC_SAFETY_LIMITS'])assert.ok(professional.unresolved.includes(item),item);
});

test('production is untouched: activation stays inactive and all 21 legacy IDs and consumers remain byte-identical',()=>{
  assert.strictEqual(digest(indexSource),'9e20ac494a4b9f125cc4189f791bd896343b11aa48a8c9bcea0f74909e997277');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  assert.ok(indexSource.includes("{ id:'classic', label:'Classic 1:1', diameter:'0.15–0.20 mm' }"));
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});
