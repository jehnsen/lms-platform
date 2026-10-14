/**
 * FR-1.1: the role-permission matrix, and the single check everything goes
 * through. Navigation, the route check and every service call use `can()`.
 *
 * This runs in the browser, so it controls what the interface offers; it does
 * not secure anything. FR-1.2 requires the same rules to be enforced on the
 * server for every request. Keep this file free of React and storage so the
 * backend can share or mirror it.
 */
import type { AccountStatus, Role } from "@/lib/types";

export type Action = "view" | "create" | "update" | "delete" | "submit" | "export";

// Marking a submission is "update" on it; releasing grades is "update" on the assignment.
// Setting up a course's categories, weights and scale, and holding or releasing quiz scores, is "update" on its gradebook.

export type ResourceType =
  | "course"
  | "course-template"
  | "progress"
  | "quiz"
  | "question-bank"
  | "assignment"
  | "submission"
  | "similarity-report"
  | "grades"
  | "gradebook"
  | "sis-export"
  | "attendance"
  | "calendar"
  | "calendar-event"
  | "announcement"
  | "message"
  | "forum"
  | "live-session"
  | "content-library"
  | "lesson-plan"
  | "tutor"
  | "user"
  | "term"
  | "settings"
  | "audit-log"
  | "notification";

/**
 * How far a grant reaches:
 * - `any`: every record of that type.
 * - `own`: records whose owner is the actor.
 * - `child`: records owned by a student linked to the actor (parents, US-05).
 * - `course`: records in a course the actor is enrolled in or teaches.
 */
export type Scope = "any" | "own" | "child" | "course";

export interface Resource {
  type: ResourceType;
  /** The user the record belongs to, e.g. whose grades these are. */
  ownerId?: string;
  courseId?: string;
}

/** The signed-in user plus the relationships scopes are resolved against. */
export interface Actor {
  id: string;
  role: Role;
  status: AccountStatus;
  childIds: string[];
  /** Courses the actor is enrolled in (students) or teaches (faculty). */
  courseIds: string[];
  /** Archived courses. Nobody may change anything in them (FR-1.8). */
  readOnlyCourseIds: string[];
}

type Grants = Partial<Record<ResourceType, Partial<Record<Action, Scope>>>>;

const OWN_NOTIFICATIONS = { view: "own", update: "own" } as const;
// FR-6.2: everyone reads and sends their own messages. Who may write to whom is decided by `messageDecision()`.
const OWN_MESSAGES = { view: "own", create: "own" } as const;

/** Default permissions per role. Anything not listed is denied. */
export const PERMISSIONS: Record<Role, Grants> = {
  student: {
    course: { view: "course" },
    progress: { view: "own", update: "own" },
    quiz: { view: "course", submit: "course" },
    // US-11: students hand work in and see their own submissions, never anyone else's.
    assignment: { view: "course", submit: "course" },
    submission: { view: "own" },
    grades: { view: "own" },
    // US-20, US-21: a student sees their own attendance and their own calendar.
    attendance: { view: "own" },
    calendar: { view: "any" },
    // US-22, US-23, US-24: students read announcements, take part in their courses' forums and join live classes.
    announcement: { view: "course" },
    message: OWN_MESSAGES,
    forum: { view: "course", create: "course" },
    "live-session": { view: "course" },
    tutor: { view: "any" },
    notification: OWN_NOTIFICATIONS,
  },
  faculty: {
    // FR-2.1: faculty create courses and edit the ones they teach.
    course: { view: "course", create: "any", update: "course" },
    // FR-2.5: templates are shared; only their author (or an admin) removes one.
    "course-template": { view: "any", create: "any", delete: "own" },
    progress: { view: "course" },
    // US-12: faculty build quizzes for the courses they teach. Marking by hand is "update" on the gradebook.
    quiz: { view: "course", create: "course", update: "course", delete: "course" },
    // FR-3.5: the question bank is shared; a teacher removes only what they added.
    "question-bank": { view: "any", create: "any", delete: "own" },
    // US-10, US-15: faculty set and mark assignments in the courses they teach.
    assignment: { view: "course", create: "course", update: "course", delete: "course" },
    submission: { view: "course", update: "course" },
    // US-14: similarity reports are for faculty.
    "similarity-report": { view: "course", create: "course" },
    grades: { view: "course" },
    gradebook: { view: "course", update: "course", export: "course" },
    // US-19: faculty take and correct attendance for the sections they teach, and add exams and cancelled classes for their courses.
    attendance: { view: "course", create: "course", update: "course" },
    calendar: { view: "any" },
    "calendar-event": { create: "course", update: "course", delete: "course" },
    // US-22 to US-24: faculty post announcements, moderate forums ("update") and run live classes in their courses.
    announcement: { view: "course", create: "course", delete: "course" },
    message: OWN_MESSAGES,
    forum: { view: "course", create: "course", update: "course" },
    "live-session": { view: "course", create: "course", update: "course" },
    "content-library": { view: "any", create: "any", update: "any", delete: "any" },
    "lesson-plan": { view: "own", create: "own", delete: "own" },
    notification: OWN_NOTIFICATIONS,
  },
  admin: {
    course: { view: "any", update: "any" },
    "course-template": { view: "any", delete: "any" },
    progress: { view: "any" },
    quiz: { view: "any" },
    "question-bank": { view: "any", delete: "any" },
    // Admins oversee assignments and marked work but do not mark it.
    assignment: { view: "any" },
    submission: { view: "any" },
    "similarity-report": { view: "any" },
    grades: { view: "any" },
    gradebook: { view: "any", export: "any" },
    // US-18: sending final grades to the SIS is the administrator's job.
    "sis-export": { create: "any" },
    // Admins oversee attendance but do not take it; they keep the school's calendar.
    attendance: { view: "any" },
    calendar: { view: "any" },
    "calendar-event": { create: "any", update: "any", delete: "any" },
    // Admins see every course's announcements, forums and live classes, and can hide a forum post or remove an announcement.
    announcement: { view: "any", delete: "any" },
    message: OWN_MESSAGES,
    forum: { view: "any", update: "any" },
    "live-session": { view: "any" },
    "content-library": { view: "any" },
    user: { view: "any", create: "any", update: "any", delete: "any" },
    term: { view: "any", update: "any" },
    settings: { view: "any", update: "any" },
    "audit-log": { view: "any" },
    notification: OWN_NOTIFICATIONS,
  },
  // US-05: a parent sees a linked child's records and can change nothing.
  parent: {
    progress: { view: "child" },
    grades: { view: "child" },
    attendance: { view: "child" },
    calendar: { view: "any" },
    // US-05: a parent sees the announcements of a linked child's courses.
    announcement: { view: "child" },
    message: OWN_MESSAGES,
    notification: OWN_NOTIFICATIONS,
  },
};

/** The scope a role holds for an action on a resource type, if any. */
export function scopeFor(role: Role, action: Action, type: ResourceType): Scope | undefined {
  return PERMISSIONS[role][type]?.[action];
}

const READ_ACTIONS: Action[] = ["view", "export"];

/**
 * May this actor do this to this resource? Inactive and archived accounts may
 * do nothing (FR-1.7). A scoped grant needs the matching field on the
 * resource: without `ownerId` or `courseId` the answer is no. In an archived
 * course every role may still look and export, but nothing can be changed
 * (FR-1.8).
 */
export function can(actor: Actor | null | undefined, action: Action, resource: Resource): boolean {
  if (!actor || actor.status !== "active") return false;
  if (
    resource.courseId !== undefined &&
    !READ_ACTIONS.includes(action) &&
    actor.readOnlyCourseIds.includes(resource.courseId)
  ) {
    return false;
  }
  const scope = scopeFor(actor.role, action, resource.type);
  switch (scope) {
    case undefined:
      return false;
    case "any":
      return true;
    case "own":
      return resource.ownerId === actor.id;
    case "child":
      return resource.ownerId !== undefined && actor.childIds.includes(resource.ownerId);
    case "course":
      return resource.courseId !== undefined && actor.courseIds.includes(resource.courseId);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
  parent: "Parent",
};

export const ROLES: Role[] = ["student", "faculty", "admin", "parent"];
