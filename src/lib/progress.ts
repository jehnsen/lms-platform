import { courseLessons } from "@/lib/domain/course-outline";
import { isFinal } from "@/lib/domain/quizzes";
import type { Course, LearnerProgress, Lesson, Quiz, QuizAttempt } from "@/lib/types";

export function courseProgress(course: Course, state: LearnerProgress) {
  const lessons = courseLessons(course);
  const done = lessons.filter((lesson) => state.completedLessons.includes(lesson.id)).length;
  return {
    done,
    total: lessons.length,
    percent: lessons.length === 0 ? 0 : Math.round((done / lessons.length) * 100),
  };
}

/**
 * The first lesson not yet completed, or the first lesson if all are done.
 * `undefined` for a course with no lessons to show yet.
 */
export function nextLesson(course: Course, state: LearnerProgress): Lesson | undefined {
  const lessons = courseLessons(course);
  return lessons.find((lesson) => !state.completedLessons.includes(lesson.id)) ?? lessons[0];
}

/** Every attempt handed in for a quiz, including any still waiting for a teacher to mark. */
export function attemptsFor(quizId: string, attempts: QuizAttempt[]) {
  return attempts.filter((attempt) => attempt.quizId === quizId);
}

/**
 * Grades use the best attempt, as on most course platforms. An attempt that
 * is still waiting for a teacher's marks has no final score, so it does not
 * count until it is marked (US-12).
 */
export function bestAttempt(quizId: string, attempts: QuizAttempt[]) {
  return attemptsFor(quizId, attempts)
    .filter(isFinal)
    .reduce<QuizAttempt | undefined>(
      (best, attempt) => (!best || attempt.percent > best.percent ? attempt : best),
      undefined,
    );
}

/** True when the student has handed in an attempt that a teacher has not finished marking. */
export function awaitingMarking(quizId: string, attempts: QuizAttempt[]) {
  return attemptsFor(quizId, attempts).some((attempt) => !isFinal(attempt));
}

/** FR-4.3: what is holding up a quiz score, for the student it belongs to. `null` when nothing is. */
export function pendingReason(quizId: string, attempts: QuizAttempt[]): "marking" | "release" | null {
  const mine = attemptsFor(quizId, attempts);
  if (mine.some((attempt) => attempt.status === "awaiting-marking")) return "marking";
  if (mine.some((attempt) => attempt.status === "held")) return "release";
  return null;
}

export interface WeightedItem {
  weight: number;
  /** `null` or `undefined`: nothing to count yet, so the item is left out. */
  percent: number | null | undefined;
}

/**
 * The weighted average of the items that have a score; `null` until one has.
 * Weights are shares of whatever is graded so far, so they need not total 100:
 * the same rule works out a category from its items (weighted by points) and a
 * course from its categories (FR-4.1, FR-4.2).
 */
export function weightedAverage(items: WeightedItem[]): number | null {
  let weightSum = 0;
  let total = 0;
  for (const item of items) {
    if (item.percent === null || item.percent === undefined || !(item.weight > 0)) continue;
    weightSum += item.weight;
    total += item.weight * item.percent;
  }
  return weightSum === 0 ? null : total / weightSum;
}

/** `weightedAverage`, rounded to a whole percent for display. */
export function weightedGrade(items: WeightedItem[]): number | null {
  const average = weightedAverage(items);
  // The small nudge keeps 89.5 from landing on 89 when the sum was a hair short in floating point.
  return average === null ? null : Math.round(average + 1e-9);
}

/** The quizzes of one course, from a list the caller may see. */
export function quizzesOf(courseId: string, quizzes: Quiz[]) {
  return quizzes.filter((quiz) => quiz.courseId === courseId);
}

/** Quizzes belonging to the given courses (a learner only has the ones they take). */
function quizzesIn(courseList: Course[], quizzes: Quiz[]) {
  const courseIds = courseList.map((course) => course.id);
  return quizzes.filter((quiz) => courseIds.includes(quiz.courseId));
}

export function checkpointStats(state: LearnerProgress) {
  const results = Object.values(state.checkpoints);
  const correct = results.filter(Boolean).length;
  return {
    answered: results.length,
    correct,
    percent: results.length === 0 ? null : Math.round((correct / results.length) * 100),
  };
}

/** Quizzes not attempted yet, soonest due first. */
export function pendingQuizzes(state: LearnerProgress, courseList: Course[], quizzes: Quiz[]): Quiz[] {
  return quizzesIn(courseList, quizzes)
    .filter((quiz) => attemptsFor(quiz.id, state.attempts).length === 0)
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Courses the learner has started, most progress first. */
export function activeCourses(state: LearnerProgress, courseList: Course[]) {
  return courseList
    .map((course) => ({ course, progress: courseProgress(course, state) }))
    .filter(({ progress }) => progress.done > 0)
    .sort((a, b) => b.progress.percent - a.progress.percent);
}
