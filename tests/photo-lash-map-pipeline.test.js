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

const entry = { peakZone: 3, category: 'lifting', correctionMultiplier: 1 };
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
