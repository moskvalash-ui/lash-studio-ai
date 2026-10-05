'use strict';
// ============================================================
// LIVE SCAN STARTUP WATCHDOG. Real production LiveScanScreen/DOM; only
// navigator.mediaDevices.getUserMedia (and, for the play() case,
// HTMLMediaElement.prototype.play) is controlled. The 12s production
// deadline is shortened through window.__LIVE_SCAN_CAMERA_WATCHDOG_MS,
// the explicit test-only override the effect itself reads.
// ============================================================
const { test, expect } = require('@playwright/test');
const WD = 1500;

// modes[i] controls the i-th getUserMedia call (last one repeats):
//   ok        resolves a stream with a real frame
//   pending   never resolves until window.__gum.release(i) is called
// zeroDims forces videoWidth/videoHeight to 0 (a stream whose first frame never decodes;
// Chromium's captureStream always emits an initial frame, so it is simulated at the getter).
async function install(page, { modes, playPending = false, zeroDims = false }) {
  await page.addInitScript(({ modes, playPending, zeroDims, WD }) => {
    window.__LIVE_SCAN_CAMERA_WATCHDOG_MS = WD;
    const gum = window.__gum = { calls: 0, streams: [], held: [], release(i) { gum.held[i](); } };
    const make = (frame) => {
      const c = document.createElement('canvas'); c.width = 480; c.height = 640;
      const x = c.getContext('2d'); x.fillStyle = 'gray'; x.fillRect(0, 0, 480, 640);
      const s = c.captureStream(0);
      if (frame) s.getVideoTracks()[0].requestFrame();
      gum.streams.push(s);
      return s;
    };
    navigator.mediaDevices.getUserMedia = () => {
      const i = gum.calls++;
      const mode = modes[Math.min(i, modes.length - 1)];
      if (mode === 'pending') return new Promise(res => { gum.held[i] = () => res(make(true)); });
      return Promise.resolve(make(true));
    };
    if (zeroDims) {
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get() { return 0; }, configurable: true });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get() { return 0; }, configurable: true });
    }
    if (playPending) {
      const real = HTMLMediaElement.prototype.play;
      window.__playResolvers = [];
      HTMLMediaElement.prototype.play = function () {
        const el = this;
        return new Promise((res, rej) => window.__playResolvers.push(() => real.call(el).then(res, rej)));
      };
    }
  }, { modes, playPending, zeroDims, WD });
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
const retryBtn = page => page.getByRole('button', { name: 'Повторить попытку', exact: true });
const noCamera = page => page.getByText('Нет доступа к камере', { exact: true });
const tracksEnded = page => page.evaluate(() => window.__gum.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')));

test('1. normal camera: no timeout, no error UI after the watchdog window', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['ok'] });
  await openLiveScan(page);
  await page.waitForTimeout(WD + 1500);
  await expect(retryBtn(page)).toHaveCount(0);
  await expect(noCamera(page)).toHaveCount(0);
  expect(await page.evaluate(() => { const v = document.querySelector('video'); return v.videoWidth > 0 && v.videoHeight > 0 && !!v.srcObject; })).toBe(true);
  expect(await page.evaluate(() => window.__gum.calls)).toBe(1);
});

test('2. getUserMedia pending: error + Retry appear after the watchdog', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['pending'] });
  await openLiveScan(page);
  await expect(retryBtn(page)).toHaveCount(0);
  await expect(retryBtn(page)).toBeVisible({ timeout: WD + 20000 });
  await expect(noCamera(page)).toBeVisible();
});

test('3. video.play() pending: error + Retry, stream released, late play() resolution does not revive the session', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['ok'], playPending: true });
  await openLiveScan(page);
  await expect(retryBtn(page)).toBeVisible({ timeout: WD + 20000 });
  expect(await tracksEnded(page)).toBe(true);
  await page.evaluate(() => window.__playResolvers.forEach(r => r()));
  await page.waitForTimeout(800);
  await expect(retryBtn(page)).toBeVisible();
  await expect(noCamera(page)).toBeVisible();
});

test('4. stream attached but zero video dimensions / no first frame: error + Retry', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['ok'], zeroDims: true });
  await openLiveScan(page);
  await expect(retryBtn(page)).toBeVisible({ timeout: WD + 20000 });
  expect(await tracksEnded(page)).toBe(true);
});

test('5. late getUserMedia stream after the timeout is stopped and ignored', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['pending'] });
  await openLiveScan(page);
  await expect(retryBtn(page)).toBeVisible({ timeout: WD + 20000 });
  await page.evaluate(() => window.__gum.release(0));
  await expect.poll(() => page.evaluate(() => window.__gum.streams.length)).toBe(1);
  await expect.poll(() => tracksEnded(page)).toBe(true);
  expect(await page.evaluate(() => !!document.querySelector('video').srcObject)).toBe(false);
  await expect(retryBtn(page)).toBeVisible();
});

test('6. unmount (Back) cancels the timer and releases a live or late stream', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['pending', 'ok'] });
  await openLiveScan(page);
  await page.locator('div.absolute.top-0 button').first().click(); // Back to Home before the deadline
  await expect(page.getByRole('button', { name: 'Начать Live Scan', exact: true })).toBeVisible();
  await page.waitForTimeout(WD + 1000);
  // Timer must not have flipped any state / error UI on the new screen.
  await expect(retryBtn(page)).toHaveCount(0);
  await expect(noCamera(page)).toHaveCount(0);
  await page.evaluate(() => window.__gum.release(0)); // late stream after unmount
  await expect.poll(() => page.evaluate(() => window.__gum.streams.length)).toBe(1);
  await expect.poll(() => tracksEnded(page)).toBe(true);
  // A live (ok) session is also released on Back.
  await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__gum.streams.length)).toBe(2);
  await page.locator('div.absolute.top-0 button').first().click();
  await expect.poll(() => tracksEnded(page)).toBe(true);
});

test('7. Retry after a watchdog timeout starts a clean, working session', async ({ page }) => {
  test.setTimeout(60000);
  await install(page, { modes: ['pending', 'ok'] });
  await openLiveScan(page);
  await expect(retryBtn(page)).toBeVisible({ timeout: WD + 20000 });
  await retryBtn(page).click();
  await page.waitForFunction(() => window.__gum.calls === 2, null, { timeout: 10000 });
  await expect(retryBtn(page)).toHaveCount(0);
  await page.waitForTimeout(WD + 1500); // the fresh session's own watchdog must stay quiet
  await expect(retryBtn(page)).toHaveCount(0);
  await expect(noCamera(page)).toHaveCount(0);
  expect(await page.evaluate(() => { const v = document.querySelector('video'); return v.videoWidth > 0 && v.srcObject === window.__gum.streams[0]; })).toBe(true);
});
