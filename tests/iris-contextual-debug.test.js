const assert=require('assert');
const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=src.indexOf('    function rgbToHsl('),end=src.indexOf('\n    // ------------------------------------------------------------\n    // NEW THIS TURN',start);
assert.ok(start>=0&&end>start,'contextual debug helper span not found');
const api=new Function(src.slice(start,end)+'\nreturn {classifyIrisColor,debugExtractIrisScleraReference,debugBuildIrisContextFeatures};')();

let pass=0,fail=0;function test(name,fn){try{fn();pass++;console.log(`  ok  - ${name}`)}catch(e){fail++;console.log(`FAIL  - ${name}\n        ${e.message}`)}}
const EYE=[{x:8,y:20},{x:18,y:13},{x:42,y:13},{x:52,y:20},{x:42,y:27},{x:18,y:27}];
const ROI={cx:30,cy:20,radius:6,eyeW:44,eyeH:14,centerMethod:'dark_pupil',centerContrast:40};
function ctx(fill){return{getImageData(x0,y0,w,h){const d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,b]=fill(x0+x,y0+y);const i=(y*w+x)*4;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255}return{data:d}}}}
function scene(ref=[190,175,168],opts={}){return ctx((x,y)=>{
  if(opts.catchlight&&x===15&&y===20)return[255,255,255];
  if(opts.reflection&&Math.hypot(x-30,y-20)<2)return[245,245,245];
  if(opts.failLeft&&x<30)return[170,105,75];
  return ref;
})}
function audit(){return{roi:ROI}}
function iris(rgb,name,confidence=.6){return{rgb,name,confidence}}
function features(c,lrgb,rrgb){return api.debugBuildIrisContextFeatures(c,EYE,EYE,audit(),audit(),iris(lrgb,api.classifyIrisColor(...lrgb)),iris(rrgb,api.classifyIrisColor(...rrgb)))}

test('male real-case RGBs keep absolute gray while both eyes show coherent relative-cool direction',()=>{
  const f=features(scene(),[143,138,138],[145,139,137]);
  assert.strictEqual(f.left.iris.absoluteCategory,'gray');assert.strictEqual(f.right.iris.absoluteCategory,'gray');
  assert.ok(f.left.contextualCoolDirection&&f.right.contextualCoolDirection);assert.ok(f.combined.bilateralContextualEvidence);
});
test('female real-case categories remain unchanged; RIGHT retains contextual cool evidence',()=>{
  const f=features(scene(),[82,65,63],[70,52,51]);
  assert.strictEqual(f.left.iris.absoluteCategory,'uncertain');assert.strictEqual(f.right.iris.absoluteCategory,'brown');assert.ok(f.right.contextualCoolDirection);
});
test('female LEFT-like bad center/reference geometry is reflected as invalid low quality and fails closed',()=>{
  const c=scene([190,175,168],{failLeft:true});const f=features(c,[82,65,63],[70,52,51]);
  assert.ok(!f.left.reference.valid||f.left.reference.quality<.4);assert.strictEqual(f.combined.bilateralContextualEvidence,false);
});
test('landmark-midpoint center fallback is exposed as low reference quality',()=>{const r=api.debugExtractIrisScleraReference(scene(),EYE,{...ROI,centerMethod:'landmark_midpoint',centerContrast:0},'left');assert.strictEqual(r.centerQuality,.35);assert.ok(r.quality<.4)});
test('pupil-core reflection is excluded from contextual reference',()=>{
  const r=api.debugExtractIrisScleraReference(scene([190,175,168],{reflection:true}),EYE,ROI,'left');
  assert.ok(r.rejected.irisOrPupil>0);assert.deepStrictEqual(r.medianRgb,{r:190,g:175,b:168});
});
test('catchlight in a lateral sclera candidate is rejected',()=>{const r=api.debugExtractIrisScleraReference(scene([190,175,168],{catchlight:true}),EYE,ROI,'left');assert.ok(r.rejected.highlight>0)});
test('skin/eyelid leakage invalidates or lowers the anatomical reference',()=>{const r=api.debugExtractIrisScleraReference(scene([170,105,75]),EYE,ROI,'left');assert.ok(!r.valid||r.quality<.4);assert.ok(r.rejected.skinOrEyelid+r.rejected.vessel>0)});
test('unilateral reference failure fails closed',()=>{const f=features(scene([190,175,168],{failLeft:true}),[143,138,138],[145,139,137]);assert.strictEqual(f.combined.bilateralContextualEvidence,false)});
test('bilateral relative-direction disagreement fails closed',()=>{const f=features(scene(),[143,138,138],[200,120,80]);assert.strictEqual(f.combined.bilateralContextualEvidence,false)});
test('brown, hazel, green, and strong absolute blue remain unchanged and activation stays blocked',()=>{
  for(const rgb of [[100,65,45],[150,110,60],[90,140,100],[90,120,160]]){const expected=api.classifyIrisColor(...rgb),f=features(scene(),rgb,rgb);assert.strictEqual(f.left.iris.absoluteCategory,expected);assert.strictEqual(api.classifyIrisColor(...rgb),expected);assert.strictEqual(f.left.productionActivationBlocked,true);assert.strictEqual(f.combined.productionActivationBlocked,true)}
});
test('schema contains all required per-eye and bilateral metrics',()=>{const f=features(scene(),[143,138,138],[145,139,137]);assert.strictEqual(f.contextualSchemaVersion,1);for(const k of ['deltaL','deltaA','deltaB','deltaE','logBRContrast','logGRContrast','rawBRDelta','rawBGDelta','relativeChromaChange','relativeSaturationChange'])assert.ok(k in f.left.relative);for(const k of ['leftRightRelativeFeatureDistance','deltaASignAgreement','deltaBSignAgreement','brContrastAgreement','referenceQualityAgreement','bilateralContextualEvidence'])assert.ok(k in f.combined)});
test('source isolation: production classifiers never reference contextual helpers',()=>{for(const fn of ['classifyIrisColor','combineIris']){const s=src.indexOf(`    function ${fn}(`),e=src.indexOf('\n    }',s)+6;assert.ok(!/Context|Sclera|Oklab/.test(src.slice(s,e)))}});
test('contextual payload is wired only beneath existing debug gates and COPY export payload',()=>{assert.ok(src.includes('contextual:debugBuildIrisContextFeatures('));assert.ok(src.includes('contextual: debugIrisAuditRef.current.contextual'));assert.ok(src.includes('buildCreaseV2CopyPayload(data, compare, latestFrameTrace, irisAudit)'))});

console.log(`\n${pass} passed, ${fail} failed`);if(fail)process.exit(1);
