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

// I2 originally forbade `analytics.js`/`.track(` outright, back when
// Phase 1 had no analytics wrapper at all. Phase 2 (Stage 2.1-2.3,
// explicitly reviewed and approved) legitimately introduces both — a
// consent-gated event wrapper whose provider adapter is still an
// inert no-op stub (see analytics.js's own header/tests). The durable
// guarantee this test actually protects — no REAL third-party
// provider signature, no REAL network primitive anywhere in
// index.html — still holds and is re-asserted below with the two now-
// legitimate tokens removed from the forbidden list. tests/analytics.test.js
// carries the more detailed Phase-2-scoped version of this guarantee.
test('I2. NO real analytics PROVIDER SDK, provider script tag, or actual network-sending primitive exists anywhere in index.html (analytics.js\'s own consent-gated wrapper + its .track() call sites are Phase 2, reviewed/approved, and still only drive an inert no-op stub — see tests/analytics.test.js)', () => {
  const forbiddenSignatures = [
    'plausible.io', 'umami', 'posthog', 'google-analytics', 'googletagmanager',
    'gtag(', 'fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'new WebSocket',
  ];
  const hits = forbiddenSignatures.filter((sig) => src.includes(sig));
  assert.deepStrictEqual(hits, [], `index.html must never contain a real analytics provider signature or a real network-sending primitive; found: ${hits.join(', ')}`);
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
    '      // Debug-only entry point: ?debug=library lands directly on the'
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
    '      // Debug-only entry point: ?debug=library lands directly on the'
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

// I8 used to assert that the header row textually equalled `git show
// HEAD:index.html`'s pre-Phase-1 form plus exactly one added line — a
// check for "Phase 1 didn't alter this div's positioning, only added
// the icon". Now that Phase 1 itself is the committed HEAD, that
// pre-Phase-1 form no longer exists in HEAD to compare against, so the
// lookup fails — the same class of staleness as the old
// iris-color-audit.test.js I3 (asserting about git history rather than
// a property of the code). Replaced with the durable, HEAD-independent
// structural invariant this was actually protecting: the header row
// keeps its ORIGINAL plain-className positioning (deliberately NOT
// switched to inline-style, unlike ConsentPanel — see I7) and contains
// both the privacy icon and the language toggle.
test('I8. the header (RU/EN + privacy icon) row keeps its original plain-className positioning (never switched to inline-style like ConsentPanel) and contains both ConsentIconButton and LangToggle', () => {
  const cur = extractSpan(src, "            {screen !== 'scan' && screen !== 'lashscan' && (\n              <div className=\"absolute top-3 right-3 z-30 flex items-center gap-2\">", '\n            )}\n            {screen === \'home\'');
  assert.ok(cur, 'expected to locate the current header row block');
  assert.ok(cur.includes('className="absolute top-3 right-3 z-30 flex items-center gap-2"'), 'the header row must keep its original plain Tailwind className positioning verbatim');
  assert.ok(!cur.includes('style={{ position:'), 'the header row must NOT use inline-style positioning — that pattern is reserved for the new ConsentPanel wrappers (see I7), not this pre-existing div');
  assert.ok(cur.includes('<ConsentIconButton'), 'expected the privacy/settings icon button to be present');
  assert.ok(cur.includes('<LangToggle'), 'expected the pre-existing LangToggle to remain present');
});

// ---- byte-identity: the scan pipeline itself is untouched ----
let HEAD;
try {
  HEAD = execSync('git show HEAD:index.html', { cwd: repoRoot }).toString();
} catch (e) {
  HEAD = null;
}

// J1 originally demanded LiveScanScreen be byte-identical to git HEAD
// outside the bounded contextual-iris-debug additions. The later
// reviewed Face Shape Analysis phase (approved, independent analyzer —
// see index.html's own "FACE SHAPE ANALYSIS" comment block) added two
// more bounded, intentional lines right after `const iris =
// combineIris(...)` and one new sibling field on `rec`. Both additions
// are explicitly carved out below, by the same normalize-back-to-HEAD
// technique already used for the iris debug block, so this guard keeps
// failing loudly on any OTHER, unrelated drift in LiveScanScreen.
test('J1. LiveScanScreen is byte-identical to git HEAD outside the debug-only contextual iris additions and the approved Face Shape Analysis addition', () => {
  assert.ok(HEAD, 'expected `git show HEAD:index.html` to succeed inside a git working tree');
  const cur = extractSpan(src, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  const prev = extractSpan(HEAD, '    function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {', '\n    function PhotoAnalysisScreen(');
  assert.ok(cur !== null && prev !== null, 'expected to locate LiveScanScreen in both current and HEAD source');
  const omitContextualIrisDebug = span => span
    .replace(
      "              const leftAudit=buildIrisColorAudit(ctx,leftEye),rightAudit=buildIrisColorAudit(ctx,rightEye);\n              debugIrisAuditRef.current = {\n                left:leftAudit,right:rightAudit,\n                contextual:debugBuildIrisContextFeatures(ctx,leftEye,rightEye,leftAudit,rightAudit,bestFrameRef.current.leftIris,bestFrameRef.current.rightIris),\n              };",
      "              debugIrisAuditRef.current = {\n                left: buildIrisColorAudit(ctx, leftEye),\n                right: buildIrisColorAudit(ctx, rightEye),\n              };"
    )
    .replace("\n              contextual: debugIrisAuditRef.current.contextual,", '');
  const omitFaceShapeAnalysis = span => span
    .replace(
      "          // FACE SHAPE ANALYSIS — independent analyzer, reads the best\n          // frame's own raw landmarks and a freshly computed headPose\n          // for that exact frame. Never derived from finalProfile/\n          // eyeProfile; never fed back into classifyFeatures, stability,\n          // or the eye-analysis pipeline in any way.\n          const faceShapeHeadPose = computeHeadPose(best.landmarks);\n          const faceShapeProfile = classifyFaceShape(best.landmarks, faceShapeHeadPose, { singleFrame: false, imageQuality });\n",
      ''
    )
    .replace("\n            faceShapeProfile,", '');
  // Approved first-launch camera-zoom fix (Phase 1, minimal): adds an
  // explicit ideal width/height to the SAME facingMode-keyed
  // getUserMedia constraints object already used here. Normalized back
  // to the pre-fix call for comparison, same technique as above, so
  // this guard still fails loudly on any OTHER, unrelated drift.
  const omitCameraZoomFix = span => span.replace(
    "            // FIRST-LAUNCH ZOOM FIX (Phase 1, minimal): request an explicit\n            // preferred capture resolution instead of leaving format\n            // negotiation entirely up to the browser/OS. Unconstrained\n            // getUserMedia here previously let a cold (first-ever\n            // permission grant) camera session settle on a different\n            // native format/zoom than an already-warm session — the video\n            // element's plain object-cover then displayed whatever raw\n            // frame arrived, uncorrected, producing a too-zoomed-in first\n            // launch that self-corrected after reload once the session\n            // was warm. facingMode is unchanged; width/height are `ideal`\n            // hints only, never hard requirements, so this never throws\n            // OverconstrainedError and never changes mirroring (still\n            // keyed on facingMode only) or any dynamic\n            // video.videoWidth/videoHeight read downstream. Deliberately\n            // NOT the full NaturalLashScanScreen CAMERA_ATTEMPTS chain or\n            // effectiveVisibleWidth compensation — those are reserved for\n            // a later phase if real-device validation shows this minimal\n            // constraint alone is insufficient.\n            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });",
    "            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });"
  );
  // Approved Live Scan lifecycle/stability fix (P0 real-device audit —
  // camera-init cancellation guard, late-getUserMedia-resolution
  // cleanup, track.onended -> distinct camera-stopped state, and the
  // tick pipeline's catch block surfacing a distinct scan-error state
  // instead of silently leaving the UI stuck). Six bounded, disjoint
  // insertions/edits, each normalized back to its pre-fix HEAD form —
  // same technique as the three normalizers above — so this guard
  // still fails loudly on any OTHER, unrelated drift in LiveScanScreen.
  // Applied FIRST (innermost) in the chain below: it restores the
  // single-line pre-fix `stream = await getUserMedia(...)` call shape
  // that omitCameraZoomFix's own literal match expects, so composing
  // it after omitCameraZoomFix would silently no-op on `cur` instead.
  const omitLiveScanLifecycleFix = span => span
    .replace(
      "        } catch (e) {\n          // LIFECYCLE FIX — a genuine processing/detector failure used\n          // to be silently swallowed here: no state change, no\n          // feedback, the UI stayed frozen wherever it last was\n          // (typically stageSearching) forever, while this tick loop\n          // kept retrying every 200ms and throwing again. Now the loop\n          // is stopped outright — so this can never repeat/spam per\n          // frame — and the failure is surfaced as its own distinct,\n          // recoverable-via-Back state.\n          console.error('[LSA] PIPELINE ERROR', e);\n          if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }\n          doneRef.current = true;\n          setStageKey('stageScanError'); setPhase('error'); setHintKey('hintRestartScan');\n        } finally {",
      "        } catch (e) {\n          console.error('[LSA] PIPELINE ERROR', e);\n        } finally {"
    )
    .replace(
      "      useEffect(() => {\n        let stream;\n        // LIFECYCLE FIX — cancellation guard for this effect run only\n        // (mirrors the `cancelled`-flag pattern already used elsewhere\n        // in this file, e.g. the App-level model-loading effect). Set\n        // to true FIRST in cleanup, before anything else, so a track's\n        // synchronous 'ended' event fired by our own cleanup's\n        // `.stop()` calls below sees cancelled=true and no-ops instead\n        // of treating our own teardown as an unexpected camera loss.\n        let cancelled = false;\n        doneRef.current = false;",
      "      useEffect(() => {\n        let stream;\n        doneRef.current = false;"
    )
    .replace(
      "        setStageKey('stageSearching'); setPhase('searching'); setProgress(0); setHintKey(null);\n\n        // LIFECYCLE FIX — unexpected camera-track termination (OS\n        // revokes access while backgrounded, another app takes the\n        // camera, hardware disconnect, etc). Distinct from both\n        // stageSearching and stageLost — those mean \"camera is fine,\n        // no face yet\"; this means the camera itself is gone and no\n        // amount of waiting will recover it. `cancelled` guards against\n        // this firing from our OWN cleanup stopping the tracks below.\n        const handleTrackEnded = () => {\n          if (cancelled) return;\n          cancelled = true;\n          if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }\n          doneRef.current = true;\n          setStageKey('stageCameraStopped'); setPhase('cameraStopped'); setHintKey('hintRestartScan');\n        };\n\n        const start = async () => {",
      "        setStageKey('stageSearching'); setPhase('searching'); setProgress(0); setHintKey(null);\n\n        const start = async () => {"
    )
    .replace(
      "            const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });\n            // LIFECYCLE FIX — Back/navigation (or a facingMode change)\n            // may have unmounted/re-run this effect while getUserMedia\n            // was still pending. A late-arriving stream must never be\n            // attached to the (now stale) video element or resurrect\n            // the scan loop — stop it immediately and walk away.\n            if (cancelled) { acquired.getTracks().forEach(t => t.stop()); return; }\n            stream = acquired;\n            stream.getVideoTracks().forEach(track => { track.onended = handleTrackEnded; });\n            if (videoRef.current) {\n              videoRef.current.srcObject = stream;\n              await videoRef.current.play();\n            }\n            if (cancelled) return;\n          } catch (e) {\n            if (!cancelled) { setStageKey('stageNoCamera'); setHintKey(null); }\n            return;\n          }\n          if (cancelled) return;\n          loopRef.current = setInterval(() => tickImplRef.current(), 200);",
      "            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });\n            if (videoRef.current) {\n              videoRef.current.srcObject = stream;\n              await videoRef.current.play();\n            }\n          } catch (e) {\n            setStageKey('stageNoCamera'); setHintKey(null);\n            return;\n          }\n          loopRef.current = setInterval(() => tickImplRef.current(), 200);"
    )
    .replace(
      "        return () => {\n          // LIFECYCLE FIX — order matters: cancelled must flip before\n          // we stop tracks below, since `.stop()` can synchronously\n          // fire the 'ended' listener registered above.\n          cancelled = true;\n          if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }\n          if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }\n          if (videoRef.current) videoRef.current.srcObject = null;\n        };\n      }, [facingMode]);",
      "        return () => {\n          if (loopRef.current) clearInterval(loopRef.current);\n          if (stream) stream.getTracks().forEach(t => t.stop());\n        };\n      }, [facingMode]);"
    )
    .replace(
      "      const statusColor = (phase === 'searching' || phase === 'lost' || phase === 'cameraStopped' || phase === 'error') ? 'bg-danger' : phase === 'adjust' ? 'bg-peak' : (phase === 'finalizing' ? 'bg-success' : 'bg-accent');",
      "      const statusColor = phase === 'searching' ? 'bg-danger' : phase === 'lost' ? 'bg-danger' : phase === 'adjust' ? 'bg-peak' : (phase === 'finalizing' ? 'bg-success' : 'bg-accent');"
    );
  // Approved SECURITY-2A fix: four pre-existing, previously-unconditional
  // console.log call sites (FACE DETECTED score/box, EYE METRICS head-
  // pose/EAR/brightness/sharpness, EYELID CONSENSUS derived classification,
  // RESULT GENERATED full diagnostics) are now gated behind the same
  // debugAvailable flag this screen already uses for its other debug-only
  // output. Each is a bounded, additive, comment+gate-only change,
  // normalized back to its pre-fix HEAD form — same technique as the four
  // normalizers above — so this guard still fails loudly on any OTHER,
  // unrelated drift in LiveScanScreen.
  const omitSecurity2AConsoleGates = span => span
    .replace(
      "          // SECURITY-2A: face detection score/box is derived, per-frame,\n" +
      "          // user-specific measurement data -- gated behind the existing\n" +
      "          // debugAvailable flag (same isDebugModeEnabled() this screen\n" +
      "          // already uses for its other debug-only output), not logged\n" +
      "          // unconditionally in normal production use.\n" +
      "          if (debugAvailable) console.log('[LSA] FACE DETECTED', { score: det.detection.score.toFixed(3), box: det.detection.box });",
      "          console.log('[LSA] FACE DETECTED', { score: det.detection.score.toFixed(3), box: det.detection.box });"
    )
    .replace(
      "          // SECURITY-2A: real per-frame derived head-pose/eye-aperture/\n" +
      "          // exposure measurements -- debug-gated, same reasoning as\n" +
      "          // FACE DETECTED above. hasNaN alone (used by the NaN-rejection\n" +
      "          // branch just below) never needed the measurement values\n" +
      "          // themselves to be logged.\n" +
      "          if (debugAvailable) {\n" +
      "            console.log('[LSA] EYE METRICS', {\n" +
      "              roll: headPose.roll.toFixed(1), yaw: headPose.yawProxy.toFixed(3), pitch: headPose.pitchProxy.toFixed(3),\n" +
      "              leftEAR: leftMetrics.ear.toFixed(3), rightEAR: rightMetrics.ear.toFixed(3),\n" +
      "              brightness: brightness.toFixed(1), sharpness: sharpness.toFixed(1), hasNaN: metricsNaN,\n" +
      "            });\n" +
      "          }",
      "          console.log('[LSA] EYE METRICS', {\n" +
      "            roll: headPose.roll.toFixed(1), yaw: headPose.yawProxy.toFixed(3), pitch: headPose.pitchProxy.toFixed(3),\n" +
      "            leftEAR: leftMetrics.ear.toFixed(3), rightEAR: rightMetrics.ear.toFixed(3),\n" +
      "            brightness: brightness.toFixed(1), sharpness: sharpness.toFixed(1), hasNaN: metricsNaN,\n" +
      "          });"
    )
    .replace(
      "          // SECURITY-2A: eyelidConsensus.type / classified.eyelidType are\n" +
      "          // real derived classification results for this specific user --\n" +
      "          // debug-gated, same reasoning as EYE METRICS above.\n" +
      "          if (debugAvailable) console.log('[LSA] EYELID CONSENSUS', eyelidConsensus.type, `(${eyelidConsensus.reliableCount}/${eyelidConsensus.totalCount} reliable, conflict=${eyelidConsensus.conflict})`, 'aggregate said', classified.eyelidType);",
      "          console.log('[LSA] EYELID CONSENSUS', eyelidConsensus.type, `(${eyelidConsensus.reliableCount}/${eyelidConsensus.totalCount} reliable, conflict=${eyelidConsensus.conflict})`, 'aggregate said', classified.eyelidType);"
    )
    .replace(
      "          // SECURITY-2A: rec.diagnostics carries the real scan's full\n" +
      "          // aggregated head-pose/eye-geometry metrics AND the computed\n" +
      "          // iris color result -- the richest console payload in this\n" +
      "          // screen. `rec.diagnostics` itself is left completely\n" +
      "          // unchanged (still attached to the result exactly as before;\n" +
      "          // that data-flow question is out of this fix's scope) -- only\n" +
      "          // this console.log is debug-gated.\n" +
      "          if (debugAvailable) console.log('[LSA] RESULT GENERATED', rec.diagnostics);",
      "          console.log('[LSA] RESULT GENERATED', rec.diagnostics);"
    )
    // This span's end marker is `PhotoAnalysisScreen`, so it also spans
    // NaturalLashScanScreen (which sits between LiveScanScreen and
    // PhotoAnalysisScreen) — that function's own SECURITY-2A change
    // (the '[NLS DIAG]' console.log) must be normalized here too, same
    // as camera-preview.test.js's dedicated NaturalLashScanScreen check.
    .replace(
      "          // SECURITY-2A: diagSnapshot carries real camera/ROI/eye-width\n" +
      "          // measurements for this scan -- both the log and the existing\n" +
      "          // debug-panel state update now share the same debugAvailable\n" +
      "          // gate (the state update was already gated; only the\n" +
      "          // console.log was not).\n" +
      "          if (debugAvailable) { console.log('[NLS DIAG]', diagSnapshot); setDiag(diagSnapshot); }",
      "          console.log('[NLS DIAG]', diagSnapshot);\n          if (debugAvailable) setDiag(diagSnapshot);"
    );
  // Approved Phase C3d addition: the real per-eye colorComposition
  // sampleIrisColor already computed is combined bilaterally right after
  // the existing, untouched combineIris(...) call -- combineIris's own
  // name/confidence/hex fields and every quality gate upstream are
  // unmodified. Normalized back to its pre-fix HEAD form so this guard
  // still fails loudly on any OTHER, unrelated drift in LiveScanScreen.
  const omitPhaseC3dComposition = span => span.replace(
    "          // Phase C3d: additive bilateral composition, computed from the\n" +
    "          // SAME per-eye colorComposition sampleIrisColor already\n" +
    "          // produced above -- combineIris's own name/confidence/hex are\n" +
    "          // untouched.\n" +
    "          iris.colorComposition = combineIrisColorComposition(best.leftIris.colorComposition, best.leftIris.confidence, best.rightIris.colorComposition, best.rightIris.confidence);\n" +
    "          iris.compositionLabel = deriveIrisColorCompositionLabel(iris.colorComposition, iris.name);\n",
    ""
  );
  // Approved RELEASE-1.1 fix: TEMPORARY debug-only camera-startup timing
  // instrumentation (T0-T9 performance.now() markers, gated behind the
  // same debugAvailable flag this screen already uses for its other
  // debug-only output) added to prove where a real device's reported
  // Live Scan startup delay actually comes from. Bounded, additive,
  // logs only elapsed milliseconds between named stages — no frame/
  // pixel/face data. Normalized back to its pre-fix HEAD form, same
  // technique as every other normalizer above, so this guard still
  // fails loudly on any OTHER, unrelated drift in LiveScanScreen.
  const omitCameraTimingInstrumentation = span => span
    .replace(
      "\n      // RELEASE-1.1 — TEMPORARY camera-startup timing diagnostics.\n      // Debug-only (never runs/logs unless ?debug=1); logs only elapsed\n      // milliseconds between named lifecycle stages (T0-T9), never any\n      // frame/pixel/face data. Exists to PROVE where a real device's\n      // \"stuck on Поиск лица\" delay actually comes from (camera/\n      // permission acquisition vs. model/inference warm-up vs. genuine\n      // face-search time) instead of guessing. Each stage is recorded\n      // once per scan (timingRef resets every effect run, same as the\n      // other scan-local refs above). Remove once real-device timing\n      // data has resolved the RELEASE-1.1 camera investigation.\n      const timingRef = useRef({});\n      const markTiming = (label) => {\n        if (!debugAvailable || timingRef.current[label] != null) return;\n        const t = performance.now();\n        timingRef.current[label] = t;\n        const t0 = timingRef.current.T0_live_scan_requested;\n        console.log('[LSA][TIMING]', label, t0 != null ? (t - t0).toFixed(0) + 'ms since T0' : 'T0 not yet marked');\n      };\n",
      ""
    )
    .replace(
      "        markTiming('T5_first_frame_eligible');\n",
      ""
    )
    .replace(
      "          markTiming('T6_first_inference_begins');\n",
      ""
    )
    .replace(
      "          markTiming('T7_first_inference_completes');\n",
      ""
    )
    .replace(
      "          markTiming('T8_first_valid_face_detected');\n",
      ""
    )
    .replace(
      "          markTiming('T9_analysis_stages_begin');\n",
      ""
    )
    .replace(
      "        timingRef.current = {};\n        markTiming('T0_live_scan_requested');\n",
      ""
    )
    .replace(
      "            markTiming('T1_getUserMedia_requested');\n",
      ""
    )
    .replace(
      "            markTiming('T2_stream_obtained');\n",
      ""
    )
    .replace(
      "              // Timing-only listener (debug-gated inside markTiming\n              // itself) — purely observational, never affects playback.\n              videoRef.current.addEventListener('loadedmetadata', () => markTiming('T3_video_metadata_ready'), { once: true });\n",
      ""
    )
    .replace(
      "              markTiming('T4_video_playing');\n",
      ""
    );
  // Approved WEBKIT-SAFE VIDEO PRESENTATION fix: real-iPhone diagnostic
  // evidence (?cameraLayoutDebug=1) proved the decoded video frame and
  // DOM geometry were both healthy while the user still saw a broken
  // narrow strip, isolating the bug to a CSS-transformed, hardware-
  // composited <video> layer on iOS/Yandex/WebKit. LiveScanScreen's
  // video mirror moved from a CSS `transform: scaleX(-1)` to a canvas
  // transform (drawVideoCover, called once per frame from the overlay
  // draw loop, sharing the SAME hoisted `mirrored` the graphics map()
  // already used) — the <video> element itself is now permanently
  // invisible (opacity:0) and unmirrored. Two disjoint edits, each
  // normalized back to its pre-fix HEAD form — same technique as every
  // other normalizer above — so this guard still fails loudly on any
  // OTHER, unrelated drift in LiveScanScreen.
  const omitWebkitSafeVideoPresentation = span => span
    .replace(
      "          // CAMERA FIX — preview-only mirror, now applied at the canvas\n" +
      "          // level (see drawVideoCover's own header comment for why —\n" +
      "          // real-iPhone diagnostic evidence isolated a visible narrow-\n" +
      "          // strip bug to <video> hardware-layer presentation even\n" +
      "          // though the decoded frame and DOM geometry were both proven\n" +
      "          // healthy). `mirrored` is hoisted here, above `fresh`, so it\n" +
      "          // drives BOTH this frame's video paint AND the overlay\n" +
      "          // coordinate map() below from the exact same read — the\n" +
      "          // video's live picture and the scanner graphics can never\n" +
      "          // disagree about mirror state. Nothing here touches\n" +
      "          // det/landmarks/lastDetRef/any measurement path: those still\n" +
      "          // read the raw, un-mirrored processing-canvas snapshot\n" +
      "          // upstream (tickImplRef), completely untouched by this.\n" +
      "          const mirrored = facingModeRef.current === 'user';\n" +
      "          const previewVideo = videoRef.current;\n" +
      "          if (previewVideo && previewVideo.videoWidth && previewVideo.videoHeight) {\n" +
      "            drawVideoCover(ctx, previewVideo, w, h, mirrored);\n" +
      "          }\n" +
      "\n" +
      "          const time = performance.now();\n" +
      "          const reduceMotion = reduceMotionRef.current;\n" +
      "          const d = lastDetRef.current;\n" +
      "          const fresh = d && d.hasFace && (time - d.ts) < FACE_LOST_GRACE_MS;\n" +
      "          const s = smoothRef.current;\n" +
      "          s.presence = lerpNum(s.presence, fresh ? 1 : 0, fresh ? 0.14 : 0.09);\n" +
      "\n" +
      "          if (fresh) {\n" +
      "            // Text (drawEyeTarget's L/R labels) stays upright since ctx\n" +
      "            // itself is never transformed here, only the coordinates\n" +
      "            // fed into it.\n" +
      "            const map = (x,y) => {",
      "          const time = performance.now();\n" +
      "          const reduceMotion = reduceMotionRef.current;\n" +
      "          const d = lastDetRef.current;\n" +
      "          const fresh = d && d.hasFace && (time - d.ts) < FACE_LOST_GRACE_MS;\n" +
      "          const s = smoothRef.current;\n" +
      "          s.presence = lerpNum(s.presence, fresh ? 1 : 0, fresh ? 0.14 : 0.09);\n" +
      "\n" +
      "          if (fresh) {\n" +
      "            // CAMERA FIX — preview-only mirror. The <video> element is\n" +
      "            // CSS-mirrored (scaleX(-1)) for the front camera only, so\n" +
      "            // the overlay's on-screen X position is flipped here to\n" +
      "            // match. This affects ONLY where shapes/text are drawn on\n" +
      "            // screen — det/landmarks/lastDetRef/every measurement path\n" +
      "            // still read the raw, un-mirrored canvas snapshot upstream,\n" +
      "            // completely untouched by this. Text (drawEyeTarget's L/R\n" +
      "            // labels) stays upright since ctx itself is never\n" +
      "            // transformed, only the coordinates fed into it.\n" +
      "            const mirrored = facingModeRef.current === 'user';\n" +
      "            const map = (x,y) => {"
    )
    .replace(
      "            {/* WEBKIT-SAFE PRESENTATION — this <video> is now the raw,\n" +
      "                invisible (opacity:0) decode source only. It is never\n" +
      "                CSS-transformed/mirrored any more: real-iPhone diagnostic\n" +
      "                evidence (?cameraLayoutDebug=1) proved the decoded frame\n" +
      "                and DOM geometry were both healthy while the user still\n" +
      "                saw a broken narrow strip, isolating the bug to a CSS-\n" +
      "                transformed, hardware-composited <video> layer on\n" +
      "                iOS/Yandex/WebKit. The overlay <canvas> below now paints\n" +
      "                the live, mirrored picture itself every frame\n" +
      "                (drawVideoCover, keyed on the same `mirrored` used for\n" +
      "                graphics coordinates) plus the scanner graphics on top —\n" +
      "                so the user-visible surface never depends on a\n" +
      "                transformed hardware video layer at all. Rear camera\n" +
      "                ('environment') stays unmirrored, like a normal\n" +
      "                viewfinder. Processing (tickImplRef) still reads this\n" +
      "                same <video> element directly via a plain, untransformed\n" +
      "                ctx.drawImage — completely unaffected by any of this. */}\n" +
      "            <video ref={videoRef} className=\"absolute inset-0 w-full h-full object-cover\" style={{ opacity: 0, pointerEvents: 'none' }} playsInline muted />\n" +
      "            <canvas ref={overlayCanvasRef} className=\"absolute inset-0 w-full h-full pointer-events-none\" />\n" +
      "            <div className=\"absolute inset-0 pointer-events-none\" style={{background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.5) 100%)'}}></div>",
      "            {/* CAMERA FIX — preview-only mirror for the front camera,\n" +
      "                matching standard selfie-camera UX (raw getUserMedia\n" +
      "                video is never mirrored by the browser on its own).\n" +
      "                Rear camera ('environment') stays unmirrored, like a\n" +
      "                normal viewfinder. The overlay canvas below is NOT\n" +
      "                CSS-mirrored — its own draw loop flips coordinates\n" +
      "                instead, so its text labels stay upright; see the\n" +
      "                overlay effect's `map`/`mirrored` comment. */}\n" +
      "            <video ref={videoRef} className=\"absolute inset-0 w-full h-full object-cover\" style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined} playsInline muted />\n" +
      "            <div className=\"absolute inset-0 pointer-events-none\" style={{background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.5) 100%)'}}></div>\n" +
      "            <canvas ref={overlayCanvasRef} className=\"absolute inset-0 w-full h-full pointer-events-none\" />"
    );
  // Approved "strong zoom + Поиск лица" real-device diagnostic
  // extension: recordDetectorSample's four call sites now also record
  // boxX/boxY/boxHeight/canvasHeight/boxClipped (still plain bounding-
  // box geometry, never landmarks/pixels), the panel now also reads
  // procCanvasRef for an independent processingCanvas snapshot, and the
  // function's own doc comment was updated to describe the widened
  // field set. All bounded, additive, gated behind the same
  // cameraLayoutDebugEnabled flag — normalized back to pre-fix HEAD
  // form, same technique as every other normalizer above, so this
  // guard still fails loudly on any OTHER, unrelated drift.
  const omitZoomDiagnosticExtension = span => span
    .replace(
      "      // TEMPORARY: URL-only (?cameraLayoutDebug=1) per-tick detector/\n" +
      "      // distance diagnostic. Records ONLY the scalar detection-outcome\n" +
      "      // fields named below — the face box's plain x/y/width/height (a\n" +
      "      // bounding rectangle in processing-canvas pixels, not landmarks\n" +
      "      // or an identity template) plus the processing canvas's own\n" +
      "      // width/height and the pre-existing boxClipped edge-touch flag —\n" +
      "      // never real landmark points, never pixels, never biometric\n" +
      "      // identity data — into a bounded rolling buffer (latest 50).\n" +
      "      // Exists purely to prove, on a real device, whether TinyFaceDetector\n" +
      "      // itself returns no result at close range, or returns a result the\n" +
      "      // quality gate then rejects, and whether a rejected/close face is\n" +
      "      // touching the processing frame's edges (clipped) — see the\n" +
      "      // \"strong zoom + stuck on Поиск лица\" investigation this was\n" +
      "      // extended for. Never read by classifyFeatures/onComplete/rec/any\n" +
      "      // production decision.",
      "      // TEMPORARY: URL-only (?cameraLayoutDebug=1) per-tick detector/\n" +
      "      // distance diagnostic. Records ONLY the scalar detection-outcome\n" +
      "      // fields named below — never landmarks, never coordinates beyond\n" +
      "      // the plain box/canvas widths already used for faceRatio, never\n" +
      "      // pixels, never biometric data — into a bounded rolling buffer\n" +
      "      // (latest 50). Exists purely to prove, on a real device, whether\n" +
      "      // TinyFaceDetector itself returns no result at close range, or\n" +
      "      // returns a result the quality gate then rejects. Never read by\n" +
      "      // classifyFeatures/onComplete/rec/any production decision."
    )
    .replace(
      "            recordDetectorSample({\n" +
      "              hasFace: false, detectorScore: null, faceRatio: null,\n" +
      "              boxX: null, boxY: null, boxWidth: null, boxHeight: null, boxClipped: null,\n" +
      "              canvasWidth: canvas.width, canvasHeight: canvas.height, rejectionReasons: ['no_detection'],\n" +
      "              stageKey: diagStageKey, hintKey: null,",
      "            recordDetectorSample({\n" +
      "              hasFace: false, detectorScore: null, faceRatio: null, boxWidth: null,\n" +
      "              canvasWidth: canvas.width, rejectionReasons: ['no_detection'],\n" +
      "              stageKey: diagStageKey, hintKey: null,"
    )
    .replace(
      "            recordDetectorSample({\n" +
      "              hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "              boxX: det.detection.box.x, boxY: det.detection.box.y, boxWidth: det.detection.box.width, boxHeight: det.detection.box.height, boxClipped,\n" +
      "              canvasWidth: canvas.width, canvasHeight: canvas.height,\n" +
      "              rejectionReasons: ['metrics_nan'], stageKey: diagStageKey, hintKey: 'hintBlurry',",
      "            recordDetectorSample({\n" +
      "              hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "              boxWidth: det.detection.box.width, canvasWidth: canvas.width,\n" +
      "              rejectionReasons: ['metrics_nan'], stageKey: diagStageKey, hintKey: 'hintBlurry',"
    )
    .replace(
      "            recordDetectorSample({\n" +
      "              hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "              boxX: det.detection.box.x, boxY: det.detection.box.y, boxWidth: det.detection.box.width, boxHeight: det.detection.box.height, boxClipped,\n" +
      "              canvasWidth: canvas.width, canvasHeight: canvas.height,\n" +
      "              rejectionReasons: quality.reasons, stageKey: diagStageKey, hintKey: diagHintKey,",
      "            recordDetectorSample({\n" +
      "              hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "              boxWidth: det.detection.box.width, canvasWidth: canvas.width,\n" +
      "              rejectionReasons: quality.reasons, stageKey: diagStageKey, hintKey: diagHintKey,"
    )
    .replace(
      "          recordDetectorSample({\n" +
      "            hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "            boxX: det.detection.box.x, boxY: det.detection.box.y, boxWidth: det.detection.box.width, boxHeight: det.detection.box.height, boxClipped,\n" +
      "            canvasWidth: canvas.width, canvasHeight: canvas.height,\n" +
      "            rejectionReasons: [], stageKey: stageKeyRef.current, hintKey: null,",
      "          recordDetectorSample({\n" +
      "            hasFace: true, detectorScore: det.detection.score, faceRatio: det.detection.box.width / Math.max(canvas.width, 1),\n" +
      "            boxWidth: det.detection.box.width, canvasWidth: canvas.width,\n" +
      "            rejectionReasons: [], stageKey: stageKeyRef.current, hintKey: null,"
    )
    .replace(
      "          {cameraLayoutDebugEnabled && <CameraLayoutDebugPanel videoRef={videoRef} containerRef={containerRef}\n" +
      "            overlayRef={overlayCanvasRef} captureRef={cameraLayoutDebugRef}\n" +
      "            detectorSamplesRef={detectorSamplesRef} detectorLatest={detectorDebugLatest} procCanvasRef={procCanvasRef} />}",
      "          {cameraLayoutDebugEnabled && <CameraLayoutDebugPanel videoRef={videoRef} containerRef={containerRef}\n" +
      "            overlayRef={overlayCanvasRef} captureRef={cameraLayoutDebugRef}\n" +
      "            detectorSamplesRef={detectorSamplesRef} detectorLatest={detectorDebugLatest} />}"
    );
  // Reverse only exact, reviewed Issue B diagnostic edits before the existing parity guard.
  const undoIssueB = span => {
    if (!span.includes('const flushDetectorSample =')) return span;
    for (const change of require('./fixtures/issue-b-approved-live-diff.json')) {
      assert.ok(span.includes(change.after), 'approved Issue B diagnostic block must match exactly');
      span = span.replace(change.after, change.before);
    }
    return span;
  };
  // Approved close-face detection-loss recovery + hint-priority fix (real-
  // device iPhone/Yandex ?cameraLayoutDebug=1 capture: a face confidently
  // measured too_close (faceRatio > 0.78, EXISTING threshold, unchanged)
  // could make detectSingleFace() return null on the next ticks; the
  // no-detection grace is extended, ONLY when the last detection was
  // too_close, from the existing FACE_LOST_GRACE_MS to a new, strictly
  // bounded TOO_CLOSE_RECOVERY_GRACE_MS (2x FACE_LOST_GRACE_MS). Also fixes
  // rejection-hint UX priority so too_close outranks lighting/confidence
  // guidance it was previously losing to. Two bounded, disjoint edits,
  // each normalized back to its pre-fix HEAD form — same technique as
  // every normalizer above — so this guard still fails loudly on any
  // OTHER, unrelated drift in LiveScanScreen.
  const omitCloseFaceRecoveryFix = span => span
    .replace(
      "            // ISSUE B — see TOO_CLOSE_RECOVERY_GRACE_MS above: when the\n" +
      "            // last real detection was past the too_close faceRatio\n" +
      "            // threshold, the no-detection grace below is extended so a real-device\n" +
      "            // detector dropout while the user is still too close doesn't\n" +
      "            // collapse straight to \"Searching for face\" before they've had\n" +
      "            // a chance to back away.\n" +
      "            const graceWindowMs = (lastDetRef.current && lastDetRef.current.tooClose)\n" +
      "              ? TOO_CLOSE_RECOVERY_GRACE_MS : FACE_LOST_GRACE_MS;\n" +
      "            const withinGrace = hadFaceRef.current && lastDetRef.current\n" +
      "              && (now - lastDetRef.current.ts) < graceWindowMs;",
      "            const withinGrace = hadFaceRef.current && lastDetRef.current\n" +
      "              && (now - lastDetRef.current.ts) < FACE_LOST_GRACE_MS;"
    )
    .replace(
      "          const quality = assessFrameQuality({\n" +
      "            detScore: det.detection.score, headPose, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n" +
      "            brightness, sharpness, canvasWidth: canvas.width, boxWidth: det.detection.box.width,\n" +
      "          });\n" +
      "          // ISSUE B — records ONLY whether THIS tick's own (unchanged,\n" +
      "          // existing) too_close threshold fired, onto the SAME lastDetRef\n" +
      "          // object already written above this tick — read by the\n" +
      "          // no-detection branch's grace-window choice, nothing else.\n" +
      "          if (lastDetRef.current) lastDetRef.current.tooClose = quality.reasons.includes('too_close');\n" +
      "\n" +
      "          if (!quality.ok) {\n" +
      "            console.log('[LSA] FRAME REJECTED:', quality.reasons.join(', '));\n" +
      "            const diagStageKey = hasHadValidFrameRef.current ? 'stageRealigning' : 'stageFaceDetected';\n" +
      "            const diagHintKey = pickRejectionHintKey(quality.reasons, boxClipped);",
      "          const quality = assessFrameQuality({\n" +
      "            detScore: det.detection.score, headPose, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n" +
      "            brightness, sharpness, canvasWidth: canvas.width, boxWidth: det.detection.box.width,\n" +
      "          });\n" +
      "\n" +
      "          if (!quality.ok) {\n" +
      "            console.log('[LSA] FRAME REJECTED:', quality.reasons.join(', '));\n" +
      "            const diagStageKey = hasHadValidFrameRef.current ? 'stageRealigning' : 'stageFaceDetected';\n" +
      "            const diagHintKey = boxClipped ? 'hintCenterFace' : (REASON_MESSAGES[quality.reasons[0]] || null);"
    );
  // omitCloseFaceRecoveryFix runs FIRST (innermost): it must revert to the
  // Issue-B post-diagnostic form (decideStage/decideHint, REASON_MESSAGES-
  // based hint lookup) BEFORE undoIssueB looks for that exact form to
  // revert further back to true pre-Issue-B HEAD text.
  const normalize = span => omitZoomDiagnosticExtension(omitWebkitSafeVideoPresentation(omitPhaseC3dComposition(omitSecurity2AConsoleGates(omitCameraZoomFix(omitFaceShapeAnalysis(omitContextualIrisDebug(omitLiveScanLifecycleFix(omitCameraTimingInstrumentation(undoIssueB(omitCloseFaceRecoveryFix(span)))))))))));
  assert.strictEqual(normalize(cur),normalize(prev),'LiveScanScreen outside the bounded contextual debug additions, the approved Face Shape Analysis addition, the approved camera-zoom fix, and the approved lifecycle/stability fix must remain byte-identical to HEAD');
  assert.ok(cur.includes('if (debugAvailable) {\n              const leftAudit=buildIrisColorAudit('),'context extraction must remain inside the existing debugAvailable gate');
  assert.ok(cur.includes('contextual: debugIrisAuditRef.current.contextual'),'final debug export must reuse the stored contextual object');
  assert.ok(cur.includes('const faceShapeProfile = classifyFaceShape(best.landmarks, faceShapeHeadPose'),'Face Shape Analysis call must still be present');
  assert.ok(cur.includes('getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })'),'camera-zoom fix constraints must still be present');
  assert.ok(cur.includes('let cancelled = false;'),'lifecycle fix cancellation flag must still be present');
  assert.ok(cur.includes('track.onended = handleTrackEnded'),'lifecycle fix track-ended handler must still be wired');
  assert.ok(cur.includes("decideStage('stageScanError')"),'lifecycle fix scan-error state must still be present');
});

// J2 used to demand that the ENTIRE PhotoAnalysisScreen span be
// byte-identical to git HEAD. That was true for Phase 1 (which never
// touched photo analysis at all). The later reviewed Photo Analysis
// sharpness fix is now part of committed HEAD, so treating it as an
// uncommitted exception makes the guard fail against its own baseline.
//
// The durable invariant this test now protects: PhotoAnalysisScreen is
// byte-identical to git HEAD throughout — (a) everything before the sharpness measurement
// (file/canvas/detection setup, headPose, leftMetrics/rightMetrics,
// physical-eye normalization, brightness sampling) is untouched, (b)
// everything from the quality-gate call onward (assessFrameQuality
// itself, the eyelid-crease/iris/design-ranking pipeline, onComplete)
// is untouched, and (c) the committed sharpnessBox block remains present
// and byte-identical. This still fails loudly on unrelated Photo drift.
test('J2. PhotoAnalysisScreen production pipeline stays byte-identical to git HEAD outside the separately-guarded iris debug audit', () => {
  assert.ok(HEAD);
  const outerStart = '    function PhotoAnalysisScreen({ onComplete, onBack, modelsLoaded }) {';
  const outerEnd = '\n    function ParamIcon(';
  const brightnessLine = '          const brightness = sampleBrightness(ctx, leftEye.concat(rightEye));\n';
  const qualityLine = '          const quality = assessFrameQuality({';

  // Locate all four markers directly in the FULL source (not in an
  // already-sliced substring — outerEnd/qualityLine only occur in the
  // full file, and qualityLine/brightnessLine also occur once earlier
  // in LiveScanScreen, so every indexOf below is anchored to start no
  // earlier than this PhotoAnalysisScreen's own outerStart).
  const curOuterStart = src.indexOf(outerStart);
  const prevOuterStart = HEAD.indexOf(outerStart);
  assert.ok(curOuterStart !== -1 && prevOuterStart !== -1, 'expected to locate PhotoAnalysisScreen in both current and HEAD source');
  const curOuterEnd = src.indexOf(outerEnd, curOuterStart);
  const prevOuterEnd = HEAD.indexOf(outerEnd, prevOuterStart);
  const curBrightnessIdx = src.indexOf(brightnessLine, curOuterStart);
  const prevBrightnessIdx = HEAD.indexOf(brightnessLine, prevOuterStart);
  const curQualityIdx = src.indexOf(qualityLine, curOuterStart);
  const prevQualityIdx = HEAD.indexOf(qualityLine, prevOuterStart);
  assert.ok([curOuterEnd, prevOuterEnd, curBrightnessIdx, prevBrightnessIdx, curQualityIdx, prevQualityIdx].every((i) => i !== -1), 'expected to locate the brightness line, quality-gate call, and end of PhotoAnalysisScreen in both current and HEAD source');

  // (a) everything up to and including the (unchanged) brightness line.
  // PHOTO QUALITY DEBUG — ?photoQualityDebug=1 diagnostic (see
  // index.html's own "TEMPORARY: URL-only, read-only Photo Analysis
  // quality diagnostics" comments). Three bounded, additive edits land
  // in this head span: the two new photoQualityDebugEnabled/
  // photoQualityDebugInfo declarations, the reset call at the top of
  // analyze(), and the !det branch gaining a debug-gated diagnostic
  // capture before its existing setState('error'); return;. Normalized
  // back to pre-fix HEAD form, same technique as every normalizer in
  // this file, so this guard still fails loudly on any OTHER,
  // unrelated drift in PhotoAnalysisScreen's measurement setup.
  const omitPhotoQualityDebugHead = (head) => head
    .replace(
      "      const fileInputRef = useRef(null);\n" +
      "      const photoQualityDebugEnabled = isPhotoQualityDebugEnabled();\n" +
      "      const [photoQualityDebugInfo, setPhotoQualityDebugInfo] = useState(null);\n",
      "      const fileInputRef = useRef(null);\n"
    )
    .replace(
      "        if (!file) return;\n" +
      "        if (photoQualityDebugEnabled) setPhotoQualityDebugInfo(null);\n" +
      "        const url = URL.createObjectURL(file);",
      "        if (!file) return;\n" +
      "        const url = URL.createObjectURL(file);"
    )
    .replace(
      "          if (!det) {\n" +
      "            if (photoQualityDebugEnabled) {\n" +
      "              setPhotoQualityDebugInfo({\n" +
      "                version: 1, detectorPresent: false, detectorScore: null, faceRatio: null,\n" +
      "                leftEAR: null, rightEAR: null, roll: null, yaw: null, pitch: null,\n" +
      "                brightness: null, sharpness: null, boxClipped: null,\n" +
      "                allReasons: [], qualityOk: null, primaryReason: 'no_detection',\n" +
      "                failureBeforeQualityCheck: true, failureType: 'no_detection',\n" +
      "                finalHardBlockPath: 'no_detection (before assessFrameQuality)',\n" +
      "                userFacingMessageKey: 'photoErrorQuality', wouldBeHintKeyIfWired: null,\n" +
      "                exceptionInfo: null,\n" +
      "              });\n" +
      "            }\n" +
      "            setState('error'); return;\n" +
      "          }\n",
      "          if (!det) { setState('error'); return; }\n"
    );
  const curHead = omitPhotoQualityDebugHead(src.slice(curOuterStart, curBrightnessIdx + brightnessLine.length));
  const prevHead = omitPhotoQualityDebugHead(HEAD.slice(prevOuterStart, prevBrightnessIdx + brightnessLine.length));
  assert.strictEqual(curHead, prevHead, 'everything before the sharpness measurement (detection, headPose, leftMetrics/rightMetrics, physical-eye normalization, brightness sampling) must be byte-identical to git HEAD');

  // (b) everything from the quality-gate call onward. outerEnd now also
  // picks up two new appended top-level functions (isPhotoQualityDebugEnabled,
  // PhotoQualityDebugPanel) — deliberately placed AFTER PhotoAnalysisScreen's
  // own closing brace, not before it, so they never land inside
  // LiveScanScreen/NaturalLashScanScreen's own byte-identical guards
  // (see J1 above and camera-preview.test.js) — normalized away below
  // alongside the quality-branch/catch-branch/JSX-panel-render additions.
  const omitPhotoQualityDebugTail = (tail) => {
    let out = tail
      .replace(
        "          console.log('[Photo] quality', quality);\n" +
        "          if (photoQualityDebugEnabled) {\n" +
        "            // faceRatio here mirrors assessFrameQuality's own internal\n" +
        "            // `boxWidth / canvasWidth` formula exactly, purely for\n" +
        "            // display — assessFrameQuality itself is not modified and\n" +
        "            // its return value is used as-is (quality.ok/quality.reasons).\n" +
        "            const photoFaceRatio = det.detection.box.width / Math.max(canvas.width, 1);\n" +
        "            const photoQualityDiag = {\n" +
        "              version: 1, detectorPresent: true, detectorScore: det.detection.score,\n" +
        "              faceRatio: photoFaceRatio, leftEAR: leftMetrics.ear, rightEAR: rightMetrics.ear,\n" +
        "              roll: headPose.roll, yaw: headPose.yawProxy, pitch: headPose.pitchProxy,\n" +
        "              brightness, sharpness,\n" +
        "              // Photo Analysis never computes an edge-clip check today\n" +
        "              // (unlike Live Scan's boxClipped) — reported honestly as\n" +
        "              // not-computed rather than inventing a new derived value.\n" +
        "              boxClipped: null,\n" +
        "              allReasons: quality.reasons, qualityOk: quality.ok,\n" +
        "              primaryReason: quality.reasons[0] ?? null,\n" +
        "              failureBeforeQualityCheck: false,\n" +
        "              failureType: quality.ok ? 'none' : 'quality_rejection',\n" +
        "              finalHardBlockPath: quality.ok ? 'none (quality.ok=true)' : `assessFrameQuality:${quality.reasons[0]}`,\n" +
        "              userFacingMessageKey: quality.ok ? null : 'photoErrorQuality',\n" +
        "              // Informational only — Photo Analysis's UI does not\n" +
        "              // currently select a per-reason hint at all (it always\n" +
        "              // shows the single generic photoErrorQuality message);\n" +
        "              // this reuses the EXISTING pickRejectionHintKey function\n" +
        "              // (already used by Live Scan) against the SAME reasons\n" +
        "              // array, purely to show what it would resolve to.\n" +
        "              wouldBeHintKeyIfWired: quality.ok ? null : pickRejectionHintKey(quality.reasons, false),\n" +
        "              exceptionInfo: null,\n" +
        "            };\n" +
        "            setPhotoQualityDebugInfo(photoQualityDiag);\n" +
        "            // On a PASS, this screen calls onComplete() and unmounts\n" +
        "            // immediately (see the EYELID CREASE V2 / IRIS COLOR AUDIT\n" +
        "            // comments above for the same documented constraint) — no\n" +
        "            // panel has time to render, so this is logged the same\n" +
        "            // read-only \"debug shadow\" way those two already are.\n" +
        "            if (quality.ok) console.log('[PhotoQualityDebug]', photoQualityDiag);\n" +
        "          }\n" +
        "          if (!quality.ok) { setState('error'); return; }",
        "          console.log('[Photo] quality', quality);\n" +
        "          if (!quality.ok) { setState('error'); return; }"
      )
      .replace(
        "        } catch (e) {\n" +
        "          console.error('[Photo] PIPELINE ERROR', e);\n" +
        "          if (photoQualityDebugEnabled) {\n" +
        "            // Safe error type/message only — a generic JS Error's\n" +
        "            // name/message (e.g. \"TypeError: Failed to fetch\",\n" +
        "            // \"SecurityError: ...\") never contains pixel data; the\n" +
        "            // exception object itself is never stored or copied.\n" +
        "            setPhotoQualityDebugInfo({\n" +
        "              version: 1, detectorPresent: null, detectorScore: null, faceRatio: null,\n" +
        "              leftEAR: null, rightEAR: null, roll: null, yaw: null, pitch: null,\n" +
        "              brightness: null, sharpness: null, boxClipped: null,\n" +
        "              allReasons: [], qualityOk: null, primaryReason: null,\n" +
        "              failureBeforeQualityCheck: null, failureType: 'exception',\n" +
        "              finalHardBlockPath: 'exception',\n" +
        "              userFacingMessageKey: 'photoErrorQuality', wouldBeHintKeyIfWired: null,\n" +
        "              exceptionInfo: { name: (e && e.name) || 'Error', message: String((e && e.message) || e || 'unknown') },\n" +
        "            });\n" +
        "          }\n" +
        "          setState('error');\n" +
        "        }",
        "        } catch (e) {\n" +
        "          console.error('[Photo] PIPELINE ERROR', e);\n" +
        "          setState('error');\n" +
        "        }"
      )
      .replace(
        "                <p className=\"text-xs text-danger leading-relaxed\">{t('photoErrorQuality', lang)}</p>\n" +
        "                {photoQualityDebugEnabled && photoQualityDebugInfo && <PhotoQualityDebugPanel info={photoQualityDebugInfo} />}\n",
        "                <p className=\"text-xs text-danger leading-relaxed\">{t('photoErrorQuality', lang)}</p>\n"
      );
    // The two new appended functions, if present, sit right after
    // PhotoAnalysisScreen's own closing "    }" and before "function
    // ParamIcon(" — stripped by exact marker rather than a giant
    // literal match, so a genuine future edit inside either function
    // still fails loudly via the separate photo-quality-debug.test.js
    // suite, not silently absorbed here.
    const helperMarker = "\n    // TEMPORARY: URL-only, read-only Photo Analysis quality diagnostics.";
    const helperStart = out.indexOf(helperMarker);
    if (helperStart !== -1) {
      const panelCloseMarker = "\n        </aside>\n      );\n    }\n";
      const panelCloseIdx = out.indexOf(panelCloseMarker, helperStart);
      assert.ok(panelCloseIdx !== -1, 'expected to find the end of the appended PhotoQualityDebugPanel function');
      out = out.slice(0, helperStart) + out.slice(panelCloseIdx + panelCloseMarker.length);
    }
    return out;
  };
  const curTail = omitPhotoQualityDebugTail(src.slice(curQualityIdx, curOuterEnd));
  const prevTail = omitPhotoQualityDebugTail(HEAD.slice(prevQualityIdx, prevOuterEnd));
  const debugStart = '          let irisColorAuditForRec = null;';
  const debugEnd = '          const designs = rankDesigns(classified, lang);';
  const omitIrisDebugAudit = (tail) => {
    const start = tail.indexOf(debugStart);
    const end = tail.indexOf(debugEnd, start);
    assert.ok(start !== -1 && end > start, 'the exclusion must resolve only the bounded irisColorAuditForRec debug block');
    return { comparable: tail.slice(0, start) + debugEnd + tail.slice(end + debugEnd.length), block: tail.slice(start, end) };
  };
  // Approved Face Shape Analysis addition (see index.html's own "FACE
  // SHAPE ANALYSIS" comment block) — one bounded call right after the
  // classifyFeatures/overallConfidence lines, plus one new sibling
  // field on photoRec. Normalized away before comparison, same
  // technique as the iris debug block above, so drift anywhere else
  // in this tail still fails loudly.
  const omitFaceShapeAnalysis = (tail) => tail
    .replace(
      "          // FACE SHAPE ANALYSIS — independent analyzer, reads this\n          // photo's own det.landmarks and the headPose already computed\n          // above. Never derived from `classified`/eyeProfile; never\n          // fed back into classifyFeatures or the quality gate above.\n          const faceShapeProfile = classifyFaceShape(det.landmarks, headPose, { singleFrame: true, imageQuality });\n",
      ''
    )
    .replace("\n            faceShapeProfile,", '');
  // Approved Phase C3d addition (see the LiveScanScreen J1 test's
  // identical normalizer/comment above) — same bounded, additive
  // colorComposition/compositionLabel assignment right after this
  // screen's own combineIris(...) call.
  const omitPhaseC3dComposition = (tail) => tail.replace(
    "          // Phase C3d: additive bilateral composition (see the LiveScan\n" +
    "          // call site's identical comment above).\n" +
    "          iris.colorComposition = combineIrisColorComposition(leftIris.colorComposition, leftIris.confidence, rightIris.colorComposition, rightIris.confidence);\n" +
    "          iris.compositionLabel = deriveIrisColorCompositionLabel(iris.colorComposition, iris.name);\n",
    ""
  );
  const curGuarded = omitIrisDebugAudit(omitPhaseC3dComposition(omitFaceShapeAnalysis(curTail)));
  const prevGuarded = omitIrisDebugAudit(omitPhaseC3dComposition(omitFaceShapeAnalysis(prevTail)));
  assert.strictEqual(curGuarded.comparable, prevGuarded.comparable, 'everything from the quality-gate call onward outside the bounded iris debug block and the approved Face Shape Analysis addition must remain byte-identical to git HEAD');
  assert.ok(curTail.includes('const faceShapeProfile = classifyFaceShape(det.landmarks, headPose'), 'Face Shape Analysis call must still be present');

  // The intentionally excluded span is not unguarded: pin its debug gate,
  // native-coordinate mapping, direct source-image read, paired comparison,
  // console exposure, and prohibition on replacing production iris values.
  assert.ok(curGuarded.block.includes('if (isDebugModeEnabled()) {'));
  assert.ok(curGuarded.block.includes('debugBuildIrisNativeMapping(naturalWidth,naturalHeight,canvas.width,canvas.height,leftEye,rightEye,resizedLeftAudit,resizedRightAudit)'));
  assert.ok(curGuarded.block.includes("nativeCtx.drawImage(img,0,0,naturalWidth,naturalHeight);"));
  assert.ok(curGuarded.block.includes('buildIrisColorAudit(nativeCtx,mapping.left.eyePoints,mapping.left.center)'));
  assert.ok(curGuarded.block.includes('buildIrisColorAudit(nativeCtx,mapping.right.eyePoints,mapping.right.center)'));
  assert.ok(curGuarded.block.includes('debugBuildPairedIrisStats(nativeCtx,resizedLeftAudit.acceptedPixels'));
  assert.ok(curGuarded.block.includes("console.log('[Photo] IRIS COLOR AUDIT (debug shadow, not used in production)', irisColorAuditForRec);"));
  assert.ok(!/leftIris\s*=\s*native|rightIris\s*=\s*native|iris\s*=\s*native/.test(curGuarded.block));

  // (c) The reviewed sharpness fix is committed history now, so current
  // and HEAD must match here too. Pin its two defining statements so the
  // guard still fails if the fix is silently removed or bypassed.
  const curMiddle = src.slice(curBrightnessIdx + brightnessLine.length, curQualityIdx);
  const prevMiddle = HEAD.slice(prevBrightnessIdx + brightnessLine.length, prevQualityIdx);
  assert.strictEqual(curMiddle, prevMiddle, 'the committed Photo sharpness block must be byte-identical to HEAD');
  assert.ok(!curMiddle.includes('estimateSharpness(ctx, det.detection.box)'), 'the current source must no longer measure sharpness directly off the (possibly heavily downscaled) display canvas');
  assert.ok(curMiddle.includes('const sharpnessBox = (() => {'), 'the current source must contain the reviewed sharpnessBox re-crop fix');
  assert.ok(curMiddle.includes("const sharpness = estimateSharpness(sharpCtx, { x: 0, y: 0, width: sharpnessBox.cw, height: sharpnessBox.ch });"), 'the current source must still call the SAME, unmodified estimateSharpness function — only its pixel source changed');
});

// J3 used to demand that the ENTIRE span from `useState('home')` through
// the App() return statement be byte-identical to git HEAD. That was
// true for Phase 1 (which never touched result handling at all), but
// Stage 2.1-2.3 (explicitly reviewed and approved) intentionally adds
// `Analytics.track(...)` calls inside handleComplete/handleReviewConfirm,
// so a whole-span byte-identity check is now the wrong tool — same class
// of staleness as I3/I8/I2 above. The durable invariants this test is
// actually protecting are: (a) the model-loading effect and the three
// untouched handlers (retryLoad/viewMap/handleLashScanComplete) remain
// byte-identical to HEAD, and (b) handleComplete/handleReviewConfirm
// still contain every one of their ORIGINAL state-transition statements
// verbatim, in the original order, proving nothing was removed or
// reordered — only additive, consent-gated Analytics.track(...) calls
// were layered in ahead of the pre-existing logic.
test('J3. the model-loading effect + untouched handlers (retryLoad/viewMap/handleLashScanComplete) inside App() are byte-identical to git HEAD, and handleComplete/handleReviewConfirm retain every original state-transition statement verbatim (only additive Analytics.track() calls were layered in)', () => {
  assert.ok(HEAD);

  // (a) the model-loading effect itself — never touched by Stage 2.1-2.3.
  const curEffect = extractSpan(src, '      // Models load once at the App root and are reused by every', '\n\n      const handleComplete');
  const prevEffect = extractSpan(HEAD, '      // Models load once at the App root and are reused by every', '\n\n      const handleComplete');
  assert.ok(curEffect !== null && prevEffect !== null, 'expected to locate the model-loading effect in both current and HEAD source');
  assert.strictEqual(curEffect, prevEffect, 'the model-loading effect must be byte-identical — Stage 2.1-2.3 must not touch model loading');

  // (a, cont'd) the three handlers Stage 2.1-2.3 does not instrument at all.
  // CLIENT-3 (later, separate, reviewed phase) adds one new handler —
  // handleSaveToClient — right after handleLashScanComplete in this
  // same span; normalized back out below, same technique as J1's
  // omit*Fix helpers, so this guard still fails loudly on any OTHER,
  // unrelated drift to retryLoad/viewMap/handleLashScanComplete.
  const omitSaveToClientHandler = span => span.replace(
    "\n      // Hero saves its current first recommendation; only the map uses\n      // activeDesign. Returning from a map must not leak that old selection\n      // into a save from Hero. Choosing another card opens its current map.\n      const handleSaveToClient = () => {\n        if (!result) return;\n        const design = screen === 'lashmap'\n          ? activeDesign\n          : (result.designs && result.designs.length)\n            ? canonicalRecommendationProps(result.designs[0], result.eyeProfile, lang, 0).clientDesign\n            : null;\n        beginSaveToClient(design);\n      };",
    ''
  );
  // Both sides are normalized the same way: HEAD itself has carried the
  // committed CLIENT-3 handleSaveToClient addition since that phase
  // landed on main, so omitting only from curTail (as originally
  // written, back when HEAD still predated CLIENT-3) would make this
  // assertion fail permanently regardless of any OTHER drift -- the
  // exact stale-comparison bug this normalization exists to avoid.
  const curTail = omitSaveToClientHandler(extractSpan(src, '      const retryLoad = ', '\n\n      return (\n        <LangContext.Provider value={lang}>'));
  const prevTail = omitSaveToClientHandler(extractSpan(HEAD, '      const retryLoad = ', '\n\n      return (\n        <LangContext.Provider value={lang}>'));
  assert.ok(curTail !== null && prevTail !== null, 'expected to locate retryLoad..handleLashScanComplete in both current and HEAD source');
  assert.strictEqual(curTail, prevTail, 'retryLoad/viewMap/handleLashScanComplete must be byte-identical — Stage 2.1-2.3 does not touch them');

  // (b) handleComplete/handleReviewConfirm: original substrings still
  // present verbatim (nothing removed/reordered), plus the new tracking.
  const curHandlers = extractSpan(src, '      const handleComplete = ', '\n      const retryLoad = ');
  assert.ok(curHandlers !== null, 'expected to locate handleComplete/handleReviewConfirm in current source');
  assert.ok(curHandlers.includes("setResult(rec); setNaturalLashProfile(null); setScreen('review');"), 'handleComplete must still perform its original state transition verbatim');
  assert.ok(curHandlers.includes("setResult(rec); setScreen('hero');"), 'handleReviewConfirm must still perform its original state transition verbatim');
  assert.ok(curHandlers.includes("Analytics.track('scan_completed'"), 'handleComplete must fire the reviewed scan_completed event');
  assert.ok(curHandlers.includes("Analytics.track('results_viewed')"), 'handleReviewConfirm must fire the reviewed results_viewed event');
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

test('J5. consent-manager.js production behavior remains untouched by unrelated worktree changes', () => {
  let diff;
  try {
    diff = execSync('git diff -- consent-manager.js', { cwd: repoRoot }).toString();
  } catch (e) {
    diff = 'DIFF_COMMAND_FAILED: ' + e.message;
  }
  assert.strictEqual(diff.trim(), '', 'consent-manager.js must have zero diff against committed HEAD');
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
