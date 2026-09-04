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
const doll=Library.getDefinition('geometry.doll');

test('geometry.doll is an explicitly reviewed professional mapping definition',()=>{
  assert.strictEqual(doll.id,'geometry.doll');
  assert.strictEqual(doll.kind,'MAPPING_GEOMETRY');
  assert.strictEqual(doll.validation.status,'EXPERT_REVIEWED');
  assert.ok(doll.professionalDefinition);
  assert.strictEqual(doll.professionalDefinition.primaryIntent,'OPEN_EYE_CENTRAL_EMPHASIS');
  assert.strictEqual(doll.validation.evidence[0].numericClaims,false);
  assert.ok(doll.validation.provenance.length>0);
});

test('central maximum or plateau is qualitative and has no legacy exact positions',()=>{
  const peak=doll.professionalDefinition.peak;
  assert.deepStrictEqual(peak.positionRange,{unit:'NORMALIZED_LASH_LINE',min:null,max:null,region:'CENTRAL',resolution:'NUMERIC_RANGE_UNRESOLVED'});
  assert.deepStrictEqual(peak.zoneRange,{regions:['CENTRAL'],resolution:'QUALITATIVE_REGION_ONLY'});
  assert.deepStrictEqual(peak.plateauAllowed,{value:true,boundaries:null,resolution:'QUALITATIVE_ONLY'});
  const professionalJson=JSON.stringify(doll.professionalDefinition);
  for(const legacyNumber of ['0.24','0.46','0.6'])assert.ok(!professionalJson.includes(legacyNumber));
});

test('normalized geometry, starting template mm, and legacy Doll constants are separate',()=>{
  assert.strictEqual(doll.professionalDefinition.normalizedProfile.unit,'RELATIVE_TO_LASH_LINE');
  assert.strictEqual(doll.professionalDefinition.normalizedProfile.numericSamples,null);
  assert.ok(!Object.hasOwn(doll.professionalDefinition,'templateMm'));
  assert.deepStrictEqual(doll.templateMm,{purpose:'STARTING_TEMPLATE_ONLY',universal:false,values:null,resolution:'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED'});
  assert.deepStrictEqual(doll.legacyReference.templateMm,[8,9,10,10,9]);
  assert.deepStrictEqual(doll.legacyReference.normalizedGeometry,{peakZone:2});
  assert.deepStrictEqual(doll.legacyReference.topology,{zonePositions:[0,.24,.46,.60,1],plateauShape:'shoulder',postPeakShape:'gradual'});
});

test('reviewed topology expresses central opening and controlled reductions without invented samples',()=>{
  const definition=doll.professionalDefinition;
  assert.strictEqual(definition.topology.rise,'CONTROLLED_RISE_TOWARD_CENTRAL_MAXIMUM_OR_PLATEAU');
  assert.strictEqual(definition.topology.shoulder,'BROAD_CENTRAL_MAXIMUM_OR_PLATEAU_ALLOWED');
  assert.strictEqual(definition.topology.postPeak,'CONTROLLED_REDUCTION_TOWARD_OUTER');
  assert.strictEqual(definition.topology.outerBehavior,'LOWER_THAN_CENTRAL_MAXIMUM_OR_PLATEAU');
  assert.deepStrictEqual(definition.normalizedProfile.sequence.map(item=>item.region),['INNER','CENTRAL','OUTER']);
});

test('non-production metadata differentiates Doll from Natural, Squirrel, Cat, and Fox',()=>{
  const comparisons=doll.professionalDefinition.crossEffectComparison;
  for(const id of ['geometry.natural','geometry.squirrel','geometry.cat','geometry.fox']){
    assert.ok(comparisons[id]);
    assert.strictEqual(comparisons[id].dollEmphasis,'CENTRAL');
    assert.strictEqual(comparisons[id].dollPlateauIntent,'OPEN_EYE');
    assert.strictEqual(comparisons[id].dollOuterBehavior,'CONTROLLED_REDUCTION');
    assert.strictEqual(comparisons[id].dollIntentClass,'OPENING');
  }
  assert.strictEqual(comparisons['geometry.squirrel'].otherIntentClass,'OUTER_LIFT');
  assert.strictEqual(comparisons['geometry.cat'].otherIntentClass,'ELONGATION');
  assert.strictEqual(comparisons['geometry.fox'].otherIntentClass,'ELONGATION');
  assert.strictEqual(Library.getDefinition('geometry.natural').professionalDefinition.crossEffectComparison.doll.geometryId,'geometry.doll');
  assert.ok(Library.getDefinition('geometry.squirrel').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.cat').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.fox').professionalDefinition);
});

test('Doll and every professional definition remain production-inactive',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.strictEqual(Library.library.activation.defaultState,'INACTIVE');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
});

test('all 21 legacy IDs and exact legacy Doll production inputs remain unchanged',()=>{
  const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = '),catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart),catalogSource=indexSource.slice(catalogStart,catalogEnd);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  const legacyDoll=catalog.find(entry=>entry.id==='doll');
  assert.deepStrictEqual(legacyDoll.baseZones,[8,9,10,10,9]);
  assert.strictEqual(legacyDoll.peakZone,2);
  assert.deepStrictEqual(legacyDoll.zonePositions,[0,.24,.46,.60,1]);
  assert.strictEqual(legacyDoll.plateauShape,'shoulder');
  assert.strictEqual(legacyDoll.postPeakShape,'gradual');
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});

test('Recommendation, PHOTO, DIAGRAM, Application Plan, and domain source remain unchanged',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(indexSource),'9e20ac494a4b9f125cc4189f791bd896343b11aa48a8c9bcea0f74909e997277');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
