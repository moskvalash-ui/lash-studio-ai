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
const natural=Library.getDefinition('geometry.natural');
const professional=natural.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('geometry.natural is populated, expert-reviewed, non-numeric, and inactive',()=>{
  assert.strictEqual(natural.kind,'MAPPING_GEOMETRY');
  assert.ok(professional);
  assert.strictEqual(natural.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(natural.validation.status,'VALIDATED');
  assert.strictEqual(natural.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('Natural geometry remains hard-separated from the reviewed Classic technique',()=>{
  const classic=Library.getDefinition('technique.classic-one-to-one');
  assert.strictEqual(classic.kind,'APPLICATION_TECHNIQUE');
  assert.notStrictEqual(classic.id,natural.id);
  assert.deepStrictEqual(professional.relationships.applicationTechnique,{domain:'APPLICATION_TECHNIQUE',selection:'SEPARATE_LAYER',techniqueId:null});
  assert.strictEqual(digest(JSON.stringify(classic)),'09eeff8937f5a5b83d14ac7e8c450f3f2a4be98851fdd4d632d9d0cf76189081');
});

test('core invariant is gradual, modest, balanced, and natural-impression preserving',()=>{
  assert.deepStrictEqual(professional.invariantOutcome,{
    progression:'GRADUAL_BALANCED_LENGTH_PROGRESSION',maximum:'BROAD_MODEST_CENTRAL_TO_NEAR_CENTRAL_MAXIMUM',
    innerRise:'SMOOTH_INNER_TO_BODY_RISE',outerFinish:'CONTROLLED_NON_ABRUPT_OUTER_FINISH',
    silhouette:'BALANCED_NON_DRAMATIC_SILHOUETTE',intent:'PRESERVE_OR_SOFTLY_ENHANCE_NATURAL_EYE_IMPRESSION',
  });
  for(const excluded of ['CENTRAL_OPENING','PRE_OUTER_LIFT','FELINE_OUTER_LIFT','TEMPORAL_HORIZONTAL_ELONGATION'])assert.ok(professional.excludedDefiningIntents.includes(excluded));
});

test('normalized profile is qualitative with a broad central-to-near-central maximum',()=>{
  assert.strictEqual(professional.normalizedProfile.unit,'RELATIVE_TO_LASH_LINE');
  assert.strictEqual(professional.normalizedProfile.numericSamples,null);
  assert.deepStrictEqual(professional.normalizedProfile.sequence.map(x=>x.relationship),['BELOW_MAXIMUM','GRADUAL_CONTROLLED_RISE','APPROACHES_BROAD_MODEST_MAXIMUM','MAXIMUM_REGION','CONTROLLED_REDUCTION_OR_MILD_TAPER']);
  assert.deepStrictEqual(professional.maximum,{region:'BROAD_CENTRAL_TO_NEAR_CENTRAL',prominence:'MODEST',exactPosition:null,anatomyDependent:true,plateauAllowed:'UNRESOLVED',exactPlateauBoundaries:null});
});

test('inner and outer behavior remain gradual, non-numeric, and personalized',()=>{
  assert.deepStrictEqual(professional.innerBehavior,{relationshipToMaximum:'BELOW_MAXIMUM',transition:'GRADUAL_CONTROLLED_RISE',exactLength:null,exactSlope:null,personalization:'REQUIRED',absoluteShortestRequired:false});
  assert.deepStrictEqual(professional.outerBehavior,{relationshipToMaximum:'CONTROLLED_REDUCTION_OR_MILD_TAPER',tailIntent:'NON_DRAMATIC',exactDrop:null,exactSlope:null,personalization:'REQUIRED',anatomyDependentLengthPreservationAllowed:true});
});

test('Doll boundary is reviewed while Doll remains byte-identical',()=>{
  const comparison=professional.crossEffectComparison.doll;
  assert.strictEqual(comparison.dollIntent,'EXPLICIT_CENTRAL_OPENING');
  assert.strictEqual(comparison.naturalMaximum,'MODEST_BROAD_CENTRAL_OR_NEAR_CENTRAL');
  assert.strictEqual(comparison.naturalRelationship,'MORE_ANATOMY_FOLLOWING');
  assert.strictEqual(comparison.naturalCentralOpeningDefining,false);
  assert.strictEqual(comparison.exactBoundary,'UNRESOLVED');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('geometry.doll'))),'ff527430e297a4ebcc7f4a8f7820a2ca9623bc2f5f69c873d09c903c900cd64d');
});

test('Squirrel, Cat, and Fox boundaries remain qualitative and protected',()=>{
  assert.strictEqual(professional.crossEffectComparison.squirrel.naturalPreOuterLiftDefining,false);
  assert.strictEqual(professional.crossEffectComparison.squirrel.exactBoundaryCoordinates,null);
  for(const key of ['cat','fox']){
    const comparison=professional.crossEffectComparison[key];
    assert.strictEqual(comparison.naturalLateOuterMaximumDefining,false);
    assert.strictEqual(comparison.naturalFelineLiftRequired,false);
    assert.strictEqual(comparison.naturalTemporalElongationRequired,false);
    assert.strictEqual(comparison.naturalStrongTailIdentity,false);
  }
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('geometry.squirrel'))),'983946b9933f5ae275801fd7b2bdc7d470c31bca010bdce458070f18bdbfe1d6');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('geometry.cat'))),'fc9b21fc83afbf00ebb0e41a225a7f5eef06782db3d60b2216be7322b8ee7d58');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('geometry.fox'))),'b0590b41ad005a284b71353877da28e70af5379e84a3ec38f03ee23baea342ae');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('direction.cat'))),'973a81cae098b780ec590bfe08ab3eaa2478a28a8aec66ab1efc5584c48ff0d9');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('direction.fox'))),'13ab577bd4a7e9332151e11ad16675ac70525cd3edde82bac0acfb1eeea6a8ed');
});

test('legacy Rounded and Elongated Natural remain references, not canonical IDs',()=>{
  assert.strictEqual(Library.getDefinition('geometry.natural-rounded'),null);
  assert.strictEqual(Library.getDefinition('geometry.natural-elongated'),null);
  assert.strictEqual(professional.variants.canonicalVariantIdsCreated,false);
  assert.strictEqual(professional.variants.taxonomyStatus,'UNRESOLVED');
  assert.deepStrictEqual(natural.legacyReference.records.map(x=>x.legacyId),['natural','naturalRounded','naturalElongated']);
});

test('personalization owns exact profile, length, asymmetry, and anatomy decisions',()=>{
  for(const field of ['EXACT_PEAK_SHIFT','EXACT_PLATEAU_WIDTH','OUTER_TAPER_STRENGTH','MAXIMUM_LENGTH','INNER_STARTING_LENGTH','ASYMMETRY_ADJUSTMENT','EYE_SHAPE_ADAPTATION'])assert.ok(professional.personalizationBoundary.clientOwnedFields.includes(field),field);
  const json=JSON.stringify(professional);
  for(const runtime of ['tiltThreshold','widthScale','openingScale','sizeScale','innerTaperDeg','outerTaperDeg','correctionMm'])assert.ok(!json.includes(runtime),runtime);
});

test('template, curl, technique, fan, construction, and density remain separate and unresolved',()=>{
  assert.deepStrictEqual(natural.templateMm,{purpose:'STARTING_TEMPLATE_ONLY',universal:false,values:null,resolution:'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED'});
  assert.strictEqual(professional.relationships.curl.curlStrategyId,null);
  assert.strictEqual(professional.relationships.applicationTechnique.techniqueId,null);
  assert.strictEqual(professional.relationships.fanConstruction.fanConstructionId,null);
  assert.strictEqual(professional.relationships.constructionRecipe.constructionId,null);
  assert.deepStrictEqual(professional.densityFinish,{exactDensity:null,exactDiameter:null,exactVolume:null,exactLayerCount:null});
});

test('all legacy precision remains isolated outside professional truth',()=>{
  const json=JSON.stringify(professional);
  for(const legacy of ['[7,8,9,9,8]','[6,8,9,9,7]','[7,8,9,10,9]','peakZone','Classic 1:1','B,C,CC','Natural Correction','Classic Natural','Rounded Natural','Elongated Natural'])assert.ok(!json.includes(legacy),legacy);
  assert.deepStrictEqual(natural.legacyReference.records.map(x=>x.templateMm),[[7,8,9,9,8],[6,8,9,9,7],[7,8,9,10,9]]);
});

test('validation includes provenance, review, revision, and explicit uncertainty',()=>{
  assert.ok(natural.validation.evidence.length&&natural.validation.provenance.length&&natural.validation.reviewers.length&&natural.validation.notes.length);
  assert.strictEqual(natural.validation.revision,1);
  for(const item of ['EXACT_MAXIMUM_REGION','PLATEAU_ALLOWANCE','MAXIMUM_PROMINENCE_BOUNDARY_WITH_DOLL','NATURAL_SQUIRREL_EXACT_BOUNDARY','NATURAL_CAT_FOX_SOFT_BOUNDARY','OUTER_TAPER_VS_LENGTH_PRESERVATION','INNER_TRANSITION_VARIATION','ROUNDED_ELONGATED_VARIANT_TAXONOMY','GEOMETRY_CONSTRUCTION_COMPATIBILITY','DIRECTION_COMPATIBILITY','TECHNIQUE_COMPATIBILITY','CURL_SELECTION','DENSITY_OR_FINISH','NATURAL_LASH_PERSONALIZATION','ASYMMETRY_PERSONALIZATION','NUMERIC_TEMPLATES','CROSS_SCHOOL_TERMINOLOGY_CONSENSUS'])assert.ok(professional.unresolved.includes(item),item);
});

test('all 21 legacy outputs and production consumers remain byte-identical',()=>{
  assert.strictEqual(digest(indexSource),'9e20ac494a4b9f125cc4189f791bd896343b11aa48a8c9bcea0f74909e997277');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.filter(x=>['natural','naturalRounded','naturalElongated'].includes(x.id)).map(x=>x.baseZones),[[7,8,9,9,8],[6,8,9,9,7],[7,8,9,10,9]]);
  assert.strictEqual(digest(catalogSource),'15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
  for(const marker of ['function calculateEyeLashMap(','function rankDesignsAll(','<ProfessionalEyeMap clientDesign={photoClientDesign}','<LashMapDiagram clientDesign={diagramClientDesign}','const plan = generateApplicationPlan(planClientDesign, lang);','const d = canonicalRecommendationProps(raw, p, lang, i);','function NaturalLashScanScreen('])assert.ok(indexSource.includes(marker),marker);
});
