import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineConfig } from './solution.ts';

// FALSE-POSITIVE GUARDS: values are randomized, coercion is checked by strict
// type AND value, and the all-missing-keys error is asserted to name EVERY
// missing key (a fail-on-first implementation fails that test).

test('a string value passes through as-is (randomized)', () => {
  const v = 'val-' + Math.random();
  const config = defineConfig({ NAME: {} }, { NAME: v });
  assert.strictEqual(config.NAME, v);
});

test('type int coerces to a real number', () => {
  const config = defineConfig({ PORT: { type: 'int' } }, { PORT: '8080' });
  assert.strictEqual(config.PORT, 8080, 'must be the number 8080, not the string');
});

test('a non-integer int value throws, naming the key', () => {
  assert.throws(() => defineConfig({ PORT: { type: 'int' } }, { PORT: 'eighty' }), /PORT/);
  assert.throws(() => defineConfig({ PORT: { type: 'int' } }, { PORT: '80.5' }), /PORT/);
});

test('type bool accepts true/1 and false/0', () => {
  assert.strictEqual(defineConfig({ D: { type: 'bool' } }, { D: 'true' }).D, true);
  assert.strictEqual(defineConfig({ D: { type: 'bool' } }, { D: '1' }).D, true);
  assert.strictEqual(defineConfig({ D: { type: 'bool' } }, { D: 'false' }).D, false);
  assert.strictEqual(defineConfig({ D: { type: 'bool' } }, { D: '0' }).D, false);
});

test('a junk bool value throws, naming the key', () => {
  assert.throws(() => defineConfig({ DEBUG: { type: 'bool' } }, { DEBUG: 'yes' }), /DEBUG/);
});

test('a missing optional key gets its default', () => {
  const config = defineConfig({ PORT: { type: 'int', default: 3000 } }, {});
  assert.strictEqual(config.PORT, 3000);
});

test('an empty-string value counts as missing (defaults apply)', () => {
  const config = defineConfig({ HOST: { default: 'localhost' } }, { HOST: '' });
  assert.strictEqual(config.HOST, 'localhost');
});

test('a present value beats the default', () => {
  const config = defineConfig({ HOST: { default: 'localhost' } }, { HOST: 'db.internal' });
  assert.strictEqual(config.HOST, 'db.internal');
});

test('a missing required key throws', () => {
  assert.throws(() => defineConfig({ DB_URL: { required: true } }, {}));
});

test('the error names ALL missing required keys, not just the first', () => {
  assert.throws(
    () => defineConfig(
      { DB_URL: { required: true }, API_KEY: { required: true }, OK: { default: 1 } },
      {}
    ),
    (err: any) => {
      assert.match(err.message, /DB_URL/, 'first missing key must be named');
      assert.match(err.message, /API_KEY/, 'second missing key must be named too — collect, then throw once');
      return true;
    }
  );
});

test('a present required key does not throw', () => {
  const config = defineConfig({ DB_URL: { required: true } }, { DB_URL: 'postgres://x' });
  assert.strictEqual(config.DB_URL, 'postgres://x');
});

test('env keys outside the schema are ignored; result has only schema keys', () => {
  const config = defineConfig(
    { PORT: { type: 'int', default: 3000 } },
    { PORT: '4000', PATH: '/usr/bin', SHELL: '/bin/zsh', SECRET: 'leak-me' }
  );
  assert.deepEqual(Object.keys(config), ['PORT'], 'unknown env vars must not leak into the config');
  assert.strictEqual(config.PORT, 4000);
});
