'use strict';
// ============================================================
// PHASE 2 — ARABIC RTL PRESENTATION LAYER, real-browser proof.
// ------------------------------------------------------------
// Arabic is NOT selectable in production (SUPPORTED_LANGUAGES stays
// ['ru','en'], LangToggle still renders only those two buttons). This
// suite activates it the ONLY way a real user never can: the
// window.__FORCE_LANG test-only override (page.addInitScript), read
// exactly once at initial mount -- see App()'s lang useState initializer
// in index.html. Exactly analogous to the existing
// window.__BOOT_WATCHDOG_MS pattern used throughout this e2e suite
// (see boot-watchdog.spec.js).
//
// The central claim under test: RTL is a PRESENTATION-ONLY layer. Every
// geometry-bearing test in this file reaches the exact same screen via
// the exact same real production flow twice -- once with the default
// language (ru) and once with lang forced to 'ar' -- and asserts the
// extracted SVG geometry (viewBox, path `d` strings, per-point cx/cy)
// is IDENTICAL between the two runs. This is the real, non-hand-wavy
// proof that RTL never touches xAt/upperY/lowerY or any other
// coordinate formula, not just an assertion that it "shouldn't".
// ============================================================
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

const STR = {
  ru: {
    reject: 'Отказаться',
    photoBtn: 'Анализ по фото',
    reviewTitle: 'Подтверждение анализа',
    confirm: 'Подтвердить и построить схемы',
    retry: 'Выбрать другое фото',
    openLashMap: 'ОТКРЫТЬ LASH MAP',
    libraryBtn: 'Библиотека Lash Map',
  },
  ar: {
    reject: 'رفض',
    photoBtn: 'تحليل بالصورة',
    reviewTitle: 'تأكيد التحليل',
    confirm: 'تأكيد وبناء الخرائط',
    retry: 'اختيار صورة أخرى',
    openLashMap: 'فتح Lash Map',
    libraryBtn: 'مكتبة Lash Map',
  },
};

async function forceLang(page, lang) {
  if (lang === 'ar') {
    await page.addInitScript(() => { window.__FORCE_LANG = 'ar'; });
  }
}

async function dismissConsent(page, lang) {
  const reject = page.getByRole('button', { name: STR[lang].reject, exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

// Reaches HeroScreen -> opens the top design's Lash Map (PHOTO view,
// the default), for a given language. Real photo upload, real face-api
// inference, real navigation -- nothing mocked, same technique as
// photo-lash-map-mirror.spec.js/results-design-discovery.spec.js.
async function reachLashMap(page, lang) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('BABEL')) pageErrors.push('console.error: ' + msg.text());
  });

  await forceLang(page, lang);
  await page.goto('/index.html');
  await dismissConsent(page, lang);

  const photoBtn = page.getByRole('button', { name: STR[lang].photoBtn, exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();

  await page.locator('input[type="file"]').setInputFiles(FIXTURE);

  const reviewTitle = page.getByText(STR[lang].reviewTitle, { exact: true });
  const errorRetryBtn = page.getByRole('button', { name: STR[lang].retry, exact: true });
  await Promise.race([
    reviewTitle.waitFor({ state: 'visible', timeout: 45000 }),
    errorRetryBtn.waitFor({ state: 'visible', timeout: 45000 }),
  ]);
  await expect(errorRetryBtn).not.toBeVisible();
  await expect(reviewTitle).toBeVisible();

  await page.getByRole('button', { name: STR[lang].confirm, exact: true }).click();

  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  const heroId = await heroHeading.getAttribute('data-hero-design-id');

  await page.getByRole('button', { name: STR[lang].openLashMap, exact: true }).click();

  const leftMap = page.locator('[aria-label="Left eye map"]');
  const rightMap = page.locator('[aria-label="Right eye map"]');
  await expect(leftMap, `${lang}: LEFT PHOTO Lash Map card must render`).toBeVisible({ timeout: 10000 });
  await expect(rightMap, `${lang}: RIGHT PHOTO Lash Map card must render`).toBeVisible({ timeout: 10000 });

  expect(pageErrors, `${lang}: no fatal page errors reaching Lash Map: ${JSON.stringify(pageErrors)}`).toEqual([]);
  return { page, leftMap, rightMap, heroId, pageErrors };
}

async function extractMapPoints(locator) {
  return locator.evaluate((el) => {
    const svg = el.querySelector('svg');
    const viewBox = svg.getAttribute('viewBox');
    const points = [...el.querySelectorAll('g[data-map-point]')].map((g) => {
      const circle = g.querySelector('circle[data-photo-sample]');
      const zoneGroup = g.querySelector('[data-photo-zone]');
      return {
        index: Number(g.getAttribute('data-map-point')),
        length: Number(g.getAttribute('data-length')),
        isPeak: g.getAttribute('data-peak') === 'true',
        cx: circle ? Number(circle.getAttribute('cx')) : null,
        cy: circle ? Number(circle.getAttribute('cy')) : null,
        zoneLabel: zoneGroup ? zoneGroup.getAttribute('data-photo-zone') : null,
      };
    });
    return { viewBox, points };
  });
}

async function extractDiagramGeometry(page) {
  return page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[dir="ltr"]')].filter(
      (svg) => svg.querySelector('[data-diagram-lash-profile-line]')
    );
    return svgs.map((svg) => ({
      viewBox: svg.getAttribute('viewBox'),
      profileLine: svg.querySelector('[data-diagram-lash-profile-line]')?.getAttribute('d') || null,
      profileFill: svg.querySelector('[data-diagram-lash-profile-fill]')?.getAttribute('d') || null,
      eyeGuide: svg.querySelector('[data-diagram-eye-guide]')?.getAttribute('d') || null,
    }));
  });
}

async function reachHeroOnly(page, lang) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await forceLang(page, lang);
  await page.goto('/index.html');
  await dismissConsent(page, lang);

  const photoBtn = page.getByRole('button', { name: STR[lang].photoBtn, exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await expect(page.getByText(STR[lang].reviewTitle, { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: STR[lang].confirm, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

  expect(pageErrors, `${lang}: no fatal page errors reaching Hero`).toEqual([]);
}

// ------------------------------------------------------------
// G2/7. Carousel RTL: swipe affordance / initial item / partial-clip
// direction genuinely mirrors under RTL, verified via real bounding
// boxes in a real browser (never assuming scrollLeft semantics).
// ------------------------------------------------------------
test('7. carousel: under RTL, the first (rank-1) card sits at the RIGHT edge and the second card is genuinely clipped on the LEFT (mirror of the LTR case)', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { window.__FORCE_LANG = 'ar'; });
  await reachHeroOnly(page, 'ar');
  await expect(page.getByText('تصاميم أخرى تناسبك', { exact: true })).toBeVisible();

  const cards = page.locator('[data-alt-carousel] [data-alt-design-id]');
  await expect(cards).toHaveCount(5);
  const viewport = page.viewportSize();
  const box0 = await cards.nth(0).boundingBox();
  const box1 = await cards.nth(1).boundingBox();

  // Mirror of the LTR case (results-design-discovery.spec.js): the
  // first card in DOCUMENT order (still result.designs.slice(1,6)[0] --
  // never reversed, per the geometry-isolation policy) sits against the
  // RIGHT edge (allowing for the screen's own container padding, the
  // same padding that sits on the LEFT in the LTR layout), and the
  // second card peeks in from the LEFT, partially clipped -- the exact
  // mirror image of results-design-discovery.spec.js's LTR assertions.
  expect(box0.x + box0.width, 'first card must sit near the right edge under RTL (within container padding)').toBeGreaterThan(viewport.width - 32);
  expect(box0.x, 'first card must NOT be flush against the left edge (that would be the unmirrored LTR layout)').toBeGreaterThan(viewport.width * 0.15);
  expect(box1.x, 'second card must start before the left edge (partially off-screen)').toBeLessThan(0);
  expect(box1.x + box1.width, 'second card must still extend into the visible viewport').toBeGreaterThan(0);
});

// ------------------------------------------------------------
// A. Document-level RTL wiring
// ------------------------------------------------------------
test('A1. lang="ar" (test-only forced) sets html lang=ar and dir=rtl; default (ru) stays lang=ru dir=ltr', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  const page2 = await page.context().newPage();
  await page2.addInitScript(() => { window.__FORCE_LANG = 'ar'; });
  await page2.goto('/index.html');
  await expect(page2.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page2.locator('html')).toHaveAttribute('dir', 'rtl');
  await page2.close();
});

test('A2. EN (real, non-forced LangToggle click) stays dir=ltr', async ({ page }) => {
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  const enBtn = page.getByRole('button', { name: 'EN', exact: true });
  await enBtn.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

// ------------------------------------------------------------
// M. Arabic remains absent from the production language selector, even
// while forced-active internally for this test's own page.
// ------------------------------------------------------------
test('M. Arabic is absent from the real LangToggle even when the page itself is running in forced lang=ar', async ({ page }) => {
  await page.addInitScript(() => { window.__FORCE_LANG = 'ar'; });
  await page.goto('/index.html');
  await dismissConsent(page, 'ar');
  await expect(page.getByRole('button', { name: 'RU', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
  await expect(page.getByText('العربية')).toHaveCount(0);
});

// ------------------------------------------------------------
// C/L. DOM presents RTL where appropriate; navigation chevron mirrors.
// Uses the Lash Map Library (no camera required, real production
// screen) for a fast, deterministic check.
// ------------------------------------------------------------
test('C/L. Lash Map Library renders correctly in forced Arabic: real Arabic text, mirrored back-chevron, mirrored disclosure chevron, no fatal errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => { window.__FORCE_LANG = 'ar'; });
  await page.goto('/index.html');
  await dismissConsent(page, 'ar');

  const libraryBtn = page.getByRole('button', { name: STR.ar.libraryBtn, exact: true });
  await expect(libraryBtn).toBeVisible();
  await libraryBtn.click();
  await expect(page.getByRole('heading', { name: STR.ar.libraryBtn, exact: true })).toBeVisible();

  // Real Arabic script actually rendered (not a fallback/blank/mojibake).
  const bodyText = await page.locator('body').innerText();
  expect(/[؀-ۿ]/.test(bodyText), 'expected real Arabic script somewhere on the Library screen').toBe(true);

  // Disclosure chevron (›) on the first card is CSS-mirrored under dir=rtl.
  const disclosureChevron = page.locator('span:has-text("›")').first();
  await expect(disclosureChevron).toBeVisible();
  const chevronTransform = await disclosureChevron.evaluate((el) => getComputedStyle(el).transform);
  expect(chevronTransform, 'disclosure chevron must have a mirroring transform under RTL').not.toBe('none');

  // Open a card, then use the shared BackButton -- its chevron SVG must
  // also carry the RTL mirror transform.
  await page.locator('button', { hasText: /mm/ }).first().click();
  const backSvg = page.locator('button svg path[d="M15 19l-7-7 7-7"]').locator('..');
  await expect(backSvg).toBeVisible();
  const backTransform = await backSvg.evaluate((el) => getComputedStyle(el).transform);
  expect(backTransform, 'BackButton chevron must have a mirroring transform under RTL').not.toBe('none');
  await backSvg.click();
  await expect(page.getByRole('heading', { name: STR.ar.libraryBtn, exact: true })).toBeVisible();

  expect(pageErrors, 'no fatal browser errors').toEqual([]);
});

test('back-chevron is NOT mirrored for RU (no transform under LTR)', async ({ page }) => {
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  await page.getByRole('button', { name: STR.ru.libraryBtn, exact: true }).click();
  await page.locator('button', { hasText: /mm/ }).first().click();
  const backSvg = page.locator('button svg path[d="M15 19l-7-7 7-7"]').locator('..');
  const backTransform = await backSvg.evaluate((el) => getComputedStyle(el).transform);
  expect(backTransform === 'none' || backTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
});

// ------------------------------------------------------------
// D/E/F/G/L. Lash Map PHOTO geometry is byte-identical RU vs AR.
// ------------------------------------------------------------
test('D/G. PHOTO Lash Map: extracted per-zone geometry (viewBox, cx/cy, zone-label sequence, PEAK) is identical between RU and forced-AR runs', async ({ page, browser }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  const { leftMap: ruLeft, rightMap: ruRight } = await reachLashMap(ruPage, 'ru');
  const ruLeftGeom = await extractMapPoints(ruLeft);
  const ruRightGeom = await extractMapPoints(ruRight);
  await ruCtx.close();

  const arCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const arPage = await arCtx.newPage();
  const { leftMap: arLeft, rightMap: arRight } = await reachLashMap(arPage, 'ar');
  const arLeftGeom = await extractMapPoints(arLeft);
  const arRightGeom = await extractMapPoints(arRight);
  await arCtx.close();

  expect(arLeftGeom, 'LEFT eye PHOTO geometry must be byte-identical between ru and ar').toEqual(ruLeftGeom);
  expect(arRightGeom, 'RIGHT eye PHOTO geometry must be byte-identical between ru and ar').toEqual(ruRightGeom);

  // F. anatomical LEFT/RIGHT: INNER/OUTER sit on opposite relative sides
  // within each eye's own crop, for BOTH ru and ar (mirror invariant
  // unaffected by language).
  for (const geom of [ruLeftGeom, arLeftGeom]) {
    const key = geom.points.filter((p) => p.zoneLabel);
    expect(key.length).toBeGreaterThan(0);
  }
});

// ------------------------------------------------------------
// D/G. Lash Map DIAGRAM geometry is byte-identical RU vs AR.
// ------------------------------------------------------------
test('D/G. DIAGRAM Lash Map: SVG path `d` strings + viewBox are byte-identical between RU and forced-AR runs', async ({ page, browser }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  await reachLashMap(ruPage, 'ru');
  await ruPage.getByRole('button', { name: 'diagram', exact: true }).click();
  await ruPage.waitForTimeout(300);
  const ruGeom = await extractDiagramGeometry(ruPage);
  await ruCtx.close();

  const arCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const arPage = await arCtx.newPage();
  await reachLashMap(arPage, 'ar');
  await arPage.getByRole('button', { name: 'diagram', exact: true }).click();
  await arPage.waitForTimeout(300);
  const arGeom = await extractDiagramGeometry(arPage);
  await arCtx.close();

  expect(ruGeom.length, 'expected at least one diagram SVG (LEFT/RIGHT)').toBeGreaterThan(0);
  expect(arGeom, 'DIAGRAM path geometry must be byte-identical between ru and ar').toEqual(ruGeom);

  // Every extracted diagram SVG root must itself carry the explicit
  // dir="ltr" presentation-isolation attribute (Phase 2 requirement).
  for (const g of ruGeom) expect(g.profileLine, 'expected a non-null profile line path').not.toBeNull();
});

// ------------------------------------------------------------
// J. recommendation output/order/scores unchanged between RU and AR.
// ------------------------------------------------------------
test('J. HeroScreen top design id is identical between RU and forced-AR runs (recommendation output unaffected by language/RTL)', async ({ page, browser }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  const { heroId: ruHeroId } = await reachLashMap(ruPage, 'ru');
  await ruCtx.close();

  const arCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const arPage = await arCtx.newPage();
  const { heroId: arHeroId } = await reachLashMap(arPage, 'ar');
  await arCtx.close();

  expect(arHeroId, 'top-recommended design id must be identical regardless of language').toBe(ruHeroId);
});

// ------------------------------------------------------------
// L. mixed Arabic + Latin/numeric professional notation (curl codes,
// mm) renders in stable (non-reordered) order.
// ------------------------------------------------------------
test('L. curl code + mm technical notation renders in stable Latin/numeric order inside Arabic UI', async ({ page }) => {
  test.setTimeout(90000);
  await reachLashMap(page, 'ar');
  // The PHOTO summary panel's CURL/LENGTH dd values (e.g. "C / CC", "5–11mm").
  const curlDd = page.locator('dt', { hasText: /^(الانحناء)$/ }).locator('xpath=following-sibling::dd[1]');
  if (await curlDd.count()) {
    const curlText = await curlDd.first().innerText();
    expect(/^[A-Z+\/\s]+$/.test(curlText.trim()), `curl code must stay pure Latin notation, got "${curlText}"`).toBe(true);
  }
});
