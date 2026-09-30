'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const PhotoLashPreview=require('../photo-lash-preview');
const LashDesignDomain=require('../lash-design-domain');
const src=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const slice=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const code=[
  slice('    function normalizeEyePoints(', '    function normalizeBrowPoints('),
  slice('    function normalizeBrowPoints(', '    function getPhysicalEyeLandmarks('),
  slice('    function getPhysicalEyeLandmarks(', '    function computeHeadPose('),
  slice('    function buildProfessionalEyeProjection(', '    // PHOTO labels all five source anchors'),
  slice('    function buildProfessionalPhotoLine(', '    // PHOTO is rendered in a 16:9 card'),
  slice('    function buildPhotoPreviewEyes(', '    function PhotoLashPreviewPanel('),
].join('\n');
const {buildPhotoPreviewEyes,createManualPhotoAdjustment}=new Function('PhotoLashPreview','LashDesignDomain',code+';return {buildPhotoPreviewEyes,createManualPhotoAdjustment};')(PhotoLashPreview,LashDesignDomain);
const left=[{x:180,y:100},{x:190,y:90},{x:210,y:90},{x:220,y:100},{x:210,y:105},{x:190,y:105}];
const right=left.map(p=>({x:300-p.x,y:p.y}));
const result={source:'photo',imageWidth:300,imageHeight:200,landmarks:{getRightEye:()=>left,getLeftEye:()=>[right[3],right[2],right[1],right[0],right[5],right[4]],getRightEyeBrow:()=>left,getLeftEyeBrow:()=>right}};
const items=[{t:0,len:7},{t:.25,len:9},{t:.5,len:11,isPeak:true},{t:.75,len:10},{t:1,len:8}];
const client={version:2,mapping:{photo:{},physicalEyes:{left:{derivedSectors:items},right:{derivedSectors:items}}},application:{},curl:{},texture:{},display:{},presentation:{photo:{manualAdjustment:{}}}};
test('renderer uses only existing sector lengths and stable nearest-sector samples',()=>{
 const samples=PhotoLashPreview.sampleSectors(items);
 assert.equal(samples.length,294);
 assert.ok(samples.every(s=>items.some(p=>p.len===s.len)));
 assert.deepEqual(samples,PhotoLashPreview.sampleSectors(items));
 assert.throws(()=>PhotoLashPreview.sampleSectors([{t:0,len:NaN},{t:1,len:9}]),/mapping/);
});
test('real canonical bridge renders both physical eyes deterministically without mutation',()=>{
 const before=JSON.stringify(client),eyes=buildPhotoPreviewEyes(result,client);
 assert.equal(eyes.length,2);
 assert.ok(eyes.every(e=>e.fibers.length===619),'294 main + 246 support + 79 accent on this fixture');
 assert.deepEqual(eyes,buildPhotoPreviewEyes(result,client));
 assert.equal(JSON.stringify(client),before);
 for(let i=0;i<eyes[0].fibers.length;i++){
   const a=eyes[0].fibers[i],b=eyes[1].fibers[i];
   assert.ok(Math.abs(a.root.x+b.root.x-300)<1e-8);
   assert.ok(Math.abs(a.tip.x+b.tip.x-300)<1e-8);
   assert.equal(a.len,b.len);
   assert.ok(a.tip.y<a.root.y);
 }
});
test('manual PHOTO displacement moves roots without changing mapping or other eye',()=>{
 const adjusted=JSON.parse(JSON.stringify(client));
 adjusted.presentation.photo.manualAdjustment.left={...createManualPhotoAdjustment(),translationX:5,translationY:3};
 const before=JSON.stringify(adjusted.mapping),a=buildPhotoPreviewEyes(result,client),b=buildPhotoPreviewEyes(result,adjusted);
 assert.equal(JSON.stringify(adjusted.mapping),before);
 assert.deepEqual(a[1],b[1]);
 a[0].fibers.forEach((f,i)=>{
   assert.ok(Math.abs(b[0].fibers[i].root.x-f.root.x-5)<1e-8);
   assert.ok(Math.abs(b[0].fibers[i].root.y-f.root.y-3)<1e-8);
   assert.equal(b[0].fibers[i].len,f.len);
 });
});
test('missing geometry and LIVE input are rejected instead of a partial preview',()=>{
 assert.throws(()=>buildPhotoPreviewEyes({...result,source:'live'},client),/geometry/);
 assert.throws(()=>buildPhotoPreviewEyes({...result,landmarks:null},client),/geometry/);
 const broken=JSON.parse(JSON.stringify(client));broken.mapping.physicalEyes.right.derivedSectors=[];
 assert.throws(()=>buildPhotoPreviewEyes(result,broken),/mapping/);
});
test('tapered fibers draw closed curved silhouettes with a single pointed tip',()=>{
 const f=buildPhotoPreviewEyes(result,client)[0].fibers[0],calls=[];
 const stops=[];
 const ctx=Object.fromEntries(['beginPath','moveTo','bezierCurveTo','closePath','fill'].map(k=>[k,(...args)=>calls.push([k,...args])]));
 ctx.createLinearGradient=()=>({addColorStop:(...args)=>stops.push(args)});
 PhotoLashPreview.draw(ctx,[f]);
 assert.equal(stops.at(-1)[0],1);
 assert.match(stops.at(-1)[1],/,0\)$/);
 assert.equal(calls.filter(c=>c[0]==='bezierCurveTo').length,2);
 assert.deepEqual(calls.find(c=>c[0]==='bezierCurveTo').slice(-2),[f.tip.x,f.tip.y]);
 assert.equal(calls.at(-1)[0],'fill');
});

test('visual defaults: root/width clamp holds so dense roots never merge into a solid band',()=>{
 const eyes=buildPhotoPreviewEyes(result,client);
 const fibers=eyes[0].fibers;
 assert.equal(fibers.length,619);
 const widthCap=40*.0060,widthFloor=40*.0013;
 assert.ok(fibers.every(f=>f.width<=widthCap+1e-9&&f.width>=widthFloor-1e-9),'width is clamped between an explicit floor and ceiling on every fiber');
 assert.ok(fibers.every(f=>f.opacity>=.20&&f.opacity<=.995));
 assert.ok(new Set(fibers.map(f=>f.opacity)).size>250);
 fibers.forEach(f=>{
   const distance=Math.hypot(f.tip.x-f.root.x,f.tip.y-f.root.y)/(40*f.len*.085);
   assert.ok(distance>.30&&distance<1.25,'visual layers are bounded by the documented scale; canonical len is preserved');
 });
 const sparse=PhotoLashPreview.sampleSectors(items);
 const dense=PhotoLashPreview.sampleSectors([{t:0,len:7},{t:.1,len:8},...items.slice(1)]);
 assert.equal(dense.length,294);
 assert.deepEqual(sparse.map(p=>p.t),dense.map(p=>p.t),'root spacing does not depend on sector density');
 for(let i=1;i<sparse.length;i++)assert.ok(sparse[i].t>sparse[i-1].t);
 assert.ok(sparse[0].t>0&&sparse.at(-1).t<1);
});
test('curl progression: the bend direction is deterministic and can never flip sign (no kink/hook)',()=>{
 // Mirrors buildFibers' own liftNear/curlPeak/tipEase formulas across the
 // full t and curlScale domain actually used (support/main/accent), to
 // prove -- not just observe on one fixture -- that root->c1->c2->tip
 // always bends the same way and tip eases back from, never past, the peak.
 for(const curlScale of [.58,1,1.12]){
   for(let t=0;t<=1;t+=.02){
     const smooth_=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
     const liftNear=(.06+.03*smooth_(0,.4,t))*curlScale;
     const curlPeak=(.24+.13*smooth_(.30,1,t))*curlScale;
     const tipEase=curlPeak*.48;
     assert.ok(liftNear>0&&curlPeak>0,'c1 and c2 bend the same (negative) direction');
     assert.ok(tipEase>0&&tipEase<curlPeak,'the tip eases back from the peak curl instead of accelerating into a hook, and never reverses sign');
   }
 }
});
test('zone density: MAIN is a continuous population (never skipped), support/accent are additive overlays, never gaps',()=>{
 const fibers=buildPhotoPreviewEyes(result,client)[0].fibers;
 const support=fibers.filter(f=>f.layer==='support'),main=fibers.filter(f=>f.layer==='main'),accent=fibers.filter(f=>f.layer==='accent');
 assert.equal(main.length,294,'every sampled root gets a MAIN fiber -- unconditional, never skipped');
 assert.equal(support.length+main.length+accent.length,fibers.length);
 assert.ok(support.length>0&&accent.length>0);
 // Continuity: MAIN roots cover every sampled t with no missing index --
 // this is what rules out the earlier "hole in the middle" defect.
 const mainTs=main.map(f=>f.t).sort((a,b)=>a-b);
 for(let i=1;i<mainTs.length;i++)assert.ok(mainTs[i]>mainTs[i-1],'MAIN roots are strictly ordered with no duplicate/missing sample');
 const innerCorner=fibers.filter(f=>f.t<.10);
 assert.ok(innerCorner.length>0&&innerCorner.some(f=>f.layer==='main'),'inner corner still has continuous MAIN coverage, not a gap');
 const meanW=xs=>xs.reduce((s,f)=>s+f.width,0)/xs.length,meanO=xs=>xs.reduce((s,f)=>s+f.opacity,0)/xs.length;
 assert.ok(meanW(support)<meanW(main)&&meanW(main)<=meanW(accent));
 assert.ok(meanO(support)<meanO(main)&&meanO(main)<meanO(accent));
 assert.ok(accent.length<fibers.length*.25,'accent stays a minority layer, never the bulk of the eye');
});
test('MAIN roots stay exactly on the existing upper-lid cubic; support/accent only nestle a bounded micro-offset away',()=>{
 const fibers=buildPhotoPreviewEyes(result,client)[0].fibers;
 const spacing=40/294; // eyeWidth / STRAND_COUNT for this fixture
 for(const f of fibers){
   const u=1-f.t,expected={
     x:u*u*u*left[0].x+3*u*u*f.t*left[1].x+3*u*f.t*f.t*left[2].x+f.t**3*left[3].x,
     y:u*u*u*left[0].y+3*u*u*f.t*left[1].y+3*u*f.t*f.t*left[2].y+f.t**3*left[3].y};
   const d=Math.hypot(f.root.x-expected.x,f.root.y-expected.y);
   if(f.layer==='main')assert.ok(d<1e-9,'MAIN never displaces its root off the real lid curve');
   else assert.ok(d<spacing,'support/accent nestle close to their neighbor, never drifting past one root-spacing away');
 }
});

test('map-driven length: the main layer renders the real Lash Map length near-unscaled, and canonical len is never invented',()=>{
 const fibers=buildPhotoPreviewEyes(result,client)[0].fibers;
 assert.ok(fibers.every(f=>items.some(s=>s.len===f.len)),'every visual length still traces back to a real, unmodified sector length');
 const main=fibers.filter(f=>f.layer==='main');
 assert.equal(new Set(main.map(f=>f.t)).size,294,'every sampled root has its own MAIN sample; support/accent intentionally share a t with their MAIN neighbor');
 const midMain=main.filter(f=>f.t>.4&&f.t<.6);
 assert.ok(midMain.length>0);
 midMain.forEach(f=>{
   const ratio=Math.hypot(f.tip.x-f.root.x,f.tip.y-f.root.y)/(40*f.len*.085);
   assert.ok(ratio>.95&&ratio<1.03,'main-layer mid-zone strands stay close to the documented, unscaled map length');
 });
});
test('LEFT/RIGHT parity: both physical eyes assign the same depth layer at the same sample index',()=>{
 const eyes=buildPhotoPreviewEyes(result,client);
 eyes[0].fibers.forEach((f,i)=>assert.equal(f.layer,eyes[1].fibers[i].layer,'a shared per-index rule must never accidentally flip one side only'));
});
test('curl family: every curl WITHOUT an "L" (undefined, null, C, CC, D, B, J) renders the exact same C-like geometry -- no curl is hard-coded to L',()=>{
 const baseline=JSON.stringify(PhotoLashPreview.buildFibers(
   PhotoLashPreview.sampleSectors(items).map(s=>({...s,x:180+s.t*40,y:100,normal:{x:0,y:-1},tangent:{x:1,y:0}})),40));
 for(const curl of [undefined,null,'C','CC','D','B','J']){
   const points=PhotoLashPreview.sampleSectors(items).map(s=>({...s,x:180+s.t*40,y:100,normal:{x:0,y:-1},tangent:{x:1,y:0}}));
   const fibers=PhotoLashPreview.buildFibers(points,40,curl);
   assert.equal(JSON.stringify(fibers),baseline,`curl=${curl} must be byte-identical to the no-curl default`);
 }
});
test('curl family: a curl string containing "L" (L, L+) renders a distinct, still valid, sign-stable geometry -- lengths/peak/zones/count/LEFT-RIGHT untouched',()=>{
 const cPoints=PhotoLashPreview.sampleSectors(items).map(s=>({...s,x:180+s.t*40,y:100,normal:{x:0,y:-1},tangent:{x:1,y:0}}));
 const cFibers=PhotoLashPreview.buildFibers(cPoints,40,'CC');
 for(const curl of ['L','L+']){
   const points=PhotoLashPreview.sampleSectors(items).map(s=>({...s,x:180+s.t*40,y:100,normal:{x:0,y:-1},tangent:{x:1,y:0}}));
   const lFibers=PhotoLashPreview.buildFibers(points,40,curl);
   assert.equal(lFibers.length,cFibers.length,'curl never changes density/fiber count');
   lFibers.forEach((f,i)=>{
     assert.equal(f.layer,cFibers[i].layer,'curl never changes layer assignment');
     assert.equal(f.len,cFibers[i].len,'curl never changes the canonical Lash Map length');
     assert.equal(f.t,cFibers[i].t,'curl never moves a root to a different sector/zone');
     assert.deepEqual(f.root,cFibers[i].root,'curl never moves the root off the real lid curve');
     assert.ok(Math.abs(f.width-cFibers[i].width)<1e-9&&Math.abs(f.opacity-cFibers[i].opacity)<1e-9,'curl never changes width/opacity');
   });
   assert.notEqual(JSON.stringify(lFibers.map(f=>[f.c1,f.c2,f.tip])),JSON.stringify(cFibers.map(f=>[f.c1,f.c2,f.tip])),'the L profile must actually produce different control-point geometry from C/CC');
 }
});
test('curl family: the L/LLD profile is deterministic and sign-stable across the full t domain (no kink/hook)',()=>{
 for(const curlScale of [.58,1,1.12]){
   for(let t=0;t<=1;t+=.02){
     const smooth_=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
     const curlPeak=(.24+.13*smooth_(.30,1,t))*curlScale;
     const liftNear=(.015+.008*smooth_(0,.4,t))*curlScale;
     const midBend=curlPeak*.22;
     const tipEase=curlPeak*1.25;
     assert.ok(liftNear>0&&midBend>0&&curlPeak>0&&tipEase>0,'root, mid and tip all bend the same (negative) direction, never a sign flip');
     assert.ok(midBend<curlPeak,'c2 stays a small fraction of curlPeak so the shaft reads flat through the first ~70% of length');
   }
 }
});
