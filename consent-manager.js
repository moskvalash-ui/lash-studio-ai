// ============================================================
// CONSENT MANAGER — Phase 1: Consent foundation.
// ------------------------------------------------------------
// Pure, DOM/React-independent consent state logic for the analytics
// consent mechanic. Extracted into its own module, following the
// same dual-load pattern as lash-scan-core.js, so it can be loaded
// two ways with ZERO duplication:
//   1. as a plain global <script> in index.html (no build step) —
//      its exports land on window.ConsentManager and are consumed as
//      a bare global by App(), same as NLS-1's globals;
//   2. via require() from tests/consent-manager.test.js (Node).
//
// PHASE 1 SCOPE: this module ONLY tracks the user's decision about
// OPTIONAL analytics. It does not load, call, reference, or know
// about any analytics SDK, script tag, or network request — there is
// none in this phase (that is Phase 2+, and is intentionally not
// part of this module). It never touches, stores, or references
// scan-derived data of any kind (photos, camera frames, facial
// landmarks, iris/eyelid measurements, debug captures, results).
//
// STORAGE TAXONOMY (see also the audit doc in the project):
//   - "essential" technical storage — the app's existing
//     `lashStudioLang` (UI language) and `lashStudioDebug`
//     (developer-only debug flag) localStorage keys — is NOT gated
//     by consent. It is required for the app to function and is not
//     used for analytics/tracking. This module does not touch those
//     keys at all.
//   - `lashStudioConsent` (this module) is the ONLY storage key that
//     records the user's OPTIONAL analytics choice. It is the sole
//     concern of this module.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    // Unlike lash-scan-core.js (which spreads its exports as bare
    // globals), this module attaches under a single window.ConsentManager
    // namespace — its function names (getConsent/setConsent/...) are
    // generic enough that spreading them as bare globals risks colliding
    // with unrelated code elsewhere in this large, single-file app.
    root.ConsentManager = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONSENT_STORAGE_KEY = 'lashStudioConsent';
  const CONSENT_SCHEMA_VERSION = 1;

  // ------------------------------------------------------------
  // Storage adapter — wraps a Web Storage-like object (getItem/
  // setItem/removeItem) with try/catch, matching the existing
  // lashStudioLang/lashStudioDebug pattern elsewhere in index.html so
  // a blocked/unavailable localStorage (private browsing, disabled
  // storage, Node test environment) never throws or crashes the app.
  // Falls back to an in-memory object for the remainder of the
  // session so consent still behaves correctly in-session even when
  // persistence itself is unavailable.
  // ------------------------------------------------------------
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

  // Default storage: real window.localStorage in the browser, an
  // isolated in-memory adapter everywhere else (Node tests). Tests
  // that need isolation should pass their own createStorageAdapter(null)
  // instance explicitly rather than relying on this singleton.
  function defaultStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return createStorageAdapter(window.localStorage);
    }
    return createStorageAdapter(null);
  }

  // ------------------------------------------------------------
  // Consent record shape — the ONLY thing ever written under
  // CONSENT_STORAGE_KEY:
  //   { version: 1, analytics: boolean, decidedAt: <ISO string>,
  //     updatedAt: <ISO string> }
  // Never contains scan-derived data, a user identifier, or anything
  // beyond this fixed, fully-anonymous shape.
  // ------------------------------------------------------------

  function isValidRecord(rec) {
    return !!rec &&
      typeof rec === 'object' &&
      rec.version === CONSENT_SCHEMA_VERSION &&
      typeof rec.analytics === 'boolean' &&
      typeof rec.decidedAt === 'string' &&
      typeof rec.updatedAt === 'string';
  }

  // Returns the stored consent record, or null if none exists yet, or
  // the stored value is missing/corrupt/an unrecognized schema
  // version. A corrupt or unknown-version record is treated exactly
  // like "no decision yet" — never throws, never guesses a decision
  // on the user's behalf, never silently upgrades old data.
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

  // Analytics is allowed ONLY when a valid record exists AND its
  // `analytics` flag is explicitly true. No record, a corrupt record,
  // or an explicit false all resolve to "not allowed" — the safe
  // default in every ambiguous case (fail closed, never fail open).
  function isAnalyticsAllowed(storage) {
    const rec = getConsent(storage);
    return !!rec && rec.analytics === true;
  }

  // Writes (or updates) the consent decision. `analytics` is coerced
  // to a strict boolean. `decidedAt` is preserved from any existing
  // record (first-ever decision time); `updatedAt` always reflects
  // this call, so a later change/withdrawal is distinguishable from
  // the original decision. `nowIso` is injectable (defaults to real
  // time) purely so tests can assert exact timestamps deterministically.
  function setConsent(storage, analytics, nowIso) {
    const s = storage || defaultStorage();
    const ts = nowIso || new Date().toISOString();
    const existing = getConsent(s);
    const record = {
      version: CONSENT_SCHEMA_VERSION,
      analytics: analytics === true,
      decidedAt: (existing && existing.decidedAt) || ts,
      updatedAt: ts,
    };
    try { s.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch (e) { /* best-effort persistence only */ }
    return record;
  }

  // Fully removes the stored decision, resetting back to "no decision
  // yet" (the consent banner is shown again on next load). Provided
  // for completeness/testing; the product-facing "change later"
  // affordance should normally call setConsent(storage, false, ...)
  // instead, which keeps an auditable record of the withdrawal rather
  // than erasing that it ever happened.
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
    isAnalyticsAllowed,
    setConsent,
    clearConsent,
  };
});
