// System design practice — the senior interview (and senior job) skill.
// Workflow: `academy design sd1` shows the prompt + the framework checklist.
// Whiteboard it for 45 minutes OUT LOUD, then `academy design sd1 --reveal`
// to diff your reasoning against the model answer.

import type { Design } from './types.ts';

export const designs: Design[] = [
  {
    id: 'sd1',
    title: 'Design a URL shortener',
    prompt:
      'Design a service like bit.ly: given a long URL return a short one; visiting the short URL redirects to the original. Assume 100M new URLs/month and a 100:1 read:write ratio. Support custom aliases and click counts.',
    clarify: [
      'Length/charset of short codes? Collisions acceptable?',
      'Are analytics real-time or eventually consistent?',
      'TTL/expiry on links? Can links be deleted or edited?',
      'Latency target for the redirect (this IS the product)?',
    ],
    answer: `# Model answer — URL shortener

## Estimates
100M writes/month ≈ 40 writes/s; 100:1 reads → ~4k redirects/s (peaks 10x).
Each record ~500B → 100M/mo ≈ 600GB over 5 years. Small data, read-heavy: this
problem is about **redirect latency + availability**, not storage.

## API
- POST /urls {longUrl, customAlias?} -> 201 {code, shortUrl}
- GET /:code -> 301/302 redirect  (302 if you want every hit for analytics; 301 lets browsers cache and drops your hit-count)
- GET /urls/:code/stats -> {clicks}

## Code generation (the interesting bit)
- Base62 over a monotonic id: 7 chars covers 3.5 trillion — plenty.
- Getting ids at scale: a ticket/segment server (each app instance leases a
  range of ids, e.g. 100k at a time) — no per-write coordination, no collisions.
- Custom alias: unique-constraint insert; 409 on conflict.
- Avoid hashing the URL alone (collisions, and same URL/different owner breaks).

## Storage & path
- Postgres (code -> longUrl, owner, createdAt) is fine at this size; DynamoDB
  also natural (key-value by code). The redirect path goes:
  **CDN/edge cache → Redis (hot codes) → DB**. Hit rate on hot links is huge —
  most redirects never touch the DB.
- Redirect handler must be tiny: lookup, 302, enqueue analytics event — never
  synchronous analytics writes on the hot path.

## Analytics
Fire-and-forget event to a queue/stream (Kafka/Kinesis/simple Redis stream);
aggregate clicks asynchronously (per-minute rollups). Counting exactly, in the
redirect transaction, would put your write load at read scale — don't.

## Failure & scale notes
- Stateless app tier behind LB; Redis cache-aside with TTL; read replicas if needed.
- The 301-vs-302 tradeoff is a classic senior flex: 301 = less traffic, lost analytics.
- Rate-limit creation; validate/deny-list target URLs (open-redirect/abuse).`,
  },
  {
    id: 'sd2',
    title: 'Design a distributed rate limiter',
    prompt:
      'Design a rate-limiting service for a public API platform: e.g. 100 requests/min per API key, enforced across ~50 API-gateway instances, adding <2ms latency. Discuss algorithm choice, distributed state, and failure behavior.',
    clarify: [
      'Hard limit or burst-tolerant? What response on limit (429 + Retry-After)?',
      'Per-key only, or layered (key, IP, endpoint, tenant)?',
      'How exact must enforcement be — is small over-admission acceptable?',
      'What happens if the limiter itself is down (fail-open vs fail-closed)?',
    ],
    answer: `# Model answer — distributed rate limiter

## Algorithm
- **Fixed window**: trivial, but 2x bursts at window edges.
- **Sliding window log**: exact, memory-heavy (timestamp per request).
- **Sliding window counter**: good approximation, cheap.
- **Token bucket** ← usual pick: allows controlled bursts (capacity) with a
  steady refill rate; O(1) state per key (tokens, lastRefill).

## Distributed state
50 gateways can't keep local counters (a client could get 50x the limit by
spraying instances). Centralize in **Redis**:
- Key per {apiKey}: token count + last-refill timestamp.
- The check-and-decrement must be **atomic** → a small **Lua script** (read,
  refill by elapsed time, decrement or reject) — one round-trip, no races.
- Latency: Redis in the same AZ ≈ sub-ms. Shard by key hash if one node maxes out.

## The senior tradeoff: exactness vs latency
For <2ms you can also run a **local token bucket per gateway that syncs to
Redis asynchronously** — tiny over-admission during bursts, near-zero added
latency. Say explicitly: "I'd accept ~1-5% over-admission to keep the hot path
local" or "billing enforcement must be exact → synchronous Redis". The knob is
the requirement, not the tech.

## API behavior
- 429 + Retry-After + X-RateLimit-Remaining/Reset headers.
- Layered limits evaluated cheapest-first.

## Failure mode (they will ask)
Redis down → **fail-open with local fallback limits** for availability (typical
for API platforms), fail-closed only where over-use is dangerous (auth attempts,
payments). Alert loudly either way. Cap Lua script complexity; set maxmemory +
TTLs so dead keys expire.`,
  },
  {
    id: 'sd3',
    title: 'Design a news feed',
    prompt:
      'Design the feed for a social app: users follow others; the feed shows recent posts from followed accounts, newest-ish first. 10M DAU, average 200 follows, a few posts/day per active user — but some accounts have 20M followers. Feed load must feel instant.',
    clarify: [
      'Chronological or ranked? How fresh must a new post be in followers\' feeds?',
      'Read:write ratio? (Feeds are extremely read-heavy.)',
      'Celebrity problem confirmed? Max followers?',
      'Media in posts (changes storage, not feed logic)?',
    ],
    answer: `# Model answer — news feed

## The core decision: fan-out on write vs fan-out on read
- **Fan-out on write (push)**: when someone posts, insert the post id into each
  follower's precomputed feed (Redis list per user). Reads are O(1) — instant
  feed. But a 20M-follower post = 20M writes.
- **Fan-out on read (pull)**: store posts once; on feed load, query recent posts
  from all 200 followees and merge. Cheap writes, expensive reads — too slow at
  10M DAU read volume.
- **Hybrid (the answer)**: push for normal users; for "celebrity" accounts
  (follower count over a threshold) DON'T fan out — at read time, merge the
  user's precomputed feed with a pull of the few celebrities they follow.

## Architecture
- Post service → Kafka "post.created" → fan-out workers → Redis feed lists
  (capped, e.g. 800 ids per user; older = fall through to pull/DB).
- Feed API: read Redis list → hydrate post content (cache post objects too) →
  merge celebrity pulls → return page. Cursor pagination by (timestamp, id).
- Posts in Postgres/Cassandra (write-heavy, partition by author).

## Estimates worth saying
10M DAU × ~5 feed loads/day ≈ 600 reads/s sustained, spiky. Fan-out writes:
1M posts/day × 200 followers = 200M list-inserts/day ≈ 2.3k/s — fine for
sharded Redis; the 20M-follower case is exactly why the hybrid exists.

## Extras that score senior points
- New-post latency SLO drives fan-out worker scaling.
- Feed list is a CACHE — rebuildable from the social graph + posts (Redis loss ≠ data loss).
- Ranking later = replace "recent ids" with a scored merge; architecture holds.
- Deletes/blocks: tombstone check at hydration, not synchronous list-scrubbing 20M feeds.`,
  },
  {
    id: 'sd4',
    title: 'Design a chat system',
    prompt:
      'Design 1:1 and small-group chat (WhatsApp-like, web+mobile): real-time delivery, message history, delivery/read receipts, presence, offline users catching up. 5M concurrent connections at peak.',
    clarify: [
      'Delivery guarantees — is at-least-once + client dedupe acceptable?',
      'Ordering: per-conversation strict, or best-effort?',
      'History retention? E2E encryption in scope or not?',
      'Group size cap (changes fan-out shape)?',
    ],
    answer: `# Model answer — chat system

## Connections
- WebSockets (bidirectional, real chat needs it). 5M concurrent → a fleet of
  connection/gateway servers (~50-100k conns each), LB with least-connections.
- A **session registry** (Redis): userId → which gateway holds their socket.
- Gateways are dumb pipes: auth the socket, forward frames; logic lives behind them.

## Message flow (the heart)
1. Client sends message with a **client-generated id** (dedupe key) over WS.
2. Chat service **persists first** (Cassandra/Scylla: partition by conversation,
   cluster by (timestamp, messageId) — history reads = one partition scan), THEN
   acks to sender (sent ✓).
3. Look up recipients' gateways in the registry; push via those gateways
   (cross-gateway via pub/sub, e.g. Redis/Kafka per-gateway channel).
4. Recipient client acks → delivered ✓✓; read receipts are just another small
   event on the same pipe.
5. Offline user? No registry entry → message sits in storage; on reconnect the
   client sends its last-seen cursor per conversation and pulls the gap. Push
   notification via APNs/FCM for the wake-up.

## Guarantees (say these explicitly)
- **At-least-once + client dedupe** by message id (exactly-once is a myth; own it).
- **Per-conversation ordering** via the partition's clustering key; global
  ordering not promised.
- Persist-then-fan-out means a gateway crash loses no messages — reconnect + cursor recovers.

## Presence
Heartbeats over the socket → presence service with TTL'd entries; "last seen"
on TTL expiry. Broadcast presence lazily (on conversation open), not globally.

## Groups
Small groups = fan-out to N registry lookups. Big groups/channels shift toward
pull (subscribe to the conversation partition) — same celebrity logic as feeds (sd3).`,
  },
  {
    id: 'sd5',
    title: 'Design an idempotent payment system',
    prompt:
      'Design the payments core of a commerce platform: charge cards via a PSP (Stripe-like), never double-charge, survive crashes mid-payment, keep your DB and the PSP consistent, and produce an auditable history. Discuss retries, reconciliation, and exactly what happens when the process dies between "PSP charged" and "DB committed".',
    clarify: [
      'One PSP or several? Refunds/partial captures in scope?',
      'Sync response to the buyer, or async ("processing") acceptable?',
      'Volume (drives partitioning, not the core design)?',
      'Regulatory/audit constraints (immutability, retention)?',
    ],
    answer: `# Model answer — idempotent payments

## The hard truth to state up front
Your DB and the PSP are two systems without a shared transaction. The design
is entirely about **making every step retryable + reconciling the gap**.

## The state machine (persist it!)
payment: CREATED → PENDING_PSP → SUCCEEDED | FAILED (+ REQUIRES_ACTION for 3DS).
Every transition is a DB write. The row is created BEFORE calling the PSP.

## The flow
1. POST /payments with a client **Idempotency-Key**. Insert payment row
   (unique constraint on the key) state=CREATED. A retry that hits this insert
   conflict returns the existing payment — never a second charge.
2. Call PSP **passing our payment id as the PSP idempotency key** (Stripe
   supports this — it makes the PSP call itself retryable safely).
3. On PSP response: update state, append to an **immutable ledger table**
   (append-only, no updates — that's the audit trail), emit "payment.succeeded"
   via **transactional outbox** (event written in the same DB txn as the state).

## THE interview moment: crash between PSP-charged and DB-commit
Our row is stuck in PENDING_PSP. Recovery, two layers:
- A **reconciler** sweeps stale PENDING_PSP rows and queries the PSP *with our
  idempotency key/payment id*: "did this charge happen?" → finalize the row
  accordingly. Because step 2 used an idempotency key, even re-calling "charge"
  cannot double-charge.
- **PSP webhooks** (charge.succeeded) arrive independently → same finalize
  path, idempotent by event id (store processed webhook ids).
Say it plainly: "the answer to every 'what if it dies HERE' is: state machine
row + idempotent PSP call + reconciler/webhook convergence."

## Everything else that scores
- Never store PANs — PSP tokens only (SCOPE of PCI).
- Amounts in integer minor units + currency (never floats).
- Refunds = new state machine referencing the charge, same idempotency discipline.
- Daily reconciliation report: our SUCCEEDED sum vs PSP payout report — catches
  drift the real world will eventually produce.
- Retries with backoff ONLY on network/5xx (a declined card is not retryable).`,
  },
];
