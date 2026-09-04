// PHASE C — IRIS COLOR INTEGRATION VALIDATION (happy path only).
// Extends the real Photo Analysis flow already proven in
// photo-analysis.spec.js one step further, through the real "confirm"
// transition into the real post-analysis HeroScreen, where the app
// renders its actual, user-visible Iris Color result
// (index.html's EyeProfileRow, label=t('irisColorLabel'), fed by
// eyeProfileLabels()'s real `iris` result via IRIS_NAMES). Nothing is
// invoked directly, nothing is mocked, no internal classifier/
// combineIris/radial-corroboration function is called or injected --
// this only proves the real photo -> real face-api -> real Iris Color
// pipeline -> real UI actually wires together and displays the correct
// category end to end. Iris Color logic itself (thresholds, radial
// corroboration, bilateral combineIris, uncertainty propagation) is
// owned by tests/iris-*.test.js and is not touched or re-asserted here.
//
// FIXTURE SCOPE (see tests/e2e/README.md "Fixture provenance" section
// for the full provenance writeup): the only full-face image fixture
// available anywhere in this repository is fixtures/happy-path-face.png
// (an AI-generated, non-identifiable test image, already vetted for
// Phase B). Every other Iris test fixture in tests/fixtures/*.json is
// DERIVED pixel/audit data (by design -- see CLAUDE.md's Privacy
// section), not an uploadable photo, so it cannot drive this E2E layer.
// This file therefore covers exactly one category end to end (BLUE,
// the real, multi-stage-corroborated ground truth for this fixture --
// see the Phase C report for the full diagnostic evidence). GREEN,
// BROWN, GRAY, and UNCERTAIN are not covered here: adding them would
// require either a forbidden private/real source photo or fabricating
// a brand-new fixture image, both explicitly out of scope for this
// task. A future phase can extend this file once an equivalent
// privacy-safe full-face fixture exists for those categories.
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

test('real Iris Color happy path: real photo -> real pipeline -> displayed BLUE category on HeroScreen', async ({ page }) => {
  test.setTimeout(60_000); // same bound as photo-analysis.spec.js: real CDN + real inference, not unlimited

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/index.html');

  // 1) Dismiss the real analytics-consent banner if it appears -- same
  // real-flow reasoning as photo-analysis.spec.js.
  const rejectConsent = page.getByRole('button', { name: 'Отказаться', exact: true });
  await rejectConsent.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await rejectConsent.isVisible().catch(() => false)) await rejectConsent.click();

  // 2) Real entry control, same production readiness signal as Phase B.
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn, 'Photo Analysis entry control must become enabled once models load').toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();

  // 3) Upload the fixture through the real, production file input.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE);

  // 4) Wait for the real post-analysis ReviewScreen (already proven
  // reliable for this exact fixture in Phase B).
  const reviewTitle = page.getByText('Подтверждение анализа', { exact: true });
  const errorRetryBtn = page.getByRole('button', { name: 'Выбрать другое фото', exact: true });
  await Promise.race([
    reviewTitle.waitFor({ state: 'visible', timeout: 45_000 }),
    errorRetryBtn.waitFor({ state: 'visible', timeout: 45_000 }),
  ]);
  await expect(errorRetryBtn, 'production quality gate / face detection must not reject this fixture').not.toBeVisible();
  await expect(reviewTitle, 'real analysis must complete and reach the real post-analysis Results screen (ReviewScreen)').toBeVisible();

  // 5) Advance through the real "confirm" transition -- the app's own
  // real handleReviewConfirm(rec) -> setScreen('hero') -- to reach the
  // real screen that actually displays Iris Color (ReviewScreen itself
  // never renders an Iris row; HeroScreen does, unconditionally, via
  // EyeProfileRow icon="iris").
  const confirmBtn = page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true });
  await confirmBtn.click();

  // 6) The real, user-visible Iris Color row on HeroScreen. Scoped to
  // the specific row's own container (via its label text) rather than a
  // bare page-wide text match, since other rows on the same screen
  // could in principle repeat category-like words -- this keeps the
  // selector semantically tied to "the Iris Color row" specifically,
  // the same real DOM structure a sighted user reads visually.
  const irisLabel = page.getByText('Цвет радужки', { exact: true });
  await expect(irisLabel, 'the real HeroScreen must render the Iris Color row label').toBeVisible({ timeout: 10_000 });
  const irisRow = page.locator('div.flex.justify-between.items-start.gap-3.py-3', { has: irisLabel });
  const irisValue = irisRow.locator('span').first();

  // 7) THE assertion this file exists for: FULL PHOTO -> REAL PIPELINE
  // -> EXPECTED DISPLAYED IRIS CATEGORY. 'Голубые' (RU for Blue) is the
  // real, multi-stage-corroborated ground truth for this fixture (both
  // eyes independently classify blue with real sampled-pixel evidence;
  // bilateral combineIris also resolves to blue, not uncertain -- see
  // the Phase C report for the full diagnostic trace). This must not be
  // relaxed to a looser match or to 'Оттенок не определён' (uncertain)
  // merely to make the assertion pass.
  await expect(irisValue, 'the real Iris Color pipeline must reach and display BLUE ("Голубые") for this fixture').toHaveText('Голубые');

  // 8) No uncaught page error during the whole real flow.
  expect(pageErrors, `no fatal page errors during the real analysis flow: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
