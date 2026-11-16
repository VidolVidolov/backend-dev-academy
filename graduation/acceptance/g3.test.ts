// G3 — Orders: validation, cursor pagination, idempotency, optimistic locking
// FALSE-POSITIVE GUARDS: duplicate-order checks count ACTUAL orders through the
// API (fresh user + list), pagination is verified for coverage AND isolation,
// and locking is probed with both the fresh and the stale version.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { req, registerAndLogin, uniq } from './client.ts';

let me: Awaited<ReturnType<typeof registerAndLogin>>;
before(async () => { me = await registerAndLogin(); });

const items = [{ sku: 'WIDGET-1', qty: 2 }];

test('g3: creating an order requires auth', async () => {
  assert.equal((await req('POST', '/orders', { body: { items } })).status, 401);
});

test('g3: valid create -> 201 with status created and version 1', async () => {
  const res = await req('POST', '/orders', { body: { items }, headers: me.auth });
  assert.equal(res.status, 201);
  assert.ok(res.body.id);
  assert.equal(res.body.status, 'created');
  assert.equal(res.body.version, 1);
});

test('g3: invalid bodies -> 400', async () => {
  for (const bad of [{}, { items: [] }, { items: [{ qty: 1 }] }, { items: [{ sku: 'X', qty: 0 }] }, { items: [{ sku: 'X', qty: 1.5 }] }]) {
    const res = await req('POST', '/orders', { body: bad, headers: me.auth });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
});

test('g3: idempotency-key replay returns the SAME order', async () => {
  const key = `grad-key-${uniq()}`;
  const a = await req('POST', '/orders', { body: { items }, headers: { ...me.auth, 'idempotency-key': key } });
  const b = await req('POST', '/orders', { body: { items }, headers: { ...me.auth, 'idempotency-key': key } });
  assert.equal(a.body.id, b.body.id, 'a retried POST with the same key must not create a second order');
});

test('g3: a replayed key creates exactly ONE order (verified via the list)', async () => {
  const fresh = await registerAndLogin();
  const key = `grad-count-${uniq()}`;
  await req('POST', '/orders', { body: { items }, headers: { ...fresh.auth, 'idempotency-key': key } });
  await req('POST', '/orders', { body: { items }, headers: { ...fresh.auth, 'idempotency-key': key } });
  await req('POST', '/orders', { body: { items }, headers: { ...fresh.auth, 'idempotency-key': key } });
  const list = await req('GET', '/orders', { headers: fresh.auth });
  assert.equal(list.body.items.length, 1, 'three keyed retries must leave exactly one order');
});

test('g3: different keys create different orders', async () => {
  const a = await req('POST', '/orders', { body: { items }, headers: { ...me.auth, 'idempotency-key': `k-${uniq()}` } });
  const b = await req('POST', '/orders', { body: { items }, headers: { ...me.auth, 'idempotency-key': `k-${uniq()}` } });
  assert.notEqual(a.body.id, b.body.id);
});

test('g3: cursor pagination pages through with no overlap and no leftovers', async () => {
  const pager = await registerAndLogin();           // fresh user -> clean count
  for (let i = 0; i < 15; i++) {
    const r = await req('POST', '/orders', { body: { items: [{ sku: `S-${i}`, qty: 1 }] }, headers: pager.auth });
    assert.equal(r.status, 201);
  }
  const p1 = await req('GET', '/orders?limit=10', { headers: pager.auth });
  assert.equal(p1.status, 200);
  assert.equal(p1.body.items.length, 10);
  assert.ok(p1.body.nextCursor, 'first page must include nextCursor');

  const p2 = await req('GET', `/orders?limit=10&cursor=${encodeURIComponent(p1.body.nextCursor)}`, { headers: pager.auth });
  assert.equal(p2.body.items.length, 5);
  assert.ok(!p2.body.nextCursor, 'last page must not have a nextCursor');

  const ids = new Set([...p1.body.items, ...p2.body.items].map((o) => o.id));
  assert.equal(ids.size, 15, 'pages must not overlap or skip');
});

test('g3: the list contains ONLY my orders', async () => {
  const isolated = await registerAndLogin();
  const mine = await req('POST', '/orders', { body: { items }, headers: { ...isolated.auth } });
  await req('POST', '/orders', { body: { items }, headers: me.auth }); // someone else's order
  const list = await req('GET', '/orders', { headers: isolated.auth });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].id, mine.body.id, 'another user’s orders leaked into my list');
});

test('g3: ownership — another user gets 404, unknown id gets 404', async () => {
  const mine = await req('POST', '/orders', { body: { items }, headers: me.auth });
  const stranger = await registerAndLogin();
  assert.equal((await req('GET', `/orders/${mine.body.id}`, { headers: stranger.auth })).status, 404,
    'return 404 (not 403) for someone else\'s order — don\'t leak existence');
  assert.equal((await req('GET', '/orders/does-not-exist', { headers: me.auth })).status, 404);
});

test('g3: optimistic locking — correct version increments, stale version 409', async () => {
  const order = await req('POST', '/orders', { body: { items }, headers: me.auth });
  const ok = await req('PATCH', `/orders/${order.body.id}`, {
    body: { status: 'cancelled', version: 1 }, headers: me.auth,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.version, 2);

  const stale = await req('PATCH', `/orders/${order.body.id}`, {
    body: { status: 'cancelled', version: 1 }, headers: me.auth,   // version 1 is stale now
  });
  assert.equal(stale.status, 409, 'a stale version must be rejected with 409 Conflict');
});
