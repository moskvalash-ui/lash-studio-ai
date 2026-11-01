// Standalone functional-parity check for index.precompiled.html
// (TASK 09, section 6). Mirrors assertions from the REAL E2E specs
// (rtl-arabic-presentation.spec.js, results-design-discovery.spec.js,
// lashmap-back-navigation.spec.js) WITHOUT editing them — this is a
// separate, throwaway script, not part of tests/.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));
const assert = require('assert');

const BASE = 'http://localhost:8935/index.precompiled.html';

async function check(name, fn) {
  try { await fn(); console.log(`  ok  - ${name}`); return true; }
  catch (e) { console.log(`FAIL  - ${name}\n        ${e.message}`); return false; }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:8935', localStorage: [{ name: 'lashStudioOnboardingSeenV1', value: '1' }] }] },
  });
  const page = await context.newPage();
  const realErrors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('BABEL')) realErrors.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => realErrors.push('PAGEERROR: ' + e.message.slice(0, 150)));

  let pass = 0, total = 0;
  const run = async (name, fn) => { total++; if (await check(name, fn)) pass++; };

  await page.goto(BASE);
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();

  await run('RU initial: lang=ru dir=ltr', async () => {
    await page.locator('html').getAttribute('lang').then(v => assert.strictEqual(v, 'ru'));
    await page.locator('html').getAttribute('dir').then(v => assert.strictEqual(v, 'ltr'));
  });

  await run('RU -> EN: lang=en dir=ltr', async () => {
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    const { expect } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  await run('EN -> AR: lang=ar dir=rtl + localStorage persists', async () => {
    const { expect } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));
    await page.getByRole('button', { name: 'العربية', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const stored = await page.evaluate(() => localStorage.getItem('lashStudioLang'));
    assert.strictEqual(stored, 'ar');
  });

  await run('reload preserves Arabic (lang=ar dir=rtl)', async () => {
    const { expect } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', { timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  await run('AR -> RU restores dir=ltr', async () => {
    const { expect } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));
    await page.getByRole('button', { name: 'RU', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  await run('Photo Analysis button reachable, opens upload flow', async () => {
    const btn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();
    // after click, expect to land on photo analysis screen (file input or upload prompt present)
    await page.waitForTimeout(500);
    const hasFileInput = await page.locator('input[type="file"]').count();
    assert.ok(hasFileInput >= 1, 'expected a file input on Photo Analysis screen');
  });

  await run('Lash Map Library reachable (no camera/photo needed)', async () => {
    // SPA uses a `screen` state string, not real URL routing (see
    // CLAUDE.md Architecture) -- goBack() has no history entry to
    // return to. Fresh navigation to Home instead.
    await page.goto(BASE);
    await page.waitForTimeout(300);
    const libBtn = page.getByRole('button', { name: 'Библиотека Lash Map', exact: true });
    await libBtn.waitFor({ state: 'visible', timeout: 10000 });
    await libBtn.click();
    await page.waitForTimeout(500);
    const bodyText = await page.locator('body').innerText();
    assert.ok(bodyText.length > 100, 'Lash Map Library screen should render real content');
  });

  await run('Photo Analysis -> Hero -> alternative effect (3rd card) opens its own Lash Map', async () => {
    const fixture = path.join(__dirname, '..', 'tests/e2e/fixtures/happy-path-face.png');
    await page.goto(BASE);
    const photo = page.getByRole('button', { name: 'Анализ по фото', exact: true });
    await photo.waitFor({ state: 'visible', timeout: 10000 });
    await photo.click();
    await page.locator('input[type=file]').setInputFiles(fixture);
    await page.getByText('Подтверждение анализа', { exact: true }).waitFor({ state: 'visible', timeout: 45000 });
    await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();
    const heroHeading = page.getByRole('heading', { level: 1 });
    await heroHeading.waitFor({ state: 'visible', timeout: 15000 });

    const cards = page.locator('[data-alt-carousel] [data-alt-design-id]');
    const count = await cards.count();
    assert.strictEqual(count, 5, `expected exactly 5 alternative cards, got ${count}`);

    const targetCard = cards.nth(2);
    const targetId = await targetCard.getAttribute('data-alt-design-id');
    await targetCard.scrollIntoViewIfNeeded();
    await targetCard.click();
    await page.getByText('Профессиональная Lash Map', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(targetId, 'clicked alternative card must carry a design id');
  });

  console.log(`\n${pass}/${total} functional checks passed.`);
  console.log(`Non-BABEL console/page errors observed: ${realErrors.length}`);
  realErrors.forEach(e => console.log('  ', e));

  await browser.close();
  if (pass !== total || realErrors.length > 0) process.exitCode = 1;
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
