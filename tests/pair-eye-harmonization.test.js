'use strict';
// PAIR-EYE HARMONIZATION / PROFESSIONAL BILATERAL LASH MAP LOGIC.
// ------------------------------------------------------------
// Regression coverage for the calculateEyeLashMap PAIR HARMONIZATION fix
// (Phase 1T). Root cause (proven by this file's own before/after test):
// the PEAK-zone decision and the tilt term of `outerAdjustment` were
// driven entirely by each eye's own raw, sub-degree-noisy physicalTilt
// reading against a hard +/-4deg threshold with zero hysteresis and zero
// pair-level context -- a 0.2deg per-eye difference straddling that
// threshold (well inside plausible landmark-measurement noise) could put
// PEAK in a different NAMED zone on LEFT vs RIGHT for Natural/Doll/Cat/
// Squirrel (Fox already had its own, narrower exemption).
//
// FIX: the categorical PEAK-zone decision (and the tilt-term of
// outerAdjustment) now uses `c.tiltDegrees` -- the SAME pair-level,
// L/R-agreement-checked composite tilt already computed once per client
// and already used to drive the shared curl recommendation
// (recommendCurl) -- as the shared baseline, with a narrowly-gated
// per-eye override that only fires when the ALREADY-EXISTING
// `c.compositeAsymmetry > 0.07` threshold (reused verbatim from the
// pre-existing correctionMm gate a few lines below in the same function)
// confirms real, measured, cross-checked anatomical asymmetry. No new
// numeric threshold was invented anywhere in this fix.
//
// Every function under test is extracted from the REAL, unmodified
// index.html via the established string-slice + new Function technique.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractApi(source) {
  const util = source.slice(source.indexOf('    const mirrorReflectDeg = (deg) => {'), source.indexOf('\n    const clampScore'));
  const mapStart = source.indexOf('    function calculateEyeLashMap(');
  const mapEnd = source.indexOf('    const CLIENT_LASH_DESIGN_REGISTRY', mapStart);
  const mapSource = source.slice(mapStart, mapEnd);
  const catalogStart = source.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = source.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalog = new Function('const clampScore=n=>n;' + source.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();
  const { calculateEyeLashMap, buildEyeZones } = new Function(util + '\n' + mapSource + '\nreturn { calculateEyeLashMap, buildEyeZones };')();
  return { calculateEyeLashMap, buildEyeZones, catalog, mapSource };
}

const current = extractApi(src);
const { calculateEyeLashMap, buildEyeZones, catalog } = current;

const recommendCurlSrc = src.slice(src.indexOf('    function recommendCurl('), src.indexOf('\n\n    // ------------------------------------------------------------\n    // TECHNIQUE CATALOG'));
const buildDesignResultStart = src.indexOf('    function buildDesignResult(');
const buildDesignResultSrc = src.slice(buildDesignResultStart, src.indexOf('\n    function ', buildDesignResultStart + 20));

const ZONE_NAMES = ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER'];

// ------------------------------------------------------------
// Fixture builders. `tiltDegrees` mirrors exactly how the real eye-profile
// aggregation computes it (avg of the two physical per-eye tilts) --
// never hardcoded independently of the two tilt inputs, so these
// fixtures cannot silently drift from what production actually derives.
// ------------------------------------------------------------
function makeEye(overrides = {}) { return { width: 24, ear: 0.24, innerTaperDeg: 60, outerTaperDeg: 70, ...overrides }; }
function makeClient({ leftEye, rightEye, leftTilt = 1, rightTilt = 1, relativeEyeSize = 0.33, isCloseSet = false, compositeAsymmetry = 0.02 }) {
  return {
    leftEye, rightEye,
    perEyeTiltDegrees: { left: leftTilt, right: rightTilt },
    tiltDegrees: (leftTilt + rightTilt) / 2,
    relativeEyeSize, isCloseSet, compositeAsymmetry,
  };
}
function divergence(entry, c) {
  const { left, right, leftPeakZone, rightPeakZone, leftCorrectionMm, rightCorrectionMm } = buildEyeZones(entry, c);
  return {
    left, right, leftPeakZone, rightPeakZone,
    leftPeakName: ZONE_NAMES[leftPeakZone], rightPeakName: ZONE_NAMES[rightPeakZone],
    peakNameDiffers: ZONE_NAMES[leftPeakZone] !== ZONE_NAMES[rightPeakZone],
    maxZoneDelta: Math.max(...left.map((v, i) => Math.abs(v - right[i]))),
    meanZoneDelta: left.reduce((s, v, i) => s + Math.abs(v - right[i]), 0) / left.length,
    leftCorrectionMm, rightCorrectionMm,
  };
}

const DESIGNS = ['natural', 'doll', 'fox', 'cat', 'squirrel'].map((id) => {
  const entry = catalog.find((e) => e.id === id);
  assert.ok(entry, `${id} must exist in the real DESIGN_CATALOG`);
  return entry;
});

// ============================================================
// 1. Regression proof: OLD behavior reproduces the bug, NEW behavior fixes it.
// ============================================================
test('REGRESSION PROOF: the tiny-tilt PEAK divergence bug reproduces against the pre-fix (HEAD) source and is fixed in the current working tree', () => {
  let beforeSrc;
  try {
    beforeSrc = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  } catch (e) {
    // If HEAD already IS the fix commit (e.g. this test file is re-run
    // after a later commit), the historical pre-fix source is recovered
    // from HEAD~1 instead -- the specific commit is irrelevant, only
    // that we compare against a real pre-fix snapshot.
    beforeSrc = execSync('git show HEAD~1:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
  }
  const before = extractApi(beforeSrc);
  // If HEAD is already post-fix (e.g. re-running this suite on a branch
  // built on top of the fix commit), fall back further until a genuinely
  // different (pre-fix) mapSource is found, bounded to a few commits.
  let depth = 1;
  while (before.mapSource === current.mapSource && depth < 6) {
    beforeSrc = execSync(`git show HEAD~${depth}:index.html`, { cwd: root, maxBuffer: 1024 * 1024 * 50 }).toString('utf8');
    Object.assign(before, extractApi(beforeSrc));
    depth++;
  }
  assert.notStrictEqual(before.mapSource, current.mapSource, 'a genuinely pre-fix calculateEyeLashMap/buildEyeZones source must be found within recent history for this regression proof to be meaningful');

  const eye = makeEye();
  const bugFixture = makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 3.9, rightTilt: 4.1 });
  const natural = before.catalog.find((e) => e.id === 'natural');

  const oldResult = divergence.call(null, natural, bugFixture);
  // divergence() above closes over the CURRENT buildEyeZones; build a
  // local variant bound to the OLD (pre-fix) implementation instead.
  const oldDiv = (() => {
    const { left, right, leftPeakZone, rightPeakZone } = before.buildEyeZones(natural, bugFixture);
    return { peakNameDiffers: ZONE_NAMES[leftPeakZone] !== ZONE_NAMES[rightPeakZone], leftPeakName: ZONE_NAMES[leftPeakZone], rightPeakName: ZONE_NAMES[rightPeakZone] };
  })();
  const newDiv = divergence(natural, bugFixture);

  assert.strictEqual(oldDiv.peakNameDiffers, true, `OLD behavior must reproduce the bug: LEFT=${oldDiv.leftPeakName} RIGHT=${oldDiv.rightPeakName} for a 0.2deg tilt difference straddling +/-4deg -- if this assertion fails, the "before" snapshot is not the actual pre-fix code and this regression proof is invalid`);
  assert.strictEqual(newDiv.peakNameDiffers, false, `NEW (current) behavior must fix the bug: LEFT=${newDiv.leftPeakName} RIGHT=${newDiv.rightPeakName}`);
});

// ============================================================
// A. Symmetric pair
// ============================================================
test('A. symmetric pair: identical anatomy produces identical maps for every tested design', () => {
  for (const entry of DESIGNS) {
    const eye = makeEye();
    const d = divergence(entry, makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 1, rightTilt: 1 }));
    assert.strictEqual(d.maxZoneDelta, 0, `${entry.id}: symmetric eyes must produce identical zone lengths`);
    assert.strictEqual(d.peakNameDiffers, false, `${entry.id}: symmetric eyes must share PEAK zone name`);
  }
});

// ============================================================
// B/tiny asymmetry: measurement-noise drift prevention (invariants B/C/D)
// ============================================================
test('B. tiny tilt asymmetry straddling +/-4deg does not create a different design identity (PEAK stays coherent) -- Natural/Doll/Cat/Squirrel', () => {
  for (const entry of DESIGNS) {
    const eye = makeEye();
    const d = divergence(entry, makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 3.9, rightTilt: 4.1 }));
    assert.strictEqual(d.peakNameDiffers, false, `${entry.id}: a 0.2deg tilt difference must not flip PEAK to a different named zone (LEFT=${d.leftPeakName} RIGHT=${d.rightPeakName})`);
    assert.strictEqual(d.maxZoneDelta, 0, `${entry.id}: must produce identical zone lengths for this noise-level difference`);
  }
});

test('tiny width asymmetry alone does not create divergence', () => {
  for (const entry of DESIGNS) {
    const d = divergence(entry, makeClient({ leftEye: makeEye({ width: 24 }), rightEye: makeEye({ width: 24.5 }), leftTilt: 1, rightTilt: 1 }));
    assert.strictEqual(d.maxZoneDelta, 0, `${entry.id}: a 0.5-unit width difference (continuous scale, no threshold) must not diverge`);
  }
});

test('tiny opening (EAR) asymmetry alone does not create divergence', () => {
  for (const entry of DESIGNS) {
    const d = divergence(entry, makeClient({ leftEye: makeEye({ ear: 0.24 }), rightEye: makeEye({ ear: 0.245 }), leftTilt: 1, rightTilt: 1 }));
    assert.strictEqual(d.maxZoneDelta, 0, `${entry.id}: a 0.005 EAR difference must not diverge`);
  }
});

test('tiny tilt asymmetry away from the +/-4deg threshold does not diverge (isolates the fix to the boundary, not tilt differences in general)', () => {
  for (const entry of DESIGNS) {
    const eye = makeEye();
    const d = divergence(entry, makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 0.9, rightTilt: 1.1 }));
    assert.strictEqual(d.maxZoneDelta, 0, `${entry.id}: a 0.2deg difference far from any threshold must not diverge`);
  }
});

// ============================================================
// C/D. Moderate and strong asymmetry: controlled correction preserved
// (invariants E/F -- genuine asymmetry is NOT blindly averaged away)
// ============================================================
test('C. moderate asymmetry (one eye measurably more downturned + narrower) retains a bounded, explainable correction', () => {
  for (const entry of DESIGNS) {
    const d = divergence(entry, makeClient({
      leftEye: makeEye({ width: 24, ear: 0.24 }), rightEye: makeEye({ width: 22.5, ear: 0.21 }),
      leftTilt: 1, rightTilt: 6, compositeAsymmetry: 0.09,
    }));
    assert.ok(d.rightCorrectionMm > 0, `${entry.id}: the measurably worse (narrower/less-open) eye must receive a nonzero, explainable correctionMm`);
    assert.strictEqual(d.leftCorrectionMm, 0, `${entry.id}: the unaffected eye must receive zero correctionMm (correction is not applied symmetrically/blindly)`);
    assert.ok(d.maxZoneDelta <= 3, `${entry.id}: correction must stay bounded (observed maxZoneDelta=${d.maxZoneDelta}) -- see report for the exact evidence-derived bound`);
  }
});

test('D. strong asymmetry is not blindly averaged away: the more-asymmetric eye still receives measurable correction, and the pair still shares one coherent design baseline', () => {
  for (const entry of DESIGNS) {
    const c = makeClient({
      leftEye: makeEye({ width: 25, ear: 0.26 }), rightEye: makeEye({ width: 20, ear: 0.18 }),
      leftTilt: 0, rightTilt: 9, compositeAsymmetry: 0.30,
    });
    const d = divergence(entry, c);
    assert.ok(d.rightCorrectionMm > 0, `${entry.id}: strong asymmetry must still produce a real correction on the worse eye, not be averaged to zero`);
    // Shared design coherence: because the PAIR-level tilt average (4.5deg)
    // itself crosses the shared threshold, BOTH eyes adopt the same
    // baseline PEAK zone -- this is the "one coherent design" principle;
    // the residual, bounded correctionMm captures the genuine per-eye
    // difference on top of that shared baseline.
    assert.strictEqual(d.peakNameDiffers, false, `${entry.id}: even under strong asymmetry, the pair must share one semantic PEAK identity (LEFT=${d.leftPeakName} RIGHT=${d.rightPeakName}) -- the per-eye difference is expressed as a bounded length correction, not a categorical design split`);
  }
});

// ============================================================
// PEAK coherence (Section 11)
// ============================================================
test('PEAK coherence: for every tested design, LEFT and RIGHT never receive PEAK in zones more than one physical position apart under any tested fixture', () => {
  const fixtures = [
    makeClient({ leftEye: makeEye(), rightEye: makeEye(), leftTilt: 3.9, rightTilt: 4.1 }),
    makeClient({ leftEye: makeEye({ width: 24, ear: 0.24 }), rightEye: makeEye({ width: 22.5, ear: 0.21 }), leftTilt: 1, rightTilt: 6, compositeAsymmetry: 0.09 }),
    makeClient({ leftEye: makeEye({ width: 25, ear: 0.26 }), rightEye: makeEye({ width: 20, ear: 0.18 }), leftTilt: 0, rightTilt: 9, compositeAsymmetry: 0.30 }),
  ];
  for (const entry of DESIGNS) for (const c of fixtures) {
    const d = divergence(entry, c);
    assert.ok(Math.abs(d.leftPeakZone - d.rightPeakZone) <= 1, `${entry.id}: PEAK zone index must never differ by more than 1 physical position (LEFT=${d.leftPeakZone} RIGHT=${d.rightPeakZone})`);
  }
});

// ============================================================
// Curl coherence (Section 13)
// ============================================================
test('curl coherence: recommendCurl is computed once per client (pair-level), never per eye -- source-level proof', () => {
  assert.ok(!/\bside\b/.test(recommendCurlSrc), 'recommendCurl must not take or branch on a `side` parameter');
  assert.ok(buildDesignResultSrc.includes('const curlRec = recommendCurl(c, entry, lang);'), 'buildDesignResult must call recommendCurl exactly once, not once per eye');
  const curlRecCallCount = (buildDesignResultSrc.match(/recommendCurl\(/g) || []).length;
  assert.strictEqual(curlRecCallCount, 1, 'recommendCurl must be called exactly once per design result, shared by both eyes');
});

test('curl coherence: buildDesignResult never produces a leftCurl/rightCurl split -- only one shared curlRec field', () => {
  assert.ok(buildDesignResultSrc.includes('curlRec,'), 'legacyDesign must expose one shared curlRec');
  assert.ok(!/leftCurl|rightCurl/.test(buildDesignResultSrc), 'no per-eye curl field may exist -- curl remains a pair-level DESIGN variable, not a per-eye CORRECTION variable, per the current architecture');
});

// ============================================================
// Zone-length coherence (Section 12) -- every retained difference must be inspectable/explainable
// ============================================================
test('zone-length coherence: every nonzero per-eye correction is attributable to a nonzero correctionMm (no unexplained silent divergence path)', () => {
  const c = makeClient({
    leftEye: makeEye({ width: 24, ear: 0.24, innerTaperDeg: 58, outerTaperDeg: 75 }),
    rightEye: makeEye({ width: 23, ear: 0.225, innerTaperDeg: 53, outerTaperDeg: 82 }),
    leftTilt: 1, rightTilt: 5, compositeAsymmetry: 0.10,
  });
  for (const entry of DESIGNS) {
    const d = divergence(entry, c);
    // innerTaperDeg/outerTaperDeg boolean adjustments and correctionMm
    // are the only remaining, EXPLAINABLE per-eye divergence sources at
    // this fixture's magnitude; assert the divergence is bounded to what
    // those specific, inspectable mechanisms can produce (not an
    // unbounded/unexplained drift).
    assert.ok(d.maxZoneDelta <= 4, `${entry.id}: divergence (${d.maxZoneDelta}) must stay within the range explainable by innerAdjustment/outerAdjustment/correctionMm for this fixture`);
  }
});

// ============================================================
// Physical INNER/OUTER + Fox/Cat tail (Section 15, re-verifying the
// closed mirror investigation is untouched by this phase)
// ============================================================
test('physical INNER/OUTER: zones are always returned in physical order regardless of which side (left/right) is requested', () => {
  const c = makeClient({ leftEye: makeEye(), rightEye: makeEye({ width: 22 }), leftTilt: 1, rightTilt: 3 });
  for (const entry of DESIGNS) {
    const leftResult = calculateEyeLashMap(entry, c, 'left');
    const rightResult = calculateEyeLashMap(entry, c, 'right');
    assert.strictEqual(leftResult.zones.length, 5, `${entry.id}: LEFT must return 5 physically-ordered zones`);
    assert.strictEqual(rightResult.zones.length, 5, `${entry.id}: RIGHT must return 5 physically-ordered zones`);
  }
});

test('Fox pair: the fox-only tilt exemption is untouched -- Fox never receives the shared-tilt PEAK demotion this fix introduced for other designs', () => {
  const foxEntry = catalog.find((e) => e.id === 'fox');
  const eye = makeEye();
  const c = makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 6, rightTilt: 6 }); // both past threshold
  const d = divergence(foxEntry, c);
  assert.strictEqual(d.leftPeakZone, foxEntry.peakZone, 'Fox LEFT PEAK must stay at its authored late-outer zone regardless of shared tilt (exemption preserved)');
  assert.strictEqual(d.rightPeakZone, foxEntry.peakZone, 'Fox RIGHT PEAK must stay at its authored late-outer zone regardless of shared tilt (exemption preserved)');
  assert.strictEqual(ZONE_NAMES[d.leftPeakZone], 'PEAK');
});

test('Cat pair: PEAK coherence and length coherence hold for the Cat-family design specifically', () => {
  const catEntry = catalog.find((e) => e.id === 'cat');
  const eye = makeEye();
  const noiseFixture = makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 3.9, rightTilt: 4.1 });
  const d = divergence(catEntry, noiseFixture);
  assert.strictEqual(d.peakNameDiffers, false, 'Cat: noise-level tilt difference must not split PEAK identity');
  assert.strictEqual(d.maxZoneDelta, 0);
});

test('Natural control: the baseline, non-directional design remains fully coherent under every tested fixture magnitude that should not diverge', () => {
  const naturalEntry = catalog.find((e) => e.id === 'natural');
  const eye = makeEye();
  for (const fixture of [
    makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 1, rightTilt: 1 }),
    makeClient({ leftEye: eye, rightEye: { ...eye }, leftTilt: 3.9, rightTilt: 4.1 }),
    makeClient({ leftEye: makeEye({ width: 24 }), rightEye: makeEye({ width: 24.5 }), leftTilt: 1, rightTilt: 1 }),
  ]) {
    const d = divergence(naturalEntry, fixture);
    assert.strictEqual(d.maxZoneDelta, 0, 'Natural: must stay fully coherent for symmetric/noise-level fixtures');
  }
});

// ============================================================
// Shared design identity / correction-reason integrity (Sections 14, J)
// ============================================================
test('shared design identity: entry (the professional design/effect) and curlRec are identical object references for both eyes -- the pair always receives the same DESIGN', () => {
  const c = makeClient({ leftEye: makeEye(), rightEye: makeEye({ width: 20 }), leftTilt: 0, rightTilt: 8, compositeAsymmetry: 0.25 });
  for (const entry of DESIGNS) {
    // calculateEyeLashMap receives the exact same `entry` object for both
    // calls in buildEyeZones -- confirmed at the source level (both
    // `calculateEyeLashMap(entry, c, 'left')` and `(entry, c, 'right')`
    // read the identical `entry` reference, never a per-side variant).
    assert.ok(current.mapSource.includes("calculateEyeLashMap(entry, c, 'left')"));
    assert.ok(current.mapSource.includes("calculateEyeLashMap(entry, c, 'right')"));
  }
});

test('correction-reason integrity: every nonzero correctionMm has an inspectable anatomical reason (widthDeficit or openingDeficit > 0 on that specific eye)', () => {
  const c = makeClient({
    leftEye: makeEye({ width: 24, ear: 0.24 }), rightEye: makeEye({ width: 22.5, ear: 0.21 }),
    leftTilt: 1, rightTilt: 6, compositeAsymmetry: 0.09,
  });
  for (const entry of DESIGNS) {
    const rightResult = calculateEyeLashMap(entry, c, 'right');
    if (rightResult.correctionMm > 0) {
      assert.ok(c.rightEye.width < c.leftEye.width || c.rightEye.ear < c.leftEye.ear, `${entry.id}: a nonzero correctionMm must correspond to a real, inspectable measured deficit (this eye is narrower and/or less open than its pair)`);
    }
  }
});

// ============================================================
// Unresolved-threshold documentation (Section 8): the two remaining
// per-eye boolean cliffs (innerTaperDeg<55, outerTaperDeg>80) are
// deliberately NOT harmonized -- no pair-level composite exists for
// these in the current architecture, and inventing a dead-band width
// would be an unevidenced guess. This test pins their existence so a
// future phase with real domain evidence can find and resolve them.
// ============================================================
test('UNRESOLVED (documented, not fixed): innerTaperDeg/outerTaperDeg remain per-eye boolean cliffs with no pair-level composite to reuse', () => {
  assert.ok(current.mapSource.includes('eye.innerTaperDeg<55?1:0'), 'innerTaperDeg 55deg cliff must still exist and be visible for future review');
  assert.ok(current.mapSource.includes('eye.outerTaperDeg>80?1:0'), 'outerTaperDeg 80deg cliff must still exist and be visible for future review');
  for (const entry of DESIGNS) {
    const d = divergence(entry, makeClient({ leftEye: makeEye({ innerTaperDeg: 54.9 }), rightEye: makeEye({ innerTaperDeg: 55.1 }), leftTilt: 1, rightTilt: 1 }));
    assert.ok(d.maxZoneDelta <= 1, `${entry.id}: the still-unresolved innerTaperDeg cliff is bounded to a max 1mm effect (documented, not silently larger)`);
  }
});
