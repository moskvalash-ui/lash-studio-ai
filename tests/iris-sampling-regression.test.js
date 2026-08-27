const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function estimateIrisCenter(');
const end = src.indexOf('\n    const EYE_METRIC_KEYS =', start);
const rgbToHex = "const rgbToHex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');";
const api = new Function(rgbToHex + '\n' + src.slice(start,end) + '\nreturn {analyzeIrisSample,sampleIrisColor,classifyIrisColor,combineIris,hasPupilEnclosure,isInsideIrisCenterSearch};')();
const { analyzeIrisSample, sampleIrisColor, classifyIrisColor, combineIris, hasPupilEnclosure, isInsideIrisCenterSearch } = api;
const REAL_ENCLOSURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'real-capture-2026-08-27-pupil-enclosure.json'), 'utf8'));
const POST_FIX_SEARCH = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'real-capture-post-c89cfbf-pupil-search.json'), 'utf8'));

let pass=0, fail=0;
function test(name,fn){try{fn();pass++;console.log(`  ok  - ${name}`);}catch(e){fail++;console.log(`FAIL  - ${name}\n        ${e.message}`);}}

const EYE=[{x:20,y:50},{x:35,y:38},{x:65,y:38},{x:80,y:50},{x:65,y:62},{x:35,y:62}];
function ctxFor(base,{sclera=false,pupil=false,specular=false,lidShadow=false,quadrants=null}={}){
  return {getImageData(x0,y0,w,h){
    const data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=x0+x,py=y0+y,dx=px-50,dy=py-50,rad=Math.sqrt(dx*dx+dy*dy);
      let rgb=quadrants ? quadrants[(dy>=0?2:0)+(dx>=0?1:0)] : base;
      if(sclera&&rad>11) rgb=[232,232,230];
      if(lidShadow&&Math.abs(dy)>8) rgb=[62,48,44];
      if(pupil&&rad<4) rgb=[10,10,10];
      if(specular&&dx>=3&&dx<=6&&dy>=-5&&dy<=-2) rgb=[250,250,250];
      const i=(y*w+x)*4; data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
    }
    return {data};
  }};
}

function offCenterBlueCtx(){
  return {getImageData(x0,y0,w,h){
    const data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=x0+x,py=y0+y,d=Math.hypot(px-62,py-50);
      let rgb=d<=12?[120,165,205]:[103,98,94];
      if(d<=3)rgb=[12,12,12];
      const i=(y*w+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
    }
    return {data};
  }};
}

for(const [label,rgb,expected] of [
  ['clear blue',[95,145,195],'blue'],
  ['pale blue',[185,202,218],'blue'],
  ['clear gray',[150,154,158],'gray'],
  ['brown',[80,45,30],'brown'],
  ['hazel',[132,105,58],'hazel'],
  ['green',[75,125,78],'green'],
]) test(`${label} iris -> ${expected}`,()=>assert.strictEqual(sampleIrisColor(ctxFor(rgb),EYE).name,expected));

test('sclera contamination does not replace blue iris pixels',()=>{
  const r=sampleIrisColor(ctxFor([95,145,195],{sclera:true}),EYE);
  assert.strictEqual(r.name,'blue'); assert.ok(r.confidence>0.7,`confidence=${r.confidence}`);
});
test('central pupil and dark pixels do not replace blue iris pixels',()=>{
  const r=sampleIrisColor(ctxFor([95,145,195],{pupil:true,lidShadow:true}),EYE);
  assert.strictEqual(r.name,'blue'); assert.ok(r.confidence>0.7,`confidence=${r.confidence}`);
});
test('specular catchlights do not turn blue uncertain',()=>{
  const a=analyzeIrisSample(ctxFor([185,202,218],{specular:true}),EYE);
  assert.strictEqual(a.name,'blue'); assert.ok(a.rejected.some(p=>p.reason==='bright_specular'));
});
test('off-center gaze relocates ROI from warm eyelid/skin pixels to the dark pupil and blue iris',()=>{
  const a=analyzeIrisSample(offCenterBlueCtx(),EYE);
  assert.strictEqual(a.roi.centerMethod,'dark_pupil');
  assert.ok(Math.abs(a.roi.cx-62)<=2,`cx=${a.roi.cx}`);
  assert.deepStrictEqual(a.rgb,[120,165,205]);
  assert.strictEqual(a.name,'blue');
  assert.ok(a.confidence>0.7,`confidence=${a.confidence}`);
});
test('real-capture pupil enclosure accepts the left pupil and rejects the right lash/eyelid edge',()=>{
  assert.strictEqual(hasPupilEnclosure(REAL_ENCLOSURE.left.centerMean,REAL_ENCLOSURE.left.ringLuma), true);
  assert.strictEqual(hasPupilEnclosure(REAL_ENCLOSURE.right.centerMean,REAL_ENCLOSURE.right.ringLuma), false);
  assert.strictEqual(hasPupilEnclosure(REAL_ENCLOSURE.left.centerMean,REAL_ENCLOSURE.left.ringLuma), REAL_ENCLOSURE.left.expectedEnclosed);
  assert.strictEqual(hasPupilEnclosure(REAL_ENCLOSURE.right.centerMean,REAL_ENCLOSURE.right.ringLuma), REAL_ENCLOSURE.right.expectedEnclosed);
});

test('an elongated dark lash edge cannot relocate the iris ROI',()=>{
  const ctx={getImageData(x0,y0,w,h){
    const data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=x0+x,py=y0+y;
      let rgb=[120,165,205];
      if(Math.abs(py-46-(px-50)*0.35)<3)rgb=[12,12,12];
      const i=(y*w+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=255;
    }
    return {data};
  }};
  const a=analyzeIrisSample(ctx,EYE);
  assert.strictEqual(a.roi.centerMethod,'landmark_midpoint');
  assert.strictEqual(a.roi.cx,50);
  assert.strictEqual(a.roi.cy,50);
});
test('post-c89cfbf real false-positive cluster is outside the anatomical eye-search ellipse',()=>{
  const center={x:POST_FIX_SEARCH.landmarkCenter[0],y:POST_FIX_SEARCH.landmarkCenter[1]};
  const left=POST_FIX_SEARCH.leftControl;
  assert.strictEqual(isInsideIrisCenterSearch(left.detectedCenter[0],left.detectedCenter[1],{x:left.landmarkCenter[0],y:left.landmarkCenter[1]},left.eyeW,left.eyeH),true,'real LEFT pupil control must remain eligible');
  assert.strictEqual(POST_FIX_SEARCH.oldEnclosure.brighterRingSamples/POST_FIX_SEARCH.oldEnclosure.ringSamples,5/6);
  for(const [x,y] of POST_FIX_SEARCH.enclosedFalseCenters){
    assert.strictEqual(isInsideIrisCenterSearch(x,y,center,POST_FIX_SEARCH.eyeW,POST_FIX_SEARCH.eyeH),false,`${x},${y} must be outside`);
  }
});

test('anatomical ellipse preserves a genuine horizontally off-center pupil',()=>{
  assert.strictEqual(isInsideIrisCenterSearch(62,50,{x:50,y:50},60,24),true);
  const a=analyzeIrisSample(offCenterBlueCtx(),EYE);
  assert.strictEqual(a.roi.centerMethod,'dark_pupil');
  assert.ok(Math.abs(a.roi.cx-62)<=2,`cx=${a.roi.cx}`);
  assert.strictEqual(a.name,'blue');
});
test('spatially inconsistent low-saturation neutral mixture stays uncertain',()=>{
  const a=analyzeIrisSample(ctxFor(null,{quadrants:[[145,151,158],[158,150,145],[145,151,158],[158,150,145]]}),EYE);
  assert.strictEqual(a.name,'uncertain'); assert.ok(a.sectorAgreement<0.6);
});

test('BLUE/GRAY boundary uses measurable cold chroma, not luminance',()=>{
  assert.strictEqual(classifyIrisColor(170,175,179),'gray'); // chroma 9
  assert.strictEqual(classifyIrisColor(170,175,180),'blue'); // chroma 10, cold hue
  assert.strictEqual(classifyIrisColor(220,225,235),'blue'); // same boundary survives high luminance
});
test('warm chroma at the same magnitude is not mislabeled blue',()=>{
  assert.notStrictEqual(classifyIrisColor(200,195,190),'blue');
});
test('LEFT/RIGHT samples stay independent and combine through the production path',()=>{
  const left=sampleIrisColor(ctxFor([95,145,195]),EYE), right=sampleIrisColor(ctxFor([98,148,198]),EYE);
  assert.strictEqual(left.name,'blue'); assert.strictEqual(right.name,'blue');
  assert.strictEqual(combineIris(left,right).name,'blue');
});
test('runtime wiring: both Live and Photo call the shared sampler and combiner',()=>{
  assert.strictEqual((src.match(/sampleIrisColor\(ctx, leftEye\)/g)||[]).length,2);
  assert.strictEqual((src.match(/combineIris\(/g)||[]).length>=3,true);
  assert.ok(src.includes('irisName = iris?.name'));
});
test('insufficient sector evidence cannot expose a concrete zero-confidence category',()=>{
  const tinyEye=[{x:10,y:10},{x:11,y:9},{x:12,y:9},{x:13,y:10},{x:12,y:11},{x:11,y:11}];
  const noEvidence={getImageData(x0,y0,w,h){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data[i]=data[i+1]=data[i+2]=data[i+3]=250;return{data};}};
  const a=analyzeIrisSample(noEvidence,tinyEye);
  assert.strictEqual(a.confidence,0);
  assert.strictEqual(a.name,null);
});
test('bilateral aggregation cannot expose gray or another concrete category at zero confidence',()=>{
  const zeroGray={rgb:[103,98,94],hex:'#67625e',name:'gray',confidence:0};
  assert.strictEqual(combineIris(zeroGray,zeroGray).name,'uncertain');
  assert.strictEqual(combineIris({rgb:null},zeroGray).name,'uncertain');
});

console.log(`\n${pass} passed, ${fail} failed`); if(fail)process.exit(1);
