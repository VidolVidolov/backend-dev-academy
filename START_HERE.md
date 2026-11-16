# START HERE — The Complete Walkthrough 👋

This is the **canonical instruction manual** for the academy. If you only read
one document, read this one. It tells you exactly what to do, in what order,
every single day, from day 1 to job-ready.

**What you're working through:** 7 phases · 26 lessons (each with a quiz) ·
6 coding challenges · 4 build labs (12 test-gated milestones) · 16 architecture
decision scenarios · 5 system-design prompts · 4 capstone projects.

**What you need:** Node ≥ 20 (`node --version`) and a terminal. Nothing else —
the academy has zero dependencies.

---

## Part 1 — One-time setup (2 minutes)

**Step 1.** Open a terminal in the academy folder:

```bash
cd /Users/home/Desktop/dev/backend-dev-academy
```

**Step 2 (optional but recommended).** Make the `academy` command global:

```bash
npm link
```

If you skip this, replace `academy` with `node bin/academy.ts` everywhere below.

**Step 3.** Confirm it works:

```bash
academy
```

You should see the dashboard with six progress bars (Lessons, Challenges,
Labs, Decisions, Designs, Phases) and a "Next up" pointer. That pointer is the
app telling you what to do — you never have to guess.

---

## Part 2 — The daily session recipe (~60–90 min)

Do this 5 days a week. Every step is a single command.

**1. Open the dashboard** — `academy`
   See where you are and what's next. (This also keeps your 🔥 streak alive.)

**2. Read the next lesson** — `academy learn`
   It opens the next unread lesson automatically. Read it properly and RUN the
   code in it — every lesson teaches from the ground up with runnable examples
   and ends with a "try it now" experiment. Budget 45–80 min per lesson
   including the experiments; the experiments are where it sticks.

**3. Take the quiz** — it's offered right after the lesson (press Enter to accept).
   Type the option number for each question. **70% passes.** Failed it? Reread
   the lesson and retake with `academy quiz <lessonId>` (e.g. `academy quiz p0.l2`).

   ⛔ **Lessons are sequential and locked.** The next lesson does not open until
   the current one is *complete*: **read + quiz passed + challenge passed** (when
   it has one). No skipping ahead — `academy learn` always takes you to your
   actual blocker.

**4. Do the lesson's challenge — it is mandatory.** Six lessons end with
   `› Coding challenge: academy challenge <id>`, and those challenges **gate the
   next lesson** just like the quiz. When you see one:
   - Run `academy challenge <id>` once — it prints the task and the failing tests.
   - Open the `solution.ts` file it names and implement it.
   - Re-run the same command until every test is ✔ green.
   - Genuinely stuck ≥30 min? `academy solve <id>` shows a reference — study it,
     close it, and rewrite it yourself from memory.

**5. Push your current lab one milestone** (see the phase tables below for
   which lab is "current"):
   - `academy lab <id>` — shows which milestone you're on (`← you are here`)
     and its failing tests.
   - Edit the file it names, re-run, repeat until the milestone flips ✔.
   - One milestone per session is a solid pace. `--solution` if truly stuck.

**5½. Confused at any point? Ask the AI tutor.** `academy ask <lessonId>` opens
   a chat grounded in that exact lesson (it knows the full text); add your
   question inline for a one-shot answer:
   ```bash
   academy ask p0.l2                          # interactive chat about the lesson
   academy ask p0.l2 "why does nextTick beat promises?"   # one-shot (quote it!)
   academy ask "when would I actually use a worker thread?" # general tutor
   ```
   It runs on your Claude Code CLI (no API key needed; `ANTHROPIC_API_KEY` works
   as a fallback). Use it after every failed quiz and whenever a lesson leaves a
   gap — asking early beats grinding confused.

**6. Finish with one decision scenario** — `academy decide <id>` (pick the next
   unchecked one for your phase from the tables below). **Commit to an answer
   before revealing** — the value is in being wrong out loud.

That's a session: **1 lesson + quiz (+ challenge) + 1 lab milestone + 1 decision.**
If short on time, never skip the hands-on half — skip the lesson instead.

---

## Part 3 — The full path, phase by phase

Work top to bottom inside each phase. Everything is a checkbox — print this or
check `academy progress` anytime. Weekends: capstone work (see `academy plan`).

### Phase 0 — Runtime Foundations (weeks 1–2)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: FE vs BE mindset + quiz | `academy lesson p0.l1` |
| 2 | Lesson: event loop & libuv + quiz | `academy lesson p0.l2` |
| 3 | **Challenge: don't block the loop** | `academy challenge ch-event-loop` |
| 4 | Lesson: streams & backpressure + quiz | `academy lesson p0.l3` |
| 5 | Lesson: ESM/CJS, process, signals + quiz | `academy lesson p0.l4` |
| 6 | **Challenge: graceful shutdown** | `academy challenge ch-graceful-shutdown` |
| 7 | Read this app's own source (it's part of the course) | open `src/` |

### Phase 1 — HTTP & Servers (weeks 3–5)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: HTTP protocol deep dive + quiz | `academy lesson p1.l1` |
| 2 | Lesson: a server with no framework + quiz | `academy lesson p1.l2` |
| 3 | **Challenge: build a router** | `academy challenge ch-router` |
| 4 | **LAB: Orders API — all 3 milestones** (routing → validation → idempotency) | `academy lab lab-orders-api` |
| 5 | Lesson: Express & Fastify + quiz | `academy lesson p1.l3` |
| 6 | Lesson: senior REST design + quiz | `academy lesson p1.l4` |
| 7 | Decision: breaking an API with mobile clients in the wild | `academy decide d11` |
| 8 | Weekend: start **Capstone 1** (Orders API for real, with a framework) | `academy plan` |

### Phase 2 — The Data Layer (weeks 6–9)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: SQL & schema design + quiz | `academy lesson p2.l1` |
| 2 | **Challenge: parameterized SQL** | `academy challenge ch-sql-safe` |
| 3 | Lesson: transactions, isolation, indexes + quiz | `academy lesson p2.l2` |
| 4 | Lesson: ORMs, pooling, migrations + quiz | `academy lesson p2.l3` |
| 5 | Lesson: Redis & NoSQL — when they earn it + quiz | `academy lesson p2.l4` |
| 6 | Decision: DB reads are spiking | `academy decide d1` |
| 7 | Decision: Postgres or MongoDB | `academy decide d5` |
| 8 | Decision: zero-downtime schema change | `academy decide d7` |
| 9 | Decision: multi-tenant isolation | `academy decide d12` |
| 10 | Decision: the 300-query N+1 page | `academy decide d15` |
| 11 | Weekend: wire Capstone 1 to real Postgres (Docker) | — |

### Phase 3 — Production API Engineering (weeks 10–13)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: auth — sessions, JWT, OAuth + quiz | `academy lesson p3.l1` |
| 2 | **Challenge: ownership + RBAC** | `academy challenge ch-auth-owns` |
| 3 | **LAB: Auth from scratch — all 3 milestones** (hashing → sessions → ownership) | `academy lab lab-auth` |
| 4 | Lesson: validation, errors, config, logging + quiz | `academy lesson p3.l2` |
| 5 | Lesson: caching, rate limiting, uploads + quiz | `academy lesson p3.l3` |
| 6 | Lesson: queues, jobs & real-time + quiz | `academy lesson p3.l4` |
| 7 | **LAB: Job queue — all 3 milestones** (concurrency → retries/DLQ → dedupe/close) | `academy lab lab-job-queue` |
| 8 | Decision: sessions vs JWT | `academy decide d2` |
| 9 | Decision: never double-charge | `academy decide d4` |
| 10 | Decision: one slow dependency | `academy decide d6` |
| 11 | Decision: picking a queue tech | `academy decide d9` |
| 12 | Decision: WebSockets vs SSE vs polling | `academy decide d13` |
| 13 | Weekend: finish Capstone 1 · start Capstone 2 (workers + outbox) | `academy plan` |

### Phase 4 — Testing, Observability, Security (weeks 14–16)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: the testing pyramid for services + quiz | `academy lesson p4.l1` |
| 2 | Lesson: logs, metrics, traces, SLOs + quiz | `academy lesson p4.l2` |
| 3 | Lesson: OWASP & supply chain + quiz | `academy lesson p4.l3` |
| 4 | Decision: how much to mock | `academy decide d8` |
| 5 | Decision: alert fatigue | `academy decide d10` |
| 6 | Weekend: add Testcontainers tests + pino + OTel to your capstones | — |

### Phase 5 — Architecture & Scaling (weeks 17–20)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: hexagonal architecture & DDD-lite + quiz | `academy lesson p5.l1` |
| 2 | Lesson: monolith vs microservices + quiz | `academy lesson p5.l2` |
| 3 | Decision: monolith or microservices for a startup | `academy decide d3` |
| 4 | Lesson: scaling the database + quiz | `academy lesson p5.l3` |
| 5 | Lesson: horizontal scaling & idempotency + quiz | `academy lesson p5.l4` |
| 6 | **Challenge: idempotency keys** | `academy challenge ch-idempotency` |
| 7 | **LAB: Resilience — all 3 milestones** (timeout → retry → circuit breaker) | `academy lab lab-resilience` |
| 8 | Weekend: refactor Capstone 1 toward hexagonal; write scaling notes | — |

### Phase 6 — DevOps, Deployment & System Design (weeks 21–24)
| # | Do this | Command |
|---|---|---|
| 1 | Lesson: Docker for Node + quiz | `academy lesson p6.l1` |
| 2 | Lesson: CI/CD, cloud, k8s literacy + quiz | `academy lesson p6.l2` |
| 3 | Decision: serverless or containers | `academy decide d14` |
| 4 | Decision: roll back or fix forward | `academy decide d16` |
| 5 | Lesson: the system-design framework + quiz | `academy lesson p6.l3` |
| 6 | **Design week A:** URL shortener, then rate limiter | `academy design sd1` · `sd2` |
| 7 | **Design week B:** news feed, then chat | `academy design sd3` · `sd4` |
| 8 | **Design week C:** idempotent payments (the boss fight) | `academy design sd5` |
| 9 | Capstone 3: containerize + CI/CD + deploy · Capstone 4: design dossier | `academy plan` |

### 🎓 Graduation Project — "OrderFlow" (weeks 25–28)

The final exam: one production-grade system on **real Postgres, Redis, and
Kafka** (infra provided via Docker), built with real libraries of your choice,
graded black-box against your *running* service — including your deployed one.
Full spec: `graduation/GRADUATION.md`.

| # | Do this | Command |
|---|---|---|
| 1 | Read the spec + start the infra | `academy graduate --spec`, then `cd graduation && docker compose up -d` |
| 2 | Build your app in `graduation/app/` (any framework, real libs, migrations) | — |
| 3 | **G1** health + readiness (really ping Postgres/Redis/Kafka) | `academy graduate` |
| 4 | **G2** auth: users in Postgres, sessions in Redis | `academy graduate` |
| 5 | **G3** orders: validation, cursor pagination, idempotency keys, optimistic locking | `academy graduate` |
| 6 | **G4** Redis caching (x-cache MISS/HIT) + login rate limiting (429) | `academy graduate` |
| 7 | **G5** the Kafka pipeline: outbox → topic → idempotent consumer → confirmed | `academy graduate` |
| 8 | Get a staff-level code review of each stage (ask Claude Code) | — |
| 9 | Work the manual checklist: graceful shutdown, Dockerfile, CI, your own tests | `graduation/GRADUATION.md` |
| 10 | **Deploy it, then graduate against production** | `academy graduate https://your-app.xyz` |

Passing all five stages **against a deployed URL** is graduating.

**How to do a design (exact protocol):** run `academy design sd1` → it prints
the prompt, the clarifying questions, and the 7-step framework → set a
45-minute timer → whiteboard it **out loud** (paper or tldraw) → only then run
`academy design sd1 --reveal` → write down every gap between your answer and
the model one → redo the same design from scratch 3 days later.

---

## Part 4 — How grading works & getting unstuck

- **Sequential unlocking**: lesson N+1 opens only when lesson N is read, its
  quiz is passed, **and** its challenge (if any) is beaten. Locked lessons show
  🔒 in `academy list`; trying to open one tells you exactly what to finish first.
- **Quizzes**: 70% to pass; retake freely with `academy quiz <lessonId>`.
- **Challenges/labs**: real tests (Node's built-in runner) grade your code.
  Green = done, and progress saves automatically. The output shows exactly
  which assertion failed — read it, that's the skill.
- **Stuck protocol** (in order): 1) reread the failing assertion, 2) reread the
  contract comment at the top of the file you're editing, 3) reread the linked
  lesson, 4) **ask the tutor** — `academy ask <lessonId> "your question"` — it
  explains, it doesn't hand you the code, 5) after 30+ minutes,
  `academy solve <id>` / `academy lab <id> --solution` — study the reference,
  close it, rewrite from memory. Never paste it in; that defeats the program.
- **Everything at once**: `academy list` (curriculum tree), `academy progress`
  (detailed stats), `academy help` (all commands).

## Part 4½ — Time commitment & retakes

**Total: ~28–30 weeks at ~10 focused hours/week (~300 h)** — 24 weeks of phases +
3–4 weeks for the Graduation Project. Guided content
(lessons ≈ 29 h alone, plus quizzes, challenges, labs, decisions, designs) is ~60–70 h of that;
the capstone projects are the other ~190 h — deliberately, because the
capstones are what make you hireable. Other paces: 5 h/wk ≈ 10–12 months,
15–20 h/wk ≈ 3–4 months. As a senior frontend dev you'll move fast through
Phases 0–1; budget extra patience for Phase 2 (the data layer) — everyone needs it.

**Everything is infinitely retakeable:**
- **Lessons** — re-read anytime (`academy lesson <id>`), no penalty.
- **Quizzes** — retake freely (`academy quiz <id>`); latest score is stored but
  a pass is never lost by a later failed retake.
- **Challenges** — re-run endlessly (that IS the loop); a pass is kept once earned.
- **Labs** — re-graded from scratch each run, so breaking your solution later
  honestly regresses the milestone until you fix it.
- **Decisions/designs** — redo anytime; the design protocol requires a from-scratch
  redo 3 days after each reveal.
- **Full reset** — delete `.academy-progress.json` (your code files are untouched).
- **Streak** — any one command per day keeps it alive.

## Part 5 — Rules of the road

1. **Never skip the hands-on half.** Reading feels like progress; building is
   progress. If pressed for time, drop the lesson, keep the lab/challenge.
2. **Answer quizzes in a real terminal**, one line at a time (piping answers in
   bulk drops some — a readline quirk).
3. **Commit before you reveal** in decisions and designs. Being wrong first is
   the mechanism.
4. **Read this app's source.** Zero dependencies on purpose: `src/ui.ts` is a
   hand-rolled chalk+markdown, `src/cli.ts` a hand-rolled router, `src/store.ts`
   a crude repository with a race condition you'll be able to name by Phase 2.
5. **Capstones are the portfolio.** The academy teaches; the capstones get you
   hired. `academy plan` describes all four.
6. Progress lives in `.academy-progress.json` — delete it to start over.
   `CURRICULUM.md` is the whole course as one readable document.

---

## Part 6 — Making this optimal (the honest section)

This academy is a scaffold, not the whole path. Senior backend skill comes from
a loop no curriculum contains: **build → break → debug → get feedback → repeat.**
Five habits turn this program from "very good" into "the real thing":

1. **Treat capstones as the main event.** The academy is ~20% of the hours for
   a reason. From Capstone 1 on, use REAL infrastructure: Postgres + Redis in
   Docker, real migrations, a real deploy that stays up. Break it on purpose;
   debugging your own outage teaches more than any lesson here.
2. **Get code review after every milestone.** Tests grade correctness, not
   quality. Open a Claude Code session and ask: *"Review labs/lab-auth/src/app.ts
   like a staff backend engineer — critique design, error handling, and naming,
   not just correctness."* Do the same for every capstone feature. This is the
   feedback loop that self-study normally lacks.
3. **Explain out loud after each phase.** Teach the hardest concept of the phase
   to Claude (or a friend, or a rubber duck) from memory, and ask to have holes
   poked in it. If you can't explain the event loop without notes, you don't
   own it yet — go back.
4. **Read production code weekly (~1 h).** Fastify's router, BullMQ's job
   lifecycle, pino's logger. You built toy versions of all three in the labs —
   now see what a decade of production hardening adds.
5. **Ship something real before the end.** Deploy a capstone publicly, get one
   real user, or land one PR on an open-source backend project. Real stakes are
   the final teacher, and it's the strongest possible line on a CV.

---

**Your very next action:**

```bash
academy learn
```
