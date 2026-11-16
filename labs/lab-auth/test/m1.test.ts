// MILESTONE 1 — registration + password hashing
// FALSE-POSITIVE GUARDS: passwords are randomized and then grepped for in both
// the response and the store, so plaintext storage or hash leakage is caught
// with values that cannot be special-cased.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); });

let n = 0;
const randEmail = () => `user${++n}-${Math.random().toString(36).slice(2, 8)}@x.com`;
const randPassword = () => 'pw-' + Math.random().toString(36).slice(2, 12) + 'A1';

test('m1: register returns 201 with id + email', async () => {
  const email = randEmail();
  const res = await app.req('POST', '/register', { body: { email, password: randPassword() } });
  assert.equal(res.status, 201);
  assert.ok(res.body.id, 'response must include the new user id');
  assert.equal(res.body.email, email);
});

test('m1: the response never contains the password or a hash', async () => {
  const password = randPassword();
  const res = await app.req('POST', '/register', { body: { email: randEmail(), password } });
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes(password), 'response must not contain the password');
  assert.ok(!raw.toLowerCase().includes('hash'), 'response must not contain the hash');
});

test('m1: a short password is rejected with 400', async () => {
  const res = await app.req('POST', '/register', { body: { email: randEmail(), password: 'short' } });
  assert.equal(res.status, 400);
});

test('m1: a missing password is rejected with 400', async () => {
  const res = await app.req('POST', '/register', { body: { email: randEmail() } });
  assert.equal(res.status, 400);
});

test('m1: an invalid email is rejected with 400', async () => {
  const res = await app.req('POST', '/register', { body: { email: 'not-an-email', password: randPassword() } });
  assert.equal(res.status, 400);
});

test('m1: a duplicate email is rejected with 409', async () => {
  const email = randEmail();
  await app.req('POST', '/register', { body: { email, password: randPassword() } });
  const res = await app.req('POST', '/register', { body: { email, password: randPassword() } });
  assert.equal(res.status, 409);
});

test('m1: a rejected duplicate does not clobber the original user', async () => {
  const email = randEmail();
  const first = await app.req('POST', '/register', { body: { email, password: randPassword() } });
  await app.req('POST', '/register', { body: { email, password: randPassword() } });
  const stored = app.store.users.get(email);
  assert.equal(stored.id, first.body.id, 'the original registration must survive the duplicate attempt');
});

test('m1: the stored user does NOT contain the plaintext password', async () => {
  const password = randPassword();
  await app.req('POST', '/register', { body: { email: randEmail(), password } });
  const stored = JSON.stringify([...app.store.users.values()]);
  assert.ok(!stored.includes(password), 'plaintext password found in the store!');
});

test('m1: same password, different users -> different stored hashes (salt!)', async () => {
  const password = randPassword();
  const e1 = randEmail();
  const e2 = randEmail();
  await app.req('POST', '/register', { body: { email: e1, password } });
  await app.req('POST', '/register', { body: { email: e2, password } });
  const u1 = app.store.users.get(e1);
  const u2 = app.store.users.get(e2);
  assert.ok(u1.passwordHash && u2.passwordHash, 'users should store a passwordHash');
  assert.notEqual(u1.passwordHash, u2.passwordHash, 'identical hashes mean you are not salting');
});

test('m1: every registered user gets a unique id', async () => {
  const a = await app.req('POST', '/register', { body: { email: randEmail(), password: randPassword() } });
  const b = await app.req('POST', '/register', { body: { email: randEmail(), password: randPassword() } });
  assert.ok(a.body.id && b.body.id);
  assert.notEqual(a.body.id, b.body.id);
});
