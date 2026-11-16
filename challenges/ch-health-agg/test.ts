import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth } from './solution.ts';

// FALSE-POSITIVE GUARDS: error messages are randomized and asserted verbatim,
// parallelism is proven by wall-clock (serial implementations blow the budget),
// and a never-settling check proves the timeout actually fires.

const delay = (ms: number, v?: unknown): Promise<unknown> => new Promise((r) => setTimeout(() => r(v), ms));

test('all passing checks -> ok true', async () => {
  const result = await checkHealth({
    postgres: async () => {},
    redis: async () => {},
  }, { timeoutMs: 500 });
  assert.equal(result.ok, true);
});

test('each check appears in the result with ok true', async () => {
  const result = await checkHealth({ a: async () => {}, b: async () => {} }, { timeoutMs: 500 });
  assert.equal(result.checks.a.ok, true);
  assert.equal(result.checks.b.ok, true);
});

test('the result contains exactly the given check names', async () => {
  const result = await checkHealth({ one: async () => {}, two: async () => {} }, { timeoutMs: 500 });
  assert.deepEqual(Object.keys(result.checks).sort(), ['one', 'two']);
});

test('a rejecting check makes overall ok false', async () => {
  const result = await checkHealth({
    good: async () => {},
    bad: async () => { throw new Error('down'); },
  }, { timeoutMs: 500 });
  assert.equal(result.ok, false);
});

test('the failing check carries its error message (randomized)', async () => {
  const marker = 'refused-' + Math.random().toString(36).slice(2, 8);
  const result = await checkHealth({
    redis: async () => { throw new Error(marker); },
  }, { timeoutMs: 500 });
  assert.equal(result.checks.redis.ok, false);
  assert.ok(result.checks.redis.error!.includes(marker), 'the real error message must surface');
});

test('one bad check does not hide the good ones', async () => {
  const result = await checkHealth({
    bad: async () => { throw new Error('x'); },
    good: async () => {},
    alsoGood: async () => {},
  }, { timeoutMs: 500 });
  assert.equal(result.checks.good.ok, true);
  assert.equal(result.checks.alsoGood.ok, true);
});

test('a synchronously-throwing check is handled like a rejection', async () => {
  const result = await checkHealth({
    sync: () => { throw new Error('sync boom'); },
  }, { timeoutMs: 500 });
  assert.equal(result.checks.sync.ok, false);
  assert.match(result.checks.sync.error!, /sync boom/);
});

test('a check slower than timeoutMs fails with a timeout error', async () => {
  const result = await checkHealth({
    slow: () => delay(500),
  }, { timeoutMs: 50 });
  assert.equal(result.checks.slow.ok, false);
  assert.match(result.checks.slow.error!, /timeout/i);
});

test('a check that NEVER settles still times out', async () => {
  // Outer 2s guard: if the solution has no working timeout, this test fails
  // fast instead of hanging the whole suite until the grader kills it.
  const guard = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('checkHealth never returned — your timeout is not firing')), 2000).unref());
  const result = await Promise.race([
    checkHealth({ hung: () => new Promise(() => {}) }, { timeoutMs: 50 }),
    guard,
  ]);
  assert.equal(result.ok, false);
  assert.match(result.checks.hung.error!, /timeout/i);
});

test('a fast check is not timed out', async () => {
  const result = await checkHealth({ quick: () => delay(10) }, { timeoutMs: 200 });
  assert.equal(result.checks.quick.ok, true);
});

test('checks run in PARALLEL (wall clock ≈ slowest, not the sum)', async () => {
  const start = Date.now();
  const result = await checkHealth({
    a: () => delay(60),
    b: () => delay(60),
    c: () => delay(60),
  }, { timeoutMs: 1000 });
  const elapsed = Date.now() - start;
  assert.equal(result.ok, true);
  assert.ok(elapsed < 150, `three 60ms checks took ${elapsed}ms — they must run concurrently, not sequentially`);
});

test('an empty checks object -> ok true with empty checks', async () => {
  const result = await checkHealth({}, { timeoutMs: 100 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks, {});
});
