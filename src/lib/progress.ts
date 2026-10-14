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

/** Weighted average of the quizzes graded so far; null until one is graded. */
export function weightedGrade(items: Array<{ weight: number; percent: number | null | undefined }>) {
  let weightSum = 0;
  let total = 0;
  for (const item of items) {
    if (item.percent === null || item.percent === undefined) continue;
    weightSum += item.weight;
    total += item.weight * item.percent;
  }
  return weightSum === 0 ? null : Math.round(total / weightSum);
}

/** The quizzes of one course, from a list the caller may see. */
export function quizzesOf(courseId: string, quizzes: Quiz[]) {
  return quizzes.filter((quiz) => quiz.courseId === courseId);
}

export function courseGrade(course: Course, state: LearnerProgress, quizzes: Quiz[]) {
  return weightedGrade(
    quizzesOf(course.id, quizzes).map((quiz) => ({
      weight: quiz.weight,
      percent: bestAttempt(quiz.id, state.attempts)?.percent,
    })),
  );
}

/** Quizzes belonging to the given courses (a learner only has the ones they take). */
function quizzesIn(courseList: Course[], quizzes: Quiz[]) {
  const courseIds = courseList.map((course) => course.id);
  return quizzes.filter((quiz) => courseIds.includes(quiz.courseId));
}

export function overallGrade(state: LearnerProgress, courseList: Course[], quizzes: Quiz[]) {
  const best = quizzesIn(courseList, quizzes)
    .map((quiz) => bestAttempt(quiz.id, state.attempts)?.percent)
    .filter((percent): percent is number => percent !== undefined);
  if (best.length === 0) return null;
  return Math.round(best.reduce((sum, percent) => sum + percent, 0) / best.length);
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
