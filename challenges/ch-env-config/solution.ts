// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-env-config — fail at boot, not at 3am.
// academy challenge ch-env-config   |   academy solve ch-env-config

/**
 * Implement defineConfig(schema, env) — 12-factor configuration with
 * validation at startup. Returns a plain config object.
 *
 * schema: { KEY: { required?: boolean, default?: any, type?: 'string'|'int'|'bool' } }
 * env:    a plain object of string values (defaults to process.env).
 *
 *   - A present value is coerced by type:
 *       'string' (default) -> as-is
 *       'int'    -> integer; a non-integer value THROWS naming the key
 *       'bool'   -> 'true'/'1' -> true, 'false'/'0' -> false; anything else THROWS
 *   - A missing value (undefined or '') uses `default` if provided.
 *   - A missing REQUIRED value is collected, and after checking every key the
 *     function throws ONE error naming ALL missing keys — ops fixes them in
 *     one round trip, not five deploys.
 *   - Keys not in the schema are ignored (the env is full of noise).
 *
 * @example
 *   const config = defineConfig({
 *     PORT:     { type: 'int', default: 3000 },
 *     DB_URL:   { required: true },
 *     DEBUG:    { type: 'bool', default: false },
 *   }, { DB_URL: 'postgres://localhost/app', DEBUG: 'true' });
 *   // -> { PORT: 3000, DB_URL: 'postgres://localhost/app', DEBUG: true }
 *
 *   defineConfig({ A: { required: true }, B: { required: true } }, {});
 *   // -> THROWS one error mentioning BOTH "A" and "B"
 */
export function defineConfig(schema, env = process.env): Record<string, any> {
  throw new Error('TODO: implement defineConfig');
}
