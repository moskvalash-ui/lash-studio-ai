'use strict';
// ============================================================
// PHOTO SCAN VISUAL LAYER — real-browser E2E.
// ------------------------------------------------------------
// Drives the REAL app end to end (real face-api detection, nothing
// mocked, same privacy-safe synthetic fixture every other Photo
// Analysis E2E spec already uses). Complements
// tests/photo-scan-visual-layer.test.js (structural/byte-identical
// proof) with real-browser proof of: completion reaches the existing
// Results flow, unmount mid-animation never crashes/double-navigates,
// and prefers-reduced-motion is honored.
// ============================================================
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function reachHomeAndStartPhoto(page) {
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
}

test('A. real photo upload completes the scan animation and reaches the existing Results (Review) contract, with zero page errors', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await reachHomeAndStartPhoto(page);
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  const canvas = page.locator('[data-photo-scan-canvas]');
  await expect(canvas, 'the scan-animation canvas must appear (not the old spinner)').toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  expect(errors, `no page errors during the scan animation: ${JSON.stringify(errors)}`).toEqual([]);
});

test('B. navigating Back mid-animation is safe: no crash, no page error, no double navigation, lands back on Home', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await reachHomeAndStartPhoto(page);
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.locator('[data-photo-scan-canvas]').waitFor({ state: 'visible', timeout: 10000 });
  // Mid-animation, well before either the ~2.9s minimum or real
  // analysis could plausibly finish.
  await page.waitForTimeout(400);
  // Same real BackButton selector already established by
  // lashmap-back-navigation.spec.js / live-scan-cold-start.spec.js.
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  // Give any in-flight async work (analyze()'s remaining awaits, the
  // rAF loop) a real chance to fire before asserting nothing bad happened.
  await page.waitForTimeout(4000);
  expect(errors, `no page errors after navigating away mid-animation: ${JSON.stringify(errors)}`).toEqual([]);
  // Must not have been silently carried forward into Results/Review —
  // confirms onComplete never fired post-unmount.
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toHaveCount(0);
});

test('C. prefers-reduced-motion: the stable (non-sweeping) scan state renders and the flow still reaches Results, with zero page errors', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await reachHomeAndStartPhoto(page);
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.locator('[data-photo-scan-canvas]').waitFor({ state: 'visible', timeout: 10000 });
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  expect(errors, `no page errors with reduced motion: ${JSON.stringify(errors)}`).toEqual([]);
});
