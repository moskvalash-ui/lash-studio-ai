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
const cat=Library.getDefinition('geometry.cat');

test('geometry.cat is an explicitly reviewed professional mapping definition',()=>{
  assert.strictEqual(cat.id,'geometry.cat');
  assert.strictEqual(cat.kind,'MAPPING_GEOMETRY');
  assert.strictEqual(cat.validation.status,'EXPERT_REVIEWED');
  assert.ok(cat.professionalDefinition);
  assert.strictEqual(cat.professionalDefinition.primaryIntent,'STRONGER_FELINE_OUTER_ELONGATION');
  assert.strictEqual(cat.validation.evidence[0].numericClaims,false);
  assert.ok(cat.validation.provenance.length>0);
});

test('professional peak is qualitative late-outer emphasis and never legacy 0.78',()=>{
  const peak=cat.professionalDefinition.peak;
  assert.deepStrictEqual(peak.positionRange,{unit:'NORMALIZED_LASH_LINE',min:null,max:null,region:'LATE_OUTER',resolution:'NUMERIC_RANGE_UNRESOLVED'});
  assert.deepStrictEqual(peak.zoneRange,{regions:['LATE_OUTER'],resolution:'QUALITATIVE_REGION_ONLY'});
  assert.deepStrictEqual(peak.plateauAllowed,{value:null,resolution:'UNRESOLVED'});
  assert.ok(!JSON.stringify(cat.professionalDefinition).includes('0.78'));
  assert.strictEqual(cat.legacyReference.normalizedGeometry.peakPosition,0.78);
});

test('normalized geometry, starting template mm, and legacy Cat constants are separate',()=>{
  assert.strictEqual(cat.professionalDefinition.normalizedProfile.unit,'RELATIVE_TO_LASH_LINE');
  assert.strictEqual(cat.professionalDefinition.normalizedProfile.numericSamples,null);
  assert.ok(!Object.hasOwn(cat.professionalDefinition,'templateMm'));
  assert.deepStrictEqual(cat.templateMm,{purpose:'STARTING_TEMPLATE_ONLY',universal:false,values:null,resolution:'NO_REVIEWED_NUMERIC_TEMPLATE_SUPPLIED'});
  assert.deepStrictEqual(cat.legacyReference.templateMm,[7,8,10,12,10]);
  assert.deepStrictEqual(cat.legacyReference.normalizedGeometry,{peakPosition:.78,peakZone:3});
  assert.deepStrictEqual(cat.legacyReference.topology,{zonePositions:[0,.22,.48,.78,1],plateauShape:'linear',postPeakShape:'frontLoaded'});
});

test('reviewed topology contains pronounced late-outer emphasis without unsupported exact behavior',()=>{
  const definition=cat.professionalDefinition;
  assert.strictEqual(definition.topology.rise,'BUILDS_TOWARD_PRONOUNCED_LATE_OUTER_EMPHASIS');
  assert.strictEqual(definition.topology.shoulder,'UNRESOLVED');
  assert.strictEqual(definition.topology.postPeak,'CONTROLLED_BEHAVIOR_TOWARD_PHYSICAL_OUTER');
  assert.strictEqual(definition.topology.outerBehavior,'CONTROLLED_AT_PHYSICAL_OUTER');
  assert.deepStrictEqual(definition.normalizedProfile.sequence.map(item=>item.region),['INNER','BODY','LATE_OUTER','PHYSICAL_OUTER']);
});

test('Cat versus Fox is qualitative, direction-aware, and never based on legacy coordinates',()=>{
  const comparison=cat.professionalDefinition.crossEffectComparison['geometry.fox'];
  assert.strictEqual(comparison.catPeakRegion,'LATE_OUTER');
  assert.strictEqual(comparison.foxPeakRegion,'LATE_OUTER');
  assert.strictEqual(comparison.relativePeakOrder,'UNRESOLVED');
  assert.strictEqual(comparison.relativeSharpness,'UNRESOLVED');
  assert.strictEqual(comparison.tailDeclineOrPlateauDifference,'UNRESOLVED');
  assert.strictEqual(comparison.catIntentClass,'STRONGER_FELINE_OUTER_EMPHASIS');
  assert.strictEqual(comparison.foxIntentClass,'HORIZONTAL_TEMPORAL_ELONGATION');
  assert.strictEqual(comparison.directionDependency.status,'UNRESOLVED_NEEDS_DIRECTION_STRATEGY_VALIDATION');
  assert.strictEqual(comparison.numericLegacyComparisonUsed,false);
  assert.ok(!JSON.stringify(comparison).includes('.78'));
  assert.ok(!JSON.stringify(comparison).includes('.66'));
});

test('non-production metadata differentiates Cat from Squirrel and Doll',()=>{
  const comparisons=cat.professionalDefinition.crossEffectComparison;
  assert.strictEqual(comparisons['geometry.squirrel'].otherPeakRegion,'PRE_OUTER');
  assert.strictEqual(comparisons['geometry.squirrel'].otherIntentClass,'OUTER_LIFT');
  assert.match(comparisons['geometry.squirrel'].distinction,/ELONGATION_VERSUS_PRE_OUTER_LIFT/);
  assert.strictEqual(comparisons['geometry.doll'].otherPeakRegion,'CENTRAL');
  assert.strictEqual(comparisons['geometry.doll'].otherIntentClass,'OPENING');
  assert.match(comparisons['geometry.doll'].distinction,/OUTER_ELONGATION_VERSUS_CENTRAL_OPENING/);
  assert.ok(Library.getDefinition('geometry.fox').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.squirrel').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.doll').professionalDefinition);
});

test('Cat and every professional definition remain production-inactive',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.strictEqual(Library.library.activation.defaultState,'INACTIVE');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
});

test('all 21 legacy IDs and exact legacy Cat production inputs remain unchanged',()=>{
  const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = '),catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart),catalogSource=indexSource.slice(catalogStart,catalogEnd);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  const legacyCat=catalog.find(entry=>entry.id==='cat');
  assert.deepStrictEqual(legacyCat.baseZones,[7,8,10,12,10]);
  assert.strictEqual(legacyCat.peakZone,3);
  assert.deepStrictEqual(legacyCat.zonePositions,[0,.22,.48,.78,1]);
  assert.strictEqual(legacyCat.plateauShape,undefined);
  assert.strictEqual(legacyCat.postPeakShape,'frontLoaded');
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
});

test('Recommendation, PHOTO, DIAGRAM, Application Plan, and domain source remain unchanged',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(indexSource),'99d276a5209d67a57f30160f07ea0ae89c91bec76cf56060dc915c488c9593ed');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
