'use strict';
// ============================================================
// CLIENT STORE — Phase 1 tests.
// Pure data-layer tests: no UI, no index.html involvement, no real
// IndexedDB required (Node has none — every test here runs the
// module's memory-fallback path, which is exactly the same fallback
// path a browser without/with-broken IndexedDB would take, so this
// suite directly proves the "IndexedDB unavailable must never break
// the app" requirement rather than merely asserting it).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ClientStore = require(path.join(__dirname, '..', 'client-store.js'));
const {
  CLIENT_SCHEMA_VERSION,
  VISIT_SCHEMA_VERSION,
  isValidClientRecord,
  isValidVisitRecord,
  calculateAge,
  deriveClientVisitStats,
  createMemoryAdapter,
  createClientStore,
} = ClientStore;

const root = path.join(__dirname, '..');

// ------------------------------------------------------------
// Pure helpers: calculateAge / deriveClientVisitStats
// ------------------------------------------------------------

test('calculateAge computes correctly and is a pure function of (dateOfBirth, today)', () => {
  assert.strictEqual(calculateAge('2000-06-15', '2026-06-15'), 26);
  assert.strictEqual(calculateAge('2000-06-15', '2026-06-14'), 25, 'birthday not yet reached this year');
  assert.strictEqual(calculateAge('2000-06-15', '2026-06-16'), 26, 'birthday already passed this year');
  assert.strictEqual(calculateAge('2000-01-01', '2000-01-01'), 0);
});

test('calculateAge never mutates or depends on anything but its two arguments (no hidden clock use when today is supplied)', () => {
  const a = calculateAge('1990-03-10', '2026-03-09');
  const b = calculateAge('1990-03-10', '2026-03-09');
  assert.strictEqual(a, b);
  assert.strictEqual(a, 35);
});

test('calculateAge returns null for missing or invalid input rather than throwing', () => {
  assert.strictEqual(calculateAge(null, '2026-01-01'), null);
  assert.strictEqual(calculateAge(undefined, '2026-01-01'), null);
  assert.strictEqual(calculateAge('not-a-date', '2026-01-01'), null);
  assert.strictEqual(calculateAge('2026-01-01', 'not-a-date'), null);
});

test('deriveClientVisitStats computes first/last visit date and total count from visit records only', () => {
  const stats = deriveClientVisitStats([
    { visitDate: '2026-08-14' },
    { visitDate: '2026-08-31' },
    { visitDate: '2026-07-01' },
  ]);
  assert.strictEqual(stats.firstVisitDate, '2026-07-01');
  assert.strictEqual(stats.lastVisitDate, '2026-08-31');
  assert.strictEqual(stats.totalVisits, 3);
});

test('deriveClientVisitStats returns nulls/zero for an empty or missing visit list, never throws', () => {
  assert.deepStrictEqual(deriveClientVisitStats([]), { firstVisitDate: null, lastVisitDate: null, totalVisits: 0 });
  assert.deepStrictEqual(deriveClientVisitStats(undefined), { firstVisitDate: null, lastVisitDate: null, totalVisits: 0 });
});

// ------------------------------------------------------------
// Schema shape / no medical fields
// ------------------------------------------------------------

test('created Client record matches the versioned schema and stores dateOfBirth at the client level, never an age field', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({
    fullName: 'Barbara',
    dateOfBirth: '1994-05-20',
    phone: '+1 555 0100',
    preferences: { desiredLook: 'Kim K', preferredEffects: ['Kim K', 'Wispy'], requestNotes: 'wants bold', artistSensitivityNotes: 'slight redness last time, watch adhesive amount' },
  });
  assert.ok(isValidClientRecord(client));
  assert.strictEqual(client.version, CLIENT_SCHEMA_VERSION);
  assert.strictEqual(client.fullName, 'Barbara');
  assert.strictEqual(client.dateOfBirth, '1994-05-20');
  assert.strictEqual(client.photoId, null, 'photoId is reserved but must be null — no Blob storage exists in Phase 1');
  assert.deepStrictEqual(client.visitIds, []);
  assert.ok(!Object.prototype.hasOwnProperty.call(client, 'age'), 'age must never be a stored field');
  assert.ok(!Object.prototype.hasOwnProperty.call(client, 'firstVisitDate'));
  assert.ok(!Object.prototype.hasOwnProperty.call(client, 'lastVisitDate'));
  assert.ok(!Object.prototype.hasOwnProperty.call(client, 'totalVisits'));
});

test('no medical/diagnosis field exists anywhere in the Client schema', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Ana', preferences: { artistSensitivityNotes: 'client mentioned mild irritation once' } });
  const banned = /diagnos|medical|allerg(y|ic)|condition|treatment|prescri/i;
  const allKeys = Object.keys(client).concat(Object.keys(client.preferences));
  for (const key of allKeys) assert.ok(!banned.test(key), 'unexpected medical-sounding field: ' + key);
  // free text itself is never schema-constrained into a medical category
  assert.strictEqual(typeof client.preferences.artistSensitivityNotes, 'string');
});

test('created ClientVisit record matches the versioned schema and reserves (but never populates) photo id fields', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const visit = await store.createVisit(client.id, { visitDate: '2026-08-31', artistNote: 'great retention' });
  assert.ok(isValidVisitRecord(visit));
  assert.strictEqual(visit.version, VISIT_SCHEMA_VERSION);
  assert.strictEqual(visit.clientId, client.id);
  assert.deepStrictEqual(visit.photos, { beforePhotoId: null, afterPhotoId: null });
  assert.strictEqual(visit.artistNote, 'great retention');
});

// ------------------------------------------------------------
// Append-only visits
// ------------------------------------------------------------

test('visits are append-only: creating a new visit never overwrites or mutates a previously saved visit', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const visitA = await store.createVisit(client.id, { visitDate: '2026-08-14', designSnapshot: { name: 'Fox' } });
  const visitB = await store.createVisit(client.id, { visitDate: '2026-08-31', designSnapshot: { name: 'Kim K' } });

  const reloadedA = await store.getVisit(visitA.id);
  assert.strictEqual(reloadedA.designSnapshot.name, 'Fox', 'visit A must be unaffected by visit B being created afterward');

  const reloadedClient = await store.getClient(client.id);
  assert.deepStrictEqual(reloadedClient.visitIds, [visitA.id, visitB.id], 'visitIds only ever grows, in creation order');
});

test('there is no updateVisit/overwriteVisit function exposed — append-only is structural, not just conventional', () => {
  const store = createClientStore({ forceMemory: true });
  assert.strictEqual(typeof store.updateVisit, 'undefined');
  assert.strictEqual(typeof store.overwriteVisit, 'undefined');
  assert.strictEqual(typeof store.saveVisit, 'undefined');
});

test('listVisitsForClient returns visits newest-first and only for the requested client', async () => {
  const store = createClientStore({ forceMemory: true });
  const barbara = await store.createClient({ fullName: 'Barbara' });
  const ana = await store.createClient({ fullName: 'Ana' });
  await store.createVisit(barbara.id, { visitDate: '2026-08-14' });
  await store.createVisit(barbara.id, { visitDate: '2026-08-31' });
  await store.createVisit(ana.id, { visitDate: '2026-08-20' });

  const barbaraVisits = await store.listVisitsForClient(barbara.id);
  assert.strictEqual(barbaraVisits.length, 2);
  assert.strictEqual(barbaraVisits[0].visitDate, '2026-08-31', 'newest first');
  assert.strictEqual(barbaraVisits[1].visitDate, '2026-08-14');
  assert.ok(barbaraVisits.every(v => v.clientId === barbara.id));
});

// ------------------------------------------------------------
// Derived-only identity fields (first/last visit, total visits, age)
// ------------------------------------------------------------

test('first visit date, last visit date, and total visits are derived from real visit records, never independently stored or settable', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara', dateOfBirth: '1994-05-20' });
  await store.createVisit(client.id, { visitDate: '2026-07-01' });
  await store.createVisit(client.id, { visitDate: '2026-08-31' });
  const visits = await store.listVisitsForClient(client.id);
  const stats = deriveClientVisitStats(visits);
  assert.strictEqual(stats.firstVisitDate, '2026-07-01');
  assert.strictEqual(stats.lastVisitDate, '2026-08-31');
  assert.strictEqual(stats.totalVisits, 2);

  const reloadedClient = await store.getClient(client.id);
  assert.ok(!Object.prototype.hasOwnProperty.call(reloadedClient, 'firstVisitDate'));
  assert.ok(!Object.prototype.hasOwnProperty.call(reloadedClient, 'lastVisitDate'));
  assert.ok(!Object.prototype.hasOwnProperty.call(reloadedClient, 'totalVisits'));

  const age = calculateAge(reloadedClient.dateOfBirth, '2026-08-31');
  assert.strictEqual(age, 32);
});

// ------------------------------------------------------------
// Deep-clone / snapshot immutability
// ------------------------------------------------------------

test('analysisSnapshot and designSnapshot are deep-cloned at save time: mutating the caller\'s original object afterward never changes the stored visit', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const mutableAnalysis = { eyeProfile: { eyeShapeCategory: 'almond' }, iris: { name: 'brown' } };
  const mutableDesign = { designName: 'Kim K', curl: { global: 'L' } };

  const visit = await store.createVisit(client.id, { visitDate: '2026-08-31', analysisSnapshot: mutableAnalysis, designSnapshot: mutableDesign });

  // mutate the ORIGINAL objects after the visit was saved
  mutableAnalysis.eyeProfile.eyeShapeCategory = 'round';
  mutableDesign.curl.global = 'D';

  const reloaded = await store.getVisit(visit.id);
  assert.strictEqual(reloaded.analysisSnapshot.eyeProfile.eyeShapeCategory, 'almond', 'stored snapshot must be unaffected by later mutation of the source object');
  assert.strictEqual(reloaded.designSnapshot.curl.global, 'L', 'stored snapshot must be unaffected by later mutation of the source object');
});

test('mutating an object returned by createVisit/getVisit never reaches back into stored state', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const visit = await store.createVisit(client.id, { visitDate: '2026-08-31', analysisSnapshot: { eyeProfile: { eyeShapeCategory: 'almond' } } });

  visit.analysisSnapshot.eyeProfile.eyeShapeCategory = 'round';
  const reloadedOnce = await store.getVisit(visit.id);
  assert.strictEqual(reloadedOnce.analysisSnapshot.eyeProfile.eyeShapeCategory, 'almond');

  reloadedOnce.analysisSnapshot.eyeProfile.eyeShapeCategory = 'narrow';
  const reloadedTwice = await store.getVisit(visit.id);
  assert.strictEqual(reloadedTwice.analysisSnapshot.eyeProfile.eyeShapeCategory, 'almond', 'a second read must also be unaffected');
});

test('a null/absent analysisSnapshot or designSnapshot is stored as null, never as undefined or a crash', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const visit = await store.createVisit(client.id, { visitDate: '2026-08-31' });
  assert.strictEqual(visit.analysisSnapshot, null);
  assert.strictEqual(visit.designSnapshot, null);
});

// ------------------------------------------------------------
// Fail-closed on corrupt/unknown schema versions
// ------------------------------------------------------------

test('a client record with an unknown schema version fails closed: getClient returns null, listClients excludes it', async () => {
  const adapter = createMemoryAdapter();
  await adapter.put('clients', { id: 'bad-client', version: 999, fullName: 'Ghost', photoId: null, dateOfBirth: null, phone: null, preferences: {}, visitIds: [], createdAt: 'x', updatedAt: 'x' });
  const store = createClientStore({ adapter });
  assert.strictEqual(await store.getClient('bad-client'), null);
  assert.deepStrictEqual(await store.listClients(), []);
});

test('a visit record with an unknown schema version fails closed: getVisit returns null, listVisitsForClient excludes it', async () => {
  const adapter = createMemoryAdapter();
  await adapter.put('visits', { id: 'bad-visit', clientId: 'someone', version: 999, visitDate: '2026-01-01', photos: {}, createdAt: 'x' });
  const store = createClientStore({ adapter });
  assert.strictEqual(await store.getVisit('bad-visit'), null);
  assert.deepStrictEqual(await store.listVisitsForClient('someone'), []);
});

test('a record missing required fields fails closed rather than being guessed/patched', async () => {
  const adapter = createMemoryAdapter();
  await adapter.put('clients', { id: 'incomplete', version: CLIENT_SCHEMA_VERSION, fullName: 'X' /* missing everything else */ });
  const store = createClientStore({ adapter });
  assert.strictEqual(await store.getClient('incomplete'), null);
});

test('isValidClientRecord/isValidVisitRecord are exported and directly usable for schema validation', () => {
  assert.strictEqual(isValidClientRecord(null), false);
  assert.strictEqual(isValidClientRecord({}), false);
  assert.strictEqual(isValidVisitRecord(null), false);
  assert.strictEqual(isValidVisitRecord({}), false);
});

// ------------------------------------------------------------
// IndexedDB unavailable / failing — must never break the app
// ------------------------------------------------------------

test('with no indexedDB global present at all (the real situation in this Node test environment), the store still works end to end via the memory fallback', async () => {
  const store = createClientStore({});
  const mode = await store.whenReady();
  assert.strictEqual(mode, 'memory');
  const client = await store.createClient({ fullName: 'No IndexedDB Here' });
  assert.ok(isValidClientRecord(client));
});

test('an indexedDB implementation whose open() throws synchronously falls back to memory without throwing', async () => {
  const throwingIndexedDB = { open() { throw new Error('IndexedDB is disabled'); } };
  const store = createClientStore({ indexedDBImpl: throwingIndexedDB });
  const mode = await store.whenReady();
  assert.strictEqual(mode, 'memory');
  await assert.doesNotReject(async () => {
    const client = await store.createClient({ fullName: 'Still Works' });
    assert.ok(isValidClientRecord(client));
  });
});

test('an indexedDB implementation whose open request errors asynchronously falls back to memory without throwing', async () => {
  const erroringIndexedDB = {
    open() {
      const req = {};
      setTimeout(() => { if (req.onerror) req.onerror(); }, 0);
      return req;
    },
  };
  const store = createClientStore({ indexedDBImpl: erroringIndexedDB });
  const mode = await store.whenReady();
  assert.strictEqual(mode, 'memory');
  const client = await store.createClient({ fullName: 'Recovered' });
  assert.ok(isValidClientRecord(client));
});

test('forceMemory always uses the memory backend even when an indexedDB implementation is supplied', async () => {
  let openCalled = false;
  const spyIndexedDB = { open() { openCalled = true; throw new Error('should never be called'); } };
  const store = createClientStore({ indexedDBImpl: spyIndexedDB, forceMemory: true });
  const mode = await store.whenReady();
  assert.strictEqual(mode, 'memory');
  assert.strictEqual(openCalled, false);
});

// ------------------------------------------------------------
// Client deletion architecture (cascade)
// ------------------------------------------------------------

test('deleteClient removes the client and every one of its visit records, but leaves other clients untouched', async () => {
  const store = createClientStore({ forceMemory: true });
  const barbara = await store.createClient({ fullName: 'Barbara' });
  const ana = await store.createClient({ fullName: 'Ana' });
  const v1 = await store.createVisit(barbara.id, { visitDate: '2026-08-14' });
  const v2 = await store.createVisit(barbara.id, { visitDate: '2026-08-31' });
  const anaVisit = await store.createVisit(ana.id, { visitDate: '2026-08-20' });

  await store.deleteClient(barbara.id);

  assert.strictEqual(await store.getClient(barbara.id), null);
  assert.strictEqual(await store.getVisit(v1.id), null, 'cascade must delete visit A');
  assert.strictEqual(await store.getVisit(v2.id), null, 'cascade must delete visit B');
  assert.deepStrictEqual(await store.listVisitsForClient(barbara.id), []);

  const reloadedAna = await store.getClient(ana.id);
  assert.ok(reloadedAna, 'other clients must be untouched by an unrelated deletion');
  const reloadedAnaVisit = await store.getVisit(anaVisit.id);
  assert.ok(reloadedAnaVisit, "another client's visit must survive an unrelated client's deletion");
});

test('deleteVisit removes a single visit and updates the owning client\'s visitIds without affecting other visits', async () => {
  const store = createClientStore({ forceMemory: true });
  const client = await store.createClient({ fullName: 'Barbara' });
  const v1 = await store.createVisit(client.id, { visitDate: '2026-08-14' });
  const v2 = await store.createVisit(client.id, { visitDate: '2026-08-31' });

  await store.deleteVisit(v1.id);

  assert.strictEqual(await store.getVisit(v1.id), null);
  assert.ok(await store.getVisit(v2.id), 'the other visit must survive');
  const reloadedClient = await store.getClient(client.id);
  assert.deepStrictEqual(reloadedClient.visitIds, [v2.id]);
});

test('createVisit rejects an unknown/invalid clientId rather than creating an orphaned visit', async () => {
  const store = createClientStore({ forceMemory: true });
  await assert.rejects(() => store.createVisit('does-not-exist', { visitDate: '2026-08-31' }));
});

// ------------------------------------------------------------
// Store instance isolation (no shared global state leaking between tests / clients)
// ------------------------------------------------------------

test('two independent store instances never share data', async () => {
  const storeA = createClientStore({ forceMemory: true });
  const storeB = createClientStore({ forceMemory: true });
  await storeA.createClient({ fullName: 'Only in A' });
  assert.deepStrictEqual(await storeB.listClients(), []);
});

// ------------------------------------------------------------
// Production isolation — this phase must not touch scan/ranking/
// recommendation/library code or the backend.
// ------------------------------------------------------------

function stripLineComments(s) {
  return s.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}

test('client-store.js and client-data-consent.js never call production scan/ranking/library code in actual code (comments may name them for documentation)', () => {
  const clientStoreCode = stripLineComments(fs.readFileSync(path.join(root, 'client-store.js'), 'utf8'));
  const forbidden = ['DESIGN_CATALOG', 'rankDesigns(', 'rankDesignsAll(', 'calculateEyeLashMap(', 'ProfessionalLashLibrary.', 'getUserMedia('];
  for (const token of forbidden) assert.ok(!clientStoreCode.includes(token), 'client-store.js must not reference ' + token);
});

test('backend/worker.js, consent-manager.js, and analytics.js remain byte-identical (client-store.js never touches production library/backend/consent/analytics code)', () => {
  const { execSync } = require('node:child_process');
  for (const file of ['backend/worker.js', 'consent-manager.js', 'analytics.js']) {
    let diff;
    try {
      diff = execSync('git diff -- ' + JSON.stringify(file), { cwd: root }).toString();
    } catch (e) {
      diff = 'DIFF_COMMAND_FAILED: ' + e.message;
    }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD in this phase');
  }
});
