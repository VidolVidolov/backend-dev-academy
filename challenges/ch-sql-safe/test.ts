import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSelect } from './solution.ts';

// FALSE-POSITIVE GUARDS: values are randomized and checked to appear ONLY in the
// values array (never in the SQL text), placeholder numbering is asserted, and
// the allow-list is probed from both sides (each allowed column works; unknown
// columns throw). A solution that string-concatenates values will fail here.

test('no filters selects everything', () => {
  assert.deepEqual(buildSelect('users'), { text: 'SELECT * FROM users', values: [] });
});

test('an empty filters object also selects everything', () => {
  assert.deepEqual(buildSelect('users', {}), { text: 'SELECT * FROM users', values: [] });
});

test('a single filter is parameterized as $1', () => {
  const { text, values } = buildSelect('users', { email: 'a@b.com' });
  assert.equal(text, 'SELECT * FROM users WHERE email = $1');
  assert.deepEqual(values, ['a@b.com']);
});

test('multiple filters increment placeholders in insertion order', () => {
  const { text, values } = buildSelect('users', { status: 'active', ownerId: 7 });
  assert.equal(text, 'SELECT * FROM users WHERE status = $1 AND ownerId = $2');
  assert.deepEqual(values, ['active', 7]);
});

test('placeholder count equals the number of filters', () => {
  const { text, values } = buildSelect('users', { id: 1, email: 'e', status: 's' });
  assert.equal(values.length, 3);
  assert.ok(/\$1\b/.test(text) && /\$2\b/.test(text) && /\$3\b/.test(text));
  assert.ok(!/\$4/.test(text), 'must not emit more placeholders than values');
});

test('a randomized value is placed in values, never in the SQL text', () => {
  const secret = 'v' + Math.random().toString(36).slice(2);
  const { text, values } = buildSelect('users', { email: secret });
  assert.ok(!text.includes(secret), 'value must NOT be interpolated into the SQL text');
  assert.deepEqual(values, [secret]);
});

test('a SQL-injection payload is neutralized (kept as a value)', () => {
  const injection = "x'; DROP TABLE users; --";
  const { text, values } = buildSelect('users', { email: injection });
  assert.ok(!text.includes('DROP'), 'malicious value must not appear in SQL text');
  assert.ok(!text.includes("'"), 'no quoted literals should be built');
  assert.deepEqual(values, [injection]);
});

test('numeric values keep their type', () => {
  const { values } = buildSelect('users', { ownerId: 7 });
  assert.strictEqual(values[0], 7);
});

test('each allow-listed column is accepted', () => {
  for (const col of ['id', 'email', 'status', 'ownerId']) {
    const { text, values } = buildSelect('t', { [col]: 'v' });
    assert.equal(text, `SELECT * FROM t WHERE ${col} = $1`);
    assert.deepEqual(values, ['v']);
  }
});

test('an unknown column is rejected by throwing', () => {
  assert.throws(() => buildSelect('users', { password: 'x' }));
});

test('one bad column among valid ones still throws', () => {
  assert.throws(() => buildSelect('users', { email: 'a@b.com', evil: 1 }));
});

test('the table name is reflected in the SQL text', () => {
  assert.ok(buildSelect('orders', { id: 1 }).text.includes('FROM orders'));
});
