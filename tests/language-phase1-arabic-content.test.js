'use strict';
// ============================================================
// PHASE 1 — ARABIC LOCALIZATION CONTENT.
// ------------------------------------------------------------
// Content + localization-architecture-refactor only, per the approved
// scope. Adds Arabic (ar) translations for the centralized STRINGS
// dictionary and its 4 dedicated {ru,en}-shaped sibling dictionaries
// (IRIS_NAMES/IRIS_FAMILY_NAMES/IRIS_COMBO_NAMES/CATEGORY_LABELS), plus
// CURL_CATALOG's geometry/suitable descriptive fields, and migrates a
// first tranche of previously-scattered binary lang==='en'?X:Y /
// (const en=...; en?X:Y) ternaries onto the SAME centralized STRINGS/
// t() architecture rather than adding new 3-way ternaries anywhere.
//
// Arabic remains completely UNSELECTABLE in production (SUPPORTED_LANGUAGES
// is still exactly ['ru','en'], unchanged from Phase 0) -- these tests
// exercise lang='ar' only by calling the real extracted functions
// directly with that value, never through the UI.
//
// IMPORTANT, explicitly and honestly documented (see the implementation
// report's own "remaining untranslated" section): this migration is
// NOT exhaustive. A second, larger tranche of hardcoded ru/en ternaries
// remains -- specifically every function called from inside the
// protected recommendation-engine/Application-Plan call graph
// (designNarrative, generateLegacyApplicationPlan, generateEyeHighlight,
// buildLibraryTechniqueNotes, the two locale-code ternaries, and the
// pre-React boot-fallback script's 3 strings) plus a handful of smaller
// DetailsScreen/VisitDetailScreen display-only ternaries. Test Z below
// pins the exact current count of each remaining category so it is
// mechanically re-verified (not silently forgotten) by whichever future
// pass migrates them.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let HEAD = null;
try { HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 20 }).toString(); } catch (e) { HEAD = null; }
assert.ok(HEAD, 'expected `git show HEAD:index.html` to succeed');

function extractObjectLiteral(source, name) {
  const start = source.indexOf('const ' + name + ' = {');
  const braceStart = source.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + source.slice(braceStart, i + 1))();
}
function extractArrayLiteral(source, name) {
  const start = source.indexOf('const ' + name + ' = [');
  const bracketStart = source.indexOf('[', start);
  let depth = 0, i = bracketStart;
  for (; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + source.slice(bracketStart, i + 1))();
}

const STRINGS = extractObjectLiteral(src, 'STRINGS');
const IRIS_NAMES = extractObjectLiteral(src, 'IRIS_NAMES');
const IRIS_FAMILY_NAMES = extractObjectLiteral(src, 'IRIS_FAMILY_NAMES');
const IRIS_COMBO_NAMES = extractObjectLiteral(src, 'IRIS_COMBO_NAMES');
const CATEGORY_LABELS = extractObjectLiteral(src, 'CATEGORY_LABELS');
const CURL_CATALOG = extractArrayLiteral(src, 'CURL_CATALOG');
const PREV_STRINGS = extractObjectLiteral(HEAD, 'STRINGS');
const PREV_IRIS_NAMES = extractObjectLiteral(HEAD, 'IRIS_NAMES');
const PREV_IRIS_FAMILY_NAMES = extractObjectLiteral(HEAD, 'IRIS_FAMILY_NAMES');
const PREV_IRIS_COMBO_NAMES = extractObjectLiteral(HEAD, 'IRIS_COMBO_NAMES');
const PREV_CATEGORY_LABELS = extractObjectLiteral(HEAD, 'CATEGORY_LABELS');

const start = src.indexOf('function t(key, lang) {');
const end = src.indexOf('\n', start) + 1;
const t = new Function('STRINGS', src.slice(start, end) + '\nreturn t;')(STRINGS);

const ALL_DICTS = { STRINGS, IRIS_NAMES, IRIS_FAMILY_NAMES, IRIS_COMBO_NAMES, CATEGORY_LABELS };
const PREV_DICTS = { STRINGS: PREV_STRINGS, IRIS_NAMES: PREV_IRIS_NAMES, IRIS_FAMILY_NAMES: PREV_IRIS_FAMILY_NAMES, IRIS_COMBO_NAMES: PREV_IRIS_COMBO_NAMES, CATEGORY_LABELS: PREV_CATEGORY_LABELS };

// ------------------------------------------------------------
// A. every production localization key has ru + en + ar.
// ------------------------------------------------------------
test('A. every entry in STRINGS and its 4 sibling dictionaries has a non-empty ru, en, AND ar value', () => {
  for (const [dictName, dict] of Object.entries(ALL_DICTS)) {
    for (const [key, entry] of Object.entries(dict)) {
      assert.ok(entry.ru && entry.ru.trim().length > 0, `${dictName}.${key} missing ru`);
      assert.ok(entry.en && entry.en.trim().length > 0, `${dictName}.${key} missing en`);
      assert.ok(entry.ar && entry.ar.trim().length > 0, `${dictName}.${key} missing ar`);
    }
  }
});

test('A2. CURL_CATALOG geometry/suitable descriptive fields (additive, previously undiscovered {ru,en}-only data) now also carry ar', () => {
  assert.strictEqual(CURL_CATALOG.length, 8);
  for (const entry of CURL_CATALOG) {
    for (const field of ['geometry', 'suitable']) {
      assert.ok(entry[field].ru && entry[field].en && entry[field].ar, `${entry.id}.${field} missing a language`);
    }
  }
});

// ------------------------------------------------------------
// B. no known Arabic production key falls back to Russian.
// ------------------------------------------------------------
test('B. t(key, \'ar\') never falls back to the ru value for any STRINGS key (every key has its OWN distinct ar entry, not a copy of ru used as a stand-in)', () => {
  for (const key of Object.keys(STRINGS)) {
    const arResult = t(key, 'ar');
    // appName/eyeProfileTitle/debugModeTitle/legacy zone-name pairs are
    // legitimately IDENTICAL across all three languages (brand name, an
    // intentionally-untranslated feature label, or a technical/English
    // zone token RU itself never translated -- see the STRINGS source
    // comments on natLashZoneInner/natLashZoneCenter/natLashZoneOuter).
    // For every other key, ar must be a real, distinct translation, not
    // the ru text reused verbatim (which would indicate a missed
    // translation silently masked by t()'s own ru-fallback).
    // spikeBaseLabel/spikeSpikesLabel ("BASE"/"SPIKES") are professional
    // lash notation, identical across ru/en already (like curl letters)
    // -- correctly left untranslated in ar too, per the explicit
    // instruction to preserve established professional terminology.
    const identicalByDesign = ['appName', 'eyeProfileTitle', 'debugModeTitle', 'natLashZoneInner', 'natLashZoneCenter', 'natLashZoneOuter', 'spikeBaseLabel', 'spikeSpikesLabel'];
    if (identicalByDesign.includes(key)) continue;
    assert.notStrictEqual(arResult, STRINGS[key].ru, `t('${key}', 'ar') must not silently equal the ru fallback -- ar entry looks missing/copied`);
  }
});

test('B2. t() itself is unmodified: still falls back to .ru for any key/lang it does not recognize (unchanged safety net for genuinely unfinished future content)', () => {
  assert.ok(src.includes('function t(key, lang) { const e = STRINGS[key]; if (!e) return key; return e[lang] || e.ru; }'), 't() must be byte-identical to Phase 0');
});

// ------------------------------------------------------------
// C. Arabic strings render correctly when lang='ar' is injected
// internally (never through the real, still-RU/EN-only UI).
// ------------------------------------------------------------
test('C. t(key, \'ar\') returns real Arabic text (Arabic-script codepoints) for a representative cross-section of production keys', () => {
  const arabicRe = /[؀-ۿ]/;
  for (const key of ['tagline', 'photoBtn', 'liveScanBtn', 'irisColorLabel', 'shapeLabel', 'eyelidTypeHooded', 'reviewConfirm', 'consentReject', 'saveToClientButton', 'lashMapEdit', 'heroBestDesignTitle']) {
    const result = t(key, 'ar');
    assert.ok(arabicRe.test(result), `t('${key}', 'ar') = "${result}" does not look like Arabic script`);
  }
});

test('C2. the migrated Natural Lash label functions produce real Arabic output when called directly with lang=\'ar\', and remain byte-identical ru/en for lang=\'ru\'/\'en\'', () => {
  const fnStart = src.indexOf('    function lashDensityLabel(d, lang) {');
  const fnEnd = src.indexOf('\n    // AI-advisory text', fnStart);
  assert.ok(fnStart >= 0 && fnEnd > fnStart, 'expected to locate the migrated lash label function cluster');
  const body = src.slice(fnStart, fnEnd);
  const fns = new Function('t', body + '\nreturn { lashDensityLabel, lashDirectionLabel, lashLengthLabel, lashDistributionText };')(t);
  assert.strictEqual(fns.lashDensityLabel('high', 'ru'), 'Высокая');
  assert.strictEqual(fns.lashDensityLabel('high', 'en'), 'High');
  const arDensity = fns.lashDensityLabel('high', 'ar');
  assert.ok(/[؀-ۿ]/.test(arDensity), 'expected Arabic script for density label under lang=ar');
  assert.strictEqual(fns.lashLengthLabel('long', 'ru'), 'Длинные');
  assert.strictEqual(fns.lashLengthLabel('long', 'en'), 'Long');
  const distObs = { hasData: true, gapZones: [0, 2] };
  const ruDist = fns.lashDistributionText(distObs, 'ru');
  const enDist = fns.lashDistributionText(distObs, 'en');
  assert.ok(ruDist.includes('внутренней трети') && ruDist.includes(' и ') && ruDist.includes('внешней трети'));
  assert.ok(enDist.includes('inner third') && enDist.includes(' and ') && enDist.includes('outer third'));
  const arDist = fns.lashDistributionText(distObs, 'ar');
  assert.ok(/[؀-ۿ]/.test(arDist), 'expected Arabic script for the distribution sentence under lang=ar');
  assert.ok(!arDist.includes('{zones}'), 'the {zones} placeholder must be substituted, never leak into the rendered string');
});

// ------------------------------------------------------------
// D. Arabic is still NOT visible/selectable in production LangToggle.
// ------------------------------------------------------------
test('D. SUPPORTED_LANGUAGES is still exactly [\'ru\',\'en\'] -- unchanged from Phase 0, Arabic still cannot be selected via the real LangToggle', () => {
  const arrStart = src.indexOf("const SUPPORTED_LANGUAGES = [");
  const arrEnd = src.indexOf(']', arrStart) + 1;
  assert.strictEqual(src.slice(arrStart, arrEnd), "const SUPPORTED_LANGUAGES = ['ru', 'en']");
});

test('D2. the LangToggle component itself is byte-identical to Phase 0 (no new button/branch was added to expose Arabic)', () => {
  const marker = '    function LangToggle({ lang, setLang }) {';
  const curStart = src.indexOf(marker);
  const prevStart = HEAD.indexOf(marker);
  assert.ok(curStart >= 0 && prevStart >= 0);
  const curEnd = src.indexOf('\n    }', curStart) + '\n    }'.length;
  const prevEnd = HEAD.indexOf('\n    }', prevStart) + '\n    }'.length;
  assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), 'LangToggle must be untouched by Phase 1 (content-only phase)');
});

// ------------------------------------------------------------
// E & F. RU and EN remain unchanged (only ar was ADDED; ru/en values
// themselves were never edited).
// ------------------------------------------------------------
test('E. every STRINGS/dictionary ru value is byte-identical to its Phase 0 (HEAD) value', () => {
  for (const [dictName, dict] of Object.entries(ALL_DICTS)) {
    const prevDict = PREV_DICTS[dictName];
    for (const key of Object.keys(prevDict)) {
      assert.strictEqual(dict[key].ru, prevDict[key].ru, `${dictName}.${key}.ru changed -- Phase 1 must only ADD ar, never edit ru/en`);
    }
  }
});

test('F. every STRINGS/dictionary en value is byte-identical to its Phase 0 (HEAD) value', () => {
  for (const [dictName, dict] of Object.entries(ALL_DICTS)) {
    const prevDict = PREV_DICTS[dictName];
    for (const key of Object.keys(prevDict)) {
      assert.strictEqual(dict[key].en, prevDict[key].en, `${dictName}.${key}.en changed -- Phase 1 must only ADD ar, never edit ru/en`);
    }
  }
});

test('F2. no pre-existing STRINGS/dictionary key was removed by Phase 1 (additive only)', () => {
  for (const [dictName, prevDict] of Object.entries(PREV_DICTS)) {
    const dict = ALL_DICTS[dictName];
    for (const key of Object.keys(prevDict)) {
      assert.ok(key in dict, `${dictName}.${key} was removed -- Phase 1 must be additive only`);
    }
  }
});

// ------------------------------------------------------------
// G. canonical Lash Map numeric sequences remain unchanged.
// ------------------------------------------------------------
test('G. DESIGN_CATALOG source (all 21 canonical baseZones sequences, e.g. 5-5-8-11-10) is byte-for-byte unchanged -- proven by the SAME whole-block hash the production-source-parity hash guards use', () => {
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const digest = require('node:crypto').createHash('sha256').update(src.slice(catalogStart, catalogEnd)).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181', 'DESIGN_CATALOG (all canonical baseZones numeric sequences) must be byte-identical -- Phase 1 must never touch analytical/geometry data');
});

test('G2. ZONE_NAMES canonical order is unchanged', () => {
  assert.ok(src.includes("const ZONE_NAMES = ['INNER','TRANSITION','BODY','PEAK','OUTER'];"));
});

// ------------------------------------------------------------
// H. anatomical LEFT/RIGHT behavior remains unchanged.
// ------------------------------------------------------------
test('H. LEFT/RIGHT physical-eye normalization and the Lash Map mirror formula are byte-identical to Phase 0 HEAD', () => {
  for (const marker of [
    '    function getPhysicalEyeLandmarks(landmarks, physicalSide) {',
    '    function computeHeadPose(landmarks) {',
    '    function computeEyeSideMetrics(landmarks, side, headPose) {',
    '    function mapVideoPointToDisplay(x, y, videoW, videoH, dispW, dispH) {',
  ]) {
    const curStart = src.indexOf(marker);
    const prevStart = HEAD.indexOf(marker);
    assert.ok(curStart >= 0 && prevStart >= 0, 'expected to locate ' + marker);
    const curEnd = src.indexOf('\n    function ', curStart + 10);
    const prevEnd = HEAD.indexOf('\n    function ', prevStart + 10);
    assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), marker + ' must be byte-identical to HEAD');
  }
  assert.ok(src.includes("xAt=t=>55+(side==='right'?1-t:t)*290"), 'Lash Map mirror formula must be unchanged');
});

// ------------------------------------------------------------
// I. Photo Scan geometry/timing remains unchanged (~8s choreography).
// ------------------------------------------------------------
test('I. Photo Scan\'s scan-animation effect (choreography constants + all geometry) is byte-identical to Phase 0 HEAD', () => {
  const marker = '      // PHASE 0: keeps the document\'s own <html lang> attribute';
  // Anchor off a stable, unrelated Phase-0 marker is unnecessary here --
  // directly compare the known-fixed choreography constants instead.
  assert.ok(src.includes('const MIN_MS = 7300, REVEAL_MS = 7300, COLLAPSE_MS = 700;'), 'Photo Scan choreography constants must be unchanged (~8s total)');
  const funcMarker = '    function drawScanBeam(ctx, box, time, cycleMs, softness, reduceMotion) {';
  const curStart = src.indexOf(funcMarker);
  const prevStart = HEAD.indexOf(funcMarker);
  assert.ok(curStart >= 0 && prevStart >= 0);
  const curEnd = src.indexOf('\n    function ', curStart + 10);
  const prevEnd = HEAD.indexOf('\n    function ', prevStart + 10);
  assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), 'drawScanBeam (canvas geometry) must be byte-identical to HEAD');
});

// ------------------------------------------------------------
// J. Live Scan behavior remains unchanged.
// ------------------------------------------------------------
test('J. LiveScanScreen is byte-identical to Phase 0 HEAD -- Phase 1 never touched Live Scan, and Phase 2 touches only 2 presentation-only dir="ltr" attributes', () => {
  const marker = '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {';
  const curStart = src.indexOf(marker);
  const prevStart = HEAD.indexOf(marker);
  assert.ok(curStart >= 0 && prevStart >= 0);
  const curEnd = src.indexOf('\n    function ', curStart + 10);
  const prevEnd = HEAD.indexOf('\n    function ', prevStart + 10);
  // PHASE 2 (Arabic RTL): the only approved diff is dir="ltr" added
  // directly to LiveScanScreen's own <video>/<canvas> elements
  // (presentation-only geometry isolation -- see the Phase 2
  // geometry-isolation tests). Normalized out here so this guard keeps
  // proving nothing ELSE in LiveScanScreen changed.
  const omitPhase2DirLtr = span => span
    .replace('<video dir="ltr" ref={videoRef}', '<video ref={videoRef}')
    .replace('<canvas dir="ltr" ref={overlayCanvasRef}', '<canvas ref={overlayCanvasRef}');
  assert.strictEqual(omitPhase2DirLtr(src.slice(curStart, curEnd)), HEAD.slice(prevStart, prevEnd), 'LiveScanScreen must be byte-identical to HEAD outside the approved Phase 2 dir="ltr" additions');
});

// ------------------------------------------------------------
// K. Results recommendations remain unchanged.
// ------------------------------------------------------------
test('K. rankDesignsAll/rankDesigns/buildDesignResult wiring and recommendCurl are byte-identical to Phase 0 HEAD -- recommendCurl was deliberately REVERTED after an initial t()-migration attempt broke recommendation-canonical.test.js/lash-design-domain.test.js (it sits inside the protected recommendation-engine call graph; see the implementation report)', () => {
  assert.ok(src.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'));
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  const marker = '    function recommendCurl(c, design, lang) {';
  const curStart = src.indexOf(marker);
  const prevStart = HEAD.indexOf(marker);
  assert.ok(curStart >= 0 && prevStart >= 0);
  const curEnd = src.indexOf('\n    }', curStart) + '\n    }'.length;
  const prevEnd = HEAD.indexOf('\n    }', prevStart) + '\n    }'.length;
  assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), 'recommendCurl must be byte-identical to HEAD (reverted, not migrated)');
});

test('K2. production activation flags stay inert (professional-lash-library.js untouched by this phase)', () => {
  const Library = require(path.join(root, 'professional-lash-library.js'));
  assert.strictEqual(Library.library.activation.productionEnabled, false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds, []);
});

// ------------------------------------------------------------
// Z. Explicit, mechanically-checked inventory of what this phase did
// NOT migrate -- so it is tracked by a test, not lost. If any of these
// counts change, this test's own expectation must be updated alongside
// the real migration work, never silently.
// ------------------------------------------------------------
test('Z. remaining un-migrated hardcoded ru/en ternary count is pinned (tracks known, intentionally-retained non-user-facing/protected sites, not silently forgotten)', () => {
  // Uses [\s\S] instead of line-based tooling specifically because
  // several real matches are formatted across multiple source lines
  // (long ternary condition/branches wrapped for readability) -- a
  // naive per-line grep undercounts those.
  //
  // PHASE 1 CONTINUATION: all category A/B/C (safe, user-facing)
  // ternary sites have now been migrated onto centralized STRINGS/t()
  // -- generateLashApplicationNotes, designNarrative,
  // generateLegacyApplicationPlan, generateEyeHighlight,
  // buildLibraryTechniqueNotes (LashMapLibraryScreen's real production
  // technique notes + item count), the CATEGORY_LABELS/IRIS_NAMES/
  // IRIS_FAMILY_NAMES/resolveIrisColorLabel lookups (eyeProfileLabels,
  // DetailsScreen, VisitDetailScreen, AllDesignsScreen),
  // heroDesignDisplayName (also fixed to stop leaking Russian "Лисий"
  // into a hypothetical Arabic render), LashMapScreen's asymmetry
  // banner (both PHOTO and diagram-adjacent copies), and the full
  // DetailsScreen cluster (shape-tendency words, L/R Asymmetry
  // breakdown labels, Confidence/lighting note, Other header,
  // Close/Wide/Balanced spacing words).
  //
  // What remains below is exhaustively categorized, not merely
  // uncounted:
  //   enFirst (4): the 2 reverted recommendCurl reason strings
  //     (PROTECTED -- inside the recommendation-engine call graph; see
  //     test K's own comment) + 2 in ProLibraryReferenceTemplateMap
  //     (DEBUG-ONLY -- called exclusively from ProLibraryDetailScreen,
  //     itself reachable only via screen==='proLibraryDetail', itself
  //     only reachable via the ?debug=library URL param).
  //   ruFirst (10): the 2 'ru-RU'/'en-US' toLocaleDateString locale-code
  //     ternaries (technical BCP-47 identifiers, not translatable
  //     display text; ConsentPanel + formatClientDate) + 8 inside the
  //     confirmed DEBUG-ONLY buildMethodicalSections/
  //     plOtherIdentityName cluster (same ?debug=library gate as above).
  //   boolEnForm (3): the pre-React boot-fallback script's 3 hardcoded
  //     pairs -- runs in <head> before React/Babel/STRINGS exist, by
  //     design (see Z2); SUPPORTED_LANGUAGES is still ['ru','en'] only,
  //     so this cannot regress even if Arabic is later exposed.
  //   constEnDeclarations (0): every "const en = lang === 'en'"
  //     boolean-form declaration has now been migrated -- none remain.
  const enFirst = (src.match(/lang\s*===\s*'en'\s*\?\s*'[^']*'\s*:\s*'[^']*'/g) || []).length;
  const ruFirst = (src.match(/lang\s*===\s*'ru'\s*\?\s*'[^']*'\s*:\s*'[^']*'/g) || []).length;
  const boolEnForm = (src.match(/[^a-zA-Z.]en \? '[^']*' : '[^']*'/g) || []).length;
  const constEnDeclarations = (src.match(/const en = lang === 'en';/g) || []).length;
  assert.strictEqual(enFirst, 4, 'lang===\'en\'?\'X\':\'Y\' ternary count changed -- update this pinned count alongside any further migration');
  assert.strictEqual(ruFirst, 10, 'lang===\'ru\'?\'X\':\'Y\' ternary count changed -- update this pinned count alongside any further migration');
  assert.strictEqual(boolEnForm, 3, 'boolean-variable en?\'X\':\'Y\' ternary count changed -- update this pinned count alongside any further migration');
  assert.strictEqual(constEnDeclarations, 0, 'const en = lang===\'en\' declaration count changed -- all known sites were migrated this phase; a nonzero count means a new one was introduced');
});

test('Z2. the pre-React boot-fallback script (outside STRINGS/t(), runs before React mounts) still has exactly 3 hardcoded ru/en string pairs, not yet Arabic-capable -- tracked, not forgotten', () => {
  const marker = 'function showBootFallback() {';
  const start = src.indexOf(marker);
  const end = src.indexOf('setTimeout(showBootFallback', start);
  const body = src.slice(start, end);
  const pairs = (body.match(/en \? '[^']*' : '[^']*'/g) || []).length;
  assert.strictEqual(pairs, 3, 'boot-fallback hardcoded string-pair count changed -- update this pinned count alongside any further migration');
});
