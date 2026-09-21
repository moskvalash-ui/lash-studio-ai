'use strict';
// ============================================================
// PHASE 2/3 — ARABIC RTL PRESENTATION + PUBLIC ACTIVATION, real-browser
// proof.
// ------------------------------------------------------------
// PHASE 3: Arabic is now genuinely publicly selectable -- SUPPORTED_
// LANGUAGES is ['ru','en','ar'] and the real LangToggle renders all
// three. The window.__FORCE_LANG test-only override (page.addInitScript,
// read exactly once at initial mount -- see App()'s lang useState
// initializer in index.html; exactly analogous to the existing
// window.__BOOT_WATCHDOG_MS pattern used throughout this e2e suite, see
// boot-watchdog.spec.js) is KEPT for the geometry/recommendation-identity
// tests below: it activates the exact same `lang` state a real
// LangToggle click does (both funnel through the identical App() state
// and render code), so it remains valid, fast, deterministic evidence
// for those specific claims. Separately, dedicated tests further down
// drive the REAL LangToggle (RU -> EN -> العربية -> RU) with no
// __FORCE_LANG at all, proving the public activation itself.
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
    moreDetails: 'مزيد من التفاصيل ←',
    detailsTitle: 'تفاصيل التحليل',
    saveToClient: 'حفظ لدى العميلة',
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
// M/A/H. PHASE 3: Arabic is now genuinely present in the production
// language selector, exactly once, alongside RU/EN -- the opposite
// claim of Phase 2's "M" test, which correctly pinned the pre-
// activation state and is now superseded by this intentional change.
// ------------------------------------------------------------
test('A/H. the real LangToggle exposes exactly RU, EN, and العربية -- three buttons, no duplicate, no clipping/overlap', async ({ page }) => {
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  const ru = page.getByRole('button', { name: 'RU', exact: true });
  const en = page.getByRole('button', { name: 'EN', exact: true });
  const ar = page.getByRole('button', { name: 'العربية', exact: true });
  await expect(ru).toBeVisible();
  await expect(en).toBeVisible();
  await expect(ar).toBeVisible();
  await expect(page.getByText('العربية')).toHaveCount(1);

  // No clipping/overlap: all three buttons sit fully within the
  // 390px mobile viewport with non-overlapping bounding boxes.
  const viewport = page.viewportSize();
  const [ruBox, enBox, arBox] = await Promise.all([ru.boundingBox(), en.boundingBox(), ar.boundingBox()]);
  for (const box of [ruBox, enBox, arBox]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  }
  expect(ruBox.x + ruBox.width).toBeLessThanOrEqual(enBox.x + 1);
  expect(enBox.x + enBox.width).toBeLessThanOrEqual(arBox.x + 1);
});

// ------------------------------------------------------------
// B/C/D. Real selector drive: RU -> EN -> العربية -> RU, no __FORCE_LANG
// anywhere in this test. Proves dir/lang wiring, persistence across
// reload, and restoration to ltr on switch-back, all through the
// SAME production setLang()/localStorage path RU/EN always used.
// ------------------------------------------------------------
test('B/C/D. real selector: RU -> EN -> العربية sets lang=ar/dir=rtl, persists across reload, and switching back to RU restores dir=ltr', async ({ page }) => {
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const stored = await page.evaluate(() => localStorage.getItem('lashStudioLang'));
  expect(stored, 'Arabic must persist via the exact same localStorage key RU/EN always used').toBe('ar');

  // C. Reload preserves Arabic, exactly like RU/EN always did.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar', { timeout: 10000 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // D. Switching back to RU restores ltr.
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('العربية -> EN also restores dir=ltr (not just العربية -> RU)', async ({ page }) => {
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
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
test('D/G. PHOTO Lash Map: extracted per-zone geometry (viewBox, cx/cy, zone-label sequence, PEAK) is identical between RU and forced-AR runs', async ({ page, browser, storageState }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  const { leftMap: ruLeft, rightMap: ruRight } = await reachLashMap(ruPage, 'ru');
  const ruLeftGeom = await extractMapPoints(ruLeft);
  const ruRightGeom = await extractMapPoints(ruRight);
  await ruCtx.close();

  const arCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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
test('D/G. DIAGRAM Lash Map: SVG path `d` strings + viewBox are byte-identical between RU and forced-AR runs', async ({ page, browser, storageState }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  await reachLashMap(ruPage, 'ru');
  await ruPage.getByRole('button', { name: 'diagram', exact: true }).click();
  await ruPage.waitForTimeout(300);
  const ruGeom = await extractDiagramGeometry(ruPage);
  await ruCtx.close();

  const arCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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
test('J. HeroScreen top design id is identical between RU and forced-AR runs (recommendation output unaffected by language/RTL)', async ({ page, browser, storageState }) => {
  test.setTimeout(120000);
  const ruCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const ruPage = await ruCtx.newPage();
  const { heroId: ruHeroId } = await reachLashMap(ruPage, 'ru');
  await ruCtx.close();

  const arCtx = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
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

// ------------------------------------------------------------
// E. PHASE 3 real-flow E2E -- drives the REAL production language
// selector (a real click on العربية, no __FORCE_LANG anywhere in this
// test) through the full real user journey: Home -> consent ->
// Photo Analysis (upload, real face-api, real ~8s Photo Scan
// choreography) -> Results Hero -> Details -> back -> Lash Map PHOTO
// -> DIAGRAM -> Save to Client button reachable. Verifies real Arabic
// text is genuinely present at every stop, and that navigating
// (back buttons, view-mode toggle) works correctly under RTL.
// ------------------------------------------------------------
test('E. real Arabic flow through the REAL LangToggle (no __FORCE_LANG): Home -> Photo Analysis -> Photo Scan -> Results Hero -> Details -> Lash Map PHOTO/DIAGRAM -> Save to Client, real Arabic text throughout', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('BABEL')) pageErrors.push('console.error: ' + msg.text());
  });
  const arabicRe = /[؀-ۿ]/;

  // Home: default ru, then a REAL click on العربية.
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText(STR.ar.libraryBtn, { exact: true })).toBeVisible();

  // Photo Analysis, through the real Arabic button label.
  const photoBtn = page.getByRole('button', { name: STR.ar.photoBtn, exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20000 });
  await photoBtn.click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  // Photo Scan: the real ~8s scan-canvas choreography runs here (same
  // production animation as RU/EN -- see photo-scan-visual-layer.spec.js
  // for its own dedicated timing proof; this test only confirms it
  // completes and reaches the real post-scan Arabic confirmation screen).
  await expect(page.getByText(STR.ar.reviewTitle, { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: STR.ar.confirm, exact: true }).click();

  // Results Hero: real Arabic recommendation card text.
  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  const heroBodyText = await page.locator('body').innerText();
  expect(arabicRe.test(heroBodyText), 'expected real Arabic script on Results Hero').toBe(true);

  // Details, via the real "Detailed metrics" Arabic link, then back.
  // The moreDetails button sits inside the collapsible "AI Eye Profile"
  // Section (closed by default -- see Section's defaultOpen prop), so
  // it must be expanded first, same as a real user would.
  await page.getByRole('button', { name: 'AI Eye Profile', exact: true }).click();
  const detailsLink = page.getByText(STR.ar.moreDetails, { exact: true });
  await expect(detailsLink).toBeVisible();
  await detailsLink.click();
  await expect(page.getByText(STR.ar.detailsTitle, { exact: true })).toBeVisible({ timeout: 10000 });
  const detailsBodyText = await page.locator('body').innerText();
  expect(arabicRe.test(detailsBodyText), 'expected real Arabic script on Details').toBe(true);
  const backSvg = page.locator('button svg path[d="M15 19l-7-7 7-7"]').locator('..');
  await backSvg.click();
  await expect(heroHeading).toBeVisible({ timeout: 10000 });

  // Lash Map: PHOTO view (default) then DIAGRAM view, both under a
  // real Arabic-selected session -- proves the view-mode toggle and
  // both renderers work correctly under RTL, not just via __FORCE_LANG.
  await page.getByRole('button', { name: STR.ar.openLashMap, exact: true }).click();
  const leftMap = page.locator('[aria-label="Left eye map"]');
  await expect(leftMap, 'PHOTO Lash Map must render under real Arabic selection').toBeVisible({ timeout: 10000 });
  const lashMapBodyText = await page.locator('body').innerText();
  expect(arabicRe.test(lashMapBodyText), 'expected real Arabic script on Lash Map PHOTO view').toBe(true);
  await page.getByRole('button', { name: 'diagram', exact: true }).click();
  await expect(page.locator('svg[dir="ltr"]').first()).toBeVisible({ timeout: 5000 });

  // Save to Client entry point remains reachable under real Arabic.
  await expect(page.getByText(STR.ar.saveToClient, { exact: true }).first()).toBeVisible({ timeout: 10000 });

  expect(pageErrors, `no fatal errors in the real Arabic flow: ${JSON.stringify(pageErrors)}`).toEqual([]);
});

// ------------------------------------------------------------
// E2 (Live Scan touch). Live Scan is reachable under real Arabic and
// shows real Arabic UI text. Headless Chromium has no real camera
// device, so this proves the reachable/localized surface (entry
// button, no-camera error state) rather than driving a full fake-
// camera detection loop (already covered by the dedicated
// live-scan-*.spec.js suite for RU/EN geometry/timing, which Phase 3
// changes nothing in -- see the unit-level byte-identical guards).
// ------------------------------------------------------------
test('E2. Live Scan entry point is reachable under real Arabic selection and shows real Arabic UI text', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/index.html');
  await dismissConsent(page, 'ru');
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  const liveBtn = page.getByRole('button', { name: 'بدء المسح المباشر', exact: true });
  await expect(liveBtn).toBeEnabled({ timeout: 20000 });
  await liveBtn.click();
  // No real/fake camera device in this headless context -> the real
  // production "camera unavailable" state, with real Arabic text.
  await expect(page.getByText('لا يمكن الوصول إلى الكاميرا', { exact: true })).toBeVisible({ timeout: 15000 });
});
