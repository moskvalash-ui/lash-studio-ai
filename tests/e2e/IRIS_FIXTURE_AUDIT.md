# Iris Color E2E fixture audit (Phase C2 → updated Phase C3a)

Started as a read-only fixture-inventory pass (Phase C2), run against HEAD `ee7107b40c51299098ca0d8d252450be914ba7fb`. Goal: find privacy-safe, full-face image fixtures for the Iris Color categories `tests/e2e/iris-color.spec.js` (Phase C) did not yet cover — GREEN, BROWN, GRAY/BLUE-GRAY, UNCERTAIN. No production code, threshold, classifier, radial-corroboration, or `combineIris` logic was touched in either phase.

**Phase C3a update:** four new synthetic candidate images (Russian working filenames `зрачки1.png`–`зрачки4.png`, provided by the project's user specifically as disposable Iris Color test fixtures, intended respectively as GREEN/BROWN/GRAY-BLUE-GRAY/UNCERTAIN candidates) were validated through the real production Photo Analysis pipeline (`?debug=1`, read-only). Two were accepted (`зрачки2.png` → BROWN, `зрачки4.png` → UNCERTAIN, now committed as `fixtures/iris-brown.png` and `fixtures/iris-uncertain.png` and covered by `iris-color.spec.js`); two were rejected on their own sampled-pixel evidence (`зрачки1.png` intended GREEN, `зрачки3.png` intended GRAY/BLUE-GRAY). See the per-category sections below for the full evidence trail. The original Phase C2 findings (no candidate existed at all) are preserved below for history; this update supersedes them only for BROWN and UNCERTAIN.

## Method

The repository's entire file tree (git-tracked and untracked) was searched exhaustively for image files (`*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.gif`, `*.bmp`, `*.heic`, `*.tiff`, `*.avif`), via both a filesystem `find` and `git ls-files`, cross-checked against the full untracked-file listing (`git status --uall`). This is a complete enumeration, not a sample — every image file that exists anywhere in the working tree is listed below.

## Candidate inventory

| FILE | PROVENANCE | SYNTHETIC/REAL | IDENTIFIABLE? | FULL FACE? | CURRENT PRODUCTION RESULT | GROUND-TRUTH SUITABILITY | SAFE TO COMMIT? |
|---|---|---|---|---|---|---|---|
| `tests/e2e/fixtures/happy-path-face.png` | `тестик7.png`, one file from an AI-generated batch the project's user created in an earlier session, explicitly as disposable pipeline test fixtures (documented in `tests/e2e/README.md`'s existing "Fixture provenance" section) | Synthetic | No — shares the batch's repeating studio background/lighting/pose template, not a real identifiable person | Yes | **BLUE** (`Голубые`) — already verified via the real production pipeline in Phase C, with strong multi-stage evidence (both eyes independently sector-confident blue, bilateral `combineIris` resolves to blue) | Already accepted and in use (BLUE, `tests/e2e/iris-color.spec.js`) | Already committed |
| `blue-eyes-source.jpg` (repo root, untracked) | Not documented anywhere in this repo as synthetic; CLAUDE.md and prior sessions identify it as a real/private source image | Real (per CLAUDE.md's own characterization) | Presumed yes | Not opened — out of scope | Not tested — **explicitly forbidden by this task's instructions** | N/A | **No — explicitly forbidden**; not opened, read, or used in any way during this audit |
| `iris-debug-contextual-latest-20260829.txt`, `iris-debug-female-blue-gray-20260827.txt`, `iris-debug-male-blue-eyes-20260827.txt`, `iris-debug-post-c85b44b-20260827.txt`, `iris-debug-post-c89cfbf-20260827.txt`, `iris-debug-post-ede388e-20260827.txt`, `iris-debug-real-20260827 (1).txt` (repo root, untracked, 7 files) | Pre-existing untracked debug-capture dumps (per CLAUDE.md: "debug capture text files ... often in-progress diagnostic evidence") | N/A — not image files (confirmed via `file`: plain text / JSON) | N/A | **No** — text/JSON `irisColorAudit` dumps, not uploadable photos | Not tested — wrong file type for an E2E upload fixture regardless of content, and CLAUDE.md instructs not to touch/modify pre-existing untracked files | Not applicable — cannot serve as an E2E fixture no matter what color evidence they might contain | **No** — not touched, not opened beyond confirming file type via `file`(1); no content extracted or reproduced here |
| `tests/fixtures/*.json` (26 files: `real-capture-noregression-testik{1,2,4,7,8,8sp,9,10,11,12,13}-{left,right}.json`, `real-capture-green-eye-glaza33-{left,right}.json`, `real-capture-2026-08-25.json`, `real-capture-2026-08-27-pupil-enclosure.json`, `real-capture-post-c89cfbf-pupil-search.json`) | Derived pixel/audit extracts from various real captures (the testik AI-generated batch, plus real captures including "glaza33") — already inventoried in the Phase C report | Derived (pixel arrays / audit objects, not images) | N/A | **No** — not image files, cannot drive `input[type="file"]` | Category ground truth already known from `tests/iris-radial-outer-band-corroboration.test.js`'s existing no-regression list (e.g. `testik4-right: brown`, `testik9-left: brown`, `testik12-right: gray`, `testik1-left: uncertain`, `testik2-left: uncertain`) — but this is unit-test-only evidence, not usable for a browser-driven E2E upload | Not usable for E2E regardless of category — no corresponding source image file exists in the repo for any of them | N/A — already used only in unit tests, unchanged by this task |

**Total full-face image files in the entire repository: 2.** One (`happy-path-face.png`) is already accepted and in use for BLUE. The other (`blue-eyes-source.jpg`) is explicitly forbidden. There is no third image anywhere.

## Current category status (as of Phase C3a)

| Category | Status | Fixture |
|---|---|---|
| **BLUE** | **Accepted** (Phase C) | `fixtures/happy-path-face.png` → `Голубые` |
| **BROWN** | **Accepted** (Phase C3a) | `fixtures/iris-brown.png` → `Карие` |
| **UNCERTAIN** | **Accepted** (Phase C3a) | `fixtures/iris-uncertain.png` → `Оттенок не определён` |
| **GREEN** | **Still blocked** | No accepted fixture — `зрачки1.png` was evaluated and rejected (see below) |
| **GRAY / BLUE-GRAY** | **Still blocked** | No accepted fixture — `зрачки3.png` was evaluated and rejected (see below) |

## Phase C2 original finding (historical — no candidates existed at all)

At the time of the original Phase C2 pass, an exhaustive repository image search found **zero** candidate images for any of GREEN/BROWN/GRAY/UNCERTAIN (the only two image files in the entire repo were `happy-path-face.png`, already accepted for BLUE, and `blue-eyes-source.jpg`, explicitly forbidden). What was missing, precisely: an E2E fixture requires an actual uploadable image file (`input[type="file"]` needs real bytes to attach). For GREEN, the only real evidence anywhere in the repository was derived from a photo (`глаза33`) explicitly forbidden by that task's instructions, and even setting that aside only its *derived pixel JSON* was ever kept, never the source image. For BROWN, GRAY, and UNCERTAIN, evidence existed only as `tests/fixtures/real-capture-noregression-testik*.json` — derived pixel extracts from an AI-generated batch (`тестик1`–`тестик13`) of which only `тестик7`'s original PNG was ever committed. This blocked state has since been partially resolved by Phase C3a, below, once new candidate images were explicitly provided.

## Phase C3a evaluation — the four new candidates

Four new synthetic images were provided (`зрачки1.png`–`зрачки4.png`, 1536×1024 PNGs, a single AI-generation batch), each run once through the real production pipeline with `?debug=1` to check plausibility, then (for candidates matching their intended category) 3 consecutive times for stability.

### `зрачки1.png` — intended GREEN — **REJECTED**

Real sampled-pixel evidence on both eyes was genuinely warm/amber, not green: median RGB left `{r:116,g:106,b:81}`, right `{r:123,g:111,b:87}` (hue ≈ 40–41°); the classifier's own internal rule trace named `amber` on both eyes before quality logic correctly demoted the result to `uncertain` for low sector agreement (left 0.5, right 0.25). Final displayed result: `Оттенок не определён`. This is the exact failure mode this project's fixture-acceptance rules warn about — "looks green, sampled evidence is warm/golden" — confirmed directly, not assumed. Not repeated 3×, since run 1 clearly failed the intended category.

### `зрачки2.png` — intended BROWN — **ACCEPTED**

Both eyes independently classify `brown` with maximal sector agreement (4/4 sectors each), high confidence (left 0.752, right 0.766), median RGB genuinely warm-brown (left `{r:76,g:49,b:35}`, right `{r:81,g:52,b:33}`, hue ≈ 23–24°). Bilateral `combineIris` confidently resolves to `brown` (confidence 0.723, RGB distance only 6.16 between eyes). Displayed `Карие` identically across 3 consecutive runs. Committed as `fixtures/iris-brown.png`.

### `зрачки3.png` — intended GRAY/BLUE-GRAY — **REJECTED**

Sampled evidence genuinely trends neutral/low-chroma (low saturation ~0.05–0.06 on both eyes, near-equal RGB channels — left `{r:83,g:80,b:76}`, right `{r:94,g:90,b:87}`), the correct *direction* for a gray/blue-gray fixture. But sector agreement never clears the production threshold on either eye (left 0.75 with only 1/4 sectors reading gray, right 0.5 with 2/4), so both eyes and the bilateral combine legitimately land on `uncertain` rather than `gray`. Displayed `Оттенок не определён`. This is a quality/evidence-sufficiency rejection, not a wrong-hue rejection — the pipeline correctly declines to commit to gray on weak sector evidence. Not repeated 3×, since run 1 clearly failed the intended category.

### `зрачки4.png` — intended UNCERTAIN — **ACCEPTED**

Face detection and both eyes' ROI are fully valid (not a detection/ROI failure), with substantial accepted pixel counts (~200 per eye) and a real `dark_pupil` iris-center method — but each eye's angular sectors genuinely split between adjacent warm hues: left `['brown','brown','hazel','hazel']` (sector agreement 0.5, flat-median trace `brown`), right `['brown','brown','mixed','hazel']` (sector agreement 0.25, flat-median trace `hazel`). Both eyes are demoted to `uncertain`, and the bilateral combine stays `uncertain` (confidence 0.303). This is legitimate pipeline-native ambiguity — real angular-sector disagreement and sub-threshold confidence — not a manufactured or harness-driven failure. Displayed `Оттенок не определён` identically across 3 consecutive runs. Committed as `fixtures/iris-uncertain.png`.

## Rejected fixture candidates (cumulative, Phase C2 + C3a)

| Filename | Intended category | Actual production evidence | Why rejected |
|---|---|---|---|
| `blue-eyes-source.jpg` | Unknown/unattempted | Not tested | Explicitly forbidden by task instructions; never opened or run through the pipeline |
| `глаза33` source image | Green | Not tested — no source image exists in this repo, and use is explicitly forbidden regardless | Forbidden by task instructions; only derived pixel JSON exists here |
| `зрачки1.png` | Green | Warm/amber (see above) | Wrong color evidence — sampled pixels are not green |
| `зрачки3.png` | Gray / Blue-Gray | Neutral-trending but sub-threshold sector agreement (see above) | Quality/evidence-sufficiency failure — real direction, insufficient confidence to commit |

## Categories still blocked

- **GREEN** — blocked. `зрачки1.png` was evaluated and rejected for wrong color evidence; no other candidate exists.
- **GRAY / BLUE-GRAY** — blocked. `зрачки3.png` was evaluated and rejected for insufficient sector agreement; no other candidate exists.

## What would unblock the remaining categories

A future phase would need a *new* candidate image for GREEN and/or GRAY/BLUE-GRAY (the two already evaluated here were rejected on real evidence, not on availability), generated and vetted the same way `зрачки2.png`/`зрачки4.png` were: real production pipeline run, sampled-pixel evidence genuinely supporting the intended category, 3-run stability. Neither is authorized within the current task's scope.
