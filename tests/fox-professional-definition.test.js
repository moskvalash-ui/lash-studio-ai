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
const fox=Library.getDefinition('geometry.fox');

test('geometry.fox is an explicitly reviewed professional mapping definition',()=>{
  assert.strictEqual(fox.id,'geometry.fox');
  assert.strictEqual(fox.kind,'MAPPING_GEOMETRY');
  assert.strictEqual(fox.validation.status,'EXPERT_REVIEWED');
  assert.ok(fox.professionalDefinition);
  assert.strictEqual(fox.professionalDefinition.primaryIntent,'HORIZONTAL_TEMPORAL_ELONGATION');
  assert.strictEqual(fox.validation.evidence[0].numericClaims,false);
  assert.ok(fox.validation.provenance.length>0);
});

test('professional peak is qualitative late-outer emphasis and never legacy 0.66',()=>{
  const peak=fox.professionalDefinition.peak;
  assert.deepStrictEqual(peak.positionRange,{unit:'NORMALIZED_LASH_LINE',min:null,max:null,region:'LATE_OUTER',resolution:'NUMERIC_RANGE_UNRESOLVED'});
  assert.deepStrictEqual(peak.zoneRange,{regions:['LATE_OUTER'],resolution:'QUALITATIVE_REGION_ONLY'});
  assert.deepStrictEqual(peak.plateauAllowed,{value:null,resolution:'UNRESOLVED'});
  assert.ok(!JSON.stringify(fox.professionalDefinition).includes('0.66'));
  assert.strictEqual(fox.legacyReference.normalizedGeometry.peakPosition,0.66);
});

test('normalized geometry, starting template mm, and legacy Fox constants are separate',()=>{
  assert.strictEqual(fox.professionalDefinition.normalizedProfile.unit,'RELATIVE_TO_LASH_LINE');
  assert.strictEqual(fox.professionalDefinition.normalizedProfile.numericSamples,null);
  assert.ok(!Object.hasOwn(fox.professionalDefinition,'templateMm'));
  assert.deepStrictEqual(fox.templateMm,{purpose:'STARTING_TEMPLATE_ONLY',universal:false,values:null,resolution:'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED'});
  assert.deepStrictEqual(fox.legacyReference.templateMm,[6,7,9,12,11]);
  assert.deepStrictEqual(fox.legacyReference.normalizedGeometry,{peakPosition:.66,peakZone:3});
  assert.deepStrictEqual(fox.legacyReference.topology,{zonePositions:[0,.20,.44,.66,1],plateauShape:'linear',postPeakShape:'gradual'});
});

test('reviewed topology contains late-outer emphasis and controlled outer-tail behavior',()=>{
  const definition=fox.professionalDefinition;
  assert.strictEqual(definition.topology.rise,'BUILDS_TOWARD_LATE_OUTER_EMPHASIS');
  assert.strictEqual(definition.topology.shoulder,'UNRESOLVED');
  assert.strictEqual(definition.topology.postPeak,'CONTROLLED_OUTER_TAIL');
  assert.strictEqual(definition.topology.outerBehavior,'CONTROLLED_TAIL_AFTER_LATE_OUTER_EMPHASIS');
  assert.deepStrictEqual(definition.normalizedProfile.sequence.map(item=>item.region),['INNER','BODY','LATE_OUTER','OUTER_TAIL']);
});

test('non-production metadata differentiates Fox from Cat, Squirrel, and Doll',()=>{
  const comparisons=fox.professionalDefinition.crossEffectComparison;
  for(const id of ['geometry.cat','geometry.squirrel','geometry.doll']){
    assert.ok(comparisons[id]);
    assert.strictEqual(comparisons[id].foxPeakRegion,'LATE_OUTER');
    assert.strictEqual(comparisons[id].foxOuterBehavior,'CONTROLLED_TAIL');
    assert.strictEqual(comparisons[id].foxIntentClass,'TEMPORAL_ELONGATION');
    assert.ok(comparisons[id].distinction);
  }
  assert.strictEqual(comparisons['geometry.squirrel'].otherPeakRegion,'PRE_OUTER');
  assert.strictEqual(comparisons['geometry.squirrel'].otherIntentClass,'OUTER_LIFT');
  assert.strictEqual(comparisons['geometry.doll'].otherPeakRegion,'CENTRAL');
  assert.strictEqual(comparisons['geometry.doll'].otherIntentClass,'OPENING');
  assert.ok(Library.getDefinition('geometry.cat').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.squirrel').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.doll').professionalDefinition);
});

test('Fox and every professional definition remain production-inactive',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.strictEqual(Library.library.activation.defaultState,'INACTIVE');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
});

test('all 21 legacy IDs and exact legacy Fox production inputs remain unchanged',()=>{
  const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = '),catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart),catalogSource=indexSource.slice(catalogStart,catalogEnd);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  const legacyFox=catalog.find(entry=>entry.id==='fox');
  assert.deepStrictEqual(legacyFox.baseZones,[6,7,9,12,11]);
  assert.strictEqual(legacyFox.peakZone,3);
  assert.deepStrictEqual(legacyFox.zonePositions,[0,.20,.44,.66,1]);
  assert.strictEqual(legacyFox.plateauShape,undefined);
  assert.strictEqual(legacyFox.postPeakShape,'gradual');
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
});

test('Recommendation, PHOTO, DIAGRAM, Application Plan, and domain source remain unchanged',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(indexSource),'1f7dca3f5c8060a59e0cfc9e0900064a884ba7db27ded3a4f7c9812fd6d53f01');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
