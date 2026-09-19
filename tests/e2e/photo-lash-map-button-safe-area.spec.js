'use strict';
// ============================================================
// PHOTO LASH MAP — CUSTOMIZE MAP button safe-area regression.
// ------------------------------------------------------------
// Real-device report: on the LEFT eye card (PEAK/OUTER render on the
// same, right, side as the button), "НАСТРОИТЬ СХЕМУ"/"CUSTOMIZE MAP"
// visually competed with the PEAK/OUTER labels. Root cause: the
// button's own fixed CSS footprint (top-3 + min-h-[44px] = 56px from
// the card's top) occupies ~25-28% of the card's real rendered height
// at the production ~390-430px iPhone viewport range, while
// selectProfessionalEyeLabels' reservedTopY only protected 16% of it.
//
// This test drives the REAL app end to end (no internal function
// called directly, nothing mocked) and measures REAL rendered
// getBoundingClientRect() geometry for both the button and every
// canonical label text element — proving no intersection, not just
// that a JS-level Y coordinate looks plausible. Same real navigation
// pattern as photo-lash-map-mirror.spec.js's own reachLashMapFor.
// ============================================================
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');
// Covers the production range this fix was calibrated against (see
// selectProfessionalEyeLabels' own comment on the real measurements).
const VIEWPORT_WIDTHS = [390, 430];

async function reachLashMapFor(page, designName) {
  await page.goto('/index.html');
  const rejectConsent = page.getByRole('button', { name: 'Отказаться', exact: true });
  await rejectConsent.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await rejectConsent.isVisible().catch(() => false)) await rejectConsent.click();

  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();

  const allDesignsBtn = page.getByRole('button', { name: 'Смотреть все дизайны', exact: true });
  await allDesignsBtn.scrollIntoViewIfNeeded();
  await expect(allDesignsBtn).toBeVisible({ timeout: 10_000 });
  await allDesignsBtn.click();

  const designHeading = page.getByRole('heading', { name: designName, level: 4, exact: true }).first();
  await designHeading.scrollIntoViewIfNeeded();
  await expect(designHeading, `${designName} must be listed in the real All Designs catalog`).toBeVisible({ timeout: 10_000 });
  await designHeading.locator('xpath=ancestor::button[1]').click();

  const leftMap = page.locator('[aria-label="Left eye map"]');
  const rightMap = page.locator('[aria-label="Right eye map"]');
  await expect(leftMap, 'LEFT PHOTO Lash Map card must render').toBeVisible({ timeout: 10_000 });
  await expect(rightMap, 'RIGHT PHOTO Lash Map card must render').toBeVisible({ timeout: 10_000 });
  return { leftMap, rightMap };
}

// Real getBoundingClientRect() rectangles: the CUSTOMIZE MAP button
// (last button inside data-photo-edit-controls — the eye-side badge is
// a <span>, never a <button>) and every canonical label text element
// currently rendered (only the 5 canonical zone anchors ever render
// one, post RELEASE POLISH — see selectProfessionalEyeLabels).
async function measureSafeArea(cardLocator) {
  return cardLocator.evaluate((el) => {
    const rect = (node) => { const r = node.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }; };
    const controls = el.querySelector('[data-photo-edit-controls]');
    const buttons = controls.querySelectorAll('button');
    const button = rect(buttons[buttons.length - 1]);
    const labelTexts = [...el.querySelectorAll('text[data-photo-label], g[data-photo-zone] text')].map((node) => ({
      text: node.textContent,
      rect: rect(node),
    }));
    return { button, labelTexts };
  });
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

for (const width of VIEWPORT_WIDTHS) {
  for (const designName of ['FOX', 'CAT EYE']) {
    test(`CUSTOMIZE MAP button never overlaps a canonical PHOTO label — ${designName} @ ${width}px (LEFT and RIGHT)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 844 });
      const { leftMap, rightMap } = await reachLashMapFor(page, designName);

      for (const [side, card] of [['LEFT', leftMap], ['RIGHT', rightMap]]) {
        const { button, labelTexts } = await measureSafeArea(card);
        // Each of the 5 canonical zone anchors renders TWO text nodes:
        // its bare numeric label (data-photo-label, e.g. "11") and its
        // zone-name + value label (g[data-photo-zone] text, e.g. "ПИК
        // 11") — 10 total. Confirms only the 5 canonical anchors ever
        // produce a label (RELEASE POLISH), not merely a collision-free
        // subset of a larger set.
        expect(labelTexts.length, `${designName}/${side}@${width}px: expected exactly 10 text nodes (5 canonical zones x 2 label forms each)`).toBe(10);
        for (const label of labelTexts) {
          expect(
            intersects(button, label.rect),
            `${designName}/${side}@${width}px: CUSTOMIZE MAP button ${JSON.stringify(button)} must not intersect label "${label.text}" ${JSON.stringify(label.rect)}`
          ).toBe(false);
        }
      }
    });
  }
}
