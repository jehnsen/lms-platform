/**
 * Reporting rules (Epic G): at-risk students from configurable rules (FR-7.3),
 * the figures on the class and school dashboards (FR-7.1, FR-7.2), and the
 * report documents that the PDF and Excel exports are made from (FR-7.4).
 *
 * An export is built from the same rows the screen shows, after the same
 * filters, so it cannot contain anything the screen did not (US-28). No clock
 * and no storage here: callers pass `now`.
 */
import type { AtRiskPolicy, AtRiskRule, Role } from "@/lib/types";

// --- At-risk rules (US-27, FR-7.3) ------------------------------------------------------

/** Q-22: the rules a school starts with. An admin changes them in Settings. */
export const DEFAULT_AT_RISK_POLICY: AtRiskPolicy = {
  rules: [
    { id: "risk-grades-attendance", name: "Low grades and low attendance", enabled: true, gradeBelow: 65, attendanceBelow: 85 },
    { id: "risk-failing", name: "Failing the course", enabled: true, gradeBelow: 50 },
    { id: "risk-missing", name: "Falling behind with work", enabled: true, missingAtLeast: 3 },
    { id: "risk-inactive", name: "Not signing in", enabled: false, inactiveDays: 14 },
  ],
};

export const RISK_RANGES = {
  gradeBelow: { min: 1, max: 100 },
  attendanceBelow: { min: 1, max: 100 },
  missingAtLeast: { min: 1, max: 50 },
  inactiveDays: { min: 1, max: 365 },
} as const;

export type RiskCondition = keyof typeof RISK_RANGES;

export const RISK_CONDITIONS: RiskCondition[] = ["gradeBelow", "attendanceBelow", "missingAtLeast", "inactiveDays"];

export const RISK_CONDITION_LABELS: Record<RiskCondition, { label: string; unit: string }> = {
  gradeBelow: { label: "Course grade below", unit: "%" },
  attendanceBelow: { label: "Attendance below", unit: "%" },
  missingAtLeast: { label: "Missing work: at least", unit: "pieces" },
  inactiveDays: { label: "No sign-in for at least", unit: "days" },
};

/** What is known about one student in one course. */
export interface StudentMetrics {
  /** The course total, staff view; `null` while nothing is graded. */
  grade: number | null;
  /** Attendance in the course; `null` while none is recorded. */
  attendance: number | null;
  /** Work past its due date and not handed in. */
  missing: number;
  /** When the student last signed in; absent: never. */
  lastLoginAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since a moment, or `null` when there is none. */
export function daysSince(iso: string | undefined, now: string): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(iso)) / DAY_MS));
}

function oneDecimal(value: number) {
  return Number(value.toFixed(1));
}

/**
 * The reasons a rule matches, one for each condition it sets, or `null` when
 * it does not match: any of its conditions fails, or it sets none. A
 * condition about something not known yet (no grade, no attendance) fails.
 */
export function matchRule(metrics: StudentMetrics, rule: AtRiskRule, now: string): string[] | null {
  const reasons: string[] = [];
  if (rule.gradeBelow !== undefined) {
    if (metrics.grade === null || !(metrics.grade < rule.gradeBelow)) return null;
    reasons.push(`Grade ${metrics.grade}%, below ${rule.gradeBelow}%`);
  }
  if (rule.attendanceBelow !== undefined) {
    if (metrics.attendance === null || !(metrics.attendance < rule.attendanceBelow)) return null;
    reasons.push(`Attendance ${oneDecimal(metrics.attendance)}%, below ${rule.attendanceBelow}%`);
  }
  if (rule.missingAtLeast !== undefined) {
    if (!(metrics.missing >= rule.missingAtLeast)) return null;
    reasons.push(`${metrics.missing} ${metrics.missing === 1 ? "piece" : "pieces"} of work missing`);
  }
  if (rule.inactiveDays !== undefined) {
    const days = daysSince(metrics.lastLoginAt, now);
    if (days !== null && days < rule.inactiveDays) return null;
    reasons.push(days === null ? "Has never signed in" : `No sign-in for ${days} days`);
  }
  return reasons.length > 0 ? reasons : null;
}

export interface RiskMatch {
  ruleId: string;
  name: string;
  reasons: string[];
}

/** FR-7.3: every enabled rule that matches. A student is at risk when this is not empty. */
export function atRiskMatches(metrics: StudentMetrics, policy: AtRiskPolicy, now: string): RiskMatch[] {
  return policy.rules.flatMap((rule) => {
    if (!rule.enabled) return [];
    const reasons = matchRule(metrics, rule, now);
    return reasons ? [{ ruleId: rule.id, name: rule.name, reasons }] : [];
  });
}

/** Why these rules cannot be saved. Empty when they can. */
export function atRiskProblems(policy: AtRiskPolicy): string[] {
  const problems: string[] = [];
  policy.rules.forEach((rule, index) => {
    const name = rule.name.trim() || `Rule ${index + 1}`;
    if (!rule.name.trim()) problems.push(`Give rule ${index + 1} a name.`);
    const used = RISK_CONDITIONS.filter((condition) => rule[condition] !== undefined);
    if (used.length === 0) problems.push(`"${name}" needs at least one condition.`);
    for (const condition of used) {
      const value = rule[condition]!;
      const range = RISK_RANGES[condition];
      const whole = condition === "missingAtLeast" || condition === "inactiveDays";
      if (!Number.isFinite(value) || value < range.min || value > range.max || (whole && !Number.isInteger(value))) {
        problems.push(
          `In "${name}", ${RISK_CONDITION_LABELS[condition].label.toLowerCase()} must be ${whole ? "a whole number " : ""}from ${range.min} to ${range.max}.`,
        );
      }
    }
  });
  const names = policy.rules.map((rule) => rule.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) problems.push("Two rules have the same name.");
  return problems;
}

// --- Dashboard figures (US-26, US-27) ------------------------------------------------------

export const GRADE_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "Below 60", min: 0, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

/** FR-7.1: how many totals fall in each band. A total with nothing graded yet is not counted. */
export function gradeDistribution(percents: Array<number | null>): Array<{ label: string; count: number }> {
  return GRADE_BANDS.map((band) => ({
    label: band.label,
    count: percents.filter((percent) => percent !== null && percent >= band.min && percent <= band.max).length,
  }));
}

/** The plain average of the known values, to one decimal place; `null` when there are none. */
export function meanOf(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : oneDecimal(known.reduce((sum, value) => sum + value, 0) / known.length);
}

export interface UsageInput {
  users: Array<{ role: Role; status: string; lastLoginAt?: string }>;
  /** When each kind of activity happened. */
  quizAttempts: string[];
  handIns: string[];
  forumPosts: string[];
  messages: string[];
}

export interface UsageSummary {
  /** How many days back "recent" goes. */
  days: number;
  /** Active accounts of each role, and how many of them signed in within the window. */
  byRole: Record<Role, { accounts: number; signedIn: number }>;
  quizAttempts: number;
  handIns: number;
  forumPosts: number;
  messages: number;
}

/** FR-7.2: school-wide use over the last `days` days. */
export function usageSummary(input: UsageInput, now: string, days = 7): UsageSummary {
  const since = Date.parse(now) - days * DAY_MS;
  const recent = (moments: string[]) => moments.filter((moment) => Date.parse(moment) >= since && Date.parse(moment) <= Date.parse(now)).length;
  const roles: Role[] = ["student", "faculty", "admin", "parent"];
  const active = input.users.filter((user) => user.status === "active");
  return {
    days,
    byRole: Object.fromEntries(
      roles.map((role) => {
        const accounts = active.filter((user) => user.role === role);
        return [role, { accounts: accounts.length, signedIn: recent(accounts.flatMap((user) => (user.lastLoginAt ? [user.lastLoginAt] : []))) }];
      }),
    ) as UsageSummary["byRole"],
    quizAttempts: recent(input.quizAttempts),
    handIns: recent(input.handIns),
    forumPosts: recent(input.forumPosts),
    messages: recent(input.messages),
  };
}

/** "Today", "Yesterday", "5 days ago" or "Never", for the last sign-in column. */
export function describeLastLogin(iso: string | undefined, now: string) {
  const days = daysSince(iso, now);
  if (days === null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// --- The views a dashboard shows, and their exports (US-28, FR-7.4) -----------------------------

export interface ClassRow {
  studentId: string;
  name: string;
  section: string;
  grade: number | null;
  /** The grade on the course's scale, when it is not a percentage scale. */
  gradeLabel: string | null;
  attendance: number | null;
  missing: number;
  /** The titles of the missing work. */
  missingItems: string[];
  lastLoginAt?: string;
  lessonsDone: number;
  lessonsTotal: number;
  risks: RiskMatch[];
}

export interface ClassFilters {
  /** `null`: every section of the course. */
  sectionId: string | null;
  sectionName: string | null;
  onlyAtRisk: boolean;
}

/** The rows a class dashboard shows for its filters, by name. */
export function filterClassRows(rows: ClassRow[], filters: Pick<ClassFilters, "onlyAtRisk">): ClassRow[] {
  return rows.filter((row) => !filters.onlyAtRisk || row.risks.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}

export interface CourseSummaryRow {
  courseId: string;
  code: string;
  title: string;
  term: string;
  sections: number;
  students: number;
  average: number | null;
  attendance: number | null;
  missing: number;
  atRisk: number;
}

export interface AtRiskEntry {
  studentId: string;
  name: string;
  courseTitle: string;
  section: string;
  risks: RiskMatch[];
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

/** FR-7.4: what a PDF or an Excel file contains. Both formats are made from this, so they always agree. */
export interface ReportDocument {
  title: string;
  /** The filters applied on screen, in words, printed on the export. */
  filters: string[];
  generatedAt: string;
  generatedBy: string;
  tables: ReportTable[];
}

/** A number stays a number, so a spreadsheet can sort and sum it; an unknown value is an empty cell. */
const blank = (value: number | null): string | number => (value === null ? "" : value);

/** US-26, US-28: the class dashboard as a report, for exactly the rows shown. */
export function classReport(
  view: { courseTitle: string; courseCode: string; rows: ClassRow[]; distribution: Array<{ label: string; count: number }> },
  filters: ClassFilters,
  meta: { generatedAt: string; generatedBy: string },
): ReportDocument {
  const rows = filterClassRows(view.rows, filters);
  return {
    title: `Class report: ${view.courseCode} ${view.courseTitle}`,
    filters: [
      `Section: ${filters.sectionName ?? "All sections"}`,
      `Students: ${filters.onlyAtRisk ? "only those at risk" : "everyone"}`,
    ],
    ...meta,
    tables: [
      {
        title: "Students",
        columns: ["Student", "Section", "Grade (%)", "Grade", "Attendance (%)", "Missing work", "Lessons done", "Last sign-in", "At risk"],
        rows: rows.map((row) => [
          row.name,
          row.section,
          blank(row.grade),
          row.gradeLabel ?? "",
          row.attendance === null ? "" : oneDecimal(row.attendance),
          row.missing,
          `${row.lessonsDone}/${row.lessonsTotal}`,
          row.lastLoginAt ? row.lastLoginAt.slice(0, 10) : "Never",
          row.risks.map((risk) => `${risk.name} (${risk.reasons.join("; ")})`).join(". "),
        ]),
      },
      {
        title: "Grade distribution",
        columns: ["Band", "Students"],
        rows: view.distribution.map((band) => [band.label, band.count]),
      },
    ],
  };
}

/** US-27, US-28: the school dashboard as a report: its usage figures, its courses and its at-risk list. */
export function schoolReport(
  view: { termName: string | null; usage: UsageSummary; courses: CourseSummaryRow[]; atRisk: AtRiskEntry[] },
  meta: { generatedAt: string; generatedBy: string },
): ReportDocument {
  const roleNames: Record<Role, string> = { student: "Students", faculty: "Faculty", admin: "Admins", parent: "Parents" };
  return {
    title: "School report",
    filters: [`Term: ${view.termName ?? "All terms"}`, `Usage: the last ${view.usage.days} days`],
    ...meta,
    tables: [
      {
        title: "Usage",
        columns: ["Measure", "Count"],
        rows: [
          ...(Object.keys(roleNames) as Role[]).map((role) => [
            `${roleNames[role]} who signed in`,
            `${view.usage.byRole[role].signedIn} of ${view.usage.byRole[role].accounts}`,
          ]),
          ["Quiz attempts", view.usage.quizAttempts],
          ["Assignments handed in", view.usage.handIns],
          ["Forum posts", view.usage.forumPosts],
          ["Messages", view.usage.messages],
        ],
      },
      {
        title: "Courses",
        columns: ["Code", "Course", "Term", "Sections", "Students", "Average (%)", "Attendance (%)", "Missing work", "At risk"],
        rows: view.courses.map((course) => [
          course.code,
          course.title,
          course.term,
          course.sections,
          course.students,
          blank(course.average),
          blank(course.attendance),
          course.missing,
          course.atRisk,
        ]),
      },
      {
        title: "Students at risk",
        columns: ["Student", "Course", "Section", "Rules", "Why"],
        rows: view.atRisk.map((entry) => [
          entry.name,
          entry.courseTitle,
          entry.section,
          entry.risks.map((risk) => risk.name).join(", "),
          entry.risks.flatMap((risk) => risk.reasons).join("; "),
        ]),
      },
    ],
  };
}

/** A file name for an export: the title in lower case with dashes, and the date. */
export function reportFileName(document: Pick<ReportDocument, "title" | "generatedAt">, extension: "pdf" | "xlsx") {
  const slug = document.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${document.generatedAt.slice(0, 10)}.${extension}`;
}

/** Characters the standard PDF fonts cannot draw, and what to draw instead. */
const PDF_REPLACEMENTS: Record<string, string> = {
  "−": "-",
  "‑": "-",
  "→": "->",
  "≥": ">=",
  "≤": "<=",
  "…": "...",
};

/**
 * Text the standard PDF fonts can draw (Windows-1252). Known symbols are
 * replaced; any other character outside the set becomes "?", so a name in
 * another script is visible as missing rather than drawn as garbage.
 */
export function pdfSafe(text: string): string {
  const extra = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  return [...text]
    .map((char) => {
      if (PDF_REPLACEMENTS[char]) return PDF_REPLACEMENTS[char];
      const code = char.codePointAt(0) ?? 0;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || extra.includes(char) || char === "\n") return char;
      return "?";
    })
    .join("");
}

/** A worksheet name Excel accepts: at most 31 characters, none of : \ / ? * [ ]. */
export function sheetName(title: string, used: string[]) {
  const base = title.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base;
  for (let index = 2; used.includes(name); index += 1) name = `${base.slice(0, 31 - String(index).length - 1)} ${index}`;
  return name;
}
