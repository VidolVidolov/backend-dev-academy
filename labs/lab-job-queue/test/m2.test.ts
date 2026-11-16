// MILESTONE 2 — retries with backoff + dead-letter queue
// FALSE-POSITIVE GUARDS: backoff math is checked with a randomized base (no
// hardcoding), attempt counts are asserted exactly, and the DLQ entry's shape
// (job, attempts, error) is verified — not just its length.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, computeBackoff } from '../src/queue.ts';

test('m2: computeBackoff doubles per attempt (randomized base)', () => {
  const base = (1 + Math.floor(Math.random() * 20)) * 10;
  assert.equal(computeBackoff(1, base), base);
  assert.equal(computeBackoff(2, base), base * 2);
  assert.equal(computeBackoff(3, base), base * 4);
  assert.equal(computeBackoff(5, base), base * 16);
});

test('m2: computeBackoff caps at capMs', () => {
  assert.equal(computeBackoff(10, 100, 1000), 1000, 'must cap at capMs');
  assert.equal(computeBackoff(4, 300, 500), 500);
});

test('m2: computeBackoff has a default cap', () => {
  assert.equal(computeBackoff(20, 100), 30000, 'without capMs the default 30s cap applies');
});

test('m2: a flaky job is retried until it succeeds', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; if (tries < 3) throw new Error('transient'); },
    maxAttempts: 5,
    baseDelayMs: 1,
  });
  q.push({ name: 'flaky' });
  await q.onIdle();
  assert.equal(tries, 3, 'should have failed twice then succeeded');
  assert.equal(q.processed, 1);
});

test('m2: a job that eventually succeeds does NOT land in the DLQ', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; if (tries < 2) throw new Error('once'); },
    maxAttempts: 3,
    baseDelayMs: 1,
  });
  q.push({});
  await q.onIdle();
  assert.equal(q.dlq.length, 0);
});

test('m2: a retried job counts as processed ONCE', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; if (tries < 4) throw new Error('x'); },
    maxAttempts: 5,
    baseDelayMs: 1,
  });
  q.push({});
  await q.onIdle();
  assert.equal(q.processed, 1, 'retries of one job are not extra processed jobs');
});

test('m2: a poison job lands in the DLQ after exactly maxAttempts tries', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; throw new Error('always broken'); },
    maxAttempts: 3,
    baseDelayMs: 1,
  });
  q.push({ name: 'poison' });
  await q.onIdle();
  assert.equal(tries, 3, 'must stop retrying after maxAttempts');
  assert.equal(q.processed, 0);
  assert.equal(q.dlq.length, 1);
});

test('m2: the DLQ entry records the job, the attempt count, and the error', async () => {
  const q = createQueue({
    handler: async () => { throw new Error('always broken'); },
    maxAttempts: 3,
    baseDelayMs: 1,
  });
  const marker = 'poison-' + Math.random().toString(36).slice(2, 8);
  q.push({ name: marker });
  await q.onIdle();
  assert.equal(q.dlq[0].attempts, 3);
  assert.equal(q.dlq[0].job.name, marker);
  assert.match(q.dlq[0].error, /always broken/);
});

test('m2: maxAttempts 1 means no retries at all', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; throw new Error('nope'); },
    maxAttempts: 1,
    baseDelayMs: 1,
  });
  q.push({});
  await q.onIdle();
  assert.equal(tries, 1);
  assert.equal(q.dlq.length, 1);
});

test('m2: one poison job does not block healthy jobs', async () => {
  const q = createQueue({
    handler: async (job) => { if (job.bad) throw new Error('nope'); },
    concurrency: 1,
    maxAttempts: 2,
    baseDelayMs: 1,
  });
  q.push({ bad: true });
  q.push({ bad: false });
  q.push({ bad: false });
  await q.onIdle();
  assert.equal(q.processed, 2, 'healthy jobs complete despite the poison one');
  assert.equal(q.dlq.length, 1);
});
