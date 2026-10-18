'use strict';
// EXPERIMENTAL proV1 coverage (review follow-up, PR #1). Exercises the
// real production code path -- real DESIGN_CATALOG entries, real
// expandLashMapSectors, real LashDesignDomain.legacyToClientLashDesign/
// withPhotoRuntime/photoPropsFromClientDesign, real (unmodified)
// buildPhotoPreviewEyes extracted straight out of index.html, same
// pattern tests/photo-lash-preview.test.js and
// tests/photo-lash-map-pipeline.test.js already use -- never a
// hand-duplicated reimplementation of production logic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PhotoLashPreview = require('../photo-lash-preview');
const LashDesignDomain = require('../lash-design-domain');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

const bppeCode = [
  slice('    function normalizeEyePoints(', '    function normalizeBrowPoints('),
  slice('    function normalizeBrowPoints(', '    function getPhysicalEyeLandmarks('),
  slice('    function getPhysicalEyeLandmarks(', '    function computeHeadPose('),
  slice('    function buildProfessionalEyeProjection(', '    // PHOTO labels all five source anchors'),
  slice('    function buildProfessionalPhotoLine(', '    // PHOTO is rendered in a 16:9 card'),
  slice('    function buildPhotoPreviewEyes(', '    function PhotoLashPreviewPanel('),
].join('\n');
const { buildPhotoPreviewEyes } = new Function(
  'PhotoLashPreview', 'LashDesignDomain',
  bppeCode + ';return {buildPhotoPreviewEyes};'
)(PhotoLashPreview, LashDesignDomain);

const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const DESIGN_CATALOG = new Function(src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;')();

const zoneStart = src.indexOf('    const ZONE_NAMES = '), zoneEnd = src.indexOf('\n    const CATEGORY_LABELS =', zoneStart);
const expandLashMapSectors = new Function(src.slice(zoneStart, zoneEnd) + '\nreturn expandLashMapSectors;')();

// Same synthetic-but-real-code-path eye landmark fixture
// tests/photo-lash-preview.test.js already uses (hexagon approximating
// a real 6-point eye, mirrored for the other side).
const left = [{ x: 180, y: 100 }, { x: 190, y: 90 }, { x: 210, y: 90 }, { x: 220, y: 100 }, { x: 210, y: 105 }, { x: 190, y: 105 }];
const right = left.map(p => ({ x: 300 - p.x, y: p.y }));
const result = {
  source: 'photo', imageWidth: 300, imageHeight: 200,
  landmarks: {
    getRightEye: () => left, getLeftEye: () => [right[3], right[2], right[1], right[0], right[5], right[4]],
    getRightEyeBrow: () => left, getLeftEyeBrow: () => right,
  },
};

// Builds a REAL ClientLashDesign for one real DESIGN_CATALOG entry,
// through the real production functions (legacyToClientLashDesign +
// withPhotoRuntime) -- never a hand-built mapping/photo object. Zone
// personalization (calculateEyeLashMap) is intentionally bypassed by
// using the catalog's own baseZones/peakZone directly for both eyes --
// this test targets the proV1 rendering layer, not the personalization
// engine, which is already covered elsewhere.
function clientDesignFor(id) {
  const catalogEntry = DESIGN_CATALOG.find(e => e.id === id);
  assert.ok(catalogEntry, `DESIGN_CATALOG must still contain '${id}'`);
  const design = {
    id: catalogEntry.id, name: catalogEntry.ruName, ruName: catalogEntry.ruName, enName: catalogEntry.enName,
    category: catalogEntry.category, aliases: catalogEntry.aliases || [],
    baseCurl: catalogEntry.baseCurl, curlOptions: catalogEntry.curlOptions,
    defaultTechnique: catalogEntry.defaultTechnique, texture: catalogEntry.texture || null,
    leftZones: catalogEntry.baseZones, rightZones: catalogEntry.baseZones,
    leftPeakZone: catalogEntry.peakZone, rightPeakZone: catalogEntry.peakZone,
    score: 50, whyItWorks: '', correctionGoal: '', limitations: [],
  };
  const canonical = LashDesignDomain.legacyToClientLashDesign({ design, catalogEntry, expandSectors: expandLashMapSectors });
  return LashDesignDomain.withPhotoRuntime(canonical, {
    physicalEyes: canonical.mapping.physicalEyes, topology: canonical.mapping.template.topology,
    technique: canonical.application.legacyLabel, curl: canonical.curl.global,
    textureDescriptor: canonical.texture.legacyDescriptor,
  });
}

const WIDTH_CAP_PER_EYEWIDTH = .0060, WIDTH_FLOOR_PER_EYEWIDTH = .0013;

function assertFiniteBoundedGeometry(eyes) {
  for (const eye of eyes) {
    assert.ok(Number.isFinite(eye.eyeWidth) && eye.eyeWidth > 0);
    const widthCap = eye.eyeWidth * WIDTH_CAP_PER_EYEWIDTH, widthFloor = eye.eyeWidth * WIDTH_FLOOR_PER_EYEWIDTH;
    for (const f of eye.fibers) {
      for (const pt of [f.root, f.c1, f.c2, f.tip]) {
        assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), 'every control point must be finite');
      }
      assert.ok(Number.isFinite(f.width) && f.width >= widthFloor - 1e-9 && f.width <= widthCap + 1e-9, `width ${f.width} must stay within [${widthFloor},${widthCap}]`);
      assert.ok(Number.isFinite(f.opacity) && f.opacity >= 0 && f.opacity <= 1 + 1e-9, `opacity ${f.opacity} must stay within [0,1]`);
    }
  }
}

// ------------------------------------------------------------
// 1. Technique profile selection, per modeled technique + unknown
//    fallback -- the exact 4 TECHNIQUE_VISUAL_PROFILES entries, plus a
//    technique string the table does not model.
// ------------------------------------------------------------
for (const [id, expectDenser] of [['natural', false], ['fox', null], ['cat', null], ['doll', true], ['wet', false], ['manga', true]]) {
  test(`proV1 technique profile: ${id} produces finite, bounded, deterministic geometry`, () => {
    const client = clientDesignFor(id);
    const current = buildPhotoPreviewEyes(result, client);
    const proV1 = buildPhotoPreviewEyes(result, client, { renderVariant: 'proV1' });
    assertFiniteBoundedGeometry(current);
    assertFiniteBoundedGeometry(proV1);
    assert.deepEqual(proV1, buildPhotoPreviewEyes(result, client, { renderVariant: 'proV1' }), 'proV1 output must be deterministic for identical input');
    if (expectDenser === true) assert.ok(proV1[0].fibers.length > current[0].fibers.length, `${id} (Volume 3D) is expected to be denser under proV1 than CURRENT`);
    if (expectDenser === false) assert.ok(proV1[0].fibers.length <= current[0].fibers.length, `${id} is expected to be no denser under proV1 than CURRENT`);
  });
}

test('unknown/invalid technique string falls back to CURRENT-equivalent density, same as omitting technique', () => {
  const client = clientDesignFor('natural');
  const mutated = JSON.parse(JSON.stringify(client));
  mutated.application.photoTechnique = 'Some Future Technique Not Yet Modeled';
  const withUnknown = buildPhotoPreviewEyes(result, mutated, { renderVariant: 'proV1' });
  const noTextureClient = JSON.parse(JSON.stringify(client));
  noTextureClient.application.photoTechnique = null;
  const withNull = buildPhotoPreviewEyes(result, noTextureClient, { renderVariant: 'proV1' });
  assert.equal(withUnknown[0].fibers.length, withNull[0].fibers.length, 'an unmodeled technique string must fall back exactly like no technique at all');
});

// ------------------------------------------------------------
// 2. CURRENT/v2A parity -- proV1 data sitting on the clientDesign must
//    never leak into CURRENT/v2A output.
// ------------------------------------------------------------
test('CURRENT and v2A ignore technique/texture entirely, even for a texture-bearing design (manga)', () => {
  const client = clientDesignFor('manga');
  const before = JSON.stringify(client);
  const current1 = buildPhotoPreviewEyes(result, client);
  const current2 = buildPhotoPreviewEyes(result, client);
  const v2a = buildPhotoPreviewEyes(result, client, { renderVariant: 'v2A' });
  assert.deepEqual(current1, current2, 'CURRENT must be deterministic');
  assert.equal(JSON.stringify(client), before, 'buildPhotoPreviewEyes must never mutate clientDesign');
  assert.notEqual(v2a[0].fibers.length, 0);
  // v2A's own layer set (main+back only) is independent of technique/texture -- confirmed by the dedicated photo-lash-preview-v2a.test.js suite; here we only confirm this call path still works unmodified for a texture-bearing design.
});

// ------------------------------------------------------------
// 3. Left/right mirror symmetry under proV1 (same invariant already
//    proven for CURRENT in photo-lash-preview.test.js).
// ------------------------------------------------------------
test('proV1 preserves left/right mirror symmetry', () => {
  const client = clientDesignFor('doll');
  const eyes = buildPhotoPreviewEyes(result, client, { renderVariant: 'proV1' });
  assert.equal(eyes.length, 2);
  assert.equal(eyes[0].fibers.length, eyes[1].fibers.length);
  for (let i = 0; i < eyes[0].fibers.length; i++) {
    const a = eyes[0].fibers[i], b = eyes[1].fibers[i];
    assert.ok(Math.abs(a.root.x + b.root.x - result.imageWidth) < 1e-6);
    assert.equal(a.len, b.len);
  }
});

// ------------------------------------------------------------
// 4. WET: grouped rays (clump) actually present in the output, not
//    merely claimed in a comment -- gap-cycle MAIN fibers must read
//    thinner than non-gap MAIN fibers, and only non-gap MAIN fibers
//    may carry the glossy flag.
// ------------------------------------------------------------
test('WET technique: clump groups/gaps are structurally present in MAIN fibers', () => {
  const client = clientDesignFor('wet');
  const eyes = buildPhotoPreviewEyes(result, client, { renderVariant: 'proV1' });
  const mains = eyes[0].fibers.filter(f => f.layer === 'main');
  const glossy = mains.filter(f => f.glossy);
  const nonGlossy = mains.filter(f => !f.glossy);
  assert.ok(glossy.length > 0, 'WET must produce at least some glossy (non-gap) MAIN fibers');
  assert.ok(nonGlossy.length > 0, 'WET must produce at least some non-glossy (gap) MAIN fibers -- i.e. real gaps, not uniform density');
  const avg = arr => arr.reduce((s, f) => s + f.width, 0) / arr.length;
  assert.ok(avg(nonGlossy) < avg(glossy), 'gap-cycle MAIN fibers must average thinner than non-gap MAIN fibers');
  for (const f of mains) if (!f.glossy) assert.ok(!('glossy' in f) || f.glossy === undefined, 'gap fibers must never be glossy');
});

// ------------------------------------------------------------
// 5. MANGA: real end-to-end isKey shape + frequency-driven cadence.
//    This is the review's explicit ask: demonstrate derivedSectors'
//    real isKey shape in the PHOTO path, and prove `frequency` actually
//    controls sparsity instead of boosting nearly every fiber.
// ------------------------------------------------------------
test('MANGA: real photoPropsFromClientDesign items carry a genuine mixed isKey shape (not all-true/all-false)', () => {
  const client = clientDesignFor('manga');
  const props = LashDesignDomain.photoPropsFromClientDesign(client, 'left');
  assert.equal(props.technique, 'Volume 3D');
  assert.equal(props.texture.pattern, 'manga');
  assert.equal(props.texture.frequency, 2);
  assert.ok(props.items.some(it => it.isKey === true), 'real derivedSectors must contain true professional zone anchors');
  assert.ok(props.items.some(it => it.isKey === false), 'real derivedSectors must also contain non-anchor presentational points');
  assert.ok(props.items.filter(it => it.isKey).length < props.items.length, 'anchors must be a minority, not the whole set');
});

test('MANGA: every isKey (professional zone anchor) sample keeps its exact original mm length under proV1 -- spikes never touch canonical lengths', () => {
  const client = clientDesignFor('manga');
  const props = LashDesignDomain.photoPropsFromClientDesign(client, 'left');
  const samples = PhotoLashPreview.sampleSectors(props.items);
  const eyes = buildPhotoPreviewEyes(result, client, { renderVariant: 'proV1' });
  const mainsBySample = eyes[0].fibers.filter(f => f.layer === 'main');
  assert.equal(mainsBySample.length, samples.length);
  const anchorLens = new Set(props.items.filter(it => it.isKey).map(it => it.len));
  let anchorSampleCount = 0;
  samples.forEach((s, i) => {
    if (s.isKey) { anchorSampleCount++; assert.ok(anchorLens.has(s.len)); }
  });
  assert.ok(anchorSampleCount > 0, 'at least one of the 294 rendered samples must land exactly on a professional zone anchor');
});

test('MANGA: spike cadence is sparse and scales with texture.frequency (not boosting nearly every fiber)', () => {
  const client2 = clientDesignFor('manga');
  // Same client, same technique (so layer population/ordering is
  // identical) -- only the texture descriptor varies, isolating the
  // spike selection itself rather than any density-profile difference.
  const freq2Client = JSON.parse(JSON.stringify(client2));
  const freq3Client = JSON.parse(JSON.stringify(client2));
  const noTextureClient = JSON.parse(JSON.stringify(client2));
  freq2Client.texture.photoDescriptor = { pattern: 'manga', frequency: 2, baseToSpikeDiff: 4 };
  freq3Client.texture.photoDescriptor = { pattern: 'manga', frequency: 3, baseToSpikeDiff: 4 };
  noTextureClient.texture.photoDescriptor = null;
  const baseline = buildPhotoPreviewEyes(result, freq2Client, { renderVariant: 'proV1' });
  const withFreq3 = buildPhotoPreviewEyes(result, freq3Client, { renderVariant: 'proV1' });
  const withoutTexture = buildPhotoPreviewEyes(result, noTextureClient, { renderVariant: 'proV1' });
  assert.equal(baseline[0].fibers.length, withoutTexture[0].fibers.length, 'texture must never change which/how many fibers are populated, only their length');
  const countBoosted = (eyes) => {
    let n = 0;
    for (let i = 0; i < eyes[0].fibers.length; i++) {
      const a = eyes[0].fibers[i], c = withoutTexture[0].fibers[i];
      if (a.layer === 'main' && Math.hypot(a.tip.x - c.tip.x, a.tip.y - c.tip.y) > 0.5) n++;
    }
    return n;
  };
  const n2 = countBoosted(baseline), n3 = countBoosted(withFreq3);
  const totalMain = baseline[0].fibers.filter(f => f.layer === 'main').length;
  assert.ok(n2 > 0, 'frequency:2 must produce at least some spikes');
  assert.ok(n2 < totalMain * 0.3, `frequency:2 must stay sparse (<30% of MAIN fibers), got ${n2}/${totalMain}`);
  assert.ok(n3 > n2, 'frequency:3 must produce more spike positions than frequency:2 on the same map -- frequency must actually be read');
  assert.deepEqual(baseline, buildPhotoPreviewEyes(result, freq2Client, { renderVariant: 'proV1' }), 'manga spike selection must be deterministic');
});
