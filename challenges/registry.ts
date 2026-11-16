// Challenge registry. Each challenge is a folder with:
//   solution.ts   <- YOU edit this (starts as a throwing stub)
//   test.ts       <- the grader (Node's built-in test runner)
//   reference.ts  <- a worked solution ('academy solve <id>' reveals it)
// The CLI runs `node --test <folder>/test.ts` and parses the TAP counts: all
// `expect` tests must RUN and PASS. Exit code alone is never trusted, so a
// solution that kills the runner early (e.g. process.exit) cannot fake a pass.
// Every prompt includes a happy-path example: exact input -> expected output.

export interface Challenge {
  title: string;
  dir: string;
  lesson: string;
  hints: string[];
  expect: number;
  prompt: string;
}

export interface ChallengeEntry extends Challenge {
  id: string;
}

export const challenges: Record<string, Challenge> = {
  'ch-event-loop': {
    title: 'Don’t block the event loop',
    dir: 'ch-event-loop',
    lesson: 'p0.l2',
    hints: [
      'A plain items.map() runs start-to-finish on one tick — the event loop never gets a turn. You need to pause somewhere in the middle. Where are the natural pause points?',
      'You can yield to the event loop with: await new Promise((resolve) => setImmediate(resolve)). Everything queued behind you (I/O callbacks, other requests) runs before you resume.',
      'Yield at chunk boundaries: after processing item i, check (i + 1) % chunkSize === 0. Collect results into a preallocated array so order is preserved.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement mapInChunks(items, fn, chunkSize) in solution.ts.
It must apply fn to every item and return the results array, BUT it must yield
to the event loop (using setImmediate) between chunks so a huge array never
blocks the loop / starves I/O. Order of results must match input order.

Example (happy path):
  const out = await mapInChunks([1, 2, 3, 4, 5], (x) => x * 2, 2);
  // out -> [2, 4, 6, 8, 10]
  // fn ran on every item, results in input order, and the function
  // awaited setImmediate after item 2 and after item 4 (chunk size 2),
  // so other callbacks could run in between.`,
  },
  'ch-graceful-shutdown': {
    title: 'Drain in-flight work',
    dir: 'ch-graceful-shutdown',
    lesson: 'p0.l4',
    hints: [
      'You need to REMEMBER the in-flight promises so drain() can wait for them. A Set works: add on track(), remove when the promise settles — fulfilled OR rejected (promise.then(onDone, onDone)).',
      'track() must throw SYNCHRONOUSLY once draining. An `async` function can never do that — it returns a rejected promise instead. Make track a regular function.',
      'drain(): set the flag, then await Promise.all over the tracked (rejection-swallowed) promises. It must WAIT, not exit — process.exit belongs in the SIGTERM handler around the tracker, never inside it.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement createDrainTracker() in solution.ts — the core of graceful
shutdown. It returns { track(promise), drain() }. track() registers in-flight
work; drain() stops accepting new work (further track() throws) and resolves
once all currently in-flight promises settle. This is how you finish live
requests after SIGTERM before exiting.

Example (happy path):
  const { track, drain } = createDrainTracker();
  track(saveOrder());               // a promise that takes ~50ms
  track(sendEmail());               // another in-flight promise
  const done = drain();             // shutdown begins: no new work accepted
  track(anotherJob());              // -> THROWS ("shutting down")
  await done;                       // resolves only after saveOrder + sendEmail settle`,
  },
  'ch-router': {
    title: 'A tiny path-param router',
    dir: 'ch-router',
    lesson: 'p1.l2',
    hints: [
      'Split the pattern on "/" at add() time and pre-classify each segment: does it start with ":" (a param) or not (static)? Store that, not the raw string.',
      'A route matches when the method matches AND the path has the SAME number of segments AND every static segment equals its path counterpart. Params always match — capture decodeURIComponent(value) under the param name.',
      'For "static beats param": among all matching routes, keep the one with the MOST static segments. That makes /users/me beat /users/:id regardless of registration order.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement createRouter() in solution.ts. Support add(method, pattern, handler)
where pattern may contain params like '/users/:id/posts/:postId', and
match(method, path) returning { handler, params } or null. Static routes must
win over param routes on the same path. This is what Express/Fastify do for you.

Example (happy path):
  const r = createRouter();
  const handler = () => 'posts page';
  r.add('GET', '/users/:id/posts/:postId', handler);

  r.match('GET', '/users/42/posts/abc');
  // -> { handler, params: { id: '42', postId: 'abc' } }

  r.match('POST', '/users/42/posts/abc');   // -> null (method mismatch)
  r.match('GET', '/nowhere');               // -> null (no route)`,
  },
  'ch-sql-safe': {
    title: 'Parameterize, never concatenate',
    dir: 'ch-sql-safe',
    lesson: 'p2.l1',
    hints: [
      'Validate columns against the fixed allow-list FIRST — reject anything unknown by throwing before you build any SQL.',
      'Build each clause as `${col} = $${i + 1}` — the column name comes from your allow-list (safe), the VALUE never enters the string.',
      'Collect values in a parallel array in the same order as the clauses. The pair { text, values } goes to the driver, which sends values out-of-band — that is what defeats injection.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement buildSelect(table, filters) in solution.ts. Return
{ text, values } where text is a parameterized SQL string using $1,$2,... and
values holds the parameters in order — NEVER interpolate values into text
(that’s SQL injection). Column names come from a fixed allow-list you validate;
reject unknown columns by throwing.

Example (happy path):
  buildSelect('users', { status: 'active', ownerId: 7 });
  // -> {
  //      text: 'SELECT * FROM users WHERE status = $1 AND ownerId = $2',
  //      values: ['active', 7]
  //    }

  buildSelect('users');                     // -> { text: 'SELECT * FROM users', values: [] }
  buildSelect('users', { password: 'x' });  // -> THROWS (column not in allow-list)`,
  },
  'ch-transactions': {
    title: 'All-or-nothing: the transaction wrapper',
    dir: 'ch-transactions',
    lesson: 'p2.l2',
    hints: [
      'The shape is: await BEGIN, then try { … } catch { … }. Which statement goes in the try, which in the catch?',
      'Success path: await fn(client), then COMMIT, then return the result you got from fn. The COMMIT must happen AFTER fn fully settles — await it.',
      'Failure path: ROLLBACK, then `throw err` — the ORIGINAL error object, not a new one. Callers need the real reason (constraint name, deadlock, …) to react correctly.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement withTransaction(client, fn) in solution.ts — the wrapper every
data layer needs. Send BEGIN, run fn(client); COMMIT and return its result on
success, ROLLBACK and rethrow the ORIGINAL error on failure. Never swallow the
error, never commit a failed transaction.

Example (happy path):
  const result = await withTransaction(client, async (tx) => {
    await tx.query('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
    await tx.query('UPDATE accounts SET balance = balance + 100 WHERE id = 2');
    return 'transferred';
  });
  // client saw: BEGIN, UPDATE..., UPDATE..., COMMIT  ->  result === 'transferred'
  // if the 2nd UPDATE throws: BEGIN, UPDATE..., ROLLBACK — and the error propagates`,
  },
  'ch-auth-owns': {
    title: 'Authorization with ownership + RBAC',
    dir: 'ch-auth-owns',
    lesson: 'p3.l1',
    hints: [
      'Guard the degenerate cases first: no user or no resource → false. Then check rules from MOST powerful to least: admin, then public read, then ownership.',
      'The ownership rule is one comparison: resource.ownerId === user.id — but only for the role "user" and only for read/update/delete.',
      'End with `return false`. Authorization is default-DENY: anything you did not explicitly allow is forbidden. If your function can fall off the end returning undefined, that is a bug.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement can(user, action, resource) in solution.ts. Rules:
- role 'admin' can do anything.
- role 'user' can 'read'/'update'/'delete' a resource only if resource.ownerId === user.id.
- anyone can 'read' a resource where resource.public === true.
- everything else is denied (return false).
This is the OWASP #1 defense: authorize every action against the resource.

Example (happy path):
  const alice = { id: 'u1', role: 'user' };
  const admin = { id: 'a1', role: 'admin' };

  can(alice, 'update', { ownerId: 'u1' });                // -> true  (her own)
  can(alice, 'read',   { ownerId: 'u2', public: true });  // -> true  (public read)
  can(alice, 'delete', { ownerId: 'u2' });                // -> false (not hers)
  can(admin, 'delete', { ownerId: 'u2' });                // -> true  (admin)`,
  },
  'ch-log-context': {
    title: 'Request-scoped logging (AsyncLocalStorage)',
    dir: 'ch-log-context',
    lesson: 'p4.l2',
    hints: [
      'A module-level "currentContext" variable fails the moment two requests interleave: an await lets the other request overwrite it. You need per-async-chain storage — that is exactly what AsyncLocalStorage (node:async_hooks) provides.',
      'runWithContext(ctx, fn) is als.run(ctx, fn) — als.run returns fn\'s return value, so async fns and their results pass straight through.',
      'When writing an entry: als.getStore() gives you the ACTIVE context (or undefined outside any run). Spread it: { level, msg, ...(als.getStore() || {}) }.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement createRequestLogger(sink) in solution.ts using AsyncLocalStorage
(node:async_hooks). Returns { runWithContext(ctx, fn), info(msg), error(msg) }.
Log entries ({ level, msg, ...context }) are pushed onto the sink array. The
context must survive awaits and must NOT leak between two concurrent requests —
that's how a requestId follows a request without threading a logger everywhere.

Example (happy path):
  const sink = [];
  const log = createRequestLogger(sink);
  await log.runWithContext({ requestId: 'r-1' }, async () => {
    log.info('start');     // -> { level:'info', msg:'start', requestId:'r-1' }
    await somethingAsync();
    log.info('done');      // requestId STILL 'r-1' after the await
  });
  log.info('outside');     // -> { level:'info', msg:'outside' }  (no context)`,
  },
  'ch-rate-limiter': {
    title: 'A fixed-window rate limiter',
    dir: 'ch-rate-limiter',
    lesson: 'p4.l3',
    hints: [
      'Keep a Map of key → { windowStart, count }. On every allow(), read the injected clock: const t = now().',
      'If there is no bucket for the key OR t - windowStart >= windowMs, start a fresh bucket at t with count 0 — that is the "window reset".',
      'Check count >= limit BEFORE incrementing: if at the limit, return false WITHOUT counting (denials must not consume allowance). Otherwise increment and return true.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement createRateLimiter({ limit, windowMs, now }) in solution.ts.
Returns { allow(key) } -> boolean. At most \`limit\` allowed calls per key per
window; a fresh window restores the allowance; keys are independent; DENIED
calls consume nothing. \`now\` is an injectable clock (defaults to Date.now) —
the tests drive a fake clock, so behavior is exact, no sleeps.

Example (happy path):
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  rl.allow('ip-1');   // -> true   (1/2)
  rl.allow('ip-1');   // -> true   (2/2)
  rl.allow('ip-1');   // -> false  (limit hit)
  rl.allow('ip-2');   // -> true   (independent key)
  t = 1000;           // window elapsed
  rl.allow('ip-1');   // -> true   (fresh window)`,
  },
  'ch-idempotency': {
    title: 'Idempotency keys',
    dir: 'ch-idempotency',
    lesson: 'p5.l4',
    hints: [
      'Two Maps: one for finished results (key → value), one for in-flight executions (key → Promise). Check finished first, then in-flight.',
      'The concurrency trick: store the PROMISE itself in the in-flight map before awaiting it. Concurrent callers with the same key get that same promise — fn ran once, everyone shares the outcome.',
      'In a finally, delete the in-flight entry. Cache the result ONLY on success — a rejection must leave the key uncached so a later retry can run fn again.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement createIdempotencyStore() in solution.ts returning { run(key, fn) }.
run() must execute fn() only ONCE per key and return the cached result on any
later call with the same key — even if many calls with the same key arrive
concurrently before the first finishes (they must all await the same in-flight
execution, and fn must run exactly once). This makes POST retries safe.

Example (happy path):
  const store = createIdempotencyStore();
  let calls = 0;
  const charge = async () => { calls++; return 'charged-99eur'; };

  await store.run('checkout-42', charge);   // -> 'charged-99eur'  (fn ran; calls === 1)
  await store.run('checkout-42', charge);   // -> 'charged-99eur'  (cached; calls STILL 1)
  await store.run('checkout-43', charge);   // -> 'charged-99eur'  (new key; calls === 2)`,
  },
  'ch-env-config': {
    title: 'Config from env — fail at boot',
    dir: 'ch-env-config',
    lesson: 'p6.l1',
    hints: [
      'Iterate Object.entries(schema) — never the env (it is full of unrelated variables). For each key: is the env value undefined or empty string?',
      'Missing + required → push the key onto a `missing` array and CONTINUE (do not throw yet). Missing + optional → use spec.default. Present → coerce by type; a junk int/bool throws immediately, naming the key.',
      'After the loop, if missing.length, throw ONE error with missing.join(", ") — collecting first is what lets ops fix every missing variable in a single deploy.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement defineConfig(schema, env) in solution.ts — 12-factor config with
startup validation. Coerce 'int' and 'bool' types (junk values throw, naming
the key), apply defaults for missing/empty values, and — the key part — collect
ALL missing required keys and throw ONE error naming every one of them, so ops
fixes the deployment in one round trip.

Example (happy path):
  const config = defineConfig({
    PORT:   { type: 'int', default: 3000 },
    DB_URL: { required: true },
    DEBUG:  { type: 'bool', default: false },
  }, { DB_URL: 'postgres://localhost/app', DEBUG: 'true' });
  // -> { PORT: 3000, DB_URL: 'postgres://localhost/app', DEBUG: true }

  defineConfig({ A: { required: true }, B: { required: true } }, {});
  // -> THROWS one error mentioning BOTH A and B`,
  },
  'ch-health-agg': {
    title: 'Health-check aggregator (/ready engine)',
    dir: 'ch-health-agg',
    lesson: 'p6.l2',
    hints: [
      'Promise.all over Object.entries(checks), where each entry maps to an async task returning [name, result]. That is what makes the checks run in parallel — a for-await loop makes them sequential and fails the wall-clock test.',
      'Wrap each check in its own try/catch: resolve → { ok: true }, catch → { ok: false, error: err.message }. Use Promise.resolve().then(fn) so a synchronously-throwing check is caught too.',
      'The timeout is a Promise.race between the check and a setTimeout-rejection (message matching /timeout/i). Clear the timer in .finally() or the suite hangs on fast checks.',
    ],
    expect: 12, // grader requires all 12 tests to run and pass (no early-exit fakes)
    prompt: `Implement checkHealth(checks, { timeoutMs }) in solution.ts — the engine
behind a readiness probe. Run every check fn in PARALLEL; a rejection becomes
{ ok:false, error }, a check slower than timeoutMs fails with /timeout/i, and
overall ok means every check passed. One bad dependency must never hide the
status of the others.

Example (happy path):
  const result = await checkHealth({
    postgres: async () => db.query('SELECT 1'),
    redis:    async () => redis.ping(),
  }, { timeoutMs: 500 });
  // all healthy -> { ok: true, checks: { postgres: {ok:true}, redis: {ok:true} } }
  // redis down  -> { ok: false, checks: { ..., redis: { ok:false, error:'...' } } }`,
  },
};

export const challengeList: ChallengeEntry[] = Object.entries(challenges).map(([id, c]) => ({ id, ...c }));
