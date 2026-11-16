// Phase 2 — The data layer. Where backend seniority is really made or lost.
// New-joiner depth: every SQL concept from the problem up, runnable examples.

import type { Phase } from '../types.ts';

export default {
  id: 'p2',
  title: 'The Data Layer: SQL, NoSQL, Modeling',
  weeks: 4,
  goal: 'Model data correctly, write and reason about SQL, understand transactions/isolation/indexes, use ORMs/query builders without being owned by them, and know when Redis/Mongo earn their place.',
  modules: [
    {
      id: 'p2.m1',
      title: 'Relational databases done right',
      lessons: [
        {
          id: 'p2.l1',
          title: 'SQL & schema design (Postgres)',
          minutes: 75,
          body: `# SQL & schema design (Postgres)

Here's a truth that surprises frontend developers: **the database is the most
important component of almost every backend.** Servers are replaceable and
stateless (you'll see why in Phase 5); the data is the business. Lose a
server, restart it. Corrupt the data, and there may be no company left.

We learn **PostgreSQL** ("Postgres") — the correct default for ~90% of
products, and the most loved database in every developer survey for years.
Get it running now; everything here is meant to be typed, not skimmed:

\`\`\`bash
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -it pg psql -U postgres      # psql = the interactive SQL shell
\`\`\`

## Thinking in tables

A relational database stores data in **tables**: rows (records) and columns
(typed fields). The "relational" part is the superpower — tables reference
each other, and the database *enforces* those references.

Model a small shop. In JS you'd instinctively nest:

\`\`\`js
// the JS instinct — nested objects
const customer = { name: 'Ada', orders: [ { total: 90, items: [...] } ] };
\`\`\`

Relational modeling *un-nests*: each entity gets a table; relationships
become **foreign keys** — columns that point at another table's primary key:

\`\`\`sql
CREATE TABLE customers (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),  -- the foreign key
  status      text NOT NULL DEFAULT 'created',
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
\`\`\`

Read the column definitions slowly — each keyword is a *guarantee*:
- \`PRIMARY KEY\` — unique identifier for the row; what others reference.
- \`NOT NULL\` — this column can never be empty. Make everything NOT NULL
  unless you have a reason; nullable-by-accident columns breed bugs.
- \`UNIQUE\` — no two customers share an email. Enforced *by the database*,
  even under concurrent requests (remember the race in p0.l1? An app-level
  "check if email exists, then insert" RACES; a unique constraint cannot).
- \`REFERENCES customers(id)\` — an order can't point at a customer that
  doesn't exist, and a customer can't be deleted while orders point at them.
- \`CHECK (total_cents >= 0)\` — a business rule the database enforces.
- \`total_cents integer\` — money as integer cents, **never** float. Floats
  can't represent 0.1 exactly; \`0.1 + 0.2 === 0.30000000000000004\` in a
  price is a lawsuit.

The philosophy: **push invariants into the database.** App code has bugs,
gets bypassed by scripts and admin tools, and races with itself across
instances. The database is the single choke point every write must pass —
rules that live there *cannot* be skipped.

## Normalization, minus the jargon

You'll hear "third normal form (3NF)". The working version is one sentence:
**every fact lives in exactly one place.**

Anti-example: put \`customer_name\` on each order row (feels convenient —
saves a join!). Now Ada renames herself: you must update every one of her
orders; miss one and your data *disagrees with itself* — and there's no
longer a way to know which value is true. That's the disease normalization
prevents. Store the name once in \`customers\`; orders point at it.

Relationship shapes and where the key goes:
- **1-to-many** (customer → orders): FK on the *many* side (\`orders.customer_id\`).
- **many-to-many** (orders ↔ products): a *join table* holding both FKs —
  which is also exactly where per-pair facts (like quantity) belong:

\`\`\`sql
CREATE TABLE order_items (
  order_id   bigint NOT NULL REFERENCES orders(id),
  product_id bigint NOT NULL REFERENCES products(id),
  quantity   integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_id, product_id)
);
\`\`\`

(Deliberate denormalization exists as a *performance* tool — Phase 5. Learn
the clean way first; you can't safely break rules you don't know.)

## The SQL you'll write every day

\`\`\`sql
INSERT INTO customers (email, name) VALUES ('ada@lovelace.dev', 'Ada')
RETURNING id;                                -- get the new id back, no 2nd query

SELECT id, status, total_cents FROM orders   -- never SELECT * in app code
WHERE customer_id = 1 AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;

UPDATE orders SET status = 'shipped' WHERE id = 42;   -- FORGET the WHERE and
DELETE FROM order_items WHERE order_id = 42;          -- you update EVERY row.
\`\`\`

That WHERE-less UPDATE is a genuine career moment that happens to someone
every day somewhere. Habit: write the \`WHERE\` first, or wrap risky
statements in a transaction (next lesson) so you can ROLLBACK.

**JOIN** — the operation that makes relational data whole again:

\`\`\`sql
SELECT o.id, o.total_cents, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id     -- INNER: only rows with a match
WHERE o.status = 'paid';

-- LEFT JOIN: keep ALL customers, even those with no orders (order columns NULL)
SELECT c.name, count(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name;                             -- GROUP BY: one row per customer
\`\`\`

**Aggregation**: \`count/sum/avg/min/max\` + \`GROUP BY\` collapse rows into
stats; \`HAVING\` filters *after* grouping (\`WHERE\` filters before):

\`\`\`sql
SELECT customer_id, sum(total_cents) AS lifetime
FROM orders GROUP BY customer_id
HAVING sum(total_cents) > 100000;            -- only big spenders
\`\`\`

**The senior differentiator — window functions.** "Latest order per
customer" — the naive instinct is to loop in JS: fetch customers, then query
orders per customer. That's the **N+1 pattern** (1 query + N more), and it's
the most common performance disease in backend code (decision d15). SQL does
it in one pass:

\`\`\`sql
SELECT * FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY customer_id      -- restart count per customer
                            ORDER BY created_at DESC) AS rn
  FROM orders o
) ranked
WHERE rn = 1;                                -- rank 1 = newest per customer
\`\`\`

A window function computes across related rows *without* collapsing them
like GROUP BY does. If you're looping in JS to do what a JOIN or window
function does in one query — you're doing it slower, racier, and wronger.

> **Try it now (30 min):** in psql, create the four tables above, insert 3
> customers / 6 orders / a few items, then write: (1) each customer's order
> count including zero-order customers, (2) revenue by status, (3) latest
> order per customer with ROW_NUMBER. Then try to insert an order for
> customer_id 999 and *enjoy* the foreign key stopping you.`,
          quiz: [
            {
              q: 'Why push invariants (UNIQUE, FK, CHECK) into the database?',
              choices: ['It looks professional', 'The DB enforces them under all concurrent access; app code can be bypassed or race', 'It is faster to write', 'ORMs require it'],
              answer: 1,
              explain: 'Multiple app instances race; the database is the single consistent enforcement point.',
            },
            {
              q: 'EXPLAIN ANALYZE shows a Seq Scan on a large filtered query. Likely fix?',
              choices: ['Add more RAM', 'Add an appropriate index so the planner uses an Index Scan', 'Rewrite in NoSQL', 'Increase connection pool'],
              answer: 1,
              explain: 'A sequential scan over a large table for a selective filter usually means a missing index.',
            },
          ],
          challenge: 'ch-sql-safe',
        },
        {
          id: 'p2.l2',
          title: 'Transactions, isolation & indexes',
          minutes: 75,
          body: `# Transactions, isolation & indexes

Two topics, one lesson, because together they answer the two questions every
backend must answer about its database: *"is my data correct under
concurrency?"* and *"why is this query slow?"*

## Transactions: all or nothing

The classic: transfer $100 between accounts. Two updates:

\`\`\`sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- ⚡ what if the process crashes RIGHT HERE?
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
\`\`\`

Crash between them and $100 has *vanished* — debited, never credited. No
retry fixes it; the money is just gone from reality. The fix is the
**transaction**: a group of statements that succeed or fail **as one unit**:

\`\`\`sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;    -- both become durable together — or, on any failure, ROLLBACK:
           -- both are undone as if they never ran
\`\`\`

This is the **A** in the acronym you'll hear constantly, **ACID**:
- **Atomicity** — all-or-nothing (the transfer above).
- **Consistency** — constraints hold before and after (a CHECK can't be
  violated "temporarily and committed").
- **Isolation** — concurrent transactions don't see each other's half-done
  work (rest of this section).
- **Durability** — once COMMIT returns, the data survives a crash or power
  cut (it's genuinely on disk, not just in memory).

Internalize what ACID buys you, because half of system design (Phase 5) is
about the pain of operating *without* it.

## Isolation: what happens when transactions overlap

Remember p0.l1's double-sold item? Databases have the same problem class,
and a dial for how much protection you get — **isolation levels**:

- **Read Committed** (Postgres default): you never see uncommitted data from
  others, but two reads *within your own transaction* can disagree if someone
  commits in between. Fine for most CRUD.
- **Repeatable Read**: your transaction sees a frozen **snapshot** taken at
  its start — a consistent view for multi-step reads/reports.
- **Serializable**: the gold standard — the outcome is *as if* transactions
  ran one at a time. The catch: Postgres achieves it by **aborting** one of
  two genuinely conflicting transactions with a serialization error. **Your
  app must catch that error and retry the transaction.** Serializable
  without retry logic is a bug, not a safety feature.

But for the classic backend races, you'll usually reach for two targeted
tools instead of cranking the dial:

**Pessimistic locking** — "lock the row while I work on it":

\`\`\`sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- others' FOR UPDATE now WAITS
-- check balance, decide, update — no one can interleave on this row
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;                                          -- lock released
\`\`\`

This is THE fix for p0.l1's check-then-act race: the check and the act
happen while holding the row. Cost: waiting reduces throughput on hot rows.

**Optimistic locking** — "don't lock; detect the collision". Add a
\`version\` column; every update must name the version it read:

\`\`\`sql
UPDATE orders SET status = 'shipped', version = version + 1
WHERE id = 42 AND version = 3;    -- I read version 3...
\`\`\`

If someone else updated first, the row is at version 4, your WHERE matches
**zero rows** — and "0 rows updated" is your signal: someone won the race.
Report it to the client as **409 Conflict** and let them re-fetch and retry.
No waiting, perfect for HTTP APIs — this is exactly what \`lab-orders-api\`'s
PATCH milestone and the Graduation Project require. Pessimistic = hold the
door; optimistic = collide detectably and retry. Interview gold: know when
each fits (hot contended rows → pessimistic; occasional-conflict API updates
→ optimistic).

## Indexes: why queries are slow, and the fix

A query filtering a 10M-row table with no help must read **every row** — a
**sequential scan**. An **index** is a sorted side-structure (a B-tree) that
lets the database *seek*: like a book's index versus reading every page —
O(log n) instead of O(n).

\`\`\`sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
\`\`\`

**See the difference yourself** — this tool is half of all performance work:

\`\`\`sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 1;
-- BEFORE:  Seq Scan on orders ... rows=10000000 ... actual time=812ms
-- AFTER:   Index Scan using idx_orders_customer ... actual time=0.08ms
\`\`\`

Ten thousand times faster. Same query, same data. \`EXPLAIN ANALYZE\` runs the
query and shows the plan — Seq Scan on a big filtered table = your missing-
index alarm. When anyone says "the API is slow", your FIRST move is EXPLAIN
ANALYZE on the hot query, not adding caches or servers (decision d1).

What to know beyond the basics:
- **Composite indexes** \`(a, b)\` obey the **leftmost-prefix rule**: they
  serve \`WHERE a = ?\` and \`WHERE a = ? AND b = ?\`, but NOT \`WHERE b = ?\`
  alone — like a phone book sorted by (last, first): useless for finding
  everyone named "Ada". Column order matters; lead with the column you
  always filter on.
- **Uniques come free**: PRIMARY KEY and UNIQUE create indexes automatically.
  FKs do NOT auto-index in Postgres — index your FK columns; joins live on them.
- **Partial**: \`CREATE INDEX ... ON orders (created_at) WHERE status = 'pending'\`
  — small, fast index for the hot subset.
- **The price**: every index must be updated on every INSERT/UPDATE — indexes
  make reads fast and *writes slower*, plus storage. Index for the query
  patterns you actually have, not "just in case".

> **Try it now (20 min):** \`INSERT INTO orders (customer_id, total_cents)
> SELECT (random()*2+1)::int, (random()*10000)::int FROM generate_series(1, 1000000);\`
> — a million rows in seconds. EXPLAIN ANALYZE a filtered query, watch the
> Seq Scan and the ms. CREATE INDEX. Run it again. That 1000x is a feeling
> you should get to have at least once with your own hands.`,
          quiz: [
            {
              q: 'You use SERIALIZABLE isolation. Your app must additionally…',
              choices: ['nothing extra', 'retry transactions that fail with a serialization error', 'disable indexes', 'use only GET requests'],
              answer: 1,
              explain: 'Serializable can abort conflicting txns; the app retries them to make progress.',
            },
            {
              q: 'A composite index on (a, b). Which query canNOT use it efficiently?',
              choices: ['WHERE a = 1', 'WHERE a = 1 AND b = 2', 'WHERE b = 2 alone', 'WHERE a = 1 ORDER BY b'],
              answer: 2,
              explain: 'Leftmost-prefix rule: a query on b alone cannot use a (a,b) index effectively.',
            },
            {
              q: 'Optimistic locking with a version column maps naturally to which HTTP status on conflict?',
              choices: ['200', '403', '409 Conflict', '500'],
              answer: 2,
              explain: 'A stale version update affecting 0 rows means someone else won → 409.',
            },
          ],
          challenge: 'ch-transactions',
        },
      ],
    },
    {
      id: 'p2.m2',
      title: 'ORMs, query builders & NoSQL',
      lessons: [
        {
          id: 'p2.l3',
          title: 'Prisma / Drizzle / Knex — and migrations',
          minutes: 60,
          body: `# Talking to Postgres from Node: drivers, ORMs & migrations

You know SQL. Now: how does your Node code actually send it — and how do
teams change database schemas without breaking production? Two workaday
skills that separate "did a tutorial" from "works on a team".

## Level 0: the raw driver (pg) — and the pool

The \`pg\` package speaks the Postgres wire protocol. First contact:

\`\`\`js
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  'SELECT id, status FROM orders WHERE customer_id = $1 AND status = $2',
  [customerId, 'paid'],          // $1, $2 <- parameterized. ALWAYS. (ch-sql-safe)
);
\`\`\`

Two life-or-death details in six lines:

**Parameterized queries.** The \`$1\` placeholders send SQL and values
*separately* — user input can never become SQL code. The alternative is the
most famous vulnerability on the internet:

\`\`\`js
// NEVER. If email = "'; DROP TABLE users; --" you just lost the users table.
await pool.query(\`SELECT * FROM users WHERE email = '\${email}'\`);
\`\`\`

That's **SQL injection**. The defense is not escaping, not cleverness:
parameterize, always, no exceptions. (You proved you can in ch-sql-safe.)

**The Pool.** Opening a Postgres connection is expensive (~tens of ms:
TCP + auth + a server process), and Postgres caps total connections
(default ~100). A connection per request melts under load. A **pool** keeps
~10-20 connections open and *lends* them out per query. No pool (or a
misconfigured one) is a top-3 cause of real production outages — the
symptom: everything is fine, then under load, requests queue forever waiting
for a connection. Every option up the stack (Prisma, Knex) has a pool under
the hood; know it's there and know its size.

## Level 1-2: query builders and ORMs

Raw strings get unwieldy for dynamic queries (optional filters, etc.).
The ecosystem offers rungs of abstraction:

**Query builder (Knex, or Drizzle in TS)** — JS that *composes* SQL,
transparently:

\`\`\`js
let q = db('orders').where('customer_id', id).orderBy('created_at', 'desc');
if (status) q = q.where({ status });          // dynamic filters compose cleanly
const orders = await q.limit(20);
\`\`\`

You still think in SQL; it writes the string and parameterizes for you.

**ORM (Prisma, TypeORM)** — models the schema and generates a typed client:

\`\`\`js
const orders = await prisma.order.findMany({
  where: { customerId: id, status: 'paid' },
  include: { items: true },                  // a JOIN, expressed declaratively
  take: 20,
});   // fully typed result — typo a field name and TS errors at compile time
\`\`\`

Gorgeous DX. Two classic traps hide inside:
1. **N+1 again**: \`findMany\` customers, then \`order.findMany\` inside a loop
   = 1+N queries. ORMs make this *comfortable* to write. \`include\` (a join)
   fixes it — but only if you notice. Turn on query logging in dev and READ
   what your ORM emits.
2. **The 5% wall**: some queries (window functions, recursive CTEs, exotic
   upserts) exceed the ORM's language. Every ORM has a raw-SQL escape hatch
   (\`prisma.$queryRaw\`) — using it is correct engineering, not defeat.

The senior stance: **ORMs are a convenience layer over SQL you understand,
never a substitute for understanding it.** When the ORM's query is slow, you
read the SQL it generated, EXPLAIN ANALYZE it, and fix it — everything from
p2.l2 still applies underneath.

## Migrations: how schemas change on a team

Day one at any job: the schema isn't in anyone's head — it's a folder of
**migration files**, each a numbered, versioned schema change:

\`\`\`
migrations/
  001_create_customers.sql
  002_create_orders.sql
  003_add_orders_status_index.sql
\`\`\`

A migration tool (Prisma Migrate, Knex, node-pg-migrate) tracks which have
run against which database and applies the missing ones, in order. Why this
is non-negotiable on teams: the schema needs the same properties as code —
versioned in git, reviewed in PRs, applied identically in dev/staging/prod,
reproducible from scratch. "I'll just run ALTER TABLE on prod real quick" is
how environments drift apart until deploys start failing mysteriously.

Rules of the road:
- Migrations are **forward-only** in practice: fixing a mistake means writing
  a *new* migration, not editing an applied one (it already ran on prod;
  editing the file changes nothing there and desyncs everyone else's dev DB).
- CI/CD runs migrations as a deploy step, *before* the new code starts.
- **The zero-downtime rule**: during a rolling deploy, old code and new code
  run against the same database *simultaneously* — so every migration must
  be **backward compatible** with the currently-running code. Renaming a
  column in place breaks the old code instantly. The safe path is
  **expand → migrate → contract**: add the new nullable column; deploy code
  that writes both; backfill old rows in batches; enforce NOT NULL; then,
  releases later, drop the old column. You'll defend this pattern in
  decision d7, and interviewers genuinely ask it ("add a NOT NULL column to
  a 400M-row table with zero downtime — go").

> **Try it now (25 min):** \`npm i knex pg\` in a scratch folder,
> \`npx knex init\`, write migration 001 creating \`customers\` and 002 creating
> \`orders\`, run \`npx knex migrate:latest\` against your Docker Postgres, then
> \`migrate:rollback\` and \`latest\` again. That run/rollback/run loop is your
> daily rhythm on every backend team.`,
          quiz: [
            {
              q: 'Why is a connection pool mandatory in a real Node/Postgres service?',
              choices: ['To encrypt traffic', 'DB connections are finite and expensive; a pool reuses a bounded set across many requests', 'ORMs refuse to work without it', 'To enable migrations'],
              answer: 1,
              explain: 'Opening a connection per request exhausts Postgres and adds latency; pool and reuse.',
            },
            {
              q: 'Zero-downtime "add required column" uses which pattern?',
              choices: ['Rename in place', 'Expand/contract: add nullable, backfill, enforce, drop old', 'Drop and recreate the table', 'Turn off the database briefly'],
              answer: 1,
              explain: 'Backward-compatible steps let old and new code run simultaneously during deploy.',
            },
          ],
        },
        {
          id: 'p2.l4',
          title: 'Redis & document stores: when NoSQL earns it',
          minutes: 60,
          body: `# Redis & document stores: when NoSQL earns it

"SQL or NoSQL?" is asked like a religion question. The senior answer is
boring: **default to Postgres; add a specialized store when a specific
access pattern demands it.** This lesson gives you the two stores you'll
actually meet — Redis constantly, document DBs sometimes — and the judgment
for when each earns its place.

## Redis: the backend's Swiss-army knife

Redis is a **key-value store that lives in RAM**. That one design choice
drives everything: reads and writes take *microseconds* (Postgres: single-
digit milliseconds — a thousand-fold gap), but RAM is small and, by default,
**data can be lost on restart**. So Redis is never your source of truth —
it's the fast layer *in front of* the truth.

Play with it now:

\`\`\`bash
docker run -d --name redis -p 6379:6379 redis:7
docker exec -it redis redis-cli
\`\`\`

\`\`\`
SET user:42:name "Ada"          # keys are strings; colons are just convention
GET user:42:name                # -> "Ada"
SET session:abc123 "42" EX 3600 # EX = expire after 3600s — TTL is built in!
INCR pageviews                  # atomic increment — no read-modify-write race
EXPIRE pageviews 60
\`\`\`

Those few commands power four patterns you'll use in nearly every job:

**1. Caching (cache-aside)** — the big one. Some read is expensive (a fat
JOIN, an external API). Check the cache first; on miss, do the work and
store it with a TTL:

\`\`\`js
async function getProduct(id) {
  const cached = await redis.get(\`product:\${id}\`);
  if (cached) return JSON.parse(cached);              // HIT: microseconds

  const product = await db.products.find(id);        // MISS: hit the truth
  await redis.set(\`product:\${id}\`, JSON.stringify(product), { EX: 300 });
  return product;
}
\`\`\`

A 90% hit rate = 90% of that load gone from Postgres. The **hard part is
invalidation**: the product changes — your cache is now serving lies for up
to 300s. Strategies: short TTLs (bounded staleness), or **delete the key on
every write** (\`redis.del\` in the update path — what the Graduation Project
requires, surfaced through that \`x-cache: MISS/HIT\` header).

Also know the failure mode named **cache stampede**: a hot key expires and
1,000 concurrent requests all miss at once → 1,000 identical queries hammer
Postgres → it tips over. Mitigations: staggered/jittered TTLs, or letting
one request rebuild while others briefly serve stale. (You built the
single-flight version of this idea in \`ch-idempotency\` — same shape!)

**2. Sessions** — \`session:<token> → userId\` with a TTL. Why Redis instead
of server memory? Phase 5's punchline: with multiple server instances behind
a load balancer, the next request may hit a *different* instance — state must
live somewhere shared. Instant revocation = delete the key. (This is your
lab-auth sessions map, made real — and it's decision d2.)

**3. Rate limiting** — \`INCR\` is atomic, so counting per-user requests has
no race even across many server instances:

\`\`\`js
const count = await redis.incr(\`rl:\${userId}:\${currentMinute}\`);
if (count === 1) await redis.expire(\`rl:\${userId}:\${currentMinute}\`, 60);
if (count > 100) throw new TooManyRequestsError();   // -> 429 + Retry-After
\`\`\`

**4. Queues** — BullMQ (Phase 3) stores its jobs in Redis. Same instance,
another job.

One more property: Redis is **single-threaded**, like Node — each command
runs atomically, which is *why* INCR needs no locks. And the same warning
transfers: one slow command (\`KEYS *\` on a big instance — never run it in
prod) blocks every client.

## Document stores (MongoDB): the honest picture

Document DBs store JSON-ish **documents** in collections — schema optional,
nesting natural:

\`\`\`js
db.orders.insertOne({
  customer: { name: 'Ada', email: 'ada@lovelace.dev' },   // nested, denormalized
  items: [{ sku: 'X1', qty: 2 }],
  status: 'paid',
});
\`\`\`

The honest trade: you've **denormalized** — Ada's name is copied into every
order (the exact disease p2.l1 warned about). Rename her and you're updating
N documents, in application code, without the transactional muscle SQL gives
you. Where documents genuinely win: data that is *naturally* a self-contained
blob you read/write whole (a saved form draft, a game state, a CMS page),
truly variable per-item shapes, and rapid early prototyping.

Before reaching for Mongo, know this: **Postgres has jsonb** — a binary JSON
column type, indexable with GIN indexes and queryable:

\`\`\`sql
ALTER TABLE orders ADD COLUMN metadata jsonb;
SELECT * FROM orders WHERE metadata @> '{"gift": true}';
\`\`\`

Relational integrity for the structured 90%, document flexibility for the
messy 10%, one database to operate. This combination removes most of the
reason teams thought they needed a document store — and it's decision d5.

## The decision rule (and the interview answer)

Choose by **access pattern**, never by data shape aesthetics ("our data is
JSON" describes every API on earth):

- Structured entities, relationships, constraints, transactions → **Postgres**.
- Sub-millisecond reads, ephemeral/expiring data, counters, cache, sessions,
  queues → **Redis** *next to* Postgres.
- Self-contained blobs read/written whole, no cross-entity transactions → a
  document store *may* earn it — after jsonb fails you.
- Full-text search at scale → Elasticsearch. Metrics/time-series →
  Timescale/Influx. Each is a specialist you *add*, not a replacement.

Say it like a senior: "Postgres is the system of record; Redis accelerates
it; anything else has to buy its way in with a concrete access pattern."

> **Try it now (20 min):** with both containers running, write a 30-line Node
> script (\`npm i pg redis\`) implementing cache-aside \`getProduct\` against a
> real products table. Log timings for the MISS and the HIT — seeing "12ms →
> 0.4ms" in your own terminal is the whole argument for Redis, felt.`,
          quiz: [
            {
              q: 'Which is NOT a typical, appropriate Redis use?',
              choices: ['Cache with TTL', 'Rate limiting via INCR/EXPIRE', 'System of record for financial transactions', 'Session storage'],
              answer: 2,
              explain: 'Redis is volatile/in-memory; it is a cache/coordination layer, not your durable source of truth.',
            },
            {
              q: 'Cache stampede is…',
              choices: ['too many keys', 'many simultaneous cache misses hammering the DB (e.g. after expiry)', 'a network partition', 'a full disk'],
              answer: 1,
              explain: 'Coalesce requests / add jittered TTL / use a lock so only one refill hits the DB.',
            },
          ],
        },
      ],
    },
  ],
} satisfies Phase;
