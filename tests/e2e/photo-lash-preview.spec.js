'use strict';
// ============================================================
// PHOTO LASH PREVIEW — permanent-disable regression guard.
// ------------------------------------------------------------
// This file used to exercise the ENABLED photo-fiber preview (fiber
// counts, canvas pixel composition, manual-adjustment dragging,
// reopen stability, EN copy, renderer-failure diagnostics). Product
// decision: Photo Preview is permanently OFF for end users
// (PHOTO_LASH_PREVIEW_ENABLED = false in index.html) — the renderer
// itself (PhotoLashPreviewPanel, PhotoLashEditorWorkspace,
// buildPhotoPreviewEyes, photo-lash-preview.js's buildFibers/draw) is
// kept in source, just unreachable from the UI. Exercising the old
// enabled behavior through a real browser is no longer meaningful, so
// this file now asserts the OPPOSITE: that no path in the real app —
// Hero, Lash Map, in any of RU/EN/AR — ever surfaces a lash-preview
// button, canvas, or any related copy, while the schematic Lash Map
// (LashMapDiagram) and the Live Scan per-eye map (ProfessionalEyeMap)
// keep working normally. See tests/lash-map-visual.test.js and
// tests/live-scan-result-to-lash-map.test.js for the source-level
// (non-browser) half of this same guarantee.
// ============================================================
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fixture = path.join(__dirname, 'fixtures/happy-path-face.png');

const LANG = {
  ru: {
    reject: 'Отказаться', langBtn: 'RU', photoBtn: 'Анализ по фото',
    confirmHeading: 'Подтверждение анализа', confirmBtn: 'Подтвердить и построить схемы',
    openMap: 'ОТКРЫТЬ LASH MAP',
  },
  en: {
    reject: 'Отказаться', langBtn: 'EN', photoBtn: 'Photo Analysis',
    confirmHeading: 'Confirm analysis', confirmBtn: 'Confirm and build designs',
    openMap: 'OPEN LASH MAP',
  },
  ar: {
    reject: 'Отказаться', langBtn: 'العربية', photoBtn: 'تحليل بالصورة',
    confirmHeading: 'تأكيد التحليل', confirmBtn: 'تأكيد وبناء الخرائط',
    openMap: 'فتح Lash Map',
  },
};

async function reachLashMap(page, lang) {
  const L = LANG[lang];
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('[BABEL]')) errors.push(m.text()); });

  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: L.reject, exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  if (lang !== 'ru') await page.getByRole('button', { name: L.langBtn, exact: true }).click();

  const photoBtn = page.getByRole('button', { name: L.photoBtn, exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 30000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText(L.confirmHeading, { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: L.confirmBtn, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

  // Hero check happens HERE, before navigating away — this is a single-page
  // app with no real URL routing between screens, so page.goBack() does not
  // return to Hero (an earlier version of this test wrongly assumed it would).
  const noPreviewOnHero = await page.getByText(/LASH PREVIEW|معاينة الرموش/i).count();
  expect(noPreviewOnHero, `[${lang}] Hero: no lash-preview text anywhere`).toBe(0);

  const mapBtn = page.getByRole('button', { name: L.openMap, exact: true });
  await expect(mapBtn).toBeVisible({ timeout: 10000 });
  await mapBtn.click();
  await page.waitForTimeout(500);

  return errors;
}

for (const lang of ['ru', 'en', 'ar']) {
  test(`[${lang}] no lash-preview button/canvas/copy anywhere on Hero or Lash Map; diagram still works; no console errors`, async ({ page }) => {
    test.setTimeout(90000);
    const errors = await reachLashMap(page, lang);

    const noPreviewOnLashMap = await page.getByText(/LASH PREVIEW|معاينة الرموش/i).count();
    expect(noPreviewOnLashMap, `[${lang}] Lash Map: no lash-preview text anywhere`).toBe(0);
    expect(await page.locator('[data-photo-lash-preview]').count(), `[${lang}] no PhotoLashPreviewPanel mounted`).toBe(0);
    expect(await page.locator('canvas[aria-label="Lash Preview"]').count(), `[${lang}] no lash-preview canvas mounted`).toBe(0);

    // the schematic Lash Map (zone/curve chart) must still render real data
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });

    expect(errors, `[${lang}] no console/page errors across the whole flow`).toEqual([]);
  });
}
