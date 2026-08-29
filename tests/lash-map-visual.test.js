const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    const ZONE_NAMES = ');
const end = src.indexOf('\n    const CATEGORY_LABELS =', start);
assert.ok(start >= 0 && end > start, 'projection helpers must be extractable');
const { expandLashMapSectors, buildProfessionalEyeProjection, selectProfessionalEyeLabels } = new Function(
  src.slice(start, end) + '\nreturn { expandLashMapSectors, buildProfessionalEyeProjection, selectProfessionalEyeLabels };'
)();
const catalogStart=src.indexOf('    const DESIGN_CATALOG = '),catalogEnd=src.indexOf('\n\n    function calculateEyeLashMap(',catalogStart);
const DESIGN_CATALOG=new Function(src.slice(catalogStart,catalogEnd)+'\nreturn DESIGN_CATALOG;')();
const curveFor=entry=>({zonePositions:entry.zonePositions||null,postPeakShape:entry.postPeakShape||'linear',plateauShape:entry.plateauShape||'linear'});
const rendererStart=src.indexOf('    function ProfessionalEyeMap(');
const rendererEnd=src.indexOf('\n    function LashMapScreen(',rendererStart);
assert.ok(rendererStart>=0&&rendererEnd>rendererStart,'ProfessionalEyeMap must be structurally extractable');
const professionalEyeMapSource=src.slice(rendererStart,rendererEnd);

const leftEye = [
  {x:100,y:100},{x:126,y:84},{x:158,y:82},
  {x:190,y:101},{x:158,y:112},{x:126,y:113},
];
const rightEye = [
  {x:390,y:100},{x:364,y:84},{x:332,y:82},
  {x:300,y:101},{x:332,y:112},{x:364,y:113},
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
  assert.ok(src.includes('viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}'));
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
  assert.ok(component.includes("point.isPeak?`PEAK ${point.len}`:point.len"));
  assert.strictEqual((component.match(/expandLashMapSectors\(/g)||[]).length,1);
});

test('PEAK label is mandatory and collision scheduling is deterministic',()=>{
  const mapped=project(leftEye),a=selectProfessionalEyeLabels(mapped.points,mapped.crop),b=selectProfessionalEyeLabels(mapped.points,mapped.crop);
  const peakIndex=mapped.points.findIndex(p=>p.isPeak);
  assert.deepStrictEqual(a,b);
  assert.ok(a[peakIndex]);
  assert.strictEqual(a[peakIndex].priority,5);
  assert.strictEqual(a[peakIndex].x,mapped.points[peakIndex].profileX);
  assert.strictEqual(a[peakIndex].y,mapped.points[peakIndex].profileY-mapped.crop.height*.045);
});

test('PHOTO permanently labels only INNER, PEAK, and OUTER while retaining every marker',()=>{
  const mapped=project(leftEye),labels=selectProfessionalEyeLabels(mapped.points,mapped.crop);
  assert.deepStrictEqual(labels.map((label,i)=>label&&mapped.points[i].isPeak?'PEAK':label&&mapped.points[i].label).filter(Boolean),['INNER','PEAK','OUTER']);
  assert.ok(professionalEyeMapSource.includes('{points.map((point,i)=>'));
  assert.ok(professionalEyeMapSource.includes('data-map-point={i}'));
  assert.ok(professionalEyeMapSource.includes("point.isPeak?`PEAK ${point.len}`:point.len"));
});

test('PHOTO visual hierarchy is silhouette above baseline above ordinary stems',()=>{
  assert.ok(professionalEyeMapSource.includes('<path d={profilePath} fill="none" stroke="rgba(231,239,245,.96)" strokeWidth={unit*.52}'));
  assert.ok(professionalEyeMapSource.includes('<path d={path} fill="none" stroke="rgba(231,239,245,.46)" strokeWidth={unit*.28}'));
  assert.ok(professionalEyeMapSource.includes("stroke={point.isPeak?'rgba(83,199,255,.62)':'rgba(231,239,245,.18)'}"));
  assert.ok(professionalEyeMapSource.includes('strokeWidth={unit*(point.isPeak ? 0.32 : 0.12)}'));
  assert.strictEqual((professionalEyeMapSource.match(/<path d=\{path\}/g)||[]).length,1,'baseline must use one stroke');
  assert.ok(!src.includes('profileBandPath'),'unused profile-band geometry must not remain');
});

test('plateau values do not produce redundant repeated labels',()=>{
  const plateau=expandLashMapSectors([7,8,10,10,9],2,{zonePositions:[0,.2,.5,.7,1],plateauShape:'shoulder'});
  const mapped=buildProfessionalEyeProjection(leftEye,plateau,500,250),labels=selectProfessionalEyeLabels(mapped.points,mapped.crop);
  const visibleTens=mapped.points.filter((p,i)=>p.len===10&&labels[i]);
  assert.ok(visibleTens.some(p=>p.isPeak));
  assert.strictEqual(visibleTens.filter(p=>!p.isPeak&&p.label!=='INNER'&&p.label!=='OUTER').length,0);
});

test('PHOTO is default and DIAGRAM remains a secondary shared-engine view',()=>{
  assert.ok(src.includes("const [viewMode,setViewMode]=useState('photo')"));
  assert.ok(src.includes("viewMode==='photo'?"));
  const diagram=src.slice(src.indexOf('    function LashMapDiagram('),src.indexOf('\n    // Artist-facing map',src.indexOf('    function LashMapDiagram(')));
  assert.ok(diagram.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(src.includes('<LashMapDiagram zones={zones} peakIdx={peakIdx}'));
});

test('Fox retains an elevated outer silhouette after its late engine peak',()=>{
  const fox=DESIGN_CATALOG.find(e=>e.id==='fox');
  const items=expandLashMapSectors([5,5,8,11,10],3,curveFor(fox));
  const points=buildProfessionalEyeProjection(leftEye,items,500,250).points,peak=points.find(p=>p.isPeak),outer=points.find(p=>p.label==='OUTER');
  assert.ok(peak.t>=.6&&peak.t<=.7);
  assert.ok(outer.profileHeight/peak.profileHeight>.9);
});

test('Cat post-peak profile decline is steeper than Fox from existing engine data',()=>{
  const rate=(id,zones)=>{const entry=DESIGN_CATALOG.find(e=>e.id===id),points=buildProfessionalEyeProjection(leftEye,expandLashMapSectors(zones,3,curveFor(entry)),500,250).points,peak=points.find(p=>p.isPeak),outer=points.find(p=>p.label==='OUTER');return (peak.profileHeight-outer.profileHeight)/(outer.t-peak.t);};
  assert.ok(rate('cat',[7,8,10,12,10])>rate('fox',[5,5,8,11,10]));
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
