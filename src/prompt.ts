// prompt.ts — tiny readline wrapper for interactive quizzes/menus.
import readline from 'node:readline';

export interface Prompter {
  ask: (q: string) => Promise<string>;
  close: () => void;
}

export function createPrompter(): Prompter {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (q: string) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim()))),
    close: () => rl.close(),
  };
}
