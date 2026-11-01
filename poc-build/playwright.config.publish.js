// Runs the REAL, unmodified E2E spec files (testDir below points at
// the actual tests/e2e directory — nothing copied or rewritten)
// against the production BUILD ARTIFACT (publish/) instead of the
// source index.html. Same viewport/device/storageState as the real
// playwright.config.js, different webServer/port only.
'use strict';
const { defineConfig } = require('../tests/e2e/node_modules/@playwright/test');
const path = require('path');

const PORT = 8937;

module.exports = defineConfig({
  testDir: path.join(__dirname, '..', 'tests', 'e2e'),
  testMatch: '*.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: path.join(__dirname, 'publish-test-results'),
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    storageState: { cookies: [], origins: [{ origin: `http://127.0.0.1:${PORT}`, localStorage: [{ name: 'lashStudioOnboardingSeenV1', value: '1' }] }] },
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: `node ${path.join(__dirname, 'publish-server.js')}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
