"use client";

/**
 * Grades service (Epic D): the class gradebook, how a course is graded
 * (categories, weights, scale), holding and releasing quiz scores, and the
 * grades a student or a parent sees.
 *
 * Backend seam: `GET /courses/:id/gradebook`, `GET|PUT /courses/:id/gradebook/setup`,
 * `POST /quizzes/:id/grades/hold`, `POST /quizzes/:id/grades/release`,
 * `GET /users/:id/grades`. The server works the totals out itself with the
 * rules in `src/lib/domain/gradebook.ts`, and never sends a student, or a
 * parent, a score that has not been released.
 */
import { useMemo } from "react";
import { forStudent, latestByStudent } from "@/lib/domain/assignments";
import {
  attemptsForLearner,
  averageOf,
  courseGrade,
  defaultSetup,
  gradeItems,
  setupProblems,
  type CourseGrade,
  type CourseTotal,
  type GradeItem,
  type ItemScore,
} from "@/lib/domain/gradebook";
import { can } from "@/lib/domain/permissions";
import { findScale } from "@/lib/grading";
import { bestAttempt } from "@/lib/progress";
import type {
  Assignment,
  Course,
  Enrollment,
  GradeCategory,
  GradebookSetup,
  GradingScale,
  LearnerProgress,
  Quiz,
  SchoolSettings,
  Section,
  Submission,
  User,
} from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRepository } from "./_repository";
import {
  assignmentsRepo,
  enrollmentsRepo,
  gradebookSetupsRepo,
  progressRepo,
  quizzesRepo,
  sectionsRepo,
  settingsRepo,
  submissionsRepo,
} from "./_stores";
import { useCourseRoster } from "./courses";
import { notify } from "./notifications";
import { EMPTY_PROGRESS, useViewedLearner, type ViewedLearner } from "./progress";
import { authorize, recordAudit, useActor } from "./session";

/** A gradebook change the rules do not allow, with every reason. */
export class GradebookError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "GradebookError";
  }
}

// --- The records grades are worked out from ---------------------------------------

/** Everything a grade depends on. Read once and handed to the rules, in hooks and in actions alike. */
export interface GradeData {
  quizzes: Quiz[];
  assignments: Assignment[];
  submissions: Submission[];
  progress: Record<string, LearnerProgress>;
  setups: Record<string, GradebookSetup>;
  settings: SchoolSettings;
  sections: Section[];
  enrollments: Enrollment[];
}

export function readGradeData(): GradeData {
  return {
    quizzes: quizzesRepo.get(),
    assignments: assignmentsRepo.get(),
    submissions: submissionsRepo.get(),
    progress: progressRepo.get(),
    setups: gradebookSetupsRepo.get(),
    settings: settingsRepo.get(),
    sections: sectionsRepo.get(),
    enrollments: enrollmentsRepo.get(),
  };
}

export function useGradeData(): GradeData {
  const quizzes = useRepository(quizzesRepo);
  const assignments = useRepository(assignmentsRepo);
  const submissions = useRepository(submissionsRepo);
  const progress = useRepository(progressRepo);
  const setups = useRepository(gradebookSetupsRepo);
  const settings = useRepository(settingsRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  return useMemo(
    () => ({ quizzes, assignments, submissions, progress, setups, settings, sections, enrollments }),
    [quizzes, assignments, submissions, progress, setups, settings, sections, enrollments],
  );
}

/** How a course is graded: what its teachers saved, or the default until they do. */
export function setupOf(courseId: string, data: Pick<GradeData, "setups" | "settings">): GradebookSetup {
  return data.setups[courseId] ?? defaultSetup(courseId, data.settings.defaultScaleId);
}

export interface StudentCourseGrade extends CourseGrade {
  setup: GradebookSetup;
  scale: GradingScale;
  /** The section of this course the student is in. */
  section: Section | undefined;
  /** The student's latest hand-in for each assignment, as this audience may see it. */
  latest: Record<string, Submission>;
}

/**
 * One student's grade in one course. `learner` is what the student and a
 * parent get: released grades only (US-17). `staff` is everything.
 */
export function studentCourseGrade(
  data: GradeData,
  courseId: string,
  studentId: string,
  audience: "learner" | "staff",
  nowMs: number,
): StudentCourseGrade {
  const setup = setupOf(courseId, data);
  const courseSections = data.sections.filter((section) => section.courseId === courseId);
  const sectionIds = data.enrollments
    .filter((entry) => entry.userId === studentId && courseSections.some((section) => section.id === entry.sectionId))
    .map((entry) => entry.sectionId);

  let attempts = (data.progress[studentId] ?? EMPTY_PROGRESS).attempts;
  let submissions = data.submissions.filter(
    (submission) => submission.studentId === studentId && submission.courseId === courseId,
  );
  if (audience === "learner") {
    attempts = attemptsForLearner(attempts, setup.heldQuizIds);
    submissions = submissions.map((submission) =>
      forStudent(submission, { similarityVisible: data.settings.similarityVisibleToStudents }),
    );
  }

  const grade = courseGrade({
    courseId,
    quizzes: data.quizzes,
    assignments: data.assignments,
    setup,
    studentId,
    sectionIds,
    attempts,
    submissions,
    now: new Date(nowMs).toISOString(),
  });

  const latest: Record<string, Submission> = {};
  for (const item of grade.items) {
    if (item.kind !== "assignment") continue;
    const mine = latestByStudent(submissions.filter((submission) => submission.assignmentId === item.id))[studentId];
    if (mine) latest[item.id] = mine;
  }
  return {
    ...grade,
    setup,
    scale: findScale(data.settings, setup.scaleId),
    section: courseSections.find((section) => sectionIds.includes(section.id)),
    latest,
  };
}

// --- The class gradebook (US-16) --------------------------------------------------

export interface GradebookEntry {
  student: User;
  section: Section | undefined;
  progress: LearnerProgress;
  scores: ItemScore[];
  total: CourseTotal;
}

/** How the class stands on one grade item, and whether its grades have reached the students. */
export interface ItemSummary {
  item: GradeItem;
  /** Students it applies to. */
  expected: number;
  graded: number;
  toMark: number;
  /** Graded, and not yet visible to the student. */
  unreleased: number;
  /** Quizzes: the teacher is holding the scores back. */
  held: boolean;
}

export interface Gradebook {
  setup: GradebookSetup;
  scale: GradingScale;
  /** The school's scales, to choose from. */
  scales: GradingScale[];
  items: GradeItem[];
  summaries: ItemSummary[];
  entries: GradebookEntry[];
  /** May set the course up and hold or release grades. False for admins and in an archived course. */
  canEdit: boolean;
}

/**
 * A course's gradebook: every enrolled student with a score for each grade
 * item and a running total. `null` unless the signed-in user may see it.
 */
export function useGradebook(courseId: string): Gradebook | null {
  const actor = useActor();
  const roster = useCourseRoster(courseId);
  const data = useGradeData();
  const now = useNow();
  return useMemo(() => {
    if (!roster) return null;
    const setup = setupOf(courseId, data);
    const items = gradeItems(courseId, data.quizzes, data.assignments, setup.categories);
    const entries = roster.students.map((student): GradebookEntry => {
      const grade = studentCourseGrade(data, courseId, student.id, "staff", now);
      return {
        student,
        section: grade.section ?? roster.sections.find((section) => section.id === roster.sectionOf[student.id]),
        progress: data.progress[student.id] ?? EMPTY_PROGRESS,
        scores: grade.scores,
        total: grade.total,
      };
    });
    const summaries = items.map((item, index): ItemSummary => {
      const scores = entries.map((entry) => entry.scores[index]).filter((score) => score.state !== "exempt");
      return {
        item,
        expected: scores.length,
        graded: scores.filter((score) => score.state === "graded").length,
        toMark: scores.filter((score) => score.state === "to-mark").length,
        unreleased: scores.filter((score) => score.unreleased).length,
        held: item.kind === "quiz" && setup.heldQuizIds.includes(item.id),
      };
    });
    return {
      setup,
      scale: findScale(data.settings, setup.scaleId),
      scales: data.settings.gradingScales,
      items,
      summaries,
      entries,
      canEdit: can(actor, "update", { type: "gradebook", courseId }),
    };
  }, [actor, roster, data, courseId, now]);
}

/** The categories a quiz or an assignment of this course can count in, for the builders. */
export function useGradeCategories(courseId: string | undefined): GradeCategory[] {
  const setups = useRepository(gradebookSetupsRepo);
  const settings = useRepository(settingsRepo);
  return useMemo(() => (courseId ? setupOf(courseId, { setups, settings }).categories : []), [courseId, setups, settings]);
}

/** The grading scale a course reports on. */
export function useCourseScale(courseId: string | undefined): GradingScale {
  const setups = useRepository(gradebookSetupsRepo);
  const settings = useRepository(settingsRepo);
  return useMemo(() => findScale(settings, courseId ? setups[courseId]?.scaleId : undefined), [courseId, setups, settings]);
}

/** FR-4.3: true while the teacher is holding this quiz's scores back from students. */
export function useQuizGradesHeld(courseId: string, quizId: string): boolean {
  const setups = useRepository(gradebookSetupsRepo);
  return setups[courseId]?.heldQuizIds.includes(quizId) ?? false;
}

export interface GradebookSetupInput {
  categories: GradeCategory[];
  scaleId: string;
  missingAsZero: boolean;
  /** The category chosen for each quiz and assignment, by item id. */
  itemCategories: Record<string, string>;
}

/**
 * US-16: saves a course's categories, weights, scale and missing-work rule.
 * Refused unless the weights total 100%. Grades are worked out from what is
 * stored each time they are shown, so every total follows at once.
 */
export async function saveGradebookSetup(courseId: string, input: GradebookSetupInput): Promise<void> {
  authorize("update", { type: "gradebook", courseId });
  const settings = settingsRepo.get();
  const categories = input.categories.map((category) => ({ ...category, name: category.name.trim() }));
  const problems = setupProblems(
    { categories, scaleId: input.scaleId },
    settings.gradingScales.map((scale) => scale.id),
  );
  if (problems.length > 0) throw new GradebookError(problems);

  const valid = (categoryId: string | undefined) => categories.some((category) => category.id === categoryId);
  const move = <T extends { id: string; courseId: string; categoryId?: string }>(record: T): T => {
    const chosen = input.itemCategories[record.id];
    if (record.courseId !== courseId || !valid(chosen) || record.categoryId === chosen) return record;
    return { ...record, categoryId: chosen };
  };
  quizzesRepo.update((quizzes) => quizzes.map(move));
  assignmentsRepo.update((assignments) => assignments.map(move));

  const previous = gradebookSetupsRepo.get()[courseId];
  gradebookSetupsRepo.update((setups) => ({
    ...setups,
    [courseId]: {
      courseId,
      categories,
      scaleId: input.scaleId,
      missingAsZero: input.missingAsZero,
      heldQuizIds: previous?.heldQuizIds ?? [],
    },
  }));
  recordAudit({
    action: "gradebook.setup",
    resource: `gradebook:${courseId}`,
    outcome: "allowed",
    detail: `${categories.map((category) => `${category.name} ${category.weight}%`).join(", ")}; ${findScale(settings, input.scaleId).name}; missing work ${input.missingAsZero ? "counts as zero" : "is left out"}`,
  });
}

/**
 * FR-4.3: holds a quiz's scores back from students, or releases them. On
 * release every student with a score is notified (US-17). Returns how many
 * were told.
 */
export async function setQuizGradesHeld(quizId: string, held: boolean): Promise<number> {
  const quiz = quizzesRepo.get().find((candidate) => candidate.id === quizId);
  if (!quiz) throw new GradebookError(["This quiz no longer exists."]);
  authorize("update", { type: "gradebook", courseId: quiz.courseId });
  const setup = setupOf(quiz.courseId, { setups: gradebookSetupsRepo.get(), settings: settingsRepo.get() });
  if (setup.heldQuizIds.includes(quizId) === held) return 0;

  gradebookSetupsRepo.update((setups) => ({
    ...setups,
    [quiz.courseId]: {
      ...setup,
      heldQuizIds: held ? [...setup.heldQuizIds, quizId] : setup.heldQuizIds.filter((id) => id !== quizId),
    },
  }));

  let told = 0;
  if (!held) {
    for (const [studentId, learner] of Object.entries(progressRepo.get())) {
      if (!bestAttempt(quizId, learner.attempts)) continue;
      told += 1;
      notify({
        userId: studentId,
        category: "grades",
        title: `Grade released: ${quiz.title}`,
        body: "Your score is ready to view.",
        href: `/quizzes/${quizId}`,
      });
    }
  }
  recordAudit({
    action: held ? "quiz.hold-grades" : "quiz.release-grades",
    resource: `quiz:${quizId}`,
    outcome: "allowed",
    detail: held ? quiz.title : `${quiz.title}: ${told} ${told === 1 ? "student" : "students"} notified`,
  });
  return told;
}

/** Checks the caller may export this gradebook and records the export (NFR-3). */
export async function logGradebookExport(courseId: string, rowCount: number): Promise<void> {
  authorize("export", { type: "gradebook", courseId });
  recordAudit({
    action: "gradebook.export",
    resource: `gradebook:${courseId}`,
    outcome: "allowed",
    detail: `${rowCount} learners, CSV`,
  });
}

// --- What a student, or a parent, sees (US-17) -------------------------------------

export interface LearnerCourseGrade extends StudentCourseGrade {
  course: Course;
}

export interface ViewedGrades {
  viewed: ViewedLearner;
  /** One entry for each course the learner takes, released grades only. */
  courses: LearnerCourseGrade[];
  /** The plain average of the course totals so far. */
  overall: number | null;
  /** The school's default scale, for the average across courses. */
  overallScale: GradingScale;
}

/**
 * The grades of the learner the page is about: the signed-in student, or the
 * child a parent has selected. `null` when the role has no learner to show.
 */
export function useViewedGrades(): ViewedGrades | null | undefined {
  const viewed = useViewedLearner();
  const data = useGradeData();
  const now = useNow();
  return useMemo(() => {
    if (!viewed) return viewed;
    const courses = viewed.courses.map((course) => ({
      course,
      ...studentCourseGrade(data, course.id, viewed.learner.id, "learner", now),
    }));
    return {
      viewed,
      courses,
      overall: averageOf(courses.map((entry) => entry.total.percent)),
      overallScale: findScale(data.settings),
    };
  }, [viewed, data, now]);
}
