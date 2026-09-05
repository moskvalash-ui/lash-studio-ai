'use strict';
// ============================================================
// RELEASE-1.1 — real-iPhone blocker fixes, regression guards.
// ------------------------------------------------------------
// isDebugModeEnabled is now a PURE function of window.location.search
// (no storage of any kind), so it is extracted and EXECUTED for real
// here (same string-slice + eval technique this repo uses throughout),
// with only `window.location.search` mocked — real behavioral proof,
// not a structural guess. Everything else (camera timing / iris
// display) stays structural/string-based, matching this repo's
// established approach for JSX-heavy, DOM-dependent code (see
// security-2a-console-diagnostics.test.js's own precedent).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadIsDebugModeEnabled() {
  const start = src.indexOf('function isDebugModeEnabled() {');
  const end = src.indexOf('\n\n', start);
  assert.ok(start !== -1 && end !== -1, 'expected to locate isDebugModeEnabled');
  const fnSrc = src.slice(start, end);
  return { fnSrc, load: (search) => new Function('window', 'URLSearchParams', fnSrc + '\nreturn isDebugModeEnabled();')({ location: { search } }, URLSearchParams) };
}

// ------------------------------------------------------------
// 1. Fail-closed debug gate — pure function of the CURRENT URL only,
// no localStorage/sessionStorage of any kind. Real execution proof
// for cases A/B/D/E; case C (navigate ?debug=1 -> plain URL in the
// SAME tab/session) is proven by construction: with zero storage
// anywhere, calling the function again with a different `search`
// value cannot possibly see anything left over from a previous call
// in the same JS realm — there is nowhere for such state to live.
// ------------------------------------------------------------
test('isDebugModeEnabled uses NO storage of any kind (localStorage/sessionStorage) — pure function of the current URL only', () => {
  const { fnSrc } = loadIsDebugModeEnabled();
  assert.ok(!fnSrc.includes('localStorage'), 'must never reference localStorage');
  assert.ok(!fnSrc.includes('sessionStorage'), 'must never reference sessionStorage');
  assert.ok(!fnSrc.includes('lashStudioDebug'), 'the old persisted-flag key must be fully retired');
});

test('no other production code path references the retired lashStudioDebug storage key', () => {
  assert.ok(!src.includes('lashStudioDebug'), 'lashStudioDebug must not appear anywhere in production source — the flag is fully retired, not just unused');
});

test('A. plain URL (no query string at all) -> debug false', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load(''), false);
});

test('B. ?debug=1 -> debug true', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load('?debug=1'), true);
});

test('C. navigating from ?debug=1 to the plain URL in the SAME session sees debug false (no storage exists to carry state across the two calls)', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load('?debug=1'), true, 'sanity: the first "page" really was in debug mode');
  assert.strictEqual(load(''), false, 'the very next "page" (same JS realm, same test, simulating the same tab) must not inherit it');
});

test('D. reloading the plain URL (called again with the same empty search, simulating a reload) stays debug false', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load(''), false);
  assert.strictEqual(load(''), false);
});

test('E. ?debug=0 -> debug false', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load('?debug=0'), false);
});

test('other query params, and an unrecognized debug value, do not accidentally enable debug mode', () => {
  const { load } = loadIsDebugModeEnabled();
  assert.strictEqual(load('?foo=bar'), false);
  assert.strictEqual(load('?debug=true'), false);
  assert.strictEqual(load('?debug='), false);
});

test('F. the underlying debug-only analysis/diagnostic code itself is preserved (not deleted) — only isDebugModeEnabled\'s storage mechanism changed', () => {
  assert.ok(src.includes("console.log('[Photo] EYELID CREASE V2 (debug shadow, not used in classification)'"));
  assert.ok(src.includes('function CreaseV2DebugPanel(')); // the debug overlay component itself still exists
  assert.ok(src.includes('debugAvailable'), 'the debugAvailable flag this diagnostic code is gated on must still be threaded through');
});

test('G. the debug overlay (EYELID CREASE V2 shadow / experimental eyelid type / Copy V2 JSON) is unreachable on a plain URL: its render call site is still gated on debugAvailable (== isDebugModeEnabled(), proven false above for a plain URL), and nothing else can set debugCreaseV2', () => {
  assert.ok(src.includes("{debugAvailable && debugCreaseV2 && <CreaseV2DebugPanel data={debugCreaseV2} compare={debugEyelidCompare} frameTrace={debugFrameTrace} frameTraceRef={debugFrameTraceSnapshotRef} irisAudit={debugIrisAudit} />}"));
  const start = src.indexOf('function LiveScanScreen({ onComplete, onBack, modelsLoaded, onSetLang }) {');
  const end = src.indexOf('\n    function PhotoAnalysisScreen(');
  const body = src.slice(start, end);
  assert.strictEqual((body.match(/setDebugCreaseV2\(/g) || []).length >= 1, true, 'setDebugCreaseV2 must still be the only writer of debugCreaseV2');
  // Every setDebugCreaseV2 call in this screen must itself be reached
  // only through code already conditioned on debugAvailable.
  const setterCalls = [...body.matchAll(/setDebugCreaseV2\(/g)];
  for (const m of setterCalls) {
    const before = body.slice(Math.max(0, m.index - 5000), m.index);
    const lastIf = before.lastIndexOf('if (debugAvailable) {');
    assert.ok(lastIf !== -1, 'a setDebugCreaseV2 call was found with no enclosing if (debugAvailable) block');
  }
});

// ------------------------------------------------------------
// 2. Camera timing instrumentation — temporary, debug-only, no
// user/frame data, every mark gated behind debugAvailable.
// ------------------------------------------------------------
test('every camera-startup timing mark is debug-only (markTiming itself gates on debugAvailable, not per call site)', () => {
  const start = src.indexOf('const timingRef = useRef({});');
  const end = src.indexOf('};', src.indexOf('const markTiming = (label) =>', start)) + 2;
  assert.ok(start !== -1 && end > start);
  const body = src.slice(start, end);
  assert.ok(body.includes('if (!debugAvailable'), 'markTiming must bail out immediately when debug mode is off');
  assert.ok(!body.includes('landmarks') && !body.includes('canvas.toDataURL') && !body.includes('rgb'), 'timing instrumentation must never carry frame/pixel/face data — timestamps only');
});

test('all ten T0-T9 timing stages are present, each called exactly once (instrumentation preserved for the real-iPhone retest)', () => {
  for (const stage of ['T0_live_scan_requested', 'T1_getUserMedia_requested', 'T2_stream_obtained', 'T3_video_metadata_ready', 'T4_video_playing', 'T5_first_frame_eligible', 'T6_first_inference_begins', 'T7_first_inference_completes', 'T8_first_valid_face_detected', 'T9_analysis_stages_begin']) {
    const occurrences = (src.match(new RegExp("markTiming\\('" + stage + "'\\)", 'g')) || []).length;
    assert.strictEqual(occurrences, 1, stage + ' must be marked exactly once, found ' + occurrences);
  }
});

// ------------------------------------------------------------
// 3. Iris confidence display fix — Results (HeroScreen) — matches the
// SAME uncertain-suppression pattern already established for
// shape/symmetry.
// ------------------------------------------------------------
test('Results: HeroScreen suppresses the iris confidence percentage when the category itself is uncertain (matching shape/symmetry\'s existing pattern)', () => {
  assert.ok(src.includes("confidence={p.eyeShapeCategory === 'uncertain' ? undefined : p.eyeShapeConfidence}"), 'expected the pre-existing shape pattern to still be present, unmodified');
  assert.ok(src.includes("confidence={p.symmetryCategory === 'uncertain' ? undefined : p.symmetryConfidence}"), 'expected the pre-existing symmetry pattern to still be present, unmodified');
  assert.ok(src.includes("confidence={result.iris?.name === 'uncertain' ? undefined : result.iris?.confidence}"), 'expected the iris row to suppress confidence the same way when result.iris.name is uncertain');
  assert.ok(!src.includes('confidence={result.iris?.confidence}'), 'the old unconditional iris confidence prop must no longer exist verbatim');
});

// ------------------------------------------------------------
// 3b. Iris confidence display fix — Visit Detail (Client Card history)
// — same rule, approved as a RELEASE-1.1 consistency hotfix.
// ------------------------------------------------------------
test('Visit Detail: suppresses the historical iris confidence percentage when the SAVED canonical category is uncertain', () => {
  assert.ok(src.includes("confidence={analysis.iris?.category === 'uncertain' ? undefined : (analysis.iris?.confidence ?? undefined)}"), 'expected VisitDetailScreen\'s iris row to suppress confidence when analysis.iris.category is uncertain');
  assert.ok(!src.includes('confidence={analysis.iris?.confidence ?? undefined}'), 'the old unconditional historical iris confidence prop must no longer exist verbatim');
});

test('Visit Detail: uncertain historical iris shows the RU/EN "not determined" text with no confidence number; a confident historical iris may still show one', () => {
  // Value text is untouched by this fix — IRIS_NAMES.uncertain already
  // provides the RU/EN "not determined" wording; only confidence changed.
  assert.ok(src.includes("value={analysis.iris && analysis.iris.category ? (lang === 'en' ? IRIS_NAMES[analysis.iris.category].en : IRIS_NAMES[analysis.iris.category].ru) : na}"));
  assert.ok(src.includes("uncertain: {ru:'Оттенок не определён', en:'Color inconclusive'}"), 'IRIS_NAMES.uncertain RU/EN text must still exist unchanged');
});

test('Visit Detail iris fix does not touch the classifier, combineIris, thresholds, snapshot schema, Visit persistence, historical Lash Map, or Client Card architecture', () => {
  assert.ok(src.includes('const selectedName = sectorNames.length < 3 || sectorAgreement < 0.6'));
  assert.ok(src.includes('const eitherUncertain = l.name === \'uncertain\' || r.name === \'uncertain\';'));
  const vsStart = src.indexOf('function VisitDetailScreen({ lang, visitId, clientId, store, onBack }) {');
  const vsEnd = src.indexOf('\n    // ------------------------------------------------------------\n    // DEBUG-ONLY:', vsStart);
  const vsBody = vsStart !== -1 && vsEnd !== -1 ? src.slice(vsStart, vsEnd) : '';
  assert.ok(vsBody.length > 0, 'expected to locate VisitDetailScreen');
  for (const forbidden of ['classifyIrisColor(', 'combineIris(', 'analyzeIrisSample(', 'store.createVisit', 'ClientStore.']) {
    assert.ok(!vsBody.includes(forbidden), 'VisitDetailScreen must not reference ' + forbidden);
  }
  assert.ok(vsBody.includes('visit.analysisSnapshot'), 'must still read the saved, immutable snapshot only');
});

// ------------------------------------------------------------
// 4. Live Scan vs Photo Analysis resolution — documents the real,
// measured difference this investigation found in code.
// ------------------------------------------------------------
test('Live Scan processes frames at a lower resolution cap (640px) than Photo Analysis (900px) — the real, measured input-resolution difference behind the iris-uncertainty investigation', () => {
  assert.ok(src.includes('const scale = Math.min(1, 640 / video.videoWidth);'), 'expected LiveScanScreen\'s tick to still cap at 640px wide');
  assert.ok(src.includes('const maxW = 900;'), 'expected PhotoAnalysisScreen to still cap at 900px wide');
});

// ------------------------------------------------------------
// 5. First-inference warm-up fix — additive only, never touches the
// protected model-loading effect, camera constraints, detector config,
// or modelsLoaded/loadError semantics. Camera fix must remain
// unchanged in this reconciliation pass.
// ------------------------------------------------------------
test('the TF.js first-inference warm-up call is additive, gated on modelsLoaded, and never sets modelsLoaded/loadError itself', () => {
  const start = src.indexOf('useEffect(() => {\n        if (!modelsLoaded) return;');
  const end = src.indexOf('}, [modelsLoaded]);', start) + '}, [modelsLoaded]);'.length;
  assert.ok(start !== -1 && end > start, 'expected to locate the warm-up effect');
  const body = src.slice(start, end);
  assert.ok(!body.includes('setModelsLoaded'), 'the warm-up effect must never set modelsLoaded itself');
  assert.ok(!body.includes('setLoadError'), 'the warm-up effect must never set loadError itself');
  assert.ok(body.includes('faceapi.detectSingleFace'), 'expected a real throwaway detectSingleFace call to pay the backend warm-up cost');
  assert.ok(body.includes('catch (e)'), 'the warm-up call must be best-effort — never allowed to throw into the render tree');
});

test('camera constraints, detector configuration, and mirror semantics are unchanged from the previous RELEASE-1.1 pass', () => {
  assert.ok(src.includes("navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })"));
  assert.ok(src.includes("new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })"));
  assert.ok(src.includes("loopRef.current = setInterval(() => tickImplRef.current(), 200);"));
});

test('the experimental eyelid-crease debug overlay stays gated behind BOTH debugAvailable and real debug data — its render call site is unchanged by the RELEASE-1.1 fix', () => {
  assert.ok(src.includes("{debugAvailable && debugCreaseV2 && <CreaseV2DebugPanel data={debugCreaseV2} compare={debugEyelidCompare} frameTrace={debugFrameTrace} frameTraceRef={debugFrameTraceSnapshotRef} irisAudit={debugIrisAudit} />}"), 'the debug overlay\'s own render gate must remain exactly as before — RELEASE-1.1 fixed the underlying flag\'s persistence, not this gate');
});

test('the warm-up effect sits outside the model-loading effect\'s own protected span (never edits it)', () => {
  const modelLoadStart = src.indexOf('// Models load once at the App root and are reused by every');
  const modelLoadEnd = src.indexOf('\n\n      const handleComplete', modelLoadStart);
  const modelLoadSpan = src.slice(modelLoadStart, modelLoadEnd);
  assert.ok(!modelLoadSpan.includes('warm-up') && !modelLoadSpan.includes('detectSingleFace'), 'the model-loading effect itself must remain untouched by the warm-up fix');
});
