// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-rate-limiter.
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }): { allow: (key: string) => boolean } {
  const buckets = new Map(); // key -> { windowStart, count }

  function allow(key) {
    const t = now();
    let bucket = buckets.get(key);
    if (!bucket || t - bucket.windowStart >= windowMs) {
      bucket = { windowStart: t, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return false; // denied calls consume nothing
    bucket.count++;
    return true;
  }

  return { allow };
}
