import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdempotencyStore } from './solution.ts';

const delay = (ms: number, v?: unknown): Promise<unknown> => new Promise((r) => setTimeout(() => r(v), ms));
const rkey = () => 'k' + Math.floor(Math.random() * 1e9);

// FALSE-POSITIVE GUARDS: keys are randomized, fn call counts are asserted so a
// no-op cache is caught, concurrency is exercised (the hard part), and rejection
// handling is checked so a solution that caches failures fails here.

test('runs fn once per key and caches the result', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const fn = async () => { calls++; return 'charged'; };
  const k = rkey();
  assert.equal(await store.run(k, fn), 'charged');
  assert.equal(await store.run(k, fn), 'charged');
  assert.equal(calls, 1);
});

test('the cached value is returned without re-invoking fn', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  await store.run(k, async () => { calls++; return 1; });
  await store.run(k, async () => { calls++; return 2; }); // different fn, same key
  assert.equal(calls, 1, 'second call must not invoke any fn');
  assert.equal(await store.run(k, async () => 99), 1, 'still the first cached value');
});

test('different keys run independently', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const fn = async () => { calls++; return calls; };
  await store.run(rkey(), fn);
  await store.run(rkey(), fn);
  assert.equal(calls, 2);
});

test('many distinct keys each execute exactly once', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const keys = Array.from({ length: 20 }, () => rkey());
  for (const k of keys) await store.run(k, async () => { calls++; });
  for (const k of keys) await store.run(k, async () => { calls++; }); // repeat
  assert.equal(calls, 20);
});

test('concurrent same-key calls share ONE execution', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  const fn = () => { calls++; return delay(30, 'ok'); };
  const results = await Promise.all([store.run(k, fn), store.run(k, fn), store.run(k, fn)]);
  assert.deepEqual(results, ['ok', 'ok', 'ok']);
  assert.equal(calls, 1, 'fn must execute exactly once for concurrent same-key calls');
});

test('concurrent same-key calls all resolve to the same value', async () => {
  const store = createIdempotencyStore();
  const k = rkey();
  const token = 'tok-' + Math.random();
  const fn = () => delay(20, token);
  const results = await Promise.all([store.run(k, fn), store.run(k, fn)]);
  assert.deepEqual(results, [token, token]);
});

test('an object result is cached by reference', async () => {
  const store = createIdempotencyStore();
  const k = rkey();
  const fn = async () => ({ ok: true });
  const a = await store.run(k, fn);
  const b = await store.run(k, fn);
  assert.equal(a, b, 'cached result should be the same object reference');
});

test('a synchronous fn is supported and cached', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  const fn = () => { calls++; return 42; };
  assert.equal(await store.run(k, fn), 42);
  assert.equal(await store.run(k, fn), 42);
  assert.equal(calls, 1);
});

test('rejection is NOT cached; a later call may retry', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  const fn = async () => { calls++; if (calls === 1) throw new Error('fail'); return 'ok'; };
  await assert.rejects(store.run(k, fn));
  assert.equal(await store.run(k, fn), 'ok');
  assert.equal(calls, 2);
});

test('concurrent rejecting calls all reject, then a retry succeeds', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  const fn = () => { calls++; return delay(20).then(() => { throw new Error('boom'); }); };
  const settled = await Promise.allSettled([store.run(k, fn), store.run(k, fn), store.run(k, fn)]);
  assert.ok(settled.every((s) => s.status === 'rejected'), 'all concurrent calls should reject');
  assert.equal(calls, 1, 'the shared in-flight execution runs once');
  assert.equal(await store.run(k, async () => 'recovered'), 'recovered');
  assert.equal(calls, 1);
});

test('two independent stores do not share keys', async () => {
  const a = createIdempotencyStore();
  const b = createIdempotencyStore();
  let calls = 0;
  const k = 'shared-key';
  await a.run(k, async () => { calls++; });
  await b.run(k, async () => { calls++; });
  assert.equal(calls, 2, 'each store has its own key space');
});

test('a cached key stays cached across later, unrelated runs', async () => {
  const store = createIdempotencyStore();
  let calls = 0;
  const k = rkey();
  await store.run(k, async () => { calls++; return 'first'; });
  await store.run(rkey(), async () => { calls++; });
  assert.equal(await store.run(k, async () => 'nope'), 'first');
  assert.equal(calls, 2, 'the original key was not re-run');
});
