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
const catDirection=Library.getDefinition('direction.cat');
const foxDirection=Library.getDefinition('direction.fox');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('stable Cat and Fox direction identities exist uniquely in the direction registry',()=>{
  assert.strictEqual(catDirection.id,'direction.cat');
  assert.strictEqual(foxDirection.id,'direction.fox');
  assert.notStrictEqual(catDirection.id,foxDirection.id);
  assert.strictEqual(catDirection.kind,'DIRECTION_STRATEGY');
  assert.strictEqual(foxDirection.kind,'DIRECTION_STRATEGY');
  const directionIds=Object.keys(Library.library.registries.directionStrategies);
  assert.ok(directionIds.includes('direction.cat'));
  assert.ok(directionIds.includes('direction.fox'));
  assert.strictEqual(new Set(directionIds).size,directionIds.length);
});

test('Cat and Fox are structurally distinguishable without display names or legacy geometry',()=>{
  const cat=catDirection.professionalDefinition,fox=foxDirection.professionalDefinition;
  assert.strictEqual(cat.directionalIntent,'FELINE_OUTER_LIFT');
  assert.strictEqual(cat.dominantAxis,'UPWARD_OUTER');
  assert.strictEqual(cat.visualBehavior,'COMPARATIVELY_UPWARD_CURVED');
  assert.strictEqual(fox.directionalIntent,'TEMPORAL_HORIZONTAL_ELONGATION');
  assert.strictEqual(fox.dominantAxis,'TEMPORAL_OUTWARD');
  assert.strictEqual(fox.visualBehavior,'COMPARATIVELY_OUTWARD_LINEAR');
  assert.notDeepStrictEqual(
    {intent:cat.directionalIntent,axis:cat.dominantAxis,behavior:cat.visualBehavior},
    {intent:fox.directionalIntent,axis:fox.dominantAxis,behavior:fox.visualBehavior},
  );
  const professionalJson=JSON.stringify({cat,fox});
  assert.ok(!professionalJson.includes('0.78'));
  assert.ok(!professionalJson.includes('0.66'));
});

test('no exact direction degrees, vectors, zone boundaries, or curl are invented',()=>{
  for(const definition of [catDirection,foxDirection]){
    const professional=definition.professionalDefinition;
    assert.strictEqual(professional.numericAngles,null);
    assert.strictEqual(professional.directionVectors,null);
    assert.strictEqual(professional.zoneBoundaries,null);
    assert.deepStrictEqual(professional.curlInteraction,{relationship:'MAY_INTERACT',exactCurl:null,resolution:'UNRESOLVED'});
    assert.ok(professional.unresolved.includes('EXACT_ANGLES'));
    assert.ok(professional.unresolved.includes('EXACT_CURL'));
  }
});

test('mapping geometry, direction strategy, and curl remain separate professional layers',()=>{
  const schema=Library.library.schema.direction;
  assert.strictEqual(schema.separateFromMappingGeometry,true);
  assert.strictEqual(schema.separateFromCurlStrategy,true);
  for(const [direction,geometryId] of [[catDirection,'geometry.cat'],[foxDirection,'geometry.fox']]){
    const relationship=direction.professionalDefinition.mappingDirectionRelationship;
    assert.strictEqual(relationship.geometryId,geometryId);
    assert.deepStrictEqual(relationship.layers,['MAPPING_GEOMETRY','DIRECTION_STRATEGY']);
    assert.strictEqual(relationship.relationship,'COMPOSITE_CONTRIBUTOR');
    assert.strictEqual(relationship.directionAloneDefinesEffect,false);
    assert.strictEqual(relationship.universalComposition,'UNRESOLVED');
  }
});

test('Cat and Fox geometry definitions and their unresolved questions remain byte-identical',()=>{
  const cat=Library.getDefinition('geometry.cat'),fox=Library.getDefinition('geometry.fox');
  assert.strictEqual(digest(JSON.stringify(cat)),'fc9b21fc83afbf00ebb0e41a225a7f5eef06782db3d60b2216be7322b8ee7d58');
  assert.strictEqual(digest(JSON.stringify(fox)),'7cf9298a0331e08843127c74fc4f8f38b9ef5742e6e5a7e3bb13cd7d0a2811c7');
  const comparison=cat.professionalDefinition.crossEffectComparison['geometry.fox'];
  assert.strictEqual(comparison.relativePeakOrder,'UNRESOLVED');
  assert.strictEqual(comparison.relativeSharpness,'UNRESOLVED');
  assert.strictEqual(comparison.tailDeclineOrPlateauDifference,'UNRESOLVED');
  assert.strictEqual(fox.professionalDefinition.peak.positionRange.min,null);
  assert.strictEqual(fox.professionalDefinition.peak.positionRange.max,null);
});

test('direction dependency is qualitative, non-universal, and comparatively explicit',()=>{
  assert.deepStrictEqual(catDirection.professionalDefinition.directionDependency,{role:'MEANINGFUL_CONTRIBUTOR',universality:'UNRESOLVED'});
  assert.deepStrictEqual(foxDirection.professionalDefinition.directionDependency,{role:'STRONG_CONTRIBUTOR',universality:'UNRESOLVED'});
  assert.strictEqual(catDirection.professionalDefinition.crossEffectComparison['direction.fox'].relativeDirectionDependency,'FOX_STRONGER_THAN_CAT');
  assert.strictEqual(foxDirection.professionalDefinition.crossEffectComparison['direction.cat'].exactDependencyMagnitude,'UNRESOLVED');
  assert.deepStrictEqual(catDirection.professionalDefinition.schoolDependency,{status:'UNRESOLVED'});
  assert.deepStrictEqual(foxDirection.professionalDefinition.schoolDependency,{status:'UNRESOLVED'});
});

test('both direction definitions have reviewed non-numeric evidence and provenance',()=>{
  for(const definition of [catDirection,foxDirection]){
    assert.strictEqual(definition.validation.status,'EXPERT_REVIEWED');
    assert.strictEqual(definition.validation.evidence[0].numericClaims,false);
    assert.ok(definition.validation.evidence.length>0);
    assert.ok(definition.validation.provenance.length>0);
    assert.ok(definition.validation.reviewers.length>0);
  }
});

test('production remains disabled and all production consumers and 21 legacy IDs are unchanged',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(digest(indexSource),'7b645842ef2fe5718bacd7ad9ccce74c3a06f22437ae44e83e6a647488bb4987');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  assert.ok(indexSource.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
