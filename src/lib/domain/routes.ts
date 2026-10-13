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
  action: Action;
  resource: ResourceType;
  /** When set, the role's grant must have one of these scopes. */
  scopes?: Scope[];
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/courses", action: "view", resource: "course" },
  { prefix: "/quizzes", action: "submit", resource: "quiz" },
  // The learner's own grades page: students for themselves, parents for a child.
  { prefix: "/grades", action: "view", resource: "grades", scopes: ["own", "child"] },
  { prefix: "/tutor", action: "view", resource: "tutor" },
  { prefix: "/gradebook", action: "view", resource: "gradebook" },
  { prefix: "/content", action: "view", resource: "content-library" },
  { prefix: "/lesson-planner", action: "view", resource: "lesson-plan" },
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
 */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const rule = ROUTE_RULES.filter((candidate) => matches(pathname, candidate.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  if (!rule) return true;
  const scope = scopeFor(role, rule.action, rule.resource);
  if (!scope) return false;
  return rule.scopes ? rule.scopes.includes(scope) : true;
}
