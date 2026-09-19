// ============================================================
// ANALYTICS — consent-gated event wrapper.
// ------------------------------------------------------------
// Pure, DOM-independent gate + allowlist logic, same dual-load
// pattern as consent-manager.js / lash-scan-core.js: a plain global
// <script> in index.html (window.Analytics), require()-able from
// Node tests with zero duplication.
//
// STAGE 3 — CLOSED-BETA POSTHOG INTEGRATION (this revision):
//   - The provider behind Analytics is now a REAL one: createPostHogProvider
//     below sends approved events to PostHog EU Cloud over its plain
//     HTTP Capture API (POST .../capture/). It deliberately does NOT
//     load posthog-js (the vendor's own client SDK) — there is no
//     script tag, no bundled library, nothing injected into the page.
//     Autocapture, Session Replay, heatmaps, surveys, and automatic
//     page/person tracking are not merely turned off by a config flag
//     — they are architecturally absent, because the SDK that would
//     contain them is never loaded. The only network primitive this
//     file ever uses is a single, bounded, fire-and-forget fetch()
//     call inside createPostHogProvider's send().
//   - Consent is read through the EXISTING ConsentManager.isAnalyticsAllowed()
//     (consent-manager.js, unchanged) — this file does not read
//     localStorage directly for consent and does not duplicate consent
//     logic. (It DOES own one small, separate localStorage key for the
//     anonymous installation id — see IDENTITY below — a different
//     concern from consent, same non-duplication rule as
//     client-data-consent.js already documents for itself.)
//   - Every track() call is re-validated against the CURRENT consent
//     state at call time (not just once at page load) — this is what
//     makes a withdrawn consent stop tracking immediately, even
//     within the same page session, without a reload.
//   - scan_error was a placeholder name from an earlier stage and was
//     never implemented. The real failure event introduced in this
//     stage is named scan_failed (see EVENT_SCHEMA) — scan_error
//     remains permanently absent from ALLOWED_EVENTS.
//
// IDENTITY — anonymous_installation_id + anonymous_session_id:
//   - anonymous_installation_id: a random UUID, generated the first
//     time analytics consent is granted (never before), persisted in
//     its OWN localStorage key (separate from consent-manager.js's
//     and client-data-consent.js's keys), reused across sessions so
//     repeated visits from the same test device can be grouped in the
//     PostHog UI. Never derived from name/email/phone/IP/User-Agent/
//     device fingerprint/client data — a bare random value.
//   - anonymous_session_id: a random UUID generated once per page
//     load (module init), not persisted — identifies one sitting.
//   - Both are sent as explicit event properties (distinct_id /
//     session_id), not via posthog-js's own identify()/autocapture
//     machinery — identify() (the vendor concept) is never called
//     with anything but this module's own random id.
//
// PRIVACY — every property that ever reaches PostHog passes through
// sanitizeEventProps' strict allowlist first (see below): an event
// call that doesn't match its schema EXACTLY (missing required prop,
// extra prop, or a prop failing its validator) is rejected IN FULL,
// never partially forwarded. No event in EVENT_SCHEMA accepts a photo,
// image, blob, data URL, landmark, ROI, iris/eye measurement, client
// name/note/phone/email, VisitSnapshot content, or any free-text
// field — only short, fixed, predefined enum strings.
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

  // Deliberately small and coarse for a closed beta — not the full
  // internal assessFrameQuality() reason list (too_dark/too_bright/
  // blurry/too_far/too_close/eyes_closed/head_tilted/head_turned/
  // head_pitch/low_face_confidence). Those ten real internal reasons
  // collapse into ONE 'quality_rejected' bucket here; a real face
  // detected zero times at all is its own 'no_face_detected' bucket
  // (a materially different, earlier failure than quality rejection);
  // a genuine thrown exception is 'processing_error'. Low cardinality,
  // no scan measurement of any kind.
  function isScanFailReason(v) {
    return v === 'no_face_detected' || v === 'quality_rejected' || v === 'processing_error';
  }

  // client-store.js's finishSaveToClient path can fail for exactly two
  // reasons in current production code: the IndexedDB/memory store
  // being unavailable at all, or the write itself throwing. Never the
  // raw exception message/stack.
  function isVisitFailReason(v) {
    return v === 'store_unavailable' || v === 'write_failed';
  }

  // The 21 DESIGN_CATALOG ids, confirmed against index.html at
  // implementation time. Product metadata (a lash-style name), never
  // client-identifying. Kept as an explicit fixed list (not "any
  // string") so a typo'd or invented id is rejected the same way any
  // other schema violation is, not silently forwarded.
  const DESIGN_IDS = [
    'natural', 'naturalRounded', 'naturalElongated', 'angel', 'doll',
    'rounded', 'squirrel', 'kitten', 'cat', 'softcat', 'fox', 'softfox',
    'eyeliner', 'wispy', 'wispycat', 'wispydoll', 'kim', 'manga', 'wet',
    'reverse', 'correction',
  ];
  function isDesignId(v) { return DESIGN_IDS.indexOf(v) !== -1; }

  function isLashMapOrigin(v) {
    return v === 'best_design' || v === 'results_carousel' || v === 'all_designs';
  }

  const EVENT_SCHEMA = {
    app_open: {},
    scan_started: { mode: isMode },
    scan_completed: { mode: isMode },
    scan_failed: { mode: isMode, reason_code: isScanFailReason },
    results_viewed: {},
    details_viewed: {},
    rescan_started: {},
    language_changed: { lang: isLang },
    all_designs_opened: {},
    lash_map_opened: { design_id: isDesignId, origin: isLashMapOrigin },
    save_to_client_started: {},
    client_created: {},
    client_selected: {},
    visit_saved: {},
    visit_save_failed: { reason_code: isVisitFailReason },
    client_card_viewed: {},
    historical_visit_opened: {},
  };
  const ALLOWED_EVENTS = Object.keys(EVENT_SCHEMA);

  // ------------------------------------------------------------
  // IDENTITY — anonymous_installation_id (persisted) + anonymous_
  // session_id (per page-load). See file header. This storage
  // adapter is a small, LOCAL duplicate of the same try/catch +
  // memory-fallback shape consent-manager.js/client-data-consent.js
  // already use — not imported from either, so this module has zero
  // load-order dependency on them, same rationale those files state
  // for not importing each other.
  // ------------------------------------------------------------
  function createInstallIdStorageAdapter() {
    const memory = {};
    let real = null;
    try { real = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null; } catch (e) { real = null; }
    return {
      getItem(key) {
        if (real) { try { return real.getItem(key); } catch (e) { real = null; } }
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      },
      setItem(key, value) {
        if (real) { try { real.setItem(key, value); return; } catch (e) { real = null; } }
        memory[key] = value;
      },
    };
  }

  const INSTALL_ID_STORAGE_KEY = 'lashStudioAnalyticsInstallId';
  const installIdStorage = createInstallIdStorageAdapter();

  // crypto.randomUUID() where available (all modern mobile browsers
  // this app already requires for getUserMedia/face-api, and modern
  // Node for tests); a manual RFC 4122 v4 fallback only for exotic
  // engines lacking it. This id is a non-secret grouping token, not a
  // security credential, so Math.random() in the fallback path is an
  // acceptable, deliberate tradeoff.
  function genUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof require === 'function') {
      try {
        const nodeCrypto = require('crypto');
        if (nodeCrypto && typeof nodeCrypto.randomUUID === 'function') return nodeCrypto.randomUUID();
      } catch (e) { /* not running under Node, or crypto unavailable */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Generated once per module load (one app session). Not persisted —
  // a fresh value every time the app is opened.
  let sessionId = genUuidV4();

  // Lazily creates the installation id THE FIRST TIME this is called
  // (i.e. only when a provider actually loads, which only happens
  // after consent — see initIfAllowed() below) and reuses it on every
  // later call within this session and across future sessions on the
  // same device (same fail-closed-until-consent philosophy consent-
  // manager.js already documents for itself).
  function getOrCreateInstallationId() {
    let id = null;
    try { id = installIdStorage.getItem(INSTALL_ID_STORAGE_KEY); } catch (e) { id = null; }
    if (typeof id === 'string' && id.length > 0) return id;
    id = genUuidV4();
    try { installIdStorage.setItem(INSTALL_ID_STORAGE_KEY, id); } catch (e) { /* best-effort only */ }
    return id;
  }

  // ------------------------------------------------------------
  // PROVIDER ADAPTER — a real one (PostHog EU Cloud, HTTP Capture API
  // only — see file header for why posthog-js itself is never
  // loaded), plus the inert stub kept for tests/introspection.
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

  // PostHog Project API Key — a write-only, publishable capture
  // token: it can submit events but cannot read data back, list
  // projects, or perform any account action. Safe to ship in public
  // client code by PostHog's own design, the same trust model as a
  // Sentry DSN or a Stripe publishable key. This repository has no
  // build step and no server-side secret-injection mechanism, so
  // there is no alternative location that would keep it out of the
  // shipped bytes even in principle.
  const POSTHOG_PROJECT_TOKEN = 'phc_n8HcVgJnuKskmFEBxiAJpf3MUxZbpNF8Rf5a9LDTqmTE';
  const POSTHOG_API_HOST = 'https://eu.i.posthog.com';
  const POSTHOG_CAPTURE_PATH = '/capture/';
  const POSTHOG_SEND_TIMEOUT_MS = 5000;

  function createPostHogProvider(token, apiHost) {
    let installationId = null;
    return {
      name: 'posthog-http',
      loaded: false,
      load() {
        this.loaded = true;
        installationId = getOrCreateInstallationId();
      },
      // Fire-and-forget by design: never awaited by track(), never
      // throws, always bounded by its own timeout so a hung/blocked/
      // offline network can never accumulate indefinitely or delay
      // any caller. A missing `fetch` (exotic environment) or any
      // synchronous construction error is swallowed the same way —
      // analytics must never be able to break or slow the app.
      send(eventName, props) {
        if (!installationId || typeof fetch !== 'function') return;
        const payload = {
          api_key: token,
          event: eventName,
          properties: Object.assign({}, props, {
            distinct_id: installationId,
            session_id: sessionId,
            $lib: 'lash-studio-ai-http',
          }),
        };
        let body;
        try { body = JSON.stringify(payload); } catch (e) { return; }
        try {
          const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
          const timer = controller ? setTimeout(function () { controller.abort(); }, POSTHOG_SEND_TIMEOUT_MS) : null;
          fetch(apiHost + POSTHOG_CAPTURE_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true,
            signal: controller ? controller.signal : undefined,
          }).catch(function () { /* never throw, never surface a network error to the caller */ })
            .then(function () { if (timer) clearTimeout(timer); });
        } catch (e) { /* never throw, never block the caller */ }
      },
    };
  }

  let provider = createPostHogProvider(POSTHOG_PROJECT_TOKEN, POSTHOG_API_HOST);
  let consentAllowed = false;
  let initialized = false;

  // Call this whenever the app's consent state changes (Accept /
  // Reject / Customize-save / withdraw). Pass the CURRENT boolean —
  // this module has no independent memory of consent and never reads
  // storage itself for consent; App() is the single caller, driven by
  // the existing ConsentManager-backed `consent` state (see index.html
  // wiring).
  function setConsent(allowed) {
    consentAllowed = allowed === true;
    if (consentAllowed) {
      initIfAllowed();
    }
    // Withdrawing consent (allowed=false) deliberately does NOT try to
    // unload/remove the provider — a script tag can't be un-executed,
    // and here there is no script tag to begin with (see file header).
    // The actual guarantee ("tracking stops immediately on
    // withdrawal") is enforced by track() re-checking consentAllowed
    // on every single call, below — not by teardown.
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
  // Identity introspection/reset — test-only, never called by App().
  function _getInstallationIdForTests() {
    return getOrCreateInstallationId();
  }
  function _resetInstallationIdForTests() {
    try { installIdStorage.setItem(INSTALL_ID_STORAGE_KEY, ''); } catch (e) { /* best-effort only */ }
  }
  function _getSessionIdForTests() {
    return sessionId;
  }
  function _resetSessionForTests() {
    sessionId = genUuidV4();
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
    _getInstallationIdForTests,
    _resetInstallationIdForTests,
    _getSessionIdForTests,
    _resetSessionForTests,
  };
});
