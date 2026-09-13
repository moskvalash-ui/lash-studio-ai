'use strict';
const { test, expect } = require('@playwright/test');

test('URL-only diagnostic observes first camera opening without changing preview or constraints', async ({ browser }) => {
  test.setTimeout(120000);
  const results = [];
  for (const flagged of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__constraints = [];
      Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
      navigator.mediaDevices.getUserMedia = async constraints => {
        window.__constraints.push(constraints);
        const canvas = document.createElement('canvas');
        canvas.width = 480; canvas.height = 640;
        const ctx = canvas.getContext('2d');
        const draw = () => { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 240, 640); ctx.fillStyle = '#0000ff'; ctx.fillRect(240, 0, 240, 640); };
        draw(); setInterval(draw, 100);
        return canvas.captureStream(10);
      };
    });
    await page.goto('/' + (flagged ? '?cameraLayoutDebug=1' : ''));
    await page.getByRole('button', { name: 'Отказаться', exact: true }).click({ timeout: 30000 });
    await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    if (flagged) {
      await expect(page.locator('[data-camera-layout-debug]')).toBeVisible();
      // Real face-api inference can block the main thread on this older test machine.
      await expect(page.locator('[data-camera-layout-latest]')).toContainText('playing +1500 ms', { timeout: 20000 });
      await page.evaluate(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); });
      await expect(page.locator('[data-camera-layout-latest]')).toContainText('orientationchange');
      await page.getByRole('button', { name: 'COPY JSON', exact: true }).click();
      const data = await page.evaluate(() => JSON.parse(window.__copied));
      for (const event of ['LiveScan mount', 'srcObject assigned', 'loadedmetadata', 'canplay', 'playing', 'playing +100 ms', 'playing +500 ms', 'playing +1500 ms', 'resize', 'orientationchange']) {
        expect(data.snapshots.some(s => s.event === event), event).toBe(true);
      }
      const assigned = data.snapshots.find(s => s.event === 'srcObject assigned');
      expect(assigned.mediaTrackSettings.width).toBe(480);
      expect(assigned.video.paused).toBe(true);
      const last = data.snapshots.at(-1);
      expect(last.video.rect.width).toBe(390);
      expect(last.container.rect).toEqual(last.overlay.rect);
      expect(last.video.videoWidth).toBe(480);
      expect(last.video.computed['object-fit']).toBe('cover');
      expect(Object.keys(last.mediaTrackSettings).every(k => ['width', 'height', 'aspectRatio', 'facingMode', 'frameRate'].includes(k))).toBe(true);
    } else {
      await page.waitForTimeout(1800);
      await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    }
    results.push(await page.evaluate(() => {
      const v = document.querySelector('video'), c = v.parentElement, o = c.querySelector('canvas');
      const style = getComputedStyle(v);
      return { constraints: window.__constraints, style: v.getAttribute('style'), classes: v.className,
        computed: ['width', 'height', 'position', 'object-fit', 'object-position', 'transform'].map(k => style.getPropertyValue(k)),
        rect: v.getBoundingClientRect().toJSON(), container: c.getBoundingClientRect().toJSON(), overlay: o.getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
        persistedFlag: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].some(k => /cameraLayoutDebug/i.test(k)) };
    }));
    await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
    await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    await context.close();
  }
  expect(results[1]).toEqual(results[0]);
  expect(results[0].overflow).toBe(false);
  expect(results[0].persistedFlag).toBe(false);
});
