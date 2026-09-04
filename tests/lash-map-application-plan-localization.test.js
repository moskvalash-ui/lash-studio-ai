// ============================================================
// LASH MAP LOCALIZATION — FOLLOW-UP: recommendation/Application Plan
// text generation.
// ------------------------------------------------------------
// The prior "Localize Lash Map labels" turn (commit d8fa467) deliberately
// left generateLashDesignConsiderations/generateLegacyApplicationPlan
// untouched, scoped as "recommendation logic". A production audit
// (real deployed page verified byte-identical to HEAD, ruling out any
// deploy/cache cause) proved these two functions are reachable in the
// SAME real user flow (HeroScreen's "Lash Design Considerations" panel,
// shown right after every scan; and LashMapScreen's own Application
// Plan section) and were still embedding the raw English ZONE_NAMES
// array (and, in one spot, hand-typed "LEFT"/"RIGHT") directly into
// RU-language sentences, bypassing the zoneLabel()/t() layer entirely.
//
// THIS FIX: every raw ZONE_NAMES/spikeGeom.mainSpikeZone substitution
// reachable in RU output, plus the three step-title STRINGS entries
// that embedded raw English, plus the one hand-typed "LEFT и RIGHT"
// artist note, now route through the existing zoneLabel()/t() layer or
// natural Russian wording. EN output is untouched byte-for-byte
// (verified below) -- ZONE_NAMES itself, geometry, zone values, peak
// position, lengths, curls, recommendation scoring, and every other
// system are untouched.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// ---- Real STRINGS / t() / ZONE_LABEL_KEYS / zoneLabel() / ZONE_NAMES,
// extracted straight out of index.html (same technique as
// tests/lash-map-localization.test.js) so these tests exercise the
// actual production localization layer, never a duplicated formula. ----
function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(braceStart, i + 1);
}
const stringsLiteral = extractObjectLiteral('STRINGS');
const tFnStart = src.indexOf('function t(key, lang)');
const tFnLine = src.slice(tFnStart, src.indexOf('\n', tFnStart));
const zoneKeysStart = src.indexOf('const ZONE_LABEL_KEYS = {');
const zoneKeysLine = src.slice(zoneKeysStart, src.indexOf('\n', zoneKeysStart));
const zoneFnStart = src.indexOf('function zoneLabel(name, lang)');
const zoneFnLine = src.slice(zoneFnStart, src.indexOf('\n', zoneFnStart));
assert.ok(stringsLiteral.length > 0 && tFnStart >= 0 && zoneKeysStart >= 0 && zoneFnStart >= 0, 'localization primitives must be structurally extractable');
const { t, zoneLabel, STRINGS } = new Function(
  `const STRINGS = ${stringsLiteral};\n${tFnLine}\n${zoneKeysLine}\n${zoneFnLine}\nreturn { t, zoneLabel, STRINGS };`
)();

const zoneNamesStart = src.indexOf('    const ZONE_NAMES = ');
const ZONE_NAMES = new Function(src.slice(zoneNamesStart, src.indexOf('\n', zoneNamesStart)) + '\nreturn ZONE_NAMES;')();

// ---- generateLegacyApplicationPlan / computeSpikeGeometry, extracted
// with the REAL t()/zoneLabel() wired in (unlike
// tests/application-plan-canonical.test.js, which deliberately injects
// a `t` STUB since it only cares about structural byte-parity, not
// real RU/EN text) -- same span boundaries as that file. ----
const planStart = src.indexOf('    function pseudoJitter(');
const planEnd = src.indexOf('\n    // ------------------------------------------------------------\n    // Coordinate transform', planStart);
assert.ok(planStart >= 0 && planEnd > planStart, 'the application-plan span must be structurally extractable');
const { computeSpikeGeometry, generateLegacyApplicationPlan } = new Function(
  't', 'ZONE_NAMES', 'expandLashMapSectors', 'zoneLabel',
  src.slice(planStart, planEnd) + '\nreturn {computeSpikeGeometry, generateLegacyApplicationPlan};'
)(t, ZONE_NAMES, (zones, peakIdx) => zones.map((len, i) => ({ len, t: i / (zones.length - 1), isPeak: i === peakIdx })), zoneLabel);

// ---- generateLashDesignConsiderations, extracted with STUBBED
// DESIGN_CATALOG/buildDesignResult/canonicalRecommendationProps --
// this fix touches only how the already-computed `d` fields (peakZone/
// lengthDistribution) are turned into text, not the recommendation
// engine itself, so the engine is stubbed with controlled, predictable
// output rather than re-deriving the real 21-design catalog here. ----
const considerationsStart = src.indexOf('    const LASH_DESIGN_CONSIDERATION_IDS = ');
const considerationsEnd = src.indexOf('\n\n    // ---- Lash Correction Opportunity', considerationsStart);
assert.ok(considerationsStart >= 0 && considerationsEnd > considerationsStart, 'the Lash Design Considerations span must be structurally extractable');
const FAKE_CATALOG = ['natural', 'squirrel', 'softcat', 'doll', 'wispy'].map(id => ({ id }));
function fakeBuildDesignResult(entry) { return { id: entry.id }; }
function fakeCanonicalRecommendationProps(legacyDesign) {
  return {
    id: legacyDesign.id, name: legacyDesign.id, score: 70,
    whyItWorks: 'goal text', peakZone: 3,
    leftZones: [5, 6, 8, 11, 9], rightZones: [5, 6, 8, 10, 9],
    curlRec: { primary: 'C', alternatives: ['CC'] }, limitations: [],
  };
}
const { generateLashDesignConsiderations } = new Function(
  'DESIGN_CATALOG', 'buildDesignResult', 'canonicalRecommendationProps', 'ZONE_NAMES', 'zoneLabel', 't',
  src.slice(considerationsStart, considerationsEnd) + '\nreturn { generateLashDesignConsiderations };'
)(FAKE_CATALOG, fakeBuildDesignResult, fakeCanonicalRecommendationProps, ZONE_NAMES, zoneLabel, t);

const RAW_ZONE_TOKENS = /\b(INNER|TRANSITION|BODY|PEAK|OUTER)\b/;
const RAW_SIDE_TOKENS = /\bLEFT\b|\bRIGHT\b/;

// ================================================================
// 1. generateLashDesignConsiderations(result, 'ru')
// ================================================================
test('1a. RU: no raw INNER/TRANSITION/BODY/PEAK/OUTER anywhere in the result', () => {
  const result = generateLashDesignConsiderations({ eyeProfile: {} }, 'ru');
  for (const d of result) {
    assert.ok(!RAW_ZONE_TOKENS.test(d.peakZone), `peakZone leaked a raw zone token: ${d.peakZone}`);
    assert.ok(!RAW_ZONE_TOKENS.test(d.lengthDistribution), `lengthDistribution leaked a raw zone token: ${d.lengthDistribution}`);
  }
});
test('1b. RU: peakZone is localized to the real Russian zone word', () => {
  const result = generateLashDesignConsiderations({ eyeProfile: {} }, 'ru');
  for (const d of result) assert.strictEqual(d.peakZone, 'ПИК'); // index 3 of ZONE_NAMES, per the fake fixture
});
test('1c. RU: lengthDistribution is fully localized (all three embedded zone names)', () => {
  const result = generateLashDesignConsiderations({ eyeProfile: {} }, 'ru');
  for (const d of result) {
    assert.strictEqual(d.lengthDistribution, 'ВНУТРЕННЯЯ 5мм → ПИК 11мм → ВНЕШНЯЯ 9мм');
  }
});
test('1d. EN: generateLashDesignConsiderations output is byte-identical to the pre-fix behavior', () => {
  const result = generateLashDesignConsiderations({ eyeProfile: {} }, 'en');
  for (const d of result) {
    assert.strictEqual(d.peakZone, 'PEAK');
    assert.strictEqual(d.lengthDistribution, 'INNER 5mm → PEAK 11mm → OUTER 9mm');
  }
});

// ================================================================
// 2. generateLegacyApplicationPlan(..., 'ru')
// ================================================================
const profile = { compositeAsymmetry: 0.12, isCloseSet: false }; // > 0.07 -> asym branch (LEFT/RIGHT artist note)
const design = { name: 'Fox', limitations: [], correctionGoal: 'Correction goal.' };
const zones = [5, 6, 8, 11, 9];
const otherZones = [5, 6, 8, 11, 9];
const curve = { zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' };
function plan(lang, spikeGeom) {
  return generateLegacyApplicationPlan(profile, design, 'Classic 1:1', 'C', zones, otherZones, spikeGeom || null, curve, lang);
}

test('2a. RU: preparation contains no raw zone keys', () => {
  const p = plan('ru');
  for (const line of p.preparation) assert.ok(!RAW_ZONE_TOKENS.test(line), `preparation leaked a raw zone token: ${line}`);
});
test('2b. RU: steps[].title contains no raw zone keys', () => {
  const p = plan('ru');
  for (const step of p.steps) assert.ok(!RAW_ZONE_TOKENS.test(step.title), `step title leaked a raw zone token: ${step.title}`);
});
test('2c. RU: steps[].body contains no raw zone keys', () => {
  const p = plan('ru');
  for (const step of p.steps) assert.ok(!RAW_ZONE_TOKENS.test(step.body), `step body leaked a raw zone token: ${step.body}`);
});
test('2d. RU: spikePlan.notes contains no raw zone keys', () => {
  const p = plan('ru', { baseMin: 5, baseMax: 6, spikeMin: 9, spikeMax: 11, diff: 3, count: 12, mainSpikeZone: 'PEAK', pattern: 'manga' });
  assert.ok(p.spikePlan, 'sanity: spikePlan must be built for this fixture');
  for (const note of p.spikePlan.notes) assert.ok(!RAW_ZONE_TOKENS.test(note), `spike note leaked a raw zone token: ${note}`);
});
test('2e. RU: artistNotes contains no raw LEFT/RIGHT', () => {
  const p = plan('ru');
  for (const note of p.artistNotes) assert.ok(!RAW_SIDE_TOKENS.test(note), `artist note leaked a raw side token: ${note}`);
});
test('2f. RU: the exact preparation zone-marking line reads real Russian zone names', () => {
  const p = plan('ru');
  assert.ok(p.preparation.some(line => line === 'Выполните разметку зон: ВНУТРЕННЯЯ / ПЕРЕХОД / ОСНОВНАЯ ЗОНА / ПИК / ВНЕШНЯЯ.'));
});
test('2g. RU: the peak-zone step body is localized', () => {
  const p = plan('ru');
  const peakStep = p.steps.find(s => s.body.includes('Пиковая зона'));
  assert.ok(peakStep, 'sanity: the peak step must exist');
  assert.ok(peakStep.body.includes('Пиковая зона: ПИК,'), peakStep.body);
});
test('2h. RU: the mapping step body localizes every one of the five embedded zone names', () => {
  const p = plan('ru');
  const mappingStep = p.steps.find(s => s.body.includes('пяти контрольным зонам'));
  assert.ok(mappingStep, 'sanity: the mapping step must exist');
  for (const ru of ['ВНУТРЕННЯЯ', 'ПЕРЕХОД', 'ОСНОВНАЯ ЗОНА', 'ПИК', 'ВНЕШНЯЯ']) assert.ok(mappingStep.body.includes(ru), `expected "${ru}" in: ${mappingStep.body}`);
});
test('2i. RU: an asymmetric design\'s artist note uses natural Russian wording for both eyes, not "LEFT и RIGHT"', () => {
  const p = plan('ru');
  assert.ok(p.artistNotes.some(n => n.includes('левого и правого глаза')));
  assert.ok(!p.artistNotes.some(n => n.includes('LEFT и RIGHT')));
});
test('2j. RU: step titles (STRINGS) no longer embed raw English', () => {
  for (const key of ['stepBodyTitle', 'stepPeakTitle', 'stepOuterTitle']) {
    assert.ok(!RAW_ZONE_TOKENS.test(t(key, 'ru')), `${key} RU still contains a raw zone token: ${t(key, 'ru')}`);
  }
  assert.strictEqual(t('stepBodyTitle', 'ru'), 'ШАГ 3 — ПЕРЕХОД / ОСНОВНАЯ ЗОНА');
  assert.strictEqual(t('stepPeakTitle', 'ru'), 'ШАГ 4 — ПИК');
  assert.strictEqual(t('stepOuterTitle', 'ru'), 'ШАГ 5 — ВНЕШНЯЯ');
});

// ================================================================
// 3. EN regression — byte-identical to pre-fix behavior.
// ================================================================
test('3a. EN: preparation/steps/artistNotes remain byte-identical to the documented pre-fix strings', () => {
  const p = plan('en');
  assert.ok(p.preparation.some(line => line === 'Mark the zones: INNER / TRANSITION / BODY / PEAK / OUTER.'));
  const mappingStep = p.steps.find(s => s.body.includes('five control zones'));
  assert.ok(mappingStep.body.startsWith('Divide the lash line using the five control zones (INNER 5mm, TRANSITION 6mm, BODY 8mm, PEAK 11mm, OUTER 9mm)'));
  const peakStep = p.steps.find(s => s.body.startsWith('Peak zone:'));
  assert.strictEqual(peakStep.body.slice(0, 'Peak zone: PEAK, 11mm.'.length), 'Peak zone: PEAK, 11mm.');
  assert.ok(p.artistNotes.some(n => n === 'With pronounced asymmetry, applying identical correction to LEFT and RIGHT is not recommended.'));
});
test('3b. EN: step-title STRINGS entries are byte-identical to before this fix', () => {
  assert.strictEqual(t('stepBodyTitle', 'en'), 'STEP 3 — TRANSITION / BODY');
  assert.strictEqual(t('stepPeakTitle', 'en'), 'STEP 4 — PEAK');
  assert.strictEqual(t('stepOuterTitle', 'en'), 'STEP 5 — OUTER');
});
test('3c. EN: spikePlan note is byte-identical to before this fix', () => {
  const p = plan('en', { baseMin: 5, baseMax: 6, spikeMin: 9, spikeMax: 11, diff: 3, count: 12, mainSpikeZone: 'PEAK', pattern: 'manga' });
  assert.ok(p.spikePlan.notes.some(n => n === 'Recommended to place the main spike in the PEAK zone, aligned with the map\'s peak.'));
});

// ================================================================
// 4. Isolation — geometry/scoring/zone-value untouched.
// ================================================================
test('4a. ZONE_NAMES itself is untouched (still the raw English engine key set)', () => {
  assert.deepStrictEqual(ZONE_NAMES, ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
});
test('4b. this fix does not alter any numeric zone length/peak index — RU and EN plans differ only in text', () => {
  const ru = plan('ru'), en = plan('en');
  assert.deepStrictEqual(ru.displaySectors.map(s => s.len), en.displaySectors.map(s => s.len));
  assert.deepStrictEqual(ru.displaySectors.map(s => s.isPeak), en.displaySectors.map(s => s.isPeak));
});
test('4c. Lash Map DIAGRAM/PHOTO renderer and LEFT/RIGHT mirror formula are unchanged by this text-generation-only fix', () => {
  assert.ok(src.includes("xAt=t=>55+(side==='right'?1-t:t)*290"));
  assert.ok(src.includes("function LegacyLashMapDiagram({ zones, peakIdx, spikeGeom, curve, hoveredZone, setHoveredZone, curl, technique, side, lang, zoneNames, curlByZone, lengthRangeByZone }) {"));
});
