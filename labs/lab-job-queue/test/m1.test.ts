// MILESTONE 1 — dispatch with bounded concurrency
// FALSE-POSITIVE GUARDS: peak concurrency is measured live (not inferred), the
// limit is checked as BOTH a ceiling and a floor (the queue must actually use
// its slots), and job counts are randomized.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/queue.ts';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('m1: all pushed jobs are processed', async () => {
  const count = 5 + Math.floor(Math.random() * 10);
  const done = [];
  const q = createQueue({ handler: async (job) => { done.push(job.n); }, concurrency: 2 });
  for (let n = 1; n <= count; n++) q.push({ n });
  await q.onIdle();
  assert.equal(done.length, count);
  assert.equal(q.processed, count);
});

test('m1: the job payload arrives at the handler intact', async () => {
  const payloads: any[] = [];
  const q = createQueue({ handler: async (job) => { payloads.push(job); } });
  const job = { n: 1, nested: { token: 'tok-' + Math.random() } };
  q.push(job);
  await q.onIdle();
  assert.deepEqual(payloads, [job]);
});

test('m1: never runs more than `concurrency` handlers at once', async () => {
  let current = 0;
  let peak = 0;
  const q = createQueue({
    handler: async () => {
      current++;
      peak = Math.max(peak, current);
      await delay(20);
      current--;
    },
    concurrency: 2,
  });
  for (let i = 0; i < 6; i++) q.push({ i });
  await q.onIdle();
  assert.equal(q.processed, 6);
  assert.ok(peak <= 2, `peak concurrency was ${peak}, limit is 2`);
});

test('m1: actually uses all available slots (not secretly serial)', async () => {
  let current = 0;
  let peak = 0;
  const q = createQueue({
    handler: async () => { current++; peak = Math.max(peak, current); await delay(20); current--; },
    concurrency: 3,
  });
  for (let i = 0; i < 9; i++) q.push({ i });
  await q.onIdle();
  assert.equal(peak, 3, 'with 9 queued jobs the queue should saturate all 3 slots');
});

test('m1: concurrency 1 runs jobs strictly one at a time', async () => {
  let current = 0;
  let peak = 0;
  const q = createQueue({
    handler: async () => { current++; peak = Math.max(peak, current); await delay(10); current--; },
    concurrency: 1,
  });
  for (let i = 0; i < 4; i++) q.push({ i });
  await q.onIdle();
  assert.equal(peak, 1);
});

test('m1: concurrency 1 preserves push order', async () => {
  const order: any[] = [];
  const q = createQueue({ handler: async (job) => { await delay(5); order.push(job.n); }, concurrency: 1 });
  for (let n = 1; n <= 5; n++) q.push({ n });
  await q.onIdle();
  assert.deepEqual(order, [1, 2, 3, 4, 5], 'a single-slot queue is FIFO');
});

test('m1: onIdle resolves immediately on an empty queue', async () => {
  const q = createQueue({ handler: async () => {} });
  await q.onIdle(); // must not hang
  assert.equal(q.processed, 0);
});

test('m1: active reflects in-flight handlers and returns to 0', async () => {
  const q = createQueue({ handler: () => delay(30), concurrency: 1 });
  q.push({});
  await delay(10);
  assert.equal(q.active, 1);
  await q.onIdle();
  assert.equal(q.active, 0);
});

test('m1: onIdle can be awaited again after new work arrives', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { runs++; await delay(5); } });
  q.push({});
  await q.onIdle();
  assert.equal(runs, 1);
  q.push({});
  q.push({});
  await q.onIdle();
  assert.equal(runs, 3, 'the queue keeps working after going idle once');
});

test('m1: several concurrent onIdle waiters all resolve', async () => {
  const q = createQueue({ handler: () => delay(20) });
  q.push({});
  await Promise.all([q.onIdle(), q.onIdle(), q.onIdle()]);
  assert.equal(q.processed, 1);
});
