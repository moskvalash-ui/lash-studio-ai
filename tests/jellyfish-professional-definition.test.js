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
const jellyfish=Library.getDefinition('construction.jellyfish');
const professional=jellyfish.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('construction.jellyfish is the populated, expert-reviewed, non-numeric, production-inactive canonical identity',()=>{
  assert.strictEqual(jellyfish.id,'construction.jellyfish');
  assert.strictEqual(jellyfish.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(jellyfish.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(jellyfish.validation.status,'VALIDATED');
  assert.strictEqual(jellyfish.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('no production DESIGN_CATALOG Jellyfish entry exists, and the only debug-preview mention stays confined to the isolated presentation layer',()=>{
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.ok(!catalog.some(entry=>/jellyfish/i.test(entry.id)));
  // A presentation-only Russian display-name lookup keyed by canonicalId
  // (added for the debug preview's RU translation layer) legitimately
  // contains the literal string 'construction.jellyfish' — that lookup
  // lives entirely inside the isolated preview/detail block, never in
  // production code before it or in App()/HomeScreen/any production
  // screen after it.
  const previewStart=indexSource.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
  const appStart=indexSource.indexOf('function App() {');
  assert.ok(previewStart>-1&&appStart>previewStart);
  assert.ok(!/jellyfish/i.test(indexSource.slice(0,previewStart)));
  assert.ok(!/jellyfish/i.test(indexSource.slice(appStart)));
  assert.ok(!/jellyfish/i.test(domainSource));
});

test('no legacy IDs, aliases, geometry, curl, technique, or scoring are invented for Jellyfish',()=>{
  assert.deepStrictEqual(jellyfish.legacyReference.legacyIds,[]);
  assert.deepStrictEqual(jellyfish.legacyReference.legacyAliases,[]);
  assert.strictEqual(jellyfish.legacyReference.relationship,'NO_CURRENT_PRODUCTION_PRECEDENT');
  for(const field of ['normalizedGeometry','templateMm','scoreCoefficients','spikeDeltas','textureFrequencies','curlLiftStrength','techniqueDiameters'])assert.strictEqual(jellyfish.legacyReference[field],null,field);
  assert.strictEqual(jellyfish.legacyReference.curl,undefined);
  assert.strictEqual(jellyfish.legacyReference.applicationTechnique,undefined);
  assert.strictEqual(jellyfish.legacyReference.textureExecution,undefined);
  assert.strictEqual(jellyfish.legacyReference.category,undefined);
});

test('the candidate identity is qualitative: separated elongated accents, long-short hierarchy, sparse support, negative space, irregular composition',()=>{
  assert.strictEqual(professional.invariantOutcome.accentArchitecture,'SEPARATED_ELONGATED_DOMINANT_ACCENTS');
  assert.strictEqual(professional.invariantOutcome.hierarchy,'STRONG_LONG_VS_SHORT_VISUAL_HIERARCHY');
  assert.strictEqual(professional.invariantOutcome.supportingFieldCharacter,'COMPARATIVELY_SPARSE_OR_SOFT_SUPPORTING_FIELD');
  assert.strictEqual(professional.invariantOutcome.negativeSpace,'VISIBLE_NEGATIVE_SPACE');
  assert.strictEqual(professional.invariantOutcome.composition,'INTENTIONALLY_IRREGULAR_CONTROLLED_COMPOSITION');
  assert.strictEqual(professional.invariantOutcome.finish.numericClaim,false);
  assert.strictEqual(professional.invariantOutcome.finish.literalChaosClaim,false);
});

test('identity confidence is recorded as low, single-source, with no repository precedent',()=>{
  assert.strictEqual(professional.identityConfidence.repositoryProductionPrecedent,false);
  assert.strictEqual(professional.identityConfidence.multiSourceCorroboration,false);
  assert.ok(professional.identityConfidence.resolution.includes('LOW_CONFIDENCE'));
});

test('exact spike count, spacing, regularity, millimeters, density, and fan construction remain unresolved or null',()=>{
  const s=professional.spikeAccentArchitecture;
  assert.strictEqual(s.exactSpikeCount,null);
  assert.strictEqual(s.exactSpacing,null);
  assert.strictEqual(s.exactSpikeWidth,null);
  assert.strictEqual(s.exactLengthDelta,null);
  assert.ok(s.exactRegularity.includes('UNRESOLVED'));
  assert.ok(s.exactAlternation.includes('UNRESOLVED'));
  assert.strictEqual(professional.exactMillimeters,null);
  assert.strictEqual(professional.exactDensity,null);
  assert.strictEqual(professional.exactVolume,null);
  assert.strictEqual(professional.exactFanWidth,null);
  assert.strictEqual(professional.exactLayerCount,null);
  assert.strictEqual(professional.exactDiameter,null);
  assert.strictEqual(professional.relationships.fanConstruction.constructionId,null);
  assert.strictEqual(professional.relationships.fanConstruction.universalFanConstruction,null);
  for(const field of ['exactDensity','exactDiameter','exactVolume','exactFanWidth','exactLayerCount','exactExtensionCount','exactMillimeters'])assert.strictEqual(professional.densityFinish[field],null,field);
});

test('execution never becomes universal: no mandatory closed/narrow fans, RAY, layering, fan construction, volume, density, or technique',()=>{
  const o=professional.outcomeVsExecution;
  assert.strictEqual(o.universallyRequiresClosedFans,false);
  assert.strictEqual(o.universallyRequiresNarrowFans,false);
  assert.strictEqual(o.universallyRequiresRay,false);
  assert.strictEqual(o.universallyRequiresSpecificLayering,false);
  assert.strictEqual(o.universallyRequiresSpecificFanConstruction,false);
  assert.strictEqual(o.universallyRequiresSpecificVolume,false);
  assert.strictEqual(o.universallyRequiresSpecificDensity,false);
  assert.strictEqual(o.universallyRequiresSpecificApplicationTechnique,false);
  assert.strictEqual(o.universalMethod,null);
});

test('supporting field is conservative: no universal base construction is required',()=>{
  assert.strictEqual(professional.supportingField.universalBaseConstruction,null);
  assert.strictEqual(professional.supportingField.continuousBaseUniversal,false);
  assert.strictEqual(professional.supportingField.fanBaseUniversal,false);
  assert.strictEqual(professional.supportingField.closedFanBaseUniversal,false);
  assert.strictEqual(professional.supportingField.universalLayerCount,null);
});

test('negative space is professionally relevant without a numeric gap, interval, frequency, or mandatory pattern',()=>{
  assert.strictEqual(professional.negativeSpace.universalNumericGap,null);
  assert.strictEqual(professional.negativeSpace.exactInterval,null);
  assert.strictEqual(professional.negativeSpace.exactFrequency,null);
  assert.strictEqual(professional.negativeSpace.mandatoryRepeatingPattern,false);
  assert.strictEqual(professional.negativeSpace.exactGapArchitecture,'UNRESOLVED');
});

test('geometry remains a separate mandatory carrier slot with no geometry.jellyfish',()=>{
  assert.strictEqual(professional.relationships.geometry.role,'MANDATORY_CARRIER_SLOT');
  assert.strictEqual(professional.relationships.geometry.geometryId,null);
  assert.deepStrictEqual(professional.relationships.geometry.universalCompatibleIds,[]);
  assert.strictEqual(Library.getDefinition('geometry.jellyfish'),null);
});

test('direction remains secondary with no direction.jellyfish and no universal strategy',()=>{
  assert.strictEqual(professional.relationships.direction.role,'SECONDARY');
  assert.strictEqual(professional.relationships.direction.directionStrategyId,null);
  assert.strictEqual(professional.relationships.direction.numericAngles,null);
  assert.strictEqual(professional.relationships.direction.universalDirectionStrategy,null);
  assert.strictEqual(Library.getDefinition('direction.jellyfish'),null);
});

test('curl remains separate and unresolved',()=>{
  assert.strictEqual(professional.relationships.curl.curlStrategyId,null);
  assert.strictEqual(professional.relationships.curl.exactCurl,null);
});

test('application technique remains separate/unresolved and never defaults to Classic, Volume, or Wet',()=>{
  const at=professional.relationships.applicationTechnique;
  assert.strictEqual(at.techniqueId,null);
  assert.strictEqual(at.role,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(at.defaultsToClassic,false);
  assert.strictEqual(at.defaultsToVolume,false);
  assert.strictEqual(at.defaultsToWet,false);
});

test('RAY is a possible, non-mandatory execution method for Jellyfish and RAY itself is untouched',()=>{
  const rp=professional.rayPrimitiveRelationship;
  assert.strictEqual(rp.role,'POSSIBLE_NON_UNIVERSAL_EXECUTION_METHOD');
  assert.strictEqual(rp.required,false);
  assert.strictEqual(rp.mandatory,false);
  assert.strictEqual(rp.jellyfishIsCompleteConstruction,true);
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.ok(!ray.professionalDefinition.reusability.potentialContainingConstructionIds.includes('construction.jellyfish'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ray.professionalDefinition.taxonomyRelationships,'jellyfish'));
  assert.strictEqual(digest(JSON.stringify(ray)),'3e23c055de03aa7c238df7182c808983475d5d46e89062743d06066caa48aefb');
});

test('Anime boundary stays school-dependent/unresolved, never a universal distinction',()=>{
  const cmp=professional.crossEffectComparison.anime;
  assert.strictEqual(cmp.status,'SCHOOL_DEPENDENT_POSSIBLE_TERMINOLOGY_OVERLAP_WITH_ANIME_MANGA');
  assert.strictEqual(cmp.universalDistinctionAsserted,false);
  assert.strictEqual(cmp.possibleSynonymInSomeSources,true);
  const anime=Library.getDefinition('construction.anime');
  assert.strictEqual(anime.professionalDefinition.crossEffectComparison.jellyfish.status,'SCHOOL_DEPENDENT_POSSIBLE_TERMINOLOGY_OVERLAP_WITH_ANIME_MANGA');
  assert.strictEqual(anime.professionalDefinition.crossEffectComparison.jellyfish.boundaryResolved,false);
});

test('Wispy and Kim K boundaries remain provisional/school-dependent, with Wispy and Kim K untouched',()=>{
  const wispyCmp=professional.crossEffectComparison.wispy;
  assert.strictEqual(wispyCmp.status,'SCHOOL_DEPENDENT_PROVISIONAL');
  assert.strictEqual(wispyCmp.universalNumericRegularityDifference,false);
  const kimKCmp=professional.crossEffectComparison.kimK;
  assert.strictEqual(kimKCmp.status,'SCHOOL_DEPENDENT_PROVISIONAL');
  assert.strictEqual(kimKCmp.universalNumericRegularityDifference,false);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wispy'))),'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.kim-k'))),'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3');
});

test('Wet relationship records possible execution overlap without collapsing the two identities, and Wet is untouched',()=>{
  const wetCmp=professional.crossEffectComparison.wet;
  assert.strictEqual(wetCmp.identityCollapse,false);
  assert.strictEqual(wetCmp.mutuallyExclusive,false);
  assert.ok(wetCmp.possibleSharedExecution.includes('FAN'));
  assert.notStrictEqual(wetCmp.status,'IDENTICAL');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wet'))),'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff');
});

test('Angel receives no invented dedicated relationship, and Angel is untouched',()=>{
  assert.strictEqual(professional.crossEffectComparison.angel,undefined);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.angel'))),'ba6f01a6e7745f4fb17c29af90d5c38e3870da0cb0aef5af9787196c3bbc7dae');
});

test('validation includes provenance, review, revision, and every required unresolved dimension',()=>{
  assert.ok(jellyfish.validation.evidence.length&&jellyfish.validation.provenance.length&&jellyfish.validation.reviewers.length&&jellyfish.validation.notes.length);
  assert.strictEqual(jellyfish.validation.revision,1);
  assert.strictEqual(jellyfish.validation.evidence[0].repositoryProductionPrecedent,false);
  for(const item of ['JELLYFISH_VS_ANIME_MANGA_TERMINOLOGY_BOUNDARY','EXACT_SPIKE_CONSTRUCTION','EXACT_HIERARCHY_OR_TIERING','EXACT_RHYTHM','EXACT_SPACING','EXACT_REGULARITY','SUPPORTING_BASE_CONSTRUCTION','LAYERING','FAN_CONSTRUCTION','GEOMETRY_COMPATIBILITY','DIRECTION_COMPATIBILITY','CURL_SELECTION','TECHNIQUE_COMPATIBILITY','DENSITY','DIAMETER','VOLUME','NEGATIVE_SPACE_ARCHITECTURE','JELLYFISH_KIM_K_BOUNDARY','JELLYFISH_WISPY_BOUNDARY','JELLYFISH_WET_BOUNDARY','REGIONAL_OR_SCHOOL_TERMINOLOGY'])assert.ok(professional.unresolved.includes(item),item);
});

test('protected professional definitions remain byte-identical after populating Jellyfish',()=>{
  const expected={
    'geometry.natural':'805e701d0fc611c6bcaa946b23f36d6d428422026ae31f6800a286b8f280fcd9',
    'geometry.doll':'ff527430e297a4ebcc7f4a8f7820a2ca9623bc2f5f69c873d09c903c900cd64d',
    'geometry.squirrel':'983946b9933f5ae275801fd7b2bdc7d470c31bca010bdce458070f18bdbfe1d6',
    'geometry.cat':'fc9b21fc83afbf00ebb0e41a225a7f5eef06782db3d60b2216be7322b8ee7d58',
    'geometry.fox':'7cf9298a0331e08843127c74fc4f8f38b9ef5742e6e5a7e3bb13cd7d0a2811c7',
    'direction.cat':'973a81cae098b780ec590bfe08ab3eaa2478a28a8aec66ab1efc5584c48ff0d9',
    'direction.fox':'13ab577bd4a7e9332151e11ad16675ac70525cd3edde82bac0acfb1eeea6a8ed',
    'technique.classic-one-to-one':'09eeff8937f5a5b83d14ac7e8c450f3f2a4be98851fdd4d632d9d0cf76189081',
    'preset.eyeliner':'76bab61bfd6e66fa794504749c3e505a569f199451a6e9284674d0300bc8bd9a',
    'construction.wet':'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff',
    'construction.angel':'ba6f01a6e7745f4fb17c29af90d5c38e3870da0cb0aef5af9787196c3bbc7dae',
    'construction.wispy':'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86',
    'construction.kim-k':'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3',
    'construction.rays':'5054f998b7976c0c7ca63d6a2fe0a426d8655ba74c227c13cc8ee121c586bffd',
  };
  for(const [id,hash] of Object.entries(expected))assert.strictEqual(digest(JSON.stringify(Library.getDefinition(id))),hash,id);
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.strictEqual(digest(JSON.stringify(ray)),'3e23c055de03aa7c238df7182c808983475d5d46e89062743d06066caa48aefb');
});

test('production is untouched: activation stays inactive and all 21 legacy IDs and consumers remain byte-identical',()=>{
  assert.strictEqual(digest(indexSource),'8158c616f8b88ea34c1afa598118fbb1f3d3b8dfcb45f50b509ecb04b53a2bbb');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});
