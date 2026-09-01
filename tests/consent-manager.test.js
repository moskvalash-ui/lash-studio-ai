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
  const normalize = span => omitCameraZoomFix(omitFaceShapeAnalysis(omitContextualIrisDebug(span)));
  assert.strictEqual(normalize(cur),normalize(prev),'LiveScanScreen outside the bounded contextual debug additions, the approved Face Shape Analysis addition, and the approved camera-zoom fix must remain byte-identical to HEAD');
  assert.ok(cur.includes('if (debugAvailable) {\n              const leftAudit=buildIrisColorAudit('),'context extraction must remain inside the existing debugAvailable gate');
  assert.ok(cur.includes('contextual: debugIrisAuditRef.current.contextual'),'final debug export must reuse the stored contextual object');
  assert.ok(cur.includes('const faceShapeProfile = classifyFaceShape(best.landmarks, faceShapeHeadPose'),'Face Shape Analysis call must still be present');
  assert.ok(cur.includes('getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })'),'camera-zoom fix constraints must still be present');
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
  const curHead = src.slice(curOuterStart, curBrightnessIdx + brightnessLine.length);
  const prevHead = HEAD.slice(prevOuterStart, prevBrightnessIdx + brightnessLine.length);
  assert.strictEqual(curHead, prevHead, 'everything before the sharpness measurement (detection, headPose, leftMetrics/rightMetrics, physical-eye normalization, brightness sampling) must be byte-identical to git HEAD');

  // (b) everything from the quality-gate call onward.
  const curTail = src.slice(curQualityIdx, curOuterEnd);
  const prevTail = HEAD.slice(prevQualityIdx, prevOuterEnd);
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
  const curGuarded = omitIrisDebugAudit(omitFaceShapeAnalysis(curTail));
  const prevGuarded = omitIrisDebugAudit(omitFaceShapeAnalysis(prevTail));
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
  const curTail = extractSpan(src, '      const retryLoad = ', '\n\n      return (\n        <LangContext.Provider value={lang}>');
  const prevTail = extractSpan(HEAD, '      const retryLoad = ', '\n\n      return (\n        <LangContext.Provider value={lang}>');
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
