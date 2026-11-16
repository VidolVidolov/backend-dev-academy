// next.ts — the unified next-action engine.
//
// The academy has six activity types (lessons, quizzes, challenges, labs,
// decisions, designs) plus graduation, but only lessons/quizzes/challenges
// used to participate in "what's next". Labs, decisions and designs were
// side quests you had to discover on your own. This module fixes that: it
// flattens the whole journey into ONE ordered list of steps, phase by phase —
//   lessons (read → quiz → challenge) → the phase's labs → its decisions →
//   its designs → … → graduation —
// so every surface (dashboard, map, learn) can point at the single next thing.

import { phases, isLessonComplete } from '../curriculum/index.ts';
import { labList } from '../labs/registry.ts';
import { decisions } from '../curriculum/decisions.ts';
import { designs } from '../curriculum/designs.ts';
import { gradStages } from './commands/graduate.ts';
import type { ProgressState } from './store.ts';
import type { Lesson } from '../curriculum/types.ts';

// Designs carry no phase field — they are the system-design practice attached
// to Phase 6 (the framework they use is taught in p6.l3).
const DESIGN_PHASE = 'p6';

export type StepKind = 'read' | 'quiz' | 'challenge' | 'lab' | 'decide' | 'design' | 'graduate';

/**
 * A single step in the unified journey.
 *   done:    has the user completed it?
 *   command: the exact CLI invocation to work on it
 *   gate:    true if this step blocks later LESSONS (lesson/quiz/challenge do;
 *            labs/decisions/designs are strongly recommended but non-blocking)
 */
export interface Step {
  kind: StepKind;
  id: string;
  title: string;
  phaseId: string;
  done: boolean;
  command: string;
  gate: boolean;
  progress?: string;
}

/** The full journey as an ordered list of steps. */
export function journey(state: ProgressState): Step[] {
  const steps: Step[] = [];

  for (const phase of phases) {
    for (const module of phase.modules) {
      for (const lesson of module.lessons) {
        steps.push({
          kind: 'read', id: lesson.id, title: lesson.title, phaseId: phase.id,
          done: Boolean(state.lessons[lesson.id]),
          command: `academy lesson ${lesson.id}`, gate: true,
        });
        if (lesson.quiz?.length) {
          steps.push({
            kind: 'quiz', id: lesson.id, title: `Quiz — ${lesson.title}`, phaseId: phase.id,
            done: Boolean(state.quizzes[lesson.id]?.passedAt),
            command: `academy quiz ${lesson.id}`, gate: true,
          });
        }
        if (lesson.challenge) {
          steps.push({
            kind: 'challenge', id: lesson.challenge, title: `Challenge — ${lesson.challenge}`, phaseId: phase.id,
            done: Boolean(state.challenges[lesson.challenge]?.passedAt),
            command: `academy challenge ${lesson.challenge}`, gate: true,
          });
        }
      }
    }

    // The phase's hands-on follow-ups, in a sensible order: build, then judge,
    // then whiteboard.
    for (const lab of labList.filter((l) => l.phase === phase.id)) {
      const passed = state.labs?.[lab.id]?.milestonesPassed?.length || 0;
      steps.push({
        kind: 'lab', id: lab.id, title: lab.title, phaseId: phase.id,
        done: passed === lab.milestones.length,
        progress: `${passed}/${lab.milestones.length}`,
        command: `academy lab ${lab.id}`, gate: false,
      });
    }
    for (const d of decisions.filter((d) => d.phase === phase.id)) {
      steps.push({
        kind: 'decide', id: d.id, title: d.title, phaseId: phase.id,
        done: Boolean(state.decisions?.[d.id]),
        command: `academy decide ${d.id}`, gate: false,
      });
    }
    if (phase.id === DESIGN_PHASE) {
      for (const d of designs) {
        steps.push({
          kind: 'design', id: d.id, title: d.title, phaseId: phase.id,
          done: Boolean(state.designs?.[d.id]?.revealedAt),
          command: `academy design ${d.id}`, gate: false,
        });
      }
    }
  }

  for (const s of gradStages) {
    steps.push({
      kind: 'graduate', id: s.id, title: s.name, phaseId: 'grad',
      done: state.graduation?.stagesPassed?.includes(s.id) || false,
      command: 'academy graduate', gate: false,
    });
  }

  return steps;
}

/**
 * The ONE thing to do next: the first not-done step in journey order.
 * Returns null when everything (graduation included) is complete.
 */
export function nextAction(state: ProgressState): Step | null {
  return journey(state).find((s) => !s.done) || null;
}

// Human phrasing for a step, used by the dashboard and map footer.
export function describeAction(step: Step | null): string | null {
  if (!step) return null;
  const verbs: Record<StepKind, string> = {
    read: 'Read', quiz: 'Pass the quiz for', challenge: 'Beat', lab: 'Build',
    decide: 'Work the decision', design: 'Whiteboard', graduate: 'Graduation stage:',
  };
  return `${verbs[step.kind]} ${step.title}`;
}

// Does the same lesson own this step? Used to group lesson/quiz/challenge rows.
export function lessonComplete(state: ProgressState, lesson: Lesson): boolean {
  return isLessonComplete(state, lesson);
}
