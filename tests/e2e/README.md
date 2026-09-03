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

## Current scope

**Phase A** — infrastructure only: `smoke.spec.js` proves the app boots and its root UI renders over real HTTP.

**Phase B** — `photo-analysis.spec.js`: one real happy-path Photo Analysis flow (upload → real face-api detection → real quality gate → real analysis pipeline → real post-analysis Results screen, `ReviewScreen`). Deliberately asserts only that Results was reached, not any specific Iris/face-shape/recommendation content — that's the job of `tests/*.test.js` or a future, more targeted E2E phase. Does not touch Iris Color, Lash Map, Natural Lash Scan, or recommendation logic.

Lash Map, Iris Color-specific, and further product-behavior E2E are later phases, each adding its own `*.spec.js` file on top of this same config/server foundation.

## Fixture provenance (`fixtures/happy-path-face.png`)

This image is a copy of one file (`тестик7.png`) from a batch of AI-generated frontal face images the project's user created earlier in this same working session, explicitly as disposable pipeline test fixtures (used across several rounds of Iris Color validation, documented in the session's own history and reflected in `tests/fixtures/real-capture-noregression-testik7-*.json`). It is **not a photograph of a real, identifiable person**: it shares the same repeating studio background/lighting/pose template as the rest of that generated batch, with only eye color varying between files — a generation-batch signature, not a real photo series. The user's own in-session messages described this batch as "generated," never as photographs of themselves, a client, or any other real individual.

Verified through the real production path before being kept as a fixture: quality gate passes, exactly one face is detected, real face-api landmarks are obtained, and the real analysis pipeline reaches `ReviewScreen` — confirmed across the 3 consecutive Phase B runs in the implementation report (all pass, `retries: 0`).

Do not replace this fixture with, or add alongside it, any real client/user/friend photograph, or any of the files this project's `CLAUDE.md` and prior sessions have already identified as real photographs (e.g. `глаза 33.jpeg`, `глаза 333.jpeg`, `blue-eyes-source.jpg`) — those must never be committed to this repository.

## Failure artifacts

On a failing test, Playwright automatically saves a screenshot and a trace into `test-results/` (gitignored, regenerated per run — never committed). Open a trace with:

```sh
npx playwright show-trace test-results/<test-name>/trace.zip
```

No artifacts are generated for passing tests.

## CDN dependency

The app itself loads React/Babel/Tailwind (and, for screens beyond Phase A's scope, face-api.js + model weights) from public CDNs at runtime — this test suite does not vendor or mock those. A CDN outage will make CDN-dependent tests fail for reasons unrelated to the code under test; this is a known, accepted characteristic of testing this app's real boot path, not a bug in the harness. See `../../CLAUDE.md` and the Phase A report for the current CDN readiness finding.
