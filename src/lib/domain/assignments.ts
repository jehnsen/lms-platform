/**
 * Rules for assignments (Epic C): late work (FR-3.4), rubrics (FR-3.2), who
 * may hand in and when (US-11), and what a student may see of marked work
 * (US-15, US-14). No React and no storage, so the backend can run the same
 * rules; a browser's own verdict on any of them must never be trusted.
 */
import type {
  Assignment,
  LatePolicy,
  Rubric,
  Submission,
  SubmissionGrade,
  SubmissionKind,
} from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// --- Late work (FR-3.4, US-11) -----------------------------------------------

/** Until the school decides (Q-14): late work is accepted and marked late, with no deduction. */
export const DEFAULT_LATE_POLICY: LatePolicy = {
  rule: "flag",
  penaltyPercent: 10,
  penaltyPer: "day",
  maxPenaltyPercent: 50,
};

/** Whole days late, counting any part of a day as a day. 0 when on time. */
export function daysLate(dueAt: string, submittedAt: string) {
  const lateMs = Date.parse(submittedAt) - Date.parse(dueAt);
  return lateMs <= 0 ? 0 : Math.ceil(lateMs / DAY_MS);
}

/** The percent deducted from the mark for work this many days late. */
export function latePenaltyPercent(policy: LatePolicy, days: number) {
  if (days <= 0 || policy.rule !== "penalty") return 0;
  if (policy.penaltyPer === "submission") return Math.min(100, policy.penaltyPercent);
  return Math.min(100, policy.maxPenaltyPercent, policy.penaltyPercent * days);
}

export interface LateOutcome {
  /** False only when the rule is `block` and the due time has passed. */
  accepted: boolean;
  daysLate: number;
  penaltyPercent: number;
}

/** What the late rule does to work handed in at this moment. */
export function lateOutcome(policy: LatePolicy, dueAt: string, submittedAt: string): LateOutcome {
  const days = daysLate(dueAt, submittedAt);
  return {
    accepted: days === 0 || policy.rule !== "block",
    daysLate: days,
    penaltyPercent: latePenaltyPercent(policy, days),
  };
}

/** The mark after a late penalty, to two decimal places. */
export function applyPenalty(rawPoints: number, penaltyPercent: number) {
  return Math.round(rawPoints * (100 - Math.min(100, Math.max(0, penaltyPercent)))) / 100;
}

/** The late rule in words, as it is shown to students before they hand in (US-11). */
export function describeLatePolicy(policy: LatePolicy) {
  if (policy.rule === "block") return "Late work is not accepted: nothing can be handed in after the due time.";
  if (policy.rule === "flag") return "Late work is accepted and marked as late. No marks are deducted.";
  if (policy.penaltyPer === "submission") {
    return `Late work is accepted and loses ${policy.penaltyPercent}% of its mark.`;
  }
  return `Late work is accepted and loses ${policy.penaltyPercent}% of its mark for each day late, up to ${policy.maxPenaltyPercent}%.`;
}

export function latePolicyProblems(policy: LatePolicy): string[] {
  if (policy.rule !== "penalty") return [];
  const problems: string[] = [];
  const inRange = (value: number) => Number.isFinite(value) && value > 0 && value <= 100;
  if (!inRange(policy.penaltyPercent)) problems.push("The late penalty must be more than 0% and at most 100%.");
  if (policy.penaltyPer === "day") {
    if (!inRange(policy.maxPenaltyPercent)) {
      problems.push("The most that can be deducted for late work must be more than 0% and at most 100%.");
    } else if (inRange(policy.penaltyPercent) && policy.maxPenaltyPercent < policy.penaltyPercent) {
      problems.push("The most that can be deducted for late work cannot be less than the penalty for one day.");
    }
  }
  return problems;
}

// --- Rubrics (FR-3.2, US-10, US-15) --------------------------------------------

export function rubricTotal(rubric: Rubric) {
  return rubric.criteria.reduce((sum, criterion) => sum + criterion.points, 0);
}

/** US-10: why this rubric cannot be published for an assignment worth `points`. Empty when it can. */
export function rubricProblems(rubric: Rubric, points: number): string[] {
  const problems: string[] = [];
  if (rubric.criteria.length === 0) problems.push("The rubric needs at least one criterion.");

  rubric.criteria.forEach((criterion, index) => {
    const name = criterion.title.trim() ? `"${criterion.title.trim()}"` : `Criterion ${index + 1}`;
    if (!criterion.title.trim()) problems.push(`Criterion ${index + 1} needs a title.`);
    if (!Number.isFinite(criterion.points) || criterion.points <= 0) {
      problems.push(`${name} needs points greater than 0.`);
    }
    if (criterion.levels.length < 2) {
      problems.push(`${name} needs at least two levels.`);
      return;
    }
    if (criterion.levels.some((level) => !level.label.trim())) problems.push(`Every level of ${name} needs a name.`);
    if (criterion.levels.some((level) => !Number.isFinite(level.points) || level.points < 0)) {
      problems.push(`Every level of ${name} needs points of 0 or more.`);
      return;
    }
    const top = Math.max(...criterion.levels.map((level) => level.points));
    if (top !== criterion.points) {
      problems.push(`The highest level of ${name} is worth ${top}, but the criterion is worth ${criterion.points}.`);
    }
    if (new Set(criterion.levels.map((level) => level.points)).size !== criterion.levels.length) {
      problems.push(`Two levels of ${name} are worth the same points.`);
    }
  });

  const total = rubricTotal(rubric);
  if (rubric.criteria.length > 0 && Number.isFinite(total) && total !== points) {
    problems.push(`The rubric adds up to ${total} points, but the assignment is worth ${points}.`);
  }
  return problems;
}

export interface RubricScore {
  points: number;
  /** True when a level has been chosen for every criterion. */
  complete: boolean;
}

/** US-15: the total of the levels chosen so far. Choices for criteria or levels that do not exist count for nothing. */
export function rubricScore(rubric: Rubric, chosen: Record<string, string>): RubricScore {
  let points = 0;
  let scored = 0;
  for (const criterion of rubric.criteria) {
    const level = criterion.levels.find((candidate) => candidate.id === chosen[criterion.id]);
    if (!level) continue;
    points += level.points;
    scored += 1;
  }
  return { points, complete: scored === rubric.criteria.length };
}

// --- Assignments (FR-3.1, US-10) -----------------------------------------------

export interface AssignmentRulesContext {
  /** Ids of the sections of the assignment's course. */
  courseSectionIds: string[];
}

/** US-10: why this assignment cannot be published. Empty when it can. A draft is saved whatever this says. */
export function assignmentProblems(assignment: Assignment, context: AssignmentRulesContext): string[] {
  const problems: string[] = [];
  if (!assignment.title.trim()) problems.push("Give the assignment a title.");
  if (!assignment.instructions.trim()) problems.push("Write the instructions students will follow.");
  if (!Number.isFinite(assignment.points) || assignment.points <= 0) {
    problems.push("Points must be a number greater than 0.");
  }
  if (Number.isNaN(Date.parse(assignment.dueAt))) problems.push("Set a due date and time.");
  if (assignment.sectionIds.length === 0) problems.push("Choose at least one section to set the assignment for.");
  else if (assignment.sectionIds.some((id) => !context.courseSectionIds.includes(id))) {
    problems.push("One of the chosen sections no longer belongs to this course.");
  }
  if (assignment.accepts.length === 0) problems.push("Choose how students hand in: typed text, files, or both.");
  problems.push(...latePolicyProblems(assignment.late));
  if (assignment.rubric) problems.push(...rubricProblems(assignment.rubric, assignment.points));
  return problems;
}

/** FR-3.1: a student sees an assignment once it is published for a section they are in. */
export function isSetFor(assignment: Assignment, sectionIds: string[]) {
  return assignment.status === "published" && assignment.sectionIds.some((id) => sectionIds.includes(id));
}

// --- Handing in (FR-3.3, FR-3.4, US-11) ----------------------------------------

export type SubmitDecision =
  | { allowed: true; outcome: LateOutcome }
  | { allowed: false; reason: string };

/**
 * May the student hand in now? `attempts` is how many times they already have.
 * Resubmission is allowed only if the teacher enabled it (US-11).
 */
export function submitDecision(assignment: Assignment, attempts: number, at: string): SubmitDecision {
  if (assignment.status !== "published") return { allowed: false, reason: "This assignment is not open yet." };
  if (attempts > 0 && !assignment.allowResubmission) {
    return { allowed: false, reason: "You have already handed this in, and resubmission is not allowed for this assignment." };
  }
  const outcome = lateOutcome(assignment.late, assignment.dueAt, at);
  if (!outcome.accepted) {
    return { allowed: false, reason: "The due time has passed and late work is not accepted for this assignment." };
  }
  return { allowed: true, outcome };
}

export const MAX_SUBMISSION_FILES = 5;

/** Why this work cannot be handed in as it stands. Empty when it can. */
export function submissionProblems(accepts: SubmissionKind[], text: string, fileCount: number): string[] {
  const hasText = text.trim().length > 0;
  if (!hasText && fileCount === 0) {
    return [
      accepts.length === 2
        ? "Type your answer or attach at least one file."
        : accepts[0] === "text"
          ? "Type your answer."
          : "Attach at least one file.",
    ];
  }
  const problems: string[] = [];
  if (hasText && !accepts.includes("text")) problems.push("This assignment takes files only.");
  if (fileCount > 0 && !accepts.includes("file")) problems.push("This assignment takes typed answers only.");
  if (fileCount > MAX_SUBMISSION_FILES) problems.push(`Attach at most ${MAX_SUBMISSION_FILES} files.`);
  return problems;
}

/** Formats a student may attach. Photos are included for handwritten work. */
export const SUBMISSION_EXTENSIONS = ["pdf", "doc", "docx", "txt", "md", "ppt", "pptx", "odp", "jpg", "jpeg", "png"];

/** Why this file cannot be attached to a submission, or `undefined` when it can. */
export function submissionFileProblem(file: { name: string; size: number }, limitMb: number): string | undefined {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
  if (!SUBMISSION_EXTENSIONS.includes(extension)) {
    return `${file.name}: ${extension ? `.${extension} files` : "files of this type"} cannot be handed in.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > limitMb * 1024 * 1024) {
    return `${file.name} is ${Math.ceil(file.size / (1024 * 1024))} MB. The limit is ${limitMb} MB for each file.`;
  }
  return undefined;
}

/** The reference a student keeps as proof of submission. Readable, and unique per hand-in. */
export function receiptCode(submissionId: string, submittedAt: string) {
  let hash = 0x811c9dc5;
  for (const char of `${submissionId}|${submittedAt}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
  return `R-${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The most recent hand-in of each student, by student id. */
export function latestByStudent(submissions: Submission[]): Record<string, Submission> {
  const latest: Record<string, Submission> = {};
  for (const submission of submissions) {
    const current = latest[submission.studentId];
    if (!current || submission.attempt > current.attempt) latest[submission.studentId] = submission;
  }
  return latest;
}

// --- Marking and release (FR-3.9, FR-4.3, US-15, US-14) ------------------------

/** Builds the grade for a hand-in: rubric choices or a typed mark, then the late penalty. */
export function gradeFor(
  assignment: Assignment,
  submission: Submission,
  input: { rubricLevels?: Record<string, string>; rawPoints?: number; feedback: string },
  by: { gradedById: string; gradedAt: string },
): { grade: SubmissionGrade } | { problems: string[] } {
  let rawPoints: number;
  if (assignment.rubric) {
    const score = rubricScore(assignment.rubric, input.rubricLevels ?? {});
    if (!score.complete) return { problems: ["Choose a level for every rubric criterion."] };
    rawPoints = score.points;
  } else {
    rawPoints = input.rawPoints ?? Number.NaN;
    if (!Number.isFinite(rawPoints) || rawPoints < 0 || rawPoints > assignment.points) {
      return { problems: [`Enter a mark from 0 to ${assignment.points}.`] };
    }
  }
  return {
    grade: {
      rubricLevels: assignment.rubric ? input.rubricLevels : undefined,
      rawPoints,
      points: applyPenalty(rawPoints, submission.late?.penaltyPercent ?? 0),
      feedback: input.feedback.trim(),
      ...by,
      // Re-marking work that was already released keeps it released.
      releasedAt: submission.grade?.releasedAt,
    },
  };
}

/**
 * A hand-in as its own student may see it. The mark, the feedback and the
 * inline comments are withheld until the grade is released (US-15); the
 * similarity report is withheld unless the school shares it (US-14).
 */
export function forStudent(submission: Submission, options: { similarityVisible: boolean }): Submission {
  const released = submission.grade?.releasedAt !== undefined;
  return {
    ...submission,
    grade: released ? submission.grade : undefined,
    comments: released ? submission.comments : [],
    similarity: options.similarityVisible ? submission.similarity : undefined,
  };
}

/** Where a hand-in stands, for lists. `graded` means marked but not yet released. */
export type SubmissionState = "missing" | "submitted" | "graded" | "released";

export function submissionState(submission: Submission | undefined): SubmissionState {
  if (!submission) return "missing";
  if (!submission.grade) return "submitted";
  return submission.grade.releasedAt ? "released" : "graded";
}

// --- Inline comments on typed text (FR-3.9) -------------------------------------

export interface TextSegment {
  start: number;
  end: number;
  text: string;
  /** Ids of the comments anchored to this run of text. Empty for plain text. */
  commentIds: string[];
}

/**
 * Cuts text into runs so that anchored comments can be highlighted, including
 * where two comments overlap. The segments, joined, are the text unchanged.
 */
export function segmentText(
  text: string,
  anchors: Array<{ id: string; start: number; end: number }>,
  from = 0,
  to = text.length,
): TextSegment[] {
  const inside = anchors
    .map((anchor) => ({ ...anchor, start: Math.max(from, anchor.start), end: Math.min(to, anchor.end) }))
    .filter((anchor) => anchor.start < anchor.end);
  const cuts = [...new Set([from, to, ...inside.flatMap((anchor) => [anchor.start, anchor.end])])].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const [start, end] = [cuts[index], cuts[index + 1]];
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      commentIds: inside.filter((anchor) => anchor.start <= start && anchor.end >= end).map((anchor) => anchor.id),
    });
  }
  return segments;
}
