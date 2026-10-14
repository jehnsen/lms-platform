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

export type ResourceType =
  | "course"
  | "course-template"
  | "progress"
  | "quiz"
  | "grades"
  | "gradebook"
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

/** Default permissions per role. Anything not listed is denied. */
export const PERMISSIONS: Record<Role, Grants> = {
  student: {
    course: { view: "course" },
    progress: { view: "own", update: "own" },
    quiz: { view: "course", submit: "course" },
    grades: { view: "own" },
    tutor: { view: "any" },
    notification: OWN_NOTIFICATIONS,
  },
  faculty: {
    // FR-2.1: faculty create courses and edit the ones they teach.
    course: { view: "course", create: "any", update: "course" },
    // FR-2.5: templates are shared; only their author (or an admin) removes one.
    "course-template": { view: "any", create: "any", delete: "own" },
    progress: { view: "course" },
    quiz: { view: "course" },
    grades: { view: "course" },
    gradebook: { view: "course", update: "course", export: "course" },
    "content-library": { view: "any", create: "any", update: "any", delete: "any" },
    "lesson-plan": { view: "own", create: "own", delete: "own" },
    notification: OWN_NOTIFICATIONS,
  },
  admin: {
    course: { view: "any", update: "any" },
    "course-template": { view: "any", delete: "any" },
    progress: { view: "any" },
    quiz: { view: "any" },
    grades: { view: "any" },
    gradebook: { view: "any", export: "any" },
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
