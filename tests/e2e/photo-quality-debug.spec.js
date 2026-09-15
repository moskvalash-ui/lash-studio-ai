'use strict';
// ============================================================
// PHOTO QUALITY DEBUG — ?photoQualityDebug=1 real-browser proof.
// ------------------------------------------------------------
// Drives the REAL production PhotoAnalysisScreen end to end (real
// face-api detection, real assessFrameQuality, real UI) — nothing
// mocked except navigator.clipboard.writeText (same established
// technique as camera-layout-debug.spec.js) so the COPY DEBUG JSON
// button's output can be read back and inspected.
//
// The "no face detected" scenario uses a plain solid-color PNG
// generated at test time in the browser itself (canvas -> toBlob ->
// base64), never a real or fixture photo of anyone — it deterministically
// contains no face, so detectSingleFace reliably returns no detection.
// The "valid photo" scenario reuses the same real, already-reviewed
// fixture as photo-analysis.spec.js/iris-color.spec.js.
// ============================================================
const path = require('path');
const { test, expect } = require('@playwright/test');

const VALID_FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function dismissConsent(page) {
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function makeBlankFaceless(page) {
  const base64 = await page.evaluate(() => new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, 400, 500);
    canvas.toBlob(blob => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    }, 'image/png');
  }));
  return { name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('1. plain URL: no debug panel renders, even on a rejected (no-face) photo', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/index.html');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const blank = await makeBlankFaceless(page);
  await page.locator('input[type=file]').setInputFiles(blank);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});

test('2. ?photoQualityDebug=1: panel renders after a real no-face rejection, shows the correct primary reason, and the copied JSON contains no forbidden data', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
  });
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const blank = await makeBlankFaceless(page);
  await page.locator('input[type=file]').setInputFiles(blank);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 20_000 });

  const panel = page.locator('[data-photo-quality-debug]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('PRIMARY REJECTION REASON:');
  await expect(panel).toContainText('no_detection');
  await expect(panel).toContainText('failureType:');

  await page.getByRole('button', { name: 'COPY DEBUG JSON', exact: true }).click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toBeTruthy();
  const data = JSON.parse(copied);
  expect(data.detectorPresent).toBe(false);
  expect(data.failureType).toBe('no_detection');
  expect(data.failureBeforeQualityCheck).toBe(true);
  expect(data.primaryReason).toBe('no_detection');
  // No forbidden data anywhere in the actually-copied payload.
  for (const forbidden of ['data:image', 'base64', 'landmarks', 'toDataURL', 'originalImage']) {
    expect(copied).not.toContain(forbidden);
  }
});

test('3. valid photo still behaves exactly as before with debug OFF: reaches the real post-analysis ReviewScreen', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/index.html');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(VALID_FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});

test('4. valid photo still behaves exactly as before with debug ON: reaches the real post-analysis ReviewScreen, and the pass is logged via the debug-shadow console line (screen unmounts before a panel could render)', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(VALID_FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  expect(consoleMessages.some(m => m.includes('[PhotoQualityDebug]'))).toBe(true);
});

// Darkens the SAME already-reviewed happy-path-face.png fixture (real
// face, real geometry) at test-run time by uniformly scaling down every
// pixel's RGB — this deliberately keeps the face structurally detectable
// by the real TinyFaceDetector while pushing the real sampleBrightness()
// reading at the eyes below assessFrameQuality's too_dark threshold
// (<45). This is NOT the no-face/!det path already covered by test 2 —
// it exercises the genuinely-detected-face-but-fails-assessFrameQuality
// (!quality.ok) branch, which none of tests 1-4 above ever reached.
async function makeDarkenedRealFace(page) {
  const base64 = await page.evaluate(fixtureUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const factor = 0.14;
      for (let i = 0; i < d.length; i += 4) {
        d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor;
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = fixtureUrl;
  }), '/tests/e2e/fixtures/happy-path-face.png');
  return { name: 'darkened-real-face.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('5. plain URL: a real detected face that fails assessFrameQuality (too_dark) shows the normal rejection and zero debug UI', async ({ page }) => {
  test.setTimeout(30_000);
  // console.log('[Photo] quality', quality) logs a live object -- msg.text()
  // only returns Chromium's short object PREVIEW (e.g. "{ok: false,
  // reasons: Array(1)}"), never the real reasons string, so proving the
  // real reason requires reading the actual logged argument's value.
  let qualityArg = null;
  page.on('console', msg => {
    if (msg.text().startsWith('[Photo] quality') && msg.args().length > 1) {
      qualityArg = msg.args()[1].jsonValue();
    }
  });
  await page.goto('/index.html');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const darkened = await makeDarkenedRealFace(page);
  await page.locator('input[type=file]').setInputFiles(darkened);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 20_000 });
  // Prove this really is the !quality.ok branch (a real detected face),
  // not the !det/no-face branch already covered by tests 1-2.
  expect(qualityArg).not.toBeNull();
  const quality = await qualityArg;
  expect(quality.ok).toBe(false);
  expect(quality.reasons).toContain('too_dark');
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});

test('6. ?photoQualityDebug=1: panel is VISIBLE (not just present) on the real quality-rejection screen, directly beneath the rejection message, with a working COPY DEBUG JSON reflecting the real too_dark rejection', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
  });
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const darkened = await makeDarkenedRealFace(page);
  await page.locator('input[type=file]').setInputFiles(darkened);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 20_000 });

  const panel = page.locator('[data-photo-quality-debug]');
  // toBeVisible() alone cannot distinguish "on-screen" from "clipped by
  // an ancestor overflow:hidden with no scroll" (see the audit report) —
  // so this test additionally asserts the panel's bounding box is
  // actually within the viewport's vertical bounds, which is the exact
  // real-device symptom being regression-tested here.
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

  await expect(panel).toContainText('PRIMARY REJECTION REASON:');
  await expect(panel).toContainText('too_dark');
  await expect(panel).toContainText('failureType:');
  await expect(panel).toContainText('quality_rejection');

  const copyBtn = page.getByRole('button', { name: 'COPY DEBUG JSON', exact: true });
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toBeTruthy();
  const data = JSON.parse(copied);
  expect(data.detectorPresent).toBe(true);
  expect(data.failureType).toBe('quality_rejection');
  expect(data.failureBeforeQualityCheck).toBe(false);
  expect(data.qualityOk).toBe(false);
  expect(data.allReasons).toContain('too_dark');
  expect(data.primaryReason).toBe('too_dark');
  for (const forbidden of ['data:image', 'base64', 'landmarks', 'toDataURL', 'originalImage']) {
    expect(copied).not.toContain(forbidden);
  }
});
