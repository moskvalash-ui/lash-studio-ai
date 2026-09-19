'use strict';
// ============================================================
// RESULTS HERO — compact, always-visible IRIS COLOR indicator, real
// browser proof.
// ------------------------------------------------------------
// Complements tests/results-hero-iris-indicator.test.js (structural/
// byte-identical proof) and tests/e2e/iris-color.spec.js (which
// verifies the pre-existing, still-collapsed-by-default "AI Eye
// Profile" row after deliberately clicking the toggle). This file
// proves the actual reported symptom is fixed: a real user who never
// taps "AI Eye Profile" still sees the real iris color, using the same
// real photo -> real face-api -> real Iris Color pipeline as
// iris-color.spec.js, nothing mocked.
// ============================================================
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function reachHeroWithoutExpandingEyeProfile(page, lang) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();

  if (lang === 'en') {
    await page.getByRole('button', { name: 'EN', exact: true }).click();
  }

  const photoLabel = lang === 'en' ? 'Photo Analysis' : 'Анализ по фото';
  const photoBtn = page.getByRole('button', { name: photoLabel, exact: true });
  await expect(photoBtn, 'Photo Analysis entry control must become enabled once models load').toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(FIXTURE);

  const reviewTitle = lang === 'en' ? 'Confirm analysis' : 'Подтверждение анализа';
  await expect(page.getByText(reviewTitle, { exact: true }), 'real analysis must complete and reach ReviewScreen').toBeVisible({ timeout: 45000 });

  const confirmLabel = lang === 'en' ? 'Confirm and build designs' : 'Подтвердить и построить схемы';
  await page.getByRole('button', { name: confirmLabel, exact: true }).click();

  // Deliberately do NOT click "AI Eye Profile" here -- this is the exact
  // real, unmodified default state a user lands on.
  return { pageErrors };
}

test('RU: iris color is visible on Results Hero without opening AI Eye Profile, and AI Eye Profile itself remains collapsed', async ({ page }) => {
  test.setTimeout(60_000);
  const { pageErrors } = await reachHeroWithoutExpandingEyeProfile(page, 'ru');

  // 1 & 2. The real, always-visible indicator is present and shows the
  // real classified category for this fixture (same real ground truth
  // iris-color.spec.js's own RU test already established: 'Голубые').
  const indicator = page.locator('[data-hero-iris-indicator]');
  await expect(indicator, 'the iris indicator must be visible without any prior interaction').toBeVisible({ timeout: 10000 });
  await expect(indicator, 'expected the RU label "Цвет радужки"').toContainText('Цвет радужки');
  await expect(indicator, 'expected the real, correct BLUE category for this fixture').toContainText('Голубые');

  // 4. AI Eye Profile is genuinely still collapsed: its own toggle
  // button exists (accessible name is the Section title) but the row
  // list inside it (proven by the collapsed EyeProfileRow's own iris
  // label text) is not yet in the DOM.
  const toggle = page.getByRole('button', { name: 'AI Eye Profile', exact: true });
  await expect(toggle, 'the AI Eye Profile toggle itself must still exist').toBeVisible();
  const collapsedRowsCount = await page.getByText('Цвет радужки', { exact: true }).count();
  expect(collapsedRowsCount, 'only the new indicator\'s label should match "Цвет радужки" before AI Eye Profile is expanded — the collapsed row\'s own copy must not be in the DOM yet').toBe(1);

  // 5. Primary CTA remains present, unchanged, and reachable.
  const cta = page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true });
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();

  expect(pageErrors, `no fatal page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);

  // Now expand AI Eye Profile and confirm the pre-existing row still
  // shows the SAME category — the new indicator did not fork a second,
  // divergent iris result.
  await toggle.click();
  const expandedRowsCount = await page.getByText('Цвет радужки', { exact: true }).count();
  expect(expandedRowsCount, 'once expanded, both the indicator and the original row should show the same label text').toBe(2);
  const expandedRowValue = page.locator('div.flex.justify-between.items-start.gap-3.py-3', { hasText: 'Цвет радужки' }).locator('span').first();
  await expect(expandedRowValue).toHaveText('Голубые');
});

test('EN: iris color is visible on Results Hero without opening AI Eye Profile, and AI Eye Profile itself remains collapsed', async ({ page }) => {
  test.setTimeout(60_000);
  const { pageErrors } = await reachHeroWithoutExpandingEyeProfile(page, 'en');

  const indicator = page.locator('[data-hero-iris-indicator]');
  await expect(indicator, 'the iris indicator must be visible without any prior interaction').toBeVisible({ timeout: 10000 });
  await expect(indicator, 'expected the EN label "Iris color"').toContainText('Iris color');
  await expect(indicator, 'expected the real, correct Blue category for this fixture').toContainText('Blue');

  const toggle = page.getByRole('button', { name: 'AI Eye Profile', exact: true });
  await expect(toggle).toBeVisible();

  const cta = page.getByRole('button', { name: 'OPEN LASH MAP', exact: true });
  await expect(cta).toBeVisible();
  await expect(cta).toBeEnabled();

  expect(pageErrors, `no fatal page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
