import { describe, expect, it } from "vitest";
import { can, type Actor } from "@/lib/domain/permissions";
import { canAccessRoute } from "@/lib/domain/routes";
import { decodeSession, encodeSession } from "@/lib/domain/session-cookie";

const student: Actor = { id: "s1", role: "student", status: "active", childIds: [], courseIds: ["math"] };
const faculty: Actor = { id: "f1", role: "faculty", status: "active", childIds: [], courseIds: ["math"] };
const admin: Actor = { id: "a1", role: "admin", status: "active", childIds: [], courseIds: [] };
const parent: Actor = { id: "p1", role: "parent", status: "active", childIds: ["s1"], courseIds: [] };

describe("US-03: each person only sees what their role permits", () => {
  it("lets a student see their own grades", () => {
    expect(can(student, "view", { type: "grades", ownerId: "s1" })).toBe(true);
  });

  it("blocks a student from another student's grades", () => {
    expect(can(student, "view", { type: "grades", ownerId: "s2" })).toBe(false);
  });

  it("blocks a student from another student's grades even in a shared course", () => {
    expect(can(student, "view", { type: "grades", ownerId: "s2", courseId: "math" })).toBe(false);
  });

  it("keeps students out of faculty and admin resources", () => {
    expect(can(student, "view", { type: "gradebook", courseId: "math" })).toBe(false);
    expect(can(student, "view", { type: "user" })).toBe(false);
    expect(can(student, "view", { type: "audit-log" })).toBe(false);
  });

  it("limits a student to courses they are enrolled in", () => {
    expect(can(student, "view", { type: "course", courseId: "math" })).toBe(true);
    expect(can(student, "view", { type: "course", courseId: "art" })).toBe(false);
    expect(can(student, "submit", { type: "quiz", courseId: "art" })).toBe(false);
  });

  it("limits faculty to the gradebook of courses they teach", () => {
    expect(can(faculty, "view", { type: "gradebook", courseId: "math" })).toBe(true);
    expect(can(faculty, "update", { type: "gradebook", courseId: "math" })).toBe(true);
    expect(can(faculty, "view", { type: "gradebook", courseId: "art" })).toBe(false);
  });

  it("does not let faculty take quizzes or manage users", () => {
    expect(can(faculty, "submit", { type: "quiz", courseId: "math" })).toBe(false);
    expect(can(faculty, "update", { type: "user" })).toBe(false);
  });

  it("lets an admin manage users and read the audit log, but not edit scores", () => {
    expect(can(admin, "update", { type: "user" })).toBe(true);
    expect(can(admin, "view", { type: "audit-log" })).toBe(true);
    expect(can(admin, "view", { type: "gradebook", courseId: "art" })).toBe(true);
    expect(can(admin, "update", { type: "gradebook", courseId: "art" })).toBe(false);
  });

  it("denies a scoped permission when the resource does not say whose it is", () => {
    expect(can(student, "view", { type: "grades" })).toBe(false);
    expect(can(faculty, "view", { type: "gradebook" })).toBe(false);
  });
});

describe("US-05: a parent sees only their linked child", () => {
  it("lets a parent see a linked child's grades and progress", () => {
    expect(can(parent, "view", { type: "grades", ownerId: "s1" })).toBe(true);
    expect(can(parent, "view", { type: "progress", ownerId: "s1" })).toBe(true);
  });

  it("blocks a parent from other students' data", () => {
    expect(can(parent, "view", { type: "grades", ownerId: "s2" })).toBe(false);
    expect(can(parent, "view", { type: "progress", ownerId: "s2" })).toBe(false);
  });

  it("does not let a parent submit work or change progress for the child", () => {
    expect(can(parent, "submit", { type: "quiz", courseId: "math" })).toBe(false);
    expect(can(parent, "update", { type: "progress", ownerId: "s1" })).toBe(false);
  });
});

describe("FR-1.7: non-active accounts can do nothing", () => {
  it("denies everything to inactive and archived accounts", () => {
    expect(can({ ...student, status: "inactive" }, "view", { type: "grades", ownerId: "s1" })).toBe(false);
    expect(can({ ...admin, status: "archived" }, "view", { type: "user" })).toBe(false);
  });

  it("denies everything when nobody is signed in", () => {
    expect(can(null, "view", { type: "tutor" })).toBe(false);
    expect(can(undefined, "view", { type: "tutor" })).toBe(false);
  });
});

describe("page access by role", () => {
  it("gives each role only its own pages", () => {
    expect(canAccessRoute("student", "/quizzes/ml-quiz-1")).toBe(true);
    expect(canAccessRoute("student", "/gradebook")).toBe(false);
    expect(canAccessRoute("faculty", "/gradebook")).toBe(true);
    expect(canAccessRoute("faculty", "/quizzes")).toBe(false);
    expect(canAccessRoute("admin", "/gradebook")).toBe(true);
    expect(canAccessRoute("admin", "/lesson-planner")).toBe(false);
    expect(canAccessRoute("parent", "/courses")).toBe(false);
  });

  it("opens the learner grades page to students and parents only", () => {
    expect(canAccessRoute("student", "/grades")).toBe(true);
    expect(canAccessRoute("parent", "/grades")).toBe(true);
    expect(canAccessRoute("faculty", "/grades")).toBe(false);
    expect(canAccessRoute("admin", "/grades")).toBe(false);
  });

  it("does not treat a longer path as a match for a shorter rule", () => {
    // "/gradebook" must not be governed by the "/grades" rule.
    expect(canAccessRoute("student", "/gradebook")).toBe(false);
    expect(canAccessRoute("parent", "/gradebook")).toBe(false);
  });

  it("leaves pages without a rule open to every signed-in role", () => {
    for (const role of ["student", "faculty", "admin", "parent"] as const) {
      expect(canAccessRoute(role, "/")).toBe(true);
      expect(canAccessRoute(role, "/forbidden")).toBe(true);
    }
  });
});

describe("session cookie", () => {
  it("round-trips a session", () => {
    const session = { userId: "u-1", role: "faculty" as const };
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("rejects missing, malformed and unknown-role values", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("not json")).toBeNull();
    expect(decodeSession(encodeURIComponent(JSON.stringify({ userId: "u-1", role: "root" })))).toBeNull();
    expect(decodeSession(encodeURIComponent(JSON.stringify({ role: "admin" })))).toBeNull();
  });
});
