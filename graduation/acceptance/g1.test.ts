// G1 — Foundation: health & readiness
// FALSE-POSITIVE GUARDS: each dependency flag is asserted in its own test so a
// /ready that hardcodes one value can't hide behind another, and negative
// probes (unknown routes, wrong methods) prove there is real routing rather
// than a catch-all 200.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { req, BASE } from './client.ts';

test('g1: server is reachable', async () => {
  try {
    await req('GET', '/health');
  } catch {
    assert.fail(`nothing answering at ${BASE} — start your app (and docker compose up -d) first`);
  }
});

test('g1: GET /health returns 200', async () => {
  const res = await req('GET', '/health');
  assert.equal(res.status, 200);
});

test('g1: /health body is JSON with ok: true', async () => {
  const res = await req('GET', '/health');
  assert.ok(res.body !== null, '/health must return a JSON body');
  assert.equal(res.body.ok, true);
});

test('g1: /health answers fast (it must not block on dependencies)', async () => {
  const start = Date.now();
  await req('GET', '/health');
  assert.ok(Date.now() - start < 2000, '/health is liveness — it should answer in milliseconds');
});

test('g1: GET /ready returns 200 when all dependencies are up', async () => {
  const res = await req('GET', '/ready');
  assert.equal(res.status, 200, 'ready must be 200 when all deps are up — did you actually ping them?');
});

test('g1: /ready reports postgres', async () => {
  const res = await req('GET', '/ready');
  assert.equal(res.body.postgres, true, 'postgres must be reported (and actually checked!)');
});

test('g1: /ready reports redis', async () => {
  const res = await req('GET', '/ready');
  assert.equal(res.body.redis, true, 'redis must be reported (and actually checked!)');
});

test('g1: /ready reports kafka', async () => {
  const res = await req('GET', '/ready');
  assert.equal(res.body.kafka, true, 'kafka must be reported (and actually checked!)');
});

test('g1: an unknown route is 404, not a catch-all 200', async () => {
  const res = await req('GET', '/definitely-not-a-route-' + Math.random().toString(36).slice(2));
  assert.equal(res.status, 404);
});

test('g1: POST /health is rejected (405 or 404), not treated as a health check', async () => {
  const res = await req('POST', '/health', { body: {} });
  assert.ok([404, 405].includes(res.status), `expected 404/405, got ${res.status}`);
});
