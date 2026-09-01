const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Domain = require('../lash-design-domain.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const catalogSource = src.slice(catalogStart, catalogEnd);
const DESIGN_CATALOG = new Function('const clampScore=n=>Math.max(0,Math.min(100,Math.round(n)));\n' + catalogSource + '\nreturn DESIGN_CATALOG;')();
const mapStart = src.indexOf('    function calculateEyeLashMap(');
const mapEnd = src.indexOf('    const CLIENT_LASH_DESIGN_REGISTRY', mapStart);
const mapSource = src.slice(mapStart, mapEnd);
const { buildEyeZones } = new Function(`
const clamp01=n=>Math.max(0,Math.min(1,n));
const mirrorReflectDeg=deg=>{let d=180-deg;while(d>180)d-=360;while(d<=-180)d+=360;return d;};
${mapSource}
return {buildEyeZones};
`)();
const helperStart = src.indexOf('    const ZONE_NAMES = ');
const helperEnd = src.indexOf('\n    const CATEGORY_LABELS =', helperStart);
const helpersSource = src.slice(helperStart, helperEnd);
const helpers = new Function(helpersSource + '\nreturn {expandLashMapSectors,buildProfessionalEyeProjection,buildProfessionalPhotoLine,buildProfessionalPhotoCrop,selectProfessionalEyeLabels,createManualPhotoAdjustment,applyManualPhotoAdjustment};')();
const { expandLashMapSectors, buildProfessionalEyeProjection, buildProfessionalPhotoLine, buildProfessionalPhotoCrop, selectProfessionalEyeLabels, createManualPhotoAdjustment, applyManualPhotoAdjustment } = helpers;

const profile = {
  leftEye:{width:42,height:15,ear:.24,innerTaperDeg:62,outerTaperDeg:68,tiltCorrected:-2},
  rightEye:{width:39,height:14,ear:.21,innerTaperDeg:66,outerTaperDeg:73,tiltCorrected:-178},
  perEyeTiltDegrees:{left:-2,right:-2},relativeEyeSize:.34,isCloseSet:false,isWideSet:false,
  isHooded:false,hoodedConfidence:.7,hoodingLevel:'none',tiltTendency:'neutral',tiltConfidence:.75,
  tiltDegrees:0,compositeAsymmetry:.09,overallConfidence:.72,spacingConfidence:.7,
  shapeTendencies:{round:.2,almond:.6,elongated:.2},
  asymmetryBreakdown:{width:.07,height:.06,openness:.12,tilt:0,hooding:.03,vertical:.01},
};
const eyes = {
  left:[{x:100,y:100},{x:126,y:84},{x:158,y:82},{x:190,y:101},{x:158,y:112},{x:126,y:113}],
  right:[{x:390,y:100},{x:364,y:84},{x:332,y:82},{x:300,y:101},{x:332,y:112},{x:364,y:113}],
};
const curveFor = entry => ({zonePositions:entry.zonePositions||null,postPeakShape:entry.postPeakShape||'linear',plateauShape:entry.plateauShape||'linear'});
function legacyDesign(entry) {
  const maps=buildEyeZones(entry,profile),curve=curveFor(entry);
  return {id:entry.id,category:entry.category,name:entry.enName,ruName:entry.ruName,enName:entry.enName,aliases:entry.aliases,
    score:entry.score(profile),whyItWorks:entry.why(profile,'en'),correctionGoal:entry.goal(profile,'en'),limitations:entry.cautions(profile,'en'),
    baseCurl:entry.baseCurl,curlOptions:entry.curlOptions,defaultTechnique:entry.defaultTechnique,
    peakZone:maps.leftPeakZone===maps.rightPeakZone?maps.leftPeakZone:entry.peakZone,leftPeakZone:maps.leftPeakZone,rightPeakZone:maps.rightPeakZone,
    leftCorrectionMm:maps.leftCorrectionMm,rightCorrectionMm:maps.rightCorrectionMm,texture:entry.texture||null,curve,leftZones:maps.left,rightZones:maps.right,
    curlRec:{primary:entry.baseCurl,alternatives:entry.curlOptions.filter(value=>value!==entry.baseCurl),reason:'legacy'}};
}
function structural(eye, props) {
  const projection=buildProfessionalEyeProjection(eye,props.items,500,250);
  const automatic=buildProfessionalPhotoLine(eye,projection.points);
  const crop=buildProfessionalPhotoCrop(eye,automatic.points,500,250);
  const peak=projection.points.find(point=>point.isPeak);
  const working=applyManualPhotoAdjustment(eye,projection.points,props.adjustment,peak?.t);
  return {projection,automatic,crop,working,labels:selectProfessionalEyeLabels(working.points,crop)};
}

test('PHOTO canonical props and structural geometry equal legacy inputs for all 21 IDs and both physical eyes',()=>{
  assert.strictEqual(DESIGN_CATALOG.length,21);
  for(const entry of DESIGN_CATALOG){
    const design=legacyDesign(entry),adjustment={left:createManualPhotoAdjustment(),right:{...createManualPhotoAdjustment(),translationX:2.25,translationY:-1.5}};
    const base=Domain.legacyToClientLashDesign({design,catalogEntry:entry,eyeProfile:profile,expandSectors:expandLashMapSectors});
    const physicalEyes=Object.fromEntries(['left','right'].map(side=>{const zones=design[`${side}Zones`],peakZone=design[`${side}PeakZone`];return [side,{finalMm:zones,peakZone,derivedSectors:expandLashMapSectors(zones,peakZone,design.curve)}];}));
    const canonical=Domain.withPhotoRuntime(base,{activeSide:'right',topology:design.curve,physicalEyes,manualAdjustment:adjustment,technique:design.defaultTechnique,curl:design.curlRec.primary,textureDescriptor:design.texture});
    for(const side of ['left','right']){
      const legacy={side,zones:design[`${side}Zones`],peakIdx:design[`${side}PeakZone`],items:physicalEyes[side].derivedSectors,curve:design.curve,
        design:{name:design.name,curlRec:{alternatives:design.curlRec.alternatives}},curl:design.curlRec.primary,technique:design.defaultTechnique,texture:design.texture,adjustment:adjustment[side]};
      const props=Domain.photoPropsFromClientDesign(canonical,side);
      assert.deepStrictEqual(props,legacy,`${entry.id}/${side}/renderer props`);
      assert.deepStrictEqual(structural(eyes[side],props),structural(eyes[side],legacy),`${entry.id}/${side}/projection line crop labels`);
      assert.strictEqual(props.items[0].t,0); assert.strictEqual(props.items[0].label,'INNER');
      assert.strictEqual(props.items.at(-1).t,1); assert.strictEqual(props.items.at(-1).label,'OUTER');
      assert.deepStrictEqual(props.items.map(item=>item.t),legacy.items.map(item=>item.t),'canonical migration must not reverse samples');
    }
    assert.deepStrictEqual(base.presentation.photo.manualAdjustment,null,'base domain remains free of PHOTO presentation state');
    assert.deepStrictEqual(canonical.mapping.physicalEyes.left.finalMm,design.leftZones);
    assert.ok(!('manualAdjustment' in canonical.mapping.physicalEyes.left));
  }
});

test('Custom runtime maps, peaks, topology, and manual presentation state pass through without domain writes',()=>{
  const entry=DESIGN_CATALOG.find(item=>item.id==='fox'),design=legacyDesign(entry),left=[5,7,12,9,8],right=[6,8,9,13,10];
  const adjustment={left:{...createManualPhotoAdjustment(),innerDelta:{x:1,y:-2}},right:{...createManualPhotoAdjustment(),outerDelta:{x:-3,y:2}}};
  const physicalEyes={left:{finalMm:left,peakZone:2,derivedSectors:expandLashMapSectors(left,2,design.curve)},right:{finalMm:right,peakZone:3,derivedSectors:expandLashMapSectors(right,3,design.curve)}};
  const base=Domain.legacyToClientLashDesign({design,catalogEntry:entry,eyeProfile:profile,expandSectors:expandLashMapSectors});
  const runtime=Domain.withPhotoRuntime(base,{activeSide:'left',topology:design.curve,physicalEyes,manualAdjustment:adjustment,technique:'Custom',curl:'CC',textureDescriptor:null});
  assert.deepStrictEqual(Domain.photoPropsFromClientDesign(runtime,'left').zones,left);
  assert.deepStrictEqual(Domain.photoPropsFromClientDesign(runtime,'right').zones,right);
  assert.strictEqual(Domain.photoPropsFromClientDesign(runtime,'left').peakIdx,2);
  assert.strictEqual(Domain.photoPropsFromClientDesign(runtime,'right').peakIdx,3);
  assert.deepStrictEqual(runtime.presentation.photo.manualAdjustment,adjustment);
  assert.ok(!('manualAdjustment' in runtime.mapping.physicalEyes.left));
});

test('PHOTO anatomical and mirror contract is explicit at the canonical wrapper and SVG boundary',()=>{
  const legacyRenderer=src.slice(src.indexOf('    function LegacyProfessionalEyeMap('),src.indexOf('\n    // Phase 2C consumer boundary:'));
  assert.ok(legacyRenderer.includes('getPhysicalEyeLandmarks(result.landmarks,side).eye'));
  assert.ok(legacyRenderer.includes('href={result.originalImage}'));
  assert.ok(!/scaleX\s*\(\s*-1|rotateY\s*\(\s*180|<svg[^>]+transform=|transform[^\n]*mirror/i.test(legacyRenderer));
  for(const side of ['left','right']){
    const sectors=expandLashMapSectors([6,7,9,12,10],3,curveFor(DESIGN_CATALOG[0]));
    const projection=buildProfessionalEyeProjection(eyes[side],sectors,500,250);
    assert.deepStrictEqual({x:projection.points[0].x,y:projection.points[0].y},eyes[side][0]);
    assert.deepStrictEqual({x:projection.points.at(-1).x,y:projection.points.at(-1).y},eyes[side][3]);
  }
  assert.ok(eyes.left[0].x<eyes.left[3].x&&eyes.right[0].x>eyes.right[3].x,'RIGHT retains anatomical order without matching LEFT image direction');
});

test('Phase 2C isolation guards keep forbidden consumers and professional sources unchanged',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'196a163932c70e131a7f5d8a0c5b919d052503b1960031d0588da645942478cf','DESIGN_CATALOG changed');
  assert.strictEqual(digest(mapSource),'e379b5c73bb835d3eb8d846ef6fac714ecb7d7c539249ae10b50771c05095ab1','calculateEyeLashMap/buildEyeZones changed');
  assert.ok(src.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(src.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  const naturalStart=src.indexOf('    function NaturalLashScanScreen('),naturalEnd=src.indexOf('\n    function ',naturalStart+20);
  assert.ok(!src.slice(naturalStart,naturalEnd).includes('photoClientDesign'));
  assert.strictEqual((src.match(/withPhotoRuntime\(/g)||[]).length,1,'only PHOTO screen may create PHOTO runtime');
});
