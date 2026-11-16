// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for lab-resilience.

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`timed out after ${ms}ms`);
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function withRetry<T>(fn: (attempt: number) => T | Promise<T>, { attempts = 3, baseMs = 10 } = {}): Promise<T> {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      // A non-retryable error (e.g. a 400) will never succeed — bail out.
      if (err && err.retryable === false) throw err;
      if (attempt === attempts) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** (attempt - 1)));
    }
  }
  throw lastErr; // unreachable, kept for clarity
}

export function createBreaker<Args extends any[], R>(fn: (...args: Args) => Promise<R>, { threshold = 5, resetMs = 1000 } = {}): import('./resilience.ts').Breaker<Args, R> {
  let consecutiveFailures = 0;
  let state = 'closed'; // 'closed' | 'open' | 'half-open'
  let openedAt = 0;

  async function call(...args) {
    if (state === 'open') {
      if (Date.now() - openedAt >= resetMs) {
        state = 'half-open'; // let one probe through
      } else {
        const e = new Error('circuit open — failing fast');
        e.name = 'CircuitOpenError';
        throw e;
      }
    }
    try {
      const result = await fn(...args);
      consecutiveFailures = 0;
      state = 'closed';
      return result;
    } catch (err) {
      consecutiveFailures++;
      if (state === 'half-open' || consecutiveFailures >= threshold) {
        state = 'open';
        openedAt = Date.now();
      }
      throw err;
    }
  }

  call.getState = () => state;
  return call;
}
