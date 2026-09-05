'use strict';
// ============================================================
// RELEASE-1 — V1 launch scope guard.
// ------------------------------------------------------------
// PRODUCT DECISION: legacy Try-On must never be user-reachable in V1.
// An exhaustive source audit (see the RELEASE-1 report) found that no
// Try-On UI, route, CTA, or copy exists anywhere in this codebase —
// there was nothing to remove. This file exists to LOCK THAT IN as a
// permanent regression guard, so a future change cannot silently
// reintroduce a public Try-On entry point without this suite catching
// it. It also pins the intended public V1 screen/navigation surface
// and confirms every debug-only route stays explicitly gated.
//
// Same approach as this repo's other JSX-heavy screens (structural/
// string assertions against the real source — no @babel/core hard
// dependency here, see client-card-ui.test.js's own note).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + src.slice(braceStart, i + 1))();
}
const STRINGS = extractObjectLiteral('STRINGS');

// The one and only literal "Try-On" occurrence allowed anywhere in the
// production script: a comment documenting that a piece of debug state
// is explicitly isolated from a hypothetical future system by that
// name. If this count ever grows, something new referencing Try-On was
// added and must be reviewed against this release decision.
const TRYON_TOKEN_ALLOWLIST = ["// Try-On, or Application Plan logic."];

test('A/B/C/D/E. no screen, component, or navigation route in the app is named/keyed to Try-On, a simulation, or a lash preview', () => {
  const screenNames = [...src.matchAll(/screen === '([a-zA-Z]+)'/g)].map(m => m[1]);
  const uniqueScreens = [...new Set(screenNames)];
  assert.ok(uniqueScreens.length > 0, 'expected to find the screen-routing list');
  for (const name of uniqueScreens) {
    assert.ok(!/tryon|try-on|simulat|preview.?lash|lash.?preview/i.test(name), 'unexpected Try-On-shaped screen name: ' + name);
  }
  for (const forbidden of ['TryOnScreen', 'TryonScreen', 'LashSimulationScreen', 'LashPreviewScreen', 'onTryOn', 'onOpenTryOn']) {
    assert.ok(!src.includes(forbidden), 'unexpected Try-On surface: ' + forbidden);
  }
});

test('literal "Try-On" appears in the production script only in the one pre-existing, allowlisted isolation comment', () => {
  // \b word boundaries matter: "geometry-only" contains the bare
  // substring "try-on" (…me-TRY-ONly…) with no boundary on either side —
  // a real false positive a boundary-free regex would wrongly flag.
  const occurrences = [...src.matchAll(/\btry-?on\b/gi)].length;
  const allowedCount = TRYON_TOKEN_ALLOWLIST.filter(snippet => src.includes(snippet)).length;
  assert.strictEqual(occurrences, allowedCount, 'a new "Try-On" reference was added to index.html — review it against the RELEASE-1 decision to keep Try-On unreachable in V1');
});

test('J/K. no RU or EN STRINGS value promises a virtual try-on, lash preview, or before/after simulation', () => {
  const forbiddenRu = /примерить|примерка|виртуальн.*пример/i;
  const forbiddenEn = /virtual try-?on|try (on|the) lashes|lash preview|before\s*\/\s*after/i;
  for (const [key, value] of Object.entries(STRINGS)) {
    if (!value || typeof value !== 'object') continue;
    if (typeof value.ru === 'string') assert.ok(!forbiddenRu.test(value.ru), key + '.ru unexpectedly promises Try-On: ' + value.ru);
    if (typeof value.en === 'string') assert.ok(!forbiddenEn.test(value.en), key + '.en unexpectedly promises Try-On: ' + value.en);
  }
});

// ------------------------------------------------------------
// F/G/H. the intended public V1 flow's screen wiring is present and
// each screen guards on its required data (no blank-screen route).
// ------------------------------------------------------------
test('F. Results (Hero) -> Lash Map wiring is intact and gated on real result/design data', () => {
  assert.ok(src.includes("{screen === 'hero' && result && <HeroScreen"));
  assert.ok(src.includes("{screen === 'lashmap' && result && activeDesign && <LashMapScreen"));
});

test('G. Save to Client is wired from both Results and Lash Map to the same handler (no duplicate/parallel save path)', () => {
  const occurrences = (src.match(/onSaveToClient=\{handleSaveToClient\}/g) || []).length;
  assert.strictEqual(occurrences, 2);
});

test('H. Client Card -> Visit History -> Visit Detail wiring is intact and gated on real ids', () => {
  assert.ok(src.includes("{screen === 'clientCard' && activeClientId && <ClientCardScreen"));
  assert.ok(src.includes("{screen === 'visitDetail' && activeClientId && activeVisitId && <VisitDetailScreen"));
});

test('every screen route in App() is guarded so it can never render without its required data (no accidental blank screen)', () => {
  const routeLines = [...src.matchAll(/\{screen === '([a-zA-Z]+)' && ([\s\S]*?)<[A-Z][A-Za-z]*Screen/g)];
  assert.ok(routeLines.length >= 15, 'expected the full set of App() screen routes');
  const dataFreeRoutes = new Set(['home', 'clients', 'clientForm', 'scan', 'photo', 'lashscan', 'proLibraryPreview']);
  for (const [, name, guardExpr] of routeLines) {
    if (dataFreeRoutes.has(name)) continue;
    assert.notStrictEqual(guardExpr.trim(), '', name + ' route has no data guard before rendering its screen');
  }
});

// ------------------------------------------------------------
// I. debug-only routes stay explicitly, exclusively URL-gated.
// ------------------------------------------------------------
test('I. the debug-only Professional Lash Library preview is reachable ONLY via the initial ?debug=library URL param, never from any normal (non-debug) in-app navigation', () => {
  assert.ok(src.includes("new URLSearchParams(window.location.search).get('debug') === 'library' ? 'proLibraryPreview' : 'home'"));
  const setScreenToPreview = [...src.matchAll(/setScreen\('proLibraryPreview'\)/g)];
  // The only allowed occurrence is ProLibraryDetailScreen's own Back
  // button returning to the preview LIST it came from — navigation
  // entirely internal to the already ?debug=library-gated flow, never
  // a new public entry point into it.
  assert.strictEqual(setScreenToPreview.length, 1, 'expected exactly one setScreen(\'proLibraryPreview\') call: ProLibraryDetailScreen\'s own internal Back button');
  assert.ok(src.includes("<ProLibraryDetailScreen canonicalId={debugPreviewCanonicalId} onBack={() => setScreen('proLibraryPreview')} />"), 'the one allowed call must be exactly the debug detail screen\'s own Back handler');
});

test('isDebugModeEnabled() gates every debug-only console/UI surface identified in the RELEASE-1 audit', () => {
  assert.ok(src.includes("console.log('[Photo] EYELID CREASE V2 (debug shadow, not used in classification)'"));
  assert.ok(src.includes("console.log('[Photo] IRIS COLOR AUDIT (debug shadow, not used in production)'"));
  const creaseIdx = src.indexOf("console.log('[Photo] EYELID CREASE V2");
  const irisAuditIdx = src.indexOf("console.log('[Photo] IRIS COLOR AUDIT");
  assert.ok(src.lastIndexOf('if (isDebugModeEnabled()) {', creaseIdx) > creaseIdx - 3000);
  assert.ok(src.lastIndexOf('if (isDebugModeEnabled()) {', irisAuditIdx) > irisAuditIdx - 3000);
});
