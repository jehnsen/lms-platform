"use client";

/**
 * Users service: accounts, roles, statuses, parent–child links and bulk
 * onboarding (Epic A).
 *
 * Backend seam: `GET /users`, `PATCH /users/:id`, `PUT /users/:id/password`,
 * `PUT|DELETE /users/:id/children/:studentId`, `POST /users/imports` (dry run
 * and commit) and `POST /integrations/sis/sync`. The server runs the checks in
 * `src/lib/domain/user-import.ts` itself; a browser's verdict is never trusted.
 */
import { useMemo } from "react";
import { mockSis } from "@/lib/adapters/sis";
import { nowIso } from "@/lib/clock";
import { courses as courseCatalogue } from "@/lib/data/courses";
import { meetsPasswordPolicy } from "@/lib/domain/password-policy";
import { can } from "@/lib/domain/permissions";
import { isCourseArchived } from "@/lib/domain/terms";
import {
  applyUserImport,
  countImport,
  importTemplate,
  planUserImport,
  type ImportContext,
  type ImportPlan,
  type ImportRecord,
} from "@/lib/domain/user-import";
import type { AccountStatus, Role, User } from "@/lib/types";
import { storeCredential } from "./_credentials";
import { useRepository } from "./_repository";
import {
  enrollmentsRepo,
  sectionsRepo,
  settingsRepo,
  sisSyncRepo,
  termsRepo,
  usersRepo,
  type SisSyncState,
} from "./_stores";
import { authorize, recordAudit, useActor } from "./session";

const NO_USERS: User[] = [];

/** Every account. `null` unless the signed-in user may manage users. */
export function useUsers(): User[] | null {
  const actor = useActor();
  const users = useRepository(usersRepo);
  return can(actor, "view", { type: "user" }) ? users : null;
}

/** The students linked to the signed-in parent (US-05). Empty for other roles. */
export function useLinkedChildren(): User[] {
  const actor = useActor();
  const users = useRepository(usersRepo);
  return useMemo(() => {
    if (!actor || actor.childIds.length === 0) return NO_USERS;
    return users.filter((user) => actor.childIds.includes(user.id));
  }, [actor, users]);
}

/**
 * Section codes per user id: the sections a student is enrolled in or a
 * faculty member teaches. `null` unless the signed-in user may manage users.
 */
export function useUserSections(): Record<string, string[]> | null {
  const actor = useActor();
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const users = useRepository(usersRepo);
  return useMemo(() => {
    if (!can(actor, "view", { type: "user" })) return null;
    const codeOf = new Map(sections.map((section) => [section.id, section.code]));
    const result: Record<string, string[]> = {};
    for (const user of users) {
      const sectionIds =
        user.role === "student"
          ? enrollments.filter((entry) => entry.userId === user.id).map((entry) => entry.sectionId)
          : user.role === "faculty"
            ? sections.filter((section) => section.facultyIds.includes(user.id)).map((section) => section.id)
            : [];
      result[user.id] = sectionIds.flatMap((id) => codeOf.get(id) ?? []).sort();
    }
    return result;
  }, [actor, sections, enrollments, users]);
}

// --- Changing one account (US-03, US-04, US-05) ------------------------------

/** A change the rules do not allow, with a message for the person making it. */
export class UserChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserChangeError";
  }
}

function requireUser(userId: string) {
  const user = usersRepo.get().find((candidate) => candidate.id === userId);
  if (!user) throw new UserChangeError("That account no longer exists.");
  return user;
}

function patchUser(userId: string, changes: Partial<User>) {
  usersRepo.update((users) => users.map((user) => (user.id === userId ? { ...user, ...changes } : user)));
}

/**
 * US-03: change someone's role. It applies the next time that person loads a
 * page, and the change is written to the audit log. Their sections and linked
 * children are kept, unused, in case the role is changed back.
 */
export async function updateUserRole(userId: string, role: Role): Promise<void> {
  const actor = authorize("update", { type: "user" });
  const user = requireUser(userId);
  if (user.role === role) return;
  if (user.id === actor.id) {
    throw new UserChangeError("You can't change your own role. Ask another administrator.");
  }
  patchUser(userId, { role });
  recordAudit({
    action: "user.role-change",
    resource: `user:${userId}`,
    outcome: "allowed",
    detail: `${user.role} → ${role}`,
  });
}

/**
 * US-04, FR-1.7: activate, deactivate or archive accounts, one or many. Only
 * active accounts can sign in; nothing is deleted. Returns how many changed.
 */
export async function setUserStatus(userIds: string[], status: AccountStatus): Promise<number> {
  const actor = authorize("update", { type: "user" });
  if (status !== "active" && userIds.includes(actor.id)) {
    throw new UserChangeError("You can't deactivate or archive your own account. Ask another administrator.");
  }
  const changing = usersRepo.get().filter((user) => userIds.includes(user.id) && user.status !== status);
  if (changing.length === 0) return 0;
  const ids = new Set(changing.map((user) => user.id));
  usersRepo.update((users) => users.map((user) => (ids.has(user.id) ? { ...user, status } : user)));
  for (const user of changing) {
    recordAudit({
      action: "user.status-change",
      resource: `user:${user.id}`,
      outcome: "allowed",
      detail: `${user.status} → ${status}`,
    });
  }
  return changing.length;
}

/** US-05: link a parent account to a student. */
export async function linkChild(parentId: string, studentId: string): Promise<void> {
  authorize("update", { type: "user" });
  const parent = requireUser(parentId);
  const student = requireUser(studentId);
  if (parent.role !== "parent") throw new UserChangeError("Only parent accounts can be linked to a child.");
  if (student.role !== "student") throw new UserChangeError("A parent can only be linked to a student account.");
  const childIds = parent.childIds ?? [];
  if (childIds.includes(studentId)) return;
  patchUser(parentId, { childIds: [...childIds, studentId] });
  recordAudit({
    action: "user.link-child",
    resource: `user:${parentId}`,
    outcome: "allowed",
    detail: `Linked to ${student.name} (${studentId})`,
  });
}

export async function unlinkChild(parentId: string, studentId: string): Promise<void> {
  authorize("update", { type: "user" });
  const parent = requireUser(parentId);
  const childIds = parent.childIds ?? [];
  if (!childIds.includes(studentId)) return;
  patchUser(parentId, { childIds: childIds.filter((id) => id !== studentId) });
  recordAudit({
    action: "user.unlink-child",
    resource: `user:${parentId}`,
    outcome: "allowed",
    detail: `Unlinked from ${studentId}`,
  });
}

/**
 * FR-1.4: give a local account a password. It must meet the school's password
 * policy. MOCK: see `_credentials.ts`; the password itself is never logged.
 */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  authorize("update", { type: "user" });
  const user = requireUser(userId);
  if (!meetsPasswordPolicy(password, settingsRepo.get().passwordPolicy)) {
    throw new UserChangeError("That password doesn't meet the school's password policy.");
  }
  storeCredential(user.id, password);
  recordAudit({ action: "user.password-set", resource: `user:${userId}`, outcome: "allowed" });
}

// --- Bulk onboarding (US-01) -------------------------------------------------

/** Files above this size are refused before they are read. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function importContext(): ImportContext {
  const terms = termsRepo.get();
  return {
    users: usersRepo.get(),
    sections: sectionsRepo.get().map((section) => {
      const course = courseCatalogue.find((candidate) => candidate.id === section.courseId);
      return {
        id: section.id,
        code: section.code,
        courseId: section.courseId,
        open: course !== undefined && !isCourseArchived(course, terms),
      };
    }),
  };
}

/** FR-1.5: the CSV template, with section codes that exist in this school. */
export function userImportTemplate(): string[][] {
  return importTemplate(
    importContext()
      .sections.filter((section) => section.open)
      .map((section) => section.code),
  );
}

/**
 * Reads a CSV file and reports what importing it would do, row by row.
 * Nothing is saved until `commitUserImport`.
 */
export async function previewUserImport(file: File): Promise<ImportPlan> {
  authorize("create", { type: "user" });
  if (file.size > MAX_IMPORT_BYTES) {
    return { problems: ["That file is larger than 5 MB. Split it into smaller files."], ignoredColumns: [], rows: [] };
  }
  // The parser is only needed here, so it stays out of every other page's bundle (NFR-2).
  const Papa = (await import("papaparse")).default;
  const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: false });
  const [headers = [], ...lines] = parsed.data;
  const problemAt = new Map(parsed.errors.map((error) => [error.row, error.message]));
  const records: ImportRecord[] = lines.map((cells, index) => ({
    // The header is spreadsheet row 1, so the first record is row 2.
    row: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, cells[column]])),
    problem: problemAt.has(index + 1) ? `This row could not be read: ${problemAt.get(index + 1)}.` : undefined,
  }));
  return planUserImport(headers, records, importContext());
}

let importCounter = 0;

function saveImport(plan: ImportPlan, source: string): ImportPlan {
  const stamp = Date.parse(nowIso());
  const changes = applyUserImport(plan, () => {
    importCounter += 1;
    return `u-import-${stamp}-${importCounter}`;
  });
  if (changes.users.length > 0) {
    usersRepo.update((users) => [...users, ...changes.users]);
    enrollmentsRepo.update((enrollments) => [...enrollments, ...changes.enrollments]);
    sectionsRepo.update((sections) =>
      sections.map((section) => {
        const added = changes.teaching.filter((entry) => entry.sectionId === section.id).map((entry) => entry.userId);
        return added.length > 0 ? { ...section, facultyIds: [...section.facultyIds, ...added] } : section;
      }),
    );
  }
  const counts = countImport(plan);
  recordAudit({
    action: "users.import",
    resource: `users:${source}`,
    outcome: "allowed",
    detail: `${counts.ready} created, ${counts.duplicate} duplicates skipped, ${counts.error} not imported`,
  });
  return plan;
}

/**
 * Creates the accounts for the rows that passed. The file is checked again
 * against the accounts that exist now, so a row that became a duplicate since
 * the preview is skipped rather than created twice (FR-1.6).
 */
export async function commitUserImport(file: File): Promise<ImportPlan> {
  const plan = await previewUserImport(file);
  return plan.problems.length > 0 ? plan : saveImport(plan, "csv");
}

export function useSisSync(): SisSyncState {
  return useRepository(sisSyncRepo);
}

/**
 * FR-1.6: a manual sync with the SIS. New people are created; people who
 * already have an account are left as they are; records the import rejects
 * are returned in the report. Scheduled syncs need a server.
 */
export async function syncFromSis(): Promise<ImportPlan> {
  authorize("create", { type: "user" });
  const roster = await mockSis.fetchRoster();
  const records: ImportRecord[] = roster.map((entry, index) => ({
    row: index + 1,
    values: {
      name: entry.name,
      email: entry.email,
      role: entry.role,
      sections: entry.sectionCodes.join(";"),
      sis_id: entry.sisId,
    },
  }));
  const plan = saveImport(
    planUserImport(["name", "email", "role", "sections", "sis_id"], records, importContext()),
    "sis",
  );
  const counts = countImport(plan);
  sisSyncRepo.update(() => ({
    lastRunAt: nowIso(),
    created: counts.ready,
    skipped: counts.duplicate,
    failed: counts.error,
  }));
  return plan;
}
