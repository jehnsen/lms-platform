/**
 * Which role may open which page. One table, read by the navigation, the
 * client route guard and `src/proxy.ts`, so they cannot disagree.
 *
 * A page-level rule only asks "does this role hold this permission at all?".
 * Whether the user may see one particular record (this course, that student's
 * grades) is decided by `can()` where the record is loaded.
 */
import { scopeFor, type Action, type ResourceType, type Scope } from "@/lib/domain/permissions";
import type { Role } from "@/lib/types";

interface RouteRule {
  /** Matches the path itself and anything beneath it. */
  prefix: string;
  /** Narrows the rule to paths of this shape, for pages that sit below a record's id. */
  pattern?: RegExp;
  action: Action;
  resource: ResourceType;
  /** When set, the role's grant must have one of these scopes. */
  scopes?: Scope[];
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/courses", action: "view", resource: "course" },
  // FR-2.1: the course builder. Creating and editing are for roles that hold those permissions.
  { prefix: "/courses/new", action: "create", resource: "course" },
  { prefix: "/courses", pattern: /^\/courses\/[^/]+\/edit$/, action: "update", resource: "course" },
  // Students take quizzes; staff see them with their answers. Building and marking are for faculty.
  { prefix: "/quizzes", action: "view", resource: "quiz" },
  { prefix: "/quizzes/new", action: "create", resource: "quiz" },
  { prefix: "/quizzes", pattern: /^\/quizzes\/[^/]+\/edit$/, action: "update", resource: "quiz" },
  { prefix: "/grading", action: "update", resource: "gradebook" },
  // Assignments: everyone who has them may list and open them; setting and marking are for staff.
  { prefix: "/assignments", action: "view", resource: "assignment" },
  { prefix: "/assignments/new", action: "create", resource: "assignment" },
  { prefix: "/assignments", pattern: /^\/assignments\/[^/]+\/edit$/, action: "update", resource: "assignment" },
  {
    prefix: "/assignments",
    pattern: /^\/assignments\/[^/]+\/submissions\/[^/]+$/,
    action: "view",
    resource: "submission",
    scopes: ["course", "any"],
  },
  // The learner's own grades page: students for themselves, parents for a child.
  { prefix: "/grades", action: "view", resource: "grades", scopes: ["own", "child"] },
  // FR-4.4: progress reports. Every role has some; which students it covers is decided when the report is built.
  { prefix: "/reports", action: "view", resource: "grades" },
  // FR-5.3: the timetable and calendar, for every role. FR-5.1: attendance, each role for the students it may see.
  { prefix: "/calendar", action: "view", resource: "calendar" },
  { prefix: "/attendance", action: "view", resource: "attendance" },
  // Epic F: announcements and messages for every role, forums for the people in a course, and everyone's own notifications.
  { prefix: "/announcements", action: "view", resource: "announcement" },
  { prefix: "/messages", action: "view", resource: "message" },
  { prefix: "/forums", action: "view", resource: "forum" },
  { prefix: "/notifications", action: "view", resource: "notification" },
  { prefix: "/tutor", action: "view", resource: "tutor" },
  { prefix: "/gradebook", action: "view", resource: "gradebook" },
  { prefix: "/content", action: "view", resource: "content-library" },
  { prefix: "/lesson-planner", action: "view", resource: "lesson-plan" },
  // The admin area. The longest matching prefix decides, so "/admin" covers any page without its own rule.
  { prefix: "/admin", action: "view", resource: "user" },
  { prefix: "/admin/terms", action: "update", resource: "term" },
  { prefix: "/admin/settings", action: "view", resource: "settings" },
  { prefix: "/admin/audit", action: "view", resource: "audit-log" },
];

/** Reachable without a session. */
export const PUBLIC_PATHS = ["/login"];

export const SIGN_IN_PATH = "/login";
export const FORBIDDEN_PATH = "/forbidden";

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => matches(pathname, path));
}

/**
 * May a signed-in user with this role open this path? Paths with no rule
 * (the home page, the forbidden page, unknown URLs) are open to every role.
 * A rule with a pattern beats one without; after that the longest prefix wins.
 */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const rule = ROUTE_RULES.filter(
    (candidate) => matches(pathname, candidate.prefix) && (!candidate.pattern || candidate.pattern.test(pathname)),
  ).sort((a, b) => Number(Boolean(b.pattern)) - Number(Boolean(a.pattern)) || b.prefix.length - a.prefix.length)[0];
  if (!rule) return true;
  const scope = scopeFor(role, rule.action, rule.resource);
  if (!scope) return false;
  return rule.scopes ? rule.scopes.includes(scope) : true;
}
