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

**Phase C** — `iris-color.spec.js`: extends Phase B one step further, through the real "confirm" transition into `HeroScreen`, and asserts the actual, user-visible Iris Color result on `HeroScreen` (RU label "Цвет радужки" → the real displayed value). Iris Color logic itself (thresholds, radial corroboration, bilateral combination, uncertainty propagation) remains owned by `tests/iris-*.test.js`; this file only proves the real UI wiring end to end — real photo → real face-api → real Iris pipeline → real displayed category. Nothing is mocked or injected.

**Phase C (as of C3a)** covers three categories end to end:
- **BLUE** — `fixtures/happy-path-face.png` → `Голубые`.
- **BROWN** — `fixtures/iris-brown.png` → `Карие`.
- **UNCERTAIN** — `fixtures/iris-uncertain.png` → `Оттенок не определён`.

GREEN and GRAY/BLUE-GRAY are **not** covered — see `IRIS_FIXTURE_AUDIT.md` for the full evidence trail: a GREEN and a GRAY/BLUE-GRAY candidate were each evaluated through the real production pipeline and rejected on their own merits (not fixture unavailability alone). Each would need a new, separately-vetted privacy-safe fixture before E2E coverage could be added.

Lash Map and further product-behavior E2E are later phases, each adding its own `*.spec.js` file on top of this same config/server foundation.

## Fixture provenance

### `fixtures/happy-path-face.png` (BLUE)

This image is a copy of one file (`тестик7.png`) from a batch of AI-generated frontal face images the project's user created earlier in this same working session, explicitly as disposable pipeline test fixtures (used across several rounds of Iris Color validation, documented in the session's own history and reflected in `tests/fixtures/real-capture-noregression-testik7-*.json`). It is **not a photograph of a real, identifiable person**: it shares the same repeating studio background/lighting/pose template as the rest of that generated batch, with only eye color varying between files — a generation-batch signature, not a real photo series. The user's own in-session messages described this batch as "generated," never as photographs of themselves, a client, or any other real individual.

Verified through the real production path before being kept as a fixture: quality gate passes, exactly one face is detected, real face-api landmarks are obtained, and the real analysis pipeline reaches `ReviewScreen` — confirmed across the 3 consecutive Phase B runs in the implementation report (all pass, `retries: 0`).

### `fixtures/iris-brown.png` (BROWN) and `fixtures/iris-uncertain.png` (UNCERTAIN)

Both images were AI-generated specifically for LASH STUDIO AI testing, as a later, separate batch of four disposable Iris Color candidate fixtures (Russian working filenames `зрачки1.png`–`зрачки4.png`) the project's user provided explicitly for this purpose. They are synthetic and do **not** depict a real, identifiable user, client, or friend.

Both were validated through the real production Photo Analysis pipeline (`?debug=1`, read-only) before acceptance — not accepted on visual appearance alone:
- **`iris-brown.png`** (source: `зрачки2.png`): both eyes independently classify `brown` with maximal sector agreement (4/4 sectors each), high confidence (left 0.75, right 0.77), and bilateral `combineIris` confidently resolves to `brown` (confidence 0.72). Stable across 3 consecutive runs.
- **`iris-uncertain.png`** (source: `зрачки4.png`): face detection and both eyes' ROI are fully valid (not a detection/ROI failure) with substantial accepted pixel counts (~200 per eye), but each eye's angular sectors genuinely split between adjacent warm hues (brown/hazel) with sector agreement below the production threshold, and the bilateral result is legitimately `uncertain` — the pipeline's real, intended uncertainty-safety behavior, not a broken input. Stable across 3 consecutive runs.

Two other candidates from the same batch (`зрачки1.png`, intended GREEN; `зрачки3.png`, intended GRAY/BLUE-GRAY) were evaluated through the same real pipeline and **rejected** — `зрачки1`'s sampled evidence was genuinely warm/amber, not green; `зрачки3`'s sampled evidence was neutral/low-chroma in the right direction but never reached the production sector-agreement threshold required to commit to gray. Neither was kept. See `IRIS_FIXTURE_AUDIT.md` for the full evidence trail.

Do not replace or add alongside these fixtures any real client/user/friend photograph, or any of the files this project's `CLAUDE.md` and prior sessions have already identified as real photographs (e.g. `глаза 33.jpeg`, `глаза 333.jpeg`, `blue-eyes-source.jpg`) — those must never be committed to this repository.

## Failure artifacts

On a failing test, Playwright automatically saves a screenshot and a trace into `test-results/` (gitignored, regenerated per run — never committed). Open a trace with:

```sh
npx playwright show-trace test-results/<test-name>/trace.zip
```

No artifacts are generated for passing tests.

## CDN dependency

The app itself loads React/Babel/Tailwind (and, for screens beyond Phase A's scope, face-api.js + model weights) from public CDNs at runtime — this test suite does not vendor or mock those. A CDN outage will make CDN-dependent tests fail for reasons unrelated to the code under test; this is a known, accepted characteristic of testing this app's real boot path, not a bug in the harness. See `../../CLAUDE.md` and the Phase A report for the current CDN readiness finding.
