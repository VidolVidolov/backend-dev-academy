import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './solution.ts';

// FALSE-POSITIVE GUARDS: the limit is randomized (hardcoded counters fail),
// both directions are probed (allows below the limit AND denies above it), and
// the injected fake clock makes window behavior exact — no sleeps, no flakes.

function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; }, set: (ms: number) => { t = ms; } };
}

test('the first call for a key is allowed', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: clock.now });
  assert.equal(rl.allow('k'), true);
});

test('allows exactly `limit` calls in one window (randomized limit)', () => {
  const limit = 2 + Math.floor(Math.random() * 8);
  const clock = makeClock();
  const rl = createRateLimiter({ limit, windowMs: 1000, now: clock.now });
  for (let i = 0; i < limit; i++) {
    assert.equal(rl.allow('k'), true, `call ${i + 1} of ${limit} should be allowed`);
  }
  assert.equal(rl.allow('k'), false, `call ${limit + 1} must be denied`);
});

test('keeps denying while the window is still open', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  rl.allow('k');
  clock.advance(500); // still inside the window
  assert.equal(rl.allow('k'), false);
  assert.equal(rl.allow('k'), false);
});

test('a fresh window restores the full allowance', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });
  rl.allow('k');
  rl.allow('k');
  assert.equal(rl.allow('k'), false);
  clock.advance(1000); // window elapsed
  assert.equal(rl.allow('k'), true);
  assert.equal(rl.allow('k'), true);
  assert.equal(rl.allow('k'), false, 'the new window has the same limit');
});

test('the window boundary is exact (>= windowMs resets)', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  rl.allow('k');
  clock.advance(999);
  assert.equal(rl.allow('k'), false, '1ms before the boundary is still limited');
  clock.advance(1);
  assert.equal(rl.allow('k'), true, 'at exactly windowMs the window resets');
});

test('keys are independent', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), false);
  assert.equal(rl.allow('b'), true, 'hammering key "a" must not consume key "b"');
});

test('similar-looking keys are still distinct', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  assert.equal(rl.allow('user'), true);
  assert.equal(rl.allow('user2'), true);
  assert.equal(rl.allow('use'), true);
});

test('denied calls do NOT consume allowance', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });
  rl.allow('k');
  rl.allow('k');
  for (let i = 0; i < 10; i++) rl.allow('k'); // 10 denials
  clock.advance(1000);
  // If denials had counted, some implementations would carry debt into the
  // new window. The fresh window must grant the FULL limit.
  assert.equal(rl.allow('k'), true);
  assert.equal(rl.allow('k'), true);
});

test('many keys at once each honor their own limit', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });
  const keys = Array.from({ length: 20 }, (_, i) => 'k' + i);
  for (const k of keys) {
    assert.equal(rl.allow(k), true);
    assert.equal(rl.allow(k), true);
    assert.equal(rl.allow(k), false);
  }
});

test('windows are per key, not global', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  rl.allow('early');            // early's window starts at t=0
  clock.advance(600);
  rl.allow('late');             // late's window starts at t=600
  clock.advance(400);           // t=1000: early resets, late does not
  assert.equal(rl.allow('early'), true);
  assert.equal(rl.allow('late'), false, 'late’s window started at 600 and is still open');
});

test('multiple full window cycles keep working', () => {
  const clock = makeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 100, now: clock.now });
  for (let cycle = 0; cycle < 5; cycle++) {
    assert.equal(rl.allow('k'), true, `cycle ${cycle}: first call allowed`);
    assert.equal(rl.allow('k'), false, `cycle ${cycle}: second call denied`);
    clock.advance(100);
  }
});

test('works with the default clock too (no injection)', () => {
  const rl = createRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(rl.allow('real'), true);
  assert.equal(rl.allow('real'), true);
  assert.equal(rl.allow('real'), false, 'within one minute the third call must be denied');
});
