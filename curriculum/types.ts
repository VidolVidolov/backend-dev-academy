// Shared shape definitions for curriculum content. Kept separate from
// index.ts so the per-phase files (which index.ts imports) can import these
// types without a circular import.

export interface QuizQuestion {
  q: string;
  choices: string[];
  answer: number;
  explain: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  body: string;
  quiz?: QuizQuestion[];
  challenge?: string;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Phase {
  id: string;
  title: string;
  weeks: number;
  goal: string;
  modules: Module[];
}

export interface DecisionOption {
  label: string;
  verdict: 'good' | 'ok' | 'bad';
  why: string;
}

export interface Decision {
  id: string;
  phase: string;
  title: string;
  problem: string;
  constraints: string[];
  question: string;
  options: DecisionOption[];
  recommendation: string;
  principle: string;
}

export interface Design {
  id: string;
  title: string;
  prompt: string;
  clarify: string[];
  answer: string;
}

export interface Capstone {
  id: string;
  title: string;
  blurb: string;
}

// A lesson enriched with its parent phase/module context — what
// `curriculum/index.ts`'s flattened `lessons` list holds.
export interface FlatLesson extends Lesson {
  phaseId: string;
  phaseTitle: string;
  moduleTitle: string;
}
