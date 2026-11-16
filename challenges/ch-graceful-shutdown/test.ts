import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDrainTracker } from './solution.ts';

const delay = (ms: number, val?: unknown): Promise<unknown> => new Promise((r) => setTimeout(() => r(val), ms));

// NOTE ON FALSE POSITIVES: a solution can "pass" cheaply by (a) calling
// process.exit() inside drain() — which kills the runner mid-suite and forges a
// 0 exit code — or (b) never actually waiting for in-flight work. These tests
// are written so both cheats FAIL: the suite has 12 independent checks (the
// grader requires all 12 to run and pass, so a mid-suite exit is caught), and
// one test replaces process.exit with a trap that turns the cheat into a loud
// failure instead of a silent kill.

test('drain waits for a single in-flight promise to finish', async () => {
  const { track, drain } = createDrainTracker();
  let finished = false;
  track(delay(30).then(() => { finished = true; }));
  await drain();
  assert.equal(finished, true, 'drain() resolved before the tracked work finished');
});

test('drain waits for ALL in-flight promises (slowest wins)', async () => {
  const { track, drain } = createDrainTracker();
  let finished = 0;
  track(delay(20).then(() => { finished++; }));
  track(delay(60).then(() => { finished++; }));
  track(delay(40).then(() => { finished++; }));
  await drain();
  assert.equal(finished, 3, 'drain() must wait for the slowest tracked promise');
});

test('drain does NOT resolve before in-flight work settles', async () => {
  const { track, drain } = createDrainTracker();
  let settled = false;
  track(delay(50).then(() => { settled = true; }));
  const done = drain();
  // Right now, before awaiting, the work is still in flight.
  assert.equal(settled, false, 'work should still be pending immediately after drain()');
  await done;
  assert.equal(settled, true);
});

test('track throws SYNCHRONOUSLY once draining has started', () => {
  const { track, drain } = createDrainTracker();
  track(delay(20));
  const done = drain();
  // assert.throws needs a synchronous throw — an `async` track() would only
  // reject a promise and this would fail.
  assert.throws(() => track(delay(10)), /.*/);
  return done;
});

test('the rejection when draining mentions shutting down', async () => {
  const { track, drain } = createDrainTracker();
  const done = drain();
  assert.throws(() => track(delay(5)), /shut|drain|down|accept|closing/i);
  await done;
});

test('drain resolves even if some tracked work rejects', async () => {
  const { track, drain } = createDrainTracker();
  let okFinished = false;
  track(delay(20).then(() => { okFinished = true; }));
  track(Promise.reject(new Error('boom')));
  await assert.doesNotReject(drain(), 'drain() must not reject just because tracked work did');
  assert.equal(okFinished, true, 'non-rejecting work must still be awaited');
});

test('drain with no in-flight work resolves', async () => {
  const { drain } = createDrainTracker();
  await assert.doesNotReject(drain());
});

test('work tracked before drain runs its side effect to completion', async () => {
  const { track, drain } = createDrainTracker();
  const order = [];
  track(delay(25).then(() => order.push('work')));
  await drain();
  order.push('after-drain');
  assert.deepEqual(order, ['work', 'after-drain']);
});

test('two independent trackers do not share shutdown state', async () => {
  const a = createDrainTracker();
  const b = createDrainTracker();
  const doneA = a.drain();
  // Draining A must not put B into shutdown.
  assert.doesNotThrow(() => b.track(delay(10)), 'trackers must be isolated');
  await Promise.all([doneA, b.drain()]);
});

test('calling drain twice both resolve', async () => {
  const { track, drain } = createDrainTracker();
  track(delay(20));
  const first = drain();
  const second = drain();
  await assert.doesNotReject(Promise.all([first, second]));
});

test('a late-settling promise is still awaited by drain', async () => {
  const { track, drain } = createDrainTracker();
  let done = false;
  track(delay(80).then(() => { done = true; }));
  await drain();
  assert.equal(done, true, 'drain() must wait for even slow in-flight work');
});

test('drain must NOT terminate the process (no process.exit cheat)', async () => {
  const { track, drain } = createDrainTracker();
  track(delay(10));
  const realExit = process.exit;
  let exitCalled = false;
  // Trap process.exit: if the solution tries to "shut down" by killing the
  // process, turn it into a visible test failure instead of a silent,
  // suite-truncating kill.
  process.exit = (code) => {
    exitCalled = true;
    throw new Error(`solution called process.exit(${code}) — drain() must await work, not exit`);
  };
  try {
    await drain();
  } finally {
    process.exit = realExit;
  }
  assert.equal(exitCalled, false, 'drain() must resolve by awaiting in-flight work, not by exiting');
});
