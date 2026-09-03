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
const kim=Library.getDefinition('construction.kim-k');
const professional=kim.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('construction.kim-k is populated, expert-reviewed, non-numeric, and inactive',()=>{
  assert.strictEqual(kim.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(kim.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(kim.validation.status,'VALIDATED');
  assert.strictEqual(kim.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('core identity is a structured repeated accent hierarchy over support',()=>{
  assert.deepStrictEqual(professional.invariantOutcome,{
    hierarchy:'DELIBERATELY_STRUCTURED_ACCENT_HIERARCHY',accentArchitecture:'REPEATED_VISIBLE_ACCENT_SPIKES_OR_WISPS',
    supportRelationship:'ACCENT_TO_SUPPORT_HIERARCHY',topLine:'SEGMENTED_BROKEN_TOP_LINE',
    finish:'DIMENSIONAL_INTENTIONALLY_STYLED_TEXTURE',rhythm:'READABLE_REPEATED_ACCENT_RHYTHM',
  });
});

test('visual outcome is separate from school- or variant-dependent execution',()=>{
  assert.strictEqual(professional.outcomeVsExecution.executionMethodStatus,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(professional.outcomeVsExecution.universalMethod,null);
  assert.strictEqual(professional.outcomeVsExecution.differentMethodsMayShareCanonicalIdentity,true);
});

test('hierarchy is qualitative and the legacy alternating plan is not universal',()=>{
  const hierarchy=professional.spikeWispHierarchy;
  assert.strictEqual(hierarchy.primaryVisibleAccents,'ESSENTIAL');
  assert.strictEqual(hierarchy.supportingField,'ESSENTIAL_CONCEPT');
  assert.strictEqual(hierarchy.qualitativeAccentHierarchy,'ESSENTIAL');
  assert.strictEqual(hierarchy.repeatedPattern,'ESSENTIAL_QUALITATIVE');
  assert.strictEqual(hierarchy.exactAlternatingPattern,'NOT_UNIVERSAL');
  assert.strictEqual(hierarchy.universalHierarchy,null);
  assert.strictEqual(hierarchy.universalSpikePlan,null);
});

test('rhythm requires intentional repetition without exact or symmetric spacing',()=>{
  const rhythm=professional.spacingRhythm;
  assert.strictEqual(rhythm.qualitativeRequirement,'INTENTIONALLY_PLACED_REPEATED_ACCENTS_MAINTAIN_READABLE_HIERARCHY');
  assert.strictEqual(rhythm.exactRhythm,'SCHOOL_DEPENDENT_UNRESOLVED');
  assert.strictEqual(rhythm.exactSpacing,null);
  for(const field of ['equalSpacingRequired','semiRegularSpacingRequired','organicSpacingRequired','clusteringRequired','symmetricalIntervalsRequired'])assert.strictEqual(rhythm[field],false,field);
});

test('supporting field permits base, layered, and integrated variants without one universal base',()=>{
  const base=professional.supportingFieldBase;
  assert.strictEqual(base.visuallyDistinctSupportingField,'ESSENTIAL_CONCEPT');
  assert.strictEqual(base.shorterBase,'COMMON_VARIANT');
  assert.strictEqual(base.spikeOverBaseConstruction,'COMMON_SCHOOL_DEPENDENT_METHOD');
  assert.strictEqual(base.integratedMixedLengths,'LEGITIMATE_ALTERNATIVE');
  assert.strictEqual(base.separatePhysicalLayers,'SCHOOL_DEPENDENT');
  assert.strictEqual(base.exactBaseDensity,null);
  assert.strictEqual(base.universalBaseConstruction,null);
});

test('Wispy relationship is reviewed, school-dependent, and non-exclusive while Wispy stays unchanged',()=>{
  const relation=professional.relationshipWithWispy;
  assert.strictEqual(relation.relationship,'SCHOOL_DEPENDENT_RELATIONSHIP');
  assert.strictEqual(relation.strongerSpikeHierarchy,'SUPPORTED');
  assert.strictEqual(relation.strongerAccentToSupportContrast,'SUPPORTED');
  assert.strictEqual(relation.alwaysWispySubtype,'SEMANTIC_OR_SCHOOL_DEPENDENT');
  assert.strictEqual(relation.universallySeparateFromWispy,'UNRESOLVED');
  assert.strictEqual(relation.mutuallyExclusive,false);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wispy'))),'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86');
});

test('Rays remains separate, unchanged, and not a canonical Kim K alias',()=>{
  const rays=Library.getDefinition('construction.rays'),relation=professional.relationshipWithRays;
  assert.notStrictEqual(rays.id,kim.id);
  assert.strictEqual(relation.relationship,'SCHOOL_DEPENDENT_OVERLAP');
  assert.strictEqual(relation.professionallyIdentical,false);
  assert.strictEqual(relation.canonicalAliasRelationship,false);
  assert.strictEqual(relation.exactTaxonomy,'UNRESOLVED_PENDING_RAYS_SPECIFIC_AUDIT');
  assert.deepStrictEqual(kim.aliases,[]);
  assert.strictEqual(digest(JSON.stringify(rays)),'5054f998b7976c0c7ca63d6a2fe0a426d8655ba74c227c13cc8ee121c586bffd');
});

test('geometry and direction remain separate without Kim K identities or numeric execution',()=>{
  assert.strictEqual(Library.getDefinition('geometry.kim-k'),null);
  assert.strictEqual(Library.getDefinition('direction.kim-k'),null);
  assert.deepStrictEqual(professional.relationships.geometry,{domain:'MAPPING_GEOMETRY',role:'MANDATORY_CARRIER_SLOT',selection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[]});
  assert.strictEqual(professional.relationships.direction.role,'SECONDARY');
  for(const field of ['numericAngles','directionVectors','directionalZones','universalSweep'])assert.strictEqual(professional.relationships.direction[field],null,field);
});

test('fan and layering execution remain non-universal and non-numeric',()=>{
  const fan=professional.relationships.fanConstruction,layering=professional.relationships.layering;
  assert.strictEqual(fan.closedFanSpikes,'COMMON_PRIMARY_VARIANT');
  assert.strictEqual(fan.narrowOrNearlyClosedSpikes,'COMMON_PRIMARY_VARIANT');
  assert.strictEqual(fan.universalFanConstruction,null);
  assert.strictEqual(layering.role,'SCHOOL_DEPENDENT');
  assert.strictEqual(layering.universalLayeringMethod,null);
  assert.strictEqual(layering.universalLayerCount,null);
  for(const field of ['exactFanCount','exactFanWidth','exactDiameter','exactVolume','exactFanClosurePercentage','exactLayerCount'])assert.strictEqual(professional[field],null,field);
});

test('curl, technique, and density are separate qualitative variant layers',()=>{
  assert.strictEqual(professional.relationships.curl.role,'NOT_PART_OF_EFFECT');
  assert.strictEqual(professional.relationships.curl.exactCurl,null);
  assert.strictEqual(professional.relationships.applicationTechnique.techniqueId,null);
  assert.deepStrictEqual(professional.densityFinish.essential,['TEXTURED','DIMENSIONAL','VISIBLY_ACCENTED','SEGMENTED_TOP_LINE']);
  assert.strictEqual(professional.densityFinish.exactDensity,null);
  for(const field of ['bold','dense','editorial'])assert.notStrictEqual(professional.densityFinish[field],'UNIVERSAL',field);
});

test('all legacy precision is isolated outside professional truth',()=>{
  const json=JSON.stringify(professional);
  for(const legacy of ['[6,10,7,11,8]','peakZone','frequency','baseToSpikeDiff','TALL_SHORT_TALL','0.35','1.05','Volume 3D','confidenceThreshold','Soft Rays','Textured Effect'])assert.ok(!json.includes(legacy),legacy);
  assert.deepStrictEqual(kim.aliases,[]);
  assert.deepStrictEqual(kim.legacyReference.templateMm,[6,10,7,11,8]);
  assert.strictEqual(kim.legacyReference.textureExecution.frequency,3);
  assert.strictEqual(kim.legacyReference.textureExecution.shortPieceMultiplier,.35);
  assert.deepStrictEqual(kim.legacyReference.scoreCoefficients,{base:35,wideSetBonus:12,confidenceThreshold:.55,confidenceBonus:14,almondCoefficient:8});
});

test('validation includes provenance, review, revision, and explicit uncertainty',()=>{
  assert.ok(kim.validation.evidence.length&&kim.validation.provenance.length&&kim.validation.reviewers.length&&kim.validation.notes.length);
  assert.strictEqual(kim.validation.revision,1);
  for(const item of ['EXACT_KIM_K_WISPY_TAXONOMY_BOUNDARY','EXACT_KIM_K_RAYS_TAXONOMY_BOUNDARY','MINIMUM_HIERARCHY_DISTINGUISHING_KIM_K_FROM_GENERAL_WISPY','EXACT_RHYTHM_OR_REGULARITY','CLUSTERING','UNIVERSAL_BASE_CONSTRUCTION','UNIVERSAL_LAYERING_METHOD','UNIVERSAL_FAN_METHOD','EXACT_DENSITY_OR_INTENSITY','GEOMETRY_COMPATIBILITY','DIRECTION_EXECUTION','CURL_SELECTION','APPLICATION_TECHNIQUE','ALL_NUMERIC_EXECUTION_PARAMETERS','CROSS_SCHOOL_TERMINOLOGY_CONSENSUS'])assert.ok(professional.unresolved.includes(item),item);
});

test('all 21 legacy outputs and production consumers remain byte-identical',()=>{
  assert.strictEqual(digest(indexSource),'901ee8ce6417eb97931479bde0fca61670b80f533c6bc26e6457bb1101ee26da');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  const legacy=catalog.find(x=>x.id==='kim');
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(legacy.baseZones,[6,10,7,11,8]);
  assert.strictEqual(legacy.peakZone,3);
  assert.deepStrictEqual(legacy.texture,{pattern:'kim',frequency:3,baseToSpikeDiff:3});
  assert.strictEqual(legacy.defaultTechnique,'Volume 3D');
  assert.strictEqual(digest(catalogSource),'15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
  for(const marker of ['function computeSpikeGeometry(','function rankDesignsAll(','<ProfessionalEyeMap clientDesign={photoClientDesign}','<LashMapDiagram clientDesign={diagramClientDesign}','const plan = generateApplicationPlan(planClientDesign, lang);','const d = canonicalRecommendationProps(raw, p, lang, i);'])assert.ok(indexSource.includes(marker),marker);
});
