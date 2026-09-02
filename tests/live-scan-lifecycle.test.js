const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// LiveScanScreen and NaturalLashScanScreen are JSX/React closures, not
// requirable modules — see camera-preview.test.js's own header comment
// for why this codebase tests them via source-guard string assertions
// against the real file text rather than executing them in Node.
const liveScanStart = src.indexOf('    function LiveScanScreen(');
const liveScanEnd = src.indexOf('\n    const NAT_LASH_HINT_KEYS', liveScanStart);
assert.ok(liveScanStart >= 0 && liveScanEnd > liveScanStart, 'LiveScanScreen must be structurally extractable');
const liveScanSource = src.slice(liveScanStart, liveScanEnd);

const naturalLashStart = src.indexOf('    function NaturalLashScanScreen(');
const naturalLashEnd = src.indexOf('\n    function PhotoAnalysisScreen(', naturalLashStart);
assert.ok(naturalLashStart >= 0 && naturalLashEnd > naturalLashStart, 'NaturalLashScanScreen must be structurally extractable');
const naturalLashSource = src.slice(naturalLashStart, naturalLashEnd);

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

// ------------------------------------------------------------
// A + B + C — camera-init effect: cancellation guard, order of checks,
// late-resolution track cleanup, idempotent teardown.
// ------------------------------------------------------------
const cameraEffectStart = liveScanSource.indexOf('      useEffect(() => {\n        let stream;');
const cameraEffectEnd = liveScanSource.indexOf('}, [facingMode]);', cameraEffectStart) + '}, [facingMode]);'.length;
assert.ok(cameraEffectStart >= 0 && cameraEffectEnd > cameraEffectStart, 'camera-init effect must be structurally extractable');
const cameraEffect = liveScanSource.slice(cameraEffectStart, cameraEffectEnd);

test('A: camera-init effect declares a cancellation flag and checks it before srcObject, play(), and starting the interval', () => {
  assert.ok(cameraEffect.includes('let cancelled = false;'));
  const getUserMediaIdx = cameraEffect.indexOf('await navigator.mediaDevices.getUserMedia(');
  const cancelCheckAfterAcquireIdx = cameraEffect.indexOf('if (cancelled) { acquired.getTracks().forEach(t => t.stop()); return; }', getUserMediaIdx);
  const srcObjectIdx = cameraEffect.indexOf('videoRef.current.srcObject = stream;', cancelCheckAfterAcquireIdx);
  const playIdx = cameraEffect.indexOf('await videoRef.current.play();', srcObjectIdx);
  const cancelCheckAfterPlayIdx = cameraEffect.indexOf('if (cancelled) return;', playIdx);
  const intervalStartIdx = cameraEffect.indexOf('loopRef.current = setInterval(() => tickImplRef.current(), 200);');
  assert.ok(getUserMediaIdx >= 0 && cancelCheckAfterAcquireIdx > getUserMediaIdx, 'cancellation must be checked immediately after getUserMedia resolves, before touching video');
  assert.ok(srcObjectIdx > cancelCheckAfterAcquireIdx, 'srcObject assignment must come after the post-getUserMedia cancellation check');
  assert.ok(playIdx > srcObjectIdx, 'play() must come after srcObject assignment');
  assert.ok(cancelCheckAfterPlayIdx > playIdx, 'cancellation must be re-checked after play() resolves');
  assert.ok(intervalStartIdx > cancelCheckAfterPlayIdx, 'the processing interval must start only after the post-play cancellation check');
});

test('B: a getUserMedia stream resolving after cancellation has every track stopped and is never attached or used to start the loop', () => {
  const guard = 'if (cancelled) { acquired.getTracks().forEach(t => t.stop()); return; }';
  assert.ok(cameraEffect.includes(guard));
  const guardIdx = cameraEffect.indexOf(guard);
  // The guard must return before any of these three ever run for a
  // cancelled acquisition.
  assert.ok(cameraEffect.indexOf('videoRef.current.srcObject = stream;') > guardIdx);
  assert.ok(cameraEffect.indexOf('stream = acquired;') > guardIdx);
  assert.ok(cameraEffect.indexOf('loopRef.current = setInterval(') > guardIdx);
});

test('C: cleanup marks cancelled first, then clears the interval, then stops tracks, and is safe if initialization only partially completed', () => {
  const cleanupStart = cameraEffect.indexOf('return () => {', cameraEffect.indexOf('start();'));
  assert.ok(cleanupStart >= 0);
  const cleanup = cameraEffect.slice(cleanupStart, cameraEffect.indexOf('};', cleanupStart));
  const cancelIdx = cleanup.indexOf('cancelled = true;');
  const clearIntervalIdx = cleanup.indexOf('clearInterval(loopRef.current)');
  const stopTracksIdx = cleanup.indexOf('stream.getTracks().forEach(t => t.stop())');
  assert.ok(cancelIdx >= 0 && clearIntervalIdx > cancelIdx, 'cancelled must be set before clearing the interval');
  assert.ok(stopTracksIdx > clearIntervalIdx, 'tracks must be stopped after the interval is cleared');
  // Idempotent / partial-completion safe: every teardown step is
  // guarded by an `if`, so a cleanup firing when getUserMedia never
  // resolved (loopRef.current and stream both still unset) is a no-op
  // rather than a throw.
  assert.ok(/if \(loopRef\.current\)/.test(cleanup));
  assert.ok(/if \(stream\)/.test(cleanup));
});

test('cleanup detaches the stale video reference where still present', () => {
  const cleanupStart = cameraEffect.indexOf('return () => {', cameraEffect.indexOf('start();'));
  const cleanup = cameraEffect.slice(cleanupStart, cameraEffect.indexOf('};', cleanupStart));
  assert.ok(cleanup.includes('if (videoRef.current) videoRef.current.srcObject = null;'));
});

// ------------------------------------------------------------
// D — camera track ended -> distinct error state, never reusing
// stageSearching/stageLost.
// ------------------------------------------------------------
test('D: an unexpected track "ended" event transitions to a distinct camera-stopped state, not stageSearching/stageLost', () => {
  assert.ok(cameraEffect.includes("stream.getVideoTracks().forEach(track => { track.onended = handleTrackEnded; });"));
  const handlerStart = cameraEffect.indexOf('const handleTrackEnded = () => {');
  const handlerEnd = cameraEffect.indexOf('};', handlerStart);
  const handler = cameraEffect.slice(handlerStart, handlerEnd);
  assert.ok(handler.includes("setStageKey('stageCameraStopped')"));
  assert.ok(handler.includes("setPhase('cameraStopped')"));
  assert.ok(!handler.includes("'stageSearching'") && !handler.includes("'stageLost'"));
  // Guards against firing from our own cleanup's track.stop() calls —
  // the cancellation check must be the first statement in the handler
  // body, before any state is touched.
  const body = handler.slice(handler.indexOf('=> {') + 4).trim();
  assert.ok(body.startsWith('if (cancelled) return;'));
});

test('D: stageCameraStopped/hintRestartScan RU+EN text matches the specified message and is distinct from stageSearching/stageLost', () => {
  assert.deepStrictEqual(STRINGS.stageCameraStopped, { ru: 'Камера остановлена', en: 'Camera stopped' });
  assert.deepStrictEqual(STRINGS.hintRestartScan, { ru: 'Попробуйте запустить сканирование снова.', en: 'Please start the scan again.' });
  // The pill (stageKey) + the hint paragraph directly below it, read
  // together, reproduce the exact requested sentence pair.
  assert.strictEqual(`${STRINGS.stageCameraStopped.ru}. ${STRINGS.hintRestartScan.ru}`, 'Камера остановлена. Попробуйте запустить сканирование снова.');
  assert.strictEqual(`${STRINGS.stageCameraStopped.en}. ${STRINGS.hintRestartScan.en}`, 'Camera stopped. Please start the scan again.');
  assert.notStrictEqual(STRINGS.stageCameraStopped.ru, STRINGS.stageSearching.ru);
  assert.notStrictEqual(STRINGS.stageCameraStopped.ru, STRINGS.stageLost.ru);
});

// ------------------------------------------------------------
// E + F — detector/tick exception -> distinct error state, loop
// stopped, no repeated throw/log per frame.
// ------------------------------------------------------------
const tickCatchStart = liveScanSource.indexOf('        } catch (e) {\n          // LIFECYCLE FIX — a genuine processing/detector failure');
const tickCatchEnd = liveScanSource.indexOf('        }\n      };', tickCatchStart) + '        }\n      };'.length;
assert.ok(tickCatchStart >= 0, 'tick pipeline catch block must be structurally extractable');
const tickCatch = liveScanSource.slice(tickCatchStart, tickCatchEnd);

test('E: a thrown detector/pipeline error transitions to a distinct, user-visible scan-error state', () => {
  assert.ok(tickCatch.includes("setStageKey('stageScanError')"));
  assert.ok(tickCatch.includes("setPhase('error')"));
  assert.ok(tickCatch.includes("setHintKey('hintRestartScan')"));
  assert.ok(!tickCatch.includes("'stageSearching'"));
  assert.deepStrictEqual(STRINGS.stageScanError, { ru: 'Ошибка сканирования', en: 'Scan error' });
});

test('F: the processing loop is stopped in the catch block, so a fatal error cannot repeat/spam every frame', () => {
  assert.ok(tickCatch.includes('if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }'));
  assert.ok(tickCatch.includes('doneRef.current = true;'));
});

test('no technical error object/stack is interpolated into any user-facing string', () => {
  // console.error(e) is fine (devtools-only); the object itself must
  // never reach a setStageKey/setHintKey/setPhase call.
  assert.ok(!/setStageKey\([^)]*\be\b[^)]*\)/.test(tickCatch));
  assert.ok(!/setHintKey\([^)]*\be\b[^)]*\)/.test(tickCatch));
});

// ------------------------------------------------------------
// G — Back stays actionable in every state.
// ------------------------------------------------------------
test('G: BackButton is rendered unconditionally in LiveScanScreen, independent of stageKey/phase', () => {
  const backButtonCount = (liveScanSource.match(/<BackButton onBack={onBack}/g) || []).length;
  assert.strictEqual(backButtonCount, 1);
  const idx = liveScanSource.indexOf('<BackButton onBack={onBack}');
  const before = liveScanSource.slice(Math.max(0, idx - 400), idx);
  // Not wrapped in a phase/stageKey-gated conditional immediately
  // before it in the header markup.
  assert.ok(!/phase\s*===|stageKey\s*===|phase\s*!==|stageKey\s*!==/.test(before.slice(-120)));
});

test('G: onBack is the plain, state-independent App-level handler — never conditioned on scan phase', () => {
  assert.ok(src.includes("{screen === 'scan' && <LiveScanScreen onComplete={handleComplete} onBack={() => setScreen('home')} modelsLoaded={modelsLoaded} onSetLang={setLang} />}"));
});

// ------------------------------------------------------------
// H + I — camera constraint and dimension-handling isolation.
// ------------------------------------------------------------
test('H: the 1280x720 preferred (ideal) constraints are unchanged', () => {
  assert.ok(cameraEffect.includes('const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });'));
});

test('I: downstream analysis still reads the actual delivered video.videoWidth/videoHeight, never a hardcoded 1280/720', () => {
  assert.ok(liveScanSource.includes('const scale = Math.min(1, 640 / video.videoWidth);'));
  assert.ok(liveScanSource.includes('canvas.width = Math.max(1, Math.round(video.videoWidth * scale));'));
  assert.ok(liveScanSource.includes('canvas.height = Math.max(1, Math.round(video.videoHeight * scale));'));
  assert.ok(!/canvas\.width\s*=\s*1280/.test(liveScanSource));
  assert.ok(!/canvas\.height\s*=\s*720/.test(liveScanSource));
});

// ------------------------------------------------------------
// J — NaturalLashScanScreen untouched by this phase.
// ------------------------------------------------------------
test('J: NaturalLashScanScreen source has zero diff against committed HEAD', () => {
  const diff = execSync('git diff -- lash-scan-core.js', { cwd: root }).toString();
  assert.strictEqual(diff.trim(), '', 'lash-scan-core.js must be untouched');
  // NaturalLashScanScreen itself lives in index.html, which the fix
  // above legitimately modifies elsewhere — so pin its own camera
  // effect to the exact pre-fix shape instead of a whole-file diff.
  assert.ok(naturalLashSource.includes(
    "      useEffect(() => {\n        let stream;\n        const start = async () => {\n          try {\n            const cam = await acquireCameraStream();\n            stream = cam.stream;\n            cameraInfoRef.current = cam;\n            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }\n          } catch (e) { setHintKey('natLashNoEyeHint'); return; }\n          loopRef.current = setInterval(() => tickImplRef.current(), 220);\n        };\n        start();\n        return () => { if (loopRef.current) clearInterval(loopRef.current); if (stream) stream.getTracks().forEach(t => t.stop()); };\n      }, []);"
  ), 'NaturalLashScanScreen camera-init effect must remain byte-for-byte unchanged');
});

test('J: none of the new LiveScanScreen lifecycle machinery was copied into NaturalLashScanScreen', () => {
  for (const marker of ['let cancelled = false;', 'handleTrackEnded', 'stageCameraStopped', 'stageScanError', 'hintRestartScan']) {
    assert.ok(!naturalLashSource.includes(marker), `NaturalLashScanScreen must not contain "${marker}"`);
  }
});

// ------------------------------------------------------------
// K — Lash Map / LEFT-RIGHT mirroring untouched.
// ------------------------------------------------------------
test('K: Lash Map LEFT/RIGHT mirror formula is unchanged by this lifecycle fix', () => {
  assert.ok(src.includes("xAt=t=>55+(side==='right'?1-t:t)*290"));
});

// ------------------------------------------------------------
// L — production-system isolation (recommendations, catalog, face
// shape, iris, Client Cards, ProfessionalLashLibrary).
// ------------------------------------------------------------
test('L: unrelated production systems have zero diff against committed HEAD', () => {
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js', 'client-store.js', 'client-data-consent.js', 'lash-design-domain.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('L: DESIGN_CATALOG source is unchanged', () => {
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalogSource = src.slice(catalogStart, catalogEnd);
  const digest = require('node:crypto').createHash('sha256').update(catalogSource).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});
