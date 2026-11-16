// MILESTONE 1 — routing + CRUD
// FALSE-POSITIVE GUARDS: payloads are randomized so hardcoded responses fail,
// and every route is probed in both the found and not-found direction.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

const randSku = () => 'SKU-' + Math.random().toString(36).slice(2, 8);

test('m1: GET /health returns 200 { ok: true }', async () => {
  const res = await app.req('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('m1: POST /orders creates an order with 201, an id, and status created', async () => {
  const items = [{ sku: randSku(), qty: 2 }];
  const res = await app.req('POST', '/orders', { body: { items } });
  assert.equal(res.status, 201);
  assert.ok(res.body.id, 'order should have an id');
  assert.equal(res.body.status, 'created');
  assert.deepEqual(res.body.items, items);
});

test('m1: each created order gets a unique id', async () => {
  const a = await app.req('POST', '/orders', { body: { items: [{ sku: randSku(), qty: 1 }] } });
  const b = await app.req('POST', '/orders', { body: { items: [{ sku: randSku(), qty: 1 }] } });
  assert.ok(a.body.id && b.body.id);
  assert.notEqual(a.body.id, b.body.id, 'two orders must not share an id');
});

test('m1: GET /orders/:id returns the created order', async () => {
  const created = await app.req('POST', '/orders', { body: { items: [{ sku: randSku(), qty: 1 }] } });
  const res = await app.req('GET', '/orders/' + created.body.id);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, created.body.id);
});

test('m1: GET /orders/:id returns the exact items that were posted', async () => {
  const items = [{ sku: randSku(), qty: 3 }, { sku: randSku(), qty: 7 }];
  const created = await app.req('POST', '/orders', { body: { items } });
  const res = await app.req('GET', '/orders/' + created.body.id);
  assert.deepEqual(res.body.items, items, 'stored order must reflect the posted items');
});

test('m1: two different orders are each retrievable by their own id', async () => {
  const a = await app.req('POST', '/orders', { body: { items: [{ sku: 'AAA', qty: 1 }] } });
  const b = await app.req('POST', '/orders', { body: { items: [{ sku: 'BBB', qty: 2 }] } });
  const gotA = await app.req('GET', '/orders/' + a.body.id);
  const gotB = await app.req('GET', '/orders/' + b.body.id);
  assert.equal(gotA.body.items[0].sku, 'AAA');
  assert.equal(gotB.body.items[0].sku, 'BBB');
});

test('m1: GET /orders/:id for an unknown id returns 404 with an error message', async () => {
  const res = await app.req('GET', '/orders/does-not-exist');
  assert.equal(res.status, 404);
  assert.ok(typeof res.body.error === 'string' && res.body.error.length > 0);
});

test('m1: an unknown route returns 404', async () => {
  const res = await app.req('GET', '/nope');
  assert.equal(res.status, 404);
});

test('m1: POST to an unknown route returns 404', async () => {
  const res = await app.req('POST', '/not-a-route', { body: {} });
  assert.equal(res.status, 404);
});

test('m1: responses are JSON (parseable bodies) on both success and error', async () => {
  const ok = await app.req('GET', '/health');
  const notFound = await app.req('GET', '/orders/none');
  assert.ok(ok.body !== null, 'success responses must be JSON');
  assert.ok(notFound.body !== null, 'error responses must be JSON too');
});
