const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Extract the real STRINGS dictionary, the real t(key,lang) lookup, and
// the real zoneLabel(name,lang) helper by brace-matching / line-slicing
// straight out of index.html, so these tests exercise the actual
// production localization code rather than a duplicated formula.
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
const zoneKeysStart = src.indexOf('const ZONE_LABEL_KEYS = {');
const zoneKeysLine = src.slice(zoneKeysStart, src.indexOf('\n', zoneKeysStart));
const zoneFnStart = src.indexOf('function zoneLabel(name, lang)');
const zoneFnLine = src.slice(zoneFnStart, src.indexOf('\n', zoneFnStart));
assert.ok(stringsLiteral.length > 0 && tFnStart >= 0 && zoneKeysStart >= 0 && zoneFnStart >= 0, 'localization primitives must be structurally extractable');

const { t, zoneLabel, STRINGS } = new Function(
  `const STRINGS = ${stringsLiteral};\n${tFnLine}\n${zoneKeysLine}\n${zoneFnLine}\nreturn { t, zoneLabel, STRINGS };`
)();

const zoneStart = src.indexOf('    const ZONE_NAMES = ');
const ZONE_NAMES = new Function(src.slice(zoneStart, src.indexOf('\n', zoneStart)) + '\nreturn ZONE_NAMES;')();

test('ZONE_NAMES stays the canonical English engine key set, untouched by localization', () => {
  assert.deepStrictEqual(ZONE_NAMES, ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
});

test('every zone display label has both RU and EN text matching the requested mapping', () => {
  const expected = {
    INNER: { en: 'INNER', ru: 'ВНУТРЕННЯЯ' },
    TRANSITION: { en: 'TRANSITION', ru: 'ПЕРЕХОД' },
    BODY: { en: 'BODY', ru: 'ОСНОВНАЯ ЗОНА' },
    PEAK: { en: 'PEAK', ru: 'ПИК' },
    OUTER: { en: 'OUTER', ru: 'ВНЕШНЯЯ' },
  };
  for (const name of ZONE_NAMES) {
    assert.strictEqual(zoneLabel(name, 'en'), expected[name].en, `${name} EN`);
    assert.strictEqual(zoneLabel(name, 'ru'), expected[name].ru, `${name} RU`);
  }
});

test('EN zone labels are byte-identical to the original unlocalized ZONE_NAMES values', () => {
  // Guards against the localization fix silently altering what EN users see.
  for (const name of ZONE_NAMES) assert.strictEqual(zoneLabel(name, 'en'), name);
});

test('CURL/LENGTH/TEXTURE summary labels localize to RU and keep the original EN text', () => {
  assert.strictEqual(t('lashMapCurl', 'en'), 'Curl');
  assert.strictEqual(t('lashMapCurl', 'ru'), 'ИЗГИБ');
  assert.strictEqual(t('lashMapLength', 'en'), 'Length');
  assert.strictEqual(t('lashMapLength', 'ru'), 'ДЛИНА');
  assert.strictEqual(t('lashMapTexture', 'en'), 'Texture');
  assert.strictEqual(t('lashMapTexture', 'ru'), 'ТЕКСТУРА');
});

test('unknown zone names fail closed to their own key rather than throwing or going blank', () => {
  assert.strictEqual(zoneLabel('NOT_A_ZONE', 'ru'), 'NOT_A_ZONE');
  assert.strictEqual(zoneLabel('NOT_A_ZONE', 'en'), 'NOT_A_ZONE');
});

// ------------------------------------------------------------
// Structural wiring: the renderers are JSX and cannot run under plain
// Node, so confirm every render site was actually switched over to the
// localization helpers (and that geometry/mirroring code is untouched).
// ------------------------------------------------------------
const diagramStart = src.indexOf('    function LegacyLashMapDiagram(');
const diagramEnd = src.indexOf('\n    // Phase 2B consumer boundary', diagramStart);
const diagramSource = src.slice(diagramStart, diagramEnd);

const consumerStart = src.indexOf('    function LashMapDiagram(');
const consumerEnd = src.indexOf('\n\n    // Artist-facing map', consumerStart);
const consumerSource = src.slice(consumerStart, consumerEnd);

const photoStart = src.indexOf('    function LegacyProfessionalEyeMap(');
const photoEnd = src.indexOf('\n\n    // Phase 2C consumer boundary', photoStart);
const photoSource = src.slice(photoStart, photoEnd);

const screenStart = src.indexOf('    function LashMapScreen(');
const screenEnd = src.indexOf('\n    function ApplicationStepCard(', screenStart);
const screenSource = src.slice(screenStart, screenEnd);

test('LegacyLashMapDiagram renders localized zone labels and keeps its mirroring geometry untouched', () => {
  assert.ok(diagramSource.includes("function LegacyLashMapDiagram({ zones, peakIdx, spikeGeom, curve, hoveredZone, setHoveredZone, curl, technique, side, lang }) {"));
  assert.ok(diagramSource.includes('{zoneLabel(z.label,lang)}'));
  assert.ok(diagramSource.includes("xAt=t=>55+(side==='right'?1-t:t)*290"), 'LEFT/RIGHT mirror formula must be unchanged by this localization-only fix');
  assert.ok(!diagramSource.includes('{z.label}</text>'), 'raw unlocalized zone label must no longer be rendered directly');
});

test('LashMapDiagram forwards lang through to the legacy renderer alongside the existing props', () => {
  assert.ok(consumerSource.includes('function LashMapDiagram({ clientDesign, hoveredZone, setHoveredZone, lang }) {'));
  assert.ok(consumerSource.includes('<LegacyLashMapDiagram {...diagramProps} hoveredZone={hoveredZone} setHoveredZone={setHoveredZone} lang={lang}/>'));
});

test('LashMapScreen passes lang into the DIAGRAM view call site', () => {
  assert.ok(screenSource.includes('<LashMapDiagram clientDesign={diagramClientDesign} hoveredZone={hoveredZone} setHoveredZone={setHoveredZone} lang={lang}/>'));
});

test('PHOTO view localizes the zone-cue leader text and the bottom zone-value strip', () => {
  assert.ok(photoSource.includes('{`${zoneLabel(point.label,lang)} ${point.len}`}'));
  assert.ok(photoSource.includes('{zoneLabel(ZONE_NAMES[i],lang)}'));
  assert.ok(!photoSource.includes('{`${point.label} ${point.len}`}'), 'raw unlocalized zone-cue text must no longer be rendered directly');
});

test('PHOTO summary panel localizes CURL/LENGTH/TEXTURE dt labels via the existing t() mechanism', () => {
  assert.ok(photoSource.includes("<dt className=\"text-[9px] uppercase tracking-wider text-textMuted\">{t('lashMapCurl',lang)}</dt>"));
  assert.ok(photoSource.includes("<dt className=\"text-[9px] uppercase tracking-wider text-textMuted\">{t('lashMapLength',lang)}</dt>"));
  assert.ok(photoSource.includes("<dt className=\"text-[9px] uppercase tracking-wider text-textMuted\">{t('lashMapTexture',lang)}</dt>"));
  assert.ok(!photoSource.includes('>Curl</dt>') && !photoSource.includes('>Length</dt>') && !photoSource.includes('>Texture</dt>'), 'hardcoded English dt text must no longer be rendered directly');
});

test('custom zone editor in LashMapScreen localizes its per-zone name span', () => {
  assert.ok(screenSource.includes('<span className="text-[9px] text-textMuted mb-1 uppercase">{zoneLabel(ZONE_NAMES[i],lang)}</span>'));
});

test('recommendation/Application Plan text generation is untouched by this localization-only fix', () => {
  // These strings intentionally embed raw ZONE_NAMES inside already-localized
  // sentences and are explicitly out of scope for the Lash Map label fix.
  assert.ok(src.includes('`${ZONE_NAMES[0]} ${d.leftZones[0]}mm → ${ZONE_NAMES[d.peakZone]} ${maxLeft}mm → ${ZONE_NAMES[4]} ${d.leftZones[4]}mm`'));
  assert.ok(src.includes('`${ZONE_NAMES[0]} ${d.leftZones[0]}мм → ${ZONE_NAMES[d.peakZone]} ${maxLeft}мм → ${ZONE_NAMES[4]} ${d.leftZones[4]}мм`'));
});
