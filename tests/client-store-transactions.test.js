'use strict';
// Real Chromium/IndexedDB regression; uses the existing E2E dependency.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./e2e/node_modules/playwright');
const source = fs.readFileSync(process.env.CLIENT_STORE_TEST_SOURCE || path.join(__dirname, '../client-store.js'), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { if (browser) await browser.close(); });
async function scenario(operation, abort, abortStore = null) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route('http://client-store.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
    await page.goto('http://client-store.test/');
    await page.addScriptTag({ content: source });
    const evidence = await page.evaluate(async ({ operation, abort, abortStore }) => {
      const store = ClientStore.createClientStore();
      const client = await store.createClient({ fullName: 'Synthetic transaction client' });
      const initialVisit = ['deleteVisit', 'deleteClient'].includes(operation) ? await store.createVisit(client.id, {}) : null;
      const method = operation.startsWith('delete') ? 'delete' : 'put';
      const original = IDBObjectStore.prototype[method];
      let requestSucceeded = false, transactionAborted = false, completed = false;
      const transactions = new Set();
      const originalTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = originalTransaction.apply(this, args);
        if (args[1] === 'readwrite') tx.addEventListener('complete', () => { completed = true; }, { once: true });
        return tx;
      };
      IDBObjectStore.prototype[method] = function (...args) {
        const tx = this.transaction;
        transactions.add(tx);
        const storeName = this.name;
        const request = original.apply(this, args);
        request.addEventListener('success', () => {
          requestSucceeded = true;
          if (abort && !transactionAborted && (!abortStore || abortStore === storeName)) { transactionAborted = true; tx.abort(); }
        }, { once: true });
        return request;
      };
      let resolved = false, error = null, result;
      try {
        if (operation === 'createClient') result = await store.createClient({ fullName: 'Should roll back' });
        if (operation === 'updateClient') result = await store.updateClient(client.id, { fullName: 'Updated' });
        if (operation === 'createVisit') result = await store.createVisit(client.id, {});
        if (operation === 'deleteClient') result = await store.deleteClient(client.id);
        if (operation === 'deleteVisit') result = await store.deleteVisit(initialVisit.id);
        resolved = true;
      } catch (e) { error = e.message; }
      finally { IDBObjectStore.prototype[method] = original; IDBDatabase.prototype.transaction = originalTransaction; }
      return { operation, clientId: client.id, initialVisitId: initialVisit?.id, resultId: result?.id,
        requestSucceeded, transactionAborted, resolved, error, completedAtResolution: completed,
        mutationTransactions: transactions.size, mode: await store.whenReady() };
    }, { operation, abort, abortStore });
    await page.reload();
    await page.addScriptTag({ content: source });
    evidence.reopened = await page.evaluate(async id => {
      const store = ClientStore.createClientStore();
      return { mode: await store.whenReady(), client: await store.getClient(id), clients: await store.listClients(), visits: await store.listVisitsForClient(id) };
    }, evidence.clientId);
    return evidence;
  } finally { await context.close(); }
}
for (const operation of ['createClient', 'updateClient', 'createVisit', 'deleteVisit', 'deleteClient']) {
  test(`${operation}: request success followed by transaction abort rejects and preserves state after reload`, async () => {
    const e = await scenario(operation, true);
    assert.equal(e.requestSucceeded, true);
    assert.equal(e.transactionAborted, true);
    assert.equal(e.resolved, false, JSON.stringify(e));
    assert.ok(e.error);
    assert.equal(e.mode, 'indexeddb', 'write failure must never select memory fallback');
    assert.equal(e.reopened.clients.length, 1);
    assert.equal(e.reopened.client.fullName, 'Synthetic transaction client');
    const expected = e.initialVisitId ? [e.initialVisitId] : [];
    assert.deepEqual(e.reopened.client.visitIds, expected);
    assert.deepEqual(e.reopened.visits.map(v => v.id), expected);
    console.log(JSON.stringify({ operation, transactionAborted: e.transactionAborted, createVisitResolved: e.resolved, error: e.error, afterReloadVisits: expected.length, danglingReferences: 0 }));
  });
}
test('createVisit resolves after one atomic transaction completes and both records survive reload', async () => {
  const e = await scenario('createVisit', false);
  assert.equal(e.resolved, true);
  assert.equal(e.completedAtResolution, true);
  assert.equal(e.mutationTransactions, 1);
  assert.equal(e.reopened.mode, 'indexeddb');
  assert.deepEqual(e.reopened.client.visitIds, [e.resultId]);
  assert.deepEqual(e.reopened.visits.map(v => v.id), [e.resultId]);
});

test('createVisit abort on client reference write rolls back the already successful visit request', async () => {
  const e = await scenario('createVisit', true, 'clients');
  assert.equal(e.requestSucceeded, true);
  assert.equal(e.resolved, false);
  assert.ok(e.error);
  assert.equal(e.mutationTransactions, 1);
  assert.deepEqual(e.reopened.client.visitIds, []);
  assert.deepEqual(e.reopened.visits, []);
});
