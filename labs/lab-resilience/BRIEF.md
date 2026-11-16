# Lab: Resilience patterns — timeout, retry, circuit breaker

The three functions that stop "one slow dependency" from becoming "the whole
service is down" (decision scenario d6, lesson p3.l3). You build them for real.

## Milestones
**M1 — withTimeout.** Bound every wait; reject with `TimeoutError` and clean up
the timer.

**M2 — withRetry.** Exponential backoff between attempts; **never** retry an
error marked non-retryable (a 400 won't get better); throw the last error.

**M3 — Circuit breaker.** Open after N consecutive failures and fail fast
without touching the dependency; half-open probe after `resetMs`; success
closes, failure re-opens.

## Work loop
```bash
academy lab lab-resilience              # grade; edit labs/lab-resilience/src/resilience.ts
academy lab lab-resilience --solution   # reference if stuck
```

## Stretch goals
- Add jitter to the retry backoff (thundering-herd protection).
- Compose them: `breaker(() => withRetry(() => withTimeout(fetch(...), 500)))`
  — think hard about the right nesting order and why.
- Emit state-change events from the breaker for observability.
