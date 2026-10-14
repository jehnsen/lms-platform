/**
 * FR-4.5 (US-18): final grades in the shape the Student Information System
 * takes, and the records that cannot go, each with its reason.
 *
 * Q-18: the SIS and its file format are not chosen yet. The columns below are
 * a common shape for a grade import; change `SIS_GRADE_COLUMNS` and
 * `sisGradeRows` when the real format is known.
 */
import { gradeOnScale, gradePoints } from "@/lib/grading";
import type { Course, GradingScale, Section, Term, User } from "@/lib/types";
import type { CourseTotal } from "./gradebook";

/** One student's final grade in one course, before it is checked. */
export interface SisGradeCandidate {
  student: Pick<User, "id" | "name" | "sisId">;
  term: Pick<Term, "id" | "name"> | undefined;
  course: Pick<Course, "id" | "code" | "title">;
  section: Pick<Section, "code"> | undefined;
  /** The total as staff see it, unreleased marks included. */
  total: CourseTotal;
  scale: GradingScale;
}

export interface SisGradeRecord {
  /** Student and course, to match a rejection from the SIS back to its record. */
  key: string;
  term: string;
  courseCode: string;
  sectionCode: string;
  studentSisId: string;
  studentName: string;
  percent: number;
  /** The grade on the course's scale: "87%", "B+" or "3.3". */
  grade: string;
  gradePoints: number | null;
}

export interface SisFailure {
  key: string;
  studentName: string;
  studentSisId: string;
  courseCode: string;
  sectionCode: string;
  reason: string;
}

export interface SisExportPlan {
  ready: SisGradeRecord[];
  failed: SisFailure[];
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Why this grade cannot be exported. Empty when it can. */
export function sisProblems(candidate: SisGradeCandidate): string[] {
  const problems: string[] = [];
  const { counts, percent } = candidate.total;
  if (!candidate.student.sisId?.trim()) problems.push("The account has no SIS ID.");
  if (!candidate.section) problems.push("The student is not in a section of this course.");
  if (percent === null) problems.push("Nothing is graded yet, so there is no final grade.");
  if (counts.toMark > 0) {
    problems.push(`${plural(counts.toMark, "item is", "items are")} handed in and not marked yet.`);
  }
  if (counts.unreleased > 0) {
    problems.push(`${plural(counts.unreleased, "mark has", "marks have")} not been released to the student.`);
  }
  return problems;
}

/** Sorts candidates into records ready to send and records that failed, with every reason. */
export function planSisExport(candidates: SisGradeCandidate[]): SisExportPlan {
  const plan: SisExportPlan = { ready: [], failed: [] };
  for (const candidate of candidates) {
    const key = `${candidate.student.id}:${candidate.course.id}`;
    const common = {
      key,
      studentName: candidate.student.name,
      studentSisId: candidate.student.sisId?.trim() ?? "",
      courseCode: candidate.course.code,
      sectionCode: candidate.section?.code ?? "",
    };
    const problems = sisProblems(candidate);
    const { percent } = candidate.total;
    if (problems.length > 0 || percent === null) {
      plan.failed.push({ ...common, reason: problems.join(" ") });
      continue;
    }
    plan.ready.push({
      ...common,
      term: candidate.term?.name ?? "",
      percent,
      grade: gradeOnScale(percent, candidate.scale),
      gradePoints: gradePoints(percent, candidate.scale),
    });
  }
  return plan;
}

/** Moves the records the SIS itself turned down from `ready` to `failed`. */
export function applySisRejections(
  plan: SisExportPlan,
  rejections: Array<{ key: string; reason: string }>,
): SisExportPlan {
  const reasons = new Map(rejections.map((rejection) => [rejection.key, rejection.reason]));
  return {
    ready: plan.ready.filter((record) => !reasons.has(record.key)),
    failed: [
      ...plan.failed,
      ...plan.ready
        .filter((record) => reasons.has(record.key))
        .map((record) => ({
          key: record.key,
          studentName: record.studentName,
          studentSisId: record.studentSisId,
          courseCode: record.courseCode,
          sectionCode: record.sectionCode,
          reason: reasons.get(record.key) ?? "",
        })),
    ],
  };
}

export const SIS_GRADE_COLUMNS = [
  "term",
  "course_code",
  "section_code",
  "student_id",
  "student_name",
  "final_percent",
  "final_grade",
  "grade_points",
] as const;

/** The export file: a header row, then one row for each grade. */
export function sisGradeRows(records: SisGradeRecord[]): string[][] {
  return [
    [...SIS_GRADE_COLUMNS],
    ...records.map((record) => [
      record.term,
      record.courseCode,
      record.sectionCode,
      record.studentSisId,
      record.studentName,
      String(record.percent),
      record.grade,
      record.gradePoints === null ? "" : record.gradePoints.toFixed(1),
    ]),
  ];
}

/** The failed records as a file, so they can be put right and exported again. */
export function sisFailureRows(failed: SisFailure[]): string[][] {
  return [
    ["course_code", "section_code", "student_id", "student_name", "reason"],
    ...failed.map((failure) => [
      failure.courseCode,
      failure.sectionCode,
      failure.studentSisId,
      failure.studentName,
      failure.reason,
    ]),
  ];
}
