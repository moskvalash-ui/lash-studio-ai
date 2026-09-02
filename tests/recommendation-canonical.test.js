const test=require('node:test');
const assert=require('node:assert');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const Domain=require('../lash-design-domain.js');

const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const catalogStart=src.indexOf('    const DESIGN_CATALOG = '),catalogEnd=src.indexOf('\n\n    function calculateEyeLashMap(',catalogStart),catalogSource=src.slice(catalogStart,catalogEnd);
const DESIGN_CATALOG=new Function('const clampScore=n=>Math.max(0,Math.min(100,Math.round(n)));\n'+catalogSource+'\nreturn DESIGN_CATALOG;')();
const mapStart=src.indexOf('    function calculateEyeLashMap('),mapEnd=src.indexOf('    const CLIENT_LASH_DESIGN_REGISTRY',mapStart),mapSource=src.slice(mapStart,mapEnd);
const {buildEyeZones}=new Function(`const clamp01=n=>Math.max(0,Math.min(1,n));const mirrorReflectDeg=deg=>{let d=180-deg;while(d>180)d-=360;while(d<=-180)d+=360;return d;};${mapSource};return {buildEyeZones};`)();
const sectorStart=src.indexOf('    const ZONE_NAMES = '),sectorEnd=src.indexOf('\n    const CATEGORY_LABELS =',sectorStart);
const {expandLashMapSectors}=new Function(src.slice(sectorStart,sectorEnd)+'\nreturn {expandLashMapSectors};')();
const curlStart=src.indexOf('    const CURL_CATALOG = '),curlEnd=src.indexOf('\n\n    // ------------------------------------------------------------\n    // TECHNIQUE CATALOG',curlStart);
const {recommendCurl}=new Function(src.slice(curlStart,curlEnd)+'\nreturn {recommendCurl};')();

const baseProfile={leftEye:{width:42,height:15,ear:.24,innerTaperDeg:62,outerTaperDeg:68,tiltCorrected:-2},rightEye:{width:39,height:14,ear:.21,innerTaperDeg:66,outerTaperDeg:73,tiltCorrected:-178},perEyeTiltDegrees:{left:-2,right:-2},relativeEyeSize:.34,isCloseSet:false,isWideSet:false,isHooded:false,hoodedConfidence:.7,hoodingLevel:'none',tiltTendency:'neutral',tiltConfidence:.75,tiltDegrees:0,compositeAsymmetry:.09,overallConfidence:.72,spacingConfidence:.7,shapeTendencies:{round:.2,almond:.6,elongated:.2},asymmetryBreakdown:{width:.07,height:.06,openness:.12,tilt:0,hooding:.03,vertical:.01}};
const profiles=[
  baseProfile,
  {...baseProfile,isHooded:true,hoodingLevel:'full',tiltTendency:'downturned',tiltDegrees:-7,relativeEyeSize:.29,isCloseSet:true,shapeTendencies:{round:.65,almond:.25,elongated:.1}},
  {...baseProfile,isWideSet:true,tiltTendency:'upturned',tiltDegrees:8,relativeEyeSize:.4,compositeAsymmetry:.02,shapeTendencies:{round:.1,almond:.3,elongated:.6}},
];
const curveFor=entry=>({zonePositions:entry.zonePositions||null,postPeakShape:entry.postPeakShape||'linear',plateauShape:entry.plateauShape||'linear'});
function legacy(entry,profile,lang){const maps=buildEyeZones(entry,profile),curlRec=recommendCurl(profile,entry,lang);return{id:entry.id,category:entry.category,name:lang==='en'?entry.enName:entry.ruName,ruName:entry.ruName,enName:entry.enName,aliases:entry.aliases,score:entry.score(profile),whyItWorks:entry.why(profile,lang),correctionGoal:entry.goal(profile,lang),limitations:entry.cautions(profile,lang),baseCurl:entry.baseCurl,curlOptions:entry.curlOptions,defaultTechnique:entry.defaultTechnique,peakZone:maps.leftPeakZone===maps.rightPeakZone?maps.leftPeakZone:entry.peakZone,leftPeakZone:maps.leftPeakZone,rightPeakZone:maps.rightPeakZone,leftCorrectionMm:maps.leftCorrectionMm,rightCorrectionMm:maps.rightCorrectionMm,texture:entry.texture||null,curve:curveFor(entry),leftZones:maps.left,rightZones:maps.right,curlRec};}
function canonicalProps(design,entry,profile,rank){const base=Domain.legacyToClientLashDesign({design,catalogEntry:entry,eyeProfile:profile,expandSectors:expandLashMapSectors,rank});const runtime=Domain.withRecommendationRuntime(base,{rank,localizedLegacy:design});return Domain.recommendationPropsFromClientDesign(runtime);}
const plain=props=>{const {clientDesign,...values}=props;return values;};

test('all 21 IDs preserve exact Recommendation output in RU and EN across representative profiles',()=>{
  assert.strictEqual(DESIGN_CATALOG.length,21);
  for(const profile of profiles)for(const lang of ['ru','en'])for(const [rank,entry] of DESIGN_CATALOG.entries()){
    const design=legacy(entry,profile,lang),props=canonicalProps(design,entry,profile,rank);
    assert.deepStrictEqual(plain(props),{...design,rank},`${entry.id}/${lang}/profile${profiles.indexOf(profile)}`);
    assert.strictEqual(props.clientDesign.legacyDesignId,design.id);
    assert.deepStrictEqual(props.leftZones,design.leftZones);assert.deepStrictEqual(props.rightZones,design.rightZones);
    assert.deepStrictEqual(props.curlRec,design.curlRec);assert.deepStrictEqual(props.aliases,design.aliases);
  }
});

test('canonical output preserves full ranking, ranks, top six, primary, and tie behavior',()=>{
  for(const profile of profiles)for(const lang of ['ru','en']){
    const ranked=DESIGN_CATALOG.map(entry=>legacy(entry,profile,lang)).sort((a,b)=>b.score-a.score);
    const canonical=ranked.map((design,rank)=>canonicalProps(design,DESIGN_CATALOG.find(entry=>entry.id===design.id),profile,rank));
    assert.deepStrictEqual(canonical.map(item=>item.id),ranked.map(item=>item.id));
    assert.deepStrictEqual(canonical.map(item=>item.score),ranked.map(item=>item.score));
    assert.deepStrictEqual(canonical.map(item=>item.rank),ranked.map((_,rank)=>rank));
    assert.deepStrictEqual(canonical.slice(0,6).map(item=>item.id),ranked.slice(0,6).map(item=>item.id));
    assert.strictEqual(canonical[0].id,ranked[0].id);
  }
});

test('selected canonical recommendation hands the identical legacy ID and Lash Map fields forward',()=>{
  const profile=profiles[1],entry=DESIGN_CATALOG.find(item=>item.id==='softfox'),design=legacy(entry,profile,'ru'),selected=canonicalProps(design,entry,profile,4);
  assert.strictEqual(selected.clientDesign.legacyDesignId,design.id);
  assert.deepStrictEqual(plain(Domain.recommendationPropsFromClientDesign(selected.clientDesign)),{...design,rank:4});
  assert.ok(src.includes('onViewMap(d.clientDesign)'));
  assert.ok(src.includes('onSelect(d.clientDesign)'));
  assert.ok(src.includes('design={LashDesignDomain.recommendationPropsFromClientDesign(activeDesign)}'));
});

test('Phase 2D isolation guards protect ranking and forbidden consumers',()=>{
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(digest(catalogSource),'15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
  assert.strictEqual(digest(mapSource),'b14f739d8b3854dd4dd57bb1eeaceae159c6c939259bf277906b9cb932aba6eb');
  assert.ok(src.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'));
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(src.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(src.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(src.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  const naturalStart=src.indexOf('    function NaturalLashScanScreen('),naturalEnd=src.indexOf('\n    function ',naturalStart+20);
  assert.ok(!src.slice(naturalStart,naturalEnd).includes('canonicalRecommendationProps'));
  assert.strictEqual((src.match(/canonicalRecommendationProps\(/g)||[]).length,4);
});
