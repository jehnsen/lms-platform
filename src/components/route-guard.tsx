"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ForbiddenView } from "@/components/forbidden-view";
import { PageSkeleton } from "@/components/ui";
import { reconcileSession, useActor } from "@/lib/api/session";
import { SIGN_IN_PATH, canAccessRoute } from "@/lib/domain/routes";
import { isLeavingPage } from "@/lib/navigation";

/**
 * Client-side page guard for everything behind sign-in. `src/proxy.ts` makes
 * the same check before a page is served; this one also covers navigation
 * that never reaches the server and a role that changes mid-session.
 *
 * While the session is unknown (always the case on the server) it renders a
 * skeleton, so prerendered HTML never contains one role's data.
 *
 * NOT A SECURITY BOUNDARY: see the note in `src/proxy.ts`.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const actor = useActor();
  const pathname = usePathname();
  const router = useRouter();
  const signedOut = actor === null;

  // Drop the cookie of a deactivated account; pick up a changed role (US-03).
  useEffect(() => {
    reconcileSession();
  }, [actor]);

  useEffect(() => {
    if (signedOut && !isLeavingPage()) router.replace(SIGN_IN_PATH);
  }, [signedOut, router]);

  // The user is being switched and this page is about to be replaced.
  if (!actor || isLeavingPage()) return <PageSkeleton />;
  if (!canAccessRoute(actor.role, pathname)) return <ForbiddenView resource={`route:${pathname}`} />;
  return children;
}
