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
const wet=Library.getDefinition('construction.wet');
const professional=wet.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('construction.wet is the populated reviewed production-inactive canonical identity',()=>{
  assert.strictEqual(wet.id,'construction.wet');
  assert.strictEqual(wet.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(wet.validation.status,'EXPERT_REVIEWED');
  assert.strictEqual(wet.validation.evidence[0].numericClaims,false);
});

test('Wet invariant is grouped mascara-like definition with separated columns and reduced fluffiness',()=>{
  const invariant=professional.invariantOutcome;
  assert.deepStrictEqual(invariant.grouping,{role:'ESSENTIAL_QUALITATIVE_OUTCOME',result:'MASCARA_LIKE_GROUPED_DEFINITION'});
  assert.strictEqual(invariant.visibleStructure,'VISIBLE_SEPARATED_COLUMNS');
  assert.strictEqual(invariant.openness,'REDUCED_FLUFFINESS');
  assert.strictEqual(invariant.repetition,'CONTROLLED_REPETITION_OF_DEFINED_GROUPS');
});

test('wet-look finish is an essential perceived visual result, never a literal substance or treatment',()=>{
  assert.deepStrictEqual(professional.invariantOutcome.finish,{
    role:'ESSENTIAL_VISUAL_DESCRIPTOR',result:'WET_LOOK_VISUAL_FINISH',perceivedAppearanceOnly:true,
    literalGlossProduct:false,coatingOrChemicalTreatmentRequired:false,appliedWetSubstanceRequired:false,
  });
});

test('outcome is separate from school- or variant-dependent execution',()=>{
  assert.deepStrictEqual(professional.outcomeVsExecution,{
    invariant:'GROUPED_DEFINED_MASCARA_LIKE_REDUCED_FLUFFINESS_WET_LOOK',
    executionMethodStatus:'SCHOOL_OR_VARIANT_DEPENDENT',universalMethod:null,
    differentMethodsMayShareCanonicalIdentity:true,
  });
});

test('fan construction is essential while its exact method remains unresolved',()=>{
  const fan=professional.relationships.fanConstruction;
  assert.strictEqual(fan.domain,'FAN_CONSTRUCTION');
  assert.strictEqual(fan.role,'ESSENTIAL_CONTRIBUTOR');
  assert.strictEqual(fan.selection,'VARIANT_OR_SCHOOL_DEPENDENT');
  assert.strictEqual(fan.constructionId,null);
  assert.deepStrictEqual(fan.allowedMethodClasses,['CLOSED_FANS','NARROW_OR_NEARLY_CLOSED_FANS','PARTIALLY_CLOSED_CONSTRUCTIONS','GROUPED_BUNDLES_OR_SPIKES']);
  assert.strictEqual(fan.allowedMethodClassesAreUniversalRequirements,false);
  assert.strictEqual(fan.wideOpenFluffyFansPartOfCoreInvariant,false);
});

test('professional Wet contains no fan, density, diameter, volume, spacing, layer, frequency, column, or mm precision',()=>{
  for(const field of ['exactFanCount','exactFanWidth','exactDensity','exactDiameter','exactVolume','exactSpacing','exactColumnCount','exactSpikeFrequency','exactLayerCount','exactMillimeters']){
    assert.strictEqual(professional[field],null,field);
  }
  assert.strictEqual(professional.densityIntent,'VARIANT_DEPENDENT');
  assert.strictEqual(professional.intensity,'VARIANT_DEPENDENT');
});

test('geometry is a separate unresolved carrier and geometry.wet does not exist',()=>{
  assert.strictEqual(Library.getDefinition('geometry.wet'),null);
  assert.deepStrictEqual(professional.relationships.geometry,{
    domain:'MAPPING_GEOMETRY',role:'MANDATORY_CARRIER_SLOT',selection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[],
  });
  assert.deepStrictEqual(wet.compatibility.geometryIds,[]);
});

test('direction is secondary and separate with no Wet identity or numeric execution',()=>{
  const direction=professional.relationships.direction;
  assert.strictEqual(Library.getDefinition('direction.wet'),null);
  assert.strictEqual(direction.role,'SECONDARY_SEPARATE_CONTRIBUTOR');
  assert.strictEqual(direction.strategyId,null);
  assert.strictEqual(direction.numericAngles,null);
  assert.strictEqual(direction.directionVectors,null);
  assert.strictEqual(direction.directionalZones,null);
  assert.strictEqual(direction.universalSweep,null);
});

test('curl and technique are separate unresolved relationships without legacy truth',()=>{
  const curl=professional.relationships.curl,technique=professional.relationships.applicationTechnique;
  assert.strictEqual(curl.role,'SEPARATE_VARIANT_DEPENDENT_UNRESOLVED');
  assert.strictEqual(curl.strategyId,null);
  assert.strictEqual(curl.exactCurl,null);
  assert.strictEqual(technique.role,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(technique.techniqueId,null);
  const json=JSON.stringify(professional);
  for(const legacy of ['Wet Technique / Wet Set','0.05–0.10 mm','[7,8,9,9,8]','peakZone','asymmetryThreshold','MINIMAL_ROOT_DENSITY','DELIBERATELY_SPARSE'])assert.ok(!json.includes(legacy),legacy);
  assert.ok(!professional.relationships.curl.exactCurl);
});

test('Angel boundary is resolved by the separate Angel review while Wispy or Kim K requirements do not redefine Wet',()=>{
  assert.strictEqual(professional.crossEffectBoundaries.angel,'ANGEL_BOUNDARY_REQUIRES_SEPARATE_REVIEW');
  assert.strictEqual(professional.invariantOutcome.dramaticLengthContrastRequired,false);
  assert.strictEqual(professional.invariantOutcome.kimStyleRaysRequired,false);
  assert.strictEqual(professional.invariantOutcome.wispyAccentStructureRequired,false);
  assert.strictEqual(Library.getDefinition('construction.angel').professionalDefinition.visualBoundaryWithWet.wetConstructionId,'construction.wet');
  assert.strictEqual(Library.getDefinition('construction.wispy').professionalDefinition.invariantOutcome.accentArchitecture,'REPEATED_ACCENT_WISPS');
  assert.strictEqual(Library.getDefinition('construction.kim-k').professionalDefinition.invariantOutcome.hierarchy,'DELIBERATELY_STRUCTURED_ACCENT_HIERARCHY');
});

test('future variants are reviewable without creating variant identities now',()=>{
  assert.strictEqual(professional.futureVariantNamespace.status,'REQUIRES_SEPARATE_REVIEW');
  assert.strictEqual(professional.futureVariantNamespace.canonicalVariantIdsCreated,false);
  assert.deepStrictEqual(wet.variants,[]);
  assert.ok(professional.unresolved.includes('SCHOOL_VARIANTS'));
  assert.ok(professional.unresolved.includes('ANGEL_BOUNDARY'));
  assert.ok(wet.validation.evidence.length>0);
  assert.ok(wet.validation.provenance.length>0);
  assert.ok(wet.validation.reviewers.length>0);
});

test('legacy Wet precision remains isolated in legacyReference only',()=>{
  assert.deepStrictEqual(wet.legacyReference.templateMm,[7,8,9,9,8]);
  assert.deepStrictEqual(wet.legacyReference.normalizedGeometry,{peakZone:3});
  assert.deepStrictEqual(wet.legacyReference.topology,{zonePositions:null,plateauShape:'linear',postPeakShape:'linear'});
  assert.deepStrictEqual(wet.legacyReference.curl,{base:'B',options:['J','B','C']});
  assert.strictEqual(wet.legacyReference.applicationTechnique,'Wet Technique / Wet Set');
  assert.deepStrictEqual(wet.legacyReference.techniqueDiameters,['0.05–0.10 mm']);
  assert.deepStrictEqual(wet.legacyReference.scoreCoefficients,{base:44,neutralTiltCoefficient:10,nonNeutralFallback:2,asymmetryThreshold:.06,asymmetryBonus:6});
  assert.deepStrictEqual(wet.legacyReference.narrativeClaims,['MINIMAL_ROOT_DENSITY','DELIBERATELY_SPARSE','FILL_FREQUENCY_CLAIM']);
});

test('production and all legacy Wet consumers remain byte-identical',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(digest(indexSource),'2dff4f9a689701c9e95673ab035fb79c7aa10c0c443eb1907406b47bdd8dcc2d');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  const legacyWet=catalog.find(entry=>entry.id==='wet');
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(legacyWet.baseZones,[7,8,9,9,8]);
  assert.strictEqual(legacyWet.peakZone,3);
  assert.strictEqual(legacyWet.baseCurl,'B');
  assert.deepStrictEqual(legacyWet.curlOptions,['J','B','C']);
  assert.strictEqual(legacyWet.defaultTechnique,'Wet Technique / Wet Set');
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  assert.ok(indexSource.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(indexSource.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(indexSource.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(indexSource.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(indexSource.includes('const d = canonicalRecommendationProps(raw, p, lang, i);'));
});
