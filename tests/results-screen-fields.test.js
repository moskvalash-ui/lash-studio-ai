'use strict';
// ============================================================
// NORMAL USER-FACING ANALYSIS FLOW — visible-field regression coverage.
// ------------------------------------------------------------
// Product decision: eyelid crease type, eyelid hooding, and eye size
// must not be visible to the artist anywhere in the normal analysis
// flow (HeroScreen "Результаты анализа"/Results, ReviewScreen
// "Подтверждение анализа"/Confirm analysis, DetailsScreen "Детали
// анализа"/Analysis details). This is DISPLAY-ONLY for eyelidType and
// eyeSizeCategory: eyelidType, creaseState, eyelidCategory,
// eyeSizeCategory, and their calculations (eyeProfileLabels,
// classifyFeatures, ReviewScreen confirm()) all remain fully intact —
// still computed, still round-tripped, just not shown to the artist.
//
// HOODING WENT FURTHER: hooding is no longer a trusted recommendation
// parameter at all (see tests/hooding-recommendation-removal.test.js
// for the recommendation-side proof). hoodingState's ReviewScreen row
// is now ALSO removed — safe specifically because isHooded/
// hoodedConfidence/hoodingLevel no longer feed DESIGN_CATALOG scoring/
// cautions, recommendCurl, generateEyeHighlight, or the Application
// Plan. hoodingState/isHooded/hoodedConfidence/hoodingLevel remain
// fully computed (classifyFeatures, ReviewScreen confirm()) for
// diagnostics/backward compatibility only — they are simply inert now,
// never coerced to a false "confirmed non-hooded" that affects output.
//
// index.html's app script is JSX, not requirable/executable directly
// in Node without a build step, so this file uses the same static
// source-extraction convention already used by
// tests/face-shape-analysis.test.js and tests/client-card-ui.test.js.
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

function extractFunctionSpan(startMarker) {
  const start = indexSource.indexOf(startMarker);
  const end = indexSource.indexOf('\n    function ', start + 10);
  return indexSource.slice(start, end);
}

const heroBlock = extractFunctionSpan('    function HeroScreen(');
const reviewBlock = extractFunctionSpan('    function ReviewScreen(');
const detailsBlock = extractFunctionSpan('    function DetailsScreen(');

// The exact set of EyeProfileRow calls actually rendered in HeroScreen,
// identified by the STRINGS key passed as their `label` prop.
const renderedRowLabelKeys = [...heroBlock.matchAll(/<EyeProfileRow[^/]*\/>/g)]
  .map((m) => m[0])
  .map((call) => {
    const m = call.match(/label=\{t\('([^']+)'/);
    return m ? m[1] : null;
  });

test('HeroScreen renders exactly 6 EyeProfileRow entries', () => {
  assert.strictEqual(renderedRowLabelKeys.length, 6, 'unexpected row count: ' + JSON.stringify(renderedRowLabelKeys));
});

// ------------------------------------------------------------
// 1. Eyelid crease type is absent from all three screens
// ------------------------------------------------------------
test('Eyelid crease type is not rendered on HeroScreen', () => {
  assert.ok(!renderedRowLabelKeys.includes('eyelidTypeLabel'));
  assert.ok(!renderedRowLabelKeys.includes('creaseStateLabel'));
  assert.ok(!heroBlock.includes('labels.eyelidTypeLabel') && !heroBlock.includes('value={labels.creaseStateLabel}'));
});

test('Eyelid crease type is not a confirmable row on ReviewScreen', () => {
  assert.ok(!reviewBlock.includes("['eyelidType', t('eyelidTypeLabel', lang)"), 'eyelidType must no longer be a rendered field row');
});

test('Eyelid crease type is not shown as a card on DetailsScreen', () => {
  assert.ok(!detailsBlock.includes("<h3 className=\"label-tech\">{t('creaseStateLabel', lang)}"), 'crease-type card must be removed from DetailsScreen');
  assert.ok(!detailsBlock.includes('creaseStateVisible') && !detailsBlock.includes('creaseStateAbsent'), 'no crease-state display text should remain rendered on DetailsScreen');
});

// ------------------------------------------------------------
// 2. Eyelid hooding is absent from HeroScreen and DetailsScreen (see
// the documented ReviewScreen exception above)
// ------------------------------------------------------------
test('Eyelid hooding is not rendered on HeroScreen', () => {
  assert.ok(!renderedRowLabelKeys.includes('hoodingStateLabel'));
  assert.ok(!heroBlock.includes('value={labels.hoodingStateLabel}') && !heroBlock.includes('value={labels.hooding}'));
});

test('Eyelid hooding is not shown as a card on DetailsScreen', () => {
  assert.ok(!detailsBlock.includes("<h3 className=\"label-tech\">{t('hoodingStateLabel', lang)}"), 'hooding card must be removed from DetailsScreen');
  assert.ok(!detailsBlock.includes('hoodingOptionHooded') && !detailsBlock.includes('hoodingOptionNonHooded'), 'no hooding display text should remain rendered on DetailsScreen');
});

test('hoodingState is now also removed from ReviewScreen — safe because recommendations no longer read isHooded/hoodedConfidence/hoodingLevel at all (see tests/hooding-recommendation-removal.test.js)', () => {
  assert.ok(!reviewBlock.includes("['hoodingState', t('reviewHoodingLabel', lang)"), 'hoodingState must no longer be a rendered ReviewScreen field row');
});

// ------------------------------------------------------------
// 3. Eye size remains hidden everywhere in the normal flow
// ------------------------------------------------------------
test('Eye size is not rendered on HeroScreen', () => {
  assert.ok(!renderedRowLabelKeys.includes('eyeSizeLabel'));
  assert.ok(!heroBlock.includes('value={labels.eyeSize}'));
});

test('Eye size is not a confirmable row on ReviewScreen', () => {
  assert.ok(!reviewBlock.includes("['eyeSizeCategory', t('eyeSizeLabel', lang)"), 'eyeSizeCategory must no longer be a rendered field row');
});

test('Eye size is not shown on DetailsScreen (neither the labeled row nor the inline "Rel. eye size" line)', () => {
  assert.ok(!detailsBlock.includes("t('eyeSizeLabel', lang)"));
  assert.ok(!detailsBlock.includes('Rel. eye size') && !detailsBlock.includes('Отн. размер глаз'), 'the inline relativeEyeSize display line must also be removed');
});

// ------------------------------------------------------------
// 4-9. The six kept rows remain visible on HeroScreen
// ------------------------------------------------------------
const KEPT_ROWS = {
  shapeLabel: 'Eye shape',
  spacingLabel: 'Eye spacing',
  tiltLabel: 'Outer corner direction',
  symmetryLabel: 'Symmetry',
  irisColorLabel: 'Iris color',
  faceShapeLabel: 'Face shape',
};
for (const [key, description] of Object.entries(KEPT_ROWS)) {
  test(`${description} (${key}) remains visible on the Results screen`, () => {
    assert.ok(renderedRowLabelKeys.includes(key), `expected ${key} to still be rendered as a HeroScreen row`);
  });
}

test('the Face Shape row is present but still correctly guarded on result.faceShapeProfile existing', () => {
  assert.ok(heroBlock.includes('{result.faceShapeProfile && ('), 'Face Shape row must remain conditionally rendered');
});

test('ReviewScreen still confirms eyeShapeCategory, eyeSetCategory, tiltTendency, and symmetryCategory (the kept parameters)', () => {
  for (const needle of [
    "['eyeShapeCategory', t('shapeLabel', lang)",
    "['eyeSetCategory', t('spacingLabel', lang)",
    "['tiltTendency', t('tiltLabel', lang)",
    "['symmetryCategory', t('symmetryLabel', lang)",
  ]) {
    assert.ok(reviewBlock.includes(needle), 'expected ReviewScreen to still confirm: ' + needle);
  }
});

// ------------------------------------------------------------
// 10. Underlying analysis fields/calculations remain untouched
// ------------------------------------------------------------
test('eyeProfileLabels still computes creaseStateLabel, hoodingStateLabel, eyelidTypeLabel, and eyeSize unchanged', () => {
  const fnStart = indexSource.indexOf('function eyeProfileLabels(p, iris, lang) {');
  const fnEnd = indexSource.indexOf('\n    }', fnStart) + 6;
  const fnBody = indexSource.slice(fnStart, fnEnd);
  for (const field of ['creaseStateLabel', 'hoodingStateLabel', 'eyeSize', 'eyelidTypeLabel', 'hooding']) {
    assert.ok(fnBody.includes(field), `eyeProfileLabels must still compute ${field} — this task is display-only`);
  }
  assert.ok(fnBody.includes('return { shape, tilt, hooding, eyelidTypeLabel, eyelidTypeRawLabel, creaseStateLabel, hoodingStateLabel, spacing, eyeSize, symmetry, irisName };'), 'the full labels object must still be returned unchanged');
});

test('classifyFeatures itself is untouched: creaseState/hoodingState/eyeSizeCategory/eyelidType/eyelidCategory computation is unchanged', () => {
  const fnStart = indexSource.indexOf('function classifyFeatures(aggregated, opts) {');
  const fnEnd = indexSource.indexOf('\n    function ', fnStart + 10);
  const body = indexSource.slice(fnStart, fnEnd);
  for (const field of ['creaseState', 'hoodingState', 'eyeSizeCategory', 'eyelidType', 'eyelidCategory']) {
    assert.ok(body.includes(field), `classifyFeatures must still compute ${field} — this task never touches analysis logic`);
  }
});

test('ReviewScreen still seeds and round-trips eyelidType/eyeSizeCategory/hoodingState internally, even though eyelidType/eyeSizeCategory no longer have a visible control', () => {
  assert.ok(reviewBlock.includes('eyelidType: initial.eyelidType,'), 'values state must still seed eyelidType');
  assert.ok(reviewBlock.includes('eyeSizeCategory: initial.eyeSizeCategory,'), 'values state must still seed eyeSizeCategory');
  assert.ok(reviewBlock.includes('hoodingState: initial.hoodingState,'), 'values state must still seed hoodingState');
  assert.ok(reviewBlock.includes('...values,'), 'confirm() must still spread the full values object (including the hidden fields) onto the confirmed profile');
  assert.ok(reviewBlock.includes("eyelidCategory = values.eyelidType"), 'eyelidCategory must still be derived from values.eyelidType');
  assert.ok(reviewBlock.includes('isHooded = values.hoodingState'), 'isHooded must still be derived from values.hoodingState');
});

test('every STRINGS key involved (kept, hidden-but-preserved) still has both RU and EN text', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const allKeys = [...Object.keys(KEPT_ROWS), 'creaseStateLabel', 'hoodingStateLabel', 'eyeSizeLabel', 'eyelidTypeLabel', 'reviewHoodingLabel'];
  for (const key of allKeys) {
    assert.ok(STRINGS[key], 'missing STRINGS key: ' + key);
    assert.ok(STRINGS[key].ru && STRINGS[key].ru.trim().length > 0, key + ' missing RU text');
    assert.ok(STRINGS[key].en && STRINGS[key].en.trim().length > 0, key + ' missing EN text');
  }
});

test('this is UI-only: no removed row is replaced with a placeholder, empty state, or technical explanation on HeroScreen or DetailsScreen', () => {
  assert.ok(!heroBlock.includes('t(\'creaseState') && !heroBlock.includes('t(\'hoodingState') && !heroBlock.includes('t(\'eyeSize'));
  assert.ok(!detailsBlock.includes("t('creaseStateLabel'") && !detailsBlock.includes("t('hoodingStateLabel'") && !detailsBlock.includes("t('eyeSizeLabel'"));
});

// ------------------------------------------------------------
// RU/EN behave identically: both languages route through the same `t()`
// lookup and the same conditional JSX — there is no per-language branch
// anywhere in this removal, so RU/EN parity is structural, not just
// tested per-string.
// ------------------------------------------------------------
test('no language-specific branch was introduced by this cleanup (RU/EN share the exact same rendered structure)', () => {
  assert.ok(!heroBlock.includes("lang === 'ru' ?") && !heroBlock.includes("lang==='ru'?"), 'HeroScreen must not gain a new RU-only/EN-only branch from this change');
});

// ------------------------------------------------------------
// Production isolation
// ------------------------------------------------------------
test('production/library/backend/consent/client-storage files remain byte-identical to committed HEAD', () => {
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js', 'client-store.js', 'client-data-consent.js', 'lash-scan-core.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('rankDesignsAll wiring itself is byte-unchanged — see tests/hooding-recommendation-removal.test.js for DESIGN_CATALOG scoring-content proof', () => {
  assert.ok(indexSource.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'), 'rankDesignsAll must be byte-unchanged');
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
