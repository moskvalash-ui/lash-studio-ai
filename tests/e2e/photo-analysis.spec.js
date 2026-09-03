// PHASE B — REAL PHOTO ANALYSIS USER FLOW (happy path only).
// Drives the REAL production UI end to end: real face-api detection,
// real quality gate, real analysis pipeline (index.html's
// PhotoAnalysisScreen.analyze(), ~index.html:7990). Nothing is invoked
// directly, nothing is mocked, no internal function is called, no
// classifier/recommendation output is injected.
//
// This test answers exactly one question: did a valid photo travel
// through the real production analysis pipeline and reach the app's
// real post-analysis Results state (ReviewScreen)? It deliberately does
// NOT assert Iris category, face shape, recommendation score, or any
// other analysis-specific content -- those belong to lower-level
// regression tests (tests/*.test.js) or a future, more focused E2E
// phase. Iris Color / recommendation / Lash Map / Natural Lash Scan
// logic is not touched by this file.
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

test('real Photo Analysis happy path: upload -> real face-api -> real analysis -> Results reached', async ({ page }) => {
  test.setTimeout(60_000); // real face-api CDN load (~10s, Phase A probe) + real inference; bounded, not unlimited

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/index.html');

  // 1) Wait for the real user-facing entry control to become available --
  // same production readiness signal already proven in Phase A (models
  // loaded), not a fixed sleep.
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn, 'Photo Analysis entry control must become enabled once models load').toBeEnabled({ timeout: 20_000 });

  // 2) Enter Photo Analysis through the real control.
  await photoBtn.click();

  // 3) Upload the fixture through the real, production file input.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE);

  // 4) Wait for the REAL end state of analyze() (index.html:7990-8167):
  // either the real post-analysis ReviewScreen (success) or the real
  // quality-gate/no-face error screen (failure) -- whichever the
  // production pipeline actually reaches. Racing both real signals
  // (rather than only waiting on success) means a genuine pipeline
  // failure produces a clear, immediate, diagnosable assertion failure
  // instead of a 45s timeout with no information.
  const reviewTitle = page.getByText('Подтверждение анализа', { exact: true });
  const errorRetryBtn = page.getByRole('button', { name: 'Выбрать другое фото', exact: true });
  await Promise.race([
    reviewTitle.waitFor({ state: 'visible', timeout: 45_000 }),
    errorRetryBtn.waitFor({ state: 'visible', timeout: 45_000 }),
  ]);

  // 5) The real pipeline must have reached Results (ReviewScreen), not
  // the error path -- this fixture is expected to be a reliable pass.
  await expect(errorRetryBtn, 'production quality gate / face detection must not reject this fixture').not.toBeVisible();
  await expect(reviewTitle, 'real analysis must complete and reach the real post-analysis Results screen (ReviewScreen)').toBeVisible();

  // 6) At least one stable, result-level, production-rendered element
  // proving analysis genuinely completed with real data -- the client
  // photo preview the real pipeline itself produced (result.originalImage,
  // index.html ReviewScreen), not a placeholder.
  const clientPhoto = page.getByAltText('client');
  await expect(clientPhoto, 'the real analyzed photo must be rendered on the Results screen').toBeVisible();
  await expect(clientPhoto).toHaveAttribute('src', /^data:image\//);

  // 7) No uncaught page error during the whole real flow.
  expect(pageErrors, `no fatal page errors during the real analysis flow: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
