'use strict';
// ============================================================
// RESULTS HERO V1 — real-browser proof at the project's standard
// 390x844 mobile viewport (see playwright.config.js's `use.viewport`;
// no special context needed, this is already the suite default).
// Same real face-api analysis + real fixture photo technique as
// photo-analysis.spec.js/iris-color.spec.js — nothing mocked.
// ============================================================
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fixture = path.join(__dirname, 'fixtures/happy-path-face.png');

test('Results Hero: best design + score + primary CTA visible without a long scroll, above analysis/detail sections, and the primary CTA opens the correct design', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const photo = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photo).toBeEnabled({ timeout: 20000 });
  await photo.click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();

  // ---- Results Hero (real render) ----
  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  const topDesignId = await heroHeading.getAttribute('data-hero-design-id');
  expect(topDesignId).toBeTruthy();

  // A. Best recommendation is visually BEFORE the analysis/detail
  // sections, proven structurally (DOM order), not by pixel position —
  // robust to any future spacing/sizing tweak.
  const order = await page.evaluate(() => {
    const leaves = Array.from(document.querySelectorAll('body *')).filter(el => el.children.length === 0);
    const heroIdx = leaves.findIndex(el => el.textContent.trim() === 'ВАШ ЛУЧШИЙ ДИЗАЙН');
    const eyeProfileIdx = leaves.findIndex(el => el.textContent.trim() === 'AI Eye Profile');
    return { heroIdx, eyeProfileIdx };
  });
  expect(order.heroIdx, 'expected the Hero headline label to be present').toBeGreaterThan(-1);
  expect(order.eyeProfileIdx, 'expected the AI Eye Profile label to be present').toBeGreaterThan(-1);
  expect(order.heroIdx, 'Hero must render before the AI Eye Profile / analysis section').toBeLessThan(order.eyeProfileIdx);

  // B. Best design name + match percentage + primary Lash Map CTA are
  // all visible without a long scroll, i.e. within the real 390x844
  // viewport this whole suite already runs at by default.
  const heroScore = page.locator('span.text-2xl.font-bold.text-accent');
  const openLashMapCTA = page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true });
  await expect(heroHeading).toBeInViewport();
  await expect(heroScore).toBeInViewport();
  await expect(openLashMapCTA).toBeInViewport();

  // C. The primary CTA opens the CORRECT design — checked by canonical
  // id, not display text: RU can intentionally show a presentation-only
  // label (e.g. "Лисий" for canonical fox) that differs from the real
  // persisted name, so a text comparison here would be the wrong proof.
  await openLashMapCTA.click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill('Synthetic Results-Hero E2E');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();

  const saved = await page.evaluate(async () => {
    const store = ClientStore.createClientStore();
    const clients = await store.listClients();
    const client = clients.find(c => c.fullName === 'Synthetic Results-Hero E2E');
    const visits = await store.listVisitsForClient(client.id);
    return visits[0];
  });
  expect(saved.designSnapshot.designId).toBe(topDesignId);
  expect(saved.designSnapshot.recommendation.rank).toBe(0);
});
