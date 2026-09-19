'use strict';
// ============================================================
// RELEASE FIX #2 — LASH MAP CONTEXT-AWARE BACK NAVIGATION.
// ------------------------------------------------------------
// Fast, dependency-free unit-level regression for the lashMapOrigin
// mechanism (index.html's App(), ~line 14268/14331/14365-14367). Real
// extraction+eval of the actual, unmodified `viewMap` function (same
// technique save-to-client-flow.test.js already uses for it) plus
// structural/string assertions against the real screen-routing JSX
// (this repo has no @babel/core hard dependency, so the JSX itself
// can't be rendered in Node — see client-card-ui.test.js's own
// precedent). Complements, does not duplicate,
// tests/e2e/lashmap-back-navigation.spec.js, which proves the same
// contract through a real rendered browser end to end.
//
// Contract under test:
//   - Hero primary CTA and the alternatives carousel call onViewMap
//     (== viewMap) with NO origin argument -> lashMapOrigin defaults
//     to 'hero' -> LashMapScreen's Back returns to Results Hero.
//   - AllDesignsScreen's onSelect calls viewMap(design, 'catalog')
//     explicitly -> LashMapScreen's Back returns to All Designs.
//   - Historical/Visit design viewing (VisitDetailScreen) renders its
//     own VisitLashMapDiagram directly and never touches lashMapOrigin
//     or viewMap at all -- an architecturally separate path, so it is
//     provably unaffected by this mechanism.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const appStart = src.indexOf('    function App() {');
assert.ok(appStart !== -1, 'expected to locate App()');
const appBlock = src.slice(appStart);

// ------------------------------------------------------------
// A. Behavioral proof: the real, unmodified viewMap function, executed.
// ------------------------------------------------------------
const viewMapMatch = appBlock.match(/const viewMap = \(design, origin\) => \{[^\n]+/);
assert.ok(viewMapMatch, 'expected to locate the real viewMap function');
const viewMapSource = viewMapMatch[0];

function runViewMap(design, origin) {
  const calls = { setActiveDesign: [], setLashMapOrigin: [], setScreen: [] };
  new Function(
    'setActiveDesign', 'setLashMapOrigin', 'setScreen', 'design', 'origin',
    viewMapSource + '\nviewMap(design, origin);'
  )(
    (d) => calls.setActiveDesign.push(d),
    (o) => calls.setLashMapOrigin.push(o),
    (s) => calls.setScreen.push(s),
    design, origin
  );
  return calls;
}

test('A1. viewMap(design) with NO origin defaults lashMapOrigin to "hero" (Hero primary CTA / alternatives carousel path)', () => {
  const calls = runViewMap({ id: 'kitten' }, undefined);
  assert.deepStrictEqual(calls.setLashMapOrigin, ['hero']);
  assert.deepStrictEqual(calls.setScreen, ['lashmap']);
  assert.deepStrictEqual(calls.setActiveDesign, [{ id: 'kitten' }]);
});

test('A2. viewMap(design, "catalog") sets lashMapOrigin to "catalog" (All Designs path)', () => {
  const calls = runViewMap({ id: 'fox' }, 'catalog');
  assert.deepStrictEqual(calls.setLashMapOrigin, ['catalog']);
  assert.deepStrictEqual(calls.setScreen, ['lashmap']);
});

test('A3. an unrecognized/falsy origin still falls back to "hero", never crashes or passes through undefined', () => {
  assert.deepStrictEqual(runViewMap({ id: 'doll' }, '').setLashMapOrigin, ['hero']);
  assert.deepStrictEqual(runViewMap({ id: 'doll' }, null).setLashMapOrigin, ['hero']);
});

// ------------------------------------------------------------
// B. Structural wiring: the real screen-routing JSX lines.
// ------------------------------------------------------------
test('B1. lashMapOrigin state defaults to "hero" before any viewMap call', () => {
  assert.ok(appBlock.includes("const [lashMapOrigin, setLashMapOrigin] = useState('hero');"));
});

test('B2. Hero screen is wired with the RAW viewMap function (not a pre-bound origin) as onViewMap', () => {
  assert.ok(appBlock.includes('onViewMap={viewMap}'), 'HeroScreen must receive viewMap itself, unwrapped, so its own call sites (best-design CTA, carousel cards) get the default "hero" origin');
});

test('B3. AllDesignsScreen explicitly passes origin "catalog" through onSelect', () => {
  assert.ok(appBlock.includes("onSelect={(design) => viewMap(design, 'catalog')}"));
});

test('B4. LashMapScreen Back reads the live lashMapOrigin state, never a hardcoded screen name', () => {
  assert.ok(appBlock.includes('onBack={() => setScreen(lashMapOrigin)}'), 'LashMapScreen onBack must resolve dynamically via lashMapOrigin, not a fixed "hero"/"catalog" literal');
  assert.ok(!/screen === 'lashmap'[^\n]*onBack=\{\(\) => setScreen\('hero'\)\}/.test(appBlock), 'LashMapScreen back must never be hardcoded back to hero');
  assert.ok(!/screen === 'lashmap'[^\n]*onBack=\{\(\) => setScreen\('catalog'\)\}/.test(appBlock), 'LashMapScreen back must never be hardcoded back to catalog');
});

test('B5. AllDesignsScreen keeps its OWN, separate Back control fixed to "hero" (its own top-level Back, not the Lash Map Back)', () => {
  assert.ok(appBlock.includes("{screen === 'catalog' && result && <AllDesignsScreen result={result} onSelect={(design) => viewMap(design, 'catalog')} onBack={() => setScreen('hero')} />}"), 'AllDesignsScreen\'s own Back button is a distinct affordance from Lash Map\'s Back and must remain fixed to Results Hero');
});

// ------------------------------------------------------------
// C. Isolation: historical/Visit design viewing never touches this
//    mechanism at all (VisitDetailScreen renders VisitLashMapDiagram
//    directly, with its own onBack = closeVisitDetail -> 'clientCard').
// ------------------------------------------------------------
test('C. VisitDetailScreen (historical Visit design viewing) never references lashMapOrigin or viewMap in its own source', () => {
  const visitDetailStart = src.indexOf('function VisitDetailScreen({ lang, visitId, clientId, store, onBack }) {');
  assert.ok(visitDetailStart !== -1, 'expected to locate VisitDetailScreen');
  const visitDetailEnd = src.indexOf('\n    }\n', visitDetailStart);
  assert.ok(visitDetailEnd !== -1);
  const visitDetailBlock = src.slice(visitDetailStart, visitDetailEnd);
  assert.ok(!visitDetailBlock.includes('lashMapOrigin'), 'VisitDetailScreen must stay architecturally separate from the Lash Map origin-aware Back mechanism');
  assert.ok(!visitDetailBlock.includes('viewMap('), 'VisitDetailScreen must never call viewMap — it renders VisitLashMapDiagram directly from stored snapshot data');
  assert.ok(visitDetailBlock.includes('<VisitLashMapDiagram'), 'expected VisitDetailScreen to render the real VisitLashMapDiagram');
});
