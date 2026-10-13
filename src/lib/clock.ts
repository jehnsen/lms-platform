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
