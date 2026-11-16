// G4 — Redis for real: caching + rate limiting
// FALSE-POSITIVE GUARDS: the cache is probed for correctness (HIT serves the
// same data) AND for invalidation (no stale reads after a write); the rate
// limiter is probed in both directions — it must fire under hammering AND must
// NOT block a different user or a legitimate login below the threshold.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { req, registerAndLogin, uniq } from './client.ts';

let me: Awaited<ReturnType<typeof registerAndLogin>>;
before(async () => { me = await registerAndLogin(); });

async function createOrder(auth: Record<string, string>) {
  const res = await req('POST', '/orders', { body: { items: [{ sku: `C-${uniq()}`, qty: 1 }] }, headers: auth });
  assert.equal(res.status, 201);
  return res.body;
}

test('g4: first read of an order is x-cache: MISS', async () => {
  const order = await createOrder(me.auth);
  const cold = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal(cold.status, 200);
  assert.equal((cold.headers.get('x-cache') || '').toUpperCase(), 'MISS', 'first read must be x-cache: MISS');
});

test('g4: an immediate re-read is x-cache: HIT', async () => {
  const order = await createOrder(me.auth);
  await req('GET', `/orders/${order.id}`, { headers: me.auth });
  const warm = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal((warm.headers.get('x-cache') || '').toUpperCase(), 'HIT', 'immediate re-read must be x-cache: HIT');
});

test('g4: the cached response carries the same order data, with a 200', async () => {
  const order = await createOrder(me.auth);
  const cold = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  const warm = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal(warm.status, 200);
  assert.equal(warm.body.id, cold.body.id);
  assert.deepEqual(warm.body.items, cold.body.items, 'the cache must serve the same order, not garbage');
});

test('g4: cache does not serve stale data after PATCH', async () => {
  const order = await createOrder(me.auth);
  await req('GET', `/orders/${order.id}`, { headers: me.auth });   // warm the cache
  const patched = await req('PATCH', `/orders/${order.id}`, {
    body: { status: 'cancelled', version: 1 }, headers: me.auth,
  });
  assert.equal(patched.status, 200);
  const read = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal(read.body.status, 'cancelled', 'cached read served stale status — invalidate on write!');
});

test('g4: after invalidation the updated order is re-cached (MISS then HIT again)', async () => {
  const order = await createOrder(me.auth);
  await req('GET', `/orders/${order.id}`, { headers: me.auth });   // warm
  await req('PATCH', `/orders/${order.id}`, { body: { status: 'cancelled', version: 1 }, headers: me.auth });
  const afterWrite = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal((afterWrite.headers.get('x-cache') || '').toUpperCase(), 'MISS', 'the write must evict the cache entry');
  const rewarmed = await req('GET', `/orders/${order.id}`, { headers: me.auth });
  assert.equal((rewarmed.headers.get('x-cache') || '').toUpperCase(), 'HIT');
  assert.equal(rewarmed.body.status, 'cancelled');
});

test('g4: POST /login is rate limited — 429 under hammering', async () => {
  const email = `g4-${uniq()}@academy.test`;
  await req('POST', '/register', { body: { email, password: 'valid-password-1' } });
  let got429 = null;
  for (let i = 0; i < 25; i++) {
    const res = await req('POST', '/login', { body: { email, password: 'wrong-password-x' } });
    if (res.status === 429) { got429 = res; break; }
    assert.equal(res.status, 401, `attempt ${i + 1}: expected 401 or 429, got ${res.status}`);
  }
  assert.ok(got429, '25 rapid failed logins never hit a 429 — where is the rate limit?');
});

test('g4: the 429 carries a retry-after header', async () => {
  const email = `g4b-${uniq()}@academy.test`;
  await req('POST', '/register', { body: { email, password: 'valid-password-1' } });
  let got429 = null;
  for (let i = 0; i < 25 && !got429; i++) {
    const res = await req('POST', '/login', { body: { email, password: 'wrong-password-x' } });
    if (res.status === 429) got429 = res;
  }
  assert.ok(got429, 'never hit the rate limit');
  assert.ok(got429.headers.get('retry-after'), '429 must carry a retry-after header');
});

test('g4: a few failed attempts do NOT lock out a legitimate login', async () => {
  const email = `g4c-${uniq()}@academy.test`;
  const password = 'valid-password-1';
  await req('POST', '/register', { body: { email, password } });
  for (let i = 0; i < 3; i++) {
    await req('POST', '/login', { body: { email, password: 'wrong-password-x' } });
  }
  const legit = await req('POST', '/login', { body: { email, password } });
  assert.equal(legit.status, 200, 'three failures must not trip a limit meant for hammering');
});

test('g4: one hammered account does not rate-limit a different user', async () => {
  const victim = `g4d-${uniq()}@academy.test`;
  const bystander = `g4e-${uniq()}@academy.test`;
  const password = 'valid-password-1';
  await req('POST', '/register', { body: { email: victim, password } });
  await req('POST', '/register', { body: { email: bystander, password } });
  for (let i = 0; i < 25; i++) {
    const res = await req('POST', '/login', { body: { email: victim, password: 'wrong-password-x' } });
    if (res.status === 429) break;
  }
  const other = await req('POST', '/login', { body: { email: bystander, password } });
  assert.equal(other.status, 200, 'the limit must be scoped, not global');
});

test('g4: cached reads still respect ownership (no cross-user leaks from the cache)', async () => {
  const order = await createOrder(me.auth);
  await req('GET', `/orders/${order.id}`, { headers: me.auth });   // warm the cache as owner
  const stranger = await registerAndLogin();
  const res = await req('GET', `/orders/${order.id}`, { headers: stranger.auth });
  assert.equal(res.status, 404, 'a cache HIT must never bypass the ownership check');
});
