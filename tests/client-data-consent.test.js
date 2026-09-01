'use strict';
// ============================================================
// CLIENT DATA CONSENT — Phase 1 tests.
// Proves: this consent is completely separate from analytics consent
// (own storage key, own module, no cross-reference), defaults to OFF
// (fail closed) until an explicit opt-in, survives corrupt/unknown-
// version storage without throwing or guessing, and never touches the
// pre-existing essential keys or consent-manager.js's own key.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ClientDataConsent = require(path.join(__dirname, '..', 'client-data-consent.js'));
const {
  CONSENT_STORAGE_KEY,
  CONSENT_SCHEMA_VERSION,
  createStorageAdapter,
  getConsent,
  hasConsentDecision,
  isClientDataAllowed,
  setConsent,
  clearConsent,
} = ClientDataConsent;

const root = path.join(__dirname, '..');
const clientConsentSource = fs.readFileSync(path.join(root, 'client-data-consent.js'), 'utf8');

function stripLineComments(s) {
  return s.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  }).join('\n');
}
const clientConsentCode = stripLineComments(clientConsentSource);

function memStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _raw: data,
  };
}

test('storage key is its own dedicated key, distinct from analytics consent and essential keys', () => {
  assert.strictEqual(CONSENT_STORAGE_KEY, 'lashStudioClientDataConsent');
  assert.notStrictEqual(CONSENT_STORAGE_KEY, 'lashStudioConsent');
  assert.notStrictEqual(CONSENT_STORAGE_KEY, 'lashStudioLang');
  assert.notStrictEqual(CONSENT_STORAGE_KEY, 'lashStudioDebug');
});

test('this module never requires, reads, or references consent-manager.js, analytics.js, or client-store.js in actual code (comments may name them for documentation)', () => {
  assert.ok(!clientConsentCode.includes('require('));
  assert.ok(!clientConsentCode.includes('consent-manager'));
  assert.ok(!clientConsentCode.includes('ConsentManager'));
  assert.ok(!clientConsentCode.includes('analytics'));
  assert.ok(!clientConsentCode.includes('ClientStore'));
});

test('default is OFF: with no decision ever made, client-data storage is not allowed', () => {
  const storage = memStorage();
  assert.strictEqual(hasConsentDecision(storage), false);
  assert.strictEqual(isClientDataAllowed(storage), false);
  assert.strictEqual(getConsent(storage), null);
});

test('explicit opt-in is required before client-data storage is allowed', () => {
  const storage = memStorage();
  const rec = setConsent(storage, true, '2026-09-01T10:00:00.000Z');
  assert.strictEqual(rec.version, CONSENT_SCHEMA_VERSION);
  assert.strictEqual(rec.clientData, true);
  assert.strictEqual(rec.decidedAt, '2026-09-01T10:00:00.000Z');
  assert.strictEqual(rec.updatedAt, '2026-09-01T10:00:00.000Z');
  assert.strictEqual(isClientDataAllowed(storage), true);
});

test('explicit opt-out is respected and fails closed, keeping decidedAt but advancing updatedAt', () => {
  const storage = memStorage();
  setConsent(storage, true, '2026-09-01T10:00:00.000Z');
  const rec = setConsent(storage, false, '2026-09-02T09:00:00.000Z');
  assert.strictEqual(rec.clientData, false);
  assert.strictEqual(rec.decidedAt, '2026-09-01T10:00:00.000Z', 'decidedAt is preserved across updates');
  assert.strictEqual(rec.updatedAt, '2026-09-02T09:00:00.000Z');
  assert.strictEqual(isClientDataAllowed(storage), false);
});

test('non-boolean clientData input is coerced to a strict boolean, never stored as a truthy non-boolean', () => {
  const storage = memStorage();
  const rec = setConsent(storage, 'yes', '2026-09-01T00:00:00.000Z');
  assert.strictEqual(rec.clientData, false);
  assert.strictEqual(isClientDataAllowed(storage), false);
});

test('corrupt JSON in storage fails closed, never throws', () => {
  const storage = memStorage();
  storage.setItem(CONSENT_STORAGE_KEY, '{not valid json');
  assert.doesNotThrow(() => {
    assert.strictEqual(getConsent(storage), null);
    assert.strictEqual(isClientDataAllowed(storage), false);
    assert.strictEqual(hasConsentDecision(storage), false);
  });
});

test('unknown schema version fails closed and is never silently upgraded', () => {
  const storage = memStorage();
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: 999, clientData: true, decidedAt: 'x', updatedAt: 'y' }));
  assert.strictEqual(getConsent(storage), null);
  assert.strictEqual(isClientDataAllowed(storage), false);
});

test('missing fields on an otherwise plausible record fail closed', () => {
  const storage = memStorage();
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_SCHEMA_VERSION, clientData: true }));
  assert.strictEqual(getConsent(storage), null);
  assert.strictEqual(isClientDataAllowed(storage), false);
});

test('a blocked/throwing storage backend degrades to safe in-memory behavior without throwing', () => {
  const throwingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const adapter = createStorageAdapter(throwingStorage);
  assert.doesNotThrow(() => {
    assert.strictEqual(isClientDataAllowed(adapter), false);
    const rec = setConsent(adapter, true, '2026-09-01T00:00:00.000Z');
    assert.strictEqual(rec.clientData, true);
    // in-memory fallback still behaves correctly for the remainder of the session
    assert.strictEqual(isClientDataAllowed(adapter), true);
  });
});

test('clearConsent resets back to "no decision yet" (OFF)', () => {
  const storage = memStorage();
  setConsent(storage, true, '2026-09-01T00:00:00.000Z');
  assert.strictEqual(isClientDataAllowed(storage), true);
  clearConsent(storage);
  assert.strictEqual(hasConsentDecision(storage), false);
  assert.strictEqual(isClientDataAllowed(storage), false);
});

test('the stored record never contains any client personal data, only the yes/no decision', () => {
  const storage = memStorage();
  setConsent(storage, true, '2026-09-01T00:00:00.000Z');
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  const parsed = JSON.parse(raw);
  assert.deepStrictEqual(Object.keys(parsed).sort(), ['clientData', 'decidedAt', 'updatedAt', 'version']);
});

test('consent-manager.js and analytics.js remain byte-identical (this phase never touches them)', () => {
  const { execSync } = require('node:child_process');
  for (const file of ['consent-manager.js', 'analytics.js']) {
    let diff;
    try {
      diff = execSync('git diff -- ' + file, { cwd: root }).toString();
    } catch (e) {
      diff = 'DIFF_COMMAND_FAILED: ' + e.message;
    }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});
