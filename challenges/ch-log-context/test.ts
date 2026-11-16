import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLogger } from './solution.ts';

// FALSE-POSITIVE GUARDS: request ids are randomized, context is checked AFTER
// awaits (a naive "current context" variable passes sync tests but fails
// there), and the interleaved-concurrency test defeats any single-global-
// variable implementation.

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('info() writes a level+msg entry to the sink', () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  log.info('hello');
  assert.equal(sink.length, 1);
  assert.equal(sink[0].level, 'info');
  assert.equal(sink[0].msg, 'hello');
});

test('error() writes level error', () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  log.error('bad');
  assert.equal(sink[0].level, 'error');
  assert.equal(sink[0].msg, 'bad');
});

test('the message is preserved verbatim (randomized)', () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  const msg = 'msg-' + Math.random();
  log.info(msg);
  assert.equal(sink[0].msg, msg);
});

test('outside any context, entries carry no context fields', () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  log.info('bare');
  assert.deepEqual(Object.keys(sink[0]).sort(), ['level', 'msg']);
});

test('inside runWithContext, entries carry the context (randomized id)', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  const requestId = 'r-' + Math.random().toString(36).slice(2, 8);
  await log.runWithContext({ requestId }, () => { log.info('in ctx'); });
  assert.equal(sink[0].requestId, requestId);
});

test('every field of the context is spread onto the entry', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  await log.runWithContext({ requestId: 'r1', userId: 'u9', route: '/orders' }, () => { log.info('x'); });
  assert.equal(sink[0].userId, 'u9');
  assert.equal(sink[0].route, '/orders');
});

test('the context SURVIVES an await (the whole point)', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  const requestId = 'r-' + Math.random().toString(36).slice(2, 8);
  await log.runWithContext({ requestId }, async () => {
    log.info('before');
    await delay(20);
    log.info('after');
  });
  assert.equal(sink[1].msg, 'after');
  assert.equal(sink[1].requestId, requestId, 'context lost across an await — use AsyncLocalStorage');
});

test('runWithContext returns the fn result (async)', async () => {
  const log = createRequestLogger([]);
  const token = 'v-' + Math.random();
  assert.equal(await log.runWithContext({ requestId: 'r' }, async () => token), token);
});

test('runWithContext returns a sync fn result too', () => {
  const log = createRequestLogger([]);
  assert.equal(log.runWithContext({ requestId: 'r' }, () => 42), 42);
});

test('after runWithContext ends, logging is context-free again', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  await log.runWithContext({ requestId: 'r1' }, () => { log.info('inside'); });
  log.info('outside');
  assert.equal(sink[0].requestId, 'r1');
  assert.equal(sink[1].requestId, undefined, 'context must not leak past its run');
});

test('nested contexts: inner wins, outer restores', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  await log.runWithContext({ requestId: 'outer' }, async () => {
    log.info('a');
    await log.runWithContext({ requestId: 'inner' }, () => { log.info('b'); });
    log.info('c');
  });
  assert.equal(sink[0].requestId, 'outer');
  assert.equal(sink[1].requestId, 'inner');
  assert.equal(sink[2].requestId, 'outer', 'outer context must be restored after the inner run');
});

test('two CONCURRENT requests never see each other’s context', async () => {
  const sink: any[] = [];
  const log = createRequestLogger(sink);
  // Interleave two async chains: A logs, waits, logs; B starts mid-A.
  await Promise.all([
    log.runWithContext({ requestId: 'req-A' }, async () => {
      log.info('A1');
      await delay(30);
      log.info('A2');
    }),
    log.runWithContext({ requestId: 'req-B' }, async () => {
      await delay(10);
      log.info('B1');
      await delay(30);
      log.info('B2');
    }),
  ]);
  for (const entry of sink) {
    const expected = entry.msg.startsWith('A') ? 'req-A' : 'req-B';
    assert.equal(entry.requestId, expected,
      `entry ${entry.msg} has requestId ${entry.requestId} — contexts leaked between concurrent requests`);
  }
});
