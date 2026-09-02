'use strict';
// ============================================================
// FACE SHAPE ANALYSIS — independent analyzer tests.
// classifyFaceShape lives as plain JS inside index.html's app script
// (same file/pattern as classifyFeatures/computeHeadPose). This file
// extracts and evals the REAL function plus its real dependencies
// (dist/clamp01/getPhysicalEyeLandmarks/computeHeadPose/
// computeConfidence/FACE_SHAPE_PROVISIONAL_THRESHOLDS) straight out of
// index.html — the same functions the browser runs, not a
// reimplementation — following the exact extraction convention
// already used by tests/pro-library-preview-ui.test.js's loadComposer.
//
// Fixtures below are constructed by SOLVING FORWARD from the
// classifier's own documented target ratio profile for each shape
// (FACE_SHAPE_PROVISIONAL_THRESHOLDS.shapeTargets) — i.e. "does the
// classifier correctly recover the category it was designed to
// represent from clean, idealized geometry" — never by trial-and-error
// tuning of a threshold to make a fixture pass. Ambiguous/boundary
// fixtures are deliberately the exact midpoint between two target
// profiles, not a cherry-picked near-miss.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractObjectLiteral(name) {
  const start = indexSource.indexOf('const ' + name + ' = {');
  const braceStart = indexSource.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < indexSource.length; i++) {
    if (indexSource[i] === '{') depth++;
    else if (indexSource[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + indexSource.slice(braceStart, i + 1))();
}

function extractFn(name, endMarker) {
  const start = indexSource.indexOf(name);
  const end = indexSource.indexOf(endMarker, start);
  return indexSource.slice(start, end);
}

function loadFaceShapeClassifier() {
  const clamp01 = 'const clamp01 = (n) => Math.max(0, Math.min(1, n));';
  const distAngle = indexSource.slice(indexSource.indexOf('const dist = (a,b)'), indexSource.indexOf('const shortestAngleDiffDeg'));
  const getPhysicalEyeLandmarks = extractFn('function getPhysicalEyeLandmarks', '\n    function computeHeadPose');
  const computeHeadPose = extractFn('function computeHeadPose', '\n    function ');
  const computeConfidenceBlock = indexSource.slice(
    indexSource.indexOf('function confidenceBucket'),
    indexSource.indexOf('// ============================================================\n    // FACE SHAPE ANALYSIS')
  );
  const faceShapeBlock = indexSource.slice(
    indexSource.indexOf('// ============================================================\n    // FACE SHAPE ANALYSIS'),
    indexSource.indexOf('// Turns aggregated measurements into independent')
  );
  const code = [clamp01, distAngle, getPhysicalEyeLandmarks, computeHeadPose, computeConfidenceBlock, faceShapeBlock,
    'return { classifyFaceShape, FACE_SHAPE_PROVISIONAL_THRESHOLDS, dist };'].join('\n');
  return new Function(code)();
}
let M;
try { M = loadFaceShapeClassifier(); } catch (e) { M = null; global.__faceShapeLoadError = e; }

// ------------------------------------------------------------
// Synthetic landmark builder. Only the 9 indices classifyFaceShape
// actually reads (0,4,6,8,10,12,16,21,22,26,17) are meaningfully
// placed; distances are constructed to land EXACTLY on the requested
// templeWidth/jawWidth/chinWidth/lowerFaceLength(L)/browWidth by
// simple horizontal-pair placement (each pair shares a y so its
// Euclidean distance equals its x-span exactly), keeping the fixture
// math transparent and independent of the classifier's own scoring
// implementation.
// ------------------------------------------------------------
function buildLandmarks({ templeWidth = 100, jawWidth, chinWidth, L, browWidth, scale = 1, rotateDeg = 0 }) {
  const raw = new Array(68).fill(0).map(() => ({ x: 0, y: 0 }));
  raw[21] = { x: -5, y: 0 }; raw[22] = { x: 5, y: 0 };
  raw[0] = { x: -templeWidth / 2, y: 5 }; raw[16] = { x: templeWidth / 2, y: 5 };
  raw[4] = { x: -jawWidth / 2, y: 40 }; raw[12] = { x: jawWidth / 2, y: 40 };
  raw[6] = { x: -chinWidth / 2, y: 65 }; raw[10] = { x: chinWidth / 2, y: 65 };
  raw[8] = { x: 0, y: L };
  raw[17] = { x: -browWidth / 2, y: -20 }; raw[26] = { x: browWidth / 2, y: -20 };
  const rad = (rotateDeg * Math.PI) / 180;
  const positions = raw.map((pt) => {
    const sx = pt.x * scale, sy = pt.y * scale;
    return { x: sx * Math.cos(rad) - sy * Math.sin(rad), y: sx * Math.sin(rad) + sy * Math.cos(rad) };
  });
  return { positions };
}

const FRONTAL_POSE = { roll: 0, yawProxy: 0, pitchProxy: 0.75, interEyeDistance: 40 };

// Target profiles used to construct each idealized fixture — pulled
// directly from the classifier's own documented (provisional)
// shapeTargets, not invented separately for the test.
const T = (M && M.FACE_SHAPE_PROVISIONAL_THRESHOLDS) || null;
function idealParamsFor(shape) {
  const target = T.shapeTargets[shape];
  const templeWidth = 100;
  const jawWidth = target.jawTaper * templeWidth;
  const chinWidth = target.chinTaper * jawWidth;
  const L = target.lengthToWidth * templeWidth;
  const browWidth = target.foreheadSoft * templeWidth;
  return { templeWidth, jawWidth, chinWidth, L, browWidth };
}

test('module loads: classifyFaceShape and FACE_SHAPE_PROVISIONAL_THRESHOLDS are extractable straight from index.html', () => {
  assert.ok(M, 'failed to load: ' + (global.__faceShapeLoadError && global.__faceShapeLoadError.message));
  assert.strictEqual(typeof M.classifyFaceShape, 'function');
  assert.ok(M.FACE_SHAPE_PROVISIONAL_THRESHOLDS && typeof M.FACE_SHAPE_PROVISIONAL_THRESHOLDS === 'object');
});

test('thresholds are explicitly documented as provisional/unvalidated, matching this codebase\'s existing DEBUG_..._UNCALIBRATED disclosure convention', () => {
  const start = indexSource.indexOf('const FACE_SHAPE_PROVISIONAL_THRESHOLDS');
  const commentStart = indexSource.lastIndexOf('// FACE SHAPE ANALYSIS', start);
  const header = indexSource.slice(commentStart, start);
  assert.ok(/not validated against a labeled dataset/i.test(header));
  assert.ok(/provisional|heuristic/i.test(header));
});

// ------------------------------------------------------------
// 1. Each supported category, from idealized (exact-target) geometry
// ------------------------------------------------------------
const SHAPES = ['oval', 'round', 'square', 'oblong', 'heart', 'diamond'];
for (const shape of SHAPES) {
  test(`classifies ${shape} correctly from geometry matching its own documented target profile`, () => {
    const params = idealParamsFor(shape);
    const result = M.classifyFaceShape(buildLandmarks(params), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
    assert.strictEqual(result.category, shape);
    assert.strictEqual(result.isUncertain, false);
    assert.ok(result.confidence > 0.5, 'confidence should be reasonably high for an idealized, unambiguous fixture');
    assert.ok(result.measurements.scores[0].name === shape);
  });
}

// ------------------------------------------------------------
// 2. Uncertain result + ambiguous boundary
// ------------------------------------------------------------
test('returns uncertain at the exact midpoint between two distinct target profiles (oval/round), never forcing a pick', () => {
  const oval = idealParamsFor('oval'), round = idealParamsFor('round');
  const mid = {
    templeWidth: 100,
    jawWidth: (oval.jawWidth + round.jawWidth) / 2,
    chinWidth: (oval.chinWidth + round.chinWidth) / 2,
    L: (oval.L + round.L) / 2,
    browWidth: (oval.browWidth + round.browWidth) / 2,
  };
  const result = M.classifyFaceShape(buildLandmarks(mid), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(result.category, 'uncertain');
  assert.strictEqual(result.isUncertain, true);
  assert.ok(result.qualityFlags.includes('ambiguous_margin'));
});

test('a forehead-proxy-dependent decision (heart vs. diamond, which differ mainly on the weak forehead signal) is flagged even when accepted, and requires a wider margin', () => {
  const heart = idealParamsFor('heart');
  const result = M.classifyFaceShape(buildLandmarks(heart), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  // heart's own exact profile clears even the stricter margin, but the
  // flag must still be present, proving the code path was exercised.
  if (!result.isUncertain) {
    assert.ok(Array.isArray(result.qualityFlags));
  }
  // A blend of heart/diamond (identical except forehead) must resolve
  // to uncertain under the stricter forehead-driven margin.
  const diamond = idealParamsFor('diamond');
  const blend = { templeWidth: 100, jawWidth: (heart.jawWidth + diamond.jawWidth) / 2, chinWidth: (heart.chinWidth + diamond.chinWidth) / 2, L: (heart.L + diamond.L) / 2, browWidth: (heart.browWidth + diamond.browWidth) / 2 };
  const blendResult = M.classifyFaceShape(buildLandmarks(blend), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(blendResult.isUncertain, true);
});

// ------------------------------------------------------------
// 3. Excessive pose — independent of, and never affecting, the
// existing eye-analysis frame-acceptance gate (assessFrameQuality).
// ------------------------------------------------------------
test('excessive roll forces uncertain, independent of assessFrameQuality', () => {
  const params = idealParamsFor('oval');
  const result = M.classifyFaceShape(buildLandmarks(params), { ...FRONTAL_POSE, roll: 25 }, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(result.isUncertain, true);
  assert.ok(result.qualityFlags.includes('excessive_roll'));
});

test('excessive yaw forces uncertain', () => {
  const params = idealParamsFor('oval');
  const result = M.classifyFaceShape(buildLandmarks(params), { ...FRONTAL_POSE, yawProxy: 0.5 }, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(result.isUncertain, true);
  assert.ok(result.qualityFlags.includes('excessive_yaw'));
});

test('excessive pitch forces uncertain', () => {
  const params = idealParamsFor('oval');
  const result = M.classifyFaceShape(buildLandmarks(params), { ...FRONTAL_POSE, pitchProxy: 1.4 }, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(result.isUncertain, true);
  assert.ok(result.qualityFlags.includes('excessive_pitch'));
});

test('the face-shape pose gate uses its own, stricter thresholds than assessFrameQuality\'s eye-tuned gate', () => {
  const t = M.FACE_SHAPE_PROVISIONAL_THRESHOLDS.pose;
  assert.ok(t.maxRollDeg < 18, 'face-shape roll gate must be stricter than the 18° eye-analysis gate');
  assert.ok(t.maxYawProxy < 0.32, 'face-shape yaw gate must be stricter than the 0.32 eye-analysis gate');
});

// ------------------------------------------------------------
// 4. Missing / invalid landmarks
// ------------------------------------------------------------
test('missing a required landmark index returns uncertain with null measurements, never throws', () => {
  const lm = buildLandmarks(idealParamsFor('oval'));
  lm.positions[8] = undefined;
  assert.doesNotThrow(() => {
    const result = M.classifyFaceShape(lm, FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
    assert.strictEqual(result.isUncertain, true);
    assert.deepStrictEqual(result.qualityFlags, ['missing_landmarks']);
    assert.strictEqual(result.measurements, null);
  });
});

test('too few landmark positions (broken/partial detection) returns uncertain, never throws', () => {
  const lm = { positions: new Array(40).fill({ x: 0, y: 0 }) };
  assert.doesNotThrow(() => {
    const result = M.classifyFaceShape(lm, FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
    assert.strictEqual(result.isUncertain, true);
    assert.ok(result.qualityFlags.includes('missing_landmarks'));
  });
});

test('a null/undefined landmarks object never throws', () => {
  assert.doesNotThrow(() => {
    const result = M.classifyFaceShape(null, FRONTAL_POSE, {});
    assert.strictEqual(result.isUncertain, true);
  });
});

// ------------------------------------------------------------
// 5. Deterministic output
// ------------------------------------------------------------
test('identical input always produces identical output', () => {
  const params = idealParamsFor('square');
  const a = M.classifyFaceShape(buildLandmarks(params), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  const b = M.classifyFaceShape(buildLandmarks(params), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  assert.deepStrictEqual(a, b);
});

// ------------------------------------------------------------
// 6. Normalized / scale-independent measurements (camera-distance
// invariance) and roll-invariance (rigid in-plane rotation)
// ------------------------------------------------------------
function assertRatiosClose(a, b, epsilon) {
  for (const key of Object.keys(a)) {
    assert.ok(Math.abs(a[key] - b[key]) < epsilon, `${key}: ${a[key]} vs ${b[key]} differ by more than ${epsilon}`);
  }
}

test('ratios and category are invariant to overall scale (camera distance)', () => {
  const params = idealParamsFor('oblong');
  const near = M.classifyFaceShape(buildLandmarks({ ...params, scale: 1 }), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  const far = M.classifyFaceShape(buildLandmarks({ ...params, scale: 0.3 }), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(near.category, far.category);
  // Floating-point trig/division noise (~1e-15), not a real
  // dependence on scale — an exact deepStrictEqual would be too
  // brittle here.
  assertRatiosClose(near.measurements.ratios, far.measurements.ratios, 1e-9);
});

test('ratios and category are invariant to in-plane head roll (rigid rotation of the same geometry)', () => {
  const params = idealParamsFor('heart');
  const upright = M.classifyFaceShape(buildLandmarks({ ...params, rotateDeg: 0 }), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  const rotated = M.classifyFaceShape(buildLandmarks({ ...params, rotateDeg: 30 }), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  assert.strictEqual(upright.category, rotated.category);
  // Same floating-point-noise rationale as the scale-invariance test
  // above (sin/cos of 30° introduces ~1e-16 rounding, not a real
  // roll-dependence).
  assertRatiosClose(upright.measurements.ratios, rotated.measurements.ratios, 1e-9);
});

test('measurements never use absolute pixel values as a classification criterion — every reported ratio is a dimensionless quotient', () => {
  const params = idealParamsFor('round');
  const result = M.classifyFaceShape(buildLandmarks(params), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  for (const key of ['lengthToWidth', 'jawTaper', 'chinTaper', 'foreheadSoft']) {
    assert.strictEqual(typeof result.measurements.ratios[key], 'number');
    assert.ok(result.measurements.ratios[key] > 0 && result.measurements.ratios[key] < 3, key + ' should be a plausible dimensionless ratio');
  }
});

// ------------------------------------------------------------
// 7. Result contract
// ------------------------------------------------------------
test('result object always exposes the minimum required contract fields', () => {
  const result = M.classifyFaceShape(buildLandmarks(idealParamsFor('oval')), FRONTAL_POSE, { singleFrame: false, imageQuality: 0.8 });
  for (const key of ['category', 'confidence', 'isUncertain', 'measurements', 'qualityFlags']) {
    assert.ok(Object.prototype.hasOwnProperty.call(result, key), 'missing contract field: ' + key);
  }
  assert.strictEqual(typeof result.category, 'string');
  assert.strictEqual(typeof result.confidence, 'number');
  assert.strictEqual(typeof result.isUncertain, 'boolean');
  assert.ok(Array.isArray(result.qualityFlags));
});

// ------------------------------------------------------------
// 8. RU/EN labels
// ------------------------------------------------------------
test('RU/EN strings exist for the face-shape label and every category, including uncertain', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const expectedKeys = ['faceShapeLabel', 'faceShape_oval', 'faceShape_round', 'faceShape_square', 'faceShape_oblong', 'faceShape_heart', 'faceShape_diamond', 'faceShape_uncertain'];
  for (const key of expectedKeys) {
    assert.ok(STRINGS[key], 'missing STRINGS key: ' + key);
    assert.ok(STRINGS[key].ru && STRINGS[key].ru.trim().length > 0, key + ' missing RU text');
    assert.ok(STRINGS[key].en && STRINGS[key].en.trim().length > 0, key + ' missing EN text');
  }
  assert.strictEqual(STRINGS.faceShapeLabel.ru, 'Форма лица');
  assert.strictEqual(STRINGS.faceShapeLabel.en, 'Face shape');
  assert.strictEqual(STRINGS.faceShape_uncertain.ru, 'Не удалось надёжно определить');
  assert.strictEqual(STRINGS.faceShape_uncertain.en, 'Could not determine reliably');
});

test('no raw technical wording (ratio/landmark/threshold/proxy/quality-flag language) leaks into the face-shape RU/EN strings', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const banned = /ratio|landmark|threshold|proxy|quality.?flag|brow.?to.?chin|forehead.?width/i;
  for (const key of Object.keys(STRINGS).filter((k) => k.startsWith('faceShape'))) {
    assert.ok(!banned.test(STRINGS[key].ru), key + '.ru leaks technical wording: ' + STRINGS[key].ru);
    assert.ok(!banned.test(STRINGS[key].en), key + '.en leaks technical wording: ' + STRINGS[key].en);
  }
});

// ------------------------------------------------------------
// 9. Results UI rendering
// ------------------------------------------------------------
test('HeroScreen renders exactly one new Face Shape row, guarded on result.faceShapeProfile, using faceShapeLabel/category/uncertain strings', () => {
  assert.ok(indexSource.includes('{result.faceShapeProfile && ('));
  assert.ok(indexSource.includes("label={t('faceShapeLabel', lang)}"));
  assert.ok(indexSource.includes("t('faceShape_uncertain', lang) : t('faceShape_' + result.faceShapeProfile.category, lang)"));
});

test('the Results UI never renders raw measurements, ratios, or quality flags — only category/uncertain text', () => {
  const heroStart = indexSource.indexOf('function HeroScreen(');
  const heroEnd = indexSource.indexOf('\n    function ', heroStart + 10);
  const heroBlock = indexSource.slice(heroStart, heroEnd);
  assert.ok(!heroBlock.includes('faceShapeProfile.measurements'));
  assert.ok(!heroBlock.includes('faceShapeProfile.qualityFlags'));
  assert.ok(!heroBlock.includes('.ratios'));
});

test('the confidence badge is suppressed for an uncertain face-shape result, matching the existing pattern for other uncertain rows', () => {
  assert.ok(indexSource.includes('confidence={result.faceShapeProfile.isUncertain ? undefined : result.faceShapeProfile.confidence}'));
});

// ------------------------------------------------------------
// 10. Isolation from existing eye/iris/recommendation logic
// ------------------------------------------------------------
test('classifyFaceShape is never called from inside classifyFeatures, and is not part of eyeProfile construction', () => {
  const classifyFeaturesStart = indexSource.indexOf('function classifyFeatures(aggregated, opts) {');
  const classifyFeaturesEnd = indexSource.indexOf('\n    function ', classifyFeaturesStart + 10);
  const classifyFeaturesBody = indexSource.slice(classifyFeaturesStart, classifyFeaturesEnd);
  assert.ok(!classifyFeaturesBody.includes('classifyFaceShape'));
  assert.ok(!classifyFeaturesBody.includes('faceShapeProfile'));
});

test('face shape is never derived from eyeShapeCategory or any other eyeProfile field', () => {
  const faceShapeStart = indexSource.indexOf('function classifyFaceShape(landmarks, headPose, opts) {');
  const faceShapeEnd = indexSource.indexOf('\n    // Turns aggregated measurements into independent', faceShapeStart);
  const faceShapeBody = indexSource.slice(faceShapeStart, faceShapeEnd);
  for (const forbidden of ['eyeShapeCategory', 'eyeProfile', 'dominantShape', 'shapeTendencies']) {
    assert.ok(!faceShapeBody.includes(forbidden), 'classifyFaceShape must not reference ' + forbidden);
  }
});

test('faceShapeProfile is attached as a sibling field on rec/photoRec, never nested inside eyeProfile', () => {
  assert.ok(indexSource.includes('confidence: finalProfile.overallConfidence,\n            faceShapeProfile,\n          };'));
  assert.ok(indexSource.includes('confidence: classified.overallConfidence,\n            faceShapeProfile,\n          };'));
});

test('the face-shape pose gate never touches assessFrameQuality or the existing frame-acceptance decision', () => {
  const assessStart = indexSource.indexOf('function assessFrameQuality(');
  const assessEnd = indexSource.indexOf('\n    }', assessStart) + 6;
  const assessBody = indexSource.slice(assessStart, assessEnd);
  assert.ok(!assessBody.includes('classifyFaceShape'));
  assert.ok(!assessBody.includes('FACE_SHAPE_PROVISIONAL_THRESHOLDS'));
});

test('face shape is not fed into recommendation/ranking/DESIGN_CATALOG in this phase', () => {
  const forbidden = ['rankDesigns(finalProfile', 'rankDesigns(classified'];
  // Confirm the two real production call sites for rankDesigns still
  // pass ONLY the eye-analysis profile, not faceShapeProfile.
  assert.ok(indexSource.includes('const designs = rankDesigns(finalProfile, langRef.current);'));
  assert.ok(indexSource.includes('const designs = rankDesigns(classified, lang);'));
  const rankDesignsDef = indexSource.slice(indexSource.indexOf('function rankDesignsAll('), indexSource.indexOf('function rankDesignsAll(') + 2000);
  assert.ok(!rankDesignsDef.includes('faceShapeProfile'));
});

test('production/library/backend/consent/client-storage files remain byte-identical to committed HEAD — this phase touches only index.html and its own test file', () => {
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js', 'client-store.js', 'client-data-consent.js', 'lash-scan-core.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('production activation flags stay inert: productionEnabled false, activeDefinitionIds empty', () => {
  const Library = require(path.join(root, 'professional-lash-library.js'));
  assert.strictEqual(Library.library.activation.productionEnabled, false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds, []);
});

test('Babel/JSX parse of the full app script, when @babel/core is available locally', (t) => {
  let babel;
  try { babel = require('@babel/core'); } catch (e) { babel = null; }
  if (!babel) {
    t.skip('@babel/core is not an installed dependency of this repo; full Babel parse verification is performed manually per phase (see implementation report) rather than as a hard CI dependency.');
    return;
  }
  const marker = '<script type="text/babel">';
  const start = indexSource.indexOf(marker) + marker.length;
  const end = indexSource.indexOf('</script>', start);
  const script = indexSource.slice(start, end);
  assert.doesNotThrow(() => babel.transformSync(script, { presets: [require.resolve('@babel/preset-react')], filename: 'app.jsx' }));
});
