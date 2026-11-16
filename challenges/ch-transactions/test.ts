import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTransaction } from './solution.ts';

// FALSE-POSITIVE GUARDS: the fake client records every statement, so ordering
// (BEGIN → work → COMMIT) is asserted literally; both outcomes are probed
// (success commits, failure rolls back); and error identity is checked so a
// wrapper that swallows or re-wraps errors fails.

function fakeClient() {
  const queries: any[] = [];
  return {
    queries,
    query: async (sql: string) => { queries.push(sql); return { rows: [] }; },
  };
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('sends BEGIN before running fn', async () => {
  const client = fakeClient();
  let queriesAtFnStart;
  await withTransaction(client, async () => { queriesAtFnStart = [...client.queries]; });
  assert.deepEqual(queriesAtFnStart, ['BEGIN'], 'fn must run inside an open transaction');
});

test('sends COMMIT after fn succeeds', async () => {
  const client = fakeClient();
  await withTransaction(client, async () => {});
  assert.deepEqual(client.queries, ['BEGIN', 'COMMIT']);
});

test('fn receives the client', async () => {
  const client = fakeClient();
  let received;
  await withTransaction(client, async (tx) => { received = tx; });
  assert.equal(received, client, 'fn must get the client to run its queries on');
});

test('returns fn’s result (randomized)', async () => {
  const client = fakeClient();
  const token = 'result-' + Math.random();
  assert.equal(await withTransaction(client, async () => token), token);
});

test('fn’s queries land between BEGIN and COMMIT', async () => {
  const client = fakeClient();
  await withTransaction(client, async (tx) => {
    await tx.query('UPDATE a');
    await tx.query('UPDATE b');
  });
  assert.deepEqual(client.queries, ['BEGIN', 'UPDATE a', 'UPDATE b', 'COMMIT']);
});

test('an async fn is awaited before COMMIT', async () => {
  const client = fakeClient();
  let workDone = false;
  await withTransaction(client, async () => { await delay(20); workDone = true; });
  assert.equal(workDone, true, 'COMMIT must wait for fn to finish');
  assert.equal(client.queries.at(-1), 'COMMIT');
});

test('sends ROLLBACK when fn rejects', async () => {
  const client = fakeClient();
  await assert.rejects(withTransaction(client, async () => { throw new Error('boom'); }));
  assert.deepEqual(client.queries, ['BEGIN', 'ROLLBACK']);
});

test('rethrows the ORIGINAL error (same identity, not wrapped)', async () => {
  const client = fakeClient();
  const original = new Error('constraint violation');
  await assert.rejects(
    withTransaction(client, async () => { throw original; }),
    (err) => err === original
  );
});

test('never COMMITs on failure', async () => {
  const client = fakeClient();
  await assert.rejects(withTransaction(client, async (tx) => {
    await tx.query('UPDATE a');
    throw new Error('mid-tx failure');
  }));
  assert.ok(!client.queries.includes('COMMIT'), 'a failed transaction must not commit');
  assert.equal(client.queries.at(-1), 'ROLLBACK');
});

test('never ROLLBACKs on success', async () => {
  const client = fakeClient();
  await withTransaction(client, async () => 'fine');
  assert.ok(!client.queries.includes('ROLLBACK'));
});

test('a synchronously-throwing fn still rolls back', async () => {
  const client = fakeClient();
  await assert.rejects(
    withTransaction(client, () => { throw new Error('sync throw'); }),
    /sync throw/
  );
  assert.deepEqual(client.queries, ['BEGIN', 'ROLLBACK']);
});

test('two sequential transactions are independent (no leaked state)', async () => {
  const client = fakeClient();
  await assert.rejects(withTransaction(client, async () => { throw new Error('first fails'); }));
  const token = 'second-' + Math.random();
  const result = await withTransaction(client, async () => token);
  assert.equal(result, token);
  assert.deepEqual(client.queries, ['BEGIN', 'ROLLBACK', 'BEGIN', 'COMMIT']);
});
