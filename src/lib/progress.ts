import { courseLessons, courses } from "@/lib/data/courses";
import { quizzes, quizzesForCourse } from "@/lib/data/quizzes";
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

/** The first lesson not yet completed, or the first lesson if all are done. */
export function nextLesson(course: Course, state: LearnerProgress): Lesson {
  const lessons = courseLessons(course);
  return lessons.find((lesson) => !state.completedLessons.includes(lesson.id)) ?? lessons[0];
}

export function attemptsFor(quizId: string, attempts: QuizAttempt[]) {
  return attempts.filter((attempt) => attempt.quizId === quizId);
}

/** Grades use the best attempt, as on most course platforms. */
export function bestAttempt(quizId: string, attempts: QuizAttempt[]) {
  return attemptsFor(quizId, attempts).reduce<QuizAttempt | undefined>(
    (best, attempt) => (!best || attempt.percent > best.percent ? attempt : best),
    undefined,
  );
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

export function courseGrade(course: Course, state: LearnerProgress) {
  return weightedGrade(
    quizzesForCourse(course.id).map((quiz) => ({
      weight: quiz.weight,
      percent: bestAttempt(quiz.id, state.attempts)?.percent,
    })),
  );
}

/** Quizzes belonging to the given courses (a learner only has the ones they take). */
function quizzesIn(courseList: Course[]) {
  const courseIds = courseList.map((course) => course.id);
  return quizzes.filter((quiz) => courseIds.includes(quiz.courseId));
}

export function overallGrade(state: LearnerProgress, courseList: Course[] = courses) {
  const best = quizzesIn(courseList)
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

export function pendingQuizzes(state: LearnerProgress, courseList: Course[] = courses): Quiz[] {
  return quizzesIn(courseList)
    .filter((quiz) => attemptsFor(quiz.id, state.attempts).length === 0)
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Courses the learner has started, most progress first. */
export function activeCourses(state: LearnerProgress, courseList: Course[] = courses) {
  return courseList
    .map((course) => ({ course, progress: courseProgress(course, state) }))
    .filter(({ progress }) => progress.done > 0)
    .sort((a, b) => b.progress.percent - a.progress.percent);
}
