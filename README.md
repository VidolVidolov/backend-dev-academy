# Backend Dev Academy

A zero-dependency Node.js CLI that trains a **senior frontend developer** into a
**senior backend / Node.js engineer** — and is itself written in Node so you
learn by reading and extending its own source.

It skips JavaScript basics entirely and goes straight at what backend seniority
actually requires: the event loop, HTTP, the data layer, auth, testing,
observability, architecture, scaling, DevOps, and system design.

> **New here? Read [START_HERE.md](START_HERE.md)** for the exact step-by-step of how to go through the course.

## How to go through the course

The app always tells you what to do next — you never have to plan. The loop:

1. **`academy`** — see your dashboard and what's next.
2. **`academy learn`** — opens your current lesson, then offers its quiz. **Lessons
   are locked sequentially**: the next one opens only when the current one is
   read, its quiz passed (70%), and its coding challenge (if any) beaten.
   Questions at any point? **`academy ask <lessonId>`** starts an AI tutor chat
   grounded in that lesson (runs on your Claude Code CLI).
3. If the lesson has a **coding challenge**, it's **mandatory** — it gates the next lesson: `academy challenge <id>` (edit the `solution.ts` it names, re-run until green; `academy solve <id>` after a real attempt).
4. Work the hands-on tracks constantly:
   - **Build labs** (`academy labs`) — real projects graded milestone-by-milestone: an Orders API, auth from scratch, a job queue, resilience patterns.
   - **Decision scenarios** (`academy decisions`) — 16 real problems; make the call, then compare with the senior analysis.
   - **System designs** (`academy designs`) — 5 interview prompts; whiteboard 45 min, then `--reveal` the model answer.
5. From Phase 1 on, build the **capstone projects** in parallel (`academy plan` shows them).
6. Check in anytime with **`academy progress`**.

That's it — do steps 2–4 daily. It auto-saves your progress and tracks a streak.

## Install

No dependencies to install. You need Node ≥ 23.6 (runs TypeScript directly, no build step).

```bash
cd backend-dev-academy

# Option A: run directly
node bin/academy.ts

# Option B: install the `academy` command globally
npm link          # then just run:  academy
```

## Daily loop

```bash
academy            # dashboard: progress + the ONE next step (across everything)
academy map        # the whole journey in order — where you are, what's next
academy learn      # open the next unread lesson (with an optional quiz)
academy review     # drill the quiz questions you previously missed
academy plan       # your tailored 6-month roadmap + capstone projects
```

## All commands

| Command | What it does |
|---|---|
| `academy` | Dashboard: overall progress, phase status, the ONE next step |
| `academy map` | The whole journey in order — lessons, labs, decisions, designs, graduation |
| `academy learn` | Open the next unread lesson (interactive; offers its quiz) |
| `academy lesson <id>` | Read a specific lesson, e.g. `academy lesson p2.l1` |
| `academy quiz <id>` | Take a lesson's quiz (70% to pass; gates the next lesson) |
| `academy review` | Drill previously-missed quiz questions until they stick |
| `academy ask [id] [question]` | AI tutor chat — grounded in a lesson when you pass its id |
| `academy challenge <id>` | Run an auto-graded coding challenge (`--watch`: re-grade on save) |
| `academy challenges` | List all coding challenges |
| `academy hint <id>` | Progressive hints: concept → approach → the tricky detail |
| `academy solve <id>` | Reveal the reference solution (last resort — hints first) |
| `academy lab <id>` | Guided build project, graded milestone-by-milestone |
| `academy labs` | List the guided build labs |
| `academy decide <id>` | Work a real architecture-decision scenario |
| `academy decisions` | List the decision scenarios |
| `academy graduate [url]` | Grade the 🎓 Graduation Project (real Postgres/Redis/Kafka) against localhost or a deployed URL (`--contract` prints the HTTP contract) |
| `academy list` | The full curriculum tree |
| `academy progress` | Detailed progress breakdown |
| `academy plan` | 6-month roadmap + capstone projects |
| `academy help` | Help |

## The curriculum (7 phases, ~24 weeks)

0. **Runtime Foundations & the Backend Mindset** — event loop/libuv, streams & backpressure, modules, process/signals
1. **HTTP & Building Servers** — HTTP protocol, a server with no framework, Express & Fastify, senior REST design
2. **The Data Layer** — Postgres, transactions & isolation, indexes, ORMs & migrations, Redis/NoSQL
3. **Production API Engineering** — auth (argon2/JWT/OAuth), validation & errors, caching/rate-limiting, queues & real-time
4. **Testing, Observability & Security** — the testing pyramid + Testcontainers, logs/metrics/traces, OWASP & supply chain
5. **Architecture & Scaling** — hexagonal architecture, monolith vs microservices, scaling data, statelessness & idempotency
6. **DevOps, Deployment & System Design** — Docker, CI/CD & cloud, the system-design interview framework

Plus **4 capstone projects** that become your portfolio (see `academy plan`),
and the **🎓 Graduation Project**: a production-grade order platform on real
Postgres, Redis, and Kafka (Docker infra provided), graded black-box over HTTP
by `academy graduate` — including against your deployed production URL. Spec:
[graduation/GRADUATION.md](graduation/GRADUATION.md).

## Coding challenges

Each challenge is a real exercise graded by Node's built-in test runner:

```bash
academy challenge ch-router          # edit challenges/ch-router/solution.ts, re-run
academy challenge ch-router --watch  # auto re-grade on every save
academy hint ch-router               # stuck? escalating hints (least spoiler first)
academy solve ch-router              # last resort: the reference solution
npm test                             # run every challenge's tests at once
```

Challenges: `ch-event-loop`, `ch-graceful-shutdown`, `ch-router`, `ch-sql-safe`,
`ch-transactions`, `ch-auth-owns`, `ch-log-context`, `ch-rate-limiter`,
`ch-idempotency`, `ch-env-config`, `ch-health-agg`.

Every suite has 10+ tests designed to resist false positives (randomized
inputs, both-direction assertions, effect-based checks). The grader parses the
runner's TAP counts — all expected tests must run AND pass, so `process.exit()`
tricks and cut-short suites are caught — and `test-checksums.json` pins every
test file's hash, so a weakened suite fails loudly instead of quietly passing.

## Learn from the source

This app has **no dependencies on purpose**. `src/ui.ts` is a tiny chalk +
markdown renderer; `src/cli.ts` is a hand-rolled router; `src/store.ts` is a
crude repository (with a race condition you'll learn to fix in Phase 2). Reading
it is part of the course.

## Progress

Stored in `.academy-progress.json` in this folder. Delete it to start over.

## License

MIT
