'use strict';
// ============================================================
// CLIENT-4 — VISIT HISTORY UI tests.
// ------------------------------------------------------------
// Same approach as client-card-ui.test.js/save-to-client-flow.test.js:
// structural/string assertions against the real JSX source (this repo
// has no @babel/core hard dependency, so the JSX components themselves
// cannot be rendered in Node — see tests/e2e/visit-history.spec.js for
// the real-browser proof of actual rendering), plus direct
// extraction+eval of the one genuinely new pure-JS function this phase
// adds (visitDesignDiagramProps), exercised against real ClientStore/
// VisitSnapshot/LashDesignDomain modules, not a reimplementation.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ClientStore = require(path.join(root, 'client-store.js'));
const VisitSnapshot = require(path.join(root, 'visit-snapshot.js'));
const LashDesignDomain = require(path.join(root, 'lash-design-domain.js'));

const appStart = src.indexOf('    function App() {');
const appBlock = src.slice(appStart);
const clientSectionStart = src.indexOf('// CLIENT CARD / CLIENT HISTORY — Phase 2: production UI only.');
const debugMarkerStart = src.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
const clientUiBlock = src.slice(clientSectionStart, debugMarkerStart);

function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + src.slice(braceStart, i + 1))();
}

// Extracts and evals the REAL visitDesignDiagramProps function verbatim
// (same string-slice + eval technique used throughout this repo), with
// the real ZONE_NAMES constant it references injected as a parameter.
function loadVisitDesignDiagramProps() {
  const zoneNamesLine = "const ZONE_NAMES = ['INNER','TRANSITION','BODY','PEAK','OUTER'];";
  assert.ok(src.includes(zoneNamesLine), 'expected the real ZONE_NAMES declaration');
  const start = src.indexOf('    function visitDesignDiagramProps(designSnapshot, side) {');
  const end = src.indexOf('\n    function VisitLashMapDiagram', start);
  assert.ok(start !== -1 && end !== -1, 'expected to locate visitDesignDiagramProps in index.html');
  const fnSource = src.slice(start, end);
  return new Function('ZONE_NAMES', fnSource + '\nreturn visitDesignDiagramProps;')(['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
}
const visitDesignDiagramProps = loadVisitDesignDiagramProps();

// Real fixtures, same style as save-to-client-flow.test.js.
function buildRealClientDesign(overrides) {
  const eyeProfile = { eyeShapeCategory: 'almond', eyeShapeConfidence: 0.8, tiltTendency: 'neutral', tiltConfidence: 0.7, tiltDegrees: 1, perEyeTiltDegrees: { left: 1, right: 1 }, eyelidCategory: 'none', eyelidCategoryConfidence: 0.6, eyelidType: 'standard', eyelidTypeConfidence: 0.6, eyelidSignalsConflict: false, creaseState: 'visible', hoodingState: 'none', eyeSetCategory: 'standard', eyeSizeCategory: 'medium', symmetryCategory: 'symmetric', compositeAsymmetry: 0.02, overallConfidence: 0.75 };
  const catalogEntry = { id: (overrides && overrides.design && overrides.design.id) || 'fox' };
  const design = {
    id: 'fox', category: 'cat-fox', name: 'Fox', ruName: 'Fox', enName: 'Fox', aliases: [],
    score: 82, whyItWorks: 'Real recommendation explanation.', correctionGoal: null, limitations: ['A real limitation.'], baseCurl: 'C', curlOptions: ['C', 'CC'],
    defaultTechnique: '2D', peakZone: 3, leftPeakZone: 3, rightPeakZone: 3,
    leftCorrectionMm: 0.5, rightCorrectionMm: -0.5, texture: null, curve: { zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' },
    leftZones: [8, 9, 10, 12, 11], rightZones: [8, 9, 10, 12, 11],
    curlRec: { primary: 'C', alternatives: ['CC'], reason: 'test' },
    ...(overrides && overrides.design),
  };
  const base = LashDesignDomain.legacyToClientLashDesign({
    design, catalogEntry, eyeProfile: (overrides && overrides.eyeProfile) || eyeProfile,
    expandSectors: (zones, peakIdx) => zones.map((mm, i) => ({ zone: i, mm, peak: i === peakIdx })),
  });
  return LashDesignDomain.withRecommendationRuntime(base, { rank: 0, localizedLegacy: design });
}
function buildRealResult(overrides) {
  return {
    originalImage: 'data:image/jpeg;base64,IGNORED_IN_THIS_TEST',
    landmarks: { positions: [{ x: 1, y: 1 }] },
    imageWidth: 800, imageHeight: 600,
    eyeProfile: { eyeShapeCategory: 'almond', eyeShapeConfidence: 0.8, tiltTendency: 'neutral', tiltConfidence: 0.7, tiltDegrees: 1, perEyeTiltDegrees: { left: 1, right: 1 }, eyelidCategory: 'none', eyelidCategoryConfidence: 0.6, eyelidType: 'standard', eyelidTypeConfidence: 0.6, eyelidSignalsConflict: false, creaseState: 'visible', hoodingState: 'none', eyeSetCategory: 'standard', eyeSizeCategory: 'medium', symmetryCategory: 'symmetric', compositeAsymmetry: 0.02, overallConfidence: 0.75 },
    iris: { name: 'brown', confidence: 0.8, compositionLabel: 'brown', colorComposition: null },
    source: 'photo', singleFrame: true,
    designs: [{ id: 'fox' }],
    ...overrides,
  };
}

// ------------------------------------------------------------
// A. zero-Visit empty state
// ------------------------------------------------------------
test('A. ClientCardScreen renders the true empty state only when store.listVisitsForClient resolved zero visits', () => {
  assert.ok(clientUiBlock.includes('visits.length === 0'));
  assert.ok(clientUiBlock.includes("t('clientCardHistoryEmpty', lang)"));
});

// ------------------------------------------------------------
// B/D. one Visit renders using the saved design snapshot
// ------------------------------------------------------------
test('B/D. VisitHistoryCard is rendered from the real visits array, one card per visit, reading only visit.designSnapshot/visit.artistNote/visit.visitDate', () => {
  assert.ok(clientUiBlock.includes('visits.map(v => <VisitHistoryCard key={v.id} visit={v} lang={lang} onOpen={() => onOpenVisit(v.id)} />)'));
  const fnMatch = clientUiBlock.match(/function VisitHistoryCard\(\{ visit, lang, onOpen \}\) \{[\s\S]*?\n    \}\n/);
  assert.ok(fnMatch, 'expected to locate VisitHistoryCard');
  const body = fnMatch[0];
  assert.ok(body.includes('visit.designSnapshot'));
  assert.ok(body.includes('visit.artistNote'));
  assert.ok(body.includes('formatClientDate(visit.visitDate, lang)'));
});

// ------------------------------------------------------------
// C. multiple Visits, newest first — the UI never re-sorts; it trusts
// ClientStore.listVisitsForClient's own newest-first contract (see
// client-store.js's listVisitsForClient, already regression-tested).
// ------------------------------------------------------------
test('C. ClientCardScreen renders store.listVisitsForClient results in the order returned, with no additional client-side re-sort', () => {
  const fnMatch = clientUiBlock.match(/function ClientCardScreen\(\{[\s\S]*?\n    \}\n/);
  assert.ok(fnMatch);
  assert.ok(!fnMatch[0].includes('.sort('), 'ClientCardScreen must not re-sort visits — ordering is owned exclusively by the store');
});

// ------------------------------------------------------------
// E/F. opening/closing a Visit navigates correctly and back
// ------------------------------------------------------------
test('E/F. App wires openVisitDetail/closeVisitDetail: opening a visit sets activeVisitId+screen, Back clears the visit and returns to the SAME Client Card (activeClientId untouched)', () => {
  assert.ok(appBlock.includes("const openVisitDetail = (visitId) => { setActiveVisitId(visitId); setScreen('visitDetail'); };"));
  assert.ok(appBlock.includes("const closeVisitDetail = () => { setActiveVisitId(null); setScreen('clientCard'); };"));
  assert.ok(!appBlock.match(/const closeVisitDetail = \(\) => \{[^}]*setActiveClientId/), 'closeVisitDetail must never touch activeClientId — Back must return to the same client');
  assert.ok(appBlock.includes("<ClientCardScreen lang={lang} clientId={activeClientId} store={clientStoreRef.current} onBack={() => setScreen('clients')} onEdit={openEditClientForm} onDeleted={() => { setActiveClientId(null); setScreen('clients'); }} onOpenVisit={openVisitDetail} />"));
  assert.ok(appBlock.includes("{screen === 'visitDetail' && activeClientId && activeVisitId && <VisitDetailScreen lang={lang} visitId={activeVisitId} clientId={activeClientId} store={clientStoreRef.current} onBack={closeVisitDetail} />}"));
});

test('E2. VisitDetailScreen only accepts a fetched visit whose clientId matches the given clientId — a stale/foreign visitId can never render another client\'s data', () => {
  const fnMatch = src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/);
  assert.ok(fnMatch);
  assert.ok(fnMatch[0].includes('v && v.clientId === clientId ? v : null'));
});

// ------------------------------------------------------------
// G/H. LEFT/RIGHT saved maps and physical INNER->OUTER semantics
// preserved -- real extracted visitDesignDiagramProps, real stored
// snapshot (round-tripped through the real ClientStore).
// ------------------------------------------------------------
test('G/H. visitDesignDiagramProps feeds the real diagram renderer the saved zones/peak verbatim, in the same INNER->OUTER array order they were stored in -- never reversed by side', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client G/H' });
  const clientDesign = buildRealClientDesign();
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: clientDesign, naturalLashProfile: null });
  const visit = await store.createVisit(client.id, snapshot);
  const design = visit.designSnapshot;

  for (const side of ['left', 'right']) {
    const props = visitDesignDiagramProps(design, side);
    assert.ok(props, side + ' props must not be null when finalMm is present');
    assert.deepStrictEqual(props.zones, design.physicalEyes[side].finalMm, 'zones must be the exact stored array, never reordered');
    assert.strictEqual(props.zones[0], design.physicalEyes[side].finalMm[0], 'index 0 stays INNER regardless of side');
    assert.strictEqual(props.zones.at(-1), design.physicalEyes[side].finalMm.at(-1), 'the last index stays OUTER regardless of side');
    assert.strictEqual(props.peakIdx, design.physicalEyes[side].peakZone);
    assert.strictEqual(props.side, side);
    assert.deepStrictEqual(props.zoneNames, ['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);
  }
});

test('G2. visitDesignDiagramProps returns null (never throws/fabricates) when a side has no stored finalMm', () => {
  assert.strictEqual(visitDesignDiagramProps(null, 'left'), null);
  assert.strictEqual(visitDesignDiagramProps({ physicalEyes: { left: { finalMm: null } } }, 'left'), null);
});

// ------------------------------------------------------------
// I/J/K. saved lengths/curls/PEAK preserved
// ------------------------------------------------------------
test('I/J/K. visitDesignDiagramProps carries the exact stored curl/curlByZone/peakZone through, never recomputing them', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client I/J/K' });
  const clientDesign = buildRealClientDesign();
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: clientDesign, naturalLashProfile: null });
  const visit = await store.createVisit(client.id, snapshot);
  const design = visit.designSnapshot;
  const props = visitDesignDiagramProps(design, 'left');
  assert.strictEqual(props.curl, design.curl.global);
  assert.strictEqual(props.curl, 'C');
  assert.strictEqual(props.peakIdx, 3);
  assert.deepStrictEqual(props.zones, [8, 9, 10, 12, 11]);
});

// ------------------------------------------------------------
// L/M. recommendation explanation and analysis summary preserved --
// VisitDetailScreen reads them directly off the already-immutable
// snapshot fields (visit-snapshot.test.js already proves those fields
// themselves never change after being built).
// ------------------------------------------------------------
test('L. VisitDetailScreen reads whyItWorks/limitations directly from design.recommendation, never from a re-ranked/re-localized source', () => {
  const fnMatch = src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/)[0];
  assert.ok(fnMatch.includes('design.recommendation.whyItWorks'));
  assert.ok(fnMatch.includes('design.recommendation.limitations'));
});

test('M. VisitDetailScreen reads the analysis summary directly from analysis.eye/analysis.iris/analysis.naturalLash, never from result.eyeProfile/result.iris', () => {
  const fnMatch = src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/)[0];
  for (const forbidden of ['result.eyeProfile', 'result.iris', 'result.naturalLashProfile']) {
    assert.ok(!fnMatch.includes(forbidden), 'VisitDetailScreen must never read ' + forbidden);
  }
  assert.ok(fnMatch.includes('analysis.eye.shape.category'));
  assert.ok(fnMatch.includes('analysis.iris'));
  assert.ok(fnMatch.includes('analysis.naturalLash'));
});

// ------------------------------------------------------------
// N. missing optional analysis handled safely (na fallback)
// ------------------------------------------------------------
test('N. every optional analysis/design field VisitDetailScreen displays has an explicit "not available" fallback, never a blank/undefined render', () => {
  const fnMatch = src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/)[0];
  const naUses = (fnMatch.match(/: na\b/g) || []).length + (fnMatch.match(/\? na\b/g) || []).length + (fnMatch.match(/\|\| na\b/g) || []).length;
  assert.ok(naUses >= 6, 'expected multiple guarded fields falling back to the na ("not available") constant, found ' + naUses);
});

test('N2. buildDesignSnapshot/buildAnalysisSnapshot really do allow partial/missing data (visit-snapshot.js contract) -- so VisitDetailScreen\'s na fallback is exercised by real data, not a hypothetical', () => {
  const snap = VisitSnapshot.buildAnalysisSnapshot({ eyeProfile: {}, iris: null, naturalLashProfile: null });
  assert.strictEqual(snap.eye.shape.category, null);
  assert.strictEqual(snap.iris, null);
  assert.strictEqual(snap.naturalLash.availability, 'UNAVAILABLE');
});

// ------------------------------------------------------------
// O. artist note rendered correctly (and never fabricated when empty)
// ------------------------------------------------------------
test('O. visit.artistNote is shown verbatim when present and the whole section is omitted (not blanked) when absent', () => {
  const fnMatch = src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/)[0];
  assert.ok(fnMatch.includes('{visit.artistNote && ('));
  assert.ok(fnMatch.includes("t('visitArtistNoteTitle', lang)"));
  assert.ok(fnMatch.includes('{visit.artistNote}</p>'));
});

// ------------------------------------------------------------
// P. historical values do not change when current library/recommendation
// values change later -- real regression, UI-adapter layer.
// ------------------------------------------------------------
test('P. a stored Visit\'s diagram props stay byte-identical after the ORIGINAL design/catalog objects used to build it are mutated afterward', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client P' });
  const mutableDesign = { id: 'fox', category: 'cat-fox', name: 'Fox', ruName: 'Fox', enName: 'Fox', aliases: [], score: 82, whyItWorks: 'Original explanation.', correctionGoal: null, limitations: [], baseCurl: 'C', curlOptions: ['C', 'CC'], defaultTechnique: '2D', peakZone: 3, leftPeakZone: 3, rightPeakZone: 3, leftCorrectionMm: 0, rightCorrectionMm: 0, texture: null, curve: { zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' }, leftZones: [8, 9, 10, 12, 11], rightZones: [8, 9, 10, 12, 11], curlRec: { primary: 'C', alternatives: ['CC'], reason: 'test' } };
  const clientDesign = buildRealClientDesign({ design: mutableDesign });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: clientDesign, naturalLashProfile: null });
  await store.createVisit(client.id, snapshot);

  // Simulate "the current library/recommendation engine changed later":
  // mutate the SAME source objects a live re-ranking would now produce.
  mutableDesign.leftZones[0] = 99;
  mutableDesign.leftPeakZone = 0;
  mutableDesign.curlRec.primary = 'D';
  mutableDesign.whyItWorks = 'A completely different, later explanation.';

  const [visit] = await store.listVisitsForClient(client.id);
  const props = visitDesignDiagramProps(visit.designSnapshot, 'left');
  assert.deepStrictEqual(props.zones, [8, 9, 10, 12, 11], 'stored zones must not reflect the later mutation');
  assert.strictEqual(props.peakIdx, 3, 'stored peak must not reflect the later mutation');
  assert.strictEqual(props.curl, 'C', 'stored curl must not reflect the later mutation');
  assert.strictEqual(visit.designSnapshot.recommendation.whyItWorks, 'Original explanation.');
});

// ------------------------------------------------------------
// Q/R. privacy — no photo/landmark/debug data ever referenced or shown
// ------------------------------------------------------------
test('Q/R. VisitDetailScreen/VisitHistoryCard/visitDesignDiagramProps never reference photo/landmark/debug fields in their own source', () => {
  const blocks = [
    src.match(/function VisitDetailScreen\(\{[\s\S]*?\n    \}\n/)[0],
    src.match(/function VisitHistoryCard\(\{[\s\S]*?\n    \}\n/)[0],
    src.match(/function visitDesignDiagramProps\([\s\S]*?\n    \}\n/)[0],
  ];
  for (const forbidden of ['originalImage', 'landmarks', 'base64', '.getContext(', 'photoId', '.debug']) {
    for (const block of blocks) assert.ok(!block.includes(forbidden), 'must not reference ' + forbidden);
  }
});

test('Q2. a real stored Visit round-tripped through ClientStore contains no photo/image/landmark data anywhere (data-layer proof, matching save-to-client-flow.test.js test K)', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client Q2' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const visit = await store.createVisit(client.id, snapshot);
  const raw = JSON.stringify(visit);
  for (const forbidden of ['originalImage', 'IGNORED_IN_THIS_TEST', 'data:image', 'landmarks', 'base64']) {
    assert.ok(!raw.includes(forbidden));
  }
});

// ------------------------------------------------------------
// S/T. RU/EN coverage for every new visit-prefixed string
// ------------------------------------------------------------
test('S/T. every new visit-prefixed STRINGS key has both a non-empty ru and en value', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const visitKeys = Object.keys(STRINGS).filter(k => k.startsWith('visit'));
  assert.ok(visitKeys.length >= 8, 'expected the new CLIENT-4 visit-prefixed strings, found ' + visitKeys.length);
  for (const key of visitKeys) {
    assert.ok(STRINGS[key].ru && STRINGS[key].ru.trim().length > 0, key + ' missing RU text');
    assert.ok(STRINGS[key].en && STRINGS[key].en.trim().length > 0, key + ' missing EN text');
  }
  assert.strictEqual(STRINGS.clientCardHistoryEmpty.ru, 'История визитов пока пуста');
  assert.strictEqual(STRINGS.clientCardHistoryEmpty.en, 'No visits yet');
});

// ------------------------------------------------------------
// U/V. existing navigation is not disturbed by this phase
// ------------------------------------------------------------
test('U. ClientsListScreen (normal, non-save navigation) is completely untouched by CLIENT-4 -- no new props, no visit-history references', () => {
  const fnMatch = src.match(/function ClientsListScreen\(\{[\s\S]*?\n    \}\n/)[0];
  assert.ok(!fnMatch.includes('VisitHistoryCard'));
  assert.ok(!fnMatch.includes('onOpenVisit'));
});

test('V. CLIENT-3\'s finishSaveToClient still lands on screen "clientCard" (unmodified by this phase) -- Client Card is where the new Visit History now becomes visible', () => {
  const fnMatch = appBlock.match(/const finishSaveToClient = async \(clientId\) => \{[\s\S]*?\n      \};/)[0];
  assert.ok(fnMatch.includes("setScreen('clientCard');"));
});
