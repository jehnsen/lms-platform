"use client";

import { useSyncExternalStore } from "react";
import type { LessonPlan, QuizAttempt } from "@/lib/types";

/**
 * The learner's progress. There is no backend yet, so this lives in
 * localStorage; swap the load/save pair for API calls when one exists.
 */
export interface LearnerState {
  completedLessons: string[];
  attempts: QuizAttempt[];
  /** In-video checkpoint id -> whether the first answer was correct. */
  checkpoints: Record<string, boolean>;
  savedPlans: LessonPlan[];
}

const STORAGE_KEY = "lumen-lms:learner:v1";

/** Starting state so the dashboard and gradebook aren't empty on first run. */
const SEED: LearnerState = {
  completedLessons: [
    "ml-learning-from-data",
    "ml-supervised-unsupervised",
    "ml-short-history",
    "web-how-web-works",
  ],
  attempts: [
    {
      id: "seed-1",
      quizId: "ml-quiz-1",
      earned: 8,
      possible: 10,
      percent: 80,
      submittedAt: "2026-10-02T09:30:00.000Z",
    },
    {
      id: "seed-2",
      quizId: "web-quiz-1",
      earned: 6,
      possible: 10,
      percent: 60,
      submittedAt: "2026-10-06T15:10:00.000Z",
    },
    {
      id: "seed-3",
      quizId: "web-quiz-1",
      earned: 9,
      possible: 10,
      percent: 90,
      submittedAt: "2026-10-08T16:45:00.000Z",
    },
  ],
  checkpoints: {
    "cp-ml-1a": true,
    "cp-ml-1b": true,
    "cp-ml-2a": false,
    "cp-web-1a": true,
  },
  savedPlans: [],
};

let state: LearnerState = SEED;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...SEED, ...(JSON.parse(raw) as Partial<LearnerState>) };
  } catch {
    // Unreadable or blocked storage: keep the seed state.
  }
}

function commit(next: LearnerState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: progress still works for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  hydrate();
  return state;
}

function getServerSnapshot() {
  return SEED;
}

export function useLearner() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const learner = {
  setLessonComplete(lessonId: string, complete: boolean) {
    const current = getSnapshot();
    const has = current.completedLessons.includes(lessonId);
    if (has === complete) return;
    commit({
      ...current,
      completedLessons: complete
        ? [...current.completedLessons, lessonId]
        : current.completedLessons.filter((id) => id !== lessonId),
    });
  },

  recordAttempt(attempt: QuizAttempt) {
    const current = getSnapshot();
    commit({ ...current, attempts: [...current.attempts, attempt] });
  },

  /** Only the first answer to a checkpoint counts towards participation. */
  recordCheckpoint(checkpointId: string, correct: boolean) {
    const current = getSnapshot();
    if (checkpointId in current.checkpoints) return;
    commit({ ...current, checkpoints: { ...current.checkpoints, [checkpointId]: correct } });
  },

  savePlan(plan: LessonPlan) {
    const current = getSnapshot();
    const others = current.savedPlans.filter((saved) => saved.id !== plan.id);
    commit({ ...current, savedPlans: [plan, ...others] });
  },

  deletePlan(planId: string) {
    const current = getSnapshot();
    commit({ ...current, savedPlans: current.savedPlans.filter((plan) => plan.id !== planId) });
  },

  reset() {
    commit(SEED);
  },
};
