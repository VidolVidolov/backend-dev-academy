# 🎓 The Graduation Project — "OrderFlow"

**This is your final exam and your flagship portfolio piece in one.** You build
a production-grade order platform using **real Postgres, real Redis, real
Kafka, and real Docker** — everything the academy taught, assembled into one
running system. Unlike the labs (zero-dep by design), here you use the real
tools of the trade: any framework and any libraries you want.

The grader (`academy graduate`) is **black-box**: it tests your *running
service over HTTP*, so it doesn't care what framework you used — and it can
grade your **deployed production URL** the same way it grades localhost.

---

## What you're building

An order platform with authentication, durable orders in Postgres,
Redis-backed caching and rate limiting, and an event-driven pipeline through
Kafka (transactional outbox → producer → consumer) that asynchronously
confirms orders.

```
                        ┌──────────────────────────────────────────┐
 client ── HTTP ──▶ API │ auth · validation · rate limit · caching │
                        └───────┬──────────────────────┬───────────┘
                                │                      │
                        Postgres (orders,        Redis (sessions/cache/
                        users, outbox,           rate-limit counters)
                        events — the truth)
                                │
                     outbox relay ──▶ Kafka topic `orders` ──▶ consumer
                                                                  │
                                              marks order CONFIRMED,
                                              appends to events table
```

## Ground rules

- **Your app lives in `graduation/app/`** — your own `package.json`, your own
  dependencies. Express, Fastify, or NestJS; `pg`, Knex, Drizzle, or Prisma;
  `kafkajs`; `ioredis` or `redis`; `zod`; `pino`. Choose and own your choices.
- **Infra is provided**: `docker compose up -d` in `graduation/` starts
  Postgres 16, Redis 7, and Kafka (KRaft, no ZooKeeper).
- **Config via environment** (12-factor — lesson p0.l4):
  - `DATABASE_URL=postgres://academy:academy@localhost:5432/graduation`
  - `REDIS_URL=redis://localhost:6379`
  - `KAFKA_BROKERS=localhost:9092`
  - `PORT=3000`
- **Schema via migrations** (node-pg-migrate, Knex, Prisma Migrate — not
  hand-typed SQL in psql). Committed, versioned, forward-only.
- Passwords hashed (argon2/bcrypt/scrypt). Parameterized queries only.
  Structured JSON logs with a request id. You know all of this now — do it.

## Getting started

```bash
cd graduation
docker compose up -d          # Postgres :5432, Redis :6379, Kafka :9092
mkdir app && cd app && npm init -y
# ... build, run your migrations, start your server on :3000 ...
academy graduate              # grades stage by stage against localhost:3000
academy graduate https://your-app.fly.dev   # same grader, production URL
```

---

## The graded stages (exact contracts)

The grader runs these **in order** and stops at the first failing stage.
All request/response bodies are JSON.

### G1 — Foundation: health & readiness
- `GET /health` → `200 {"ok":true}` — liveness: the process is up.
- `GET /ready` → `200 {"postgres":true,"redis":true,"kafka":true}` when every
  dependency is genuinely reachable (actually ping them!), otherwise
  `503` with the failing ones `false`. This is the k8s readiness contract
  (lesson p4.l2).

### G2 — Auth (users in Postgres, sessions in Redis)
- `POST /register {email,password}` → `201 {id,email}`; password < 8 chars →
  `400`; duplicate email → `409`. Never return the password or hash.
- `POST /login {email,password}` → `200 {token}` (opaque token, stored in
  Redis). Wrong password and unknown email must both return `401` with the
  **same** error message (no user enumeration).
- `GET /me` with `authorization: Bearer <token>` → `200 {id,email}`;
  missing/invalid token → `401`.

### G3 — Orders: validation, pagination, idempotency, optimistic locking
All endpoints require auth (`401` without). Orders belong to their creator.
- `POST /orders {items:[{sku,qty}]}` → `201 {id, items, status:"created",
  version:1}`. Empty/missing items, missing sku, or qty < 1 → `400`.
- Honor an `idempotency-key` header: a retry with the same key returns the
  **same order id** and creates nothing new (store keys in Postgres with a
  unique constraint — lab-orders-api m3, now durable).
- `GET /orders?limit=10[&cursor=...]` → `200 {items:[...], nextCursor}` —
  **cursor** pagination (lesson p1.l4), newest first, only *your* orders.
  `nextCursor` is `null` (or absent) on the last page.
- `GET /orders/:id` → `200` for the owner; **`404` for another user's order
  or an unknown id** (don't leak existence — lab-auth m3).
- `PATCH /orders/:id {status:"cancelled", version}` — optimistic locking
  (lesson p2.l2): stale `version` → `409`; correct version → `200` with
  `version` incremented.

### G4 — Redis for real: caching + rate limiting
- `GET /orders/:id` must be cached (cache-aside, short TTL): respond with
  header `x-cache: MISS` on a cold read and `x-cache: HIT` on an immediate
  re-read. Invalidate (or version) on PATCH so stale data never serves.
- Rate-limit `POST /login`: more than 10 attempts per minute (per email or
  IP) → `429` with a `retry-after` header. Counters in Redis so the limit
  holds across instances (lesson p3.l3, decision d2's cousin).

### G5 — Kafka: the event pipeline (outbox → topic → consumer)
- Creating an order must write an `order.created` event to an **outbox table
  in the same Postgres transaction** as the order (the outbox pattern —
  lesson p3.l4). A relay publishes outbox rows to the Kafka topic `orders`.
- A **consumer** (separate process or same, your call — argue it in the
  README) consumes `orders`, and for each `order.created`: marks the order
  `status: "confirmed"` and appends an `order.confirmed` row to an events
  table. Consumption must be **idempotent** (redelivery must not double-append
  — lab-job-queue m3, now with a unique constraint).
- Black-box contract the grader checks:
  - a fresh order's `status` is `"created"`, then becomes `"confirmed"`
    within **15 seconds** (poll on `GET /orders/:id`);
  - `GET /orders/:id/events` → `200` array containing (at least) objects with
    `type: "order.created"` and `type: "order.confirmed"`.

---

## The manual checklist (not auto-graded — but not optional)

Do these and note them in your README; ask Claude Code to review each one:

- [ ] **Graceful shutdown**: SIGTERM → stop accepting, drain in-flight HTTP +
      Kafka consumer, close pools, exit 0 (lab: ch-graceful-shutdown, for real).
- [ ] **Structured logs** (pino): request id on every line; no secrets logged.
- [ ] **Dockerfile** for your app: multi-stage, non-root, `npm ci` (lesson p6.l1).
- [ ] **CI** (GitHub Actions): lint + tests on every push.
- [ ] **Tests of your own**: at least integration tests for auth + orders
      against real Postgres (Testcontainers or the compose stack).
- [ ] **Deploy it** (Fly.io / Render / Railway) with managed Postgres/Redis
      (Kafka: Upstash Kafka has a free tier) — then run
      `academy graduate <your-production-url>` and watch it pass in prod. 🎓
- [ ] **README runbook**: how to run, how it's designed, what you'd do next.
      Write it like the senior engineer you now are.

## How to work it

Plan ~3–4 weeks at the standard pace. Suggested order: G1 → G2 → G3 (the bulk)
→ G4 → G5 (the boss fight) → checklist → deploy → grade against prod. After
each stage passes, ask Claude Code for a staff-level review of that stage's
code before moving on. When all five stages pass against a **deployed URL**,
you have completed the academy — and you have the receipts.
