// MILESTONE 2 — login + opaque session tokens
// FALSE-POSITIVE GUARDS: both auth outcomes are probed (valid token works,
// invalid/missing/wrong-format tokens all 401), enumeration is checked with
// identical error messages, and tokens are verified to map to the RIGHT user,
// not just any user.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

const ME = { email: 'me@x.com', password: 'correcthorse1' };
const OTHER = { email: 'other@x.com', password: 'differentpw22' };

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => {
  app = await startApp();
  await app.req('POST', '/register', { body: ME });
  await app.req('POST', '/register', { body: OTHER });
});
after(async () => { await app.close(); });

test('m2: correct credentials return a token of reasonable length', async () => {
  const res = await app.req('POST', '/login', { body: ME });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.token === 'string' && res.body.token.length >= 16);
});

test('m2: two logins produce two different tokens', async () => {
  const a = await app.req('POST', '/login', { body: ME });
  const b = await app.req('POST', '/login', { body: ME });
  assert.notEqual(a.body.token, b.body.token, 'each login is a fresh session');
});

test('m2: the token does not embed the email (opaque, not encoded data)', async () => {
  const res = await app.req('POST', '/login', { body: ME });
  assert.ok(!res.body.token.includes(ME.email), 'token must be opaque');
  assert.ok(!Buffer.from(res.body.token, 'base64').toString().includes(ME.email), 'not even base64-encoded');
});

test('m2: a wrong password is rejected with 401', async () => {
  const res = await app.req('POST', '/login', { body: { email: ME.email, password: 'wrongwrong1' } });
  assert.equal(res.status, 401);
});

test('m2: an unknown email is rejected with 401', async () => {
  const res = await app.req('POST', '/login', { body: { email: 'ghost@x.com', password: 'whatever123' } });
  assert.equal(res.status, 401);
});

test('m2: wrong password and unknown email return the SAME error message', async () => {
  const wrongPw = await app.req('POST', '/login', { body: { email: ME.email, password: 'wrongwrong1' } });
  const noUser = await app.req('POST', '/login', { body: { email: 'ghost@x.com', password: 'whatever123' } });
  assert.equal(wrongPw.body.error, noUser.body.error, 'different messages leak which emails exist (enumeration)');
});

test('m2: an empty or missing password is a 401, not a crash', async () => {
  const empty = await app.req('POST', '/login', { body: { email: ME.email, password: '' } });
  const missing = await app.req('POST', '/login', { body: { email: ME.email } });
  assert.equal(empty.status, 401);
  assert.equal(missing.status, 401);
});

test('m2: GET /me with a valid token returns the RIGHT user', async () => {
  const mine = await app.req('POST', '/login', { body: ME });
  const theirs = await app.req('POST', '/login', { body: OTHER });
  const me = await app.req('GET', '/me', { headers: { authorization: `Bearer ${mine.body.token}` } });
  const them = await app.req('GET', '/me', { headers: { authorization: `Bearer ${theirs.body.token}` } });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, ME.email, 'token must resolve to its own user');
  assert.equal(them.body.email, OTHER.email, 'a different token resolves to the other user');
});

test('m2: GET /me with a bad or missing token is 401', async () => {
  const bad = await app.req('GET', '/me', { headers: { authorization: 'Bearer nonsense' } });
  const none = await app.req('GET', '/me');
  assert.equal(bad.status, 401);
  assert.equal(none.status, 401);
});

test('m2: an Authorization header without the Bearer scheme is 401', async () => {
  const login = await app.req('POST', '/login', { body: ME });
  const res = await app.req('GET', '/me', { headers: { authorization: login.body.token } });
  assert.equal(res.status, 401, 'a raw token without "Bearer " must not authenticate');
});
