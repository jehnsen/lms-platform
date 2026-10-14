import { describe, expect, it } from "vitest";
import {
  JOIN_OPENS_MINUTES_BEFORE,
  announcementProblems,
  audienceOf,
  isForSections,
  liveProblems,
  liveState,
  postFor,
  postProblems,
  readStats,
  replyDecision,
  reportDecision,
  threadSummaries,
} from "@/lib/domain/community";
import {
  DEFAULT_MESSAGING_POLICY,
  contactsOf,
  conversationsOf,
  messageDecision,
  messageProblems,
  sendDecision,
  type MessagingContext,
} from "@/lib/domain/messaging";
import {
  DEFAULT_NOTIFICATION_POLICY,
  NOTIFICATION_CHANNELS,
  channelsFor,
  emailFor,
  isMandatory,
  prefRows,
  withPref,
} from "@/lib/domain/notifications";
import { can, type Actor } from "@/lib/domain/permissions";
import { calendarItems } from "@/lib/domain/schedule";
import { canAccessRoute } from "@/lib/domain/routes";
import { DEFAULT_SETTINGS, settingsProblems } from "@/lib/domain/settings";
import type {
  Announcement,
  ForumPost,
  ForumThread,
  LiveSession,
  Message,
  NotificationPrefs,
  Role,
  User,
} from "@/lib/types";

function person(id: string, role: Role, extra: Partial<User> = {}): User {
  return { id, name: id, email: `${id}@example.com`, role, status: "active", ...extra };
}

const okafor = person("okafor", "faculty");
const reyes = person("reyes", "faculty");
const admin = person("nair", "admin");
const mike = person("mike", "student");
const aiko = person("aiko", "student");
const ben = person("ben", "student");
const rosa = person("rosa", "parent", { childIds: ["mike"] });
const kenji = person("kenji", "parent", { childIds: ["aiko"] });
const everyone = [okafor, reyes, admin, mike, aiko, ben, rosa, kenji];

/** Okafor teaches math-a (Mike, Aiko) and math-b (Ben). Reyes teaches art-a (Ben). */
const context: MessagingContext = {
  sections: [
    { id: "math-a", facultyIds: ["okafor"] },
    { id: "math-b", facultyIds: ["okafor"] },
    { id: "art-a", facultyIds: ["reyes"] },
  ],
  enrollments: [
    { userId: "mike", sectionId: "math-a" },
    { userId: "aiko", sectionId: "math-a" },
    { userId: "ben", sectionId: "math-b" },
    { userId: "ben", sectionId: "art-a" },
  ],
};
const sections = [
  { id: "math-a", courseId: "math" },
  { id: "math-b", courseId: "math" },
  { id: "art-a", courseId: "art" },
];

const policy = DEFAULT_NOTIFICATION_POLICY;

describe("notification channels (US-25, FR-6.6, FR-6.7)", () => {
  it("sends on every channel until the person chooses otherwise", () => {
    expect(channelsFor({ category: "grades" }, undefined, policy)).toEqual(["in-app", "email", "push"]);
  });

  it("lets email, push and in-app be turned on or off individually", () => {
    let prefs: NotificationPrefs | undefined;
    for (const [channel, on] of [["email", false], ["push", false], ["email", true]] as const) {
      const result = withPref(prefs, "grades", channel, on, policy);
      if ("problem" in result) throw new Error(result.problem);
      prefs = result.prefs;
    }
    expect(channelsFor({ category: "grades" }, prefs, policy)).toEqual(["in-app", "email"]);
    // Another kind of notification is not affected.
    expect(channelsFor({ category: "deadlines" }, prefs, policy)).toEqual(["in-app", "email", "push"]);
    const off = withPref(prefs, "grades", "in-app", false, policy);
    expect("prefs" in off && channelsFor({ category: "grades" }, off.prefs, policy)).toEqual(["email"]);
  });

  it("refuses to switch off a mandatory alert, and says why", () => {
    expect(withPref(undefined, "schedule", "email", false, policy)).toEqual({
      problem: "Exams and timetable alerts are required by the school and cannot be switched off.",
    });
    expect(withPref(undefined, "attendance", "push", false, policy)).toHaveProperty("problem");
    // Switching one on again is always fine.
    expect(withPref(undefined, "schedule", "email", true, policy)).toHaveProperty("prefs");
  });

  it("delivers a critical alert on every channel whatever the person chose", () => {
    const allOff: NotificationPrefs = {
      schedule: { "in-app": false, email: false, push: false },
      grades: { "in-app": false, email: false, push: false },
    };
    // An exam change: its kind is mandatory.
    expect(channelsFor({ category: "schedule" }, allOff, policy)).toEqual(NOTIFICATION_CHANNELS);
    // One notification marked mandatory, in a kind that is not.
    expect(channelsFor({ category: "grades", mandatory: true }, allOff, policy)).toEqual(NOTIFICATION_CHANNELS);
    expect(channelsFor({ category: "grades" }, allOff, policy)).toEqual([]);
    expect(isMandatory({ category: "schedule" }, policy)).toBe(true);
    expect(isMandatory({ category: "grades" }, policy)).toBe(false);
  });

  it("follows the kinds the school makes mandatory", () => {
    const strict = { mandatoryCategories: ["announcements" as const] };
    const quiet: NotificationPrefs = { announcements: { "in-app": true, email: false, push: false } };
    expect(channelsFor({ category: "announcements" }, quiet, policy)).toEqual(["in-app"]);
    expect(channelsFor({ category: "announcements" }, quiet, strict)).toEqual(NOTIFICATION_CHANNELS);
    expect(channelsFor({ category: "schedule" }, { schedule: { "in-app": false, email: false, push: false } }, strict)).toEqual([]);
  });

  it("shows mandatory kinds as on and locked on the preferences screen", () => {
    const rows = prefRows({ grades: { "in-app": true, email: false, push: true }, attendance: { "in-app": false, email: false, push: false } }, policy);
    expect(rows.find((row) => row.category === "grades")).toEqual({
      category: "grades",
      locked: false,
      channels: { "in-app": true, email: false, push: true },
    });
    expect(rows.find((row) => row.category === "attendance")).toEqual({
      category: "attendance",
      locked: true,
      channels: { "in-app": true, email: true, push: true },
    });
    expect(rows.filter((row) => row.locked).map((row) => row.category)).toEqual(["schedule", "attendance", "system"]);
  });

  it("writes an email with a link back to the app", () => {
    expect(emailFor({ title: "Grade released: Essay", body: "Your mark is ready.", href: "/assignments/a1" }, "https://lms.example")).toEqual({
      subject: "Grade released: Essay",
      body: "Your mark is ready.\n\nOpen it: https://lms.example/assignments/a1\n\nYou can change which emails you get under Notifications in the app.",
    });
  });

  it("accepts the default settings", () => {
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
  });
});

describe("announcements (US-22, FR-6.1)", () => {
  const announcement: Announcement = {
    id: "n1",
    courseId: "math",
    sectionIds: [],
    title: "Room change",
    body: "We meet in Room 14 on Monday.",
    authorId: "okafor",
    postedAt: "2026-10-14T08:00:00.000Z",
    channels: ["in-app", "email"],
    readBy: {},
  };

  it("reaches every student of the course, or only the sections chosen", () => {
    expect(audienceOf(announcement, sections, context.enrollments, everyone)).toEqual(["mike", "aiko", "ben"]);
    expect(audienceOf({ ...announcement, sectionIds: ["math-b"] }, sections, context.enrollments, everyone)).toEqual(["ben"]);
    // A deactivated student is not in the audience.
    const users = everyone.map((user) => (user.id === "aiko" ? { ...user, status: "inactive" as const } : user));
    expect(audienceOf(announcement, sections, context.enrollments, users)).toEqual(["mike", "ben"]);
    expect(isForSections(announcement, ["math-a", "math-b"], ["math-a"])).toBe(true);
    expect(isForSections({ sectionIds: ["math-b"] }, ["math-a", "math-b"], ["math-a"])).toBe(false);
  });

  it("goes out through the channels the teacher selected, narrowed by each student's own choices", () => {
    const kind = { category: "announcements" as const };
    expect(channelsFor(kind, undefined, policy, announcement.channels)).toEqual(["in-app", "email"]);
    const noEmail: NotificationPrefs = { announcements: { "in-app": true, email: false, push: true } };
    expect(channelsFor(kind, noEmail, policy, announcement.channels)).toEqual(["in-app"]);
    // Push was not selected, so it is not used even for someone who has it on.
    expect(channelsFor(kind, noEmail, policy, ["push"])).toEqual(["push"]);
    expect(channelsFor(kind, noEmail, policy, ["email"])).toEqual([]);
  });

  it("shows the teacher how many students have read it", () => {
    const audience = ["mike", "aiko", "ben"];
    expect(readStats(announcement, audience)).toEqual({ read: 0, total: 3, unreadIds: audience });
    const opened = { ...announcement, readBy: { mike: "2026-10-14T09:00:00.000Z", ben: "2026-10-14T09:05:00.000Z" } };
    expect(readStats(opened, audience)).toEqual({ read: 2, total: 3, unreadIds: ["aiko"] });
  });

  it("counts only the students it was sent to as readers", () => {
    // The teacher, a parent and a student from another section opened it too.
    const opened = { ...announcement, readBy: { okafor: "t", rosa: "t", ben: "t", mike: "t" } };
    expect(readStats(opened, ["mike", "aiko"])).toEqual({ read: 1, total: 2, unreadIds: ["aiko"] });
  });

  it("needs a title, a message, real sections and at least one channel", () => {
    expect(announcementProblems(announcement, ["math-a", "math-b"])).toEqual([]);
    expect(announcementProblems({ title: " ", body: "", sectionIds: ["art-a"], channels: [] }, ["math-a", "math-b"])).toEqual([
      "Give the announcement a title.",
      "Write the announcement.",
      "One of the sections chosen is not a section of this course.",
      "Choose at least one way to send it.",
    ]);
  });
});

describe("direct messages within role rules (FR-6.2)", () => {
  const rules = DEFAULT_MESSAGING_POLICY;
  const may = (from: User, to: User, changes = {}) => messageDecision(from, to, context, { ...rules, ...changes }).allowed;

  it("lets a teacher message the students they teach and those students' parents", () => {
    expect(may(okafor, mike)).toBe(true);
    expect(may(okafor, rosa)).toBe(true);
    expect(may(reyes, mike)).toBe(false);
    expect(may(reyes, rosa)).toBe(false);
    expect(messageDecision(reyes, mike, context, rules)).toEqual({ allowed: false, reason: "You can message only the students you teach." });
  });

  it("lets staff message each other and an admin message anyone", () => {
    expect(may(okafor, reyes)).toBe(true);
    expect(may(okafor, admin)).toBe(true);
    for (const other of [okafor, mike, rosa]) expect(may(admin, other)).toBe(true);
  });

  it("lets a student message their own teachers, and nobody else by default", () => {
    expect(may(mike, okafor)).toBe(true);
    expect(may(mike, reyes)).toBe(false);
    expect(may(mike, aiko)).toBe(false);
    expect(may(mike, admin)).toBe(false);
    expect(may(mike, rosa)).toBe(false);
    expect(messageDecision(mike, aiko, context, rules)).toEqual({
      allowed: false,
      reason: "The school does not allow students to message each other.",
    });
  });

  it("follows the school's choices for students and parents", () => {
    expect(may(mike, aiko, { studentsToClassmates: true })).toBe(true);
    // Ben is in another section of the same course.
    expect(may(mike, ben, { studentsToClassmates: true })).toBe(false);
    expect(may(mike, okafor, { studentsToTeachers: false })).toBe(false);
    expect(may(rosa, okafor)).toBe(true);
    expect(may(rosa, okafor, { parentsToTeachers: false })).toBe(false);
  });

  it("keeps parents to their own children's teachers and the school office", () => {
    expect(may(rosa, okafor)).toBe(true);
    expect(may(rosa, reyes)).toBe(false);
    expect(may(rosa, admin)).toBe(true);
    expect(may(rosa, mike)).toBe(false);
    expect(may(rosa, kenji)).toBe(false);
  });

  it("refuses a message to oneself or to an account that is not active", () => {
    expect(may(okafor, okafor)).toBe(false);
    expect(may(okafor, { ...mike, status: "inactive" })).toBe(false);
  });

  it("always lets someone answer a message they were sent", () => {
    const fromAdmin: Message = { id: "m1", fromId: "nair", toId: "mike", body: "Please see the office.", sentAt: "2026-10-14T08:00:00.000Z" };
    expect(sendDecision(mike, admin, context, rules, []).allowed).toBe(false);
    expect(sendDecision(mike, admin, context, rules, [fromAdmin]).allowed).toBe(true);
    // Having written to someone does not open the way for them to be written to by a third person.
    expect(sendDecision(aiko, admin, context, rules, [fromAdmin]).allowed).toBe(false);
  });

  it("lists only the people someone may write to", () => {
    expect(contactsOf(mike, everyone, context, rules).map((user) => user.id)).toEqual(["okafor"]);
    expect(contactsOf(rosa, everyone, context, rules).map((user) => user.id)).toEqual(["nair", "okafor"]);
    expect(contactsOf(okafor, everyone, context, rules).map((user) => user.id)).toEqual(["aiko", "ben", "kenji", "mike", "nair", "reyes", "rosa"]);
  });

  it("groups messages into conversations with unread counts, newest first", () => {
    const messages: Message[] = [
      { id: "m1", fromId: "okafor", toId: "mike", body: "Hello", sentAt: "2026-10-14T08:00:00.000Z" },
      { id: "m2", fromId: "mike", toId: "okafor", body: "Hi", sentAt: "2026-10-14T08:05:00.000Z", readAt: "2026-10-14T08:06:00.000Z" },
      { id: "m3", fromId: "okafor", toId: "mike", body: "Bring your book", sentAt: "2026-10-14T08:10:00.000Z" },
      { id: "m4", fromId: "nair", toId: "mike", body: "Office", sentAt: "2026-10-14T09:00:00.000Z", readAt: "2026-10-14T09:01:00.000Z" },
      { id: "m5", fromId: "okafor", toId: "aiko", body: "Other thread", sentAt: "2026-10-14T10:00:00.000Z" },
    ];
    const mine = conversationsOf("mike", messages);
    expect(mine.map((thread) => [thread.otherId, thread.messages.length, thread.unread, thread.last.id])).toEqual([
      ["nair", 1, 0, "m4"],
      ["okafor", 3, 2, "m3"],
    ]);
    expect(conversationsOf("okafor", messages).map((thread) => [thread.otherId, thread.unread])).toEqual([["aiko", 0], ["mike", 0]]);
  });

  it("needs something to send, within the length limit", () => {
    expect(messageProblems("  ")).toEqual(["Write a message first."]);
    expect(messageProblems("x".repeat(2001))).toEqual(["A message can be up to 2000 characters. This one is 2001."]);
    expect(messageProblems("See you Monday.")).toEqual([]);
  });
});

describe("course forums (US-23, FR-6.3)", () => {
  const thread: ForumThread = { id: "t1", courseId: "math", title: "Question on unit 2", authorId: "mike", createdAt: "2026-10-12T10:00:00.000Z" };
  const post = (id: string, authorId: string, createdAt: string, extra: Partial<ForumPost> = {}): ForumPost => ({
    id,
    threadId: "t1",
    courseId: "math",
    authorId,
    body: `Post ${id}`,
    createdAt,
    reports: [],
    ...extra,
  });

  it("organizes threads by course, most recently active first", () => {
    const other: ForumThread = { ...thread, id: "t2", title: "Study group", createdAt: "2026-10-13T10:00:00.000Z" };
    const posts = [
      post("p1", "mike", "2026-10-12T10:00:00.000Z"),
      post("p2", "aiko", "2026-10-14T09:00:00.000Z"),
      post("p3", "ben", "2026-10-13T10:00:00.000Z", { threadId: "t2" }),
    ];
    const summaries = threadSummaries([thread, other], posts);
    expect(summaries.map((summary) => [summary.thread.id, summary.replies, summary.lastPostAt])).toEqual([
      ["t1", 1, "2026-10-14T09:00:00.000Z"],
      ["t2", 0, "2026-10-13T10:00:00.000Z"],
    ]);
  });

  it("lets a participant report a post once, but not their own", () => {
    const reported = post("p2", "aiko", "2026-10-14T09:00:00.000Z", { reports: [{ byId: "mike", at: "t", reason: "Rude" }] });
    expect(reportDecision(reported, "ben")).toEqual({ allowed: true });
    expect(reportDecision(reported, "mike")).toEqual({ allowed: false, reason: "You have already reported this post." });
    expect(reportDecision(reported, "aiko")).toEqual({ allowed: false, reason: "You cannot report your own post." });
    expect(reportDecision({ ...reported, hidden: { byId: "okafor", at: "t" } }, "ben").allowed).toBe(false);
  });

  it("hides a moderated post from students and keeps it for moderators", () => {
    const hidden = post("p2", "aiko", "2026-10-14T09:00:00.000Z", {
      body: "Something inappropriate",
      reports: [{ byId: "mike", at: "t", reason: "Rude" }, { byId: "ben", at: "t", reason: "Offensive" }],
      hidden: { byId: "okafor", at: "2026-10-14T09:30:00.000Z" },
    });
    const forStudent = postFor(hidden, { id: "ben", moderator: false });
    expect(forStudent.body).toBe("");
    expect(forStudent.hidden).toBeDefined();
    // A student sees only their own report, never who else reported it.
    expect(forStudent.reports).toEqual([{ byId: "ben", at: "t", reason: "Offensive" }]);
    // Even its author no longer sees the words on the page.
    expect(postFor(hidden, { id: "aiko", moderator: false }).body).toBe("");
    expect(postFor(hidden, { id: "okafor", moderator: true })).toBe(hidden);
  });

  it("flags threads with reported posts for the moderator until they are dealt with", () => {
    const reports = [{ byId: "mike", at: "t", reason: "Rude" }];
    const posts = [post("p1", "mike", "2026-10-12T10:00:00.000Z"), post("p2", "aiko", "2026-10-14T09:00:00.000Z", { reports })];
    expect(threadSummaries([thread], posts)[0].reported).toBe(1);
    const dealtWith = [posts[0], { ...posts[1], hidden: { byId: "okafor", at: "t" } }];
    expect(threadSummaries([thread], dealtWith)[0].reported).toBe(0);
  });

  it("stops replies to a thread a moderator has locked", () => {
    expect(replyDecision(thread)).toEqual({ allowed: true });
    expect(replyDecision({ locked: true })).toEqual({
      allowed: false,
      reason: "A moderator has locked this thread, so it can be read but not replied to.",
    });
  });

  it("needs a title for a thread and words for every post", () => {
    expect(postProblems("How do I start?", "Question")).toEqual([]);
    expect(postProblems(" ", " ")).toEqual(["Give the thread a title.", "Write the first post."]);
    expect(postProblems("")).toEqual(["Write your reply first."]);
    expect(postProblems("x".repeat(5001))).toEqual(["A post can be up to 5000 characters."]);
  });
});

describe("live classes (US-24, FR-6.4, FR-6.5)", () => {
  const session: Pick<LiveSession, "status" | "startsAt" | "durationMinutes"> = {
    status: "scheduled",
    startsAt: "2026-10-15T09:00:00.000Z",
    durationMinutes: 50,
  };
  const at = (time: string) => Date.parse(`2026-10-15T${time}:00.000Z`);

  it("shows the join button at the scheduled time, not before", () => {
    expect(JOIN_OPENS_MINUTES_BEFORE).toBe(10);
    expect(liveState(session, at("08:00"))).toBe("upcoming");
    expect(liveState(session, at("08:49"))).toBe("upcoming");
    expect(liveState(session, at("08:50"))).toBe("open");
    expect(liveState(session, at("09:00"))).toBe("open");
    expect(liveState(session, at("09:49"))).toBe("open");
  });

  it("takes the join button away when the class is over", () => {
    expect(liveState(session, at("09:50"))).toBe("ended");
    // Ended early by the teacher.
    expect(liveState({ ...session, status: "ended" }, at("09:20"))).toBe("ended");
    expect(liveState({ ...session, status: "cancelled" }, at("09:00"))).toBe("cancelled");
  });

  it("puts a live class on the calendar of the course, unless it is cancelled", () => {
    const live = {
      ...session,
      id: "l1",
      courseId: "math",
      sectionIds: [],
      title: "Revision",
      createdById: "okafor",
      provider: "Mock video",
      meetingId: "m1",
      joinUrl: "https://meet.example.com/j/m1",
    } as LiveSession;
    const source = {
      courses: [{ id: "math", title: "Algebra", code: "MATH-1", termId: "t1" }],
      sections: [],
      terms: [],
      quizzes: [],
      assignments: [],
      events: [],
      toLocal: (iso: string) => ({ date: iso.slice(0, 10), time: iso.slice(11, 16) }),
    };
    const range = { from: "2026-10-12", to: "2026-10-18" };
    expect(calendarItems({ ...source, liveSessions: [live] }, range)).toEqual([
      {
        id: "live:l1",
        kind: "class",
        title: "Live class: Revision",
        date: "2026-10-15",
        start: "09:00",
        end: "09:50",
        courseId: "math",
        detail: "Algebra · Online",
        href: "/courses/math",
      },
    ]);
    expect(calendarItems({ ...source, liveSessions: [{ ...live, status: "cancelled" }] }, range)).toEqual([]);
  });

  it("checks a live class before it is scheduled", () => {
    const draft = { title: "Revision", startsAt: session.startsAt, durationMinutes: 50, sectionIds: ["math-a"] };
    expect(liveProblems(draft, ["math-a", "math-b"], at("08:00"))).toEqual([]);
    // Starting now is fine: it is still running.
    expect(liveProblems(draft, ["math-a"], at("09:10"))).toEqual([]);
    expect(liveProblems({ ...draft, title: "", durationMinutes: 5, sectionIds: ["art-a"] }, ["math-a"], at("12:00"))).toEqual([
      "Give the live class a title.",
      "That time has already passed.",
      "It must last from 10 to 480 minutes.",
      "One of the sections chosen is not a section of this course.",
    ]);
    expect(liveProblems({ ...draft, startsAt: "" }, ["math-a"], at("08:00"))).toEqual(["Choose when it starts."]);
  });
});

describe("who may use the communication tools", () => {
  const actor = (role: Role, extra: Partial<Actor> = {}): Actor => ({
    id: `${role}-1`,
    role,
    status: "active",
    childIds: [],
    courseIds: role === "student" || role === "faculty" ? ["math"] : [],
    readOnlyCourseIds: [],
    ...extra,
  });
  const student = actor("student");
  const faculty = actor("faculty");
  const administrator = actor("admin");
  const parent = actor("parent", { childIds: ["student-1"] });

  it("lets faculty post announcements in their courses and everyone in the course read them", () => {
    expect(can(faculty, "create", { type: "announcement", courseId: "math" })).toBe(true);
    expect(can(faculty, "create", { type: "announcement", courseId: "art" })).toBe(false);
    expect(can(student, "view", { type: "announcement", courseId: "math" })).toBe(true);
    expect(can(student, "create", { type: "announcement", courseId: "math" })).toBe(false);
    expect(can(administrator, "create", { type: "announcement", courseId: "math" })).toBe(false);
    expect(can(parent, "view", { type: "announcement", ownerId: "student-1" })).toBe(true);
    expect(can(parent, "view", { type: "announcement", ownerId: "student-2" })).toBe(false);
  });

  it("lets students post in their courses' forums and faculty and admins moderate", () => {
    expect(can(student, "create", { type: "forum", courseId: "math" })).toBe(true);
    expect(can(student, "create", { type: "forum", courseId: "art" })).toBe(false);
    expect(can(student, "update", { type: "forum", courseId: "math" })).toBe(false);
    expect(can(faculty, "update", { type: "forum", courseId: "math" })).toBe(true);
    expect(can(administrator, "update", { type: "forum", courseId: "art" })).toBe(true);
    expect(can(parent, "view", { type: "forum", courseId: "math" })).toBe(false);
    // An archived course's forum can be read but not posted in.
    expect(can({ ...student, readOnlyCourseIds: ["math"] }, "create", { type: "forum", courseId: "math" })).toBe(false);
    expect(can({ ...student, readOnlyCourseIds: ["math"] }, "view", { type: "forum", courseId: "math" })).toBe(true);
  });

  it("lets only faculty schedule live classes, in their own courses", () => {
    expect(can(faculty, "create", { type: "live-session", courseId: "math" })).toBe(true);
    expect(can(faculty, "create", { type: "live-session", courseId: "art" })).toBe(false);
    expect(can(student, "create", { type: "live-session", courseId: "math" })).toBe(false);
    expect(can(student, "view", { type: "live-session", courseId: "math" })).toBe(true);
  });

  it("gives everyone their own messages and nobody anyone else's", () => {
    for (const who of [student, faculty, administrator, parent]) {
      expect(can(who, "view", { type: "message", ownerId: who.id })).toBe(true);
      expect(can(who, "create", { type: "message", ownerId: who.id })).toBe(true);
      expect(can(who, "view", { type: "message", ownerId: "someone-else" })).toBe(false);
    }
  });

  it("opens each page to the roles that have it", () => {
    for (const role of ["student", "faculty", "admin", "parent"] as const) {
      expect(canAccessRoute(role, "/announcements")).toBe(true);
      expect(canAccessRoute(role, "/messages")).toBe(true);
      expect(canAccessRoute(role, "/notifications")).toBe(true);
    }
    expect(canAccessRoute("student", "/forums")).toBe(true);
    expect(canAccessRoute("student", "/forums/thread-1")).toBe(true);
    expect(canAccessRoute("faculty", "/forums")).toBe(true);
    expect(canAccessRoute("admin", "/forums")).toBe(true);
    expect(canAccessRoute("parent", "/forums")).toBe(false);
  });
});
