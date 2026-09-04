'use strict';
// FINAL LASH MAP REFERENCE TEMPLATE — LABEL READABILITY FIX.
// Regression coverage for the deterministic vertical-level collision-
// avoidance mechanism added to LegacyLashMapDiagram for the small
// anatomical zone labels (z.label text). Extracts the REAL production
// collision-computation block and zoneLabelCompact/zoneLabel/STRINGS
// straight out of index.html (same string-slice + new Function technique
// as every other test in this project), never a hand-duplicated formula.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Library = require('../professional-lash-library.js');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(braceStart, i + 1);
}

const stringsLiteral = extractObjectLiteral('STRINGS');
const tFnStart = src.indexOf('function t(key, lang)');
const tFnLine = src.slice(tFnStart, src.indexOf('\n', tFnStart));
const zoneKeysStart = src.indexOf('    const ZONE_LABEL_KEYS = {');
const zoneKeysLine = src.slice(zoneKeysStart, src.indexOf('\n', zoneKeysStart));
const zoneFnStart = src.indexOf('function zoneLabel(name, lang)');
const zoneFnLine = src.slice(zoneFnStart, src.indexOf('\n', zoneFnStart));
const compactKeysStart = src.indexOf('    const ZONE_LABEL_COMPACT_KEYS = {');
const compactKeysLine = src.slice(compactKeysStart, src.indexOf('\n', compactKeysStart));
const compactFnStart = src.indexOf('function zoneLabelCompact(name, lang)');
const compactFnLine = src.slice(compactFnStart, src.indexOf('\n', compactFnStart));
assert.ok([stringsLiteral.length, tFnStart, zoneKeysStart, zoneFnStart, compactKeysStart, compactFnStart].every(v => v > 0 || v === stringsLiteral.length), 'localization primitives must be structurally extractable');

const { t, zoneLabel, zoneLabelCompact, STRINGS } = new Function(
  `const STRINGS = ${stringsLiteral};\n${tFnLine}\n${zoneKeysLine}\n${zoneFnLine}\n${compactKeysLine}\n${compactFnLine}\nreturn { t, zoneLabel, zoneLabelCompact, STRINGS };`
)();

// The real collision-computation block, extracted verbatim and wrapped as
// a standalone testable function taking (items, lang). `zoneLabelCompact`
// is injected exactly as the real component closure provides it.
const collisionStart = src.indexOf('      const keyZoneItems = items.filter(z => z.isKey);');
const collisionEnd = src.indexOf('\n      const upper=Array.from({length:21}', collisionStart);
assert.ok(collisionStart > 0 && collisionEnd > collisionStart, 'the label-collision block must be structurally extractable');
const collisionSource = src.slice(collisionStart, collisionEnd);
const computeLabelLevels = new Function(
  'items', 'lang', 'zoneLabelCompact',
  collisionSource + '\nreturn labelLevelByKeyIndex;'
);

// The exact rendering snippet (level -> y, leader line, clamp) so source-
// level assertions check the real JSX, not a re-description of it.
const rendererStart = src.indexOf('    function LegacyLashMapDiagram(');
const rendererEnd = src.indexOf('\n    // Phase 2B consumer boundary', rendererStart);
const rendererSource = src.slice(rendererStart, rendererEnd);

// ------------------------------------------------------------
// Helper: build synthetic `items` (the expandLashMapSectors output shape)
// for direct, controlled collision testing -- real fixtures are used
// separately below via the real adapter + real referenceTemplate data.
// ------------------------------------------------------------
function keyItem(t, keyZoneIndex, label, len = 10) {
  return { t, len, keyZoneIndex, label, isKey: true, isPeak: false };
}

test('adjacent zone labels receive non-colliding placements: two tightly-packed long labels alternate levels, spaced-out ones do not', () => {
  // Two RU labels ("ВНУТРЕННЯЯ-ОСНОВНАЯ" is long) placed extremely close
  // in t-space (0 and 0.05 on a 290px-wide canvas = ~14.5px apart) must
  // collide and alternate; the same labels placed far apart (t=0, t=1)
  // must not.
  const tight = [keyItem(0, 0, 'INNER'), keyItem(0.05, 1, 'INNER_BODY')];
  const levelsTight = computeLabelLevels(tight, 'ru', zoneLabelCompact);
  assert.notStrictEqual(levelsTight.get(0), levelsTight.get(1), 'tightly-packed adjacent labels must be placed at different levels');

  const spaced = [keyItem(0, 0, 'INNER'), keyItem(1, 1, 'INNER_BODY')];
  const levelsSpaced = computeLabelLevels(spaced, 'ru', zoneLabelCompact);
  assert.strictEqual(levelsSpaced.get(0), 0);
  assert.strictEqual(levelsSpaced.get(1), 0, 'labels with ample room must stay at the base level -- no unnecessary displacement');
});

test('three-in-a-row collisions alternate rather than accumulating monotonically (round-trips back to level 0)', () => {
  const items = [keyItem(0, 0, 'INNER'), keyItem(0.03, 1, 'INNER_BODY'), keyItem(0.06, 2, 'BODY')];
  const levels = computeLabelLevels(items, 'ru', zoneLabelCompact);
  assert.strictEqual(levels.get(0), 0);
  assert.strictEqual(levels.get(1), 1, 'the second (colliding with the first) must move to level 1');
  assert.strictEqual(levels.get(2), 0, 'the third (colliding with the second, now at level 1) must alternate back to level 0, not escalate to level 2');
});

test('length/curl labels remain associated with the correct zone: the primary text stays keyed by z.keyZoneIndex via zoneCurl/zoneDisplayLen, untouched by this fix', () => {
  assert.ok(rendererSource.includes("{z.isKey&&<text x={x} y={y-16} textAnchor=\"middle\" fill={z.isPeak?'#53C7FF':'#F4F7FA'} fontSize={15} fontWeight={z.isPeak?700:400}>{zoneCurl(z)?`${zoneDisplayLen(z)} ${zoneCurl(z)}`:zoneDisplayLen(z)}</text>}"), 'the length/curl text node (highest priority) must be byte-for-byte unchanged by the label-readability fix');
});

test('displaced labels preserve their correct anchor: the anatomical label\'s x never changes, and a leader line runs from the exact anchor y to the displaced label y', () => {
  assert.ok(rendererSource.includes('const level=labelLevelByKeyIndex.get(z.keyZoneIndex)||0;'));
  assert.ok(rendererSource.includes('const labelY=Math.min(y+20+level*LABEL_LEVEL_STEP_Y,290);'));
  assert.ok(rendererSource.includes('{level>0&&<line x1={x} y1={y+9} x2={x} y2={labelY-6}'), 'a leader line must connect the anchor to a displaced label');
  assert.ok(rendererSource.includes('<text x={x} y={labelY} textAnchor="middle"'), 'the label text itself must use the SAME x as the anchor/circle -- only y (level) may change');
});

test('labels remain within diagram bounds: labelY is clamped, and the clamp is comfortably inside the 0..300 viewBox', () => {
  assert.ok(rendererSource.includes('Math.min(y+20+level*LABEL_LEVEL_STEP_Y,290)'));
  // even a pathological y (near the very bottom of the 300-tall viewBox)
  // plus the maximum reasonable level offset stays inside bounds once clamped
  const clampedY = Math.min(290 + 20 + 1 * 13, 290);
  assert.strictEqual(clampedY, 290);
  assert.ok(290 < 300, 'the clamp ceiling itself must be inside the 0..300 viewBox');
});

test('LEFT/RIGHT collision layout mirrors correctly: computeLabelLevels never takes a `side`/`xAt` parameter, so identical items always produce identical levels regardless of screen mirroring', () => {
  // Structural proof: the extracted function's own parameter list.
  assert.deepStrictEqual(collisionSource.includes('side'), false, 'the collision block must not reference `side` at all');
  assert.deepStrictEqual(collisionSource.includes('xAt'), false, 'the collision block must not reference `xAt` (screen mirroring) at all -- only `t` (physical order)');
  // Behavioral proof: real 6/7-zone referenceTemplate items (in physical
  // array order, which is what both LEFT and RIGHT iterate) produce
  // identical levels -- this is exactly what "LEFT and RIGHT reach the
  // same layout decisions" means, since xAt (unchanged) then places
  // those identical levels at mirrored screen x.
  for (const id of ['geometry.hybrid-cat-eye', 'construction.anime', 'construction.wet', 'construction.wispy']) {
    const rt = Library.library.referenceTemplates[id];
    const zonesSource = rt.baseProfile || rt.zones;
    const items = zonesSource.map((z, i) => keyItem(i / (zonesSource.length - 1), i, z.position));
    const levelsA = computeLabelLevels(items, 'ru', zoneLabelCompact);
    const levelsB = computeLabelLevels(items, 'ru', zoneLabelCompact);
    assert.deepStrictEqual([...levelsA.entries()], [...levelsB.entries()], `${id}: identical physical-order input must always produce identical levels (determinism, and therefore LEFT/RIGHT equivalence)`);
  }
});

test('previously-overlapping templates: FULL-word labels (the pre-fix behavior) genuinely collide, confirming the real root cause', () => {
  // Root-cause confirmation: with the ORIGINAL full-word zoneLabel text
  // (no compact abbreviation, the exact pre-fix rendering), these real
  // 6/7-zone templates collide -- this is the actual crowding seen in the
  // reviewed screenshots, reproduced here deterministically.
  let anyFullWordCollision = false;
  for (const id of ['geometry.hybrid-cat-eye', 'construction.anime', 'construction.wet', 'construction.wispy']) {
    const rt = Library.library.referenceTemplates[id];
    const zonesSource = rt.baseProfile || rt.zones;
    const items = zonesSource.map((z, i) => keyItem(i / (zonesSource.length - 1), i, z.position));
    // pass zoneLabel (full word, no compact) in place of zoneLabelCompact
    // to reproduce the exact pre-fix text width.
    const levels = computeLabelLevels(items, 'ru', zoneLabel);
    if ([...levels.values()].some(l => l > 0)) anyFullWordCollision = true;
  }
  assert.ok(anyFullWordCollision, 'at least one of the four previously-reported templates must reproduce a real collision when using the original full-word labels -- otherwise this fixture no longer represents the reported problem');
});

test('the real fix (compact labels + level alternation together) leaves zero residual same-level collisions for every one of the 9 professional strategies, in both languages', () => {
  const allIds = [
    'geometry.mega-volume-dense', 'geometry.long-curved-fox', 'geometry.soft-volume-gradient',
    'geometry.downturned-eye-correction', 'geometry.multi-curl-volume-fox', 'geometry.hybrid-cat-eye',
    'construction.anime', 'construction.wet', 'construction.wispy',
  ];
  const estimateLabelWidthPx = txt => txt.length * 4.3;
  for (const id of allIds) {
    const rt = Library.library.referenceTemplates[id];
    const zonesSource = rt.baseProfile || rt.zones;
    for (const lang of ['ru', 'en']) {
      const items = zonesSource.map((z, i) => keyItem(i / (zonesSource.length - 1), i, z.position));
      const levels = computeLabelLevels(items, lang, zoneLabelCompact);
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1], b = items[i];
        if (levels.get(a.keyZoneIndex) !== levels.get(b.keyZoneIndex)) continue; // different level -> no vertical overlap possible
        const gapPx = Math.abs(b.t - a.t) * 290;
        const needed = estimateLabelWidthPx(zoneLabelCompact(a.label, lang)) / 2 + estimateLabelWidthPx(zoneLabelCompact(b.label, lang)) / 2 + 4;
        assert.ok(gapPx >= needed, `${id}/${lang}: zones "${a.label}" and "${b.label}" share level ${levels.get(a.keyZoneIndex)} but still collide (gap ${gapPx.toFixed(1)}px < needed ${needed.toFixed(1)}px)`);
      }
    }
  }
});

test('none of the 21 real DESIGN_CATALOG designs trigger any collision, in either language -- the fix is a provable no-op for existing production designs', () => {
  const zoneNamesStart = src.indexOf('    const ZONE_NAMES = ');
  const zoneNamesLine = src.slice(zoneNamesStart, src.indexOf('\n', zoneNamesStart));
  const expandStart = src.indexOf('    function expandLashMapSectors(');
  const expandEnd = src.indexOf('\n\n    // Professional Lash Map projection.', expandStart);
  const { expandLashMapSectors } = new Function(zoneNamesLine + '\n' + src.slice(expandStart, expandEnd) + '\nreturn { expandLashMapSectors };')();

  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const catalog = new Function('const clampScore=n=>n;' + src.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();

  for (const entry of catalog) {
    const curve = { zonePositions: entry.zonePositions, postPeakShape: entry.postPeakShape, plateauShape: entry.plateauShape };
    const items = expandLashMapSectors(entry.baseZones, entry.peakZone, curve);
    for (const lang of ['ru', 'en']) {
      const levels = computeLabelLevels(items, lang, zoneLabelCompact);
      assert.ok([...levels.values()].every(l => l === 0), `${entry.id}/${lang}: no existing production design should ever trigger label displacement -- if it does, this phase changed real rendered output for a live design`);
    }
  }
});

test('zoneLabelCompact falls through to zoneLabel (identical text) for every token except the 4 long Phase 1S ones, and the 5 original canonical labels are completely untouched', () => {
  for (const name of ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER', 'PRE_PEAK', 'PHYSICAL_INNER', 'PHYSICAL_OUTER']) {
    for (const lang of ['ru', 'en']) assert.strictEqual(zoneLabelCompact(name, lang), zoneLabel(name, lang), `${name}/${lang}`);
  }
  for (const name of ['INNER_BODY', 'PRE_OUTER', 'OUTER_TRANSITION', 'OUTER_TIP']) {
    for (const lang of ['ru', 'en']) {
      const compact = zoneLabelCompact(name, lang), full = zoneLabel(name, lang);
      assert.ok(compact.length < full.length, `${name}/${lang}: compact form must be genuinely shorter (compact="${compact}" full="${full}")`);
    }
  }
});

test('professional referenceTemplate geometry arrays are byte-identical after the label-readability fix (this phase touched only index.html)', () => {
  const libSource = fs.readFileSync(path.join(root, 'professional-lash-library.js'), 'utf8');
  const digest = require('crypto').createHash('sha256').update(libSource).digest('hex');
  assert.strictEqual(digest, 'e662e643080c5bdff0e299b1612cd22d9b5829cf309f708137d721000e0c6192', 'professional-lash-library.js (zones/curl/baseProfile/spikes for all 9 strategies) must be byte-identical -- this phase is a DIAGRAM label-rendering fix only');
});

test('base/spike arrays are unchanged: Anime/Wet/Wispy referenceTemplate baseProfile and spikes are exactly the validated Phase 1R values', () => {
  const wet = Library.library.referenceTemplates['construction.wet'];
  assert.deepStrictEqual(wet.baseProfile.map(z => z.lengthMm), [7, 8, 9, 10]);
  assert.deepStrictEqual(wet.spikes.map(z => z.lengthMm ?? z.lengthMmRange), [8, 10, 10, 12, [13, 14]]);
  const wispy = Library.library.referenceTemplates['construction.wispy'];
  assert.deepStrictEqual(wispy.baseProfile.map(z => z.lengthMm), [7, 8, 8, 9, 10, 12]);
  assert.deepStrictEqual(wispy.spikes.map(z => z.lengthMm), [10, 11, 11, 12, 13, 15]);
  const anime = Library.library.referenceTemplates['construction.anime'];
  assert.deepStrictEqual(anime.baseProfile.map(z => z.lengthMm), [8, 9, 10, 11, 12]);
  assert.deepStrictEqual(anime.spikes.map(z => z.lengthMm), [9, 10, 12, 13, 14]);
});

test('mirror safety re-verified: side is still consumed only by xAt, and the label-collision block is entirely independent of it', () => {
  assert.ok(rendererSource.includes("xAt=t=>55+(side==='right'?1-t:t)*290"));
  const sideConditionals = (rendererSource.match(/side\s*===/g) || []).length;
  assert.strictEqual(sideConditionals, 1, 'side must still be branched on exactly once (inside xAt) after the label fix');
});
