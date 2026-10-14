/**
 * Seed data for attendance and the academic calendar: the school's events,
 * the attendance taken so far this term, and which students are already below
 * the threshold. The service layer loads these into its mock repositories.
 */
import { DEFAULT_ATTENDANCE_POLICY, alertMessage, isBelowThreshold, marksOf, summarize } from "@/lib/domain/attendance";
import { sectionSessions } from "@/lib/domain/schedule";
import type {
  AttendanceAlertState,
  AttendanceSheet,
  AttendanceStatus,
  CalendarEvent,
  Notification,
} from "@/lib/types";
import { courses } from "./courses";
import { DEMO_USER_IDS, seedEnrollments, seedSections, seedTerms, seedUsers } from "./directory";

export const seedCalendarEvents: CalendarEvent[] = [
  {
    id: "event-heroes-day",
    title: "National Heroes Day",
    kind: "holiday",
    date: "2026-08-31",
    noClasses: true,
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-midterm-week",
    title: "Midterm week",
    kind: "event",
    date: "2026-10-19",
    endDate: "2026-10-23",
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-ml-midterm",
    title: "Midterm exam: Introduction to Machine Learning",
    kind: "exam",
    date: "2026-10-21",
    start: "07:30",
    end: "09:30",
    room: "AVR",
    courseId: "ml-foundations",
    createdById: "u-faculty-alcantara",
  },
  {
    id: "event-web-midterm",
    title: "Midterm exam: Web Systems and Technologies",
    kind: "exam",
    date: "2026-10-22",
    start: "09:00",
    end: "11:00",
    room: "Computer Lab 1",
    courseId: "web-dev",
    createdById: "u-faculty-villanueva",
  },
  {
    id: "event-ethics-midterm",
    title: "Midterm exam: Ethics",
    kind: "exam",
    date: "2026-10-21",
    start: "13:00",
    end: "14:30",
    room: "Room 301",
    courseId: "ethics",
    createdById: "u-faculty-magtibay",
  },
  {
    id: "event-assessment-midterm",
    title: "Midterm exam: Assessment in Learning 1",
    kind: "exam",
    date: "2026-10-22",
    start: "14:30",
    end: "16:30",
    room: "Room 402",
    courseId: "assessment-learning",
    createdById: "u-faculty-castillo",
  },
  {
    id: "event-automotive-practical",
    title: "Practical exam: engine disassembly and measurement",
    kind: "exam",
    date: "2026-10-23",
    start: "07:30",
    end: "10:30",
    room: "Automotive Shop",
    courseId: "automotive-engines",
    createdById: "u-faculty-abad",
  },
  {
    id: "event-recollection",
    title: "Annual Salesian Youth recollection",
    kind: "event",
    date: "2026-10-30",
    noClasses: true,
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-undas-break",
    title: "All Saints' and All Souls' Day break",
    kind: "holiday",
    date: "2026-11-02",
    endDate: "2026-11-03",
    noClasses: true,
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-conferences",
    title: "Parent–teacher conferences",
    kind: "event",
    date: "2026-11-05",
    start: "15:00",
    end: "19:00",
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-bonifacio-day",
    title: "Bonifacio Day",
    kind: "holiday",
    date: "2026-11-30",
    noClasses: true,
    createdById: DEMO_USER_IDS.admin,
  },
  {
    id: "event-immaculate-conception",
    title: "Feast of the Immaculate Conception",
    kind: "holiday",
    date: "2026-12-08",
    noClasses: true,
    createdById: DEMO_USER_IDS.admin,
  },
];

/** Attendance is seeded up to this day. Sessions after it are left for the demo to take. */
const SEEDED_UNTIL = "2026-10-13";

/** The course in which the seeded examples below happen. */
const EXAMPLE_COURSE_ID = "ml-foundations";

/** Already below the threshold in the example course when the demo starts. */
const LOW_ATTENDANCE_STUDENT_ID = "u-student-04";

/**
 * The demo student's marks in the example course, by session number: two
 * absences, one excused and one late. That is 84.6%, so one more absence
 * takes them below the default threshold of 80% and sends the alert (US-21).
 */
const DEMO_STUDENT_MARKS: Record<number, AttendanceStatus> = { 3: "late", 6: "absent", 9: "excused", 12: "absent" };

/** Small deterministic generator so seeded attendance is the same on every run. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function statusFor(studentId: string, courseId: string, sessionIndex: number, random: () => number): AttendanceStatus {
  if (studentId === DEMO_USER_IDS.student) {
    return courseId === EXAMPLE_COURSE_ID ? (DEMO_STUDENT_MARKS[sessionIndex] ?? "present") : "present";
  }
  if (studentId === LOW_ATTENDANCE_STUDENT_ID && courseId === EXAMPLE_COURSE_ID) {
    return sessionIndex % 3 === 2 ? "absent" : "present";
  }
  const roll = random();
  return roll < 0.03 ? "absent" : roll < 0.06 ? "late" : roll < 0.07 ? "excused" : "present";
}

export const seedAttendanceSheets: AttendanceSheet[] = seedSections.flatMap((section, sectionIndex) => {
  const course = courses.find((candidate) => candidate.id === section.courseId);
  const term = seedTerms.find((candidate) => candidate.id === section.termId);
  if (!course || !term) return [];
  const studentIds = seedEnrollments.filter((entry) => entry.sectionId === section.id).map((entry) => entry.userId);
  const random = seeded(sectionIndex * 131 + 7);
  return sectionSessions(section, course, seedTerms, seedCalendarEvents, { from: term.startsOn, to: SEEDED_UNTIL }).map(
    (session, sessionIndex): AttendanceSheet => ({
      id: session.id,
      sectionId: section.id,
      courseId: section.courseId,
      date: session.date,
      start: session.start,
      marks: Object.fromEntries(
        studentIds.map((studentId) => [studentId, statusFor(studentId, section.courseId, sessionIndex, random)]),
      ),
      // Submitted a few minutes after the class ended.
      submittedAt: `${session.date}T${session.end}:00.000Z`,
      submittedById: section.facultyIds[0] ?? DEMO_USER_IDS.admin,
      changes: [],
    }),
  );
});

/** One correction, so the roster shows what an edit trail looks like (FR-5.2). */
const corrected = seedAttendanceSheets.findLast((sheet) => sheet.sectionId === `${EXAMPLE_COURSE_ID}-a`);
if (corrected) {
  const studentId = "u-student-01";
  corrected.changes.push({
    at: `${corrected.date}T11:05:00.000Z`,
    byId: corrected.submittedById,
    studentId,
    from: "absent",
    to: "late",
  });
  corrected.marks[studentId] = "late";
}

const below: Array<{ studentId: string; courseId: string; alertedAt: string }> = [];

for (const course of courses) {
  const sheets = seedAttendanceSheets.filter((sheet) => sheet.courseId === course.id);
  for (const studentId of new Set(sheets.flatMap((sheet) => Object.keys(sheet.marks)))) {
    if (isBelowThreshold(summarize(marksOf(studentId, sheets), DEFAULT_ATTENDANCE_POLICY), DEFAULT_ATTENDANCE_POLICY)) {
      below.push({ studentId, courseId: course.id, alertedAt: `${SEEDED_UNTIL}T09:00:00.000Z` });
    }
  }
}

/** FR-5.5: these students were alerted when they fell below, so they are not alerted again for the same breach. */
export const seedAttendanceAlerts: Record<string, AttendanceAlertState> = Object.fromEntries(
  below.map((entry) => [`${entry.studentId}|${entry.courseId}`, { breached: true, alertedAt: entry.alertedAt }]),
);

/** The alerts those students, their parents and their teachers received. */
export const seedAttendanceNotifications: Notification[] = below.flatMap((entry) => {
  const student = seedUsers.find((user) => user.id === entry.studentId);
  const course = courses.find((candidate) => candidate.id === entry.courseId);
  if (!student || !course) return [];
  const sheets = seedAttendanceSheets.filter((sheet) => sheet.courseId === course.id);
  const message = alertMessage(
    student.name,
    course.title,
    summarize(marksOf(student.id, sheets), DEFAULT_ATTENDANCE_POLICY),
    DEFAULT_ATTENDANCE_POLICY,
  );
  const teacherIds = seedSections
    .filter((section) => section.courseId === course.id && sheets.some((sheet) => sheet.sectionId === section.id && student.id in sheet.marks))
    .flatMap((section) => section.facultyIds);
  const parentIds = seedUsers.filter((user) => user.childIds?.includes(student.id)).map((user) => user.id);
  return [...new Set([student.id, ...parentIds, ...teacherIds])].map((userId) => ({
    id: `seed-attendance-${student.id}-${course.id}-${userId}`,
    userId,
    category: "attendance" as const,
    ...message,
    href: "/attendance",
    createdAt: entry.alertedAt,
    mandatory: true,
  }));
});
