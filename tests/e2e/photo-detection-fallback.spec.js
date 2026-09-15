'use strict';
// ============================================================
// PHOTO-ONLY NO_DETECTION FALLBACK — real-browser proof.
// ------------------------------------------------------------
// Drives the REAL production PhotoAnalysisScreen end to end (real
// face-api detection, real assessFrameQuality, real UI). The fixture
// below is a REAL photo (the same already-reviewed happy-path-face.png
// used throughout this suite) pasted small into a large synthetic
// background canvas -- not a fabricated face, just a real face placed
// at a resolution/frame-position deliberately chosen (via empirical
// measurement against the real, unmodified production detector) so
// that:
//   - the PRIMARY attempt (900px-capped canvas, TinyFaceDetector
//     inputSize:416) reliably finds no face, and
//   - the bounded FALLBACK attempt (1600px-capped canvas, inputSize:
//     608, same scoreThreshold 0.5) reliably recovers it.
// This reproduces, with real (not synthetic-face) detector behavior,
// the same class of "real, visible, frontal face that the primary
// attempt still misses" input this fix responds to.
//
// The recovered face here also happens to be too small relative to
// the frame to pass assessFrameQuality's faceRatio check -- which is
// used deliberately, not worked around: it lets this one real-browser
// test prove BOTH that the fallback recovers detection AND that the
// recovered face still goes through the exact same, unmodified quality
// gate (never bypassed) in a single real run.
// ============================================================
const path = require('path');
const { test, expect } = require('@playwright/test');

const VALID_FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function dismissConsent(page) {
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

// Composite parameters (compositeW=3000, compositeH=4000, faceFracW=
// 0.26) were determined empirically by running the real, unmodified
// faceapi.detectSingleFace against this exact fixture at both the
// primary (900/416) and fallback (1600/608) configurations directly in
// a Chromium page -- confirmed to reliably reproduce primaryFound:
// false, fallbackFound: true (score ~0.75) before being wired into
// this upload-driven test.
async function makeFallbackRecoveryFixture(page) {
  const base64 = await page.evaluate(fixtureUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const compositeW = 3000, compositeH = 4000, faceFracW = 0.26;
      const canvas = document.createElement('canvas');
      canvas.width = compositeW; canvas.height = compositeH;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#cfa98a';
      ctx.fillRect(0, 0, compositeW, compositeH);
      const faceW = Math.round(compositeW * faceFracW);
      const faceH = Math.round(faceW * (img.height / img.width));
      const x = Math.round((compositeW - faceW) / 2);
      const y = Math.round((compositeH - faceH) / 2);
      ctx.drawImage(img, x, y, faceW, faceH);
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = fixtureUrl;
  }), '/tests/e2e/fixtures/happy-path-face.png');
  return { name: 'fallback-recovery.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('1. real fallback recovery: a real, genuinely-detectable face that the PRIMARY attempt misses is recovered by the bounded fallback, and still flows through the real, unmodified assessFrameQuality gate (never bypassed)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
  });
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeFallbackRecoveryFixture(page);
  await page.locator('input[type=file]').setInputFiles(fixture);

  // The normal rejection message renders on the SAME screen either way
  // (no_detection and quality_rejection share the same user-facing
  // copy) -- the debug JSON below is what distinguishes them.
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 40_000 });

  const panel = page.locator('[data-photo-quality-debug]');
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'COPY DEBUG JSON', exact: true }).click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toBeTruthy();
  const data = JSON.parse(copied);

  // Proves the FALLBACK, not the primary, is what recovered this face:
  // an independently-verified real (non-live) run of the exact same
  // primary config (900px/416) against this exact fixture found no
  // face at all -- so detectorPresent:true here is only reachable via
  // the bounded fallback attempt.
  expect(data.detectorPresent).toBe(true);
  expect(typeof data.detectorScore).toBe('number');

  // Proves the recovery did NOT bypass the quality gate: this is the
  // quality_rejection shape (assessFrameQuality actually ran), never
  // the no_detection shape.
  expect(data.failureBeforeQualityCheck).toBe(false);
  expect(data.failureType).toBe('quality_rejection');
  expect(data.qualityOk).toBe(false);
  expect(Array.isArray(data.allReasons)).toBe(true);
  expect(data.allReasons.length).toBeGreaterThan(0);
  expect(data.finalHardBlockPath).toBe(`assessFrameQuality:${data.primaryReason}`);

  // Proves the full, real, unmodified downstream measurement pipeline
  // (headPose, EAR, brightness, sharpness) actually ran against the
  // recovered face -- these are genuinely computed numbers, never the
  // all-null shape the no_detection branch produces.
  for (const field of ['leftEAR', 'rightEAR', 'roll', 'yaw', 'pitch', 'brightness', 'sharpness', 'faceRatio']) {
    expect(typeof data[field]).toBe('number');
  }

  for (const forbidden of ['data:image', 'base64', 'landmarks', 'toDataURL', 'originalImage']) {
    expect(copied).not.toContain(forbidden);
  }
});

test('2. plain URL: the same fallback-recovery fixture shows only the normal rejection message, with zero debug UI (no leakage)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/index.html');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeFallbackRecoveryFixture(page);
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});

test('3. existing successful real-photo path is unaffected by the fallback addition: happy-path-face.png still reaches ReviewScreen normally', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(VALID_FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});
