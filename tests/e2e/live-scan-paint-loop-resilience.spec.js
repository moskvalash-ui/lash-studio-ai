'use strict';
// ============================================================
// LIVE SCAN PAINT-LOOP LIVENESS. The overlay canvas is the only
// user-visible camera surface (the <video> is opacity:0), and its rAF
// loop used to schedule the next frame only after a fully successful
// draw -- one exception ended painting forever while the stream, video
// dimensions and startup watchdog all stayed "healthy" (black screen).
// Real app/DOM; only getUserMedia is faked, and the overlay canvas's own
// 2D context methods are made to throw for the first frames.
// ============================================================
const { test, expect } = require('@playwright/test');

async function install(page, { throwOn, count }) {
  await page.addInitScript(({ throwOn, count }) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas'); c.width = 480; c.height = 640;
      const x = c.getContext('2d'); x.fillStyle = 'rgb(200,120,40)'; x.fillRect(0, 0, 480, 640);
      const s = c.captureStream(0); s.getVideoTracks()[0].requestFrame();
      return s;
    };
    window.__inj = { thrown: 0, passedAfter: 0 };
    if (!throwOn) return;
    const proto = CanvasRenderingContext2D.prototype, real = proto[throwOn];
    proto[throwOn] = function (...a) {
      const live = this.canvas && this.canvas.closest && this.canvas.closest('[data-live-scan-camera]');
      if (live) {
        if (window.__inj.thrown < count) { window.__inj.thrown++; throw new DOMException('simulated transient failure', 'InvalidStateError'); }
        window.__inj.passedAfter++;
      }
      return real.apply(this, a);
    };
  }, { throwOn, count });
}

async function openLiveScan(page) {
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const live = page.getByRole('button', { name: 'Начать Live Scan', exact: true });
  await expect(live).toBeEnabled({ timeout: 20000 });
  await live.click();
}
const lit = page => page.evaluate(() => {
  const c = document.querySelector('[data-live-scan-camera] canvas');
  if (!c || !c.width) return 0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < d.length; i += 4 * 211) if (d[i] + d[i + 1] + d[i + 2] > 120 && d[i + 3] > 0) n++;
  return n;
});

for (const [name, throwOn] of [['control (no injected failure)', null], ['clearRect throws for the first frames', 'clearRect'], ['setTransform throws for the first frames', 'setTransform']]) {
  test(`paint loop keeps painting the camera image: ${name}`, async ({ page }) => {
    test.setTimeout(90000);
    await install(page, { throwOn, count: 6 });
    await openLiveScan(page);
    await expect.poll(() => lit(page), { timeout: 30000 }).toBeGreaterThan(50);
    if (throwOn) {
      expect(await page.evaluate(() => window.__inj.thrown)).toBe(6);
      // Loop is alive AFTER the failures: contexts calls keep arriving.
      const before = await page.evaluate(() => window.__inj.passedAfter);
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => window.__inj.passedAfter)).toBeGreaterThan(before);
    }
  });
}
