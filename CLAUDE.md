# CLAUDE.md — working notes for AI-assisted changes to this repo

This file is for whoever (human or AI) extends the academy itself. It's not
student-facing — see [README.md](README.md), [START_HERE.md](START_HERE.md),
and [CURRICULUM.md](CURRICULUM.md) for that. Read this before touching
`curriculum/`, `challenges/`, `labs/`, `graduation/`, or `src/grader.ts`.

## The one rule that overrides everything else

**Never edit a student's in-progress work file.** That means:
- `challenges/*/solution.ts`
- `labs/*/src/app.ts` (or whatever `labs/registry.ts` names as `file`)

These are the user's workspace, not app code. If one has a bug, explain the
bug and let the user fix it — don't patch it for them, even if asked to "just
fix the tests." This applies even mid-task; if you're deep in an unrelated
change and notice a broken solution file, leave it alone.

Everything else in the repo (registries, graders, curriculum content, CLI,
`reference.ts` files) is normal app code — edit freely.

## What this app is

A zero-dependency Node CLI (`bin/academy.ts`) that serves a structured
backend-engineering curriculum: lessons → quizzes → coding challenges (gate
sequential progression), plus standalone labs, decision scenarios, system
designs, and a graduation project. Progress lives in
`.academy-progress.json` (shape defined in `src/store.ts`). Node runs the
`.ts` sources directly (type-stripping, Node ≥ 23.6) — there is no build
step; `npm run typecheck` (`tsc --noEmit`) is a separate, optional check.

## Architecture map

Three parallel **content registries**, each a plain object keyed by id, each
consumed by both the CLI (`src/commands/*.ts`) and the grader:

| Registry | File | Content lives in |
|---|---|---|
| Curriculum (phases → modules → lessons → quizzes) | `curriculum/index.ts` (aggregates `curriculum/phases/phase{0..6}.ts`) | inline in the phase files (lesson `body` is markdown-in-TS) |
| Coding challenges | `challenges/registry.ts` | `challenges/<id>/{solution,test,reference}.ts` |
| Guided labs | `labs/registry.ts` | `labs/<id>/{BRIEF.md, src/*, test/*.test.ts}` |

`curriculum/index.ts` also derives the gating logic (`isLessonComplete`,
`isLessonUnlocked`, `nextLesson`) — a lesson unlocks only when every lesson
before it is complete (read + quiz passed + challenge passed, whichever
apply). If you add a lesson, it slots into this chain automatically; you
don't need to touch the gating functions.

`src/grader.ts` is shared by challenges, labs, and graduation — see below.

## The grading system — read this before touching any test file

`src/grader.ts`'s `gradeTestFile()` does NOT trust the child process's exit
code. It runs `node --test --test-reporter=tap <file>`, parses the TAP
summary (`# tests`, `# pass`, `# fail`, `# cancelled`), and requires:
1. at least `expect` tests actually **ran** (catches `process.exit()` /
   early-return tricks that cut a suite short with a fake 0 exit),
2. every test that ran **passed** (`pass === tests`, `fail === 0`),
3. nothing was cancelled,
4. the process exited 0.

This exists because the old exit-code-only grader could be defeated by a
solution calling `process.exit(0)` mid-suite (see the comment at the top of
`ch-graceful-shutdown`'s history / `src/grader.ts`). Don't regress to
trusting exit code alone.

**`test-checksums.json` pins every graded test file's SHA-256** (challenges'
`test.ts`, labs' `test/*.test.ts` + `helper.ts`, graduation's
`acceptance/*.test.ts` + `client.ts`). The grader hard-fails if a graded file's
hash doesn't match — this catches both accidental edits and an AI assistant
"helpfully" weakening an assertion to make a stuck solution pass.

**If you intentionally add or edit a test file**, you MUST regenerate the
manifest or grading breaks for everyone:
```bash
node scripts/update-test-checksums.ts
```
Do this as part of the same change, not a follow-up — an uncommitted manifest
drift means the grader rejects the very test file you just wrote correctly.

**`expect` counts must match reality.** Every challenge/milestone entry sets
`expect: N` (currently 10–12 across the board) — the number of tests in that
file. If you add or remove a `test(...)` block, update `expect` in
`challenges/registry.ts` or `labs/registry.ts` to match, or the grader will
either falsely reject (`expect` too high) or let a truncated run slip through
(`expect` too low).

## Adding a new coding challenge

1. `mkdir challenges/ch-<name>` with three files:
   - `solution.ts` — starts as a throwing stub (this is what the student edits)
   - `test.ts` — `node:test` suite, aim for 10+ tests, favor randomized inputs
     and effect-based assertions over exact-value checks (defeats hardcoding —
     see `ch-event-loop/test.ts` for the pattern)
   - `reference.ts` — a worked solution (`academy solve <id>` reveals this)
2. Add an entry to `challenges/registry.ts`: `title`, `dir`, `lesson` (the
   lesson id it gates), `hints` (2-3, least-spoiler-first), `expect` (test
   count), `prompt` (include one concrete happy-path example — every existing
   prompt does this).
3. If it should gate a lesson, set that lesson's `challenge: 'ch-<name>'` in
   the relevant `curriculum/phases/phaseN.ts` file.
4. `node scripts/update-test-checksums.ts`.
5. Verify: `node --test challenges/ch-<name>/test.ts` against your own
   `reference.ts` (temporarily point `solution.ts`'s exports at it, or just
   copy it in) to confirm the suite is satisfiable and `expect` matches.

## Adding a new lab

1. `mkdir labs/lab-<name>` with `BRIEF.md`, `src/<entry>.ts` (student stub),
   `src/<entry>.reference.ts`, `test/m1.test.ts`, `test/m2.test.ts`, ...
   (one file per milestone, graded in order — see `lab-auth` for the shape).
2. Add an entry to `labs/registry.ts`: `title`, `dir`, `file` (student's
   entry point), `solution` (reference path), `phase`, `milestones` (each
   with `id`, `name`, `test`, `expect`).
3. `node scripts/update-test-checksums.ts`.
4. Verify each milestone's test file passes against the reference solution.

## Adding/editing a lesson

Edit the relevant `curriculum/phases/phaseN.ts` file directly — lessons are
plain objects with `id`, `title`, `minutes`, `body` (markdown string), and
optionally `quiz` (array of `{ q, choices, answer }`) and `challenge` (a
challenge id from `challenges/registry.ts`). No registry file to update
separately — `curriculum/index.ts` flattens phases automatically. Keep the
teaching voice consistent with neighboring lessons in the same phase (written
for an experienced frontend dev who is new to backend specifically, not new
to programming).

## Verifying a change

```bash
npm run typecheck                           # tsc --noEmit over the maintained code
npm run lint                                # ESLint over the maintained code
npm test                                    # every challenge's test.ts
node --test 'labs/**/test/*.test.ts'        # every lab milestone
node bin/academy.ts                         # smoke-test the CLI/dashboard
node bin/academy.ts challenge ch-<id>       # grade one challenge
node bin/academy.ts lab lab-<id>            # grade one lab's next milestone
```

`npm test` failing with `TODO: implement …` is EXPECTED — those are the
student's unimplemented solution stubs, not a regression. Only worry about
failures that aren't unimplemented stubs.

## Linting (ESLint)

ESLint 10 flat config lives in `eslint.config.js`. It is **dev-only** — in
`devDependencies`, never imported by the CLI — so it does NOT break the app's
zero-*runtime*-dependency design. That constraint is about what ships with and
runs the product; a linter is tooling. (Runtime code is still plain Node ESM
with no `dependencies`: `src/ui.ts`, `src/cli.ts`, and `src/store.ts` are
hand-rolled on purpose — part of what the course teaches by example. Don't add
a runtime `dependency` without discussing it first.)

- `npm run lint` — report only (safe, read-only).
- `npm run lint:fix` — autofix. Safe because of the scoping below, but know
  what it can touch before running it.

**Scope: ESLint lints the maintained infrastructure only** — `src/`, `bin/`,
`scripts/`, `curriculum/`, and the two registries. `eslint.config.js` ignores
all *exercise content*, for concrete reasons:
- `challenges/*/solution.ts`, `labs/*/src/**` — student workspace (never ours
  to touch — see the top rule) and app-authored **reference solutions**, which
  sometimes show a pattern a linter dislikes on purpose (e.g. an explicit
  `catch { throw }` annotated to teach why a value is left uncached). Both are
  teaching artifacts, not code to lint-police. These files also carry a
  `// @ts-nocheck` marker for the same reason — they're not held to the
  repo's strict typecheck either (see `npm run typecheck`).
- `challenges/*/test.ts`, `challenges/*/_cheat.test.ts`, `labs/*/test/**`,
  `graduation/acceptance/**` — **checksum-pinned** (see grading section). These
  are ignored specifically so `lint:fix` can never rewrite a hashed file and
  silently break grading for everyone.
- `lesson-exapmles/**` — scratch demos, some intentionally "wrong" (e.g. a
  blocking loop).

If you add a lesson/challenge/lab and want its *new maintained* files linted,
they're already covered by the globs above; if you add a new top-level dir of
app code, confirm it isn't accidentally swept up by an ignore pattern.
