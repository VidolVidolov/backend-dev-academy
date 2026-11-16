// map.ts — the whole journey on one screen: every phase, every step type,
// where you are, and what's next. This is the answer to "what do I actually
// do in this academy, and in what order?"

import { c, hr, box, symbols } from '../ui.ts';
import { phases } from '../../curriculum/index.ts';
import { journey, nextAction, describeAction } from '../next.ts';
import type { StepKind } from '../next.ts';
import type { ProgressState } from '../store.ts';

const KIND_LABEL: Record<StepKind, string> = {
  read: c.gray('lesson '),
  quiz: c.blue('quiz   '),
  challenge: c.yellow('code   '),
  lab: c.magenta('lab    '),
  decide: c.cyan('decide '),
  design: c.cyan('design '),
  graduate: c.green('grad   '),
};

export function map(state: ProgressState): void {
  const steps = journey(state);
  const next = nextAction(state);

  console.log('\n' + box('Journey Map'));
  console.log(c.gray('  The whole path in order. ') + symbols.arrow + c.gray(' marks your next step;'));
  console.log(c.gray('  lessons/quizzes/challenges gate the path, the rest is your craft practice.\n'));

  const phaseIds = [...phases.map((p) => p.id), 'grad'];
  for (const pid of phaseIds) {
    const phaseSteps = steps.filter((s) => s.phaseId === pid);
    if (phaseSteps.length === 0) continue;
    const title = pid === 'grad'
      ? '🎓 Graduation — OrderFlow (Postgres · Redis · Kafka)'
      : phases.find((p) => p.id === pid)!.title;
    const done = phaseSteps.filter((s) => s.done).length;

    const phaseMark = done === phaseSteps.length ? symbols.done : done > 0 ? symbols.active : symbols.todo;
    console.log(`${phaseMark} ${c.bold(c.cyan(title))} ${c.gray(`${done}/${phaseSteps.length}`)}`);

    // Collapse fully-done phases to a single line to keep the map scannable.
    if (done === phaseSteps.length) { console.log(c.gray('     complete\n')); continue; }

    for (const s of phaseSteps) {
      const here = Boolean(next && s.kind === next.kind && s.id === next.id && s.phaseId === next.phaseId);
      const mark = s.done ? symbols.done : here ? c.cyan(symbols.arrow) : symbols.todo;
      const label = KIND_LABEL[s.kind] || '       ';
      const extra = s.progress && !s.done ? c.gray(` (${s.progress})`) : '';
      const line = `   ${mark} ${label} ${s.done ? c.gray(s.title) : s.title}${extra}`;
      console.log(here ? line + c.cyan('   ← you are here') : line);
    }
    console.log();
  }

  console.log(hr());
  if (next) {
    console.log('  ' + symbols.arrow + ' ' + c.bold(describeAction(next)!));
    console.log('  ' + c.gray('Run: ') + c.yellow(next.command) + '\n');
  } else {
    console.log('  ' + symbols.done + c.green(' Everything is complete. You are, formally, dangerous. 🎓\n'));
  }
}
