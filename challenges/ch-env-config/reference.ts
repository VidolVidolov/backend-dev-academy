// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-env-config.
export function defineConfig(schema, env = process.env): Record<string, any> {
  const config = {};
  const missing = [];

  for (const [key, spec] of Object.entries(schema)) {
    const raw = env[key];
    if (raw === undefined || raw === '') {
      if (spec.required) { missing.push(key); continue; }
      config[key] = spec.default;
      continue;
    }
    config[key] = coerce(key, raw, spec.type || 'string');
  }

  // One error naming everything that's missing — not death by a thousand boots.
  if (missing.length) throw new Error(`missing required env: ${missing.join(', ')}`);
  return config;
}

function coerce(key, raw, type) {
  if (type === 'int') {
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error(`env ${key} must be an integer, got "${raw}"`);
    return n;
  }
  if (type === 'bool') {
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new Error(`env ${key} must be a boolean, got "${raw}"`);
  }
  return raw;
}
