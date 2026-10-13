/**
 * Full browser navigation, for the moments the signed-in user changes (sign
 * in, sign out, role switch). The Next.js router keeps prefetched redirects
 * and recently visited pages in memory; a full load is the one way to be sure
 * none of that, and no component state, carries over from the previous user.
 * Everywhere else use `<Link>` or `useRouter()`.
 */
let leaving = false;

/**
 * Runs `changeUser` (if given), then loads `path` from scratch. From the
 * moment it is called the current page counts as on its way out.
 */
export function reloadTo(path: string, changeUser?: () => void) {
  leaving = true;
  changeUser?.();
  window.location.assign(path);
}

/**
 * True once `reloadTo` has been called. The page still on screen belongs to
 * the previous user, so it must not run access checks against the new one:
 * that would write a denied attempt nobody made to the audit log.
 */
export function isLeavingPage() {
  return leaving;
}
