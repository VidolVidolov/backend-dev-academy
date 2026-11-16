// MILESTONE 3 — ownership authorization (OWASP #1 defense)
// FALSE-POSITIVE GUARDS: ownership is probed in BOTH directions (alice→bob and
// bob→alice), so neither "always allow" nor "always deny" can pass, and the
// not-yours case must be a 404 (not 403) so existence isn't leaked.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helper.ts';

let app: Awaited<ReturnType<typeof startApp>>, aliceToken: string, bobToken: string, aliceId: string;
before(async () => {
  app = await startApp();
  await app.req('POST', '/register', { body: { email: 'alice@x.com', password: 'alicepass123' } });
  await app.req('POST', '/register', { body: { email: 'bob@x.com', password: 'bobpass12345' } });
  aliceToken = (await app.req('POST', '/login', { body: { email: 'alice@x.com', password: 'alicepass123' } })).body.token;
  bobToken = (await app.req('POST', '/login', { body: { email: 'bob@x.com', password: 'bobpass12345' } })).body.token;
  aliceId = (await app.req('GET', '/me', { headers: { authorization: `Bearer ${aliceToken}` } })).body.id;
});
after(async () => { await app.close(); });

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const randText = () => 'note-' + Math.random().toString(36).slice(2, 10);

test('m3: creating a note requires auth', async () => {
  const res = await app.req('POST', '/notes', { body: { text: 'secret' } });
  assert.equal(res.status, 401);
});

test('m3: creating a note with empty or missing text is 400', async () => {
  const empty = await app.req('POST', '/notes', { body: { text: '' }, headers: auth(aliceToken) });
  const missing = await app.req('POST', '/notes', { body: {}, headers: auth(aliceToken) });
  assert.equal(empty.status, 400);
  assert.equal(missing.status, 400);
});

test('m3: a created note is stamped with the creator as owner', async () => {
  const created = await app.req('POST', '/notes', { body: { text: randText() }, headers: auth(aliceToken) });
  assert.equal(created.status, 201);
  assert.equal(created.body.ownerId, aliceId, 'ownerId must come from the session, not the request body');
});

test('m3: the owner can read their own note back, text intact', async () => {
  const text = randText();
  const created = await app.req('POST', '/notes', { body: { text }, headers: auth(aliceToken) });
  const read = await app.req('GET', '/notes/' + created.body.id, { headers: auth(aliceToken) });
  assert.equal(read.status, 200);
  assert.equal(read.body.text, text);
});

test('m3: another authenticated user gets 404 on someone else’s note', async () => {
  const created = await app.req('POST', '/notes', { body: { text: randText() }, headers: auth(aliceToken) });
  const res = await app.req('GET', '/notes/' + created.body.id, { headers: auth(bobToken) });
  assert.equal(res.status, 404, 'return 404 (not 403) so you do not reveal the note exists');
});

test('m3: ownership works in the other direction too (alice cannot read bob’s)', async () => {
  const created = await app.req('POST', '/notes', { body: { text: randText() }, headers: auth(bobToken) });
  assert.equal(created.status, 201);
  const own = await app.req('GET', '/notes/' + created.body.id, { headers: auth(bobToken) });
  const cross = await app.req('GET', '/notes/' + created.body.id, { headers: auth(aliceToken) });
  assert.equal(own.status, 200, 'bob reads his own note');
  assert.equal(cross.status, 404, 'alice must not read bob’s note');
});

test('m3: cross-user 404 and missing-note 404 are indistinguishable', async () => {
  const created = await app.req('POST', '/notes', { body: { text: randText() }, headers: auth(aliceToken) });
  const notYours = await app.req('GET', '/notes/' + created.body.id, { headers: auth(bobToken) });
  const missing = await app.req('GET', '/notes/really-not-there', { headers: auth(bobToken) });
  assert.equal(notYours.status, missing.status);
  assert.deepEqual(notYours.body, missing.body, 'responses must not differ, or existence leaks');
});

test('m3: an unknown note id is 404 even for its owner', async () => {
  const res = await app.req('GET', '/notes/nope', { headers: auth(aliceToken) });
  assert.equal(res.status, 404);
});

test('m3: reading a note unauthenticated is 401, not 404', async () => {
  const res = await app.req('GET', '/notes/whatever');
  assert.equal(res.status, 401);
});

test('m3: a user with several notes can read each one', async () => {
  const t1 = randText();
  const t2 = randText();
  const a = await app.req('POST', '/notes', { body: { text: t1 }, headers: auth(aliceToken) });
  const b = await app.req('POST', '/notes', { body: { text: t2 }, headers: auth(aliceToken) });
  const readA = await app.req('GET', '/notes/' + a.body.id, { headers: auth(aliceToken) });
  const readB = await app.req('GET', '/notes/' + b.body.id, { headers: auth(aliceToken) });
  assert.equal(readA.body.text, t1);
  assert.equal(readB.body.text, t2);
});
