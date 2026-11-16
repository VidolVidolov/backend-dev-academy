// store.ts — progress persistence. A JSON file next to the project.
// Notice the pattern: read-modify-write with a default shape. In real backend
// work you'd swap this for Postgres/Redis, but the interface stays the same —
// that's the point (repository pattern, covered in Phase 5).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', '.academy-progress.json');

export interface ReviewEntry {
  times: number;
  lastMissedAt: string;
}

export interface ProgressState {
  startedAt: string | null;
  lessons: Record<string, { readAt: string }>;
  quizzes: Record<string, { score: number; total: number; passedAt: string | null }>;
  challenges: Record<string, { passedAt: string | null; attempts: number }>;
  labs: Record<string, { milestonesPassed: string[]; updatedAt: string | null }>;
  decisions: Record<string, { reviewedAt: string; picked: number | null }>;
  designs: Record<string, { startedAt?: string; revealedAt?: string | null }>;
  graduation: { stagesPassed: string[]; url: string | null; updatedAt: string | null };
  streak: { current: number; longest: number; lastActive: string | null };
  notes: Record<string, string>;
  review?: Record<string, ReviewEntry>;
  hints?: Record<string, number>;
  solveWarned?: Record<string, boolean>;
}

const DEFAULTS: ProgressState = {
  startedAt: null,
  lessons: {},   // id -> { readAt }
  quizzes: {},   // id -> { score, total, passedAt }
  challenges: {},// id -> { passedAt, attempts }
  labs: {},      // id -> { milestonesPassed:[], updatedAt }
  decisions: {}, // id -> { reviewedAt, picked }
  designs: {},   // id -> { startedAt, revealedAt }
  graduation: { stagesPassed: [], url: null, updatedAt: null },
  streak: { current: 0, longest: 0, lastActive: null },
  notes: {},     // id -> string
};

export function load(): ProgressState {
  if (!existsSync(FILE)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(state: ProgressState): void {
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function touchStreak(state: ProgressState): ProgressState {
  const today = new Date().toISOString().slice(0, 10);
  const last = state.streak.lastActive;
  if (last === today) return state;
  if (!state.startedAt) state.startedAt = new Date().toISOString();

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak.current = last === yesterday ? state.streak.current + 1 : 1;
  state.streak.longest = Math.max(state.streak.longest, state.streak.current);
  state.streak.lastActive = today;
  save(state);
  return state;
}

export function markLessonRead(state: ProgressState, id: string): void {
  state.lessons[id] = { readAt: new Date().toISOString() };
  save(state);
}

export function recordQuiz(state: ProgressState, id: string, score: number, total: number): boolean {
  const passed = score / total >= 0.7;
  state.quizzes[id] = {
    score,
    total,
    passedAt: passed ? new Date().toISOString() : state.quizzes[id]?.passedAt || null,
  };
  save(state);
  return passed;
}

// Missed quiz questions, keyed "lessonId:questionIndex" — the raw material for
// `academy review` (retention needs revisiting, not one-shot quizzing).
export function recordMiss(state: ProgressState, lessonId: string, qIndex: number): void {
  state.review = state.review || {};
  const key = `${lessonId}:${qIndex}`;
  const prev = state.review[key] || { times: 0, lastMissedAt: '' };
  state.review[key] = { times: prev.times + 1, lastMissedAt: new Date().toISOString() };
  save(state);
}

export function clearMiss(state: ProgressState, lessonId: string, qIndex: number): void {
  const key = `${lessonId}:${qIndex}`;
  if (state.review?.[key]) {
    delete state.review[key];
    save(state);
  }
}

export function recordChallenge(state: ProgressState, id: string, passed: boolean): void {
  const prev = state.challenges[id] || { attempts: 0, passedAt: null };
  state.challenges[id] = {
    attempts: prev.attempts + 1,
    passedAt: passed ? prev.passedAt || new Date().toISOString() : prev.passedAt,
  };
  save(state);
}
