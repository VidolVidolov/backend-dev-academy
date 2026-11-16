import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { c, hr, box, symbols } from '../ui.ts';
import { labs, labList } from '../../labs/registry.ts';
import type { Lab, Milestone } from '../../labs/registry.ts';
import { gradeTestFile } from '../grader.ts';
import type { ProgressState } from '../store.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export function listLabs(state: ProgressState): void {
  console.log('\n' + box('Guided Build Labs'));
  console.log(c.gray('  Real projects, built milestone by milestone with test gates.\n'));
  for (const l of labList) {
    const prog = state.labs?.[l.id];
    const doneCount = prog?.milestonesPassed?.length || 0;
    const mark = doneCount === l.milestones.length ? symbols.done : doneCount ? symbols.active : symbols.todo;
    console.log(`  ${mark} ${c.yellow(l.id)}  ${c.bold(l.title)} ${c.gray(`(${doneCount}/${l.milestones.length} milestones)`)}`);
  }
  console.log('\n  ' + c.gray('Start one: ') + c.yellow('academy lab <id>') + '\n');
}

interface MilestoneResult {
  passed: boolean;
  output: string;
  reason: string;
}

function runMilestone(dir: string, m: Milestone): MilestoneResult {
  // Enforce the TAP counts, not just the exit code, so a milestone can't be
  // faked green by a solution that exits early or short-circuits the suite.
  const r = gradeTestFile({ file: join(dir, m.test), expect: m.expect ?? 1, cwd: ROOT });
  return { passed: r.passed, output: r.output, reason: r.reason };
}

export function runLab(state: ProgressState, id: string, flag?: string): void {
  const lab = labs[id];
  if (!lab) {
    console.log(c.red(`Unknown lab: ${id}`));
    return listLabs(state);
  }
  const dir = join(ROOT, 'labs', lab.dir);

  if (flag === '--solution') return showSolution(lab, dir);
  if (flag === '--brief' || flag === undefined) printBrief(lab, dir);

  console.log('\n' + hr());
  console.log(c.bold('  Grading milestones...\n'));

  const passed: string[] = [];
  let stoppedAt: { m: Milestone; output: string; reason: string } | null = null;
  for (const m of lab.milestones) {
    const r = runMilestone(dir, m);
    if (r.passed) {
      console.log('  ' + symbols.done + c.green(`  ${m.id} — ${m.name}`));
      passed.push(m.id);
    } else {
      console.log('  ' + c.red(`✗  ${m.id} — ${m.name}`) + c.gray('  ← you are here'));
      stoppedAt = { m, output: r.output, reason: r.reason };
      break;
    }
  }
  for (const m of lab.milestones.slice(passed.length + (stoppedAt ? 1 : 0))) {
    console.log('  ' + symbols.todo + c.gray(`  ${m.id} — ${m.name}`));
  }

  // Persist progress.
  state.labs = state.labs || {};
  state.labs[id] = { milestonesPassed: passed, updatedAt: new Date().toISOString() };
  import('../store.ts').then(({ save }) => save(state));

  console.log('\n' + hr());
  if (!stoppedAt) {
    console.log('  ' + symbols.done + c.green(' All milestones pass — the Orders API is built! 🎉'));
    console.log('  ' + c.gray('Now try the BRIEF\'s stretch goals (pagination, optimistic locking, Postgres).'));
  } else {
    console.log(c.bold(`  Failing checks for ${stoppedAt.m.id} (${stoppedAt.m.name}):`));
    if (stoppedAt.reason) console.log('  ' + c.gray(stoppedAt.reason));
    console.log(summarize(stoppedAt.output));
    console.log('\n  ' + c.gray('Edit ') + c.yellow(`labs/${lab.dir}/${lab.file}`) + c.gray(' then re-run ') + c.yellow(`academy lab ${id}`));
    console.log('  ' + c.gray('Stuck? ') + c.yellow(`academy lab ${id} --solution`));
  }
  console.log();
}

function printBrief(lab: Lab, dir: string): void {
  console.log('\n' + box(`Lab · ${lab.title}`));
  const briefPath = join(dir, 'BRIEF.md');
  if (existsSync(briefPath)) {
    // Show just the top of the brief; full file is in the folder.
    const brief = readFileSync(briefPath, 'utf8').split('\n').slice(0, 4).join('\n');
    console.log(c.gray('  ' + briefPath.replace(ROOT + '/', '')));
    console.log('\n' + brief.split('\n').map((l) => '  ' + l).join('\n'));
  }
  console.log('\n  ' + c.bold('Milestones:'));
  lab.milestones.forEach((m) => console.log('   ' + symbols.arrow + ' ' + c.cyan(m.id) + ' ' + m.name));
  console.log('  ' + c.gray('You edit: ') + c.yellow(`labs/${lab.dir}/${lab.file}`));
}

function showSolution(lab: Lab, dir: string): void {
  const ref = join(dir, lab.solution);
  if (!existsSync(ref)) return console.log(c.yellow('No reference available.'));
  console.log('\n' + box(`Reference · ${lab.title}`));
  console.log(c.gray('  ' + ref.replace(ROOT + '/', '') + '\n'));
  console.log(readFileSync(ref, 'utf8').split('\n').map((l) => '  ' + c.yellow(l)).join('\n'));
  console.log();
}

function summarize(out: string): string {
  const lines = out.split('\n').filter((l) =>
    /not ok|AssertionError|expected|actual|✖|Error:/i.test(l));
  return (lines.length ? lines : out.split('\n')).slice(0, 25).map((l) => '  ' + c.gray(l)).join('\n');
}
