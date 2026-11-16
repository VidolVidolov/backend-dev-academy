// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-rate-limiter — protect the endpoint before it protects itself.
// academy challenge ch-rate-limiter   |   academy solve ch-rate-limiter

/**
 * Implement createRateLimiter({ limit, windowMs, now }) — a fixed-window rate
 * limiter, the defense you put in front of /login and every public endpoint.
 * Returns { allow(key) } where allow returns true (request may proceed) or
 * false (rate limited).
 *
 *   - Per key (e.g. an IP or email), allow at most `limit` calls per window
 *     of `windowMs` milliseconds.
 *   - When a key's window has elapsed, it gets a fresh allowance.
 *   - Keys are independent: hammering one key must not affect another.
 *   - DENIED calls do not consume allowance (only allowed ones count).
 *   - `now` is an injectable clock function (defaults to Date.now) — the tests
 *     use a fake clock, and so will YOUR tests when you build one for real.
 *
 * @example
 *   let t = 0;
 *   const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
 *   rl.allow('ip-1');   // -> true   (1/2 used)
 *   rl.allow('ip-1');   // -> true   (2/2 used)
 *   rl.allow('ip-1');   // -> false  (limit hit)
 *   rl.allow('ip-2');   // -> true   (different key, own allowance)
 *   t = 1000;           // window elapsed
 *   rl.allow('ip-1');   // -> true   (fresh window)
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }): { allow: (key: string) => boolean } {
  throw new Error('TODO: implement createRateLimiter');
}
