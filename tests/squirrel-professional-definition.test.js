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
const squirrel=Library.getDefinition('geometry.squirrel');

test('geometry.squirrel is a reviewed professional mapping definition with unresolved numeric precision',()=>{
  assert.strictEqual(squirrel.id,'geometry.squirrel');
  assert.strictEqual(squirrel.kind,'MAPPING_GEOMETRY');
  assert.strictEqual(squirrel.validation.status,'EXPERT_REVIEWED');
  assert.ok(squirrel.professionalDefinition);
  assert.strictEqual(squirrel.professionalDefinition.primaryIntent,'OUTER_LIFT');
  assert.strictEqual(squirrel.validation.evidence[0].numericClaims,false);
  assert.ok(squirrel.validation.provenance.length>0);
});

test('professional peak is a qualitative range/region and never the legacy fixed 0.62',()=>{
  const peak=squirrel.professionalDefinition.peak;
  assert.deepStrictEqual(peak.positionRange,{unit:'NORMALIZED_LASH_LINE',min:null,max:null,region:'PRE_OUTER',resolution:'NUMERIC_RANGE_UNRESOLVED'});
  assert.deepStrictEqual(peak.zoneRange,{regions:['PRE_OUTER'],resolution:'QUALITATIVE_REGION_ONLY'});
  assert.deepStrictEqual(peak.plateauAllowed,{value:null,resolution:'UNRESOLVED'});
  assert.ok(!JSON.stringify(squirrel.professionalDefinition).includes('0.62'));
  assert.strictEqual(squirrel.legacyReference.normalizedGeometry.peakPosition,0.62);
});

test('normalized geometry, educational template mm, and production legacy values are separated',()=>{
  const professional=squirrel.professionalDefinition;
  assert.strictEqual(professional.normalizedProfile.unit,'RELATIVE_TO_LASH_LINE');
  assert.strictEqual(professional.normalizedProfile.numericSamples,null);
  assert.ok(!Object.hasOwn(professional,'templateMm'));
  assert.strictEqual(squirrel.templateMm.purpose,'STARTING_TEMPLATE_ONLY');
  assert.strictEqual(squirrel.templateMm.universal,false);
  assert.strictEqual(squirrel.templateMm.values,null);
  assert.deepStrictEqual(squirrel.legacyReference.templateMm,[7,8,10,11,10]);
  assert.deepStrictEqual(squirrel.legacyReference.topology,{zonePositions:[0,.20,.46,.62,1],plateauShape:'shoulder',postPeakShape:'gradual'});
});

test('reviewed topology contains pre-outer lift and controlled OUTER decrease without invented samples',()=>{
  const definition=squirrel.professionalDefinition;
  assert.strictEqual(definition.topology.rise,'BUILDS_TOWARD_PRE_OUTER_MAXIMUM');
  assert.strictEqual(definition.topology.postPeak,'CONTROLLED_DECREASE');
  assert.strictEqual(definition.topology.outerBehavior,'LOWER_THAN_PRE_OUTER_MAXIMUM');
  assert.strictEqual(definition.topology.shoulder,'UNRESOLVED');
  assert.strictEqual(definition.normalizedProfile.sequence.at(-1).relationship,'CONTROLLED_DECREASE_FROM_MAXIMUM');
});

test('non-production comparison metadata keeps Squirrel distinct from Cat and Fox',()=>{
  const comparisons=squirrel.professionalDefinition.crossEffectComparison;
  for(const id of ['geometry.cat','geometry.fox']){
    assert.ok(comparisons[id]);
    assert.strictEqual(comparisons[id].squirrelPeakRegion,'PRE_OUTER');
    assert.strictEqual(comparisons[id].squirrelOuterBehavior,'CONTROLLED_DECREASE');
    assert.strictEqual(comparisons[id].squirrelIntent,'OUTER_LIFT');
    assert.strictEqual(comparisons[id].otherIntentClass,'ELONGATION');
    assert.match(comparisons[id].otherDefinitionStatus,/UNRESOLVED_PENDING_/);
  }
  assert.ok(Library.getDefinition('geometry.cat').professionalDefinition);
  assert.ok(Library.getDefinition('geometry.fox').professionalDefinition);
});

test('Squirrel and every other professional definition remain production-inactive',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.strictEqual(Library.library.activation.defaultState,'INACTIVE');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
});

test('all 21 legacy IDs and exact legacy Squirrel inputs remain unchanged',()=>{
  const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = '),catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart),catalogSource=indexSource.slice(catalogStart,catalogEnd);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  const legacySquirrel=catalog.find(entry=>entry.id==='squirrel');
  assert.deepStrictEqual(legacySquirrel.baseZones,[7,8,10,11,10]);
  assert.strictEqual(legacySquirrel.peakZone,3);
  assert.deepStrictEqual(legacySquirrel.zonePositions,[0,.20,.46,.62,1]);
  assert.strictEqual(legacySquirrel.plateauShape,'shoulder');
  assert.strictEqual(legacySquirrel.postPeakShape,'gradual');
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'196a163932c70e131a7f5d8a0c5b919d052503b1960031d0588da645942478cf');
});

test('production Recommendation, PHOTO, DIAGRAM, Application Plan, and domain source remain unchanged',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(indexSource),'8158c616f8b88ea34c1afa598118fbb1f3d3b8dfcb45f50b509ecb04b53a2bbb');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
