"use client";

/**
 * Attendance service (BR-17, BR-19): the roster for each class session, taking
 * and correcting attendance, each student's attendance rate, and the alert
 * when it falls below the school's threshold.
 *
 * Backend seam: `GET /sections/:id/sessions`, `GET|PUT /sessions/:id/attendance`,
 * `GET /sections/:id/attendance`, `GET /users/:id/attendance`. The server
 * stamps the submission time, enforces the correction window against its own
 * clock, writes the audit trail, and evaluates the threshold and sends the
 * alerts itself, once per breach.
 */
import { useMemo } from "react";
import { localParts, nowIso } from "@/lib/clock";
import {
  ATTENDANCE_LABELS,
  alertDecision,
  alertMessage,
  canTakeOn,
  editDecision,
  formatRate,
  isBelowThreshold,
  markChanges,
  marksOf,
  sheetProblems,
  summarize,
  type AttendanceSummary,
  type EditDecision,
} from "@/lib/domain/attendance";
import { can } from "@/lib/domain/permissions";
import { sectionSessions, sessionId, type ClassSession } from "@/lib/domain/schedule";
import type {
  AttendancePolicy,
  AttendanceSheet,
  AttendanceStatus,
  Course,
  Enrollment,
  Section,
  User,
} from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRepository } from "./_repository";
import {
  attendanceAlertsRepo,
  attendanceRepo,
  calendarEventsRepo,
  coursesRepo,
  enrollmentsRepo,
  sectionsRepo,
  settingsRepo,
  termsRepo,
  usersRepo,
} from "./_stores";
import { notify } from "./notifications";
import { useViewedLearner, type ViewedLearner } from "./progress";
import { authorize, recordAudit, useActor } from "./session";

/** Something the attendance rules do not allow, with every reason. */
export class AttendanceError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "AttendanceError";
  }
}

function rosterOf(sectionId: string, users: User[], enrollments: Enrollment[]): User[] {
  const ids = new Set(enrollments.filter((entry) => entry.sectionId === sectionId).map((entry) => entry.userId));
  return users
    .filter((user) => ids.has(user.id) && user.role === "student" && user.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- Reading: staff -----------------------------------------------------------------

export interface AttendanceSection {
  section: Section;
  course: Course;
  /** May take and correct attendance here. False for admins and in an archived course. */
  canTake: boolean;
}

/** The sections whose attendance the signed-in user may see: those they teach, or all of them for an admin. */
export function useAttendanceSections(): AttendanceSection[] {
  const actor = useActor();
  const sections = useRepository(sectionsRepo);
  const courses = useRepository(coursesRepo);
  return useMemo(() => {
    if (!actor) return [];
    return sections
      .flatMap((section) => {
        const course = courses.find((candidate) => candidate.id === section.courseId);
        if (!course || !can(actor, "view", { type: "attendance", courseId: section.courseId })) return [];
        // Faculty see the sections they teach, not every section of a course they teach one of.
        if (actor.role === "faculty" && !section.facultyIds.includes(actor.id)) return [];
        return [{ section, course, canTake: can(actor, "create", { type: "attendance", courseId: section.courseId }) }];
      })
      .sort((a, b) => a.course.title.localeCompare(b.course.title) || a.section.name.localeCompare(b.section.name));
  }, [actor, sections, courses]);
}

export interface SessionRow {
  session: ClassSession;
  /** The attendance taken for it, if any. */
  sheet: AttendanceSheet | undefined;
  /** Not taken yet, and it may be taken now. */
  canTake: boolean;
  /** Taken: whether it can still be corrected, and until when or why not. */
  edit: EditDecision | undefined;
}

export interface SectionAttendance {
  section: Section;
  course: Course;
  /** Every session from the course's first day up to today, newest first. */
  sessions: SessionRow[];
  students: User[];
  /** Each student's attendance in this course so far. */
  summaries: Array<{ student: User; summary: AttendanceSummary; below: boolean }>;
  policy: AttendancePolicy;
  canTake: boolean;
  /** Names of everyone who appears in these sheets, by user id: students, and the staff who took or corrected them. */
  names: Record<string, string>;
}

/**
 * FR-5.1: a section's sessions with their rosters' state, and each student's
 * attendance so far. `null` unless the signed-in user may see it.
 */
export function useSectionAttendance(sectionId: string | undefined): SectionAttendance | null {
  const actor = useActor();
  const sections = useRepository(sectionsRepo);
  const courses = useRepository(coursesRepo);
  const terms = useRepository(termsRepo);
  const events = useRepository(calendarEventsRepo);
  const sheets = useRepository(attendanceRepo);
  const users = useRepository(usersRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const settings = useRepository(settingsRepo);
  const now = useNow();

  return useMemo(() => {
    const section = sections.find((candidate) => candidate.id === sectionId);
    const course = courses.find((candidate) => candidate.id === section?.courseId);
    if (!section || !course || !can(actor, "view", { type: "attendance", courseId: course.id })) return null;
    const policy = settings.attendance;
    const today = localParts(now).date;
    const nowAt = new Date(now).toISOString();
    const canTake = can(actor, "create", { type: "attendance", courseId: course.id });
    const mine = sheets.filter((sheet) => sheet.sectionId === section.id);
    const byId = new Map(mine.map((sheet) => [sheet.id, sheet]));

    const sessions = sectionSessions(section, course, terms, events, { from: "0000-01-01", to: today })
      .reverse()
      .map((session): SessionRow => {
        const sheet = byId.get(session.id);
        return {
          session,
          sheet,
          canTake: canTake && !sheet && canTakeOn(session.date, today),
          edit: sheet ? editDecision(sheet, policy, nowAt) : undefined,
        };
      });

    const students = rosterOf(section.id, users, enrollments);
    // The rate is for the course: a student who moved section keeps the marks from the other one.
    const courseSheets = sheets.filter((sheet) => sheet.courseId === course.id);
    return {
      section,
      course,
      sessions,
      students,
      summaries: students.map((student) => {
        const summary = summarize(marksOf(student.id, courseSheets), policy);
        return { student, summary, below: isBelowThreshold(summary, policy) };
      }),
      policy,
      canTake,
      names: Object.fromEntries(users.map((user) => [user.id, user.name])),
    };
  }, [actor, sections, courses, terms, events, sheets, users, enrollments, settings, now, sectionId]);
}

// --- Reading: the student, or a parent (US-05, US-21) -----------------------------------

export interface LearnerCourseAttendance {
  course: Course;
  section: Section | undefined;
  summary: AttendanceSummary;
  below: boolean;
  /** Every session with a mark for this student, newest first. */
  marks: Array<{ sheet: AttendanceSheet; status: AttendanceStatus }>;
}

export interface ViewedAttendance {
  viewed: ViewedLearner;
  courses: LearnerCourseAttendance[];
  policy: AttendancePolicy;
}

/**
 * The attendance of the learner the page is about: the signed-in student, or
 * the child a parent has selected. `null` when the role has no learner to show.
 */
export function useViewedAttendance(): ViewedAttendance | null | undefined {
  const viewed = useViewedLearner();
  const actor = useActor();
  const sheets = useRepository(attendanceRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const settings = useRepository(settingsRepo);
  return useMemo(() => {
    if (!viewed) return viewed;
    const learnerId = viewed.learner.id;
    if (!can(actor, "view", { type: "attendance", ownerId: learnerId })) return null;
    const policy = settings.attendance;
    const sectionIds = enrollments.filter((entry) => entry.userId === learnerId).map((entry) => entry.sectionId);
    return {
      viewed,
      policy,
      courses: viewed.courses.map((course): LearnerCourseAttendance => {
        const courseSheets = sheets.filter((sheet) => sheet.courseId === course.id);
        const summary = summarize(marksOf(learnerId, courseSheets), policy);
        return {
          course,
          section: sections.find((section) => section.courseId === course.id && sectionIds.includes(section.id)),
          summary,
          below: isBelowThreshold(summary, policy),
          marks: courseSheets
            .filter((sheet) => sheet.marks[learnerId] !== undefined)
            .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
            .map((sheet) => ({ sheet, status: sheet.marks[learnerId] })),
        };
      }),
    };
  }, [viewed, actor, sheets, sections, enrollments, settings]);
}

/** One student's attendance in one course, for reports. Callers have already checked who may see it. */
export function courseAttendance(
  studentId: string,
  courseId: string,
  sheets: AttendanceSheet[],
  policy: AttendancePolicy,
): { summary: AttendanceSummary; below: boolean } {
  const summary = summarize(marksOf(studentId, sheets.filter((sheet) => sheet.courseId === courseId)), policy);
  return { summary, below: isBelowThreshold(summary, policy) };
}

// --- Alerts (US-21, FR-5.5) -----------------------------------------------------------

/**
 * Checks attendance against the threshold and sends the alert for every breach
 * that has just begun: to the student, their linked parents and the academic
 * coordinator. A student who was already below is not alerted again; one who
 * has recovered can be alerted for a later breach. Returns how many breaches
 * were alerted.
 *
 * MOCK stand-in for a server job. It runs after attendance is saved and after
 * the policy changes, in the browser of whoever made the change.
 */
export function evaluateAttendanceAlerts(scope: { courseId?: string; studentIds?: string[] } = {}): number {
  const policy = settingsRepo.get().attendance;
  const sheets = attendanceRepo.get();
  const users = usersRepo.get();
  const sections = sectionsRepo.get();
  const enrollments = enrollmentsRepo.get();
  const states = { ...attendanceAlertsRepo.get() };
  const at = nowIso();
  let alerts = 0;
  let changed = false;

  for (const course of coursesRepo.get()) {
    if (scope.courseId !== undefined && course.id !== scope.courseId) continue;
    const courseSheets = sheets.filter((sheet) => sheet.courseId === course.id);
    const studentIds = new Set(courseSheets.flatMap((sheet) => Object.keys(sheet.marks)));
    for (const studentId of studentIds) {
      if (scope.studentIds && !scope.studentIds.includes(studentId)) continue;
      const student = users.find((user) => user.id === studentId);
      if (!student || student.status !== "active") continue;
      const key = `${studentId}|${course.id}`;
      const summary = summarize(marksOf(studentId, courseSheets), policy);
      const decision = alertDecision(states[key]?.breached ?? false, summary, policy);
      if (decision.breached !== (states[key]?.breached ?? false) || decision.alert) {
        states[key] = { breached: decision.breached, alertedAt: decision.alert ? at : states[key]?.alertedAt };
        changed = true;
      }
      if (!decision.alert) continue;

      alerts += 1;
      const parents = users.filter((user) => user.role === "parent" && user.status === "active" && user.childIds?.includes(studentId));
      const active = (ids: string[]) =>
        users.filter((user) => ids.includes(user.id) && user.status === "active" && user.role !== "student" && user.role !== "parent");
      // Q-04: the coordinators the school has named; until it names any, the teachers of the student's section.
      const mySections = sections.filter(
        (section) =>
          section.courseId === course.id &&
          enrollments.some((entry) => entry.userId === studentId && entry.sectionId === section.id),
      );
      const named = active(policy.coordinatorIds);
      const coordinators = named.length > 0 ? named : active(mySections.flatMap((section) => section.facultyIds));
      const recipients = [...new Map([student, ...parents, ...coordinators].map((user) => [user.id, user])).values()];
      const message = alertMessage(student.name, course.title, summary, policy);
      for (const recipient of recipients) {
        notify({
          userId: recipient.id,
          category: "attendance",
          ...message,
          href: "/attendance",
          // FR-6.7: an attendance alert is one of the alerts nobody can switch off.
          mandatory: true,
        });
      }
      recordAudit({
        action: "attendance.alert",
        resource: `attendance:${studentId}`,
        outcome: "allowed",
        detail: `${course.code}: ${formatRate(summary.rate)}, below ${policy.thresholdPercent}%. Sent to the student, ${parents.length} ${parents.length === 1 ? "parent" : "parents"} and ${coordinators.length} ${coordinators.length === 1 ? "coordinator" : "coordinators"}.`,
      });
    }
  }
  if (changed) attendanceAlertsRepo.update(() => states);
  return alerts;
}

// --- Taking and correcting attendance (US-19) -------------------------------------------

/**
 * Submits the attendance for one session, or corrects it. Everyone on the
 * roster needs a mark. A correction is allowed only inside the school's window
 * and every mark it changes is logged (FR-5.2). Returns how many
 * low-attendance alerts the change set off.
 */
export async function saveAttendance(
  sectionId: string,
  date: string,
  start: string,
  marks: Record<string, AttendanceStatus | undefined>,
): Promise<{ alerts: number; changed: number }> {
  const section = sectionsRepo.get().find((candidate) => candidate.id === sectionId);
  const course = coursesRepo.get().find((candidate) => candidate.id === section?.courseId);
  if (!section || !course) throw new AttendanceError(["This section no longer exists."]);
  const id = sessionId(sectionId, date, start);
  const existing = attendanceRepo.get().find((sheet) => sheet.id === id);
  const actor = authorize(existing ? "update" : "create", { type: "attendance", courseId: course.id });
  // Q-58: attendance is taken by the teachers of the section, not by everyone who teaches the course.
  if (!section.facultyIds.includes(actor.id)) {
    throw new AttendanceError(["Only the teachers of this section can take its attendance."]);
  }

  const session = sectionSessions(section, course, termsRepo.get(), calendarEventsRepo.get(), { from: date, to: date }).find(
    (candidate) => candidate.id === id,
  );
  if (!session) throw new AttendanceError(["This section has no class at that time."]);
  const at = nowIso();
  if (!canTakeOn(date, localParts(at).date)) {
    throw new AttendanceError(["Attendance can be taken from the day of the class, not before it."]);
  }

  const students = rosterOf(sectionId, usersRepo.get(), enrollmentsRepo.get());
  const problems = sheetProblems(
    students.map((student) => student.id),
    marks,
  );
  if (problems.length > 0) throw new AttendanceError(problems);
  // Marks for anyone not on the roster are ignored; a student who has since left keeps the mark they had.
  const next: Record<string, AttendanceStatus> = { ...existing?.marks };
  for (const student of students) next[student.id] = marks[student.id] as AttendanceStatus;

  const nameOf = (studentId: string) => students.find((student) => student.id === studentId)?.name ?? studentId;
  const where = `${course.code} ${section.name}, ${date} ${start}`;
  let changed = students.length;

  if (existing) {
    const decision = editDecision(existing, settingsRepo.get().attendance, at);
    if (!decision.allowed) throw new AttendanceError([decision.reason]);
    const changes = markChanges(existing.marks, next, { byId: actor.id, at });
    if (changes.length === 0) return { alerts: 0, changed: 0 };
    changed = changes.length;
    attendanceRepo.update((sheets) =>
      sheets.map((sheet) => (sheet.id === id ? { ...sheet, marks: next, changes: [...sheet.changes, ...changes] } : sheet)),
    );
    recordAudit({
      action: "attendance.edit",
      resource: `attendance:${id}`,
      outcome: "allowed",
      detail: `${where}: ${changes
        .map((change) => `${nameOf(change.studentId)} ${change.from ? ATTENDANCE_LABELS[change.from] : "no mark"} to ${ATTENDANCE_LABELS[change.to]}`)
        .join("; ")}`,
    });
  } else {
    const sheet: AttendanceSheet = {
      id,
      sectionId,
      courseId: course.id,
      date,
      start,
      marks: next,
      submittedAt: at,
      submittedById: actor.id,
      changes: [],
    };
    attendanceRepo.update((sheets) => [...sheets, sheet]);
    const summary = summarize(Object.values(next), { late: "absent", excused: "absent" });
    recordAudit({
      action: "attendance.submit",
      resource: `attendance:${id}`,
      outcome: "allowed",
      detail: `${where}: ${summary.present} present, ${summary.absent} absent, ${summary.late} late, ${summary.excused} excused`,
    });
  }

  const alerts = evaluateAttendanceAlerts({ courseId: course.id, studentIds: students.map((student) => student.id) });
  return { alerts, changed };
}
