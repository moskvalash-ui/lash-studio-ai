// ============================================================
// RESULTS-SCREEN EYELID TYPE WIRING — regression tests.
// ------------------------------------------------------------
// Audit turn: verifies the REAL production label mapper
// (eyeProfileLabels) correctly renders every eyelidType value
// classifyFeatures can produce, including 'openCrease' — the value
// from the real iPhone capture under investigation. No code was
// changed this turn (see the deliverable report) — these tests exist
// to lock in proof that the wiring is already correct, and to catch
// any future regression in it.
//
// Tests the ACTUAL mapper function extracted straight out of
// index.html (same technique as every other test file in this
// project) — never a hand-duplicated copy of its ternary chain.
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

// ---- Extract the REAL eyeProfileLabels mapper and everything it
// depends on (STRINGS/t, IRIS_NAMES, TILT_CONFIDENCE_FLOOR) straight
// out of index.html — three separate contiguous slices concatenated
// in dependency order, since huge JSX-heavy screen components sit
// textually between them, making one single slice impossible. ----
const stringsStart = src.indexOf('    const STRINGS = {');
const stringsAndTEnd = src.indexOf('\n\n    // Raw-metrics DEBUG/EXPLAINABILITY panel');
const stringsAndTSrc = src.slice(stringsStart, stringsAndTEnd);

const irisNamesStart = src.indexOf('    const IRIS_NAMES = {');
const irisNamesEnd = src.indexOf('\n    function classifyIrisColor(');
const irisNamesSrc = src.slice(irisNamesStart, irisNamesEnd);

const tiltFloorStart = src.indexOf('    const TILT_CONFIDENCE_FLOOR = 0.22;');
const eyeProfileLabelsEnd = src.indexOf('\n\n    // ---- Eye Highlight ----');
const eyeProfileLabelsSrc = src.slice(tiltFloorStart, eyeProfileLabelsEnd);

if ([stringsStart, stringsAndTEnd, irisNamesStart, irisNamesEnd, tiltFloorStart, eyeProfileLabelsEnd].some(i => i === -1)) {
  throw new Error('Could not locate one or more source blocks for eyeProfileLabels extraction — have they moved? Update the markers above.');
}

const { eyeProfileLabels, STRINGS, t } = new Function(
  stringsAndTSrc + '\n' + irisNamesSrc + '\n' + eyeProfileLabelsSrc + '\nreturn { eyeProfileLabels, STRINGS, t };'
)();

test('setup: extracted the real eyeProfileLabels mapper from index.html successfully', () => {
  assert.strictEqual(typeof eyeProfileLabels, 'function');
  assert.strictEqual(typeof STRINGS, 'object');
});

// ---- Fixture: a plausible full `p` (classifyFeatures result shape)
// with only eyelidType/eyelidSignalsConflict varied per test. ----
function fakeProfile({ eyelidType = 'uncertain', eyelidSignalsConflict = false } = {}) {
  return {
    eyeShapeCategory: 'almond', tiltTendency: 'neutral', tiltConfidence: 0.8,
    eyelidCategory: 'open', eyelidType, eyelidSignalsConflict,
    eyeSetCategory: 'balanced', eyeSizeCategory: 'medium', symmetryCategory: 'balanced',
  };
}

// ================================================================
// A/B — openCrease reaches the real mapper unchanged and renders the
// intended RU label.
// ================================================================
test('A/B. eyelidType="openCrease" reaches eyeProfileLabels unchanged and renders the intended RU label', () => {
  const p = fakeProfile({ eyelidType: 'openCrease', eyelidSignalsConflict: false });
  const labels = eyeProfileLabels(p, null, 'ru');
  assert.strictEqual(labels.eyelidTypeRawLabel, 'Открытая складка (видна чётко)');
  assert.strictEqual(labels.eyelidTypeLabel, 'Открытая складка (видна чётко)', 'eyelidSignalsConflict is false, so the displayed label must equal the raw label, not fall back to "needs confirmation"');
});

// ================================================================
// C — openCrease renders the intended EN label.
// ================================================================
test('C. eyelidType="openCrease" renders the intended EN label', () => {
  const p = fakeProfile({ eyelidType: 'openCrease' });
  const labels = eyeProfileLabels(p, null, 'en');
  assert.strictEqual(labels.eyelidTypeLabel, 'Visible / open crease');
});

// ================================================================
// D/E/F — hooded / monolid / uncertain still map correctly.
// ================================================================
test('D. eyelidType="hooded" renders the intended RU/EN labels', () => {
  const p = fakeProfile({ eyelidType: 'hooded' });
  assert.strictEqual(eyeProfileLabels(p, null, 'ru').eyelidTypeLabel, 'Нависшее веко (складка скрыта)');
  assert.strictEqual(eyeProfileLabels(p, null, 'en').eyelidTypeLabel, 'Hooded eyelid');
});
test('E. eyelidType="monolid" renders the intended RU/EN labels', () => {
  const p = fakeProfile({ eyelidType: 'monolid' });
  assert.strictEqual(eyeProfileLabels(p, null, 'ru').eyelidTypeLabel, 'Монолид (складка не выявлена)');
  assert.strictEqual(eyeProfileLabels(p, null, 'en').eyelidTypeLabel, 'Monolid / no visible crease');
});
test('F. eyelidType="uncertain" renders the intended RU/EN labels', () => {
  const p = fakeProfile({ eyelidType: 'uncertain' });
  assert.strictEqual(eyeProfileLabels(p, null, 'ru').eyelidTypeLabel, 'Требует визуального подтверждения');
  assert.strictEqual(eyeProfileLabels(p, null, 'en').eyelidTypeLabel, 'Needs visual confirmation');
});
test('F2. eyelidSignalsConflict=true suppresses ANY eyelidType (including openCrease) to the "needs confirmation" label, by design', () => {
  const p = fakeProfile({ eyelidType: 'openCrease', eyelidSignalsConflict: true });
  const labels = eyeProfileLabels(p, null, 'ru');
  assert.strictEqual(labels.eyelidTypeRawLabel, 'Открытая складка (видна чётко)', 'the raw label must still reflect the true computed value');
  assert.strictEqual(labels.eyelidTypeLabel, 'Требует визуального подтверждения', 'but the DISPLAYED label is intentionally suppressed when signals conflict');
});

// ================================================================
// G — a valid eyelidType is not overwritten by fallback/default
// state anywhere between classifyFeatures and the mapper.
// ================================================================
test('G. classifyFeatures never produces an eyelidType value the mapper doesn\'t recognize (closed 4-value enum, no silent fallback gap)', () => {
  const declStart = src.indexOf('      let eyelidType;');
  const declEnd = src.indexOf('\n\n      // ---- Confidence, computed AFTER classification', declStart);
  const block = src.slice(declStart, declEnd);
  const assigned = [...block.matchAll(/eyelidType = '(\w+)';/g)].map(m => m[1]);
  const uniqueAssigned = [...new Set(assigned)];
  assert.deepStrictEqual(uniqueAssigned.sort(), ['hooded', 'monolid', 'openCrease', 'uncertain'].sort(),
    'classifyFeatures\' eyelidType decision tree must only ever assign one of the 4 values the mapper/translations/ReviewScreen dropdown all recognize');
});
test('G2. result.eyeProfile is assigned directly from classifyFeatures\' own return value at both write sites, no intermediate transform/default object', () => {
  const liveIdx = src.indexOf("source: 'live', eyeProfile: classified,");
  const photoIdx = src.indexOf("source: 'photo', eyeProfile: classified,");
  assert.ok(liveIdx !== -1, 'expected LiveScanScreen\'s rec.eyeProfile = classified assignment');
  assert.ok(photoIdx !== -1, 'expected PhotoAnalysisScreen\'s rec.eyeProfile = classified assignment');
});
test('G3. ReviewScreen seeds its editable eyelidType field from the real AI result, and the confirmed profile keeps it unless the artist changes it', () => {
  const rsStart = src.indexOf('function ReviewScreen(');
  const rsEnd = src.indexOf('\n    function App(');
  const rsSrc = src.slice(rsStart, rsEnd);
  assert.ok(/eyelidType:\s*initial\.eyelidType/.test(rsSrc), 'ReviewScreen must seed its eyelidType dropdown from initial.eyelidType (the real classifyFeatures result)');
  assert.ok(/confirmedProfile\s*=\s*\{\s*\.\.\.initial,\s*\.\.\.values,/.test(rsSrc), 'the confirmed profile must spread ...initial then ...values, so an unedited field keeps the AI value, not a default');
});

// ================================================================
// H — debug experimental state cannot affect ResultsScreen.
// ================================================================
test('H. eyeProfileLabels never references any experimental/debug identifier', () => {
  assert.ok(!/debugEyelidCompare|experimentalType|currentClassified|resolveEyelidCreaseEvidence|computeExperimentalEyelidType/.test(eyeProfileLabelsSrc),
    'eyeProfileLabels must be computed purely from the real p.eyelidType/p.eyelidSignalsConflict, never from the debug experimental layer');
});
test('H2. ReviewScreen never references any experimental/debug identifier', () => {
  const rsStart = src.indexOf('function ReviewScreen(');
  const rsEnd = src.indexOf('\n    function App(');
  const rsSrc = src.slice(rsStart, rsEnd);
  assert.ok(!/debugEyelidCompare|experimentalType|currentClassified|resolveEyelidCreaseEvidence|computeExperimentalEyelidType/.test(rsSrc),
    'ReviewScreen must only ever read result.eyeProfile (the real production classifyFeatures result)');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
