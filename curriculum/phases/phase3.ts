// Phase 3 — Real-world API engineering: the concerns that turn a toy into a service.
// New-joiner depth: problem first, then the pattern, then runnable code.

import type { Phase } from '../types.ts';

export default {
  id: 'p3',
  title: 'Production API Engineering',
  weeks: 4,
  goal: 'Auth, validation, error handling, config, logging, caching, rate limiting, file handling, background jobs/queues, and real-time — the concerns that turn a toy into a service.',
  modules: [
    {
      id: 'p3.m1',
      title: 'Auth & security fundamentals',
      lessons: [
        {
          id: 'p3.l1',
          title: 'Authentication: sessions, JWT, OAuth2/OIDC',
          minutes: 80,
          body: `# Authentication: sessions, JWT, OAuth2/OIDC

Auth is where a backend mistake stops being a bug and becomes a breach. The
good news: it decomposes into a few clean problems. Let's take them in order:
storing passwords, keeping users logged in, delegating login, and — the one
that actually tops the vulnerability charts — deciding what a logged-in user
may *do*.

## Problem 1: storing passwords

Rule zero: **you never store a password.** You store something that lets you
*verify* one. If your database leaks (assume someday it will), plaintext
passwords burn every user — including on the *other* sites where they reused
them.

The instinctive fix — hash them with SHA-256 — is wrong in an instructive
way: SHA-256 is *designed to be fast*, and fast is fatal here. A single GPU
computes billions of SHA-256 hashes per second, so an attacker with your
leaked table just hashes every common password and looks for matches.
Password storage needs the opposite of fast: **deliberately slow, memory-
hungry functions** — \`argon2id\` (the modern pick), \`bcrypt\` (the veteran),
or \`scrypt\` (built into Node — you used it in lab-auth). At ~50-100ms per
attempt, a billion guesses stops taking seconds and starts taking years.

Second ingredient: a **salt** — random bytes, unique per user, stored next to
the hash, mixed in before hashing. Without salts, equal passwords produce
equal hashes: crack one, crack them all, and precomputed "rainbow tables"
work. With salts, every user must be attacked individually. (Every modern
library salts automatically — lab-auth's tests literally verified yours
differed.)

\`\`\`js
import argon2 from 'argon2';
const hash = await argon2.hash(password);          // salted, slow, encoded
const ok = await argon2.verify(hash, attempt);     // true/false
\`\`\`

And a detail you already met: login must return the **same 401 for "no such
user" and "wrong password"** — different answers let attackers enumerate
which emails have accounts.

## Problem 2: staying logged in

HTTP is stateless — every request arrives with amnesia. Two architectures
exist for "prove it's still me", and choosing between them is decision d2.

**Server-side sessions** (the classic). On login, generate a random opaque
token, store \`token → userId\` server-side (Redis, with TTL), hand the token
to the client:

\`\`\`
login ok → SET session:a1b2c3 = 42 EX 604800  → client stores "a1b2c3"
request  → reads token → GET session:a1b2c3   → it's user 42
logout   → DEL session:a1b2c3                 → token instantly dead
\`\`\`

The token itself is meaningless — a claim check, not information. Strengths:
**instant revocation** (logout everywhere = delete keys; stolen token = kill
it) and dead-simple reasoning. Cost: one fast Redis lookup per request.

**JWT — JSON Web Tokens** (the stateless one). Put the facts *in* the token
and **sign** it so tampering is detectable:

\`\`\`
header.payload.signature
eyJhbGciOi...  .  eyJzdWIiOiI0MiIsImV4cCI6...  .  SflKxwRJ...
       payload (base64, NOT encrypted!): { "sub": "42", "exp": 1735689600 }
\`\`\`

The server verifies the signature with its secret — valid signature = "I
issued this and nobody altered it" — **no storage lookup at all**. Any
instance, any service can verify. Two sharp edges, both famous:

1. **Payloads are readable by anyone** — base64 is encoding, not encryption.
   Never put secrets in a JWT.
2. **You can't revoke a stateless token.** It's valid until \`exp\`, period.
   Logout can't kill it; a stolen one rides out its lifetime. The industry
   pattern that makes this livable: **short-lived access token (5–15 min) +
   long-lived refresh token that IS stored server-side**. The access token
   authenticates requests statelessly; when it expires, the refresh token —
   which you *can* revoke, and which rotates on every use — mints a new one.
   Compromise window shrinks to minutes; revocation lives at the refresh
   step.

Also: verify with explicit algorithms (\`jwt.verify(token, secret,
{ algorithms: ['HS256'] })\`) — historic attacks smuggled \`"alg": "none"\`
tokens past sloppy verifiers.

Rule of thumb: single app + instant-revocation requirement → sessions.
Many services needing to verify identity without a shared session store →
JWTs (with the refresh pattern). Not fashion — requirements (d2 again).

## Problem 3: "Log in with Google" — OAuth2 / OIDC

Users hate new passwords; you'd rather not run password infrastructure. So
delegate: **OAuth2** lets a user grant your app access via a provider;
**OIDC** (OpenID Connect) is the identity layer on top that answers *who
they are*. The flow to know — **Authorization Code + PKCE**:

1. You redirect to Google with your \`client_id\`, a \`redirect_uri\`, and a
   PKCE challenge (a hash of a one-time secret you keep).
2. User authenticates *on Google* — credentials never touch your servers.
3. Google redirects back with a one-time **code**.
4. Your *backend* exchanges code + PKCE secret for tokens, including an
   **id_token** (a JWT: subject, email) — verify its signature, then create
   YOUR own session/JWT as above.

PKCE exists so an intercepted redirect code is useless without the secret.
Use a maintained library or provider (Auth0/Clerk/Cognito/Keycloak); know
the flow anyway, because you'll debug redirect/callback issues forever.

## Problem 4 — the one that actually gets exploited: authorization

Authentication = who you are. **Authorization = what you may do.** Broken
access control is **OWASP's #1** web vulnerability class, and the bug is
embarrassingly simple. This handler is authenticated and still catastrophic:

\`\`\`js
app.get('/orders/:id', requireLogin, async (req, res) => {
  res.json(await db.orders.find(req.params.id));   // ANY user, ANY order 💥
});
\`\`\`

Being logged in says nothing about *whose order that is*. Increment the id
in the URL and read every order in the company (this exact bug — "IDOR" —
has hit banks and airlines; testers try it in their first five minutes).
The fix is a per-resource ownership check, every time:

\`\`\`js
const order = await db.orders.find(req.params.id);
if (!order || order.userId !== req.user.id) {
  return res.status(404).json({ error: 'not found' });  // 404, not 403:
}                                // don't confirm the id exists (p1.l1)
res.json(order);
\`\`\`

Layer roles on top — **RBAC** (\`admin\` bypasses ownership, \`user\` doesn't) —
exactly the \`can(user, action, resource)\` you built in ch-auth-owns. The
habit that prevents the breach: for every endpoint ask **"authenticated as
whom, authorized on which resource, checked where?"** — and never trust a
role or userId that arrived from the client.

> **Do now:** \`academy challenge ch-auth-owns\` if not yet green, then the
> full build: \`academy lab lab-auth\` — hashing, sessions, enumeration-safe
> login, and ownership 404s, all test-gated.`,
          quiz: [
            {
              q: 'Best current default for hashing passwords?',
              choices: ['SHA-256', 'argon2id (or bcrypt)', 'MD5 with salt', 'base64'],
              answer: 1,
              explain: 'Slow, memory-hard, salted algorithms resist brute force; fast hashes do not.',
            },
            {
              q: 'The main operational downside of stateless JWTs is…',
              choices: ['they are too small', 'you cannot easily revoke them before expiry', 'they require Redis', 'they cannot be signed'],
              answer: 1,
              explain: 'No server lookup means no easy invalidation; mitigate with short TTL + refresh rotation + denylist.',
            },
            {
              q: 'OWASP\'s #1 risk class, and the most common auth mistake, is…',
              choices: ['SQL injection', 'broken access control (missing/incorrect authorization checks)', 'weak TLS', 'verbose errors'],
              answer: 1,
              explain: 'Authenticating users but failing to authorize each action/resource ownership is the top bug.',
            },
          ],
          challenge: 'ch-auth-owns',
        },
        {
          id: 'p3.l2',
          title: 'Validation, errors, config & logging',
          minutes: 70,
          body: `# Validation, errors, config & logging

Four topics that sound like chores and are actually the *skeleton* of a
production service. Ask any senior what separates toy code from production
code — this lesson is the answer they'll give.

## Validation: parse, don't check

From p0.l1: every inbound byte is untrusted, and TypeScript types are erased
at runtime. The professional pattern is **validate once, at the edge, into a
typed value** — everything downstream then works with data that's *proven*
clean. As a frontend dev you may already know the perfect tool — **zod**:

\`\`\`js
import { z } from 'zod';

const CreateOrder = z.object({
  items: z.array(z.object({
    sku: z.string().min(1),
    qty: z.number().int().positive(),      // integers > 0 only
  })).min(1),                              // at least one item
  couponCode: z.string().max(32).optional(),
}).strict();                               // unknown fields = reject

app.post('/orders', (req, res) => {
  const parsed = CreateOrder.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION', details: parsed.error.issues },
    });
  }
  const order = parsed.data;   // ✅ typed AND runtime-guaranteed from here on
});
\`\`\`

The mindset shift is in the verb: don't *check* the data ("is qty a
number?") — **parse** it into a value that can only exist if valid. Handlers
and services below the edge never re-validate; they trust the type because
the runtime actually enforced it. (\`.strict()\` matters more than it looks:
silently accepting unknown fields is how "extra" data sneaks into spreads
and inserts. Reject what you didn't ask for.)

Bonus for you specifically: the same zod schema can validate the form on the
frontend and the request on the backend — one contract, shared.

## Errors: two species, one handler

Production error handling starts with a distinction worth tattooing:

- **Operational errors** — expected outcomes of a hostile world: bad input,
  missing resource, downstream timeout. *Handle* them: clean status + safe
  message, business as usual.
- **Programmer errors** — bugs: undefined property, broken invariant. The
  process state is now *unknown*. Log loudly and **crash** (p0.l4); the
  orchestrator restarts you clean. Catching-and-continuing a bug is how
  zombies serve corrupted data for six hours.

Make operational errors first-class citizens with an error hierarchy and ONE
translation point:

\`\`\`js
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status; this.code = code;
    this.operational = true;
  }
}
class NotFoundError extends AppError {
  constructor(what) { super(404, 'NOT_FOUND', \`\${what} not found\`); }
}

// handlers just throw — no res.status() scattered through business logic:
app.get('/orders/:id', async (req) => {
  const order = await orders.find(req.params.id);
  if (!order) throw new NotFoundError('order');
  return order;
});

// ONE place turns errors into HTTP:
app.use((err, req, res, next) => {
  if (err.operational) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  logger.error({ err, reqId: req.id }, 'unexpected error');   // full detail for YOU
  res.status(500).json({ error: { code: 'INTERNAL', message: 'internal error' } });
});                                                    // nothing for attackers
\`\`\`

Business logic stays pure ("this doesn't exist" → throw), HTTP mapping lives
in one reviewable place, and the 500 branch leaks nothing (stack traces are
free reconnaissance — p1.l2).

## Config: fail at boot, not at midnight

You know from p0.l4 that config comes from \`process.env\`. The upgrade —
using the tool you just learned: **validate the environment like it's user
input**, once, at startup:

\`\`\`js
const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),        // env vars are strings; coerce
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

export const config = Env.parse(process.env);   // throws at BOOT if wrong
\`\`\`

The failure-time trade is the whole point: an unset \`DATABASE_URL\` now
crashes the deploy in ten seconds with a named error — instead of surfacing
at 2am as the first database query failing in production. Boot order for a
real service: **validate config → connect dependencies → THEN listen.**
Accepting traffic before you can serve it just converts your outage into
your users' errors.

## Logging: structured, or it doesn't count

\`console.log('user logged in!')\` works until the day you're staring at
production trying to answer "what happened to request X at 14:32?". That day
you'll want **structured logs** — one JSON object per event, machine-
queryable:

\`\`\`js
import pino from 'pino';
const logger = pino();

logger.info({ userId: 42, orderId: 917, ms: 130 }, 'order created');
// {"level":30,"time":1735...,"userId":42,"orderId":917,"ms":130,"msg":"order created"}
\`\`\`

Now your log platform can *query*: every event for user 42, all requests
over 500ms, error-rate per endpoint. Prose logs can't do any of that. The
essential habits:

- **Correlation id**: generate an id per request (middleware), attach it to
  every log line that request produces, return it in an \`x-request-id\`
  header. A user reports an error → they give you the id → you pull the
  request's *entire story* across every log line (and later, across
  services — Phase 4 tracing is this idea, industrialized). Without it, logs
  from 200 concurrent requests are interleaved noise.
- **Levels**: \`debug\` (dev noise), \`info\` (business events), \`warn\`
  (degraded), \`error\` (failed). Production runs at info.
- **Log to stdout** — the platform ships logs; your app doesn't manage files.
- **Never log secrets**: no passwords, tokens, cookie headers, card numbers.
  Leaked logs are breaches too; pino's \`redact\` option exists for this.

> **Try it now (25 min):** wire all four into your lab-orders-api: a zod
> schema on POST /orders, the AppError + central handler, a zod-validated
> config object, and pino with a request-id middleware. Then curl a bad
> request and a good one and read the JSON log lines you produced. That's
> production shape — and exactly what the Graduation Project graders expect.`,
          quiz: [
            {
              q: 'Where should untrusted request data be validated?',
              choices: ['In the database only', 'At the edge/boundary, into a typed trusted shape, before business logic', 'In the frontend only', 'Nowhere if using TypeScript'],
              answer: 1,
              explain: 'Validate once at the boundary; downstream code then trusts the data. TS types are erased at runtime.',
            },
            {
              q: 'Operational vs programmer errors: a null-deref bug should…',
              choices: ['be caught and ignored', 'crash the process and let it restart (it is an unknown state)', 'return 400', 'be retried forever'],
              answer: 1,
              explain: 'Programmer errors mean the process state is untrustworthy; fail fast and restart clean.',
            },
            {
              q: 'A correlation/request id in logs primarily enables…',
              choices: ['faster JSON parsing', 'tracing a single request across handlers/services', 'smaller log files', 'encryption'],
              answer: 1,
              explain: 'It stitches together all log lines (and services) for one request.',
            },
          ],
        },
      ],
    },
    {
      id: 'p3.m2',
      title: 'Scale-shaped concerns & real-time',
      lessons: [
        {
          id: 'p3.l3',
          title: 'Caching, rate limiting, pagination, uploads',
          minutes: 70,
          body: `# Caching, rate limiting, uploads & staying alive

Four defenses every public API needs before real traffic finds it. Each one
follows from a failure story — let's take them failure-first.

## Caching: the layers, assembled

You know cache-aside with Redis (p2.l4). Zoom out: production caching is a
*gauntlet* a request runs, cheapest layer first:

\`\`\`
browser cache → CDN (edge) → app memory → Redis → Postgres (the truth)
   ~0ms          ~10ms         ~0.01ms     ~1ms       ~5-50ms
\`\`\`

- **HTTP caching** — you already own the headers (p1.l1): \`Cache-Control:
  public, max-age=300\` lets browsers and CDNs serve repeats without touching
  you; \`ETag\` + \`If-None-Match\` turns unchanged re-fetches into empty 304s.
  For anonymous GET traffic this is the cheapest scaling lever in existence —
  the request never reaches your server at all.
- **In-process memory** (a Map with TTL): fastest possible, but *per
  instance* — 5 servers = 5 disagreeing caches, and it eats your heap. Fine
  for small, hot, rarely-changing data (feature flags); wrong for shared
  state.
- **Redis**: the shared cache tier — one truth-ish layer all instances see
  (p2.l4's patterns: TTLs, delete-on-write, stampede protection).

The judgment call per endpoint is always the same triple: *how expensive is
the read, how hot is it, how stale can it be?* Expensive + hot + staleness-
tolerant = cache aggressively. Cheap or freshness-critical = don't add lying
as a feature.

## Rate limiting: because someone WILL hammer you

The failure: a bug in a client retry loop — or a bot — sends one endpoint
5,000 requests/min. Without a limiter this becomes *everyone's* outage
(and on \`/login\`, it's a password-guessing tool).

Two algorithms cover practice. **Fixed window** — what you built in p2.l4
with INCR+EXPIRE: count per user per minute; simple, slightly bursty at
window edges (up to 2x across the boundary). **Token bucket** — the
industry favorite: a bucket holds up to N tokens, refilling at R/sec; each
request spends one. Steady rate R with graceful bursts up to N — exactly how
clients actually behave.

Non-negotiables regardless of algorithm:
- Counters live in **Redis**, not process memory — 5 instances × "100/min
  each" is a 500/min limit you didn't intend (and it's random per user).
  Atomic INCR means no race (d2's cousin, decision d9's neighbor).
- Reply **429** with \`Retry-After: 30\` — well-behaved clients back off.
- **Layer it**: strict per-IP on \`/login\` (attack surface), generous
  per-user on the API, plus a global circuit for total overload.

## Uploads: don't be the middleman

The failure: you add profile pictures, buffer uploads through your server,
and memory + worker time drown the day a marketing email goes out. The
senior pattern is **presigned URLs** — your server *authorizes*, object
storage (S3 and friends) does the *lifting*:

\`\`\`js
// 1. Client asks: "may I upload avatar.png?"
app.post('/uploads', requireLogin, async (req, res) => {
  const key = \`avatars/\${req.user.id}/\${crypto.randomUUID()}.png\`;
  const url = await getSignedUploadUrl({           // time-limited, key-locked
    bucket: 'my-app-uploads', key,
    contentType: 'image/png', maxBytes: 5_000_000, expiresIn: 300,
  });
  res.json({ url, key });
});
// 2. Client PUTs the file bytes DIRECTLY to S3 — not through you.
// 3. Client tells you it's done; you store the key, validate, thumbnail async.
\`\`\`

Your API handles two tiny JSON exchanges; gigabytes flow client→S3. Sharp
edges that remain yours: cap size and content-type *in the signature*
(clients lie), never trust filenames (path traversal — you generate the
key), and never serve user bytes from your API domain (XSS via uploaded
HTML; serve from a separate storage domain/CDN).

## Timeouts, retries, breakers: the resilience kit

The failure — the one that kills whole platforms: your API calls a shipping-
rates vendor. Vendor gets slow: 80ms → 20s. Every request holds a
connection 20 seconds… your pool exhausts… **endpoints that never touch
shipping start failing too**, because they're queueing behind the stuck
ones. One sick dependency, total outage — a *cascading failure* (decision
d6 is literally this story).

The kit — which you will build with your own hands in \`lab-resilience\`:

1. **Timeouts on every outbound call.** No exceptions — HTTP, DB, Redis.
   An unbounded wait is a resource leak with a fuse attached:
   \`fetch(url, { signal: AbortSignal.timeout(2000) })\`.
2. **Retries with exponential backoff + jitter** — retry *transient* errors
   (timeout, 503) at 200ms → 400ms → 800ms with randomness (jitter) so a
   thousand clients don't retry in lockstep and stampede the recovering
   service. Never retry non-retryable errors (a 400 won't improve), and
   never retry non-idempotent operations without an idempotency key
   (p1.l4 — see how it all links?).
3. **Circuit breaker** — after N consecutive failures, stop calling for a
   cooldown: fail *fast* with a fallback ("rates unavailable") instead of
   waiting on a corpse; probe occasionally; close when healthy. Protects
   your threads AND gives the dependency air to recover.

One sentence to keep: **every outbound call gets a timeout; every retry gets
backoff, jitter, and an idempotency guarantee; every flaky dependency gets a
breaker and a fallback.**

> **Do now:** \`academy lab lab-resilience\` — you'll implement withTimeout,
> withRetry, and a real circuit breaker, test-gated. Then decision \`d6\`
> replays the cascading-failure incident as a judgment call.`,
          quiz: [
            {
              q: 'A rate limiter shared across many app instances should live in…',
              choices: ['each instance\'s local memory', 'a shared store like Redis (atomic counters)', 'the client', 'the database schema'],
              answer: 1,
              explain: 'Per-instance counters let a client exceed the global limit by hitting different instances.',
            },
            {
              q: 'Best way to handle large user file uploads?',
              choices: ['Buffer the whole file in Node memory', 'Base64 in a JSON body', 'Pre-signed URLs so clients upload directly to object storage', 'Store in Postgres as bytea'],
              answer: 2,
              explain: 'Pre-signed URLs keep large bytes out of your app process entirely.',
            },
            {
              q: 'The single most important reliability knob on every outbound network call is…',
              choices: ['a cache', 'a timeout', 'a bigger pool', 'gzip'],
              answer: 1,
              explain: 'Without timeouts, one slow dependency exhausts your workers and cascades.',
            },
          ],
        },
        {
          id: 'p3.l4',
          title: 'Background jobs, queues & real-time',
          minutes: 75,
          body: `# Background jobs, queues & real-time

The last mindset upgrade of this phase: **not everything belongs in the
request.** Master when to answer *now* versus *promise and deliver soon*,
and you unlock half of system design.

## The problem: slow work inside the request

"Send a receipt email after checkout." First instinct:

\`\`\`js
app.post('/checkout', async (req, res) => {
  const order = await createOrder(req.body);
  await sendReceiptEmail(order);          // 2 seconds of SMTP... 😬
  res.status(201).json(order);
});
\`\`\`

Three escalating problems: the user waits 2s for an email they don't need to
wait for; if the email provider is *down*, checkout fails (a paid order 500s
because of a receipt!); and email time consumes your request capacity.
Diagnosis: the email is not *part of* checkout — it's a *consequence*. The
response only needs the order.

## The fix: a job queue

Put a **queue** between "decide to do work" and "do it":

\`\`\`
API (producer) → [ queue ] → worker process (consumer)
   enqueue job     holds jobs    processes at its own pace, retries on failure
\`\`\`

\`\`\`js
// producer — in the request, enqueue is ~1ms:
await emailQueue.add('receipt', { orderId: order.id });
res.status(201).json(order);              // user is gone, instantly

// consumer — a SEPARATE process (scale it independently of the API):
const worker = new Worker('email', async (job) => {
  const order = await db.orders.find(job.data.orderId);
  await sendReceiptEmail(order);          // provider down? throws → retried
}, { connection: redis, concurrency: 5 });
\`\`\`

That's **BullMQ** (Redis-backed — the same Redis you already run; decision
d9 covers when SQS/RabbitMQ/Kafka earn their extra weight instead). What a
real queue gives you beyond the array-in-memory version — you built every
one of these in \`lab-job-queue\`, so read this list as your own feature set:
**bounded concurrency**, **retries with exponential backoff**, a **dead-
letter queue** (jobs that failed max attempts get parked for humans, not
retried forever, not silently dropped), **delayed/scheduled jobs**, and
**graceful shutdown** (drain in-flight jobs on SIGTERM — p0.l4 rides again).

What belongs in a queue: emails/notifications, image/video processing,
webhooks to third parties, exports, sync jobs — anything slow, failable, or
not needed for the response. The API's new job description: *validate,
persist, enqueue, respond.*

## The rule that makes queues safe: idempotent consumers

Queues promise **at-least-once** delivery. A worker crashes after doing the
work but before acknowledging it → the job is redelivered → the work happens
*twice*. "Exactly-once delivery" is, for practical purposes, a myth — so the
fix lives in YOUR handler: make doing it twice harmless. Techniques you now
recognize from p1.l4 and ch-idempotency: dedupe by a business key
(\`emailed_receipt_for_order_42\` — a unique constraint makes the second
attempt a no-op), or make the operation naturally idempotent (\`status =
'sent'\` twice is fine; \`count += 1\` twice is not). This isn't optional
polish — it's the contract of queue-based systems.

## The dual-write trap → the outbox pattern

Subtle, famous, and a favorite interview probe. Checkout must (a) save the
order in Postgres and (b) enqueue the email job in Redis. **Two systems, no
shared transaction:**

\`\`\`js
await db.orders.create(order);            // Postgres: committed ✅
await emailQueue.add('receipt', ...);     // 💥 crash here → order, no email
\`\`\`

Flip the order and you get the opposite ghost (email for an order that
rolled back). You cannot fix this with ordering — that's the **dual-write
problem**. The fix is the **transactional outbox**: write the *event* into
Postgres **inside the same transaction** as the order:

\`\`\`sql
BEGIN;
INSERT INTO orders (...) VALUES (...);
INSERT INTO outbox (event_type, payload)          -- same transaction!
  VALUES ('order.created', '{"orderId": 42}');
COMMIT;      -- order + event are now atomically together (ACID doing its job)
\`\`\`

A small **relay** loop polls the outbox and publishes rows to the real queue
(marking them relayed). Crash anywhere → the event is still safely in
Postgres → relay picks it up next pass. Combined with idempotent consumers,
the system *converges*: nothing lost, duplicates harmless. This exact
pattern — outbox → queue → idempotent consumer — is Graduation stage G5.

## Real-time: pushing TO the client

Queues decouple you from slow work; one more channel remains: the server
telling the *browser* something happened. Three transports, one decision
(you'll defend it in d13):

- **Polling** — client asks every N seconds. Crude, maximally compatible,
  latency = N. Fine as a fallback.
- **SSE (Server-Sent Events)** — one long-lived HTTP response the server
  keeps writing events into. **Server→client only**, plain HTTP
  (proxy-friendly), auto-reconnect built into the browser's
  \`EventSource\`. For notifications, feeds, live status — the usual right
  answer, and the humble hero of real-time.
- **WebSockets** — a full duplex socket, both directions, low latency. For
  chat, collaboration, games. Costs: a stateful connection per client, and —
  Phase 5's statelessness rule colliding with reality — with multiple
  instances, user A (instance 1) messaging user B (instance 3) needs a
  **shared backplane**: instances subscribe to Redis pub/sub and relay to
  their local sockets.

Choose by *traffic shape*: one-way, low-frequency → SSE. Genuinely
bidirectional → WebSockets. Don't pay the WebSocket operational tax for
data that only ever flows one way.

> **Do now:** \`academy lab lab-job-queue\` if it isn't green yet — after this
> lesson, every milestone in it (concurrency, retries+DLQ, dedupe, graceful
> close) should read as "oh, that's just the contract of real queues." Then
> take decisions \`d9\` and \`d13\`.`,
          quiz: [
            {
              q: 'Job queues typically guarantee at-least-once delivery, so your handler must be…',
              choices: ['fast', 'idempotent (safe to run twice)', 'synchronous', 'written in TypeScript'],
              answer: 1,
              explain: 'Redeliveries happen; dedupe by a business/job key so repeats do not double-apply.',
            },
            {
              q: 'The Outbox pattern solves…',
              choices: ['slow queries', 'the dual-write problem: committing DB state and publishing an event atomically', 'password hashing', 'CORS'],
              answer: 1,
              explain: 'Event is written in the same transaction as state; a relay publishes it afterward.',
            },
            {
              q: 'To scale WebSockets across multiple app instances you need…',
              choices: ['nothing special', 'a shared pub/sub (e.g. Redis adapter) or sticky sessions to route/broadcast', 'HTTP/2 only', 'to disable load balancing'],
              answer: 1,
              explain: 'A client on instance A must receive messages published on instance B — hence a shared backplane.',
            },
          ],
        },
      ],
    },
  ],
} satisfies Phase;
