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
// A. Allowlist shape — 24 reviewed events (Stage 5: scan_quality_rejected
//    adds one MORE granular, additive signal alongside the existing
//    scan_failed{quality_rejected} — never replacing or reshaping it, so
//    its existing PostHog history stays intact), scan_error still
//    excluded (superseded by scan_failed, never itself implemented).
// ================================================================
test('A1. ALLOWED_EVENTS is exactly the 24 reviewed events, in no particular order, scan_error absent', () => {
  const expected = [
    'app_open', 'onboarding_started', 'onboarding_completed', 'home_viewed',
    'scan_started', 'scan_completed', 'scan_failed', 'scan_quality_rejected', 'camera_failed',
    'photo_loaded', 'results_viewed', 'details_viewed', 'rescan_started',
    'language_changed', 'all_designs_opened', 'lash_map_opened',
    'lash_preview_opened', 'save_to_client_started', 'client_created',
    'client_selected', 'visit_saved', 'visit_save_failed',
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

// Like extractFnSpan, but for a component whose header itself contains a
// destructured-params brace (e.g. `function Foo({ a, b }) {`) — extractFnSpan's
// "first '{' after startMarker" would match that params brace instead of the
// body, so `header` here must be the FULL literal header text ending in the
// body's own opening '{' (i.e. up to and including "...}) {").
function extractBodyAfterHeader(s, header) {
  const st = s.indexOf(header);
  if (st === -1) return null;
  let depth = 0;
  for (let i = st + header.length - 1; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return s.slice(st, i + 1); }
  }
  return null;
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

test('F2. every Analytics.track(...) call site in index.html uses one of the 24 reviewed event-name string literals as its first argument — no invented name, scan_error never appears', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = [];
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.push(m[1]);
  assert.ok(found.length >= 31, `expected at least 31 Analytics.track() call sites, found ${found.length}`);
  const unexpected = found.filter((name) => !Analytics.ALLOWED_EVENTS.includes(name));
  assert.deepStrictEqual(unexpected, [], `every call site must use a reviewed event name; found unexpected: ${unexpected.join(', ')}`);
  assert.ok(!found.includes('scan_error'), 'scan_error must never appear as a call site');
});

test('F3. index.html\'s Analytics.track() call sites cover exactly the 24 reviewed events at least once each', () => {
  const callSiteRe = /Analytics\.track\(\s*'([^']+)'/g;
  const found = new Set();
  let m;
  while ((m = callSiteRe.exec(src)) !== null) found.add(m[1]);
  Analytics.ALLOWED_EVENTS.forEach((name) => assert.ok(found.has(name), `expected a call site for ${name}`));
});

test('F4. inside LiveScanScreen/PhotoAnalysisScreen, Analytics usage is limited to the reviewed failure/funnel calls at each screen\'s own real site — LiveScanScreen: exactly 1 scan_failed (pipeline-error catch) + 1 camera_failed (getUserMedia catch); PhotoAnalysisScreen: exactly 4 scan_failed (no_face_detected / quality_rejected / processing_error / timeout) + 1 scan_quality_rejected + 1 photo_loaded — nothing else', () => {
  const liveScan = extractSpan(src, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(liveScan !== null && photoScan !== null, 'expected to locate both screens');

  const liveCalls = liveScan.match(/Analytics\.track\([^)]*\)/g) || [];
  assert.strictEqual(liveCalls.length, 2, `LiveScanScreen must contain exactly 2 Analytics.track calls, found ${liveCalls.length}`);
  const liveScanFailed = liveCalls.filter((c) => c.includes("'scan_failed'"));
  const liveCameraFailed = liveCalls.filter((c) => c.includes("'camera_failed'"));
  assert.strictEqual(liveScanFailed.length, 1, 'expected exactly 1 scan_failed call in LiveScanScreen');
  assert.ok(liveScanFailed[0].includes("mode: 'live'") && liveScanFailed[0].includes("reason_code: 'processing_error'"), 'LiveScanScreen\'s scan_failed call must be {mode:live, reason_code:processing_error}');
  assert.strictEqual(liveCameraFailed.length, 1, 'expected exactly 1 camera_failed call in LiveScanScreen');
  assert.ok(liveCameraFailed[0].includes("'permission_denied'") && liveCameraFailed[0].includes("'unavailable'"), 'LiveScanScreen\'s camera_failed call must reference both closed-enum reason_code literals (via the existing NotAllowedError ternary), never a free string');

  const photoCalls = photoScan.match(/Analytics\.track\([^)]*\)/g) || [];
  assert.strictEqual(photoCalls.length, 6, `PhotoAnalysisScreen must contain exactly 6 Analytics.track calls, found ${photoCalls.length}`);
  const photoScanFailed = photoCalls.filter((c) => c.includes("'scan_failed'"));
  const photoQualityRejected = photoCalls.filter((c) => c.includes("'scan_quality_rejected'"));
  const photoLoaded = photoCalls.filter((c) => c.includes("'photo_loaded'"));
  assert.strictEqual(photoScanFailed.length, 4, `PhotoAnalysisScreen must contain exactly 4 scan_failed calls, found ${photoScanFailed.length}`);
  photoScanFailed.forEach((c) => assert.ok(c.includes("mode: 'photo'"), `every PhotoAnalysisScreen scan_failed call must be mode:photo, got: ${c}`));
  const reasonCodes = photoScanFailed.map((c) => (c.match(/reason_code:\s*'([a-z_]+)'/) || [])[1]).sort();
  assert.deepStrictEqual(reasonCodes, ['no_face_detected', 'processing_error', 'quality_rejected', 'timeout']);
  assert.strictEqual(photoQualityRejected.length, 1, 'expected exactly 1 scan_quality_rejected call in PhotoAnalysisScreen');
  assert.ok(photoQualityRejected[0].includes("mode: 'photo'"), 'scan_quality_rejected call must be mode:photo');
  assert.ok(photoQualityRejected[0].includes('reason: qualityReason'), 'scan_quality_rejected\'s reason must come from the computed qualityReason variable, never a hardcoded literal');
  assert.strictEqual(photoLoaded.length, 1, 'expected exactly 1 photo_loaded call in PhotoAnalysisScreen');
  assert.strictEqual(photoLoaded[0], "Analytics.track('photo_loaded')", 'photo_loaded must be called with no properties');

  // No OTHER Analytics reference (any event name) exists in either screen.
  const liveOther = (liveScan.match(/Analytics\.track\(\s*'([^']+)'/g) || []).filter((c) => !c.includes("'scan_failed'") && !c.includes("'camera_failed'"));
  const photoOther = (photoScan.match(/Analytics\.track\(\s*'([^']+)'/g) || []).filter((c) => !c.includes("'scan_failed'") && !c.includes("'scan_quality_rejected'") && !c.includes("'photo_loaded'"));
  assert.deepStrictEqual(liveOther, [], 'LiveScanScreen must not reference any event other than scan_failed/camera_failed');
  assert.deepStrictEqual(photoOther, [], 'PhotoAnalysisScreen must not reference any event other than scan_failed/scan_quality_rejected/photo_loaded');
});

test('F4c (source-guard). scan_quality_rejected reuses the EXISTING HINT_PRIORITY_ORDER priority pick (not quality.reasons[0], not a new priority list) to choose a single reason when several co-occur', () => {
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(photoScan.includes('HINT_PRIORITY_ORDER.find(r => quality.reasons.includes(r))'), 'expected scan_quality_rejected\'s reason to be computed via the existing HINT_PRIORITY_ORDER.find(...) priority pick');
  assert.ok(!photoScan.includes("reason: quality.reasons[0]"), 'must not use the unprioritized quality.reasons[0] for analytics');
});

test('F4d (source-guard). scan_quality_rejected is sent from INSIDE the same `if (!photoQualityProceeds)` branch as scan_failed{quality_rejected} — never reachable when photoQualityProceeds is true (i.e. never when photoQualityRecovered is true)', () => {
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  const idx = photoScan.indexOf('if (!photoQualityProceeds) {');
  assert.ok(idx !== -1, 'expected the !photoQualityProceeds branch');
  const branchEnd = photoScan.indexOf('setState(\'error\'); return;', idx);
  assert.ok(branchEnd !== -1, 'expected to find the branch body');
  const branch = photoScan.slice(idx, branchEnd);
  assert.ok(branch.includes("Analytics.track('scan_failed', { mode: 'photo', reason_code: 'quality_rejected' })"), 'expected the existing scan_failed{quality_rejected} call inside this same branch');
  assert.ok(branch.includes("Analytics.track('scan_quality_rejected'"), 'expected scan_quality_rejected inside this same branch, not a separate/parallel code path');
});

test('F4b. the PHOTO watchdog\'s scan_failed{timeout} call is reached exactly once, inside the SAME already-idempotent branch guarded by the pre-existing `finished` flag — this patch does not add a new dedup mechanism nor change watchdog timing', () => {
  const watchdogSpan = extractFnSpan(src, 'const watchdogTimer = setTimeout(');
  assert.ok(watchdogSpan !== null, 'expected to locate the watchdogTimer callback');
  assert.ok(watchdogSpan.includes('if (finished || cancelledRef.current) return;'), 'the watchdog callback must still start with the pre-existing idempotency guard');
  const timeoutCalls = (watchdogSpan.match(/Analytics\.track\(\s*'scan_failed'\s*,\s*\{\s*mode:\s*'photo'\s*,\s*reason_code:\s*'timeout'\s*\}\s*\)/g) || []);
  assert.strictEqual(timeoutCalls.length, 1, `expected exactly one scan_failed{timeout} call inside the watchdog callback, found ${timeoutCalls.length}`);
  assert.ok(!/WATCHDOG_MS\s*=\s*(?!20000)\d+/.test(src), 'WATCHDOG_MS must remain unchanged at 20000');
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

// ================================================================
// G. Stage 4 — the 6 new funnel-completeness events: schema validation,
//    consent gating (generic track() gate, proven once per new event
//    rather than re-testing B/C's whole mechanism), and source-guards
//    proving each fires once-per-genuine-occurrence, not on every
//    React re-render.
// ================================================================
test('G1. onboarding_started/onboarding_completed/home_viewed/photo_loaded accept zero properties and reject any property', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  ['onboarding_started', 'onboarding_completed', 'home_viewed', 'photo_loaded'].forEach((name) => {
    assert.strictEqual(Analytics.track(name), true, `${name} with no props must succeed`);
    assert.strictEqual(Analytics.track(name, {}), true, `${name} with an empty props object must succeed`);
    assert.strictEqual(Analytics.track(name, { extra: 'x' }), false, `${name} must reject any property`);
  });
});

test('G2. camera_failed requires reason_code and its enum is closed to permission_denied/unavailable', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('camera_failed', { reason_code: 'permission_denied' }), true);
  assert.strictEqual(Analytics.track('camera_failed', { reason_code: 'unavailable' }), true);
  assert.strictEqual(Analytics.track('camera_failed', {}), false, 'missing reason_code must be rejected');
  assert.strictEqual(Analytics.track('camera_failed', { reason_code: 'denied' }), false, 'a non-enum value (e.g. the UI-only cameraErrorKind spelling) must be rejected');
  assert.strictEqual(Analytics.track('camera_failed', { reason_code: 'timeout' }), false, 'scan_failed\'s reason_code enum must not leak into camera_failed\'s');
});

test('G3. lash_preview_opened requires origin and its enum is closed to hero/lash_map', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('lash_preview_opened', { origin: 'hero' }), true);
  assert.strictEqual(Analytics.track('lash_preview_opened', { origin: 'lash_map' }), true);
  assert.strictEqual(Analytics.track('lash_preview_opened', {}), false, 'missing origin must be rejected');
  assert.strictEqual(Analytics.track('lash_preview_opened', { origin: 'results_carousel' }), false, 'lash_map_opened\'s origin enum must not leak into lash_preview_opened\'s');
});

test('G4. scan_failed now accepts reason_code:"timeout" alongside the 3 original reasons, still rejecting anything else', () => {
  Analytics._resetForTests();
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_failed', { mode: 'photo', reason_code: 'timeout' }), true);
  assert.strictEqual(Analytics.track('scan_failed', { mode: 'live', reason_code: 'timeout' }), true, 'timeout is a mode-agnostic reason_code, same as the other 3');
  assert.strictEqual(Analytics.track('scan_failed', { mode: 'photo', reason_code: 'bogus' }), false);
});

test('G4b. scan_failed{quality_rejected} continues to be sent exactly as before — unaffected by the new scan_quality_rejected event', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_failed', { mode: 'photo', reason_code: 'quality_rejected' }), true);
  assert.deepStrictEqual(provider._log[provider._log.length - 1], { type: 'event', eventName: 'scan_failed', props: { mode: 'photo', reason_code: 'quality_rejected' } });
});

test('G4c. scan_quality_rejected requires mode+reason and its reason enum is closed to exactly the 10 real assessFrameQuality reasons', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  Analytics.setConsent(true);
  const validReasons = ['head_tilted', 'head_turned', 'head_pitch', 'eyes_closed', 'too_far',
    'too_close', 'too_dark', 'too_bright', 'blurry', 'low_face_confidence'];
  for (const reason of validReasons) {
    assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason }), true, `${reason} must be accepted`);
  }
  assert.strictEqual(Analytics.track('scan_quality_rejected', { reason: 'too_dark' }), false, 'mode is required');
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo' }), false, 'reason is required');
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'quality_rejected' }), false, 'the coarse scan_failed reason_code value must not leak into this enum');
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'brightness_42' }), false, 'a raw/invented value must be rejected, never forwarded');
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'too_dark', brightness: 42 }), false, 'a raw numeric diagnostic must never be accepted alongside reason');
});

test('G4d. scan_quality_rejected is gated by consent exactly like every other event', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'too_dark' }), false, 'must no-op before any consent decision');
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'too_dark' }), true);
  Analytics.setConsent(false);
  assert.strictEqual(Analytics.track('scan_quality_rejected', { mode: 'photo', reason: 'too_dark' }), false, 'must stop immediately on withdrawal');
});

// Independent mirror of index.html's HINT_PRIORITY_ORDER (the SAME list
// scan_quality_rejected's call site reuses via HINT_PRIORITY_ORDER.find)
// -- proves the priority-pick behavior analytically, the same technique
// already used elsewhere in this file (CURL_PROFILE_MIRROR-style),
// independent of any one PhotoAnalysisScreen fixture.
const HINT_PRIORITY_ORDER_MIRROR = ['head_tilted', 'head_turned', 'head_pitch', 'eyes_closed', 'too_close',
  'low_face_confidence', 'too_dark', 'too_bright', 'blurry', 'too_far'];
test('G4e. when multiple quality reasons co-occur, the reason sent to scan_quality_rejected follows HINT_PRIORITY_ORDER, never array order / quality.reasons[0]', () => {
  const pick = (reasons) => HINT_PRIORITY_ORDER_MIRROR.find((r) => reasons.includes(r));
  // assessFrameQuality's own internal check order (index.html:2312-2322)
  // would produce quality.reasons in THIS order for a frame failing all
  // three — low_face_confidence would be reasons[0], but head_tilted
  // must win per HINT_PRIORITY_ORDER.
  assert.strictEqual(pick(['low_face_confidence', 'head_tilted', 'too_dark']), 'head_tilted');
  // eyes_closed must outrank too_close/too_dark/blurry.
  assert.strictEqual(pick(['too_dark', 'blurry', 'eyes_closed', 'too_close']), 'eyes_closed');
  // too_close must outrank low_face_confidence/too_dark/too_bright/blurry/too_far.
  assert.strictEqual(pick(['too_far', 'too_dark', 'too_close']), 'too_close');
  // Single-reason case: that reason itself, unambiguous.
  assert.strictEqual(pick(['blurry']), 'blurry');
});

test('G5. all 6 new events are gated by consent exactly like every existing event — no-op before setConsent(true), forwarded after', () => {
  Analytics._resetForTests();
  const provider = fakeProvider();
  Analytics._setProviderForTests(provider);
  assert.strictEqual(Analytics.track('home_viewed'), false, 'must no-op before any consent decision');
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('home_viewed'), true);
  Analytics.setConsent(false);
  assert.strictEqual(Analytics.track('home_viewed'), false, 'must stop immediately on withdrawal, same as every other event');
});

test('G6 (source-guard). onboarding_started fires from a useEffect with an empty dependency array (fires once per OnboardingDialog mount, i.e. once per genuine "shown to the user", never merely from a re-render)', () => {
  const dialogSpan = extractBodyAfterHeader(src, 'function OnboardingDialog({ onClose, onStart, modelsLoaded, loadError, onRetry }) {');
  assert.ok(dialogSpan !== null, 'expected to locate OnboardingDialog');
  assert.ok(/Analytics\.track\('onboarding_started'\);\s*\n\s*\}, \[\]\);/.test(dialogSpan), 'onboarding_started\'s effect must close with an empty-deps array');
});

test('G7 (source-guard). onboarding_completed fires only from the step-5 "complete and proceed" branch of the primary button, never from the plain onClose() dismiss path (X button / Escape / backdrop cancel)', () => {
  const dialogSpan = extractBodyAfterHeader(src, 'function OnboardingDialog({ onClose, onStart, modelsLoaded, loadError, onRetry }) {');
  assert.ok(dialogSpan !== null, 'expected to locate OnboardingDialog');
  assert.strictEqual((dialogSpan.match(/Analytics\.track\('onboarding_completed'\)/g) || []).length, 1, 'expected exactly one onboarding_completed call site');
  assert.ok(dialogSpan.includes("Analytics.track('onboarding_completed'); onClose(); onStart(); }"), 'onboarding_completed must fire immediately before the existing onClose()+onStart() completion path, not inside the plain dismiss handler');
  const dismissOnClick = dialogSpan.match(/onClick=\{onClose\}/g) || [];
  assert.ok(dismissOnClick.length >= 1, 'expected the X-button dismiss handler to remain a plain onClose with no analytics call attached');
});

test('G8 (source-guard). home_viewed fires from a useEffect with an empty dependency array inside HomeScreen itself (fires once per HomeScreen mount = once per genuine navigation to Home, including navigating away and back, never from an ordinary re-render while already on Home)', () => {
  const homeSpan = extractBodyAfterHeader(src, 'function HomeScreen({ onLive, onPhoto, modelsLoaded, loadError, onRetry, onClients, onLibrary }) {');
  assert.ok(homeSpan !== null, 'expected to locate HomeScreen');
  assert.ok(/Analytics\.track\('home_viewed'\);\s*\n\s*\}, \[\]\);/.test(homeSpan), 'home_viewed\'s effect must close with an empty-deps array');
  assert.strictEqual((homeSpan.match(/Analytics\.track\('home_viewed'\)/g) || []).length, 1, 'expected exactly one home_viewed call site');
});

test('G9 (source-guard). lash_preview_opened fires only on the closed-to-open toggle transition (never on close, never merely because the panel/component exists in the DOM), and its origin comes from the PhotoLashPreviewPanel origin prop, never a literal hardcoded inside the shared component', () => {
  const panelSpan = extractBodyAfterHeader(src, 'function PhotoLashPreviewPanel({result,clientDesign,lang,origin}) {');
  assert.ok(panelSpan !== null, 'expected to locate PhotoLashPreviewPanel');
  assert.strictEqual((panelSpan.match(/Analytics\.track\('lash_preview_opened'/g) || []).length, 1, 'expected exactly one lash_preview_opened call site, inside the shared panel');
  assert.ok(panelSpan.includes("Analytics.track('lash_preview_opened',{origin})"), 'the panel\'s own call must forward its origin PROP, not a hardcoded literal — the literal enum values must live only at the two call sites');
  assert.ok(/const next=!value;if\(next&&typeof Analytics!=='undefined'\)Analytics\.track/.test(panelSpan), 'the event must be conditioned on the open transition (next===true), not fired unconditionally on every toggle');

  const heroCallSite = src.match(/<PhotoLashPreviewPanel result=\{result\} clientDesign=\{best\.clientDesign\} lang=\{lang\} origin="([^"]+)"\/>/);
  const lashMapCallSite = src.match(/<PhotoLashPreviewPanel result=\{result\} clientDesign=\{photoClientDesign\} lang=\{lang\} origin="([^"]+)"\/>/);
  assert.ok(heroCallSite && lashMapCallSite, 'expected exactly the 2 known PhotoLashPreviewPanel usages (HeroScreen, LashMapScreen), each passing a literal origin');
  assert.strictEqual(heroCallSite[1], 'hero');
  assert.strictEqual(lashMapCallSite[1], 'lash_map');
});

test('G10 (source-guard). photo_loaded fires exactly once, after the image decode succeeds and before face detection begins, inside analyze()', () => {
  const photoScan = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(photoScan !== null, 'expected to locate PhotoAnalysisScreen');
  const loadedIdx = photoScan.indexOf("Analytics.track('photo_loaded')");
  const fetchImageIdx = photoScan.indexOf('await faceapi.fetchImage(url)');
  const detectIdx = photoScan.indexOf('faceapi.detectSingleFace(canvas');
  assert.ok(loadedIdx !== -1 && fetchImageIdx !== -1 && detectIdx !== -1, 'expected to locate the decode call, the photo_loaded call, and the first detection call');
  assert.ok(fetchImageIdx < loadedIdx && loadedIdx < detectIdx, 'photo_loaded must fire strictly after image decode and strictly before face detection');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
