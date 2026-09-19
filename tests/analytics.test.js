// ============================================================
// ANALYTICS — tests, through Stage 3 (closed-beta PostHog patch).
// ------------------------------------------------------------
// Same dependency-free assert-based convention as the rest of this
// repo's tests/*.test.js. Three parts:
//   1. Unit tests against analytics.js's real, required exports (no
//      hand-duplicated logic) — consent gate, strict event allowlist,
//      whole-event-rejection on any malformed/extra property,
//      immediate stop on withdrawal, and proof the real provider is
//      an HTTP-capture-only integration (no vendor SDK/script tag, so
//      autocapture/Session Replay/surveys/heatmaps are architecturally
//      absent, not merely disabled).
//   2. Identity-model tests (anonymous_installation_id/session_id) —
//      randomness, no user/device data, persistence behavior.
//   3. Source-guard + byte-identity checks against index.html proving:
//      every Analytics.track() call site in the app uses one of the
//      17 reviewed event names (never scan_error, never an invented
//      name); the ONLY Analytics usage inside LiveScanScreen/
//      PhotoAnalysisScreen is the reviewed scan_failed call at each
//      screen's own real failure site; and no call site's properties
//      argument ever references scan-derived or client-entered data.
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
// A. Allowlist shape — the 17 reviewed events (Stage 3: closed-beta
//    PostHog patch adds 11 to the original 5 + language_changed),
//    scan_error still excluded (superseded by scan_failed, never
//    itself implemented).
// ================================================================
test('A1. ALLOWED_EVENTS is exactly the 17 reviewed events, in no particular order, scan_error absent', () => {
  const expected = [
    'app_open', 'scan_started', 'scan_completed', 'scan_failed',
    'results_viewed', 'details_viewed', 'rescan_started', 'language_changed',
    'all_designs_opened', 'lash_map_opened', 'save_to_client_started',
    'client_created', 'client_selected', 'visit_saved', 'visit_save_failed',
    'client_card_viewed', 'historical_visit_opened',
  ];
  assert.deepStrictEqual([...Analytics.ALLOWED_EVENTS].sort(), [...expected].sort());
  assert.ok(!Analytics.ALLOWED_EVENTS.includes('scan_error'), 'scan_error must never be implemented — scan_failed supersedes it');
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
// E. Provider adapter — Stage 3: a REAL PostHog HTTP-capture-only
//    integration. Both checks below scan CODE ONLY (line comments
//    stripped first) — analytics.js's own header prose legitimately
//    describes what it does/doesn't do in English, which would
//    otherwise be a false positive against a raw substring scan.
// ================================================================
function stripLineComments(s) {
  // String-aware: a naive line.indexOf('//') would misfire on the
  // 'https://...' string literal (POSTHOG_API_HOST) and truncate the
  // line mid-string. Track single/double-quote state so '//' only ends
  // the line when it's real code, not inside a string.
  return s.split('\n').map((line) => {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inSingle) {
        if (c === '\\') { i++; continue; }
        if (c === "'") inSingle = false;
        continue;
      }
      if (inDouble) {
        if (c === '\\') { i++; continue; }
        if (c === '"') inDouble = false;
        continue;
      }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

function extractFnSpan(s, startMarker) {
  const st = s.indexOf(startMarker);
  if (st === -1) return null;
  // Balanced-brace extraction from the first '{' after startMarker.
  let i = s.indexOf('{', st);
  let depth = 0;
  const bodyStart = i;
  for (; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return s.slice(st, i + 1); }
  }
  return s.slice(st, bodyStart);
}

test('E1. the ONLY network primitive anywhere in analytics.js CODE is a single fetch( call, and it lives inside createPostHogProvider — no DOM-mutation or script-injection primitive exists anywhere (createElement, appendChild, XMLHttpRequest, sendBeacon, WebSocket, script src assignment, innerHTML)', () => {
  const rawSrc = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');
  const analyticsSrc = stripLineComments(rawSrc);
  const forbiddenAlways = ['document.createElement', 'appendChild', 'XMLHttpRequest', 'sendBeacon', 'new WebSocket', '.src =', 'innerHTML'];
  const hits = forbiddenAlways.filter((sig) => analyticsSrc.includes(sig));
  assert.deepStrictEqual(hits, [], `no DOM-mutation/script-injection primitive may ever appear; found: ${hits.join(', ')}`);

  const fetchCount = (analyticsSrc.match(/fetch\(/g) || []).length;
  assert.strictEqual(fetchCount, 1, `expected exactly one fetch( call in the whole file, found ${fetchCount}`);

  const providerFn = extractFnSpan(analyticsSrc, 'function createPostHogProvider(');
  assert.ok(providerFn !== null, 'expected to locate createPostHogProvider');
  assert.ok(providerFn.includes('fetch('), 'the one fetch( call must live inside createPostHogProvider');
});

test('E2. analytics.js never loads posthog-js or any other vendor SDK/script tag — PostHog is referenced only as a plain HTTP capture target (api host + api_key field), and no OTHER vendor (umami/plausible/google-analytics/gtag/mixpanel/amplitude/segment) is referenced anywhere', () => {
  const analyticsSrc = stripLineComments(fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8'));
  const sdkSignatures = ['posthog-js', 'posthog.init', 'array.js', '<script', 'unpkg.com', 'cdn.'];
  const sdkHits = sdkSignatures.filter((sig) => analyticsSrc.includes(sig));
  assert.deepStrictEqual(sdkHits, [], `no vendor SDK/script-tag reference may ever appear; found: ${sdkHits.join(', ')}`);

  const lower = analyticsSrc.toLowerCase();
  const forbiddenVendors = ['umami', 'plausible', 'google-analytics', 'googletagmanager', 'gtag(', 'mixpanel', 'amplitude', 'segment.'];
  const vendorHits = forbiddenVendors.filter((sig) => lower.includes(sig));
  assert.deepStrictEqual(vendorHits, [], `no other, unreviewed vendor may ever be named; found: ${vendorHits.join(', ')}`);

  assert.ok(analyticsSrc.includes("POSTHOG_API_HOST = 'https://eu.i.posthog.com'"), 'expected PostHog EU Cloud as the exact, literal capture host (data residency requirement)');
});

test("E2b. the PostHog Project API Key is present exactly once, as a single named constant, and looks like a real token (starts with 'phc_', not a placeholder)", () => {
  const analyticsSrc = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');
  const matches = [...analyticsSrc.matchAll(/const POSTHOG_PROJECT_TOKEN = '([^']*)';/g)];
  assert.strictEqual(matches.length, 1, 'expected exactly one POSTHOG_PROJECT_TOKEN declaration');
  const token = matches[0][1];
  assert.ok(token.startsWith('phc_'), 'token must have the real PostHog project-key prefix');
  assert.ok(!/REPLACED_AT_IMPLEMENTATION_TIME|YOUR_TOKEN|PLACEHOLDER|TODO/i.test(token), 'token must not still be a placeholder');
  assert.ok(token.length >= 20, 'token must not be a truncated/malformed value');
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

test('F2. every Analytics.track(...) call site in index.html uses one of the 17 reviewed event-name string literals as its first argument — no invented name, scan_error never appears', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = [];
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.push(m[1]);
  assert.ok(found.length >= 23, `expected at least 23 Analytics.track() call sites, found ${found.length}`);
  const unexpected = found.filter((name) => !Analytics.ALLOWED_EVENTS.includes(name));
  assert.deepStrictEqual(unexpected, [], `every call site must use a reviewed event name; found unexpected: ${unexpected.join(', ')}`);
  assert.ok(!found.includes('scan_error'), 'scan_error must never appear as a call site');
});

test('F3. index.html\'s Analytics.track() call sites cover exactly the 17 reviewed events at least once each', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = new Set();
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.add(m[1]);
  Analytics.ALLOWED_EVENTS.forEach((name) => assert.ok(found.has(name), `expected a call site for ${name}`));
});

test('F4. inside LiveScanScreen/PhotoAnalysisScreen, the ONLY Analytics usage is the reviewed scan_failed call at each screen\'s own real failure site — exactly 1 in LiveScanScreen (its pipeline-error catch) and exactly 3 in PhotoAnalysisScreen (no_face_detected / quality_rejected / processing_error), each using mode/reason_code enum literals only, nothing else', () => {
  const liveScan = extractSpan(src, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(liveScan !== null && photoScan !== null, 'expected to locate both screens');

  const liveCalls = liveScan.match(/Analytics\.track\([^)]*\)/g) || [];
  assert.strictEqual(liveCalls.length, 1, `LiveScanScreen must contain exactly one Analytics.track call, found ${liveCalls.length}`);
  assert.ok(liveCalls[0].includes("'scan_failed'") && liveCalls[0].includes("mode: 'live'") && liveCalls[0].includes("reason_code: 'processing_error'"), 'LiveScanScreen\'s one call must be scan_failed{mode:live, reason_code:processing_error}');

  const photoCalls = photoScan.match(/Analytics\.track\([^)]*\)/g) || [];
  assert.strictEqual(photoCalls.length, 3, `PhotoAnalysisScreen must contain exactly 3 Analytics.track calls, found ${photoCalls.length}`);
  photoCalls.forEach((c) => assert.ok(c.includes("'scan_failed'") && c.includes("mode: 'photo'"), `every PhotoAnalysisScreen call must be scan_failed{mode:photo,...}, got: ${c}`));
  const reasonCodes = photoCalls.map((c) => (c.match(/reason_code:\s*'([a-z_]+)'/) || [])[1]).sort();
  assert.deepStrictEqual(reasonCodes, ['no_face_detected', 'processing_error', 'quality_rejected']);

  // No OTHER Analytics reference (any event name) exists in either screen.
  const liveOther = (liveScan.match(/Analytics\.track\(\s*'([^']+)'/g) || []).filter((c) => !c.includes("'scan_failed'"));
  const photoOther = (photoScan.match(/Analytics\.track\(\s*'([^']+)'/g) || []).filter((c) => !c.includes("'scan_failed'"));
  assert.deepStrictEqual(liveOther, [], 'LiveScanScreen must not reference any event other than scan_failed');
  assert.deepStrictEqual(photoOther, [], 'PhotoAnalysisScreen must not reference any event other than scan_failed');
});

test('F5. NO Analytics.track(...) call site ever passes scan-derived data, client-entered data, or free text as a property — only fixed enum literals the schema declares (source-guard: scans ONLY the properties-object argument, with quoted string literals stripped first so enum VALUES like "results_carousel"/"client store unavailable" cannot false-positive against substrings inside them; a bare identifier/property REFERENCE like `result` or `profile.landmarks` would still be caught)', () => {
  // Captures just the optional second (properties-object) argument, so
  // the event-name string itself (e.g. "results_viewed", which legitimately
  // contains the substring "result") is never part of the scanned text.
  const callRe = /Analytics\.track\(\s*'[^']+'\s*(?:,\s*(\{[^}]*\}))?\s*\)/g;
  const propsArgs = [];
  let m;
  while ((m = callRe.exec(src)) !== null) propsArgs.push(m[1] || '');
  assert.ok(propsArgs.length >= 23, `expected to find the track() call sites, found ${propsArgs.length}`);
  const forbidden = ['result', 'profile', 'landmark', 'iris', 'eyelid', 'canvas', 'image', 'base64', 'client', 'visit', 'snapshot', 'phone', 'email', 'note'];
  propsArgs.forEach((propsText) => {
    const withoutStringLiterals = propsText.replace(/'[^']*'/g, "''");
    const hit = forbidden.find((f) => withoutStringLiterals.toLowerCase().includes(f));
    assert.strictEqual(hit, undefined, `properties argument "${propsText}" must not reference scan/client-derived data outside a quoted enum literal (found: ${hit})`);
  });
});

test('F6. the ConsentManager -> Analytics wiring effect calls the EXISTING ConsentManager.isAnalyticsAllowed(...) — this file does not duplicate the analytics-allowed boolean logic itself', () => {
  assert.ok(src.includes('Analytics.setConsent(ConsentManager.isAnalyticsAllowed('), 'expected the wiring effect to defer to ConsentManager.isAnalyticsAllowed(...) rather than recomputing the boolean inline');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
