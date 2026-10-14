import { describe, expect, it } from "vitest";
import { can, type Actor } from "@/lib/domain/permissions";
import { canAccessRoute } from "@/lib/domain/routes";
import { decodeSession, encodeSession } from "@/lib/domain/session-cookie";

const student: Actor = { id: "s1", role: "student", status: "active", childIds: [], courseIds: ["math"], readOnlyCourseIds: [] };
const faculty: Actor = { id: "f1", role: "faculty", status: "active", childIds: [], courseIds: ["math"], readOnlyCourseIds: [] };
const admin: Actor = { id: "a1", role: "admin", status: "active", childIds: [], courseIds: [], readOnlyCourseIds: [] };
const parent: Actor = { id: "p1", role: "parent", status: "active", childIds: ["s1"], courseIds: [], readOnlyCourseIds: [] };

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

describe("US-03, US-04: only admins manage users, terms and settings", () => {
  it("lets an admin change terms and settings", () => {
    expect(can(admin, "update", { type: "term" })).toBe(true);
    expect(can(admin, "update", { type: "settings" })).toBe(true);
    expect(can(admin, "create", { type: "user" })).toBe(true);
  });

  it("keeps every other role out", () => {
    for (const actor of [student, faculty, parent]) {
      expect(can(actor, "update", { type: "term" })).toBe(false);
      expect(can(actor, "update", { type: "settings" })).toBe(false);
      expect(can(actor, "create", { type: "user" })).toBe(false);
      expect(can(actor, "update", { type: "user" })).toBe(false);
    }
  });
});

describe("US-04, FR-1.8: an archived course is read-only and its grades stay viewable", () => {
  const archived = { readOnlyCourseIds: ["math"] };

  it("blocks a student from submitting a quiz or recording progress", () => {
    const actor = { ...student, ...archived };
    expect(can(actor, "submit", { type: "quiz", courseId: "math" })).toBe(false);
    expect(can(actor, "update", { type: "progress", ownerId: "s1", courseId: "math" })).toBe(false);
  });

  it("blocks faculty and admins from changing the course or its gradebook", () => {
    expect(can({ ...faculty, ...archived }, "update", { type: "course", courseId: "math" })).toBe(false);
    expect(can({ ...faculty, ...archived }, "update", { type: "gradebook", courseId: "math" })).toBe(false);
    expect(can({ ...admin, ...archived }, "update", { type: "course", courseId: "math" })).toBe(false);
  });

  it("still lets authorized users view the course and view and export its grades", () => {
    expect(can({ ...student, ...archived }, "view", { type: "course", courseId: "math" })).toBe(true);
    expect(can({ ...student, ...archived }, "view", { type: "grades", ownerId: "s1", courseId: "math" })).toBe(true);
    expect(can({ ...parent, ...archived }, "view", { type: "grades", ownerId: "s1", courseId: "math" })).toBe(true);
    expect(can({ ...faculty, ...archived }, "view", { type: "gradebook", courseId: "math" })).toBe(true);
    expect(can({ ...faculty, ...archived }, "export", { type: "gradebook", courseId: "math" })).toBe(true);
    expect(can({ ...admin, ...archived }, "export", { type: "gradebook", courseId: "math" })).toBe(true);
  });

  it("does not open archived grades to anyone who could not see them before", () => {
    expect(can({ ...student, ...archived }, "view", { type: "grades", ownerId: "s2", courseId: "math" })).toBe(false);
    expect(can({ ...student, ...archived }, "view", { type: "gradebook", courseId: "math" })).toBe(false);
  });

  it("leaves other courses unaffected", () => {
    const actor = { ...student, courseIds: ["math", "art"], ...archived };
    expect(can(actor, "submit", { type: "quiz", courseId: "art" })).toBe(true);
    expect(can(actor, "update", { type: "progress", ownerId: "s1" })).toBe(true);
  });
});

describe("US-06, US-08: faculty build courses; templates are shared", () => {
  it("lets faculty create a course and edit only the ones they teach", () => {
    expect(can(faculty, "create", { type: "course" })).toBe(true);
    expect(can(faculty, "update", { type: "course", courseId: "math" })).toBe(true);
    expect(can(faculty, "update", { type: "course", courseId: "art" })).toBe(false);
  });

  it("does not let students or parents create or edit courses", () => {
    for (const actor of [student, parent]) {
      expect(can(actor, "create", { type: "course" })).toBe(false);
      expect(can(actor, "update", { type: "course", courseId: "math" })).toBe(false);
    }
  });

  it("lets every teacher use a template, and only its author or an admin delete it", () => {
    expect(can(faculty, "view", { type: "course-template" })).toBe(true);
    expect(can(faculty, "create", { type: "course-template" })).toBe(true);
    expect(can(faculty, "delete", { type: "course-template", ownerId: "f1" })).toBe(true);
    expect(can(faculty, "delete", { type: "course-template", ownerId: "f2" })).toBe(false);
    expect(can(admin, "delete", { type: "course-template", ownerId: "f2" })).toBe(true);
    expect(can(student, "view", { type: "course-template" })).toBe(false);
  });
});

describe("US-10, US-11, US-14, US-15: assignments", () => {
  it("lets faculty set and mark assignments only in the courses they teach", () => {
    expect(can(faculty, "create", { type: "assignment", courseId: "math" })).toBe(true);
    expect(can(faculty, "update", { type: "submission", courseId: "math" })).toBe(true);
    expect(can(faculty, "create", { type: "assignment", courseId: "art" })).toBe(false);
    expect(can(faculty, "update", { type: "submission", courseId: "art" })).toBe(false);
  });

  it("lets a student hand in for their own courses and see only their own submissions", () => {
    expect(can(student, "submit", { type: "assignment", courseId: "math" })).toBe(true);
    expect(can(student, "submit", { type: "assignment", courseId: "art" })).toBe(false);
    expect(can(student, "view", { type: "submission", ownerId: "s1" })).toBe(true);
    expect(can(student, "view", { type: "submission", ownerId: "s2", courseId: "math" })).toBe(false);
    expect(can(student, "update", { type: "submission", ownerId: "s1", courseId: "math" })).toBe(false);
    expect(can(student, "create", { type: "assignment", courseId: "math" })).toBe(false);
  });

  it("shows similarity reports to faculty and admins only", () => {
    expect(can(faculty, "view", { type: "similarity-report", courseId: "math" })).toBe(true);
    expect(can(admin, "view", { type: "similarity-report", courseId: "math" })).toBe(true);
    expect(can(student, "view", { type: "similarity-report", courseId: "math" })).toBe(false);
    expect(can(parent, "view", { type: "similarity-report", courseId: "math" })).toBe(false);
  });

  it("lets admins look at assignments and marked work but not set or mark them", () => {
    expect(can(admin, "view", { type: "assignment", courseId: "art" })).toBe(true);
    expect(can(admin, "view", { type: "submission", courseId: "art" })).toBe(true);
    expect(can(admin, "create", { type: "assignment", courseId: "art" })).toBe(false);
    expect(can(admin, "update", { type: "submission", courseId: "art" })).toBe(false);
  });

  it("closes handing in and marking once the course is archived", () => {
    const archived = { readOnlyCourseIds: ["math"] };
    expect(can({ ...student, ...archived }, "submit", { type: "assignment", courseId: "math" })).toBe(false);
    expect(can({ ...faculty, ...archived }, "update", { type: "submission", courseId: "math" })).toBe(false);
    expect(can({ ...faculty, ...archived }, "view", { type: "submission", courseId: "math" })).toBe(true);
  });

  it("gives parents no access to assignments yet", () => {
    expect(can(parent, "view", { type: "assignment", courseId: "math" })).toBe(false);
    expect(can(parent, "view", { type: "submission", ownerId: "s1" })).toBe(false);
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

  it("opens the course builder to roles that may author courses", () => {
    expect(canAccessRoute("faculty", "/courses/new")).toBe(true);
    expect(canAccessRoute("student", "/courses/new")).toBe(false);
    expect(canAccessRoute("admin", "/courses/new")).toBe(false);
    expect(canAccessRoute("faculty", "/courses/math/edit")).toBe(true);
    expect(canAccessRoute("admin", "/courses/math/edit")).toBe(true);
    expect(canAccessRoute("student", "/courses/math/edit")).toBe(false);
    // The course page and its lessons stay open to students.
    expect(canAccessRoute("student", "/courses/math")).toBe(true);
    expect(canAccessRoute("student", "/courses/math/learn/edit")).toBe(true);
  });

  it("opens assignments to students and staff, and setting and marking to staff", () => {
    for (const role of ["student", "faculty", "admin"] as const) {
      expect(canAccessRoute(role, "/assignments")).toBe(true);
      expect(canAccessRoute(role, "/assignments/asg-1")).toBe(true);
    }
    expect(canAccessRoute("parent", "/assignments")).toBe(false);
    expect(canAccessRoute("faculty", "/assignments/new")).toBe(true);
    expect(canAccessRoute("student", "/assignments/new")).toBe(false);
    expect(canAccessRoute("admin", "/assignments/new")).toBe(false);
    expect(canAccessRoute("faculty", "/assignments/asg-1/edit")).toBe(true);
    expect(canAccessRoute("student", "/assignments/asg-1/edit")).toBe(false);
    expect(canAccessRoute("faculty", "/assignments/asg-1/submissions/s1")).toBe(true);
    expect(canAccessRoute("admin", "/assignments/asg-1/submissions/s1")).toBe(true);
    // A student may not open the marking page, not even for their own work.
    expect(canAccessRoute("student", "/assignments/asg-1/submissions/s1")).toBe(false);
  });

  it("opens the admin area to admins only", () => {
    for (const path of ["/admin/users", "/admin/terms", "/admin/settings", "/admin/audit", "/admin/anything-else"]) {
      expect(canAccessRoute("admin", path)).toBe(true);
      expect(canAccessRoute("student", path)).toBe(false);
      expect(canAccessRoute("faculty", path)).toBe(false);
      expect(canAccessRoute("parent", path)).toBe(false);
    }
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
