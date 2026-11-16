// review.ts — drill the quiz questions you got WRONG. One pass through a quiz
// tells you what you didn't know; revisiting it is what makes it stick. A
// correct answer here removes the question from the pile; another miss keeps
// it (and counts how often it's bitten you).

import { c, hr, box, symbols } from '../ui.ts';
import { lessonById } from '../../curriculum/index.ts';
import { clearMiss, recordMiss } from '../store.ts';
import { createPrompter } from '../prompt.ts';
import type { ProgressState, ReviewEntry } from '../store.ts';
import type { FlatLesson, QuizQuestion } from '../../curriculum/types.ts';

interface ReviewItem {
  lessonId: string;
  qIndex: number;
  lesson: FlatLesson;
  q: QuizQuestion;
  meta: ReviewEntry;
}

export async function review(state: ProgressState): Promise<void> {
  const entries: ReviewItem[] = Object.entries(state.review || {})
    .map(([key, meta]): ReviewItem | null => {
      const sep = key.lastIndexOf(':');
      const lessonId = key.slice(0, sep);
      const qIndex = Number(key.slice(sep + 1));
      const lesson = lessonById(lessonId);
      const q = lesson?.quiz?.[qIndex];
      return q ? { lessonId, qIndex, lesson: lesson!, q, meta } : null;
    })
    .filter((e): e is ReviewItem => e !== null)
    // Most-missed first — those are your weakest spots.
    .sort((a, b) => b.meta.times - a.meta.times);

  console.log('\n' + box('Review · your missed quiz questions'));
  if (entries.length === 0) {
    console.log(c.gray('  Nothing to review — no outstanding misses. ') + symbols.done + '\n');
    return;
  }
  console.log(c.gray(`  ${entries.length} question(s) you previously missed. Answer right to retire one.\n`));

  if (!process.stdin.isTTY) {
    for (const e of entries) {
      console.log('  ' + symbols.todo + ' ' + c.gray(`[${e.lessonId}]`) + ' ' + e.q.q +
        c.gray(`  (missed ${e.meta.times}x)`));
    }
    console.log('\n  ' + c.gray('Run in an interactive terminal to drill them.\n'));
    return;
  }

  const p = createPrompter();
  let retired = 0;
  for (const e of entries) {
    console.log(c.gray(`  ${e.lesson.title} · missed ${e.meta.times}x`));
    console.log(c.bold(`  ${e.q.q}`));
    e.q.choices.forEach((choice, idx) => console.log(`     ${c.yellow(idx + 1)}. ${choice}`));
    let pick = NaN;
    while (Number.isNaN(pick) || pick < 1 || pick > e.q.choices.length) {
      const raw = await p.ask('  > ');
      pick = parseInt(raw, 10);
    }
    if (pick - 1 === e.q.answer) {
      retired++;
      clearMiss(state, e.lessonId, e.qIndex);
      console.log('  ' + symbols.done + c.green(' Correct — retired from review. ') + c.gray(e.q.explain) + '\n');
    } else {
      recordMiss(state, e.lessonId, e.qIndex);
      console.log('  ' + c.red('✗ Missed again. ') + c.gray('Answer: ') +
        c.green(`${e.q.answer + 1}. ${e.q.choices[e.q.answer]}`));
      console.log('  ' + c.gray(e.q.explain) + '\n');
    }
  }
  p.close();

  console.log(hr());
  const remaining = Object.keys(state.review || {}).length;
  console.log(`  Retired ${c.green(retired)} of ${entries.length} · ${remaining ? c.yellow(remaining + ' still in the pile') : c.green('pile empty 🎉')}`);
  console.log();
}
