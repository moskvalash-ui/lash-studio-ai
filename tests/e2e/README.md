# LASH STUDIO AI — E2E (Playwright)

Browser-level end-to-end tests that drive the **real, unmodified `index.html`** through a real Chromium browser — the app's own UI, not extracted functions. This complements, and never duplicates, the `tests/*.test.js` unit/regression suite one directory up (see `../../CLAUDE.md`).

Scoped entirely to this directory: its `node_modules`, `package.json`, and generated output never touch the rest of the repository, which otherwise has zero build tooling by design.

## Setup (one-time per machine)

```sh
cd tests/e2e
npm install
npx playwright install chromium
```

`@playwright/test` is pinned to an exact version (`1.40.0`), not a range. This is intentional: this project has been developed on macOS 12.7.6 (Monterey), and newer Playwright releases bundle Chromium builds that drop macOS 12 support. If the version is ever bumped, re-verify Chromium launches successfully on every machine this runs on first.

## Running

```sh
cd tests/e2e
npm run e2e
```

This starts a throwaway local static server (`server.js`, serving the real repo root over `http://127.0.0.1:8934`), runs the Playwright suite against it, and shuts the server down afterward — Playwright's `webServer` config owns the server's lifecycle end to end, so there is nothing to start or stop manually and no orphan process risk under normal exit.

Exit code is non-zero if any test fails.

## What belongs here vs. `tests/*.test.js`

- `tests/*.test.js` (repo root's `tests/`): fast, dependency-free, extracts real production functions out of `index.html` and exercises them directly in Node. Owns classifier thresholds, geometry formulas, localization strings, catalog/scoring parity — anything that doesn't require an actual rendered browser.
- `tests/e2e/`: slower, real-browser integration checks that a unit test structurally cannot perform — real UI navigation, real file upload, real face-api.js inference, real rendered layout. Keep this layer small and focused on wiring/integration, not on re-asserting logic the unit suite already owns.

## Current scope (Phase A)

Infrastructure only: one smoke test (`smoke.spec.js`) proving the app boots and its root UI renders over real HTTP. No product behavior (Photo Analysis, Iris Color, Lash Map, recommendations) is tested here yet — those are later phases, each adding its own `*.spec.js` file on top of this same config/server foundation.

## Failure artifacts

On a failing test, Playwright automatically saves a screenshot and a trace into `test-results/` (gitignored, regenerated per run — never committed). Open a trace with:

```sh
npx playwright show-trace test-results/<test-name>/trace.zip
```

No artifacts are generated for passing tests.

## CDN dependency

The app itself loads React/Babel/Tailwind (and, for screens beyond Phase A's scope, face-api.js + model weights) from public CDNs at runtime — this test suite does not vendor or mock those. A CDN outage will make CDN-dependent tests fail for reasons unrelated to the code under test; this is a known, accepted characteristic of testing this app's real boot path, not a bug in the harness. See `../../CLAUDE.md` and the Phase A report for the current CDN readiness finding.
