/**
 * Attendance rules (Epic E): how a session's roster is checked (FR-5.1), when
 * a submitted sheet can still be corrected (FR-5.2), how the attendance rate
 * is counted against the school's threshold (FR-5.4), and when an alert is
 * due (FR-5.5). No clock and no storage: callers pass `now`.
 */
import type { AttendanceChange, AttendancePolicy, AttendanceSheet, AttendanceStatus } from "@/lib/types";

/** In the order of US-19. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

/** Q-19: used until the school sets its own policy. */
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  thresholdPercent: 80,
  minSessions: 5,
  late: "present",
  excused: "excluded",
  editWindowHours: 48,
  coordinatorIds: [],
};

export const ATTENDANCE_RANGES = {
  thresholdPercent: { min: 1, max: 100 },
  minSessions: { min: 1, max: 50 },
  editWindowHours: { min: 0, max: 720 },
} as const;

/** Why this attendance policy cannot be saved. Empty when it can. */
export function attendancePolicyProblems(policy: AttendancePolicy): string[] {
  const problems: string[] = [];
  const { thresholdPercent, minSessions, editWindowHours } = ATTENDANCE_RANGES;
  if (
    !Number.isFinite(policy.thresholdPercent) ||
    policy.thresholdPercent < thresholdPercent.min ||
    policy.thresholdPercent > thresholdPercent.max
  ) {
    problems.push(`The attendance threshold must be from ${thresholdPercent.min} to ${thresholdPercent.max} percent.`);
  }
  if (!Number.isInteger(policy.minSessions) || policy.minSessions < minSessions.min || policy.minSessions > minSessions.max) {
    problems.push(
      `The number of sessions before attendance is checked must be a whole number from ${minSessions.min} to ${minSessions.max}.`,
    );
  }
  if (
    !Number.isInteger(policy.editWindowHours) ||
    policy.editWindowHours < editWindowHours.min ||
    policy.editWindowHours > editWindowHours.max
  ) {
    problems.push(
      `The time allowed for correcting attendance must be a whole number of hours from ${editWindowHours.min} to ${editWindowHours.max}.`,
    );
  }
  return problems;
}

// --- Taking and correcting attendance (US-19) ----------------------------------------

/** Attendance is taken from the day of the class onwards, never ahead of it. */
export function canTakeOn(sessionDate: string, today: string) {
  return sessionDate <= today;
}

/** Why a roster cannot be submitted: every student on it needs one of the four marks. */
export function sheetProblems(studentIds: string[], marks: Record<string, AttendanceStatus | undefined>): string[] {
  const unmarked = studentIds.filter((id) => !ATTENDANCE_STATUSES.includes(marks[id] as AttendanceStatus)).length;
  if (unmarked === 0) return [];
  return [`${unmarked} ${unmarked === 1 ? "student is" : "students are"} not marked yet. Mark everyone before you submit.`];
}

/** The moment a submitted sheet stops being correctable. */
export function editClosesAt(sheet: Pick<AttendanceSheet, "submittedAt">, policy: Pick<AttendancePolicy, "editWindowHours">) {
  return new Date(Date.parse(sheet.submittedAt) + policy.editWindowHours * 60 * 60 * 1000).toISOString();
}

export type EditDecision = { allowed: true; closesAt: string } | { allowed: false; reason: string };

/** FR-5.2: a submitted sheet can be corrected until the school's window has passed. */
export function editDecision(
  sheet: Pick<AttendanceSheet, "submittedAt">,
  policy: Pick<AttendancePolicy, "editWindowHours">,
  now: string,
): EditDecision {
  if (policy.editWindowHours <= 0) {
    return { allowed: false, reason: "The school does not allow attendance to be changed once it is submitted." };
  }
  const closesAt = editClosesAt(sheet, policy);
  if (Date.parse(now) > Date.parse(closesAt)) {
    const hours = policy.editWindowHours;
    return {
      allowed: false,
      reason: `This attendance was submitted more than ${hours} ${hours === 1 ? "hour" : "hours"} ago, so it can no longer be changed.`,
    };
  }
  return { allowed: true, closesAt };
}

/** FR-5.2: what a correction changed, one entry for each student whose mark is different. */
export function markChanges(
  before: Record<string, AttendanceStatus>,
  after: Record<string, AttendanceStatus>,
  by: { byId: string; at: string },
): AttendanceChange[] {
  return Object.keys(after)
    .filter((studentId) => before[studentId] !== after[studentId])
    .sort()
    .map((studentId) => ({
      at: by.at,
      byId: by.byId,
      studentId,
      from: before[studentId] ?? null,
      to: after[studentId],
    }));
}

// --- The attendance rate (FR-5.4) ------------------------------------------------------

export interface AttendanceSummary {
  /** Sessions with a mark for this student. */
  recorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Sessions that count towards the rate, and how many of them count as attended. */
  counted: number;
  attended: number;
  /** Percent attended, not rounded. `null` while nothing counts. */
  rate: number | null;
}

type CountingRules = Pick<AttendancePolicy, "late" | "excused">;

/** One student's attendance from their marks, counted the way the school's policy says. */
export function summarize(statuses: AttendanceStatus[], rules: CountingRules): AttendanceSummary {
  const count = (status: AttendanceStatus) => statuses.filter((candidate) => candidate === status).length;
  const present = count("present");
  const absent = count("absent");
  const late = count("late");
  const excused = count("excused");
  const lateShare = rules.late === "present" ? 1 : rules.late === "half" ? 0.5 : 0;
  const counted = present + absent + late + (rules.excused === "excluded" ? 0 : excused);
  const attended = present + late * lateShare + (rules.excused === "present" ? excused : 0);
  return {
    recorded: statuses.length,
    present,
    absent,
    late,
    excused,
    counted,
    attended,
    rate: counted === 0 ? null : (attended / counted) * 100,
  };
}

/** A student's marks in the given sheets, oldest session first. */
export function marksOf(studentId: string, sheets: AttendanceSheet[]): AttendanceStatus[] {
  return [...sheets]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .flatMap((sheet) => (sheet.marks[studentId] ? [sheet.marks[studentId]] : []));
}

type ThresholdRules = Pick<AttendancePolicy, "thresholdPercent" | "minSessions">;

/**
 * True when the rate is below the school's threshold. Not checked until enough
 * sessions count, so one absence in the first week is not a breach.
 */
export function isBelowThreshold(summary: AttendanceSummary, policy: ThresholdRules) {
  return summary.rate !== null && summary.counted >= policy.minSessions && summary.rate < policy.thresholdPercent;
}

/**
 * FR-5.5 (US-21): one alert for each breach. A breach begins when the rate
 * falls below the threshold and lasts until it is back at or above it. The
 * alert is due only when a breach begins, however long it then lasts.
 */
export function alertDecision(
  wasBreached: boolean,
  summary: AttendanceSummary,
  policy: ThresholdRules,
): { breached: boolean; alert: boolean } {
  const breached = isBelowThreshold(summary, policy);
  return { breached, alert: breached && !wasBreached };
}

/** A rate for display, to one decimal place so a rate just under the threshold does not read as on it. */
export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${Number(rate.toFixed(1))}%`;
}

/** The counting rules in a sentence, for the people the rate is shown to. */
export function describeCounting(rules: CountingRules) {
  const late =
    rules.late === "present" ? "Late counts as attended" : rules.late === "half" ? "Late counts as half a session" : "Late counts as missed";
  const excused =
    rules.excused === "excluded"
      ? "excused sessions are left out"
      : rules.excused === "present"
        ? "excused sessions count as attended"
        : "excused sessions count as missed";
  return `${late}, and ${excused}.`;
}

/** The words of a low-attendance alert. */
export function alertMessage(
  studentName: string,
  courseTitle: string,
  summary: AttendanceSummary,
  policy: Pick<AttendancePolicy, "thresholdPercent">,
) {
  return {
    title: `Attendance below ${policy.thresholdPercent}%: ${studentName}`,
    body: `${studentName} has attended ${formatRate(summary.rate)} of ${courseTitle} (${Number(summary.attended.toFixed(1))} of ${summary.counted} sessions). The school expects at least ${policy.thresholdPercent}%.`,
  };
}
