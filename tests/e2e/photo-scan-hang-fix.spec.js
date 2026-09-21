'use strict';
// ============================================================
// PHOTO SCAN HANG FIX — regression coverage for a real tester report:
// Photo Analysis could get permanently stuck in state='analyzing'
// (scanning screen never leaves, Results never reached) because
// completion was gated entirely on a decorative requestAnimationFrame
// loop (PhotoAnalysisScreen's `frame()`) that had (a) no protection
// against an exception thrown by its own geometry/draw code silently
// killing the loop forever, and (b) no absolute ceiling if the reveal
// gate was never satisfied for any reason. See the implementation
// report for the full root-cause analysis.
//
// This fix touches ONLY PhotoAnalysisScreen's animation/completion
// plumbing -- no face/iris/eyelid/face-shape/ranking algorithm, and no
// EXIF handling (an unconfirmed hypothesis, deliberately out of scope).
// Tests here drive the REAL production code end to end in a real
// browser (nothing mocked except the two narrow injection points each
// test documents), using the same real, privacy-safe synthetic fixture
// already used throughout this project's Photo Analysis E2E coverage.
// ============================================================
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function reachPhotoAnalysis(page) {
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
}

// Injects a SINGLE simulated animation-frame failure into
// PhotoAnalysisScreen's own scan loop, then restores the real,
// unmodified mapVideoPointToDisplay immediately after. mapVideoPointToDisplay
// is also used by ResultMeshOverlay (ReviewScreen/HeroScreen, an
// unrelated, out-of-scope component this fix never touches) -- a
// PERMANENT global patch would break that too and produce a false
// signal, so this deliberately throws exactly once (enough to trigger
// PhotoAnalysisScreen's own catch/animationBroken path, which never
// calls the function again itself) and then behaves exactly like the
// real production function for everyone else, including ResultMeshOverlay.
async function injectSingleAnimationFrameFailure(page) {
  await page.addInitScript(() => {
    const install = () => {
      if (typeof window.mapVideoPointToDisplay !== 'function' || window.__mapVideoPointToDisplayPatched) return;
      window.__mapVideoPointToDisplayPatched = true;
      const real = window.mapVideoPointToDisplay;
      let thrown = false;
      window.mapVideoPointToDisplay = (...args) => {
        if (!thrown) { thrown = true; throw new Error('TEST-INJECTED animation exception'); }
        return real(...args);
      };
    };
    const iv = setInterval(() => { install(); if (window.__mapVideoPointToDisplayPatched) clearInterval(iv); }, 20);
  });
}

// ------------------------------------------------------------
// A. Happy path is unaffected: normal Photo Analysis still reaches
// Results, with the same real choreography, zero page errors.
// ------------------------------------------------------------
test('A. normal Photo Analysis happy path still reaches Results Hero', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().includes('BABEL')) errors.push('console.error: ' + msg.text()); });

  await reachPhotoAnalysis(page);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

  expect(errors, `no fatal errors on the happy path: ${JSON.stringify(errors)}`).toEqual([]);
});

// ------------------------------------------------------------
// B/C. An exception injected into the animation's geometry/draw code
// (mapVideoPointToDisplay, the first real call inside the newly-
// guarded try block, called unconditionally as soon as geometry
// exists) must NOT leave the app on the scanning screen. It must be
// logged with the documented [PhotoScanAnimation] prefix, and once the
// real analysis result is ready, the flow must still reach Results --
// proving both (B) an animation exception doesn't block a successful
// result, and (C) the decorative reveal timer (REVEAL_MS) is no longer
// an absolute blocker: this photo's geometry reveal never plays a
// single successful frame, yet completion still proceeds.
// ------------------------------------------------------------
test('B/C. animation-frame exception does not hang the app -- falls back and still reaches Results once analysis is ready', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await injectSingleAnimationFrameFailure(page);

  await reachPhotoAnalysis(page);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();

  // Must still reach Results despite the geometry-reveal frame throwing
  // -- this is the core hang-fix claim.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

  expect(pageErrors, 'the injected exception must be caught, never an uncaught page error').toEqual([]);
  expect(
    consoleErrors.some((t) => t.includes('[PhotoScanAnimation]') && t.includes('TEST-INJECTED animation exception')),
    `expected a [PhotoScanAnimation] console.error mentioning the injected failure, got: ${JSON.stringify(consoleErrors)}`
  ).toBe(true);
});

// ------------------------------------------------------------
// D. Watchdog: if the analyzer itself never resolves (a genuinely
// stuck detector), the screen must NOT stay on 'analyzing' forever --
// after WATCHDOG_MS (20s, see the code's own comment for why), the
// existing, already-tested error state must appear.
// ------------------------------------------------------------
test('D. watchdog: a genuinely stuck analyzer surfaces the error state instead of an infinite scanning screen', async ({ page }) => {
  test.setTimeout(45000);
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // Makes face-api's own detection promise never resolve, simulating a
  // genuinely stuck analyzer (as opposed to a fast one that just never
  // gets a chance to run its animation, which tests B/C already cover).
  await page.addInitScript(() => {
    const install = () => {
      if (typeof window.faceapi === 'undefined' || !window.faceapi.detectSingleFace || window.__faceapiPatched) return;
      window.__faceapiPatched = true;
      window.faceapi.detectSingleFace = () => ({
        withFaceLandmarks: () => new Promise(() => {}), // never resolves
      });
    };
    const iv = setInterval(() => { install(); if (window.__faceapiPatched) clearInterval(iv); }, 20);
  });

  await reachPhotoAnalysis(page);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);

  // Real watchdog window (20s) plus normal browser/test overhead.
  await expect(page.getByText('Недостаточно качества для точного анализа', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Выбрать другое фото', exact: true })).toBeVisible();

  expect(
    consoleErrors.some((t) => t.includes('[PhotoScanAnimation]') && t.includes('watchdog')),
    `expected a [PhotoScanAnimation] watchdog console.error, got: ${JSON.stringify(consoleErrors)}`
  ).toBe(true);
});

// ------------------------------------------------------------
// E. onComplete is idempotent: in the same exception-recovery scenario
// as B/C, once Results has been reached (via the fast animationBroken
// path, well before the 20s watchdog window), waiting PAST the
// watchdog's own duration must never produce a second completion/
// error transition -- proving finish()'s `finished` guard and the
// effect's clearTimeout cleanup actually prevent a race between normal
// completion and the watchdog.
// ------------------------------------------------------------
test('E. onComplete fires at most once: reaching Results via the exception-recovery path is stable through the full watchdog window', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await injectSingleAnimationFrameFailure(page);

  await reachPhotoAnalysis(page);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();

  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  // Wait past the real 20s WATCHDOG_MS window entirely. If the
  // watchdog were NOT properly cancelled/guarded, it would fire a
  // second, stray setState('error') here even though Results was
  // already reached — which would either throw (state update on an
  // unexpected screen) or visibly replace Results with the error UI.
  await page.waitForTimeout(21000);

  await expect(heroHeading, 'must still be on the SAME Results screen, not bounced to an error state by a stray watchdog fire').toBeVisible();
  expect(await heroHeading.getAttribute('data-hero-design-id')).toBe(heroId);
  expect(pageErrors, 'no page errors from a stray second completion attempt').toEqual([]);
});
