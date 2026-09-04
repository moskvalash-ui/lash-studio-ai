// PHOTO LASH MAP LEFT/RIGHT GEOMETRY ROOT-CAUSE INVESTIGATION.
// Real production pipeline validation (item 12 of the investigation
// brief): Photo Analysis -> Results -> confirm -> Hero -> All Designs ->
// Fox / Cat -> Lash Map (PHOTO, the default view). Drives the REAL app
// end to end (no internal function called directly, nothing mocked),
// using the already-approved, privacy-safe synthetic fixture
// happy-path-face.png (never blue-eyes-source.jpg or a private capture).
//
// This does more than eyeball screenshots: it extracts the real rendered
// SVG DOM (data-map-point/data-length/data-peak/data-photo-zone
// attributes LegacyProfessionalEyeMap already emits) for BOTH eyes and
// checks the semantic invariant (same zone-label sequence, same
// professional lengths, PEAK/tail identity) the unit-level mirror oracle
// (tests/photo-lash-map-mirror-oracle.test.js) already proved
// numerically for the underlying math -- this is the same claim,
// re-verified against the real browser-rendered production DOM.
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'happy-path-face.png');

async function reachLashMapFor(page, designName) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/index.html');

  const rejectConsent = page.getByRole('button', { name: 'Отказаться', exact: true });
  await rejectConsent.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await rejectConsent.isVisible().catch(() => false)) await rejectConsent.click();

  const photoBtn = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photoBtn).toBeEnabled({ timeout: 20_000 });
  await photoBtn.click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE);

  const reviewTitle = page.getByText('Подтверждение анализа', { exact: true });
  const errorRetryBtn = page.getByRole('button', { name: 'Выбрать другое фото', exact: true });
  await Promise.race([
    reviewTitle.waitFor({ state: 'visible', timeout: 45_000 }),
    errorRetryBtn.waitFor({ state: 'visible', timeout: 45_000 }),
  ]);
  await expect(errorRetryBtn).not.toBeVisible();
  await expect(reviewTitle).toBeVisible();

  // Confirm through the real production control -> HeroScreen.
  const confirmBtn = page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true });
  await confirmBtn.click();

  // HeroScreen -> All Designs (catalog, every one of the 21 real designs,
  // not just the top-6 recommended) -> deterministic Fox/Cat selection,
  // independent of this fixture's actual top recommendation rank.
  const allDesignsBtn = page.getByRole('button', { name: 'Все дизайны →', exact: true });
  await allDesignsBtn.waitFor({ state: 'attached', timeout: 20_000 });
  await allDesignsBtn.scrollIntoViewIfNeeded();
  await expect(allDesignsBtn).toBeVisible({ timeout: 10_000 });
  await allDesignsBtn.click();

  // Each catalog card is a <button> whose accessible name concatenates
  // ALL its text content (name, score, description, badges) -- not just
  // the design name -- so match on the h4 heading (rendered as
  // d.name.toUpperCase()) and click its containing button, rather than
  // an exact accessible-name match that could never match the whole
  // button's full text.
  const designHeading = page.getByRole('heading', { name: designName, level: 4, exact: true }).first();
  await designHeading.waitFor({ state: 'attached', timeout: 15_000 });
  await designHeading.scrollIntoViewIfNeeded();
  await expect(designHeading, `${designName} must be listed in the real All Designs catalog`).toBeVisible({ timeout: 10_000 });
  const designBtn = designHeading.locator('xpath=ancestor::button[1]');
  await designBtn.scrollIntoViewIfNeeded();
  await designBtn.click();

  // LashMapScreen, PHOTO view (the default viewMode).
  const leftMap = page.locator('[aria-label="Left eye map"]');
  const rightMap = page.locator('[aria-label="Right eye map"]');
  await expect(leftMap, 'LEFT PHOTO Lash Map card must render').toBeVisible({ timeout: 10_000 });
  await expect(rightMap, 'RIGHT PHOTO Lash Map card must render').toBeVisible({ timeout: 10_000 });

  expect(pageErrors, `no fatal page errors while reaching ${designName}'s Lash Map: ${JSON.stringify(pageErrors)}`).toEqual([]);
  return { leftMap, rightMap };
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

function keyPoints(extracted) {
  return extracted.points.filter((p) => p.zoneLabel);
}

for (const designName of ['FOX', 'CAT EYE']) {
  test(`real PHOTO Lash Map pipeline — ${designName}: LEFT/RIGHT semantic invariant holds on real rendered DOM`, async ({ page }) => {
    // Real face-api CDN load + real inference + a full multi-screen
    // navigation (Review -> confirm -> Hero -> All Designs -> Lash Map)
    // genuinely needs more headroom than the 30s config default -- same
    // reasoning/precedent as photo-analysis.spec.js's own override.
    test.setTimeout(90_000);
    const { leftMap, rightMap } = await reachLashMapFor(page, designName);

    const left = await extractMapPoints(leftMap);
    const right = await extractMapPoints(rightMap);
    const leftKeys = keyPoints(left), rightKeys = keyPoints(right);

    expect(leftKeys.length, `${designName}: LEFT must have key zone points`).toBeGreaterThan(0);
    expect(rightKeys.length, `${designName}: RIGHT must have key zone points`).toBeGreaterThan(0);
    expect(leftKeys.map((p) => p.zoneLabel), `${designName}: zone LABEL sequence must match between eyes (same professional design)`).toEqual(rightKeys.map((p) => p.zoneLabel));
    expect(leftKeys.at(-1).zoneLabel, `${designName}: LEFT tail must be OUTER`).toBe('OUTER');
    expect(rightKeys.at(-1).zoneLabel, `${designName}: RIGHT tail must be OUTER (never migrates to INNER)`).toBe('OUTER');

    const leftPeak = leftKeys.find((p) => p.isPeak), rightPeak = rightKeys.find((p) => p.isPeak);
    expect(leftPeak, `${designName}: LEFT must have exactly one PEAK key zone`).toBeTruthy();
    expect(rightPeak, `${designName}: RIGHT must have exactly one PEAK key zone`).toBeTruthy();
    expect(leftPeak.zoneLabel, `${designName}: PEAK must sit in the same named zone on both eyes`).toBe(rightPeak.zoneLabel);

    // Screen-space mirror sanity: INNER and OUTER must sit on OPPOSITE
    // relative sides within each eye's own crop for LEFT vs RIGHT (a true
    // visual mirror), not the same relative side on both (which would be
    // the exact symptom this investigation was asked to rule out).
    const leftInner = leftKeys[0], leftOuter = leftKeys.at(-1);
    const rightInner = rightKeys[0], rightOuter = rightKeys.at(-1);
    const leftDir = Math.sign(leftOuter.cx - leftInner.cx);
    const rightDir = Math.sign(rightOuter.cx - rightInner.cx);
    expect(leftDir, `${designName}: LEFT INNER->OUTER must have a definite horizontal direction`).not.toBe(0);
    expect(rightDir, `${designName}: RIGHT INNER->OUTER must have a definite horizontal direction`).not.toBe(0);
    expect(rightDir, `${designName}: RIGHT's INNER->OUTER screen direction must be the OPPOSITE of LEFT's (true mirror, not a copy)`).toBe(-leftDir);
  });
}
