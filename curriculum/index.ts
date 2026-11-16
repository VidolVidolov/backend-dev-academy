// Curriculum aggregator. Loads every phase and exposes flat lookups so the CLI
// can navigate lessons/quizzes/challenges without caring about nesting.

import p0 from './phases/phase0.ts';
import p1 from './phases/phase1.ts';
import p2 from './phases/phase2.ts';
import p3 from './phases/phase3.ts';
import p4 from './phases/phase4.ts';
import p5 from './phases/phase5.ts';
import p6 from './phases/phase6.ts';
import type { Phase, FlatLesson, Lesson, Capstone } from './types.ts';
import type { ProgressState } from '../src/store.ts';

export const phases: Phase[] = [p0, p1, p2, p3, p4, p5, p6];

// Flattened, ordered list of lessons with parent references attached.
export const lessons: FlatLesson[] = [];
for (const phase of phases) {
  for (const module of phase.modules) {
    for (const lesson of module.lessons) {
      lessons.push({ ...lesson, phaseId: phase.id, phaseTitle: phase.title, moduleTitle: module.title });
    }
  }
}

export function lessonById(id: string): FlatLesson | undefined {
  return lessons.find((l) => l.id === id);
}

export function lessonIndex(id: string): number {
  return lessons.findIndex((l) => l.id === id);
}

export function firstUnread(state: ProgressState): FlatLesson | null {
  return lessons.find((l) => !state.lessons[l.id]) || null;
}

// A lesson is COMPLETE when it has been read, its quiz (if any) is passed,
// AND its coding challenge (if any) is passed. All three gate the next lesson.
export function isLessonComplete(state: ProgressState, lesson: Lesson): boolean {
  if (!state.lessons[lesson.id]) return false;
  if (lesson.quiz?.length && !state.quizzes[lesson.id]?.passedAt) return false;
  if (lesson.challenge && !state.challenges[lesson.challenge]?.passedAt) return false;
  return true;
}

// Sequential gating: a lesson is unlocked only when every lesson before it is
// complete. The first lesson is always unlocked.
export function isLessonUnlocked(state: ProgressState, id: string): boolean {
  const idx = lessonIndex(id);
  if (idx <= 0) return idx === 0;
  return lessons.slice(0, idx).every((l) => isLessonComplete(state, l));
}

// The lesson you should be working on: the first incomplete one.
export function nextLesson(state: ProgressState): FlatLesson | null {
  return lessons.find((l) => !isLessonComplete(state, l)) || null;
}

export function totals(): { lessons: number; quizzes: number; challenges: number; phases: number } {
  const quizCount = lessons.filter((l) => l.quiz?.length).length;
  const challengeCount = lessons.filter((l) => l.challenge).length;
  return { lessons: lessons.length, quizzes: quizCount, challenges: challengeCount, phases: phases.length };
}

// Capstone projects — the portfolio you actually show employers.
export const capstones: Capstone[] = [
  {
    id: 'cap1',
    title: 'Orders API (Phases 1-3)',
    blurb: 'A production-shaped REST API: auth (argon2 + JWT refresh rotation), zod validation, Postgres with migrations & transactions, cursor pagination, idempotency keys on checkout, structured logging, rate limiting. This is your flagship.',
  },
  {
    id: 'cap2',
    title: 'Async worker + outbox (Phase 3-5)',
    blurb: 'Add BullMQ workers, the transactional outbox pattern, email/webhook delivery with retries + DLQ, and a WebSocket/SSE live order-status feed. Prove idempotency under redelivery with a test.',
  },
  {
    id: 'cap3',
    title: 'Observable, containerized, deployed (Phases 4-6)',
    blurb: 'Wrap it in Docker + docker-compose, add OpenTelemetry traces + Prometheus metrics + health/readiness probes, a GitHub Actions CI/CD pipeline with Testcontainers integration tests, and deploy to a cloud (Fly.io/Render/Cloud Run) with automated migrations.',
  },
  {
    id: 'cap4',
    title: 'System design dossier (Phase 6)',
    blurb: 'Write up 5 full system designs (URL shortener, rate limiter, news feed, chat, idempotent payments) with requirements, estimates, diagrams, and tradeoffs. This is your interview arsenal.',
  },
];
