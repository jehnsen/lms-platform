export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Dates are formatted in UTC so server and client render the same string. */
export function formatDate(iso: string, withYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatClock(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Month and day for calendar-style date tiles, e.g. { month: "Oct", day: "24" }. */
export function dateParts(iso: string) {
  const [month, day] = formatDate(iso).split(" ");
  return { month, day };
}

/** "Dr. Amara Okafor" -> "AO". Titles are skipped. */
export function initialsOf(name: string) {
  const words = name.split(/\s+/).filter((word) => word && !word.endsWith("."));
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/** "Dr. Amara Okafor" -> "Amara". Titles are skipped. */
export function firstNameOf(name: string) {
  return name.split(/\s+/).find((word) => word && !word.endsWith(".")) ?? name;
}

/** Date and time in the viewer's own time zone. Only for content rendered in the browser. */
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
