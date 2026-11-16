// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-graceful-shutdown.
export function createDrainTracker(): { track: (promise: Promise<any>) => Promise<any>; drain: () => Promise<void> } {
  const inFlight = new Set();
  let draining = false;

  function track(promise) {
    if (draining) throw new Error("shutting down: not accepting new work");
    // Settle = remove regardless of outcome; swallow rejection for tracking.
    const p = Promise.resolve(promise).then(
      () => inFlight.delete(p),
      () => inFlight.delete(p),
    );
    inFlight.add(p);
    return promise;
  }

  async function drain() {
    draining = true;
    await Promise.all([...inFlight]);
  }

  return { track, drain };
}
