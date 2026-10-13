/**
 * The demo session cookie, shared by the browser session service and
 * `src/proxy.ts`.
 *
 * MOCK ONLY. The cookie is written by the browser, unsigned and readable by
 * scripts, so anyone can forge it. A real backend must issue an encrypted,
 * HttpOnly session cookie after authenticating the user (see
 * docs/requirements/BACKEND-BACKLOG.md).
 */
import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "lms_session";

export interface Session {
  userId: string;
  role: Role;
}

const ROLE_VALUES: Role[] = ["student", "faculty", "admin", "parent"];

export function encodeSession(session: Session) {
  return encodeURIComponent(JSON.stringify(session));
}

/** Returns null for a missing or malformed value rather than throwing. */
export function decodeSession(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { userId, role } = parsed as Record<string, unknown>;
    if (typeof userId !== "string" || userId.length === 0) return null;
    if (typeof role !== "string" || !ROLE_VALUES.includes(role as Role)) return null;
    return { userId, role: role as Role };
  } catch {
    return null;
  }
}
