"use client";

/**
 * Reports service (BR-16): the progress report for one student in one term
 * (FR-4.4), and the export of final grades to the Student Information System
 * (FR-4.5).
 *
 * Backend seam: `GET /reports/progress?studentId=&termId=` and
 * `POST /sis/grade-exports`. The server builds both from its own records,
 * sends the export itself with the SIS credentials, and writes the audit entry.
 */
import { useMemo } from "react";
import { mockSis } from "@/lib/adapters/sis";
import { nowIso } from "@/lib/clock";
import { courseForViewer } from "@/lib/domain/content-visibility";
import type { ReportDocument } from "@/lib/domain/analytics";
import { formatRate, type AttendanceSummary } from "@/lib/domain/attendance";
import { termSummary, type CourseTotal, type TermSummary } from "@/lib/domain/gradebook";
import { can, type Actor } from "@/lib/domain/permissions";
import {
  applySisRejections,
  planSisExport,
  type SisExportPlan,
  type SisGradeCandidate,
} from "@/lib/domain/sis-export";
import { findScale, gradeOnScale } from "@/lib/grading";
import { courseProgress } from "@/lib/progress";
import type { Course, GradingScale, Section, Term, User } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRepository } from "./_repository";
import { attendanceRepo, coursesRepo, termsRepo, usersRepo } from "./_stores";
import { courseAttendance } from "./attendance";
import { readGradeData, studentCourseGrade, useGradeData, type GradeData } from "./grades";
import { EMPTY_PROGRESS } from "./progress";
import { authorize, getActor, recordAudit, useActor } from "./session";

// --- Progress reports (FR-4.4) -----------------------------------------------------

/** The courses a student takes, from the enrolment records. */
function coursesTakenBy(studentId: string, data: GradeData, courses: Course[]): Course[] {
  const sectionIds = data.enrollments.filter((entry) => entry.userId === studentId).map((entry) => entry.sectionId);
  const courseIds = new Set(
    data.sections.filter((section) => sectionIds.includes(section.id)).map((section) => section.courseId),
  );
  return courses.filter((course) => courseIds.has(course.id));
}

/**
 * May this user see this student's grade in this course? The student, a
 * linked parent and an admin may for every course; faculty for the courses
 * they teach.
 */
function mayReport(actor: Actor | null | undefined, studentId: string, courseId: string) {
  return (
    can(actor, "view", { type: "grades", ownerId: studentId }) ||
    (actor?.role === "faculty" && can(actor, "view", { type: "grades", courseId }))
  );
}

/** The students the signed-in user can open a progress report for, by name. */
export function useReportStudents(): User[] {
  const actor = useActor();
  const users = useRepository(usersRepo);
  const courses = useRepository(coursesRepo);
  const data = useGradeData();
  return useMemo(() => {
    if (!actor) return [];
    return users
      .filter(
        (user) =>
          user.role === "student" &&
          (can(actor, "view", { type: "grades", ownerId: user.id }) ||
            coursesTakenBy(user.id, data, courses).some((course) => mayReport(actor, user.id, course.id))),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [actor, users, courses, data]);
}

export interface ReportCourse {
  course: Pick<Course, "id" | "code" | "title" | "status">;
  section: Section | undefined;
  teachers: string[];
  scale: GradingScale;
  total: CourseTotal;
  /** The total on the course's scale; `null` while nothing is graded. */
  grade: string | null;
  lessons: { done: number; total: number };
  /** FR-5.4: attendance in this course so far, and whether it is below the school's threshold. */
  attendance: { summary: AttendanceSummary; below: boolean };
}

export interface ProgressReport {
  student: User;
  term: Term;
  /** The terms this student has courses in that the viewer may see, newest first. */
  terms: Term[];
  courses: ReportCourse[];
  summary: TermSummary;
  /** The school's GPA scale, when it has one. */
  gpaScale: GradingScale | undefined;
  /** `learner`: built for the student or a parent, from released grades only. */
  audience: "learner" | "staff";
  /** Staff: marks counted here that the student cannot see yet. */
  unreleased: number;
  /** The attendance the school expects, in percent. */
  attendanceThreshold: number;
}

/**
 * FR-4.4: one student's report for one term. With no term given it is the
 * active term, or the newest the student has courses in. `null` when the
 * signed-in user may not see this student, or the student has no courses.
 */
export function useProgressReport(studentId: string | undefined, termId: string | undefined): ProgressReport | null {
  const actor = useActor();
  const users = useRepository(usersRepo);
  const catalogue = useRepository(coursesRepo);
  const allTerms = useRepository(termsRepo);
  const data = useGradeData();
  const sheets = useRepository(attendanceRepo);
  const now = useNow();

  return useMemo(() => {
    const student = users.find((user) => user.id === studentId && user.role === "student");
    if (!actor || !student) return null;
    const visible = coursesTakenBy(student.id, data, catalogue).filter((course) => mayReport(actor, student.id, course.id));
    const terms = allTerms
      .filter((term) => visible.some((course) => course.termId === term.id))
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    const term = terms.find((candidate) => candidate.id === termId) ?? terms.find((candidate) => candidate.status === "active") ?? terms[0];
    if (!term) return null;

    const audience = actor.role === "student" || actor.role === "parent" ? "learner" : "staff";
    const progress = data.progress[student.id] ?? EMPTY_PROGRESS;
    const courses = visible
      .filter((course) => course.termId === term.id)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((course): ReportCourse => {
        const grade = studentCourseGrade(data, course.id, student.id, audience, now);
        const seen = courseForViewer(course, { staff: false, sectionIds: grade.section ? [grade.section.id] : [] }, now);
        const lessons = courseProgress(seen, progress);
        return {
          course,
          section: grade.section,
          teachers: users.filter((user) => grade.section?.facultyIds.includes(user.id)).map((user) => user.name),
          scale: grade.scale,
          total: grade.total,
          grade: grade.total.percent === null ? null : gradeOnScale(grade.total.percent, grade.scale),
          lessons: { done: lessons.done, total: lessons.total },
          attendance: courseAttendance(student.id, course.id, sheets, data.settings.attendance),
        };
      });

    const gpaScale = data.settings.gradingScales.find((scale) => scale.kind === "gpa");
    return {
      student,
      term,
      terms,
      courses,
      summary: termSummary(courses.map((entry) => entry.total.percent), gpaScale),
      gpaScale,
      audience,
      unreleased: courses.reduce((sum, entry) => sum + entry.total.counts.unreleased, 0),
      attendanceThreshold: data.settings.attendance.thresholdPercent,
    };
  }, [actor, users, catalogue, allTerms, data, sheets, now, studentId, termId]);
}

/** FR-4.4: the report-card data as rows, one for each course, for a spreadsheet or another system. */
export function reportRows(report: ProgressReport): string[][] {
  const categories = [...new Set(report.courses.flatMap((entry) => entry.total.categories.map((item) => item.category.name)))];
  return [
    [
      "student_id",
      "student_name",
      "term",
      "course_code",
      "course_title",
      "section",
      "teacher",
      "percent",
      "grade",
      "scale",
      ...categories.map((name) => `${name} (%)`),
      "work_missing",
      "work_awaiting_grade",
      "lessons_done",
      "lessons_total",
      "attendance_percent",
      "sessions_absent",
      "sessions_late",
      "sessions_excused",
      "sessions_recorded",
    ],
    ...report.courses.map((entry) => [
      report.student.sisId ?? "",
      report.student.name,
      report.term.name,
      entry.course.code,
      entry.course.title,
      entry.section?.name ?? "",
      entry.teachers.join("; "),
      entry.total.percent === null ? "" : String(entry.total.percent),
      entry.grade ?? "",
      entry.scale.name,
      ...categories.map((name) => {
        const percent = entry.total.categories.find((item) => item.category.name === name)?.percent;
        return percent === null || percent === undefined ? "" : String(percent);
      }),
      String(entry.total.counts.missing),
      String(entry.total.counts.toMark + entry.total.counts.held),
      String(entry.lessons.done),
      String(entry.lessons.total),
      entry.attendance.summary.rate === null ? "" : formatRate(entry.attendance.summary.rate).replace("%", ""),
      String(entry.attendance.summary.absent),
      String(entry.attendance.summary.late),
      String(entry.attendance.summary.excused),
      String(entry.attendance.summary.recorded),
    ]),
  ];
}

/** Records that a progress report was taken out of the app (NFR-3). Refused for a student the caller may not see. */
/**
 * FR-4.4, FR-7.4: the progress report as a document for the PDF and Excel
 * exports: the summary, then the report-card rows exactly as in the CSV.
 */
export function progressReportDocument(report: ProgressReport, meta: { generatedAt: string; generatedBy: string }): ReportDocument {
  const [columns, ...rows] = reportRows(report);
  const { summary } = report;
  return {
    title: `Progress report: ${report.student.name}`,
    filters: [
      `Term: ${report.term.name}`,
      report.audience === "learner"
        ? "Released grades only"
        : report.unreleased > 0
          ? `Includes ${report.unreleased} ${report.unreleased === 1 ? "mark" : "marks"} not yet released to the student`
          : "Every mark released",
    ],
    ...meta,
    tables: [
      {
        title: "Summary",
        columns: ["Measure", "Value"],
        rows: [
          ["Student ID", report.student.sisId ?? ""],
          ["Term average (%)", summary.average ?? ""],
          ["GPA", summary.gpa === null ? "" : summary.gpa.toFixed(2)],
          ["Courses graded", `${summary.graded} of ${summary.courses}`],
          ["Attendance expected (%)", report.attendanceThreshold],
        ],
      },
      { title: "Courses", columns, rows },
    ],
  };
}

export async function logReportExport(studentId: string, termId: string, format: "CSV" | "print" | "PDF" | "Excel"): Promise<void> {
  const actor = getActor();
  // Faculty hold this permission course by course, so name one of the report's courses they teach.
  const course = coursesTakenBy(studentId, readGradeData(), coursesRepo.get()).find(
    (candidate) => candidate.termId === termId && mayReport(actor, studentId, candidate.id),
  );
  authorize("view", { type: "grades", ownerId: studentId, courseId: course?.id });
  recordAudit({
    action: "report.export",
    resource: `report:${studentId}`,
    outcome: "allowed",
    detail: `Progress report, ${termsRepo.get().find((term) => term.id === termId)?.name ?? termId}, ${format}`,
  });
}

// --- Export to the SIS (FR-4.5, US-18) ---------------------------------------------

function sisCandidates(courseIds: string[], data: GradeData, nowMs: number): SisGradeCandidate[] {
  const users = usersRepo.get();
  const terms = termsRepo.get();
  const candidates: SisGradeCandidate[] = [];
  for (const course of coursesRepo.get().filter((candidate) => courseIds.includes(candidate.id))) {
    const sectionIds = data.sections.filter((section) => section.courseId === course.id).map((section) => section.id);
    const studentIds = new Set(
      data.enrollments.filter((entry) => sectionIds.includes(entry.sectionId)).map((entry) => entry.userId),
    );
    const students = users
      .filter((user) => user.role === "student" && user.status === "active" && studentIds.has(user.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const student of students) {
      const grade = studentCourseGrade(data, course.id, student.id, "staff", nowMs);
      candidates.push({
        student,
        term: terms.find((term) => term.id === course.termId),
        course,
        section: grade.section,
        total: grade.total,
        scale: findScale(data.settings, grade.setup.scaleId),
      });
    }
  }
  return candidates;
}

/**
 * What an export of these courses would send and what it would leave out,
 * before anything is sent. `null` unless the signed-in user may export to the SIS.
 */
export function useSisExportPlan(courseIds: string[]): SisExportPlan | null {
  const actor = useActor();
  const data = useGradeData();
  // Read so the plan follows changes to people, courses and terms too.
  const users = useRepository(usersRepo);
  const courses = useRepository(coursesRepo);
  const terms = useRepository(termsRepo);
  const now = useNow();
  const key = courseIds.join("|");
  return useMemo(() => {
    void users;
    void courses;
    void terms;
    if (!can(actor, "create", { type: "sis-export" })) return null;
    return planSisExport(sisCandidates(key ? key.split("|") : [], data, now));
  }, [actor, data, users, courses, terms, now, key]);
}

export interface SisExportResult {
  /** What was sent, and every record that failed with its reason: checked here, or turned down by the SIS. */
  plan: SisExportPlan;
  /** The name of the system the grades went to. */
  system: string;
  exportedAt: string;
}

/**
 * US-18: sends the final grades of these courses to the SIS. Records that
 * cannot go are returned with the reason, and every export is written to the
 * audit log, whatever it sent.
 */
export async function exportGradesToSis(courseIds: string[], label: string): Promise<SisExportResult> {
  authorize("create", { type: "sis-export" });
  const exportedAt = nowIso();
  const checked = planSisExport(sisCandidates(courseIds, readGradeData(), Date.parse(exportedAt)));
  let plan = checked;
  let failure: string | undefined;
  try {
    const result = checked.ready.length > 0 ? await mockSis.exportGrades(checked.ready) : { accepted: 0, rejected: [] };
    plan = applySisRejections(checked, result.rejected);
  } catch {
    failure = "The SIS could not be reached, so nothing was sent.";
    plan = applySisRejections(
      checked,
      checked.ready.map((record) => ({ key: record.key, reason: failure! })),
    );
  }
  recordAudit({
    action: "grades.sis-export",
    resource: `sis-export:${label}`,
    outcome: "allowed",
    detail: `${plan.ready.length} exported, ${plan.failed.length} failed, to ${mockSis.name}${failure ? ` (${failure})` : ""}`,
  });
  return { plan, system: mockSis.name, exportedAt };
}
