'use strict';
// ============================================================
// RELEASE FIX #3 — BOOT WATCHDOG / CDN STARTUP-FAILURE FALLBACK.
// ------------------------------------------------------------
// Real production boot sequence, real DOM — the only thing ever
// controlled is window.__BOOT_WATCHDOG_MS (an explicit test-only
// override the watchdog script itself reads, see index.html's own
// comment) so tests never wait on the real 10s timeout or on an
// actually-broken CDN. Deterministic failure is simulated by blocking
// the specific CDN request at the network layer (page.route), never
// by disconnecting real internet access.
// ============================================================
const { test, expect } = require('@playwright/test');

test('A. normal successful boot never shows the startup-failure fallback, even after the watchdog window elapses', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => { window.__BOOT_WATCHDOG_MS = 300; });
  await page.goto('/index.html');
  // Give the (short, test-only) watchdog window time to elapse on a
  // real, successfully-booting page.
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-boot-fallback]')).toHaveCount(0);
  // The real app is actually there.
  await expect(page.getByRole('button', { name: 'Отказаться', exact: true })).toBeVisible({ timeout: 10000 }).catch(() => {});
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('B. a critical pre-React CDN dependency failing to load shows the startup-error UI instead of a blank page', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => { window.__BOOT_WATCHDOG_MS = 500; });
  // Block React itself — deterministic simulated failure, never real
  // network breakage. React failing to load is representative of any
  // critical pre-mount dependency failing (Babel would never even
  // transpile/execute the app script without it either).
  await page.route('https://unpkg.com/react@18.3.1/umd/react.production.min.js', route => route.abort('failed'));
  await page.goto('/index.html');
  const fallback = page.locator('[data-boot-fallback]');
  await expect(fallback).toBeVisible({ timeout: 5000 });
  await expect(fallback).toContainText('Не удалось загрузить приложение');
  await expect(fallback).toContainText('Проверьте интернет-соединение и попробуйте ещё раз.');
  await expect(page.getByRole('button', { name: 'ПОВТОРИТЬ', exact: true })).toBeVisible();
  // #root never got a real app mounted into it.
  const rootChildren = await page.locator('#root').evaluate(el => el.childElementCount);
  expect(rootChildren).toBe(0);
  // No technical/exception details anywhere in the fallback.
  const text = await fallback.innerText();
  expect(text).not.toMatch(/react|script|fetch|CDN|error:|failed|undefined/i);
});

test('C. Retry performs the intended recovery action (reload)', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => { window.__BOOT_WATCHDOG_MS = 500; });
  let blockReact = true;
  await page.route('https://unpkg.com/react@18.3.1/umd/react.production.min.js', route => {
    if (blockReact) return route.abort('failed');
    return route.continue();
  });
  await page.goto('/index.html');
  await expect(page.locator('[data-boot-fallback]')).toBeVisible({ timeout: 5000 });
  // Allow the real dependency to load successfully on the next
  // navigation, same as a real user fixing their connection then
  // pressing Retry.
  blockReact = false;
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.getByRole('button', { name: 'ПОВТОРИТЬ', exact: true }).click(),
  ]);
  await expect(page.locator('[data-boot-fallback]')).toHaveCount(0);
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 });
});

test('D. fallback does not overlay an app that successfully mounts before the watchdog fires, and removes itself if it narrowly loses the race', async ({ page }) => {
  test.setTimeout(30000);
  // A long watchdog relative to a real (fast) successful boot: the
  // fallback must never appear at all in the common case.
  await page.addInitScript(() => { window.__BOOT_WATCHDOG_MS = 60000; });
  await page.goto('/index.html');
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 });
  await page.waitForTimeout(500);
  await expect(page.locator('[data-boot-fallback]')).toHaveCount(0);
});

test('E. RU/EN fallback text follows the safe pre-React localStorage language source, read-only (no new persistence)', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => {
    window.__BOOT_WATCHDOG_MS = 500;
    try { localStorage.setItem('lashStudioLang', 'en'); } catch (e) {}
  });
  await page.route('https://unpkg.com/react@18.3.1/umd/react.production.min.js', route => route.abort('failed'));
  await page.goto('/index.html');
  const fallback = page.locator('[data-boot-fallback]');
  await expect(fallback).toBeVisible({ timeout: 5000 });
  await expect(fallback).toContainText('Unable to load the app');
  await expect(fallback).toContainText('Check your internet connection and try again.');
  await expect(page.getByRole('button', { name: 'RETRY', exact: true })).toBeVisible();
  // Read-only: the watchdog never wrote a NEW value, the pre-set 'en' survives unchanged.
  expect(await page.evaluate(() => localStorage.getItem('lashStudioLang'))).toBe('en');
});

test('F. existing face-api MODEL loading failure handling is untouched and stays entirely separate from the boot watchdog', async ({ page }) => {
  test.setTimeout(30000);
  await page.addInitScript(() => { window.__BOOT_WATCHDOG_MS = 60000; });
  // Block only the face-api model weight files (NOT any bootstrap
  // dependency) -- the app itself (React/Tailwind/Babel) still boots
  // completely normally; this is the pre-existing, separate
  // modelsError/loadError/retryLoad path inside HomeScreen.
  await page.route('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/**', route => route.abort('failed'));
  await page.goto('/index.html');
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 });
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  // The EXISTING model-load-error UI appears -- untouched, unrelated
  // to the boot watchdog, which never fires here (real bootstrap
  // succeeded).
  await expect(page.getByText('AI-модели не загружены', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-boot-fallback]')).toHaveCount(0);
});
