'use strict';
// PHASE CLIENT-1 — CANONICAL VISIT SNAPSHOT CONTRACT.
// Regression coverage for visit-snapshot.js. Fixtures for the DESIGN
// snapshot are built via the REAL, unmodified
// LashDesignDomain.legacyToClientLashDesign (same technique as every
// other test in this project — exercising real production code, not a
// hand-duplicated shape) rather than hand-crafted ClientLashDesign
// objects.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const VisitSnapshot = require(path.join(root, 'visit-snapshot.js'));
const LashDesignDomain = require(path.join(root, 'lash-design-domain.js'));

// ------------------------------------------------------------
// Real ClientLashDesign v2 fixture, built via the real production
// converter (same one buildDesignResult uses in index.html).
// ------------------------------------------------------------
function realExpandSectors(zones, peakIdx) {
  return zones.map((len, i) => ({ len, t: i / (zones.length - 1), isPeak: i === peakIdx, isKey: true, label: ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER'][i] }));
}
function buildRealClientDesign(overrides = {}) {
  const designId = overrides.design?.id || 'fox';
  const catalogEntry = { id: designId, baseZones: [6, 7, 9, 12, 11], peakZone: 3, zonePositions: [0, 0.2, 0.44, 0.66, 1], postPeakShape: 'gradual', plateauShape: 'linear' };
  const design = {
    id: designId, category: 'elongating', name: 'Fox', ruName: 'Fox', enName: 'Fox', aliases: ['Fox-inspired'],
    score: 82, whyItWorks: 'Pronounced horizontal elongation toward the temple.', correctionGoal: '', limitations: ['Needs a supportive tilt'],
    baseCurl: 'C', curlOptions: ['C', 'CC', 'D'], defaultTechnique: 'Light Volume 2D',
    peakZone: 3, leftPeakZone: 3, rightPeakZone: 2,
    leftCorrectionMm: 0, rightCorrectionMm: 1,
    texture: null,
    curve: { zonePositions: catalogEntry.zonePositions, postPeakShape: 'gradual', plateauShape: 'linear' },
    leftZones: [6, 7, 9, 12, 11], rightZones: [6, 8, 9, 11, 10],
    curlRec: { primary: 'CC', alternatives: ['C', 'D'], reason: 'Compensates a downturned corner with a stronger curve.' },
    ...overrides.design,
  };
  const eyeProfile = { artistConfirmed: true, compositeAsymmetry: 0.09, isHooded: false, isCloseSet: false, isWideSet: false, tiltTendency: 'downturned', ...overrides.eyeProfile };
  return LashDesignDomain.legacyToClientLashDesign({ design, catalogEntry, eyeProfile, expandSectors: realExpandSectors, rank: 0, naturalLashProfile: overrides.naturalLashProfile });
}

function realEyeProfileFixture(overrides = {}) {
  return {
    eyeShapeCategory: 'almond', eyeShapeConfidence: 0.81,
    tiltTendency: 'downturned', tiltConfidence: 0.62, tiltDegrees: 4.5,
    perEyeTiltDegrees: { left: 1, right: 8 },
    eyelidCategory: 'mild', eyelidCategoryConfidence: 0.7,
    eyelidType: 'openCrease', eyelidTypeConfidence: 0.66, eyelidSignalsConflict: false,
    creaseState: 'visible', hoodingState: 'nonHooded',
    isCloseSet: false, isWideSet: false, eyeSetCategory: 'balanced',
    relativeEyeSize: 0.33, eyeSizeCategory: 'medium',
    compositeAsymmetry: 0.09, symmetryCategory: 'mild',
    overallConfidence: 0.71,
    // fields that MUST NOT leak into the snapshot
    leftEye: { width: 24.3, height: 9.1, ear: 0.241, innerTaperDeg: 58, outerTaperDeg: 74 },
    rightEye: { width: 22.8, height: 8.4, ear: 0.219, innerTaperDeg: 51, outerTaperDeg: 83 },
    debug: { left: { whRatio: 2.6 }, right: { whRatio: 2.7 } },
    shapeTendencies: { round: 0.1, almond: 0.7, elongated: 0.2 },
    shapeMargin: 0.34,
    hoodingRatio: 0.28,
    spacingRatio: 1.05, spacingConfidence: 0.8,
    depthConfidence: 0.12,
    ...overrides,
  };
}

function realIrisFixture(overrides = {}) {
  return {
    name: 'green', confidence: 0.74,
    compositionLabel: 'hazel', colorComposition: { green: 0.34, amber: 0.48, gray: 0.12, brown: 0.06 },
    ...overrides,
  };
}

function realNaturalLashProfileFixture() {
  return {
    left: { hasData: true, visualDensity: 'medium', overallLenBucket: 'medium', dominantDirection: 'up', confidence: 0.6, framesUsed: 12, condition: { locallyReducedOccupancy: false }, zones: {} },
    right: { hasData: true, visualDensity: 'sparse', overallLenBucket: 'short', dominantDirection: 'up', confidence: 0.55, framesUsed: 10, condition: { locallyReducedOccupancy: true }, zones: {} },
    comparison: { hasComparison: true, occupancyDiff: 0.12, conditionComparison: { locallyReducedOccupancy: 'right-only' } },
  };
}

// ============================================================
// A/B. canonical inputs produce valid snapshots
// ============================================================
test('A. a canonical completed analysis (eyeProfile+iris) produces a valid analysisSnapshot', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ eyeProfile: realEyeProfileFixture(), iris: realIrisFixture(), naturalLashProfile: realNaturalLashProfileFixture() });
  assert.strictEqual(snap.snapshotSchemaVersion, 1);
  assert.strictEqual(snap.eye.shape.category, 'almond');
  assert.strictEqual(snap.eye.shape.confidence, 0.81);
  assert.strictEqual(snap.eye.spacing.category, 'balanced');
  assert.strictEqual(snap.eye.size.category, 'medium');
  assert.strictEqual(snap.eye.symmetry.category, 'mild');
  assert.strictEqual(snap.eye.overallConfidence, 0.71);
});

test('B. a canonical professional design (ClientLashDesign v2) produces a valid designSnapshot', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.snapshotSchemaVersion, 1);
  assert.strictEqual(snap.designId, 'fox');
  assert.strictEqual(snap.display.name, 'Fox');
  assert.strictEqual(snap.curl.global, 'CC');
});

// ============================================================
// C/D/E/F. Lash Map fidelity
// ============================================================
test('C. LEFT/RIGHT Lash Maps retain physical INNER->OUTER semantics (5-length arrays, order preserved)', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.physicalEyes.left.finalMm.length, 5);
  assert.strictEqual(snap.physicalEyes.right.finalMm.length, 5);
  // physical order is INNER(index 0) -> OUTER(index 4) -- proven by
  // ZONE_NAMES alignment already established elsewhere (Pair-Eye
  // Harmonization phase); this test asserts the snapshot preserves the
  // exact array as given, never reversed/reordered.
  assert.deepStrictEqual(snap.physicalEyes.left.finalMm, [6, 7, 9, 12, 11]);
  assert.deepStrictEqual(snap.physicalEyes.right.finalMm, [6, 8, 9, 11, 10]);
});

test('D. zone lengths survive snapshot exactly', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.deepStrictEqual(snap.physicalEyes.left.finalMm, clientDesign.mapping.physicalEyes.left.finalMm);
  assert.deepStrictEqual(snap.physicalEyes.right.finalMm, clientDesign.mapping.physicalEyes.right.finalMm);
});

test('E. per-zone curl: the current legacy pipeline has no per-zone curl (byZone is always null) -- snapshot preserves that honestly, does not fabricate one', () => {
  const clientDesign = buildRealClientDesign();
  assert.strictEqual(clientDesign.curl.byZone, null, 'sanity: the real ClientLashDesign converter itself has curl.byZone===null today');
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.curl.byZone, null);
  assert.strictEqual(snap.curl.global, 'CC', 'the single shared (pair-level) curl value must still survive');
});

test('F. PEAK survives exactly, independently per eye', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.physicalEyes.left.peakZone, 3);
  assert.strictEqual(snap.physicalEyes.right.peakZone, 2);
});

// ============================================================
// G. correction survives
// ============================================================
test('G. correctionMm and curl reason survive when present', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.correction.left.correctionMm, 0);
  assert.strictEqual(snap.correction.right.correctionMm, 1);
  assert.strictEqual(snap.curl.reason, 'Compensates a downturned corner with a stronger curve.');
});

// ============================================================
// H. referenceTemplate
// ============================================================
test('H. referenceTemplate: reserved as null (no current production design is built from a professional-lash-library.js referenceTemplate)', () => {
  const clientDesign = buildRealClientDesign();
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.referenceTemplateId, null);
  assert.ok(Object.prototype.hasOwnProperty.call(snap, 'referenceTemplateId'), 'the field must exist (reserved), even though it is always null today');
});

// ============================================================
// I/J. missing/uncertain data
// ============================================================
test('I. uncertain iris remains uncertain (never silently resolved to a confident category)', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ iris: realIrisFixture({ name: 'uncertain', compositionLabel: 'uncertain', colorComposition: null }) });
  assert.strictEqual(snap.iris.category, 'uncertain');
  assert.strictEqual(snap.iris.compositionLabel, 'uncertain');
  assert.strictEqual(snap.iris.colorComposition, null);
});

test('I2. missing iris entirely is represented as null, not a fabricated category', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ iris: null });
  assert.strictEqual(snap.iris, null);
});

test('J. missing Natural Lash Scan remains UNAVAILABLE rather than fabricated', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ naturalLashProfile: null });
  assert.strictEqual(snap.naturalLash.availability, 'UNAVAILABLE');
  assert.strictEqual(snap.naturalLash.eyes.left.availability, 'UNAVAILABLE');
  assert.strictEqual(snap.naturalLash.eyes.right.availability, 'UNAVAILABLE');
});

test('J2. Natural Lash Scan LEFT/RIGHT condition is preserved when available (via the real, reused buildNaturalLashEvidence)', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ naturalLashProfile: realNaturalLashProfileFixture() });
  assert.strictEqual(snap.naturalLash.availability, 'PARTIAL');
  assert.strictEqual(snap.naturalLash.eyes.left.availability, 'AVAILABLE');
  assert.strictEqual(snap.naturalLash.eyes.right.availability, 'AVAILABLE');
  assert.strictEqual(snap.naturalLash.comparison.availability, 'AVAILABLE');
});

test('missing design (no active design selected) is represented as designSnapshot: null in buildVisitSnapshot', () => {
  const visit = VisitSnapshot.buildVisitSnapshot({ result: { eyeProfile: realEyeProfileFixture(), iris: realIrisFixture() }, activeDesign: null, naturalLashProfile: null });
  assert.strictEqual(visit.designSnapshot, null);
  assert.ok(visit.analysisSnapshot);
});

test('recommendation-unavailable / partial optional metadata: missing recommendation fields resolve to null, not thrown errors', () => {
  const clientDesign = buildRealClientDesign({ design: { whyItWorks: '', correctionGoal: '', limitations: [] } });
  clientDesign.recommendation = { score: undefined, rank: null };
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.strictEqual(snap.recommendation.score, null);
  assert.strictEqual(snap.recommendation.rank, null);
});

// ============================================================
// K. no diagnostic-only fields leak
// ============================================================
test('K. no diagnostic-only fields leak into the analysisSnapshot', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ eyeProfile: realEyeProfileFixture(), iris: realIrisFixture() });
  const json = JSON.stringify(snap);
  for (const forbidden of ['whRatio', 'shapeTendencies', 'shapeMargin', 'hoodingRatio', 'spacingRatio', 'depthConfidence', 'debug', 'apertureAsymmetry']) {
    assert.ok(!json.includes(forbidden), `forbidden diagnostic field "${forbidden}" leaked into analysisSnapshot`);
  }
});

test('K2. no raw per-eye pixel-derived measurements (leftEye/rightEye) leak into the analysisSnapshot', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ eyeProfile: realEyeProfileFixture() });
  const json = JSON.stringify(snap);
  for (const forbidden of ['24.3', '22.8', 'innerTaperDeg', 'outerTaperDeg', 'widthRatio', 'covCenterByWidth']) {
    assert.ok(!json.includes(forbidden), `forbidden raw measurement "${forbidden}" leaked into analysisSnapshot`);
  }
});

test('K3. no renderer-only derivedSectors leak into the designSnapshot', () => {
  const clientDesign = buildRealClientDesign();
  assert.ok(Array.isArray(clientDesign.mapping.physicalEyes.left.derivedSectors), 'sanity: the real ClientLashDesign does carry derivedSectors');
  const snap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  assert.ok(!Object.prototype.hasOwnProperty.call(snap.physicalEyes.left, 'derivedSectors'));
  assert.ok(!JSON.stringify(snap).includes('derivedSectors'));
});

// ============================================================
// L. no photo/image/landmark data leaks (Section 10 of the task)
// ============================================================
test('L. no photo/image/landmark data can appear in any snapshot -- proven against a result object that actually carries them', () => {
  const resultWithPhoto = {
    originalImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD-fake-not-a-real-photo',
    landmarks: { positions: [{ x: 1, y: 2 }], getNose: () => [] },
    imageWidth: 800, imageHeight: 600,
    eyeProfile: realEyeProfileFixture(), iris: realIrisFixture(),
  };
  const visit = VisitSnapshot.buildVisitSnapshot({ result: resultWithPhoto, activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const json = JSON.stringify(visit);
  for (const forbidden of ['data:image', 'base64', 'originalImage', 'landmarks', 'positions', 'imageWidth', 'imageHeight']) {
    assert.ok(!json.includes(forbidden), `forbidden photo/image/landmark marker "${forbidden}" leaked into the visit snapshot`);
  }
});

test('L2. source-level proof: visit-snapshot.js never references originalImage/landmarks/dataURL/base64/getImageData anywhere in its own source', () => {
  const src = fs.readFileSync(path.join(root, 'visit-snapshot.js'), 'utf8');
  for (const forbidden of ['originalImage', 'landmarks', 'dataURL', 'base64', 'getImageData', 'toDataURL']) {
    assert.ok(!src.includes(forbidden), `visit-snapshot.js source must never reference "${forbidden}"`);
  }
});

// ============================================================
// M. source-object mutation after snapshot creation
// ============================================================
test('M. mutating the source eyeProfile/iris/clientDesign objects after snapshot creation does not alter the snapshot', () => {
  const eyeProfile = realEyeProfileFixture();
  const iris = realIrisFixture();
  const clientDesign = buildRealClientDesign();
  const analysisSnap = VisitSnapshot.buildAnalysisSnapshot({ eyeProfile, iris });
  const designSnap = VisitSnapshot.buildDesignSnapshot(clientDesign);
  const beforeAnalysis = JSON.stringify(analysisSnap);
  const beforeDesign = JSON.stringify(designSnap);

  eyeProfile.eyeShapeCategory = 'round';
  eyeProfile.tiltConfidence = 0.01;
  iris.name = 'brown';
  iris.colorComposition.green = 0.99;
  clientDesign.mapping.physicalEyes.left.finalMm[0] = 99;
  clientDesign.mapping.physicalEyes.left.finalMm.push(999);
  clientDesign.curl.global = 'MUTATED';
  clientDesign.personalization.right.correctionMm = 77;

  assert.strictEqual(JSON.stringify(analysisSnap), beforeAnalysis, 'analysisSnapshot must be unaffected by later mutation of its source objects');
  assert.strictEqual(JSON.stringify(designSnap), beforeDesign, 'designSnapshot must be unaffected by later mutation of its source objects');
});

// ============================================================
// N. historical stability against future professional-definition changes
// ============================================================
test('N. source-level proof: visit-snapshot.js never references DESIGN_CATALOG, ProfessionalLashLibrary, calculateEyeLashMap, expandLashMapSectors, or rankDesigns -- a future change to any of them cannot alter historical snapshots because the builder never calls into them', () => {
  const src = fs.readFileSync(path.join(root, 'visit-snapshot.js'), 'utf8');
  for (const forbidden of ['DESIGN_CATALOG', 'ProfessionalLashLibrary', 'calculateEyeLashMap', 'expandLashMapSectors', 'rankDesigns', 'buildDesignResult']) {
    assert.ok(!src.includes(forbidden), `visit-snapshot.js must never reference "${forbidden}"`);
  }
});

test('N2. a snapshot taken before a design change is unaffected by later, unrelated construction of a different design object', () => {
  const clientDesignA = buildRealClientDesign();
  const snapA = VisitSnapshot.buildDesignSnapshot(clientDesignA);
  // Simulate "the professional library/catalog changed": build a
  // completely different design from scratch after the snapshot exists.
  const clientDesignB = buildRealClientDesign({ design: { id: 'cat', name: 'Cat Eye', leftZones: [1, 1, 1, 1, 1], rightZones: [1, 1, 1, 1, 1] } });
  VisitSnapshot.buildDesignSnapshot(clientDesignB); // exercised, result intentionally unused
  assert.strictEqual(snapA.designId, 'fox');
  assert.deepStrictEqual(snapA.physicalEyes.left.finalMm, [6, 7, 9, 12, 11]);
});

// ============================================================
// O. serialization round-trip
// ============================================================
test('O. snapshot serialization/deserialization (JSON round-trip) preserves values exactly -- both snapshots are plain JSON-safe data', () => {
  const visit = VisitSnapshot.buildVisitSnapshot({
    result: { eyeProfile: realEyeProfileFixture(), iris: realIrisFixture() },
    activeDesign: buildRealClientDesign(),
    naturalLashProfile: realNaturalLashProfileFixture(),
  });
  const roundTripped = JSON.parse(JSON.stringify(visit));
  assert.deepStrictEqual(roundTripped, visit);
});

// ============================================================
// P. snapshotSchemaVersion
// ============================================================
test('P. snapshotSchemaVersion exists on both snapshots and is deterministic', () => {
  const visit = VisitSnapshot.buildVisitSnapshot({
    result: { eyeProfile: realEyeProfileFixture(), iris: realIrisFixture() },
    activeDesign: buildRealClientDesign(),
  });
  assert.strictEqual(visit.analysisSnapshot.snapshotSchemaVersion, 1);
  assert.strictEqual(visit.designSnapshot.snapshotSchemaVersion, 1);
  assert.strictEqual(visit.analysisSnapshot.snapshotSchemaVersion, VisitSnapshot.SNAPSHOT_SCHEMA_VERSION);
  assert.strictEqual(visit.designSnapshot.snapshotSchemaVersion, VisitSnapshot.SNAPSHOT_SCHEMA_VERSION);
});

test('P2. snapshotSchemaVersion is independent of client-store.js\'s own CLIENT_SCHEMA_VERSION/VISIT_SCHEMA_VERSION -- proven by zero coupling in source', () => {
  const src = fs.readFileSync(path.join(root, 'visit-snapshot.js'), 'utf8');
  assert.ok(!src.includes('client-store'), 'visit-snapshot.js must not require/reference client-store.js at all');
  assert.ok(!src.includes('CLIENT_SCHEMA_VERSION') && !src.includes('VISIT_SCHEMA_VERSION'));
});

// ============================================================
// Module isolation (matches the established convention: every sibling
// module documents and proves its own dependency boundary).
// ============================================================
test('module isolation: visit-snapshot.js depends only on LashDesignDomain, never on consent-manager.js/client-data-consent.js/analytics.js/camera/scan code', () => {
  const src = fs.readFileSync(path.join(root, 'visit-snapshot.js'), 'utf8');
  for (const forbidden of ['ConsentManager', 'ClientDataConsent', 'Analytics', 'getUserMedia', 'face-api', 'faceapi']) {
    assert.ok(!src.includes(forbidden), `visit-snapshot.js must not reference "${forbidden}"`);
  }
});

test('dual-load pattern: the module exposes window.VisitSnapshot in a browser and module.exports in Node, matching every other sibling module', () => {
  const src = fs.readFileSync(path.join(root, 'visit-snapshot.js'), 'utf8');
  assert.ok(src.includes('root.VisitSnapshot = factory'));
  assert.ok(src.includes('module.exports = factory'));
});
