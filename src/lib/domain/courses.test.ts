import { describe, expect, it } from "vitest";
import { courseForViewer, lessonAvailability } from "@/lib/domain/content-visibility";
import {
  copyCourse,
  countCourseDates,
  daysBetween,
  shiftCourseDates,
  shiftDate,
  shiftDateTime,
} from "@/lib/domain/course-copy";
import { courseLessons, locateLesson, moveItem, sectionCode } from "@/lib/domain/course-outline";
import { courseProblems, type CourseRulesContext } from "@/lib/domain/course-rules";
import { embedUrlFor, isWebUrl } from "@/lib/domain/links";
import { DEFAULT_UPLOAD_LIMITS_MB, checkUpload, materialKindOf } from "@/lib/domain/uploads";
import type { Course, Lesson, Quiz, Term } from "@/lib/types";

function lesson(id: string, extra: Partial<Lesson> = {}): Lesson {
  return { id, title: `Lesson ${id}`, type: "reading", minutes: 5, summary: "", keyPoints: [], thumbnail: "/t.jpg", ...extra };
}

const course: Course = {
  id: "math",
  title: "Algebra",
  tagline: "",
  description: "",
  subject: "Maths",
  level: "Beginner",
  instructor: "Dr. Lee",
  code: "MATH-101",
  termId: "t1",
  status: "active",
  startsOn: "2026-08-24",
  endsOn: "2026-12-18",
  thumbnail: "/c.jpg",
  accent: "#000000",
  learners: 30,
  rating: 4.5,
  modules: [
    {
      id: "u1",
      title: "Unit 1",
      quizId: "quiz-1",
      lessons: [
        lesson("a"),
        lesson("b", { releaseAt: "2026-09-10T08:00:00.000Z" }),
        lesson("c", { sectionIds: ["sec-a"], checkpoints: [{ id: "cp-1", position: 0.5, prompt: "?", options: ["x"], answer: 0, explanation: "" }] }),
      ],
    },
    { id: "u2", title: "Unit 2", lessons: [lesson("d", { releaseAt: "2026-10-01T08:00:00.000Z", sectionIds: ["sec-b"] })] },
  ],
};

const sections = [
  { id: "sec-a", name: "Section A", meetings: [{ day: 1, start: "09:00", end: "10:00", room: "R1" }] },
  { id: "sec-b", name: "Section B", meetings: [] },
];

const at = (iso: string) => Date.parse(iso);
const ids = (value: Course) => courseLessons(value).map((item) => item.id);

describe("US-06: units and lessons appear in order", () => {
  it("lists lessons in unit order, then lesson order", () => {
    expect(ids(course)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps the new order after a lesson is moved", () => {
    const reordered = { ...course, modules: [{ ...course.modules[0], lessons: moveItem(course.modules[0].lessons, 2, 0) }, course.modules[1]] };
    expect(ids(reordered)).toEqual(["c", "a", "b", "d"]);
    expect(locateLesson(reordered, "a")).toMatchObject({ index: 1, total: 4, previous: { id: "c" }, next: { id: "b" } });
  });

  it("keeps the new order after a unit is moved", () => {
    expect(ids({ ...course, modules: moveItem(course.modules, 1, 0) })).toEqual(["d", "a", "b", "c"]);
  });

  it("ignores a move outside the list", () => {
    const list = ["x", "y"];
    expect(moveItem(list, 0, 2)).toBe(list);
    expect(moveItem(list, -1, 0)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it("builds section codes from the course code and the section name", () => {
    expect(sectionCode("math-101", "Section A")).toBe("MATH-101-A");
    expect(sectionCode("MATH-101", " evening group ")).toBe("MATH-101-EVENING-GROUP");
  });
});

describe("US-09: scheduled release (FR-2.7)", () => {
  it("hides a lesson from students until its release date and time", () => {
    const before = courseForViewer(course, { staff: false, sectionIds: ["sec-a"] }, at("2026-09-10T07:59:59.000Z"));
    expect(ids(before)).toEqual(["a", "c"]);
  });

  it("shows it from that moment on, with no action by anyone", () => {
    const after = courseForViewer(course, { staff: false, sectionIds: ["sec-a"] }, at("2026-09-10T08:00:00.000Z"));
    expect(ids(after)).toEqual(["a", "b", "c"]);
  });

  it("always shows staff everything", () => {
    expect(courseForViewer(course, { staff: true, sectionIds: [] }, at("2026-01-01T00:00:00.000Z"))).toBe(course);
  });
});

describe("US-09: section restriction (FR-2.8)", () => {
  const late = at("2027-01-01T00:00:00.000Z");

  it("shows a restricted lesson only to students enrolled in that section", () => {
    expect(ids(courseForViewer(course, { staff: false, sectionIds: ["sec-a"] }, late))).toEqual(["a", "b", "c"]);
    expect(ids(courseForViewer(course, { staff: false, sectionIds: ["sec-b"] }, late))).toEqual(["a", "b", "d"]);
  });

  it("shows a student with no section in the course only unrestricted lessons", () => {
    expect(ids(courseForViewer(course, { staff: false, sectionIds: [] }, late))).toEqual(["a", "b"]);
  });

  it("applies both rules to a lesson that has both", () => {
    expect(lessonAvailability(course.modules[1].lessons[0], ["sec-b"], at("2026-09-30T00:00:00.000Z"))).toBe("scheduled");
    expect(lessonAvailability(course.modules[1].lessons[0], ["sec-b"], late)).toBe("available");
    expect(lessonAvailability(course.modules[1].lessons[0], ["sec-a"], late)).toBe("other-section");
  });

  it("drops a unit that has nothing left to show, but keeps one that still has a quiz", () => {
    const early = courseForViewer(course, { staff: false, sectionIds: ["sec-a"] }, at("2026-09-01T00:00:00.000Z"));
    expect(early.modules.map((module) => module.id)).toEqual(["u1"]);
    const emptied = { ...course, modules: [{ ...course.modules[0], lessons: [lesson("z", { sectionIds: ["sec-b"] })] }] };
    expect(courseForViewer(emptied, { staff: false, sectionIds: ["sec-a"] }, late).modules).toHaveLength(1);
  });

  it("returns the same course object when nothing is hidden", () => {
    const open = { ...course, modules: [{ id: "u", title: "U", lessons: [lesson("a")] }] };
    expect(courseForViewer(open, { staff: false, sectionIds: [] }, late)).toBe(open);
  });
});

describe("US-08: copy a course or start from a template", () => {
  let counter = 0;
  const makeId = (prefix: string) => `${prefix}-new-${(counter += 1)}`;
  const target = { title: "Algebra (Term 2)", code: "MATH-102", termId: "t2", instructor: "Dr. Park", facultyId: "f2", shiftDays: 140 };
  const copy = copyCourse({ course, sections }, target, makeId);

  it("copies the structure and content in the same order", () => {
    expect(copy.course.modules.map((module) => module.title)).toEqual(["Unit 1", "Unit 2"]);
    expect(courseLessons(copy.course).map((item) => item.title)).toEqual(["Lesson a", "Lesson b", "Lesson c", "Lesson d"]);
    expect(copy.course).toMatchObject({ title: "Algebra (Term 2)", code: "MATH-102", termId: "t2", instructor: "Dr. Park", status: "active", subject: "Maths" });
  });

  it("carries no student data: every id that progress is recorded against is new", () => {
    const originalIds = [course.id, ...course.modules.map((module) => module.id), ...ids(course), "cp-1"];
    const copiedIds = [
      copy.course.id,
      ...copy.course.modules.map((module) => module.id),
      ...ids(copy.course),
      ...courseLessons(copy.course).flatMap((item) => item.checkpoints?.map((checkpoint) => checkpoint.id) ?? []),
    ];
    expect(copiedIds).toHaveLength(originalIds.length);
    for (const id of copiedIds) expect(originalIds).not.toContain(id);
    expect(new Set(copiedIds).size).toBe(copiedIds.length);
    expect(copy.course.learners).toBe(0);
  });

  it("recreates the sections empty, taught by the new owner, with their schedules", () => {
    expect(copy.sections.map((section) => [section.name, section.code, section.termId, section.facultyIds])).toEqual([
      ["Section A", "MATH-102-A", "t2", ["f2"]],
      ["Section B", "MATH-102-B", "t2", ["f2"]],
    ]);
    expect(copy.sections[0].meetings).toEqual(sections[0].meetings);
    expect(copy.sections.every((section) => section.courseId === copy.course.id)).toBe(true);
  });

  it("points section-restricted lessons at the new sections", () => {
    const [, , third, fourth] = courseLessons(copy.course);
    expect(third.sectionIds).toEqual([copy.sections[0].id]);
    expect(fourth.sectionIds).toEqual([copy.sections[1].id]);
  });

  it("shifts every date in bulk by the same number of days", () => {
    expect(copy.course.startsOn).toBe("2027-01-11");
    expect(copy.course.endsOn).toBe("2027-05-07");
    expect(courseLessons(copy.course).map((item) => item.releaseAt)).toEqual([
      undefined,
      "2027-01-28T08:00:00.000Z",
      undefined,
      "2027-02-18T08:00:00.000Z",
    ]);
  });

  it("copies the course's quizzes with new ids, keeps them on their units and moves their due dates", () => {
    const quiz: Quiz = {
      id: "quiz-1",
      courseId: "math",
      title: "Unit 1 quiz",
      description: "",
      minutes: 10,
      passMark: 70,
      due: "2026-10-20",
      status: "published",
      questions: [{ id: "q1", kind: "boolean", prompt: "True?", points: 1, explanation: "", answer: true }],
    };
    const other: Quiz = { ...quiz, id: "quiz-9", courseId: "art" };
    const withQuizzes = copyCourse({ course, sections, quizzes: [quiz, other] }, target, makeId);
    expect(withQuizzes.quizzes).toHaveLength(1);
    const [copied] = withQuizzes.quizzes;
    expect(copied).toMatchObject({ courseId: withQuizzes.course.id, title: "Unit 1 quiz", due: "2027-03-09" });
    expect(copied.id).not.toBe("quiz-1");
    expect(copied.questions[0].id).not.toBe("q1");
    expect(withQuizzes.course.modules.map((unit) => unit.quizId)).toEqual([copied.id, undefined]);
    expect(countCourseDates(course, [quiz, other])).toBe(5);
    // Without quizzes to copy, a unit does not point at a quiz that is not there.
    expect(copy.course.modules.map((unit) => unit.quizId)).toEqual([undefined, undefined]);
    expect(copy.quizzes).toEqual([]);
  });

  it("leaves the original untouched", () => {
    expect(course.startsOn).toBe("2026-08-24");
    expect(ids(course)).toEqual(["a", "b", "c", "d"]);
  });

  it("shifts dates on an existing course, forwards or backwards", () => {
    expect(countCourseDates(course)).toBe(4);
    expect(shiftCourseDates(course, 0)).toBe(course);
    expect(shiftCourseDates(course, -7).startsOn).toBe("2026-08-17");
    expect(shiftDate("2026-12-28", 7)).toBe("2027-01-04");
    expect(shiftDateTime("2026-02-27T15:30:00.000Z", 2)).toBe("2026-03-01T15:30:00.000Z");
    expect(daysBetween("2026-08-24", "2027-01-11")).toBe(140);
    expect(daysBetween("2027-01-11", "2026-08-24")).toBe(-140);
  });
});

describe("US-07: supported formats and size limits (FR-2.3)", () => {
  const mb = (size: number) => size * 1024 * 1024;

  it("accepts documents, video, audio and presentations", () => {
    expect(materialKindOf("Week 1.PDF")).toBe("document");
    expect(materialKindOf("lecture.mp4")).toBe("video");
    expect(materialKindOf("podcast.mp3")).toBe("audio");
    expect(materialKindOf("slides.pptx")).toBe("slides");
    expect(checkUpload({ name: "notes.docx", size: mb(2) }, DEFAULT_UPLOAD_LIMITS_MB)).toEqual({ ok: true, kind: "document" });
  });

  it("rejects an unsupported format and says which", () => {
    expect(checkUpload({ name: "setup.exe", size: 10 }, DEFAULT_UPLOAD_LIMITS_MB)).toEqual({
      ok: false,
      reason: "setup.exe: .exe files are not supported.",
    });
    expect(checkUpload({ name: "README", size: 10 }, DEFAULT_UPLOAD_LIMITS_MB).ok).toBe(false);
  });

  it("accepts a file at the limit and rejects one over it, naming the limit", () => {
    expect(checkUpload({ name: "a.pdf", size: mb(50) }, DEFAULT_UPLOAD_LIMITS_MB).ok).toBe(true);
    expect(checkUpload({ name: "a.pdf", size: mb(50) + 1 }, DEFAULT_UPLOAD_LIMITS_MB)).toEqual({
      ok: false,
      reason: "a.pdf is 51 MB. The limit for documents is 50 MB.",
    });
  });

  it("uses the limit the school has configured for each kind", () => {
    const limits = { ...DEFAULT_UPLOAD_LIMITS_MB, video: 10 };
    expect(checkUpload({ name: "clip.mp4", size: mb(11) }, limits).ok).toBe(false);
    expect(checkUpload({ name: "clip.mp4", size: mb(11) }, DEFAULT_UPLOAD_LIMITS_MB).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(checkUpload({ name: "a.pdf", size: 0 }, DEFAULT_UPLOAD_LIMITS_MB).ok).toBe(false);
  });
});

describe("FR-2.4: external links and embedded media", () => {
  it("accepts only http and https links", () => {
    expect(isWebUrl("https://example.com/page")).toBe(true);
    expect(isWebUrl("http://example.com")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("example.com")).toBe(false);
    expect(isWebUrl("")).toBe(false);
  });

  it("embeds known video players and opens everything else in a new tab", () => {
    expect(embedUrlFor("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(embedUrlFor("https://youtu.be/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(embedUrlFor("https://vimeo.com/987654")).toBe("https://player.vimeo.com/video/987654");
    expect(embedUrlFor("https://en.wikipedia.org/wiki/Algebra")).toBeUndefined();
    expect(embedUrlFor("not a link")).toBeUndefined();
  });
});

describe("US-06, FR-2.1: a course needs a name, code, term, sections and a valid schedule", () => {
  const terms: Term[] = [
    { id: "t1", name: "Term 1", startsOn: "2026-08-24", endsOn: "2026-12-18", status: "active" },
    { id: "t0", name: "Last year", startsOn: "2025-08-24", endsOn: "2025-12-18", status: "archived" },
  ];
  const context: CourseRulesContext = {
    terms,
    otherCourseCodes: ["ART-200"],
    enrolledBySection: { "sec-a": 12, "sec-b": 0 },
    currentSectionIds: ["sec-a", "sec-b"],
    materialIds: ["mat-1"],
  };

  it("accepts a complete course", () => {
    expect(courseProblems(course, sections, context)).toEqual([]);
  });

  it("requires a name, a code that no other course uses, and a term that is not archived", () => {
    expect(courseProblems({ ...course, title: " ", code: "art-200", termId: "t0" }, sections, context)).toEqual([
      "Give the course a name.",
      "Another course already uses the code art-200.",
      "Last year is archived. Choose a current or upcoming term.",
    ]);
  });

  it("requires at least one section, with distinct names", () => {
    expect(courseProblems({ ...course, modules: [] }, [], { ...context, currentSectionIds: [] })).toEqual(["Add at least one section."]);
    const twins = [sections[0], { ...sections[1], name: "section a" }];
    expect(courseProblems({ ...course, modules: [] }, twins, context)).toEqual(['Two sections are called "section a".']);
  });

  it("rejects a meeting that ends before it starts", () => {
    const bad = [{ ...sections[0], meetings: [{ day: 2, start: "11:00", end: "10:00" }] }, sections[1]];
    expect(courseProblems(course, bad, context)).toEqual(["Section A has a Tuesday meeting that ends before it starts."]);
  });

  it("will not remove a section that has students, but will remove an empty one", () => {
    const noDependents = { ...course, modules: [] };
    expect(courseProblems(noDependents, [sections[1]], context)).toEqual(["A section with 12 enrolled students cannot be removed."]);
    expect(courseProblems(noDependents, [sections[0]], context)).toEqual([]);
  });

  it("checks each lesson: title, length, link, file and section", () => {
    const broken: Course = {
      ...course,
      startsOn: "2026-12-19",
      modules: [
        {
          id: "u1",
          title: "",
          lessons: [
            lesson("a", { title: "" }),
            lesson("b", { title: "Reading list", type: "link", url: "ftp://files" }),
            lesson("c", { title: "Worksheet", type: "document" }),
            lesson("d", { title: "Deck", type: "slides", materialId: "gone", minutes: 0, sectionIds: ["sec-x"] }),
          ],
        },
      ],
    };
    expect(courseProblems(broken, sections, context)).toEqual([
      "The course ends before it starts.",
      "Unit 1 needs a title.",
      "Lesson 1 in Unit 1 needs a title.",
      '"Reading list" needs a link that starts with http:// or https://.',
      '"Worksheet" needs a file from the content library.',
      '"Deck" needs a length of at least 1 minute.',
      '"Deck" uses a content library item that no longer exists.',
      '"Deck" is restricted to a section that no longer exists.',
    ]);
  });
});
