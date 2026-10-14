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

/**
 * Where a moment falls on this device's calendar: the date (YYYY-MM-DD) and the
 * time of day ("HH:MM"). Classes meet at times on the school's clock, and the
 * device is taken to be in the school's time zone (Q-34), so "today's classes"
 * and the day a deadline falls on are worked out with this.
 */
export function localParts(moment: Date | string | number) {
  const date = new Date(moment);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** Today's date as YYYY-MM-DD, in UTC like every date-only value in the app. */
export function todayIso() {
  return nowIso().slice(0, 10);
}
