import { c, hr, box, symbols, renderMarkdown } from '../ui.ts';
import { designs } from '../../curriculum/designs.ts';
import { save } from '../store.ts';
import type { ProgressState } from '../store.ts';

export function listDesigns(state: ProgressState): void {
  console.log('\n' + box('System Design Practice'));
  console.log(c.gray('  Whiteboard each for 45 min out loud, THEN reveal the model answer.\n'));
  for (const d of designs) {
    const st = state.designs?.[d.id];
    const mark = st?.revealedAt ? symbols.done : st?.startedAt ? symbols.active : symbols.todo;
    console.log(`  ${mark} ${c.yellow(d.id)}  ${c.bold(d.title)}`);
  }
  console.log('\n  ' + c.gray('Start one: ') + c.yellow('academy design sd1') +
    c.gray('  · model answer: ') + c.yellow('academy design sd1 --reveal') + '\n');
}

export function runDesign(state: ProgressState, id: string, flag?: string): void {
  const d = designs.find((x) => x.id === id);
  if (!d) {
    console.log(c.red(`Unknown design: ${id}`));
    listDesigns(state);
    return;
  }

  state.designs = state.designs || {};
  const st = (state.designs[id] = state.designs[id] || {});

  if (flag === '--reveal') {
    console.log('\n' + box(`Model answer · ${d.title}`));
    console.log(renderMarkdown(d.answer));
    console.log('\n' + hr());
    console.log('  ' + c.gray('Now diff it against YOUR whiteboard: what did you miss, what did you'));
    console.log('  ' + c.gray('reason differently about, and was your version defensible anyway?'));
    st.revealedAt = new Date().toISOString();
    save(state);
    console.log();
    return;
  }

  console.log('\n' + box(`Design · ${d.title}`));
  console.log('\n' + c.bold('  The prompt'));
  console.log(d.prompt.split('\n').map((l) => '  ' + l).join('\n'));
  console.log('\n' + c.bold('  Questions a senior asks before drawing anything'));
  for (const q of d.clarify) console.log('  ' + symbols.bullet + ' ' + q);
  console.log('\n' + hr());
  console.log(c.bold('  The framework (from lesson p6.l3)'));
  const steps = [
    'Clarify functional + non-functional requirements',
    'Back-of-envelope estimates (QPS, storage, bandwidth)',
    'API design',
    'Data model + store choice (justified)',
    'High-level architecture',
    'Deep-dive the hard part',
    'Bottlenecks, failure modes, scaling each tier',
  ];
  steps.forEach((s, i) => console.log(`   ${c.yellow(i + 1)}. ${s}`));
  console.log('\n  ' + symbols.arrow + c.bold(' Set a 45-minute timer. Whiteboard it OUT LOUD.'));
  console.log('  ' + c.gray('Then: ') + c.yellow(`academy design ${id} --reveal`) + c.gray(' and diff your reasoning.'));
  st.startedAt = st.startedAt || new Date().toISOString();
  save(state);
  console.log();
}
