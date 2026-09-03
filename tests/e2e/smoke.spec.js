// PHASE A — INFRASTRUCTURE SMOKE TEST ONLY.
// Verifies the E2E foundation itself (server, browser launch, app boot),
// not product behavior. Deliberately does NOT wait on face-api/model
// loading (that's a separate, non-gating readiness probe -- see the
// Phase A report) so this test cannot flake on CDN availability. No
// photo upload, no Iris/recommendation/Lash Map assertions belong here --
// those are future phases.
const { test, expect } = require('@playwright/test');

test('app boots: real index.html loads over HTTP and the root UI renders', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const response = await page.goto('/index.html');
  expect(response, 'server must respond to the real index.html request').not.toBeNull();
  expect(response.status(), 'index.html must be served successfully').toBe(200);

  // Stable, semantic, production text rendered unconditionally by the
  // root HomeScreen the moment React mounts -- present regardless of
  // whether face-api models have finished loading (index.html:5424).
  // Not invented for testing: this is the app's own real logo text.
  // exact:true matters here -- the analytics-consent banner's RU copy
  // also contains the substring "LASH STUDIO AI" inside a longer
  // sentence (discovered by this test's own first run, strict-mode
  // violation); exact match on the logo's full (whitespace-normalized)
  // text uniquely identifies the header logo, not that banner text.
  const logo = page.getByText('LASH STUDIO AI', { exact: true });
  await expect(logo, 'root app UI (home screen logo) must be visible after boot').toBeVisible();

  expect(pageErrors, `no fatal page errors during boot: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
