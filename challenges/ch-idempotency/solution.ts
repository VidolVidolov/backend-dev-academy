// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-idempotency — make retries safe.
// academy challenge ch-idempotency   |   academy solve ch-idempotency

/**
 * Returns { run }.
 * run(key, fn): executes fn() exactly once per key and caches its result.
 *   - Later calls with the same key return the cached result WITHOUT calling fn.
 *   - Concurrent calls with the same key (before the first settles) must all
 *     await the SAME in-flight execution; fn must run exactly once.
 *   - If fn rejects, the key should not be cached as success (a later call may retry).
 *
 * @example
 *   const store = createIdempotencyStore();
 *   let calls = 0;
 *   const charge = async () => { calls++; return 'charged-99eur'; };
 *
 *   await store.run('checkout-42', charge);  // -> 'charged-99eur'  (fn ran; calls === 1)
 *   await store.run('checkout-42', charge);  // -> 'charged-99eur'  (cached; calls STILL 1)
 *   await store.run('checkout-43', charge);  // -> 'charged-99eur'  (new key; calls === 2)
 */
export function createIdempotencyStore(): { run<T>(key: string, fn: () => T | Promise<T>): Promise<T> } {
  throw new Error('TODO: implement createIdempotencyStore');
}
