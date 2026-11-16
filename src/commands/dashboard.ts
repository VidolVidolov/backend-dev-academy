import { c, hr, box, progressBar, symbols } from '../ui.ts';
import { phases, lessons, totals } from '../../curriculum/index.ts';
import { labList } from '../../labs/registry.ts';
import { decisions } from '../../curriculum/decisions.ts';
import { designs } from '../../curriculum/designs.ts';
import { gradStages } from './graduate.ts';
import { nextAction, describeAction } from '../next.ts';
import type { ProgressState } from '../store.ts';

export function dashboard(state: ProgressState): void {
  const t = totals();
  const doneLessons = lessons.filter((l) => state.lessons[l.id]).length;
  const doneChallenges = Object.values(state.challenges).filter((ch) => ch.passedAt).length;
  const donePhases = phases.filter((p) =>
    p.modules.every((m) => m.lessons.every((l) => state.lessons[l.id]))
  ).length;
  const totalMilestones = labList.reduce((n, l) => n + l.milestones.length, 0);
  const doneMilestones = labList.reduce((n, l) => n + (state.labs?.[l.id]?.milestonesPassed?.length || 0), 0);
  const doneDecisions = Object.keys(state.decisions || {}).length;
  const doneDesigns = Object.values(state.designs || {}).filter((d) => d.revealedAt).length;

  console.log('\n' + box('Backend Dev Academy'));
  console.log(c.gray('  frontend senior  →  backend senior · your daily driver\n'));

  console.log(c.bold('  Overall'));
  console.log('  Lessons    ' + progressBar(doneLessons, t.lessons));
  console.log('  Challenges ' + progressBar(doneChallenges, t.challenges));
  console.log('  Labs       ' + progressBar(doneMilestones, totalMilestones) + c.gray(' milestones'));
  console.log('  Decisions  ' + progressBar(doneDecisions, decisions.length));
  console.log('  Designs    ' + progressBar(doneDesigns, designs.length));
  console.log('  Graduation ' + progressBar(state.graduation?.stagesPassed?.length || 0, gradStages.length) + c.gray(' stages'));
  console.log('  Phases     ' + progressBar(donePhases, t.phases));
  console.log('  ' + c.gray(`🔥 streak ${state.streak.current}d (best ${state.streak.longest}d)`));
  console.log();

  console.log(c.bold('  Phases'));
  for (const p of phases) {
    const pl = p.modules.flatMap((m) => m.lessons);
    const done = pl.filter((l) => state.lessons[l.id]).length;
    const mark = done === pl.length ? symbols.done : done > 0 ? symbols.active : symbols.todo;
    console.log(`  ${mark} ${c.bold(p.title)} ${c.gray(`(${p.weeks}w · ${done}/${pl.length})`)}`);
  }
  console.log();

  // ONE next step, across every activity type (lessons, labs, decisions,
  // designs, graduation) — not just the next lesson.
  const next = nextAction(state);
  console.log(hr());
  if (next) {
    const gateNote = next.gate ? c.yellow('  ← gates the next lesson') : c.gray('  (craft practice — non-blocking)');
    console.log('  ' + symbols.arrow + ' Next up: ' + c.cyan(c.bold(describeAction(next)!)) + gateNote);
    console.log('  ' + c.gray('Run ') + c.yellow(next.command) +
      c.gray(' · see the whole path: ') + c.yellow('academy map') +
      (next.kind === 'read' || next.kind === 'quiz' ? c.gray(' · questions? ') + c.yellow(`academy ask ${next.id}`) : ''));
  } else {
    console.log('  ' + symbols.done + c.green(' Everything complete — graduation included. 🎓'));
  }
  console.log('  ' + c.gray('Learn: ') + c.yellow('learn · lesson <id> · quiz <id> · review'));
  console.log('  ' + c.gray('Build: ') + c.yellow('challenge <id> · lab <id> · decide <id> · design <id>') + c.gray('   ← hands-on'));
  console.log('  ' + c.gray('Track: ') + c.yellow('map · list · progress · plan · help'));
  console.log();
}
