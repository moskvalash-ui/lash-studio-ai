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
const angel=Library.getDefinition('construction.angel');
const wet=Library.getDefinition('construction.wet');
const professional=angel.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const leafStrings=value=>value&&typeof value==='object'?Object.values(value).flatMap(leafStrings):typeof value==='string'?[value]:[];

test('construction.angel is the populated reviewed production-inactive canonical identity',()=>{
  assert.strictEqual(angel.id,'construction.angel');
  assert.strictEqual(angel.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(angel.validation.status,'EXPERT_REVIEWED');
  assert.strictEqual(angel.validation.evidence[0].numericClaims,false);
});

test('Angel invariant is airy, feathered, soft, separated, fluttery, and non-compact',()=>{
  const invariant=professional.invariantOutcome;
  assert.strictEqual(invariant.definition,'AIRY_FEATHERED_DEFINITION');
  assert.strictEqual(invariant.texture,'SOFT_SEPARATED_TEXTURE');
  assert.strictEqual(invariant.movement,'FLUTTERY_VISUAL_MOVEMENT');
  assert.strictEqual(invariant.finish.result,'LIGHT_NON_COMPACT_FINISH');
  assert.deepStrictEqual(invariant.wispySeparatedMovement,{role:'ESSENTIAL_VISUAL_OUTCOME'});
});

test('visual language never becomes technical weight, density, load, or safety truth',()=>{
  const finish=professional.invariantOutcome.finish;
  assert.strictEqual(finish.role,'ESSENTIAL_VISUAL_DESCRIPTOR');
  assert.strictEqual(finish.perceivedAppearanceOnly,true);
  assert.strictEqual(finish.technicalWeightClaim,false);
  assert.strictEqual(finish.numericDensityClaim,false);
  assert.strictEqual(finish.safetyOrLoadClaim,false);
  assert.strictEqual(professional.densityFinish.exactDensity,null);
});

test('visual outcome is separated from school- or variant-dependent execution',()=>{
  assert.deepStrictEqual(professional.outcomeVsExecution,{
    invariant:'AIRY_FEATHERED_SOFT_SEPARATED_FLUTTERY_NON_COMPACT_VISUAL_RESULT',
    executionMethodStatus:'SCHOOL_OR_VARIANT_DEPENDENT',universalMethod:null,
    differentMethodsMayShareCanonicalIdentity:true,
  });
});

test('fan construction is essential without one universal physical method',()=>{
  const fan=professional.relationships.fanConstruction;
  assert.strictEqual(fan.role,'ESSENTIAL_CONTRIBUTOR');
  assert.strictEqual(fan.selection,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(fan.constructionId,null);
  assert.deepStrictEqual(fan.recognizedMethodClasses,['CLOSED_FANS','NARROW_OR_NEARLY_CLOSED_FANS','OPEN_SUPPORTING_FANS','MIXED_OPEN_CLOSED_CONSTRUCTIONS','CLASSIC_ASSISTED_CONSTRUCTIONS','LAYERED_COMBINATIONS']);
  assert.strictEqual(fan.recognizedMethodClassesAreUniversalRequirements,false);
});

test('professional Angel contains no exact fan, spike, layer, length, or millimeter execution',()=>{
  for(const field of ['exactFanCount','exactFanWidth','exactDiameter','exactVolume','exactFanClosurePercentage','exactLashCount','exactSpikeCount','exactSpikeFrequency','exactSpikeSpacing','exactSpikeHierarchy','exactLengthDelta','exactPlacement','exactLayerCount','exactMillimeters']){
    assert.strictEqual(professional[field],null,field);
  }
  assert.strictEqual(professional.relationships.spikeWisp.role,'COMMON_CONTRIBUTOR_SCHOOL_DEPENDENT');
  assert.strictEqual(professional.relationships.spikeWisp.universalSpikePlan,null);
  assert.strictEqual(professional.relationships.layering.role,'OPTIONAL_OR_SCHOOL_DEPENDENT');
  assert.strictEqual(professional.relationships.layering.universalLayeringMethod,null);
});

test('geometry is a separate unresolved carrier and geometry.angel does not exist',()=>{
  assert.strictEqual(Library.getDefinition('geometry.angel'),null);
  assert.deepStrictEqual(professional.relationships.geometry,{
    domain:'MAPPING_GEOMETRY',role:'MANDATORY_CARRIER_SLOT',selection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[],
  });
  assert.deepStrictEqual(angel.compatibility.geometryIds,[]);
});

test('direction is secondary and separate with no Angel identity or numeric execution',()=>{
  const direction=professional.relationships.direction;
  assert.strictEqual(Library.getDefinition('direction.angel'),null);
  assert.strictEqual(direction.role,'SECONDARY');
  assert.strictEqual(direction.strategyId,null);
  for(const field of ['numericAngles','directionVectors','directionalZones','universalSweep'])assert.strictEqual(direction[field],null,field);
});

test('curl and technique stay separate without legacy B/J/C or Light Volume truth',()=>{
  const curl=professional.relationships.curl,technique=professional.relationships.applicationTechnique;
  assert.strictEqual(curl.role,'SEPARATE_VARIANT_DEPENDENT');
  assert.strictEqual(curl.strategyId,null);
  assert.strictEqual(curl.exactCurl,null);
  assert.strictEqual(technique.role,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(technique.techniqueId,null);
  const strings=leafStrings(professional);
  for(const legacy of ['B','J','C','Light Volume 2D'])assert.ok(!strings.includes(legacy),legacy);
});

test('density and finish remain qualitative with variant intensity and unresolved root darkness',()=>{
  assert.deepStrictEqual(professional.densityFinish.supportedVisualOutcomes,['AIRY','LIGHT','SOFT','FEATHERED','FLUTTERY','VISUALLY_SEPARATED']);
  assert.strictEqual(professional.densityFinish.exactDensity,null);
  assert.strictEqual(professional.densityFinish.intensity,'VARIANT_DEPENDENT');
  assert.strictEqual(professional.densityFinish.rootDarkness,'UNRESOLVED_OR_SCHOOL_DEPENDENT');
  assert.strictEqual(professional.densityFinish.transparentMandatory,false);
});

test('Angel and Wet have a reviewed visual boundary without a universal technical split',()=>{
  const boundary=professional.visualBoundaryWithWet;
  assert.strictEqual(boundary.wetConstructionId,'construction.wet');
  assert.strictEqual(boundary.differentiator,'VISUAL_OUTCOME_INTENT');
  assert.strictEqual(boundary.exactTechnicalSeparation,'SCHOOL_DEPENDENT');
  assert.strictEqual(boundary.terminologyOverlap,'PRESENT_IN_SOME_SCHOOLS');
  assert.deepStrictEqual(boundary.sharedMethodClassesAllowed,['NARROW_FANS','CLOSED_FANS']);
  assert.strictEqual(boundary.universalPhysicalFanDifference,false);
  assert.strictEqual(digest(JSON.stringify(wet)),'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff');
});

test('Wispy overlap remains school-dependent and Kim K is not redefined',()=>{
  const effects=professional.crossEffectRelationships;
  assert.strictEqual(effects.wispy.taxonomyBoundary,'SCHOOL_DEPENDENT_OVERLAP');
  assert.strictEqual(effects.wispy.subtypeInSomeSchools,true);
  assert.strictEqual(effects.wispy.distinctWetRelatedConstructionInOtherSchools,true);
  assert.strictEqual(effects.kimK.comparisonStatus,'PROVISIONAL_UNTIL_KIM_K_REVIEW');
  assert.strictEqual(effects.kimK.dramaticSpikeBaseContrastRequired,false);
  assert.strictEqual(Library.getDefinition('construction.wispy').professionalDefinition.visualBoundaryWithAngel.angelConstructionId,'construction.angel');
  assert.strictEqual(Library.getDefinition('construction.kim-k').professionalDefinition.relationshipWithWispy.wispyConstructionId,'construction.wispy');
});

test('future school variants are review dimensions, not canonical IDs',()=>{
  assert.strictEqual(professional.futureVariantNamespace.status,'REQUIRES_SEPARATE_REVIEW');
  assert.strictEqual(professional.futureVariantNamespace.canonicalVariantIdsCreated,false);
  assert.deepStrictEqual(angel.variants,[]);
  for(const unresolved of ['UNIVERSAL_FAN_METHOD','SPIKE_HIERARCHY','LAYERING_REQUIREMENT','EXACT_DENSITY','ROOT_DARKNESS','GEOMETRY_COMPATIBILITY','TECHNICAL_ANGEL_WET_SEPARATION','ANGEL_WISPY_TAXONOMY_BOUNDARY','NUMERIC_EXECUTION_PARAMETERS'])assert.ok(professional.unresolved.includes(unresolved),unresolved);
});

test('legacy Angel precision remains isolated in legacyReference only',()=>{
  assert.deepStrictEqual(angel.legacyReference.templateMm,[6,7,8,8,7]);
  assert.deepStrictEqual(angel.legacyReference.normalizedGeometry,{peakZone:2});
  assert.deepStrictEqual(angel.legacyReference.topology,{zonePositions:null,plateauShape:'linear',postPeakShape:'linear'});
  assert.deepStrictEqual(angel.legacyReference.curl,{base:'B',options:['J','B','C']});
  assert.strictEqual(angel.legacyReference.applicationTechnique,'Light Volume 2D');
  assert.deepStrictEqual(angel.legacyReference.scoreCoefficients,{base:40,lowConfidenceThreshold:.5,lowConfidenceBonus:10,tiltThresholdDegrees:3,tiltBonus:12,asymmetryThreshold:.05,asymmetryBonus:8});
  const json=JSON.stringify(professional);
  for(const legacy of ['[6,7,8,8,7]','peakZone','lowConfidenceThreshold','tiltThresholdDegrees','asymmetryThreshold'])assert.ok(!json.includes(legacy),legacy);
});

test('validation is reviewed, non-numeric, and explicit about uncertainty',()=>{
  assert.strictEqual(angel.validation.evidence[0].numericClaims,false);
  assert.ok(angel.validation.evidence.length>0);
  assert.ok(angel.validation.provenance.length>0);
  assert.ok(angel.validation.reviewers.length>0);
  assert.ok(angel.validation.notes.length>0);
  assert.notStrictEqual(angel.validation.status,'VALIDATED');
});

test('production and all legacy Angel consumers remain byte-identical',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(digest(indexSource),'7b645842ef2fe5718bacd7ad9ccce74c3a06f22437ae44e83e6a647488bb4987');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  const legacyAngel=catalog.find(entry=>entry.id==='angel');
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(legacyAngel.baseZones,[6,7,8,8,7]);
  assert.strictEqual(legacyAngel.peakZone,2);
  assert.strictEqual(legacyAngel.baseCurl,'B');
  assert.deepStrictEqual(legacyAngel.curlOptions,['J','B','C']);
  assert.strictEqual(legacyAngel.defaultTechnique,'Light Volume 2D');
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  assert.ok(indexSource.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
});
