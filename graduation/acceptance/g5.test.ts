// G5 — Kafka: outbox -> topic -> consumer -> order confirmed
// FALSE-POSITIVE GUARDS: the async pipeline is verified end to end (created ->
// confirmed), the audit trail is checked for presence, ORDER, and exactly-once
// confirmation (a non-idempotent consumer fails), and a second independent
// order proves the pipeline isn't a one-shot.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { req, registerAndLogin, delay } from './client.ts';

let me: Awaited<ReturnType<typeof registerAndLogin>>;
before(async () => { me = await registerAndLogin(); });

async function createAndAwaitConfirmation() {
  const created = await req('POST', '/orders', { body: { items: [{ sku: 'K-1', qty: 1 }] }, headers: me.auth });
  assert.equal(created.status, 201);

  // The pipeline is asynchronous by design — poll up to 15s.
  const deadline = Date.now() + 15000;
  let latest = created.body;
  while (Date.now() < deadline && latest.status !== 'confirmed') {
    await delay(500);
    latest = (await req('GET', `/orders/${created.body.id}`, { headers: me.auth })).body;
  }
  return { id: created.body.id, initial: created.body, latest };
}

// One shared confirmed order for the audit-trail assertions (tests in a file
// run sequentially, so this resolves once and is reused).
let shared: Awaited<ReturnType<typeof createAndAwaitConfirmation>>;
const getShared = async () => (shared ??= await createAndAwaitConfirmation());

test('g5: a fresh order starts as "created"', async () => {
  const res = await req('POST', '/orders', { body: { items: [{ sku: 'K-0', qty: 1 }] }, headers: me.auth });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'created', 'a fresh order starts as "created" — confirmation is async');
});

test('g5: the consumer confirms the order within 15s (outbox -> Kafka -> consumer)', async () => {
  const { latest } = await getShared();
  assert.equal(latest.status, 'confirmed',
    'order never became "confirmed" — is the outbox relay running? is the consumer consuming?');
});

test('g5: the events endpoint returns an array', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`, { headers: me.auth });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), '/orders/:id/events must return an array');
});

test('g5: events include order.created', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`, { headers: me.auth });
  assert.ok(res.body.map((e: any) => e.type).includes('order.created'), 'events must include order.created');
});

test('g5: events include order.confirmed after confirmation', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`, { headers: me.auth });
  assert.ok(res.body.map((e: any) => e.type).includes('order.confirmed'), 'events must include order.confirmed');
});

test('g5: order.confirmed appears EXACTLY once (idempotent consumer)', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`, { headers: me.auth });
  const confirms = res.body.filter((e: any) => e.type === 'order.confirmed').length;
  assert.equal(confirms, 1,
    `order.confirmed appears ${confirms} times — your consumer is not idempotent under redelivery`);
});

test('g5: order.created comes before order.confirmed in the trail', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`, { headers: me.auth });
  const types = res.body.map((e: any) => e.type);
  assert.ok(types.indexOf('order.created') < types.indexOf('order.confirmed'),
    'the audit trail must be in causal order');
});

test('g5: the events endpoint requires auth', async () => {
  const { id } = await getShared();
  const res = await req('GET', `/orders/${id}/events`);
  assert.equal(res.status, 401);
});

test('g5: another user cannot read my order events (404)', async () => {
  const { id } = await getShared();
  const stranger = await registerAndLogin();
  const res = await req('GET', `/orders/${id}/events`, { headers: stranger.auth });
  assert.equal(res.status, 404, 'events must be ownership-guarded like the order itself');
});

test('g5: a second, independent order is also confirmed (pipeline is not one-shot)', async () => {
  const { latest } = await createAndAwaitConfirmation();
  assert.equal(latest.status, 'confirmed', 'the pipeline must keep working for subsequent orders');
});
