import { c, hr, renderMarkdown, symbols } from '../ui.ts';
import { lessonById, lessonIndex, lessons, isLessonUnlocked, isLessonComplete, nextLesson } from '../../curriculum/index.ts';
import { markLessonRead } from '../store.ts';
import { runQuiz } from './quiz.ts';
import { challenges } from '../../challenges/registry.ts';
import type { ProgressState } from '../store.ts';

// Render a single lesson, mark it read, and offer its quiz/challenge.
export async function showLesson(state: ProgressState, id: string, { interactive = true } = {}): Promise<void> {
  const lesson = lessonById(id);
  if (!lesson) {
    console.log(c.red(`Unknown lesson: ${id}`));
    return;
  }

  // Sequential gating: no skipping ahead.
  if (!isLessonUnlocked(state, id)) {
    const blocker = lessons.slice(0, lessonIndex(id)).find((l) => !isLessonComplete(state, l));
    console.log('\n  ' + symbols.locked + c.yellow(`  "${lesson.title}" is locked.`));
    console.log('  ' + c.gray('Lessons unlock in order: read the previous one, pass its quiz, AND beat its challenge.'));
    if (blocker) {
      console.log('  ' + symbols.arrow + ' First finish: ' + c.cyan(`${blocker.id} — ${blocker.title}`));
      if (!state.lessons[blocker.id]) {
        console.log('    ' + c.gray('Read it: ') + c.yellow(`academy lesson ${blocker.id}`));
      } else if (blocker.quiz?.length && !state.quizzes[blocker.id]?.passedAt) {
        console.log('    ' + c.gray('Pass its quiz: ') + c.yellow(`academy quiz ${blocker.id}`));
      } else if (blocker.challenge && !state.challenges[blocker.challenge]?.passedAt) {
        console.log('    ' + c.gray('Beat its challenge: ') + c.yellow(`academy challenge ${blocker.challenge}`));
      }
      console.log('    ' + c.gray('Stuck or confused? ') + c.yellow(`academy ask ${blocker.id}`));
    }
    console.log();
    return;
  }

  console.log('\n' + c.gray(`${lesson.phaseTitle}  ›  ${lesson.moduleTitle}`));
  console.log(c.gray(`${symbols.arrow} ${lesson.id} · ~${lesson.minutes} min read\n`));
  console.log(renderMarkdown(lesson.body));
  console.log('\n' + hr());

  markLessonRead(state, id);
  console.log('  ' + symbols.done + c.green(' Marked as read.'));

  if (lesson.challenge && challenges[lesson.challenge]) {
    console.log('  ' + symbols.arrow + ' Coding challenge: ' + c.yellow(`academy challenge ${lesson.challenge}`) +
      c.gray(`  (${challenges[lesson.challenge].title})`));
  }

  if (interactive && lesson.quiz?.length && process.stdin.isTTY) {
    const { createPrompter } = await import('../prompt.ts');
    const p = createPrompter();
    const ans = (await p.ask('\n  Take the ' + c.cyan(`${lesson.quiz.length}-question quiz`) + ' now? [Y/n] ')).toLowerCase();
    if (ans === '' || ans === 'y' || ans === 'yes') {
      await runQuiz(state, id, p);
    }
    p.close();
  } else if (lesson.quiz?.length) {
    console.log('  ' + symbols.arrow + ' Quiz available: ' + c.yellow(`academy quiz ${lesson.id}`) + c.gray(' (passing it unlocks the next lesson)'));
  }
  console.log('  ' + c.gray('Questions about this lesson? Ask the AI tutor: ') + c.yellow(`academy ask ${lesson.id}`));
  console.log();
}

// "learn" = jump to the first INCOMPLETE lesson (unread, or quiz not passed).
export async function learn(state: ProgressState): Promise<void> {
  const next = nextLesson(state);
  if (!next) {
    console.log('\n' + symbols.done + c.green(' Every lesson complete! Grind ') + c.yellow('labs · decisions · designs') + c.green(' and then ') + c.yellow('academy graduate') + '\n');
    return;
  }
  // Already read but quiz not passed -> the quiz IS the blocker; go straight to it.
  if (state.lessons[next.id] && next.quiz?.length && !state.quizzes[next.id]?.passedAt) {
    console.log('\n  ' + symbols.active + c.yellow(`  You've read "${next.title}" but haven't passed its quiz yet.`));
    console.log('  ' + c.gray('That quiz gates the next lesson.'));
    if (process.stdin.isTTY) {
      await runQuiz(state, next.id);
    } else {
      console.log('  ' + symbols.arrow + ' ' + c.yellow(`academy quiz ${next.id}`));
    }
    console.log('  ' + c.gray('Confused by a question? Ask the tutor: ') + c.yellow(`academy ask ${next.id}`) + '\n');
    return;
  }
  // Read + quiz done, but the coding challenge is the blocker.
  if (state.lessons[next.id] && next.challenge && !state.challenges[next.challenge]?.passedAt) {
    console.log('\n  ' + symbols.active + c.yellow(`  "${next.title}" — the coding challenge is what's left.`));
    console.log('  ' + c.gray('It gates the next lesson. Reading about backend isn\'t backend; go build it:'));
    console.log('  ' + symbols.arrow + ' ' + c.yellow(`academy challenge ${next.challenge}`));
    console.log('  ' + c.gray('Stuck? ') + c.yellow(`academy ask ${next.id}`) + c.gray(' or, after a real attempt, ') + c.yellow(`academy solve ${next.challenge}`) + '\n');
    return;
  }
  await showLesson(state, next.id);
}
