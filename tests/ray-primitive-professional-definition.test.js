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
const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
const professional=ray.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('RAY exists in the existing primitive architecture as reviewed non-numeric truth',()=>{
  assert.ok(Library.library.schema.textureConstruction.primitives.includes('RAY'));
  assert.strictEqual(ray.id,'RAY');
  assert.strictEqual(ray.kind,'TEXTURE_CONSTRUCTION_PRIMITIVE');
  assert.strictEqual(ray.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(ray.validation.status,'VALIDATED');
  assert.strictEqual(ray.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.schemaVersion,1);
});

test('core primitive is a reusable visible elongated accent with localized segmentation',()=>{
  assert.deepStrictEqual(professional.invariantOutcome,{
    visibleAccent:'VISIBLE_ELONGATED_ACCENT',texture:'LOCALIZED_TEXTURE',separation:'ACCENT_SEPARATION',
    topLineRole:'TOP_LINE_SEGMENTATION_CONTRIBUTOR',architecturalRole:'REUSABLE_CONSTRUCTION_BUILDING_BLOCK',
  });
});

test('primitive and complete Rays construction remain explicitly separate',()=>{
  const construction=Library.getDefinition('construction.rays'),boundary=professional.primitiveBoundary;
  assert.strictEqual(boundary.completeEffectIdentity,false);
  assert.strictEqual(boundary.completeConstructionId,'construction.rays');
  assert.strictEqual(boundary.synonymousWithEveryRaysConstruction,false);
  assert.strictEqual(construction.kind,'CONSTRUCTION_RECIPE');
  assert.strictEqual(construction.validation.status,'UNVALIDATED');
  assert.strictEqual(construction.professionalDefinition,null);
  assert.notStrictEqual(construction.id,Library.getDefinition('construction.kim-k').id);
  assert.notStrictEqual(construction.id,Library.getDefinition('construction.wispy').id);
  assert.strictEqual(digest(JSON.stringify(construction)),'5054f998b7976c0c7ca63d6a2fe0a426d8655ba74c227c13cc8ee121c586bffd');
});

test('RAY is reusable without becoming universally required by containing effects',()=>{
  const reuse=professional.reusability;
  assert.deepStrictEqual(reuse.potentialContainingConstructionIds,['construction.kim-k','construction.wispy','construction.anime','construction.wet','preset.american']);
  assert.strictEqual(reuse.otherTexturedConstructionsAllowed,true);
  assert.strictEqual(reuse.universalRequirementForContainingConstructions,false);
});

test('hierarchy, support, rhythm, and spacing are not intrinsic to one primitive',()=>{
  assert.strictEqual(professional.hierarchy.visibleAccent,'ESSENTIAL');
  assert.strictEqual(professional.hierarchy.supportingField,'NOT_INTRINSIC_TO_PRIMITIVE');
  assert.strictEqual(professional.hierarchy.universalHierarchy,null);
  assert.strictEqual(professional.rhythmSpacing.rhythm,'NOT_INTRINSIC');
  assert.strictEqual(professional.rhythmSpacing.qualitativeRepetition,'CONSTRUCTION_DEPENDENT');
  assert.strictEqual(professional.rhythmSpacing.exactSpacing,null);
  assert.strictEqual(professional.rhythmSpacing.frequency,null);
  assert.strictEqual(professional.supportingFieldRelationships.universalBaseConstruction,null);
});

test('geometry is outside the primitive and no Rays geometry or direction identity exists',()=>{
  assert.strictEqual(Library.getDefinition('geometry.rays'),null);
  assert.strictEqual(Library.getDefinition('direction.rays'),null);
  assert.deepStrictEqual(professional.relationships.geometry,{domain:'MAPPING_GEOMETRY',role:'NOT_PART_OF_PRIMITIVE',completeConstructionCarrierSelection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[]});
  assert.strictEqual(professional.relationships.direction.role,'SECONDARY');
  for(const field of ['numericAngles','directionVectors','directionalZones'])assert.strictEqual(professional.relationships.direction[field],null,field);
});

test('physical fan construction and curl remain non-universal and non-numeric',()=>{
  const fan=professional.relationships.fanConstruction;
  assert.strictEqual(fan.closedFanRays,'COMMON_VARIANT');
  assert.strictEqual(fan.narrowNearlyClosedFans,'COMMON_VARIANT');
  assert.strictEqual(fan.universalFanMethod,null);
  assert.strictEqual(professional.relationships.curl.exactCurl,null);
  for(const field of ['exactFanWidth','exactFanCount','exactVolume','exactDiameter'])assert.strictEqual(professional[field],null,field);
});

test('density and finish remain qualitative and variant-dependent',()=>{
  assert.deepStrictEqual(professional.densityFinish.essential,['VISIBLE_ACCENT_SEPARATION','LOCALIZED_TEXTURE','TOP_LINE_SEGMENTATION_CONTRIBUTION']);
  assert.strictEqual(professional.densityFinish.dimensional,'COMMON_OUTCOME');
  assert.strictEqual(professional.densityFinish.exactDensity,null);
  for(const field of ['graphic','airy','bold','sparse','dense','editorial'])assert.strictEqual(professional.densityFinish[field],'VARIANT_DEPENDENT',field);
});

test('Kim K and Wispy stay unchanged while relationships remain non-universal',()=>{
  const kim=professional.taxonomyRelationships.kimK,wispy=professional.taxonomyRelationships.wispy;
  assert.strictEqual(kim.primitiveRoleBroaderThanConstruction,true);
  assert.strictEqual(kim.universallyIdentical,false);
  assert.strictEqual(kim.raysConstructionRelationship,'SCHOOL_DEPENDENT_OVERLAP');
  assert.strictEqual(wispy.relationship,'POSSIBLE_ACCENT_ARCHITECTURE');
  assert.strictEqual(wispy.universallyRequired,false);
  assert.strictEqual(wispy.inheritsCompleteInvariant,false);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.kim-k'))),'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wispy'))),'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86');
});

test('legacy Kim K precision and aliases are absent from RAY professional truth',()=>{
  const json=JSON.stringify(professional);
  for(const legacy of ['[6,10,7,11,8]','peakZone','frequency":3','baseToSpikeDiff','TALL_SHORT_TALL','0.35','1.05','Volume 3D','confidenceThreshold','Soft Rays','Textured Effect'])assert.ok(!json.includes(legacy),legacy);
  for(const field of ['exactRayLength','exactRayCount','exactSpacing','exactFrequency','exactMillimeters','exactLengthDelta','exactLayerCount','exactPlacementCoordinates'])assert.strictEqual(professional[field],null,field);
});

test('validation records provenance and every required unresolved dimension',()=>{
  assert.ok(ray.validation.evidence.length&&ray.validation.provenance.length&&ray.validation.reviewers.length&&ray.validation.notes.length);
  assert.strictEqual(ray.validation.revision,1);
  for(const item of ['EXACT_PHYSICAL_RAY_CONSTRUCTION','FAN_METHOD','RAY_WIDTH','RAY_LENGTH','SPACING','REPETITION','HIERARCHY','SUPPORTING_FIELD_RELATIONSHIP','LAYERING','DIRECTION_EXECUTION','DENSITY_OR_INTENSITY','CONTAINING_EFFECT_COMPATIBILITY_RULES','CROSS_SCHOOL_TERMINOLOGY'])assert.ok(professional.unresolved.includes(item),item);
});

test('production activation, all 21 legacy IDs, aliases, and consumers remain unchanged',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.strictEqual(digest(indexSource),'7183dbc76913198709af43f168d2014f4d6c1726f54e2e5e68e1445b9a2df285');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.find(x=>x.id==='kim').aliases,['Rays','Spikes','Soft Rays','Textured Effect']);
  assert.strictEqual(catalog.some(x=>x.id==='rays'),false);
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  for(const marker of ['function computeSpikeGeometry(','function rankDesignsAll(','<ProfessionalEyeMap clientDesign={photoClientDesign}','<LashMapDiagram clientDesign={diagramClientDesign}','const plan = generateApplicationPlan(planClientDesign, lang);','const d = canonicalRecommendationProps(raw, p, lang, i);'])assert.ok(indexSource.includes(marker),marker);
});
