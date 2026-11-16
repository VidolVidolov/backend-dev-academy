import { c, hr, symbols } from '../ui.ts';
import { lessonById, isLessonUnlocked } from '../../curriculum/index.ts';
import { recordQuiz, recordMiss, clearMiss } from '../store.ts';
import { createPrompter } from '../prompt.ts';
import type { ProgressState } from '../store.ts';
import type { Prompter } from '../prompt.ts';

// Run the quiz attached to a lesson. Accepts an existing prompter (from learn)
// or creates its own.
export async function runQuiz(state: ProgressState, lessonId: string, prompter?: Prompter): Promise<void> {
  const lesson = lessonById(lessonId);
  if (!lesson?.quiz?.length) {
    console.log(c.yellow(`No quiz for ${lessonId}.`));
    return;
  }
  const ownPrompter = !prompter;
  const p = prompter || createPrompter();

  console.log('\n' + c.bold(c.cyan(`Quiz — ${lesson.title}`)));
  console.log(c.gray('  Pass mark: 70%. Answer with the option number.\n'));

  let correct = 0;
  for (let i = 0; i < lesson.quiz.length; i++) {
    const q = lesson.quiz[i]!;
    console.log(c.bold(`  Q${i + 1}. ${q.q}`));
    q.choices.forEach((choice, idx) => console.log(`     ${c.yellow(idx + 1)}. ${choice}`));
    let pick = NaN;
    while (Number.isNaN(pick) || pick < 1 || pick > q.choices.length) {
      const raw = await p.ask('  > ');
      pick = parseInt(raw, 10);
    }
    if (pick - 1 === q.answer) {
      correct++;
      clearMiss(state, lessonId, i); // answered right — drop it from the review pile
      console.log('  ' + symbols.done + c.green(' Correct. ') + c.gray(q.explain) + '\n');
    } else {
      recordMiss(state, lessonId, i); // remembered for `academy review`
      console.log('  ' + c.red('✗ Not quite. ') + c.gray('Answer: ') +
        c.green(`${q.answer + 1}. ${q.choices[q.answer]}`));
      console.log('  ' + c.gray(q.explain) + '\n');
    }
  }

  const passed = recordQuiz(state, lessonId, correct, lesson.quiz.length);
  console.log(hr());
  const pct = Math.round((correct / lesson.quiz.length) * 100);
  const line = `  Score: ${correct}/${lesson.quiz.length} (${pct}%) — `;
  if (passed) {
    const challengePending = lesson.challenge && !state.challenges[lesson.challenge]?.passedAt;
    console.log(line + c.green('PASSED ' + symbols.done) +
      (challengePending
        ? c.yellow(`  → now beat the challenge to unlock the next lesson: `) + c.yellow(`academy challenge ${lesson.challenge}`)
        : c.green('  → next lesson unlocked')));
  } else {
    console.log(line + c.red('not yet — this quiz gates the next lesson'));
    console.log('  ' + c.gray('Reread the lesson (') + c.yellow(`academy lesson ${lessonId}`) + c.gray('), or ask the tutor: ') + c.yellow(`academy ask ${lessonId}`));
  }
  console.log();

  if (ownPrompter) p.close();
}

export async function quizCommand(state: ProgressState, lessonId: string): Promise<void> {
  if (!lessonId) {
    console.log(c.yellow('Usage: academy quiz <lessonId>   e.g. academy quiz p0.l2'));
    return;
  }
  // No quizzing ahead: the lesson must be unlocked AND read first.
  if (!isLessonUnlocked(state, lessonId)) {
    console.log('\n  ' + symbols.locked + c.yellow('  That lesson is still locked — no banking quiz passes ahead.'));
    console.log('  ' + c.gray('Run ') + c.yellow('academy learn') + c.gray(' to continue from where you actually are.\n'));
    return;
  }
  if (!state.lessons[lessonId]) {
    console.log('\n  ' + c.yellow('Read the lesson before taking its quiz: ') + c.yellow(`academy lesson ${lessonId}`) + '\n');
    return;
  }
  await runQuiz(state, lessonId);
}
