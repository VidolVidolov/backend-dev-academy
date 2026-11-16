// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// ============================================================================
// LAB: Resilience patterns — timeout, retry, circuit breaker.
// You implement this file. Tests in ../test define the exact contract.
// Run:  academy lab lab-resilience    Reveal: academy lab lab-resilience --solution
// ============================================================================
//
// These three functions are the difference between "one slow dependency" and
// "the whole service is down" (see decision scenario d6). Every outbound call
// in a production system goes through some version of them.
//
// Contract:
//
//   MILESTONE 1 — withTimeout(promise, ms)
//     Resolves/rejects with the promise's result if it settles within ms.
//     Otherwise rejects with an Error whose .name === 'TimeoutError'.
//     Must not leave a dangling timer once settled (clearTimeout).
//
//   MILESTONE 2 — withRetry(fn, { attempts = 3, baseMs = 10 })
//     Calls `await fn(attemptNumber)` up to `attempts` times (1-based).
//     On failure, waits baseMs * 2^(attempt-1) before the next try.
//     If the thrown error has `.retryable === false`, rethrow IMMEDIATELY
//     without further attempts (a 400 will never succeed on retry).
//     If all attempts fail, throw the last error.
//
//   MILESTONE 3 — createBreaker(fn, { threshold = 5, resetMs = 1000 })
//     Returns an async wrapper `call` with call.getState() -> 'closed' |
//     'open' | 'half-open'.
//     - closed: calls pass through; `threshold` CONSECUTIVE failures open it.
//     - open: calls reject instantly with Error .name === 'CircuitOpenError'
//       WITHOUT invoking fn (fail fast — stop hammering a dying dependency).
//     - after resetMs, the next call is a half-open probe: it invokes fn;
//       success closes the breaker (failure count reset), failure re-opens it.
//     - any success resets the consecutive-failure count.
//
// ----------------------------------------------------------------------------

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface Breaker<Args extends any[] = any[], R = any> {
  (...args: Args): Promise<R>;
  getState: () => BreakerState;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  throw new Error('TODO: implement withTimeout');
}

export async function withRetry<T>(fn: (attempt: number) => T | Promise<T>, { attempts = 3, baseMs = 10 } = {}): Promise<T> {
  throw new Error('TODO: implement withRetry');
}

export function createBreaker<Args extends any[], R>(fn: (...args: Args) => Promise<R>, { threshold = 5, resetMs = 1000 } = {}): Breaker<Args, R> {
  throw new Error('TODO: implement createBreaker');
}
