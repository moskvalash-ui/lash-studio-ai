'use strict';
// ============================================================
// CLIENT-4 — VISIT HISTORY UI real E2E.
// ------------------------------------------------------------
// Same real-pipeline approach as client-save-persistence.spec.js (real
// face-api analysis on a real fixture photo, real IndexedDB via the
// project's own static server) — never mocked. Proves the full loop:
// Photo Analysis -> Save to Client -> Client Card Visit History ->
// Visit Detail (historical design + Lash Map + analysis summary) ->
// Back -> reload -> reopen client -> reopen Visit -> history survives.
// ============================================================
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fixture = path.join(__dirname, 'fixtures/happy-path-face.png');

async function analyze(page) {
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
  await expect(page.getByRole('button', { name: 'Сохранить клиентке', exact: true })).toBeVisible();
}

async function clickBack(page) {
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
}

// Opens the Nth ranked design's own Lash Map screen and saves THAT exact
// viewed design (clicking "Save to Client" while still on LashMapScreen,
// never after returning to Hero -- handleSaveToClient reads Hero's
// CURRENT first recommendation instead of a previously-viewed map, see
// tests/save-to-client-flow.test.js test P). This is what lets two
// visits saved from the very same fixture photo carry two genuinely
// distinct designSnapshot.designId values.
async function openNthDesignMapAndBeginSave(page, index) {
  const mapButtons = page.getByRole('button', { name: 'ОТКРЫТЬ КАРТУ →', exact: true });
  const cards = page.locator('div.glass.rounded-lg.p-4').filter({ has: mapButtons });
  const name = await cards.nth(index).locator('h4').innerText();
  await mapButtons.nth(index).click();
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  return name;
}

// Assumes "Save to Client" was just clicked (client-select list showing).
async function finishSaveAsNewClient(page, clientName) {
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill(clientName);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
}

// Assumes "Save to Client" was just clicked (client-select list showing).
async function finishSaveToExistingClient(page, clientName) {
  await page.getByRole('button').filter({ hasText: clientName }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
}

async function openClientCard(page, name) {
  await page.getByRole('button', { name: 'Клиенты', exact: true }).click();
  await page.getByRole('button').filter({ hasText: name }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('real analysis: Client Card Visit History, Visit Detail with historical Lash Map, and reload persistence', async ({ page }) => {
  test.setTimeout(180000);
  const name = 'Synthetic CLIENT-4 E2E';

  // ---- Visit 1: new client, a specific (non-top) design ----
  await analyze(page);
  const design1 = await openNthDesignMapAndBeginSave(page, 1);
  await finishSaveAsNewClient(page, name);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

  // A/B. Client Card renders the real Visit History with exactly one visit.
  await expect(page.getByText('История визитов', { exact: true })).toBeVisible();
  await expect(page.getByText('История визитов пока пуста', { exact: true })).not.toBeVisible();
  const historyButtons = page.locator('button').filter({ hasText: design1 });
  await expect(historyButtons).toHaveCount(1);

  // E. Opening the visit shows the correct historical design + map.
  await historyButtons.first().click();
  await expect(page.getByRole('heading', { name: 'Визит', exact: true })).toBeVisible();
  await expect(page.getByText(design1, { exact: false })).toBeVisible();
  await expect(page.getByText('ЛЕВЫЙ ГЛАЗ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ПРАВЫЙ ГЛАЗ', { exact: true }).first()).toBeVisible();
  await expect(page.locator('svg path[data-diagram-lash-profile-line="true"]')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/client4-visit-detail-390x844.png' });

  // F. Back returns to the SAME Client Card.
  await clickBack(page);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

  // ---- Visit 2: existing client, a DIFFERENT design ----
  await analyze(page);
  const design2 = await openNthDesignMapAndBeginSave(page, 0);
  expect(design2).not.toBe(design1);
  await finishSaveToExistingClient(page, name);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

  // C. Multiple visits, newest first.
  await expect(page.getByText('Всего визитов', { exact: true }).locator('..')).toContainText('2');
  const allCards = page.locator('button').filter({ hasText: /mm/ });
  const firstCardText = await allCards.first().innerText();
  expect(firstCardText.toUpperCase()).toContain(design2.toUpperCase());
  await page.screenshot({ path: 'test-results/client4-client-card-multi-visit-390x844.png' });

  // G/H/I/J/K. Opening each visit shows its OWN distinct snapshot -- no leakage.
  await page.locator('button').filter({ hasText: design2 }).first().click();
  await expect(page.getByText(design2, { exact: false })).toBeVisible();
  await clickBack(page);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.locator('button').filter({ hasText: design1 }).first().click();
  await expect(page.getByText(design1, { exact: false })).toBeVisible();
  await expect(page.getByText(design2, { exact: false })).not.toBeVisible();

  // P. Reload -> reopen client -> reopen a Visit -> history still exists
  // (real IndexedDB, not the in-memory fallback).
  await page.reload();
  await openClientCard(page, name);
  await expect(page.getByText('Всего визитов', { exact: true }).locator('..')).toContainText('2');
  await page.locator('button').filter({ hasText: design1 }).first().click();
  await expect(page.getByRole('heading', { name: 'Визит', exact: true })).toBeVisible();
  await expect(page.getByText(design1, { exact: false })).toBeVisible();
});

test('a client with zero visits shows the clean empty state, not fabricated history', async ({ page }) => {
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  await page.getByRole('button', { name: 'Клиенты', exact: true }).click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill('Synthetic CLIENT-4 Empty');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible().catch(() => false)) await consent.click();
  await expect(page.getByRole('heading', { name: 'Synthetic CLIENT-4 Empty', exact: true })).toBeVisible();
  await expect(page.getByText('История визитов пока пуста', { exact: true })).toBeVisible();
});
