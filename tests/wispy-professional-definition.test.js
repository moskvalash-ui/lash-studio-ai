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
const wispy=Library.getDefinition('construction.wispy');
const professional=wispy.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('construction.wispy is populated, reviewed, non-numeric, and production inactive',()=>{
  assert.strictEqual(wispy.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(wispy.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(wispy.validation.status,'VALIDATED');
  assert.strictEqual(wispy.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('Wispy invariant is controlled repeated accent-to-support texture without asymmetry truth',()=>{
  assert.deepStrictEqual(professional.invariantOutcome,{
    visibleLengthVariation:'CONTROLLED_VISIBLE_LENGTH_VARIATION',accentArchitecture:'REPEATED_ACCENT_WISPS',
    topLine:'BROKEN_NON_UNIFORM_TOP_LINE',textureContrast:'ACCENT_TO_SUPPORT_TEXTURE_CONTRAST',finish:'DIMENSIONAL_TEXTURED_FINISH',
  });
  assert.ok(!JSON.stringify(professional.invariantOutcome).includes('CONTROLLED_ASYMMETRY'));
});

test('visual outcome is separate from school- or variant-dependent execution',()=>{
  assert.strictEqual(professional.outcomeVsExecution.executionMethodStatus,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(professional.outcomeVsExecution.universalMethod,null);
});

test('accent architecture is qualitative and exact spike execution remains unresolved',()=>{
  const spike=professional.spikeWispArchitecture;
  assert.strictEqual(spike.accentPieces,'ESSENTIAL');
  assert.strictEqual(spike.visibleLengthHierarchy,'ESSENTIAL_QUALITATIVE');
  assert.strictEqual(spike.brokenTopLine,'ESSENTIAL');
  assert.strictEqual(spike.supportingFieldRelationship,'ESSENTIAL_CONCEPTUAL');
  assert.strictEqual(spike.exactHierarchy,null);
  assert.strictEqual(spike.regularity,'VARIANT_DEPENDENT');
  assert.strictEqual(spike.clustering,null);
  assert.strictEqual(spike.exactSpikeConstruction,'SCHOOL_DEPENDENT');
  assert.strictEqual(spike.universalSpikePlan,null);
  for(const field of ['exactAccentCount','exactAccentFrequency','exactAccentSpacing','exactLengthHierarchy','exactLengthDelta','exactPlacement'])assert.strictEqual(professional[field],null,field);
  assert.ok(!JSON.stringify(professional).includes('0.35'));
});

test('supporting field permits layered and integrated executions without a universal base',()=>{
  assert.deepStrictEqual(professional.supportingField,{
    role:'ESSENTIAL_CONCEPT',continuousBase:'NOT_UNIVERSALLY_REQUIRED',baseDensity:'VARIANT_DEPENDENT',
    layeredSpikeOverBase:'COMMON_SCHOOL_DEPENDENT_METHOD',mixedLengthsIntegrated:'LEGITIMATE_ALTERNATIVE',universalLayerCount:null,
  });
  assert.strictEqual(professional.relationships.layering.universalLayeringMethod,null);
  assert.strictEqual(professional.relationships.layering.universalLayerCount,null);
});

test('fan construction has recognized possibilities but no universal or numeric method',()=>{
  const fan=professional.relationships.fanConstruction;
  assert.strictEqual(fan.selection,'SCHOOL_OR_VARIANT_DEPENDENT');
  assert.strictEqual(fan.universalFanMethod,null);
  assert.strictEqual(fan.recognizedMethodClassesAreUniversalRequirements,false);
  for(const field of ['exactFanCount','exactFanWidth','exactDiameter','exactVolume'])assert.strictEqual(professional[field],null,field);
});

test('Angel and Kim K boundaries stay separate, provisional, and non-exclusive',()=>{
  const angel=professional.visualBoundaryWithAngel,kim=professional.relationshipWithKimK;
  assert.strictEqual(angel.strongerVisibleAccentToSupportContrast,'SUPPORTED');
  assert.strictEqual(angel.taxonomyBoundary,'SCHOOL_DEPENDENT_OVERLAP');
  assert.strictEqual(angel.mutuallyExclusive,false);
  assert.strictEqual(angel.lessUniformlySoft,'SCHOOL_DEPENDENT');
  assert.strictEqual(kim.status,'PROVISIONAL_SCHOOL_DEPENDENT_RELATIONSHIP');
  assert.strictEqual(kim.canonicalSubtypeClaim,false);
  assert.strictEqual(kim.universalHierarchy,null);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.angel'))),'ba6f01a6e7745f4fb17c29af90d5c38e3870da0cb0aef5af9787196c3bbc7dae');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wet'))),'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff');
  assert.strictEqual(Library.getDefinition('construction.kim-k').professionalDefinition.relationshipWithWispy.relationship,'SCHOOL_DEPENDENT_RELATIONSHIP');
});

test('geometry, direction, curl, density, and technique remain separate and unresolved',()=>{
  assert.strictEqual(Library.getDefinition('geometry.wispy'),null);
  assert.strictEqual(Library.getDefinition('direction.wispy'),null);
  assert.deepStrictEqual(professional.relationships.geometry,{domain:'MAPPING_GEOMETRY',role:'MANDATORY_CARRIER_SLOT',selection:'VARIANT_DEPENDENT',geometryId:null,universalCompatibleIds:[]});
  assert.strictEqual(professional.relationships.direction.role,'SECONDARY');
  assert.strictEqual(professional.relationships.curl.exactCurl,null);
  assert.strictEqual(professional.relationships.applicationTechnique.techniqueId,null);
  assert.strictEqual(professional.densityFinish.exactDensity,null);
  assert.strictEqual(professional.densityFinish.lightOrAiryMandatory,false);
});

test('legacy numeric execution is isolated from professional truth',()=>{
  const json=JSON.stringify(professional);
  for(const legacy of ['[7,8,9,10,8]','[7,8,9,11,9]','[7,9,10,10,8]','peakZone','Light Volume 2D','Volume 3D','frequency','0.35'])assert.ok(!json.includes(legacy),legacy);
  assert.deepStrictEqual(wispy.legacyReference.records.map(record=>record.legacyId),['wispy','wispycat','wispydoll']);
  assert.strictEqual(wispy.legacyReference.textureExecution.frequency,2);
  assert.strictEqual(wispy.legacyReference.textureExecution.shortMultiplier,.35);
});

test('validation records provenance and every required unresolved field',()=>{
  assert.ok(wispy.validation.evidence.length&&wispy.validation.provenance.length&&wispy.validation.reviewers.length&&wispy.validation.notes.length);
  for(const item of ['EXACT_ACCENT_HIERARCHY','EXACT_REGULARITY','CLUSTERING','UNIVERSAL_SPIKE_CONSTRUCTION','UNIVERSAL_FAN_METHOD','BASE_LAYER_EXECUTION','UNIVERSAL_LAYERING_METHOD','EXACT_DENSITY','GEOMETRY_COMPATIBILITY','ANGEL_WISPY_TAXONOMY_BOUNDARY','KIM_K_WISPY_TAXONOMY_BOUNDARY','NUMERIC_EXECUTION_PARAMETERS'])assert.ok(professional.unresolved.includes(item),item);
});

test('all legacy production consumers and source bytes remain unchanged',()=>{
  assert.strictEqual(digest(indexSource),'a10d967e9df9d812d0415a5241e0094da1df27f1ab9e64537acb2531851344ba');
  assert.strictEqual(digest(domainSource),'11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end);
  const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.find(x=>x.id==='wispy').baseZones,[7,8,9,10,8]);
  assert.deepStrictEqual(catalog.find(x=>x.id==='wispycat').baseZones,[7,8,9,11,9]);
  assert.deepStrictEqual(catalog.find(x=>x.id==='wispydoll').baseZones,[7,9,10,10,8]);
  assert.strictEqual(digest(catalogSource),'196a163932c70e131a7f5d8a0c5b919d052503b1960031d0588da645942478cf');
  for(const marker of ['function computeSpikeGeometry(','<ProfessionalEyeMap clientDesign={photoClientDesign}','<LashMapDiagram clientDesign={diagramClientDesign}','const plan = generateApplicationPlan(planClientDesign, lang);','const d = canonicalRecommendationProps(raw, p, lang, i);'])assert.ok(indexSource.includes(marker),marker);
});
