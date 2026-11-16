// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-idempotency.
export function createIdempotencyStore(): { run<T>(key: string, fn: () => T | Promise<T>): Promise<T> } {
  const inFlight = new Map(); // key -> Promise
  const done = new Map();     // key -> resolved value

  async function run(key, fn) {
    if (done.has(key)) return done.get(key);
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = (async () => fn())();
    inFlight.set(key, promise);
    try {
      const result = await promise;
      done.set(key, result);       // cache success only
      return result;
    } catch (err) {
      throw err;                    // leave uncached so a retry can happen
    } finally {
      inFlight.delete(key);
    }
  }

  return { run };
}
