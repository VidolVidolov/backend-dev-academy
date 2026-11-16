import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync, watch as fsWatch } from 'node:fs';
import { c, hr, box, symbols } from '../ui.ts';
import { challenges, challengeList } from '../../challenges/registry.ts';
import type { Challenge } from '../../challenges/registry.ts';
import { recordChallenge, save } from '../store.ts';
import { gradeTestFile } from '../grader.ts';
import type { ProgressState } from '../store.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export function listChallenges(state: ProgressState): void {
  console.log('\n' + box('Coding Challenges'));
  for (const ch of challengeList) {
    const done = state.challenges[ch.id]?.passedAt;
    const mark = done ? symbols.done : symbols.todo;
    console.log(`  ${mark} ${c.yellow(ch.id)}  ${ch.title}`);
  }
  console.log('\n  ' + c.gray('Run one: ') + c.yellow('academy challenge <id>') +
    c.gray('  · reveal solution: ') + c.yellow('academy solve <id>') + '\n');
}

export function runChallenge(state: ProgressState, id: string, flag?: string): void {
  const ch = challenges[id];
  if (!ch) {
    console.log(c.red(`Unknown challenge: ${id}`));
    return listChallenges(state);
  }
  const dir = join(ROOT, 'challenges', ch.dir);

  console.log('\n' + box(`Challenge · ${ch.title}`));
  console.log(c.gray(`  file: challenges/${ch.dir}/solution.ts`));
  console.log('\n' + c.bold('  Task'));
  console.log(ch.prompt.split('\n').map((l) => '  ' + l).join('\n'));

  gradeOnce(state, id, ch, dir);

  if (flag === '--watch') {
    console.log('  ' + c.cyan('👀 watching ') + c.gray(`challenges/${ch.dir}/solution.ts — save to re-grade, Ctrl-C to stop`));
    watchAndRegrade(state, id, ch, dir);
  }
}

function gradeOnce(state: ProgressState, id: string, ch: Challenge, dir: string): void {
  console.log('\n' + hr());
  console.log(c.gray('  Running the grader (node --test)...\n'));

  // `expect` is the number of tests that MUST run and pass. The grader checks
  // the TAP counts, not just the exit code, so a solution can't fake a pass by
  // calling process.exit() or otherwise cutting the suite short.
  const result = gradeTestFile({
    file: join(dir, 'test.ts'),
    expect: ch.expect ?? 1,
    cwd: ROOT,
  });
  console.log(indent(summarize(result.output)));

  const passed = result.passed;
  recordChallenge(state, id, passed);
  console.log(hr());
  if (passed) {
    console.log('  ' + symbols.done + c.green(` All ${result.tests} tests pass. Challenge complete!`));
    console.log('  ' + c.gray('If this was gating a lesson, it\'s unlocked now — ') + c.yellow('academy learn'));
  } else {
    console.log('  ' + c.red('✗ Not passing yet.') + c.gray('  ' + result.reason));
    console.log('  ' + c.gray(`Edit challenges/${ch.dir}/solution.ts and re-run`) +
      c.gray(' (or auto-rerun on save: ') + c.yellow(`academy challenge ${id} --watch`) + c.gray(')'));
    const hintsUsed = state.hints?.[id] || 0;
    const hintsTotal = ch.hints?.length || 0;
    if (hintsTotal && hintsUsed < hintsTotal) {
      console.log('  ' + c.gray('Stuck? ') + c.yellow(`academy hint ${id}`) +
        c.gray(` (${hintsUsed}/${hintsTotal} hints used — they escalate; the solution stays yours)`));
    } else {
      console.log('  ' + c.gray('Out of hints? Last resort: ') + c.yellow(`academy solve ${id}`));
    }
  }
  console.log();
}

// --watch: re-grade on every save of solution.ts. The tight loop is where the
// learning happens — edit, save, read the failure, repeat.
function watchAndRegrade(state: ProgressState, id: string, ch: Challenge, dir: string): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  const target = join(dir, 'solution.ts');

  fsWatch(dir, (_event, filename) => {
    if (filename && filename !== 'solution.ts') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (running) return; // a grade is already in flight; the next save re-triggers
      running = true;
      console.log('\n' + c.cyan('↻ change detected — re-grading...'));
      try { gradeOnce(state, id, ch, dir); } finally { running = false; }
      console.log('  ' + c.cyan('👀 still watching ') + c.gray(target.replace(ROOT + '/', '') + ' — Ctrl-C to stop'));
    }, 250); // editors often fire several fs events per save; debounce them
  });
}

// Progressive hints: each call reveals ONE more, and earlier ones stay visible.
// The ladder goes concept -> approach -> the tricky detail, so you get unstuck
// with the least possible spoiler.
export function hintChallenge(state: ProgressState, id: string): void {
  const ch = challenges[id];
  if (!ch) {
    console.log(c.red(`Unknown challenge: ${id}`));
    return listChallenges(state);
  }
  if (!ch.hints?.length) {
    console.log(c.yellow(`No hints for ${id} — try academy ask, or (last resort) academy solve ${id}.`));
    return;
  }

  state.hints = state.hints || {};
  const already = state.hints[id] || 0;
  const revealed = Math.min(already + 1, ch.hints.length);
  state.hints[id] = revealed;
  save(state);

  console.log('\n' + box(`Hints · ${ch.title}`));
  console.log(c.gray(`  Revealed ${revealed} of ${ch.hints.length} — each one spoils a bit more.\n`));
  for (let i = 0; i < revealed; i++) {
    console.log('  ' + c.yellow(`${i + 1}.`) + ' ' + wrapText(ch.hints[i]!, '     '));
    console.log();
  }
  if (revealed < ch.hints.length) {
    console.log('  ' + c.gray('Still stuck after trying? ') + c.yellow(`academy hint ${id}`) + c.gray(' reveals the next one.'));
  } else {
    console.log('  ' + c.gray('That was the last hint. If it still won’t click: ') + c.yellow(`academy solve ${id}`));
  }
  console.log();
}

function wrapText(text: string, indent: string, width = 72): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  lines.push(line.trim());
  return lines.join('\n' + indent);
}

export function solveChallenge(state: ProgressState, id: string): void {
  const ch = challenges[id];
  if (!ch) return console.log(c.red(`Unknown challenge: ${id}`));
  const ref = join(ROOT, 'challenges', ch.dir, 'reference.ts');
  if (!existsSync(ref)) return console.log(c.yellow('No reference available.'));

  // Nudge toward the hints ladder first — the reference is the LAST resort,
  // because reading it converts a learning rep into a reading rep.
  const hintsUsed = state.hints?.[id] || 0;
  const hintsTotal = ch.hints?.length || 0;
  if (hintsTotal && hintsUsed < hintsTotal) {
    console.log('\n  ' + c.yellow(`⚠ You have ${hintsTotal - hintsUsed} unread hint(s) for this challenge.`));
    console.log('  ' + c.gray('The full solution spoils the rep — try ') + c.yellow(`academy hint ${id}`) + c.gray(' first.'));
    console.log('  ' + c.gray('(Re-run ') + c.yellow(`academy solve ${id}`) + c.gray(' if you really want the reference now.)\n'));
    state.solveWarned = state.solveWarned || {};
    if (!state.solveWarned[id]) { state.solveWarned[id] = true; save(state); return; }
  }
  console.log('\n' + box(`Reference · ${ch.title}`));
  console.log(c.gray('  challenges/' + ch.dir + '/reference.ts\n'));
  console.log(readFileSync(ref, 'utf8').split('\n').map((l) => '  ' + c.yellow(l)).join('\n'));
  console.log('\n  ' + c.gray('Study it, then implement it yourself in solution.ts. ') +
    c.gray('Copy it with: ') + c.yellow(`cp challenges/${ch.dir}/reference.ts challenges/${ch.dir}/solution.ts`) + '\n');
}

// Keep test output readable: pull each failing test's NAME plus its assertion
// message/expected/actual out of the TAP YAML, instead of a raw line soup.
function summarize(out: string): string {
  const lines = out.split('\n');
  const failures: { name: string; details: string[] }[] = [];
  const preamble: string[] = []; // non-counter comment lines: load errors, stack heads
  const COUNTERS = /^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms|Subtest)/;
  let current: { name: string; details: string[] } | null = null;
  for (const line of lines) {
    const notOk = line.match(/^not ok \d+ - (.+)$/);
    if (notOk) {
      current = { name: notOk[1]!, details: [] };
      failures.push(current);
      continue;
    }
    if (/^ok \d+ /.test(line) || /^# /.test(line)) { current = null; }
    if (/^# /.test(line) && !COUNTERS.test(line) && preamble.length < 10) preamble.push(line);
    if (current && /^\s+(error|message|code|expected|actual):/.test(line) && current.details.length < 6) {
      current.details.push(line.trim());
    }
  }

  const outLines: string[] = [];
  if (preamble.length) outLines.push(...preamble, '');
  for (const f of failures.slice(0, 4)) {
    outLines.push(c.red('✗ ' + f.name));
    for (const d of f.details) outLines.push('    ' + d);
  }
  if (failures.length > 4) outLines.push(c.gray(`… and ${failures.length - 4} more failing test(s)`));

  const counts = lines.filter((l) => /^# (tests|pass|fail) /.test(l));
  outLines.push('', ...counts);

  // Fallback (e.g. a syntax error before any test ran): show the head raw.
  if (failures.length === 0 && counts.length === 0) return lines.slice(0, 25).join('\n');
  return outLines.join('\n');
}

function indent(s: string): string {
  return s.split('\n').map((l) => '  ' + c.gray(l)).join('\n');
}
