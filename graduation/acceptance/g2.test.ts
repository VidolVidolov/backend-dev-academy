// G2 — Auth: users in Postgres, sessions in Redis
// FALSE-POSITIVE GUARDS: credentials are randomized per run, secrets are
// grepped for in responses, both 401 paths must be byte-identical (no
// enumeration), and tokens are checked to be fresh per login and bound to the
// Bearer scheme.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { req, uniq } from './client.ts';

const email = `g2-${uniq()}@academy.test`;
const password = `pw-${uniq()}-battery`;

before(async () => {
  const reg = await req('POST', '/register', { body: { email, password } });
  assert.equal(reg.status, 201, `register failed (${reg.status})`);
});

test('g2: register returns id + email', async () => {
  const res = await req('POST', '/register', { body: { email: `g2a-${uniq()}@academy.test`, password } });
  assert.equal(res.status, 201);
  assert.ok(res.body.id);
  assert.ok(res.body.email);
});

test('g2: the register response never leaks the password or a hash', async () => {
  const pw = `leakcheck-${uniq()}`;
  const res = await req('POST', '/register', { body: { email: `g2b-${uniq()}@academy.test`, password: pw } });
  const raw = JSON.stringify(res.body).toLowerCase();
  assert.ok(!raw.includes(pw.toLowerCase()), 'response leaks the password');
  assert.ok(!raw.includes('hash'), 'response leaks the hash');
});

test('g2: a weak password is rejected with 400', async () => {
  const res = await req('POST', '/register', { body: { email: `g2c-${uniq()}@academy.test`, password: 'short' } });
  assert.equal(res.status, 400);
});

test('g2: a duplicate email is rejected with 409', async () => {
  const res = await req('POST', '/register', { body: { email, password } });
  assert.equal(res.status, 409);
});

test('g2: login with correct credentials returns a token', async () => {
  const res = await req('POST', '/login', { body: { email, password } });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.token === 'string' && res.body.token.length >= 16);
});

test('g2: each login issues a FRESH token (sessions, not a static secret)', async () => {
  const a = await req('POST', '/login', { body: { email, password } });
  const b = await req('POST', '/login', { body: { email, password } });
  assert.notEqual(a.body.token, b.body.token);
});

test('g2: wrong password and unknown email give identical 401s (no enumeration)', async () => {
  const wrongPw = await req('POST', '/login', { body: { email, password: `wrong-${uniq()}` } });
  const noUser = await req('POST', '/login', { body: { email: `ghost-${uniq()}@academy.test`, password: `whatever-${uniq()}` } });
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(wrongPw.body, noUser.body, 'different bodies leak which emails exist (enumeration)');
});

test('g2: GET /me with a valid token returns the RIGHT user', async () => {
  const login = await req('POST', '/login', { body: { email, password } });
  const me = await req('GET', '/me', { headers: { authorization: `Bearer ${login.body.token}` } });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, email, 'the token must resolve to its own user');
});

test('g2: GET /me with a bad or missing token is 401', async () => {
  assert.equal((await req('GET', '/me', { headers: { authorization: 'Bearer nonsense' } })).status, 401);
  assert.equal((await req('GET', '/me')).status, 401);
});

test('g2: a token without the Bearer scheme does not authenticate', async () => {
  const login = await req('POST', '/login', { body: { email, password } });
  const res = await req('GET', '/me', { headers: { authorization: login.body.token } });
  assert.equal(res.status, 401, 'a raw token without "Bearer " must be rejected');
});
