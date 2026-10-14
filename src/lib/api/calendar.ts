"use client";

/**
 * Calendar service (BR-18): each person's timetable and academic calendar,
 * and the exams, holidays and other events on it.
 *
 * Backend seam: `GET /calendar?from=&to=` (the server builds it for the
 * caller, or for a parent's child), `GET|POST /calendar-events`,
 * `PUT|DELETE /calendar-events/:id`. Classes and due dates are not stored as
 * calendar entries: they follow from schedules, quizzes and assignments, so a
 * change to any of them is on the calendar at once (US-20).
 */
import { useMemo } from "react";
import { localParts } from "@/lib/clock";
import { isSetFor } from "@/lib/domain/assignments";
import { isForSections } from "@/lib/domain/community";
import { can } from "@/lib/domain/permissions";
import { calendarItems, eventProblems, type CalendarItem, type DateRange } from "@/lib/domain/schedule";
import type { CalendarEvent, Course, User } from "@/lib/types";
import { useRepository } from "./_repository";
import {
  assignmentsRepo,
  calendarEventsRepo,
  coursesRepo,
  enrollmentsRepo,
  liveSessionsRepo,
  quizzesRepo,
  sectionsRepo,
  termsRepo,
  usersRepo,
  viewedChildRepo,
} from "./_stores";
import { notify } from "./notifications";
import { authorize, recordAudit, useActor } from "./session";
import { useLinkedChildren } from "./users";

/** A calendar event that cannot be saved, with every reason. */
export class CalendarError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "CalendarError";
  }
}

export interface CalendarView {
  items: CalendarItem[];
  /** The courses on this calendar, to filter by. */
  courses: Array<Pick<Course, "id" | "title" | "code">>;
  /** Whose calendar it is, when it is not the signed-in user's own: a parent's child. */
  learner: User | undefined;
  /** A parent's linked children, to choose between. */
  children: User[];
  /** The courses the signed-in user may add events to, and whether they may add school-wide ones. */
  editableCourses: Array<Pick<Course, "id" | "title" | "code">>;
  canAddSchoolWide: boolean;
  /** Every stored event the signed-in user may change, by id. */
  editableEventIds: string[];
}

/**
 * FR-5.3: the role-specific calendar for a range of dates. A student gets
 * their own classes and deadlines, a parent their child's, faculty what they
 * teach, and an admin the whole school. `undefined` while loading, `null`
 * when the role has no calendar.
 */
export function useCalendar(range: DateRange): CalendarView | null | undefined {
  const actor = useActor();
  const users = useRepository(usersRepo);
  const courses = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const terms = useRepository(termsRepo);
  const quizzes = useRepository(quizzesRepo);
  const assignments = useRepository(assignmentsRepo);
  const events = useRepository(calendarEventsRepo);
  const liveSessions = useRepository(liveSessionsRepo);
  const selection = useRepository(viewedChildRepo);
  const children = useLinkedChildren();
  const { from, to } = range;

  return useMemo(() => {
    if (actor === undefined) return undefined;
    if (!actor || !can(actor, "view", { type: "calendar" })) return null;

    // A parent looks at the calendar of one linked child.
    const learner =
      actor.role === "parent" ? (children.find((child) => child.id === selection[actor.id]) ?? children[0]) : undefined;
    const person = actor.role === "parent" ? learner : users.find((user) => user.id === actor.id);
    const asStudent = person?.role === "student";

    const enrolled = person ? enrollments.filter((entry) => entry.userId === person.id).map((entry) => entry.sectionId) : [];
    const mySections =
      actor.role === "admin"
        ? sections
        : asStudent
          ? sections.filter((section) => enrolled.includes(section.id))
          : person
            ? sections.filter((section) => section.facultyIds.includes(person.id))
            : [];
    const myCourses =
      actor.role === "admin" ? courses : courses.filter((course) => mySections.some((section) => section.courseId === course.id));

    const items = calendarItems(
      {
        courses: myCourses,
        sections: mySections,
        terms,
        quizzes,
        // A student has only the assignments set for their sections.
        assignments: asStudent ? assignments.filter((assignment) => isSetFor(assignment, enrolled)) : assignments,
        events,
        // A student has only the live classes for their sections.
        liveSessions: asStudent
          ? liveSessions.filter((live) =>
              isForSections(
                live,
                sections.filter((section) => section.courseId === live.courseId).map((section) => section.id),
                enrolled,
              ),
            )
          : liveSessions,
        toLocal: localParts,
      },
      { from, to },
    );

    const mayChange = (courseId: string | undefined) => can(actor, "update", { type: "calendar-event", courseId });
    return {
      items,
      courses: [...myCourses].sort((a, b) => a.title.localeCompare(b.title)),
      learner,
      children,
      editableCourses: myCourses
        .filter((course) => can(actor, "create", { type: "calendar-event", courseId: course.id }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      canAddSchoolWide: can(actor, "create", { type: "calendar-event" }),
      editableEventIds: events.filter((event) => mayChange(event.courseId)).map((event) => event.id),
    };
  }, [actor, users, courses, sections, enrollments, terms, quizzes, assignments, events, liveSessions, selection, children, from, to]);
}

/** One stored event, for the form that edits it. */
export function useCalendarEvent(eventId: string | undefined): CalendarEvent | undefined {
  const events = useRepository(calendarEventsRepo);
  return events.find((event) => event.id === eventId);
}

let idCounter = 0;

/** An exam, or a day without classes, is a change people must hear about (US-25). Other events are only on the calendar. */
function isCritical(event: Pick<CalendarEvent, "kind" | "noClasses"> | undefined) {
  return event !== undefined && (event.kind === "exam" || event.noClasses === true);
}

/**
 * Tells the students an exam or a day without classes concerns, and their
 * parents: those of the course, or everyone for a school-wide one. The
 * "schedule" kind is mandatory unless the school changes that (Q-21).
 */
function announceChange(event: CalendarEvent, change: "new" | "changed" | "cancelled") {
  const users = usersRepo.get();
  const sectionIds = event.courseId
    ? sectionsRepo.get().filter((section) => section.courseId === event.courseId).map((section) => section.id)
    : sectionsRepo.get().map((section) => section.id);
  const enrolled = new Set(enrollmentsRepo.get().filter((entry) => sectionIds.includes(entry.sectionId)).map((entry) => entry.userId));
  const students = users.filter((user) => user.role === "student" && user.status === "active" && enrolled.has(user.id));
  const parents = users.filter(
    (user) => user.role === "parent" && user.status === "active" && user.childIds?.some((childId) => students.some((student) => student.id === childId)),
  );
  const course = coursesRepo.get().find((candidate) => candidate.id === event.courseId);
  const what = event.kind === "exam" ? "Exam" : "No classes";
  const when = `${event.date}${event.endDate ? ` to ${event.endDate}` : ""}${event.start ? `, ${event.start}${event.end ? ` to ${event.end}` : ""}` : ""}`;
  const title =
    change === "cancelled" ? `${what} cancelled: ${event.title}` : change === "changed" ? `${what} changed: ${event.title}` : `${what}: ${event.title}`;
  const body =
    change === "cancelled"
      ? `${course?.title ?? "The school"}: this is no longer on the calendar. It was planned for ${when}.`
      : `${course?.title ?? "The whole school"}, ${when}${event.room ? `, ${event.room}` : ""}.`;
  for (const person of [...students, ...parents]) {
    notify({ userId: person.id, category: "schedule", title, body, href: "/calendar" });
  }
}

export interface CalendarEventInput {
  /** Absent: a new event. */
  id?: string;
  title: string;
  kind: CalendarEvent["kind"];
  date: string;
  endDate?: string;
  start?: string;
  end?: string;
  room?: string;
  /** Absent: for the whole school. */
  courseId?: string;
  noClasses: boolean;
}

/**
 * Adds or changes an exam, a holiday or another event. Faculty may do so for
 * the courses they teach; only an admin may for the whole school. Returns the
 * event's id.
 */
export async function saveCalendarEvent(input: CalendarEventInput): Promise<string> {
  const existing = input.id ? calendarEventsRepo.get().find((event) => event.id === input.id) : undefined;
  if (input.id && !existing) throw new CalendarError(["This event no longer exists."]);
  // Changing an event needs the right to the course it is in now and to the one it moves to.
  if (existing) authorize("update", { type: "calendar-event", courseId: existing.courseId });
  const actor = authorize(existing ? "update" : "create", { type: "calendar-event", courseId: input.courseId });

  const blank = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
  const endDate = blank(input.endDate);
  const event: CalendarEvent = {
    id: existing?.id ?? `event-${Date.now().toString(36)}${(idCounter += 1).toString(36)}`,
    title: input.title.trim(),
    kind: input.kind,
    date: input.date,
    endDate: endDate && endDate !== input.date ? endDate : undefined,
    start: blank(input.start),
    end: blank(input.end),
    room: blank(input.room),
    courseId: input.courseId || undefined,
    noClasses: input.noClasses || undefined,
    createdById: existing?.createdById ?? actor.id,
  };
  const problems = eventProblems(event);
  if (problems.length > 0) throw new CalendarError(problems);

  calendarEventsRepo.update((events) =>
    existing ? events.map((candidate) => (candidate.id === event.id ? event : candidate)) : [...events, event],
  );
  recordAudit({
    action: existing ? "calendar.event-update" : "calendar.event-create",
    resource: `calendar-event:${event.id}`,
    outcome: "allowed",
    detail: `${event.title}, ${event.date}${event.endDate ? ` to ${event.endDate}` : ""}${event.noClasses ? ", no classes" : ""}`,
  });
  // US-25: an exam change is a critical alert. A change that only fixes the wording of the same exam still counts.
  if (isCritical(event)) announceChange(event, existing ? "changed" : "new");
  else if (isCritical(existing)) announceChange(existing!, "cancelled");
  return event.id;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const event = calendarEventsRepo.get().find((candidate) => candidate.id === eventId);
  if (!event) return;
  authorize("delete", { type: "calendar-event", courseId: event.courseId });
  calendarEventsRepo.update((events) => events.filter((candidate) => candidate.id !== eventId));
  recordAudit({ action: "calendar.event-delete", resource: `calendar-event:${eventId}`, outcome: "allowed", detail: event.title });
  if (isCritical(event)) announceChange(event, "cancelled");
}
