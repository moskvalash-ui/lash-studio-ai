// ============================================================
// PRODUCT SEMANTICS SPLIT — creaseState / hoodingState regression
// tests (manual hooding confirmation turn).
// ------------------------------------------------------------
// Two things are exercised here, both extracted straight out of
// index.html (same technique as every other test file in this
// project — never a hand-duplicated copy):
//
//  1. classifyFeatures' new, purely-additive creaseState/hoodingState
//     fields (tests A/C/F/G/H/I/J) — via the real function.
//  2. ReviewScreen's confirm() derivation logic (tests A/B/D/E/I/J) —
//     via a source-level extraction of the exact
//     `const confirm = () => { ... const confirmedProfile = {...} }`
//     block (the same block index.html actually runs), evaluated as
//     a standalone (initial, values) -> confirmedProfile function.
//     rankDesigns()/onConfirm() (UI wiring, unrelated to this turn's
//     logic and heavy to stub) are intentionally outside the
//     extracted range — confirmedProfile is the object under test.
//
// LOCAL ONLY. Not wired into any CI/deploy step this turn.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

// ---- Extract classifyFeatures (unchanged technique) ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');
if (cfStart === -1 || cfEnd === -1) throw new Error('Could not locate the classifyFeatures pipeline block — has it moved?');
const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;
const { classifyFeatures } = new Function(reactStubs + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();

test('setup: extracted real classifyFeatures from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
});

// ---- Extract ReviewScreen's real confirm() derivation block ----
const confirmStart = src.indexOf('      const confirm = () => {');
const confirmedProfileDeclEnd = src.indexOf('        };', src.indexOf('const confirmedProfile = {', confirmStart)) + '        };'.length;
if (confirmStart === -1 || confirmedProfileDeclEnd === -1) throw new Error('Could not locate ReviewScreen\'s confirm()/confirmedProfile block — has it moved?');
const confirmBodySrc = src.slice(confirmStart, confirmedProfileDeclEnd)
  .replace('const confirm = () => {', '')
  .trim()
  .replace(/;$/, ';\nreturn confirmedProfile;');
const buildConfirmedProfile = new Function('initial', 'values', confirmBodySrc);

test('setup: extracted real ReviewScreen confirm()/confirmedProfile derivation from index.html successfully', () => {
  assert.strictEqual(typeof buildConfirmedProfile, 'function');
});

function eyeMetrics({
  covCenter, covInner, covOuter, covByHeight, ear = 0.28,
  creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6,
} = {}) {
  const cc = covCenter ?? 0.44;
  return {
    width: 30, height: 12, ear, widthRatio: 0.42, tiltCorrected: 0,
    hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
    covCenterByWidth: cc, covInnerByWidth: covInner ?? cc, covOuterByWidth: covOuter ?? cc,
    covByHeight: covByHeight ?? (cc / 0.36),
    apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70,
    creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality,
  };
}
function classify(leftOverrides, rightOverrides) {
  const left = eyeMetrics(leftOverrides);
  const right = eyeMetrics(rightOverrides || leftOverrides);
  const aggregated = { left, right, interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  return classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
}
const CLEAR = { creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseReadQuality: 0.7 };
function coverageForCategory(category) {
  return { pronounced: 0.15, moderate: 0.24, mild: 0.32, open: 0.44 }[category];
}

// REAL 18-frame aggregate (the reported bug's exact numbers).
const REAL_LEFT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9445, covInner: 0.8285, covOuter: 0.9293, covByHeight: 2.8144, ear: 0.3354 };
const REAL_RIGHT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9401, covInner: 0.8368, covOuter: 0.8682, covByHeight: 2.8362, ear: 0.3314 };

// ================================================================
// A. visible crease + hooded confirmation
// ================================================================
test('A. visible crease + hooded confirmation -> creaseState=visible, hoodingState=hooded, isHooded=true', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  assert.strictEqual(initial.creaseState, 'visible');
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: initial.eyelidType, hoodingState: 'hooded', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  assert.strictEqual(confirmed.creaseState, 'visible', 'creaseState is carried through from initial (read-only, not edited by this turn)');
  assert.strictEqual(confirmed.hoodingState, 'hooded');
  assert.strictEqual(confirmed.isHooded, true);
});

// ================================================================
// B. visible crease + nonHooded confirmation
// ================================================================
test('B. visible crease + nonHooded confirmation -> isHooded=false', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: initial.eyelidType, hoodingState: 'nonHooded', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  assert.strictEqual(confirmed.hoodingState, 'nonHooded');
  assert.strictEqual(confirmed.isHooded, false);
  assert.strictEqual(confirmed.hoodedConfidence, 0.8, 'a confirmed nonHooded is just as confidently known as confirmed hooded, not the old low 0.25');
});

// ================================================================
// C. visible crease + no confirmation -> hoodingState=uncertain
// ================================================================
test('C. visible crease + no confirmation (fresh automatic classifyFeatures result) -> hoodingState=uncertain', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  assert.strictEqual(initial.creaseState, 'visible');
  assert.strictEqual(initial.hoodingState, 'uncertain', 'the automatic pipeline never asserts a confident hoodingState — see the hooding audit');
});

// ================================================================
// D. unsure cannot create a confident hooded recommendation input
// ================================================================
test('D. "unsure" confirmation cannot create a confident hooded recommendation input', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: initial.eyelidType, hoodingState: 'uncertain', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  assert.strictEqual(confirmed.isHooded, false, 'recommendations must never see a confident isHooded=true from an unconfirmed/unsure read');
  assert.strictEqual(confirmed.hoodedConfidence, 0.25, 'reuses the app\'s existing not-confident-enough convention, not a new threshold');
});

// ================================================================
// E. hooded manual confirmation overrides old automatic open geometry
// ================================================================
test('E. hooded manual confirmation overrides the old automatic open-geometry read', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  assert.strictEqual(initial.eyelidCategory, 'open', 'sanity: the automatic Signal-B geometry read is still the audited, unfixed "open" — proves this test is a real override, not a no-op');
  assert.strictEqual(initial.isHooded, false);
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: initial.eyelidType, hoodingState: 'hooded', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  assert.strictEqual(confirmed.isHooded, true, 'manual confirmation must win over the unreliable automatic geometry read');
});

// ================================================================
// F. monolid behavior unchanged
// ================================================================
test('F. monolid classification (crease confidently absent + open geometry) is unchanged by this turn', () => {
  const NONE_HQ = { creaseValid: 1, creasePeak: 0.5, creaseProminence: 0.3, creaseReadQuality: 0.6 };
  const cov = coverageForCategory('open');
  const c = classify({ ...NONE_HQ, covCenter: cov, covInner: cov, covOuter: cov });
  assert.strictEqual(c.eyelidType, 'monolid');
  assert.strictEqual(c.creaseState, 'absent');
  assert.strictEqual(c.isHooded, false);
  // Confirming a monolid client as explicitly non-hooded must not be
  // blocked or altered by the new hoodingState field.
  const values = { eyeShapeCategory: c.eyeShapeCategory, eyelidType: c.eyelidType, hoodingState: 'nonHooded', eyeSetCategory: c.eyeSetCategory, tiltTendency: c.tiltTendency, eyeSizeCategory: c.eyeSizeCategory, symmetryCategory: c.symmetryCategory };
  const confirmed = buildConfirmedProfile(c, values);
  assert.strictEqual(confirmed.eyelidType, 'monolid');
  assert.strictEqual(confirmed.isHooded, false);
});

// ================================================================
// G. RU labels correct
// ================================================================
test('G. RU labels correct for creaseState/hoodingState (via the real eyeProfileLabels mapper)', () => {
  const stringsStart = src.indexOf('    const STRINGS = {');
  const stringsAndTEnd = src.indexOf('\n\n    // Raw-metrics DEBUG/EXPLAINABILITY panel');
  const irisNamesStart = src.indexOf('    const IRIS_NAMES = {');
  const irisNamesEnd = src.indexOf('\n    function classifyIrisColor(');
  const tiltFloorStart = src.indexOf('    const TILT_CONFIDENCE_FLOOR = 0.22;');
  const eyeProfileLabelsEnd = src.indexOf('\n\n    // ---- Eye Highlight ----');
  const { eyeProfileLabels } = new Function(
    src.slice(stringsStart, stringsAndTEnd) + '\n' + src.slice(irisNamesStart, irisNamesEnd) + '\n' + src.slice(tiltFloorStart, eyeProfileLabelsEnd) + '\nreturn { eyeProfileLabels };'
  )();
  const p = { eyeShapeCategory: 'almond', tiltTendency: 'neutral', tiltConfidence: 0.8, creaseState: 'visible', hoodingState: 'hooded', eyeSetCategory: 'balanced', eyeSizeCategory: 'medium', symmetryCategory: 'balanced' };
  const labels = eyeProfileLabels(p, null, 'ru');
  assert.strictEqual(labels.creaseStateLabel, 'Видимая складка');
  assert.strictEqual(labels.hoodingStateLabel, 'Нависшее');
  const pUncertain = { ...p, creaseState: 'uncertain', hoodingState: 'uncertain' };
  const labelsU = eyeProfileLabels(pUncertain, null, 'ru');
  assert.strictEqual(labelsU.creaseStateLabel, 'Требует подтверждения');
  assert.strictEqual(labelsU.hoodingStateLabel, 'Требует подтверждения');
});

// ================================================================
// H. EN labels correct
// ================================================================
test('H. EN labels correct for creaseState/hoodingState (via the real eyeProfileLabels mapper)', () => {
  const stringsStart = src.indexOf('    const STRINGS = {');
  const stringsAndTEnd = src.indexOf('\n\n    // Raw-metrics DEBUG/EXPLAINABILITY panel');
  const irisNamesStart = src.indexOf('    const IRIS_NAMES = {');
  const irisNamesEnd = src.indexOf('\n    function classifyIrisColor(');
  const tiltFloorStart = src.indexOf('    const TILT_CONFIDENCE_FLOOR = 0.22;');
  const eyeProfileLabelsEnd = src.indexOf('\n\n    // ---- Eye Highlight ----');
  const { eyeProfileLabels } = new Function(
    src.slice(stringsStart, stringsAndTEnd) + '\n' + src.slice(irisNamesStart, irisNamesEnd) + '\n' + src.slice(tiltFloorStart, eyeProfileLabelsEnd) + '\nreturn { eyeProfileLabels };'
  )();
  const p = { eyeShapeCategory: 'almond', tiltTendency: 'neutral', tiltConfidence: 0.8, creaseState: 'absent', hoodingState: 'nonHooded', eyeSetCategory: 'balanced', eyeSizeCategory: 'medium', symmetryCategory: 'balanced' };
  const labels = eyeProfileLabels(p, null, 'en');
  assert.strictEqual(labels.creaseStateLabel, 'No visible crease');
  assert.strictEqual(labels.hoodingStateLabel, 'No obvious hooding');
});

// ================================================================
// I. ResultsScreen no longer implies openCrease == non-hooded
// ================================================================
test('I. openCrease + confirmed hooded is representable at once (ResultsScreen no longer implies openCrease == non-hooded)', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  assert.strictEqual(initial.eyelidType, 'openCrease', 'sanity: this is the exact reported-bug fixture, still openCrease under the (unmodified) old enum');
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: initial.eyelidType, hoodingState: 'hooded', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  // Old collapsed enum still says "openCrease" (kept for backward
  // compat) AND the new split model simultaneously says hooded=true —
  // proving the two are no longer mutually exclusive in the confirmed
  // profile ResultsScreen (HeroScreen/DetailsScreen) actually renders.
  assert.strictEqual(confirmed.eyelidType, 'openCrease');
  assert.strictEqual(confirmed.creaseState, 'visible');
  assert.strictEqual(confirmed.hoodingState, 'hooded');
  assert.strictEqual(confirmed.isHooded, true);
});

// ================================================================
// J. old eyelidType remains backward compatible
// ================================================================
test('J. old eyelidType field remains present, editable, and correctly wired for backward compatibility', () => {
  const initial = classify(REAL_LEFT, REAL_RIGHT);
  const values = { eyeShapeCategory: initial.eyeShapeCategory, eyelidType: 'hooded', hoodingState: 'uncertain', eyeSetCategory: initial.eyeSetCategory, tiltTendency: initial.tiltTendency, eyeSizeCategory: initial.eyeSizeCategory, symmetryCategory: initial.symmetryCategory };
  const confirmed = buildConfirmedProfile(initial, values);
  assert.strictEqual(confirmed.eyelidType, 'hooded', 'the legacy eyelidType dropdown is still independently editable and still flows through to confirmedProfile');
  assert.strictEqual(confirmed.eyelidCategory, 'moderate', 'the legacy eyelidCategory bucket is still derived from eyelidType exactly as before, for old/debug-panel consumers');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
