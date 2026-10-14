/**
 * US-01, FR-1.5, FR-1.6: bulk onboarding from a CSV file or the SIS feed.
 *
 * `planUserImport` checks every row and decides what would happen to it;
 * `applyUserImport` turns the rows that passed into new records. Nothing here
 * reads a file or touches storage, so the backend can run the same rules.
 *
 * A person who already has an account is never created again (FR-1.6). When
 * their row lists sections they are added to those sections (Q-25), which is
 * how existing students are placed in a new course. Nothing else about an
 * existing account is changed: not its name, email, role or status, and nobody
 * is taken out of a section or moved between sections.
 *
 * Rows are numbered as a spreadsheet shows them: the header is row 1.
 */
import type { AccountStatus, Enrollment, Role, User } from "@/lib/types";

export const IMPORT_COLUMNS = ["name", "email", "role", "sections", "sis_id", "children"] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const REQUIRED_COLUMNS: ImportColumn[] = ["name", "email", "role"];
const ROLES: Role[] = ["student", "faculty", "admin", "parent"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Separates several section codes or children in one cell. */
const LIST_SEPARATOR = /[;|]/;

/** One record as read from the file or feed. */
export interface ImportRecord {
  row: number;
  /** Cell values keyed by column header. */
  values: Record<string, string | undefined>;
  /** Set when the record itself could not be read, e.g. an unclosed quote. */
  problem?: string;
}

export interface ImportSection {
  id: string;
  code: string;
  courseId: string;
  /** False when the section's term is archived. */
  open: boolean;
  /** Who teaches it now. Absent: nobody. */
  facultyIds?: string[];
}

export interface ImportContext {
  users: Array<Pick<User, "id" | "name" | "email" | "role" | "sisId"> & { status?: AccountStatus }>;
  sections: ImportSection[];
  /** Students' places in sections now. Absent: none. */
  enrollments?: Enrollment[];
}

/** A student a parent row links to: an existing account, or another row in the same import. */
export type ChildRef = { userId: string } | { row: number };

export interface ImportRow {
  row: number;
  name: string;
  email: string;
  role: Role | null;
  sisId?: string;
  /**
   * `ready` rows are created. `update` rows are for someone who already has an
   * account and add them to sections. `duplicate` rows are skipped, and `error`
   * rows are reported.
   */
  status: "ready" | "update" | "duplicate" | "error";
  problems: string[];
  /** The sections the row places the person in. For an `update` row, only the ones they are not in yet. */
  sectionIds: string[];
  children: ChildRef[];
  /** `update` rows: the existing account. */
  userId?: string;
  /** `update` rows: what the import does for this person, in words. */
  note?: string;
}

export interface ImportPlan {
  /** Problems with the file as a whole. When there are any, no row is imported. */
  problems: string[];
  /** Columns in the file that the import does not use. */
  ignoredColumns: string[];
  rows: ImportRow[];
}

function normalizeHeader(header: string) {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function splitList(value: string) {
  return value
    .split(LIST_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

function sameText(a: string | undefined, b: string) {
  return a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The sections a row names, with every reason one of them cannot be used. A
 * student can be in one section of a course (Q-10).
 */
function resolveSections(codes: string[], role: Role | null, context: ImportContext) {
  const sections: ImportSection[] = [];
  const problems: string[] = [];
  if (codes.length > 0 && role !== null && role !== "student" && role !== "faculty") {
    return { sections, problems: ["Only students and faculty can be placed in sections."] };
  }
  for (const code of codes) {
    const section = context.sections.find((candidate) => sameText(candidate.code, code));
    if (!section) problems.push(`Section "${code}" does not exist.`);
    else if (!section.open) problems.push(`Section "${code}" belongs to an archived term.`);
    else if (!sections.includes(section)) sections.push(section);
  }
  if (role === "student") {
    sections.forEach((section, index) => {
      const clash = sections.slice(index + 1).find((other) => other.courseId === section.courseId);
      if (clash) {
        problems.push(
          `Sections "${section.code}" and "${clash.code}" are for the same course. A student can be in only one.`,
        );
      }
    });
  }
  return { sections, problems };
}

/**
 * Q-25: a row for someone who already has an account. With no sections it is a
 * duplicate and is skipped. With sections, the person is added to the ones
 * they are not in yet, and nothing else about their account changes.
 */
function planExisting(
  row: ImportRow,
  existing: ImportContext["users"][number],
  who: string,
  codes: string[],
  context: ImportContext,
): ImportRow {
  if (codes.length === 0) return { ...row, status: "duplicate", problems: [who] };
  const fail = (...problems: string[]): ImportRow => ({ ...row, status: "error", problems: [who, ...problems] });

  if (row.role !== null && row.role !== existing.role) {
    return fail(
      `It is a ${existing.role} account and this row says ${row.role}. An import does not change roles, so the sections were not added.`,
    );
  }
  if (existing.status !== undefined && existing.status !== "active") {
    return fail(`The account is ${existing.status}. Reactivate it on the Users page before adding it to sections.`);
  }
  const { sections, problems } = resolveSections(codes, existing.role, context);
  const current =
    existing.role === "student"
      ? context.sections.filter((section) =>
          (context.enrollments ?? []).some((entry) => entry.userId === existing.id && entry.sectionId === section.id),
        )
      : context.sections.filter((section) => section.facultyIds?.includes(existing.id));
  const toAdd = sections.filter((section) => !current.includes(section));
  if (existing.role === "student") {
    for (const section of toAdd) {
      const held = current.find((other) => other.courseId === section.courseId);
      if (held) {
        problems.push(
          `Already in section "${held.code}" of the same course as "${section.code}". An import does not move a student between sections.`,
        );
      }
    }
  }
  if (problems.length > 0) return fail(...problems);
  if (toAdd.length === 0) return { ...row, status: "duplicate", problems: [who, "Already in every section listed."] };
  return {
    ...row,
    status: "update",
    userId: existing.id,
    role: existing.role,
    sectionIds: toAdd.map((section) => section.id),
    note: `${existing.name} already has an account. ${existing.role === "faculty" ? "Now also teaches" : "Added to"} ${toAdd.map((section) => section.code).join(", ")}.`,
  };
}

export function planUserImport(
  headers: string[],
  records: ImportRecord[],
  context: ImportContext,
): ImportPlan {
  const known = headers.map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter((column) => !known.includes(column));
  const ignoredColumns = headers.filter(
    (header) => header.trim() !== "" && !IMPORT_COLUMNS.includes(normalizeHeader(header) as ImportColumn),
  );

  if (missing.length > 0) {
    return {
      problems: [
        `The file is missing ${missing.length === 1 ? "the column" : "the columns"} ${missing
          .map((column) => `"${column}"`)
          .join(", ")}. Download the template to see the expected header row.`,
      ],
      ignoredColumns,
      rows: [],
    };
  }

  const filled = records
    .map((record) => ({
      record,
      cells: Object.fromEntries(
        Object.entries(record.values).map(([header, value]) => [normalizeHeader(header), (value ?? "").trim()]),
      ) as Partial<Record<ImportColumn, string>>,
    }))
    // Blank lines between rows are not rows.
    .filter(({ record, cells }) => record.problem !== undefined || Object.values(cells).some(Boolean));

  if (filled.length === 0) {
    return { problems: ["The file has no rows below the header."], ignoredColumns, rows: [] };
  }

  // Pass 1: check each row on its own and against the accounts that already exist.
  const rows: ImportRow[] = filled.map(({ record, cells }) => {
    const name = cells.name ?? "";
    const email = (cells.email ?? "").toLowerCase();
    const roleText = (cells.role ?? "").toLowerCase();
    const sisId = cells.sis_id || undefined;
    const role = ROLES.includes(roleText as Role) ? (roleText as Role) : null;
    const row: ImportRow = { row: record.row, name, email, role, sisId, status: "ready", problems: [], sectionIds: [], children: [] };

    if (record.problem) {
      return { ...row, status: "error", problems: [record.problem] };
    }

    // FR-1.6: an account that already exists is not created twice. Q-25: it can be added to sections.
    const existing = context.users.find(
      (user) => (email !== "" && sameText(user.email, email)) || (sisId !== undefined && sameText(user.sisId, sisId)),
    );
    if (existing) {
      const who = sameText(existing.email, email)
        ? `An account with this email already exists (${existing.name}).`
        : `SIS ID ${sisId} already belongs to ${existing.name}.`;
      return planExisting(row, existing, who, splitList(cells.sections ?? ""), context);
    }

    const problems: string[] = [];
    if (!name) problems.push("Name is missing.");
    if (!email) problems.push("Email is missing.");
    else if (!EMAIL_PATTERN.test(email)) problems.push(`"${cells.email}" is not a valid email address.`);
    if (!roleText) problems.push("Role is missing.");
    else if (!role) problems.push(`Role "${cells.role}" is not recognised. Use student, faculty, admin or parent.`);

    const resolved = resolveSections(splitList(cells.sections ?? ""), role, context);
    const sections = resolved.sections;
    problems.push(...resolved.problems);

    if (splitList(cells.children ?? "").length > 0 && role !== null && role !== "parent") {
      problems.push("Only parent accounts can have linked children.");
    }

    return {
      ...row,
      status: problems.length > 0 ? "error" : "ready",
      problems,
      sectionIds: sections.map((section) => section.id),
    };
  });

  // Pass 2: the same person twice in one file. The first valid row wins.
  const seenEmails = new Map<string, number>();
  const seenSisIds = new Map<string, number>();
  const seenAccounts = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "update" && row.userId !== undefined) {
      const earlier = seenAccounts.get(row.userId);
      if (earlier === undefined) {
        seenAccounts.set(row.userId, row.row);
      } else {
        row.status = "duplicate";
        row.problems = [`Same person as row ${earlier}.`];
        row.sectionIds = [];
        row.note = undefined;
      }
      continue;
    }
    if (row.status !== "ready") continue;
    const sisKey = row.sisId?.toLowerCase();
    const earlierByEmail = seenEmails.get(row.email);
    const earlierBySis = sisKey === undefined ? undefined : seenSisIds.get(sisKey);
    if (earlierByEmail !== undefined) {
      row.status = "duplicate";
      row.problems = [`Same email as row ${earlierByEmail}.`];
    } else if (earlierBySis !== undefined) {
      row.status = "duplicate";
      row.problems = [`Same SIS ID as row ${earlierBySis}.`];
    } else {
      seenEmails.set(row.email, row.row);
      if (sisKey !== undefined) seenSisIds.set(sisKey, row.row);
    }
  }

  // Pass 3: link parents to students, existing or arriving in this same import.
  const cellsByRow = new Map(filled.map(({ record, cells }) => [record.row, cells]));
  for (const row of rows) {
    if (row.status !== "ready" || row.role !== "parent") continue;
    for (const key of splitList(cellsByRow.get(row.row)?.children ?? "")) {
      const account = context.users.find((user) => sameText(user.email, key) || sameText(user.sisId, key));
      const incoming = rows.find(
        (other) => other.status === "ready" && other.role === "student" && (sameText(other.email, key) || sameText(other.sisId, key)),
      );
      if (account?.role === "student") row.children.push({ userId: account.id });
      else if (account) row.problems.push(`"${key}" is not a student account.`);
      else if (incoming) row.children.push({ row: incoming.row });
      else row.problems.push(`Child "${key}" was not found among existing students or the student rows in this file.`);
    }
    if (row.problems.length > 0) {
      row.status = "error";
      row.children = [];
    }
  }

  return { problems: [], ignoredColumns, rows };
}

export function countImport(plan: ImportPlan) {
  const count = (status: ImportRow["status"]) => plan.rows.filter((row) => row.status === status).length;
  return { ready: count("ready"), update: count("update"), duplicate: count("duplicate"), error: count("error") };
}

export interface ImportChanges {
  /** New accounts. */
  users: User[];
  /** Students' new places in sections, for new and for existing accounts. */
  enrollments: Enrollment[];
  /** Faculty members' new sections, for new and for existing accounts. */
  teaching: Array<{ sectionId: string; userId: string }>;
  /** Existing accounts that were added to sections (Q-25). */
  updatedUserIds: string[];
}

/**
 * The records the `ready` rows create and the section places the `update` rows
 * add. Rows with problems and duplicates change nothing.
 */
export function applyUserImport(plan: ImportPlan, makeId: (row: ImportRow) => string): ImportChanges {
  const usable = plan.problems.length > 0 ? [] : plan.rows;
  const ready = usable.filter((row) => row.status === "ready");
  const idByRow = new Map(ready.map((row) => [row.row, makeId(row)]));
  const changes: ImportChanges = { users: [], enrollments: [], teaching: [], updatedUserIds: [] };

  for (const row of usable) {
    if (row.status !== "update" || row.userId === undefined) continue;
    changes.updatedUserIds.push(row.userId);
    for (const sectionId of row.sectionIds) {
      if (row.role === "student") changes.enrollments.push({ userId: row.userId, sectionId });
      else if (row.role === "faculty") changes.teaching.push({ sectionId, userId: row.userId });
    }
  }

  for (const row of ready) {
    if (!row.role) continue;
    const id = idByRow.get(row.row)!;
    const childIds = row.children
      .map((child) => ("userId" in child ? child.userId : idByRow.get(child.row)))
      .filter((childId): childId is string => childId !== undefined);
    changes.users.push({
      id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: "active",
      ...(row.sisId ? { sisId: row.sisId } : {}),
      ...(row.role === "parent" ? { childIds } : {}),
    });
    for (const sectionId of row.sectionIds) {
      if (row.role === "student") changes.enrollments.push({ userId: id, sectionId });
      else if (row.role === "faculty") changes.teaching.push({ sectionId, userId: id });
    }
  }
  return changes;
}

const RESULT_LABELS: Record<ImportRow["status"], string> = {
  ready: "Created",
  update: "Existing account added to sections",
  duplicate: "Skipped (duplicate)",
  error: "Not imported",
};

/** FR-1.5: the row-level report, as rows for a CSV download. */
export function importReport(plan: ImportPlan): string[][] {
  return [
    ["Row", "Name", "Email", "Role", "Result", "Details"],
    ...plan.rows.map((row) => [
      String(row.row),
      row.name,
      row.email,
      row.role ?? "",
      RESULT_LABELS[row.status],
      row.note ?? row.problems.join(" "),
    ]),
  ];
}

/** The CSV template: the header row and one example per kind of account. */
export function importTemplate(sectionCodes: string[]): string[][] {
  const [first = "SECTION-A", second] = sectionCodes;
  return [
    [...IMPORT_COLUMNS],
    ["Juan Carlo Dela Cruz", "juan.delacruz@dbcc.edu.ph", "student", second ? `${first};${second}` : first, "2026-00101", ""],
    ["Mr. Ernesto Bautista", "ernesto.bautista@dbcc.edu.ph", "faculty", first, "F-3001", ""],
    ["Elena Dela Cruz", "elena.delacruz@gmail.com", "parent", "", "", "juan.delacruz@dbcc.edu.ph"],
  ];
}
