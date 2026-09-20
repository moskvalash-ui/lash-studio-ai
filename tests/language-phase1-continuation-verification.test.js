'use strict';
// ============================================================
// PHASE 1 CONTINUATION — regression coverage for the second tranche of
// category A/B/C (safe, user-facing) ru/en ternary migrations onto
// centralized STRINGS/t(): AllDesignsScreen's CATEGORY_LABELS lookup,
// eyeProfileLabels'/DetailsScreen's/VisitDetailScreen's IRIS_NAMES/
// IRIS_FAMILY_NAMES/resolveIrisColorLabel lookups, heroDesignDisplayName
// (also fixed to stop leaking Russian "Лисий" into a hypothetical
// Arabic render), LashMapScreen's asymmetry banner, and the full
// DetailsScreen cluster (shape-tendency words, L/R Asymmetry breakdown
// labels, Confidence/lighting note, Other header, spacing words).
//
// These screens are JSX and cannot be rendered in plain Node (this repo
// has no @babel/core hard dependency — see other *-ui.test.js files'
// own precedent), so coverage here is: (1) real extraction+eval of the
// pure eyeProfileLabels function, diffed against the real, unmodified
// function extracted from git HEAD (pre-migration) to prove RU/EN
// output is byte-identical and AR now resolves correctly instead of
// falling through to RU; (2) structural source assertions for the
// JSX-only sites, proving the underlying computed-value expressions
// (p.shapeTendencies, p.asymmetryBreakdown.*, design.leftCorrectionMm/
// rightCorrectionMm, iris.confidence, p.isCloseSet/isWideSet/
// spacingConfidence) are read exactly as before -- only which STRING
// gets displayed changed, never what is computed.
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
  return source.slice(braceStart, i + 1);
}

function loadEyeProfileLabels(source) {
  const stringsLiteral = extractObjectLiteral(source, 'STRINGS');
  const irisNamesLiteral = extractObjectLiteral(source, 'IRIS_NAMES');
  const irisFamilyLiteral = extractObjectLiteral(source, 'IRIS_FAMILY_NAMES');
  const irisComboLiteral = extractObjectLiteral(source, 'IRIS_COMBO_NAMES');
  const tFnStart = source.indexOf('function t(key, lang)');
  const tFnLine = source.slice(tFnStart, source.indexOf('\n', tFnStart));

  const resolveFnStart = source.indexOf('function resolveIrisColorLabel(');
  const resolveFnEnd = source.indexOf('\n    }', resolveFnStart) + 6;
  const resolveFnSrc = source.slice(resolveFnStart, resolveFnEnd);

  const formatBreakdownStart = source.indexOf('function formatIrisColorCompositionBreakdown(');
  const formatBreakdownEnd = source.indexOf('\n    }', formatBreakdownStart) + 6;
  const formatBreakdownSrc = source.slice(formatBreakdownStart, formatBreakdownEnd);

  const epStart = source.indexOf('function eyeProfileLabels(');
  const epEnd = source.indexOf('\n    }', epStart) + 6;
  const epSrc = source.slice(epStart, epEnd);

  return new Function(
    `const STRINGS = ${stringsLiteral};\nconst IRIS_NAMES = ${irisNamesLiteral};\nconst IRIS_FAMILY_NAMES = ${irisFamilyLiteral};\nconst IRIS_COMBO_NAMES = ${irisComboLiteral};\nconst TILT_CONFIDENCE_FLOOR=0.22;\n${tFnLine}\n` +
    resolveFnSrc + '\n' + formatBreakdownSrc + '\n' + epSrc +
    '; return { eyeProfileLabels };'
  )();
}

const currentApi = loadEyeProfileLabels(src);
const headApi = loadEyeProfileLabels(HEAD);

const BASE_P = {
  creaseState: 'visible', hoodingState: 'nonHooded', eyeSetCategory: 'normal',
  eyeSizeCategory: 'medium', symmetryCategory: 'symmetric', tiltConfidence: 0.9,
  tiltTendency: 'neutral', shapeTendencies: [], eyelidType: 'unknown', eyelidTypeConfidence: 0.5,
  shape: 'almond',
};
const IRIS_CASES = [
  { name: 'green', compositionLabel: 'greenBrown', colorComposition: { green: 0.6, brown: 0.4 } },
  { name: 'blue', compositionLabel: 'uncertain', colorComposition: { blue: 0.5, gray: 0.5 } },
  { name: 'hazel', compositionLabel: null, colorComposition: null },
  { name: 'uncertain', compositionLabel: 'uncertain', colorComposition: null },
  {},
];

// ------------------------------------------------------------
// eyeProfileLabels: pure function, real byte-identical-to-HEAD proof.
// ------------------------------------------------------------
test('eyeProfileLabels RU/EN output is byte-identical to the pre-migration (git HEAD) function, across representative iris cases', () => {
  for (const lang of ['ru', 'en']) {
    for (const iris of IRIS_CASES) {
      const current = currentApi.eyeProfileLabels(BASE_P, iris, lang);
      const head = headApi.eyeProfileLabels(BASE_P, iris, lang);
      assert.deepStrictEqual(current, head, `lang=${lang} iris=${JSON.stringify(iris)}`);
    }
  }
});
test('eyeProfileLabels now resolves real Arabic script for iris-derived fields under lang=\'ar\' (previously fell through to Russian)', () => {
  const arabicRe = /[؀-ۿ]/;
  for (const iris of IRIS_CASES) {
    if (!iris.name) continue;
    const result = currentApi.eyeProfileLabels(BASE_P, iris, 'ar');
    assert.ok(arabicRe.test(result.irisName), `irisName not Arabic for ${JSON.stringify(iris)}: "${result.irisName}"`);
    if (result.irisCompositionBreakdown) {
      assert.ok(arabicRe.test(result.irisCompositionBreakdown), `irisCompositionBreakdown not Arabic: "${result.irisCompositionBreakdown}"`);
    }
  }
});

// ------------------------------------------------------------
// DetailsScreen (JSX, structural): the shape-tendency/asymmetry/
// confidence/other/spacing ternaries were migrated to t(); the
// computed-value expressions they wrap must be untouched.
// ------------------------------------------------------------
const detailsStart = src.indexOf('    function DetailsScreen({ result, onBack }) {');
const detailsEnd = src.indexOf('\n    function nls2TriLabel(', detailsStart);
const detailsBlock = src.slice(detailsStart, detailsEnd);
const headDetailsStart = HEAD.indexOf('    function DetailsScreen({ result, onBack }) {');
const headDetailsEnd = HEAD.indexOf('\n    function nls2TriLabel(', headDetailsStart);
const headDetailsBlock = HEAD.slice(headDetailsStart, headDetailsEnd);

test('DetailsScreen: shape-tendency labels now resolve via t(), never a hardcoded ru/en ternary', () => {
  assert.ok(detailsBlock.includes("{k === 'round' ? t('detailsShapeTendencyRound', lang) : k === 'almond' ? t('detailsShapeTendencyAlmond', lang) : t('detailsShapeTendencyElongated', lang)}"));
  assert.ok(!detailsBlock.includes("lang==='en'?'Round':'Округлая'"));
});
test('DetailsScreen: L/R Asymmetry header + all 6 breakdown labels now resolve via t()', () => {
  for (const key of ['detailsAsymHeader', 'detailsAsymWidth', 'detailsAsymHeight', 'detailsAsymCornerAngle', 'detailsAsymOpenness', 'detailsAsymLidVisibility', 'detailsAsymVerticalPosition']) {
    assert.ok(detailsBlock.includes(`t('${key}', lang)`), `expected ${key} to be used in DetailsScreen`);
  }
  assert.ok(!detailsBlock.includes("lang==='en'?'L/R Asymmetry'"));
});
test('DetailsScreen: Confidence/lighting note and Other/spacing labels now resolve via t()', () => {
  assert.ok(detailsBlock.includes("t('detailsIrisConfidenceLabel', lang)"));
  assert.ok(detailsBlock.includes("t('detailsIrisLightingNote', lang)"));
  assert.ok(detailsBlock.includes("t('detailsOtherHeader', lang)"));
  assert.ok(detailsBlock.includes("t('detailsSpacingClose', lang)"));
  assert.ok(detailsBlock.includes("t('detailsSpacingWide', lang)"));
  assert.ok(detailsBlock.includes("t('detailsSpacingBalanced', lang)"));
});
test('DetailsScreen: the computed-value expressions underneath every migrated label are byte-identical to git HEAD (only the label ternary changed, never what is computed)', () => {
  const computedExpressions = [
    'p.shapeTendencies).sort((a,b)=>b[1]-a[1]).map(([k,v])',
    '(v*100).toFixed(0)}%',
    'p.compositeAsymmetry > 0.05',
    '(p.asymmetryBreakdown.width*100).toFixed(1)',
    '(p.asymmetryBreakdown.height*100).toFixed(1)',
    'p.asymmetryBreakdown.tilt.toFixed(1)',
    '(p.asymmetryBreakdown.openness*100).toFixed(1)',
    '(p.asymmetryBreakdown.hooding*100).toFixed(1)',
    '(p.asymmetryBreakdown.vertical*100).toFixed(1)',
    '(iris.confidence*100).toFixed(0)',
    'p.tiltConfidence < TILT_CONFIDENCE_FLOOR',
    'p.isCloseSet ?',
    'p.isWideSet ?',
    '(p.spacingConfidence*100).toFixed(0)',
  ];
  for (const expr of computedExpressions) {
    assert.ok(detailsBlock.includes(expr), `current DetailsScreen missing computed expression: ${expr}`);
    assert.ok(headDetailsBlock.includes(expr), `HEAD DetailsScreen missing computed expression (test itself may be wrong): ${expr}`);
  }
});

// ------------------------------------------------------------
// AllDesignsScreen (JSX, structural): CATEGORY_LABELS lookup.
// ------------------------------------------------------------
const allDesignsStart = src.indexOf('    function AllDesignsScreen({ result, onSelect, onBack }) {');
const allDesignsEnd = src.indexOf('\n    function zoneLabel(', allDesignsStart);
const allDesignsBlock = src.slice(allDesignsStart, allDesignsEnd);
test('AllDesignsScreen: category header + card badge both resolve via CATEGORY_LABELS[cat][lang] with a .ru fallback, never a binary lang===\'en\' ternary', () => {
  const occurrences = (allDesignsBlock.match(/CATEGORY_LABELS\[cat\]\[lang\] \|\| CATEGORY_LABELS\[cat\]\.ru/g) || []).length;
  assert.strictEqual(occurrences, 2, 'expected exactly 2 sites (section header + card badge) to use the new fallback form');
  assert.ok(!allDesignsBlock.includes("lang==='en'?CATEGORY_LABELS[cat].en:CATEGORY_LABELS[cat].ru"), 'the old binary ternary must be gone');
});
test('CATEGORY_LABELS itself has non-empty ru/en/ar for every category', () => {
  const catLiteral = extractObjectLiteral(src, 'CATEGORY_LABELS');
  const CATEGORY_LABELS = new Function('return ' + catLiteral)();
  for (const [cat, entry] of Object.entries(CATEGORY_LABELS)) {
    assert.ok(entry.ru && entry.en && entry.ar, `CATEGORY_LABELS.${cat} missing ru/en/ar`);
  }
});

// ------------------------------------------------------------
// LashMapScreen (JSX, structural): asymmetry banner.
// ------------------------------------------------------------
const lashMapScreenStart = src.indexOf('    function LashMapScreen({ result, design: designProp, naturalLashProfile, onBack, onSaveToClient }) {');
const lashMapScreenEnd = src.indexOf('\n    function DebugFactorBars(', lashMapScreenStart);
const lashMapScreenBlock = src.slice(lashMapScreenStart, lashMapScreenEnd);
test('LashMapScreen: both asymmetry-banner copies (PHOTO view + Application Plan section) now route through the shared lashMapAsymBannerTemplate, never a hardcoded ru/en ternary', () => {
  const occurrences = (lashMapScreenBlock.match(/t\('lashMapAsymBannerTemplate', lang\)/g) || []).length;
  assert.strictEqual(occurrences, 2, 'expected exactly 2 banner sites');
  assert.ok(!lashMapScreenBlock.includes("eye map was adjusted by"), 'the old hardcoded EN sentence must be gone');
  assert.ok(!lashMapScreenBlock.includes('глаза скорректирована на'), 'the old hardcoded RU sentence must be gone');
});
test('LashMapScreen: the underlying correction-mm computation feeding the banner is byte-identical to git HEAD', () => {
  const expr = "(design.leftCorrectionMm || 0) > 0";
  const maxExpr = "Math.max(design.leftCorrectionMm || 0, design.rightCorrectionMm || 0)";
  assert.ok(lashMapScreenBlock.includes(expr) && lashMapScreenBlock.includes(maxExpr));
  const headLashMapScreenStart = HEAD.indexOf('    function LashMapScreen({ result, design: designProp, naturalLashProfile, onBack, onSaveToClient }) {');
  const headLashMapScreenEnd = HEAD.indexOf('\n    function DebugFactorBars(', headLashMapScreenStart);
  const headLashMapScreenBlock = HEAD.slice(headLashMapScreenStart, headLashMapScreenEnd);
  assert.ok(headLashMapScreenBlock.includes(expr) && headLashMapScreenBlock.includes(maxExpr));
});

// ------------------------------------------------------------
// VisitDetailScreen / VisitHistoryCard (JSX, structural): iris name
// lookup migrated to the fallback form; design-name lookups (coupled
// to DESIGN_CATALOG/snapshot naming, category E) intentionally left
// untouched -- pinned here so that stays a deliberate, visible fact.
// ------------------------------------------------------------
const visitDetailStart = src.indexOf('    function VisitDetailScreen({ lang, visitId, clientId, store, onBack }) {');
const visitDetailEnd = src.indexOf('\n    function proLibKindLabel(', visitDetailStart);
assert.ok(visitDetailStart > 0 && visitDetailEnd > visitDetailStart, 'VisitDetailScreen must be structurally extractable');
const visitDetailBlock = src.slice(visitDetailStart, visitDetailEnd);
test('VisitDetailScreen: historical iris category label resolves via IRIS_NAMES[category][lang] with a .ru fallback', () => {
  assert.ok(visitDetailBlock.includes("IRIS_NAMES[analysis.iris.category][lang] || IRIS_NAMES[analysis.iris.category].ru"));
  assert.ok(!visitDetailBlock.includes("lang === 'en' ? IRIS_NAMES[analysis.iris.category].en : IRIS_NAMES[analysis.iris.category].ru"));
});
test('VisitDetailScreen/VisitHistoryCard: design.display.enName/ruName snapshot lookups are INTENTIONALLY untouched (category E -- coupled to DESIGN_CATALOG naming + historical snapshot compatibility)', () => {
  const occurrences = (src.match(/lang === 'en' \? \(design\.display\.enName \|\| design\.display\.name\) : \(design\.display\.ruName \|\| design\.display\.name\)/g) || []).length;
  assert.strictEqual(occurrences, 2, 'expected exactly the 2 known snapshot-name sites (VisitHistoryCard + VisitDetailScreen), unchanged from before this phase');
});

// ------------------------------------------------------------
// heroDesignDisplayName: AR-leak fix (RU gets "Лисий", EN and AR both
// fall through to d.name; previously AR incorrectly got "Лисий" too).
// ------------------------------------------------------------
test('heroDesignDisplayName: RU shows "Лисий" for fox, EN and AR both show d.name (no more Russian leaking into a hypothetical AR render)', () => {
  const start = src.indexOf('    function heroDesignDisplayName(d, lang) {');
  const end = src.indexOf('\n    }', start) + 6;
  const fn = new Function(src.slice(start, end) + '\nreturn heroDesignDisplayName;')();
  assert.strictEqual(fn({ id: 'fox', name: 'Fox' }, 'ru'), 'Лисий');
  assert.strictEqual(fn({ id: 'fox', name: 'Fox' }, 'en'), 'Fox');
  assert.strictEqual(fn({ id: 'fox', name: 'Fox' }, 'ar'), 'Fox');
  assert.strictEqual(fn({ id: 'cat', name: 'Cat Eye' }, 'ru'), 'Cat Eye');
});
