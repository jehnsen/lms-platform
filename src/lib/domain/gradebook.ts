/**
 * The gradebook rules (Epic D): categories and weights (FR-4.1), the course
 * total (FR-4.2), what a student may see before grades are released (FR-4.3)
 * and the figures on a progress report (FR-4.4).
 *
 * A course total is worked out in two steps with the same weighted average:
 * each category from its items, weighted by their points, then the course from
 * its categories, weighted by the category weights. Nothing here reads the
 * clock or storage, so the server can use the same rules.
 */
import { gradePoints, quizPoints } from "@/lib/grading";
import { attemptsFor, bestAttempt, weightedAverage, weightedGrade } from "@/lib/progress";
import type {
  Assignment,
  GradeCategory,
  GradebookSetup,
  GradingScale,
  Quiz,
  QuizAttempt,
  Submission,
} from "@/lib/types";
import { latestByStudent } from "./assignments";

// --- Categories and weights (US-16, FR-4.1) ------------------------------------

/** The category a quiz or an assignment counts in when it has not been given one. */
export const DEFAULT_CATEGORY_IDS = { quiz: "cat-quizzes", assignment: "cat-assignments" } as const;

/** Q-17: how a course is graded until its teacher sets it up. */
export function defaultSetup(courseId: string, scaleId: string): GradebookSetup {
  return {
    courseId,
    categories: [
      { id: DEFAULT_CATEGORY_IDS.assignment, name: "Assignments", weight: 50 },
      { id: DEFAULT_CATEGORY_IDS.quiz, name: "Quizzes", weight: 50 },
    ],
    scaleId,
    missingAsZero: false,
    heldQuizIds: [],
  };
}

/** The category weights added up, to two decimal places. */
export function weightTotal(categories: Pick<GradeCategory, "weight">[]) {
  const sum = categories.reduce((total, category) => total + (Number.isFinite(category.weight) ? category.weight : 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Why a gradebook setup cannot be saved. Empty when it can. US-16: the
 * category weights must total 100% before it is saved.
 */
export function setupProblems(setup: Pick<GradebookSetup, "categories" | "scaleId">, scaleIds: string[]): string[] {
  const problems: string[] = [];
  const { categories } = setup;
  if (categories.length === 0) {
    problems.push("Add at least one category.");
    return problems;
  }
  const names = categories.map((category) => category.name.trim());
  if (names.some((name) => name === "")) problems.push("Give every category a name.");
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (key && seen.has(key) && !problems.some((problem) => problem.includes(`"${name}"`))) {
      problems.push(`Two categories are called "${name}". Give each its own name.`);
    }
    seen.add(key);
  }
  if (categories.some((category) => !Number.isFinite(category.weight) || category.weight <= 0 || category.weight > 100)) {
    problems.push("Every category needs a weight above 0%, and no more than 100%.");
  }
  const total = weightTotal(categories);
  if (total !== 100) {
    problems.push(`The category weights total ${total}%. They must total 100% before the gradebook can be saved.`);
  }
  if (!scaleIds.includes(setup.scaleId)) problems.push("Choose a grading scale.");
  return problems;
}

/** The category an item counts in: its own, else the usual one for its kind, else the first. */
export function categoryIdFor(
  kind: "quiz" | "assignment",
  categoryId: string | undefined,
  categories: Pick<GradeCategory, "id">[],
): string {
  if (categories.some((category) => category.id === categoryId)) return categoryId!;
  const usual = DEFAULT_CATEGORY_IDS[kind];
  return categories.some((category) => category.id === usual) ? usual : (categories[0]?.id ?? "");
}

// --- Grade items ----------------------------------------------------------------

/** One column of the gradebook: a published quiz or assignment. */
export interface GradeItem {
  id: string;
  kind: "quiz" | "assignment";
  title: string;
  /** The most it can earn. Inside a category, items count in proportion to this. */
  points: number;
  /** A date (due at the end of that day) or a date-time. */
  due: string;
  categoryId: string;
  /** Quizzes: the percent needed to pass. */
  passMark?: number;
  /** Assignments: the sections it is set for. Students in other sections are exempt. */
  sectionIds?: string[];
}

/** The published quizzes and assignments of a course as grade items, soonest due first. */
export function gradeItems(
  courseId: string,
  quizzes: Quiz[],
  assignments: Assignment[],
  categories: Pick<GradeCategory, "id">[],
): GradeItem[] {
  const items: GradeItem[] = [
    ...quizzes
      .filter((quiz) => quiz.courseId === courseId && quiz.status === "published")
      .map((quiz): GradeItem => ({
        id: quiz.id,
        kind: "quiz",
        title: quiz.title,
        points: quizPoints(quiz),
        due: quiz.due,
        categoryId: categoryIdFor("quiz", quiz.categoryId, categories),
        passMark: quiz.passMark,
      })),
    ...assignments
      .filter((assignment) => assignment.courseId === courseId && assignment.status === "published")
      .map((assignment): GradeItem => ({
        id: assignment.id,
        kind: "assignment",
        title: assignment.title,
        points: assignment.points,
        due: assignment.dueAt,
        categoryId: categoryIdFor("assignment", assignment.categoryId, categories),
        sectionIds: assignment.sectionIds,
      })),
  ];
  return items.sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
}

/** True once the due moment has gone by. A date with no time is due at the end of that day. */
export function isPastDue(due: string, now: string) {
  return due.length <= 10 ? now.slice(0, 10) > due : Date.parse(now) > Date.parse(due);
}

// --- One student's scores -------------------------------------------------------

export type ItemState =
  /** It has a score, and the score counts. */
  | "graded"
  /** Handed in; a teacher has not marked it, or (as a student sees it) has not released the mark. */
  | "to-mark"
  /** A quiz the student has taken whose score is held back. Only ever seen by the student or a parent. */
  | "held"
  /** Not handed in, and the due date has passed. */
  | "missing"
  /** Not handed in, and not due yet. */
  | "upcoming"
  /** An assignment that is not set for this student's section. It never counts. */
  | "exempt";

export interface ItemScore {
  item: GradeItem;
  state: ItemState;
  /** Percent of the item's points earned, when graded. */
  percent: number | null;
  /** Points earned out of `item.points`, when graded. */
  earned: number | null;
  /** Graded, but the student cannot see it yet. Only staff are ever given such a score. */
  unreleased: boolean;
}

export interface ScoreInput {
  items: GradeItem[];
  studentId: string;
  /** The sections of this course the student is in. */
  sectionIds: string[];
  /** The student's quiz attempts. */
  attempts: QuizAttempt[];
  /** Hand-ins; other students' are ignored. */
  submissions: Submission[];
  /** Quizzes whose scores are held back from students (FR-4.3). */
  heldQuizIds: string[];
  /** ISO date-time. */
  now: string;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor + 1e-9) / factor;
}

/** Where one student stands on every grade item. The best quiz attempt and the latest hand-in count. */
export function scoreItems(input: ScoreInput): ItemScore[] {
  const own = input.submissions.filter((submission) => submission.studentId === input.studentId);
  return input.items.map((item): ItemScore => {
    const blank = { item, percent: null, earned: null, unreleased: false };
    const notHandedIn = isPastDue(item.due, input.now) ? "missing" : "upcoming";

    if (item.kind === "quiz") {
      const mine = attemptsFor(item.id, input.attempts);
      const best = bestAttempt(item.id, input.attempts);
      if (best) {
        return {
          item,
          state: "graded",
          percent: best.percent,
          earned: roundTo((item.points * best.percent) / 100, 2),
          unreleased: input.heldQuizIds.includes(item.id),
        };
      }
      if (mine.some((attempt) => attempt.status === "held")) return { ...blank, state: "held" };
      return { ...blank, state: mine.length > 0 ? "to-mark" : notHandedIn };
    }

    if (!item.sectionIds?.some((sectionId) => input.sectionIds.includes(sectionId))) return { ...blank, state: "exempt" };
    const latest = latestByStudent(own.filter((submission) => submission.assignmentId === item.id))[input.studentId];
    if (!latest) return { ...blank, state: notHandedIn };
    if (!latest.grade || !(item.points > 0)) return { ...blank, state: "to-mark" };
    return {
      item,
      state: "graded",
      percent: roundTo((latest.grade.points / item.points) * 100, 1),
      earned: latest.grade.points,
      unreleased: latest.grade.releasedAt === undefined,
    };
  });
}

// --- The course total (FR-4.2) --------------------------------------------------

export interface CategoryTotal {
  category: GradeCategory;
  /** Whole percent; `null` while nothing in the category counts yet. */
  percent: number | null;
  /** Items that apply to this student, and how many of them count so far. */
  items: number;
  counted: number;
}

export interface CourseTotal {
  /** The running total as a whole percent; `null` until something counts. */
  percent: number | null;
  categories: CategoryTotal[];
  counts: {
    graded: number;
    toMark: number;
    held: number;
    missing: number;
    upcoming: number;
    /** Staff only: graded items the student cannot see yet. */
    unreleased: number;
  };
}

/**
 * The course grade from one student's scores. A category with nothing graded
 * drops out and the others share its weight, so the total is always "the
 * grade so far". Work that is missing is left out too, unless the course counts
 * it as zero.
 */
export function courseTotal(
  setup: Pick<GradebookSetup, "categories" | "missingAsZero">,
  scores: ItemScore[],
): CourseTotal {
  const applies = scores.filter((score) => score.state !== "exempt");
  const counted = (score: ItemScore) =>
    score.state === "graded" ? score.percent : score.state === "missing" && setup.missingAsZero ? 0 : null;

  const exact: Array<{ weight: number; percent: number | null }> = [];
  const categories = setup.categories.map((category): CategoryTotal => {
    const mine = applies.filter((score) => score.item.categoryId === category.id);
    const parts = mine.map((score) => ({ weight: score.item.points, percent: counted(score) }));
    exact.push({ weight: category.weight, percent: weightedAverage(parts) });
    return {
      category,
      percent: weightedGrade(parts),
      items: mine.length,
      counted: parts.filter((part) => part.percent !== null && part.weight > 0).length,
    };
  });

  const count = (state: ItemState) => applies.filter((score) => score.state === state).length;
  return {
    percent: weightedGrade(exact),
    categories,
    counts: {
      graded: count("graded"),
      toMark: count("to-mark"),
      held: count("held"),
      missing: count("missing"),
      upcoming: count("upcoming"),
      unreleased: applies.filter((score) => score.unreleased).length,
    },
  };
}

export interface CourseGrade {
  items: GradeItem[];
  scores: ItemScore[];
  total: CourseTotal;
}

/** Everything about one student's grade in one course, from the raw records. */
export function courseGrade(input: {
  courseId: string;
  quizzes: Quiz[];
  assignments: Assignment[];
  setup: GradebookSetup;
  studentId: string;
  sectionIds: string[];
  attempts: QuizAttempt[];
  submissions: Submission[];
  now: string;
}): CourseGrade {
  const items = gradeItems(input.courseId, input.quizzes, input.assignments, input.setup.categories);
  const scores = scoreItems({
    items,
    studentId: input.studentId,
    sectionIds: input.sectionIds,
    attempts: input.attempts,
    submissions: input.submissions,
    heldQuizIds: input.setup.heldQuizIds,
    now: input.now,
  });
  return { items, scores, total: courseTotal(input.setup, scores) };
}

// --- What a student may see (US-17, FR-4.3) -------------------------------------

/**
 * A learner's quiz attempts as the learner, or a parent, may see them: an
 * attempt at a quiz whose scores are held back keeps only the fact that it was
 * handed in. Returns the same array when nothing is held, so callers can
 * compare by identity.
 */
export function attemptsForLearner(attempts: QuizAttempt[], heldQuizIds: string[]): QuizAttempt[] {
  if (!attempts.some((attempt) => heldQuizIds.includes(attempt.quizId))) return attempts;
  return attempts.map((attempt) =>
    heldQuizIds.includes(attempt.quizId)
      ? {
          id: attempt.id,
          quizId: attempt.quizId,
          earned: 0,
          possible: attempt.possible,
          percent: 0,
          submittedAt: attempt.submittedAt,
          startedAt: attempt.startedAt,
          autoSubmitted: attempt.autoSubmitted,
          status: "held",
        }
      : attempt,
  );
}

// --- Across courses (FR-4.4) -----------------------------------------------------

/** The plain average of the course totals that exist; `null` when none does. */
export function averageOf(percents: Array<number | null>): number | null {
  const known = percents.filter((percent): percent is number => percent !== null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, percent) => sum + percent, 0) / known.length + 1e-9);
}

export interface TermSummary {
  /** Courses with a grade so far, out of all the student takes in the term. */
  graded: number;
  courses: number;
  average: number | null;
  /** Mean grade points over the graded courses, to two places. `null` without a GPA scale. Q-50: courses count equally. */
  gpa: number | null;
}

/** The summary line of a progress report: one student's courses in one term. */
export function termSummary(percents: Array<number | null>, gpaScale: GradingScale | undefined): TermSummary {
  const known = percents.filter((percent): percent is number => percent !== null);
  const points = gpaScale
    ? known.map((percent) => gradePoints(percent, gpaScale)).filter((value): value is number => value !== null)
    : [];
  return {
    graded: known.length,
    courses: percents.length,
    average: averageOf(percents),
    gpa: points.length === 0 ? null : roundTo(points.reduce((sum, value) => sum + value, 0) / points.length, 2),
  };
}

/** A percent for display: at most one decimal place, and none when it is whole. */
export function formatPercent(percent: number) {
  return `${Number(percent.toFixed(1))}%`;
}
