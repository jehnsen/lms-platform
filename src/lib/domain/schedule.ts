/**
 * Class sessions, the timetable and the academic calendar (FR-5.1, FR-5.3).
 *
 * Nothing is stored for a class session: it follows from a section's weekly
 * schedule, its course's dates and the days on which no classes meet. So a
 * change to a schedule, a deadline or an event shows on the calendar at once
 * (US-20). Dates here are plain calendar dates, "YYYY-MM-DD", and times are
 * "HH:MM" on the school's clock (Q-34).
 */
import { daysBetween, shiftDate } from "@/lib/domain/course-copy";
import type { Assignment, CalendarEvent, Course, Quiz, Section, Term } from "@/lib/types";

// --- Plain dates -------------------------------------------------------------------

export const addDays = shiftDate;

/** Day of the week: 0 is Sunday, 6 is Saturday. */
export function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** The Monday of the week a date falls in. */
export function startOfWeek(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** The seven dates of the week a date falls in, Monday first. */
export function weekDates(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** "YYYY-MM" for a date. */
export function monthOf(date: string) {
  return date.slice(0, 7);
}

/** Moves a month ("YYYY-MM") by a number of months. */
export function addMonths(month: string, count: number) {
  const [year, index] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, index - 1 + count, 1));
  return moved.toISOString().slice(0, 7);
}

/** The weeks that cover a month, Monday first. The first and last may hold days of the neighbouring months. */
export function monthWeeks(month: string): string[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks: string[][] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) weeks.push(weekDates(monday));
  return weeks;
}

export interface DateRange {
  /** Both inclusive. */
  from: string;
  to: string;
}

/** Every date in a range, in order. */
export function datesIn(range: DateRange): string[] {
  const days = daysBetween(range.from, range.to);
  return days < 0 ? [] : Array.from({ length: days + 1 }, (_, index) => addDays(range.from, index));
}

// --- Class sessions (FR-5.1) ---------------------------------------------------------

/** One meeting of a section on one date. */
export interface ClassSession {
  id: string;
  sectionId: string;
  courseId: string;
  date: string;
  start: string;
  end: string;
  room?: string;
}

export function sessionId(sectionId: string, date: string, start: string) {
  return `${sectionId}|${date}|${start}`;
}

/** The first and last teaching day of a course: its own dates, or its term's. */
export function courseDates(course: Pick<Course, "termId" | "startsOn" | "endsOn">, terms: Term[]): DateRange | null {
  const term = terms.find((candidate) => candidate.id === course.termId);
  const from = course.startsOn ?? term?.startsOn;
  const to = course.endsOn ?? term?.endsOn;
  return from && to ? { from, to } : null;
}

/** The dates on which a course's classes do not meet: school-wide closures and the course's own. */
export function noClassDates(events: CalendarEvent[], courseId: string): Set<string> {
  const dates = new Set<string>();
  for (const event of events) {
    if (!event.noClasses || (event.courseId !== undefined && event.courseId !== courseId)) continue;
    for (const date of datesIn({ from: event.date, to: event.endDate ?? event.date })) dates.add(date);
  }
  return dates;
}

/**
 * The sessions of a section inside a range: one for each weekly meeting on
 * each date, leaving out the days with no classes. Earliest first.
 */
export function sessionsOf(
  section: Pick<Section, "id" | "courseId" | "meetings">,
  range: DateRange,
  closed: Set<string> = new Set(),
): ClassSession[] {
  const sessions: ClassSession[] = [];
  for (const date of datesIn(range)) {
    if (closed.has(date)) continue;
    const day = weekdayOf(date);
    for (const meeting of section.meetings) {
      if (meeting.day !== day) continue;
      sessions.push({
        id: sessionId(section.id, date, meeting.start),
        sectionId: section.id,
        courseId: section.courseId,
        date,
        start: meeting.start,
        end: meeting.end,
        room: meeting.room,
      });
    }
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** The part of `range` that lies inside `limit`, or `null` when they do not overlap. */
export function clampRange(range: DateRange, limit: DateRange | null): DateRange | null {
  if (!limit) return null;
  const from = range.from > limit.from ? range.from : limit.from;
  const to = range.to < limit.to ? range.to : limit.to;
  return from <= to ? { from, to } : null;
}

/** A section's sessions inside a range, within its course's dates and leaving out days with no classes. */
export function sectionSessions(
  section: Pick<Section, "id" | "courseId" | "meetings">,
  course: Pick<Course, "termId" | "startsOn" | "endsOn"> | undefined,
  terms: Term[],
  events: CalendarEvent[],
  range: DateRange,
): ClassSession[] {
  const within = course ? clampRange(range, courseDates(course, terms)) : null;
  return within ? sessionsOf(section, within, noClassDates(events, section.courseId)) : [];
}

// --- The calendar (FR-5.3, US-20) ----------------------------------------------------

export type CalendarKind = "class" | "due" | "exam" | "holiday" | "event";

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  class: "Classes",
  due: "Due dates",
  exam: "Exams",
  holiday: "Holidays",
  event: "Events",
};

export const CALENDAR_KINDS = Object.keys(CALENDAR_KIND_LABELS) as CalendarKind[];

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  date: string;
  /** "HH:MM". Absent: all day. */
  start?: string;
  end?: string;
  /** Absent: it concerns the whole school. */
  courseId?: string;
  detail?: string;
  /** Where the item opens, when it has a page. */
  href?: string;
  /** The stored event behind it, when it is one that can be edited. */
  eventId?: string;
}

export interface CalendarSource {
  /** The courses on this person's calendar. */
  courses: Array<Pick<Course, "id" | "title" | "code" | "termId" | "startsOn" | "endsOn">>;
  /** The sections whose classes this person attends or teaches. */
  sections: Section[];
  terms: Term[];
  /** Published quizzes and assignments this person has. */
  quizzes: Quiz[];
  assignments: Assignment[];
  events: CalendarEvent[];
  /** Where a moment falls on this person's calendar: its date and time of day. */
  toLocal: (iso: string) => { date: string; time: string };
}

/**
 * Everything on a person's calendar inside a range: classes, due dates, exams,
 * holidays and other events, with term and course start and end days.
 * In date order; within a day, all-day items first, then by time.
 */
export function calendarItems(source: CalendarSource, range: DateRange): CalendarItem[] {
  const items: CalendarItem[] = [];
  const inRange = (date: string) => date >= range.from && date <= range.to;
  const courseIds = new Set(source.courses.map((course) => course.id));
  const courseOf = (courseId: string) => source.courses.find((course) => course.id === courseId);

  for (const section of source.sections) {
    const course = courseOf(section.courseId);
    for (const session of sectionSessions(section, course, source.terms, source.events, range)) {
      items.push({
        id: `class:${session.id}`,
        kind: "class",
        title: course?.title ?? "Class",
        date: session.date,
        start: session.start,
        end: session.end,
        courseId: section.courseId,
        detail: [section.name, session.room].filter(Boolean).join(" · "),
        href: `/courses/${section.courseId}`,
      });
    }
  }

  for (const quiz of source.quizzes) {
    const date = quiz.due.slice(0, 10);
    if (quiz.status !== "published" || !courseIds.has(quiz.courseId) || !inRange(date)) continue;
    items.push({
      id: `quiz:${quiz.id}`,
      kind: "due",
      title: `Quiz due: ${quiz.title}`,
      date,
      courseId: quiz.courseId,
      detail: courseOf(quiz.courseId)?.title,
      href: `/quizzes/${quiz.id}`,
    });
  }

  for (const assignment of source.assignments) {
    if (assignment.status !== "published" || !courseIds.has(assignment.courseId)) continue;
    const due = source.toLocal(assignment.dueAt);
    if (!inRange(due.date)) continue;
    items.push({
      id: `assignment:${assignment.id}`,
      kind: "due",
      title: `Assignment due: ${assignment.title}`,
      date: due.date,
      start: due.time,
      courseId: assignment.courseId,
      detail: courseOf(assignment.courseId)?.title,
      href: `/assignments/${assignment.id}`,
    });
  }

  for (const event of source.events) {
    if (event.courseId !== undefined && !courseIds.has(event.courseId)) continue;
    const course = event.courseId ? courseOf(event.courseId) : undefined;
    for (const date of datesIn({ from: event.date, to: event.endDate ?? event.date })) {
      if (!inRange(date)) continue;
      items.push({
        id: `event:${event.id}:${date}`,
        kind: event.kind,
        title: event.title,
        date,
        start: event.start,
        end: event.end,
        courseId: event.courseId,
        detail: [course?.title ?? "Whole school", event.room, event.noClasses ? "No classes" : undefined]
          .filter(Boolean)
          .join(" · "),
        eventId: event.id,
      });
    }
  }

  // Term and course dates (US-06): a course with its own dates is shown as well as its term.
  const termIds = new Set(source.courses.map((course) => course.termId));
  for (const term of source.terms) {
    if (!termIds.has(term.id)) continue;
    const marks: Array<[string, string]> = [
      [term.startsOn, `${term.name} starts`],
      [term.endsOn, `${term.name} ends`],
    ];
    for (const [date, title] of marks) {
      if (inRange(date)) items.push({ id: `term:${term.id}:${date}`, kind: "event", title, date, detail: "Whole school" });
    }
  }
  for (const course of source.courses) {
    const marks: Array<[string | undefined, string]> = [
      [course.startsOn, `${course.title}: first day`],
      [course.endsOn, `${course.title}: last day`],
    ];
    for (const [date, title] of marks) {
      if (!date || !inRange(date)) continue;
      items.push({ id: `course:${course.id}:${date}`, kind: "event", title, date, courseId: course.id, href: `/courses/${course.id}` });
    }
  }

  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start ?? "").localeCompare(b.start ?? "") ||
      a.title.localeCompare(b.title),
  );
}

/**
 * US-20: narrows the calendar to one course and to the kinds chosen. Items for
 * the whole school stay when a course is chosen: a holiday applies to it too.
 */
export function filterCalendar(
  items: CalendarItem[],
  filter: { courseId?: string; kinds: CalendarKind[] },
): CalendarItem[] {
  return items.filter(
    (item) =>
      filter.kinds.includes(item.kind) &&
      (!filter.courseId || item.courseId === undefined || item.courseId === filter.courseId),
  );
}

/** Why a calendar event cannot be saved. Empty when it can. */
export function eventProblems(event: Pick<CalendarEvent, "title" | "date" | "endDate" | "start" | "end">): string[] {
  const problems: string[] = [];
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
  const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!event.title.trim()) problems.push("Give the event a title.");
  if (!isDate(event.date)) problems.push("Choose a date.");
  if (event.endDate) {
    if (!isDate(event.endDate)) problems.push("The last day is not a date.");
    else if (isDate(event.date) && event.endDate < event.date) problems.push("The last day cannot be before the first.");
  }
  if (event.start && !isTime(event.start)) problems.push("The start time is not a time.");
  if (event.end && !isTime(event.end)) problems.push("The end time is not a time.");
  if (event.end && !event.start) problems.push("An event with an end time needs a start time.");
  if (event.start && event.end && isTime(event.start) && isTime(event.end) && event.end <= event.start) {
    problems.push("The end time must be after the start time.");
  }
  return problems;
}
