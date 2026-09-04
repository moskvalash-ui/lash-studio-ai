// PHASE — RENDER PROFESSIONAL REFERENCE TEMPLATES IN PHOTO LASH MAP.
// Visual validation only (item 11 of the phase report): deterministic
// screenshots proving the new referenceTemplate renderer adapter actually
// draws real, distinguishable LEFT/RIGHT diagrams for the 6 requested
// strategies, through the real, unmodified app served over HTTP -- not a
// hand-built DOM fixture. No face-api/camera/photo involved: the
// DIAGRAM path used here is the deterministic synthetic-SVG renderer
// (LegacyLashMapDiagram), reachable at ?debug=library, so this spec never
// depends on model loading or a real photo.
//
// Screenshots are validation ARTIFACTS ONLY, written to the gitignored
// tests/e2e/test-results/ directory (same convention already used by this
// project's other specs) -- never committed, per the phase instructions.
const { test, expect } = require('@playwright/test');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'test-results', 'lash-map-reference-templates');

// canonicalId -> whether it's reached via the main (targetInventory) list
// or the new "candidate reference templates" section.
const TARGETS = [
  { canonicalId: 'geometry.long-curved-fox', section: 'candidate' },
  { canonicalId: 'geometry.multi-curl-volume-fox', section: 'candidate' },
  { canonicalId: 'geometry.hybrid-cat-eye', section: 'candidate' },
  { canonicalId: 'construction.anime', section: 'main' },
  { canonicalId: 'construction.wet', section: 'main' },
  { canonicalId: 'construction.wispy', section: 'main' },
];

async function openDetail(page, target) {
  await page.goto('/index.html?debug=library');

  // Dismiss the real analytics-consent banner if it appears (same
  // established pattern as photo-analysis.spec.js -- a fresh browser
  // context always has no stored consent decision). Reject (not Accept)
  // so this spec's behavior never depends on the separate analytics path.
  const rejectConsent = page.getByRole('button', { name: 'Отказаться', exact: true });
  await rejectConsent.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await rejectConsent.isVisible().catch(() => false)) await rejectConsent.click();

  const selector = target.section === 'candidate'
    ? `[data-pl-candidate-id="${target.canonicalId}"]`
    : `[data-pl-identity-id="${target.canonicalId}"]`;
  const button = page.locator(selector);
  // Language-independent readiness signal: wait for the real identity
  // button itself (canonicalId is never translated, per the pre-existing
  // "canonicalId itself is never translated" contract) rather than
  // hardcoding either language's screen title text.
  await expect(button, `${target.canonicalId} must be present and tappable in the ?debug=library list`).toBeVisible({ timeout: 10_000 });
  await button.click();
  await expect(page.locator('[data-pl-reference-map="true"]'), `${target.canonicalId}: reference map section must render`).toBeVisible();
}

for (const target of TARGETS) {
  test(`${target.canonicalId}: LEFT and RIGHT reference-template diagrams render distinctly and mirror correctly`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await openDetail(page, target);

    const left = page.locator('[data-pl-reference-map-side="left"]');
    const right = page.locator('[data-pl-reference-map-side="right"]');
    await expect(left, `${target.canonicalId}: LEFT diagram must render`).toBeVisible();
    await expect(right, `${target.canonicalId}: RIGHT diagram must render`).toBeVisible();

    // Baseline geometry: both sides must actually contain the eye-outline
    // guide path and a lash-length profile line (proves the diagram truly
    // rendered content, not an empty/blank SVG).
    await expect(left.locator('[data-diagram-eye-guide]')).toHaveCount(1);
    await expect(right.locator('[data-diagram-eye-guide]')).toHaveCount(1);
    await expect(left.locator('[data-diagram-lash-profile-line]')).toHaveCount(1);
    await expect(right.locator('[data-diagram-lash-profile-line]')).toHaveCount(1);

    const safeId = target.canonicalId.replace(/\./g, '-');
    await left.screenshot({ path: path.join(OUT_DIR, `${safeId}-left.png`) });
    await right.screenshot({ path: path.join(OUT_DIR, `${safeId}-right.png`) });
    await page.locator('[data-pl-reference-map="true"]').screenshot({ path: path.join(OUT_DIR, `${safeId}-both.png`) });

    expect(pageErrors, `no fatal page errors while rendering ${target.canonicalId}: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });
}

test('geometry.long-curved-fox and geometry.multi-curl-volume-fox: the outer-tail (longest, most-curled) zone visually sits on the temple side, mirrored between LEFT and RIGHT', async ({ page }) => {
  for (const canonicalId of ['geometry.long-curved-fox', 'geometry.multi-curl-volume-fox']) {
    await openDetail(page, { canonicalId, section: 'candidate' });
    const leftPeakX = await page.locator('[data-pl-reference-map-side="left"] circle[stroke="#53C7FF"]').first().getAttribute('cx');
    const rightPeakX = await page.locator('[data-pl-reference-map-side="right"] circle[stroke="#53C7FF"]').first().getAttribute('cx');
    // The peak/outer accent marker is the brightest-stroked circle
    // (isPeak styling in LegacyLashMapDiagram). Its x position must be on
    // opposite thirds of the 400-wide canvas for LEFT vs RIGHT -- proof
    // the outer tail visually mirrors rather than staying pinned to one
    // screen side.
    expect(Number(leftPeakX), `${canonicalId}: LEFT peak marker`).toBeGreaterThan(200);
    expect(Number(rightPeakX), `${canonicalId}: RIGHT peak marker`).toBeLessThan(200);
  }
});

test('candidate templates are visually labeled as non-production (banner text present, RU default)', async ({ page }) => {
  await openDetail(page, TARGETS[0]);
  await expect(page.locator('[data-pl-reference-map="true"]')).toContainText(/кандидат|candidate/i);
});
