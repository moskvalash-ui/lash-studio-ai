'use strict';
// ============================================================
// CLIENT CARD UI — Phase 2 tests.
// index.html's app script is JSX, transpiled only via Babel Standalone
// in the browser — there is no @babel/core hard dependency in this
// repo (see pro-library-preview-ui.test.js's own test #17 for the same
// constraint), so JSX-heavy screens are verified the same way that
// file verifies ProLibraryPreviewScreen/ProLibraryDetailScreen:
// structural/string assertions against the real source, plus direct
// extraction+eval of the plain-JS (non-JSX) helper functions this
// phase adds, evaluated against the real ClientStore module — not a
// reimplementation.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ClientStore = require(path.join(root, 'client-store.js'));
const digest = (value) => require('node:crypto').createHash('sha256').update(value).digest('hex');

const appStart = indexSource.indexOf('function App() {');
const clientSectionStart = indexSource.indexOf('// CLIENT CARD / CLIENT HISTORY — Phase 2: production UI only.');
const debugMarkerStart = indexSource.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
const clientUiBlock = indexSource.slice(clientSectionStart, debugMarkerStart);
const appBlock = indexSource.slice(appStart);

function extractObjectLiteral(name) {
  const start = indexSource.indexOf('const ' + name + ' = {');
  const braceStart = indexSource.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < indexSource.length; i++) {
    if (indexSource[i] === '{') depth++;
    else if (indexSource[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + indexSource.slice(braceStart, i + 1))();
}

// Extracts and evals the plain-JS (non-JSX) helpers this phase adds —
// formatClientAge/formatClientDate — the exact functions the browser
// runs, not a reimplementation. Mirrors loadComposer() in
// pro-library-preview-ui.test.js.
function loadClientHelpers() {
  const start = indexSource.indexOf('function formatClientAge');
  const end = indexSource.indexOf('const CLIENT_INPUT_CLASS');
  const code = indexSource.slice(start, end) + '\nreturn { formatClientAge, formatClientDate };';
  const fn = new Function(code);
  return fn();
}
const helpers = loadClientHelpers();

test('script loading: client-store.js and client-data-consent.js load as plain <script> tags before the main app script', () => {
  const storeTagIdx = indexSource.indexOf('<script src="client-store.js"></script>');
  const consentTagIdx = indexSource.indexOf('<script src="client-data-consent.js"></script>');
  const appScriptIdx = indexSource.indexOf('<script type="text/babel">');
  assert.ok(storeTagIdx !== -1);
  assert.ok(consentTagIdx !== -1);
  assert.ok(storeTagIdx < appScriptIdx);
  assert.ok(consentTagIdx < appScriptIdx);
});

// ------------------------------------------------------------
// 1. Clients screen exists, reachable from the normal app UI
// ------------------------------------------------------------
test('Clients screen exists and is reachable from HomeScreen via a normal production button', () => {
  assert.ok(clientUiBlock.includes('function ClientsListScreen('));
  assert.ok(indexSource.includes('onClick={onClients}'), 'HomeScreen must expose a Clients entry point');
  assert.ok(appBlock.includes("onClients={openClientsList}"));
  assert.ok(appBlock.includes("screen === 'clients' && <ClientsListScreen"));
});

test('the debug-only ?debug=library route is untouched by this phase and remains fully separate from the Clients feature', () => {
  assert.ok(indexSource.includes("get('debug') === 'library' ? 'proLibraryPreview' : 'home'"));
  assert.ok(!clientUiBlock.includes('proLibraryPreview'));
  assert.ok(!clientUiBlock.includes('ProfessionalLashLibrary'));
});

// ------------------------------------------------------------
// 2. Create / edit client
// ------------------------------------------------------------
test('ClientFormScreen supports both create (no clientId) and edit (clientId set) via the same component', () => {
  assert.ok(clientUiBlock.includes('function ClientFormScreen('));
  assert.ok(clientUiBlock.includes('const isEdit = !!clientId;'));
  assert.ok(clientUiBlock.includes('store.updateClient(clientId, payload)'));
  assert.ok(clientUiBlock.includes('store.createClient(payload)'));
});

test('the create-client form requires a full name before saving', () => {
  assert.ok(clientUiBlock.includes("if (!fullName.trim()) { setError(true); return; }"));
});

test('App wires create vs edit navigation without a separate id namespace: activeClientId null=create, set=edit', () => {
  assert.ok(appBlock.includes('const openNewClientForm = () => { setActiveClientId(null); setScreen(\'clientForm\'); };'));
  assert.ok(appBlock.includes('const openEditClientForm = (id) => { setActiveClientId(id); setScreen(\'clientForm\'); };'));
});

// ------------------------------------------------------------
// 3. DOB -> computed age, and age is never persisted
// ------------------------------------------------------------
test('formatClientAge computes correct RU numeral agreement and a compact EN form (real function, not reimplemented)', () => {
  assert.strictEqual(helpers.formatClientAge(21, 'ru'), '21 год');
  assert.strictEqual(helpers.formatClientAge(22, 'ru'), '22 года');
  assert.strictEqual(helpers.formatClientAge(25, 'ru'), '25 лет');
  assert.strictEqual(helpers.formatClientAge(11, 'ru'), '11 лет', 'the 11-14 exception must override the mod-10 rule');
  assert.strictEqual(helpers.formatClientAge(31, 'en'), '31 y.o.');
  assert.strictEqual(helpers.formatClientAge(null, 'ru'), null);
});

test('the UI never stores an age field: it only ever calls ClientStore.calculateAge(dateOfBirth) at render time', () => {
  assert.ok(clientUiBlock.includes('ClientStore.calculateAge(dateOfBirth)') || clientUiBlock.includes('ClientStore.calculateAge(client.dateOfBirth)'));
  // Forbids a property assignment like `foo.age = value` (a dot right
  // before "age"). Local derived variables such as `const age = ...`
  // are legitimate and intentionally NOT matched (no dot precedes
  // them); `age === value` comparisons are excluded via the
  // negative lookahead so they never false-positive as assignments.
  assert.ok(!/\.age\s*=(?!=)/.test(clientUiBlock), 'no `.age = value` property assignment should exist — age must always be derived, never stored');
});

test('createClient/updateClient payloads built by the form never include an age field, matching the Phase 1 schema', () => {
  const client = require(path.join(root, 'client-store.js')).createMemoryAdapter; // sanity: module resolves
  assert.ok(typeof client === 'function');
  // Cross-check against the real schema: age is not a valid/expected field.
  const formPayloadFieldsMatch = clientUiBlock.match(/const payload = \{[\s\S]*?\};/);
  assert.ok(formPayloadFieldsMatch, 'expected a payload object literal in ClientFormScreen.persist()');
  assert.ok(!/\bage\s*:/.test(formPayloadFieldsMatch[0]), 'the saved payload must never include an age field');
});

// ------------------------------------------------------------
// 4. Search
// ------------------------------------------------------------
test('ClientsListScreen filters by client full name (case-insensitive)', () => {
  assert.ok(clientUiBlock.includes('r.client.fullName.toLowerCase().includes(query.trim().toLowerCase())'));
});

// ------------------------------------------------------------
// 5. Empty states
// ------------------------------------------------------------
test('empty states exist for: no clients yet, no search results, and no visit history', () => {
  for (const key of ['clientsEmptyTitle', 'clientsEmptyBody', 'clientsNoResults', 'clientCardHistoryEmpty']) {
    assert.ok(clientUiBlock.includes("t('" + key + "', lang)"), 'missing empty-state usage for ' + key);
  }
});

// CLIENT-4 supersedes the old Phase-2 assumption ("visit saving is a
// later phase") this test used to pin down: the Visit History section
// now renders real saved visits when present, and the true empty state
// ONLY when store.listVisitsForClient(clientId) resolved zero visits —
// see VisitHistoryCard/ClientCardScreen below. ClientCardScreen/
// ClientsListScreen/ClientFormScreen themselves still never call
// createVisit directly (that stays exclusively in App(), proven by
// save-to-client-flow.test.js's own test O).
test("Client Card's Visit History section renders real saved visits when present, and the true empty state only when there are none", () => {
  assert.ok(clientUiBlock.includes('visits.length === 0'), 'expected a real conditional between the empty state and the real visit list');
  assert.ok(clientUiBlock.includes("t('clientCardHistoryEmpty', lang)"));
  assert.ok(clientUiBlock.includes('visits.map(v => <VisitHistoryCard'), 'expected the real visits array to be rendered, not a second always-empty placeholder');
  assert.ok(!clientUiBlock.includes('createVisit('), 'ClientCardScreen/ClientsListScreen/ClientFormScreen must never call store.createVisit — that stays exclusively in App()');
});

test('"New Visit" is visually present but structurally disconnected from scan/result state', () => {
  assert.ok(clientUiBlock.includes("t('clientCardNewVisit', lang)"));
  assert.ok(clientUiBlock.includes('disabled') , 'the button must be presented as not-yet-active');
  for (const forbidden of ['setScreen(\'scan\'', 'setScreen("scan"', 'setResult(', 'handleComplete', 'onNewVisit']) {
    assert.ok(!clientUiBlock.includes(forbidden), 'New Visit must not reference ' + forbidden);
  }
});

// ------------------------------------------------------------
// 6. Consent required before persistence
// ------------------------------------------------------------
test('a NEW client is never persisted before explicit client-data consent; editing an existing client never re-prompts', () => {
  assert.ok(clientUiBlock.includes('if (!isEdit && !consentGranted) { setConsentPromptOpen(true); return; }'));
  assert.ok(clientUiBlock.includes('function ClientDataConsentPrompt('));
});

test('client-data consent is read/written exclusively through window.ClientDataConsent, never through window.ConsentManager (analytics)', () => {
  assert.ok(appBlock.includes('ClientDataConsent.isClientDataAllowed'));
  assert.ok(appBlock.includes('ClientDataConsent.setConsent'));
  assert.ok(!appBlock.includes('ConsentManager.setConsent(consentStorageRef') || appBlock.includes('grantClientDataConsent'), 'client consent grant must be its own function, not reusing the analytics consent setter');
  const grantFnMatch = appBlock.match(/const grantClientDataConsent = \(\) => \{[\s\S]*?\};/);
  assert.ok(grantFnMatch, 'expected a dedicated grantClientDataConsent function');
  assert.ok(!grantFnMatch[0].includes('ConsentManager'), 'granting client-data consent must never touch the analytics ConsentManager');
});

test('consent-manager.js and analytics.js remain byte-identical — this phase never modifies existing analytics consent logic', () => {
  for (const file of ['consent-manager.js', 'analytics.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

// ------------------------------------------------------------
// 7. Delete client
// ------------------------------------------------------------
test('ClientCardScreen supports full client deletion with an explicit confirmation step', () => {
  assert.ok(clientUiBlock.includes('await store.deleteClient(clientId)'));
  assert.ok(clientUiBlock.includes("t('clientCardDeleteConfirmTitle', lang)"));
  assert.ok(clientUiBlock.includes("t('clientCardDeleteConfirmBody', lang)"));
  assert.ok(clientUiBlock.includes('deleteConfirmOpen'));
});

// ------------------------------------------------------------
// 8. RU/EN copy
// ------------------------------------------------------------
test('every new client-facing STRINGS key has both a non-empty ru and en value', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const clientKeys = Object.keys(STRINGS).filter(k => k.startsWith('client'));
  assert.ok(clientKeys.length >= 40, 'expected a substantial set of client-facing strings, found ' + clientKeys.length);
  for (const key of clientKeys) {
    assert.ok(STRINGS[key].ru && STRINGS[key].ru.trim().length > 0, key + ' missing RU text');
    assert.ok(STRINGS[key].en && STRINGS[key].en.trim().length > 0, key + ' missing EN text');
  }
});

test('RU remains the default UI language, unaffected by this phase', () => {
  assert.ok(indexSource.includes("localStorage.getItem('lashStudioLang') || 'ru'"));
});

// ------------------------------------------------------------
// 9. No raw technical enums/property names visible in UI copy
// ------------------------------------------------------------
test('no raw schema/property identifiers (ClientVisit, dateOfBirth, desiredLook, preferredEffects, requestNotes, artistSensitivityNotes) leak into any client-facing RU/EN string', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const banned = /ClientVisit|dateOfBirth|desiredLook|preferredEffects|artistSensitivityNotes|requestNotes|fullName|photoId/;
  for (const key of Object.keys(STRINGS).filter(k => k.startsWith('client'))) {
    assert.ok(!banned.test(STRINGS[key].ru), key + '.ru leaks a raw property/schema name: ' + STRINGS[key].ru);
    assert.ok(!banned.test(STRINGS[key].en), key + '.en leaks a raw property/schema name: ' + STRINGS[key].en);
  }
});

test('no raw enum-style SCREAMING_SNAKE token or CLIENT_SCHEMA_VERSION/VISIT_SCHEMA_VERSION ever appears in client-facing string values', () => {
  const STRINGS = extractObjectLiteral('STRINGS');
  const forbiddenTokens = /^[A-Z0-9]+(_[A-Z0-9]+)*$/;
  for (const key of Object.keys(STRINGS).filter(k => k.startsWith('client'))) {
    assert.ok(!forbiddenTokens.test(STRINGS[key].ru.trim()), key + '.ru is a raw enum token');
    assert.ok(!forbiddenTokens.test(STRINGS[key].en.trim()), key + '.en is a raw enum token');
  }
});

// ------------------------------------------------------------
// 10. Production isolation
// ------------------------------------------------------------
function stripLineComments(s) {
  return s.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}

test('the new Client UI code never calls production ranking/scan/library functions in actual code (comments may name them for documentation)', () => {
  const clientUiCode = stripLineComments(clientUiBlock);
  const forbidden = ['rankDesigns(', 'rankDesignsAll(', 'calculateEyeLashMap(', 'DESIGN_CATALOG', 'ProfessionalLashLibrary.', 'getUserMedia(', 'activation.'];
  for (const token of forbidden) assert.ok(!clientUiCode.includes(token), 'Client UI must not reference ' + token);
});

test('backend/worker.js, consent-manager.js, and analytics.js remain byte-identical to committed HEAD', () => {
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('production activation flags stay inert: productionEnabled false, activeDefinitionIds empty', () => {
  const Library = require(path.join(root, 'professional-lash-library.js'));
  assert.strictEqual(Library.library.activation.productionEnabled, false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds, []);
});

test('the debug-only Pro Library preview span is untouched by this phase: no <input>, textarea, or client-form controls exist in it', () => {
  const previewStart = indexSource.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
  const previewBlock = indexSource.slice(previewStart, appStart);
  assert.ok(!previewBlock.includes('<input'));
  assert.ok(!previewBlock.includes('<textarea'));
  assert.ok(!previewBlock.includes('ClientFormScreen'));
  assert.ok(!previewBlock.includes('ClientsListScreen'));
  assert.ok(!previewBlock.includes('ClientCardScreen'));
});

test('Babel/JSX parse of the full app script, when @babel/core is available locally', (t) => {
  let babel;
  try { babel = require('@babel/core'); } catch (e) { babel = null; }
  if (!babel) {
    t.skip('@babel/core is not an installed dependency of this repo; full Babel parse verification is performed manually per phase (see implementation report) rather than as a hard CI dependency.');
    return;
  }
  const marker = '<script type="text/babel">';
  const start = indexSource.indexOf(marker) + marker.length;
  const end = indexSource.indexOf('</script>', start);
  const script = indexSource.slice(start, end);
  assert.doesNotThrow(() => babel.transformSync(script, { presets: [require.resolve('@babel/preset-react')], filename: 'app.jsx' }));
});
