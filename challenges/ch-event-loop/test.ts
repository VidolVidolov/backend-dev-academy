import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapInChunks } from './solution.ts';

// FALSE-POSITIVE GUARDS: inputs are randomized so a hardcoded return can't pass,
// order is checked so a reordering (or Promise.all) implementation fails, and a
// dedicated test proves the function actually YIELDS to the event loop rather
// than just doing a synchronous items.map().

test('maps all items in order (large input)', async () => {
  const input = Array.from({ length: 5000 }, (_, i) => i);
  const result = await mapInChunks(input, (x) => x * 2, 500);
  assert.equal(result.length, 5000);
  assert.equal(result[0], 0);
  assert.equal(result[2500], 5000);
  assert.equal(result[4999], 9998);
});

test('maps randomized values correctly (defeats hardcoding)', async () => {
  const input = Array.from({ length: 400 }, () => Math.floor(Math.random() * 1000));
  const result = await mapInChunks(input, (x) => x + 1, 50);
  assert.deepEqual(result, input.map((x) => x + 1));
});

test('passes the index as the second argument to fn', async () => {
  const result = await mapInChunks(['a', 'b', 'c', 'd'], (x, i) => `${i}:${x}`, 2);
  assert.deepEqual(result, ['0:a', '1:b', '2:c', '3:d']);
});

test('actually yields to the event loop between chunks', async () => {
  // If it yields, a setImmediate scheduled right after starting the map should
  // run before the map finishes. A synchronous map would block it until the end.
  let mapDone = false;
  let immediateRanDuringMap = false;
  const input = Array.from({ length: 500 }, (_, i) => i);
  const p = mapInChunks(input, (x) => x, 50).then(() => { mapDone = true; });
  setImmediate(() => { if (!mapDone) immediateRanDuringMap = true; });
  await p;
  assert.equal(immediateRanDuringMap, true, 'map should have yielded so the immediate ran mid-way');
});

test('yields even with small chunkSize on a small array', async () => {
  let mapDone = false;
  let ranDuring = false;
  const p = mapInChunks([1, 2, 3, 4, 5, 6], (x) => x, 2).then(() => { mapDone = true; });
  setImmediate(() => { if (!mapDone) ranDuring = true; });
  await p;
  assert.equal(ranDuring, true);
});

test('handles empty input', async () => {
  assert.deepEqual(await mapInChunks([], (x) => x, 100), []);
});

test('handles a single element', async () => {
  assert.deepEqual(await mapInChunks([42], (x) => x * 10, 100), [420]);
});

test('calls fn exactly once per item', async () => {
  const input = Array.from({ length: 250 }, (_, i) => i);
  let calls = 0;
  await mapInChunks(input, (x) => { calls++; return x; }, 40);
  assert.equal(calls, 250);
});

test('does not mutate the input array', async () => {
  const input = [3, 1, 2];
  const snapshot = [...input];
  await mapInChunks(input, (x) => x * 100, 2);
  assert.deepEqual(input, snapshot, 'input array must be left untouched');
});

test('returns a new array, not the input reference', async () => {
  const input = [1, 2, 3];
  const out = await mapInChunks(input, (x) => x, 2);
  assert.notEqual(out, input, 'should return a fresh array');
  assert.deepEqual(out, [1, 2, 3]);
});

test('preserves falsy results at the correct positions', async () => {
  const input = [0, 1, 2, 3];
  const out = await mapInChunks(input, (x) => (x % 2 === 0 ? null : undefined), 2);
  assert.deepEqual(out, [null, undefined, null, undefined]);
});

test('works when chunkSize is larger than the array', async () => {
  const out = await mapInChunks([1, 2, 3], (x) => x * 2, 1000);
  assert.deepEqual(out, [2, 4, 6]);
});
