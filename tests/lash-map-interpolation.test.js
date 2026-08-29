const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    const ZONE_NAMES = ');
const end = src.indexOf('\n    const CATEGORY_LABELS =', start);
assert.ok(start >= 0 && end > start, 'lash-map display helper must be extractable');
const { expandLashMapSectors } = new Function(
  src.slice(start, end) + '\nreturn { expandLashMapSectors };'
)();
const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const DESIGN_CATALOG = new Function(src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;')();

const lengths = sectors => sectors.map(s => s.len);
const maxJump = values => Math.max(0, ...values.slice(1).map((v, i) => Math.abs(v - values[i])));
const curveFor = entry => ({zonePositions:entry.zonePositions||null,postPeakShape:entry.postPeakShape||'linear',plateauShape:entry.plateauShape||'linear'});
const keyLengths = sectors => sectors.filter(s=>s.isKey).map(s=>s.len);

test('6,7,9,12,11 renders without a neighboring jump above 1 mm', () => {
  const sectors=expandLashMapSectors([6,7,9,12,11],3),rendered=lengths(sectors);
  assert.deepStrictEqual(keyLengths(sectors),[6,7,9,12,11]);
  assert.ok(maxJump(rendered) <= 1);
});

test('6,7,9,13,11 includes 10/11/12 before PEAK 13', () => {
  const sectors = expandLashMapSectors([6, 7, 9, 13, 11], 3);
  const peak = sectors.findIndex(s => s.isPeak);
  assert.deepStrictEqual(keyLengths(sectors),[6,7,9,13,11]);
  assert.ok([10,11,12].every(v=>lengths(sectors).slice(0,peak+1).includes(v)));
  assert.ok(maxJump(lengths(sectors)) <= 1);
});

test('7,8,9,10,10 keeps all five named control zones, including numeric OUTER', () => {
  const controls = [7, 8, 9, 10, 10];
  const sectors = expandLashMapSectors(controls, 3);
  assert.deepStrictEqual(keyLengths(sectors),controls);
  assert.deepStrictEqual(sectors.filter(s => s.isKey).map(s => s.label), ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
  assert.strictEqual(sectors.find(s => s.label === 'OUTER').len, 10);
  assert.deepStrictEqual(controls, [7, 8, 9, 10, 10], 'business control values remain unchanged');
});

test('7,8,9,10,9 renders the real one-millimeter PEAK to OUTER decrease', () => {
  const sectors=expandLashMapSectors([7,8,9,10,9],3),rendered=lengths(sectors);
  assert.deepStrictEqual(keyLengths(sectors),[7,8,9,10,9]);
  assert.ok(maxJump(rendered) <= 1);
});

test('7,8,9,10,9 never gains an extra trailing 9 display sector', () => {
  const rendered = lengths(expandLashMapSectors([7, 8, 9, 10, 9], 3));
  assert.notDeepStrictEqual(rendered.slice(-3), [10, 9, 9]);
  assert.strictEqual(rendered.filter((v, i) => i > 0 && v === 9 && rendered[i - 1] === 9).length, 0);
});

test('no key zone disappears when adjacent control values are equal', () => {
  const sectors = expandLashMapSectors([7, 8, 9, 10, 10], 3);
  assert.strictEqual(sectors.filter(s => s.isKey).length, 5);
  assert.ok(sectors.every(s => typeof s.len === 'number'));
});

test('independent LEFT/RIGHT one-millimeter peak correction survives display expansion', () => {
  const left = expandLashMapSectors([6, 7, 9, 12, 11], 3);
  const right = expandLashMapSectors([6, 7, 9, 13, 11], 3);
  assert.strictEqual(left.find(s => s.isPeak).len, 12);
  assert.strictEqual(right.find(s => s.isPeak).len, 13);
  assert.strictEqual(right.find(s => s.isPeak).len - left.find(s => s.isPeak).len, 1);
});

test('Custom map remains five editable controls and expansion does not mutate it', () => {
  const custom = [5, 8, 11, 14, 9];
  const before = [...custom];
  const rendered = lengths(expandLashMapSectors(custom, 3));
  assert.deepStrictEqual(custom, before);
  assert.ok(rendered.length > custom.length);
  assert.ok(rendered.length>=9&&rendered.length<=14);
  assert.ok(src.includes("const next = [...base]; next[idx] = Math.max(5, Math.min(16, val));"));
  assert.ok(src.includes("const [customLeft, setCustomLeft] = useState(design.leftZones);"));
  assert.ok(src.includes("const [customRight, setCustomRight] = useState(design.rightZones);"));
});

test('diagram and written plan share the same expanded sectors', () => {
  assert.ok(src.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(src.includes('const displaySectors = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(src.includes('plan.displaySectors.map((sector,i) =>'));
});

test('every catalog profile expands smoothly without mutating its five source zones', () => {
  for(const entry of DESIGN_CATALOG){
    const before=[...entry.baseZones],sectors=expandLashMapSectors(entry.baseZones,entry.peakZone,curveFor(entry));
    assert.deepStrictEqual(entry.baseZones,before,entry.id);
    assert.deepStrictEqual(sectors.filter(s=>s.isKey).map(s=>s.label),['INNER','TRANSITION','BODY','PEAK','OUTER'],entry.id);
    assert.ok(sectors.length>=9&&sectors.length<=14,entry.id);
    const totalChange=entry.baseZones.slice(1).reduce((s,v,i)=>s+Math.abs(v-entry.baseZones[i]),0);
    if(totalChange<=13)assert.ok(maxJump(lengths(sectors))<=1,entry.id);
  }
});

test('Custom mode derives PEAK from edited values and AI length delta is bilateral', () => {
  assert.ok(src.includes("const peakIdx = mode==='custom' ? zones.indexOf(Math.max(...zones))"));
  assert.ok(src.includes("otherAiBase.map(v => Math.max(5, v + lengthDelta))"));
});

test('Doll derived geometry is centrally fuller and differs from Natural',()=>{
  const natural=DESIGN_CATALOG.find(e=>e.id==='natural'),doll=DESIGN_CATALOG.find(e=>e.id==='doll');
  const n=expandLashMapSectors(natural.baseZones,natural.peakZone,curveFor(natural));
  const d=expandLashMapSectors(doll.baseZones,doll.peakZone,curveFor(doll));
  assert.notDeepStrictEqual(d.map(x=>[x.t,x.len]),n.map(x=>[x.t,x.len]));
  assert.ok(d.find(x=>x.isPeak).t>=.45&&d.find(x=>x.isPeak).t<=.6);
});

test('Cat decline is front-loaded while Fox tail declines gradually',()=>{
  const cat=DESIGN_CATALOG.find(e=>e.id==='cat'),fox=DESIGN_CATALOG.find(e=>e.id==='fox');
  const post=e=>{const s=expandLashMapSectors(e.baseZones,e.peakZone,curveFor(e)),p=s.findIndex(x=>x.isPeak);return s.slice(p)};
  const c=post(cat),f=post(fox),catTotal=c[0].len-c.at(-1).len,foxTotal=f[0].len-f.at(-1).len;
  const halfway=a=>a.reduce((best,x)=>Math.abs(x.t-(a[0].t+a.at(-1).t)/2)<Math.abs(best.t-(a[0].t+a.at(-1).t)/2)?x:best,a[0]);
  assert.ok((c[0].len-halfway(c).len)/catTotal>.5);
  assert.ok((f[0].len-halfway(f).len)/foxTotal<=.5);
  assert.notDeepStrictEqual(c.map(x=>[x.t,x.len]),f.map(x=>[x.t,x.len]));
});

test('Squirrel has a near-maximum shoulder and is not a scaled Fox',()=>{
  const squirrel=DESIGN_CATALOG.find(e=>e.id==='squirrel'),fox=DESIGN_CATALOG.find(e=>e.id==='fox');
  const s=expandLashMapSectors(squirrel.baseZones,squirrel.peakZone,curveFor(squirrel));
  const f=expandLashMapSectors(fox.baseZones,fox.peakZone,curveFor(fox));
  const max=Math.max(...s.map(x=>x.len));
  assert.ok(s.filter(x=>x.len>=max-.3).length>=2);
  const normalized=a=>a.map(x=>Math.round((x.len-Math.min(...a.map(y=>y.len)))/(Math.max(...a.map(y=>y.len))-Math.min(...a.map(y=>y.len)))*100)/100);
  assert.notDeepStrictEqual(normalized(s),normalized(f));
});

test('Soft Fox is independent and distinct from Fox, Squirrel, and Soft Cat',()=>{
  const ids=['softfox','fox','squirrel','softcat'],entries=Object.fromEntries(ids.map(id=>[id,DESIGN_CATALOG.find(e=>e.id===id)]));
  assert.ok(entries.softfox);assert.ok(!entries.fox.aliases.includes('Soft Fox'));
  const signature=e=>expandLashMapSectors(e.baseZones,e.peakZone,curveFor(e)).map(x=>[x.t,x.len]);
  for(const id of ids.slice(1))assert.notDeepStrictEqual(signature(entries.softfox),signature(entries[id]));
});

test('derived curves are deterministic and keep equal PEAK/OUTER as separate points',()=>{
  const curve={zonePositions:[0,.2,.45,.7,1],postPeakShape:'gradual'},zones=[7,8,9,10,10];
  const a=expandLashMapSectors(zones,3,curve),b=expandLashMapSectors(zones,3,curve);
  assert.deepStrictEqual(a,b);assert.strictEqual(a.length,9);
  const peak=a.find(x=>x.isPeak),outer=a.find(x=>x.label==='OUTER');
  assert.strictEqual(peak.len,outer.len);assert.notStrictEqual(peak.t,outer.t);
});
