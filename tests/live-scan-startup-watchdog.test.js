const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Source-guard companion to tests/e2e/live-scan-startup-watchdog.spec.js
// (which proves the behavior in a real browser). Same string-slicing
// technique as live-scan-lifecycle.test.js.
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('      useEffect(() => {\n        let stream;');
const end = src.indexOf('}, [facingMode, cameraRetryToken]);', start);
assert.ok(start >= 0 && end > start, 'camera-init effect must be extractable');
const effect = src.slice(start, end);

test('watchdog is armed once per effect run with a 12s default and a test-only override', () => {
  assert.strictEqual((effect.match(/setTimeout\(/g) || []).length, 1);
  assert.ok(effect.includes('window.__LIVE_SCAN_CAMERA_WATCHDOG_MS || 12000'));
});

test('watchdog only fires when the scan loop has not started AND video has real dimensions is false', () => {
  assert.ok(effect.includes('if (loopRef.current && v && v.videoWidth > 0 && v.videoHeight > 0) return;'));
  assert.ok(effect.includes('if (cancelled || cameraFailed) return;'));
});

test('on timeout: cancelled flips first, loop/stream/srcObject are released, existing stageNoCamera UI is reused', () => {
  const body = effect.slice(effect.indexOf('const cameraWatchdog = setTimeout'));
  const order = ['cancelled = true;', 'clearInterval(loopRef.current)', 'stream.getTracks().forEach(t => t.stop())', 'v.srcObject = null', 'showCameraError(false);'].map(k => body.indexOf(k));
  assert.ok(order.every(i => i >= 0), 'all steps present');
  assert.deepStrictEqual([...order].sort((a, b) => a - b), order, 'steps in the required order');
});

test('timeout analytics reuses the existing schema-valid reason_code', () => {
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');
  assert.ok(analytics.includes("v === 'permission_denied' || v === 'unavailable'"));
  assert.strictEqual((effect.match(/Analytics\.track\('camera_failed'/g) || []).length, 1, 'exactly one camera_failed call site, shared by rejection + watchdog');
  assert.ok(effect.includes("reason_code: denied ? 'permission_denied' : 'unavailable'"));
});

test('rejection path cancels the watchdog (no duplicate camera_failed) and keeps NotAllowedError handling', () => {
  assert.ok(effect.includes('cameraFailed = true; clearTimeout(cameraWatchdog);'));
  assert.ok(effect.includes("e && e.name === 'NotAllowedError'"));
  assert.ok(effect.includes('showCameraError(deniedByOS);'));
});

test('cleanup clears the watchdog; late getUserMedia/play() are still guarded by cancelled', () => {
  const cleanup = effect.slice(effect.lastIndexOf('return () => {'));
  assert.ok(cleanup.includes('clearTimeout(cameraWatchdog);'));
  assert.ok(effect.includes('if (cancelled) { acquired.getTracks().forEach(t => t.stop()); return; }'));
  const play = effect.indexOf('await videoRef.current.play();');
  assert.ok(effect.indexOf('if (cancelled) return;', play) > play);
});

test('presentation untouched: video stays an opacity:0 decode source, constraints unchanged', () => {
  assert.ok(src.includes("style={{ opacity: 0, pointerEvents: 'none' }} playsInline muted"));
  assert.ok(effect.includes('{ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }'));
});
