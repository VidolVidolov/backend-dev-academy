// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for lab-job-queue.

export function computeBackoff(attempt, baseMs, capMs = 30000): number {
  return Math.min(baseMs * 2 ** (attempt - 1), capMs);
}

export function createQueue({ handler, concurrency = 1, maxAttempts = 3, baseDelayMs = 10 }: import('./queue.ts').QueueOptions): import('./queue.ts').Queue {
  const pending = [];     // items waiting for a free slot
  const seen = new Set(); // dedupe ids (m3)
  const dlq = [];         // poison jobs (m2)
  let active = 0;         // running handlers
  let outstanding = 0;    // pushed - (succeeded + dead-lettered)
  let processed = 0;
  let closed = false;
  const idleResolvers = [];

  function push(job) {
    if (closed) throw new Error('queue closed');
    if (job && job.id !== undefined) {
      if (seen.has(job.id)) return false;   // dedupe: at-least-once -> once
      seen.add(job.id);
    }
    outstanding++;
    pending.push({ job, attempt: 0 });
    pump();
    return true;
  }

  // Fill free slots from the pending list.
  function pump() {
    while (active < concurrency && pending.length > 0) {
      const item = pending.shift();
      active++;
      run(item);
    }
  }

  async function run(item) {
    item.attempt++;
    let err = null;
    try {
      await handler(item.job);
    } catch (e) {
      err = e || new Error('unknown');
    }
    active--;
    if (!err) {
      processed++;
      outstanding--;
    } else if (item.attempt >= maxAttempts) {
      dlq.push({ job: item.job, attempts: item.attempt, error: err.message });
      outstanding--;
    } else {
      // Schedule a retry; the job stays "outstanding" while it waits.
      setTimeout(() => {
        pending.push(item);
        pump();
      }, computeBackoff(item.attempt, baseDelayMs));
    }
    pump();
    checkIdle();
  }

  function checkIdle() {
    if (outstanding === 0) idleResolvers.splice(0).forEach((r) => r());
  }

  function onIdle() {
    if (outstanding === 0) return Promise.resolve();
    return new Promise((resolve) => idleResolvers.push(resolve));
  }

  function close() {
    closed = true;
    return onIdle();
  }

  return {
    push,
    onIdle,
    close,
    dlq,
    get processed() { return processed; },
    get active() { return active; },
  };
}
