# LASH STUDIO AI — Claude Code Instructions

## Project

LASH STUDIO AI is a phone-first, browser-only lash-extension design assistant for lash artists. It analyzes a client's eyes (live camera scan or uploaded photo), classifies eye/iris/lash features, ranks lash-map designs, and helps the artist plan and document the application.

- **No build step.** The entire application is `index.html` (~12k lines): React 18 (UMD) + Babel Standalone (in-browser JSX transpilation) + Tailwind CDN, loaded straight from CDN `<script>` tags. There is no `package.json`, no bundler, no npm scripts.
- A handful of logic modules are extracted into plain, dependency-free `.js` files at the repo root specifically so they can be loaded two ways with zero duplication: as a plain global `<script>` in `index.html`, and via `require()` from Node tests. Each uses the same UMD pattern (`module.exports` in Node, `Object.assign(window, ...)` in the browser): `lash-scan-core.js`, `lash-design-domain.js`, `professional-lash-library.js`, `client-store.js`, `consent-manager.js`, `client-data-consent.js`, `analytics.js`.
- Deployment: no CI config or `.github/workflows` exist in the repo, and Pages settings could not be independently verified via API in this audit (no `gh` CLI available). Based on repo structure alone (static `index.html` at root, git remote `github.com/moskvalash-ui/lash-studio-ai`), this is consistent with GitHub Pages "deploy from a branch (main/root)" — treat this as inferred, not confirmed, and verify directly if deployment behavior matters for a task.

## Architecture

Single-page app driven by a `screen` state string in the root component (around index.html:12006-12035). Real screens confirmed at current HEAD: `home`, `clients`/`clientCard`/`clientForm` (Client Cards), `scan` (Live Scan → `LiveScanScreen`), `photo` (Photo Analysis → `PhotoAnalysisScreen`), `review`, `hero`, `catalog` (all designs), `lashmap` (`LashMapScreen`), `details`, `lashscan`/`lashprofile` (Natural Lash Scan), `proLibraryPreview`/`proLibraryDetail` (debug-only professional-library viewer, gated behind `?debug=library`).
There is **no Try-On screen or rendering path in the current codebase** — "Try-On" appears only once, in a comment listing systems a piece of debug state is explicitly isolated from. Do not assume Try-On exists; verify before referencing it.

## Critical Systems

For each system: production file(s) → key function(s) → tests protecting it. Only function names and line-anchors confirmed at current HEAD are listed; line numbers will drift as the file changes — re-grep, don't trust a stale number.

**1. Photo Analysis** — `index.html`, `PhotoAnalysisScreen` (~line 7984). Uploads a photo, runs face-api detection, quality gate, then the same measurement/classification pipeline as Live Scan on a single validated frame (reduced confidence multiplier, `singleFrame` flag). Tests: `photo-canonical.test.js`, `photo-quality-gate.test.js`, `photo-lash-map-pipeline.test.js`.

**2. Live Scan / camera** — `index.html`, `LiveScanScreen` (~line 6568). Continuous `getUserMedia` + face-api loop, multi-frame aggregation, face-lost hysteresis, mirrored preview rendering. Tests: `camera-preview.test.js`, `live-scan-lifecycle.test.js`, `live-scan-tilt-pipeline.test.js`.

**3. Face/eye landmarks** — `index.html`: `getPhysicalEyeLandmarks`, `normalizeEyePoints`, `normalizeBrowPoints` (~line 696-726), `computeHeadPose`, `computeEyeSideMetrics` (~line 728-810+). Normalizes raw face-api 68-point landmarks into canonical, anatomy-based (not screen-side-based) eye-point arrays. Tests: `physical-eye-integration.test.js`, `eye-normalization.test.js`.

**4. Eye geometry analysis** — eyelid/hooding/aperture measurement functions in `index.html`. Tests: `eyelid-classification.test.js`, `eyelid-crease-v2.test.js`, `eyelid-final-consensus.test.js`, `eyelid-frame-trace.test.js`, `eyelid-hooding-confirmation.test.js`, `eyelid-hooding-geometry-audit.test.js`, `eyelid-type-display.test.js`, `eyelid-type-experimental.test.js`, `hooding-recommendation-removal.test.js`, `hooding-v2-stage1.test.js`, `hooding-v2-stage2b.test.js`, `angle-symmetry.test.js`, `face-shape-analysis.test.js` (`classifyFaceShape`, ~line 2791).

**5. Iris Color** — `index.html`: `estimateIrisCenter`, `analyzeIrisSample`, `sampleIrisColor`, `classifyIrisColor`, `classifyLowLightAmbiguous`, `combineIris`, `buildIrisColorAudit` (debug-only). See **Iris Color Contract** below — this is the most recently and heavily audited subsystem; do not modify it without reading that section in full.

**6. Natural Lash Scan** — `lash-scan-core.js` (pure, DOM-independent; exports `detectVisibleLashCandidates`, `aggregateLashFrames`, `computeLashConfidence`, `computeLashObservations`, `computeNaturalLashCondition`, `compareNaturalLashes`, plus `NLS2_THRESHOLDS` — a **read-only diagnostic snapshot** of the live threshold constants, not consumed by any measurement path itself) + `index.html`'s `NaturalLashScanScreen`/`NaturalLashProfileScreen` (~line 7504, 9721). Tests: `lash-scan-core.test.js`.

**7. Recommendation engine** — `index.html`: `classifyFeatures` (~line 2917), `buildDesignResult`, `rankDesignsAll`, `rankDesigns` (~line 4250-4301, top 6 of `rankDesignsAll`). Tests: `recommendation-canonical.test.js`.

**8. DESIGN_CATALOG / effect definitions** — `index.html`: `const DESIGN_CATALOG` (~line 4024), 21 entries (`natural`, `naturalRounded`, `naturalElongated`, `angel`, `doll`, `rounded`, `squirrel`, `kitten`, `cat`, `softcat`, `fox`, `softfox`, `eyeliner`, `wispy`, `wispycat`, `wispydoll`, `kim`, `manga`, `wet`, `reverse`, `correction`). Backed by `professional-lash-library.js` (validated professional definitions for a subset of these, see Protected Contracts). Tests: one `*-professional-definition.test.js` file per validated identity, plus `professional-lash-library.test.js`, `cat-fox-direction-strategy.test.js`.

**9. Professional Lash Map** — `index.html`: `LashMapScreen` (~line 8903), diagram/photo renderers, `lash-design-domain.js` (client-design domain object, mirror/runtime props). Tests: `lash-map-*.test.js` (localization, diagram-mirror, diagram-length-profile, interpolation, visual, application-plan-localization), `lash-design-domain.test.js`, `diagram-canonical.test.js`, `application-plan-canonical.test.js`.

**10. Try-On** — not present in the current codebase (see Architecture). Do not document or protect a contract for a feature that doesn't exist.

**11. RU/EN localization** — `index.html`: `const STRINGS` (~line 203), `function t(key, lang)` (~line 609, falls back to `ru` then the raw key — never throws or goes blank). Iris/zone/etc. labels use their own dedicated maps (e.g. `IRIS_NAMES`) following the same `{ru, en}` shape. Tests: `lash-map-localization.test.js`, `lash-map-application-plan-localization.test.js`.

**12. Debug/diagnostic tooling** — gated centrally by `isDebugModeEnabled()` (~line 619, reads `?debug=1`/`?debug=0` URL param, persisted to `localStorage`). Feeds `buildIrisColorAudit` and other debug-only capture/audit functions. A separate `?debug=library` value gates the professional-library preview screens. **This is permanent, load-bearing infrastructure — do not remove it because it's "debug code."**

**13. Deployment** — see Project section; not independently verified in this audit.

## Protected Contracts

Verified against current HEAD and existing tests. Do not weaken or "simplify" these without understanding why they exist — each has a regression test that will explain the reasoning if you read it.

**A. Camera preview mirroring is separate from processing coordinates.** `getPhysicalEyeLandmarks`/`computeHeadPose`/`computeEyeSideMetrics` have zero dependency on mirror/facingMode/display state — proven by static source-guard assertions, not just by convention. Protected by `camera-preview.test.js`, `physical-eye-integration.test.js` (tests I/J, I/J2).

**B. Physical LEFT/RIGHT semantics are stable and anatomy-based, not screen-side-based.** UI "left" sources from face-api's `getRightEye()` and UI "right" from `getLeftEye()` (face-api's naming is image-side, not anatomy-side) — this permutation is intentional and proven, not a bug. `canonical[0]` is always nasal (inner) and `canonical[3]` always temporal (outer) for *both* physical eyes. Protected by `physical-eye-integration.test.js` (tests A/B/E/F/K/L/M).

**C. Iris Color has a defined, tested production pipeline** with a recently-added radial-evidence stage — see the dedicated **Iris Color Contract** section below for the current, real behavior. Do not describe it from an older mental model.

**D. Iris-center / eye-aperture protections must not be casually weakened.** `estimateIrisCenter` rejects elongated dark lash/eyelid edges (via `hasPupilEnclosure`'s ring-enclosure check) before they can relocate the ROI onto skin. Protected by `iris-sampling-regression.test.js` (off-center gaze, sclera contamination, specular catchlights, elongated lash-edge tests, real-capture pupil-enclosure fixtures).

**E. Iris uncertainty and bilateral-combination rules.** `combineIris`'s `eitherUncertain` rule means either eye's own `'uncertain'` verdict is authoritative and is never silently overridden by RGB blending with a confident partner eye. Protected by `iris-uncertainty-propagation.test.js`, `iris-sampling-regression.test.js`.

**F. Natural Lash Scan: production-facing vs. diagnostic-only outputs.** `NLS2_THRESHOLDS` in `lash-scan-core.js` is an explicit read-only snapshot for a debug panel — confirmed by its own source comment to feed no measurement code path. Treat any `NLS2_*`/diagnostic-labeled export as display-only unless you trace an actual production call site.

**G. Professional Lash Map geometry/profile contracts.** `LegacyLashMapDiagram`/`LashMapDiagram` mirror geometry and `lash-design-domain.js`'s `diagramPropsFromClientDesign`/`withDiagramRuntime` runtime-props flow are covered by dedicated canonical/mirror tests — treat any diagram geometry change as needing `diagram-canonical.test.js` and `lash-map-diagram-mirror.test.js` to stay green.

**H. Lash Map LEFT/RIGHT mirror behavior.** The diagram's `xAt` formula mirrors horizontally around the canvas center for `side==='right'`: `leftXAt(t) + rightXAt(t) === 400` for every `t`. Protected by `lash-map-diagram-mirror.test.js`.

**I. DESIGN_CATALOG and recommendation scoring contracts.** All 21 catalog IDs, their RU/EN Recommendation output, full ranking/top-6/primary/tie behavior, and the legacy-ID handoff into Lash Map are pinned. Protected by `recommendation-canonical.test.js`, `professional-lash-library.test.js`'s "production source parity" test (a **whole-file SHA-256 hash of `index.html`** — it will fail on *any* edit to `index.html`, unrelated or not; see Testing section).

**J. Fox-specific geometry exemption — confirmed live at current HEAD.** The general peak-zone tilt-demotion rule (`if (physicalTilt > 4 && peakZone > 1) peakZone -= 1`, ~index.html:4192) explicitly excludes `fox`: `entry.id !== 'fox' && ...`. This is intentional, current, production logic, not a historical artifact — do not "clean it up" by removing the exemption.

**K. Try-On rendering contracts.** Not applicable — feature does not exist (see Architecture). Do not invent a contract for it.

**L. Current production deployment contract.** Not independently verified in this audit (see Project/Deployment). If a task depends on deployment specifics, verify directly rather than assuming.

## Iris Color Contract (current, as of the approved radial-corroboration fix)

Real pipeline, in order: photo/frame → `getPhysicalEyeLandmarks` → `estimateIrisCenter` (dark-pupil search with lash/lid-edge rejection, falls back to landmark midpoint) → `analyzeIrisSample` builds a fixed-radius ROI/annulus (excludes pupil core and outer/lid boundary, rejects specular highlights and near-black pixels, 80%-trim outlier pass) → per-eye `classifyIrisColor` on the trimmed flat median → **angular sector agreement** (4 quadrants, must have ≥3 qualifying sectors and ≥0.6 agreement with the flat-median category, else the eye is forced to `'uncertain'`) → **[NEW] radial outer-band corroboration** → `combineIris` bilateral combination → UI label via `IRIS_NAMES`.

**The radial-evidence invariant (why it exists — do not remove without understanding this):** a real iris can genuinely have a different color at the outer/limbal band than at the pupil-adjacent inner band (e.g. warm inner ring, cooler-hued outer ring). The flat annulus-wide median and the angular quadrants both blend every radius together, which can dilute real, well-supported outer-band evidence down into `'uncertain'` even when that evidence is strong. This was proven — not assumed — against a real photograph (non-identifying derived ROI/pixel fixture, `tests/fixtures/real-capture-green-eye-glaza33-left.json`): the eye's true outer/limbal band was confidently, consistently green (hundreds of pixels, high internal color agreement) while the flat median and angular quadrants alone forced `'uncertain'`.

The fix is additive only, inside `analyzeIrisSample`: it computes INNER/MIDDLE/OUTER radial bands (same accepted/trimmed pixels the angular sectors already use) and, **only when the existing angular path would already produce `'uncertain'`**, may instead trust the OUTER band's own category — but only when *all* of the following hold simultaneously:
- the OUTER band alone has ≥20 pixels and ≥0.55 internal color consistency (same consistency formula already used for the flat median),
- its classified category differs from the flat median's category (genuine disagreement, not restating the same answer),
- that category is a real, non-ambiguous color (`'uncertain'`/`'mixed'` never corroborate),
- and — critically — the INNER band **independently** still confirms the *original* flat-median category, proving a genuine two-region radial split exists rather than angularly-scattered noise.

When corroboration fires, the returned `rgb` (and therefore the UI hex swatch) switches to the OUTER band's own color too — a label can never disagree with its own swatch. Per-eye `confidence` is intentionally left untouched by this path. `combineIris`'s bilateral rules, the `sectorAgreement` angular mechanism, `classifyIrisColor`'s thresholds, ROI/annulus geometry, and rejection filters were **not** touched by this fix — none of that should be attributed to it.

Do not encode any specific person's photo or RGB values as a universal rule; the fixtures above are derived, non-identifying regression evidence, not product truth. Regression coverage: `tests/iris-radial-outer-band-corroboration.test.js` (28 tests — real positive/negative fixtures from the same real photo, synthetic two-tone fixtures proving the rule is symmetric across *any* color pair, and 22 no-regression fixtures spanning every green/brown/blue/gray case audited across three earlier validation rounds). Also see `iris-color-audit.test.js`, `iris-color-green-brown-robustness.test.js`, `iris-contextual-debug.test.js`, `iris-native-resize-audit.test.js`, `iris-sampling-regression.test.js`, `iris-uncertainty-propagation.test.js`.

## Computer Vision Rules

For any visual-analysis bug, trace the real pipeline before touching code:

```
VISUAL GROUND TRUTH → IMAGE/LANDMARK INPUT → SAMPLING/ROI → FEATURE EXTRACTION
→ CLASSIFIER/RULES → QUALITY GATE → LEFT/RIGHT OR BILATERAL COMBINATION → UI MAPPING
```

Do not call something a "classifier bug" until you have proven the expected evidence actually reached the classifier (inspect the real accepted pixels / real measured values — this codebase's `?debug=1` audit objects and the `tests/fixtures/real-capture-*.json` extraction technique exist specifically for this). Distinguish **FACT** (directly measured), **INFERENCE** (a reasonable read of measured facts), and **HYPOTHESIS** (untested) — never present a hypothesis as a proven root cause.

**Uncertain is a valid, safe result — not a failure to fix away.** A low-confidence `'uncertain'` is preferable to a confident wrong answer. Do not weaken quality gates, evidence-sufficiency checks, low-light protections, bilateral safeguards, or confidence handling merely to raise a "coverage" or "pass rate" number. Do not tune numerical thresholds (Iris Color, eye geometry, Natural Lash Scan, recommendation scoring, Lash Map geometry, confidence/quality gates) because one example fails — require evidence across both positive and negative regression fixtures first (see the Iris Color radial-corroboration fix for the pattern this project expects: calibrate thresholds against every available real fixture, not just the target case).

**Left/right discipline:** always distinguish physical LEFT eye, physical RIGHT eye, screen-left/right, mirrored camera preview, and raw array ordering (see Protected Contracts A/B). Any eye-related change must be checked on both eyes, not just one.

**Mobile-first:** this product is used on phones. UI/camera/visual changes need validation at realistic mobile viewport sizes — check high-DPI rendering, text collisions, button overlap, camera mirroring, image crop, overlays, and touch targets. Desktop-only validation is not sufficient for mobile UI changes.

**RU/EN parity:** user-facing text changes must cover both languages via the existing `STRINGS`/`t()` (or the relevant dedicated label map) mechanism — do not add a production message/label/hint in only one language.

## Testing

No `package.json`, no test runner config, no single "run everything" script exists in this repo. Two harness styles coexist in `tests/*.test.js`:
- a large share use Node's built-in `node:test`/`node:assert` (report via `ℹ pass`/`ℹ fail`/`ℹ skipped` lines, process exit code reflects pass/fail);
- the rest use a small hand-rolled `test(name, fn)` counter with a final `console.log(`${pass} passed, ${fail} failed`)` line and `process.exit(1)` on any failure.

Both are just `node tests/<file>.test.js`. To run everything, iterate `tests/*.test.js` and check each file's own exit code — do not assume a single output format when aggregating counts.

**Verified baseline at current HEAD (`ce2b24f`):** 63 test files, **1215 passed, 0 failed, 5 skipped** (all 5 skips are explicit and documented — e.g. "`@babel/core` is not an installed dependency of this repo," verified manually instead), 0 files with a non-zero exit code. Re-verify this yourself before relying on it — do not assume it still holds after any change.

Most tests extract the **real, unmodified** production functions straight out of `index.html` by string-slicing between named markers and `eval`-ing them via `new Function(...)`, then exercise the real function with synthetic or real-derived inputs. This is the established pattern in this repo (not a workaround to avoid) — prefer it over hand-duplicating logic when writing new tests.

**`professional-lash-library.test.js` and 15 `*-professional-definition.test.js` files each contain a "production source parity" test that hashes the *entire* `index.html` file (SHA-256) against a hardcoded constant.** This means the assertion fails on *any* `index.html` edit whatsoever, unrelated or not — it is a blunt whole-file integrity guard, not a signal that your specific change broke something. When it fails: (1) verify via `git stash` that your change is the only diff and the hash mismatch is the *only* failure in that file, (2) get explicit approval before updating the hardcoded hash in all 16 files (mechanical, one line each) — never do this silently, and never treat "the hash is stale" as an excuse to skip investigating a real functional regression if other assertions in the same file also fail.

Before treating a task as complete: run the focused test(s) for the change, then the relevant subsystem tests, then the full suite. Report exact pass/fail/skipped counts you actually observed — never state a count you did not just run.

`git diff --check` (trailing whitespace / conflict markers) is part of the pre-commit checklist this project has used consistently — run it before every commit.

A local static server + Playwright/Chromium (headless) has been the established way to exercise the real app end-to-end (real face-api.js detection, real canvas pipeline) when a test needs to go through the actual UI rather than an extracted function — e.g. driving `PhotoAnalysisScreen`'s real file-upload flow. There is no committed script for this; it has been built ad hoc per session. If you build one, prefer index-prefixed output filenames when batching photos with Cyrillic/space-heavy names — plain sanitization can collide (two different filenames reducing to the same ASCII stub has silently overwritten a result before).

## Git Safety

- Never run `git add .` or `git add -A`. Stage explicit file paths only.
- Never `commit`, `push`, `reset`, `clean`, delete untracked files, or rewrite history without the user explicitly authorizing that specific action in that turn. A prior approval does not carry forward to a new, unrelated change.
- Before any commit: run focused tests → subsystem tests → full suite → `git diff --check` → read the actual diff → check `git status --short` → confirm the staged set matches exactly what was approved (nothing extra swept in).
- This repo routinely has real untracked local files sitting alongside the working tree — debug capture text files, source/test images, a `backend/` directory, etc. Do not delete, rename, move, stage, or modify untracked files unless explicitly instructed to touch that specific file. They are often in-progress diagnostic evidence, not clutter.

## Privacy / Fixtures

Real captured evidence (real photos, real client data) is valuable for computer-vision work but must be handled carefully:
- Prefer **derived, non-identifying** fixtures — accepted-pixel arrays, ROI geometry, normalized crops, classifier inputs, debug-audit JSON — over full identifiable photos. `tests/fixtures/real-capture-*.json` is the established pattern: enough raw pixel data to deterministically reproduce production's real behavior, without the source image.
- Never commit a full identifiable client/test photograph without explicit approval.
- Never special-case a fixture (branch logic on a specific filename, hardcode a specific RGB triple as a rule) — a fixture is regression evidence for a general mechanism, not a rule unto itself.
- Do not put personal or client-identifying information into this file or into commit messages.

## Definition of Done

A production coding task is not complete until:
1. Reproduction/evidence exists for the reported behavior.
2. The first incorrect stage (per the CV pipeline trace, or the equivalent trace for non-CV code) is identified — not guessed.
3. The fix's scope is minimal — the earliest proven-wrong stage only, no unrelated refactoring swept in.
4. A focused regression test for the fix passes.
5. Related subsystem tests pass.
6. The full suite passes (or every failure is explicitly explained — e.g. the whole-file hash guard — and approved).
7. `git diff --check` passes.
8. The diff has been read and contains no unrelated changes.
9. No accidental debug artifacts (stray console logs, temporary overlays/labels/constants, experimental branches) remain in production code.
10. Mobile validation completed, if the change is UI-related.
11. Both LEFT and RIGHT validated, if the change is eye-related.
12. RU and EN validated, if the change is user-facing.
13. `git status --short` has been shown.
14. No commit or push happened unless explicitly authorized for that specific change.

Never state "verified," "fixed," "production-ready," "tests pass," or "unchanged" unless that exact check was actually run in this session against the current working tree. If something cannot be verified (e.g. deployment settings, a GitHub API you don't have access to), say so explicitly instead of asserting it.

## Stop Conditions

Stop and ask for explicit approval before proceeding when:
- Root cause is not proven and the candidate production change is risky.
- A fix would require weakening a quality/safety gate (uncertainty propagation, ROI/center protections, confidence handling, low-light safeguards).
- The requested behavior conflicts with a Protected Contract above.
- A destructive git or filesystem operation would be needed.
- Real, identifiable client imagery or data would need to be committed.
- Secrets or credentials are involved.
- A fix that started scoped to one subsystem is expanding into another.
- Unrelated tests are failing and fixing them would expand the task's scope.
- Commit or push has not been explicitly authorized for this specific change.

Default to **read-only investigation** whenever the task is phrased as audit / investigate / diagnose / analyze / find the cause — do not modify production code during diagnosis unless explicitly authorized to go further.
