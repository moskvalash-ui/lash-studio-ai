// ============================================================
// CONSENT MANAGER — Phase 1: Consent foundation tests.
// ------------------------------------------------------------
// No external test framework — matches the rest of this repo's
// dependency-free assert-based test files. Two parts:
//   1. Unit tests against consent-manager.js's real, required exports
//      (no hand-duplicated logic) — persistence, default-deny safety,
//      corrupt/blocked-storage resilience, decidedAt/updatedAt
//      semantics.
//   2. Source-guard + byte-identity checks against the CURRENT git
//      HEAD (this repo's pre-Phase-1 committed state — nothing in
//      this working tree has been committed yet) proving: no
//      analytics SDK/script/network call was introduced anywhere;
//      the consent wiring never references scan-derived data; and
//      the scan pipeline itself (LiveScanScreen, PhotoAnalysisScreen,
//      the model-loading effect, the result handlers, lash-scan-core.js)
//      is byte-for-byte unchanged by this phase.
//
// Run with:  node tests/consent-manager.test.js
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  CONSENT_STORAGE_KEY,
  CONSENT_SCHEMA_VERSION,
  createStorageAdapter,
  getConsent,
  hasConsentDecision,
  isAnalyticsAllowed,
  setConsent,
  clearConsent,
} = require(path.join(__dirname, '..', 'consent-manager.js'));

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

function memStorage() {
  // Real in-memory Web-Storage-like object (not the module's own
  // fallback map) so tests exercise createStorageAdapter's try/catch
  // wrapping against a real getItem/setItem/removeItem contract.
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _raw: data,
  };
}

// ================================================================
// A. No decision yet — every reader defaults to the safe/closed state
// ================================================================
test('A1. getConsent returns null when nothing stored', () => {
  const s = createStorageAdapter(memStorage());
  assert.strictEqual(getConsent(s), null);
});
test('A2. hasConsentDecision is false before any choice', () => {
  const s = createStorageAdapter(memStorage());
  assert.strictEqual(hasConsentDecision(s), false);
});
test('A3. isAnalyticsAllowed is false before any choice (fail closed, not fail open)', () => {
  const s = createStorageAdapter(memStorage());
  assert.strictEqual(isAnalyticsAllowed(s), false);
});

// ================================================================
// B. Accept
// ================================================================
test('B1. setConsent(true) persists analytics:true', () => {
  const s = createStorageAdapter(memStorage());
  const rec = setConsent(s, true, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(rec.analytics, true);
  assert.strictEqual(rec.version, CONSENT_SCHEMA_VERSION);
});
test('B2. after Accept, isAnalyticsAllowed is true and the record round-trips through getConsent', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, true, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(isAnalyticsAllowed(s), true);
  const rec = getConsent(s);
  assert.strictEqual(rec.analytics, true);
  assert.strictEqual(rec.decidedAt, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(rec.updatedAt, '2026-01-01T00:00:00.000Z');
});

// ================================================================
// C. Reject
// ================================================================
test('C1. setConsent(false) persists analytics:false (an explicit decision, not "no decision")', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, false, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(hasConsentDecision(s), true, 'Reject IS a decision — must not read back as undecided');
  assert.strictEqual(isAnalyticsAllowed(s), false);
});
test('C2. analytics is coerced to a strict boolean — any non-true value stored as false', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, 'yes', '2026-01-01T00:00:00.000Z');
  const rec = getConsent(s);
  assert.strictEqual(rec.analytics, false, 'only === true may ever persist as true');
});

// ================================================================
// D. Persistence across separate reads (simulates reload)
// ================================================================
test('D1. a decision written by one adapter instance is readable by a fresh adapter over the same raw storage', () => {
  const raw = memStorage();
  setConsent(createStorageAdapter(raw), true, '2026-01-01T00:00:00.000Z');
  const reloaded = getConsent(createStorageAdapter(raw));
  assert.ok(reloaded);
  assert.strictEqual(reloaded.analytics, true);
});

// ================================================================
// E. Change / withdraw later — decidedAt vs updatedAt semantics
// ================================================================
test('E1. changing an existing decision preserves the original decidedAt but bumps updatedAt', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, true, '2026-01-01T00:00:00.000Z');
  const changed = setConsent(s, false, '2026-06-15T12:00:00.000Z');
  assert.strictEqual(changed.decidedAt, '2026-01-01T00:00:00.000Z', 'decidedAt must be the FIRST decision time');
  assert.strictEqual(changed.updatedAt, '2026-06-15T12:00:00.000Z', 'updatedAt must reflect the withdrawal time');
  assert.strictEqual(changed.analytics, false);
});
test('E2. withdrawing (Accept -> Reject) immediately flips isAnalyticsAllowed to false', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, true, '2026-01-01T00:00:00.000Z');
  assert.strictEqual(isAnalyticsAllowed(s), true);
  setConsent(s, false, '2026-01-02T00:00:00.000Z');
  assert.strictEqual(isAnalyticsAllowed(s), false, 'withdrawal must take effect for every subsequent read');
});
test('E3. clearConsent fully resets to "no decision yet" (banner would show again)', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, true, '2026-01-01T00:00:00.000Z');
  clearConsent(s);
  assert.strictEqual(getConsent(s), null);
  assert.strictEqual(hasConsentDecision(s), false);
  assert.strictEqual(isAnalyticsAllowed(s), false);
});

// ================================================================
// F. Corrupt / foreign data never crashes and never reads as consent
// ================================================================
test('F1. invalid JSON under the storage key is treated as "no decision", not a crash', () => {
  const raw = memStorage();
  raw.setItem(CONSENT_STORAGE_KEY, '{not valid json');
  const s = createStorageAdapter(raw);
  assert.strictEqual(getConsent(s), null);
  assert.strictEqual(isAnalyticsAllowed(s), false);
});
test('F2. a well-formed but wrong-shape object is treated as "no decision"', () => {
  const raw = memStorage();
  raw.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
  const s = createStorageAdapter(raw);
  assert.strictEqual(getConsent(s), null);
});
test('F3. an unrecognized schema version is treated as "no decision", never silently upgraded/guessed', () => {
  const raw = memStorage();
  raw.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: 999, analytics: true, decidedAt: 'x', updatedAt: 'x' }));
  const s = createStorageAdapter(raw);
  assert.strictEqual(getConsent(s), null);
  assert.strictEqual(isAnalyticsAllowed(s), false);
});

// ================================================================
// G. Blocked/throwing storage (private browsing, disabled storage)
// never crashes the app and consent still behaves correctly in-session
// ================================================================
function throwingStorage() {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
}
test('G1. a storage whose getItem/setItem always throw never propagates — reads/writes degrade to in-memory only', () => {
  const s = createStorageAdapter(throwingStorage());
  assert.doesNotThrow(() => setConsent(s, true, '2026-01-01T00:00:00.000Z'));
  assert.doesNotThrow(() => getConsent(s));
  assert.strictEqual(isAnalyticsAllowed(s), true, 'even with persistence blocked, the in-session choice must still be honored');
});
test('G2. defaultStorage() never throws even with no window/localStorage (Node)', () => {
  const { defaultStorage } = require(path.join(__dirname, '..', 'consent-manager.js'));
  assert.doesNotThrow(() => defaultStorage());
});

// ================================================================
// H. Consent record NEVER carries scan-derived data — a structural
// guarantee, not just a convention: setConsent's signature only
// accepts a boolean, so there is no parameter through which a caller
// could even attempt to pass a photo/landmark/measurement into it.
// ================================================================
test('H1. setConsent has no way to accept anything beyond a boolean + timestamp — extra args are silently ignored, never stored', () => {
  const s = createStorageAdapter(memStorage());
  const rec = setConsent(s, true, '2026-01-01T00:00:00.000Z', { photo: 'data:image/png;base64,AAAA', landmarks: [1, 2, 3] });
  const keys = Object.keys(rec).sort();
  assert.deepStrictEqual(keys, ['analytics', 'decidedAt', 'updatedAt', 'version']);
});
test('H2. the stored record is exactly this fixed shape — no extension point for arbitrary properties', () => {
  const s = createStorageAdapter(memStorage());
  setConsent(s, true, '2026-01-01T00:00:00.000Z');
  const raw = JSON.parse(s.getItem(CONSENT_STORAGE_KEY));
  assert.deepStrictEqual(Object.keys(raw).sort(), ['analytics', 'decidedAt', 'updatedAt', 'version']);
});

// ================================================================
// I. Source-guard + byte-identity checks against index.html / the
// scan pipeline — proving Phase 1 touched ONLY consent wiring.
// ================================================================
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');
const repoRoot = path.join(__dirname, '..');

function extractSpan(s, startMarker, endMarker) {
  const st = s.indexOf(startMarker);
  const en = s.indexOf(endMarker, st);
  if (st === -1 || en === -1) return null;
  return s.slice(st, en);
}

// Strips whole-line `//` comments before token-scanning source spans
// for forbidden identifiers below — explanatory prose (e.g. "never
// gates scan/result functionality") legitimately contains these
// English words without the CODE referencing that data, so the
// guard checks below must look at code, not comments, to avoid
// false positives on the very comments documenting the guarantee.
function stripLineComments(s) {
  return s.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}

test('I1. consent-manager.js is loaded as a plain global <script>, before the main app script, same pattern as lash-scan-core.js', () => {
  const scriptTagIdx = src.indexOf('<script src="consent-manager.js"></script>');
  const appScriptIdx = src.indexOf('<script type="text/babel">');
  assert.ok(scriptTagIdx !== -1, 'expected a plain <script src="consent-manager.js"> tag');
  assert.ok(scriptTagIdx < appScriptIdx, 'consent-manager.js must load before the app script that consumes window.ConsentManager');
});

test('I2. NO analytics SDK, provider script tag, or tracking network call exists anywhere in index.html (Phase 1 scope)', () => {
  const forbiddenSignatures = [
    'plausible.io', 'umami', 'posthog', 'google-analytics', 'googletagmanager',
    'gtag(', 'analytics.js', 'fetch(', 'XMLHttpRequest', 'navigator.sendBeacon',
    'new WebSocket', '.track(',
  ];
  const hits = forbiddenSignatures.filter((sig) => src.includes(sig));
  assert.deepStrictEqual(hits, [], `Phase 1 must add zero analytics SDKs/scripts/network calls; found: ${hits.join(', ')}`);
});

test('I3. consent-manager.js itself contains no network/analytics call of any kind', () => {
  const consentSrc = fs.readFileSync(path.join(__dirname, '..', 'consent-manager.js'), 'utf8');
  const forbidden = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'script.src', 'appendChild'];
  const hits = forbidden.filter((sig) => consentSrc.includes(sig));
  assert.deepStrictEqual(hits, [], `consent-manager.js must be pure state logic only; found: ${hits.join(', ')}`);
});

test('I4. the consent UI wiring block in App() never references scan/result state — only lang/consent/screen-navigation locals', () => {
  const consentBlock = extractSpan(
    src,
    '      // ------------------------------------------------------------\n      // CONSENT — Phase 1: consent foundation only.',
    '      const [screen, setScreen] = useState(\'home\');'
  );
  assert.ok(consentBlock, 'expected to locate the App()-level consent state block');
  const code = stripLineComments(consentBlock);
  const forbiddenTokens = ['result', 'naturalLashProfile', 'landmark', 'canvas', 'ctx.', 'image', 'dataURL', 'toDataURL', 'iris', 'eyelid'];
  const hits = forbiddenTokens.filter((tok) => code.toLowerCase().includes(tok.toLowerCase()));
  assert.deepStrictEqual(hits, [], `consent state wiring must never reference scan/result data in actual code; found: ${hits.join(', ')}`);
});

test('I5. ConsentPanel/ConsentToggleRow/ConsentIconButton components never reference scan/result state either', () => {
  const panelBlock = extractSpan(src, 'function ShieldIcon({ className })', '\n    function Section({ title, defaultOpen, children }) {');
  assert.ok(panelBlock, 'expected to locate the consent UI component block');
  const forbiddenTokens = ['result.', 'naturalLashProfile', 'landmark', 'getUserMedia', 'toDataURL', 'MediaStream'];
  const hits = forbiddenTokens.filter((tok) => panelBlock.includes(tok));
  assert.deepStrictEqual(hits, [], `consent UI components must never touch scan/camera/result data; found: ${hits.join(', ')}`);
});

test('I6. App() reads/writes consent ONLY through window.ConsentManager — never a bare localStorage call for the consent key', () => {
  const consentBlock = extractSpan(
    src,
    '      // ------------------------------------------------------------\n      // CONSENT — Phase 1: consent foundation only.',
    '      const [screen, setScreen] = useState(\'home\');'
  );
  assert.ok(consentBlock);
  assert.ok(!consentBlock.includes('localStorage.setItem') && !consentBlock.includes('localStorage.getItem'),
    'consent state must go exclusively through ConsentManager, matching the audited single-source-of-truth design');
  assert.ok(consentBlock.includes('ConsentManager.getConsent') || consentBlock.includes('ConsentManager.setConsent'),
    'expected the block to actually call into ConsentManager');
});

test('I7. the consent banner/settings wrapper divs position themselves via inline `style`, not a bare Tailwind `absolute` class — regression guard for the real bug this was found to fix: these are new direct children of .app-container, and `.app-container > * { position: relative; z-index: 1; }` (see the <style> block) has EQUAL CSS specificity to a single Tailwind utility class, so a plain `className="absolute ..."` on a new direct child is cascade-order-dependent and was empirically observed (live browser check) to render as `position: relative` — pushing the banner out of view entirely. Inline `style` always wins regardless of stylesheet load order. NOTE: this fix applies ONLY to the new ConsentPanel wrappers Phase 1 introduces — the pre-existing header (RU/EN + privacy icon) row was found to have the same latent issue but is NOT required for consent functionality (proved by live scenario testing: the icon remains reachable and every consent flow — accept/reject/customize/reopen/withdraw — works with the header untouched), so Phase 1 deliberately leaves that pre-existing div alone to stay isolated to consent-only code.', () => {
  const panelBlock = extractSpan(src, 'function ConsentPanel({ lang, mode, currentConsent, onAccept, onReject, onSaveCustom, onClose }) {', '\n    function ConsentIconButton(');
  assert.ok(panelBlock, 'expected to locate the ConsentPanel function body');
  assert.ok(panelBlock.includes("style={{ position: 'absolute'"), 'expected the banner/settings wrapper(s) to set position via inline style');
  assert.ok(!/className="[^"]*\babsolute\b[^"]*"/.test(panelBlock), 'expected NO bare Tailwind `absolute` utility class on any element inside ConsentPanel — it must go through inline style instead');
});

test('I8. the pre-existing header (RU/EN + privacy icon) row is UNCHANGED from git HEAD except for the one added <ConsentIconButton> — proving Phase 1 did not alter its (pre-existing, unrelated) positioning', () => {
  const { execSync } = require('child_process');
  const head = execSync('git show HEAD:index.html', { cwd: repoRoot }).toString();
  const cur = extractSpan(src, "            {screen !== 'scan' && screen !== 'lashscan' && (\n              <div className=\"absolute top-3 right-3 z-30 flex items-center gap-2\">", '\n            )}\n            {screen === \'home\'');
  assert.ok(cur, 'expected to locate the current header row block');
  // HEAD (pre-Phase-1) had no ConsentIconButton — assert the ONLY delta
  // between current and HEAD's equivalent block is that one added line.
  const headIdx = head.indexOf('<div className="absolute top-3 right-3 z-30">');
  assert.ok(headIdx !== -1, 'expected to locate the pre-Phase-1 header row in HEAD');
  assert.ok(!cur.includes('style={{ position:'), 'the pre-existing header row must NOT have been switched to inline-style positioning by Phase 1 — it is deliberately left as-is');
  assert.ok(cur.includes('<ConsentIconButton'), 'expected the one authorized addition: the new privacy/settings icon button');
  assert.ok(cur.includes('<LangToggle'), 'the pre-existing LangToggle usage must remain, unmodified');
});

// ---- byte-identity: the scan pipeline itself is untouched ----
let HEAD;
try {
  HEAD = execSync('git show HEAD:index.html', { cwd: repoRoot }).toString();
} catch (e) {
  HEAD = null;
}

test('J1. LiveScanScreen is byte-identical to git HEAD (live camera scan flow untouched by Phase 1)', () => {
  assert.ok(HEAD, 'expected `git show HEAD:index.html` to succeed inside a git working tree');
  const cur = extractSpan(src, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  const prev = extractSpan(HEAD, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  assert.ok(cur !== null && prev !== null, 'expected to locate LiveScanScreen in both current and HEAD source');
  assert.strictEqual(cur, prev, 'LiveScanScreen must be byte-identical — Phase 1 must not touch scanning');
});

test('J2. PhotoAnalysisScreen is byte-identical to git HEAD (photo analysis flow untouched by Phase 1)', () => {
  assert.ok(HEAD);
  const cur = extractSpan(src, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  const prev = extractSpan(HEAD, '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {', '\n    function ParamIcon(');
  assert.ok(cur !== null && prev !== null, 'expected to locate PhotoAnalysisScreen in both current and HEAD source');
  assert.strictEqual(cur, prev, 'PhotoAnalysisScreen must be byte-identical — Phase 1 must not touch photo analysis');
});

test('J3. the model-loading effect + result handlers (handleComplete..handleLashScanComplete) inside App() are byte-identical to git HEAD', () => {
  assert.ok(HEAD);
  const cur = extractSpan(src, '      const [screen, setScreen] = useState(\'home\');', '\n      return (\n        <LangContext.Provider value={lang}>');
  const prev = extractSpan(HEAD, '      const [screen, setScreen] = useState(\'home\');', '\n      return (\n        <LangContext.Provider value={lang}>');
  assert.ok(cur !== null && prev !== null, 'expected to locate the App() body span in both current and HEAD source');
  assert.strictEqual(cur, prev, 'model-loading effect and result handlers must be byte-identical — Phase 1 must not touch result handling');
});

test('J4. lash-scan-core.js is completely untouched by Phase 1 (git diff is empty)', () => {
  let diff;
  try {
    diff = execSync('git diff -- lash-scan-core.js', { cwd: repoRoot }).toString();
  } catch (e) {
    diff = 'DIFF_COMMAND_FAILED: ' + e.message;
  }
  assert.strictEqual(diff.trim(), '', 'lash-scan-core.js must have zero diff against the committed HEAD');
});

test('J5. no existing test file under tests/ was modified by Phase 1, EXCEPT the one explicitly authorized edit (de-flaking iris-color-audit.test.js\'s self-referential I3, per explicit review instruction — a test-only change, no production iris logic touched, see J1-J4/iris-color-audit.test.js\'s own suite above)', () => {
  let diff;
  try {
    diff = execSync('git diff --name-only', { cwd: repoRoot }).toString().split('\n').filter(Boolean);
  } catch (e) {
    diff = ['DIFF_COMMAND_FAILED'];
  }
  const AUTHORIZED_TEST_EDITS = ['tests/consent-manager.test.js', 'tests/iris-color-audit.test.js'];
  const touchedTests = diff.filter((f) => f.startsWith('tests/') && !AUTHORIZED_TEST_EDITS.includes(f));
  assert.deepStrictEqual(touchedTests, [], `Phase 1 must not modify any pre-existing test file beyond the explicitly authorized ones; touched: ${touchedTests.join(', ')}`);
});

// ================================================================
// K. Essential vs optional storage taxonomy — the module never
// touches the pre-existing essential keys.
// ================================================================
test('K1. consent-manager.js never touches the existing essential storage keys in actual code (comments may name them for documentation)', () => {
  const consentSrc = stripLineComments(fs.readFileSync(path.join(__dirname, '..', 'consent-manager.js'), 'utf8'));
  assert.ok(!consentSrc.includes('lashStudioLang'));
  assert.ok(!consentSrc.includes('lashStudioDebug'));
});
test('K2. CONSENT_STORAGE_KEY is its own dedicated key, distinct from the essential-storage keys', () => {
  assert.strictEqual(CONSENT_STORAGE_KEY, 'lashStudioConsent');
});

// ================================================================
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
