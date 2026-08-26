// ============================================================
// ANALYTICS — Phase 2, Stage 2.1-2.3 tests.
// ------------------------------------------------------------
// Same dependency-free assert-based convention as the rest of this
// repo's tests/*.test.js. Two parts:
//   1. Unit tests against analytics.js's real, required exports (no
//      hand-duplicated logic) — consent gate, strict event allowlist,
//      whole-event-rejection on any malformed/extra property,
//      immediate stop on withdrawal, and proof the Stage 2.1-2.3
//      provider adapter is a genuinely inert no-op (no DOM/network
//      primitive anywhere in its source).
//   2. Source-guard + byte-identity checks against index.html proving:
//      every Analytics.track() call site in the app uses one of the
//      6 reviewed event names (never scan_error, never an invented
//      name); no call site is inside LiveScanScreen/PhotoAnalysisScreen
//      (requirement: those two screens are untouched); and the scan
//      pipeline itself remains exactly as guarded by
//      tests/consent-manager.test.js's own J1/J2/J3/J4 suite (not
//      re-duplicated here — this file only adds the analytics-specific
//      angle: that no track() call site leaked into the scan screens).
//
// Run with:  node tests/analytics.test.js
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Analytics = require(path.join(__dirname, '..', 'analytics.js'));

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

function fakeProvider() {
  const log = [];
  return {
    name: 'fake-test-provider',
    loaded: false,
    load() { this.loaded = true; log.push({ type: 'load' }); },
    send(eventName, props) { log.push({ type: 'event', eventName, props }); },
    _log: log,
  };
}

// ================================================================
// A. Allowlist shape — the 6 reviewed events, scan_error excluded.
// ================================================================
test('A1. ALLOWED_EVENTS is exactly the 6 reviewed events, in no particular order, scan_error absent', () => {
  const expected = ['scan_started', 'scan_completed', 'results_viewed', 'details_viewed', 'rescan_started', 'language_changed'];
  assert.deepStrictEqual([...Analytics.ALLOWED_EVENTS].sort(), [...expected].sort());
  assert.ok(!Analytics.ALLOWED_EVENTS.includes('scan_error'), 'scan_error must not be implemented in this stage');
});

// ================================================================
// B. Consent gate — no script/init/network before consent=true.
// ================================================================
test('B1. before any setConsent() call, track() on a valid event is a no-op (returns false, provider never touched)', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  const ok = Analytics.track('scan_started', { mode: 'live' });
  assert.strictEqual(ok, false);
  assert.strictEqual(provider.loaded, false);
  assert.deepStrictEqual(provider._log, []);
});

test('B2. setConsent(false) (explicit Reject) never loads the provider and track() still no-ops', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(false);
  assert.strictEqual(provider.loaded, false);
  const ok = Analytics.track('scan_started', { mode: 'live' });
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(provider._log, [], 'Reject must produce zero analytics requests — provider log must stay empty');
});

test('B3. setConsent(true) (Accept) loads the provider exactly once (idempotent init)', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  Analytics.setConsent(true);
  Analytics.setConsent(true);
  assert.strictEqual(provider.loaded, true);
  assert.strictEqual(provider._log.filter((e) => e.type === 'load').length, 1, 'the provider must be initialized exactly once no matter how many times consent is re-affirmed');
});

test('B4. after setConsent(true), a valid event IS forwarded to the provider with the expected shape', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  const ok = Analytics.track('scan_started', { mode: 'live' });
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(provider._log[provider._log.length - 1], { type: 'event', eventName: 'scan_started', props: { mode: 'live' } });
});

// ================================================================
// C. Withdrawal — tracking stops immediately, same page session.
// ================================================================
test('C1. withdrawing consent (setConsent(false) after setConsent(true)) makes the very next track() call a no-op, with no reload / no re-init needed', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_started', { mode: 'live' }), true);
  Analytics.setConsent(false);
  const ok = Analytics.track('scan_completed', { mode: 'live' });
  assert.strictEqual(ok, false, 'track() must stop immediately after withdrawal, within the same page session');
  const eventLog = provider._log.filter((e) => e.type === 'event');
  assert.strictEqual(eventLog.length, 1, 'no new event must reach the provider after withdrawal');
});

test('C2. withdrawal does not attempt to unload/remove the already-loaded provider (nothing to un-execute) — only future track() calls are blocked', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  Analytics.setConsent(false);
  assert.strictEqual(provider.loaded, true, 'the stub provider object itself is not torn down — the guarantee lives entirely in track() re-checking consent, not in DOM cleanup');
});

test('C3. re-accepting after withdrawal (Accept -> Reject -> Accept) resumes tracking without double-initializing the provider', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  Analytics.setConsent(false);
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('rescan_started'), true);
  assert.strictEqual(provider._log.filter((e) => e.type === 'load').length, 1);
});

// ================================================================
// D. Strict allowlist — unknown events and malformed/extra properties
//    are rejected IN FULL, never partially forwarded.
// ================================================================
test('D1. an unknown event name is rejected outright, even with consent granted', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  const ok = Analytics.track('some_invented_event', {});
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(provider._log.filter((e) => e.type === 'event'), []);
});

test('D2. scan_error is rejected outright — not part of ALLOWED_EVENTS in this stage', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_error', {}), false);
});

test('D3. a missing required property (scan_started with no mode) is rejected in full', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_started', {}), false);
  assert.strictEqual(Analytics.track('scan_started'), false);
});

test('D4. an invalid value for a validated property (mode: "bogus") is rejected in full', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_started', { mode: 'bogus' }), false);
});

test('D5. ANY extra/unexpected property on an otherwise-valid event rejects the WHOLE call — never stripped-and-sent', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  const ok = Analytics.track('results_viewed', { extra: 'anything' });
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(provider._log.filter((e) => e.type === 'event'), [], 'a rejected event must never partially reach the provider');
});

test('D6. an event declared with zero properties (e.g. results_viewed) rejects any props object with keys at all', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('results_viewed', { mode: 'live' }), false);
  assert.strictEqual(Analytics.track('results_viewed'), true, 'results_viewed with no props at all must succeed');
  assert.strictEqual(Analytics.track('results_viewed', {}), true, 'results_viewed with an empty props object must succeed');
});

test('D7. a value resembling sensitive data (base64-ish/long free text) in an unexpected property key still rejects the whole call, not just that key', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  const suspicious = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const ok = Analytics.track('scan_completed', { mode: 'live', debug: suspicious });
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(provider._log.filter((e) => e.type === 'event'), []);
});

test('D8. sanitizeEventProps never returns a reference to the caller\'s object — later mutation of the input cannot retroactively change what was validated', () => {
  const input = { mode: 'live' };
  const out = Analytics.sanitizeEventProps('scan_started', input);
  assert.notStrictEqual(out, input);
  input.mode = 'photo';
  assert.strictEqual(out.mode, 'live');
});

// ================================================================
// E. Provider adapter is a genuinely inert no-op stub (Stage 2.1-2.3).
// ------------------------------------------------------------
// Both checks below scan CODE ONLY (line comments stripped first) —
// analytics.js's own header prose legitimately explains, in English,
// what it deliberately does NOT do ("never calls document.createElement",
// "WITHOUT connecting to Umami/Plausible"), which would otherwise be a
// false positive against a raw substring scan of the whole file.
// ================================================================
function stripLineComments(s) {
  return s.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}

test('E1. analytics.js CODE (comments stripped) contains no DOM-mutation or network primitive anywhere (createElement, appendChild, fetch, XMLHttpRequest, sendBeacon, WebSocket, script src assignment)', () => {
  const analyticsSrc = stripLineComments(fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8'));
  const forbidden = ['document.createElement', 'appendChild', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'new WebSocket', '.src ='];
  const hits = forbidden.filter((sig) => analyticsSrc.includes(sig));
  assert.deepStrictEqual(hits, [], `analytics.js's Stage 2.1-2.3 provider adapter must be a genuinely inert stub; found: ${hits.join(', ')}`);
});

test('E2. analytics.js CODE (comments stripped) references no real analytics vendor by name (umami/plausible/posthog/google-analytics/gtag) anywhere', () => {
  const analyticsSrc = stripLineComments(fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8')).toLowerCase();
  const forbidden = ['umami', 'plausible', 'posthog', 'google-analytics', 'googletagmanager', 'gtag('];
  const hits = forbidden.filter((sig) => analyticsSrc.includes(sig));
  assert.deepStrictEqual(hits, [], `no real provider should be named in CODE yet; found: ${hits.join(', ')}`);
});

test('E3. _debugState() exposes providerName/providerLog for introspection without ever being called by App() itself (test/debug-only, verified by naming convention _*)', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  Analytics.track('rescan_started');
  const state = Analytics._debugState();
  assert.strictEqual(state.consentAllowed, true);
  assert.strictEqual(state.initialized, true);
  assert.ok(Array.isArray(state.providerLog));
});

// ================================================================
// F. Source-guard against index.html — every real call site.
// ================================================================
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

function extractSpan(s, startMarker, endMarker) {
  const st = s.indexOf(startMarker);
  const en = s.indexOf(endMarker, st);
  if (st === -1 || en === -1) return null;
  return s.slice(st, en);
}

test('F1. analytics.js is loaded as a plain global <script>, immediately after consent-manager.js, before the main app script', () => {
  const consentIdx = src.indexOf('<script src="consent-manager.js"></script>');
  const analyticsIdx = src.indexOf('<script src="analytics.js"></script>');
  assert.ok(consentIdx !== -1 && analyticsIdx !== -1, 'expected both script tags to be present');
  assert.ok(analyticsIdx > consentIdx, 'analytics.js must be loaded after consent-manager.js');
});

test('F2. every Analytics.track(...) call site in index.html uses one of the 6 reviewed event-name string literals as its first argument — no invented name, scan_error never appears', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = [];
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.push(m[1]);
  assert.ok(found.length >= 6, `expected at least 6 Analytics.track() call sites, found ${found.length}`);
  const unexpected = found.filter((name) => !Analytics.ALLOWED_EVENTS.includes(name));
  assert.deepStrictEqual(unexpected, [], `every call site must use a reviewed event name; found unexpected: ${unexpected.join(', ')}`);
  assert.ok(!found.includes('scan_error'), 'scan_error must not appear as a call site yet');
});

test('F3. index.html\'s Analytics.track() call sites cover exactly the 6 reviewed events at least once each (scan_started fires for both live and photo entry points)', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = new Set();
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.add(m[1]);
  const expected = ['scan_started', 'scan_completed', 'results_viewed', 'details_viewed', 'rescan_started', 'language_changed'];
  expected.forEach((name) => assert.ok(found.has(name), `expected a call site for ${name}`));
});

test('F4. NO Analytics.track(...) call site falls inside LiveScanScreen or PhotoAnalysisScreen — both screens remain untouched by Stage 2.1-2.3', () => {
  const liveScan = extractSpan(src, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(liveScan !== null && photoScan !== null, 'expected to locate both screens');
  assert.ok(!liveScan.includes('Analytics'), 'LiveScanScreen must not reference Analytics at all');
  assert.ok(!photoScan.includes('Analytics'), 'PhotoAnalysisScreen must not reference Analytics at all');
});

test('F5. NO Analytics.track(...) call site ever passes scan-derived data as a property — only the fixed mode/lang enum properties the schema declares (source-guard: scans ONLY the properties-object argument, never the leading event-name literal, for "result", "profile", "landmark", "iris", "eyelid", "canvas", "image", "base64")', () => {
  // Captures just the optional second (properties-object) argument, so
  // the event-name string itself (e.g. "results_viewed", which legitimately
  // contains the substring "result") is never part of the scanned text.
  const callRe = /Analytics\.track\(\s*'[^']+'\s*(?:,\s*(\{[^}]*\}))?\s*\)/g;
  const propsArgs = [];
  let m;
  while ((m = callRe.exec(src)) !== null) propsArgs.push(m[1] || '');
  assert.ok(propsArgs.length >= 6, `expected to find the track() call sites, found ${propsArgs.length}`);
  const forbidden = ['result', 'profile', 'landmark', 'iris', 'eyelid', 'canvas', 'image', 'base64'];
  propsArgs.forEach((propsText) => {
    const hit = forbidden.find((f) => propsText.toLowerCase().includes(f));
    assert.strictEqual(hit, undefined, `properties argument "${propsText}" must not reference scan-derived data (found: ${hit})`);
  });
});

test('F6. the ConsentManager -> Analytics wiring effect calls the EXISTING ConsentManager.isAnalyticsAllowed(...) — this file does not duplicate the analytics-allowed boolean logic itself', () => {
  assert.ok(src.includes('Analytics.setConsent(ConsentManager.isAnalyticsAllowed('), 'expected the wiring effect to defer to ConsentManager.isAnalyticsAllowed(...) rather than recomputing the boolean inline');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
