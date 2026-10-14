import { describe, expect, it } from "vitest";
import { forStudent } from "@/lib/domain/assignments";
import {
  DEFAULT_CATEGORY_IDS,
  attemptsForLearner,
  averageOf,
  categoryIdFor,
  courseGrade,
  courseTotal,
  defaultSetup,
  formatPercent,
  gradeItems,
  isPastDue,
  scoreItems,
  setupProblems,
  termSummary,
  weightTotal,
} from "@/lib/domain/gradebook";
import { DEFAULT_SETTINGS, settingsProblems } from "@/lib/domain/settings";
import {
  applySisRejections,
  planSisExport,
  sisFailureRows,
  sisGradeRows,
  type SisGradeCandidate,
} from "@/lib/domain/sis-export";
import {
  DEFAULT_GRADING_SCALES,
  bandFor,
  findScale,
  gradeBeside,
  gradeOnScale,
  gradePoints,
  scaleProblems,
  tidyScale,
} from "@/lib/grading";
import { pendingReason, weightedAverage, weightedGrade } from "@/lib/progress";
import type { Assignment, GradebookSetup, GradingScale, Quiz, QuizAttempt, Submission } from "@/lib/types";

const NOW = "2026-10-14T09:00:00.000Z";
const [percentage, letter, gpa] = DEFAULT_GRADING_SCALES;

function quiz(id: string, points: number, due: string, extra: Partial<Quiz> = {}): Quiz {
  return {
    id,
    courseId: "math",
    title: id,
    description: "",
    minutes: 10,
    passMark: 70,
    due,
    status: "published",
    questions: [{ id: `${id}-q`, kind: "boolean", prompt: "True?", points, explanation: "", answer: true }],
    ...extra,
  };
}

function assignment(id: string, points: number, dueAt: string, extra: Partial<Assignment> = {}): Assignment {
  return {
    id,
    courseId: "math",
    title: id,
    instructions: "",
    points,
    dueAt,
    sectionIds: ["sec-a"],
    attachments: [],
    accepts: ["text"],
    late: { rule: "flag", penaltyPercent: 0, penaltyPer: "submission", maxPenaltyPercent: 0 },
    allowResubmission: true,
    status: "published",
    createdById: "f1",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  };
}

function attempt(quizId: string, percent: number, extra: Partial<QuizAttempt> = {}): QuizAttempt {
  return { id: `${quizId}-${percent}`, quizId, earned: percent, possible: 100, percent, submittedAt: "2026-10-01T10:00:00.000Z", ...extra };
}

function handIn(assignmentId: string, studentId: string, points: number | null, extra: Partial<Submission> = {}): Submission {
  return {
    id: `${assignmentId}-${studentId}-${extra.attempt ?? 1}`,
    assignmentId,
    courseId: "math",
    studentId,
    attempt: 1,
    submittedAt: "2026-10-05T10:00:00.000Z",
    receipt: "R-0000-000",
    files: [],
    comments: [],
    grade:
      points === null
        ? undefined
        : { rawPoints: points, points, feedback: "Good.", gradedById: "f1", gradedAt: "2026-10-06T10:00:00.000Z", releasedAt: "2026-10-07T10:00:00.000Z" },
    ...extra,
  };
}

/** Quizzes 40%, assignments 60%. */
const setup: GradebookSetup = {
  courseId: "math",
  categories: [
    { id: "cat-quizzes", name: "Quizzes", weight: 40 },
    { id: "cat-assignments", name: "Assignments", weight: 60 },
  ],
  scaleId: letter.id,
  missingAsZero: false,
  heldQuizIds: [],
};

const quizzes = [quiz("q1", 10, "2026-10-01"), quiz("q2", 20, "2026-10-10")];
const assignments = [assignment("a1", 50, "2026-10-05T16:00:00.000Z")];

function grade(attempts: QuizAttempt[], submissions: Submission[], change: Partial<GradebookSetup> = {}) {
  return courseGrade({
    courseId: "math",
    quizzes,
    assignments,
    setup: { ...setup, ...change },
    studentId: "s1",
    sectionIds: ["sec-a"],
    attempts,
    submissions,
    now: NOW,
  });
}

describe("gradebook setup (US-16, FR-4.1)", () => {
  it("accepts category weights that total exactly 100%", () => {
    expect(setupProblems(setup, [letter.id])).toEqual([]);
    const thirds = [33.3, 33.3, 33.4].map((weight, index) => ({ id: `c${index}`, name: `Part ${index + 1}`, weight }));
    expect(weightTotal(thirds)).toBe(100);
    expect(setupProblems({ categories: thirds, scaleId: letter.id }, [letter.id])).toEqual([]);
  });

  it("refuses to save until the weights total 100%, and says what they total", () => {
    const short = { ...setup, categories: [{ ...setup.categories[0], weight: 30 }, setup.categories[1]] };
    expect(setupProblems(short, [letter.id])).toEqual([
      "The category weights total 90%. They must total 100% before the gradebook can be saved.",
    ]);
    const over = { ...setup, categories: [{ ...setup.categories[0], weight: 45.5 }, setup.categories[1]] };
    expect(setupProblems(over, [letter.id])).toEqual([
      "The category weights total 105.5%. They must total 100% before the gradebook can be saved.",
    ]);
  });

  it("needs a category, a name for each, weights above zero and a scale the school has", () => {
    expect(setupProblems({ categories: [], scaleId: letter.id }, [letter.id])).toEqual(["Add at least one category."]);
    const broken = {
      scaleId: "scale-gone",
      categories: [
        { id: "a", name: "Tests", weight: 100 },
        { id: "b", name: " tests ", weight: 0 },
        { id: "c", name: "", weight: Number.NaN },
      ],
    };
    expect(setupProblems(broken, [letter.id])).toEqual([
      "Give every category a name.",
      'Two categories are called "tests". Give each its own name.',
      "Every category needs a weight above 0%, and no more than 100%.",
      "Choose a grading scale.",
    ]);
  });

  it("starts a course with assignments and quizzes at 50% each", () => {
    const starting = defaultSetup("math", letter.id);
    expect(setupProblems(starting, [letter.id])).toEqual([]);
    expect(starting.categories.map((category) => [category.id, category.weight])).toEqual([
      [DEFAULT_CATEGORY_IDS.assignment, 50],
      [DEFAULT_CATEGORY_IDS.quiz, 50],
    ]);
    expect(starting.missingAsZero).toBe(false);
  });

  it("puts an item in its own category, else the usual one for its kind, else the first", () => {
    const categories = setup.categories;
    expect(categoryIdFor("quiz", "cat-assignments", categories)).toBe("cat-assignments");
    expect(categoryIdFor("quiz", undefined, categories)).toBe("cat-quizzes");
    expect(categoryIdFor("assignment", "cat-removed", categories)).toBe("cat-assignments");
    expect(categoryIdFor("quiz", undefined, [{ id: "exams" }, { id: "labs" }])).toBe("exams");
  });

  it("lists published quizzes and assignments as grade items, soonest due first", () => {
    const items = gradeItems(
      "math",
      [...quizzes, quiz("draft", 5, "2026-09-01", { status: "draft" }), quiz("other", 5, "2026-09-01", { courseId: "art" })],
      [...assignments, assignment("a-draft", 10, "2026-09-01T00:00:00.000Z", { status: "draft" })],
      setup.categories,
    );
    expect(items.map((item) => [item.id, item.kind, item.points, item.categoryId])).toEqual([
      ["q1", "quiz", 10, "cat-quizzes"],
      ["a1", "assignment", 50, "cat-assignments"],
      ["q2", "quiz", 20, "cat-quizzes"],
    ]);
  });
});

describe("course total (US-16, FR-4.2)", () => {
  it("weights items by points inside a category and categories by their weights", () => {
    // Quizzes: (10 x 80 + 20 x 50) / 30 = 60. Assignments: 45 / 50 = 90. Total: 0.4 x 60 + 0.6 x 90 = 78.
    const result = grade([attempt("q1", 80), attempt("q2", 50)], [handIn("a1", "s1", 45)]);
    expect(result.total.categories.map((entry) => [entry.category.name, entry.percent])).toEqual([
      ["Quizzes", 60],
      ["Assignments", 90],
    ]);
    expect(result.total.percent).toBe(78);
  });

  it("recalculates when any score changes", () => {
    const before = grade([attempt("q1", 80), attempt("q2", 50)], [handIn("a1", "s1", 45)]);
    // A better second quiz: quizzes become 80, so the total becomes 0.4 x 80 + 0.6 x 90 = 86.
    const retaken = grade([attempt("q1", 80), attempt("q2", 50), attempt("q2", 80)], [handIn("a1", "s1", 45)]);
    expect([before.total.percent, retaken.total.percent]).toEqual([78, 86]);
    // A re-marked assignment: 30 / 50 = 60, so the total becomes 0.4 x 60 + 0.6 x 60 = 60.
    const remarked = grade([attempt("q1", 80), attempt("q2", 50)], [handIn("a1", "s1", 30)]);
    expect(remarked.total.percent).toBe(60);
  });

  it("recalculates when the weights change", () => {
    const flipped = grade([attempt("q1", 80), attempt("q2", 50)], [handIn("a1", "s1", 45)], {
      categories: [
        { id: "cat-quizzes", name: "Quizzes", weight: 60 },
        { id: "cat-assignments", name: "Assignments", weight: 40 },
      ],
    });
    expect(flipped.total.percent).toBe(72);
  });

  it("is a running total: a category with nothing graded yet drops out", () => {
    const result = grade([], [handIn("a1", "s1", 45)]);
    expect(result.total.categories[0].percent).toBeNull();
    expect(result.total.percent).toBe(90);
    expect(grade([], []).total.percent).toBeNull();
  });

  it("counts the best quiz attempt and the latest hand-in", () => {
    const result = grade(
      [attempt("q1", 60), attempt("q1", 90), attempt("q1", 70)],
      [handIn("a1", "s1", 50), handIn("a1", "s1", 25, { attempt: 2 })],
    );
    const byId = Object.fromEntries(result.scores.map((score) => [score.item.id, score]));
    expect(byId.q1.percent).toBe(90);
    expect(byId.q1.earned).toBe(9);
    expect(byId.a1.percent).toBe(50);
    expect(byId.a1.earned).toBe(25);
  });

  it("leaves missing work out of the total unless the course counts it as zero", () => {
    // q2 was due on 10 October and was not taken.
    const attempts = [attempt("q1", 80)];
    const submissions = [handIn("a1", "s1", 45)];
    const ignored = grade(attempts, submissions);
    expect(ignored.scores.find((score) => score.item.id === "q2")?.state).toBe("missing");
    expect(ignored.total.percent).toBe(86);
    // As zero: quizzes are (10 x 80 + 20 x 0) / 30 = 26.7, so the total is 0.4 x 26.7 + 0.6 x 90 = 64.7.
    const zero = grade(attempts, submissions, { missingAsZero: true });
    expect(zero.total.categories[0].percent).toBe(27);
    expect(zero.total.percent).toBe(65);
    expect(zero.total.counts.missing).toBe(1);
  });

  it("does not count work that is not due yet, even as zero", () => {
    const later = courseGrade({
      courseId: "math",
      quizzes: [quiz("q1", 10, "2026-10-01"), quiz("q9", 20, "2026-10-14")],
      assignments: [],
      setup: { ...setup, missingAsZero: true },
      studentId: "s1",
      sectionIds: ["sec-a"],
      attempts: [attempt("q1", 80)],
      submissions: [],
      now: NOW,
    });
    expect(later.scores.map((score) => score.state)).toEqual(["graded", "upcoming"]);
    expect(later.total.percent).toBe(80);
  });

  it("treats a date with no time as due at the end of that day", () => {
    expect(isPastDue("2026-10-14", "2026-10-14T23:59:00.000Z")).toBe(false);
    expect(isPastDue("2026-10-14", "2026-10-15T00:00:00.000Z")).toBe(true);
    expect(isPastDue("2026-10-14T09:00:00.000Z", "2026-10-14T09:00:01.000Z")).toBe(true);
    expect(isPastDue("2026-10-14T09:00:00.000Z", "2026-10-14T09:00:00.000Z")).toBe(false);
  });

  it("exempts a student from an assignment that is not set for their section", () => {
    const items = gradeItems("math", [], [assignment("a2", 50, "2026-10-01T00:00:00.000Z", { sectionIds: ["sec-b"] })], setup.categories);
    const scores = scoreItems({ items, studentId: "s1", sectionIds: ["sec-a"], attempts: [], submissions: [], heldQuizIds: [], now: NOW });
    expect(scores[0].state).toBe("exempt");
    const total = courseTotal({ ...setup, missingAsZero: true }, scores);
    expect(total.percent).toBeNull();
    expect(total.counts.missing).toBe(0);
  });

  it("does not count a quiz that is waiting for a teacher's marks", () => {
    const waiting = grade([attempt("q1", 40, { status: "awaiting-marking" })], []);
    expect(waiting.scores[0].state).toBe("to-mark");
    expect(waiting.total.percent).toBeNull();
    expect(waiting.total.counts.toMark).toBe(1);
  });

  it("uses one weighted average for both steps", () => {
    expect(weightedAverage([{ weight: 1, percent: 50 }, { weight: 3, percent: 100 }])).toBe(87.5);
    expect(weightedGrade([{ weight: 1, percent: 50 }, { weight: 3, percent: 100 }])).toBe(88);
    expect(weightedGrade([{ weight: 40, percent: null }, { weight: 60, percent: 70 }])).toBe(70);
    expect(weightedGrade([{ weight: 0, percent: 90 }])).toBeNull();
    expect(weightedGrade([])).toBeNull();
  });
});

describe("grading scales (US-16, FR-4.2)", () => {
  it("reports the same percentage on whichever scale is selected", () => {
    expect(gradeOnScale(87, percentage)).toBe("87%");
    expect(gradeOnScale(87, letter)).toBe("B+");
    expect(gradeOnScale(87, gpa)).toBe("3.3");
    expect(gradePoints(87, gpa)).toBe(3.3);
    expect(gradePoints(87, letter)).toBeNull();
  });

  it("puts a percentage in the band it reaches", () => {
    expect([93, 92.9, 90, 60, 59, 0].map((percent) => gradeOnScale(percent, letter))).toEqual(["A", "A−", "A−", "D", "F", "F"]);
    expect([100, 70, 69, 0].map((percent) => gradeOnScale(percent, gpa))).toEqual(["4.0", "1.7", "1.0", "0.0"]);
    expect(bandFor(85, letter)?.label).toBe("B");
  });

  it("shows a grade beside the percentage only when it adds something", () => {
    expect(gradeBeside(87, percentage)).toBeNull();
    expect(gradeBeside(87, letter)).toBe("Grade B+");
    expect(gradeBeside(87, gpa)).toBe("GPA 3.3");
  });

  it("falls back to the school's default scale when a course's scale is gone", () => {
    expect(findScale(DEFAULT_SETTINGS, gpa.id)).toBe(gpa);
    expect(findScale(DEFAULT_SETTINGS, "scale-removed").id).toBe(DEFAULT_SETTINGS.defaultScaleId);
    expect(findScale(DEFAULT_SETTINGS).id).toBe(DEFAULT_SETTINGS.defaultScaleId);
  });

  it("accepts the default scales", () => {
    for (const scale of DEFAULT_GRADING_SCALES) expect(scaleProblems(scale)).toEqual([]);
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
  });

  it("needs every score to have a grade", () => {
    const noFloor: GradingScale = { ...letter, bands: [{ min: 50, label: "Pass" }, { min: 20, label: "Fail" }] };
    expect(scaleProblems(noFloor)).toEqual([
      "The lowest grade in Letter grades must start at 0%, so every score has a grade.",
    ]);
    expect(settingsProblems({ ...DEFAULT_SETTINGS, gradingScales: [percentage, noFloor, gpa] })).toHaveLength(1);
  });

  it("checks names, percentages and grade points", () => {
    const messy: GradingScale = {
      ...letter,
      bands: [
        { min: 50, label: "Pass" },
        { min: 50, label: "pass" },
        { min: 0, label: " " },
      ],
    };
    expect(scaleProblems(messy)).toEqual([
      "Give every grade in Letter grades a name.",
      "Two grades in Letter grades have the same name.",
      "Two grades in Letter grades start at the same percentage.",
    ]);
    expect(scaleProblems({ ...letter, bands: [{ min: 0, label: "Only" }] })).toEqual(["Letter grades needs at least two grades."]);
    expect(scaleProblems({ ...letter, bands: [{ min: 120, label: "A" }, { min: 0, label: "F" }] })).toEqual([
      "Every grade in Letter grades must start at a percentage from 0 to 100.",
    ]);
    expect(scaleProblems({ ...gpa, bands: [{ min: 50, label: "Pass" }, { min: 0, label: "Fail", points: 0 }] })).toEqual([
      "Every grade in GPA (4.0) needs grade points from 0 to 10.",
    ]);
    expect(scaleProblems({ ...gpa, bands: [{ min: 50, label: "Pass", points: 1 }, { min: 0, label: "Fail", points: 2 }] })).toEqual([
      "In GPA (4.0) a higher percentage cannot earn fewer grade points than a lower one.",
    ]);
  });

  it("stores bands from the highest down, and grade points only on a GPA scale", () => {
    const tidy = tidyScale({ ...letter, name: " Letters ", bands: [{ min: 0, label: " F ", points: 0 }, { min: 50, label: "P", points: 2 }] });
    expect(tidy).toEqual({ ...letter, name: "Letters", bands: [{ min: 50, label: "P" }, { min: 0, label: "F" }] });
    expect(tidyScale({ ...gpa, bands: [{ min: 0, label: "F", points: 0 }, { min: 50, label: "P", points: 2 }] }).bands).toEqual([
      { min: 50, label: "P", points: 2 },
      { min: 0, label: "F", points: 0 },
    ]);
  });
});

describe("what a student sees (US-17, FR-4.3)", () => {
  const visible = { similarityVisible: false };

  it("shows only released grades, and the running total counts only those", () => {
    const marked = handIn("a1", "s1", 45, {
      grade: { rawPoints: 45, points: 45, feedback: "Good.", gradedById: "f1", gradedAt: "2026-10-06T10:00:00.000Z" },
    });
    // Staff see the mark and that it is not released; it counts in their total.
    const staff = grade([attempt("q1", 80)], [marked]);
    expect(staff.scores.find((score) => score.item.id === "a1")).toMatchObject({ state: "graded", percent: 90, unreleased: true });
    expect(staff.total.percent).toBe(86);
    expect(staff.total.counts.unreleased).toBe(1);

    // The student is sent the hand-in without its grade, so it does not count and no mark can be shown.
    const student = grade([attempt("q1", 80)], [forStudent(marked, visible)]);
    expect(student.scores.find((score) => score.item.id === "a1")).toMatchObject({ state: "to-mark", percent: null, earned: null });
    expect(student.total.percent).toBe(80);

    // Once released it is visible and the total moves at once.
    const released = { ...marked, grade: { ...marked.grade!, releasedAt: "2026-10-07T10:00:00.000Z" } };
    const after = grade([attempt("q1", 80)], [forStudent(released, visible)]);
    expect(after.scores.find((score) => score.item.id === "a1")).toMatchObject({ state: "graded", percent: 90, unreleased: false });
    expect(after.total.percent).toBe(86);
  });

  it("gives the student nothing but the hand-in time for a quiz whose scores are held", () => {
    const attempts = [
      attempt("q1", 80, { answers: { "q1-q": true }, manual: {} }),
      attempt("q2", 50, { answers: { "q2-q": false } }),
    ];
    const seen = attemptsForLearner(attempts, ["q1"]);
    expect(seen[0]).toEqual({
      id: "q1-80",
      quizId: "q1",
      earned: 0,
      possible: 100,
      percent: 0,
      submittedAt: "2026-10-01T10:00:00.000Z",
      startedAt: undefined,
      autoSubmitted: undefined,
      status: "held",
    });
    expect(seen[1]).toBe(attempts[1]);
    // Nothing held: the same list comes back.
    expect(attemptsForLearner(attempts, [])).toBe(attempts);
    expect(attemptsForLearner(attempts, ["q9"])).toBe(attempts);
  });

  it("keeps a held quiz out of the student's total and in the teacher's", () => {
    const attempts = [attempt("q1", 80), attempt("q2", 50)];
    const held = { heldQuizIds: ["q2"] };
    const student = grade(attemptsForLearner(attempts, held.heldQuizIds), [], held);
    // In due order: the first quiz, the assignment nobody handed in, and the held quiz.
    expect(student.scores.map((score) => score.state)).toEqual(["graded", "missing", "held"]);
    expect(student.total.percent).toBe(80);
    expect(student.total.counts.held).toBe(1);
    expect(pendingReason("q2", attemptsForLearner(attempts, held.heldQuizIds))).toBe("release");

    const staff = grade(attempts, [], held);
    expect(staff.scores.find((score) => score.item.id === "q2")).toMatchObject({ state: "graded", percent: 50, unreleased: true });
    expect(staff.total.percent).toBe(60);
  });

  it("tells the student whether a quiz waits for marking or for release", () => {
    expect(pendingReason("q1", [attempt("q1", 40, { status: "awaiting-marking" })])).toBe("marking");
    expect(pendingReason("q1", [attempt("q1", 80)])).toBeNull();
    expect(pendingReason("q1", [])).toBeNull();
  });
});

describe("progress report figures (US-18, FR-4.4)", () => {
  it("averages the courses that have a grade and works out the GPA from them", () => {
    // 90 is an A− (3.7) and 80 a B− (2.7).
    expect(termSummary([90, 80, null], gpa)).toEqual({ graded: 2, courses: 3, average: 85, gpa: 3.2 });
    expect(termSummary([90, 80, null], undefined).gpa).toBeNull();
    expect(termSummary([null], gpa)).toEqual({ graded: 0, courses: 1, average: null, gpa: null });
    expect(averageOf([79, 80])).toBe(80);
    expect(averageOf([])).toBeNull();
  });

  it("shows a percent with at most one decimal place", () => {
    expect([90, 33.3333, 66.66, 85.04].map(formatPercent)).toEqual(["90%", "33.3%", "66.7%", "85%"]);
  });
});

describe("SIS export (US-18, FR-4.5)", () => {
  const complete = grade([attempt("q1", 80), attempt("q2", 80)], [handIn("a1", "s1", 45)]).total;

  function candidate(change: Partial<SisGradeCandidate> = {}): SisGradeCandidate {
    return {
      student: { id: "s1", name: "Aiko Tanaka", sisId: "S-1001" },
      term: { id: "t1", name: "2026–27 Term 1" },
      course: { id: "math", code: "MATH-101", title: "Algebra" },
      section: { code: "MATH-101-A" },
      total: complete,
      scale: letter,
      ...change,
    };
  }

  it("writes each final grade in the SIS format", () => {
    const plan = planSisExport([candidate(), candidate({ student: { id: "s2", name: 'Ben "BJ" Okonkwo', sisId: " S-1002 " }, scale: gpa })]);
    expect(plan.failed).toEqual([]);
    expect(sisGradeRows(plan.ready)).toEqual([
      ["term", "course_code", "section_code", "student_id", "student_name", "final_percent", "final_grade", "grade_points"],
      ["2026–27 Term 1", "MATH-101", "MATH-101-A", "S-1001", "Aiko Tanaka", "86", "B", ""],
      ["2026–27 Term 1", "MATH-101", "MATH-101-A", "S-1002", 'Ben "BJ" Okonkwo', "86", "3.0", "3.0"],
    ]);
  });

  it("lists each record that cannot go, with the reason", () => {
    const nothing = grade([], []).total;
    const toMark = grade([attempt("q1", 80)], [handIn("a1", "s1", null)]).total;
    const unreleased = grade(
      [attempt("q1", 80)],
      [handIn("a1", "s1", 45, { grade: { rawPoints: 45, points: 45, feedback: "", gradedById: "f1", gradedAt: NOW } })],
    ).total;
    const plan = planSisExport([
      candidate(),
      candidate({ student: { id: "s2", name: "No Id" } }),
      candidate({ student: { id: "s3", name: "New Student", sisId: "S-3" }, total: nothing }),
      candidate({ student: { id: "s4", name: "Waiting", sisId: "S-4" }, total: toMark }),
      candidate({ student: { id: "s5", name: "Unreleased", sisId: "S-5" }, total: unreleased }),
      candidate({ student: { id: "s6", name: "No Section", sisId: "S-6" }, section: undefined }),
    ]);
    expect(plan.ready.map((record) => record.studentSisId)).toEqual(["S-1001"]);
    expect(plan.failed.map((failure) => [failure.studentName, failure.reason])).toEqual([
      ["No Id", "The account has no SIS ID."],
      ["New Student", "Nothing is graded yet, so there is no final grade."],
      ["Waiting", "1 item is handed in and not marked yet."],
      ["Unreleased", "1 mark has not been released to the student."],
      ["No Section", "The student is not in a section of this course."],
    ]);
    expect(sisFailureRows(plan.failed)[1]).toEqual(["MATH-101", "MATH-101-A", "", "No Id", "The account has no SIS ID."]);
  });

  it("gives every reason when a record has more than one problem", () => {
    const toMark = grade([], [handIn("a1", "s1", null)]).total;
    const [failure] = planSisExport([candidate({ student: { id: "s2", name: "No Id" }, total: toMark })]).failed;
    expect(failure.reason).toBe(
      "The account has no SIS ID. Nothing is graded yet, so there is no final grade. 1 item is handed in and not marked yet.",
    );
  });

  it("moves a record the SIS turns down to the failed list with the SIS's reason", () => {
    const plan = planSisExport([candidate(), candidate({ student: { id: "s2", name: "Ben Okonkwo", sisId: "X-9" } })]);
    const after = applySisRejections(plan, [{ key: "s2:math", reason: "Student ID not found in the SIS." }]);
    expect(after.ready.map((record) => record.key)).toEqual(["s1:math"]);
    expect(after.failed).toEqual([
      { key: "s2:math", studentName: "Ben Okonkwo", studentSisId: "X-9", courseCode: "MATH-101", sectionCode: "MATH-101-A", reason: "Student ID not found in the SIS." },
    ]);
  });
});
