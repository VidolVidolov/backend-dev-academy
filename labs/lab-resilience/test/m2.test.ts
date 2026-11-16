// MILESTONE 2 — withRetry
// FALSE-POSITIVE GUARDS: call counts are asserted exactly for every scenario
// (first-try success, transient recovery, exhaustion, non-retryable), so both
// "never retry" and "retry forever" implementations fail. Backoff is verified
// by measuring elapsed time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/resilience.ts';

test('m2: a function that succeeds first try is called exactly once', async () => {
  let calls = 0;
  const token = 'v-' + Math.random();
  const result = await withRetry(async () => { calls++; return token; }, { attempts: 5, baseMs: 1 });
  assert.equal(result, token);
  assert.equal(calls, 1, 'no retries needed, none taken');
});

test('m2: succeeds after transient failures', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new Error('transient');
    return 'finally';
  }, { attempts: 5, baseMs: 1 });
  assert.equal(result, 'finally');
  assert.equal(calls, 3);
});

test('m2: stops retrying as soon as a call succeeds', async () => {
  let calls = 0;
  await withRetry(async () => { calls++; if (calls < 2) throw new Error('x'); return 'ok'; },
    { attempts: 10, baseMs: 1 });
  assert.equal(calls, 2, 'must not keep calling after success');
});

test('m2: throws the LAST error after exhausting attempts', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error('always ' + calls); }, { attempts: 3, baseMs: 1 }),
    /always 3/
  );
  assert.equal(calls, 3);
});

test('m2: attempts: 1 means a single try, no retries', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error('nope'); }, { attempts: 1, baseMs: 1 })
  );
  assert.equal(calls, 1);
});

test('m2: non-retryable errors are NOT retried', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      const e = new Error('400 bad request') as Error & { retryable?: boolean };
      e.retryable = false;
      throw e;
    }, { attempts: 5, baseMs: 1 }),
    /bad request/
  );
  assert.equal(calls, 1, 'a non-retryable error must fail immediately');
});

test('m2: the non-retryable error is rethrown with its identity intact', async () => {
  const original = new Error('403 forbidden') as Error & { retryable?: boolean };
  original.retryable = false;
  await assert.rejects(
    withRetry(async () => { throw original; }, { attempts: 5, baseMs: 1 }),
    (err: any) => err === original
  );
});

test('m2: passes the attempt number to fn (1-based)', async () => {
  const seen: number[] = [];
  await withRetry(async (attempt) => {
    seen.push(attempt);
    if (attempt < 3) throw new Error('again');
    return 'ok';
  }, { attempts: 3, baseMs: 1 });
  assert.deepEqual(seen, [1, 2, 3]);
});

test('m2: waits with exponential backoff between attempts', async () => {
  let calls = 0;
  const start = Date.now();
  await withRetry(async () => { calls++; if (calls < 3) throw new Error('x'); return 'ok'; },
    { attempts: 3, baseMs: 30 });
  const elapsed = Date.now() - start;
  // Two waits: 30ms then 60ms = 90ms minimum (with scheduling slack).
  assert.ok(elapsed >= 80, `expected >=80ms of backoff, took ${elapsed}ms — is the delay actually happening?`);
});

test('m2: a synchronous return value is passed through unchanged', async () => {
  const obj = { data: Math.random() };
  const result = await withRetry(async () => obj, { attempts: 3, baseMs: 1 });
  assert.equal(result, obj);
});
