'use strict';
// PHASE — RENDER PROFESSIONAL REFERENCE TEMPLATES IN PHOTO LASH MAP.
// Regression coverage for the renderer-integration adapter added to
// index.html (professionalReferenceTemplateToDiagramProps,
// spikeGeomFromReferenceLayers, plResolveMm, plInterpolateAt) plus the
// variable-zone-count/per-zone-curl extensions to the pre-existing,
// production `expandLashMapSectors`/`LegacyLashMapDiagram`. All extracted
// functions are the REAL, unmodified production source (same string-slice
// + new Function() technique used throughout this project), never
// hand-duplicated logic.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Library = require('../professional-lash-library.js');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const domainSource = fs.readFileSync(path.join(root, 'lash-design-domain.js'), 'utf8');

// ------------------------------------------------------------
// Extraction: expandLashMapSectors + ZONE_NAMES (production sector engine).
// ------------------------------------------------------------
const zoneNamesStart = src.indexOf('    const ZONE_NAMES = ');
const zoneNamesLine = src.slice(zoneNamesStart, src.indexOf('\n', zoneNamesStart));
const expandStart = src.indexOf('    function expandLashMapSectors(');
const expandEnd = src.indexOf('\n\n    // Professional Lash Map projection.', expandStart);
assert.ok(expandStart > 0 && expandEnd > expandStart, 'expandLashMapSectors must be structurally extractable');
const expandSectorsApi = new Function(
  zoneNamesLine + '\n' + src.slice(expandStart, expandEnd) + '\nreturn { expandLashMapSectors, ZONE_NAMES };'
)();
const { expandLashMapSectors, ZONE_NAMES } = expandSectorsApi;

// ------------------------------------------------------------
// Extraction: the Phase 1S adapter chain (plain JS, no JSX -- directly
// executable, unlike the JSX renderer components).
// ------------------------------------------------------------
const adapterStart = src.indexOf('    function plResolveMm(');
const adapterEnd = src.indexOf('\n\n\n    function ProLibraryPreviewScreen(', adapterStart);
assert.ok(adapterStart > 0 && adapterEnd > adapterStart, 'the Phase 1S adapter chain must be structurally extractable');
const adapterSource = src.slice(adapterStart, adapterEnd);
const adapterApi = new Function(
  'ProfessionalLashLibrary',
  adapterSource + '\nreturn { plResolveMm, plInterpolateAt, spikeGeomFromReferenceLayers, professionalReferenceTemplateToDiagramProps };'
)(Library);
const { professionalReferenceTemplateToDiagramProps, spikeGeomFromReferenceLayers, plResolveMm } = adapterApi;

// ------------------------------------------------------------
// Extraction: LegacyLashMapDiagram source (JSX -- inspected structurally,
// not executed, same technique as lash-map-diagram-mirror.test.js /
// diagram-canonical.test.js).
// ------------------------------------------------------------
const rendererStart = src.indexOf('    function LegacyLashMapDiagram(');
const rendererEnd = src.indexOf('\n    // Phase 2B consumer boundary', rendererStart);
assert.ok(rendererStart > 0 && rendererEnd > rendererStart);
const rendererSource = src.slice(rendererStart, rendererEnd);

// ============================================================
// A. existing legacy 5-zone maps render unchanged
// ============================================================
test('A. expandLashMapSectors is byte-for-byte unchanged for every real 5-zone catalog design (zoneNames omitted -> defaults to ZONE_NAMES)', () => {
  assert.deepStrictEqual(ZONE_NAMES, ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalog = new Function('const clampScore=n=>n;' + src.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();
  for (const entry of catalog) {
    const zones = entry.baseZones;
    const curve = { zonePositions: entry.zonePositions, postPeakShape: entry.postPeakShape, plateauShape: entry.plateauShape };
    const withDefault = expandLashMapSectors(zones, entry.peakZone, curve);
    const withExplicitZoneNames = expandLashMapSectors(zones, entry.peakZone, curve, ZONE_NAMES);
    assert.deepStrictEqual(withDefault, withExplicitZoneNames, `${entry.id}: omitting zoneNames must equal passing ZONE_NAMES explicitly`);
    // every key zone still gets one of the five original canonical labels
    for (const sector of withDefault) if (sector.isKey) assert.ok(ZONE_NAMES.includes(sector.label), `${entry.id}: key zone label must stay one of the original five`);
  }
});

test('A2. LegacyLashMapDiagram source: the new zoneCurl/zoneDisplayLen helpers are no-ops when curlByZone/lengthRangeByZone are absent (existing 21 designs never pass them)', () => {
  assert.ok(rendererSource.includes('const zoneDisplayLen=z=>{'));
  assert.ok(rendererSource.includes('const zoneCurl=z=>curlByZone&&z.keyZoneIndex!=null?curlByZone[z.keyZoneIndex]:null;'));
  assert.ok(rendererSource.includes('const range=lengthRangeByZone&&z.keyZoneIndex!=null?lengthRangeByZone[z.keyZoneIndex]:null;'));
  assert.ok(rendererSource.includes('return range?`${range[0]}–${range[1]}`:z.len;'));
});

// ============================================================
// B. 6+ zone referenceTemplate renders every zone
// ============================================================
test('B. 6-zone and 7-zone referenceTemplates expand every defined zone with zero interpolation-away of key points', () => {
  const sixZone = professionalReferenceTemplateToDiagramProps('geometry.long-curved-fox', 'left');
  assert.strictEqual(sixZone.zones.length, 6);
  const sevenZone = professionalReferenceTemplateToDiagramProps('geometry.hybrid-cat-eye', 'left');
  assert.strictEqual(sevenZone.zones.length, 7);
  for (const props of [sixZone, sevenZone]) {
    const items = expandLashMapSectors(props.zones, props.peakIdx, props.curve, props.zoneNames);
    const keyItems = items.filter(z => z.isKey);
    assert.strictEqual(keyItems.length, props.zones.length, 'every physical zone must survive as its own key point, none interpolated away');
    assert.deepStrictEqual(keyItems.map(z => z.len), props.zones);
    assert.deepStrictEqual(keyItems.map(z => z.label), props.zoneNames);
  }
});

test('B2. a 4-zone referenceTemplate (Wet Look base layer) also renders correctly -- variable count both above and below 5', () => {
  const props = professionalReferenceTemplateToDiagramProps('construction.wet', 'left');
  assert.strictEqual(props.zones.length, 4);
  const items = expandLashMapSectors(props.zones, props.peakIdx, props.curve, props.zoneNames);
  assert.strictEqual(items.filter(z => z.isKey).length, 4);
});

// ============================================================
// C. per-zone curl survives adapter and reaches renderer
// ============================================================
test('C. per-zone curl survives the adapter intact, in physical INNER->OUTER order', () => {
  const props = professionalReferenceTemplateToDiagramProps('geometry.multi-curl-volume-fox', 'left');
  assert.deepStrictEqual(props.curlByZone, ['B', 'C', 'M', 'M', 'L', 'L']);
  const propsRight = professionalReferenceTemplateToDiagramProps('geometry.multi-curl-volume-fox', 'right');
  assert.deepStrictEqual(propsRight.curlByZone, props.curlByZone, 'curl-by-zone must be identical regardless of side');
});

test('C2. curlByZone is null (not an array of nulls) for referenceTemplates with no curl data, preserving the exact no-op path in the renderer', () => {
  const props = professionalReferenceTemplateToDiagramProps('geometry.soft-volume-gradient', 'left');
  assert.strictEqual(props.curlByZone, null);
});

test('C3. renderer source: the per-zone curl compact notation is rendered as "{length} {curl}" on the same text node, and the tooltip appends curl only when present', () => {
  assert.ok(rendererSource.includes('{zoneCurl(z)?`${zoneDisplayLen(z)} ${zoneCurl(z)}`:zoneDisplayLen(z)}'));
  assert.ok(rendererSource.includes('{zoneDisplayLen(z)} mm{zoneCurl(z)||curl?` · ${zoneCurl(z)||curl}`:\'\'}'));
});

// ============================================================
// D. lengthMmRange is represented correctly
// ============================================================
test('D. lengthMmRange resolves to its midpoint for curve interpolation, but survives verbatim as [min,max] in lengthRangeByZone for display', () => {
  const props = professionalReferenceTemplateToDiagramProps('geometry.mega-volume-dense', 'left');
  assert.strictEqual(props.zones[0], 7.5, 'INNER zone (range [7,8]) must resolve to its midpoint 7.5 for the numeric curve');
  assert.deepStrictEqual(props.lengthRangeByZone[0], [7, 8]);
  assert.strictEqual(props.lengthRangeByZone[1], null, 'a zone without a range must be null, not [len,len]');
  assert.strictEqual(plResolveMm({ lengthMm: 9 }), 9);
  assert.strictEqual(plResolveMm({ lengthMmRange: [13, 14] }), 13.5);
});

test('D2. renderer source: a ranged key zone displays "{min}–{max}" instead of the resolved midpoint', () => {
  assert.ok(rendererSource.includes('return range?`${range[0]}–${range[1]}`:z.len;'));
});

// ============================================================
// E / F / G. base + spike/ray layers remain separate (Anime / Wet / Wispy)
// ============================================================
function checkLayeredTemplate(name, canonicalId, expectedBase, expectedSpikes) {
  test(`${name}: base and spikes/rays remain two separate arrays, never flattened into one`, () => {
    const props = professionalReferenceTemplateToDiagramProps(canonicalId, 'left');
    assert.deepStrictEqual(props.zones, expectedBase, `${name}: DIAGRAM's main profile (zones) must be the BASE layer, not a blend with spikes`);
    assert.ok(props.spikeGeom, `${name}: spikeGeom must be present`);
    assert.deepStrictEqual(props.spikeGeom.spikes.map(s => s.spikeLen), expectedSpikes, `${name}: spike lengths must be the explicit spike/ray layer, unflattened`);
    assert.ok(props.spikeGeom.spikes.every(s => s.tall === true), `${name}: every explicit reference-template spike is a real accent (tall=true), visually distinct from ordinary zone markers`);
    // base and spike are genuinely different arrays/values (not the same data duplicated)
    assert.notDeepStrictEqual(props.zones, props.spikeGeom.spikes.map(s => s.spikeLen));
  });
}
checkLayeredTemplate('E. Anime', 'construction.anime', [8, 9, 10, 11, 12], [9, 10, 12, 13, 14]);
checkLayeredTemplate('F. Wet Look', 'construction.wet', [7, 8, 9, 10], [8, 10, 10, 12, 13.5]);
checkLayeredTemplate('G. Wispy', 'construction.wispy', [7, 8, 8, 9, 10, 12], [10, 11, 11, 12, 13, 15]);

test('E2/F2/G2. spikeGeomFromReferenceLayers positions each spike along its OWN order/(length-1) span, not forced 1:1 to a mismatched base length (Wet: 4 base vs 5 rays)', () => {
  const wet = Library.library.referenceTemplates['construction.wet'];
  const geom = spikeGeomFromReferenceLayers(wet.baseProfile, wet.spikes);
  assert.strictEqual(geom.spikes.length, 5);
  assert.deepStrictEqual(geom.spikes.map(s => s.t), [0, 0.25, 0.5, 0.75, 1]);
  // baseLen at each spike's t is linearly interpolated from the 4-point base
  assert.strictEqual(geom.spikes[0].baseLen, 7);
  assert.strictEqual(geom.spikes[4].baseLen, 10);
});

// ============================================================
// H / I / J. LEFT/RIGHT physical mirror correctness
// ============================================================
test('H. adapter output (zones/zoneNames/curlByZone/lengthRangeByZone/spikeGeom) is identical for side="left" vs side="right" -- only `side` itself differs', () => {
  const ids = [
    'geometry.mega-volume-dense', 'geometry.long-curved-fox', 'geometry.soft-volume-gradient',
    'geometry.downturned-eye-correction', 'geometry.multi-curl-volume-fox', 'geometry.hybrid-cat-eye',
    'construction.anime', 'construction.wet', 'construction.wispy',
  ];
  for (const id of ids) {
    const left = professionalReferenceTemplateToDiagramProps(id, 'left');
    const right = professionalReferenceTemplateToDiagramProps(id, 'right');
    for (const key of ['zones', 'zoneNames', 'peakIdx', 'curve', 'curlByZone', 'lengthRangeByZone', 'spikeGeom', 'curl', 'technique']) {
      assert.deepStrictEqual(left[key], right[key], `${id}.${key} must be identical regardless of side -- only screen coordinates (xAt) may mirror, never the underlying data`);
    }
    assert.strictEqual(left.side, 'left');
    assert.strictEqual(right.side, 'right');
  }
});

test('H2. renderer source: `side` is consumed ONLY by the xAt mirroring formula, never by expandLashMapSectors or any zone/curl/spike data path', () => {
  assert.ok(rendererSource.includes("xAt=t=>55+(side==='right'?1-t:t)*290"));
  const afterXAt = rendererSource.slice(rendererSource.indexOf('xAt=t=>'));
  // `side` must not reappear as a conditional anywhere else in the renderer body
  const sideConditionals = (afterXAt.match(/side\s*===/g) || []).length;
  assert.strictEqual(sideConditionals, 1, 'side must be branched on exactly once (inside xAt) -- any second occurrence would risk a second, possibly inconsistent, mirror rule');
});

test('I. Fox-family outer tail (physical OUTER, most dramatic curl) stays the last zone/highest length on BOTH eyes', () => {
  for (const id of ['geometry.long-curved-fox', 'geometry.multi-curl-volume-fox']) {
    for (const side of ['left', 'right']) {
      const props = professionalReferenceTemplateToDiagramProps(id, side);
      const outerIdx = props.zones.length - 1;
      assert.strictEqual(props.zoneNames[outerIdx], 'OUTER', `${id}/${side}: last zone must be physical OUTER`);
      assert.strictEqual(props.curlByZone[outerIdx], 'L', `${id}/${side}: outer tail must keep its dramatic L curl on both eyes`);
      assert.strictEqual(props.zones[outerIdx], Math.max(...props.zones), `${id}/${side}: outer tail must be the longest zone on both eyes`);
    }
  }
});

test('J. Cat-family (Hybrid Cat Eye) outer tail stays physical OUTER with its curl transition on BOTH eyes', () => {
  for (const side of ['left', 'right']) {
    const props = professionalReferenceTemplateToDiagramProps('geometry.hybrid-cat-eye', side);
    const outerIdx = props.zones.length - 1;
    assert.strictEqual(props.zoneNames[outerIdx], 'OUTER_TIP', `${side}: last zone must be the physical outer tip`);
    assert.strictEqual(props.curlByZone[outerIdx], 'D', `${side}: the single curl transition (C->D) must land on the outer tip on both eyes`);
    assert.deepStrictEqual(props.lengthRangeByZone[outerIdx], [13, 14]);
  }
});

test('H3. Downturned-Eye Correction: physical INNER stays the maximum and physical OUTER stays the minimum on both eyes (the exact orientation risk this identity was designed to prove safe)', () => {
  for (const side of ['left', 'right']) {
    const props = professionalReferenceTemplateToDiagramProps('geometry.downturned-eye-correction', side);
    assert.strictEqual(props.zoneNames[0], 'PHYSICAL_INNER');
    assert.strictEqual(props.zoneNames.at(-1), 'PHYSICAL_OUTER');
    assert.strictEqual(props.zones[0], Math.max(...props.zones), `${side}: physical INNER must be the longest zone`);
    assert.strictEqual(props.zones.at(-1), Math.min(...props.zones), `${side}: physical OUTER must be the shortest zone`);
  }
});

// ============================================================
// K. no DRAFT template is promoted to EXPERT_REVIEWED
// ============================================================
test('K. all 6 new candidate geometries remain DRAFT; the 3 extended identities (Anime/Wet/Wispy) keep their pre-existing EXPERT_REVIEWED status unchanged', () => {
  const draftIds = ['geometry.mega-volume-dense', 'geometry.long-curved-fox', 'geometry.soft-volume-gradient', 'geometry.downturned-eye-correction', 'geometry.multi-curl-volume-fox', 'geometry.hybrid-cat-eye'];
  for (const id of draftIds) assert.strictEqual(Library.getDefinition(id).validation.status, 'DRAFT', `${id} must remain DRAFT -- renderer support is not professional approval`);
  for (const id of ['construction.anime', 'construction.wet', 'construction.wispy']) assert.strictEqual(Library.getDefinition(id).validation.status, 'EXPERT_REVIEWED');
  // structural proof: this renderer-integration phase's source never writes to `.validation` at all
  assert.ok(!adapterSource.includes('.validation'));
  assert.ok(!adapterSource.includes('EXPERT_REVIEWED'));
});

// ============================================================
// L. existing reviewed professional definitions remain unchanged
// ============================================================
test('L. the professional-lash-library.js data file itself is byte-identical to the validated Phase 1R state (this phase touched only index.html)', () => {
  const libSource = fs.readFileSync(path.join(root, 'professional-lash-library.js'), 'utf8');
  const digest = require('crypto').createHash('sha256').update(libSource).digest('hex');
  // Pinned once, immediately after this test file first ran green against
  // the untouched Phase 1R professional-lash-library.js.
  assert.strictEqual(digest, 'e662e643080c5bdff0e299b1612cd22d9b5829cf309f708137d721000e0c6192', 'professional-lash-library.js must be byte-identical -- this phase is renderer-only');
});

test('L2. lash-design-domain.js remains byte-identical -- the 21 production designs still go through their existing unmodified path', () => {
  const digest = require('crypto').createHash('sha256').update(domainSource).digest('hex');
  assert.strictEqual(digest, '11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
});

test('L3. all 21 DESIGN_CATALOG legacy IDs and their exact production geometry remain unchanged', () => {
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalog = new Function('const clampScore=n=>n;' + src.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();
  assert.deepStrictEqual(catalog.map(e => e.id), ['natural', 'naturalRounded', 'naturalElongated', 'angel', 'doll', 'rounded', 'squirrel', 'kitten', 'cat', 'softcat', 'fox', 'softfox', 'eyeliner', 'wispy', 'wispycat', 'wispydoll', 'kim', 'manga', 'wet', 'reverse', 'correction']);
  const digest = require('crypto').createHash('sha256').update(src.slice(catalogStart, catalogEnd)).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});

// ------------------------------------------------------------
// Isolation: the adapter/renderer additions never touch DESIGN_CATALOG,
// calculateEyeLashMap, ClientLashDesign, or any recommendation code, and
// stay reachable only via the ?debug=library preview (same guarantee the
// pre-existing "production is isolated" test already proves for the rest
// of this block).
// ------------------------------------------------------------
test('isolation: the new adapter/renderer code never references DESIGN_CATALOG, rankDesigns, rankDesignsAll, or calculateEyeLashMap', () => {
  for (const forbidden of ['DESIGN_CATALOG', 'rankDesigns(', 'rankDesignsAll(', 'calculateEyeLashMap(']) {
    assert.ok(!adapterSource.includes(forbidden), `adapter must not reference "${forbidden}"`);
  }
});

test('isolation: LegacyLashMapDiagram and expandLashMapSectors stay production functions with zero ProfessionalLashLibrary reference (only the DEBUG-ONLY adapter references it)', () => {
  assert.ok(!rendererSource.includes('ProfessionalLashLibrary'));
  const expandSource = src.slice(expandStart, expandEnd);
  assert.ok(!expandSource.includes('ProfessionalLashLibrary'));
});
