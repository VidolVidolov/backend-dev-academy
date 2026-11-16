// Architecture & engineering DECISION scenarios.
// Each is a real problem with constraints. You make the call, THEN see how a
// senior would reason about it — options rated, the recommendation, the principle.
// This is the "judgement" half of seniority that quizzes can't teach.

import type { Decision } from './types.ts';

export const decisions: Decision[] = [
  {
    id: 'd1',
    phase: 'p2',
    title: 'Reads are spiking; the DB is the bottleneck',
    problem:
      'Your Postgres-backed API served 5k req/s fine. Traffic grew to 40k req/s, 95% reads (product pages). p99 latency went from 40ms to 900ms. CPU on the single DB instance sits at 95%. Writes are a small fraction of traffic and are latency-sensitive (checkout).',
    constraints: [
      'Reads vastly outnumber writes (19:1).',
      'Product data changes infrequently (minutes-to-hours staleness is acceptable for reads).',
      'Checkout writes must stay fast and consistent.',
      'You have ~1 week, a small team.',
    ],
    question: 'What do you do FIRST, and what is the ordered plan?',
    options: [
      { label: 'Immediately shard the database by product category', verdict: 'bad',
        why: 'Sharding is the highest-complexity, hardest-to-reverse move. It destroys cross-shard queries and transactions. You never start here — it is a last resort, and nothing here says you have exhausted cheaper options.' },
      { label: 'Add a Redis cache-aside layer for product reads (TTL minutes) + verify indexes/queries with EXPLAIN', verdict: 'good',
        why: 'Reads dominate and tolerate staleness — textbook cache case. First confirm no missing index is the real cause (cheapest fix), then cache-aside offloads the vast majority of reads from the DB. Highest impact, lowest risk, fits the week.' },
      { label: 'Add read replicas and route all reads to them', verdict: 'ok',
        why: 'A solid SECOND move and complementary. But it adds ops (replication, lag handling, read-your-writes care) and each replica still executes every query. Do it after caching if cache hit-rate is not enough — caching removes work entirely; replicas just spread it.' },
      { label: 'Vertically scale the DB to a bigger instance', verdict: 'ok',
        why: 'Legitimate stopgap that buys time in an afternoon — do it if you are on fire TODAY. But it has a ceiling and treats the symptom. Fine as a bridge while you ship caching; not the plan.' },
    ],
    recommendation:
      'Order: (1) EXPLAIN ANALYZE the hot queries — rule out a missing index (often the whole problem). (2) Add Redis cache-aside for product reads with a short TTL + stampede protection. (3) If still hot, add read replicas for remaining reads, keeping checkout on the primary. (4) Vertical scale as a same-day bridge if needed. Sharding: not now.',
    principle:
      'Scale order: query/index → cache → vertical → read replicas → shard. Match the tool to the access pattern (read-heavy + tolerates staleness = cache). Never reach for the most irreversible option first.',
  },
  {
    id: 'd2',
    phase: 'p3',
    title: 'Sessions vs JWT for a new product',
    problem:
      'Greenfield SaaS: a web app (React) + a mobile app, both talking to your API. Product wants "log out everywhere" and the ability to instantly revoke a compromised account. Team is small; you will run a handful of API instances behind a load balancer.',
    constraints: [
      'Two clients: browser (cookies available) and mobile (no cookies).',
      'Instant revocation is a hard requirement.',
      'You are not at a scale where a session lookup per request is a problem.',
    ],
    question: 'Sessions, stateless JWT, or something in between?',
    options: [
      { label: 'Pure stateless JWT, no server state', verdict: 'bad',
        why: 'Directly conflicts with the hard requirement: you cannot instantly revoke a stateless JWT before it expires. "Log out everywhere" becomes "wait 15 minutes". Wrong tool for a stated must-have.' },
      { label: 'Opaque session tokens stored in Redis (cookie for web, Authorization header for mobile)', verdict: 'good',
        why: 'Revocation is trivial (delete the session). A shared Redis makes it work across all instances (stateless app tier, state externalized). Handles both clients. Simple, secure, meets every requirement at this scale.' },
      { label: 'Short-lived access JWT + long-lived refresh token with rotation + server-side refresh-token denylist', verdict: 'ok',
        why: 'The "in between" that scales best long-term: revoke by killing the refresh token; access tokens expire in minutes. More moving parts than you need today, but the right answer if per-request session lookups later become a bottleneck.' },
      { label: 'JWT in localStorage on the web for simplicity', verdict: 'bad',
        why: 'localStorage is readable by any XSS; storing auth tokens there is a known footgun. Plus it inherits the no-revocation problem. Two strikes.' },
    ],
    recommendation:
      'Use opaque server sessions in Redis now — it satisfies instant revocation and "log out everywhere" with the least complexity, and the shared store keeps your instances stateless. Migrate to short-lived-access + rotating-refresh JWTs only if/when session lookups become a real hotspot.',
    principle:
      'Let hard requirements pick the design. Revocation + simplicity → sessions. Don\'t adopt stateless JWT for "scale" you don\'t have while breaking a must-have you do.',
  },
  {
    id: 'd3',
    phase: 'p5',
    title: 'Monolith or microservices for a 4-person startup',
    problem:
      'A 4-engineer team is building an MVP for a marketplace (users, listings, orders, payments, notifications). An influential engineer wants to start with 6 microservices "so we can scale later and stay clean". You ship in 3 months.',
    constraints: [
      'Tiny team, unproven product, requirements will change weekly.',
      'No current scale problem — you have zero users.',
      'Payments and orders need strong transactional consistency.',
    ],
    question: 'How do you structure it?',
    options: [
      { label: 'Six microservices from day one, each with its own DB and API', verdict: 'bad',
        why: 'You buy the entire distributed-systems tax (network failures, eventual consistency, distributed transactions, versioned contracts, 6x ops) to solve scaling and org problems you do NOT have. With 4 people and changing requirements, cross-service refactors will crush your velocity. Classic premature split.' },
      { label: 'A modular monolith: one deployable, one DB, clear internal module boundaries (users/listings/orders/payments/notifications)', verdict: 'good',
        why: 'You get clean boundaries and fast, transactional in-process calls with none of the distributed cost. Orders+payments share a transaction trivially. When a real scaling or team-ownership pressure appears, you extract that one module along its existing boundary.' },
      { label: 'A single big-ball-of-mud monolith, no internal boundaries', verdict: 'ok',
        why: 'Ships fast but you pay later untangling it. The modular monolith gets you the same speed AND keeps future extraction cheap — strictly better with minimal upfront discipline.' },
      { label: 'Monolith, but put notifications in a separate service since it is async', verdict: 'ok',
        why: 'Defensible: notifications are naturally decoupled and async, so a small worker/queue split has low cost and real benefit. Reasonable pragmatic exception — just don\'t generalize it into "split everything".' },
    ],
    recommendation:
      'Build a modular monolith with strong internal module boundaries and one database. Optionally push notifications to an async worker via a queue. Extract services later, one at a time, only when a concrete scaling or team-ownership pressure forces a specific module out.',
    principle:
      'Microservices solve organizational and independent-scaling problems, not "cleanliness". Default to a modular monolith; earn each service extraction with a real, named pressure.',
  },
  {
    id: 'd4',
    phase: 'p3',
    title: 'A payment endpoint that must never double-charge',
    problem:
      'POST /checkout charges a card and creates an order. Mobile clients on flaky networks sometimes time out and RETRY, and your load balancer occasionally re-dispatches. You have seen a few customers charged twice.',
    constraints: [
      'The network will retry — you cannot prevent that.',
      'Charging twice is a serious, user-visible failure.',
      'The charge and the order creation must not diverge.',
    ],
    question: 'How do you make checkout safe under retries?',
    options: [
      { label: 'Tell mobile to stop retrying on timeout', verdict: 'bad',
        why: 'You do not control the network, and a timeout does not tell the client whether the charge succeeded — not retrying risks lost orders instead. You cannot solve a server-correctness problem with a client promise.' },
      { label: 'Require an Idempotency-Key header; store key→result; on a repeat key, return the stored result instead of re-charging', verdict: 'good',
        why: 'The industry-standard fix (it is exactly how Stripe does it). The client sends one key per logical checkout; the server executes once and replays the result for any retry with that key. Retries become safe by construction.' },
      { label: 'Wrap charge + order insert in a DB transaction', verdict: 'ok',
        why: 'Necessary for the "must not diverge" part (atomicity), but insufficient alone: a retried REQUEST starts a brand-new transaction and charges again. Combine transaction (atomicity) WITH an idempotency key (dedup). Also: the external charge isn\'t in your DB txn — use the outbox/mark pattern.' },
      { label: 'Check "does an order already exist for this cart?" before charging', verdict: 'ok',
        why: 'A natural-idempotency instinct in the right direction, but racy under concurrent retries (two requests both check, both find none, both charge) unless backed by a unique constraint. An explicit idempotency key is cleaner and race-free.' },
    ],
    recommendation:
      'Adopt idempotency keys: client generates one key per checkout attempt and sends it on every retry. Server records the key with a unique constraint, executes the charge+order once inside a transaction, stores the outcome, and returns the stored outcome for any subsequent request bearing the same key.',
    principle:
      'In distributed systems retries are inevitable, so every money-moving or state-creating operation must be idempotent. Transactions give atomicity; idempotency keys give safe-retry. You need both.',
  },
  {
    id: 'd5',
    phase: 'p2',
    title: 'Postgres or MongoDB for the core data',
    problem:
      'New app. A teammate argues for MongoDB "because our data is JSON and it matches the frontend, and it scales". The core entities are users, orders, and order-items with clear relationships, and finance needs consistent reports (sums, joins across orders).',
    constraints: [
      'Clear relational structure with cross-entity queries and aggregates.',
      'Financial reporting needs consistency and joins.',
      'No extreme scale or schema-variability requirement identified.',
    ],
    question: 'Which datastore for the core, and why?',
    options: [
      { label: 'MongoDB, because the data is JSON-shaped', verdict: 'bad',
        why: '"Looks like JSON" is not an access-pattern argument. Relational data with joins and consistent aggregates is exactly Postgres\'s strength; modeling it in a document store leads to duplicated data, awkward joins, and consistency pain for the finance reports.' },
      { label: 'Postgres for the core; use jsonb columns where a field is genuinely schemaless', verdict: 'good',
        why: 'You get transactions, joins, constraints, and mature aggregates for the relational core — AND document flexibility via jsonb where you actually need it. Best of both, one datastore, strong consistency for finance.' },
      { label: 'MongoDB, and do joins/aggregation in application code', verdict: 'bad',
        why: 'Reimplementing joins and consistent aggregation in app code is slow, bug-prone, and racy — you are rebuilding the database\'s core competency, badly.' },
      { label: 'Postgres now, add a document store later only if a real schemaless/scale need appears', verdict: 'ok',
        why: 'Essentially the recommendation, stated conservatively. Polyglot persistence is fine when driven by a concrete need; adding a store speculatively is not.' },
    ],
    recommendation:
      'Default to Postgres for the relational core, using jsonb for genuinely variable fields. Introduce a specialized store (document, search, time-series) later only when a specific access pattern clearly demands it.',
    principle:
      'Access patterns choose the datastore, not surface familiarity. Postgres is the correct default for ~90% of products; jsonb covers most "we need flexibility" cases without giving up transactions.',
  },
  {
    id: 'd6',
    phase: 'p3',
    title: 'One dependency is slow — protect the rest',
    problem:
      'Your API calls a third-party shipping-rates service on the product page. That vendor had a bad hour: their responses went from 80ms to 20s. During that hour, YOUR entire API became unresponsive — even endpoints that never call shipping. Requests piled up.',
    constraints: [
      'You cannot fix the vendor.',
      'Most endpoints do not need shipping rates at all.',
      'Node handles many requests on limited workers/connections.',
    ],
    question: 'Why did everything die, and how do you prevent it?',
    options: [
      { label: 'Add more server instances so there is spare capacity', verdict: 'bad',
        why: 'Treats a symptom and loses to math: if each hung request holds a worker for 20s, more instances just delays the same saturation. You must stop unbounded waiting, not out-provision it.' },
      { label: 'Set aggressive timeouts on the shipping call + a circuit breaker + a fallback (cached/estimated rate)', verdict: 'good',
        why: 'Timeouts stop a single slow call from holding resources for 20s. A circuit breaker stops hammering a known-bad dependency (fail fast) and lets it recover. A fallback keeps the page useful. This is the correct resilience trio, and it isolates the blast radius.' },
      { label: 'Move the shipping-rate call to a background job/queue and show rates asynchronously', verdict: 'ok',
        why: 'A strong architectural improvement where UX allows it — decouples the slow dependency from the request path entirely. Great as a follow-up; the immediate fix is still timeouts + breaker so the synchronous path can never hang.' },
      { label: 'Wrap the call in try/catch so errors are handled', verdict: 'bad',
        why: 'try/catch does nothing for a call that is SLOW rather than failing — without a timeout it waits the full 20s and still saturates you. Handling the error is not the same as bounding the wait.' },
    ],
    recommendation:
      'Add a tight timeout to the shipping call, wrap it in a circuit breaker, and provide a fallback (cached or estimated rate). Where the UX permits, additionally move rate fetching off the request path into an async flow. Ensure EVERY outbound call (DB, cache, HTTP) has a timeout.',
    principle:
      'A dependency without a timeout will eventually take your whole service down. Bound every wait; isolate failures with timeouts, retries-with-backoff, circuit breakers, and fallbacks so one slow dependency can\'t cascade.',
  },
  {
    id: 'd7',
    phase: 'p2',
    title: 'A zero-downtime schema change on a huge table',
    problem:
      'You must add a required `country` column to a `users` table with 400M rows, in a service that deploys via rolling updates (old and new code run simultaneously for a few minutes) and must not take downtime.',
    constraints: [
      'Rolling deploy: the currently-running version must keep working during rollout.',
      'The table is huge — a long lock is an outage.',
      'The column must ultimately be NOT NULL.',
    ],
    question: 'How do you roll this out safely?',
    options: [
      { label: 'ALTER TABLE ... ADD COLUMN country text NOT NULL in one migration before deploy', verdict: 'bad',
        why: 'Adding a NOT NULL column (historically) rewrites/locks a 400M-row table and instantly breaks the currently-running old code that knows nothing about the column. Both a long-lock outage and a compatibility break.' },
      { label: 'Expand/contract: add nullable column → deploy code that writes it → backfill in batches → add NOT NULL constraint (validate separately) → later drop the old path', verdict: 'good',
        why: 'Every step is backward-compatible, so old and new code coexist during the rolling deploy. The add is a fast metadata change (nullable), backfill is batched to avoid long locks, and the constraint is validated without a full-table lock. Textbook safe migration.' },
      { label: 'Take a maintenance window at 3am and do it all at once', verdict: 'ok',
        why: 'Sometimes acceptable for truly one-off changes — but the requirement explicitly says no downtime, and "3am windows" don\'t scale as a practice. Expand/contract avoids the window entirely.' },
      { label: 'Add the column with a non-null DEFAULT so existing rows are filled', verdict: 'ok',
        why: 'On modern Postgres a constant default is a fast metadata-only change and can be part of a good plan — but a default may not be the correct real value, and you still must handle old code and eventually enforce NOT NULL. A piece of the solution, not the whole.' },
    ],
    recommendation:
      'Use expand/contract: (1) add `country` as nullable; (2) deploy code that populates it on writes; (3) backfill existing rows in batches; (4) add the NOT NULL constraint as NOT VALID then VALIDATE (no full-table lock); (5) remove any transitional code. Never rename/retype in place on a live large table.',
    principle:
      'Schema changes during rolling deploys must be backward-compatible at every step. Expand → migrate → contract, in separate deploys, so old and new code always work against the same schema.',
  },
  {
    id: 'd8',
    phase: 'p4',
    title: 'How much to mock in tests',
    problem:
      'A teammate\'s PR adds fast unit tests for the order service by mocking the database, the payment gateway, and Redis. Coverage is 95%. Yet two bugs just shipped: a SQL query with a wrong JOIN, and a transaction that didn\'t roll back on a constraint violation.',
    constraints: [
      'The escaped bugs live in real DB/SQL/transaction behavior.',
      'The suite is green and "high coverage".',
      'You want fast feedback AND real confidence.',
    ],
    question: 'What testing strategy would have caught these?',
    options: [
      { label: 'Write more unit tests with better mocks of the database', verdict: 'bad',
        why: 'The bugs ARE in real database behavior (JOIN semantics, transaction rollback on a constraint). A mock encodes your assumptions, so it happily returns what you expected — it can never catch a wrong assumption about the real DB. More mocking makes this worse.' },
      { label: 'Add integration tests running against a REAL Postgres via Testcontainers for the data layer', verdict: 'good',
        why: 'The wrong JOIN and the rollback behavior only surface against a real database. Testcontainers spins up an ephemeral real Postgres per run, so these tests exercise actual SQL, constraints, and transactions — exactly where the bugs lived.' },
      { label: 'Keep unit tests, but stop mocking your own database; mock only true third parties (the payment gateway)', verdict: 'good',
        why: 'The right principle: mock at the edges you don\'t own (payment API), use the real thing for what you do own (your DB). Pairs naturally with Testcontainers integration tests. Coverage % matters less than testing the risky real behavior.' },
      { label: 'Add end-to-end tests hitting the deployed staging environment for everything', verdict: 'ok',
        why: 'A few E2E tests are valuable, but making them your primary net is slow, flaky, and hard to debug. Catch data-layer bugs at the cheaper integration layer; reserve E2E for critical user journeys.' },
    ],
    recommendation:
      'Stop mocking your own database. Add integration tests that run the data layer against a real Postgres (Testcontainers), mock only third parties you don\'t control (payment gateway), and keep pure unit tests for domain logic. Judge the suite by whether it exercises risky real behavior, not by coverage %.',
    principle:
      'Mock at the boundaries you don\'t own; use real dependencies for the ones you do. High coverage over mocks is false confidence — the bugs that ship live in the behavior you mocked away.',
  },
  {
    id: 'd9',
    phase: 'p3',
    title: 'Picking a queue: BullMQ, RabbitMQ, Kafka, or SQS',
    problem:
      'Your monolith needs background work: transactional emails, webhook delivery with retries, and nightly report generation. ~50k jobs/day today, maybe 500k/day in two years. You already run Redis for caching. One engineer says "use Kafka, it\'s what serious companies use."',
    constraints: [
      'Modest, spiky volume — nowhere near streaming scale.',
      'You already operate Redis; you run on AWS.',
      'Small team: ops burden matters more than throughput ceilings.',
      'Jobs need retries, backoff, and a DLQ — not event replay.',
    ],
    question: 'Which technology do you pick?',
    options: [
      { label: 'Kafka, so we never have to migrate later', verdict: 'bad',
        why: 'Kafka is a distributed, partitioned, replicated LOG for high-throughput streaming and replay — with the ops burden to match (brokers, partitions, consumer groups, rebalancing). For 50k task-queue jobs/day it is a container ship for a pizza delivery. "Serious companies use it" is not an access-pattern argument.' },
      { label: 'BullMQ on the Redis you already run', verdict: 'good',
        why: 'Job-queue semantics out of the box (retries, backoff, DLQ, delayed jobs, concurrency), Node-native DX, and zero new infrastructure — you already operate Redis. Fits the volume with 100x headroom. The cheapest correct answer.' },
      { label: 'SQS (+ a small worker) since you are on AWS', verdict: 'ok',
        why: 'Also a strong answer: fully managed, effectively infinite scale, built-in DLQ. Costs you a bit more integration code (visibility timeouts, no native scheduling without extra pieces) and money, but removes Redis-queue ops. Either this or BullMQ is defensible; Kafka is not.' },
      { label: 'RabbitMQ for its flexible routing', verdict: 'ok',
        why: 'Capable and battle-tested, but it introduces a NEW stateful system to operate for routing features this workload does not need. Choose it when you need complex exchange/routing topologies — not stated here.' },
    ],
    recommendation:
      'BullMQ on your existing Redis (or SQS if you prefer managed). Revisit only if you develop genuine streaming needs — event replay, ordered high-throughput feeds, multiple independent consumers of the same events — which is when Kafka earns its complexity.',
    principle:
      'Choose infrastructure by access pattern and ops budget, not prestige. A task queue and an event log are different tools; needing the first does not justify running the second.',
  },
  {
    id: 'd10',
    phase: 'p4',
    title: 'Alert fatigue: the on-call is drowning',
    problem:
      'Your team gets ~40 pages a week: CPU > 80%, memory > 75%, disk > 60%, any 5xx, a pod restart, replication lag > 1s. Engineers have started ignoring pages. Last week a real outage (checkout down 25 minutes) was acknowledged late because the on-call assumed it was another false alarm.',
    constraints: [
      'The real outage WAS captured by an alert — buried among noise.',
      'Management wants "more monitoring" after the incident.',
      'You have latency/error metrics per endpoint and SLOs are not yet defined.',
    ],
    question: 'How do you fix on-call?',
    options: [
      { label: 'Add more alerts so nothing is missed', verdict: 'bad',
        why: 'The problem is not coverage — the outage WAS alerted. It is signal-to-noise. More noise makes the next real page even easier to ignore. This is how "more monitoring" makes reliability worse.' },
      { label: 'Define SLOs, page ONLY on user-facing symptoms (error-rate/latency SLO burn), demote causes (CPU, memory, restarts) to dashboards/tickets', verdict: 'good',
        why: 'Pages should mean "users are hurting NOW and a human must act." Symptom-based, SLO-burn alerting delivers exactly that. Cause-level signals (CPU, disk, restarts) become dashboards and next-morning tickets. Page count drops ~10x and every page is real — trust in paging is restored.' },
      { label: 'Rotate on-call more often so no one burns out', verdict: 'bad',
        why: 'Spreads the noise across more people without reducing it. Everyone learns to ignore pages slightly slower. The dysfunction remains.' },
      { label: 'Route alerts to a Slack channel instead of paging', verdict: 'ok',
        why: 'Fine for the demoted cause-level signals — that is exactly where they belong. As a blanket policy it just moves the noise and guarantees real outages are seen late. Use it as part of the tiering, not instead of it.' },
    ],
    recommendation:
      'Define SLOs per user journey (checkout availability, p99 latency). Page only on SLO-burn / symptom alerts that are urgent AND actionable. Everything else: dashboards and tickets. Review every page weekly — each one either was actionable or gets tuned out of paging.',
    principle:
      'Alert on symptoms users feel, not causes machines report. Every non-actionable page steals credibility from the page that matters.',
  },
  {
    id: 'd11',
    phase: 'p1',
    title: 'You must break the API — mobile apps are in the wild',
    problem:
      'Your /v1/orders response has a field `total` (a number, in dollars). Finance requires switching to integer cents plus a currency code — a breaking change. Your API is consumed by your web app (deploys with the API), a mobile app (users update whenever they feel like it — some run versions from 14 months ago), and three partner integrations.',
    constraints: [
      'Old mobile clients will exist for a year or more — you cannot force upgrades.',
      'Partners integrate slowly (quarters, not weeks).',
      'Serving wrong-looking money data is not acceptable for even one client.',
    ],
    question: 'How do you ship the change?',
    options: [
      { label: 'Change the field in place and announce it in the changelog', verdict: 'bad',
        why: 'Every deployed mobile app and partner integration breaks (or worse — silently misreads dollars as cents, a 100x money bug). A changelog is not a migration strategy for clients you do not control.' },
      { label: 'Additive evolution: add `totalCents` + `currency` alongside `total`, migrate clients at their own pace, deprecate `total` with headers/comms, remove it only after usage telemetry hits ~zero', verdict: 'good',
        why: 'Additive changes are non-breaking: old clients keep reading `total`, new clients use the new fields. Deprecation headers + client-version telemetry tell you when removal is actually safe. This is how APIs with uncontrolled clients evolve in practice.' },
      { label: 'Ship /v2 with the new shape and maintain v1 alongside', verdict: 'ok',
        why: 'Correct and clean for a large redesign — but for ONE field it buys you a whole parallel surface to maintain and partners STILL take quarters to move. Prefer additive evolution within v1 for changes this small; save version bumps for genuinely incompatible redesigns.' },
      { label: 'Detect the client version and return different shapes from the same endpoint', verdict: 'bad',
        why: 'Per-client response shapes from one undocumented endpoint is a testing and debugging nightmare that grows combinatorially. Version detection for graceful degradation is one thing; forked payload semantics is a trap.' },
    ],
    recommendation:
      'Add `totalCents` and `currency` as new fields, keep `total` working, mark it deprecated (docs + Deprecation/Sunset headers), instrument who still reads it, actively migrate partners, and remove it only when telemetry says nobody is left — likely 12+ months out.',
    principle:
      'With clients you don\'t control, evolve APIs additively — never change a shipped field\'s meaning in place. Deprecate with telemetry; remove on evidence, not on a date you hoped for.',
  },
  {
    id: 'd12',
    phase: 'p2',
    title: 'Multi-tenancy: how isolated does tenant data need to be?',
    problem:
      'Your B2B SaaS is growing: 400 tenants today, aiming for 5,000. Everything lives in one Postgres. An engineer proposes database-per-tenant "for security". A big prospect\'s security questionnaire asks how you isolate tenant data. Current code filters by tenant_id in application queries — and last month a missing WHERE clause leaked one tenant\'s rows into another\'s CSV export.',
    constraints: [
      'You already leaked cross-tenant data once via a missing filter.',
      'Target is thousands of small/medium tenants, a few large ones.',
      'Small team; migrations already take coordination.',
      'Compliance needs provable isolation, not necessarily physical separation.',
    ],
    question: 'What isolation model do you move to?',
    options: [
      { label: 'Database-per-tenant for maximum isolation', verdict: 'bad',
        why: 'At 5,000 tenants that is 5,000 databases to migrate, monitor, back up, and pool connections for — a full-time ops nightmare that also makes cross-tenant analytics nearly impossible. Physical isolation is for a handful of huge regulated tenants, not thousands of small ones.' },
      { label: 'Shared schema + tenant_id everywhere, enforced by Postgres Row-Level Security (RLS) instead of hand-written WHERE clauses', verdict: 'good',
        why: 'Your incident was a missing app-level filter — RLS moves enforcement into the database: policies guarantee every query is tenant-scoped no matter what the application forgets. One schema to migrate, easy analytics, and "database-enforced row-level isolation" is a strong security-questionnaire answer.' },
      { label: 'Schema-per-tenant in one database', verdict: 'ok',
        why: 'A middle ground, but migrations become N-schema loops and connection/search_path management gets fiddly; at 5,000 schemas Postgres catalogs and tooling groan. Reasonable at dozens of tenants, painful at your target scale.' },
      { label: 'Keep app-level tenant_id filters but add code review checklists', verdict: 'bad',
        why: 'You already proved a human process fails — one forgotten WHERE clause leaked data. Checklists reduce frequency; they do not change the failure mode. Enforce isolation structurally, in the database.' },
    ],
    recommendation:
      'Shared schema with tenant_id + Postgres RLS policies (set the tenant in a session variable per request; policies filter every table automatically). Add tests that prove cross-tenant reads fail. Offer database-level isolation later as a premium tier for the few giant/regulated tenants that demand it.',
    principle:
      'Enforce tenant isolation in the database, not in developer discipline. Pick the isolation level by tenant count and compliance need — RLS for many small tenants, physical separation only where contractually required.',
  },
  {
    id: 'd13',
    phase: 'p3',
    title: 'Live updates: WebSockets, SSE, or polling?',
    problem:
      'Your dashboard product needs live order-status updates: server → browser, a few events per minute per user, thousands of concurrent viewers. A teammate has started wiring Socket.IO everywhere. Nothing in the product sends data browser → server in real time; corporate customers sit behind strict proxies; you run several instances behind an ALB.',
    constraints: [
      'Traffic is one-directional (server → client) and low-frequency.',
      'Corporate proxies/firewalls sometimes fight WebSocket upgrades.',
      'Multiple instances: any fan-out solution must work across them.',
      'Team wants minimal new moving parts.',
    ],
    question: 'What transport do you pick?',
    options: [
      { label: 'Socket.IO/WebSockets everywhere', verdict: 'ok',
        why: 'Works, but you pay for bidirectionality you do not use: upgrade handshakes through hostile proxies, sticky sessions or a Redis adapter, custom reconnect logic. Defensible if chat/collaboration is on the roadmap; overkill for one-way status ticks.' },
      { label: 'Server-Sent Events (SSE) + Redis pub/sub for cross-instance fan-out', verdict: 'good',
        why: 'SSE is plain HTTP: proxy-friendly, auto-reconnect with Last-Event-ID built into the browser, trivially simple server code. Exactly matches one-directional low-frequency updates. Redis pub/sub broadcasts events to whichever instance holds each client\'s connection.' },
      { label: 'Client polls GET /orders/status every 3 seconds', verdict: 'ok',
        why: 'The dumbest thing that works, and honestly fine at modest scale with cheap cached responses. But thousands of viewers × 20 req/min of mostly-empty polls is real waste, and latency is the poll interval. A fallback, not the design.' },
      { label: 'Long polling for compatibility', verdict: 'bad',
        why: 'The worst of both: connection churn and timeout juggling of polling plus the held-connection cost of streaming, with none of SSE\'s built-in reconnect semantics. It is a legacy fallback for environments SSE already handles.' },
    ],
    recommendation:
      'SSE for the browser stream (one GET, auto-reconnect), Redis pub/sub to fan events out across instances, and a plain polling fallback for the rare client where streaming fails. Adopt WebSockets only when a genuinely bidirectional feature (chat, collaborative editing) lands.',
    principle:
      'Match the transport to the traffic shape: one-way server push wants SSE; bidirectional interaction wants WebSockets; polling is the humble fallback. Don\'t buy bidirectional complexity for one-directional data.',
  },
  {
    id: 'd14',
    phase: 'p6',
    title: 'Serverless or containers for a spiky API?',
    problem:
      'A ticket-sales API: near-zero traffic most of the day, then 50x spikes for minutes when a sale opens. It talks to Postgres and must keep checkout p99 under 400ms. The team debates Lambda ("scales instantly, pay per use") vs. containers on ECS ("predictable, we know how to run it"). ',
    constraints: [
      'Extreme spikes: 0 → tens of thousands of requests in seconds.',
      'Postgres: every concurrent execution wants a connection.',
      'Checkout latency budget is tight; cold starts hurt.',
      'Team already operates containers well.',
    ],
    question: 'What compute model do you choose?',
    options: [
      { label: 'All-in on Lambda — it handles spikes by design', verdict: 'ok',
        why: 'The spike-handling is real, but two stated constraints bite hard: cold starts land exactly during the latency-critical burst, and thousands of concurrent Lambdas will flatten Postgres without RDS Proxy/PgBouncer. Solvable (provisioned concurrency + proxy) — but now you are buying back what containers gave you, with new bills.' },
      { label: 'Containers on ECS with autoscaling on request metrics', verdict: 'ok',
        why: 'Plays to team strength and pools DB connections properly — but reactive autoscaling takes minutes and your spike takes seconds. Alone, it means the first wave of buyers eats 503s. Needs the missing ingredient: you KNOW when sales start.' },
      { label: 'Containers, pre-scaled on schedule before each known sale + a queue to absorb the checkout burst', verdict: 'good',
        why: 'Ticket sales are SCHEDULED — the spike is predictable, so scale ahead of it instead of reacting to it. Warm containers keep p99 tight and DB connections pooled; a queue smooths the checkout burst into what Postgres can absorb (and gives you fairness/waiting-room semantics for free).' },
      { label: 'Kubernetes with aggressive HPA because it is the industry standard', verdict: 'bad',
        why: 'Adds a platform migration and cluster ops to a team happy on ECS, while still having the same reactive-scaling lag. "Industry standard" is not a requirement; nothing here needs k8s specifically.' },
    ],
    recommendation:
      'Stay on containers; pre-scale on a schedule ahead of each announced sale (plus headroom), keep autoscaling as backstop, and put checkout submissions through a queue so the DB sees bounded concurrency. Consider Lambda for the genuinely idle low-traffic endpoints where pay-per-use shines.',
    principle:
      'A predictable spike is a scheduling problem, not an autoscaling problem. Choose compute by latency budget, downstream connection limits, and team competence — not by which model is newer.',
  },
  {
    id: 'd15',
    phase: 'p2',
    title: 'The dashboard makes 300 queries per page load',
    problem:
      'A "team overview" page got slow (4s). Logs show ~300 queries per load: the ORM fetches 50 projects, then per project lazily loads its owner, tags, and latest activity. A teammate proposes "add Redis caching in front of it." The data must be fresh — stale project status confuses users mid-standup.',
    constraints: [
      'Classic N+1: 1 + 50×(owner) + 50×(tags) + 50×(activity) ≈ 300 round-trips.',
      'Freshness matters — caching hides but does not remove the cost.',
      'The page needs a bounded, known set of data.',
    ],
    question: 'What is the right fix?',
    options: [
      { label: 'Cache the whole page response in Redis for 60s', verdict: 'bad',
        why: 'Papers over the problem: the first request after every expiry still costs 300 queries (now with stampede risk), and you traded away the freshness the product explicitly needs. Caching is for expensive-AND-tolerably-stale reads — this is neither expensive-by-necessity nor stale-tolerant.' },
      { label: 'Fix the N+1: eager-load relations (include/join) or write one purposeful query with JOINs/lateral for "latest activity"', verdict: 'good',
        why: '300 round-trips of per-row lazy loading collapse into 2–4 set-based queries the database executes in tens of milliseconds. The page gets fast AND stays fresh. This is the actual disease; everything else treats symptoms.' },
      { label: 'Move the aggregation into a nightly materialized rollup table', verdict: 'ok',
        why: 'Right tool for heavy analytics over history — wrong for a live operational page (staleness again). Keep it in mind for the reporting section, not the standup view.' },
      { label: 'Raise the ORM connection pool size so queries run more in parallel', verdict: 'bad',
        why: 'Makes 300 queries arrive at Postgres FASTER — more concurrent load, same waste, and now other endpoints starve for connections. Parallelizing an N+1 is scaling the bug.' },
    ],
    recommendation:
      'Turn on query logging in dev, find the lazy loads, and replace them with eager loading or one hand-written SQL query (JOIN + window function for latest-activity). Add a CI check or ORM setting that flags N+1 patterns so it cannot regress silently.',
    principle:
      'Fix the query shape before adding infrastructure. A cache in front of an N+1 is a bandage on a self-inflicted wound — set-based SQL is what databases are FOR.',
  },
  {
    id: 'd16',
    phase: 'p6',
    title: 'Bad deploy in production: roll back or fix forward?',
    problem:
      'You deployed at 14:02. At 14:09 error rate on order creation jumped from 0.1% to 18%. The deploy contained: a new feature, a refactor, AND migration 0042 which added a nullable column. The on-call engineer has a strong hunch the bug is a one-line fix and wants to "just patch it quickly". Customers are failing checkout right now.',
    constraints: [
      'Revenue-path impact, actively burning: every minute costs money and trust.',
      'The migration was additive (nullable column) — old code runs fine against the new schema.',
      'The "one-line fix" is a hypothesis, not a diagnosis.',
      'Your pipeline can redeploy the previous image in ~3 minutes.',
    ],
    question: 'What do you do at 14:10?',
    options: [
      { label: 'Let the engineer write the one-line fix, review it fast, deploy it', verdict: 'bad',
        why: 'Fix-forward under pressure stacks unknowns: hypothesis wrong → users burn another 20 minutes; hasty patch → possibly a second bug on top. You are debugging in production with customers as the test suite. The stated 3-minute rollback dominates this option.' },
      { label: 'Roll back to the previous image immediately; diagnose calmly afterwards; redeploy the fix with a test that would have caught it', verdict: 'good',
        why: 'The migration was additive, so the old code is compatible — rollback is safe AND takes 3 minutes versus an unbounded fix-forward. Restore service first; understanding the bug is a daytime activity, not a 14:10-with-checkout-down activity.' },
      { label: 'Also roll back migration 0042 to restore the exact previous state', verdict: 'bad',
        why: 'Down-migrations under pressure are where outages become data-loss incidents. The column is nullable — old code ignores it harmlessly. Never touch the schema during an incident unless the schema itself is the problem.' },
      { label: 'Feature-flag the new code path off instead of redeploying', verdict: 'ok',
        why: 'If the buggy path is genuinely behind a flag, flipping it is even faster than a rollback — the best-case answer. It only works if the refactor (not just the feature) is flagged, which refactors usually are not. Verify, and fall back to image rollback within minutes if unsure.' },
    ],
    recommendation:
      'Mitigate first: flip the feature flag if the change is truly behind one, otherwise roll back the image now (leave the additive migration in place). Confirm error rates recover, communicate status, then diagnose offline, add the regression test, and ship the real fix through the normal pipeline. Blameless postmortem after.',
    principle:
      'In an incident, restoring service beats understanding the bug. Roll back by default; fix forward only when rollback is impossible or the flag flip is faster. And design migrations to be additive precisely so rollback stays safe.',
  },
];
