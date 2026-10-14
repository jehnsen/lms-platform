import { describe, expect, it } from "vitest";
import {
  applyUserImport,
  countImport,
  importReport,
  importTemplate,
  planUserImport,
  type ImportContext,
  type ImportRecord,
} from "@/lib/domain/user-import";

const HEADERS = ["name", "email", "role", "sections", "sis_id", "children"];

const context: ImportContext = {
  users: [
    { id: "u-1", name: "Aiko Tanaka", email: "aiko.tanaka@example.com", role: "student", sisId: "S-1001" },
    { id: "u-2", name: "Marco Reyes", email: "marco.reyes@example.com", role: "faculty" },
  ],
  sections: [
    { id: "math-a", code: "MATH-101-A", courseId: "math", open: true },
    { id: "math-b", code: "MATH-101-B", courseId: "math", open: true },
    { id: "art-a", code: "ART-200-A", courseId: "art", open: true },
    { id: "old-a", code: "HIST-100-A", courseId: "history", open: false },
  ],
};

/** Builds records the way the CSV reader does: the header is row 1, so data starts at row 2. */
function records(...lines: string[][]): ImportRecord[] {
  return lines.map((cells, index) => ({
    row: index + 2,
    values: Object.fromEntries(HEADERS.map((header, column) => [header, cells[column]])),
  }));
}

function plan(...lines: string[][]) {
  return planUserImport(HEADERS, records(...lines), context);
}

let nextId = 0;
const makeId = () => `new-${(nextId += 1)}`;

describe("US-01: a valid file creates accounts with the correct role and section", () => {
  it("creates a student enrolled in the listed sections", () => {
    const result = plan(["Jordan Rivera", "Jordan.Rivera@Example.com", "Student", "math-101-a; ART-200-A", "S-2001", ""]);
    expect(result.problems).toEqual([]);
    expect(result.rows[0]).toMatchObject({ status: "ready", role: "student", sectionIds: ["math-a", "art-a"] });

    const changes = applyUserImport(result, () => "new-student");
    expect(changes.users).toEqual([
      {
        id: "new-student",
        name: "Jordan Rivera",
        email: "jordan.rivera@example.com",
        role: "student",
        status: "active",
        sisId: "S-2001",
      },
    ]);
    expect(changes.enrollments).toEqual([
      { userId: "new-student", sectionId: "math-a" },
      { userId: "new-student", sectionId: "art-a" },
    ]);
    expect(changes.teaching).toEqual([]);
  });

  it("creates a faculty member teaching the listed sections", () => {
    const changes = applyUserImport(plan(["Dr. Noor Haddad", "noor@example.com", "faculty", "MATH-101-B", "", ""]), () => "new-faculty");
    expect(changes.users[0]).toMatchObject({ id: "new-faculty", role: "faculty" });
    expect(changes.teaching).toEqual([{ sectionId: "math-b", userId: "new-faculty" }]);
    expect(changes.enrollments).toEqual([]);
  });

  it("links a parent to an existing student and to a student in the same file", () => {
    const result = plan(
      ["Jordan Rivera", "jordan@example.com", "student", "MATH-101-A", "S-2001", ""],
      ["Alex Rivera", "alex@example.com", "parent", "", "", "jordan@example.com; S-1001"],
    );
    expect(result.rows[1].status).toBe("ready");
    const ids: Record<number, string> = { 2: "new-jordan", 3: "new-alex" };
    const changes = applyUserImport(result, (row) => ids[row.row]);
    expect(changes.users.find((user) => user.id === "new-alex")?.childIds).toEqual(["new-jordan", "u-1"]);
  });

  it("accepts headers in any case, with spaces, and ignores extra columns", () => {
    const result = planUserImport(
      ["Name", " Email ", "ROLE", "SIS ID", "Homeroom"],
      [{ row: 2, values: { Name: "Sam Lee", " Email ": "sam@example.com", ROLE: "student", "SIS ID": "S-9", Homeroom: "4B" } }],
      context,
    );
    expect(result.rows[0]).toMatchObject({ status: "ready", sisId: "S-9" });
    expect(result.ignoredColumns).toEqual(["Homeroom"]);
  });

  it("skips blank lines without shifting row numbers", () => {
    const result = plan(
      ["Sam Lee", "sam@example.com", "student", "", "", ""],
      ["", "", "", "", "", ""],
      ["Kim Ito", "kim@example.com", "student", "", "", ""],
    );
    expect(result.rows.map((row) => row.row)).toEqual([2, 4]);
  });
});

describe("US-01: invalid rows are reported row by row and the valid rows are still created", () => {
  const result = plan(
    ["Sam Lee", "sam@example.com", "student", "MATH-101-A", "", ""],
    ["", "not-an-email", "teacher", "", "", ""],
    ["Kim Ito", "kim@example.com", "student", "CHEM-300-A", "", ""],
    ["Lou Park", "lou@example.com", "faculty", "ART-200-A", "", ""],
  );

  it("reports every problem on the row it belongs to", () => {
    expect(result.rows[1]).toMatchObject({ row: 3, status: "error" });
    expect(result.rows[1].problems).toEqual([
      "Name is missing.",
      '"not-an-email" is not a valid email address.',
      'Role "teacher" is not recognised. Use student, faculty, admin or parent.',
    ]);
    expect(result.rows[2]).toMatchObject({ row: 4, status: "error", problems: ['Section "CHEM-300-A" does not exist.'] });
  });

  it("still creates the valid rows", () => {
    expect(countImport(result)).toEqual({ ready: 2, duplicate: 0, error: 2 });
    const changes = applyUserImport(result, makeId);
    expect(changes.users.map((user) => user.email)).toEqual(["sam@example.com", "lou@example.com"]);
  });

  it("produces a report with one line per row and the reason", () => {
    const report = importReport(result);
    expect(report[0]).toEqual(["Row", "Name", "Email", "Role", "Result", "Problems"]);
    expect(report[1]).toEqual(["2", "Sam Lee", "sam@example.com", "student", "Created", ""]);
    expect(report[3]).toEqual(["4", "Kim Ito", "kim@example.com", "student", "Not imported", 'Section "CHEM-300-A" does not exist.']);
  });

  it("rejects a section in an archived term", () => {
    expect(plan(["Sam Lee", "sam@example.com", "student", "HIST-100-A", "", ""]).rows[0].problems).toEqual([
      'Section "HIST-100-A" belongs to an archived term.',
    ]);
  });

  it("rejects two sections of the same course for one student", () => {
    expect(plan(["Sam Lee", "sam@example.com", "student", "MATH-101-A;MATH-101-B", "", ""]).rows[0]).toMatchObject({
      status: "error",
      problems: ['Sections "MATH-101-A" and "MATH-101-B" are for the same course. A student can be in only one.'],
    });
  });

  it("lets a faculty member teach two sections of the same course", () => {
    expect(plan(["Lou Park", "lou@example.com", "faculty", "MATH-101-A;MATH-101-B", "", ""]).rows[0].status).toBe("ready");
  });

  it("rejects sections on a parent and children on a non-parent", () => {
    expect(plan(["Alex Rivera", "alex@example.com", "parent", "MATH-101-A", "", ""]).rows[0].problems).toEqual([
      "Only students and faculty can be placed in sections.",
    ]);
    expect(plan(["Sam Lee", "sam@example.com", "student", "", "", "aiko.tanaka@example.com"]).rows[0].problems).toEqual([
      "Only parent accounts can have linked children.",
    ]);
  });

  it("rejects a parent whose child cannot be found or is not a student", () => {
    const parents = plan(
      ["Alex Rivera", "alex@example.com", "parent", "", "", "nobody@example.com"],
      ["Dana Reyes", "dana@example.com", "parent", "", "", "marco.reyes@example.com"],
    );
    expect(parents.rows[0].problems).toEqual([
      'Child "nobody@example.com" was not found among existing students or the student rows in this file.',
    ]);
    expect(parents.rows[1].problems).toEqual(['"marco.reyes@example.com" is not a student account.']);
    expect(applyUserImport(parents, makeId).users).toEqual([]);
  });

  it("does not link a parent to a student row that has errors", () => {
    const result2 = plan(
      ["Jordan Rivera", "jordan@example.com", "pupil", "", "", ""],
      ["Alex Rivera", "alex@example.com", "parent", "", "", "jordan@example.com"],
    );
    expect(result2.rows.map((row) => row.status)).toEqual(["error", "error"]);
  });

  it("carries a row the file reader could not parse into the report", () => {
    const result2 = planUserImport(HEADERS, [{ row: 2, values: {}, problem: "This row could not be read: unclosed quote." }], context);
    expect(result2.rows[0]).toMatchObject({ status: "error", problems: ["This row could not be read: unclosed quote."] });
  });

  it("refuses the whole file when a required column is missing", () => {
    const result2 = planUserImport(["name", "role"], [{ row: 2, values: { name: "Sam", role: "student" } }], context);
    expect(result2.rows).toEqual([]);
    expect(result2.problems[0]).toContain('"email"');
    expect(applyUserImport(result2, makeId).users).toEqual([]);
  });

  it("refuses a file with a header and no rows", () => {
    expect(planUserImport(HEADERS, [], context).problems).toEqual(["The file has no rows below the header."]);
  });
});

describe("US-01, FR-1.6: duplicate users are detected and not created twice", () => {
  it("skips a row whose email already has an account, whatever its case", () => {
    const result = plan(["Aiko T.", "AIKO.TANAKA@example.com", "student", "MATH-101-A", "", ""]);
    expect(result.rows[0]).toMatchObject({
      status: "duplicate",
      problems: ["An account with this email already exists (Aiko Tanaka)."],
    });
    expect(applyUserImport(result, makeId)).toEqual({ users: [], enrollments: [], teaching: [] });
  });

  it("skips a row whose SIS ID already has an account, even with a new email", () => {
    const result = plan(["Aiko Tanaka", "aiko.new@example.com", "student", "", "s-1001", ""]);
    expect(result.rows[0]).toMatchObject({ status: "duplicate", problems: ["SIS ID s-1001 already belongs to Aiko Tanaka."] });
  });

  it("creates the first of two rows for the same person and skips the second", () => {
    const result = plan(
      ["Sam Lee", "sam@example.com", "student", "", "S-7", ""],
      ["Samuel Lee", "SAM@example.com", "student", "", "", ""],
      ["S. Lee", "sam.lee@example.com", "student", "", "S-7", ""],
    );
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "duplicate", "duplicate"]);
    expect(result.rows[1].problems).toEqual(["Same email as row 2."]);
    expect(result.rows[2].problems).toEqual(["Same SIS ID as row 2."]);
    expect(applyUserImport(result, makeId).users).toHaveLength(1);
  });

  it("does not count an invalid row as the first of a pair", () => {
    const result = plan(
      ["Sam Lee", "sam@example.com", "pupil", "", "", ""],
      ["Sam Lee", "sam@example.com", "student", "", "", ""],
    );
    expect(result.rows.map((row) => row.status)).toEqual(["error", "ready"]);
  });

  it("creates nothing when the same file is imported a second time", () => {
    const lines = [["Sam Lee", "sam@example.com", "student", "MATH-101-A", "S-7", ""]];
    const first = applyUserImport(planUserImport(HEADERS, records(...lines), context), makeId);
    const after: ImportContext = { ...context, users: [...context.users, ...first.users] };
    const second = planUserImport(HEADERS, records(...lines), after);
    expect(countImport(second)).toEqual({ ready: 0, duplicate: 1, error: 0 });
  });
});

describe("FR-1.5: the CSV template", () => {
  it("passes its own validation", () => {
    const [headers, ...lines] = importTemplate(["MATH-101-A", "ART-200-A"]);
    const result = planUserImport(
      headers,
      lines.map((cells, index) => ({
        row: index + 2,
        values: Object.fromEntries(headers.map((header, column) => [header, cells[column]])),
      })),
      context,
    );
    expect(result.problems).toEqual([]);
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "ready", "ready"]);
  });
});
