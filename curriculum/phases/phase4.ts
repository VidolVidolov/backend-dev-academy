// Phase 4 — Quality: testing, observability, security. Non-negotiable for senior.
// New-joiner depth: why each practice exists, then exactly how to do it.

import type { Phase } from '../types.ts';

export default {
  id: 'p4',
  title: 'Testing, Observability & Security',
  weeks: 3,
  goal: 'Test backends properly (unit → integration → e2e, with real dependencies), make services observable (logs, metrics, traces), and internalize the security practices that keep you off the incident report.',
  modules: [
    {
      id: 'p4.m1',
      title: 'Testing backends',
      lessons: [
        {
          id: 'p4.l1',
          title: 'The testing pyramid for services',
          minutes: 70,
          body: `# The testing pyramid for services

You've written frontend tests — components, hooks, maybe Playwright. The
shape of backend testing is related but the *center of gravity* moves, and
misplacing it is the #1 testing mistake backend newcomers make. Let's build
the layers bottom-up, then confront the mistake head-on.

## Layer 1: unit tests — pure logic, no I/O

Fast, isolated, thousands-per-second tests for **pure functions**: pricing
rules, validators, date math, parsing. Node has a built-in runner now — the
academy's own challenges use it, so you've been *reading* this layer all
along:

\`\`\`js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from '../src/pricing.js';

test('discount caps at 50%', () => {
  assert.equal(applyDiscount(1000, 0.8), 500);   // 80% requested, 50% applied
});
test('rejects negative price', () => {
  assert.throws(() => applyDiscount(-100, 0.1));
});
\`\`\`

Unit tests are cheap, so push logic *toward* them: the more of your codebase
that is pure functions, the more of it is testable at this speed. (That's a
big part of why Phase 5's architecture lesson separates domain logic from
I/O.)

## Layer 2: integration tests — where backend bugs actually live

Here's the uncomfortable truth the pyramid diagrams don't tell you: **the
bugs that hurt backends are rarely in pure logic.** They're in the SQL that
joins wrong, the transaction that doesn't roll back, the unique constraint
you forgot, the migration that drifted. None of those exist in a unit test —
they exist *in the database*.

So the backend's most valuable layer tests **your real code against a real
database**. The tool that changed the game: **Testcontainers** — a library
that starts a throwaway Postgres in Docker for your test run and destroys it
after:

\`\`\`js
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container, pool;

before(async () => {
  container = await new PostgreSqlContainer('postgres:16').start(); // real PG!
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool);              // YOUR migrations — tested for free
});
after(async () => { await pool.end(); await container.stop(); });

test('duplicate email is rejected by the constraint', async () => {
  await createUser(pool, { email: 'a@x.com' });
  await assert.rejects(createUser(pool, { email: 'a@x.com' }));  // real UNIQUE
});

test('failed transfer rolls back completely', async () => {
  await assert.rejects(transfer(pool, from, to, TOO_MUCH));
  const { rows } = await pool.query('SELECT balance FROM accounts WHERE id=$1', [from]);
  assert.equal(rows[0].balance, 1000);    // real transaction semantics
});
\`\`\`

Notice what's being verified: *actual constraint enforcement, actual
rollback behavior, actual SQL against actual Postgres*. No mock can verify
any of that — which brings us to the mistake.

## The mistake: mocking your own database

A mocked repository returns whatever you program it to return — which is
whatever you *believe* it returns. If your belief is wrong (the JOIN is
wrong, the constraint is missing), **the mock faithfully reproduces your
wrong belief and the test passes**. You've tested that your assumptions
equal your assumptions. 95% coverage, green suite — and the two bugs that
ship are a wrong JOIN and a transaction that didn't roll back. (Decision d8
is precisely this postmortem.)

The rule that resolves it: **mock at the boundaries you don't own; use real
things for what you do own.**
- Your database, your Redis → **real** (Testcontainers).
- Stripe's API, the email provider, the clock, randomness → **mock/fake**
  (you can't have real Stripe charge test cards in CI; time must be
  controllable).

## Layer 3: API tests — through the front door

Test the whole service the way clients experience it: boot the app, make
real HTTP requests, assert responses AND side effects:

\`\`\`js
test('POST /orders creates and returns 201 with Location', async () => {
  const res = await fetch(\`\${baseUrl}/orders\`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\` },
    body: JSON.stringify({ items: [{ sku: 'X1', qty: 2 }] }),
  });
  assert.equal(res.status, 201);
  const order = await res.json();
  const inDb = await pool.query('SELECT * FROM orders WHERE id = $1', [order.id]);
  assert.equal(inDb.rows.length, 1);      // response AND reality agree
});
\`\`\`

Recognize the style? **The academy's lab and graduation graders are exactly
this layer** — black-box HTTP tests against your running service. You've
been *taking* API tests this whole course; now you know how to write them.
Keep this layer for critical flows (auth, checkout, the money paths) — it's
slower and coarser than integration tests, so it sits at the pyramid's top,
not its base.

## Discipline that keeps a suite trustworthy

- **Isolation**: each test starts from a known DB state — truncate tables
  between tests or wrap each test in a rolled-back transaction. Tests that
  depend on each other's leftovers fail in random order forever.
- **Determinism**: control time (fake timers) and randomness (seeded/injected)
  — a test that fails every third Tuesday teaches everyone to ignore CI.
- **Test behavior, not implementation**: assert *what happened* (the
  response, the rows), not *how* ("repository.save was called once") —
  implementation-coupled tests shatter on every refactor and verify nothing.
- **Regression rule**: every bug that reaches production earns a test that
  would have caught it, at the lowest layer that can reproduce it. This is
  how suites accumulate real protective value instead of ceremony.

> **Try it now (30 min):** \`npm i -D @testcontainers/postgresql\` in your
> lab-orders-api stretch build (or capstone), and write two integration
> tests: the unique-violation and the rollback test above, adapted to your
> schema. Watching a real disposable Postgres boot inside your test run is
> the moment backend testing clicks.`,
          quiz: [
            {
              q: 'Why avoid mocking your own database in tests?',
              choices: ['Mocks are slow', 'It hides exactly the bugs that matter (SQL, transactions, constraints)', 'ORMs forbid it', 'It uses too much memory'],
              answer: 1,
              explain: 'Real DB behavior (isolation, constraints, SQL) is where backend bugs live; test against a real one.',
            },
            {
              q: 'Testcontainers gives you…',
              choices: ['a mock library', 'throwaway real dependencies (Postgres/Redis) in Docker per test run', 'a CI provider', 'a load tester'],
              answer: 1,
              explain: 'It boots ephemeral real services so integration tests exercise real behavior.',
            },
            {
              q: '"Test behavior, not implementation" means…',
              choices: ['only write e2e tests', 'assert observable outcomes, not internal calls/private methods', 'never mock anything', 'test in production'],
              answer: 1,
              explain: 'Behavior tests survive refactors; implementation-coupled tests break on every change.',
            },
          ],
        },
      ],
    },
    {
      id: 'p4.m2',
      title: 'Observability & security',
      lessons: [
        {
          id: 'p4.l2',
          title: 'The three pillars of observability',
          minutes: 70,
          body: `# The three pillars of observability

Frontend debugging has DevTools: you *see* the failure. Production backend
debugging has… whatever evidence you thought to emit *before* the incident.
**Observability** is the discipline of emitting that evidence on purpose.
Skip it and production issues become guesswork; build it and they become
queries.

The three pillars, and the question each answers:

## Pillar 1: Logs — "what exactly happened?"

You set up structured logging with request ids in p3.l2 — that *is* this
pillar. One addition to complete the picture: in production, stdout logs
ship to a central platform (Loki, Datadog, CloudWatch, ELK) where you query
across every instance at once: \`level=error AND route=/checkout AND
time>14:00\`. Logs are your richest, most expensive signal: perfect for
reconstructing *one specific request's story*, too heavy for answering "is
the system healthy?" — that's metrics' job.

## Pillar 2: Metrics — "how is the system behaving overall?"

A metric is a cheap number sampled over time: request count, error count,
latency, queue depth, connections in use. Standard stack: your app exposes
\`GET /metrics\` in Prometheus text format; Prometheus scrapes it every 15s;
Grafana draws dashboards; alerts fire on rules.

\`\`\`js
import client from 'prom-client';

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'request latency',
  labelNames: ['method', 'route', 'status'],
});
// middleware: time every request
app.use(async (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path, status: res.statusCode }));
  next();
});
\`\`\`

Two literacy items you must own:

**Percentiles, not averages.** Average latency lies: 99 requests at 50ms +
1 at 5s = "100ms average" while 1% of users suffer. Speak in **p50** (the
typical), **p95/p99** (the tail — your unluckiest users, and where trouble
shows first). Recall p0.l2: "p99 spikes while p50 is fine" is the event-loop-
blocking signature — that diagnosis *is* metrics literacy in action.

**The four golden signals** — if you instrument nothing else: **latency**
(p50/p95/p99), **traffic** (req/s), **errors** (5xx rate), **saturation**
(how full: CPU, memory, pool utilization, queue depth). Those four answer
"is it healthy?" for almost any service.

And the alerting philosophy that keeps on-call humane (decision d10 makes
you defend it): **page on symptoms users feel** (error rate, latency SLO
burn), route *causes* (CPU high, restarts) to dashboards. Every non-
actionable page trains humans to ignore the pager — noise is how real
incidents get acknowledged late.

Vocabulary for the grown-up version: an **SLI** is an indicator you measure
("% of requests under 300ms"); an **SLO** is your target ("99.9% monthly");
your **error budget** is the allowed failure (0.1%) — burn it too fast and
the team trades feature work for reliability work. This framework is how
mature orgs decide *when reliability wins arguments*.

## Pillar 3: Traces — "where did the time go?"

A request touches your API → Postgres ×3 → Redis → an external API → a
queue. It took 900ms. *Which part?* Logs won't line up neatly; metrics
aggregate away the answer. A **distributed trace** records the tree of
timed **spans** for one request:

\`\`\`
trace 7f3c… (POST /checkout — 912ms)
├── validate                    2ms
├── pg: SELECT inventory       11ms
├── stripe: create charge     740ms   ← there's your 900ms
├── pg: INSERT order            9ms
└── enqueue receipt email       1ms
\`\`\`

The mechanism gluing it across services: **context propagation** — outgoing
calls carry a \`traceparent\` header; each service adds its spans to the same
trace id. It's your p3.l2 request-id habit, industrialized. The standard is
**OpenTelemetry** (OTel): vendor-neutral SDKs whose Node auto-
instrumentation wraps http/pg/redis for you, exporting to Jaeger/Tempo/
Datadog. Wire it once, get span trees forever.

## Health endpoints: observability the platform consumes

From Graduation stage G1, now with the *why* behind the two-endpoint split:
- **Liveness** (\`/health\`): "is the process alive?" — if this fails, the
  orchestrator **restarts** you. Keep it dumb (return 200); if it checks the
  DB, a DB outage makes k8s restart-loop every healthy pod. A restart doesn't
  fix a down database!
- **Readiness** (\`/ready\`): "can I serve traffic *right now*?" — checks
  dependencies; failing takes you **out of the load balancer** (no restart)
  until you recover. Different question, different remedy — that's why they
  must be different endpoints.

> **Try it now (25 min):** add prom-client to your capstone with the
> histogram middleware above plus a default-metrics call, hit \`/metrics\`,
> and read what's there. Then generate some traffic with a loop of curls and
> watch the counters move. Optional extra credit: run Jaeger's all-in-one
> Docker image and point OTel auto-instrumentation at it — your first real
> span tree is a genuine "ohhh" moment.`,
          quiz: [
            {
              q: 'Which pillar answers "where did the latency go across services"?',
              choices: ['Logs', 'Metrics', 'Distributed traces', 'Alerts'],
              answer: 2,
              explain: 'Traces break a request into timed spans across service boundaries.',
            },
            {
              q: 'Liveness vs readiness probe?',
              choices: ['Same thing', 'Liveness = is the process alive (restart); readiness = can it serve traffic (route/deroute)', 'Readiness restarts the pod', 'Liveness checks the database'],
              answer: 1,
              explain: 'Failing readiness pulls you from the LB without a restart; failing liveness triggers a restart.',
            },
            {
              q: 'An error budget is…',
              choices: ['a cost limit', '1 − SLO; the allowed unreliability you spend before prioritizing stability', 'the log retention period', 'a rate limit'],
              answer: 1,
              explain: 'It quantifies acceptable failure and governs the feature-vs-reliability tradeoff.',
            },
          ],
          challenge: 'ch-log-context',
        },
        {
          id: 'p4.l3',
          title: 'Backend security: OWASP and supply chain',
          minutes: 70,
          body: `# Backend security: OWASP and supply chain

You've already built the two biggest defenses in this course — parameterized
queries (ch-sql-safe) and per-resource authorization (ch-auth-owns, lab-auth).
This lesson assembles the full map: the attacks that actually hit Node
backends, what each looks like in code, and the habits that block them.
Security isn't a product you add at the end; it's a property of decisions
you're already making.

## The OWASP Top 10, translated to your daily work

OWASP publishes the canonical ranking of web vulnerability classes. The ones
that dominate backend incidents:

**#1 Broken access control.** Not exotic crypto — *missing ownership
checks*. \`GET /orders/:id\` that only checks login (p3.l1's IDOR). Your
defenses, already built: authorize *every* resource access against the
authenticated user, return 404 over 403 for others' resources, never trust a
client-sent role or userId. When reviewing any endpoint, the reflex
question: *"whose data is this, and where's the check?"*

**#2 Injection.** Any place untrusted input gets concatenated into a command
interpreted by something — SQL, shell, even HTML (that's XSS). SQL
injection you've beaten with parameterization; its cousins follow the same
law:

\`\`\`js
// Shell injection — same disease, different interpreter:
exec(\`convert \${userFilename} out.png\`);        // filename: "x; rm -rf /" 💥
execFile('convert', [userFilename, 'out.png']);  // ✅ args array — no shell parsing
\`\`\`

The universal rule: **keep code and data on separate channels.** Parameters
for SQL, argument arrays for processes, and never build queries/commands via
string interpolation with user input. Ever.

**#3 SSRF (Server-Side Request Forgery)** — under-known, increasingly
exploited. Your server fetches a URL the user supplies (webhook target,
image-by-URL, link preview):

\`\`\`js
app.post('/fetch-preview', async (req, res) => {
  const page = await fetch(req.body.url);        // user controls the URL...
});
// attacker sends: "http://169.254.169.254/latest/meta-data/iam/credentials"
\`\`\`

That magic IP is the cloud **metadata endpoint** — from inside AWS it can
serve your instance's credentials. Your server has network access the user
doesn't (internal services, localhost admin ports, cloud metadata); SSRF
lets them borrow it. Defense: allow-list schemes/hosts where possible, block
private and link-local IP ranges *after DNS resolution*, and give the
fetching service minimal network permissions.

**Cryptographic failures & misconfiguration** — a checklist you mostly know:
TLS everywhere; argon2/bcrypt/scrypt for passwords (p3.l1); real random
tokens (\`crypto.randomBytes\`, never \`Math.random()\` — it's predictable);
no stack traces to clients (p3.l2); no default credentials; CORS not set to
\`*\` with credentials; and security headers via **helmet** (one middleware:
HSTS, nosniff, frame denial, and friends).

## Least privilege: designing for the breach

The mindset shift that marks security maturity: **assume a component gets
compromised, and pre-limit the damage.**

- Your app's DB user: \`SELECT/INSERT/UPDATE/DELETE\` on its schema. Not
  \`DROP\`, not superuser. SQL injection through a crippled user steals data
  but can't destroy the database.
- Secrets: environment/secret manager (p0.l4), rotatable, never in git —
  and \`.env\` in \`.gitignore\` *before* the first commit; scanners find
  leaked keys in public repos within minutes.
- Containers run as non-root (you'll do this in p6.l1); cloud IAM roles get
  the minimum they need.

## The supply chain: npm is your biggest attack surface

Uncomfortable arithmetic: your code is thousands of lines; your
\`node_modules\` is *millions*, written by strangers, updated constantly. Real
incidents happen yearly (event-stream, ua-parser-js, colors.js): a
maintainer's account is phished or a look-alike package published, malware
ships inside a patch release, and — the nasty part — **postinstall scripts
run arbitrary code on your machine the moment you \`npm install\`.**

The defense kit, all cheap:
- **Commit the lockfile; install with \`npm ci\`** — byte-exact, reviewable
  dependency trees (p0.l4's reproducibility point, now as security).
- **\`npm audit\`** in CI + **Dependabot/Renovate** for patch PRs — known
  CVEs get fixed while they're news, not archaeology.
- **Vet before adding**: weekly downloads, maintenance pulse, dependency
  count. Prefer zero-dep or stdlib (this academy is zero-dep partly to prove
  how far \`node:\` builtins go).
- **\`npm install --ignore-scripts\`** where practical — kills the
  postinstall vector outright.
- Watch for **typosquats** (\`lodahs\`) — check the name twice on install.

## The habit that ties it together: threat modeling (lite)

No frameworks needed — three questions per endpoint, asked at design time:
1. **Who can call this?** (authn — and is it rate-limited?)
2. **What can they reach?** (authz — ownership, tenant isolation)
3. **What's the worst input they could send?** (validation, size caps,
   injection channels)

Ask them in code review too. Most vulnerabilities die in that two-minute
conversation — far cheaper than in the incident postmortem.

> **Try it now (20 min):** audit your lab-orders-api/capstone against the
> three questions, endpoint by endpoint, and fix what you find. Then run
> \`npm audit\` on any real project you have and read what it reports.
> Finally — decision \`d8\` if you haven't, and ask the tutor
> (\`academy ask p4.l3\`) about anything here that felt abstract.`,
          quiz: [
            {
              q: 'The only correct defense against SQL injection is…',
              choices: ['escaping quotes manually', 'parameterized/prepared queries (never build SQL by string concatenation)', 'a WAF', 'input length limits'],
              answer: 1,
              explain: 'Parameterization separates code from data so input can never become SQL.',
            },
            {
              q: 'SSRF is dangerous because…',
              choices: ['it slows the server', 'attacker-controlled URLs let your server reach internal/metadata endpoints', 'it corrupts the database', 'it bypasses TLS'],
              answer: 1,
              explain: 'The server becomes a proxy into your private network; allow-list and block internal ranges.',
            },
            {
              q: 'A good supply-chain practice in CI is…',
              choices: ['npm install with ^ ranges', 'npm ci with a committed lockfile plus dependency scanning', 'disabling audits', 'installing globally'],
              answer: 1,
              explain: 'npm ci gives reproducible installs from the lockfile; scanning catches known CVEs.',
            },
          ],
          challenge: 'ch-rate-limiter',
        },
      ],
    },
  ],
} satisfies Phase;
