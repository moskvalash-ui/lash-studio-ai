'use strict';
// ============================================================
// RELEASE-1 — V1 public flow E2E.
// ------------------------------------------------------------
// Real face-api analysis on the real fixture photo, real IndexedDB —
// same technique as client-save-persistence.spec.js/visit-history.spec.js.
// Proves the intended V1 public flow end-to-end AND that no Try-On CTA
// is reachable at the two screens most likely to have carried one
// (Results/Hero, Lash Map) — an explicit, evidence-based regression
// guard for the RELEASE-1 product decision (there was no Try-On CTA to
// remove; this locks in that it stays that way).
// ============================================================
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fixture = path.join(__dirname, 'fixtures/happy-path-face.png');

const NO_TRYON_PATTERN = /try-?on|примерить|примерка|virtual try/i;

async function assertNoTryOnCTA(page) {
  const buttons = await page.getByRole('button').allInnerTexts();
  for (const text of buttons) {
    expect(text, `unexpected Try-On-shaped button text: "${text}"`).not.toMatch(NO_TRYON_PATTERN);
  }
}

test('V1 release flow: Photo Analysis -> Results (no Try-On CTA) -> Lash Map (no Try-On CTA) -> Save to Client -> Client Card -> Visit History -> Visit Detail -> reload -> persists', async ({ page }) => {
  test.setTimeout(180000);
  const name = 'Synthetic RELEASE-1 V1 Flow';

  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();

  // ---- Results (Hero) ----
  await expect(page.getByRole('button', { name: 'Сохранить клиентке', exact: true })).toBeVisible();
  await assertNoTryOnCTA(page);

  // ---- Lash Map ----
  const mapButtons = page.getByRole('button', { name: 'ОТКРЫТЬ КАРТУ →', exact: true });
  await mapButtons.first().click();
  await expect(page.getByRole('button', { name: 'Сохранить клиентке', exact: true })).toBeVisible();
  await assertNoTryOnCTA(page);

  // ---- Save to Client (new client) ----
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill(name);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();

  // ---- Client Card / Visit History ----
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('История визитов', { exact: true })).toBeVisible();
  await assertNoTryOnCTA(page);
  const historyCard = page.locator('button').filter({ hasText: /mm/ }).first();
  await expect(historyCard).toBeVisible();

  // ---- Visit Detail ----
  await historyCard.click();
  await expect(page.getByRole('heading', { name: 'Визит', exact: true })).toBeVisible();
  await assertNoTryOnCTA(page);

  // ---- Back -> reload -> reopen -> confirm persisted ----
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Клиенты', exact: true }).click();
  await page.getByRole('button').filter({ hasText: name }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Всего визитов', { exact: true }).locator('..')).toContainText('1');
  await page.locator('button').filter({ hasText: /mm/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Визит', exact: true })).toBeVisible();
});
