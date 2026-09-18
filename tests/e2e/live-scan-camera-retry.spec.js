'use strict';
// ============================================================
// LIVE SCAN CAMERA ERROR / RETRY — RELEASE FIX #1.
// ------------------------------------------------------------
// Real production LiveScanScreen, real DOM, nothing mocked except
// navigator.mediaDevices.getUserMedia itself (same established
// technique as tests/e2e/live-scan-cold-start.spec.js) so acquisition
// failure/success can be deterministically controlled without real
// camera hardware.
// ============================================================
const { test, expect } = require('@playwright/test');

// Installs a controllable getUserMedia: the first `rejectCount` calls
// reject with `rejectName`; every call after that resolves with a
// real (canvas-backed) MediaStream, same fake-stream technique as
// live-scan-cold-start.spec.js. Tracks call/stream counts on
// window.__gum for assertions.
async function installGetUserMedia(page, { rejectName, rejectCount }) {
  await page.addInitScript(({ rejectName, rejectCount }) => {
    window.__gum = { calls: 0, streamsCreated: 0, lastStream: null };
    navigator.mediaDevices.getUserMedia = async () => {
      window.__gum.calls++;
      if (window.__gum.calls <= rejectCount) {
        throw new DOMException('simulated failure', rejectName);
      }
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 640;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'gray'; ctx.fillRect(0, 0, 480, 640);
      const stream = canvas.captureStream(0);
      stream.getVideoTracks()[0].requestFrame();
      window.__gum.streamsCreated++;
      window.__gum.lastStream = stream;
      return stream;
    };
  }, { rejectName, rejectCount });
}

async function dismissConsent(page) {
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
}

async function openLiveScan(page, lang) {
  await dismissConsent(page);
  if (lang === 'en') {
    await page.getByRole('button', { name: 'EN', exact: true }).click();
  }
  const label = lang === 'en' ? 'Start Live Scan' : 'Начать Live Scan';
  const liveBtn = page.getByRole('button', { name: label, exact: true });
  await expect(liveBtn).toBeEnabled({ timeout: 20000 });
  await liveBtn.click();
}

test('A. permission denial (NotAllowedError) shows camera-specific guidance, never the generic holdSteady text', async ({ page }) => {
  test.setTimeout(60000);
  await installGetUserMedia(page, { rejectName: 'NotAllowedError', rejectCount: 999 });
  await page.goto('/index.html');
  await openLiveScan(page, 'ru');
  await expect(page.getByText('Нет доступа к камере', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Нет доступа к камере. Разрешите доступ в настройках браузера и повторите попытку.', { exact: true })).toBeVisible();
  await expect(page.getByText('Держите лицо неподвижно в кадре', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить попытку', exact: true })).toBeVisible();
});

test('B. generic acquisition failure (NotFoundError) shows the generic camera-unavailable guidance, not the permission-denied text', async ({ page }) => {
  test.setTimeout(60000);
  await installGetUserMedia(page, { rejectName: 'NotFoundError', rejectCount: 999 });
  await page.goto('/index.html');
  await openLiveScan(page, 'ru');
  await expect(page.getByText('Нет доступа к камере', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Не удалось подключиться к камере. Проверьте, что она не используется другим приложением, и повторите попытку.', { exact: true })).toBeVisible();
  await expect(page.getByText('Разрешите доступ в настройках браузера', { exact: false })).not.toBeVisible();
  await expect(page.getByText('Держите лицо неподвижно в кадре', { exact: true })).not.toBeVisible();
});

test('C/D. Retry re-attempts acquisition and, on success, transitions back into the normal Live Scan camera state', async ({ page }) => {
  test.setTimeout(60000);
  await installGetUserMedia(page, { rejectName: 'NotAllowedError', rejectCount: 1 });
  await page.goto('/index.html');
  await openLiveScan(page, 'ru');
  const retryBtn = page.getByRole('button', { name: 'Повторить попытку', exact: true });
  await expect(retryBtn).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => window.__gum.calls)).toBe(1);

  await retryBtn.click();

  // C: a second real acquisition attempt happened.
  await page.waitForFunction(() => window.__gum.calls >= 2, null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__gum.calls)).toBe(2);

  // D: successful retry leaves the no-camera state entirely — Retry
  // button and both camera-error messages are gone, normal scanning
  // UI (stage text no longer "Нет доступа к камере") is back.
  await expect(retryBtn).not.toBeVisible();
  await expect(page.getByText('Нет доступа к камере', { exact: true })).not.toBeVisible();
  await expect(page.locator('video')).toHaveCount(1);
});

test('E. retry does not create duplicate active streams', async ({ page }) => {
  test.setTimeout(60000);
  await installGetUserMedia(page, { rejectName: 'NotReadableError', rejectCount: 2 });
  await page.goto('/index.html');
  await openLiveScan(page, 'ru');
  const retryBtn = page.getByRole('button', { name: 'Повторить попытку', exact: true });
  await expect(retryBtn).toBeVisible({ timeout: 15000 });
  await retryBtn.click();
  await expect(retryBtn).toBeVisible({ timeout: 15000 }); // still failing (2nd rejected call)
  await retryBtn.click();
  await page.waitForFunction(() => window.__gum.calls >= 3, null, { timeout: 15000 });

  const gum = await page.evaluate(() => ({ calls: window.__gum.calls, streamsCreated: window.__gum.streamsCreated }));
  expect(gum.calls).toBe(3); // 2 rejected + 1 succeeded
  expect(gum.streamsCreated).toBe(1); // exactly one real stream ever created

  const videoIsUsingTheOneStream = await page.evaluate(() => document.querySelector('video').srcObject === window.__gum.lastStream);
  expect(videoIsUsingTheOneStream).toBe(true);
  await expect(page.locator('video')).toHaveCount(1);
});

test('F. EN localization: permission-denied guidance and Retry label render in English', async ({ page }) => {
  test.setTimeout(60000);
  await installGetUserMedia(page, { rejectName: 'NotAllowedError', rejectCount: 999 });
  await page.goto('/index.html');
  await openLiveScan(page, 'en');
  await expect(page.getByText('Camera unavailable', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Camera access is required. Please allow camera access and try again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry Camera', exact: true })).toBeVisible();
  await expect(page.getByText('Hold your face steady in frame', { exact: true })).not.toBeVisible();
});
