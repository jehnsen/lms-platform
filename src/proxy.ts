/**
 * Optimistic route check (Next.js 16 "Proxy", formerly Middleware).
 *
 * It reads the demo session cookie and redirects before a page is served:
 * signed-out visitors go to the sign-in page, and a role that may not open a
 * page goes to the "no access" page. The rules come from the same table the
 * navigation and the client guard use (`src/lib/domain/routes.ts`).
 *
 * NOT A SECURITY BOUNDARY. The cookie is unsigned and set by the browser, and
 * Next.js documents Proxy as a place for optimistic checks only. FR-1.2
 * requires the backend to verify the session and the permission on every
 * request (see docs/requirements/BACKEND-BACKLOG.md).
 */
import { NextResponse, type NextRequest } from "next/server";
import { FORBIDDEN_PATH, SIGN_IN_PATH, canAccessRoute, isPublicPath } from "@/lib/domain/routes";
import { SESSION_COOKIE, decodeSession } from "@/lib/domain/session-cookie";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublicPath(pathname)) {
    // Someone already signed in has no use for the sign-in page.
    return session ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!session) {
    const signIn = new URL(SIGN_IN_PATH, request.url);
    if (pathname !== "/") signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (!canAccessRoute(session.role, pathname)) {
    // The page that receives this writes the denied attempt to the audit log.
    const forbidden = new URL(FORBIDDEN_PATH, request.url);
    forbidden.searchParams.set("from", pathname);
    return NextResponse.redirect(forbidden);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except build assets and the files in /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|thumbnails/|images/).*)"],
};
