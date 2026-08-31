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
const anime=Library.getDefinition('construction.anime');
const professional=anime.professionalDefinition;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('construction.anime is the populated, expert-reviewed, non-numeric, production-inactive canonical identity',()=>{
  assert.strictEqual(anime.id,'construction.anime');
  assert.strictEqual(anime.kind,'CONSTRUCTION_RECIPE');
  assert.ok(professional);
  assert.strictEqual(anime.validation.status,'EXPERT_REVIEWED');
  assert.notStrictEqual(anime.validation.status,'VALIDATED');
  assert.strictEqual(anime.validation.evidence[0].numericClaims,false);
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('canonical terminology stays Anime, independent of the combined legacy Manga/Anime label',()=>{
  assert.notStrictEqual(anime.id,'manga');
  assert.strictEqual(anime.displayName,'Anime');
  assert.strictEqual(anime.legacyReference.relationship,'INDEPENDENT_IDENTITY_FROM_LEGACY_COMBINED_LABEL');
  assert.deepStrictEqual(anime.legacyReference.legacyIds,['manga']);
  assert.strictEqual(Library.getDefinition('geometry.manga'),null);
  assert.strictEqual(Library.getDefinition('construction.manga'),null);
});

test('elongated separated accents over supporting structure are essential, with a graphic segmented top-line outcome',()=>{
  assert.strictEqual(professional.invariantOutcome.accentArchitecture,'PRONOUNCED_ELONGATED_ACCENT_STRUCTURE');
  assert.strictEqual(professional.invariantOutcome.accentToSupportHierarchy,'VISIBLE_ACCENT_TO_SUPPORT_HIERARCHY');
  assert.strictEqual(professional.invariantOutcome.accentSeparation,'CLEARLY_SEPARATED_ACCENT_PRESENTATION');
  assert.strictEqual(professional.invariantOutcome.topLine,'INTENTIONAL_TOP_LINE_SEGMENTATION');
  assert.strictEqual(professional.invariantOutcome.finish.result,'GRAPHIC_DEFINED_TEXTURE_OUTCOME');
  assert.strictEqual(professional.spikeAccentArchitecture.dominantElongatedAccents,'ESSENTIAL_QUALITATIVE');
  assert.strictEqual(professional.spikeAccentArchitecture.accentSeparationFromSupport,'ESSENTIAL_QUALITATIVE');
});

test('the invariant never claims a universal numeric contrast or the largest contrast in the family',()=>{
  assert.strictEqual(professional.invariantOutcome.universallyLargestContrastInFamily,false);
  assert.strictEqual(professional.invariantOutcome.universalMillimeterDifference,null);
  assert.strictEqual(professional.invariantOutcome.finish.numericContrastClaim,false);
});

test('exact spike count, frequency, spacing, regularity, alternation, and construction method remain unresolved',()=>{
  assert.strictEqual(professional.spikeAccentArchitecture.exactSpikeCount,null);
  assert.strictEqual(professional.spikeAccentArchitecture.exactSpikeFrequency,null);
  assert.strictEqual(professional.spikeAccentArchitecture.exactSpacing,null);
  assert.strictEqual(professional.spikeAccentArchitecture.exactAccentWidth,null);
  assert.strictEqual(professional.spikeAccentArchitecture.exactFanConstruction,null);
  assert.ok(professional.spikeAccentArchitecture.exactRegularity.includes('UNRESOLVED'));
  assert.ok(professional.spikeAccentArchitecture.exactAlternation.includes('UNRESOLVED'));
  assert.ok(professional.spikeAccentArchitecture.exactSpikeConstructionMethod.includes('UNRESOLVED'));
  assert.ok(professional.spikeAccentArchitecture.everyDivisionPointCarriesAccent.includes('UNRESOLVED'));
  assert.ok(professional.spikeAccentArchitecture.primarySecondaryTierArchitecture.includes('UNRESOLVED'));
});

test('legacy frequency 2 and baseToSpikeDiff 4 are not promoted into professional truth',()=>{
  const json=JSON.stringify(professional);
  assert.ok(!json.includes('"frequency":2'));
  assert.ok(!json.includes('"baseToSpikeDiff":4'));
  assert.deepStrictEqual(anime.legacyReference.textureExecution,{pattern:'manga',frequency:2,baseToSpikeDiff:4,alternation:'ALL_SEGMENTS_ACCENTED',jitter:'NONE'});
});

test('hierarchy requires visible accent-vs-support distinction without asserting a universal tier count',()=>{
  assert.strictEqual(professional.hierarchy.requirement,'DOMINANT_ELONGATED_ACCENTS_MUST_REMAIN_VISIBLY_DISTINGUISHABLE_FROM_SUPPORTING_STRUCTURE');
  assert.strictEqual(professional.hierarchy.singleAccentTierUniversal,false);
  assert.strictEqual(professional.hierarchy.twoTierUniversal,false);
  assert.strictEqual(professional.hierarchy.secondaryAccentsUniversallyRequired,false);
  assert.strictEqual(professional.hierarchy.secondaryAccentsUniversallyExcluded,false);
  assert.strictEqual(professional.hierarchy.exactTierCount,'UNRESOLVED');
});

test('rhythm and spacing are neither universally regular nor universally irregular',()=>{
  assert.strictEqual(professional.rhythmSpacing.regularSpacingUniversal,false);
  assert.strictEqual(professional.rhythmSpacing.irregularSpacingUniversal,false);
  assert.strictEqual(professional.rhythmSpacing.exactInterval,null);
  assert.strictEqual(professional.rhythmSpacing.exactRepetition,null);
  assert.ok(professional.rhythmSpacing.exactRhythm.includes('UNRESOLVED'));
  assert.ok(professional.rhythmSpacing.clustering.includes('UNRESOLVED'));
});

test('a supporting structure is conceptually relevant but no universal base construction is required',()=>{
  assert.strictEqual(professional.supportingField.role,'ESSENTIAL_VISUAL_RELATIONSHIP_CONCEPT');
  assert.strictEqual(professional.supportingField.universalBaseConstruction,null);
  assert.strictEqual(professional.supportingField.continuousBaseUniversal,false);
  assert.strictEqual(professional.supportingField.fanBaseUniversal,false);
  assert.strictEqual(professional.supportingField.classicBaseUniversal,false);
  assert.strictEqual(professional.supportingField.closedFanBaseUniversal,false);
  assert.strictEqual(professional.supportingField.volumeBaseUniversal,false);
  assert.strictEqual(professional.supportingField.universalLayerCount,null);
});

test('negative space is professionally relevant without a universal numeric gap or pattern',()=>{
  assert.strictEqual(professional.negativeSpace.role,'PROFESSIONALLY_RELEVANT_TO_GRAPHIC_OUTCOME');
  assert.strictEqual(professional.negativeSpace.visibleSeparationBetweenDominantAccents,'QUALITATIVELY_RELEVANT');
  assert.strictEqual(professional.negativeSpace.universalNumericGap,null);
  assert.strictEqual(professional.negativeSpace.universalGapPatternRequired,false);
  assert.strictEqual(professional.negativeSpace.exactGapArchitecture,'UNRESOLVED');
});

test('RAY is a possible, non-universal execution primitive and does not define or require Anime',()=>{
  const rp=professional.rayPrimitiveRelationship;
  assert.strictEqual(rp.primitiveId,'RAY');
  assert.strictEqual(rp.role,'POSSIBLE_NON_UNIVERSAL_EXECUTION_METHOD');
  assert.strictEqual(rp.required,false);
  assert.strictEqual(rp.usingRayAutomaticallyCreatesAnime,false);
  assert.strictEqual(rp.animeUniversallyRequiresRay,false);
  assert.strictEqual(rp.animeIsCompleteConstruction,true);
  assert.strictEqual(rp.rayIsReusablePrimitiveOnly,true);
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.ok(!Object.prototype.hasOwnProperty.call(ray.professionalDefinition.taxonomyRelationships,'anime'));
  assert.ok(ray.professionalDefinition.reusability.potentialContainingConstructionIds.includes('construction.anime'));
});

test('geometry, direction, curl, and application technique remain separate slots with no new identities',()=>{
  assert.strictEqual(professional.relationships.geometry.role,'MANDATORY_CARRIER_SLOT');
  assert.strictEqual(professional.relationships.geometry.geometryId,null);
  assert.deepStrictEqual(professional.relationships.geometry.universalCompatibleIds,[]);
  assert.strictEqual(Library.getDefinition('geometry.anime'),null);
  assert.strictEqual(professional.relationships.direction.strategyId,null);
  assert.strictEqual(professional.relationships.direction.numericAngles,null);
  assert.strictEqual(professional.relationships.direction.directionVectors,null);
  assert.strictEqual(Library.getDefinition('direction.anime'),null);
  assert.strictEqual(professional.relationships.curl.strategyId,null);
  assert.strictEqual(professional.relationships.curl.exactCurl,null);
  assert.strictEqual(professional.relationships.applicationTechnique.techniqueId,null);
  assert.strictEqual(professional.relationships.applicationTechnique.role,'SCHOOL_OR_VARIANT_DEPENDENT');
});

test('no legacy narrative about spike direction is promoted into a universal direction strategy',()=>{
  const json=JSON.stringify(professional);
  assert.ok(!json.toLowerCase().includes('key part of this look'));
});

test('legacy D/CC/L+ curl and Volume 3D technique are not promoted into professional truth',()=>{
  const json=JSON.stringify(professional);
  assert.ok(!json.includes('"D"'));
  assert.ok(!json.includes('"CC"'));
  assert.ok(!json.includes('"L+"'));
  assert.ok(!json.includes('Volume 3D'));
  assert.deepStrictEqual(anime.legacyReference.curl,{base:'D',options:['CC','D','L+']});
  assert.strictEqual(anime.legacyReference.applicationTechnique,'Volume 3D');
});

test('fan construction has recognized possibilities but no universal method',()=>{
  const fan=professional.relationships.fanConstruction;
  assert.strictEqual(fan.constructionId,null);
  assert.strictEqual(fan.universalFanConstruction,null);
  assert.strictEqual(fan.recognizedMethodClassesAreUniversalRequirements,false);
  assert.ok(Array.isArray(fan.recognizedMethodClasses)&&fan.recognizedMethodClasses.length>0);
});

test('density, diameter, volume, layer count, extension count, and length fields carry no numeric precision',()=>{
  const d=professional.densityFinish;
  for(const field of ['exactDensity','exactDiameter','exactVolume','exactFanWidth','exactLayerCount','exactExtensionCount','exactMaximumLength','exactBaseLength','exactSpikeLength'])assert.strictEqual(d[field],null,field);
  for(const field of ['exactSpikeCount','exactSpikeFrequency','exactSpacing','exactAccentWidth','exactFanCount','exactFanWidth','exactDiameter','exactVolume','exactLayerCount','exactExtensionCount','exactMillimeters','exactLengthDelta'])assert.strictEqual(professional[field],null,field);
});

test('Anime vs Kim K and Anime vs Wispy stay provisional/school-dependent, never a numeric threshold, and Kim K/Wispy remain byte-identical',()=>{
  const kimKCmp=professional.crossEffectComparison.kimK;
  assert.strictEqual(kimKCmp.status,'SCHOOL_DEPENDENT_PROVISIONAL_UNRESOLVED_BOUNDARY');
  assert.strictEqual(kimKCmp.universalNumericContrastDifference,false);
  assert.strictEqual(kimKCmp.mutuallyExclusive,false);
  const wispyCmp=professional.crossEffectComparison.wispy;
  assert.strictEqual(wispyCmp.status,'SCHOOL_DEPENDENT_PROVISIONAL');
  assert.strictEqual(wispyCmp.numericThreshold,null);
  assert.strictEqual(wispyCmp.mutuallyExclusive,false);
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.kim-k'))),'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3');
  assert.strictEqual(digest(JSON.stringify(Library.getDefinition('construction.wispy'))),'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86');
});

test('Anime vs Jellyfish is unresolved pending Jellyfish review, and Jellyfish remains an untouched placeholder',()=>{
  const jf=professional.crossEffectComparison.jellyfish;
  assert.strictEqual(jf.status,'UNRESOLVED_PENDING_JELLYFISH_REVIEW');
  const jellyfish=Library.getDefinition('construction.jellyfish');
  assert.strictEqual(jellyfish.professionalDefinition,null);
  assert.notStrictEqual(jellyfish.validation.status,'EXPERT_REVIEWED');
  assert.strictEqual(digest(JSON.stringify(jellyfish)),'06319851f2cd44d040449e147cbe597a42d4688f8f44f9969016c411519fb089');
});

test('legacy manga geometry, curl, technique, texture, category, and scoring remain isolated to legacyReference only',()=>{
  assert.deepStrictEqual(anime.legacyReference.normalizedGeometry,{peakZone:3});
  assert.deepStrictEqual(anime.legacyReference.templateMm,[6,9,7,12,7]);
  assert.strictEqual(anime.legacyReference.category,'creative');
  assert.deepStrictEqual(anime.legacyReference.scoreCoefficients,{base:30,relativeEyeSizeThreshold:0.36,relativeEyeSizeBonus:16,confidenceThreshold:0.5,confidenceBonus:10});
  const json=JSON.stringify(professional);
  for(const legacy of ['[6,9,7,12,7]','peakZone','relativeEyeSize','0.36','Doll Anime','Spiky Anime'])assert.ok(!json.includes(legacy),legacy);
});

test('validation includes provenance, review, revision, and every required unresolved dimension',()=>{
  assert.ok(anime.validation.evidence.length&&anime.validation.provenance.length&&anime.validation.reviewers.length&&anime.validation.notes.length);
  assert.strictEqual(anime.validation.revision,1);
  for(const item of ['ANIME_VS_MANGA_TERMINOLOGY_BOUNDARY','EXACT_SPIKE_CONSTRUCTION','EXACT_HIERARCHY_OR_TIERING','EXACT_RHYTHM','EXACT_SPACING','EXACT_REGULARITY','SUPPORTING_BASE_CONSTRUCTION','LAYERING','FAN_CONSTRUCTION','GEOMETRY_COMPATIBILITY','DIRECTION_COMPATIBILITY','CURL_SELECTION','TECHNIQUE_COMPATIBILITY','DENSITY','DIAMETER','VOLUME','NEGATIVE_SPACE_ARCHITECTURE','ANIME_KIM_K_BOUNDARY','ANIME_WISPY_BOUNDARY','ANIME_JELLYFISH_BOUNDARY','REGIONAL_OR_SCHOOL_TERMINOLOGY'])assert.ok(professional.unresolved.includes(item),item);
});

test('protected professional definitions remain byte-identical after populating Anime',()=>{
  const expected={
    'geometry.natural':'805e701d0fc611c6bcaa946b23f36d6d428422026ae31f6800a286b8f280fcd9',
    'geometry.doll':'ff527430e297a4ebcc7f4a8f7820a2ca9623bc2f5f69c873d09c903c900cd64d',
    'geometry.squirrel':'983946b9933f5ae275801fd7b2bdc7d470c31bca010bdce458070f18bdbfe1d6',
    'geometry.cat':'fc9b21fc83afbf00ebb0e41a225a7f5eef06782db3d60b2216be7322b8ee7d58',
    'geometry.fox':'7cf9298a0331e08843127c74fc4f8f38b9ef5742e6e5a7e3bb13cd7d0a2811c7',
    'direction.cat':'973a81cae098b780ec590bfe08ab3eaa2478a28a8aec66ab1efc5584c48ff0d9',
    'direction.fox':'13ab577bd4a7e9332151e11ad16675ac70525cd3edde82bac0acfb1eeea6a8ed',
    'technique.classic-one-to-one':'09eeff8937f5a5b83d14ac7e8c450f3f2a4be98851fdd4d632d9d0cf76189081',
    'preset.eyeliner':'76bab61bfd6e66fa794504749c3e505a569f199451a6e9284674d0300bc8bd9a',
    'construction.wet':'186c0b1b4be3b898940411982a0e792d35156d10cf639d5b72a75153be9451ff',
    'construction.angel':'ba6f01a6e7745f4fb17c29af90d5c38e3870da0cb0aef5af9787196c3bbc7dae',
    'construction.wispy':'a4774d2b3aa8cb07214398b29fb571832b5a218d0ed421385fb08c62ef446e86',
    'construction.kim-k':'d81681ffe6eb8c6febed05d4d1a3b5ab0ae01d8dd55ebc1af8209bc75da4d5b3',
    'construction.jellyfish':'06319851f2cd44d040449e147cbe597a42d4688f8f44f9969016c411519fb089',
  };
  for(const [id,hash] of Object.entries(expected))assert.strictEqual(digest(JSON.stringify(Library.getDefinition(id))),hash,id);
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.strictEqual(digest(JSON.stringify(ray)),'3e23c055de03aa7c238df7182c808983475d5d46e89062743d06066caa48aefb');
});

test('production is untouched: activation stays inactive and all 21 legacy IDs and consumers remain byte-identical',()=>{
  assert.strictEqual(digest(indexSource),'51a6c0871b4113ac5a133381690eaa7b376ea9bbf5b301a8af0fb08104347f39');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  const start=indexSource.indexOf('    const DESIGN_CATALOG = '),end=indexSource.indexOf('\n\n    function calculateEyeLashMap(',start),catalogSource=indexSource.slice(start,end),catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  assert.ok(indexSource.includes("{ id:'manga', category:'creative', ruName:'Manga / Anime', enName:'Manga / Anime', aliases:['Doll Anime','Spiky Anime'],"));
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});
