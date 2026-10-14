/**
 * The one place the app reads the current time. Rules in `src/lib/domain`
 * take `now` as an argument instead of calling this, so they stay testable.
 */
export function now() {
  return new Date();
}

export function nowIso() {
  return now().toISOString();
}

/** Today's date as YYYY-MM-DD, in UTC like every date-only value in the app. */
export function todayIso() {
  return nowIso().slice(0, 10);
}
