// SECURITY-2A — regression tests for production console diagnostic
// gating. Static source-guard assertions against the REAL index.html
// text (same technique as tests/camera-preview.test.js and
// tests/physical-eye-integration.test.js): LiveScanScreen's real-camera
// per-frame loop cannot be driven headlessly without new camera-mock
// E2E infrastructure (out of this task's scope), so this file proves
// the fix at the source level instead of inventing a brittle mock.
//
// Covers exactly the 5 console.log call sites SECURITY-2A gated behind
// the app's existing isDebugModeEnabled()-derived `debugAvailable` flag
// (no new debug mechanism introduced): LiveScanScreen's FACE DETECTED,
// EYE METRICS, EYELID CONSENSUS, RESULT GENERATED, and
// NaturalLashScanScreen's NLS DIAG. `[NLS2 VALIDATION]` was found
// ALREADY correctly gated on re-verification (a correction to an
// earlier audit note, not a new fix) and is asserted as such below.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.message}`); } }

function extractFunction(marker, endMarker) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `setup: ${marker} must exist`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `setup: end marker for ${marker} must be found after it`);
  return src.slice(start, end);
}

const liveScanSource = extractFunction('function LiveScanScreen(', '\n    function NaturalLashScanScreen(');
const nlsSource = extractFunction('function NaturalLashScanScreen(', '\n    function PhotoAnalysisScreen(');

// ------------------------------------------------------------
// A. Normal mode does not expose the targeted user-derived diagnostics
//    -- each console.log call is now reached only through the existing
//    debugAvailable gate.
// ------------------------------------------------------------
const gatedLiveScanLogs = [
  ["if (debugAvailable) console.log('[LSA] FACE DETECTED'", 'FACE DETECTED (score/box)'],
  ["console.log('[LSA] EYE METRICS'", 'EYE METRICS (head pose/EAR/brightness/sharpness)'],
  ["if (debugAvailable) console.log('[LSA] EYELID CONSENSUS'", 'EYELID CONSENSUS (derived eyelid classification)'],
  ["if (debugAvailable) console.log('[LSA] RESULT GENERATED'", 'RESULT GENERATED (full eye metrics + iris result)'],
];
for (const [needle, label] of gatedLiveScanLogs) {
  test(`A. LiveScanScreen ${label} is only reachable behind debugAvailable`, () => {
    assert.ok(liveScanSource.includes(needle), `expected to find: ${needle}`);
  });
}
test('A. LiveScanScreen EYE METRICS console.log is inside an `if (debugAvailable) {` block (multi-line gate)', () => {
  const idx = liveScanSource.indexOf("console.log('[LSA] EYE METRICS'");
  const before = liveScanSource.slice(Math.max(0, idx - 200), idx);
  assert.ok(/if\s*\(debugAvailable\)\s*\{[^}]*$/.test(before), 'EYE METRICS log must be preceded by an open, still-active `if (debugAvailable) {` block');
});
test('A. NaturalLashScanScreen NLS DIAG console.log is only reachable behind debugAvailable', () => {
  assert.ok(nlsSource.includes("if (debugAvailable) { console.log('[NLS DIAG]'"), "expected the NLS DIAG log merged into the existing debugAvailable-gated block");
});
test('A. NaturalLashScanScreen NLS2 VALIDATION console.log is (already) only reachable behind debugAvailable', () => {
  // Re-verified against current source, not assumed from an earlier
  // audit note -- this one was already correctly gated before
  // SECURITY-2A and required no change. Uses brace-depth counting
  // (not a fixed-size lookback window) since real code between the
  // gate and this particular log exceeds a short window.
  const idx = nlsSource.indexOf("console.log('[NLS2 VALIDATION]'");
  assert.ok(idx > 0, 'setup: NLS2 VALIDATION log must exist');
  const gateIdx = nlsSource.lastIndexOf('if (debugAvailable) {', idx);
  assert.ok(gateIdx >= 0, 'setup: a debugAvailable gate must appear before the log');
  const between = nlsSource.slice(gateIdx + 'if (debugAvailable) {'.length, idx);
  let depth = 1;
  for (const ch of between) { if (ch === '{') depth++; else if (ch === '}') depth--; if (depth === 0) break; }
  assert.ok(depth > 0, 'the debugAvailable block must still be open (unclosed) at the point of the console.log call');
});

// ------------------------------------------------------------
// B. Debug mode can still expose the intended diagnostic information --
//    the log calls themselves must still exist (gated, not deleted).
// ------------------------------------------------------------
test('B. all 5 targeted diagnostic console.log calls still exist in source (gated, not removed)', () => {
  for (const marker of ["'[LSA] FACE DETECTED'", "'[LSA] EYE METRICS'", "'[LSA] EYELID CONSENSUS'", "'[LSA] RESULT GENERATED'", "'[NLS DIAG]'"]) {
    assert.ok(src.includes(marker), `${marker} must still be present in source`);
  }
});

// ------------------------------------------------------------
// C. The debug flag does not alter analysis logic -- the real
//    computations (classifyFeatures/applyReliableFrameConsensus/
//    rec.diagnostics construction/rec itself) must sit OUTSIDE the
//    debugAvailable conditionals introduced by this fix, i.e. they run
//    unconditionally regardless of debug mode.
// ------------------------------------------------------------
test('C. classifyFeatures/finalProfile/eyelidConsensus computation is NOT inside a debugAvailable conditional', () => {
  const classifyIdx = liveScanSource.indexOf('const classified = classifyFeatures(');
  const consensusIdx = liveScanSource.indexOf('const eyelidConsensus = resolveReliableFrameConsensus(');
  const finalProfileIdx = liveScanSource.indexOf('const finalProfile = applyReliableFrameConsensus(');
  assert.ok(classifyIdx > 0 && consensusIdx > classifyIdx && finalProfileIdx > consensusIdx, 'setup: all three computations must be found in order');
  // None of these lines may be preceded by an unclosed `if (debugAvailable) {`
  for (const idx of [classifyIdx, consensusIdx, finalProfileIdx]) {
    const before = liveScanSource.slice(Math.max(0, idx - 400), idx);
    assert.ok(!/if\s*\(debugAvailable\)\s*\{[^}]*$/.test(before), `computation at offset ${idx} must not be inside an open debugAvailable block`);
  }
});
test('C. rec.diagnostics is still computed unconditionally (only its console.log is gated)', () => {
  const diagAssignIdx = liveScanSource.indexOf('rec.diagnostics = {');
  assert.ok(diagAssignIdx > 0, 'setup: rec.diagnostics assignment must exist');
  const before = liveScanSource.slice(Math.max(0, diagAssignIdx - 400), diagAssignIdx);
  assert.ok(!/if\s*\(debugAvailable\)\s*\{[^}]*$/.test(before), 'rec.diagnostics assignment must not be inside an open debugAvailable block -- only the console.log reading it should be gated');
});

// ------------------------------------------------------------
// D. Operational errors/warnings are not globally disabled.
// ------------------------------------------------------------
test('D. PIPELINE ERROR handlers remain unconditional console.error calls (not debug-gated, not removed)', () => {
  for (const marker of ["console.error('[LSA] PIPELINE ERROR', e)", "console.error('[NLS] PIPELINE ERROR', e)", "console.error('[Photo] PIPELINE ERROR', e)"]) {
    assert.ok(src.includes(marker), `${marker} must still exist, unconditional`);
    const idx = src.indexOf(marker);
    const before = src.slice(Math.max(0, idx - 200), idx);
    assert.ok(!/if\s*\(debugAvailable\)\s*\{[^}]*$/.test(before), `${marker} must not have been placed behind a debugAvailable gate`);
  }
});
test('D. low-sensitivity Photo Analysis quality-gate log remains unconditional (unchanged, out of this fix\'s scope)', () => {
  assert.ok(src.includes("console.log('[Photo] quality', quality)"), 'expected the existing quality-gate log to be untouched');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
