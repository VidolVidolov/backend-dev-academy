// cli.ts — argument parsing + command dispatch. No framework: we parse argv by
// hand (see Phase 0, lesson p0.l4). This is the whole "router" for the app.

import { load, touchStreak } from './store.ts';
import { dashboard } from './commands/dashboard.ts';
import { learn, showLesson } from './commands/learn.ts';
import { quizCommand } from './commands/quiz.ts';
import { runChallenge, listChallenges, solveChallenge, hintChallenge } from './commands/challenge.ts';
import { runLab, listLabs } from './commands/lab.ts';
import { runDecision, listDecisions } from './commands/decide.ts';
import { runDesign, listDesigns } from './commands/design.ts';
import { graduate } from './commands/graduate.ts';
import { askCommand } from './commands/ask.ts';
import { list, progress, plan, help } from './commands/misc.ts';
import { map } from './commands/map.ts';
import { review } from './commands/review.ts';
import { c } from './ui.ts';

export async function run(argv: string[]): Promise<void> {
  const [command, arg, flag] = argv;
  let state = load();
  state = touchStreak(state); // records a daily streak on any interaction

  switch (command) {
    case undefined:
    case 'dashboard':
    case 'status':
      dashboard(state);
      break;
    case 'learn':
    case 'today':
    case 'next':
      await learn(state);
      break;
    case 'lesson':
      await showLesson(state, arg);
      break;
    case 'quiz':
      await quizCommand(state, arg);
      break;
    case 'review':
      await review(state);
      break;
    case 'challenge':
      runChallenge(state, arg, flag);
      break;
    case 'challenges':
      listChallenges(state);
      break;
    case 'solve':
      solveChallenge(state, arg);
      break;
    case 'hint':
    case 'hints':
      hintChallenge(state, arg);
      break;
    case 'lab':
      if (!arg) listLabs(state);
      else runLab(state, arg, flag);
      break;
    case 'labs':
      listLabs(state);
      break;
    case 'decide':
      if (!arg) listDecisions(state);
      else await runDecision(state, arg);
      break;
    case 'decisions':
      listDecisions(state);
      break;
    case 'design':
      if (!arg) listDesigns(state);
      else runDesign(state, arg, flag);
      break;
    case 'designs':
      listDesigns(state);
      break;
    case 'graduate':
      await graduate(state, arg);
      break;
    case 'ask':
    case 'tutor':
      await askCommand(state, argv.slice(1));
      break;
    case 'map':
    case 'journey':
      map(state);
      break;
    case 'list':
    case 'curriculum':
      list(state);
      break;
    case 'progress':
    case 'stats':
      progress(state);
      break;
    case 'plan':
    case 'roadmap':
      plan(state);
      break;
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      console.log('\n' + c.red(`Unknown command: ${command}`));
      help();
  }
}
