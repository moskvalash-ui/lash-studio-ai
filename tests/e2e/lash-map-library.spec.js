'use strict';
// ============================================================
// LASH MAP LIBRARY — production UI E2E.
// ------------------------------------------------------------
// Plain production app, no ?debug= query, no camera required.
// Home -> Lash Map Library -> a reviewed effect -> Back -> a DRAFT
// effect -> "Under review" wording -> no fatal browser errors.
// ============================================================
const { test, expect } = require('@playwright/test');

async function dismissConsent(page) {
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
}

test('Lash Map Library: plain production app -> Library -> reviewed effect -> Back -> DRAFT effect -> no fatal errors', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('BABEL')) errors.push('console.error: ' + msg.text()); });

  // Plain production URL — no ?debug= anywhere in this test.
  await page.goto('/index.html');
  await dismissConsent(page);

  const libraryBtn = page.getByRole('button', { name: 'Библиотека Lash Map', exact: true });
  await expect(libraryBtn).toBeVisible();
  await libraryBtn.click();
  await expect(page.getByRole('heading', { name: 'Библиотека Lash Map', exact: true })).toBeVisible();
  await expect(page.getByText(/профессиональных карт/)).toBeVisible();

  // At least one reviewed (non-draft) card and one DRAFT ("На проверке") card exist.
  const allCards = page.locator('button').filter({ hasText: /mm/ });
  await expect(allCards.first()).toBeVisible();
  const draftCards = page.locator('button').filter({ hasText: 'На проверке' });
  await expect(draftCards.first()).toBeVisible();
  const reviewedCards = allCards.filter({ hasNotText: 'На проверке' });
  await expect(reviewedCards.first()).toBeVisible();

  // Open a reviewed effect, verify professional map details, then Back.
  await reviewedCards.first().click();
  await expect(page.getByText('Карта Lash Map', { exact: true })).toBeVisible();
  await expect(page.getByText('ЛЕВЫЙ ГЛАЗ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ПРАВЫЙ ГЛАЗ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('База', { exact: true })).toBeVisible();
  await expect(page.getByText('Как выполнить', { exact: true })).toBeVisible();
  await expect(page.getByText('На проверке', { exact: true })).not.toBeVisible();
  const backBtn = page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') });
  await backBtn.click();
  await expect(page.getByRole('heading', { name: 'Библиотека Lash Map', exact: true })).toBeVisible();

  // Open a DRAFT effect, verify the subtle "Under review" wording.
  await draftCards.first().click();
  await expect(page.getByText('На проверке', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Карта Lash Map', { exact: true })).toBeVisible();

  expect(errors, 'no fatal browser errors').toEqual([]);
});

test('Lash Map Library: EN language renders "Under review" and English section labels', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/index.html');
  await dismissConsent(page);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Lash Map Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lash Map Library', exact: true })).toBeVisible();
  const draftCards = page.locator('button').filter({ hasText: 'Under review' });
  await expect(draftCards.first()).toBeVisible();
  await draftCards.first().click();
  await expect(page.getByText('Under review', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('How to execute', { exact: true })).toBeVisible();
});
