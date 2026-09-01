// ============================================================
// CLIENT STORE — Phase 1: data layer only for the Client Card /
// Client History feature. No UI. Not wired into index.html yet. Not
// integrated into the scan/results flow yet. No photo/Blob storage
// yet (photoId fields are reserved in the schema for a later phase).
// ------------------------------------------------------------
// Design goals, all directly testable in plain Node (no browser, no
// real IndexedDB required):
//
//   - Client and ClientVisit are versioned schemas (`version` field on
//     every record). A corrupt or unrecognized version is treated
//     exactly like "record does not exist" — never thrown, never
//     guessed, never silently upgraded. Same fail-closed philosophy
//     already used by consent-manager.js's isValidRecord/getConsent.
//   - dateOfBirth lives on Client, never on a visit. Age is NEVER
//     stored anywhere — calculateAge(dateOfBirth, today) is a pure
//     function computed on demand.
//   - firstVisitDate/lastVisitDate/totalVisits are NEVER stored on
//     Client either — deriveClientVisitStats(visits) computes them
//     from the actual visit records, so they can never drift out of
//     sync with visit history.
//   - Visits are append-only: createVisit() only ever adds a new
//     record and appends its id to the client's visitIds array. There
//     is no updateVisit()/overwriteVisit() in this module by design.
//     deleteVisit() exists only for cascading/explicit removal (see
//     deleteClient), never for silently mutating a kept visit.
//   - analysisSnapshot/designSnapshot passed into createVisit() are
//     deep-cloned before being stored, and deep-cloned again on every
//     read — so a caller mutating the object they passed in (or the
//     object they got back) can never reach back into stored state,
//     and a saved visit can never be silently altered by a later
//     change to whatever produced that snapshot (e.g. DESIGN_CATALOG
//     or ProfessionalLashLibrary edits elsewhere in the app).
//   - Storage backend is pluggable: a real IndexedDB adapter is used
//     when `indexedDB` is available, but ANY failure to open/use it
//     (unavailable, throws, errors) falls back to an in-memory adapter
//     automatically. Every public method is async and NEVER throws
//     due to storage unavailability — the rest of the app can call
//     this module unconditionally without risking a crash.
//   - No medical/diagnosis fields anywhere in the schema. Client
//     preferences carry only plain, artist-authored free text.
//
// Same dual-load pattern as lash-scan-core.js/consent-manager.js/
// professional-lash-library.js: a bare <script> tag exposes
// window.ClientStore; require() from Node tests gets the same
// factory output. This module does not require, import, read, or
// write anything from consent-manager.js, client-data-consent.js,
// analytics.js, DESIGN_CATALOG, ProfessionalLashLibrary, or any
// camera/scan/ranking code in index.html.
// ============================================================
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ClientStore = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CLIENT_SCHEMA_VERSION = 1;
  const VISIT_SCHEMA_VERSION = 1;
  const DB_NAME = 'lashStudioClientStore';
  const DB_VERSION = 1;
  const STORE_CLIENTS = 'clients';
  const STORE_VISITS = 'visits';

  function nowIso() { return new Date().toISOString(); }

  function genId(prefix) {
    const a = Math.random().toString(36).slice(2);
    const b = Math.random().toString(36).slice(2);
    return prefix + '_' + Date.now().toString(36) + '_' + a + b;
  }

  // Deep clone used at every store/read boundary. structuredClone is
  // available in modern Node and modern browsers; the JSON fallback
  // covers older environments. Every value passing through this
  // module's public API is a plain, JSON-serializable object (no
  // functions, no class instances, no DOM/Blob references in Phase
  // 1), so either path is safe.
  function cloneSnapshot(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (e) { /* fall through to JSON */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  // ------------------------------------------------------------
  // Schema validity — the single fail-closed gate every read passes
  // through. A record failing this check is treated as if it were
  // never stored at all.
  // ------------------------------------------------------------
  function isValidClientRecord(rec) {
    return !!rec && typeof rec === 'object' &&
      rec.version === CLIENT_SCHEMA_VERSION &&
      typeof rec.id === 'string' &&
      typeof rec.fullName === 'string' &&
      (rec.photoId === null || typeof rec.photoId === 'string') &&
      (rec.dateOfBirth === null || typeof rec.dateOfBirth === 'string') &&
      (rec.phone === null || typeof rec.phone === 'string') &&
      !!rec.preferences && typeof rec.preferences === 'object' &&
      Array.isArray(rec.visitIds) &&
      typeof rec.createdAt === 'string' &&
      typeof rec.updatedAt === 'string';
  }

  function isValidVisitRecord(rec) {
    return !!rec && typeof rec === 'object' &&
      rec.version === VISIT_SCHEMA_VERSION &&
      typeof rec.id === 'string' &&
      typeof rec.clientId === 'string' &&
      typeof rec.visitDate === 'string' &&
      !!rec.photos && typeof rec.photos === 'object' &&
      typeof rec.createdAt === 'string';
  }

  // ------------------------------------------------------------
  // Pure helpers — no storage involved, trivially unit-testable.
  // ------------------------------------------------------------

  // Computes age from an ISO date-of-birth string ('YYYY-MM-DD' or a
  // full ISO timestamp) as of `today` (defaults to now, injectable for
  // deterministic tests). Returns null for missing/invalid input.
  // Age is intentionally never stored anywhere in this module — every
  // caller must derive it via this function at read time.
  function calculateAge(dateOfBirth, today) {
    if (typeof dateOfBirth !== 'string' || !dateOfBirth) return null;
    const dobSrc = dateOfBirth.length === 10 ? dateOfBirth + 'T00:00:00Z' : dateOfBirth;
    const dob = new Date(dobSrc);
    const now = today
      ? new Date(typeof today === 'string' && today.length === 10 ? today + 'T00:00:00Z' : today)
      : new Date();
    if (isNaN(dob.getTime()) || isNaN(now.getTime())) return null;
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
    const dayDiff = now.getUTCDate() - dob.getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age < 0 ? null : age;
  }

  // Derives firstVisitDate/lastVisitDate/totalVisits from an array of
  // visit records. Never stored on Client — always computed from the
  // actual visits so it can never drift out of sync with history.
  function deriveClientVisitStats(visits) {
    const dates = (Array.isArray(visits) ? visits : [])
      .map(v => v && v.visitDate)
      .filter(d => typeof d === 'string')
      .sort();
    return {
      firstVisitDate: dates.length ? dates[0] : null,
      lastVisitDate: dates.length ? dates[dates.length - 1] : null,
      totalVisits: Array.isArray(visits) ? visits.length : 0,
    };
  }

  function normalizePreferences(input) {
    const p = (input && typeof input === 'object') ? input : {};
    return {
      desiredLook: typeof p.desiredLook === 'string' ? p.desiredLook : null,
      preferredEffects: Array.isArray(p.preferredEffects) ? p.preferredEffects.filter(x => typeof x === 'string') : [],
      requestNotes: typeof p.requestNotes === 'string' ? p.requestNotes : null,
      // Plain artist-authored free text ONLY (e.g. retention/comfort
      // observations). Deliberately not a structured allergy/
      // diagnosis/medical field — this module has no such schema.
      artistSensitivityNotes: typeof p.artistSensitivityNotes === 'string' ? p.artistSensitivityNotes : null,
    };
  }

  // ------------------------------------------------------------
  // Storage adapters — a tiny common interface:
  //   get(storeName, id) -> Promise<object|null>
  //   getAll(storeName) -> Promise<object[]>
  //   put(storeName, value) -> Promise<void>   (value.id is the key)
  //   delete(storeName, id) -> Promise<void>
  // Both adapters clone on every get/put so callers can never hold a
  // live reference into stored state either way.
  // ------------------------------------------------------------

  function createMemoryAdapter() {
    const stores = { [STORE_CLIENTS]: new Map(), [STORE_VISITS]: new Map() };
    return {
      async get(storeName, id) {
        const store = stores[storeName];
        if (!store || !store.has(id)) return null;
        return cloneSnapshot(store.get(id));
      },
      async getAll(storeName) {
        const store = stores[storeName];
        if (!store) return [];
        return Array.from(store.values()).map(cloneSnapshot);
      },
      async put(storeName, value) {
        if (!stores[storeName]) stores[storeName] = new Map();
        stores[storeName].set(value.id, cloneSnapshot(value));
      },
      async delete(storeName, id) {
        const store = stores[storeName];
        if (store) store.delete(id);
      },
    };
  }

  // Real IndexedDB adapter. Only reachable in a browser with a
  // working `indexedDB`; any failure at any step (open throws, the
  // open request errors, a transaction fails) rejects and the caller
  // (getAdapter, below) falls back to the memory adapter instead of
  // ever propagating the failure to application code.
  function openIndexedDBAdapter(indexedDBImpl) {
    return new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDBImpl.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_CLIENTS)) db.createObjectStore(STORE_CLIENTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_VISITS)) db.createObjectStore(STORE_VISITS, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        function promisifyRequest(r) {
          return new Promise((res, rej) => {
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error || new Error('IndexedDB request failed'));
          });
        }
        resolve({
          async get(storeName, id) {
            const val = await promisifyRequest(db.transaction(storeName, 'readonly').objectStore(storeName).get(id));
            return (val === undefined || val === null) ? null : cloneSnapshot(val);
          },
          async getAll(storeName) {
            const all = await promisifyRequest(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
            return (all || []).map(cloneSnapshot);
          },
          async put(storeName, value) {
            await promisifyRequest(db.transaction(storeName, 'readwrite').objectStore(storeName).put(cloneSnapshot(value)));
          },
          async delete(storeName, id) {
            await promisifyRequest(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id));
          },
        });
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  // ------------------------------------------------------------
  // Store factory. Each call produces an independent store instance
  // (its own adapter/backend) — tests create a fresh one per test for
  // isolation; a future UI phase would keep one long-lived instance.
  //
  // options.adapter    — inject a pre-built adapter directly (tests
  //                       use this to pre-populate corrupt records).
  // options.indexedDBImpl — inject a specific indexedDB-like object
  //                       (tests use this to simulate a throwing/
  //                       erroring IndexedDB without a real browser).
  //                       Defaults to the global `indexedDB` when
  //                       present, else null.
  // options.forceMemory — skip IndexedDB entirely and always use the
  //                       memory adapter.
  // ------------------------------------------------------------
  function createClientStore(options) {
    const opts = options || {};
    const indexedDBImpl = Object.prototype.hasOwnProperty.call(opts, 'indexedDBImpl')
      ? opts.indexedDBImpl
      : (typeof indexedDB !== 'undefined' ? indexedDB : null);
    const forceMemory = opts.forceMemory === true;

    let mode = 'pending';
    let adapterPromise = null;

    function getAdapter() {
      if (adapterPromise) return adapterPromise;
      if (opts.adapter) {
        mode = opts.mode || 'custom';
        adapterPromise = Promise.resolve(opts.adapter);
        return adapterPromise;
      }
      if (!forceMemory && indexedDBImpl) {
        adapterPromise = openIndexedDBAdapter(indexedDBImpl)
          .then((adapter) => { mode = 'indexeddb'; return adapter; })
          .catch(() => { mode = 'memory'; return createMemoryAdapter(); });
      } else {
        mode = 'memory';
        adapterPromise = Promise.resolve(createMemoryAdapter());
      }
      return adapterPromise;
    }

    // Resolves once the backend is chosen; returns 'indexeddb',
    // 'memory', or 'custom'. Safe to call any time — also implicitly
    // awaited by every CRUD method below via getAdapter().
    async function whenReady() {
      await getAdapter();
      return mode;
    }

    // --------------------------------------------------------
    // Client CRUD
    // --------------------------------------------------------
    async function createClient(input) {
      const adapter = await getAdapter();
      const src = input || {};
      const ts = nowIso();
      const record = {
        id: genId('client'),
        version: CLIENT_SCHEMA_VERSION,
        fullName: typeof src.fullName === 'string' ? src.fullName : '',
        photoId: null, // reserved for a future phase; no Blob storage exists yet
        dateOfBirth: typeof src.dateOfBirth === 'string' ? src.dateOfBirth : null,
        phone: typeof src.phone === 'string' ? src.phone : null,
        preferences: normalizePreferences(src.preferences),
        createdAt: ts,
        updatedAt: ts,
        visitIds: [],
      };
      await adapter.put(STORE_CLIENTS, record);
      return cloneSnapshot(record);
    }

    async function getClient(id) {
      const adapter = await getAdapter();
      const rec = await adapter.get(STORE_CLIENTS, id);
      return isValidClientRecord(rec) ? rec : null;
    }

    async function listClients() {
      const adapter = await getAdapter();
      const all = await adapter.getAll(STORE_CLIENTS);
      return all.filter(isValidClientRecord);
    }

    async function updateClient(id, patch) {
      const adapter = await getAdapter();
      const existing = await adapter.get(STORE_CLIENTS, id);
      if (!isValidClientRecord(existing)) throw new Error('updateClient: unknown or invalid client id: ' + id);
      const src = patch || {};
      const merged = {
        ...existing,
        fullName: typeof src.fullName === 'string' ? src.fullName : existing.fullName,
        dateOfBirth: Object.prototype.hasOwnProperty.call(src, 'dateOfBirth')
          ? (typeof src.dateOfBirth === 'string' ? src.dateOfBirth : null)
          : existing.dateOfBirth,
        phone: Object.prototype.hasOwnProperty.call(src, 'phone')
          ? (typeof src.phone === 'string' ? src.phone : null)
          : existing.phone,
        preferences: src.preferences ? normalizePreferences({ ...existing.preferences, ...src.preferences }) : existing.preferences,
        updatedAt: nowIso(),
      };
      await adapter.put(STORE_CLIENTS, merged);
      return cloneSnapshot(merged);
    }

    // Deletes a client AND every visit record belonging to it — a
    // client can never be left with dangling/orphaned visits, and a
    // visit can never outlive the client it belongs to.
    async function deleteClient(id) {
      const adapter = await getAdapter();
      const existing = await adapter.get(STORE_CLIENTS, id);
      if (existing && Array.isArray(existing.visitIds)) {
        for (const visitId of existing.visitIds) {
          await adapter.delete(STORE_VISITS, visitId);
        }
      }
      await adapter.delete(STORE_CLIENTS, id);
    }

    // --------------------------------------------------------
    // Visit CRUD — append-only. There is deliberately no
    // updateVisit()/overwriteVisit(): once created, a visit's content
    // never changes. deleteVisit() exists only for explicit removal
    // (used by deleteClient's cascade, or a future correction action),
    // never for silently mutating a kept visit.
    // --------------------------------------------------------
    async function createVisit(clientId, input) {
      const adapter = await getAdapter();
      const client = await adapter.get(STORE_CLIENTS, clientId);
      if (!isValidClientRecord(client)) throw new Error('createVisit: unknown or invalid client id: ' + clientId);
      const src = input || {};
      const ts = nowIso();
      const record = {
        id: genId('visit'),
        clientId,
        version: VISIT_SCHEMA_VERSION,
        visitDate: typeof src.visitDate === 'string' ? src.visitDate : ts,
        // Deep-cloned snapshots, never live references. Whatever the
        // caller passes (e.g. a copy of `result.eyeProfile` or the
        // selected ClientLashDesign) is frozen into this visit exactly
        // as it looked at save time; later edits to the caller's
        // object, DESIGN_CATALOG, or ProfessionalLashLibrary can never
        // reach back into this record.
        analysisSnapshot: (src.analysisSnapshot !== undefined && src.analysisSnapshot !== null) ? cloneSnapshot(src.analysisSnapshot) : null,
        designSnapshot: (src.designSnapshot !== undefined && src.designSnapshot !== null) ? cloneSnapshot(src.designSnapshot) : null,
        // Reserved shape only — Phase 1 never writes an actual photo
        // Blob/id here. A future phase may populate these once photo
        // storage exists.
        photos: {
          beforePhotoId: (src.photos && typeof src.photos.beforePhotoId === 'string') ? src.photos.beforePhotoId : null,
          afterPhotoId: (src.photos && typeof src.photos.afterPhotoId === 'string') ? src.photos.afterPhotoId : null,
        },
        artistNote: typeof src.artistNote === 'string' ? src.artistNote : null,
        createdAt: ts,
      };
      await adapter.put(STORE_VISITS, record);
      const updatedClient = {
        ...client,
        visitIds: client.visitIds.concat(record.id),
        updatedAt: ts,
      };
      await adapter.put(STORE_CLIENTS, updatedClient);
      return cloneSnapshot(record);
    }

    async function getVisit(id) {
      const adapter = await getAdapter();
      const rec = await adapter.get(STORE_VISITS, id);
      return isValidVisitRecord(rec) ? rec : null;
    }

    // Newest first (by visitDate, tie-broken by createdAt).
    async function listVisitsForClient(clientId) {
      const adapter = await getAdapter();
      const all = await adapter.getAll(STORE_VISITS);
      return all
        .filter(v => isValidVisitRecord(v) && v.clientId === clientId)
        .sort((a, b) => (b.visitDate.localeCompare(a.visitDate)) || (b.createdAt.localeCompare(a.createdAt)));
    }

    async function deleteVisit(id) {
      const adapter = await getAdapter();
      const visit = await adapter.get(STORE_VISITS, id);
      await adapter.delete(STORE_VISITS, id);
      if (visit && typeof visit.clientId === 'string') {
        const client = await adapter.get(STORE_CLIENTS, visit.clientId);
        if (client && Array.isArray(client.visitIds)) {
          const updated = {
            ...client,
            visitIds: client.visitIds.filter(vid => vid !== id),
            updatedAt: nowIso(),
          };
          await adapter.put(STORE_CLIENTS, updated);
        }
      }
    }

    return {
      whenReady,
      createClient,
      getClient,
      listClients,
      updateClient,
      deleteClient,
      createVisit,
      getVisit,
      listVisitsForClient,
      deleteVisit,
    };
  }

  return {
    CLIENT_SCHEMA_VERSION,
    VISIT_SCHEMA_VERSION,
    isValidClientRecord,
    isValidVisitRecord,
    calculateAge,
    deriveClientVisitStats,
    cloneSnapshot,
    createMemoryAdapter,
    createClientStore,
  };
});
