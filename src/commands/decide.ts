import { c, hr, box, symbols } from '../ui.ts';
import { decisions } from '../../curriculum/decisions.ts';
import { phases } from '../../curriculum/index.ts';
import { createPrompter } from '../prompt.ts';
import type { ProgressState } from '../store.ts';

const phaseTitle = (pid: string): string => phases.find((p) => p.id === pid)?.title || pid;
const verdictTag: Record<string, string> = {
  good: c.green('★ strong call'),
  ok: c.yellow('~ defensible'),
  bad: c.red('✗ weak call'),
};

export function listDecisions(state: ProgressState): void {
  console.log('\n' + box('Architecture Decision Scenarios'));
  console.log(c.gray('  Real problems. You make the call, then see how a senior reasons.\n'));
  for (const d of decisions) {
    const done = state.decisions?.[d.id] ? symbols.done : symbols.todo;
    console.log(`  ${done} ${c.yellow(d.id)}  ${c.bold(d.title)}`);
    console.log('       ' + c.gray(phaseTitle(d.phase)));
  }
  console.log('\n  ' + c.gray('Run one: ') + c.yellow('academy decide <id>') + c.gray('   e.g. academy decide d1') + '\n');
}

export async function runDecision(state: ProgressState, id: string): Promise<void> {
  const d = decisions.find((x) => x.id === id);
  if (!d) {
    console.log(c.red(`Unknown scenario: ${id}`));
    listDecisions(state);
    return;
  }

  console.log('\n' + box(`Decision · ${d.title}`));
  console.log(c.gray('  ' + phaseTitle(d.phase)) + '\n');
  console.log(c.bold('  The problem'));
  wrap(d.problem);
  console.log('\n' + c.bold('  Constraints'));
  for (const con of d.constraints) console.log('  ' + symbols.bullet + ' ' + con);
  console.log('\n' + hr());
  console.log(c.bold(c.cyan('  ' + d.question)) + '\n');
  d.options.forEach((o, i) => console.log(`   ${c.yellow(i + 1)}. ${o.label}`));

  // Interactive: let them commit to an answer first (thinking beats reading).
  let picked: number | null = null;
  if (process.stdin.isTTY) {
    const p = createPrompter();
    console.log(c.gray('\n  Commit to a choice before revealing the analysis.'));
    const raw = await p.ask('  Your call [1-' + d.options.length + ', or Enter to just reveal] ');
    p.close();
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= d.options.length) picked = n - 1;
  }

  console.log('\n' + hr());
  console.log(c.bold('  Analysis'));
  d.options.forEach((o, i) => {
    const mark = picked === i ? c.cyan('→ you') : '     ';
    console.log(`\n  ${mark} ${c.yellow(i + 1)}. ${o.label}  ${verdictTag[o.verdict]}`);
    wrap(o.why, 8);
  });

  console.log('\n' + hr());
  console.log(c.bold(c.green('  What a senior would do')));
  wrap(d.recommendation);
  console.log('\n' + c.bold(c.magenta('  Principle')));
  wrap(d.principle);

  if (picked !== null) {
    const v = d.options[picked]!.verdict;
    console.log('\n' + (v === 'good'
      ? '  ' + symbols.done + c.green(' You picked a strong option. Now read WHY the others are weaker — that\'s the real skill.')
      : v === 'ok'
        ? '  ' + c.yellow('~ Defensible pick — but see the stronger option and what it buys you.')
        : '  ' + c.red('✗ That option has a real flaw — reread its analysis and the principle.')));
  }

  state.decisions = state.decisions || {};
  state.decisions[id] = { reviewedAt: new Date().toISOString(), picked };
  const { save } = await import('../store.ts');
  save(state);
  console.log();
}

function wrap(text: string, indent = 2): void {
  const width = 76 - indent;
  const pad = ' '.repeat(indent);
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    if ((line + w).length > width) { console.log(pad + line.trimEnd()); line = ''; }
    line += w + ' ';
  }
  if (line.trim()) console.log(pad + line.trimEnd());
}
