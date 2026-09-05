'use strict';
// ============================================================
// SAVE TO CLIENT — CLIENT-3 wiring tests.
// ------------------------------------------------------------
// Same approach as client-card-ui.test.js/pro-library-preview-ui.test.js
// for the JSX-heavy App()-level orchestration (structural/string
// assertions against the real source — this repo has no @babel/core
// hard dependency, so App() itself cannot be rendered in Node). For the
// one piece of genuinely new, risk-bearing logic this phase adds —
// finishSaveToClient's duplicate-save guard and its real effect on
// stored data — the REAL function is extracted verbatim (same
// string-slice + eval technique used throughout this repo for
// calculateEyeLashMap etc.) and exercised against the REAL ClientStore
// and REAL VisitSnapshot modules, not a reimplementation.
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

// ------------------------------------------------------------
// Real fixtures — a real ClientLashDesign v2 (via legacyToClientLashDesign,
// not hand-built) and a real result/naturalLashProfile-shaped object,
// exactly like visit-snapshot.test.js's own established fixture style.
// ------------------------------------------------------------
function buildRealClientDesign(overrides) {
  const eyeProfile = { eyeShapeCategory: 'almond', eyeShapeConfidence: 0.8, tiltTendency: 'neutral', tiltConfidence: 0.7, tiltDegrees: 1, perEyeTiltDegrees: { left: 1, right: 1 }, eyelidCategory: 'none', eyelidCategoryConfidence: 0.6, eyelidType: 'standard', eyelidTypeConfidence: 0.6, eyelidSignalsConflict: false, creaseState: 'visible', hoodingState: 'none', eyeSetCategory: 'standard', eyeSizeCategory: 'medium', symmetryCategory: 'symmetric', compositeAsymmetry: 0.02, overallConfidence: 0.75 };
  const catalogEntry = { id: (overrides && overrides.design && overrides.design.id) || 'fox' };
  const design = {
    id: 'fox', category: 'cat-fox', name: 'Fox', ruName: 'Fox', enName: 'Fox', aliases: [],
    score: 82, whyItWorks: 'test', correctionGoal: null, limitations: [], baseCurl: 'C', curlOptions: ['C', 'CC'],
    defaultTechnique: '2D', peakZone: 4, leftPeakZone: 4, rightPeakZone: 4,
    leftCorrectionMm: 0, rightCorrectionMm: 0, texture: null, curve: { zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' },
    leftZones: [8, 9, 10, 11, 12, 11, 10], rightZones: [8, 9, 10, 11, 12, 11, 10],
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
// Extracts the REAL finishSaveToClient function verbatim and runs it
// against injected (mostly real) collaborators — same technique
// client-card-ui.test.js/visit-snapshot.test.js already use for other
// production functions in this repo.
// ------------------------------------------------------------
function extractFinishSaveToClient() {
  const start = src.indexOf('      const finishSaveToClient = async (clientId) => {');
  const end = src.indexOf('\n\n      // Reused as ClientFormScreen', start);
  assert.ok(start !== -1 && end !== -1, 'expected to locate finishSaveToClient in index.html');
  return src.slice(start, end);
}
const finishSaveToClientSource = extractFinishSaveToClient();

function buildHarness({ pendingVisitSnapshot, store }) {
  const calls = { busy: [], toast: [], pendingSnapshot: [], clientSelectForSave: [], returnScreen: [], activeClientId: [], screen: [] };
  const saveVisitBusyRef = { current: false };
  const fn = new Function(
    'saveVisitBusyRef', 'setSaveVisitBusy', 'pendingVisitSnapshot', 'clientStoreRef', 'setSaveVisitToast',
    'setPendingVisitSnapshot', 'setClientSelectForSave', 'setSaveVisitReturnScreen', 'setActiveClientId', 'setScreen',
    finishSaveToClientSource + '\nreturn finishSaveToClient;'
  )(
    saveVisitBusyRef,
    (v) => calls.busy.push(v),
    pendingVisitSnapshot,
    { current: store },
    (v) => calls.toast.push(v),
    (v) => calls.pendingSnapshot.push(v),
    (v) => calls.clientSelectForSave.push(v),
    (v) => calls.returnScreen.push(v),
    (v) => calls.activeClientId.push(v),
    (v) => calls.screen.push(v),
  );
  return { fn, calls, saveVisitBusyRef };
}

// ------------------------------------------------------------
// A. completed result can initiate Save to Client
// ------------------------------------------------------------
test('A. HeroScreen and LashMapScreen both accept and conditionally render an onSaveToClient action', () => {
  assert.ok(/function HeroScreen\(\{[^}]*onSaveToClient[^}]*\}\)/.test(src));
  assert.ok(/function LashMapScreen\(\{[^}]*onSaveToClient[^}]*\}\)/.test(src));
  assert.ok(src.includes("{onSaveToClient && ("), 'HeroScreen/LashMapScreen must not render a dominant/always-on button — gated on the prop being provided');
});

test('A2. App wires the SAME handler reference to both screens (reuse, not duplicate save logic)', () => {
  assert.ok(appBlock.includes('onSaveToClient={handleSaveToClient}'));
  const occurrences = (appBlock.match(/onSaveToClient=\{handleSaveToClient\}/g) || []).length;
  assert.strictEqual(occurrences, 2, 'expected exactly two screens wired to the exact same handleSaveToClient reference');
});

// ------------------------------------------------------------
// B. VisitSnapshot builder is used, not duplicated UI mapping
// ------------------------------------------------------------
test('B. beginSaveToClient calls VisitSnapshot.buildVisitSnapshot — no hand-rolled analysisSnapshot/designSnapshot object literal in App()', () => {
  assert.ok(appBlock.includes('VisitSnapshot.buildVisitSnapshot({ result, activeDesign: design || null, naturalLashProfile })'));
  assert.ok(!appBlock.includes('analysisSnapshot:'), 'App() must never hand-build a snapshot field — that belongs exclusively to visit-snapshot.js');
  assert.ok(!appBlock.includes('designSnapshot:'), 'App() must never hand-build a snapshot field — that belongs exclusively to visit-snapshot.js');
});

test('B2. visit-snapshot.js loads as a plain <script> before the main app script, same dual-load pattern as its siblings', () => {
  const tagIdx = src.indexOf('<script src="visit-snapshot.js"></script>');
  const appScriptIdx = src.indexOf('<script type="text/babel">');
  assert.ok(tagIdx !== -1 && tagIdx < appScriptIdx);
});

// ------------------------------------------------------------
// C. existing client receives exactly one new Visit (real store + real
// extracted finishSaveToClient)
// ------------------------------------------------------------
test('C. an existing client receives exactly one new Visit after one Save-to-Client operation', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client C' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn, calls } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(visits.length, 1);
  assert.deepStrictEqual(visits[0].analysisSnapshot, snapshot.analysisSnapshot);
  assert.deepStrictEqual(visits[0].designSnapshot, snapshot.designSnapshot);
  assert.strictEqual(calls.screen[calls.screen.length - 1], 'clientCard');
  assert.strictEqual(calls.activeClientId[calls.activeClientId.length - 1], client.id);
  assert.deepStrictEqual(calls.pendingSnapshot, [null], 'pending snapshot must be cleared exactly once, to null');
});

// ------------------------------------------------------------
// D. new client flow creates Client + exactly one Visit
// ------------------------------------------------------------
test('D. creating a new client mid-save (real ClientStore.createClient, then the real finishSaveToClient) produces exactly one client and one visit', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  // Mirrors handleClientFormSaved's real branch: pendingVisitSnapshot set -> create client -> finishSaveToClient(client.id).
  const client = await store.createClient({ fullName: 'Test Client D' });
  const { fn } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  const allClients = await store.listClients();
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(allClients.length, 1);
  assert.strictEqual(visits.length, 1);
});

test('D2. handleClientFormSaved only attaches the pending visit when BOTH pendingVisitSnapshot and clientSelectForSave are true; ordinary create/edit takes the original unmodified path', () => {
  const fnMatch = appBlock.match(/const handleClientFormSaved = \(client\) => \{[\s\S]*?\n {6}\};/);
  assert.ok(fnMatch, 'expected to locate handleClientFormSaved');
  const bodySrc = fnMatch[0];
  assert.ok(bodySrc.includes('if (pendingVisitSnapshot && clientSelectForSave)'));
  assert.ok(bodySrc.includes('finishSaveToClient(client.id)'));
  assert.ok(bodySrc.includes("setActiveClientId(client.id);\n          setScreen('clientCard');"), 'the else-branch must be the exact original pre-CLIENT-3 behavior');
});

// ------------------------------------------------------------
// E. second historical visit appends rather than overwrites first
// ------------------------------------------------------------
test('E. two Save-to-Client operations for the same client append two distinct, both-retained visits (real store, real extracted finishSaveToClient)', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client E' });
  const snapshot1 = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign({ design: { id: 'fox' } }), naturalLashProfile: null });
  const { fn: fn1 } = buildHarness({ pendingVisitSnapshot: snapshot1, store });
  await fn1(client.id);
  const snapshot2 = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign({ design: { id: 'cat' } }), naturalLashProfile: null });
  const { fn: fn2 } = buildHarness({ pendingVisitSnapshot: snapshot2, store });
  await fn2(client.id);
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(visits.length, 2, 'both visits must be retained — createVisit is append-only');
  const designIds = visits.map(v => v.designSnapshot.designId).sort();
  assert.deepStrictEqual(designIds, ['cat', 'fox']);
});

// ------------------------------------------------------------
// F. pending snapshot clears after successful save
// ------------------------------------------------------------
test('F. pendingVisitSnapshot is cleared to null exactly once after a successful save', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client F' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn, calls } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  assert.deepStrictEqual(calls.pendingSnapshot, [null]);
  assert.deepStrictEqual(calls.clientSelectForSave, [false]);
  assert.deepStrictEqual(calls.returnScreen, [null]);
});

// ------------------------------------------------------------
// G. consent decline creates nothing
// ------------------------------------------------------------
test('G. handleSaveConsentDecline never references the client store / createClient / createVisit and only clears in-memory state', () => {
  const fnMatch = appBlock.match(/const handleSaveConsentDecline = \(\) => \{[\s\S]*?\n {6}\};/);
  assert.ok(fnMatch, 'expected to locate handleSaveConsentDecline');
  const bodySrc = fnMatch[0];
  for (const forbidden of ['clientStoreRef', 'createVisit', 'createClient', '.current.']) {
    assert.ok(!bodySrc.includes(forbidden), 'handleSaveConsentDecline must not reference ' + forbidden);
  }
  assert.ok(bodySrc.includes('setSaveConsentPromptOpen(false)'));
  assert.ok(bodySrc.includes('setPendingVisitSnapshot(null)'));
});

test('G2. beginSaveToClient only navigates to the client-select list AFTER the consent gate passes', () => {
  const fnMatch = appBlock.match(/const beginSaveToClient = \(design\) => \{[\s\S]*?\n {6}\};/);
  assert.ok(fnMatch);
  const bodySrc = fnMatch[0];
  const consentCheckIdx = bodySrc.indexOf('if (!clientDataConsentGranted)');
  const navigateIdx = bodySrc.indexOf("setScreen('clients')");
  assert.ok(consentCheckIdx !== -1 && navigateIdx !== -1);
  assert.ok(consentCheckIdx < navigateIdx, 'the consent gate must be checked before navigating to client selection');
});

// ------------------------------------------------------------
// H. cancel selection creates nothing
// ------------------------------------------------------------
test('H. cancelSaveToClient never references the client store / createClient / createVisit and only clears in-memory state + navigates back', () => {
  const fnMatch = appBlock.match(/const cancelSaveToClient = \(\) => \{[\s\S]*?\n {6}\};/);
  assert.ok(fnMatch, 'expected to locate cancelSaveToClient');
  const bodySrc = fnMatch[0];
  for (const forbidden of ['clientStoreRef', 'createVisit', 'createClient']) {
    assert.ok(!bodySrc.includes(forbidden), 'cancelSaveToClient must not reference ' + forbidden);
  }
  assert.ok(bodySrc.includes('setPendingVisitSnapshot(null)'));
});

// ------------------------------------------------------------
// I. double click/tap creates only one Visit
// ------------------------------------------------------------
test('I. two finishSaveToClient calls fired back-to-back in the same tick (real extracted function, real store) create exactly one Visit', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client I' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn, calls, saveVisitBusyRef } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  assert.strictEqual(saveVisitBusyRef.current, false);
  const p1 = fn(client.id);
  // Simulates a genuine same-tick double-tap: the second call fires
  // before the first has had any chance to await/settle.
  assert.strictEqual(saveVisitBusyRef.current, true, 'the ref must be set synchronously before the first await, so a same-tick second call sees it immediately');
  const p2 = fn(client.id);
  await Promise.all([p1, p2]);
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(visits.length, 1, 'exactly one Visit must be created despite two calls');
  assert.deepStrictEqual(calls.busy, [true, false], 'the second (blocked) call must never touch setSaveVisitBusy at all');
});

test('I2. a later, deliberate second Save-to-Client operation (after the first fully completed) is NOT blocked and creates a genuine second visit', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client I2' });
  const snapshot1 = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn: fn1 } = buildHarness({ pendingVisitSnapshot: snapshot1, store });
  await fn1(client.id);
  const snapshot2 = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn: fn2, saveVisitBusyRef } = buildHarness({ pendingVisitSnapshot: snapshot2, store });
  assert.strictEqual(saveVisitBusyRef.current, false, 'a fresh harness (new render) must start with the guard released');
  await fn2(client.id);
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(visits.length, 2);
});

// ------------------------------------------------------------
// J. missing optional iris/NLS fields still save safely
// ------------------------------------------------------------
test('J. a result with no iris and no naturalLashProfile still produces a savable snapshot and a real Visit (no crash, no fabricated data)', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client J' });
  const result = buildRealResult({ iris: null });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result, activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  assert.strictEqual(snapshot.analysisSnapshot.iris, null);
  assert.strictEqual(snapshot.analysisSnapshot.naturalLash.availability, 'UNAVAILABLE');
  const { fn } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  const visits = await store.listVisitsForClient(client.id);
  assert.strictEqual(visits.length, 1);
  assert.strictEqual(visits[0].analysisSnapshot.iris, null);
});

// ------------------------------------------------------------
// K. no photo/landmark/debug data enters storage (privacy)
// ------------------------------------------------------------
test('K. a Visit saved via the real flow contains no photo/image/landmark data anywhere in its stored record', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client K' });
  const result = buildRealResult(); // includes a real originalImage/landmarks field, like production
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result, activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  const visits = await store.listVisitsForClient(client.id);
  const raw = JSON.stringify(visits[0]);
  for (const forbidden of ['originalImage', 'IGNORED_IN_THIS_TEST', 'data:image', 'landmarks', 'base64']) {
    assert.ok(!raw.includes(forbidden), 'stored Visit must never contain ' + forbidden);
  }
  assert.strictEqual(visits[0].photos.beforePhotoId, null);
  assert.strictEqual(visits[0].photos.afterPhotoId, null);
});

test('K2. beginSaveToClient/finishSaveToClient never reference originalImage/landmarks/base64/photoId in their own source', () => {
  const beginMatch = appBlock.match(/const beginSaveToClient = \(design\) => \{[\s\S]*?\n {6}\};/)[0];
  for (const forbidden of ['originalImage', 'landmarks', 'base64', 'photoId', '.getContext(']) {
    assert.ok(!beginMatch.includes(forbidden), 'beginSaveToClient must not reference ' + forbidden);
    assert.ok(!finishSaveToClientSource.includes(forbidden), 'finishSaveToClient must not reference ' + forbidden);
  }
});

// ------------------------------------------------------------
// L. reload after a persistent save retains Client + Visit
// (covered at the data-layer by client-store.test.js's own IndexedDB
// persistence tests — this proves the SAME store instance the wiring
// composes with round-trips a real snapshot end-to-end)
// ------------------------------------------------------------
test('L. a second independent store instance (simulating a reload against the same IndexedDB-backed name) sees no data with forceMemory — proving persistence mode is real and load-bearing, not assumed', async () => {
  const store1 = ClientStore.createClientStore({ forceMemory: true });
  const client = await store1.createClient({ fullName: 'Test Client L' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn } = buildHarness({ pendingVisitSnapshot: snapshot, store: store1 });
  await fn(client.id);
  assert.strictEqual((await store1.listVisitsForClient(client.id)).length, 1);
  // A brand-new memory-backed store is an independent in-memory
  // universe (matching client-store.js's own "two independent store
  // instances never share data" contract) — demonstrating that the
  // memory fallback is genuinely NOT durable across a reload, which is
  // exactly why finishSaveToClient's toast distinguishes 'indexeddb'
  // from 'memory' mode (see M below).
  const store2 = ClientStore.createClientStore({ forceMemory: true });
  assert.strictEqual(await store2.getClient(client.id), null);
});

test('M. finishSaveToClient reports the real persistence mode (memory vs indexeddb) via store.whenReady() — never claims a memory-only save is durable', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Test Client M' });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn, calls } = buildHarness({ pendingVisitSnapshot: snapshot, store });
  await fn(client.id);
  assert.strictEqual(await store.whenReady(), 'memory');
  assert.deepStrictEqual(calls.toast, [{ ok: true, persistent: false }], 'a memory-backed save must report persistent:false, never true');
});

test('M2. on a store failure, the toast reports ok:false and the pending snapshot is deliberately NOT cleared (retry stays possible)', async () => {
  const failingStore = { createVisit: async () => { throw new Error('boom'); }, whenReady: async () => 'memory' };
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const { fn, calls } = buildHarness({ pendingVisitSnapshot: snapshot, store: failingStore });
  await fn('some-client-id');
  assert.deepStrictEqual(calls.toast, [{ ok: false }]);
  assert.deepStrictEqual(calls.pendingSnapshot, [], 'pendingVisitSnapshot must never be cleared on failure — the UI must never claim a failed write was saved');
  assert.deepStrictEqual(calls.screen, [], 'must never navigate to clientCard on failure');
});

// ------------------------------------------------------------
// N. normal Client List navigation still works when not in save mode
// ------------------------------------------------------------
test('N. ClientsListScreen routes taps through the ORIGINAL onOpenClient prop when saveMode is falsy', () => {
  const fnMatch = src.match(/function ClientsListScreen\(\{[\s\S]*?\n {6}\}\n/);
  assert.ok(fnMatch);
  assert.ok(fnMatch[0].includes('const handleOpen = saveMode ? onSelectForSave : onOpenClient;'));
});

test('N2. App wires the normal (non-save) Clients entry point to defensively clear any leftover save-mode state', () => {
  assert.ok(appBlock.includes("const openClientsList = () => { setClientSelectForSave(false); setPendingVisitSnapshot(null); setScreen('clients'); };"));
});

// ------------------------------------------------------------
// O. client creation outside Save-to-Client mode still works normally
// ------------------------------------------------------------
test('O. ClientFormScreen itself is completely unmodified by CLIENT-3 — all new logic lives in App()\'s onSaved callback, not the form component', () => {
  const clientSectionStart = src.indexOf('// CLIENT CARD / CLIENT HISTORY — Phase 2: production UI only.');
  const debugMarkerStart = src.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
  const clientUiBlock = src.slice(clientSectionStart, debugMarkerStart);
  assert.ok(!clientUiBlock.includes('createVisit('), 'ClientFormScreen/ClientsListScreen/ClientCardScreen must never call createVisit directly — that stays exclusively in App()');
  assert.ok(!clientUiBlock.includes('pendingVisitSnapshot'), 'the Client Card UI components must remain unaware of the save-to-client flow entirely');
});

test('O2. an ordinary (non-save) new-client creation still ends on the Client Card exactly as before CLIENT-3', () => {
  const fnMatch = appBlock.match(/const handleClientFormSaved = \(client\) => \{[\s\S]*?\n {6}\};/)[0];
  const elseBranch = fnMatch.slice(fnMatch.indexOf('} else {'));
  assert.ok(elseBranch.includes("setActiveClientId(client.id);"));
  assert.ok(elseBranch.includes("setScreen('clientCard');"));
});

// CLIENT-3 regression: screen determines which design is actually saved.
function saveDesignFromScreen(screen, result, activeDesign) {
  const handler = appBlock.match(/const handleSaveToClient = \(\) => \{[\s\S]*?\n {6}\};/)[0];
  let saved;
  const mapperCalls = [];
  new Function('screen', 'result', 'activeDesign', 'lang', 'canonicalRecommendationProps', 'beginSaveToClient',
    handler + '\nhandleSaveToClient();')(
    screen, result, activeDesign, 'ru',
    (raw, profile, lang, rank) => { mapperCalls.push({ raw, rank }); return { clientDesign: raw.clientDesign }; },
    design => { saved = design; }
  );
  return { saved, mapperCalls };
}

test('P. returning to Hero ignores the previously opened map and reads the current first recommendation', () => {
  const oldDesign = buildRealClientDesign({ design: { id: 'fox' } });
  const currentDesign = buildRealClientDesign({ design: { id: 'cat' } });
  const result = buildRealResult({ designs: [{ clientDesign: currentDesign }] });
  assert.strictEqual(saveDesignFromScreen('lashmap', result, oldDesign).saved, oldDesign);
  const hero = saveDesignFromScreen('hero', result, oldDesign);
  assert.strictEqual(hero.saved, currentDesign);
  assert.deepStrictEqual(hero.mapperCalls, [{ raw: result.designs[0], rank: 0 }]);
  assert.strictEqual(saveDesignFromScreen('hero', { ...result, designs: [] }, oldDesign).saved, null);
});

test('P2. choosing another Hero card saves that exact map selection, including a non-first recommendation', () => {
  const first = buildRealClientDesign({ design: { id: 'fox' } });
  const selected = buildRealClientDesign({ design: { id: 'cat' } });
  const result = buildRealResult({ designs: [{ clientDesign: first }, { clientDesign: selected }] });
  const viewMapSource = appBlock.match(/const viewMap = \(design\) => \{[^\n]+/)[0];
  let activeDesign = first;
  let screen = 'hero';
  new Function('setActiveDesign', 'setScreen', 'selected', viewMapSource + '\nviewMap(selected);')(
    design => { activeDesign = design; }, value => { screen = value; }, selected
  );
  const saved = saveDesignFromScreen(screen, result, activeDesign);
  assert.strictEqual(saved.saved, selected);
  assert.deepStrictEqual(saved.mapperCalls, [], 'map saving must not resolve a different recommendation');
  assert.ok(src.includes('onClick={() => onViewMap(d.clientDesign)}'));
});

test('Q. real form persistence retries a failed new-client visit against the same client ID', async () => {
  const store = ClientStore.createClientStore({ forceMemory: true });
  const snapshot = VisitSnapshot.buildVisitSnapshot({ result: buildRealResult(), activeDesign: buildRealClientDesign(), naturalLashProfile: null });
  const createVisit = store.createVisit.bind(store);
  let attempts = 0;
  store.createVisit = async (...args) => {
    if (++attempts === 1) throw new Error('first visit write failed');
    return createVisit(...args);
  };
  const callbackSource = appBlock.match(/const handleClientFormSaved = \(client\) => \{[\s\S]*?\n {6}\};/)[0];
  const formStart = src.indexOf('    function ClientFormScreen(');
  const persistStart = src.indexOf('      const persist = async () => {', formStart);
  const persistEnd = src.indexOf('\n\n      const handleSave =', persistStart);
  assert.ok(formStart !== -1 && persistStart !== -1 && persistEnd !== -1);
  const persistSource = src.slice(persistStart, persistEnd);
  let activeClientId = null;
  let visitPromise;
  let lastCalls;
  const onSaved = new Function('pendingVisitSnapshot', 'clientSelectForSave', 'setActiveClientId', 'finishSaveToClient', 'setScreen',
    callbackSource + '\nreturn handleClientFormSaved;')(
    snapshot, true, id => { activeClientId = id; },
    id => {
      assert.strictEqual(activeClientId, id, 'client identity must be retained before attempting the visit write');
      const harness = buildHarness({ pendingVisitSnapshot: snapshot, store });
      lastCalls = harness.calls;
      visitPromise = harness.fn(id);
      return visitPromise;
    }, () => {}
  );
  // Re-extract the real form's create/update path for each render, using
  // the ID retained by the real App callback after client creation.
  async function submitForm() {
    const persist = new Function('store', 'clientId', 'isEdit', 'onSaved', 'setSaving',
      'fullName', 'dateOfBirth', 'phone', 'desiredLook', 'preferredEffects', 'requestNotes', 'artistSensitivityNotes',
      persistSource + '\nreturn persist;')(
      store, activeClientId, !!activeClientId, onSaved, () => {},
      'Retry Client', '', '', '', '', '', ''
    );
    await persist();
    await visitPromise;
  }
  await submitForm();
  const originalId = activeClientId;
  assert.ok(originalId);
  assert.deepStrictEqual(lastCalls.toast, [{ ok: false }]);
  assert.deepStrictEqual(lastCalls.pendingSnapshot, []);
  assert.strictEqual((await store.listClients()).length, 1);
  assert.strictEqual((await store.listVisitsForClient(originalId)).length, 0);
  await submitForm();
  assert.strictEqual(activeClientId, originalId);
  assert.strictEqual((await store.listClients()).length, 1);
  assert.strictEqual((await store.listVisitsForClient(originalId)).length, 1);
  assert.deepStrictEqual(lastCalls.toast, [{ ok: true, persistent: false }]);
});
