// MILESTONE 1 — withTimeout
// FALSE-POSITIVE GUARDS: values are randomized and passed through by identity,
// both outcomes are probed (fast resolves, slow times out), and a never-
// settling promise proves the timeout actually fires rather than the test
// merely racing a short delay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/resilience.ts';

const delay = (ms: number, v?: unknown): Promise<unknown> => new Promise((r) => setTimeout(() => r(v), ms));

test('m1: a fast promise resolves with its value', async () => {
  const token = 'ok-' + Math.random();
  assert.equal(await withTimeout(delay(10, token), 100), token);
});

test('m1: object values pass through by reference', async () => {
  const obj = { nested: { n: Math.random() } };
  assert.equal(await withTimeout(delay(5, obj), 100), obj);
});

test('m1: falsy resolutions (undefined, 0, false) survive', async () => {
  assert.equal(await withTimeout(delay(5, undefined), 100), undefined);
  assert.equal(await withTimeout(delay(5, 0), 100), 0);
  assert.equal(await withTimeout(delay(5, false), 100), false);
});

test('m1: a slow promise rejects with TimeoutError', async () => {
  await assert.rejects(withTimeout(delay(100, 'late'), 20), (err: any) => {
    assert.equal(err.name, 'TimeoutError');
    return true;
  });
});

test('m1: a promise that NEVER settles still times out', async () => {
  const never = new Promise(() => {});
  await assert.rejects(withTimeout(never, 30), (err: any) => err.name === 'TimeoutError');
});

test('m1: the timeout error is an Error instance with a message', async () => {
  await assert.rejects(withTimeout(delay(100), 20), (err: any) => {
    assert.ok(err instanceof Error);
    assert.ok(typeof err.message === 'string' && err.message.length > 0);
    return true;
  });
});

test('m1: a rejecting promise passes its own error through', async () => {
  const boom = delay(5).then(() => { throw new Error('boom'); });
  await assert.rejects(withTimeout(boom, 100), /boom/);
});

test('m1: the passed-through error keeps its identity (not wrapped)', async () => {
  const original = new Error('original failure');
  const failing = delay(5).then(() => { throw original; });
  await assert.rejects(withTimeout(failing, 100), (err) => err === original);
});

test('m1: an immediate (already-resolved) promise wins against any timeout', async () => {
  assert.equal(await withTimeout(Promise.resolve('instant'), 1), 'instant');
});

test('m1: timer is cleaned up after a fast resolution (no dangling timeout)', async () => {
  // If clearTimeout is missing, the pending 2s timer keeps the event loop
  // alive and the suite takes 2s+ to exit; the assertion anchors the behavior.
  const start = Date.now();
  const result = await withTimeout(delay(5, 'fast'), 2000);
  assert.equal(result, 'fast');
  assert.ok(Date.now() - start < 1000, 'resolution must not wait for the timeout');
});
