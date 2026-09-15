'use strict';
// ============================================================
// PHOTO-ONLY QUALITY RECOVERY — real-browser proof.
// ------------------------------------------------------------
// Drives the REAL production PhotoAnalysisScreen end to end (real
// face-api detection, real assessFrameQuality, real UI). The fixture
// below is a REAL photo (the same already-reviewed happy-path-face.png
// fixture used throughout this suite) digitally zoomed/cropped toward
// its own center — never a fabricated face, just a tighter framing of
// the same real face, simulating the "close beauty/lash portrait"
// class of real client photo this fix responds to.
//
// Zoom factors were found empirically by running the real, unmodified
// TinyFaceDetector against this exact fixture at several zoom levels
// directly in Chromium before being wired into this upload-driven
// test:
//   - zoom 2.2  -> score 0.516 (< 0.6, so low_face_confidence),
//                  faceRatio 0.544 (comfortably < 0.78, so NOT
//                  too_close), box NOT edge-touching -> the exact
//                  single-allowlisted-reason, not-clipped class this
//                  fix must recover.
//   - zoom 2.5  -> score 0.536 (low_face_confidence again), but this
//                  time the box genuinely touches the frame edge (real,
//                  not synthetic clipping, confirmed through the actual
//                  upload path, not just an in-memory canvas check) ->
//                  recovery must be DENIED and the hard block preserved.
// (A search for a single real-photo zoom that trips BOTH
// low_face_confidence AND too_close while staying clear of the frame
// edge did not find a clean window on this particular photo's aspect
// ratio — vertical edge-clipping and faceRatio growth are coupled too
// tightly by uniform zoom on this composition. That exact two-reason
// combination is covered directly and rigorously at the unit level in
// tests/photo-quality-recovery.test.js test 4, using a controlled
// synthetic det/quality object — a real photo cannot hit an exact
// threshold combination as precisely as a controlled unit fixture can.
// This e2e file instead proves the single-reason case end-to-end with
// a real detector and real pixels, which is what only a real browser
// run can prove.)
// ============================================================
const path = require('path');
const { test, expect } = require('@playwright/test');

const VALID_FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function dismissConsent(page) {
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function makeZoomedFixture(page, zoom) {
  const base64 = await page.evaluate(({ fixtureUrl, zoom }) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cropW = img.width / zoom, cropH = img.height / zoom;
      const cx = (img.width - cropW) / 2, cy = (img.height - cropH) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cx, cy, cropW, cropH, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = fixtureUrl;
  }), { fixtureUrl: '/tests/e2e/fixtures/happy-path-face.png', zoom });
  return { name: `zoomed-${zoom}.png`, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('1. real recovery: a real, fully-visible face rejected only on low_face_confidence and NOT genuinely clipped reaches the normal post-analysis flow (same downstream pipeline as an ordinary pass)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
  });
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeZoomedFixture(page, 2.2);
  await page.locator('input[type=file]').setInputFiles(fixture);

  // Reaches the SAME real ReviewScreen an ordinary passing photo
  // reaches — proof this is the normal downstream pipeline, not a
  // duplicate/special "recovered photo" path.
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  // Screen unmounts on success -- no debug panel to inspect, but the
  // debug-shadow console log (same established pattern as the pass
  // case in photo-quality-debug.spec.js test 4) still fires and
  // exposes the recovery decision.
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toBeFalsy(); // COPY button was never clicked -- nothing to expose here, confirmed via console below instead.
});

test('2. debug-shadow console log for the recovered case exposes only safe derived recovery fields — real detScore stays honestly low', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages = [];
  let recoveredDiag = null;
  page.on('console', async msg => {
    if (msg.text().startsWith('[PhotoQualityDebug]') && msg.args().length > 1) {
      recoveredDiag = await msg.args()[1].jsonValue().catch(() => null);
    }
    consoleMessages.push(msg.text());
  });
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeZoomedFixture(page, 2.2);
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });

  expect(recoveredDiag).not.toBeNull();
  // Proves recovery actually happened (not a real pass): qualityOk is
  // honestly false, low_face_confidence is the real reported reason,
  // recovery fields both true, and detectorScore stays the REAL low
  // value — never silently upgraded to "perfect".
  expect(recoveredDiag.qualityOk).toBe(false);
  expect(recoveredDiag.allReasons).toEqual(['low_face_confidence']);
  expect(recoveredDiag.boxClipped).toBe(false);
  expect(recoveredDiag.photoRecoveryEligible).toBe(true);
  expect(recoveredDiag.photoRecoveryApplied).toBe(true);
  expect(recoveredDiag.detectorScore).toBeLessThan(0.6);
  expect(recoveredDiag.failureType).toBe('none');
  expect(recoveredDiag.finalHardBlockPath).toBe('none (photo quality recovery applied)');
  const json = JSON.stringify(recoveredDiag);
  for (const forbidden of ['data:image', 'base64', 'landmarks', 'toDataURL', 'originalImage', '"x":', '"y":']) {
    expect(json).not.toContain(forbidden);
  }
});

test('3. genuinely edge-clipped fixture (same real face, tighter zoom, box actually touches the frame edge) is still hard-rejected — recovery correctly denied', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeZoomedFixture(page, 2.5);
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 60_000 });

  const panel = page.locator('[data-photo-quality-debug]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('true'); // boxClipped: true appears in the JSON dump
  const jsonText = await panel.locator('[data-photo-quality-json]').textContent();
  const data = JSON.parse(jsonText);
  expect(data.boxClipped).toBe(true);
  expect(data.allReasons).toContain('low_face_confidence');
  expect(data.photoRecoveryEligible).toBe(false);
  expect(data.photoRecoveryApplied).toBe(false);
  expect(data.qualityOk).toBe(false);
  expect(data.failureType).toBe('quality_rejection');
});

test('4. plain URL: the recoverable (zoom 2.2) fixture shows zero debug UI, exactly as today', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/index.html');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  const fixture = await makeZoomedFixture(page, 2.2);
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-photo-quality-debug]')).toHaveCount(0);
});

test('5. existing normal happy-path photo (no zoom) is completely unaffected: reaches ReviewScreen exactly as before', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/index.html?photoQualityDebug=1');
  await dismissConsent(page);
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(VALID_FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
});
