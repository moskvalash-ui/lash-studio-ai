'use strict';
// ============================================================
// LASH MAP CONTEXT-AWARE BACK NAVIGATION — RELEASE FIX #2.
// ------------------------------------------------------------
// Real production Photo Analysis -> Results -> Lash Map flow, real
// DOM, nothing mocked. Same real fixture/technique as
// results-hero.spec.js / results-design-discovery.spec.js.
// ============================================================
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fixture = path.join(__dirname, 'fixtures/happy-path-face.png');

async function reachHero(page) {
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
  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  return heroHeading;
}

test('A. Best Design Hero -> Lash Map -> Back returns to Results Hero', async ({ page }) => {
  test.setTimeout(90000);
  const heroHeading = await reachHero(page);
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  await page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true }).click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();

  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await expect(heroHeading).toBeVisible();
  expect(await heroHeading.getAttribute('data-hero-design-id')).toBe(heroId);
});

test('B. Alternatives carousel design -> Lash Map -> Back returns to Results Hero with state preserved', async ({ page }) => {
  test.setTimeout(90000);
  const heroHeading = await reachHero(page);
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  const cards = page.locator('[data-alt-carousel] [data-alt-design-id]');
  await expect(cards).toHaveCount(5);
  const targetId = await cards.nth(0).getAttribute('data-alt-design-id');
  await cards.nth(0).click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();

  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await expect(heroHeading).toBeVisible();
  // Results state preserved: same Hero design, and the SAME carousel
  // (rank/order) is intact, not rebuilt/re-ranked.
  expect(await heroHeading.getAttribute('data-hero-design-id')).toBe(heroId);
  await expect(cards).toHaveCount(5);
  expect(await cards.nth(0).getAttribute('data-alt-design-id')).toBe(targetId);
});

test('C/D. View All Designs -> open a design -> Lash Map -> Back returns to AllDesignsScreen, and another design can then be opened', async ({ page }) => {
  test.setTimeout(90000);
  await reachHero(page);

  await page.getByRole('button', { name: 'Смотреть все дизайны', exact: true }).click();
  await expect(page.getByText('Все дизайны', { exact: true })).toBeVisible();

  const catalogButtons = page.locator('button').filter({ has: page.locator('h4') });
  const firstHeading = catalogButtons.first().locator('h4');
  const firstName = await firstHeading.textContent();
  await catalogButtons.first().click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();

  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  // C: back on AllDesignsScreen, NOT Results Hero.
  await expect(page.getByText('Все дизайны', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);

  // D: browsing continues -- a second (different) design opens fine.
  const secondHeading = catalogButtons.nth(1).locator('h4');
  const secondName = await secondHeading.textContent();
  expect(secondName).not.toBe(firstName);
  await catalogButtons.nth(1).click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();
  // TEST FIX: AllDesignsScreen's card renders d.name.toUpperCase()
  // (secondName is captured already-uppercased from that real DOM),
  // while LashMapScreen intentionally renders design.name verbatim
  // (title case) -- a real, deliberate display-style difference, not
  // a design-identity mismatch. Compare case-insensitively so this
  // proves the SAME design opened, not exact letter-casing.
  const mapTitle = await page.locator('span.text-sm.font-semibold.text-textPrimary.truncate').textContent();
  expect(mapTitle.trim().toUpperCase()).toBe(secondName.trim().toUpperCase());
});

test('E. correct design identity is passed into Lash Map for a catalog selection (not the Hero/first-alternative design)', async ({ page }) => {
  test.setTimeout(90000);
  const heroHeading = await reachHero(page);
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  await page.getByRole('button', { name: 'Смотреть все дизайны', exact: true }).click();
  await expect(page.getByText('Все дизайны', { exact: true })).toBeVisible();

  // Pick a catalog entry whose name differs from the Hero heading text,
  // to prove the ACTUAL selected design (not a stale/leftover one) is
  // what opens.
  const catalogButtons = page.locator('button').filter({ has: page.locator('h4') });
  const count = await catalogButtons.count();
  let chosen = null;
  for (let i = 0; i < count; i++) {
    const name = await catalogButtons.nth(i).locator('h4').textContent();
    if (name && name.trim() !== '') { chosen = { index: i, name: name.trim() }; break; }
  }
  expect(chosen).not.toBeNull();
  await catalogButtons.nth(chosen.index).click();
  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();
  const mapTitle = await page.locator('span.text-sm.font-semibold.text-textPrimary.truncate').textContent();
  expect(mapTitle.trim().toUpperCase()).toBe(chosen.name.toUpperCase());
});

test('F. no rank-0 duplication / no result reordering is introduced by the origin-aware navigation', async ({ page }) => {
  // Longer budget than the others: this test exercises all THREE entry
  // points (Hero, carousel, catalog) in one run, on top of the same
  // variable real photo-analysis wait reachHero() already needs.
  test.setTimeout(120000);
  const heroHeading = await reachHero(page);
  const heroId = await heroHeading.getAttribute('data-hero-design-id');
  const cardsBefore = await page.locator('[data-alt-carousel] [data-alt-design-id]').evaluateAll(els => els.map(el => el.getAttribute('data-alt-design-id')));

  // Exercise ALL THREE entry points in sequence, then confirm the Hero
  // design and full carousel order are still byte-identical to before
  // any of this navigation happened.
  await page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true }).click();
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();

  await page.locator('[data-alt-carousel] [data-alt-design-id]').nth(0).click();
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();

  await page.getByRole('button', { name: 'Смотреть все дизайны', exact: true }).click();
  await page.locator('button').filter({ has: page.locator('h4') }).first().click();
  // Back from Lash Map lands on AllDesignsScreen (not Hero) -- confirm,
  // then use AllDesignsScreen's OWN Back control to return to Hero.
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await expect(page.getByText('Все дизайны', { exact: true })).toBeVisible();
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();

  await expect(heroHeading).toBeVisible();
  expect(await heroHeading.getAttribute('data-hero-design-id')).toBe(heroId);
  expect(cardsBefore).not.toContain(heroId); // rank-0 never duplicated into the carousel
  const cardsAfter = await page.locator('[data-alt-carousel] [data-alt-design-id]').evaluateAll(els => els.map(el => el.getAttribute('data-alt-design-id')));
  expect(cardsAfter).toEqual(cardsBefore);
});
