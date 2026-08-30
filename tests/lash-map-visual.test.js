const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    const ZONE_NAMES = ');
const end = src.indexOf('\n    const CATEGORY_LABELS =', start);
assert.ok(start >= 0 && end > start, 'projection helpers must be extractable');
const { expandLashMapSectors, buildProfessionalEyeProjection, selectProfessionalEyeLabels, buildProfessionalPhotoLine, buildProfessionalPhotoCrop, createManualPhotoAdjustment, applyManualPhotoAdjustment } = new Function(
  src.slice(start, end) + '\nreturn { expandLashMapSectors, buildProfessionalEyeProjection, selectProfessionalEyeLabels, buildProfessionalPhotoLine, buildProfessionalPhotoCrop, createManualPhotoAdjustment, applyManualPhotoAdjustment };'
)();
const catalogStart=src.indexOf('    const DESIGN_CATALOG = '),catalogEnd=src.indexOf('\n\n    function calculateEyeLashMap(',catalogStart);
const DESIGN_CATALOG=new Function(src.slice(catalogStart,catalogEnd)+'\nreturn DESIGN_CATALOG;')();
const curveFor=entry=>({zonePositions:entry.zonePositions||null,postPeakShape:entry.postPeakShape||'linear',plateauShape:entry.plateauShape||'linear'});
const rendererStart=src.indexOf('    function ProfessionalEyeMap(');
const rendererEnd=src.indexOf('\n    function LashMapScreen(',rendererStart);
assert.ok(rendererStart>=0&&rendererEnd>rendererStart,'ProfessionalEyeMap must be structurally extractable');
const professionalEyeMapSource=src.slice(rendererStart,rendererEnd);
const normalizationStart=src.indexOf('    function normalizeEyePoints(raw, source) {');
const normalizationEnd=src.indexOf('\n    function computeHeadPose(',normalizationStart);
const debugRuntime=new Function(
  src.slice(normalizationStart,normalizationEnd)+src.slice(start,end)+'\nreturn { buildLashMapOrientationDebug };'
)();

const leftEye = [
  {x:100,y:100},{x:126,y:84},{x:158,y:82},
  {x:190,y:101},{x:158,y:112},{x:126,y:113},
];
const rightEye = [
  {x:390,y:100},{x:364,y:84},{x:332,y:82},
  {x:300,y:101},{x:332,y:112},{x:364,y:113},
];
const fixtureLeftEye = [
  {x:338.11,y:109.02},{x:345.56,y:103.47},{x:355.32,y:102.54},
  {x:363.55,y:105.56},{x:356.05,y:109.17},{x:346.06,y:109.48},
];
const fixtureRightEye = [
  {x:298.71,y:114.85},{x:289.77,y:112.07},{x:280.39,y:113.50},
  {x:275.54,y:117.67},{x:282.11,y:119.32},{x:291.39,y:118.62},
];
const zones=[7,8,10,11,9];
const sectors=expandLashMapSectors(zones,3,{zonePositions:[0,.2,.46,.66,1],plateauShape:'shoulder',postPeakShape:'gradual'});
const project=eye=>buildProfessionalEyeProjection(eye,sectors,500,250);

test('every derived sample maps once to the physical upper-eye path',()=>{
  const mapped=project(leftEye);
  assert.strictEqual(mapped.points.length,sectors.length);
  assert.deepStrictEqual(mapped.points.map(p=>p.len),sectors.map(p=>p.len));
  assert.ok(mapped.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert.strictEqual((mapped.profilePath.match(/[ML]/g)||[]).length,sectors.length);
});

test('display profile height is strictly monotonic with length for an equal baseline',()=>{
  const flatEye=[{x:0,y:100},{x:30,y:100},{x:60,y:100},{x:90,y:100},{x:60,y:110},{x:30,y:110}];
  const samples=[5,7,9,11].map((len,i)=>({len,t:i/3,isPeak:i===3,label:i===0?'INNER':i===3?'OUTER':null}));
  const heights=buildProfessionalEyeProjection(flatEye,samples,120,180).points.map(p=>p.profileHeight);
  assert.ok(heights.every((height,i)=>i===0||height>heights[i-1]));
  assert.deepStrictEqual(heights.map(v=>+v.toFixed(3)),samples.map(s=>+(90*(.04+.011*s.len)).toFixed(3)));
});

test('cubic tangents are normalized and outward normals face away from the eye aperture',()=>{
  for(const eye of [leftEye,rightEye]){
    const mapped=project(eye),center={x:eye.reduce((s,p)=>s+p.x,0)/eye.length,y:eye.reduce((s,p)=>s+p.y,0)/eye.length};
    assert.strictEqual(mapped.projectionMode,'normal');
    for(const point of mapped.points){
      assert.ok(Math.abs(Math.hypot(point.tangent.x,point.tangent.y)-1)<1e-9);
      assert.ok(Math.abs(Math.hypot(point.normal.x,point.normal.y)-1)<1e-9);
      assert.ok(point.normal.x*(point.x-center.x)+point.normal.y*(point.y-center.y)>0);
    }
  }
});

test('neighboring outward normals remain continuous without sign flips',()=>{
  for(const eye of [leftEye,rightEye]){
    const normals=project(eye).points.map(p=>p.normal);
    assert.ok(normals.slice(1).every((normal,i)=>normal.x*normals[i].x+normal.y*normals[i].y>.35));
  }
});

test('normal projection distance exactly equals display profileHeight',()=>{
  for(const point of project(leftEye).points)assert.ok(Math.abs(Math.hypot(point.profileX-point.x,point.profileY-point.y)-point.profileHeight)<1e-9);
});

test('INNER and OUTER land on canonical anatomical endpoints',()=>{
  for(const eye of [leftEye,rightEye]){
    const mapped=project(eye),inner=mapped.points.find(p=>p.label==='INNER'),outer=mapped.points.find(p=>p.label==='OUTER');
    assert.deepStrictEqual({x:inner.x,y:inner.y},eye[0]);
    assert.deepStrictEqual({x:outer.x,y:outer.y},eye[3]);
  }
});

test('PHOTO framing keeps both physical endpoints visible and makes the working line fill the crop',()=>{
  for(const eye of [fixtureLeftEye,fixtureRightEye]){
    const mapped=project(eye),line=buildProfessionalPhotoLine(eye,mapped.points),photoCrop=buildProfessionalPhotoCrop(eye,line.points,500,250),inner=line.points[0],outer=line.points.at(-1);
    assert.ok(inner.x>=photoCrop.x&&inner.x<=photoCrop.x+photoCrop.width);
    assert.ok(outer.x>=photoCrop.x&&outer.x<=photoCrop.x+photoCrop.width);
    assert.strictEqual(photoCrop.width/photoCrop.height,16/9);
    const scale=Math.min(400/photoCrop.width,225/photoCrop.height),effectiveCoverage=Math.abs(outer.mapX-inner.mapX)*scale/400;
    assert.ok(effectiveCoverage>=.7&&effectiveCoverage<=.8);
    assert.ok(mapped.path.startsWith(`M ${eye[0].x} ${eye[0].y}`));
    assert.ok(mapped.path.endsWith(`${eye[3].x} ${eye[3].y}`));
  }
});

test('PHOTO working curve is one smooth constant offset of physical INNER-to-OUTER geometry',()=>{
  for(const eye of [leftEye,rightEye]){
    const mapped=project(eye),line=buildProfessionalPhotoLine(eye,mapped.points);
    assert.ok(line.path.startsWith(`M ${eye[0].x} ${eye[0].y-line.offset}`));
    assert.ok(line.path.endsWith(`${eye[3].x} ${eye[3].y-line.offset}`));
    assert.ok(line.points.every((point,index)=>point.mapX===mapped.points[index].x&&point.mapY===mapped.points[index].y-line.offset));
    assert.ok(line.points.slice(1).every((point,index)=>Math.sign(point.mapX-line.points[index].mapX)===Math.sign(eye[3].x-eye[0].x)));
  }
});

test('real LEFT and RIGHT cubics have valid derivatives and no internal curvature reversal',()=>{
  const derivative=(eye,t)=>{const u=1-t;return {x:3*u*u*(eye[1].x-eye[0].x)+6*u*t*(eye[2].x-eye[1].x)+3*t*t*(eye[3].x-eye[2].x),y:3*u*u*(eye[1].y-eye[0].y)+6*u*t*(eye[2].y-eye[1].y)+3*t*t*(eye[3].y-eye[2].y)};};
  const second=(eye,t)=>({x:6*(1-t)*(eye[2].x-2*eye[1].x+eye[0].x)+6*t*(eye[3].x-2*eye[2].x+eye[1].x),y:6*(1-t)*(eye[2].y-2*eye[1].y+eye[0].y)+6*t*(eye[3].y-2*eye[2].y+eye[1].y)});
  for(const eye of [fixtureLeftEye,fixtureRightEye]){
    const signs=[];
    for(let step=0;step<=40;step++){const t=step/40,d=derivative(eye,t),d2=second(eye,t);assert.ok(Math.hypot(d.x,d.y)>1e-6);signs.push(Math.sign(d.x*d2.y-d.y*d2.x));}
    assert.strictEqual(new Set(signs).size,1);
  }
});

test('16:9 PHOTO crop contains the eye, numeric labels, PEAK, and five zone cues',()=>{
  for(const eye of [fixtureLeftEye,fixtureRightEye]){
    const mapped=project(eye),line=buildProfessionalPhotoLine(eye,mapped.points),photoCrop=buildProfessionalPhotoCrop(eye,line.points,500,250),labels=selectProfessionalEyeLabels(line.points,photoCrop),unit=photoCrop.width/100;
    const inside=(x,y)=>x>=photoCrop.x&&x<=photoCrop.x+photoCrop.width&&y>=photoCrop.y&&y<=photoCrop.y+photoCrop.height;
    assert.ok(eye.every(point=>inside(point.x,point.y)));
    assert.ok(labels.filter(Boolean).every(label=>inside(label.x,label.y-unit*1.8)));
    assert.ok(line.points.filter(point=>point.isKey).every(point=>inside(point.mapX,point.mapY+unit*(point.label==='BODY'?10.3:8.5))));
    assert.ok(inside(line.points.find(point=>point.isPeak).mapX,line.points.find(point=>point.isPeak).mapY));
  }
});

test('engine peak remains the displayed peak with its exact length',()=>{
  const mapped=project(leftEye),sourcePeak=sectors.find(p=>p.isPeak),displayPeak=mapped.points.find(p=>p.isPeak);
  assert.strictEqual(mapped.points.filter(p=>p.isPeak).length,1);
  assert.strictEqual(displayPeak.len,sourcePeak.len);
  assert.strictEqual(displayPeak.t,sourcePeak.t);
});

test('LEFT and RIGHT preserve physical INNER-to-OUTER meaning despite opposite image direction',()=>{
  const left=project(leftEye),right=project(rightEye);
  assert.ok(left.points[0].x<left.points.at(-1).x);
  assert.ok(right.points[0].x>right.points.at(-1).x);
  assert.deepStrictEqual(left.points.map(p=>p.len),right.points.map(p=>p.len));
  const leftOuter=left.points.find(p=>p.label==='OUTER'),rightOuter=right.points.find(p=>p.label==='OUTER');
  assert.ok(leftOuter.profileX>leftOuter.x);
  assert.ok(rightOuter.profileX<rightOuter.x);
});

test('responsive SVG scaling preserves normalized projection coordinates',()=>{
  const {crop,points}=project(leftEye),p=points[5];
  const atSize=(w,h)=>({x:(p.x-crop.x)/crop.width*w,y:(p.y-crop.y)/crop.height*h});
  const small=atSize(320,180),large=atSize(640,360);
  assert.strictEqual(large.x,small.x*2);
  assert.strictEqual(large.y,small.y*2);
  assert.ok(src.includes('viewBox={`${photoCrop.x} ${photoCrop.y} ${photoCrop.width} ${photoCrop.height}`}'));
  assert.ok(src.includes('preserveAspectRatio="xMidYMid meet"'));
});

test('rendering uses the retained image without presentation mirroring or eye swapping',()=>{
  const component=professionalEyeMapSource;
  assert.ok(component.includes('getPhysicalEyeLandmarks(result.landmarks,side).eye'));
  assert.ok(component.includes('href={result.originalImage}'));
  assert.ok(!/scaleX\s*\(\s*-1|rotateY\s*\(\s*180|transform[^\n]*mirror/i.test(component));
});

test('visual point count and labels come directly from derived sectors',()=>{
  const component=professionalEyeMapSource;
  assert.ok(component.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(component.includes('points.map((point,i)=>'));
  assert.ok(component.includes('data-length={point.len}'));
  assert.ok(component.includes('data-photo-label={label.kind}'));
  assert.strictEqual((component.match(/expandLashMapSectors\(/g)||[]).length,1);
});

test('PEAK label is mandatory and collision scheduling is deterministic',()=>{
  const mapped=project(leftEye),points=buildProfessionalPhotoLine(leftEye,mapped.points).points,a=selectProfessionalEyeLabels(points,mapped.crop),b=selectProfessionalEyeLabels(points,mapped.crop);
  const peakIndex=mapped.points.findIndex(p=>p.isPeak);
  assert.deepStrictEqual(a,b);
  assert.ok(a[peakIndex]);
  assert.strictEqual(a[peakIndex].priority,5);
  assert.strictEqual(a[peakIndex].x,points[peakIndex].mapX);
  assert.ok(a[peakIndex].y<points[peakIndex].mapY);
});

test('PHOTO permanently labels all five source zones while retaining every marker',()=>{
  const mapped=project(leftEye),points=buildProfessionalPhotoLine(leftEye,mapped.points).points,labels=selectProfessionalEyeLabels(points,mapped.crop);
  assert.deepStrictEqual(labels.filter(label=>label&&!label.isDerived).map(label=>label.zone),['INNER','TRANSITION','BODY','PEAK','OUTER']);
  assert.ok(professionalEyeMapSource.includes('{workingLine.points.map((point,i)=>'));
  assert.ok(professionalEyeMapSource.includes('data-map-point={i}'));
  assert.ok(professionalEyeMapSource.includes('data-photo-label={label.kind}'));
});

test('PHOTO zone cues and professional summary share the five source values',()=>{
  assert.ok(professionalEyeMapSource.includes('data-photo-zone={point.label}'));
  assert.ok(professionalEyeMapSource.includes('`${point.label} ${point.len}`'));
  assert.ok(professionalEyeMapSource.includes('{zones.map((len,i)=>'));
  assert.ok(professionalEyeMapSource.includes('key={ZONE_NAMES[i]}'));
});

test('PHOTO renders one anatomical mapping line with no elevated contour or stems',()=>{
  assert.strictEqual((professionalEyeMapSource.match(/<path\b/g)||[]).length,1);
  assert.strictEqual((professionalEyeMapSource.match(/data-photo-map-line=/g)||[]).length,1);
  assert.ok(!professionalEyeMapSource.includes('profilePath'));
  assert.ok(!professionalEyeMapSource.includes('profile-stem'));
  assert.ok(!professionalEyeMapSource.includes('profileX'));
  assert.ok(!professionalEyeMapSource.includes('profileY'));
});

test('PHOTO uses uniform regular markers and one slightly larger PEAK circle',()=>{
  assert.ok(professionalEyeMapSource.includes("r=unit*(point.isPeak?.95:.68)"));
  assert.ok(!professionalEyeMapSource.includes('professionalSampleRadius'));
});

test('PHOTO renders exactly one circular marker per sample and one engine PEAK treatment',()=>{
  assert.strictEqual((professionalEyeMapSource.match(/data-photo-sample=/g)||[]).length,1,'one mapped circle template must render for every point');
  assert.ok(professionalEyeMapSource.includes("r=unit*(point.isPeak?.95:.68)"));
  assert.ok(professionalEyeMapSource.includes("fill={point.isPeak?'#0A8CFF'"));
  assert.ok(!professionalEyeMapSource.includes('<polygon'));
  assert.ok(!professionalEyeMapSource.includes('diamond'));
});

test('plateau values do not produce redundant repeated labels',()=>{
  const plateau=expandLashMapSectors([7,8,10,10,9],2,{zonePositions:[0,.2,.5,.7,1],plateauShape:'shoulder'});
  const mapped=buildProfessionalEyeProjection(leftEye,plateau,500,250),points=buildProfessionalPhotoLine(leftEye,mapped.points).points,labels=selectProfessionalEyeLabels(points,mapped.crop);
  const derivedTens=mapped.points.filter((point,index)=>point.len===10&&labels[index]?.isDerived);
  assert.strictEqual(derivedTens.length,0);
  assert.strictEqual(labels.filter(label=>label&&!label.isDerived).length,5);
});

test('useful derived labels are exact expanded-sector values and explain the Fox transition',()=>{
  const fox=DESIGN_CATALOG.find(entry=>entry.id==='fox'),items=expandLashMapSectors([5,5,8,11,10],3,curveFor(fox));
  const mapped=buildProfessionalEyeProjection(leftEye,items,500,250),points=buildProfessionalPhotoLine(leftEye,mapped.points).points,labels=selectProfessionalEyeLabels(points,mapped.crop);
  const displayed=points.filter((point,index)=>labels[index]).map(point=>point.len);
  assert.deepStrictEqual(displayed,[5,5,6,7,8,9,10,11,10.5,10]);
  assert.ok(displayed.every(value=>items.some(item=>item.len===value)));
});

test('PHOTO is default and DIAGRAM remains a secondary shared-engine view',()=>{
  assert.ok(src.includes("const [viewMode,setViewMode]=useState('photo')"));
  assert.ok(src.includes("viewMode==='photo'?"));
  const diagram=src.slice(src.indexOf('    function LashMapDiagram('),src.indexOf('\n    // Artist-facing map',src.indexOf('    function LashMapDiagram(')));
  assert.ok(diagram.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(src.includes('<LashMapDiagram zones={zones} peakIdx={peakIdx}'));
});

test('Fox marker topology keeps a late peak and a still-large outer sample',()=>{
  const fox=DESIGN_CATALOG.find(e=>e.id==='fox');
  const items=expandLashMapSectors([5,5,8,11,10],3,curveFor(fox));
  const points=buildProfessionalEyeProjection(leftEye,items,500,250).points,peak=points.find(p=>p.isPeak),outer=points.find(p=>p.label==='OUTER'),inner=points.find(p=>p.label==='INNER');
  assert.ok(peak.t>=.6&&peak.t<=.7);
  assert.ok(inner.len<peak.len);
  assert.ok(outer.len>inner.len);
});

test('Cat marker topology peaks later and drops more at OUTER than Fox',()=>{
  const topology=(id,zones)=>{const entry=DESIGN_CATALOG.find(e=>e.id===id),points=buildProfessionalEyeProjection(leftEye,expandLashMapSectors(zones,3,curveFor(entry)),500,250).points,peak=points.find(p=>p.isPeak),outer=points.find(p=>p.label==='OUTER');return {peak,outer,drop:peak.len-outer.len};};
  const cat=topology('cat',[5,5,8,10,8]),fox=topology('fox',[5,5,8,11,10]);
  assert.ok(cat.peak.t>fox.peak.t);
  assert.ok(cat.drop>fox.drop);
});

test('Squirrel silhouette contains the existing pre-drop shoulder topology',()=>{
  const entry=DESIGN_CATALOG.find(e=>e.id==='squirrel'),points=buildProfessionalEyeProjection(leftEye,expandLashMapSectors(entry.baseZones,entry.peakZone,curveFor(entry)),500,250).points;
  const max=Math.max(...points.map(p=>p.profileHeight));
  assert.ok(points.filter(p=>p.t<=points.find(x=>x.isPeak).t&&p.profileHeight>=max-.31).length>=2);
  assert.ok(points.find(p=>p.label==='OUTER').profileHeight<max);
});

test('Doll central silhouette differs from Natural using only their derived samples',()=>{
  const signature=id=>{const entry=DESIGN_CATALOG.find(e=>e.id===id);return buildProfessionalEyeProjection(leftEye,expandLashMapSectors(entry.baseZones,entry.peakZone,curveFor(entry)),500,250).points.map(p=>[p.t,p.profileHeight]);};
  assert.notDeepStrictEqual(signature('doll'),signature('natural'));
});

test('normal projection preserves engine t, length, and PEAK and is deterministic',()=>{
  const a=project(leftEye),b=project(leftEye);
  assert.deepStrictEqual(a,b);
  assert.deepStrictEqual(a.points.map(p=>p.t),sectors.map(p=>p.t));
  assert.deepStrictEqual(a.points.map(p=>p.len),sectors.map(p=>p.len));
  assert.strictEqual(a.points.find(p=>p.isPeak).t,sectors.find(p=>p.isPeak).t);
});

test('PHOTO crop and offset preserve every engine sample field and add no point after OUTER',()=>{
  for(const eye of [leftEye,rightEye]){
    const mapped=project(eye),line=buildProfessionalPhotoLine(eye,mapped.points);
    assert.strictEqual(line.points.length,mapped.points.length);
    assert.deepStrictEqual(line.points.map(({t,len,isPeak,isKey,label})=>({t,len,isPeak,isKey,label})),mapped.points.map(({t,len,isPeak,isKey,label})=>({t,len,isPeak,isKey,label})));
    const last=line.points.at(-1);
    assert.strictEqual(last.t,1);
    assert.deepStrictEqual({x:last.mapX,y:last.mapY+line.offset},eye[3]);
    assert.ok(line.path.endsWith(`${eye[3].x} ${eye[3].y-line.offset}`));
  }
});

test('ProfessionalEyeMap has no effect-specific rendering rule',()=>{
  assert.ok(!/\b(?:fox|cat|squirrel|doll|natural|softfox)\b/i.test(professionalEyeMapSource));
  assert.strictEqual((professionalEyeMapSource.match(/expandLashMapSectors\(/g)||[]).length,1);
});

test('unstable degenerate upper-lid tangent fails closed to vertical projection',()=>{
  const degenerate=[{x:50,y:50},{x:50,y:50},{x:50,y:50},{x:50,y:50},{x:60,y:60},{x:40,y:60}];
  const mapped=buildProfessionalEyeProjection(degenerate,sectors,120,120);
  assert.strictEqual(mapped.projectionMode,'vertical-fallback');
  assert.ok(mapped.points.every(point=>point.profileX===point.x&&point.profileY===point.y-point.profileHeight));
});

test('both professional eye cards receive independent engine maps',()=>{
  assert.ok(src.includes('side="left" zones={leftZones} peakIdx={leftPeakIdx}'));
  assert.ok(src.includes('side="right" zones={rightZones} peakIdx={rightPeakIdx}'));
  assert.ok(src.includes("const leftZones=activeEye==='left'?zones:otherZones"));
  assert.ok(src.includes("const rightZones=activeEye==='right'?zones:otherZones"));
});

test('manual PHOTO adjustment has a pixel-identical automatic zero state and deterministic RESET',()=>{
  const mapped=project(leftEye),automatic=buildProfessionalPhotoLine(leftEye,mapped.points),zero=createManualPhotoAdjustment();
  assert.deepStrictEqual(applyManualPhotoAdjustment(leftEye,mapped.points,zero,sectors.find(point=>point.isPeak).t),automatic);
  const changed={...zero,translationX:4,innerDelta:{x:2,y:1},peakDelta:{x:1,y:0},outerDelta:{x:3,y:-1}};
  assert.notDeepStrictEqual(applyManualPhotoAdjustment(leftEye,mapped.points,changed,.66),automatic);
  assert.deepStrictEqual(applyManualPhotoAdjustment(leftEye,mapped.points,createManualPhotoAdjustment(),.66),automatic);
});

test('whole-map translation moves curve, markers, labels, and zone anchors together without changing engine data',()=>{
  const mapped=project(leftEye),automatic=buildProfessionalPhotoLine(leftEye,mapped.points),adjustment={...createManualPhotoAdjustment(),translationX:3.5,translationY:-2.25},manual=applyManualPhotoAdjustment(leftEye,mapped.points,adjustment,.66);
  assert.ok(manual.path!==automatic.path);
  manual.points.forEach((point,index)=>{assert.ok(Math.abs(point.mapX-automatic.points[index].mapX-3.5)<1e-9);assert.ok(Math.abs(point.mapY-automatic.points[index].mapY+2.25)<1e-9);});
  assert.deepStrictEqual(manual.points.map(({t,len,isPeak,isKey,label})=>({t,len,isPeak,isKey,label})),automatic.points.map(({t,len,isPeak,isKey,label})=>({t,len,isPeak,isKey,label})));
  const autoLabels=selectProfessionalEyeLabels(automatic.points,mapped.crop),manualLabels=selectProfessionalEyeLabels(manual.points,mapped.crop);
  manualLabels.forEach((label,index)=>{if(label){assert.ok(Math.abs(label.x-autoLabels[index].x-3.5)<1e-9);assert.ok(Math.abs(label.y-autoLabels[index].y+2.25)<1e-9);}});
});

test('INNER, PEAK, and OUTER handles deform presentation anchors only and retain every sample',()=>{
  const mapped=project(leftEye),automatic=buildProfessionalPhotoLine(leftEye,mapped.points),peakIndex=mapped.points.findIndex(point=>point.isPeak),adjustment={...createManualPhotoAdjustment(),innerDelta:{x:-2,y:1},peakDelta:{x:2,y:-1},outerDelta:{x:4,y:2}},manual=applyManualPhotoAdjustment(leftEye,mapped.points,adjustment,.66);
  assert.deepStrictEqual([manual.points[0].mapX-automatic.points[0].mapX,manual.points[0].mapY-automatic.points[0].mapY],[-2,1]);
  assert.ok(Math.abs(manual.points[peakIndex].mapX-automatic.points[peakIndex].mapX-2)<1e-9);assert.ok(Math.abs(manual.points[peakIndex].mapY-automatic.points[peakIndex].mapY+1)<1e-9);
  assert.deepStrictEqual([manual.points.at(-1).mapX-automatic.points.at(-1).mapX,manual.points.at(-1).mapY-automatic.points.at(-1).mapY],[4,2]);
  assert.strictEqual(manual.points.length,automatic.points.length);
  assert.deepStrictEqual(manual.points.map(point=>point.len),automatic.points.map(point=>point.len));
  assert.strictEqual(manual.points.find(point=>point.isPeak).len,automatic.points.find(point=>point.isPeak).len);
  assert.strictEqual(manual.points.find(point=>point.isPeak).t,automatic.points.find(point=>point.isPeak).t);
});

test('allowed manual deformation remains finite, smooth, and anatomically ordered for both eye directions',()=>{
  for(const eye of [leftEye,rightEye]){const mapped=project(eye),manual=applyManualPhotoAdjustment(eye,mapped.points,{...createManualPhotoAdjustment(),innerDelta:{x:1,y:1},peakDelta:{x:(eye[3].x-eye[0].x)*.025,y:-1},outerDelta:{x:-1,y:1}},.66),numbers=manual.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.strictEqual(numbers.length,8);assert.ok(numbers.every(Number.isFinite));
    const direction=Math.sign(manual.points.at(-1).mapX-manual.points[0].mapX);assert.ok(manual.points.slice(1).every((point,index)=>direction*(point.mapX-manual.points[index].mapX)>0));
  }
});

test('manual PHOTO state is independent per eye, survives view changes, and never reaches DIAGRAM',()=>{
  const screen=src.slice(src.indexOf('    function LashMapScreen('),src.indexOf('\n    function ApplicationStepCard(',src.indexOf('    function LashMapScreen('))),diagram=src.slice(src.indexOf('    function LashMapDiagram('),src.indexOf('\n    // Artist-facing map',src.indexOf('    function LashMapDiagram(')));
  assert.ok(screen.includes("useState(()=>({left:createManualPhotoAdjustment(),right:createManualPhotoAdjustment()}))"));
  assert.ok(screen.includes("setManualPhotoAdjustments(current=>({...current,[side]:next}))"));
  assert.ok(screen.includes("adjustment={manualPhotoAdjustments.left}"));assert.ok(screen.includes("adjustment={manualPhotoAdjustments.right}"));
  assert.ok(screen.includes("viewMode==='photo'?"));assert.ok(!diagram.includes('manualPhotoAdjustment'));assert.ok(!diagram.includes('applyManualPhotoAdjustment'));
});

test('mobile editing has large hit targets, pointer capture, constrained PEAK, and one visible PHOTO curve',()=>{
  assert.ok((professionalEyeMapSource.match(/style=\{\{touchAction:'none'\}\}/g)||[]).length>=2);
  assert.ok(professionalEyeMapSource.includes('setPointerCapture(event.pointerId)'));
  assert.ok(professionalEyeMapSource.includes("r={unit*4.2}"));
  assert.ok(professionalEyeMapSource.includes("Math.max(span*.08,Math.min(span*.92,position))"));
  assert.ok(professionalEyeMapSource.includes("outerPosition-length*.08"));
  assert.ok(professionalEyeMapSource.includes("innerPosition+length*.08"));
  assert.strictEqual((professionalEyeMapSource.match(/<path\b/g)||[]).length,1);
  assert.strictEqual((professionalEyeMapSource.match(/data-photo-map-line=/g)||[]).length,1);
  assert.ok(professionalEyeMapSource.includes('<use data-manual-map-drag="true"'));
});

test('mobile PHOTO places EDIT MAP visibly inside the image overlay and exposes RESET/DONE only while editing',()=>{
  const controlsIndex=professionalEyeMapSource.indexOf('data-photo-edit-controls="true"'),svgIndex=professionalEyeMapSource.indexOf('<svg ref={svgRef}'),summaryIndex=professionalEyeMapSource.indexOf('<div className="border-t border-white/[.07] p-3">'),controls=professionalEyeMapSource.slice(controlsIndex,summaryIndex);
  assert.ok(svgIndex>=0&&controlsIndex>svgIndex&&summaryIndex>controlsIndex,'controls must be inside PHOTO image area before summary panel');
  assert.ok(controls.includes('className="absolute inset-x-3 top-3 z-20'));
  assert.ok(controls.includes("editing?t('lashMapEditing',lang)"));
  assert.ok(controls.includes("editing?<><button type=\"button\""));
  assert.ok(controls.includes("{t('lashMapReset',lang)}</button>"));assert.ok(controls.includes("{t('lashMapDone',lang)}</button>"));assert.ok(controls.includes("{t('lashMapEdit',lang)}</button>"));
  assert.ok(controls.includes('onEdit();'));assert.ok(controls.includes('onReset();'));assert.ok(controls.includes('onDone();'));
  assert.strictEqual((controls.match(/min-h-\[44px\]/g)||[]).length,3);assert.strictEqual((controls.match(/min-w-\[44px\]/g)||[]).length,3);
  assert.ok(!/\bhidden\b|opacity-0|invisible|md:|lg:/.test(controls),'mobile control must have no responsive or visibility suppression');
  const diagram=src.slice(src.indexOf('    function LashMapDiagram('),src.indexOf('\n    // Artist-facing map',src.indexOf('    function LashMapDiagram(')));
  assert.ok(!diagram.includes('EDIT MAP'));assert.ok(!diagram.includes('data-photo-edit-controls'));
});

test('manual PHOTO controls use live RU/EN localization without coupling language to adjustment state',()=>{
  for(const [key,ru,en] of [['lashMapEdit','НАСТРОИТЬ СХЕМУ','EDIT MAP'],['lashMapEditing','НАСТРОЙКА СХЕМЫ','EDITING MAP'],['lashMapReset','СБРОСИТЬ','RESET'],['lashMapDone','ГОТОВО','DONE']]){
    assert.ok(src.includes(`${key}: {ru:'${ru}', en:'${en}'}`));
    assert.ok(professionalEyeMapSource.includes(`t('${key}',lang)`));
  }
  const screen=src.slice(src.indexOf('    function LashMapScreen('),src.indexOf('\n    function ApplicationStepCard(',src.indexOf('    function LashMapScreen(')));
  assert.ok(screen.includes("const lang = useLang();"));
  assert.ok(screen.includes("const [manualPhotoAdjustments,setManualPhotoAdjustments]=useState"));
  assert.ok(!/useEffect\([^)]*lang[^)]*setManualPhotoAdjustments|setManualPhotoAdjustments\([^\n]*lang/.test(screen));
});

test('orientation diagnostic reads runtime landmarks and classifies canthi by nose distance',()=>{
  const nose=[{x:245,y:150},{x:250,y:155},{x:255,y:150}];
  const rawLeft=[{x:180,y:100},{x:190,y:90},{x:210,y:90},{x:220,y:100},{x:210,y:110},{x:190,y:110}];
  const rawRight=[{x:280,y:100},{x:290,y:90},{x:310,y:90},{x:320,y:100},{x:310,y:110},{x:290,y:110}];
  const positions=Array(68).fill(null).map(()=>({x:0,y:0}));positions.splice(36,6,...rawLeft);positions.splice(42,6,...rawRight);
  const landmarks={positions,getNose:()=>nose,getLeftEye:()=>rawLeft,getRightEye:()=>rawRight,getLeftEyeBrow:()=>[],getRightEyeBrow:()=>[]};
  const result={source:'photo',imageWidth:500,imageHeight:250,landmarks};
  const data=debugRuntime.buildLashMapOrientationDebug(result,zones,3,zones,3,{zonePositions:[0,.2,.46,.66,1],plateauShape:'shoulder',postPeakShape:'gradual'});
  assert.strictEqual(data.sourceMode,'photo');
  assert.strictEqual(data.noseCenterX,250);
  assert.deepStrictEqual(data.rawLeftEye.p0,rawLeft[0]);
  assert.deepStrictEqual(data.rawRightEye.p3,rawRight[3]);
  assert.strictEqual(data.anatomicalCheck.leftInnerIsNasal,true);
  assert.strictEqual(data.anatomicalCheck.leftOuterIsTemporal,true);
  assert.strictEqual(data.anatomicalCheck.rightInnerIsNasal,true);
  assert.strictEqual(data.anatomicalCheck.rightOuterIsTemporal,true);
});

test('orientation diagnostic reports actual normalized and rendered PHOTO coordinates',()=>{
  const rawLeft=[{x:180,y:100},{x:190,y:90},{x:210,y:90},{x:220,y:100},{x:210,y:110},{x:190,y:110}],rawRight=[{x:280,y:100},{x:290,y:90},{x:310,y:90},{x:320,y:100},{x:310,y:110},{x:290,y:110}],positions=Array(68).fill(null).map(()=>({x:0,y:0}));positions.splice(36,6,...rawLeft);positions.splice(42,6,...rawRight);
  const landmarks={positions,getNose:()=>[{x:250,y:150}],getLeftEye:()=>rawLeft,getRightEye:()=>rawRight,getLeftEyeBrow:()=>[],getRightEyeBrow:()=>[]};
  const result={source:'live',imageWidth:500,imageHeight:250,landmarks},curve={zonePositions:[0,.2,.46,.66,1],plateauShape:'shoulder',postPeakShape:'gradual'};
  const data=debugRuntime.buildLashMapOrientationDebug(result,zones,3,zones,3,curve);
  assert.deepStrictEqual(data.normalizedPhysicalLeft.inner,{x:280,y:100});
  assert.deepStrictEqual(data.normalizedPhysicalLeft.outer,{x:320,y:100});
  assert.deepStrictEqual(data.normalizedPhysicalRight.inner,{x:220,y:100});
  assert.deepStrictEqual(data.normalizedPhysicalRight.outer,{x:180,y:100});
  assert.strictEqual(data.photoLeft.innerX,data.normalizedPhysicalLeft.innerX);
  assert.strictEqual(data.photoLeft.outerX,data.normalizedPhysicalLeft.outerX);
  assert.strictEqual(data.photoRight.innerX,data.normalizedPhysicalRight.innerX);
  assert.strictEqual(data.photoRight.outerX,data.normalizedPhysicalRight.outerX);
  assert.strictEqual(data.photoLeft.tDirection,'increasing-x');
  assert.strictEqual(data.photoRight.tDirection,'decreasing-x');
  assert.strictEqual(data.photoLeft.peakT,sectors.find(point=>point.isPeak).t);
  assert.strictEqual(data.photoRight.peakT,sectors.find(point=>point.isPeak).t);
});

test('orientation diagnostic UI and console are debug-gated and do not alter PHOTO geometry',()=>{
  const screen=src.slice(src.indexOf('    function LashMapScreen('),src.indexOf('\n    function ApplicationStepCard(',src.indexOf('    function LashMapScreen(')));
  assert.ok(screen.includes("const debugAvailable=isDebugModeEnabled();"));
  assert.ok(screen.includes('{debugAvailable&&<CopyLashMapOrientationDebugButton data={orientationDebug}/>}'));
  assert.ok(screen.includes("if(orientationDebug)console.log('LASH_MAP_ORIENTATION_DEBUG',orientationDebug)"));
  assert.strictEqual((professionalEyeMapSource.match(/data-photo-map-line/g)||[]).length,1);
  assert.ok(!professionalEyeMapSource.includes('buildLashMapOrientationDebug'));
});
