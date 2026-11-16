import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from './solution.ts';

// FALSE-POSITIVE GUARDS: param values are randomized so real extraction is
// required, distinct handler identities are checked so a router can't just
// return "something truthy", and both directions of static-vs-param precedence
// are asserted.

test('matches a static route and returns empty params', () => {
  const r = createRouter();
  const h = () => 'health';
  r.add('GET', '/health', h);
  const m = r.match('GET', '/health')!;
  assert.equal(m.handler, h);
  assert.deepEqual(m.params, {});
});

test('extracts a single path param (randomized)', () => {
  const r = createRouter();
  r.add('GET', '/users/:id', () => {});
  const id = String(Math.floor(Math.random() * 1e6));
  const m = r.match('GET', `/users/${id}`)!;
  assert.deepEqual(m.params, { id });
});

test('extracts multiple path params in order', () => {
  const r = createRouter();
  r.add('GET', '/users/:id/posts/:postId', () => {});
  const m = r.match('GET', '/users/42/posts/abc')!;
  assert.deepEqual(m.params, { id: '42', postId: 'abc' });
});

test('static route wins over a param route (both directions)', () => {
  const r = createRouter();
  const paramH = () => 'param';
  const staticH = () => 'static';
  r.add('GET', '/users/:id', paramH);
  r.add('GET', '/users/me', staticH);
  assert.equal(r.match('GET', '/users/me')!.handler, staticH, 'static must win');
  assert.equal(r.match('GET', '/users/7')!.handler, paramH, 'param handles the rest');
});

test('static wins regardless of registration order', () => {
  const r = createRouter();
  const staticH = () => 'static';
  const paramH = () => 'param';
  r.add('GET', '/users/me', staticH); // static registered FIRST this time
  r.add('GET', '/users/:id', paramH);
  assert.equal(r.match('GET', '/users/me')!.handler, staticH);
});

test('method must match', () => {
  const r = createRouter();
  r.add('POST', '/users', () => {});
  assert.equal(r.match('GET', '/users'), null);
});

test('method matching is case-insensitive', () => {
  const r = createRouter();
  const h = () => {};
  r.add('GET', '/x', h);
  assert.equal(r.match('get', '/x')!.handler, h);
});

test('no matching route returns null', () => {
  const r = createRouter();
  r.add('GET', '/a', () => {});
  assert.equal(r.match('GET', '/b'), null);
});

test('segment count must match exactly (no partial matches)', () => {
  const r = createRouter();
  r.add('GET', '/users/:id', () => {});
  assert.equal(r.match('GET', '/users'), null, 'too few segments');
  assert.equal(r.match('GET', '/users/1/extra'), null, 'too many segments');
});

test('decodes url-encoded param values', () => {
  const r = createRouter();
  r.add('GET', '/search/:q', () => {});
  assert.equal(r.match('GET', '/search/hello%20world')!.params.q, 'hello world');
});

test('routes the correct handler among many registered routes', () => {
  const r = createRouter();
  const a = () => 'a';
  const b = () => 'b';
  const c = () => 'c';
  r.add('GET', '/a', a);
  r.add('GET', '/b/:x', b);
  r.add('DELETE', '/c', c);
  assert.equal(r.match('GET', '/a')!.handler, a);
  assert.equal(r.match('GET', '/b/9')!.handler, b);
  assert.equal(r.match('DELETE', '/c')!.handler, c);
  assert.equal(r.match('GET', '/c'), null);
});

test('params object contains only the declared param keys', () => {
  const r = createRouter();
  r.add('GET', '/a/:x/b/:y', () => {});
  const m = r.match('GET', '/a/1/b/2')!;
  assert.deepEqual(Object.keys(m.params).sort(), ['x', 'y']);
});
