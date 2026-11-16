// ask.ts — the AI tutor. `academy ask [lessonId] [question...]`
//
// Engine order:
//   1. The `claude` CLI (Claude Code) in print mode — no API key needed.
//   2. The Anthropic API, if ANTHROPIC_API_KEY is set.
// When given a lesson id, the tutor gets the FULL lesson text as context, so
// answers are grounded in exactly what you're studying.

import { spawnSync } from 'node:child_process';
import { c, hr, box, symbols, renderMarkdown } from '../ui.ts';
import { lessonById } from '../../curriculum/index.ts';
import { createPrompter } from '../prompt.ts';
import type { ProgressState } from '../store.ts';
import type { FlatLesson } from '../../curriculum/types.ts';

let claudeOk: boolean | null = null; // cached availability
function hasClaudeCli(): boolean {
  if (claudeOk !== null) return claudeOk;
  try {
    claudeOk = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 }).status === 0;
  } catch {
    claudeOk = false;
  }
  return claudeOk;
}

const TUTOR_ROLE = `You are the AI tutor of "Backend Dev Academy" — a curriculum turning a senior
frontend developer into a senior backend/Node.js engineer. The student knows
JavaScript deeply; never explain JS basics. Explain backend concepts precisely
and practically, with small Node.js examples where they help. Be direct and
concise (under ~300 words unless the question truly needs more). If the student
is wrong, say so plainly and explain why. End with one short check-question to
confirm understanding when it fits naturally.`;

interface Turn {
  q: string;
  a: string;
}

function buildPrompt({ lesson, transcript, question }: { lesson: FlatLesson | null; transcript: Turn[]; question: string }): string {
  const parts = [TUTOR_ROLE];
  if (lesson) {
    parts.push(`\nThe student is currently studying this lesson ("${lesson.title}", id ${lesson.id}). Ground your answer in it, but go deeper when asked:\n\n---LESSON---\n${lesson.body}\n---END LESSON---`);
  }
  for (const turn of transcript) {
    parts.push(`\nStudent asked: ${turn.q}\nYou answered: ${turn.a}`);
  }
  parts.push(`\nStudent's question: ${question}\n\nAnswer as the tutor:`);
  return parts.join('\n');
}

async function generate(prompt: string): Promise<string | null> {
  if (hasClaudeCli()) {
    const res = spawnSync('claude', ['-p', prompt], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 240000,
    });
    if (res.status === 0 && res.stdout?.trim()) return res.stdout.trim();
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Anthropic API response
      const data: any = await res.json();
      return (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim();
    }
  }
  return null;
}

export async function askCommand(_state: ProgressState, args: string[]): Promise<void> {
  // Parse: first arg may be a lesson id (pN.lM); the rest is the question.
  let lesson: FlatLesson | null = null;
  let rest = [...args];
  if (rest[0] && /^p\d+\.l\d+$/.test(rest[0])) {
    lesson = lessonById(rest[0]) ?? null;
    if (!lesson) return console.log(c.red(`Unknown lesson: ${rest[0]}`));
    rest = rest.slice(1);
  }
  const question = rest.join(' ').trim();

  if (!hasClaudeCli() && !process.env.ANTHROPIC_API_KEY) {
    console.log('\n  ' + c.red('✗ No AI engine available.'));
    console.log(c.gray('    The tutor uses the `claude` CLI (Claude Code) or ANTHROPIC_API_KEY.'));
    console.log(c.gray('    Install Claude Code (https://claude.com/claude-code) or export an API key.\n'));
    return;
  }

  console.log('\n' + box('AI Tutor' + (lesson ? ` · ${lesson.title}` : '')));
  console.log(c.gray(lesson
    ? `  Grounded in lesson ${lesson.id}. Ask anything about it — or beyond it.`
    : '  General backend tutor. Tip: "academy ask p0.l2" grounds it in a lesson.'));

  const transcript: Turn[] = [];

  const answerOnce = async (q: string): Promise<boolean> => {
    process.stdout.write(c.gray('\n  thinking...'));
    const answer = await generate(buildPrompt({ lesson, transcript, question: q }));
    process.stdout.write('\r' + ' '.repeat(14) + '\r');
    if (!answer) {
      console.log('  ' + c.red('✗ The AI engine failed to answer. Try again.'));
      return false;
    }
    console.log(hr());
    console.log(renderMarkdown(answer));
    console.log(hr());
    transcript.push({ q, a: answer });
    return true;
  };

  // One-shot: question given on the command line.
  if (question) {
    await answerOnce(question);
    if (process.stdin.isTTY) {
      // fall through into the chat loop so follow-ups keep their context
    } else {
      console.log(c.gray('  Follow-ups with context: ') + c.yellow(`academy ask ${lesson ? lesson.id : ''}`.trim()) + '\n');
      return;
    }
  }

  if (!process.stdin.isTTY) {
    console.log(c.yellow('  Interactive chat needs a real terminal. Pass your question inline:'));
    console.log('  ' + c.yellow(`academy ask ${lesson ? lesson.id + ' ' : ''}<your question>`) + '\n');
    return;
  }

  // Interactive loop (transcript carries across turns).
  const p = createPrompter();
  console.log(c.gray('\n  Type your question. "exit" to leave.\n'));
  for (;;) {
    const q = await p.ask(c.cyan('  you › '));
    if (!q || ['exit', 'quit', 'q'].includes(q.toLowerCase())) break;
    await answerOnce(q);
    console.log();
  }
  p.close();
  console.log(c.gray('\n  Back to it. ') + symbols.arrow + ' ' + c.yellow('academy learn') + '\n');
}
