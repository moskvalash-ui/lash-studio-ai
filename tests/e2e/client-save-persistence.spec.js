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
  const mapButtons = page.getByRole('button', { name: 'ОТКРЫТЬ КАРТУ →', exact: true });
  // Read the top recommendation from rendered UI, never inject analysis.
  const cards = page.locator('div.glass.rounded-lg.p-4').filter({ has: mapButtons });
  const topName = await cards.first().locator('h4').innerText();
  await mapButtons.nth(1).click();
  await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
  await chooseNew(page, 'Synthetic CLIENT-3 E2E');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Визит сохранён', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic CLIENT-3 E2E', exact: true })).toBeVisible();
  const first = await reopen(page, 'Synthetic CLIENT-3 E2E', 1);
  expect(first.visits[0].designSnapshot.display.name.toUpperCase()).toBe(topName);
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
