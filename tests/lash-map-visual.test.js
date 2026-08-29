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
  const component=src.slice(src.indexOf('    function ProfessionalEyeMap('),src.indexOf('\n    function LashMapScreen(',src.indexOf('    function ProfessionalEyeMap(')));
  assert.ok(component.includes('getPhysicalEyeLandmarks(result.landmarks,side).eye'));
  assert.ok(component.includes('href={result.originalImage}'));
  assert.ok(!/scaleX\s*\(\s*-1|rotateY\s*\(\s*180|transform[^\n]*mirror/i.test(component));
});

test('visual point count and labels come directly from derived sectors',()=>{
  const component=src.slice(src.indexOf('    function ProfessionalEyeMap('),src.indexOf('\n    function LashMapScreen(',src.indexOf('    function ProfessionalEyeMap(')));
  assert.ok(component.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(component.includes('points.map((point,i)=>'));
  assert.ok(component.includes('>{point.len}</text>'));
  assert.strictEqual((component.match(/expandLashMapSectors\(/g)||[]).length,1);
});

test('PEAK label is mandatory and collision scheduling is deterministic',()=>{
  const mapped=project(leftEye),a=selectProfessionalEyeLabels(mapped.points,mapped.crop),b=selectProfessionalEyeLabels(mapped.points,mapped.crop);
  const peakIndex=mapped.points.findIndex(p=>p.isPeak);
  assert.deepStrictEqual(a,b);
  assert.ok(a[peakIndex]);
  assert.strictEqual(a[peakIndex].priority,5);
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

test('both professional eye cards receive independent engine maps',()=>{
  assert.ok(src.includes('side="left" zones={leftZones} peakIdx={leftPeakIdx}'));
  assert.ok(src.includes('side="right" zones={rightZones} peakIdx={rightPeakIdx}'));
  assert.ok(src.includes("const leftZones=activeEye==='left'?zones:otherZones"));
  assert.ok(src.includes("const rightZones=activeEye==='right'?zones:otherZones"));
});
