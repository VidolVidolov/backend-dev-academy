// Phase 6 — Ship it: DevOps, deployment, and system design interviews.
// New-joiner depth: what each tool IS, why it exists, then how to use it well.

import type { Phase } from '../types.ts';

export default {
  id: 'p6',
  title: 'DevOps, Deployment & System Design',
  weeks: 3,
  goal: 'Containerize, ship through CI/CD, run in the cloud, and reason about whole systems on a whiteboard the way a senior/staff engineer does.',
  modules: [
    {
      id: 'p6.m1',
      title: 'Deploying like a professional',
      lessons: [
        {
          id: 'p6.l1',
          title: 'Docker & containers for Node',
          minutes: 70,
          body: `# Docker & containers for Node

You've been *using* Docker all course — Postgres, Redis, Kafka appeared with
one command each. Time to understand what it is and package your OWN app the
same way, because containers are, simply, how backend ships now.

## The problem containers solve

The oldest pain in deployment: "works on my machine." Your laptop has Node
24, some system libraries, certain env vars; the server has Node 18 and
different everything. Deploys fail in ways local dev never showed.

A **container** ends the argument by shipping the machine-in-miniature: your
app *plus its entire userland* — exact Node version, OS libraries, files —
as one immutable, runnable artifact. If it runs in the container on your
laptop, it runs in the container on the server, because it IS the same
environment. (How it differs from a VM: a VM emulates hardware and boots a
whole OS — gigabytes, minutes; a container is just ordinary processes that
the Linux kernel *isolates* — namespaces for "what can it see", cgroups for
"what may it use". Megabytes, milliseconds. That cheapness is why "one
process per container" works as a rule.)

Two words precisely: an **image** is the frozen artifact (recipe result,
shareable, versioned); a **container** is a running instance of it. Class
and instance.

## The Dockerfile: your image, as code

A Dockerfile is the build script for an image. Here is the production-grade
one for a Node service — read it line by line, because each line encodes a
lesson:

\`\`\`dockerfile
# ---------- build stage ----------
FROM node:24-slim AS build          # start FROM an image with Node installed
WORKDIR /app
COPY package*.json ./               # copy manifests FIRST (cache trick, below)
RUN npm ci                          # exact lockfile install (p0.l4)
COPY . .                            # now the source
RUN npm run build                   # tsc, bundling — whatever "build" means

# ---------- runtime stage ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev               # runtime deps ONLY — no tsc, no test libs
COPY --from=build /app/dist ./dist  # take just the built output from stage 1
USER node                           # ← run as non-root (p4.l3 least privilege)
EXPOSE 3000
CMD ["node", "dist/server.js"]
\`\`\`

The ideas hiding in there:

**Layer caching.** Each instruction creates a cached layer, reused if its
inputs didn't change. That's why manifests are copied *before* source: your
code changes constantly, your dependencies rarely — this ordering means
\`npm ci\` re-runs only when the lockfile changes, turning ten-minute builds
into ten-second ones. Rule: order instructions least- to most-frequently
changing.

**Multi-stage.** The build stage has dev dependencies and source; the
runtime stage copies only the built artifact and prod deps. Result: an image
half the size with a fraction of the attack surface — your shipped container
simply doesn't *contain* the build tools an attacker could abuse.

**Non-root + slim base.** \`USER node\` means a compromised app isn't root in
the container (p4.l3, applied). Slim images mean fewer preinstalled
binaries to exploit and faster pulls. Complete the hygiene with a
\`.dockerignore\` (\`node_modules\`, \`.git\`, \`.env\` — yes, people have shipped
secrets inside images) and a scanner (Trivy) in CI.

**One more connection:** \`CMD ["node", ...]\` — *not* \`npm start\` — matters
because npm doesn't forward signals: your SIGTERM graceful shutdown (p0.l4,
ch-graceful-shutdown) never fires if npm swallows the signal. Node must be
PID 1 (or use an init shim). Yes: a Dockerfile detail can break a Phase 0
lesson. Everything connects.

Build and run:

\`\`\`bash
docker build -t my-api .
docker run -p 3000:3000 --env-file .env my-api
\`\`\`

## docker compose: your whole stack as one file

You've *used* the graduation compose file; now read one knowing what it says:

\`\`\`yaml
services:
  api:
    build: .                        # build MY Dockerfile
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://academy:academy@postgres:5432/graduation
    depends_on:
      postgres: { condition: service_healthy }   # wait for the healthcheck
  postgres:
    image: postgres:16-alpine
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U academy"] }
\`\`\`

The detail that teaches the most: the DB host is \`postgres\` — **the service
name**. Compose puts services on a private network with DNS: containers
reach each other by name, not localhost/IPs. And \`depends_on\` +
healthcheck answers "my app boots before the DB is ready and crashes" — the
first compose bug everyone hits. (Even so, production-grade apps *also*
retry their DB connection on boot: orchestrators start things in any order;
your readiness probe — p4.l2 — covers the gap.)

\`docker compose up\` = your entire stack — API, DB, Redis, Kafka — on any
machine, one command. New-teammate onboarding goes from a wiki page of
installs to one command. That's the pitch, delivered.

> **Try it now (45 min):** write the Dockerfile above for YOUR graduation
> app, add an \`api\` service to the graduation compose file, and get
> \`academy graduate\` passing against the *containerized* app. Then
> \`docker images\` and compare your multi-stage image size to a naive
> single-stage build — the difference is the lesson, in megabytes.`,
          quiz: [
            {
              q: 'The point of a multi-stage Docker build is…',
              choices: ['to run tests', 'to keep build tools/dev deps out of a small final runtime image', 'to support multiple languages', 'to enable caching only'],
              answer: 1,
              explain: 'You build in one stage and copy only artifacts into a lean runtime stage.',
            },
            {
              q: 'Why order Dockerfile steps least- to most-frequently-changing?',
              choices: ['readability', 'to maximize layer cache reuse (deps install stays cached until the lockfile changes)', 'security', 'it is required syntax'],
              answer: 1,
              explain: 'Copying package*.json + npm ci before source means code changes do not bust the deps layer.',
            },
            {
              q: 'A production container should run the app as…',
              choices: ['root', 'a non-root user (USER node)', 'sudo', 'any user with write to /'],
              answer: 1,
              explain: 'Least privilege limits the blast radius of a container compromise.',
            },
          ],
          challenge: 'ch-env-config',
        },
        {
          id: 'p6.l2',
          title: 'CI/CD, cloud & orchestration',
          minutes: 70,
          body: `# CI/CD, cloud & orchestration

You have a containerized service. Now: how does code travel from \`git push\`
to serving production traffic — safely, repeatably, boringly? "Boring" is
the goal: elite teams deploy many times a day precisely because each deploy
is a non-event. This lesson builds that pipeline in your head.

## CI: the robot that guards main

**Continuous Integration** = every push runs your checks automatically. In
GitHub Actions, a workflow file in the repo:

\`\`\`yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:                      # a REAL Postgres next to the test job
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci                  # lockfile-exact (p0.l4, p4.l3)
      - run: npm run lint
      - run: npm test                # incl. integration tests vs that Postgres
      - run: npm audit --audit-level=high
\`\`\`

Note the \`services\` block: your p4.l1 conviction — test against real
dependencies — extends into CI. Merges are gated on green. That's the whole
contract: **main is always shippable.**

## CD: from green build to running production

**Continuous Delivery/Deployment** extends the pipeline: build the Docker
image, tag it with the git SHA (immutable, traceable), push to a registry,
then roll it out. The rollout *strategy* is where reliability lives:

- **Rolling** (the default): replace instances a few at a time; old and new
  versions overlap for minutes. ← This overlap is exactly why migrations
  must be backward-compatible (p2.l3's expand/contract — now you see where
  that requirement physically comes from).
- **Blue/green**: build a full new fleet alongside the old, flip traffic
  at the LB, keep the old fleet warm for instant flip-back. Costs double
  capacity briefly; buys the fastest rollback in the business.
- **Canary**: route 1% → 5% → 25% → 100% to the new version, watching your
  p4.l2 metrics between steps; auto-abort on error-rate/latency regression.
  The most protective, the most tooling-hungry.

Universal deploy hygiene, whatever the strategy: **migrations run before
the new code starts** (a deploy step, not an app-boot side effect — ten
instances booting must not race ten migration runs); rollback is **one
command** (previous image tag is right there — and d16 taught you: roll
back first, diagnose after); health gates decide completion (an instance
joins the LB only when \`/ready\` passes — p4.l2 again).

## The cloud, mapped to what you already know

The cloud is other people's datacenters with an API. The menu looks
enormous; it maps to concepts you now own:

- **Compute**: VMs (EC2) — raw machines, you manage everything. **Managed
  containers** (Cloud Run, Fargate, Fly.io, Railway, Render) — "here's my
  image, run N copies behind an LB" — *start here*; it's exactly your
  mental model with the ops outsourced. **Serverless functions** (Lambda) —
  per-request execution, scales to zero; mind cold starts and DB connection
  storms (a pool per function instance × 1000 instances = Postgres
  meltdown — use a proxy like RDS Proxy/PgBouncer; d14 explores when
  serverless fits).
- **Data**: managed Postgres (RDS/Neon/Supabase), managed Redis, S3 for
  objects (p3.l3), managed Kafka (MSK/Upstash). Managed = backups, patches,
  failover included. **Default to managed for stateful things** — the 3am
  pages you never get are worth the markup; your ops attention belongs on
  your own service.
- **Network**: VPC (your private network), security groups (firewalls), the
  LB, DNS, TLS certs (automated via Let's Encrypt/ACM — no excuse for
  http:// in production).

And the practice that keeps cloud setups sane: **Infrastructure as Code**
(Terraform et al.) — infra described in versioned, reviewable files, not
in 47 console clicks nobody remembers. The same argument as migrations
(p2.l3), one level up. Clicking around a console to create prod resources
is the infra equivalent of editing the DB by hand.

## Kubernetes: the 20% that gives you 80%

You may not run k8s at every job, but it's the industry's shared vocabulary
for orchestration, so decode it once: a **Pod** ≈ your container running; a
**Deployment** declares "keep N replicas of image X alive" (rolling updates
included); a **Service** gives pods one stable internal address (DNS, like
compose service names — same idea, bigger); an **Ingress** routes external
HTTP in; **HPA** autoscales replicas on load. The deep idea — worth keeping
even if you never touch kubectl — is **reconciliation**: you declare
desired state, controllers relentlessly converge reality toward it. A pod
dies → not an incident, just a gap between desired and actual, closed
automatically. Notice every prerequisite it assumes is a lesson you've
done: statelessness (p5.l4), SIGTERM handling (p0.l4), readiness probes
(p4.l2), backward-compatible migrations (p2.l3). Kubernetes is those
assumptions, industrialized.

> **Try it now (45 min):** add the CI workflow above to your capstone repo
> and make it green. Then deploy the container to Fly.io or Render (both
> nearly free for toys), point \`academy graduate <url>\` at it, and watch
> your graduation stages pass against REAL production infrastructure. That
> moment is the course's thesis, demonstrated.`,
          quiz: [
            {
              q: 'Canary deployment means…',
              choices: ['deploy to everyone at once', 'route a small % of traffic to the new version and watch metrics before ramping', 'run tests in prod', 'deploy only at night'],
              answer: 1,
              explain: 'Limit blast radius by exposing a fraction of traffic and validating before full rollout.',
            },
            {
              q: 'DB migrations in CI/CD should run…',
              choices: ['after the new code, breaking-changes allowed', 'before the new code and be backward-compatible so old+new coexist during rollout', 'manually in production', 'never automated'],
              answer: 1,
              explain: 'During a rolling deploy both versions run; migrations must not break the old one.',
            },
            {
              q: 'Serverless (Lambda) + a relational DB requires special care around…',
              choices: ['CSS', 'connection pooling (each invocation wants a connection) and cold starts', 'HTML templating', 'CORS only'],
              answer: 1,
              explain: 'Many concurrent invocations exhaust DB connections; use a proxy/PgBouncer and mind cold starts.',
            },
          ],
          challenge: 'ch-health-agg',
        },
      ],
    },
    {
      id: 'p6.m2',
      title: 'System design',
      lessons: [
        {
          id: 'p6.l3',
          title: 'System design interviews & whole-system thinking',
          minutes: 80,
          body: `# System design interviews & whole-system thinking

"Design Twitter." Forty-five minutes, a whiteboard, an interviewer watching
how you think. This is the senior interview — and here's the reframe that
makes it winnable: **it's not a test of knowing exotic things. It's a test
of assembling the things you now know, out loud, with justified
tradeoffs.** Load balancers, stateless tiers, Postgres + replicas, Redis,
queues + outbox, idempotency, consistency choices — you've *built* these.
What's left is a repeatable assembly procedure. Here it is, with a worked
example.

## The 7-step frame (never skip 1 and 2)

**1. Requirements (5 min).** Resist drawing. Ask: core features (and
explicitly park the rest: "I'll skip DMs for scope")? Scale — users, QPS,
read:write ratio? Latency targets? Consistency needs — which paths can be
eventually consistent (p5.l3)? Interviewers *deliberately* leave the prompt
vague to see whether you charge in or scope like an engineer.

**2. Estimates (3 min).** Not precision — order of magnitude, because the
NUMBER picks the ARCHITECTURE: 100 QPS needs one Postgres and no cleverness;
100k QPS needs the full toolkit. 10M DAU × 10 reads/day ≈ 100M/day ≈
**~1,200 QPS average, plan ~4k peak**; writes at 1:100 ≈ 40/s. Numbers like
these end debates: "at 40 writes/s, one primary is plenty — no sharding
today."

**3. API (3 min).** A few REST endpoints, p1.l4 style — including
pagination shape and idempotency keys on the money paths. Signals fluency
fast.

**4. Data model (5 min).** Tables, keys, relationships, indexes for the hot
queries; store choice *with reason* ("relational integrity for orders →
Postgres; feed cache → Redis"). This is p2 compressed to a whiteboard
sketch.

**5. High-level boxes (10 min).** Draw the p5.l4 backbone — LB → stateless
API tier → cache / DB(+replicas) → queue → workers — and *narrate a request
through it*. Narration proves the diagram is a system in your head, not a
memorized shape.

**6. Deep-dive the hard part (10 min).** Every classic prompt hides one
gnarly subproblem — usually the interviewer nudges you there. Naming it
yourself ("the interesting problem here is the celebrity fan-out — let's
dig") is a strong senior signal.

**7. Failure & bottlenecks (5 min).** Walk your own diagram asking p0.l1's
question: what breaks first at 10x? What happens when the cache dies, a
replica lags, a worker double-processes? Name the mitigation for each
(you have them all: stampede protection, read-your-writes routing,
idempotent consumers).

## Worked example, compressed: "design a notification system"

Apps send users notifications (push/email/in-app); users have preferences;
scale is 10M/day. Watch the frame run:

**Requirements:** senders are internal services; delivery ≤ ~1 min is fine
(not real-time!); preferences must be respected; duplicates unacceptable.
**Estimates:** 10M/day ≈ 115/s average, but bursty (a campaign = 1M at
once) → *the design must absorb spikes* — that sentence just chose the
architecture. **API:** \`POST /notifications\` (with \`Idempotency-Key\`),
\`GET /users/:id/preferences\`. **Data:** \`notifications\` (id, user_id, type,
status, created_at — index on \`(user_id, created_at)\`), \`preferences\`,
\`delivery_attempts\`. Postgres — relational, transactional, boring, correct.

**The backbone, and why it's a queue system:** the burst requirement kills
synchronous delivery (1M requests can't each wait on an email API — p3.l4's
exact lesson). So: API validates, checks preferences, **persists + enqueues
via outbox** (dual-write problem — p3.l4), returns 202. Workers consume,
call the push/email providers with **timeouts, retries+backoff, circuit
breakers per provider** (p3.l3 / lab-resilience), and **dedupe by
notification id** because the queue is at-least-once and "duplicates
unacceptable" was a requirement (p5.l4). DLQ for poison messages
(lab-job-queue m2 — you've built this exact machine).

**Deep dive picks itself:** the burst. Queue absorbs the spike; workers
autoscale on queue depth (p4.l2 metrics driving p6.l2 autoscaling);
per-provider rate limits respected with token buckets (p3.l3). **Failure
walk:** provider down → breaker opens, retries later, queue buffers;
worker crashes mid-send → redelivery + dedupe = no double push; Postgres
primary fails → managed failover (p6.l2), queue keeps absorbing meanwhile.

Every clause traced to a lesson you've done. That's the demonstration: you
already own the parts. The frame just orders them.

## Practicing (protocol, not vibes)

The academy ships five classics as \`academy design sd1…sd5\` — URL
shortener, rate limiter, news feed, chat, payments — each with clarifying
questions and a model answer. The protocol printed there is the one that
works: **45 minutes, out loud, full frame, THEN reveal and diff.** Out loud
is non-negotiable — the interview skill is *narrated* reasoning, and it
feels embarrassing precisely until it doesn't. Redo each design cold three
days later; the redo is where it sticks.

Tradeoff sentences beat conclusions everywhere: not "I'll use Kafka" but
"queue depth spikes to a million during campaigns, so a log-based queue
fits; if bursts were small I'd stay with BullMQ on the Redis we already
run" (d9!). The interviewer is grading the *because*, not the noun.

> **Do now:** \`academy design sd1\`. Timer, whiteboard, out loud, all seven
> steps, then reveal. You've built every component this course could give
> you — this lesson is where they become one skill. Finish the designs,
> finish the graduation project, and go get the title. 🎓`,
          quiz: [
            {
              q: 'The first thing to do in a system design problem is…',
              choices: ['draw the database', 'clarify functional + non-functional requirements (scale, latency, consistency) and estimate load', 'pick a cloud provider', 'choose microservices'],
              answer: 1,
              explain: 'Requirements and rough numbers drive every later decision; designing before them is guessing.',
            },
            {
              q: 'What most distinguishes a senior system-design answer?',
              choices: ['using the newest tech', 'explicitly stating assumptions and defending tradeoffs (e.g. eventual vs strong consistency per path)', 'the most services', 'memorized diagrams'],
              answer: 1,
              explain: 'Judgment and articulated tradeoffs matter far more than component count or novelty.',
            },
            {
              q: 'Back-of-envelope estimation exists to…',
              choices: ['fill time', 'ground design decisions in expected scale (QPS, storage, bandwidth) instead of guesses', 'test math skills', 'choose a language'],
              answer: 1,
              explain: 'Rough numbers tell you whether you need a cache, replicas, or sharding at all.',
            },
          ],
        },
      ],
    },
  ],
} satisfies Phase;
