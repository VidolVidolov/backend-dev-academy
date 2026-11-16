// Guided build labs — real, multi-file projects built milestone by milestone.
// Each milestone is a test file run in order; the first failing one is where you are.

export interface Milestone {
  id: string;
  name: string;
  test: string;
  expect: number;
}

export interface Lab {
  title: string;
  dir: string;
  file: string;
  solution: string;
  phase: string;
  milestones: Milestone[];
}

export interface LabEntry extends Lab {
  id: string;
}

export const labs: Record<string, Lab> = {
  'lab-orders-api': {
    title: 'Build a real Orders API (no framework)',
    dir: 'lab-orders-api',
    file: 'src/app.ts',
    solution: 'src/app.reference.ts',
    phase: 'p1',
    milestones: [
      { id: 'm1', name: 'Routing + CRUD', test: 'test/m1.test.ts', expect: 10 },
      { id: 'm2', name: 'Validation + errors', test: 'test/m2.test.ts', expect: 10 },
      { id: 'm3', name: 'Idempotency (safe retries)', test: 'test/m3.test.ts', expect: 10 },
    ],
  },
  'lab-auth': {
    title: 'Auth from scratch — hashing, sessions, authorization',
    dir: 'lab-auth',
    file: 'src/app.ts',
    solution: 'src/app.reference.ts',
    phase: 'p3',
    milestones: [
      { id: 'm1', name: 'Registration + password hashing', test: 'test/m1.test.ts', expect: 10 },
      { id: 'm2', name: 'Login + session tokens', test: 'test/m2.test.ts', expect: 10 },
      { id: 'm3', name: 'Ownership authorization', test: 'test/m3.test.ts', expect: 10 },
    ],
  },
  'lab-job-queue': {
    title: 'Build a job queue (concurrency, retries, DLQ)',
    dir: 'lab-job-queue',
    file: 'src/queue.ts',
    solution: 'src/queue.reference.ts',
    phase: 'p3',
    milestones: [
      { id: 'm1', name: 'Bounded concurrency', test: 'test/m1.test.ts', expect: 10 },
      { id: 'm2', name: 'Retries + dead-letter queue', test: 'test/m2.test.ts', expect: 10 },
      { id: 'm3', name: 'Dedupe + graceful close', test: 'test/m3.test.ts', expect: 10 },
    ],
  },
  'lab-resilience': {
    title: 'Resilience: timeout, retry, circuit breaker',
    dir: 'lab-resilience',
    file: 'src/resilience.ts',
    solution: 'src/resilience.reference.ts',
    phase: 'p5',
    milestones: [
      { id: 'm1', name: 'withTimeout', test: 'test/m1.test.ts', expect: 10 },
      { id: 'm2', name: 'withRetry (backoff, non-retryable)', test: 'test/m2.test.ts', expect: 10 },
      { id: 'm3', name: 'Circuit breaker', test: 'test/m3.test.ts', expect: 10 },
    ],
  },
};

export const labList: LabEntry[] = Object.entries(labs).map(([id, l]) => ({ id, ...l }));
