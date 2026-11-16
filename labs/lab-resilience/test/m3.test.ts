// MILESTONE 3 — circuit breaker
// FALSE-POSITIVE GUARDS: the dependency's call count is asserted so "fails
// fast" is proven (an open breaker that still calls the dependency is caught),
// and every state transition — closed→open, open→half-open probe, probe
// success→closed, probe failure→open — is exercised.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBreaker } from '../src/resilience.ts';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('m3: starts closed and passes successful calls through', async () => {
  const token = 'r-' + Math.random();
  const call = createBreaker(async () => token, { threshold: 2, resetMs: 1000 });
  assert.equal(call.getState(), 'closed');
  assert.equal(await call(), token);
  assert.equal(call.getState(), 'closed');
});

test('m3: forwards arguments to the wrapped function', async () => {
  const call = createBreaker(async (a, b) => a + b, { threshold: 2, resetMs: 1000 });
  assert.equal(await call(2, 3), 5);
});

test('m3: stays closed below the failure threshold', async () => {
  const call = createBreaker(async () => { throw new Error('x'); }, { threshold: 3, resetMs: 10000 });
  await assert.rejects(call());
  await assert.rejects(call());
  assert.equal(call.getState(), 'closed', 'two failures under a threshold of three');
});

test('m3: opens after `threshold` consecutive failures', async () => {
  const call = createBreaker(async () => { throw new Error('dep down'); }, { threshold: 2, resetMs: 10000 });
  await assert.rejects(call(), /dep down/);
  await assert.rejects(call(), /dep down/);
  assert.equal(call.getState(), 'open');
});

test('m3: an open breaker fails fast WITHOUT calling the dependency', async () => {
  let underlyingCalls = 0;
  const call = createBreaker(async () => { underlyingCalls++; throw new Error('dep down'); },
    { threshold: 2, resetMs: 10000 });
  await assert.rejects(call());
  await assert.rejects(call());
  await assert.rejects(call(), (err: any) => err.name === 'CircuitOpenError');
  await assert.rejects(call(), (err: any) => err.name === 'CircuitOpenError');
  assert.equal(underlyingCalls, 2, 'open breaker must not call the dependency');
});

test('m3: the fail-fast error is distinguishable from a dependency error', async () => {
  const call = createBreaker(async () => { throw new Error('dep down'); }, { threshold: 1, resetMs: 10000 });
  await assert.rejects(call(), /dep down/);
  await assert.rejects(call(), (err: any) => {
    assert.equal(err.name, 'CircuitOpenError');
    assert.ok(!/dep down/.test(err.message), 'fail-fast must not masquerade as the dependency error');
    return true;
  });
});

test('m3: after resetMs a probe goes through; success closes the breaker', async () => {
  let failing = true;
  const call = createBreaker(async () => {
    if (failing) throw new Error('down');
    return 'recovered';
  }, { threshold: 2, resetMs: 30 });
  await assert.rejects(call());
  await assert.rejects(call());
  assert.equal(call.getState(), 'open');
  await delay(40);          // past resetMs -> next call is the probe
  failing = false;
  assert.equal(await call(), 'recovered');
  assert.equal(call.getState(), 'closed');
});

test('m3: a failed half-open probe re-opens the breaker', async () => {
  const call = createBreaker(async () => { throw new Error('still down'); },
    { threshold: 1, resetMs: 20 });
  await assert.rejects(call(), /still down/);
  assert.equal(call.getState(), 'open');
  await delay(30);
  await assert.rejects(call(), /still down/);   // the probe itself
  assert.equal(call.getState(), 'open', 'failed probe must re-open');
});

test('m3: a recovered breaker serves normal traffic again', async () => {
  let failing = true;
  let calls = 0;
  const call = createBreaker(async () => {
    calls++;
    if (failing) throw new Error('down');
    return 'ok';
  }, { threshold: 1, resetMs: 20 });
  await assert.rejects(call());
  await delay(30);
  failing = false;
  await call();             // probe succeeds, closes
  await call();
  await call();
  assert.equal(call.getState(), 'closed');
  assert.equal(calls, 4, 'post-recovery calls must reach the dependency');
});

test('m3: a success resets the consecutive-failure count', async () => {
  let shouldFail = false;
  const call = createBreaker(async () => {
    if (shouldFail) throw new Error('x');
    return 'ok';
  }, { threshold: 2, resetMs: 10000 });
  shouldFail = true;
  await assert.rejects(call());   // 1 failure
  shouldFail = false;
  await call();                   // success resets the count
  shouldFail = true;
  await assert.rejects(call());   // 1 failure again — still below threshold
  assert.equal(call.getState(), 'closed');
});
