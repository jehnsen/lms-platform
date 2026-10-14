import { describe, expect, it } from "vitest";
import {
  DEFAULT_AT_RISK_POLICY,
  atRiskMatches,
  atRiskProblems,
  classReport,
  daysSince,
  describeLastLogin,
  filterClassRows,
  gradeDistribution,
  matchRule,
  meanOf,
  pdfSafe,
  reportFileName,
  schoolReport,
  sheetName,
  usageSummary,
  type ClassRow,
  type StudentMetrics,
} from "@/lib/domain/analytics";
import { can, type Actor } from "@/lib/domain/permissions";
import { canAccessRoute } from "@/lib/domain/routes";
import { DEFAULT_SETTINGS, settingsProblems } from "@/lib/domain/settings";
import type { AtRiskPolicy, AtRiskRule } from "@/lib/types";

const NOW = "2026-10-14T09:00:00.000Z";
const daysAgo = (days: number) => new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();

const steady: StudentMetrics = { grade: 82, attendance: 95, missing: 0, lastLoginAt: daysAgo(1) };

describe("at-risk rules (US-27, FR-7.3)", () => {
  const both: AtRiskRule = { id: "r1", name: "Low grades and low attendance", enabled: true, gradeBelow: 65, attendanceBelow: 85 };

  it("flags low grades plus low attendance only when both hold", () => {
    expect(matchRule({ ...steady, grade: 58, attendance: 72 }, both, NOW)).toEqual([
      "Grade 58%, below 65%",
      "Attendance 72%, below 85%",
    ]);
    expect(matchRule({ ...steady, grade: 58 }, both, NOW)).toBeNull();
    expect(matchRule({ ...steady, attendance: 72 }, both, NOW)).toBeNull();
    // On the line is not below it.
    expect(matchRule({ ...steady, grade: 65, attendance: 72 }, both, NOW)).toBeNull();
  });

  it("does not flag what is not known yet", () => {
    expect(matchRule({ ...steady, grade: null, attendance: 40 }, both, NOW)).toBeNull();
    expect(matchRule({ ...steady, grade: 30, attendance: null }, both, NOW)).toBeNull();
  });

  it("counts missing work and days without signing in, and never signing in", () => {
    expect(matchRule({ ...steady, missing: 3 }, { id: "m", name: "Missing", enabled: true, missingAtLeast: 3 }, NOW)).toEqual([
      "3 pieces of work missing",
    ]);
    expect(matchRule({ ...steady, missing: 2 }, { id: "m", name: "Missing", enabled: true, missingAtLeast: 3 }, NOW)).toBeNull();
    const inactive: AtRiskRule = { id: "i", name: "Inactive", enabled: true, inactiveDays: 14 };
    expect(matchRule({ ...steady, lastLoginAt: daysAgo(16) }, inactive, NOW)).toEqual(["No sign-in for 16 days"]);
    expect(matchRule({ ...steady, lastLoginAt: daysAgo(13) }, inactive, NOW)).toBeNull();
    expect(matchRule({ ...steady, lastLoginAt: undefined }, inactive, NOW)).toEqual(["Has never signed in"]);
  });

  it("flags a student when any enabled rule matches, and says which and why", () => {
    const student = { grade: 45, attendance: 70, missing: 4, lastLoginAt: daysAgo(30) };
    expect(atRiskMatches(student, DEFAULT_AT_RISK_POLICY, NOW).map((match) => match.ruleId)).toEqual([
      "risk-grades-attendance",
      "risk-failing",
      "risk-missing",
    ]);
    expect(atRiskMatches(steady, DEFAULT_AT_RISK_POLICY, NOW)).toEqual([]);
  });

  it("follows the rules the administrator configures", () => {
    const student = { ...steady, grade: 62, attendance: 88, lastLoginAt: daysAgo(20) };
    expect(atRiskMatches(student, DEFAULT_AT_RISK_POLICY, NOW)).toEqual([]);
    const stricter: AtRiskPolicy = {
      rules: DEFAULT_AT_RISK_POLICY.rules.map((rule) =>
        rule.id === "risk-grades-attendance" ? { ...rule, attendanceBelow: 90 } : rule.id === "risk-inactive" ? { ...rule, enabled: true } : rule,
      ),
    };
    expect(atRiskMatches(student, stricter, NOW)).toEqual([
      { ruleId: "risk-grades-attendance", name: "Low grades and low attendance", reasons: ["Grade 62%, below 65%", "Attendance 88%, below 90%"] },
      { ruleId: "risk-inactive", name: "Not signing in", reasons: ["No sign-in for 20 days"] },
    ]);
  });

  it("checks the rules before they are saved", () => {
    expect(atRiskProblems(DEFAULT_AT_RISK_POLICY)).toEqual([]);
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
    const broken: AtRiskPolicy = {
      rules: [
        { id: "a", name: "", enabled: true },
        { id: "b", name: "Odd", enabled: true, gradeBelow: 0, missingAtLeast: 1.5, inactiveDays: 400 },
        { id: "c", name: "odd", enabled: false, attendanceBelow: 80 },
      ],
    };
    expect(atRiskProblems(broken)).toEqual([
      "Give rule 1 a name.",
      '"Rule 1" needs at least one condition.',
      'In "Odd", course grade below must be from 1 to 100.',
      'In "Odd", missing work: at least must be a whole number from 1 to 50.',
      'In "Odd", no sign-in for at least must be a whole number from 1 to 365.',
      "Two rules have the same name.",
    ]);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, atRisk: broken })).toHaveLength(6);
  });
});

describe("dashboard figures (US-26, US-27, FR-7.1, FR-7.2)", () => {
  it("shows the grade distribution, leaving out students with nothing graded", () => {
    expect(gradeDistribution([45, 59, 60, 75, 79, 88, 90, 100, null])).toEqual([
      { label: "Below 60", count: 2 },
      { label: "60–69", count: 1 },
      { label: "70–79", count: 2 },
      { label: "80–89", count: 1 },
      { label: "90–100", count: 2 },
    ]);
    expect(meanOf([80, 90, null])).toBe(85);
    expect(meanOf([null])).toBeNull();
  });

  it("shows when each student last signed in", () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
    expect(daysSince(undefined, NOW)).toBeNull();
    expect([daysAgo(0), daysAgo(1), daysAgo(5), undefined].map((iso) => describeLastLogin(iso, NOW))).toEqual([
      "Today",
      "Yesterday",
      "5 days ago",
      "Never",
    ]);
  });

  it("counts school-wide use over the last week", () => {
    const usage = usageSummary(
      {
        users: [
          { role: "student", status: "active", lastLoginAt: daysAgo(1) },
          { role: "student", status: "active", lastLoginAt: daysAgo(10) },
          { role: "student", status: "active" },
          { role: "student", status: "archived", lastLoginAt: daysAgo(1) },
          { role: "faculty", status: "active", lastLoginAt: daysAgo(0) },
        ],
        quizAttempts: [daysAgo(2), daysAgo(8)],
        handIns: [daysAgo(6)],
        forumPosts: [],
        messages: [daysAgo(0), daysAgo(0), daysAgo(30)],
      },
      NOW,
    );
    expect(usage).toEqual({
      days: 7,
      byRole: {
        student: { accounts: 3, signedIn: 1 },
        faculty: { accounts: 1, signedIn: 1 },
        admin: { accounts: 0, signedIn: 0 },
        parent: { accounts: 0, signedIn: 0 },
      },
      quizAttempts: 1,
      handIns: 1,
      forumPosts: 0,
      messages: 2,
    });
  });
});

describe("exports match the screen (US-28, FR-7.4)", () => {
  const row = (name: string, extra: Partial<ClassRow> = {}): ClassRow => ({
    studentId: name.toLowerCase(),
    name,
    section: "Section A",
    grade: 80,
    gradeLabel: "B−",
    attendance: 92.31,
    missing: 0,
    missingItems: [],
    lastLoginAt: daysAgo(1),
    lessonsDone: 3,
    lessonsTotal: 10,
    risks: [],
    ...extra,
  });
  const risky = { ruleId: "risk-failing", name: "Failing the course", reasons: ["Grade 40%, below 50%"] };
  const rows = [row("Zoe"), row("Ann", { grade: 40, risks: [risky], lastLoginAt: undefined }), row("Ben", { grade: null, gradeLabel: null })];
  const meta = { generatedAt: NOW, generatedBy: "Dr. Amara Okafor" };
  const view = { courseTitle: "Algebra", courseCode: "MATH-101", rows, distribution: gradeDistribution(rows.map((item) => item.grade)) };

  it("lists the same students, in the same order, as the screen", () => {
    const all = { sectionId: null, sectionName: null, onlyAtRisk: false };
    expect(filterClassRows(rows, all).map((item) => item.name)).toEqual(["Ann", "Ben", "Zoe"]);
    const report = classReport(view, all, meta);
    expect(report.tables[0].rows.map((cells) => cells[0])).toEqual(["Ann", "Ben", "Zoe"]);
    expect(report.tables[0].rows[0]).toEqual(["Ann", "Section A", 40, "B−", 92.3, 0, "3/10", "Never", "Failing the course (Grade 40%, below 50%)"]);
    expect(report.tables[0].rows[1][2]).toBe("");
  });

  it("applies the filters shown on screen and prints them on the export", () => {
    const filtered = classReport(view, { sectionId: "math-a", sectionName: "Section A", onlyAtRisk: true }, meta);
    expect(filtered.tables[0].rows.map((cells) => cells[0])).toEqual(["Ann"]);
    expect(filtered.filters).toEqual(["Section: Section A", "Students: only those at risk"]);
    expect(filtered).toMatchObject({ title: "Class report: MATH-101 Algebra", generatedBy: "Dr. Amara Okafor", generatedAt: NOW });
    expect(classReport(view, { sectionId: null, sectionName: null, onlyAtRisk: false }, meta).filters).toEqual([
      "Section: All sections",
      "Students: everyone",
    ]);
  });

  it("builds the school report from the school view only", () => {
    const usage = usageSummary({ users: [], quizAttempts: [], handIns: [], forumPosts: [], messages: [] }, NOW);
    const report = schoolReport(
      {
        termName: "2026–27 Term 1",
        usage,
        courses: [{ courseId: "math", code: "MATH-101", title: "Algebra", term: "2026–27 Term 1", sections: 2, students: 30, average: 74.5, attendance: null, missing: 4, atRisk: 2 }],
        atRisk: [{ studentId: "ann", name: "Ann", courseTitle: "Algebra", section: "Section A", risks: [risky] }],
      },
      meta,
    );
    expect(report.filters).toEqual(["Term: 2026–27 Term 1", "Usage: the last 7 days"]);
    expect(report.tables.map((table) => table.title)).toEqual(["Usage", "Courses", "Students at risk"]);
    expect(report.tables[1].rows).toEqual([["MATH-101", "Algebra", "2026–27 Term 1", 2, 30, 74.5, "", 4, 2]]);
    expect(report.tables[2].rows).toEqual([["Ann", "Algebra", "Section A", "Failing the course", "Grade 40%, below 50%"]]);
  });

  it("names files after the report and the day", () => {
    expect(reportFileName({ title: "Class report: MATH-101 Álgebra", generatedAt: NOW }, "pdf")).toBe("class-report-math-101-algebra-2026-10-14.pdf");
    expect(reportFileName({ title: "School report", generatedAt: NOW }, "xlsx")).toBe("school-report-2026-10-14.xlsx");
  });

  it("writes only characters the PDF fonts can draw", () => {
    expect(pdfSafe("Grade A− · Lucía · 60–69 · “quoted”")).toBe("Grade A- · Lucía · 60–69 · “quoted”");
    expect(pdfSafe("王小明 → done")).toBe("??? -> done");
  });

  it("gives every table a worksheet name Excel accepts", () => {
    expect(sheetName("Students at risk", [])).toBe("Students at risk");
    expect(sheetName("Report: [draft] a/b?", [])).toBe("Report   draft  a b");
    expect(sheetName("A".repeat(40), [])).toHaveLength(31);
    expect(sheetName("Courses", ["Courses"])).toBe("Courses 2");
  });
});

describe("who may see dashboards and export them (US-27, US-28)", () => {
  const actor = (role: Actor["role"]): Actor => ({
    id: `${role}-1`,
    role,
    status: "active",
    childIds: [],
    courseIds: role === "faculty" || role === "student" ? ["math"] : [],
    readOnlyCourseIds: [],
  });

  it("limits dashboards to faculty for their own classes and admins for the school", () => {
    expect(can(actor("faculty"), "view", { type: "analytics", courseId: "math" })).toBe(true);
    expect(can(actor("faculty"), "view", { type: "analytics", courseId: "art" })).toBe(false);
    expect(can(actor("faculty"), "view", { type: "analytics" })).toBe(false);
    expect(can(actor("admin"), "view", { type: "analytics" })).toBe(true);
    expect(can(actor("student"), "view", { type: "analytics", courseId: "math" })).toBe(false);
    expect(can(actor("parent"), "view", { type: "analytics" })).toBe(false);
  });

  it("lets only those roles export, and faculty only their own classes", () => {
    expect(can(actor("admin"), "export", { type: "analytics" })).toBe(true);
    expect(can(actor("faculty"), "export", { type: "analytics", courseId: "math" })).toBe(true);
    expect(can(actor("faculty"), "export", { type: "analytics", courseId: "art" })).toBe(false);
    expect(can(actor("student"), "export", { type: "analytics", courseId: "math" })).toBe(false);
    // An archived class can still be looked at and exported.
    expect(can({ ...actor("faculty"), readOnlyCourseIds: ["math"] }, "export", { type: "analytics", courseId: "math" })).toBe(true);
  });

  it("opens the dashboards page to faculty and admins only", () => {
    expect(canAccessRoute("faculty", "/analytics")).toBe(true);
    expect(canAccessRoute("admin", "/analytics")).toBe(true);
    expect(canAccessRoute("student", "/analytics")).toBe(false);
    expect(canAccessRoute("parent", "/analytics")).toBe(false);
  });
});
