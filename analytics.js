// ============================================================
// ANALYTICS — Phase 2, Stage 2.1-2.3: consent-gated event wrapper.
// ------------------------------------------------------------
// Pure, DOM-independent gate + allowlist logic, same dual-load
// pattern as consent-manager.js / lash-scan-core.js: a plain global
// <script> in index.html (window.Analytics), require()-able from
// Node tests with zero duplication.
//
// STAGE 2.1-2.3 SCOPE — read this before touching anything below:
//   - NO real analytics provider/SDK/script is loaded by this file.
//     The provider adapter below (createNoopProvider) is an inert
//     stub: `load()` and `send()` never call document.createElement,
//     never touch the network, never reference any real vendor. This
//     lets the consent-gate/allowlist architecture be fully built and
//     tested WITHOUT connecting to Umami/Plausible/anything else.
//     Swapping in a real provider is a separate, later, reviewed
//     change (Stage 2.5+) — not part of this file's current behavior.
//   - Consent is read through the EXISTING ConsentManager.isAnalyticsAllowed()
//     (consent-manager.js, unchanged) — this file does not read
//     localStorage directly and does not duplicate consent logic.
//   - Every track() call is re-validated against the CURRENT consent
//     state at call time (not just once at page load) — this is what
//     makes a withdrawn consent stop tracking immediately, even
//     within the same page session, without a reload.
//   - scan_error is deliberately NOT part of ALLOWED_EVENTS yet — it
//     is a separate, later stage requiring its own review because it
//     is the one event whose call sites live inside
//     LiveScanScreen/PhotoAnalysisScreen.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    // Namespaced (window.Analytics), same rationale as ConsentManager:
    // generic names (track/setConsent/...) are too likely to collide
    // as bare globals in this large single-file app.
    root.Analytics = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // ------------------------------------------------------------
  // EVENT SCHEMA — the ONLY events this module will ever forward, and
  // the ONLY properties each one may carry. Every declared property is
  // REQUIRED (not optional) and must pass its validator, which accepts
  // nothing but a short fixed enum string — never free text, never an
  // object/array, never anything resembling base64/a data URL/a file
  // path. An event call that doesn't match its schema EXACTLY (missing
  // required prop, extra prop, or a prop failing its validator) is
  // rejected IN FULL — never partially forwarded. This is deliberately
  // stricter than "strip unknown keys": a silently-stripped payload
  // could hide a real bug where something sensitive was passed by
  // mistake; an outright-rejected call is visible and testable.
  // ------------------------------------------------------------
  function isMode(v) { return v === 'live' || v === 'photo'; }
  function isLang(v) { return v === 'ru' || v === 'en'; }

  const EVENT_SCHEMA = {
    scan_started: { mode: isMode },
    scan_completed: { mode: isMode },
    results_viewed: {},
    details_viewed: {},
    rescan_started: {},
    language_changed: { lang: isLang },
  };
  const ALLOWED_EVENTS = Object.keys(EVENT_SCHEMA);

  // ------------------------------------------------------------
  // PROVIDER ADAPTER — STUB ONLY (Stage 2.1-2.3). See file header.
  // `_log` exists purely so tests (and, later, live verification) can
  // observe what WOULD have been sent, without any real SDK involved.
  // ------------------------------------------------------------
  function createNoopProvider() {
    const log = [];
    return {
      name: 'noop-stub',
      loaded: false,
      load() { this.loaded = true; log.push({ type: 'load' }); },
      send(eventName, props) { log.push({ type: 'event', eventName, props }); },
      _log: log,
    };
  }

  let provider = createNoopProvider();
  let consentAllowed = false;
  let initialized = false;

  // Call this whenever the app's consent state changes (Accept /
  // Reject / Customize-save / withdraw). Pass the CURRENT boolean —
  // this module has no independent memory of consent and never reads
  // storage itself; App() is the single caller, driven by the existing
  // ConsentManager-backed `consent` state (see index.html wiring).
  function setConsent(allowed) {
    consentAllowed = allowed === true;
    if (consentAllowed) {
      initIfAllowed();
    }
    // Withdrawing consent (allowed=false) deliberately does NOT try to
    // unload/remove the provider — with a stub there is nothing to
    // unload anyway, and with a real provider later, script tags can't
    // be un-executed. The actual guarantee ("tracking stops
    // immediately on withdrawal") is enforced by track() re-checking
    // consentAllowed on every single call, below — not by DOM cleanup.
  }

  function initIfAllowed() {
    if (!consentAllowed) return false;
    if (initialized) return true;
    provider.load();
    initialized = true;
    return true;
  }

  // Returns a FRESH object with only the schema's keys (never a
  // reference to the caller's object, so later mutation of the
  // caller's object can't retroactively change what was "sent"), or
  // null if eventName/props don't exactly match the schema.
  function sanitizeEventProps(eventName, props) {
    const schema = EVENT_SCHEMA[eventName];
    if (!schema) return null;
    const input = props || {};
    const allowedKeys = Object.keys(schema);
    const inputKeys = Object.keys(input);
    for (let i = 0; i < inputKeys.length; i++) {
      if (allowedKeys.indexOf(inputKeys[i]) === -1) return null;
    }
    const out = {};
    for (let i = 0; i < allowedKeys.length; i++) {
      const key = allowedKeys[i];
      if (!(key in input)) return null;
      if (!schema[key](input[key])) return null;
      out[key] = input[key];
    }
    return out;
  }

  // Public API every call site uses. Never throws — a rejected/no-op
  // call is silent by design (analytics must never be able to break
  // the app), and returns false so tests can assert on it.
  function track(eventName, props) {
    if (ALLOWED_EVENTS.indexOf(eventName) === -1) return false;
    if (!consentAllowed) return false;
    if (!initialized) return false;
    const sanitized = sanitizeEventProps(eventName, props);
    if (sanitized === null) return false;
    provider.send(eventName, sanitized);
    return true;
  }

  // ---- test-only introspection / injection, never called by App() ----
  function _debugState() {
    return {
      consentAllowed,
      initialized,
      providerName: provider.name,
      providerLog: provider._log ? provider._log.slice() : null,
    };
  }
  function _setProviderForTests(customProvider) {
    provider = customProvider;
    initialized = false;
  }
  function _resetForTests() {
    provider = createNoopProvider();
    consentAllowed = false;
    initialized = false;
  }

  return {
    ALLOWED_EVENTS,
    setConsent,
    initIfAllowed,
    track,
    sanitizeEventProps,
    _debugState,
    _setProviderForTests,
    _resetForTests,
  };
});
