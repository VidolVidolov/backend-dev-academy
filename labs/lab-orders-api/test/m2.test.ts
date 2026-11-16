// MILESTONE 2 — validation + error handling
// FALSE-POSITIVE GUARDS: every invalid shape is probed separately (missing,
// wrong type, empty, bad values) AND the happy path is re-checked, so neither
// "always 400" nor "always 201" can pass. Malformed JSON must be a 400, not a
// crash-turned-500.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

test('m2: missing items -> 400 with an error message', async () => {
  const res = await app.req('POST', '/orders', { body: {} });
  assert.equal(res.status, 400);
  assert.ok(typeof res.body.error === 'string' && res.body.error.length > 0);
});

test('m2: items of the wrong type (string) -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: 'not-an-array' } });
  assert.equal(res.status, 400);
});

test('m2: empty items array -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: [] } });
  assert.equal(res.status, 400);
});

test('m2: item missing sku -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: [{ qty: 1 }] } });
  assert.equal(res.status, 400);
});

test('m2: empty-string sku -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: [{ sku: '', qty: 1 }] } });
  assert.equal(res.status, 400);
});

test('m2: missing qty -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: [{ sku: 'A' }] } });
  assert.equal(res.status, 400);
});

test('m2: zero or negative qty -> 400', async () => {
  const zero = await app.req('POST', '/orders', { body: { items: [{ sku: 'A', qty: 0 }] } });
  const negative = await app.req('POST', '/orders', { body: { items: [{ sku: 'A', qty: -2 }] } });
  assert.equal(zero.status, 400);
  assert.equal(negative.status, 400);
});

test('m2: non-integer qty -> 400', async () => {
  const res = await app.req('POST', '/orders', { body: { items: [{ sku: 'A', qty: 1.5 }] } });
  assert.equal(res.status, 400);
});

test('m2: invalid JSON body -> 400 (not 500)', async () => {
  const res = await app.req('POST', '/orders', { body: '{ not valid json' });
  assert.equal(res.status, 400, 'malformed JSON must be a client error, not a crash');
  assert.ok(typeof res.body.error === 'string');
});

test('m2: one bad item among good ones -> 400, and a fully valid order still succeeds', async () => {
  const mixed = await app.req('POST', '/orders', {
    body: { items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 0 }] },
  });
  assert.equal(mixed.status, 400, 'every item must be validated, not just the first');
  const valid = await app.req('POST', '/orders', { body: { items: [{ sku: 'A', qty: 3 }] } });
  assert.equal(valid.status, 201, 'validation must not reject valid orders');
});
