'use strict';
// ============================================================
// WEBKIT-SAFE VIDEO PRESENTATION — real-device regression coverage.
// ------------------------------------------------------------
// Real-iPhone diagnostic evidence (?cameraLayoutDebug=1) proved the
// decoded video frame and DOM geometry were both healthy while the
// user still saw a broken narrow-strip preview, isolating the bug to
// a CSS-transformed, hardware-composited <video> layer on iOS/Yandex/
// WebKit. The fix: LiveScanScreen's <video> is now permanently
// invisible (opacity:0, no CSS transform) and the overlay <canvas>
// paints the live picture itself every frame, mirrored via a canvas
// transform instead. This spec proves, against the REAL app (real
// face-api, real overlay draw loop — only getUserMedia is faked with a
// synthetic two-color stream so the mirror direction is verifiable by
// literal pixel sampling):
//   1. the visible preview (the canvas) fills the camera viewport,
//   2. the front camera appears mirrored to the user (canvas pixels),
//   3. the <video> element itself carries no CSS transform and is
//      invisible — nothing on screen depends on it any more,
//   4. a plain production URL never renders the diagnostic panel.
// Processing/detector/overlay-coordinate/constraint invariants are
// covered by the extracted-function unit tests in
// tests/camera-preview.test.js and tests/live-scan-lifecycle.test.js —
// this file is real-browser-only proof of the presentation change.
// ============================================================
const { test, expect } = require('@playwright/test');

test('LiveScan preview fills the viewport and mirrors the front camera via canvas — no dependency on a CSS-transformed <video>', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 640;
      const ctx = canvas.getContext('2d');
      // Raw (unmirrored) stream: BLUE on the left half, GREEN on the
      // right half. A correctly mirrored preview must show GREEN on
      // the left and BLUE on the right.
      const draw = () => {
        ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 0, 240, 640);
        ctx.fillStyle = '#00ff00'; ctx.fillRect(240, 0, 240, 640);
      };
      draw(); setInterval(draw, 100);
      return canvas.captureStream(10);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Отказаться', exact: true }).click({ timeout: 30000 });

  // A — plain production URL: no diagnostic panel exists at all.
  await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  // Give the overlay rAF loop a few frames to paint the video picture.
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => {
    const container = document.querySelector('[data-live-scan-camera]');
    const video = container.querySelector('video');
    const canvas = container.querySelector('canvas');
    const videoStyle = getComputedStyle(video);
    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const leftPixel = ctx.getImageData(Math.round(w * 0.1), Math.round(h / 2), 1, 1).data;
    const rightPixel = ctx.getImageData(Math.round(w * 0.9), Math.round(h / 2), 1, 1).data;
    return {
      videoOpacity: videoStyle.opacity, videoTransform: videoStyle.transform,
      containerRect: { width: containerRect.width, height: containerRect.height },
      canvasRect: { width: canvasRect.width, height: canvasRect.height },
      leftPixel: [leftPixel[0], leftPixel[1], leftPixel[2]],
      rightPixel: [rightPixel[0], rightPixel[1], rightPixel[2]],
    };
  });

  // B — the <video> element itself is invisible and carries no mirror
  // (or any) CSS transform any more — nothing on screen depends on a
  // transformed hardware video layer.
  expect(state.videoOpacity).toBe('0');
  expect(state.videoTransform === 'none' || state.videoTransform === '').toBe(true);

  // C — the visible preview (the canvas) fills the camera viewport,
  // matching the container exactly.
  expect(Math.round(state.canvasRect.width)).toBe(Math.round(state.containerRect.width));
  expect(Math.round(state.canvasRect.height)).toBe(Math.round(state.containerRect.height));

  // D — front camera appears mirrored to the user: the raw stream was
  // BLUE-left/GREEN-right; the painted canvas must show GREEN-left/
  // BLUE-right.
  expect(state.leftPixel[1]).toBeGreaterThan(state.leftPixel[2]); // left reads green-dominant
  expect(state.rightPixel[2]).toBeGreaterThan(state.rightPixel[1]); // right reads blue-dominant
});
