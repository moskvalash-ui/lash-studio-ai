// ============================================================
// CLIENT DATA CONSENT — Phase 1: consent foundation for on-device
// client-card storage (names, dates of birth, contact info, notes,
// and — in a later phase — client photos).
// ------------------------------------------------------------
// This is a DELIBERATELY SEPARATE module from consent-manager.js.
// consent-manager.js governs only the OPTIONAL ANALYTICS decision and
// explicitly documents that it never touches personal/scan-derived
// data. Client Card storage is a materially different, heavier
// decision — the lash artist is choosing to store a THIRD PARTY's
// (their client's) personal data on this device — so it gets its own
// dedicated storage key, its own schema, and its own default.
//
// This module does not require, import, read, or write anything from
// consent-manager.js, analytics.js, or client-store.js. It does not
// know what a "Client" or "ClientVisit" record looks like. It answers
// exactly one question: has the artist explicitly opted in to storing
// client data on this device? Nothing is ever inferred or defaulted
// to "on" — an unanswered or corrupt decision is always treated as
// "not allowed" (fail closed), the same safe-default philosophy
// consent-manager.js uses for analytics.
//
// Same dual-load pattern as every other plain-script module in this
// app (lash-scan-core.js, consent-manager.js, professional-lash-
// library.js): a bare <script> tag exposes window.ClientDataConsent;
// require() from Node tests gets the same factory output.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ClientDataConsent = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONSENT_STORAGE_KEY = 'lashStudioClientDataConsent';
  const CONSENT_SCHEMA_VERSION = 1;

  // Storage adapter — same try/catch-wrapped, memory-fallback shape as
  // consent-manager.js's own adapter, duplicated locally (not
  // required from consent-manager.js) so this module has zero load-
  // order dependency on, or coupling to, that file.
  function createStorageAdapter(rawStorage) {
    const memory = {};
    let useReal = !!rawStorage;
    return {
      getItem(key) {
        if (useReal) {
          try { return rawStorage.getItem(key); } catch (e) { useReal = false; }
        }
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      },
      setItem(key, value) {
        if (useReal) {
          try { rawStorage.setItem(key, value); return; } catch (e) { useReal = false; }
        }
        memory[key] = value;
      },
      removeItem(key) {
        if (useReal) {
          try { rawStorage.removeItem(key); return; } catch (e) { useReal = false; }
        }
        delete memory[key];
      },
    };
  }

  function defaultStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return createStorageAdapter(window.localStorage);
    }
    return createStorageAdapter(null);
  }

  // Consent record shape — the ONLY thing ever written under
  // CONSENT_STORAGE_KEY:
  //   { version: 1, clientData: boolean, decidedAt: <ISO string>,
  //     updatedAt: <ISO string> }
  // Never contains a client name, photo, date of birth, or any other
  // personal data — this module only records the artist's yes/no
  // decision about whether such data may be stored at all.
  function isValidRecord(rec) {
    return !!rec &&
      typeof rec === 'object' &&
      rec.version === CONSENT_SCHEMA_VERSION &&
      typeof rec.clientData === 'boolean' &&
      typeof rec.decidedAt === 'string' &&
      typeof rec.updatedAt === 'string';
  }

  // Returns the stored consent record, or null if none exists yet, or
  // the stored value is missing/corrupt/an unrecognized schema
  // version. A corrupt or unknown-version record is treated exactly
  // like "no decision yet" — never throws, never guesses on the
  // artist's behalf, never silently upgrades old data.
  function getConsent(storage) {
    const s = storage || defaultStorage();
    let raw;
    try { raw = s.getItem(CONSENT_STORAGE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    return isValidRecord(parsed) ? parsed : null;
  }

  function hasConsentDecision(storage) {
    return getConsent(storage) !== null;
  }

  // Client-data storage is allowed ONLY when a valid record exists
  // AND its `clientData` flag is explicitly true. No record, a
  // corrupt record, an unknown schema version, or an explicit false
  // all resolve to "not allowed" — fail closed in every ambiguous
  // case. Unlike analytics (which many users opt into casually), this
  // defaults OFF until the artist takes an explicit action, because
  // the data being gated belongs to a third party (the client), not
  // just the app's own user.
  function isClientDataAllowed(storage) {
    const rec = getConsent(storage);
    return !!rec && rec.clientData === true;
  }

  // Writes (or updates) the consent decision. `clientData` is coerced
  // to a strict boolean. `decidedAt` is preserved from any existing
  // record (first-ever decision time); `updatedAt` always reflects
  // this call, so a later withdrawal is distinguishable from the
  // original decision. `nowIso` is injectable purely so tests can
  // assert exact timestamps deterministically.
  function setConsent(storage, clientData, nowIso) {
    const s = storage || defaultStorage();
    const ts = nowIso || new Date().toISOString();
    const existing = getConsent(s);
    const record = {
      version: CONSENT_SCHEMA_VERSION,
      clientData: clientData === true,
      decidedAt: (existing && existing.decidedAt) || ts,
      updatedAt: ts,
    };
    try { s.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch (e) { /* best-effort persistence only */ }
    return record;
  }

  // Fully removes the stored decision, resetting back to "no decision
  // yet" — isClientDataAllowed then safely returns false again.
  function clearConsent(storage) {
    const s = storage || defaultStorage();
    try { s.removeItem(CONSENT_STORAGE_KEY); } catch (e) { /* best-effort */ }
  }

  return {
    CONSENT_STORAGE_KEY,
    CONSENT_SCHEMA_VERSION,
    createStorageAdapter,
    defaultStorage,
    getConsent,
    hasConsentDecision,
    isClientDataAllowed,
    setConsent,
    clearConsent,
  };
});
