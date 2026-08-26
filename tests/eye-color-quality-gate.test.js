// Eye capture validity must be independent of iris color. The production
// Live Scan and Photo Analysis paths both call assessFrameQuality before
// sampling iris color; these tests execute that real shared gate.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.message}`); }
}

const qualityStart = src.indexOf('    function assessFrameQuality(');
const qualityEnd = src.indexOf('\n    function analyzeIrisSample(', qualityStart);
assert.ok(qualityStart >= 0 && qualityEnd > qualityStart, 'shared quality pipeline not found');
const qualitySource = src.slice(qualityStart, qualityEnd);
const { assessFrameQuality, sampleBrightness } = new Function(
  qualitySource + '\nreturn { assessFrameQuality, sampleBrightness };'
)();

const EYE_POINTS = [
  { x: 12, y: 20 }, { x: 18, y: 16 }, { x: 26, y: 16 },
  { x: 32, y: 20 }, { x: 26, y: 24 }, { x: 18, y: 24 },
];

function eyeCtx(irisRgb) {
  return {
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x0 + x, py = y0 + y;
        const iris = (px - 22) ** 2 + (py - 20) ** 2 <= 16;
        const rgb = iris ? irisRgb : [150, 132, 122];
        const i = (y * w + x) * 4;
        data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
      return { data };
    },
  };
}

function qualityFor(rgb, overrides = {}) {
  const brightness = sampleBrightness(eyeCtx(rgb), EYE_POINTS);
  return assessFrameQuality({
    detScore: 0.92,
    headPose: { roll: 0, yawProxy: 0, pitchProxy: 0.75 },
    leftEAR: 0.28,
    rightEAR: 0.28,
    brightness,
    sharpness: 40,
    canvasWidth: 640,
    boxWidth: 250,
    ...overrides,
  });
}

test('well-visible blue eyes pass the shared Live/Photo quality gate', () => {
  assert.deepStrictEqual(qualityFor([105, 155, 205]), { ok: true, reasons: [] });
});

test('well-visible light-gray eyes pass the shared Live/Photo quality gate', () => {
  assert.deepStrictEqual(qualityFor([165, 172, 180]), { ok: true, reasons: [] });
});

test('dark eyes keep passing under the same visible-eye conditions', () => {
  assert.deepStrictEqual(qualityFor([55, 35, 25]), { ok: true, reasons: [] });
});

test('low landmark/detection confidence still requires a retry', () => {
  const q = qualityFor([105, 155, 205], { detScore: 0.42 });
  assert.strictEqual(q.ok, false);
  assert.ok(q.reasons.includes('low_face_confidence'));
});

test('a genuinely closed/poorly visible eye still requires a retry', () => {
  const q = qualityFor([165, 172, 180], { leftEAR: 0.1 });
  assert.strictEqual(q.ok, false);
  assert.ok(q.reasons.includes('eyes_closed'));
});

test('quality validity has no iris classifier/confidence dependency', () => {
  assert.ok(!/sampleIrisColor|classifyIrisColor|iris(?:Color)?Confidence|iris\.confidence/.test(qualitySource));
  assert.strictEqual((src.match(/const quality = assessFrameQuality\(\{/g) || []).length, 2,
    'Live Scan and Photo Analysis must keep using the one shared gate');
});

test('an inconclusive iris color no longer falsely instructs a valid capture to retry', () => {
  assert.ok(src.includes("uncertain: {ru:'Оттенок не определён', en:'Color inconclusive'},"));
  assert.ok(!src.includes("uncertain: {ru:'Требует уточнения', en:'Needs clearer capture'},"));
});

test('physical LEFT/RIGHT normalization remains the only eye-side mapping at both analysis call sites', () => {
  assert.strictEqual((src.match(/const physicalLeft = getPhysicalEyeLandmarks\(det\.landmarks, 'left'\);/g) || []).length, 2);
  assert.strictEqual((src.match(/const physicalRight = getPhysicalEyeLandmarks\(det\.landmarks, 'right'\);/g) || []).length, 2);
  assert.strictEqual((src.match(/const leftEye = physicalLeft\.eye, rightEye = physicalRight\.eye;/g) || []).length, 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
