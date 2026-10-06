const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Source-guard companion to tests/e2e/live-scan-paint-loop-resilience.spec.js.
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const liveStart = src.indexOf('    function LiveScanScreen(');
const liveEnd = src.indexOf('\n    const NAT_LASH_HINT_KEYS', liveStart);
const live = src.slice(liveStart, liveEnd);
const loopStart = live.indexOf('        const draw = () => {', live.indexOf('Cinematic overlay redraw loop'));
const loopEnd = live.indexOf("return () => { if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current); };", loopStart);
assert.ok(loopStart > 0 && loopEnd > loopStart, 'Live Scan paint loop must be extractable');
const loop = live.slice(loopStart, loopEnd);

test('draw itself never schedules the next frame (scheduling lives only in the guarded paintLoop wrapper)', () => {
  const body = loop.slice(0, loop.indexOf('const paintLoop = () => {'));
  assert.ok(!body.includes('requestAnimationFrame'), 'an early return/throw inside draw must not decide whether the loop survives');
});

test('the wrapper catches any draw exception and ALWAYS schedules the next frame', () => {
  const wrapper = loop.slice(loop.indexOf('const paintLoop = () => {'));
  const tryIdx = wrapper.indexOf('try { draw(); }'), catchIdx = wrapper.indexOf('catch (e)'), rafIdx = wrapper.indexOf('overlayRafRef.current = requestAnimationFrame(paintLoop);');
  assert.ok(tryIdx >= 0 && catchIdx > tryIdx && rafIdx > catchIdx, 'try/catch first, unconditional rAF scheduling after it');
  assert.strictEqual((wrapper.match(/requestAnimationFrame\(paintLoop\)/g) || []).length, 2, 'one in the loop, one to start it');
});

test('a failing video paint is isolated so the overlay still runs, and errors surface through the debug-gated lashDiagLog only', () => {
  assert.ok(loop.includes('try { drawVideoCover(ctx, previewVideo, w, h, mirrored); }'));
  assert.ok(!/console\.(log|warn|error)/.test(loop), 'no stray console output in the paint loop');
  assert.ok(loop.includes("lashDiagLog({ type: 'preview-draw-error'"));
});

test('presentation untouched: opacity:0 video + canvas paint, same drawVideoCover contract', () => {
  assert.ok(live.includes("style={{ opacity: 0, pointerEvents: 'none' }} playsInline muted"));
  assert.ok(src.includes('function drawVideoCover(ctx, video, dispW, dispH, mirrored) {'));
});
