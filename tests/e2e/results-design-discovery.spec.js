'use strict';
// ============================================================
// RESULTS DESIGN DISCOVERY — real-browser proof at the project's
// standard 390x844 mobile viewport. Extends the real Photo Analysis ->
// real Results flow already proven in results-hero.spec.js one step
// further, into the alternatives carousel this phase adds directly
// below the unchanged Hero. Nothing is mocked; the SAME real fixture/
// technique as results-hero.spec.js is reused throughout.
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

test('carousel structure: excludes rank 0, exactly 5 cards, canonical score order, next card genuinely partially visible, View All reaches AllDesignsScreen', async ({ page }) => {
  test.setTimeout(90000);
  const heroHeading = await reachHero(page);
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  // A. Section heading is the new Design Discovery copy, immediately
  // below the Hero (not the old "Рекомендуемые дизайны").
  await expect(page.getByText('Ещё подходящие дизайны', { exact: true })).toBeVisible();

  // B. Exactly 5 alternative cards (rankDesigns always returns exactly
  // 6 of the 21 fixed DESIGN_CATALOG entries unconditionally, so
  // slice(1,6) is always exactly 5 for any client), none duplicating
  // the Hero's own rank-0 id.
  const cards = page.locator('[data-alt-carousel] [data-alt-design-id]');
  await expect(cards).toHaveCount(5);
  const cardIds = await cards.evaluateAll(els => els.map(el => el.getAttribute('data-alt-design-id')));
  expect(cardIds).not.toContain(heroId);
  expect(new Set(cardIds).size).toBe(5); // no duplicate designs among the 5

  // C. Canonical ordering preserved: each card's own displayed score is
  // >= the next card's — proving the carousel did not reorder
  // result.designs.slice(1,6), read from the REAL rendered DOM, not
  // asserted from source.
  const scores = await cards.evaluateAll(els => els.map(el => {
    const m = el.textContent.match(/(\d+)%/);
    return m ? parseInt(m[1], 10) : null;
  }));
  expect(scores.every(s => typeof s === 'number')).toBe(true);
  for (let i = 1; i < scores.length; i++) {
    expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
  }

  // D. Swipe affordance: at the real 390px viewport, with the carousel
  // at its natural (unscrolled) position, the SECOND card is only
  // partially inside the viewport's right edge -- proving a visible
  // "there's more" clip, not two full cards or one full card with
  // nothing showing of the next.
  const viewport = page.viewportSize();
  const box0 = await cards.nth(0).boundingBox();
  const box1 = await cards.nth(1).boundingBox();
  expect(box0.x).toBeGreaterThanOrEqual(0);
  expect(box0.x + box0.width).toBeLessThanOrEqual(viewport.width + 1); // first card fully visible
  expect(box1.x).toBeLessThan(viewport.width); // second card has started before the right edge
  expect(box1.x + box1.width).toBeGreaterThan(viewport.width); // ...but is NOT fully visible -- genuinely clipped

  // E. View All reaches the EXISTING AllDesignsScreen (not a new
  // screen) -- proven by its own real title text.
  await page.getByText('Смотреть все дизайны', { exact: true }).click();
  await expect(page.getByText('Все дизайны', { exact: true })).toBeVisible({ timeout: 10000 });
});

test('tapping a non-first alternative opens that exact design\'s own Lash Map, via the existing onViewMap/save-to-client path', async ({ page }) => {
  test.setTimeout(90000);
  await reachHero(page);

  const cards = page.locator('[data-alt-carousel] [data-alt-design-id]');
  await expect(cards).toHaveCount(5);
  // Deliberately the THIRD card (index 2), not the first, to prove this
  // is not hardcoded to whichever card happens to be first.
  const targetCard = cards.nth(2);
  const targetId = await targetCard.getAttribute('data-alt-design-id');
  await targetCard.scrollIntoViewIfNeeded();
  await targetCard.click();

  await expect(page.getByText('Профессиональная Lash Map', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill('Synthetic Design-Discovery E2E');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();

  const saved = await page.evaluate(async () => {
    const store = ClientStore.createClientStore();
    const clients = await store.listClients();
    const client = clients.find(c => c.fullName === 'Synthetic Design-Discovery E2E');
    const visits = await store.listVisitsForClient(client.id);
    return visits[0];
  });
  expect(saved.designSnapshot.designId).toBe(targetId);
  // Card index 2 (third card) maps to rank = i + 1 = 3 in HeroScreen's
  // carousel loop (see index.html's `const rank = i + 1;`).
  expect(saved.designSnapshot.recommendation.rank).toBe(3);
});
