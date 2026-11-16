// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// ============================================================================
// LAB: Build a job queue — the heart of every background-work system.
// You implement this file. Tests in ../test define the exact contract.
// Run:  academy lab lab-job-queue     Reveal: academy lab lab-job-queue --solution
// ============================================================================
//
// This is what BullMQ/SQS do for you: bounded concurrency, retries with
// exponential backoff, a dead-letter queue for poison jobs, dedupe for
// at-least-once safety, and graceful shutdown. ~80 lines of real engineering.
//
// Contract:
//
//   computeBackoff(attempt, baseMs, capMs = 30000)
//     -> baseMs * 2^(attempt-1), capped at capMs.   (pure function)
//
//   createQueue({ handler, concurrency = 1, maxAttempts = 3, baseDelayMs = 10 })
//     returns { push, onIdle, close, dlq, processed, active }
//
//   MILESTONE 1 — dispatch with bounded concurrency
//     push(job) enqueues; handler(job) is called for each job, but never more
//     than `concurrency` handlers run at once. onIdle() resolves when there is
//     no pending, in-flight, or retry-scheduled work left.
//     `processed` (getter) counts successful jobs; `active` (getter) counts
//     currently-running handlers.
//
//   MILESTONE 2 — retries with backoff + dead-letter queue
//     A job whose handler throws is retried (after computeBackoff(attempt,
//     baseDelayMs) ms) until it succeeds or has been attempted maxAttempts
//     times, then it is pushed to `dlq` as { job, attempts, error } and never
//     retried again. computeBackoff must be exact (tests check the math).
//
//   MILESTONE 3 — dedupe + graceful close
//     If a job has an `id` and that id was pushed before, push() returns false
//     and the job is NOT processed again (at-least-once delivery upstream ->
//     dedupe downstream). Otherwise push() returns true.
//     close() stops accepting new work (push() after close throws) and
//     resolves once all outstanding work (including scheduled retries) drains.
//
// ----------------------------------------------------------------------------

export interface Queue {
  push: (job: any) => boolean;
  onIdle: () => Promise<void>;
  close: () => Promise<void>;
  dlq: { job: any; attempts: number; error: string }[];
  readonly processed: number;
  readonly active: number;
}

export interface QueueOptions {
  handler: (job: any) => any;
  concurrency?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export function computeBackoff(attempt, baseMs, capMs = 30000): number {
  throw new Error('TODO: implement computeBackoff');
}

export function createQueue({ handler, concurrency = 1, maxAttempts = 3, baseDelayMs = 10 }: QueueOptions): Queue {
  throw new Error('TODO: implement createQueue');
}
