import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATE_POLICY,
  applyPenalty,
  assignmentProblems,
  daysLate,
  describeLatePolicy,
  forStudent,
  gradeFor,
  isSetFor,
  lateOutcome,
  latePolicyProblems,
  latestByStudent,
  receiptCode,
  rubricProblems,
  rubricScore,
  rubricTotal,
  segmentText,
  submissionFileProblem,
  submissionProblems,
  submissionState,
  submitDecision,
} from "@/lib/domain/assignments";
import type { Assignment, LatePolicy, Rubric, Submission } from "@/lib/types";

const DUE = "2026-10-20T16:00:00.000Z";

const rubric: Rubric = {
  criteria: [
    {
      id: "c1",
      title: "Understanding",
      description: "",
      points: 12,
      levels: [
        { id: "c1-4", label: "Excellent", points: 12 },
        { id: "c1-3", label: "Good", points: 9 },
        { id: "c1-2", label: "Developing", points: 6 },
        { id: "c1-1", label: "Beginning", points: 3 },
      ],
    },
    {
      id: "c2",
      title: "Clarity",
      description: "",
      points: 8,
      levels: [
        { id: "c2-2", label: "Clear", points: 8 },
        { id: "c2-1", label: "Unclear", points: 4 },
      ],
    },
  ],
};

const flag: LatePolicy = { rule: "flag", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 };
const block: LatePolicy = { ...flag, rule: "block" };
const perDay: LatePolicy = { ...flag, rule: "penalty" };
const once: LatePolicy = { ...flag, rule: "penalty", penaltyPercent: 15, penaltyPer: "submission" };

const assignment: Assignment = {
  id: "a1",
  courseId: "math",
  title: "Essay",
  instructions: "Write 300 words.",
  points: 20,
  dueAt: DUE,
  sectionIds: ["sec-a"],
  attachments: [],
  accepts: ["text", "file"],
  rubric,
  late: flag,
  allowResubmission: false,
  status: "published",
  createdById: "f1",
  createdAt: "2026-10-01T08:00:00.000Z",
  publishedAt: "2026-10-01T09:00:00.000Z",
};

const submission: Submission = {
  id: "s1",
  assignmentId: "a1",
  courseId: "math",
  studentId: "u1",
  attempt: 1,
  submittedAt: "2026-10-19T10:00:00.000Z",
  receipt: "R-0000-000",
  text: "My essay.",
  files: [],
  comments: [],
};

const by = { gradedById: "f1", gradedAt: "2026-10-21T09:00:00.000Z" };

describe("US-11, FR-3.4: the configured late rule is applied", () => {
  it("treats work handed in at or before the due time as on time", () => {
    expect(daysLate(DUE, DUE)).toBe(0);
    expect(daysLate(DUE, "2026-10-20T15:59:59.000Z")).toBe(0);
    expect(lateOutcome(block, DUE, DUE)).toEqual({ accepted: true, daysLate: 0, penaltyPercent: 0 });
  });

  it("counts any part of a day late as a whole day", () => {
    expect(daysLate(DUE, "2026-10-20T16:00:01.000Z")).toBe(1);
    expect(daysLate(DUE, "2026-10-21T16:00:00.000Z")).toBe(1);
    expect(daysLate(DUE, "2026-10-21T16:00:01.000Z")).toBe(2);
  });

  it("block: refuses late work", () => {
    expect(lateOutcome(block, DUE, "2026-10-20T16:05:00.000Z")).toEqual({ accepted: false, daysLate: 1, penaltyPercent: 0 });
  });

  it("flag: accepts late work, marks it late and deducts nothing", () => {
    expect(lateOutcome(flag, DUE, "2026-10-22T09:00:00.000Z")).toEqual({ accepted: true, daysLate: 2, penaltyPercent: 0 });
  });

  it("penalty per day: deducts for each day late, up to the cap", () => {
    expect(lateOutcome(perDay, DUE, "2026-10-20T18:00:00.000Z").penaltyPercent).toBe(10);
    expect(lateOutcome(perDay, DUE, "2026-10-23T09:00:00.000Z").penaltyPercent).toBe(30);
    expect(lateOutcome(perDay, DUE, "2026-11-20T09:00:00.000Z").penaltyPercent).toBe(50);
  });

  it("penalty per submission: deducts once however late the work is", () => {
    expect(lateOutcome(once, DUE, "2026-10-20T18:00:00.000Z").penaltyPercent).toBe(15);
    expect(lateOutcome(once, DUE, "2026-11-20T09:00:00.000Z").penaltyPercent).toBe(15);
  });

  it("takes the penalty off the mark", () => {
    expect(applyPenalty(18, 0)).toBe(18);
    expect(applyPenalty(18, 10)).toBe(16.2);
    expect(applyPenalty(17, 15)).toBe(14.45);
    expect(applyPenalty(18, 100)).toBe(0);
  });

  it("says in words what the rule does, so it can be shown to the student", () => {
    expect(describeLatePolicy(block)).toContain("not accepted");
    expect(describeLatePolicy(flag)).toContain("marked as late");
    expect(describeLatePolicy(perDay)).toBe("Late work is accepted and loses 10% of its mark for each day late, up to 50%.");
    expect(describeLatePolicy(once)).toBe("Late work is accepted and loses 15% of its mark.");
  });

  it("rejects a penalty that makes no sense", () => {
    expect(latePolicyProblems(DEFAULT_LATE_POLICY)).toEqual([]);
    expect(latePolicyProblems({ ...perDay, penaltyPercent: 0 })).toHaveLength(1);
    expect(latePolicyProblems({ ...perDay, penaltyPercent: 120 })).toHaveLength(1);
    expect(latePolicyProblems({ ...perDay, penaltyPercent: 20, maxPenaltyPercent: 10 })).toEqual([
      "The most that can be deducted for late work cannot be less than the penalty for one day.",
    ]);
    // The numbers are ignored when the rule does not use them.
    expect(latePolicyProblems({ ...block, penaltyPercent: 0 })).toEqual([]);
  });
});

describe("US-11: handing in", () => {
  it("lets a student hand in an open assignment before the due time", () => {
    expect(submitDecision(assignment, 0, "2026-10-19T10:00:00.000Z")).toEqual({
      allowed: true,
      outcome: { accepted: true, daysLate: 0, penaltyPercent: 0 },
    });
  });

  it("applies the late rule when the work is late", () => {
    const late = "2026-10-21T10:00:00.000Z";
    expect(submitDecision({ ...assignment, late: block }, 0, late)).toMatchObject({ allowed: false });
    expect(submitDecision({ ...assignment, late: perDay }, 0, late)).toEqual({
      allowed: true,
      outcome: { accepted: true, daysLate: 1, penaltyPercent: 10 },
    });
  });

  it("allows resubmission only if the teacher enabled it", () => {
    const at = "2026-10-19T12:00:00.000Z";
    expect(submitDecision(assignment, 1, at)).toMatchObject({ allowed: false });
    expect(submitDecision({ ...assignment, allowResubmission: true }, 1, at)).toMatchObject({ allowed: true });
    expect(submitDecision({ ...assignment, allowResubmission: true }, 3, at)).toMatchObject({ allowed: true });
  });

  it("still applies the late rule to a resubmission", () => {
    expect(submitDecision({ ...assignment, allowResubmission: true, late: block }, 1, "2026-10-21T10:00:00.000Z")).toMatchObject({
      allowed: false,
    });
  });

  it("takes nothing for a draft assignment", () => {
    expect(submitDecision({ ...assignment, status: "draft" }, 0, "2026-10-19T10:00:00.000Z")).toMatchObject({ allowed: false });
  });

  it("needs text or a file, of a kind the assignment accepts", () => {
    expect(submissionProblems(["text", "file"], "  ", 0)).toEqual(["Type your answer or attach at least one file."]);
    expect(submissionProblems(["text"], "", 0)).toEqual(["Type your answer."]);
    expect(submissionProblems(["file"], "", 0)).toEqual(["Attach at least one file."]);
    expect(submissionProblems(["file"], "Hello", 1)).toEqual(["This assignment takes files only."]);
    expect(submissionProblems(["text"], "Hello", 1)).toEqual(["This assignment takes typed answers only."]);
    expect(submissionProblems(["text", "file"], "Hello", 2)).toEqual([]);
    expect(submissionProblems(["file"], "", 6)).toEqual(["Attach at most 5 files."]);
  });

  it("checks each attached file's type and size", () => {
    expect(submissionFileProblem({ name: "essay.pdf", size: 1024 }, 25)).toBeUndefined();
    expect(submissionFileProblem({ name: "photo.JPG", size: 1024 }, 25)).toBeUndefined();
    expect(submissionFileProblem({ name: "run.exe", size: 1024 }, 25)).toBe("run.exe: .exe files cannot be handed in.");
    expect(submissionFileProblem({ name: "essay.pdf", size: 26 * 1024 * 1024 }, 25)).toBe(
      "essay.pdf is 26 MB. The limit is 25 MB for each file.",
    );
    expect(submissionFileProblem({ name: "essay.pdf", size: 0 }, 25)).toBe("essay.pdf is empty.");
  });

  it("gives every hand-in its own receipt", () => {
    const first = receiptCode("s1", "2026-10-19T10:00:00.000Z");
    expect(first).toMatch(/^R-[0-9A-Z]{4}-[0-9A-Z]{3,}$/);
    expect(receiptCode("s1", "2026-10-19T10:00:00.000Z")).toBe(first);
    expect(receiptCode("s2", "2026-10-19T10:00:00.000Z")).not.toBe(first);
    expect(receiptCode("s1", "2026-10-19T10:00:01.000Z")).not.toBe(first);
  });

  it("treats the highest attempt as a student's current hand-in", () => {
    const second = { ...submission, id: "s2", attempt: 2 };
    const other = { ...submission, id: "s3", studentId: "u2" };
    expect(latestByStudent([submission, second, other])).toEqual({ u1: second, u2: other });
  });
});

describe("US-10: rubric criteria and point totals are validated before publishing", () => {
  it("accepts a rubric whose criteria add up to the assignment's points", () => {
    expect(rubricTotal(rubric)).toBe(20);
    expect(rubricProblems(rubric, 20)).toEqual([]);
    expect(assignmentProblems(assignment, { courseSectionIds: ["sec-a", "sec-b"] })).toEqual([]);
  });

  it("rejects a rubric that adds up to a different total", () => {
    expect(rubricProblems(rubric, 25)).toEqual(["The rubric adds up to 20 points, but the assignment is worth 25."]);
  });

  it("rejects an empty rubric", () => {
    expect(rubricProblems({ criteria: [] }, 20)).toEqual(["The rubric needs at least one criterion."]);
  });

  it("checks each criterion: title, points, levels and the top level", () => {
    const broken: Rubric = {
      criteria: [
        { id: "x", title: "", description: "", points: 10, levels: [{ id: "x1", label: "Only", points: 10 }] },
        {
          id: "y",
          title: "Evidence",
          description: "",
          points: 10,
          levels: [
            { id: "y1", label: "Strong", points: 8 },
            { id: "y2", label: "", points: 8 },
          ],
        },
      ],
    };
    expect(rubricProblems(broken, 20)).toEqual([
      "Criterion 1 needs a title.",
      "Criterion 1 needs at least two levels.",
      'Every level of "Evidence" needs a name.',
      'The highest level of "Evidence" is worth 8, but the criterion is worth 10.',
      'Two levels of "Evidence" are worth the same points.',
    ]);
  });

  it("checks the rest of the assignment before it is published", () => {
    const broken: Assignment = {
      ...assignment,
      title: " ",
      instructions: "",
      points: 0,
      dueAt: "",
      sectionIds: [],
      accepts: [],
      rubric: undefined,
    };
    expect(assignmentProblems(broken, { courseSectionIds: ["sec-a"] })).toEqual([
      "Give the assignment a title.",
      "Write the instructions students will follow.",
      "Points must be a number greater than 0.",
      "Set a due date and time.",
      "Choose at least one section to set the assignment for.",
      "Choose how students hand in: typed text, files, or both.",
    ]);
    expect(assignmentProblems({ ...assignment, sectionIds: ["sec-z"] }, { courseSectionIds: ["sec-a"] })).toEqual([
      "One of the chosen sections no longer belongs to this course.",
    ]);
  });

  it("publishes only to the selected sections", () => {
    expect(isSetFor(assignment, ["sec-a"])).toBe(true);
    expect(isSetFor(assignment, ["sec-b"])).toBe(false);
    expect(isSetFor({ ...assignment, status: "draft" }, ["sec-a"])).toBe(false);
  });
});

describe("US-15: rubric scores total automatically", () => {
  it("adds up the chosen levels", () => {
    expect(rubricScore(rubric, { c1: "c1-3", c2: "c2-2" })).toEqual({ points: 17, complete: true });
  });

  it("gives a running total while criteria are still unscored", () => {
    expect(rubricScore(rubric, {})).toEqual({ points: 0, complete: false });
    expect(rubricScore(rubric, { c1: "c1-4" })).toEqual({ points: 12, complete: false });
  });

  it("ignores a choice that is not a level of that criterion", () => {
    expect(rubricScore(rubric, { c1: "c2-2", c2: "c2-1", gone: "x" })).toEqual({ points: 4, complete: false });
  });

  it("turns complete rubric choices into the grade", () => {
    const result = gradeFor(assignment, submission, { rubricLevels: { c1: "c1-3", c2: "c2-1" }, feedback: " Good start. " }, by);
    expect(result).toEqual({
      grade: { rubricLevels: { c1: "c1-3", c2: "c2-1" }, rawPoints: 13, points: 13, feedback: "Good start.", ...by, releasedAt: undefined },
    });
  });

  it("will not grade until every criterion has a level", () => {
    expect(gradeFor(assignment, submission, { rubricLevels: { c1: "c1-3" }, feedback: "" }, by)).toEqual({
      problems: ["Choose a level for every rubric criterion."],
    });
  });

  it("applies the late penalty recorded on the hand-in", () => {
    const late = { ...submission, late: { daysLate: 2, penaltyPercent: 20 } };
    const result = gradeFor(assignment, late, { rubricLevels: { c1: "c1-4", c2: "c2-2" }, feedback: "" }, by);
    expect(result).toMatchObject({ grade: { rawPoints: 20, points: 16 } });
  });

  it("takes a typed mark when there is no rubric, within the assignment's points", () => {
    const plain = { ...assignment, rubric: undefined };
    expect(gradeFor(plain, submission, { rawPoints: 17.5, feedback: "" }, by)).toMatchObject({ grade: { rawPoints: 17.5, points: 17.5 } });
    expect(gradeFor(plain, submission, { rawPoints: 21, feedback: "" }, by)).toEqual({ problems: ["Enter a mark from 0 to 20."] });
    expect(gradeFor(plain, submission, { feedback: "" }, by)).toEqual({ problems: ["Enter a mark from 0 to 20."] });
  });
});

describe("US-15, US-14: what the student sees", () => {
  const comment = {
    id: "k1",
    anchor: { kind: "text" as const, start: 0, end: 2, quote: "My" },
    body: "Say whose.",
    authorId: "f1",
    createdAt: "2026-10-21T09:00:00.000Z",
  };
  const grade = { rawPoints: 17, points: 17, feedback: "Well argued.", ...by };
  const similarity = { provider: "Mock", checkedAt: "2026-10-19T10:00:05.000Z", percent: 12, matches: [] };
  const marked: Submission = { ...submission, comments: [comment], grade, similarity };

  it("hides the mark, the feedback and the inline comments until the grade is released", () => {
    const seen = forStudent(marked, { similarityVisible: false });
    expect(seen.grade).toBeUndefined();
    expect(seen.comments).toEqual([]);
    expect(seen.text).toBe("My essay.");
    expect(seen.receipt).toBe(submission.receipt);
  });

  it("shows them once the grade is released", () => {
    const released = { ...marked, grade: { ...grade, releasedAt: "2026-10-22T08:00:00.000Z" } };
    const seen = forStudent(released, { similarityVisible: false });
    expect(seen.grade?.points).toBe(17);
    expect(seen.grade?.feedback).toBe("Well argued.");
    expect(seen.comments).toEqual([comment]);
  });

  it("keeps the similarity report for faculty unless the school shares it", () => {
    expect(forStudent(marked, { similarityVisible: false }).similarity).toBeUndefined();
    expect(forStudent(marked, { similarityVisible: true }).similarity).toEqual(similarity);
  });

  it("keeps a re-marked grade released", () => {
    const released = { ...marked, grade: { ...grade, releasedAt: "2026-10-22T08:00:00.000Z" } };
    const result = gradeFor(assignment, released, { rubricLevels: { c1: "c1-4", c2: "c2-2" }, feedback: "" }, by);
    expect(result).toMatchObject({ grade: { points: 20, releasedAt: "2026-10-22T08:00:00.000Z" } });
  });

  it("names where each hand-in stands", () => {
    expect(submissionState(undefined)).toBe("missing");
    expect(submissionState(submission)).toBe("submitted");
    expect(submissionState(marked)).toBe("graded");
    expect(submissionState({ ...marked, grade: { ...grade, releasedAt: "2026-10-22T08:00:00.000Z" } })).toBe("released");
  });
});

describe("US-15: comments are anchored to specific parts of the submission", () => {
  const text = "The cat sat on the mat.";

  it("cuts the text so each anchored part can be highlighted", () => {
    const segments = segmentText(text, [{ id: "k1", start: 4, end: 7 }]);
    expect(segments.map((segment) => [segment.text, segment.commentIds])).toEqual([
      ["The ", []],
      ["cat", ["k1"]],
      [" sat on the mat.", []],
    ]);
  });

  it("never changes the text itself", () => {
    const anchors = [
      { id: "k1", start: 4, end: 11 },
      { id: "k2", start: 8, end: 14 },
      { id: "k3", start: 0, end: 3 },
    ];
    expect(segmentText(text, anchors).map((segment) => segment.text).join("")).toBe(text);
  });

  it("marks the overlap of two comments with both", () => {
    const segments = segmentText(text, [
      { id: "k1", start: 4, end: 11 },
      { id: "k2", start: 8, end: 14 },
    ]);
    expect(segments.map((segment) => [segment.text, segment.commentIds])).toEqual([
      ["The ", []],
      ["cat ", ["k1"]],
      ["sat", ["k1", "k2"]],
      [" on", ["k2"]],
      [" the mat.", []],
    ]);
  });

  it("can cut one paragraph of a longer text, keeping offsets from the whole", () => {
    const segments = segmentText(text, [{ id: "k1", start: 4, end: 20 }], 8, 14);
    expect(segments).toEqual([{ start: 8, end: 14, text: "sat on", commentIds: ["k1"] }]);
  });

  it("ignores an anchor that falls outside the text", () => {
    expect(segmentText(text, [{ id: "k1", start: 40, end: 50 }])).toEqual([
      { start: 0, end: text.length, text, commentIds: [] },
    ]);
  });
});
