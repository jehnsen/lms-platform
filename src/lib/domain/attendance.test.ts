import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  DEFAULT_ATTENDANCE_POLICY,
  alertDecision,
  alertMessage,
  attendancePolicyProblems,
  canTakeOn,
  describeCounting,
  editClosesAt,
  editDecision,
  formatRate,
  isBelowThreshold,
  markChanges,
  marksOf,
  sheetProblems,
  summarize,
} from "@/lib/domain/attendance";
import { can, type Actor } from "@/lib/domain/permissions";
import { canAccessRoute } from "@/lib/domain/routes";
import {
  addMonths,
  calendarItems,
  clampRange,
  courseDates,
  datesIn,
  eventProblems,
  filterCalendar,
  monthWeeks,
  noClassDates,
  sectionSessions,
  sessionId,
  sessionsOf,
  startOfWeek,
  weekDates,
  weekdayOf,
  type CalendarSource,
} from "@/lib/domain/schedule";
import { DEFAULT_SETTINGS, settingsProblems } from "@/lib/domain/settings";
import type {
  Assignment,
  AttendancePolicy,
  AttendanceSheet,
  AttendanceStatus,
  CalendarEvent,
  Quiz,
  Section,
  Term,
} from "@/lib/types";

const policy = DEFAULT_ATTENDANCE_POLICY;

const term: Term = { id: "t1", name: "Term 1", startsOn: "2026-08-24", endsOn: "2026-12-18", status: "active" };

/** Meets on Monday and Wednesday at 09:00. */
const section: Section = {
  id: "math-a",
  courseId: "math",
  termId: "t1",
  name: "Section A",
  code: "MATH-101-A",
  facultyIds: ["f1"],
  meetings: [
    { day: 1, start: "09:00", end: "09:50", room: "Room 12" },
    { day: 3, start: "09:00", end: "09:50", room: "Room 12" },
  ],
};

const course = { id: "math", title: "Algebra", code: "MATH-101", termId: "t1" };

function sheet(date: string, marks: Record<string, AttendanceStatus>, submittedAt = `${date}T10:00:00.000Z`): AttendanceSheet {
  return { id: sessionId("math-a", date, "09:00"), sectionId: "math-a", courseId: "math", date, start: "09:00", marks, submittedAt, submittedById: "f1", changes: [] };
}

const marks = (text: string): AttendanceStatus[] =>
  [...text].map((letter) => ({ P: "present", A: "absent", L: "late", E: "excused" })[letter] as AttendanceStatus);

describe("taking attendance (US-19, FR-5.1)", () => {
  it("offers Present, Absent, Late and Excused", () => {
    expect(ATTENDANCE_STATUSES.map((status) => ATTENDANCE_LABELS[status])).toEqual(["Present", "Absent", "Late", "Excused"]);
  });

  it("loads the roster for each session of a section, from its weekly schedule", () => {
    const sessions = sessionsOf(section, { from: "2026-10-12", to: "2026-10-18" });
    expect(sessions.map((session) => [session.id, session.date, session.start, session.room])).toEqual([
      ["math-a|2026-10-12|09:00", "2026-10-12", "09:00", "Room 12"],
      ["math-a|2026-10-14|09:00", "2026-10-14", "09:00", "Room 12"],
    ]);
  });

  it("needs a mark for every student on the roster before it is submitted", () => {
    expect(sheetProblems(["s1", "s2"], { s1: "present", s2: "late" })).toEqual([]);
    expect(sheetProblems(["s1", "s2", "s3"], { s1: "present" })).toEqual([
      "2 students are not marked yet. Mark everyone before you submit.",
    ]);
    expect(sheetProblems(["s1"], {})).toEqual(["1 student is not marked yet. Mark everyone before you submit."]);
  });

  it("is taken from the day of the class, not ahead of it", () => {
    expect(canTakeOn("2026-10-14", "2026-10-14")).toBe(true);
    expect(canTakeOn("2026-10-12", "2026-10-14")).toBe(true);
    expect(canTakeOn("2026-10-19", "2026-10-14")).toBe(false);
  });
});

describe("correcting attendance (US-19, FR-5.2)", () => {
  const submitted = sheet("2026-10-12", { s1: "present", s2: "absent" }, "2026-10-12T10:00:00.000Z");

  it("allows edits after submission inside the school's window", () => {
    expect(editClosesAt(submitted, policy)).toBe("2026-10-14T10:00:00.000Z");
    expect(editDecision(submitted, policy, "2026-10-13T09:00:00.000Z")).toEqual({ allowed: true, closesAt: "2026-10-14T10:00:00.000Z" });
    expect(editDecision(submitted, policy, "2026-10-14T10:00:00.000Z").allowed).toBe(true);
  });

  it("refuses edits once the window has passed, and says why", () => {
    expect(editDecision(submitted, policy, "2026-10-14T10:00:01.000Z")).toEqual({
      allowed: false,
      reason: "This attendance was submitted more than 48 hours ago, so it can no longer be changed.",
    });
  });

  it("follows the window the admin sets", () => {
    expect(editDecision(submitted, { editWindowHours: 1 }, "2026-10-12T11:30:00.000Z")).toEqual({
      allowed: false,
      reason: "This attendance was submitted more than 1 hour ago, so it can no longer be changed.",
    });
    expect(editDecision(submitted, { editWindowHours: 720 }, "2026-11-01T00:00:00.000Z").allowed).toBe(true);
    expect(editDecision(submitted, { editWindowHours: 0 }, "2026-10-12T10:00:01.000Z")).toEqual({
      allowed: false,
      reason: "The school does not allow attendance to be changed once it is submitted.",
    });
  });

  it("logs each mark an edit changes, with who and when, and nothing else", () => {
    const by = { byId: "f1", at: "2026-10-13T09:00:00.000Z" };
    expect(markChanges(submitted.marks, { s1: "present", s2: "excused", s3: "late" }, by)).toEqual([
      { ...by, studentId: "s2", from: "absent", to: "excused" },
      { ...by, studentId: "s3", from: null, to: "late" },
    ]);
    expect(markChanges(submitted.marks, { ...submitted.marks }, by)).toEqual([]);
  });
});

describe("attendance rate and threshold (US-21, FR-5.4)", () => {
  it("counts Late as attended and leaves Excused out, by default", () => {
    const summary = summarize(marks("PPPLAE"), policy);
    expect(summary).toMatchObject({ recorded: 6, present: 3, late: 1, absent: 1, excused: 1, counted: 5, attended: 4 });
    expect(summary.rate).toBe(80);
  });

  it("counts Late and Excused the way the school's policy says", () => {
    expect(summarize(marks("PPLA"), { late: "half", excused: "excluded" }).rate).toBe(62.5);
    expect(summarize(marks("PPLA"), { late: "absent", excused: "excluded" }).rate).toBe(50);
    expect(summarize(marks("PPEA"), { late: "present", excused: "present" }).rate).toBe(75);
    expect(summarize(marks("PPEA"), { late: "present", excused: "absent" }).rate).toBe(50);
    expect(summarize(marks("EE"), policy).rate).toBeNull();
    expect(summarize([], policy).rate).toBeNull();
  });

  it("is below the threshold only when the rate is under it", () => {
    expect(isBelowThreshold(summarize(marks("PPPPA"), policy), policy)).toBe(false); // exactly 80%
    expect(isBelowThreshold(summarize(marks("PPPPAA"), policy), policy)).toBe(true); // 66.7%
    expect(isBelowThreshold(summarize(marks("PPPPAA"), policy), { ...policy, thresholdPercent: 60 })).toBe(false);
  });

  it("does not check the threshold until enough sessions count", () => {
    expect(isBelowThreshold(summarize(marks("A"), policy), policy)).toBe(false);
    expect(isBelowThreshold(summarize(marks("AAAA"), policy), policy)).toBe(false);
    expect(isBelowThreshold(summarize(marks("AAAAA"), policy), policy)).toBe(true);
    // Excused sessions do not count towards the minimum either.
    expect(isBelowThreshold(summarize(marks("AAAAEE"), policy), policy)).toBe(false);
    expect(isBelowThreshold(summarize(marks("A"), policy), { ...policy, minSessions: 1 })).toBe(true);
  });

  it("reads a student's marks from the sheets in session order", () => {
    const sheets = [sheet("2026-10-14", { s1: "absent" }), sheet("2026-10-12", { s1: "late", s2: "present" }), sheet("2026-10-07", { s2: "present" })];
    expect(marksOf("s1", sheets)).toEqual(["late", "absent"]);
    expect(marksOf("s9", sheets)).toEqual([]);
  });

  it("accepts the default policy and checks the ranges", () => {
    expect(attendancePolicyProblems(policy)).toEqual([]);
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
    const broken: AttendancePolicy = { ...policy, thresholdPercent: 0, minSessions: 2.5, editWindowHours: -1 };
    expect(attendancePolicyProblems(broken)).toEqual([
      "The attendance threshold must be from 1 to 100 percent.",
      "The number of sessions before attendance is checked must be a whole number from 1 to 50.",
      "The time allowed for correcting attendance must be a whole number of hours from 0 to 720.",
    ]);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, attendance: broken })).toHaveLength(3);
  });

  it("shows a rate to one decimal place and explains the counting", () => {
    expect([79.96, 78.5714, 100, null].map(formatRate)).toEqual(["80%", "78.6%", "100%", "—"]);
    expect(describeCounting(policy)).toBe("Late counts as attended, and excused sessions are left out.");
    expect(describeCounting({ late: "half", excused: "absent" })).toBe("Late counts as half a session, and excused sessions count as missed.");
  });
});

describe("low-attendance alerts (US-21, FR-5.5)", () => {
  /** Replays a term mark by mark and returns the sessions after which an alert was sent. */
  function alertsOver(text: string, rules: AttendancePolicy = policy) {
    let breached = false;
    const alerts: number[] = [];
    const all = marks(text);
    all.forEach((_, index) => {
      const decision = alertDecision(breached, summarize(all.slice(0, index + 1), rules), rules);
      if (decision.alert) alerts.push(index + 1);
      breached = decision.breached;
    });
    return { alerts, breached };
  }

  it("alerts when attendance falls below the threshold", () => {
    // 4 of 5 is 80%: on the threshold, no alert. 4 of 6 is 66.7%: below it.
    expect(alertsOver("PPPPAA")).toEqual({ alerts: [6], breached: true });
  });

  it("alerts once for a breach, not again while attendance stays below", () => {
    // Below from session 6 and still below after four more absences and two more days present.
    expect(alertsOver("PPPPAAAAAAPP").alerts).toEqual([6]);
  });

  it("does not alert again when nothing about the attendance changed", () => {
    const summary = summarize(marks("PPPPAA"), policy);
    expect(alertDecision(false, summary, policy)).toEqual({ breached: true, alert: true });
    // Checked again the next day, and the day after: still the same breach.
    expect(alertDecision(true, summary, policy)).toEqual({ breached: true, alert: false });
    expect(alertDecision(true, summary, policy)).toEqual({ breached: true, alert: false });
  });

  it("ends the breach when attendance recovers, and alerts again for a new one", () => {
    // 66.7% after 6 (alert), back to 80% after 10, then 72.7% after 11 (a new breach, a new alert).
    const replay = alertsOver("PPPPAAPPPPAA");
    expect(replay.alerts).toEqual([6, 11]);
    expect(alertsOver("PPPPAAPPPP")).toEqual({ alerts: [6], breached: false });
  });

  it("never alerts a student who stays at or above the threshold", () => {
    expect(alertsOver("PPPPAPPPPAPPPPL")).toEqual({ alerts: [], breached: false });
  });

  it("waits for the minimum number of sessions before the first alert", () => {
    expect(alertsOver("AAPPPPPPPPPPPPP").alerts).toEqual([5]);
    expect(alertsOver("AAPP").alerts).toEqual([]);
  });

  it("uses the threshold the administrator set", () => {
    expect(alertsOver("PPPPPPPPAA", { ...policy, thresholdPercent: 90 }).alerts).toEqual([9]);
    expect(alertsOver("PPPPPPPPAA", { ...policy, thresholdPercent: 75 }).alerts).toEqual([]);
  });

  it("says who, which course, the rate and the threshold", () => {
    expect(alertMessage("Mike Manabat", "Algebra", summarize(marks("PPPPAA"), policy), policy)).toEqual({
      title: "Attendance below 80%: Mike Manabat",
      body: "Mike Manabat has attended 66.7% of Algebra (4 of 6 sessions). The school expects at least 80%.",
    });
  });
});

describe("timetable and calendar (US-20, FR-5.3)", () => {
  const holiday: CalendarEvent = { id: "e1", title: "School holiday", kind: "holiday", date: "2026-10-12", noClasses: true, createdById: "a1" };
  const exam: CalendarEvent = { id: "e2", title: "Midterm exam", kind: "exam", date: "2026-10-21", start: "10:00", end: "11:30", room: "Hall", courseId: "math", createdById: "f1" };
  const artExam: CalendarEvent = { ...exam, id: "e3", title: "Art exam", courseId: "art" };
  const examWeek: CalendarEvent = { id: "e4", title: "Exam week", kind: "event", date: "2026-10-19", endDate: "2026-10-21", createdById: "a1" };

  const quiz = { id: "q1", courseId: "math", title: "Unit 1 quiz", due: "2026-10-20", status: "published" } as Quiz;
  const assignment = { id: "a1", courseId: "math", title: "Essay", dueAt: "2026-10-16T16:00:00.000Z", status: "published" } as Assignment;

  const source: CalendarSource = {
    courses: [course],
    sections: [section],
    terms: [term],
    quizzes: [quiz, { ...quiz, id: "q-draft", status: "draft" } as Quiz, { ...quiz, id: "q-art", courseId: "art" } as Quiz],
    assignments: [assignment],
    events: [holiday, exam, artExam, examWeek],
    toLocal: (iso) => ({ date: iso.slice(0, 10), time: iso.slice(11, 16) }),
  };
  const range = { from: "2026-10-12", to: "2026-10-25" };

  it("works with plain dates", () => {
    expect(weekdayOf("2026-10-14")).toBe(3);
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(weekDates("2026-10-14")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(datesIn({ from: "2026-10-30", to: "2026-11-01" })).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    const weeks = monthWeeks("2026-10");
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)?.[6]).toBe("2026-11-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("shows classes, due dates and exams", () => {
    const items = calendarItems(source, range);
    expect(items.map((item) => `${item.date} ${item.start ?? "all-day"} ${item.kind} ${item.title}`)).toEqual([
      "2026-10-12 all-day holiday School holiday",
      "2026-10-14 09:00 class Algebra",
      "2026-10-16 16:00 due Assignment due: Essay",
      "2026-10-19 all-day event Exam week",
      "2026-10-19 09:00 class Algebra",
      "2026-10-20 all-day event Exam week",
      "2026-10-20 all-day due Quiz due: Unit 1 quiz",
      "2026-10-21 all-day event Exam week",
      "2026-10-21 09:00 class Algebra",
      "2026-10-21 10:00 exam Midterm exam",
    ]);
    expect(items.find((item) => item.kind === "class")).toMatchObject({ detail: "Section A · Room 12", courseId: "math", href: "/courses/math" });
    expect(items.find((item) => item.kind === "exam")).toMatchObject({ detail: "Algebra · Hall", eventId: "e2" });
  });

  it("leaves out drafts and other people's courses", () => {
    const ids = calendarItems(source, range).map((item) => item.id);
    expect(ids).not.toContain("quiz:q-draft");
    expect(ids).not.toContain("quiz:q-art");
    expect(ids.some((id) => id.startsWith("event:e3"))).toBe(false);
  });

  it("can be filtered by course and by kind, keeping whole-school days", () => {
    const two: CalendarSource = {
      ...source,
      courses: [course, { id: "art", title: "Art", code: "ART-1", termId: "t1" }],
      sections: [section, { ...section, id: "art-a", courseId: "art", meetings: [{ day: 2, start: "11:00", end: "11:50" }] }],
    };
    const all = calendarItems(two, range);
    expect(all.some((item) => item.courseId === "art")).toBe(true);
    const math = filterCalendar(all, { courseId: "math", kinds: ["class", "due", "exam", "holiday", "event"] });
    expect(math.some((item) => item.courseId === "art")).toBe(false);
    expect(math.some((item) => item.title === "School holiday")).toBe(true);
    expect(filterCalendar(all, { kinds: ["exam"] }).map((item) => item.title)).toEqual(["Art exam", "Midterm exam"]);
    expect(filterCalendar(all, { courseId: "art", kinds: ["class"] }).map((item) => item.date)).toEqual(["2026-10-13", "2026-10-20"]);
  });

  it("shows a change to a class or a deadline as soon as it is made", () => {
    const moved: Section = { ...section, meetings: [{ day: 4, start: "13:00", end: "13:50", room: "Lab 2" }] };
    const after = calendarItems({ ...source, sections: [moved], assignments: [{ ...assignment, dueAt: "2026-10-23T09:30:00.000Z" }] }, range);
    expect(after.filter((item) => item.kind === "class").map((item) => `${item.date} ${item.start} ${item.detail}`)).toEqual([
      "2026-10-15 13:00 Section A · Lab 2",
      "2026-10-22 13:00 Section A · Lab 2",
    ]);
    expect(after.find((item) => item.id === "assignment:a1")).toMatchObject({ date: "2026-10-23", start: "09:30" });
  });

  it("has no class on a holiday or when the course's class is cancelled", () => {
    expect(sessionsOf(section, range, noClassDates([holiday], "math")).map((session) => session.date)).toEqual(["2026-10-14", "2026-10-19", "2026-10-21"]);
    const cancelled: CalendarEvent = { id: "e5", title: "Class cancelled", kind: "event", date: "2026-10-14", courseId: "math", noClasses: true, createdById: "f1" };
    expect([...noClassDates([holiday, cancelled], "math")]).toEqual(["2026-10-12", "2026-10-14"]);
    // Another course's cancelled class does not cancel this one.
    expect([...noClassDates([cancelled], "art")]).toEqual([]);
  });

  it("feeds the calendar from the course's dates (US-06)", () => {
    expect(courseDates(course, [term])).toEqual({ from: "2026-08-24", to: "2026-12-18" });
    const short = { ...course, startsOn: "2026-10-19", endsOn: "2026-10-30" };
    expect(courseDates(short, [term])).toEqual({ from: "2026-10-19", to: "2026-10-30" });
    expect(sectionSessions(section, short, [term], [], range).map((session) => session.date)).toEqual(["2026-10-19", "2026-10-21"]);
    expect(sectionSessions(section, course, [term], [], { from: "2026-12-14", to: "2026-12-31" }).map((session) => session.date)).toEqual(["2026-12-14", "2026-12-16"]);
    expect(clampRange(range, { from: "2027-01-01", to: "2027-02-01" })).toBeNull();
    const items = calendarItems({ ...source, courses: [short], events: [] }, { from: "2026-08-01", to: "2026-12-31" });
    expect(items.filter((item) => item.kind === "event").map((item) => `${item.date} ${item.title}`)).toEqual([
      "2026-08-24 Term 1 starts",
      "2026-10-19 Algebra: first day",
      "2026-10-30 Algebra: last day",
      "2026-12-18 Term 1 ends",
    ]);
  });

  it("checks a calendar event before it is saved", () => {
    expect(eventProblems({ title: "Midterm", date: "2026-10-21", start: "10:00", end: "11:30" })).toEqual([]);
    expect(eventProblems({ title: " ", date: "", endDate: "", start: "", end: "" })).toEqual(["Give the event a title.", "Choose a date."]);
    expect(eventProblems({ title: "Fair", date: "2026-10-21", endDate: "2026-10-20" })).toEqual(["The last day cannot be before the first."]);
    expect(eventProblems({ title: "Fair", date: "2026-10-21", end: "11:00" })).toEqual(["An event with an end time needs a start time."]);
    expect(eventProblems({ title: "Fair", date: "2026-10-21", start: "11:00", end: "10:00" })).toEqual(["The end time must be after the start time."]);
  });
});

describe("who may see and change attendance and the calendar", () => {
  const student: Actor = { id: "s1", role: "student", status: "active", childIds: [], courseIds: ["math"], readOnlyCourseIds: [] };
  const faculty: Actor = { id: "f1", role: "faculty", status: "active", childIds: [], courseIds: ["math"], readOnlyCourseIds: [] };
  const admin: Actor = { id: "a1", role: "admin", status: "active", childIds: [], courseIds: [], readOnlyCourseIds: [] };
  const parent: Actor = { id: "p1", role: "parent", status: "active", childIds: ["s1"], courseIds: [], readOnlyCourseIds: [] };

  it("lets faculty take and correct attendance only in the courses they teach", () => {
    expect(can(faculty, "create", { type: "attendance", courseId: "math" })).toBe(true);
    expect(can(faculty, "update", { type: "attendance", courseId: "math" })).toBe(true);
    expect(can(faculty, "create", { type: "attendance", courseId: "art" })).toBe(false);
    expect(can(admin, "view", { type: "attendance", courseId: "art" })).toBe(true);
    expect(can(admin, "update", { type: "attendance", courseId: "math" })).toBe(false);
    expect(can({ ...faculty, readOnlyCourseIds: ["math"] }, "update", { type: "attendance", courseId: "math" })).toBe(false);
  });

  it("lets a student see their own attendance and a parent their child's, and nobody else's", () => {
    expect(can(student, "view", { type: "attendance", ownerId: "s1" })).toBe(true);
    expect(can(student, "view", { type: "attendance", ownerId: "s2" })).toBe(false);
    expect(can(student, "create", { type: "attendance", courseId: "math" })).toBe(false);
    expect(can(parent, "view", { type: "attendance", ownerId: "s1" })).toBe(true);
    expect(can(parent, "view", { type: "attendance", ownerId: "s2" })).toBe(false);
  });

  it("lets faculty add events for their courses and admins for the whole school", () => {
    expect(can(faculty, "create", { type: "calendar-event", courseId: "math" })).toBe(true);
    expect(can(faculty, "create", { type: "calendar-event", courseId: "art" })).toBe(false);
    expect(can(faculty, "create", { type: "calendar-event" })).toBe(false);
    expect(can(admin, "create", { type: "calendar-event" })).toBe(true);
    expect(can(student, "create", { type: "calendar-event", courseId: "math" })).toBe(false);
  });

  it("opens the calendar and the attendance page to every role", () => {
    for (const role of ["student", "parent", "faculty", "admin"] as const) {
      expect(canAccessRoute(role, "/calendar")).toBe(true);
      expect(canAccessRoute(role, "/attendance")).toBe(true);
    }
  });
});
