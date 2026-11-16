# Lab: Build a job queue

You build what BullMQ/SQS give you — in ~80 lines. Every production system has
one of these; after this lab you'll know exactly what its knobs do.

## Milestones
**M1 — Bounded concurrency.** N workers max, `onIdle()` when everything drains.

**M2 — Retries + DLQ.** Exponential backoff (`computeBackoff`), give up after
`maxAttempts`, park poison jobs in a dead-letter queue — and never let one
poison job block the healthy ones.

**M3 — Dedupe + graceful close.** At-least-once delivery upstream means your
queue dedupes by job id downstream; `close()` refuses new work and drains
everything in flight (including scheduled retries) — the SIGTERM story again.

## Work loop
```bash
academy lab lab-job-queue              # grade; edit labs/lab-job-queue/src/queue.ts
academy lab lab-job-queue --solution   # reference if stuck
```

## Stretch goals
- Job priorities (a priority queue instead of FIFO).
- Delayed jobs: `push(job, { delayMs })`.
- Emit events (`'completed'`, `'failed'`) like BullMQ does.
- Wire it into your lab-orders-api: enqueue an "order.created" email job.
