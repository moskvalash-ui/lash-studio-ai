const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function debugIrisNumericDistribution(');
const end = src.indexOf('\n    const EYE_METRIC_KEYS =', start);
assert.ok(start >= 0 && end > start, 'native-vs-resized debug helpers not found');

function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0;const l=(max+min)/2;if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return{h,s,l};}
const api = new Function('rgbToHsl', src.slice(start,end) + '\nreturn {debugBuildIrisNativeMapping,debugBuildPairedIrisStats};')(rgbToHsl);

let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log(`  ok  - ${name}`);}catch(e){fail++;console.log(`FAIL  - ${name}\n        ${e.message}`);}}

const left=[{x:600,y:300},{x:620,y:290}],right=[{x:300,y:300},{x:320,y:290}];
const leftAudit={roi:{cx:610,cy:295,centerContrast:40}},rightAudit={roi:{cx:310,cy:295,centerContrast:42}};

test('900px analysis coordinates map exactly back to native coordinates',()=>{
  const m=api.debugBuildIrisNativeMapping(3600,2400,900,600,left,right,leftAudit,rightAudit);
  assert.strictEqual(m.image.scaleX,.25);assert.strictEqual(m.image.scaleY,.25);
  assert.deepStrictEqual(m.left.eyePoints,[{x:2400,y:1200},{x:2480,y:1160}]);
  assert.deepStrictEqual(m.left.center,{x:2440,y:1180,method:'mapped_analysis_center',contrast:40});
  assert.strictEqual(m.image.aspectRatioPreserved,true);
});

test('rounded canvas dimensions expose scaleX/scaleY and aspect error honestly',()=>{
  const m=api.debugBuildIrisNativeMapping(4032,3024,900,675,left,right,leftAudit,rightAudit);
  assert.strictEqual(m.image.scaleX,900/4032);assert.strictEqual(m.image.scaleY,675/3024);
  assert.strictEqual(m.image.aspectRatioPreserved,true);
});

test('LEFT and RIGHT mappings remain independent and are never swapped',()=>{
  const m=api.debugBuildIrisNativeMapping(3600,2400,900,600,left,right,leftAudit,rightAudit);
  assert.strictEqual(m.left.center.x,2440);assert.strictEqual(m.right.center.x,1240);
  assert.ok(m.left.center.x>m.right.center.x);
});

test('mapping has no mirror/facing-mode input or coordinate reflection',()=>{
  const block=src.slice(src.indexOf('    function debugBuildIrisNativeMapping('),src.indexOf('\n    function debugBuildPairedIrisStats('));
  assert.ok(!/mirror|facingMode|videoWidth|naturalWidth\s*-/.test(block));
});

test('paired audit measures real native blue evidence lost in a neutral resized pixel',()=>{
  const nativeCtx={getImageData(){return{data:new Uint8ClampedArray([90,140,190,255])};}};
  const paired=api.debugBuildPairedIrisStats(nativeCtx,[{x:100,y:50,r:120,g:121,b:120}],.25,.25,3600,2400);
  assert.strictEqual(paired.pairCount,1);
  assert.strictEqual(paired.nativeBlueEvidenceFraction,1);
  assert.strictEqual(paired.nativeBlueEvidenceRetainedFraction,0);
  assert.ok(paired.meanChromaLoss>0);
});

test('Photo native audit is debug-gated and cannot replace production iris values',()=>{
  const photo=src.slice(src.indexOf('    function PhotoAnalysisScreen('),src.indexOf('\n    function ReviewScreen('));
  const gate=photo.indexOf('if (isDebugModeEnabled()) {'),native=photo.indexOf('debugBuildIrisNativeMapping('),complete=photo.indexOf('onComplete(photoRec)');
  assert.ok(gate>=0&&native>gate&&complete>native);
  assert.ok(photo.includes('const leftIris = sampleIrisColor(ctx, leftEye), rightIris = sampleIrisColor(ctx, rightEye);'));
  assert.ok(photo.includes('const iris = combineIris(leftIris, rightIris);'));
  assert.ok(!/leftIris\s*=\s*native|rightIris\s*=\s*native|iris\s*=\s*native/.test(photo));
});

console.log(`\n${pass} passed, ${fail} failed`);if(fail)process.exit(1);
