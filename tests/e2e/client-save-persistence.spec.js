'use strict';
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
async function chooseNew(page, name) {
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Сохранять данные на этом устройстве', exact: true });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: '+ Новый клиент', exact: true }).click();
  await page.locator('input[type=text]').first().fill(name);
}
async function records(page) {
  return page.evaluate(async () => {
    const store = ClientStore.createClientStore();
    const clients = await store.listClients();
    return { mode: await store.whenReady(), clients, visits: clients.length ? await store.listVisitsForClient(clients[0].id) : [] };
  });
}
async function reopen(page, name, count) {
  await page.reload();
  await page.getByRole('button', { name: 'Клиенты', exact: true }).click();
  await page.getByRole('button').filter({ hasText: name }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Всего визитов', { exact: true }).locator('..')).toContainText(String(count));
  const data = await records(page);
  expect(data.mode).toBe('indexeddb');
  expect(data.clients).toHaveLength(1);
  expect(data.visits).toHaveLength(count);
  expect([...data.clients[0].visitIds].sort()).toEqual(data.visits.map(v => v.id).sort());
  return data;
}
test('real analysis: Hero selection, new client durability, existing client append and reload', async ({ page }) => {
  test.setTimeout(180000);
  await analyze(page);
  // Read the top recommendation's CANONICAL identity from the real
  // rendered Results Hero, never inject analysis. data-hero-design-id is
  // a presentation-layer-only test hook (see index.html HeroScreen) that
  // exposes the canonical id independent of display text — needed since
  // RESULTS HERO V1 can show a RU-only presentation label ("Лисий" for
  // fox) that intentionally differs from the persisted canonical name.
  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible();
  const topDesignId = await heroHeading.getAttribute('data-hero-design-id');
  expect(topDesignId).toBeTruthy();
  // Click a DIFFERENT (non-best) design's map, then go back to Hero and
  // save from there, proving Hero always saves its current #1
  // recommendation regardless of what was last viewed on the map (see
  // tests/save-to-client-flow.test.js and the comment on
  // App()'s handleSaveToClient). The alternatives carousel RESULTS
  // DESIGN DISCOVERY added is itself the same result.designs.slice(1,6)
  // list the old plain-card list rendered -- each card is now the
  // clickable element directly (data-alt-design-id), rank 0/Hero
  // excluded either way -- so .nth(1) still opens a genuinely
  // non-best, non-rank-0 design's map.
  const altCards = page.locator('[data-alt-carousel] [data-alt-design-id]');
  await altCards.nth(1).click();
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await chooseNew(page, 'Synthetic CLIENT-3 E2E');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic CLIENT-3 E2E', exact: true })).toBeVisible();
  const first = await reopen(page, 'Synthetic CLIENT-3 E2E', 1);
  expect(first.visits[0].designSnapshot.designId).toBe(topDesignId);
  expect(first.visits[0].designSnapshot.recommendation.rank).toBe(0);
  await analyze(page);
  await page.getByRole('button', { name: 'Сохранить клиентке', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Synthetic CLIENT-3 E2E' }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
  const second = await reopen(page, 'Synthetic CLIENT-3 E2E', 2);
  expect(second.visits.find(v => v.id === first.visits[0].id)).toEqual(first.visits[0]);
});
test('real analysis: aborted visit shows failure, then retry keeps one client and one committed visit', async ({ page }) => {
  test.setTimeout(120000);
  await analyze(page);
  await chooseNew(page, 'Synthetic CLIENT-3 retry');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    window.__visitAborted = false;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'visits' && !window.__visitAborted) {
        const tx = this.transaction;
        request.addEventListener('success', () => {
          window.__visitAborted = true;
          tx.abort();
          IDBObjectStore.prototype.put = original;
        }, { once: true });
      }
      return request;
    };
  });
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Не удалось сохранить визит. Попробуйте ещё раз.', { exact: true })).toBeVisible();
  await expect(page.getByText('Визит сохранён', { exact: true })).not.toBeVisible();
  const failed = await records(page);
  expect(await page.evaluate(() => window.__visitAborted)).toBe(true);
  expect(failed.clients).toHaveLength(1);
  expect(failed.clients[0].visitIds).toEqual([]);
  expect(failed.visits).toHaveLength(0);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
  const saved = await reopen(page, 'Synthetic CLIENT-3 retry', 1);
  expect(saved.clients[0].id).toBe(failed.clients[0].id);
});
