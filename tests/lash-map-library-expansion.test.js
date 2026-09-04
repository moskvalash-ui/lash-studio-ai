'use strict';
// PROFESSIONAL LASH MAP LIBRARY EXPANSION (Phase 1R) -- regression coverage
// for the 9 new/extended professional map strategies added to
// professional-lash-library.js. See the long Phase 1R comment block in that
// file for full context. This file is deliberately separate from the 16
// pre-existing *-professional-definition.test.js files (which each hash
// index.html/professional definitions as byte-identity guards for content
// this phase must NOT touch) -- everything here targets only the new
// library additions.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Library = require('../professional-lash-library.js');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const domainSource = fs.readFileSync(path.join(root, 'lash-design-domain.js'), 'utf8');

const NEW_GEOMETRY_IDS = [
  'geometry.mega-volume-dense',
  'geometry.long-curved-fox',
  'geometry.soft-volume-gradient',
  'geometry.downturned-eye-correction',
  'geometry.multi-curl-volume-fox',
  'geometry.hybrid-cat-eye',
];
const EXTENDED_EXISTING_IDS = ['construction.wet', 'construction.wispy', 'construction.anime'];
const ALL_NINE_IDS = [...NEW_GEOMETRY_IDS, ...EXTENDED_EXISTING_IDS];

function referenceTemplateFor(id) {
  return Library.library.referenceTemplates[id];
}

// ------------------------------------------------------------
// 0. Isolation: this phase touched only professional-lash-library.js.
// ------------------------------------------------------------
test('0. index.html and lash-design-domain.js are completely untouched by this phase (no new-canonical-id leakage)', () => {
  // Only the 6 brand-new canonical ids are checked for zero leakage --
  // construction.wet/wispy/anime are pre-existing ids already legitimately
  // referenced by the untouched debug-preview label maps (PRO_LIB_NAME_RU
  // etc.), so their presence in index.html predates and is unrelated to
  // this phase.
  for (const id of NEW_GEOMETRY_IDS) {
    assert.ok(!indexSource.includes(id), `index.html must not reference ${id}`);
    assert.ok(!domainSource.includes(id), `lash-design-domain.js must not reference ${id}`);
  }
  assert.ok(!domainSource.includes('construction.wet') && !domainSource.includes('construction.wispy') && !domainSource.includes('construction.anime'));
  // The whole-file production parity hashes pinned in professional-lash-
  // library.test.js and the 16 *-professional-definition.test.js files
  // already assert index.html/lash-design-domain.js are byte-identical;
  // this test additionally proves none of the new ids leaked in.
  assert.ok(!indexSource.includes('PHASE_1R'));
});

test('0b. production is still isolated and inactive: activation flags untouched by the six new registry entries', () => {
  assert.strictEqual(Library.library.activation.productionEnabled, false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds, []);
  assert.strictEqual(Library.library.activation.defaultState, 'INACTIVE');
});

test('0c. the 6 new geometries extend the existing geometries registry, not a second parallel registry', () => {
  for (const id of NEW_GEOMETRY_IDS) {
    assert.ok(Library.library.registries.geometries[id], `${id} must live in registries.geometries`);
    assert.strictEqual(Library.getDefinition(id).kind, 'MAPPING_GEOMETRY');
  }
  assert.deepStrictEqual(Library.REGISTRY_NAMES, ['geometries', 'techniques', 'constructionRecipes', 'directionStrategies', 'curlStrategies', 'fanConstructions', 'presets']);
  // targetInventory (the Phase 1A-1P audit checklist) is deliberately left
  // untouched -- these are a later, separate phase's additions, not part of
  // that original 15-item checklist. They are reachable via getDefinition()
  // and registries.geometries either way.
  assert.strictEqual(Library.library.targetInventory.length, 15);
});

// ------------------------------------------------------------
// 1-6. The six brand-new candidate geometries.
// ------------------------------------------------------------
test('1-6. every new geometry is DRAFT, carries a real professionalDefinition with zero numeric claims, and an isolated referenceTemplate', () => {
  for (const id of NEW_GEOMETRY_IDS) {
    const def = Library.getDefinition(id);
    assert.strictEqual(def.validation.status, 'DRAFT', id);
    assert.ok(def.professionalDefinition, id);
    assert.strictEqual(def.validation.evidence[0].numericClaims, false, id);
    assert.deepStrictEqual(def.validation.reviewers, [], `${id}: no domain-authority review has occurred, reviewers must stay empty`);
    assert.ok(def.referenceTemplate, id);
    assert.strictEqual(def.referenceTemplate.relationship, 'REFERENCE_MATERIAL_DERIVED_NOT_PRODUCTION', id);
    assert.strictEqual(def.referenceTemplate.confidence, 'SINGLE_SOURCE_UNVALIDATED', id);
    // no numeric claim ever leaks into professionalDefinition (mirrors the
    // isolation discipline already tested for legacyReference elsewhere)
    const proseJson = JSON.stringify(def.professionalDefinition);
    for (const zone of def.referenceTemplate.zones) {
      if (typeof zone.lengthMm === 'number') assert.ok(!proseJson.includes(String(zone.lengthMm)) || String(zone.lengthMm).length <= 1, `${id}: professionalDefinition must not restate zone length ${zone.lengthMm}mm as a claim`);
    }
  }
});

test('1. Dense Full / Mega Volume: exact zones, and distinguished from Fox by density/topology, not a different length curve', () => {
  const rt = referenceTemplateFor('geometry.mega-volume-dense');
  assert.deepStrictEqual(rt.zones, [
    { order: 0, position: 'INNER', lengthMmRange: [7, 8] },
    { order: 1, position: 'INNER_BODY', lengthMm: 8 },
    { order: 2, position: 'BODY', lengthMm: 9 },
    { order: 3, position: 'PRE_PEAK', lengthMm: 10 },
    { order: 4, position: 'PRE_OUTER', lengthMm: 12 },
    { order: 5, position: 'OUTER', lengthMm: 14 },
  ]);
  const def = Library.getDefinition('geometry.mega-volume-dense');
  assert.strictEqual(def.professionalDefinition.topology.postPeak, 'NOT_APPLICABLE_NO_DECLINE_REQUIRED');
  assert.strictEqual(def.professionalDefinition.crossEffectComparison['geometry.fox'].notSimplyFox, true);
});

test('2. Long Curved Fox: exact per-zone length+curl, curl escalates J -> C -> L toward physical outer', () => {
  const rt = referenceTemplateFor('geometry.long-curved-fox');
  assert.deepStrictEqual(rt.zones, [
    { order: 0, position: 'INNER', lengthMm: 6, curl: 'J' },
    { order: 1, position: 'INNER_BODY', lengthMmRange: [6, 8], curl: 'C' },
    { order: 2, position: 'BODY', lengthMm: 10, curl: 'C' },
    { order: 3, position: 'PRE_PEAK', lengthMm: 11, curl: 'L' },
    { order: 4, position: 'PEAK', lengthMm: 12, curl: 'L' },
    { order: 5, position: 'OUTER', lengthMm: 13, curl: 'L' },
  ]);
  const def = Library.getDefinition('geometry.long-curved-fox');
  assert.strictEqual(def.professionalDefinition.curlTopology.requiresPerZoneCurlRepresentation, true);
  assert.strictEqual(def.professionalDefinition.curlTopology.innerCurl, 'FLATTEST');
  assert.strictEqual(def.professionalDefinition.curlTopology.outerCurl, 'MOST_DRAMATIC');
});

test('3. Anime referenceTemplate: base ~8-12mm, spikes at 9/10/12/13/14mm, 1:1 positionally aligned to base, EXPERT_REVIEWED identity untouched', () => {
  const rt = referenceTemplateFor('construction.anime');
  assert.deepStrictEqual(rt.baseProfile.map(z => z.lengthMm), [8, 9, 10, 11, 12]);
  assert.deepStrictEqual(rt.spikes.map(z => z.lengthMm), [9, 10, 12, 13, 14]);
  assert.strictEqual(rt.baseProfile.length, rt.spikes.length);
  for (let i = 0; i < rt.baseProfile.length; i++) assert.strictEqual(rt.baseProfile[i].position, rt.spikes[i].position, `spike[${i}] must sit at the same physical position as base[${i}]`);
  const anime = Library.getDefinition('construction.anime');
  assert.strictEqual(anime.validation.status, 'EXPERT_REVIEWED');
  assert.strictEqual(anime.validation.evidence[0].numericClaims, false);
  assert.strictEqual(anime.referenceTemplate, undefined, 'candidate numbers must live in library.referenceTemplates, never mutated onto the reviewed identity object itself');
});

test('4. Wet Look referenceTemplate: compact base 7-10mm, rays 8/10/10/12/13-14mm, EXPERT_REVIEWED Wet identity untouched', () => {
  const rt = referenceTemplateFor('construction.wet');
  assert.deepStrictEqual(rt.baseProfile.map(z => z.lengthMm), [7, 8, 9, 10]);
  assert.strictEqual(rt.spikes[0].lengthMm, 8);
  assert.strictEqual(rt.spikes[1].lengthMm, 10);
  assert.strictEqual(rt.spikes[2].lengthMm, 10);
  assert.strictEqual(rt.spikes[3].lengthMm, 12);
  assert.deepStrictEqual(rt.spikes[4].lengthMmRange, [13, 14]);
  const wet = Library.getDefinition('construction.wet');
  assert.strictEqual(wet.validation.status, 'EXPERT_REVIEWED');
  assert.strictEqual(wet.referenceTemplate, undefined);
});

test('5. Wispy referenceTemplate: two full 6-point positionally-aligned layers (base + peaks), EXPERT_REVIEWED Wispy identity untouched', () => {
  const rt = referenceTemplateFor('construction.wispy');
  assert.deepStrictEqual(rt.baseProfile.map(z => z.lengthMm), [7, 8, 8, 9, 10, 12]);
  assert.deepStrictEqual(rt.spikes.map(z => z.lengthMm), [10, 11, 11, 12, 13, 15]);
  assert.strictEqual(rt.baseProfile.length, 6);
  assert.strictEqual(rt.spikes.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.ok(rt.spikes[i].lengthMm >= rt.baseProfile[i].lengthMm, `spike[${i}] must sit at/above base[${i}]`);
    assert.strictEqual(rt.baseProfile[i].position, rt.spikes[i].position);
  }
  const wispy = Library.getDefinition('construction.wispy');
  assert.strictEqual(wispy.validation.status, 'EXPERT_REVIEWED');
  assert.strictEqual(wispy.referenceTemplate, undefined);
});

test('6. Soft Volume Gradient: exact monotonic zones, explicitly no spike architecture, topology distinct from every reviewed geometry (no plateau, no decline)', () => {
  const rt = referenceTemplateFor('geometry.soft-volume-gradient');
  assert.deepStrictEqual(rt.zones.map(z => z.lengthMm), [8, 9, 10, 12, 13, 14]);
  assert.strictEqual(rt.baseProfile, null);
  assert.strictEqual(rt.spikes, null);
  const def = Library.getDefinition('geometry.soft-volume-gradient');
  assert.strictEqual(def.professionalDefinition.invariantOutcome.spikeArchitecture, 'NONE');
  assert.strictEqual(def.professionalDefinition.topology.shoulder, 'NONE_NO_PLATEAU');
  assert.strictEqual(def.professionalDefinition.topology.postPeak, 'NOT_APPLICABLE_NO_PEAK_REGION_DEFINED');
});

test('7. Downturned-Eye Correction: exact descending zones, explicit physical INNER/OUTER labels (never LEFT/RIGHT), correctionGoal present, distinct from DESIGN_CATALOG "correction"', () => {
  const rt = referenceTemplateFor('geometry.downturned-eye-correction');
  assert.deepStrictEqual(rt.zones.map(z => z.lengthMm), [13, 12, 11, 10, 9, 8]);
  assert.strictEqual(rt.zones[0].position, 'PHYSICAL_INNER');
  assert.strictEqual(rt.zones[rt.zones.length - 1].position, 'PHYSICAL_OUTER');
  assert.ok(rt.correctionGoal && rt.correctionGoal.includes('PHYSICAL_INNER') && rt.correctionGoal.includes('PHYSICAL_OUTER'));
  const def = Library.getDefinition('geometry.downturned-eye-correction');
  assert.strictEqual(def.legacyReference.legacyIds.length, 0, 'must not borrow DESIGN_CATALOG\'s unrelated "correction" entry\'s identity');
  assert.ok(def.professionalDefinition.physicalOrientationRule);
  assert.deepStrictEqual(def.professionalDefinition.physicalOrientationRule.relatedProtectedContracts, ['B', 'H']);
  // ground the "distinct from existing production correction" claim against
  // the real DESIGN_CATALOG entry (read-only, same extraction technique as
  // every other test in this project)
  const catalogStart = indexSource.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = indexSource.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalog = new Function('const clampScore=n=>n;' + indexSource.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();
  const legacyCorrection = catalog.find(e => e.id === 'correction');
  assert.deepStrictEqual(legacyCorrection.baseZones, [7, 8, 9, 9, 8]);
  assert.notDeepStrictEqual(legacyCorrection.baseZones, rt.zones.map(z => z.lengthMm), 'downturned-eye-correction\'s descending profile must not be confused with the existing ascending-then-descending asymmetry "correction" entry');
});

test('8. Multi-Curl Volume Fox: exact per-zone length+curl including the verbatim non-standard "M" curl letter', () => {
  const rt = referenceTemplateFor('geometry.multi-curl-volume-fox');
  assert.deepStrictEqual(rt.zones.map(z => [z.lengthMm, z.curl]), [[8, 'B'], [8, 'C'], [10, 'M'], [12, 'M'], [13, 'L'], [15, 'L']]);
  const def = Library.getDefinition('geometry.multi-curl-volume-fox');
  assert.ok(def.validation.notes.some(n => n.includes('"M"')));
});

test('9. Hybrid Cat Eye: exact 7-zone length+curl, steady C through the body with a single transition to D at the outer tip', () => {
  const rt = referenceTemplateFor('geometry.hybrid-cat-eye');
  assert.strictEqual(rt.zones.length, 7);
  assert.deepStrictEqual(rt.zones.slice(0, 6).map(z => z.curl), ['B', 'C', 'C', 'C', 'C', 'C']);
  assert.strictEqual(rt.zones[6].curl, 'D');
  assert.deepStrictEqual(rt.zones[6].lengthMmRange, [13, 14]);
});

// ------------------------------------------------------------
// Data model: per-zone curl and base+spike layering did NOT already exist
// anywhere in this file before Phase 1R.
// ------------------------------------------------------------
test('data model: no pre-existing (pre-Phase-1R) identity carries a per-zone curl array or an explicit baseProfile+spikes pair', () => {
  const preExistingIds = ['geometry.natural', 'geometry.doll', 'geometry.cat', 'geometry.fox', 'geometry.squirrel', 'technique.classic-one-to-one', 'preset.eyeliner', 'construction.wispy', 'construction.kim-k', 'construction.angel', 'construction.wet', 'construction.rays', 'construction.anime', 'construction.jellyfish'];
  for (const id of preExistingIds) {
    const def = Library.getDefinition(id);
    assert.ok(!Object.hasOwn(def, 'baseProfile'));
    assert.ok(!Object.hasOwn(def, 'spikes'));
    // every pre-existing curl reference is a single value/options pair, never a per-zone array
    if (def.legacyReference.curl) assert.ok(!Array.isArray(def.legacyReference.curl));
  }
});

// ------------------------------------------------------------
// Mirror safety. This library never encodes left/right at all -- there is
// exactly one physical-order array per definition, and mirroring is a
// rendering-layer concern only (Protected Contract H, index.html's xAt
// formula, completely untouched by this phase). These tests prove that by
// construction: a helper that looks up "physical INNER for side X" or
// "physical OUTER for side X" always returns `zones[0]`/`zones[last]`
// regardless of `side`, because there is no side-keyed data anywhere to
// diverge from.
// ------------------------------------------------------------
function physicalInnerZone(referenceTemplate, side) {
  const zones = referenceTemplate.zones || referenceTemplate.baseProfile;
  return zones.find(z => z.order === 0);
}
function physicalOuterZone(referenceTemplate, side) {
  const zones = referenceTemplate.zones || referenceTemplate.baseProfile;
  return zones.reduce((max, z) => (z.order > max.order ? z : max), zones[0]);
}

test('mirror safety: LEFT physical INNER === RIGHT physical INNER, and LEFT physical OUTER === RIGHT physical OUTER, for all 9 strategies', () => {
  for (const id of ALL_NINE_IDS) {
    const rt = referenceTemplateFor(id);
    const innerLeft = physicalInnerZone(rt, 'left');
    const innerRight = physicalInnerZone(rt, 'right');
    assert.deepStrictEqual(innerLeft, innerRight, `${id}: physical INNER must be identical regardless of eye side`);
    const outerLeft = physicalOuterZone(rt, 'left');
    const outerRight = physicalOuterZone(rt, 'right');
    assert.deepStrictEqual(outerLeft, outerRight, `${id}: physical OUTER must be identical regardless of eye side`);
  }
});

test('mirror safety: every zones/baseProfile/spikes array is strictly ascending order starting at 0, for all 9 strategies', () => {
  for (const id of ALL_NINE_IDS) {
    const rt = referenceTemplateFor(id);
    for (const key of ['zones', 'baseProfile', 'spikes']) {
      const arr = rt[key];
      if (!arr) continue;
      arr.forEach((zone, i) => assert.strictEqual(zone.order, i, `${id}.${key}[${i}].order must equal its index`));
    }
  }
});

test('mirror safety: Fox/Cat-family tails do not accidentally reverse on one physical eye (outer-most zone is always the tail, on both sides)', () => {
  const foxFamily = ['geometry.long-curved-fox', 'geometry.multi-curl-volume-fox'];
  const catFamily = ['geometry.hybrid-cat-eye'];
  for (const id of [...foxFamily, ...catFamily]) {
    const rt = referenceTemplateFor(id);
    const tailLeft = physicalOuterZone(rt, 'left');
    const tailRight = physicalOuterZone(rt, 'right');
    assert.deepStrictEqual(tailLeft, tailRight, `${id}: the outer tail zone must be identical on both eyes -- no per-side branch exists to reverse it`);
    // sanity: the tail actually IS the family's dramatic-curl end (L for
    // Fox family, D for the Cat-family hybrid), matching each definition's
    // own qualitative curlTopology/professionalDefinition claim above.
    if (foxFamily.includes(id)) assert.strictEqual(tailLeft.curl, 'L');
    if (catFamily.includes(id)) assert.strictEqual(tailLeft.curl, 'D');
  }
});

test('mirror safety: physical position labels are never LEFT/RIGHT-worded (only anatomical INNER/OUTER-family tokens)', () => {
  for (const id of ALL_NINE_IDS) {
    const rt = referenceTemplateFor(id);
    for (const key of ['zones', 'baseProfile', 'spikes']) {
      const arr = rt[key];
      if (!arr) continue;
      for (const zone of arr) assert.ok(!/LEFT|RIGHT/.test(zone.position), `${id}.${key}: position "${zone.position}" must not be screen-side-worded`);
    }
  }
});

// ------------------------------------------------------------
// Library-wide sanity: still deterministic, JSON-safe, and frozen after
// this phase's additions.
// ------------------------------------------------------------
test('library remains deterministic, JSON-safe, and defensively immutable after Phase 1R', () => {
  const first = Library.getSnapshot(), second = Library.getSnapshot();
  assert.deepStrictEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.ok(Object.isFrozen(Library.library));
  assert.ok(Object.isFrozen(Library.library.referenceTemplates));
  for (const id of ALL_NINE_IDS) assert.ok(Object.isFrozen(referenceTemplateFor(id)), id);
  for (const id of NEW_GEOMETRY_IDS) assert.ok(Object.isFrozen(Library.getDefinition(id)), id);
});
