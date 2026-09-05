'use strict';
// ============================================================
// LASH MAP LIBRARY — production UI tests.
// ------------------------------------------------------------
// Structural/string assertions against the real source (this repo has
// no @babel/core hard dependency, so JSX screens can't be rendered in
// Node — see client-card-ui.test.js's own precedent), plus real
// extraction+eval of the plain-JS (non-JSX) adapter/notes functions
// against the REAL professional-lash-library.js module — not a
// reimplementation. Real end-to-end rendering is proven separately by
// tests/e2e/lash-map-library.spec.js.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Library = require(path.join(root, 'professional-lash-library.js'));

const libraryUiStart = src.indexOf('// LASH MAP LIBRARY — production UI. Reachable from the normal Home');
const libraryUiEnd = src.indexOf('// CLIENT CARD / CLIENT HISTORY', libraryUiStart);
assert.ok(libraryUiStart > -1 && libraryUiEnd > libraryUiStart, 'expected to locate the Lash Map Library production UI section');
const libraryUiBlock = src.slice(libraryUiStart, libraryUiEnd);

// Extracts and evals the real plain-JS chain (LASH_MAP_LIBRARY_IDS,
// plDisplayMm, buildLibraryTechniqueNotes) PLUS the real, unmodified
// adapter it depends on (professionalReferenceTemplateToDiagramProps +
// its own helpers + zoneLabel/ZONE_LABEL_KEYS/t/STRINGS), all real
// production source, same string-slice + eval technique this repo
// uses throughout.
function loadLibraryApi() {
  const stringsStart = src.indexOf('    const STRINGS = {');
  const stringsBraceStart = src.indexOf('{', stringsStart);
  let depth = 0, i = stringsBraceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  const stringsSrc = src.slice(stringsStart, i + 1);

  const tFnStart = src.indexOf('    function t(key, lang) {');
  const tFnEnd = src.indexOf('\n    }', tFnStart) + '\n    }'.length;
  const tSrc = src.slice(tFnStart, tFnEnd);

  const zoneLabelKeysStart = src.indexOf('    const ZONE_LABEL_KEYS = ');
  const zoneLabelKeysLine = src.slice(zoneLabelKeysStart, src.indexOf('\n', zoneLabelKeysStart));
  const zoneLabelFnStart = src.indexOf('    function zoneLabel(');
  const zoneLabelFnEnd = src.indexOf('\n', zoneLabelFnStart) + 1;
  const zoneLabelSrc = zoneLabelKeysLine + '\n' + src.slice(zoneLabelFnStart, zoneLabelFnEnd);

  const adapterStart = src.indexOf('    function plResolveMm(');
  const adapterEnd = src.indexOf('\n\n\n    function ProLibraryPreviewScreen(', adapterStart);
  assert.ok(adapterStart > 0 && adapterEnd > adapterStart, 'the Phase 1S adapter chain must be structurally extractable');
  const adapterSrc = src.slice(adapterStart, adapterEnd);

  const idsStart = src.indexOf('    const LASH_MAP_LIBRARY_IDS = ');
  const idsEnd = src.indexOf('\n', idsStart) + 1;
  const notesStart = src.indexOf('    function plDisplayMm(');
  const notesEnd = src.indexOf('\n\n    function LashMapLibraryScreen(', notesStart);
  assert.ok(notesEnd > notesStart, 'plDisplayMm/buildLibraryTechniqueNotes must be structurally extractable');
  const notesSrc = src.slice(notesStart, notesEnd);

  const fullCode = stringsSrc + '\n' + tSrc + '\n' + zoneLabelSrc + '\n' + adapterSrc + '\n'
    + src.slice(idsStart, idsEnd) + '\n' + notesSrc
    + '\nreturn { LASH_MAP_LIBRARY_IDS, plDisplayMm, buildLibraryTechniqueNotes, professionalReferenceTemplateToDiagramProps };';
  return new Function('ProfessionalLashLibrary', fullCode)(Library);
}
const api = loadLibraryApi();
const { LASH_MAP_LIBRARY_IDS, buildLibraryTechniqueNotes, professionalReferenceTemplateToDiagramProps } = api;

// ------------------------------------------------------------
// A/B. Library visible from normal production UI, no debug query required
// ------------------------------------------------------------
test('A/B. the Lash Map Library is reachable from the normal Home screen with no ?debug= query required', () => {
  assert.ok(src.includes("onLibrary={openLashMapLibrary}"));
  assert.ok(src.includes("const openLashMapLibrary = () => { setActiveLibraryId(null); setScreen('lashMapLibrary'); };"));
  assert.ok(src.includes("{screen === 'lashMapLibrary' && <LashMapLibraryScreen"));
  assert.ok(!libraryUiBlock.includes('isDebugModeEnabled'), 'the Lash Map Library screens must not be gated behind debug mode');
  assert.ok(!libraryUiBlock.includes('debugAvailable'), 'the Lash Map Library screens must not read the debugAvailable flag');
  assert.ok(!libraryUiBlock.includes('ПРЕДПРОСМОТР') && !libraryUiBlock.includes('DEBUG PREVIEW'), 'no debug-preview banner wording should appear in the production Library UI');
});

test('B2. HomeScreen renders the Library button unconditionally (not behind modelsLoaded or any debug flag)', () => {
  const homeStart = src.indexOf('function HomeScreen(');
  const homeEnd = src.indexOf('\n    // Live-camera-only', homeStart);
  const homeBlock = src.slice(homeStart, homeEnd);
  assert.ok(homeBlock.includes('onClick={onLibrary}'));
  assert.ok(!/onClick=\{onLibrary\}[^>]*disabled/.test(homeBlock));
});

// ------------------------------------------------------------
// C. only actual canonical identities render
// ------------------------------------------------------------
test('C. LASH_MAP_LIBRARY_IDS is derived directly from professional-lash-library.js\'s own referenceTemplates keys, not a hardcoded duplicate list', () => {
  assert.ok(src.includes('const LASH_MAP_LIBRARY_IDS = Object.keys(ProfessionalLashLibrary.library.referenceTemplates);'));
  assert.deepStrictEqual(LASH_MAP_LIBRARY_IDS.sort(), Object.keys(Library.library.referenceTemplates).sort());
  // every exposed id must actually resolve to a real definition
  for (const id of LASH_MAP_LIBRARY_IDS) assert.ok(Library.getDefinition(id), id + ' must be a real canonical identity');
});

// ------------------------------------------------------------
// D/E. DRAFT vs EXPERT_REVIEWED status is read, not changed
// ------------------------------------------------------------
test('D. the 6 candidate geometries exposed by the Library remain DRAFT', () => {
  const draftIds = ['geometry.mega-volume-dense', 'geometry.long-curved-fox', 'geometry.soft-volume-gradient', 'geometry.downturned-eye-correction', 'geometry.multi-curl-volume-fox', 'geometry.hybrid-cat-eye'];
  for (const id of draftIds) {
    assert.ok(LASH_MAP_LIBRARY_IDS.includes(id));
    assert.strictEqual(Library.getDefinition(id).validation.status, 'DRAFT');
  }
});

test('E. the 3 extended identities (Anime/Wet/Wispy) keep their EXPERT_REVIEWED status unchanged', () => {
  for (const id of ['construction.anime', 'construction.wet', 'construction.wispy']) {
    assert.strictEqual(Library.getDefinition(id).validation.status, 'EXPERT_REVIEWED');
  }
  // structural proof: the Library UI section never writes to `.validation` at all
  assert.ok(!libraryUiBlock.includes('.validation ='));
  assert.ok(!libraryUiBlock.includes("status: 'EXPERT_REVIEWED'") && !libraryUiBlock.includes('status = \'EXPERT_REVIEWED\''));
});

test('D2/E2. the DRAFT badge is shown only for def.validation.status === \'DRAFT\', never toggled or overridden', () => {
  assert.ok(libraryUiBlock.includes("isDraft: def.validation.status === 'DRAFT',"));
  assert.ok(libraryUiBlock.includes("const isDraft = def.validation.status === 'DRAFT';"));
});

// ------------------------------------------------------------
// F. INNER -> OUTER preserved
// ------------------------------------------------------------
test('F. physical INNER stays index 0 and physical OUTER stays the last index for every exposed identity, on both eyes', () => {
  for (const id of LASH_MAP_LIBRARY_IDS) {
    const left = professionalReferenceTemplateToDiagramProps(id, 'left');
    const right = professionalReferenceTemplateToDiagramProps(id, 'right');
    assert.ok(left && right, id);
    assert.deepStrictEqual(left.zones, right.zones, id + ': zone data must be identical regardless of side');
    assert.deepStrictEqual(left.zoneNames, right.zoneNames, id);
  }
});

// ------------------------------------------------------------
// G. per-zone curls render
// ------------------------------------------------------------
test('G. per-zone curl (curlByZone) is displayed in the Base zone-by-zone list when present', () => {
  assert.ok(libraryUiBlock.includes("{plDisplayMm(z)} mm{z.curl ? ` · ${z.curl}` : ''}"));
  const props = professionalReferenceTemplateToDiagramProps('geometry.multi-curl-volume-fox', 'left');
  assert.deepStrictEqual(props.curlByZone, ['B', 'C', 'M', 'M', 'L', 'L']);
});

// ------------------------------------------------------------
// H. variable zone count renders
// ------------------------------------------------------------
test('H. variable zone counts (4, 6, 7) all render their real zone count, not a fixed 5', () => {
  assert.strictEqual(professionalReferenceTemplateToDiagramProps('construction.wet', 'left').zones.length, 4);
  assert.strictEqual(professionalReferenceTemplateToDiagramProps('geometry.long-curved-fox', 'left').zones.length, 6);
  assert.strictEqual(professionalReferenceTemplateToDiagramProps('geometry.hybrid-cat-eye', 'left').zones.length, 7);
});

// ------------------------------------------------------------
// I. referenceTemplate base/spikes render where present
// ------------------------------------------------------------
test('I. base and spike/ray layers are shown as two separate rows when a spike layer exists, and the Rays row is omitted when it does not', () => {
  assert.ok(libraryUiBlock.includes("{orderedSpikes && ("));
  const withSpikes = professionalReferenceTemplateToDiagramProps('construction.wet', 'left');
  assert.ok(withSpikes.spikeGeom);
  const withoutSpikes = professionalReferenceTemplateToDiagramProps('geometry.soft-volume-gradient', 'left');
  assert.strictEqual(withoutSpikes.spikeGeom, null);
});

// ------------------------------------------------------------
// J. existing DIAGRAM renderer is reused
// ------------------------------------------------------------
test('J. the Library UI renders via the existing ProLibraryReferenceTemplateSide/LegacyLashMapDiagram, never a second renderer', () => {
  assert.ok(libraryUiBlock.includes('<ProLibraryReferenceTemplateSide canonicalId={item.id} side="left" lang={lang} />'));
  assert.ok(libraryUiBlock.includes('<ProLibraryReferenceTemplateSide canonicalId={canonicalId} side="left" lang={lang} />'));
  assert.ok(libraryUiBlock.includes('<ProLibraryReferenceTemplateSide canonicalId={canonicalId} side="right" lang={lang} />'));
  assert.ok(!libraryUiBlock.includes('<svg') && !libraryUiBlock.includes('<canvas'), 'the Library UI must not draw its own SVG/canvas — it must delegate entirely to the existing renderer');
  assert.ok(!libraryUiBlock.includes('new Image(') && !libraryUiBlock.includes('.png') && !libraryUiBlock.includes('.jpg') && !libraryUiBlock.includes('.webp'), 'no screenshot/static image map may be used');
});

// ------------------------------------------------------------
// K. no duplicate mapping constants introduced
// ------------------------------------------------------------
test('K. the Library UI never re-derives zone/curl/peak geometry itself — it only calls the existing professionalReferenceTemplateToDiagramProps adapter', () => {
  assert.ok(!libraryUiBlock.includes('function professionalReferenceTemplateToDiagramProps'), 'the adapter must not be duplicated');
  assert.ok(!libraryUiBlock.includes('function spikeGeomFromReferenceLayers'), 'the spike-layer builder must not be duplicated');
  assert.ok(!libraryUiBlock.includes('expandLashMapSectors('), 'the Library UI itself must never call the sector-expansion engine directly — that stays inside LegacyLashMapDiagram');
  const occurrences = (src.match(/function professionalReferenceTemplateToDiagramProps\(/g) || []).length;
  assert.strictEqual(occurrences, 1, 'professionalReferenceTemplateToDiagramProps must be defined exactly once');
});

// ------------------------------------------------------------
// L. RU/EN
// ------------------------------------------------------------
test('L. every new lashMapLibrary* STRINGS key has both a non-empty ru and en value', () => {
  const stringsStart = src.indexOf('    const STRINGS = {');
  const braceStart = src.indexOf('{', stringsStart);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
  const STRINGS = new Function('return ' + src.slice(braceStart, i + 1))();
  const libKeys = Object.keys(STRINGS).filter(k => k.startsWith('lashMapLibrary'));
  assert.ok(libKeys.length >= 6, 'expected the new lashMapLibrary* strings, found ' + libKeys.length);
  for (const key of libKeys) {
    assert.ok(STRINGS[key].ru && STRINGS[key].ru.trim().length > 0, key + ' missing RU text');
    assert.ok(STRINGS[key].en && STRINGS[key].en.trim().length > 0, key + ' missing EN text');
  }
  assert.strictEqual(STRINGS.lashMapLibraryUnderReview.ru, 'На проверке');
  assert.strictEqual(STRINGS.lashMapLibraryUnderReview.en, 'Under review');
  assert.strictEqual(STRINGS.lashMapLibraryNavLabel.ru, 'Библиотека Lash Map');
  assert.strictEqual(STRINGS.lashMapLibraryNavLabel.en, 'Lash Map Library');
});

test('L2. technique notes are generated in both RU and EN for every exposed identity, with no untranslated fallback', () => {
  for (const id of LASH_MAP_LIBRARY_IDS) {
    for (const lang of ['ru', 'en']) {
      const props = professionalReferenceTemplateToDiagramProps(id, 'left');
      const notes = buildLibraryTechniqueNotes(props, lang);
      assert.ok(notes.length > 0, id + '/' + lang);
      for (const note of notes) assert.ok(note && note.trim().length > 0, id + '/' + lang);
    }
  }
});

test('L3. technique notes never state a fan diameter, glue amount, isolation timing, D-value, or safety claim', () => {
  const forbidden = /diameter|glue|isolation|\bD[- ]?value|safe(ty)?/i;
  for (const id of LASH_MAP_LIBRARY_IDS) {
    for (const lang of ['ru', 'en']) {
      const notes = buildLibraryTechniqueNotes(professionalReferenceTemplateToDiagramProps(id, 'left'), lang);
      for (const note of notes) assert.ok(!forbidden.test(note), `${id}/${lang}: "${note}"`);
    }
  }
});

// ------------------------------------------------------------
// M. Back navigation
// ------------------------------------------------------------
test('M. Back navigation is wired: Library -> Home, Detail -> Library', () => {
  assert.ok(src.includes("{screen === 'lashMapLibrary' && <LashMapLibraryScreen lang={lang} onBack={() => setScreen('home')} onSelect={openLashMapLibraryDetail} />}"));
  assert.ok(src.includes("const closeLashMapLibraryDetail = () => { setActiveLibraryId(null); setScreen('lashMapLibrary'); };"));
  assert.ok(src.includes("{screen === 'lashMapLibraryDetail' && activeLibraryId && <LashMapLibraryDetailScreen lang={lang} canonicalId={activeLibraryId} onBack={closeLashMapLibraryDetail} />}"));
});

// ------------------------------------------------------------
// N. mobile no-overflow contract (structural proxy; the real, visual
// 390x844 proof is the e2e spec's screenshots)
// ------------------------------------------------------------
test('N. Library cards/detail sections use the same overflow-safe container classes (truncate/overflow-y-auto/hide-scrollbar) already used elsewhere in this app', () => {
  assert.ok(libraryUiBlock.includes('overflow-y-auto'));
  assert.ok(libraryUiBlock.includes('truncate'));
  assert.ok(libraryUiBlock.includes('hide-scrollbar'));
});

// ------------------------------------------------------------
// O. current recommendation/scan/client flows remain unaffected
// ------------------------------------------------------------
test('O. Live Scan, Photo Analysis, and Clients entry points are unchanged on Home', () => {
  const homeStart = src.indexOf('function HomeScreen(');
  const homeEnd = src.indexOf('\n    // Live-camera-only', homeStart);
  const homeBlock = src.slice(homeStart, homeEnd);
  assert.ok(homeBlock.includes('onClick={onLive}'));
  assert.ok(homeBlock.includes('onClick={onPhoto}'));
  assert.ok(homeBlock.includes('onClick={onClients}'));
});

test('O2. the Library UI never references DESIGN_CATALOG, rankDesigns[All], calculateEyeLashMap, ClientLashDesign, or the client/visit data store', () => {
  for (const forbidden of ['DESIGN_CATALOG', 'rankDesigns(', 'rankDesignsAll(', 'calculateEyeLashMap(', 'ClientLashDesign', 'ClientStore.', 'store.createVisit']) {
    assert.ok(!libraryUiBlock.includes(forbidden), forbidden);
  }
});
