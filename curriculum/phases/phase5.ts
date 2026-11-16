// Phase 5 — Architecture & scaling. The senior/staff differentiator.
// New-joiner depth: each pattern motivated by the pain it prevents.

import type { Phase } from '../types.ts';

export default {
  id: 'p5',
  title: 'Architecture & Scaling',
  weeks: 4,
  goal: 'Structure codebases that survive growth, choose between monolith and services honestly, and scale data + traffic: caching strategy, replication, sharding, consistency, and distributed-systems reality.',
  modules: [
    {
      id: 'p5.m1',
      title: 'Application architecture',
      lessons: [
        {
          id: 'p5.l1',
          title: 'Layered / hexagonal architecture & DDD-lite',
          minutes: 70,
          body: `# Layered / hexagonal architecture & DDD-lite

Architecture talk drowns in jargon — hexagonal! clean! onion! DDD! — but
underneath sits one practical idea you can learn in an hour and apply
forever. Let's earn it by watching code rot first.

## How codebases die

Every backend starts as route handlers. Then handlers grow:

\`\`\`js
app.post('/orders', async (req, res) => {
  // parse HTTP... validate... check inventory with SQL... apply pricing
  // rules... charge Stripe... more SQL... send email... shape the response
  // ...220 lines later:
  res.status(201).json(order);
});
\`\`\`

Everything works — and everything is *welded together*: business rules
tangled with SQL tangled with HTTP tangled with Stripe. The costs arrive on
a schedule you can predict: testing the discount rule requires booting a
web server, a database, and a Stripe mock; "create order from a CSV import"
means copy-pasting half the handler; swapping the email provider means
editing checkout code. Each change touches everything because everything
touches everything.

## The one idea: dependencies point inward

Draw your system as rings:

\`\`\`
        ┌────────────────────────────────────┐
        │ infrastructure: HTTP, Postgres,    │   knows everything below
        │ Stripe client, Redis, email        │
        │  ┌──────────────────────────────┐  │
        │  │ application: use cases —     │  │   knows the domain
        │  │ "place order", "cancel order"│  │
        │  │  ┌────────────────────────┐  │  │
        │  │  │ domain: entities +     │  │  │   knows NOTHING outside
        │  │  │ business rules         │  │  │   pure JavaScript
        │  │  └────────────────────────┘  │  │
        │  └──────────────────────────────┘  │
        └────────────────────────────────────┘
\`\`\`

**The rule:** inner rings never import from outer rings. Your domain logic
must not know Express, Postgres, or Stripe *exist*. Business rules are the
most valuable, longest-lived code you have — frameworks and databases are
replaceable details. "Hexagonal", "clean", "onion" are all this one rule
with different diagrams.

But wait — placing an order *requires* saving to a database. How can the
inner ring use Postgres without knowing it? **Through an interface the
inner ring defines** (a "port"), implemented by the outer ring (an
"adapter"):

\`\`\`js
// application/place-order.js — the use case. NOTE the imports: nothing infra.
export function makePlaceOrder({ orderRepo, paymentGateway, events }) {
  return async function placeOrder({ customerId, items }) {
    const order = Order.create({ customerId, items });   // domain rules run
    await paymentGateway.charge(order.total, customerId);
    await orderRepo.save(order);
    await events.emit('order.placed', { orderId: order.id });
    return order;
  };
}
\`\`\`

\`orderRepo\`, \`paymentGateway\`, \`events\` are *shapes* the use case needs —
handed in from outside (dependency injection, no framework required: it's a
function argument). The adapters live in infrastructure:

\`\`\`js
// infrastructure/postgres-order-repo.js — an adapter implementing the port
export function makePostgresOrderRepo(pool) {
  return {
    async save(order) {
      await pool.query(
        'INSERT INTO orders (id, customer_id, total_cents) VALUES ($1,$2,$3)',
        [order.id, order.customerId, order.totalCents],
      );
    },
    async findById(id) { /* SELECT ... */ },
  };
}
\`\`\`

And the HTTP handler shrinks to translation duty — exactly the "thin
controller" you'll now recognize in every well-run codebase:

\`\`\`js
app.post('/orders', async (req, res) => {
  const input = CreateOrder.parse(req.body);        // p3.l2 validation
  const order = await placeOrder(input);            // ALL logic in use case
  res.status(201).json(toOrderResponse(order));
});
\`\`\`

This is the **repository pattern** you've brushed against since Phase 0 —
\`store.js\` was a crude repo; lab-orders-api's store was a port waiting for a
Postgres adapter. Now it has its name and its reason.

## What the rule buys you (the actual payoff)

**Testing transforms.** The discount rule? Pure function — unit test,
microseconds. The whole use case? Hand it an in-memory repo and a fake
gateway — full behavioral tests, no DB, no HTTP:

\`\`\`js
const orderRepo = makeInMemoryOrderRepo();
const paymentGateway = { charge: async () => {} };
const placeOrder = makePlaceOrder({ orderRepo, paymentGateway, events: fakeEvents });
// test EVERY business path instantly; keep p4.l1's real-DB tests for the adapters
\`\`\`

**Change localizes.** New email provider = one adapter file. CSV import =
same use case, new entry point. Postgres → something else = new repo
adapter; zero business code touched.

The litmus test to carry into code reviews: *"could I run every business
rule in this service without a database or an HTTP server?"* Yes → healthy
boundaries. No → welded.

## DDD-lite: three ideas worth stealing

Domain-Driven Design is a heavyweight book; three of its ideas pay rent
immediately:

- **Ubiquitous language** — code uses the business's words. If the team
  says "quote expires", the code says \`quote.expire()\`, not
  \`updateStatusFlag(7)\`. Translation layers between business-speak and
  code-speak are where requirements die.
- **Bounded contexts** — "Customer" in billing (payment methods, VAT id) and
  "Customer" in support (tickets, satisfaction) are *different models that
  share a word*. Don't build one mega-Customer serving everyone — split
  models per context. (This becomes the seam for extracting services in the
  next lesson.)
- **Aggregates** — clusters that change together under one consistency rule
  (an Order and its line items: "total must equal sum of lines"). Load and
  save the aggregate as a unit, in one transaction — and now you know
  *which* rows a transaction should span (p2.l2 connecting in).

## Calibration (the actually-senior part)

Ceremony must match complexity. A 4-endpoint internal CRUD app does NOT
need four layers and DI wiring — handlers with SQL are *correct* there.
The rot signals that say "add the boundaries now": business rules you need
to test independently of I/O, the same logic reachable from multiple entry
points (HTTP + jobs + CLI), or any file juggling HTTP *and* SQL *and*
external APIs at once. Architecture is insurance — buy it when the premiums
are worth it, and know *why* either way.

> **Try it now (30 min):** refactor one endpoint of your lab-orders-api into
> the shape above: domain function + use case with injected repo + thin
> handler + in-memory repo for tests. One endpoint is enough to feel the
> testing payoff — then decide, deliberately, whether the rest earns it.`,
          quiz: [
            {
              q: 'The core rule of hexagonal/clean architecture is…',
              choices: ['use microservices', 'dependencies point inward; the domain depends on no framework or DB', 'put everything in one file', 'the DB is the center'],
              answer: 1,
              explain: 'Business rules are independent of delivery/infra details, which plug in at the edges.',
            },
            {
              q: 'A bounded context means…',
              choices: ['a rate limit', 'a model boundary where a term has one specific meaning (Customer in billing ≠ in support)', 'a database transaction', 'a Kubernetes namespace'],
              answer: 1,
              explain: 'Different subdomains model the "same" concept differently; keep them separate.',
            },
            {
              q: 'The repository pattern primarily gives you…',
              choices: ['faster queries', 'persistence hidden behind an interface, so domain/use-cases stay DB-agnostic and testable', 'automatic caching', 'schema migrations'],
              answer: 1,
              explain: 'Swap Postgres for an in-memory fake in tests; the use case does not change.',
            },
          ],
        },
        {
          id: 'p5.l2',
          title: 'Monolith vs microservices — honestly',
          minutes: 65,
          body: `# Monolith vs microservices — honestly

No architecture debate generates more cargo-culting. Let's define terms
precisely, price the trade honestly, and give you the default that survives
contact with reality.

## Terms, precisely

A **monolith** is one deployable unit: one repo, one process (scaled as N
identical copies), one database. **Microservices** split the system into
independently deployed services, each owning its own data, talking over the
network.

The third option — the one this course recommends as default — is the
**modular monolith**: ONE deployable, but internally divided into modules
with strict boundaries (orders/, billing/, notifications/ — each with its own
domain + use cases from p5.l1, communicating through explicit interfaces,
never reaching into each other's tables). Discipline without distribution.

## What microservices actually cost

Everything in-process is easy becomes hard when a function call becomes a
network call:

- **A function call can't fail halfway. A network call can** — timeout?
  Did it execute or not? Now every inter-module call needs timeouts,
  retries, idempotency, circuit breakers (your lab-resilience kit — as the
  *baseline* for internal calls).
- **Transactions stop working across services.** Order service and billing
  service have separate databases — no \`BEGIN/COMMIT\` spans them. You
  inherit the dual-write problem (p3.l4) *everywhere*, solved with outboxes,
  events, and **sagas** (a distributed workflow: each service does a local
  transaction and emits an event; failures trigger *compensating* actions —
  "refund payment", "release inventory" — because there is no rollback
  across services).
- **Debugging fragments.** One user action = five services' logs. Your
  p4.l2 tracing goes from nice-to-have to survival gear.
- **Ops multiplies.** Five services = five pipelines, fleets, alert sets,
  version matrices ("orders v2 needs billing ≥ v3…").

This is the **distributed-systems tax**. It's not a reason never to pay —
it's a price tag to read *before* buying.

## What microservices actually buy (the honest list)

- **Independent scaling** — transcoding needs 40 workers; the API needs 3.
  Split = right-size each. (Though: a monolith scaled to its hottest
  component is usually just… fine. Servers are cheaper than
  distributed-systems engineering.)
- **Independent deploys for independent TEAMS** — the real one. At 5
  engineers, one deploy pipeline is a feature. At 60, one pipeline is a
  parking lot: every deploy coordinates everyone. Conway's law ("systems
  mirror org charts") run *forward*: give teams services so they can ship
  without meetings.
- **Fault isolation** (partial — a crashed recommendations service can't
  take checkout's process down; but see d6: badly-handled network calls
  re-couple what you separated).
- **Tech freedom per service** (real, occasionally decisive, usually minor).

Read the list again: **they're organizational and operational wins, not code
quality wins.** "Cleaner code" is p5.l1's boundaries — free, in-process, no
tax. Anyone selling microservices as cleanliness is selling you the tax
without the benefit. (Decision d3 is exactly this argument, staged.)

## The failure mode worth naming: the distributed monolith

Split into services but keep a **shared database** — or couple every deploy
to every other — and you get both bills: network complexity AND lockstep
coupling. Rule: a service that doesn't own its data isn't a service; it's a
monolith paying microservice taxes. (Shared DB = decision d3's trap answer.)

## The senior playbook

1. **Start modular-monolith.** Boundaries from day one (cheap), distribution
   deferred (expensive). You get 90% of the cleanliness for 0% of the tax.
2. **Extract when a NAMED pressure appears**, not by vibes:
   - a component with wildly different scaling needs,
   - a team stepping on other teams' deploys,
   - a hard isolation requirement (compliance, blast radius).
3. **Extraction is mechanical if you did p5.l1**: a module with its own use
   cases, repos, and event-based communication (your outbox!) lifts out
   along the dotted lines. The bounded context you drew IS the service
   boundary. This is why the modular monolith isn't a compromise — it's
   *microservices with the option not yet exercised*.
4. When services do talk: **async events where possible** (temporal
   decoupling — billing being down doesn't block order-taking; the queue
   absorbs it), sync calls where you truly need an immediate answer — with
   the full resilience kit attached.

The interview-ready sentence: *"Modular monolith by default; extract
services when a specific scaling, team, or isolation pressure names itself;
each service owns its data; prefer async events between them."* That
position is defensible at every company size — because it's how the
successful ones actually evolved.

> **Do now:** decision \`d3\` (the 4-person startup that wants 6 services) —
> argue it for real. Then look at your capstone and identify the bounded
> contexts you'd extract *if* pressure arrived, and which events would flow
> between them. Write it down; that document is a system-design interview
> answer in embryo.`,
          quiz: [
            {
              q: 'The recommended default architecture for a new product is…',
              choices: ['many microservices from day one', 'a modular monolith', 'serverless functions only', 'a shared database with many services'],
              answer: 1,
              explain: 'A well-modularized monolith avoids the distributed tax until you truly need it.',
            },
            {
              q: 'Multiple services sharing one database is…',
              choices: ['best practice', 'a "distributed monolith" anti-pattern — worst of both worlds', 'required for microservices', 'how you ensure consistency'],
              answer: 1,
              explain: 'Shared DB couples deploys and schema; each service should own its data.',
            },
            {
              q: 'A saga replaces distributed ACID transactions with…',
              choices: ['a bigger transaction', 'a sequence of local transactions plus compensating actions on failure', 'two-phase locking', 'a cache'],
              answer: 1,
              explain: 'Sagas achieve eventual consistency via compensation instead of a global lock.',
            },
          ],
        },
      ],
    },
    {
      id: 'p5.m2',
      title: 'Scaling data & traffic',
      lessons: [
        {
          id: 'p5.l3',
          title: 'Scaling the database & caching strategy',
          minutes: 70,
          body: `# Scaling the database & caching strategy

Traffic grows and the app tier scales by adding instances (next lesson). The
database can't copy-paste itself so easily — **the DB is almost always the
first real scaling wall.** Here's the escalation ladder, in the order a
senior actually climbs it. The order IS the lesson.

## Rung 1: make it efficient (where 80% of "scaling problems" end)

Most "we need to scale!" moments are actually "we have a missing index" or
"we have an N+1". You have the tools: \`EXPLAIN ANALYZE\` (p2.l2), indexes
matched to real query patterns, N+1 elimination via joins (p2.l1, d15),
\`SELECT\` only needed columns, LIMIT everything, a sane pool (p2.l3). A day
of this work routinely buys 10-100x. It's unglamorous, which is exactly why
it's underused — and why d1/d15 exist to drill the instinct: **efficiency
before infrastructure.**

## Rung 2: vertical scaling (don't be proud)

Rent a bigger database box. Zero code changes, zero new failure modes,
buys years for most businesses. Ceiling: the biggest machine money rents —
but modern "biggest" is enormous. Pride is not a reason to skip this rung;
cost curves eventually are.

## Rung 3: cache the reads (Redis, industrialized)

Your p2.l4 cache-aside, applied where the read:write ratio justifies it —
product pages read 10,000×/write. The strategy checklist per endpoint:
tolerable staleness (TTL), invalidation path (delete-on-write), stampede
plan (jitter, single-flight). A 95% hit rate removes 95% of that query load
from Postgres. This rung is where d1's scenario lives — and it comes
*before* replicas because a cache **removes** work; replicas merely
*spread* it.

## Rung 4: read replicas

Postgres streams its write-ahead log to **replica** servers — read-only
copies staying nearly current. Writes go to the **primary**; reads fan out
to replicas. For read-heavy apps this multiplies read capacity ~linearly.

The catch you MUST design around — **replication lag**. Replicas trail by
milliseconds (sometimes seconds under load). The classic bug: user updates
their name (primary) → next request reads their profile (replica, 200ms
behind) → old name → "your app is broken." That's **read-your-own-writes**
inconsistency. Standard fixes: route a user's reads to the primary briefly
(seconds) after their writes; or pin freshness-critical reads (own profile,
own cart) to the primary always; analytics and browsing go to replicas.
Note the shape of this trade — read scale purchased with staleness — you're
about to see it again, everywhere.

## Rung 5: sharding (the last resort, respected)

When *writes* outgrow one primary, **shard**: split rows across independent
databases by a **shard key** — users 1-10M on shard A, 10-20M on shard B (or
hash-based). Each shard is a full primary for its slice; write capacity
finally scales horizontally.

Why last resort — the costs are architectural, not operational:
- **Cross-shard queries stop being SQL.** "Top customers overall" now means
  querying every shard and merging in app code. JOINs across shards:
  gone.
- **Cross-shard transactions: gone.** Two users on different shards +
  a transfer between them = distributed transaction problem (p5.l2's
  sagas, now *inside* your data layer).
- **The shard key is nearly unchangeable** — it's physically how data is
  placed. Chosen wrong (uneven "hot shard" distribution, or wrong access
  grain) → a re-sharding migration, among engineering's least pleasant
  projects.

If you get there: shard on the key your queries naturally scope by (often
\`user_id\` or \`tenant_id\` — d12's multi-tenancy maps straight in), so most
queries stay single-shard.

## The theory that explains the trade: CAP, briefly and honestly

Distributed data forces a choice you've now met twice. **CAP theorem**:
when a network **Partition** happens (nodes can't talk — inevitable), you
must pick **Consistency** (refuse answers that might be stale — some
requests fail) or **Availability** (always answer — possibly stale).
Replication lag is this trade in miniature: replicas answer instantly
(available) but may be behind (not strictly consistent).

Working vocabulary: **strong consistency** = every read sees the latest
write (single-primary Postgres); **eventual consistency** = replicas
converge, reads may briefly trail (replicas, caches, most distributed
stores). The senior move — heard in every good system design answer — is
choosing **per data path**: "balances read strongly from the primary;
product listings tolerate 30 seconds of staleness." Never one global
policy; always a per-path judgment.

## The ladder, one line

**Efficiency → vertical → cache → replicas → shard.** Each rung costs more
complexity than the last; each is only justified when the previous rung is
exhausted. Recite it in interviews; *practice* it in incidents — and notice
d1 was secretly a quiz on exactly this ordering.

> **Try it now (15 min):** for YOUR capstone, write down: its top 3 queries,
> which rung its current bottleneck would hit first under 100x traffic, what
> you'd cache (with TTL + invalidation), and what the shard key would be if
> doomsday came. That half page is a system-design interview answer drafted.`,
          quiz: [
            {
              q: 'Read replicas serve stale data because…',
              choices: ['they are slower disks', 'asynchronous replication introduces replication lag → eventual consistency', 'they lack indexes', 'they are read-only'],
              answer: 1,
              explain: 'Writes propagate asynchronously, so a replica may briefly lag the primary.',
            },
            {
              q: 'The usual FIRST response to database load should be…',
              choices: ['shard immediately', 'indexes/query tuning and caching before big architectural changes', 'switch to NoSQL', 'add microservices'],
              answer: 1,
              explain: 'Most scaling problems are missing indexes or absent caching, not a need to shard.',
            },
            {
              q: 'CAP says that during a network partition you must trade off…',
              choices: ['cost vs speed', 'consistency vs availability', 'reads vs writes', 'CPU vs memory'],
              answer: 1,
              explain: 'Partitioned nodes cannot be both fully consistent and fully available.',
            },
          ],
        },
        {
          id: 'p5.l4',
          title: 'Horizontal scaling, statelessness & idempotency',
          minutes: 70,
          body: `# Horizontal scaling, statelessness & idempotency

The app tier's scaling story is happier than the database's — *if* you build
to one rule. This lesson is that rule, its consequences, and the property
that keeps a distributed system correct. It ties together threads from
every phase — watch them converge.

## Horizontal scaling: many identical, disposable instances

Vertical (bigger box) has a ceiling and a single point of failure.
**Horizontal** — N identical instances behind a **load balancer** — has
neither: capacity = add instances; failure = LB stops routing to the dead
one, users never notice. Instances become *cattle, not pets*: unnamed,
disposable, replaceable. (The LB itself: health checks per instance —
your \`/ready\` from p4.l2 — and a routing algorithm; least-connections
beats round-robin under uneven load.)

But there's a catch, and it has a name.

## The rule: instances must be stateless

Request 1 (login) lands on instance A. Request 2 (profile) lands on
instance C. If the session lives in instance A's memory — a Map, like
lab-auth's — instance C says 401. Randomly. Per request. Horizontal scaling
just broke login.

**Stateless** means: no instance holds data that matters beyond the current
request. All state lives in shared external stores:

- sessions → **Redis** (p2.l4/p3.l1 — *this* is why, the full reason)
- files → **object storage** (p3.l3 presigned URLs — same reason: local
  disk is one instance's disk)
- data → the database; cross-instance coordination (rate limits, locks) →
  Redis atomics (p3.l3)
- in-process caches → only for immutable/tolerably-per-instance data

The test: **could you kill any instance at any moment and lose nothing but
its in-flight requests?** (And graceful shutdown — p0.l4 — drains even
those.) Yes = you can scale, autoscale, deploy rolling updates, survive
crashes. This one property is what makes instances cattle.

You'll hear of "sticky sessions" (LB pins each user to one instance) as an
escape hatch — know it as a *smell*: it breaks even scaling, makes deploys
drop users, and merely postpones the fix.

## Node-specific: one process = one core

A Node process runs your JS on one thread (p0.l2) → one CPU core. On an
8-core box, one process wastes 7. The fix is the same horizontal idea,
zoomed in: **run 8 processes** — via the cluster module, PM2, or (the
modern default) one process per container, letting the orchestrator pack
them. Statelessness makes this free: 8 processes on one box and 8 boxes are
the same architecture at different zoom levels.

## Idempotency: the correctness rule of distributed systems

Now the deep half. More instances + more network hops = more of this
sequence: *request sent → executed → response lost → client retries*.
Retries are not an edge case at scale; they are a constant, emitted by
clients, load balancers, queues (p3.l4's at-least-once!), and your own
resilience kit (p3.l3). Which revives the question from p1.l1, now
system-wide: **is every operation safe to execute twice?**

Where duplicates sneak in even with careful clients: the LB times out but
the server finishes anyway; a queue redelivers after a slow ack; two
API instances process the "same" logical action concurrently. Each mutation
path needs one of these shields:

- **Natural idempotency** — absolute writes: \`SET status='shipped'\` twice
  is fine; \`count = count + 1\` twice is not. Prefer absolute over relative
  updates where possible.
- **Idempotency keys** — the client names the operation; the server
  executes once per name and replays the stored result (p1.l4; your
  ch-idempotency single-flight; Graduation G3 stores keys in Postgres).
- **Unique constraints as backstop** — \`UNIQUE (user_id, order_ref)\` turns
  a duplicate insert into a catchable error instead of double data. The
  database as final guardian (p2.l1's philosophy, again).
- **Dedupe at consumers** — processed-event ids recorded; repeats skipped
  (p3.l4 workers; your queue lab's m3).

Note what this list is: *every phase of this course converging.* HTTP
semantics, DB constraints, queue behavior, resilience patterns — idempotency
is where they all meet, and it's the property interviewers probe hardest
because faking it is impossible.

## The paragraph that is half of system design

Put the whole lesson in one breath: *"Stateless app instances behind a load
balancer — sessions in Redis, files in object storage, state in the
database. Scale by adding instances; kill any instance safely. Every
mutation idempotent — keys, constraints, dedupe — so the retries that
distributed systems inevitably produce are harmless."*

Memorize the shape, not the words: in Phase 6's system-design lesson this
paragraph is the middle of literally every answer — what varies per question
is the data layer around it (p5.l3) and the async pipework behind it
(p3.l4).

> **Do now:** \`academy challenge ch-idempotency\` — build the single-flight
> idempotency store for real (concurrent same-key calls must share one
> execution). Then audit your capstone: list every endpoint that mutates,
> and name its shield. Any blank in that column is a double-charge bug
> waiting for traffic.`,
          quiz: [
            {
              q: 'For instances to scale horizontally behind a load balancer, they must be…',
              choices: ['on the same machine', 'stateless — no in-memory session or local state; state externalized', 'running different code', 'connected by sticky sessions'],
              answer: 1,
              explain: 'Any instance must handle any request and be replaceable; state lives in shared stores.',
            },
            {
              q: 'A single Node process on a 16-core box, to use all cores, should…',
              choices: ['do nothing, Node uses all cores', 'run multiple processes (cluster / replicas) behind the LB', 'increase heap size', 'use more async/await'],
              answer: 1,
              explain: 'JS runs on one thread/core per process; parallelism comes from multiple processes.',
            },
            {
              q: 'Why is idempotency essential in distributed systems?',
              choices: ['it speeds up requests', 'retries/redeliveries are inevitable; non-idempotent ops corrupt data on retry', 'it saves memory', 'it is required by HTTP'],
              answer: 1,
              explain: 'LBs, clients, and queues all retry; idempotency makes those retries safe.',
            },
          ],
          challenge: 'ch-idempotency',
        },
      ],
    },
  ],
} satisfies Phase;
