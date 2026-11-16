// MILESTONE 3 — idempotency keys (safe retries)
// FALSE-POSITIVE GUARDS: keys are randomized, the store's order count is
// asserted (not just response equality), and validation/no-key behavior is
// re-checked so a solution that blindly caches every POST fails.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

const randKey = () => 'key-' + Math.random().toString(36).slice(2, 10);
const orderBody = () => ({ items: [{ sku: 'S-' + Math.random().toString(36).slice(2, 6), qty: 1 }] });

test('m3: the same idempotency-key returns the same order id', async () => {
  const headers = { 'idempotency-key': randKey() };
  const body = orderBody();
  const first = await app.req('POST', '/orders', { body, headers });
  const second = await app.req('POST', '/orders', { body, headers });
  assert.equal(first.status, 201);
  assert.ok(second.status === 200 || second.status === 201, 'replay must succeed');
  assert.equal(first.body.id, second.body.id, 'retry must return the SAME order id');
});

test('m3: a replayed key creates only ONE order in the store', async () => {
  const sizeBefore = app.store.orders.size;
  const headers = { 'idempotency-key': randKey() };
  const body = orderBody();
  await app.req('POST', '/orders', { body, headers });
  await app.req('POST', '/orders', { body, headers });
  assert.equal(app.store.orders.size, sizeBefore + 1, 'the retry must not create a second order');
});

test('m3: three replays still yield one order and identical ids', async () => {
  const sizeBefore = app.store.orders.size;
  const headers = { 'idempotency-key': randKey() };
  const body = orderBody();
  const r1 = await app.req('POST', '/orders', { body, headers });
  const r2 = await app.req('POST', '/orders', { body, headers });
  const r3 = await app.req('POST', '/orders', { body, headers });
  assert.equal(new Set([r1.body.id, r2.body.id, r3.body.id]).size, 1);
  assert.equal(app.store.orders.size, sizeBefore + 1);
});

test('m3: the replayed response body matches the original order', async () => {
  const headers = { 'idempotency-key': randKey() };
  const body = orderBody();
  const first = await app.req('POST', '/orders', { body, headers });
  const second = await app.req('POST', '/orders', { body, headers });
  assert.deepEqual(second.body.items, first.body.items, 'replay must return the stored order, not a new one');
});

test('m3: a different key creates a different order', async () => {
  const body = orderBody();
  const a = await app.req('POST', '/orders', { body, headers: { 'idempotency-key': randKey() } });
  const b = await app.req('POST', '/orders', { body, headers: { 'idempotency-key': randKey() } });
  assert.notEqual(a.body.id, b.body.id, 'distinct keys are distinct requests');
});

test('m3: a key still replays its own order after other keys were used', async () => {
  const key = randKey();
  const original = await app.req('POST', '/orders', { body: orderBody(), headers: { 'idempotency-key': key } });
  await app.req('POST', '/orders', { body: orderBody(), headers: { 'idempotency-key': randKey() } });
  await app.req('POST', '/orders', { body: orderBody(), headers: { 'idempotency-key': randKey() } });
  const replay = await app.req('POST', '/orders', { body: orderBody(), headers: { 'idempotency-key': key } });
  assert.equal(replay.body.id, original.body.id, 'interleaved requests must not evict the key');
});

test('m3: no key means every POST creates a fresh order', async () => {
  const body = orderBody();
  const a = await app.req('POST', '/orders', { body });
  const b = await app.req('POST', '/orders', { body });
  assert.notEqual(a.body.id, b.body.id, 'without a key there is nothing to deduplicate');
});

test('m3: the order created under a key is retrievable via GET', async () => {
  const headers = { 'idempotency-key': randKey() };
  const created = await app.req('POST', '/orders', { body: orderBody(), headers });
  const got = await app.req('GET', '/orders/' + created.body.id);
  assert.equal(got.status, 200);
  assert.equal(got.body.id, created.body.id);
});

test('m3: an invalid body with a key is still rejected with 400', async () => {
  const res = await app.req('POST', '/orders', {
    body: { items: [] },
    headers: { 'idempotency-key': randKey() },
  });
  assert.equal(res.status, 400, 'idempotency must not bypass validation');
});

test('m3: a key that only ever saw an invalid request is not burned', async () => {
  const key = randKey();
  await app.req('POST', '/orders', { body: { items: [] }, headers: { 'idempotency-key': key } });
  const valid = await app.req('POST', '/orders', { body: orderBody(), headers: { 'idempotency-key': key } });
  assert.equal(valid.status, 201, 'a failed request must not cache a response for its key');
  assert.ok(valid.body.id);
});
