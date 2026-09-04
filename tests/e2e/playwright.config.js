// Minimal Playwright E2E config for LASH STUDIO AI -- Phase A
// (infrastructure only). Future phases (Photo Analysis, Iris Color,
// Lash Map, ...) add spec files here; this config stays the shared
// foundation. See tests/e2e/README.md and CLAUDE.md.
'use strict';
const { defineConfig } = require('@playwright/test');

const PORT = 8934; // predictable, repo-relative "QA port" (matches the port used ad hoc throughout the project's own Iris Color validation sessions)

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Phase A: a single shared local server; keep sequential until a real need for parallelism is proven
  // WORKERS (Phase C3a infrastructure fix): `fullyParallel: false` above
  // only keeps tests WITHIN one spec file serial -- it does not limit
  // how many spec FILES run concurrently. With `workers` left unset,
  // Playwright defaulted to ~half this machine's logical CPU count (4
  // logical CPUs here -> 2 workers), so different spec files (e.g.
  // photo-analysis.spec.js and iris-color.spec.js) were scheduled onto
  // separate, concurrently-running worker processes -- each doing real
  // face-api CDN loading + real inference at the same time. On this
  // project's older development Mac that produced genuine CPU/network
  // contention, occasionally pushing individual tests past their
  // timeout (proven via reproduction: an identical suite failed once
  // under 2 workers, then passed immediately on an unmodified rerun --
  // classic resource-contention flakiness, not a code defect). Pinning
  // to a single worker makes every test run alone, sequentially, with
  // the full machine budget -- deterministic, and closer to how one
  // real user actually exercises the app than artificial parallel
  // inference ever was. Do not raise this to "fix" a slow suite by
  // hiding contention; if wall-clock time becomes a real problem later,
  // pick a real fix (e.g. more CPU) instead of masking it with retries
  // or a larger timeout.
  workers: 1,
  retries: 0, // never hide flakiness behind a retry -- see CLAUDE.md's flakiness guidance
  reporter: [['list']], // plain console output; no auto-generated HTML report directory for a passing run
  outputDir: './test-results', // gitignored; screenshots/traces land here, only on failure
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium', // explicit: this machine's Playwright/Chromium pin (1.40.0) exists specifically for macOS 12.7.6 compatibility (see CLAUDE.md) -- do not switch to a webkit/firefox device preset, which would require a different, unverified browser binary
    // Standardized single phone-class viewport for Phase A, set manually
    // (not via a devices['iPhone ...'] preset, which defaults to WebKit)
    // -- matches the audit's "mainstream current iPhone width" finding.
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off', // diagnostic artifacts stay minimal for a passing run; add per-test if a future phase needs it
  },
  webServer: {
    command: `node server.js`,
    port: PORT,
    reuseExistingServer: false, // always start a fresh server we own, so we can always cleanly terminate it -- never silently attach to (and leak) a stray existing process
    timeout: 15_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
