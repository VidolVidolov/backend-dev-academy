# Lab: Build a real Orders API (no framework)

You build a working HTTP JSON API on Node's raw `http` module — the thing
Express/Fastify wrap. You implement `src/app.ts`; the tests define the contract
and grade you one milestone at a time.

## Why this lab
Every concept in Phases 0–3 shows up here for real: streams (reading the body),
routing, status codes, validation at the edge, a central error boundary, and
idempotency for safe retries. When it's green you've built a production-shaped
API skeleton — the seed of Capstone 1.

## Milestones (each gated by tests)

**M1 — Routing + CRUD.** `GET /health`, `POST /orders` (create, generate id,
201), `GET /orders/:id` (200 or 404), unknown route → 404.

**M2 — Validation + errors.** Reject bad input (`items` non-empty array; each
item needs a string `sku` and positive integer `qty`) with 400. Invalid JSON →
400, never 500. All errors are JSON `{ error }` — never leak a stack.

**M3 — Idempotency.** Honor an `idempotency-key` request header on `POST /orders`
so a client retry with the same key returns the SAME order instead of creating a
duplicate. This is how you make POST safe to retry.

## Work loop
```bash
academy lab lab-orders-api             # shows your current milestone + runs its tests
# edit labs/lab-orders-api/src/app.ts
academy lab lab-orders-api             # re-run until the milestone passes, then the next
academy lab lab-orders-api --solution  # reveal the reference if you're stuck
```

## Stretch goals (make it senior)
- Cursor pagination for `GET /orders`.
- Optimistic concurrency: a `version` field, reject stale updates with 409.
- Swap the in-memory `store` for Postgres (Phase 2) behind the same interface —
  notice the handler code barely changes. That's the repository pattern paying off.
- Add structured request logging with a correlation id.
