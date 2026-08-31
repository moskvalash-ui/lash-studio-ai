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
const preset=Library.getDefinition('preset.eyeliner');
const construction=Library.getDefinition('construction.root-definition');
const direction=Library.getDefinition('direction.eyeliner');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('preset.eyeliner remains a populated production-inactive composite preset',()=>{
  assert.strictEqual(preset.id,'preset.eyeliner');
  assert.strictEqual(preset.kind,'COMPOSITE_PRESET');
  assert.ok(preset.professionalDefinition);
  assert.strictEqual(preset.validation.status,'EXPERT_REVIEWED');
  assert.strictEqual(preset.validation.evidence[0].numericClaims,false);
});

test('root-definition identity represents the mandatory outcome separately from execution',()=>{
  assert.strictEqual(construction.id,'construction.root-definition');
  assert.strictEqual(construction.kind,'CONSTRUCTION_RECIPE');
  assert.strictEqual(construction.professionalDefinition.outcomeType,'ROOT_LINE_DEFINITION');
  assert.strictEqual(construction.professionalDefinition.invariantOutcome.visualResult,'DEFINED_DARKER_LINER_LIKE_ROOT_LINE');
  assert.strictEqual(construction.professionalDefinition.invariantOutcome.separateFromVisibleSilhouette,true);
  assert.strictEqual(construction.professionalDefinition.executionMethods.universalMethod,null);
  assert.strictEqual(construction.professionalDefinition.executionMethods.possibleMethodsAreRequirements,false);
  assert.strictEqual(preset.professionalDefinition.invariant.rootDefinitionOutcome,'REQUIRED');
  assert.strictEqual(preset.professionalDefinition.invariant.constructionId,'construction.root-definition');
});

test('construction has no invented density, fan, volume, layer, spacing, count, or mm values',()=>{
  const professional=construction.professionalDefinition;
  for(const field of ['exactDensity','exactFanWidth','exactFanClosure','exactVolume','exactDiameter','exactLayerCount','exactSpacing','exactLashCount','exactMillimeters']){
    assert.strictEqual(professional[field],null,field);
  }
  assert.strictEqual(construction.validation.evidence[0].numericClaims,false);
  assert.ok(professional.unresolved.includes('EXECUTION_METHOD'));
  assert.ok(professional.unresolved.includes('SCHOOL_VARIANTS'));
});

test('geometry is a variant-dependent carrier slot and geometry.eyeliner does not exist',()=>{
  assert.strictEqual(Library.getDefinition('geometry.eyeliner'),null);
  const layer=preset.professionalDefinition.layers.geometry;
  assert.deepStrictEqual(layer,{domain:'MAPPING_GEOMETRY',role:'MANDATORY_CARRIER_SLOT',selection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[]});
  assert.deepStrictEqual(preset.compatibility.geometryIds,[]);
});

test('direction is a separate draft slot with no universal orientation or numeric execution',()=>{
  assert.strictEqual(direction.id,'direction.eyeliner');
  assert.strictEqual(direction.kind,'DIRECTION_STRATEGY');
  assert.strictEqual(direction.validation.status,'DRAFT');
  assert.strictEqual(direction.validation.evidence[0].numericClaims,false);
  assert.strictEqual(direction.professionalDefinition.dominantAxis,'UNRESOLVED_VARIANT_OR_SCHOOL_DEPENDENT');
  assert.strictEqual(direction.professionalDefinition.numericAngles,null);
  assert.strictEqual(direction.professionalDefinition.directionVectors,null);
  assert.strictEqual(direction.professionalDefinition.zoneBoundaries,null);
  assert.strictEqual(direction.professionalDefinition.outerTailAngle,null);
  assert.strictEqual(direction.professionalDefinition.universalHorizontalRequirement,false);
  assert.strictEqual(preset.professionalDefinition.layers.direction.domain,'DIRECTION_STRATEGY');
});

test('curl, technique, fan construction, and layering remain separate unresolved or variant layers',()=>{
  const layers=preset.professionalDefinition.layers;
  assert.strictEqual(layers.curl.domain,'CURL_STRATEGY');
  assert.strictEqual(layers.curl.strategyId,null);
  assert.strictEqual(layers.curl.exactCurl,null);
  assert.strictEqual(layers.applicationTechnique.domain,'APPLICATION_TECHNIQUE');
  assert.strictEqual(layers.applicationTechnique.techniqueId,null);
  assert.strictEqual(layers.fanConstruction.domain,'FAN_CONSTRUCTION');
  assert.strictEqual(layers.fanConstruction.constructionId,null);
  assert.strictEqual(layers.layering.universalMethod,null);
  assert.strictEqual(layers.layering.role,'OPTIONAL_VARIANT_SPECIFIC');
});

test('professional preset contains no legacy geometry, curl, technique, or score truth',()=>{
  const professionalJson=JSON.stringify(preset.professionalDefinition);
  assert.ok(!professionalJson.includes('[8,8,9,10,9]'));
  assert.ok(!professionalJson.includes('Volume 3D'));
  assert.ok(!professionalJson.includes('CC'));
  assert.ok(!professionalJson.includes('asymmetryThreshold'));
  assert.strictEqual(preset.professionalDefinition.layers.geometry.geometryId,null);
  assert.strictEqual(preset.professionalDefinition.layers.applicationTechnique.techniqueId,null);
  assert.strictEqual(preset.legacyReference.normalizedGeometry.peakZone,3);
  assert.deepStrictEqual(preset.legacyReference.templateMm,[8,8,9,10,9]);
  assert.deepStrictEqual(preset.legacyReference.curl,{base:'CC',options:['CC','D']});
  assert.strictEqual(preset.legacyReference.applicationTechnique,'Volume 3D');
  assert.deepStrictEqual(preset.legacyReference.scoreCoefficients,{base:40,closeSetBonus:10,asymmetryThreshold:.08,asymmetryBonus:10,hoodedBonus:6});
});

test('invariant and execution method are explicitly separate and uncertainty is reviewable',()=>{
  assert.deepStrictEqual(preset.professionalDefinition.invariantVsExecution,{
    invariant:'DEFINED_DARKER_LINER_LIKE_ROOT_LINE',
    executionMethodStatus:'UNRESOLVED_SCHOOL_OR_VARIANT_DEPENDENT',
    differentMethodsMayShareCanonicalIdentity:true,
  });
  assert.ok(preset.professionalDefinition.unresolved.length>0);
  assert.ok(preset.validation.evidence.length>0);
  assert.ok(preset.validation.provenance.length>0);
  assert.ok(construction.validation.provenance.length>0);
  assert.ok(direction.validation.provenance.length>0);
});

test('production remains disabled and legacy Eyeliner plus all production consumers are unchanged',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(digest(indexSource),'1f7dca3f5c8060a59e0cfc9e0900064a884ba7db27ded3a4f7c9812fd6d53f01');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  const eyeliner=catalog.find(entry=>entry.id==='eyeliner');
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(eyeliner.baseZones,[8,8,9,10,9]);
  assert.strictEqual(eyeliner.peakZone,3);
  assert.strictEqual(eyeliner.baseCurl,'CC');
  assert.deepStrictEqual(eyeliner.curlOptions,['CC','D']);
  assert.strictEqual(eyeliner.defaultTechnique,'Volume 3D');
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  assert.ok(indexSource.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
});
