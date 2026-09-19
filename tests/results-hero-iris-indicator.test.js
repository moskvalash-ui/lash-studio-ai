'use strict';
// ============================================================
// RESULTS HERO — compact, always-visible IRIS COLOR indicator.
// ------------------------------------------------------------
// Read-only audit finding: iris color analysis was already correct and
// already stored on result.iris (both Photo Analysis and Live Scan),
// but the only place HeroScreen rendered it (the "AI Eye Profile"
// EyeProfileRow) sits inside a Section collapsed by default since
// d813aef "Improve Results Hero hierarchy" -- so a user who never taps
// to expand it never sees an iris color at all, and has no other route
// to DetailsScreen's own iris card either (its "More details" button is
// nested inside the same collapsed Section).
//
// This file proves the fix: a small, always-visible indicator was added
// to the existing non-collapsible photo/mesh-overlay card on HeroScreen,
// reusing the EXACT same already-computed value (labels.irisCompositionLabel,
// built by eyeProfileLabels from result.iris, unchanged) and the EXACT
// same STRINGS key (irisColorLabel) the pre-existing collapsed row
// already used -- no new classification, no new localization mapping,
// no new result-object field.
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

function extractFunctionSpan(source, startMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf('\n    function ', start + 10);
  return { start, end, block: start >= 0 && end > start ? source.slice(start, end) : '' };
}

const hero = extractFunctionSpan(src, '    function HeroScreen(');
assert.ok(hero.block, 'expected to locate HeroScreen');

const sectionStart = hero.block.indexOf(`<Section title={t('eyeProfileTitle', lang)}>`);
const indicatorStart = hero.block.indexOf('data-hero-iris-indicator="1"');
assert.ok(sectionStart >= 0, 'expected to locate the (collapsed) AI Eye Profile Section');
assert.ok(indicatorStart >= 0, 'expected to locate the new iris indicator');

test('A. the iris indicator is structurally OUTSIDE and BEFORE the collapsible AI Eye Profile Section, so it renders regardless of that Section\'s open/closed state', () => {
  assert.ok(indicatorStart < sectionStart, 'the iris indicator must not be nested inside <Section>...</Section> (whose children only render when open)');
});

test('B. the AI Eye Profile Section itself is still collapsed by default -- no defaultOpen prop was added back', () => {
  assert.ok(hero.block.includes(`<Section title={t('eyeProfileTitle', lang)}>`), 'Section must still have no defaultOpen prop');
  assert.ok(!hero.block.includes(`<Section title={t('eyeProfileTitle', lang)} defaultOpen>`), 'defaultOpen must not have been restored');
});

test('C. still exactly 6 EyeProfileRow entries -- the new indicator is a plain div, not a 7th EyeProfileRow, and does not duplicate the Eye Profile section', () => {
  const rowCount = (hero.block.match(/<EyeProfileRow[^/]*\/>/g) || []).length;
  assert.strictEqual(rowCount, 6);
  const indicatorBlockEnd = hero.block.indexOf('</div>', hero.block.indexOf('</div>', indicatorStart) + 1);
  const indicatorSnippet = hero.block.slice(indicatorStart - 200, indicatorBlockEnd);
  assert.ok(!indicatorSnippet.includes('<EyeProfileRow'), 'the new indicator must not render an EyeProfileRow');
});

test('D. the indicator reuses the EXISTING result.iris field and the SAME already-computed labels.irisCompositionLabel -- no new iris classification/mapping is introduced', () => {
  assert.ok(hero.block.includes('result.iris?.hex'), 'expected the indicator to read the existing result.iris.hex field');
  const indicatorRegion = hero.block.slice(indicatorStart, indicatorStart + 700);
  assert.ok(indicatorRegion.includes('{labels.irisCompositionLabel}'), 'expected the indicator to display the exact same labels.irisCompositionLabel value already computed by eyeProfileLabels for the existing collapsed row');
  // labels.irisCompositionLabel/eyeProfileLabels/result.iris are computed
  // once, at the very top of HeroScreen, unchanged -- see test H below.
  assert.ok(hero.block.includes('const labels = eyeProfileLabels(p, result.iris, lang);'), 'eyeProfileLabels call site (source of the reused value) must be unchanged');
});

test('E. the indicator uses the SAME STRINGS key (irisColorLabel) the pre-existing collapsed row already used -- no new localization mapping', () => {
  const indicatorRegion = hero.block.slice(indicatorStart, indicatorStart + 700);
  assert.ok(indicatorRegion.includes("{t('irisColorLabel', lang)}"), 'expected the indicator label to use the existing irisColorLabel STRINGS key');
  // Confirm this is the SAME key already used by the pre-existing row (not a parallel/duplicate string).
  const existingRowOccurrences = (hero.block.match(/t\('irisColorLabel', lang\)/g) || []).length;
  assert.strictEqual(existingRowOccurrences, 2, 'expected exactly 2 uses of irisColorLabel in HeroScreen: the existing collapsed row and the new always-visible indicator');
});

test('F. the indicator never introduces a new SVG/icon element and never adds a language-specific ternary branch', () => {
  const indicatorRegion = hero.block.slice(indicatorStart - 400, indicatorStart + 700);
  assert.ok(!indicatorRegion.includes('<svg'), 'the indicator must not introduce a raw <svg> element');
  assert.ok(!hero.block.includes("lang === 'ru' ?") && !hero.block.includes("lang==='ru'?"), 'HeroScreen must not gain a new RU-only/EN-only branch from this change');
});

test('G. the primary CTA (Open Lash Map) is unchanged and appears in the source BEFORE the new indicator -- the indicator was added after the CTA, never repositioning it', () => {
  const ctaIdx = hero.block.indexOf("{t('heroOpenLashMap', lang)}");
  assert.ok(ctaIdx >= 0, 'expected to find the primary CTA');
  assert.ok(ctaIdx < indicatorStart, 'the primary CTA must remain positioned before the new indicator in source/DOM order');
  assert.ok(hero.block.includes("onClick={() => { if (typeof Analytics !== 'undefined') Analytics.track('lash_map_opened', { design_id: best.id, origin: 'best_design' }); onViewMap(best.clientDesign); }}"), 'the CTA\'s own handler must be byte-unchanged');
});

test('H. eyeProfileLabels, classifyIrisColor, combineIris, sampleIrisColor, and analyzeIrisSample are all byte-identical to git HEAD -- this is a presentation-only addition, no analytical code was touched', () => {
  for (const marker of [
    '    function eyeProfileLabels(p, iris, lang) {',
    '    function classifyIrisColor(r,g,b) {',
    '    function combineIris(l, r) {',
    '    function sampleIrisColor(ctx, eyePoints) {',
    '    function analyzeIrisSample(ctx, eyePoints, fixedCenter) {',
  ]) {
    const curStart = src.indexOf(marker);
    const prevStart = HEAD.indexOf(marker);
    assert.ok(curStart >= 0 && prevStart >= 0, 'expected to locate ' + marker + ' in both current and HEAD source');
    const curEnd = src.indexOf('\n    function ', curStart + 10);
    const prevEnd = HEAD.indexOf('\n    function ', prevStart + 10);
    assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), marker + ' must be byte-identical to HEAD');
  }
});

test('I. Photo Analysis and Live Scan result-object construction (photoRec/rec) are byte-identical to git HEAD -- the result schema/contract is unchanged', () => {
  for (const marker of ['const photoRec = {', 'const rec = {\n            source: \'live\', eyeProfile: finalProfile, iris, designs,']) {
    const curIdx = src.indexOf(marker);
    const prevIdx = HEAD.indexOf(marker);
    assert.ok(curIdx >= 0 && prevIdx >= 0, 'expected to locate result-object construction: ' + marker);
    const curEnd = src.indexOf('};', curIdx) + 2;
    const prevEnd = HEAD.indexOf('};', prevIdx) + 2;
    assert.strictEqual(src.slice(curIdx, curEnd), HEAD.slice(prevIdx, prevEnd), marker + ' object literal must be byte-identical to HEAD');
  }
});

test('J. the indicator degrades to the existing insufficientData/uncertain wording rather than a fabricated color, via the SAME fallback chain labels.irisCompositionLabel already uses', () => {
  // eyeProfileLabels' own fallback chain (proven byte-identical to HEAD by
  // test H above) already handles the missing/uncertain cases:
  //   irisName = iris?.name ? IRIS_NAMES[...] : t('insufficientData', lang)
  //   irisCompositionLabel = iris?.compositionLabel ? resolveIrisColorLabel(...) : irisName
  // The indicator reads labels.irisCompositionLabel directly (test D), so
  // it inherits this exact chain -- no separate "unavailable" branch, no
  // second mapping, was introduced for the indicator itself.
  const start = src.indexOf('    function eyeProfileLabels(p, iris, lang) {');
  const end = src.indexOf('\n    }', start) + '\n    }'.length;
  const body = src.slice(start, end);
  assert.ok(body.includes("const irisName = iris?.name ? (lang==='en' ? IRIS_NAMES[iris.name].en : IRIS_NAMES[iris.name].ru) : t('insufficientData', lang);"));
  assert.ok(body.includes("const irisCompositionLabel = iris?.compositionLabel ? (lang==='en' ? resolveIrisColorLabel(iris.compositionLabel).en : resolveIrisColorLabel(iris.compositionLabel).ru) : irisName;"));
});

test('K. the swatch dot only renders when result.iris.hex is truthy -- never a fabricated/placeholder color', () => {
  const indicatorRegion = hero.block.slice(indicatorStart, indicatorStart + 700);
  assert.ok(indicatorRegion.includes('{result.iris?.hex && <span style={{background: result.iris.hex}}'), 'the swatch must be conditionally rendered only when a real hex value exists');
});
