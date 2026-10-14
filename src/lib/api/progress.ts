"use client";

/**
 * Learner progress service: completed lessons, quiz attempts and in-video
 * checkpoint answers, stored per user.
 *
 * Backend seam: `GET /users/:id/progress`, `POST /lessons/:id/completion`,
 * `POST /quizzes/:id/attempts`, `POST /checkpoints/:id/answers`.
 */
import { useMemo } from "react";
import { courses as courseCatalogue } from "@/lib/data/courses";
import { seedProgress } from "@/lib/data/directory";
import { can } from "@/lib/domain/permissions";
import type { Course, LearnerProgress, QuizAttempt, User } from "@/lib/types";
import { useRepository } from "./_repository";
import {
  enrollmentsRepo,
  progressRepo,
  sectionsRepo,
  usersRepo,
  viewedChildRepo,
} from "./_stores";
import { authorize, authorizeOwn, getActor, recordAudit, useActor } from "./session";
import { useLinkedChildren } from "./users";

export const EMPTY_PROGRESS: LearnerProgress = { completedLessons: [], attempts: [], checkpoints: {} };

/** The signed-in user's own progress. Empty for roles that do not learn. */
export function useMyProgress(): LearnerProgress {
  const actor = useActor();
  const all = useRepository(progressRepo);
  return (actor && all[actor.id]) || EMPTY_PROGRESS;
}

/** May the signed-in user record progress (complete lessons, answer checkpoints)? */
export function useCanTrackProgress(): boolean {
  const actor = useActor();
  return can(actor, "update", { type: "progress", ownerId: actor?.id });
}

export interface ViewedLearner {
  learner: User;
  progress: LearnerProgress;
  /** The courses this learner is enrolled in. */
  courses: Course[];
  /** True when looking at someone else's record (a parent viewing a child). */
  readOnly: boolean;
  /** Linked children to choose between, for parents with more than one. */
  children: User[];
}

/**
 * Whose grades the learner pages show: the student themselves, or the child a
 * parent has selected (US-05). `null` when the role has no learner to show.
 */
export function useViewedLearner(): ViewedLearner | null | undefined {
  const actor = useActor();
  const users = useRepository(usersRepo);
  const all = useRepository(progressRepo);
  const selection = useRepository(viewedChildRepo);
  const children = useLinkedChildren();

  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);

  return useMemo(() => {
    if (actor === undefined) return undefined;
    if (!actor) return null;

    const describe = (learner: User, readOnly: boolean): ViewedLearner => {
      const sectionIds = enrollments
        .filter((entry) => entry.userId === learner.id)
        .map((entry) => entry.sectionId);
      const courseIds = sections
        .filter((section) => sectionIds.includes(section.id))
        .map((section) => section.courseId);
      return {
        learner,
        progress: all[learner.id] ?? EMPTY_PROGRESS,
        courses: courseCatalogue.filter((course) => courseIds.includes(course.id)),
        readOnly,
        children,
      };
    };

    const self = users.find((user) => user.id === actor.id);
    if (self && can(actor, "view", { type: "grades", ownerId: actor.id })) return describe(self, false);

    const child = children.find((candidate) => candidate.id === selection[actor.id]) ?? children[0];
    if (child && can(actor, "view", { type: "grades", ownerId: child.id })) return describe(child, true);
    return null;
  }, [actor, users, all, selection, children, sections, enrollments]);
}

/** Parent only: switch which linked child is shown. */
export async function selectViewedChild(childId: string): Promise<void> {
  const actor = authorize("view", { type: "grades", ownerId: childId });
  viewedChildRepo.update((current) => ({ ...current, [actor.id]: childId }));
}

/**
 * Reads one learner's progress after a permission check. A student asking for
 * another student's record is refused and the attempt is logged (US-03).
 */
export async function getProgress(userId: string, courseId?: string): Promise<LearnerProgress> {
  authorize("view", { type: "progress", ownerId: userId, courseId });
  return progressRepo.get()[userId] ?? EMPTY_PROGRESS;
}

/** Changes the signed-in learner's own progress. Refused in an archived course (FR-1.8). */
function updateMine(courseId: string, change: (progress: LearnerProgress) => LearnerProgress) {
  const actor = authorize("update", { type: "progress", ownerId: getActor()?.id, courseId });
  progressRepo.update((all) => {
    const current = all[actor.id] ?? EMPTY_PROGRESS;
    const next = change(current);
    return next === current ? all : { ...all, [actor.id]: next };
  });
}

export async function setLessonComplete(courseId: string, lessonId: string, complete: boolean): Promise<void> {
  updateMine(courseId, (progress) => {
    if (progress.completedLessons.includes(lessonId) === complete) return progress;
    return {
      ...progress,
      completedLessons: complete
        ? [...progress.completedLessons, lessonId]
        : progress.completedLessons.filter((id) => id !== lessonId),
    };
  });
}

export async function recordAttempt(attempt: QuizAttempt, courseId: string): Promise<void> {
  authorize("submit", { type: "quiz", courseId });
  updateMine(courseId, (progress) => ({ ...progress, attempts: [...progress.attempts, attempt] }));
}

/** Only the first answer to a checkpoint counts towards participation. */
export async function recordCheckpoint(courseId: string, checkpointId: string, correct: boolean): Promise<void> {
  updateMine(courseId, (progress) =>
    checkpointId in progress.checkpoints
      ? progress
      : { ...progress, checkpoints: { ...progress.checkpoints, [checkpointId]: correct } },
  );
}

/** Demo helper: return the signed-in learner's progress to its starting state. */
export async function resetMyProgress(): Promise<void> {
  const actor = authorizeOwn("update", "progress");
  progressRepo.update((all) => ({ ...all, [actor.id]: seedProgress[actor.id] ?? EMPTY_PROGRESS }));
  recordAudit({ action: "progress.reset", resource: `progress:${actor.id}`, outcome: "allowed" });
}
