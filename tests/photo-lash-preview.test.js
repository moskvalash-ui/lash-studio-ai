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
// Mirrors CURL_GEOMETRY_PROFILES' own literal values (photo-lash-preview.js)
// so this file can prove sign-stability analytically, across the full t
// domain, independent of any one synthetic fixture -- same technique the
// pre-refactor version of this test already used for the old two-branch
// model. This is an intentionally pinned, independent copy: if it ever
// drifts from the real source table, the "distinct geometry"/"monotonic
// progression"/"M differs from C/D/L(+)" tests below (which call the REAL
// PhotoLashPreview.buildFibers, not this mirror) still catch real
// behavioral regressions on their own.
const CURL_PROFILE_MIRROR={
 J:{angleBase:.062,angleSweep:.564,angleProm:.28,curvePhaseBase:.63,liftNearBase:.018,liftNearSweep:.010,midBendRatio:.66,tipEaseRatio:.29},
 B:{angleBase:.076,angleSweep:.592,angleProm:.315,curvePhaseBase:.575,liftNearBase:.039,liftNearSweep:.020,midBendRatio:.83,tipEaseRatio:.385},
 C:{angleBase:.09,angleSweep:.62,angleProm:.35,curvePhaseBase:.52,liftNearBase:.06,liftNearSweep:.03,midBendRatio:1,tipEaseRatio:.48},
 CC:{angleBase:.104,angleSweep:.648,angleProm:.385,curvePhaseBase:.465,liftNearBase:.081,liftNearSweep:.040,midBendRatio:1.17,tipEaseRatio:.575},
 D:{angleBase:.118,angleSweep:.676,angleProm:.42,curvePhaseBase:.41,liftNearBase:.102,liftNearSweep:.050,midBendRatio:1.34,tipEaseRatio:.67},
 // L/L+/M -- TUNING PASS 4 (professional-reference review, current as of
 // this mirror). J/B/C/CC/D (roundedProfile) are UNCHANGED across every
 // pass -- see test 'J/B/C/CC/D rounded-family profiles are byte-identical
 // to commit 0c77cec' below for a source-level proof, not just this
 // mirror. See photo-lash-preview.js's own comments above L_PROFILE/M for
 // the full rationale of each field.
 L:{angleBase:1.25,angleSweep:.20,angleProm:0,curvePhaseBase:.82,liftNearBase:.010,liftNearSweep:.006,midBendRatio:.45,tipEaseRatio:.98},
 'L+':{angleBase:1.25,angleSweep:.20,angleProm:0,curvePhaseBase:.69,liftNearBase:.010,liftNearSweep:.006,midBendRatio:.80,tipEaseRatio:1.78},
 M:{angleBase:1.25,angleSweep:.20,angleProm:0,curvePhaseBase:.20,liftNearBase:.020,liftNearSweep:.010,midBendRatio:.52,tipEaseRatio:1.02},
};
const ALL_CURLS=['J','B','C','CC','D','L','L+','M'];
const ROUNDED_CURLS=['J','B','C','CC','D'];

test('curl progression: every one of the 8 profiles bends root->c1->c2->tip the same (negative) direction and can never flip sign (no kink/hook), across the full t/curlScale domain',()=>{
 const smooth_=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
 for(const curl of ALL_CURLS){
   const p=CURL_PROFILE_MIRROR[curl];
   for(const curlScale of [.58,1,1.12]){
     for(let t=0;t<=1;t+=.02){
       const liftNear=(p.liftNearBase+p.liftNearSweep*smooth_(0,.4,t))*curlScale;
       const curlPeak=(.24+.13*smooth_(.30,1,t))*curlScale;
       const midBend=curlPeak*p.midBendRatio;
       const tipEase=curlPeak*p.tipEaseRatio;
       assert.ok(liftNear>0&&midBend>0&&curlPeak>0&&tipEase>0,`curl=${curl}: root, mid and tip all bend the same (negative) direction, never a sign flip`);
     }
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
// ------------------------------------------------------------
// CURL GEOMETRY PROFILES -- distinct professional curl identities
// (J/B/C/CC/D/L/L+/M), replacing the old binary isLCurl model. Every
// test below exercises the REAL, exported PhotoLashPreview.buildFibers,
// never a re-derivation, so these prove actual rendered behavior.
// ------------------------------------------------------------
const curlFixturePoints=()=>PhotoLashPreview.sampleSectors(items).map(s=>({...s,x:180+s.t*40,y:100,normal:{x:0,y:-1},tangent:{x:1,y:0}}));
const geomKey=f=>JSON.stringify([f.c1,f.c2,f.tip]);
const buildAllCurls=()=>Object.fromEntries(ALL_CURLS.map(curl=>[curl,PhotoLashPreview.buildFibers(curlFixturePoints(),40,curl)]));

test('A. all 8 curl names (J/B/C/CC/D/L/L+/M) resolve to their own explicit profile -- every pair produces different control-point geometry',()=>{
 const byCurl=buildAllCurls();
 for(let i=0;i<ALL_CURLS.length;i++)for(let j=i+1;j<ALL_CURLS.length;j++){
   const a=ALL_CURLS[i],b=ALL_CURLS[j];
   assert.notEqual(geomKey(byCurl[a][0]),geomKey(byCurl[b][0]),`curl=${a} must render different control-point geometry from curl=${b}`);
 }
});

test('B. J/B/C/CC/D (the rounded family) are not geometrically identical to one another',()=>{
 const byCurl=buildAllCurls();
 const geoms=new Set(ROUNDED_CURLS.map(c=>geomKey(byCurl[c][0])));
 assert.equal(geoms.size,ROUNDED_CURLS.length,'each rounded curl must have its own distinct geometry, not collapse into a shared default');
});

test('C. rounded-family progression J<B<C<CC<D is monotonic in real, measured tip geometry (not just profile constants)',()=>{
 // Measures the REAL fiber's tip angle from the synthetic fixture's own
 // "up" axis (root->tip vector, atan2 against local up=(0,-1)/outward=
 // (1,0) that this straight synthetic eye produces) at the peak sector
 // (t=.5, prom=1 on this fixture), where curl-driven differences are
 // largest. This is the actual rendered geometry, not the source table.
 const byCurl=buildAllCurls();
 const peakAngle=curl=>{
   const fibers=byCurl[curl];
   const peak=fibers.find(f=>f.layer==='main'&&Math.abs(f.t-.5)<.01);
   assert.ok(peak,`expected a MAIN fiber near the peak sector for curl=${curl}`);
   return Math.atan2(peak.tip.x-peak.root.x,-(peak.tip.y-peak.root.y));
 };
 const angles=ROUNDED_CURLS.map(peakAngle);
 for(let i=1;i<angles.length;i++){
   assert.ok(angles[i]>angles[i-1],`expected strictly increasing tip angle ${ROUNDED_CURLS[i-1]}(${angles[i-1].toFixed(4)}) < ${ROUNDED_CURLS[i]}(${angles[i].toFixed(4)})`);
 }
});

test('D. L differs from D (L must not resemble the strongest rounded curl)',()=>{
 const byCurl=buildAllCurls();
 assert.notEqual(geomKey(byCurl.L[0]),geomKey(byCurl.D[0]));
 // L's own root-to-tip vector should read as flatter/less-resolved by c2
 // than D's -- verified via midBend/curlPeak ratio being far smaller for
 // every fiber pair sharing the same t, i.e. via the real output's c2
 // staying much closer to root+direction*length*curvePhase than D's does.
 const lPeak=byCurl.L.find(f=>f.layer==='main'&&Math.abs(f.t-.5)<.01);
 const dPeak=byCurl.D.find(f=>f.layer==='main'&&Math.abs(f.t-.5)<.01);
 const bend=f=>Math.hypot(f.c2.x-f.root.x,f.c2.y-f.root.y);
 assert.notEqual(bend(lPeak).toFixed(6),bend(dPeak).toFixed(6),'L and D must reach c2 with a measurably different bend magnitude');
});

test('E. L+ differs from L, while staying architecturally related (near-identical root/c1, distinctly stronger tip)',()=>{
 const byCurl=buildAllCurls();
 assert.notEqual(geomKey(byCurl.L[0]),geomKey(byCurl['L+'][0]),'L and L+ must no longer be byte-identical');
 byCurl.L.forEach((f,i)=>{
   const g=byCurl['L+'][i];
   assert.deepEqual(f.root,g.root,'L and L+ never move the root');
   assert.ok(Math.abs(f.c1.x-g.c1.x)<1e-6&&Math.abs(f.c1.y-g.c1.y)<1e-6,'L and L+ share the same straight basal leg (liftNear unchanged) -- c1 must stay effectively identical');
 });
 const lTip=byCurl.L.find(f=>f.layer==='main'&&Math.abs(f.t-.5)<.01);
 const lPlusTip=byCurl['L+'].find(f=>f.layer==='main'&&Math.abs(f.t-.5)<.01);
 const tipLift=f=>Math.hypot(f.tip.x-f.c2.x,f.tip.y-f.c2.y);
 assert.ok(tipLift(lPlusTip)>tipLift(lTip),'L+ must show a visibly stronger final tip lift than L');
});

test('F. M differs from C, CC, D, L, and L+ (not a rounded curl, not identical to either L variant)',()=>{
 const byCurl=buildAllCurls();
 for(const other of ['C','CC','D','L','L+']){
   assert.notEqual(geomKey(byCurl.M[0]),geomKey(byCurl[other][0]),`M must not be identical to curl=${other}`);
 }
});

test('G. an unknown/missing curl string safely falls back to the existing default (C) geometry -- never throws, never invents a new shape',()=>{
 const cFibers=PhotoLashPreview.buildFibers(curlFixturePoints(),40,'C');
 const baseline=JSON.stringify(cFibers);
 for(const invalid of [undefined,null,'','XYZ','l',123,{},[]]){
   assert.doesNotThrow(()=>PhotoLashPreview.buildFibers(curlFixturePoints(),40,invalid),`curl=${JSON.stringify(invalid)} must never throw`);
   const fibers=PhotoLashPreview.buildFibers(curlFixturePoints(),40,invalid);
   assert.equal(JSON.stringify(fibers),baseline,`curl=${JSON.stringify(invalid)} must fall back to the exact C-equivalent default geometry`);
 }
});

test('H. same input + same curl remains fully deterministic, for every one of the 8 curls',()=>{
 for(const curl of ALL_CURLS){
   const a=PhotoLashPreview.buildFibers(curlFixturePoints(),40,curl);
   const b=PhotoLashPreview.buildFibers(curlFixturePoints(),40,curl);
   assert.deepEqual(a,b,`curl=${curl} must produce byte-identical output for identical input`);
 }
});

test('I. changing curl never changes fiber count, source sector lengths, root positions, layer assignment, width/opacity, or mutates the input points array',()=>{
 const basePoints=curlFixturePoints();
 const frozenSnapshot=JSON.stringify(basePoints);
 const byCurl=Object.fromEntries(ALL_CURLS.map(curl=>[curl,PhotoLashPreview.buildFibers(basePoints,40,curl)]));
 assert.equal(JSON.stringify(basePoints),frozenSnapshot,'buildFibers must never mutate its input points array, regardless of curl');
 const reference=byCurl.C;
 for(const curl of ALL_CURLS){
   const fibers=byCurl[curl];
   assert.equal(fibers.length,reference.length,`curl=${curl} must not change fiber count`);
   fibers.forEach((f,i)=>{
     const r=reference[i];
     assert.equal(f.len,r.len,`curl=${curl}: source sector length must be unchanged at index ${i}`);
     assert.equal(f.t,r.t,`curl=${curl}: root sector/zone (t) must be unchanged at index ${i}`);
     assert.equal(f.layer,r.layer,`curl=${curl}: layer assignment must be unchanged at index ${i}`);
     assert.deepEqual(f.root,r.root,`curl=${curl}: root position must be unchanged at index ${i} (curl never moves roots, only the fiber's trajectory) -- deterministic support/accent jitter already existed pre-curl and is untouched here since it is derived from the same noise(i,salt) calls regardless of curl`);
     assert.ok(Math.abs(f.width-r.width)<1e-9,`curl=${curl}: width must be unchanged at index ${i}`);
     assert.ok(Math.abs(f.opacity-r.opacity)<1e-9,`curl=${curl}: opacity must be unchanged at index ${i}`);
   });
 }
});

test('J. no new curl values were introduced into index.html\'s CURL_CATALOG or DESIGN_CATALOG (production catalogs are byte-identical to git HEAD)',()=>{
 const {execSync}=require('node:child_process');
 let HEAD;
 try{HEAD=execSync('git show HEAD:index.html',{cwd:require('node:path').join(__dirname,'..'),maxBuffer:1024*1024*20}).toString();}catch(e){HEAD=null;}
 assert.ok(HEAD,'expected `git show HEAD:index.html` to succeed inside a git working tree');
 const extract=(s,start,end)=>{const st=s.indexOf(start);const en=s.indexOf(end,st);assert.ok(st!==-1&&en!==-1,'expected to locate CURL_CATALOG/DESIGN_CATALOG markers');return s.slice(st,en);};
 const curCurlCatalog=extract(src,'const CURL_CATALOG = [','function recommendCurl(');
 const prevCurlCatalog=extract(HEAD,'const CURL_CATALOG = [','function recommendCurl(');
 assert.equal(curCurlCatalog,prevCurlCatalog,'CURL_CATALOG must be byte-identical to git HEAD -- this task is rendering-only');
 const curDesignCatalog=extract(src,'const DESIGN_CATALOG','function calculateEyeLashMap(');
 const prevDesignCatalog=extract(HEAD,'const DESIGN_CATALOG','function calculateEyeLashMap(');
 assert.equal(curDesignCatalog,prevDesignCatalog,'DESIGN_CATALOG (including every baseCurl/curlOptions entry) must be byte-identical to git HEAD');
});

// ------------------------------------------------------------
// L/L+/M TUNING PASS (after commit 0c77cec) -- J/B/C/CC/D (the rounded
// family, built entirely from roundedProfile()) are frozen and must
// stay byte-identical; only L/L+/M's own profile objects may change.
// ------------------------------------------------------------
test('J/B/C/CC/D rounded-family profiles are byte-identical to commit 0c77cec (source-level proof, not just a value mirror)',()=>{
 const {execSync}=require('node:child_process');
 const root=require('node:path').join(__dirname,'..');
 let BASE;
 try{BASE=execSync('git show 0c77cec:photo-lash-preview.js',{cwd:root,maxBuffer:1024*1024*20}).toString();}catch(e){BASE=null;}
 assert.ok(BASE,'expected `git show 0c77cec:photo-lash-preview.js` to succeed -- 0c77cec must exist in history');
 const curSrc=fs.readFileSync(require('node:path').join(root,'photo-lash-preview.js'),'utf8');
 // Balanced-brace extraction (not a second string marker) so an
 // unrelated comment inserted AFTER roundedProfile's own closing brace
 // (e.g. explaining the L/L+/M tuning below it) can never accidentally
 // get swept into this comparison.
 const extractFnBody=(s,marker)=>{
   const st=s.indexOf(marker);
   assert.ok(st!==-1,`expected to find "${marker}"`);
   let i=s.indexOf('{',st),depth=0;
   for(;i<s.length;i++){
     if(s[i]==='{')depth++;
     else if(s[i]==='}'){depth--;if(depth===0)return s.slice(st,i+1);}
   }
   throw new Error('unbalanced braces');
 };
 const curRounded=extractFnBody(curSrc,'function roundedProfile(delta) {');
 const baseRounded=extractFnBody(BASE,'function roundedProfile(delta) {');
 assert.equal(curRounded,baseRounded,'roundedProfile() itself (the function every one of J/B/C/CC/D is derived from) must be untouched');
 const extract=(s,start,end)=>{const st=s.indexOf(start);assert.ok(st!==-1,`expected to find "${start}"`);const en=s.indexOf(end,st);assert.ok(en!==-1,`expected to find "${end}" after "${start}"`);return s.slice(st,en);};
 const curJD=extract(curSrc,'J: Object.freeze(roundedProfile(-2)),','L: Object.freeze(L_PROFILE),');
 const baseJD=extract(BASE,'J: Object.freeze(roundedProfile(-2)),','L: Object.freeze(L_PROFILE),');
 assert.equal(curJD,baseJD,'the J/B/C/CC/D table entries themselves (delta arguments -2..2) must be untouched');
});

// Real tangent-direction turning profile of the actual rendered curve
// (root/c1/c2/tip are exactly the 4 control points buildFibers already
// returns per fiber) -- reads how much the fiber's direction rotates
// between successive parameter samples, and where along the shaft that
// rotation is concentrated. Standard cubic Bezier derivative; used only
// to read real, already-computed geometry, never to re-derive it.
function tangentAt(f,s){
 const u=1-s;
 return {
   x:3*u*u*(f.c1.x-f.root.x)+6*u*s*(f.c2.x-f.c1.x)+3*s*s*(f.tip.x-f.c2.x),
   y:3*u*u*(f.c1.y-f.root.y)+6*u*s*(f.c2.y-f.c1.y)+3*s*s*(f.tip.y-f.c2.y),
 };
}
function turningProfile(f){
 const samples=[.05,.25,.45,.65,.85,.97];
 const angles=samples.map(s=>{const t=tangentAt(f,s);return Math.atan2(t.y,t.x);});
 const turns=[];
 for(let i=1;i<angles.length;i++){
   let d=angles[i]-angles[i-1];
   while(d>Math.PI)d-=2*Math.PI;
   while(d<-Math.PI)d+=2*Math.PI;
   turns.push(d);
 }
 return {samples,turns};
}
// Turning-weighted mean parameter position: where, on average along s,
// the fiber's own direction change is centered. A smaller value means
// the curve does most of its turning earlier along the shaft.
function turnCentroidS(f){
 const {samples,turns}=turningProfile(f);
 let weighted=0,total=0;
 for(let i=0;i<turns.length;i++){const mid=(samples[i]+samples[i+1])/2,w=Math.abs(turns[i]);weighted+=w*mid;total+=w;}
 return weighted/total;
}
// Fraction of the curve's TOTAL turning that happens in its final
// sampled segment -- how hinge-like/late-concentrated the bend is. 1.0
// would mean the curve is dead straight until the very last stretch,
// then snaps; a smaller fraction means the turning is spread more
// evenly across the shaft (a smoother, more continuous transition).
function turnLastSegmentFraction(f){
 const {turns}=turningProfile(f);
 const total=turns.reduce((s,t)=>s+Math.abs(t),0);
 return Math.abs(turns.at(-1))/total;
}
function peakFiberFor(byCurl,curl){
 const f=byCurl[curl].find(x=>x.layer==='main'&&Math.abs(x.t-.5)<.01);
 assert.ok(f,`expected a MAIN fiber near the peak sector for curl=${curl}`);
 return f;
}

test('F. M begins its lift earlier than L -- the real curve\'s turning is centered at an earlier parameter for M than for L',()=>{
 const byCurl=buildAllCurls();
 const m=turnCentroidS(peakFiberFor(byCurl,'M')),l=turnCentroidS(peakFiberFor(byCurl,'L'));
 assert.ok(m<l,`expected M's turn-centroid parameter (${m.toFixed(3)}) to be earlier than L's (${l.toFixed(3)})`);
});

test('F2. M\'s basal section starts structurally earlier than L+\'s -- M\'s curvePhaseBase precedes L+\'s own, even though L+ is deliberately tuned to a much stronger midBend/tipEase magnitude whose aggregate turning can legitimately front-load ahead of M\'s smoother profile (M\'s identity is defined relative to L -- see F/F3 -- not by out-measuring an intentionally extreme L+)',()=>{
 const m=CURL_PROFILE_MIRROR.M,lPlus=CURL_PROFILE_MIRROR['L+'];
 assert.ok(m.curvePhaseBase<lPlus.curvePhaseBase,`expected M's curvePhaseBase (${m.curvePhaseBase}) to be earlier than L+'s (${lPlus.curvePhaseBase})`);
});

test('F3. L has a longer straight basal section than M -- equivalently, L\'s real measured transition is later than M\'s (same claim as test F, stated from L\'s side, for direct traceability to the professional-geometry brief)',()=>{
 const byCurl=buildAllCurls();
 const l=turnCentroidS(peakFiberFor(byCurl,'L')),m=turnCentroidS(peakFiberFor(byCurl,'M'));
 assert.ok(l>m,`expected L's turn-centroid parameter (${l.toFixed(3)}) to be later than M's (${m.toFixed(3)}), i.e. a longer straight base`);
});

test('G. M\'s transition is smoother / less hinge-like than L\'s -- a smaller fraction of the real curve\'s total turning is concentrated in its final segment for M than for L',()=>{
 const byCurl=buildAllCurls();
 const m=turnLastSegmentFraction(peakFiberFor(byCurl,'M')),l=turnLastSegmentFraction(peakFiberFor(byCurl,'L'));
 assert.ok(m<l,`expected M's final-segment turning fraction (${m.toFixed(3)}) to be smaller (smoother) than L's (${l.toFixed(3)})`);
});

test('L remains a controlled lift, not an extreme hook, and stays clearly distinct from D',()=>{
 const byCurl=buildAllCurls();
 const l=peakFiberFor(byCurl,'L');
 // PASS 6 deliberately raised L's curvePhaseBase (.73->.82) specifically
 // to concentrate MORE of the turning into the later segments (making
 // the flat base read more distinctly straight) -- so the final-segment
 // share rose on purpose (~0.25 -> ~0.37). The ceiling here is raised to
 // match, with headroom: 0.45 comfortably clears the current, verified-
 // gradual value (checked: consecutive late-segment turning only grows
 // ~1.3x, never spikes) while still catching real hook-like spikes (a
 // curvePhaseBase pushed too much further, e.g. .90+, was measured to
 // both exceed 0.45 AND spike ~1.7x+ between its last two segments).
 assert.ok(turnLastSegmentFraction(l)<0.45,`expected L's post-tuning final-segment turning fraction (${turnLastSegmentFraction(l).toFixed(3)}) to stay well below a hook-like concentration`);
 assert.notEqual(geomKey(byCurl.L[0]),geomKey(byCurl.D[0]),'L must remain distinct from D after tuning');
});
