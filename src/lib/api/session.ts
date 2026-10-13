"use client";

/**
 * Mock authentication: who is signed in, and what they may do.
 *
 * Backend seam: `signIn`, `signOut` and the session read become calls to the
 * real auth service. Everything else in the app reads the user through
 * `useActor()` / `getActor()` and checks permissions through `can()` or
 * `authorize()`, so it does not change.
 */
import { useMemo, useSyncExternalStore } from "react";
import { nowIso } from "@/lib/clock";
import { DEMO_USER_IDS } from "@/lib/data/directory";
import {
  can,
  type Action,
  type Actor,
  type Resource,
  type ResourceType,
} from "@/lib/domain/permissions";
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  type Session,
} from "@/lib/domain/session-cookie";
import type { AuditEvent, Enrollment, Role, Section, User } from "@/lib/types";
import { useRepository } from "./_repository";
import { auditRepo, enrollmentsRepo, sectionsRepo, usersRepo } from "./_stores";

/** The signed-in user, with the relationships permission scopes need. */
export interface CurrentUser extends Actor {
  name: string;
  email: string;
}

// --- Session cookie --------------------------------------------------------

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const listeners = new Set<() => void>();
let cachedRaw: string | undefined;
let cachedSession: Session | null = null;

function readCookie() {
  const prefix = `${SESSION_COOKIE}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : "";
}

function getSession(): Session | null {
  if (typeof document === "undefined") return null;
  const raw = readCookie();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = decodeSession(raw);
  }
  return cachedSession;
}

function writeSession(session: Session | null) {
  document.cookie = session
    ? `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`
    : `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `undefined` until the browser has read the cookie; `null` when signed out. */
function getServerSession(): Session | null | undefined {
  return undefined;
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore<Session | null | undefined>(subscribe, getSession, getServerSession);
}

// --- Actor -----------------------------------------------------------------

function buildActor(
  session: Session | null,
  users: User[],
  sections: Section[],
  enrollments: Enrollment[],
): CurrentUser | null {
  if (!session) return null;
  const user = users.find((candidate) => candidate.id === session.userId);
  // FR-1.7: an account that is no longer active has no session.
  if (!user || user.status !== "active") return null;

  const sectionIds =
    user.role === "student"
      ? enrollments.filter((entry) => entry.userId === user.id).map((entry) => entry.sectionId)
      : user.role === "faculty"
        ? sections.filter((section) => section.facultyIds.includes(user.id)).map((section) => section.id)
        : [];
  const courseIds = [
    ...new Set(
      sections.filter((section) => sectionIds.includes(section.id)).map((section) => section.courseId),
    ),
  ];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // The role comes from the user record, so a change by an admin applies at once.
    role: user.role,
    status: user.status,
    childIds: user.childIds ?? [],
    courseIds,
  };
}

/** The signed-in user. `undefined` while loading, `null` when signed out. */
export function useActor(): CurrentUser | null | undefined {
  const session = useSession();
  const users = useRepository(usersRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  return useMemo(
    () => (session === undefined ? undefined : buildActor(session, users, sections, enrollments)),
    [session, users, sections, enrollments],
  );
}

/** The signed-in user, for service functions (outside React). */
export function getActor(): CurrentUser | null {
  return buildActor(getSession(), usersRepo.get(), sectionsRepo.get(), enrollmentsRepo.get());
}

// --- Audit (FR-1.2) ---------------------------------------------------------

let auditCounter = 0;

export function recordAudit(event: Omit<AuditEvent, "id" | "at" | "actorId" | "actorRole">, actor = getActor()) {
  const at = nowIso();
  auditCounter += 1;
  const entry: AuditEvent = {
    ...event,
    id: `audit-${Date.parse(at)}-${auditCounter}`,
    at,
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
  };
  auditRepo.update((events) => [entry, ...events].slice(0, 500));
}

const DENIAL_REPEAT_WINDOW_MS = 2000;
let lastDenial = { key: "", at: 0 };

/**
 * Logs a blocked attempt. The same actor hitting the same resource again
 * within two seconds is one attempt, not several (a page can check twice
 * while it renders).
 */
export function recordDenied(resource: string, detail?: string) {
  const actor = getActor();
  const key = `${actor?.id ?? "anonymous"}|${resource}`;
  const at = Date.now();
  if (lastDenial.key === key && at - lastDenial.at < DENIAL_REPEAT_WINDOW_MS) return;
  lastDenial = { key, at };
  recordAudit({ action: "access.denied", resource, outcome: "denied", detail }, actor);
}

export class PermissionDeniedError extends Error {
  constructor(action: Action, resource: Resource) {
    super(`You don't have permission to ${action} this ${resource.type.replace("-", " ")}.`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * The check every service function runs before it reads or changes anything.
 * Denied attempts are logged, then the call is refused.
 *
 * NOT A SECURITY BOUNDARY. This runs in the browser, where it can be
 * bypassed. The backend must repeat the same check on every request.
 */
export function authorize(action: Action, resource: Resource): CurrentUser {
  const actor = getActor();
  if (!actor || !can(actor, action, resource)) {
    const target = resource.ownerId ?? resource.courseId ?? "*";
    recordDenied(`${resource.type}:${target}`, `Attempted to ${action}`);
    throw new PermissionDeniedError(action, resource);
  }
  return actor;
}

/** `authorize` for a record that belongs to the signed-in user. */
export function authorizeOwn(action: Action, type: ResourceType): CurrentUser {
  return authorize(action, { type, ownerId: getActor()?.id });
}

// --- Sign in and out --------------------------------------------------------

export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInError";
  }
}

const MIN_PASSWORD_LENGTH = 6;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function startSession(user: User, method: string) {
  writeSession({ userId: user.id, role: user.role });
  recordAudit({ action: "auth.sign-in", resource: `user:${user.id}`, outcome: "allowed", detail: method });
}

/**
 * MOCK: any password of six or more characters is accepted for an existing
 * account. Replace with a request to the auth service.
 */
export async function signIn(email: string, password: string): Promise<void> {
  await wait(700);
  const user = usersRepo
    .get()
    .find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || password.length < MIN_PASSWORD_LENGTH) {
    throw new SignInError("That email and password don't match an account.");
  }
  if (user.status !== "active") {
    recordAudit(
      { action: "auth.sign-in", resource: `user:${user.id}`, outcome: "denied", detail: `Account is ${user.status}` },
      null,
    );
    throw new SignInError(
      "This account has been deactivated. Contact your school administrator to restore access.",
    );
  }
  startSession(user, "password");
}

/** Demo shortcut: sign in as the seeded account for a role. */
export function signInAsDemo(role: Role) {
  const user = usersRepo.get().find((candidate) => candidate.id === DEMO_USER_IDS[role]);
  if (user) startSession(user, "demo role switcher");
}

export function demoEmailFor(role: Role) {
  return usersRepo.getServerSnapshot().find((user) => user.id === DEMO_USER_IDS[role])?.email ?? "";
}

export function signOut() {
  if (getSession()) {
    recordAudit({ action: "auth.sign-out", resource: "session", outcome: "allowed" });
  }
  writeSession(null);
}

/**
 * Keeps the cookie in step with the user record: clears it when the account
 * is gone or no longer active, and updates the role after an admin changes it
 * (US-03: role changes take effect on the next page load).
 */
export function reconcileSession() {
  const session = getSession();
  if (!session) return;
  const actor = getActor();
  if (!actor) writeSession(null);
  else if (actor.role !== session.role) writeSession({ userId: actor.id, role: actor.role });
}
