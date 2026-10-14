"use client";

/**
 * Analytics service (Epic G): the class dashboard (US-26), the school
 * dashboard with drill-down and the at-risk list (US-27), and the export of
 * either as PDF or Excel (US-28).
 *
 * Backend seam: `GET /analytics/classes/:courseId?sectionId=`,
 * `GET /analytics/school?termId=`, `POST /analytics/exports`. The server
 * computes these figures from its own records, at least daily (US-26), returns
 * only courses the caller may see, and produces the files itself.
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import {
  atRiskMatches,
  gradeDistribution,
  meanOf,
  usageSummary,
  type AtRiskEntry,
  type ClassRow,
  type CourseSummaryRow,
  type ReportDocument,
  type UsageSummary,
} from "@/lib/domain/analytics";
import { courseForViewer } from "@/lib/domain/content-visibility";
import { can } from "@/lib/domain/permissions";
import { gradeOnScale } from "@/lib/grading";
import { courseProgress } from "@/lib/progress";
import type { AttendanceSheet, Course, GradingScale, Section, Term, User } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRepository } from "./_repository";
import {
  attendanceRepo,
  coursesRepo,
  forumPostsRepo,
  messagesRepo,
  termsRepo,
  usersRepo,
} from "./_stores";
import { courseAttendance } from "./attendance";
import { studentCourseGrade, useGradeData, type GradeData } from "./grades";
import { EMPTY_PROGRESS } from "./progress";
import { authorize, recordAudit, useActor } from "./session";

export interface AnalyticsCourse {
  course: Course;
  sections: Section[];
}

/** The courses whose dashboard the signed-in user may open: those they teach, or all of them for an admin. */
export function useAnalyticsCourses(): AnalyticsCourse[] {
  const actor = useActor();
  const courses = useRepository(coursesRepo);
  const data = useGradeData();
  return useMemo(() => {
    if (!actor) return [];
    return courses
      .filter((course) => can(actor, "view", { type: "analytics", courseId: course.id }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((course) => ({
        course,
        sections: data.sections.filter((section) => section.courseId === course.id).sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [actor, courses, data]);
}

/** One row for each active student in the given sections of a course. */
function classRows(
  course: Course,
  sections: Section[],
  data: GradeData,
  users: User[],
  sheets: AttendanceSheet[],
  nowMs: number,
): { rows: ClassRow[]; scale: GradingScale | undefined } {
  const now = new Date(nowMs).toISOString();
  const sectionIds = sections.map((section) => section.id);
  let scale: GradingScale | undefined;
  const rows = users
    .filter((user) => user.role === "student" && user.status === "active")
    .flatMap((student): ClassRow[] => {
      const entry = data.enrollments.find((item) => item.userId === student.id && sectionIds.includes(item.sectionId));
      if (!entry) return [];
      const grade = studentCourseGrade(data, course.id, student.id, "staff", nowMs);
      scale = grade.scale;
      const attendance = courseAttendance(student.id, course.id, sheets, data.settings.attendance).summary.rate;
      const lessons = courseProgress(
        courseForViewer(course, { staff: false, sectionIds: [entry.sectionId] }, nowMs),
        data.progress[student.id] ?? EMPTY_PROGRESS,
      );
      const missingItems = grade.scores.filter((score) => score.state === "missing").map((score) => score.item.title);
      const percent = grade.total.percent;
      return [
        {
          studentId: student.id,
          name: student.name,
          section: sections.find((section) => section.id === entry.sectionId)?.name ?? "",
          grade: percent,
          gradeLabel: percent === null || grade.scale.kind === "percentage" ? null : gradeOnScale(percent, grade.scale),
          attendance,
          missing: missingItems.length,
          missingItems,
          lastLoginAt: student.lastLoginAt,
          lessonsDone: lessons.done,
          lessonsTotal: lessons.total,
          risks: atRiskMatches(
            { grade: percent, attendance, missing: missingItems.length, lastLoginAt: student.lastLoginAt },
            data.settings.atRisk,
            now,
          ),
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows, scale };
}

export interface ClassView {
  course: Course;
  sections: Section[];
  /** The section shown, or `null` for all of them. */
  section: Section | null;
  rows: ClassRow[];
  distribution: Array<{ label: string; count: number }>;
  average: number | null;
  attendance: number | null;
  /** Each piece of work that someone has missed, with who. */
  missingByItem: Array<{ title: string; names: string[] }>;
  scale: GradingScale | undefined;
  /** When the figures were worked out (US-26: at least daily; here, every time the page is shown). */
  computedAt: string;
}

/**
 * US-26: one class's performance and engagement: grade distribution, missing
 * work, last sign-in and who is at risk, for one section or all of them.
 * `null` unless the signed-in user may see this course's dashboard.
 */
export function useClassView(courseId: string | undefined, sectionId: string | null): ClassView | null {
  const actor = useActor();
  const courses = useRepository(coursesRepo);
  const users = useRepository(usersRepo);
  const sheets = useRepository(attendanceRepo);
  const data = useGradeData();
  const now = useNow();
  return useMemo(() => {
    const course = courses.find((candidate) => candidate.id === courseId);
    if (!course || !can(actor, "view", { type: "analytics", courseId: course.id })) return null;
    const sections = data.sections.filter((section) => section.courseId === course.id).sort((a, b) => a.name.localeCompare(b.name));
    const section = sections.find((candidate) => candidate.id === sectionId) ?? null;
    const { rows, scale } = classRows(course, section ? [section] : sections, data, users, sheets, now);
    const missing = new Map<string, string[]>();
    for (const row of rows) for (const title of row.missingItems) missing.set(title, [...(missing.get(title) ?? []), row.name]);
    return {
      course,
      sections,
      section,
      rows,
      distribution: gradeDistribution(rows.map((row) => row.grade)),
      average: meanOf(rows.map((row) => row.grade)),
      attendance: meanOf(rows.map((row) => row.attendance)),
      missingByItem: [...missing.entries()].map(([title, names]) => ({ title, names })).sort((a, b) => b.names.length - a.names.length),
      scale,
      computedAt: new Date(now).toISOString(),
    };
  }, [actor, courses, users, sheets, data, now, courseId, sectionId]);
}

export interface SchoolView {
  terms: Term[];
  term: Term | null;
  usage: UsageSummary;
  courses: CourseSummaryRow[];
  atRisk: AtRiskEntry[];
  /** Every student's total in every course of the term. */
  distribution: Array<{ label: string; count: number }>;
  computedAt: string;
}

/**
 * US-27: the whole school: use over the last week, each course's figures to
 * drill down from, and every student at risk. `null` unless the signed-in user
 * may see the school (admins).
 */
export function useSchoolView(termId: string | null): SchoolView | null {
  const actor = useActor();
  const courses = useRepository(coursesRepo);
  const users = useRepository(usersRepo);
  const terms = useRepository(termsRepo);
  const sheets = useRepository(attendanceRepo);
  const posts = useRepository(forumPostsRepo);
  const messages = useRepository(messagesRepo);
  const data = useGradeData();
  const now = useNow();
  return useMemo(() => {
    if (!can(actor, "view", { type: "analytics" })) return null;
    const term = terms.find((candidate) => candidate.id === termId) ?? null;
    const inScope = courses.filter((course) => !term || course.termId === term.id).sort((a, b) => a.title.localeCompare(b.title));
    const summaries: CourseSummaryRow[] = [];
    const atRisk: AtRiskEntry[] = [];
    const totals: Array<number | null> = [];
    for (const course of inScope) {
      const sections = data.sections.filter((section) => section.courseId === course.id);
      const { rows } = classRows(course, sections, data, users, sheets, now);
      totals.push(...rows.map((row) => row.grade));
      summaries.push({
        courseId: course.id,
        code: course.code,
        title: course.title,
        term: terms.find((candidate) => candidate.id === course.termId)?.name ?? "",
        sections: sections.length,
        students: rows.length,
        average: meanOf(rows.map((row) => row.grade)),
        attendance: meanOf(rows.map((row) => row.attendance)),
        missing: rows.reduce((sum, row) => sum + row.missing, 0),
        atRisk: rows.filter((row) => row.risks.length > 0).length,
      });
      for (const row of rows) {
        if (row.risks.length > 0) {
          atRisk.push({ studentId: row.studentId, name: row.name, courseTitle: course.title, section: row.section, risks: row.risks });
        }
      }
    }
    const nowAt = new Date(now).toISOString();
    return {
      terms: [...terms].sort((a, b) => b.startsOn.localeCompare(a.startsOn)),
      term,
      usage: usageSummary(
        {
          users,
          quizAttempts: Object.values(data.progress).flatMap((learner) => learner.attempts.map((attempt) => attempt.submittedAt)),
          handIns: data.submissions.map((submission) => submission.submittedAt),
          forumPosts: posts.map((post) => post.createdAt),
          messages: messages.map((message) => message.sentAt),
        },
        nowAt,
      ),
      courses: summaries,
      atRisk: atRisk.sort((a, b) => b.risks.length - a.risks.length || a.name.localeCompare(b.name)),
      distribution: gradeDistribution(totals),
      computedAt: nowAt,
    };
  }, [actor, courses, users, terms, sheets, posts, messages, data, now, termId]);
}

/**
 * US-28: exports a dashboard as PDF or Excel. The document is built from the
 * rows on screen, so it holds what the screen holds and nothing more. Refused
 * for anyone who may not export this dashboard; every export is audit-logged.
 */
export async function exportReport(
  document: ReportDocument,
  format: "pdf" | "xlsx",
  scope: { courseId?: string },
): Promise<void> {
  authorize("export", { type: "analytics", courseId: scope.courseId });
  recordAudit({
    action: "report.export",
    resource: scope.courseId ? `analytics:${scope.courseId}` : "analytics:school",
    outcome: "allowed",
    detail: `${document.title}, ${format === "pdf" ? "PDF" : "Excel"}. ${document.filters.join("; ")}. ${document.tables.map((table) => `${table.rows.length} ${table.title.toLowerCase()}`).join(", ")}`,
  });
  // The libraries are loaded only when someone exports, so they stay out of every page's bundle (NFR-2).
  const files = await import("@/lib/export-files");
  if (format === "pdf") await files.downloadPdf(document);
  else await files.downloadExcel(document);
}

/** Who is exporting, for the "generated by" line. */
export function exportMeta(actorName: string) {
  return { generatedAt: nowIso(), generatedBy: actorName };
}
