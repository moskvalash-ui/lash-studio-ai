'use strict';
// ============================================================
// LIVE SCAN RESULT -> LASH MAP. A live-scan result has source:'live'.
// LashMapScreen defaults to the PHOTO view and mounts
// PhotoLashEditorWorkspace, which renders nothing for non-photo
// results but whose mount effect used to dereference an <img> ref that
// is never attached -> uncaught TypeError inside an effect -> with no
// error boundary React unmounts the whole app (black screen) the moment
// the user taps an effect on the result screen.
//
// Deterministic and fast: one REAL face-api detection of the exact frame
// the fake camera shows is replayed every tick, so the real scan
// pipeline, completion, onComplete, Review and Results all run for real
// (only getUserMedia and detection speed are controlled).
// ============================================================
const path = require('node:path');
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

test('tapping an effect after a real Live Scan opens Lash Map without crashing the app', async ({ page }) => {
  test.setTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const b64 = fs.readFileSync(path.join(__dirname, 'fixtures/happy-path-face.png')).toString('base64');
  await page.addInitScript((b64) => {
    localStorage.setItem('lashStudioOnboardingSeenV1', '1');
    window.__img = new Image();
    window.__imgReady = new Promise(r => { window.__img.onload = r; window.__img.src = 'data:image/png;base64,' + b64; });
    navigator.mediaDevices.getUserMedia = async () => {
      await window.__imgReady;
      const img = window.__img, c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d'), s = Math.max(640 / img.width, 480 / img.height);
      const draw = () => x.drawImage(img, (640 - img.width * s) / 2, (480 - img.height * s) / 2, img.width * s, img.height * s);
      draw(); setInterval(draw, 50);
      return c.captureStream(20);
    };
  }, b64);
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  await page.waitForFunction(() => typeof faceapi !== 'undefined' && faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceLandmark68Net.isLoaded, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    await window.__imgReady;
    const img = window.__img, c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const x = c.getContext('2d'), s = Math.max(640 / img.width, 480 / img.height);
    x.drawImage(img, (640 - img.width * s) / 2, (480 - img.height * s) / 2, img.width * s, img.height * s);
    const real = await faceapi.detectSingleFace(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks();
    faceapi.detectSingleFace = () => ({ withFaceLandmarks: async () => real });
  });
  await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click();
  // Real scan completes -> Review.
  const confirm = page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true });
  await expect(confirm).toBeVisible({ timeout: 90000 });
  await confirm.click();
  // Results screen is up; tap the effect (open its Lash Map).
  const open = page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true });
  await expect(open).toBeVisible({ timeout: 30000 });
  await open.click();
  await page.waitForTimeout(2500);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.getElementById('root').childElementCount)).toBeGreaterThan(0);
  await expect(page.getByText('ПРОФЕССИОНАЛЬНАЯ LASH MAP', { exact: false })).toBeVisible();
  // A live result must open on the DIAGRAM, never on an empty PHOTO workspace.
  expect(await activeView(page)).toBe('diagram');
  await expect(page.locator('[data-photo-lash-editor-workspace]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Lash Map view"]')).toBeVisible();
  // Switching to PHOTO on a live result must not crash either (the workspace intentionally renders nothing).
  await page.locator('[aria-label="Lash Map view"] button').first().click();
  await page.waitForTimeout(800);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.getElementById('root').childElementCount)).toBeGreaterThan(0);
});

// Which Lash Map view tab is active, read from the tab group itself (labels are CSS-uppercased).
const activeView = page => page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[aria-label="Lash Map view"] button')];
  const active = tabs.find(b => /(^|\s)bg-white/.test(b.className));
  return active ? active.textContent.trim().toLowerCase() : null;
});

test('Photo Analysis result still opens Lash Map on the PHOTO view', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const photo = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photo).toBeEnabled({ timeout: 30000 });
  await photo.click();
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixtures/happy-path-face.png'));
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 90000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();
  await page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true }).click();
  await expect(page.locator('[data-photo-lash-editor-workspace]')).toBeVisible({ timeout: 30000 });
  expect(await activeView(page)).toBe('photo');
  expect(pageErrors).toEqual([]);
});
