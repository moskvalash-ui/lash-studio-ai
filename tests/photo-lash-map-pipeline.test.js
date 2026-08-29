const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function calculateEyeLashMap(');
const end = src.indexOf('    function buildDesignResult(', start);
assert.ok(start >= 0 && end > start);
const helpers = `
const clamp01 = n => Math.max(0, Math.min(1, n));
const mirrorReflectDeg = deg => { let d=180-deg; while(d>180)d-=360; while(d<=-180)d+=360; return d; };
`;
const { calculateEyeLashMap, buildEyeZones } = new Function(
  helpers + src.slice(start, end) + '\nreturn { calculateEyeLashMap, buildEyeZones };'
)();
const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const DESIGN_CATALOG = new Function(src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;')();

const entry = { peakZone: 3, category: 'lifting', correctionMultiplier: 1, baseZones: [6,7,8,9,8] };
const profile = {
  leftEye: { width: 44, ear: .28, innerTaperDeg: 48, outerTaperDeg: 62, tiltCorrected: -7 },
  rightEye: { width: 38, ear: .21, innerTaperDeg: 72, outerTaperDeg: 86, tiltCorrected: -174 },
  perEyeTiltDegrees: { left: -7, right: -6 }, relativeEyeSize: .35,
  isCloseSet: false, compositeAsymmetry: .14,
  asymmetryBreakdown: { width: .136, height: .09, openness: .25, tilt: 1, hooding: .03, vertical: .025 },
};

test('photo and live recommendations use one shared map builder', () => {
  assert.strictEqual((src.match(/function calculateEyeLashMap\(/g) || []).length, 1);
  assert.ok(src.includes("const designs = rankDesigns(finalProfile, langRef.current);"));
  assert.ok(src.includes("const designs = rankDesigns(classified, lang);"));
});

test('LEFT and RIGHT maps are calculated independently from each eye metrics', () => {
  const maps = buildEyeZones(entry, profile);
  assert.notDeepStrictEqual(maps.left, maps.right);
  assert.strictEqual(maps.left.length, 5);
  assert.strictEqual(maps.right.length, 5);
});

test('PEAK is returned per eye and points to that eye maximum', () => {
  const maps = buildEyeZones(entry, profile);
  assert.strictEqual(maps.left[maps.leftPeakZone], Math.max(...maps.left));
  assert.strictEqual(maps.right[maps.rightPeakZone], Math.max(...maps.right));
});

test('asymmetry correction is measurement-derived and targets the smaller/less-open eye', () => {
  const maps = buildEyeZones(entry, profile);
  assert.strictEqual(maps.leftCorrectionMm, 0);
  assert.ok(maps.rightCorrectionMm > 0);
});

test('outer-corner tendency mirror-normalizes RIGHT before averaging', () => {
  assert.ok(src.includes('const rightPhysicalTilt = mirrorReflectDeg(right.tiltCorrected);'));
  assert.ok(src.includes('const avgTilt = (leftPhysicalTilt + rightPhysicalTilt) / 2;'));
  assert.ok(!src.includes('const avgTilt = (left.tiltCorrected + right.tiltCorrected) / 2;'));
});

test('design-specific PEAK to OUTER profiles remain distinct and always produce five source zones', () => {
  const neutral = {
    ...profile,
    leftEye: { ...profile.leftEye, width: 40, ear: .2, innerTaperDeg: 70, outerTaperDeg: 60, tiltCorrected: -5 },
    rightEye: { ...profile.rightEye, width: 40, ear: .2, innerTaperDeg: 70, outerTaperDeg: 60, tiltCorrected: -175 },
    perEyeTiltDegrees: { left: -5, right: -5 }, relativeEyeSize: .28,
    compositeAsymmetry: 0, asymmetryBreakdown: { width: 0, height: 0, openness: 0, tilt: 0, hooding: 0, vertical: 0 },
  };
  const entries = {
    kitten: { peakZone: 3, category: 'lifting', baseZones: [6,7,8,9,8] },
    softcat: { peakZone: 3, category: 'elongating', baseZones: [7,8,9,11,9] },
    rounded: { peakZone: 2, category: 'opening', baseZones: [7,9,10,10,8] },
    angel: { peakZone: 2, category: 'natural', baseZones: [6,7,8,8,7] },
  };
  const maps = Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, calculateEyeLashMap(e, neutral, 'left')]));
  for (const map of Object.values(maps)) assert.strictEqual(map.zones.length, 5);
  assert.strictEqual(maps.kitten.zones[4], maps.kitten.zones[maps.kitten.peakZone] - 1);
  assert.strictEqual(maps.softcat.zones[4], maps.softcat.zones[maps.softcat.peakZone] - 2);
  assert.strictEqual(maps.rounded.zones[4], maps.rounded.zones[maps.rounded.peakZone] - 2);
  assert.strictEqual(maps.angel.zones[4], maps.angel.zones[maps.angel.peakZone] - 1);
});

const neutralProfile = {
  ...profile,
  leftEye: { ...profile.leftEye, width: 40, ear: .2, innerTaperDeg: 70, outerTaperDeg: 60, tiltCorrected: 0 },
  rightEye: { ...profile.rightEye, width: 40, ear: .2, innerTaperDeg: 70, outerTaperDeg: 60, tiltCorrected: 180 },
  perEyeTiltDegrees: { left: 0, right: 0 }, relativeEyeSize: .28,
  isCloseSet: false, compositeAsymmetry: 0,
  asymmetryBreakdown: { width: 0, height: 0, openness: 0, tilt: 0, hooding: 0, vertical: 0 },
};

test('every catalog design preserves all five professional template offsets at neutral geometry', () => {
  assert.ok(DESIGN_CATALOG.length >= 20);
  for (const entry of DESIGN_CATALOG) {
    const map = calculateEyeLashMap(entry, neutralProfile, 'left');
    assert.strictEqual(map.zones.length, 5, entry.id);
    assert.strictEqual(map.peakZone, entry.peakZone, entry.id);
    const expectedOffsets = entry.baseZones.map(v => v - entry.baseZones[entry.peakZone]);
    const actualOffsets = map.zones.map(v => v - map.zones[map.peakZone]);
    assert.deepStrictEqual(actualOffsets, expectedOffsets, entry.id);
  }
});

test('major effect families retain distinct professional geometry', () => {
  const ids = ['natural','doll','squirrel','kitten','cat','softcat','fox','rounded'];
  const maps = Object.fromEntries(ids.map(id => {
    const entry = DESIGN_CATALOG.find(e => e.id === id);
    return [id, calculateEyeLashMap(entry, neutralProfile, 'left').zones];
  }));
  assert.deepStrictEqual(maps.natural.map(v=>v-Math.max(...maps.natural)), [-2,-1,0,0,-1]);
  assert.deepStrictEqual(maps.doll.map(v=>v-Math.max(...maps.doll)), [-2,-1,0,0,-1]);
  assert.deepStrictEqual(maps.squirrel.map(v=>v-Math.max(...maps.squirrel)), [-4,-3,-2,0,-1]);
  assert.deepStrictEqual(maps.kitten.map(v=>v-Math.max(...maps.kitten)), [-3,-2,-1,0,-1]);
  assert.deepStrictEqual(maps.cat.map(v=>v-Math.max(...maps.cat)), [-5,-4,-2,0,-2]);
  assert.deepStrictEqual(maps.softcat.map(v=>v-Math.max(...maps.softcat)), [-4,-3,-2,0,-2]);
  assert.deepStrictEqual(maps.fox.map(v=>v-Math.max(...maps.fox)), [-6,-5,-3,0,-1]);
  assert.deepStrictEqual(maps.rounded.map(v=>v-Math.max(...maps.rounded)), [-3,-1,0,0,-2]);
  assert.notDeepStrictEqual(maps.fox, maps.cat);
  assert.notDeepStrictEqual(maps.cat, maps.softcat);
});

test('effect-family invariants survive measured peak-length adaptation', () => {
  const map = id => calculateEyeLashMap(DESIGN_CATALOG.find(e=>e.id===id), neutralProfile, 'left');
  const natural=map('natural'),doll=map('doll'),squirrel=map('squirrel'),rounded=map('rounded');
  assert.ok(natural.zones.slice(1).every((v,i)=>Math.abs(v-natural.zones[i])<=1));
  assert.strictEqual(doll.zones[2],doll.zones[3]);assert.ok(doll.zones[4]<doll.zones[3]);
  assert.ok(squirrel.zones[0]<squirrel.zones[1]&&squirrel.zones[1]<squirrel.zones[2]&&squirrel.zones[2]<squirrel.zones[3]&&squirrel.zones[4]<squirrel.zones[3]);
  assert.strictEqual(rounded.zones[2],rounded.zones[3]);assert.strictEqual(rounded.zones[3]-rounded.zones[4],2);
});

test('peak movement coherently warps profiles for supported peak indices 1, 2, and 3', () => {
  for (const id of ['reverse','doll','fox']) {
    const entry=DESIGN_CATALOG.find(e=>e.id===id);
    for (const tilt of [-6,0,6]) {
      const shifted={...neutralProfile,leftEye:{...neutralProfile.leftEye,tiltCorrected:tilt},perEyeTiltDegrees:{...neutralProfile.perEyeTiltDegrees,left:tilt}};
      const map=calculateEyeLashMap(entry,shifted,'left');
      assert.strictEqual(map.zones.length,5);
      assert.strictEqual(map.zones[map.peakZone],Math.max(...map.zones),`${id}/${tilt}`);
      assert.ok(map.peakZone>=1&&map.peakZone<=3,`${id}/${tilt}`);
      assert.ok(map.zones.every(Number.isFinite),`${id}/${tilt}`);
    }
  }
});

test('mirror-equivalent LEFT and RIGHT measurements produce equivalent map geometry', () => {
  for (const entry of DESIGN_CATALOG) {
    const maps=buildEyeZones(entry,neutralProfile);
    assert.deepStrictEqual(maps.left,maps.right,entry.id);
    assert.strictEqual(maps.leftPeakZone,maps.rightPeakZone,entry.id);
    assert.strictEqual(maps.leftCorrectionMm,0);assert.strictEqual(maps.rightCorrectionMm,0);
  }
});
