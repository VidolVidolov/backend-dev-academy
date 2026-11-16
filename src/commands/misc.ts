import { c, hr, box, progressBar, symbols } from '../ui.ts';
import { phases, lessons, capstones, totals, isLessonComplete, isLessonUnlocked } from '../../curriculum/index.ts';
import type { ProgressState } from '../store.ts';

export function list(state: ProgressState): void {
  console.log('\n' + box('Full Curriculum'));
  for (const p of phases) {
    const pl = p.modules.flatMap((m) => m.lessons);
    const done = pl.filter((l) => state.lessons[l.id]).length;
    console.log(`\n${c.bold(c.cyan(p.title))} ${c.gray(`· ${p.weeks} weeks · ${done}/${pl.length}`)}`);
    console.log(c.gray('  ' + p.goal));
    for (const m of p.modules) {
      console.log('  ' + c.blue(m.title));
      for (const l of m.lessons) {
        const complete = isLessonComplete(state, l);
        const unlocked = isLessonUnlocked(state, l.id);
        const mark = complete ? symbols.done : unlocked ? (state.lessons[l.id] ? symbols.active : symbols.todo) : symbols.locked;
        const extras = [l.quiz?.length ? c.gray('quiz') : null, l.challenge ? c.yellow('challenge') : null]
          .filter(Boolean).join(c.gray(' · '));
        const title = unlocked ? l.title : c.gray(l.title);
        console.log(`    ${mark} ${c.gray(l.id)}  ${title}${extras ? c.gray('  [') + extras + c.gray(']') : ''}`);
      }
    }
  }
  console.log();
}

export function progress(state: ProgressState): void {
  const t = totals();
  const doneLessons = lessons.filter((l) => state.lessons[l.id]).length;
  const passedQuizzes = Object.values(state.quizzes).filter((q) => q.passedAt).length;
  const doneChallenges = Object.values(state.challenges).filter((ch) => ch.passedAt).length;

  console.log('\n' + box('Your Progress'));
  console.log('  Started    ' + c.gray(state.startedAt ? new Date(state.startedAt).toDateString() : '—'));
  console.log('  Streak     ' + c.yellow(`${state.streak.current} day(s)`) + c.gray(`  (best ${state.streak.longest})`));
  console.log();
  console.log('  Lessons    ' + progressBar(doneLessons, t.lessons));
  console.log('  Quizzes    ' + progressBar(passedQuizzes, t.quizzes));
  console.log('  Challenges ' + progressBar(doneChallenges, t.challenges));
  console.log('\n' + hr());

  // Per-phase breakdown
  for (const p of phases) {
    const pl = p.modules.flatMap((m) => m.lessons);
    const done = pl.filter((l) => state.lessons[l.id]).length;
    console.log('  ' + (done === pl.length ? symbols.done : done ? symbols.active : symbols.todo) +
      ' ' + p.title.padEnd(38) + c.gray(`${done}/${pl.length}`));
  }
  console.log();
}

export function plan(_state: ProgressState): void {
  console.log('\n' + box('Your 6-Month Plan → Senior Backend'));
  console.log(c.gray('  Tailored for a senior frontend dev. ~10 focused hours/week.\n'));

  const schedule: [string, string, string][] = [
    ['Weeks 1-2',  'Phase 0 — Runtime foundations', 'Event loop, streams, modules, process. Read every lesson + do both challenges.'],
    ['Weeks 3-5',  'Phase 1 — HTTP & servers', 'Raw http server, then Express + Fastify. Start Capstone 1: Orders API skeleton.'],
    ['Weeks 6-9',  'Phase 2 — Data layer', 'Postgres deep, transactions, indexes, migrations. Wire Capstone 1 to a real DB.'],
    ['Weeks 10-13','Phase 3 — Production APIs', 'Auth, validation, caching, queues, real-time. Finish Capstone 1 + build Capstone 2.'],
    ['Weeks 14-16','Phase 4 — Quality', 'Testing (Testcontainers), observability, security. Add tests + OTel to capstones.'],
    ['Weeks 17-20','Phase 5 — Architecture & scale', 'Hexagonal, mono-vs-micro, scaling data. Refactor Capstone 1; write scaling notes.'],
    ['Weeks 21-23','Phase 6 — Ship it', 'Docker, CI/CD, cloud deploy, system design. Deploy Capstone 3; system-design dossier.'],
    ['Week 24',    'Consolidate & interview', 'Polish portfolio, mock system-design interviews, review weak quiz topics.'],
  ];
  for (const [when, what, how] of schedule) {
    console.log('  ' + c.yellow(when.padEnd(13)) + c.bold(what));
    console.log('  ' + ' '.repeat(13) + c.gray(how));
  }

  console.log('\n' + hr());
  console.log(c.bold('  Capstone projects (your portfolio):'));
  for (const cap of capstones) {
    const mark = symbols.arrow;
    console.log('  ' + mark + ' ' + c.cyan(cap.title));
    console.log('    ' + c.gray(cap.blurb));
  }
  console.log('\n' + c.gray('  Weekly ritual: 3–4 lessons, their quizzes + challenges, and push capstone progress.'));
  console.log(c.gray('  Do one system-design write-up per week from Phase 6 onward.\n'));
}

export function help(): void {
  console.log('\n' + box('academy — commands'));
  const rows: [string, string][] = [
    ['academy', 'dashboard: progress + the ONE next step'],
    ['academy map', 'the whole journey in order — where you are, what\'s next'],
    ['academy learn', 'open the next unread lesson (interactive)'],
    ['academy lesson <id>', 'read a specific lesson (e.g. p2.l1)'],
    ['academy quiz <id>', 'take a lesson\'s quiz'],
    ['academy review', 'drill the quiz questions you previously missed'],
    ['academy ask [id] [q]', 'AI tutor chat — grounded in a lesson if you pass its id'],
    ['academy challenge <id>', 'run a coding challenge & grade it (--watch: re-grade on save)'],
    ['academy challenges', 'list all coding challenges'],
    ['academy hint <id>', 'progressive hints: concept → approach → the tricky detail'],
    ['academy solve <id>', 'reveal the reference solution (last resort — hints first!)'],
    ['academy lab <id>', 'guided build project, graded milestone-by-milestone'],
    ['academy labs', 'list the build labs'],
    ['academy decide <id>', 'work a real architecture-decision scenario'],
    ['academy decisions', 'list decision scenarios'],
    ['academy design <id>', 'system-design interview prompt (--reveal for model answer)'],
    ['academy designs', 'list system-design prompts'],
    ['academy graduate [url]', 'grade the final project — --spec for setup, --contract for the HTTP contract'],
    ['academy list', 'the full curriculum tree'],
    ['academy progress', 'detailed progress breakdown'],
    ['academy plan', 'your 6-month roadmap + capstones'],
    ['academy help', 'this help'],
  ];
  for (const [cmd, desc] of rows) {
    console.log('  ' + c.yellow(cmd.padEnd(24)) + c.gray(desc));
  }
  console.log('\n  ' + c.gray('Tip: this app is written in Node with zero deps — read its src/ to learn.') + '\n');
}
