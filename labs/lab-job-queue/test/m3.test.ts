// MILESTONE 3 — dedupe + graceful close
// FALSE-POSITIVE GUARDS: dedupe is checked via push's return value AND the
// handler run count, close() is verified to actually WAIT (the graceful-
// shutdown lesson — no process.exit shortcuts here), and both accept/reject
// directions of every rule are probed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/queue.ts';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('m3: a job id already seen is not processed twice', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { runs++; } });
  const id = 'job-' + Math.random().toString(36).slice(2, 8);
  const first = q.push({ id, n: 1 });
  const second = q.push({ id, n: 1 });   // redelivery!
  assert.equal(first, true);
  assert.equal(second, false, 'duplicate push must return false');
  await q.onIdle();
  assert.equal(runs, 1, 'handler must run exactly once per job id');
});

test('m3: dedupe persists even after the job has completed', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { runs++; } });
  q.push({ id: 'done-once' });
  await q.onIdle();
  const again = q.push({ id: 'done-once' });
  assert.equal(again, false, 'a completed id is still a duplicate');
  await q.onIdle();
  assert.equal(runs, 1);
});

test('m3: different ids are all processed', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { runs++; } });
  assert.equal(q.push({ id: 'a' }), true);
  assert.equal(q.push({ id: 'b' }), true);
  assert.equal(q.push({ id: 'c' }), true);
  await q.onIdle();
  assert.equal(runs, 3);
});

test('m3: jobs without ids are never deduped', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { runs++; } });
  assert.equal(q.push({ n: 1 }), true);
  assert.equal(q.push({ n: 1 }), true);
  await q.onIdle();
  assert.equal(runs, 2);
});

test('m3: close() waits for in-flight work to finish', async () => {
  let finished = false;
  const q = createQueue({ handler: async () => { await delay(30); finished = true; } });
  q.push({});
  await q.close();
  assert.equal(finished, true, 'close resolved before the in-flight job finished');
});

test('m3: close() waits for QUEUED (not yet started) work too', async () => {
  let runs = 0;
  const q = createQueue({ handler: async () => { await delay(10); runs++; }, concurrency: 1 });
  q.push({});
  q.push({});
  q.push({});
  await q.close();
  assert.equal(runs, 3, 'close must drain the backlog, not just in-flight jobs');
});

test('m3: close() also waits for scheduled retries to drain', async () => {
  let tries = 0;
  const q = createQueue({
    handler: async () => { tries++; if (tries < 2) throw new Error('flaky'); },
    maxAttempts: 3,
    baseDelayMs: 5,
  });
  q.push({});
  await q.close();
  assert.equal(tries, 2, 'the retry must complete before close resolves');
  assert.equal(q.processed, 1);
});

test('m3: push after close throws', async () => {
  const q = createQueue({ handler: async () => {} });
  await q.close();
  assert.throws(() => q.push({}), /closed/i);
});

test('m3: close() on an empty queue resolves immediately', async () => {
  const q = createQueue({ handler: async () => {} });
  await q.close(); // must not hang
  assert.equal(q.processed, 0);
});

test('m3: counters are consistent after close', async () => {
  const q = createQueue({
    handler: async (job) => { if (job.bad) throw new Error('x'); },
    maxAttempts: 2,
    baseDelayMs: 1,
  });
  q.push({ id: 'ok-1' });
  q.push({ id: 'ok-1' });          // dup — ignored
  q.push({ id: 'bad-1', bad: true });
  await q.close();
  assert.equal(q.processed, 1, 'one success');
  assert.equal(q.dlq.length, 1, 'one dead-lettered job');
  assert.equal(q.active, 0, 'nothing left running');
});
