// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-health-agg.
export async function checkHealth(checks, { timeoutMs = 1000 } = {}): Promise<{ ok: boolean; checks: Record<string, { ok: boolean; error?: string }> }> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, fn]) => {
      try {
        await withTimeout(Promise.resolve().then(fn), timeoutMs);
        return [name, { ok: true }];
      } catch (err) {
        return [name, { ok: false, error: err?.message ?? String(err) }];
      }
    })
  );
  return {
    ok: entries.every(([, r]) => r.ok),
    checks: Object.fromEntries(entries),
  };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
