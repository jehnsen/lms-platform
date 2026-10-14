import type {
  Answer,
  AnswerSheet,
  GradingScale,
  GradingScaleBand,
  ManualMark,
  MatchingQuestion,
  Question,
  Quiz,
} from "@/lib/types";

/** `pending` means the answer is waiting for a teacher to mark it (US-12). */
export type QuestionStatus = "correct" | "partial" | "incorrect" | "unanswered" | "pending";

export interface QuestionResult {
  questionId: string;
  earned: number;
  possible: number;
  status: QuestionStatus;
}

export interface QuizResult {
  earned: number;
  possible: number;
  percent: number;
  passed: boolean;
  /** How many answers still wait for a teacher. While this is above 0 the score is not final. */
  pending: number;
  questions: QuestionResult[];
}

export function isAnswered(answer: Answer | undefined) {
  if (answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  // Multi-select: at least one choice. Matching: at least one item matched (-1 means not matched).
  if (Array.isArray(answer)) return answer.some((choice) => choice >= 0);
  return true;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** US-12: multiple choice, true/false and matching are always marked automatically; short answers only when set to. */
export function isManuallyMarked(question: Question) {
  return question.kind === "short" && question.marking === "manual";
}

/** The right-hand choices of a matching question: each pair's match, then the distractors. */
export function matchingChoices(question: MatchingQuestion): string[] {
  return [...question.pairs.map((pair) => pair.right), ...(question.distractors ?? [])];
}

/**
 * The order the right-hand choices are shown in: shuffled so the answer is not
 * given away, and the same every time for a given question so a saved attempt
 * reads the same after a reload. Each entry is an index into `matchingChoices`.
 */
export function matchingOrder(question: MatchingQuestion): number[] {
  const order = matchingChoices(question).map((_, index) => index);
  let state = 0x811c9dc5;
  for (const char of question.id + question.prompt) {
    state ^= char.codePointAt(0) ?? 0;
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  for (let index = order.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  // A shuffle that changes nothing would show the answers lined up.
  if (order.length > 1 && order.every((value, index) => value === index)) order.push(order.shift()!);
  return order;
}

/** Fraction of the question's points earned, from 0 to 1. */
function scoreFraction(question: Question, answer: Answer): number {
  switch (question.kind) {
    case "single":
      return answer === question.answer ? 1 : 0;
    case "boolean":
      return answer === question.answer ? 1 : 0;
    case "multi": {
      // Partial credit: each right choice adds, each wrong choice subtracts.
      const chosen = Array.isArray(answer) ? answer : [];
      const right = chosen.filter((choice) => question.answer.includes(choice)).length;
      const wrong = chosen.length - right;
      return Math.max(0, right - wrong) / question.answer.length;
    }
    case "short": {
      const response = normalize(typeof answer === "string" ? answer : "");
      return question.accept.some((phrase) => response.includes(normalize(phrase))) ? 1 : 0;
    }
    case "matching": {
      // Part marks: one share for each left item matched to its own pair.
      const chosen = Array.isArray(answer) ? answer : [];
      const right = question.pairs.filter((_, index) => chosen[index] === index).length;
      return question.pairs.length === 0 ? 0 : right / question.pairs.length;
    }
  }
}

/**
 * Marks one answer. A manually marked question earns what the teacher gave
 * it, or is `pending` until they have.
 */
export function gradeQuestion(question: Question, answer: Answer | undefined, mark?: ManualMark): QuestionResult {
  const base = { questionId: question.id, possible: question.points };
  if (answer === undefined || !isAnswered(answer)) {
    return { ...base, earned: 0, status: "unanswered" };
  }
  if (isManuallyMarked(question)) {
    if (!mark) return { ...base, earned: 0, status: "pending" };
    const earned = Math.min(question.points, Math.max(0, mark.points));
    return { ...base, earned, status: earned === question.points ? "correct" : earned > 0 ? "partial" : "incorrect" };
  }
  const fraction = scoreFraction(question, answer);
  // Round to the nearest half point so partial credit stays readable.
  const earned = Math.round(question.points * fraction * 2) / 2;
  const status: QuestionStatus =
    fraction === 1 ? "correct" : earned > 0 ? "partial" : "incorrect";
  return { ...base, earned, status };
}

export function gradeQuiz(quiz: Quiz, answers: AnswerSheet, manual: Record<string, ManualMark> = {}): QuizResult {
  const questions = quiz.questions.map((question) =>
    gradeQuestion(question, answers[question.id], manual[question.id]),
  );
  const earned = questions.reduce((sum, result) => sum + result.earned, 0);
  const possible = questions.reduce((sum, result) => sum + result.possible, 0);
  const percent = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  const pending = questions.filter((result) => result.status === "pending").length;
  return { earned, possible, percent, passed: pending === 0 && percent >= quiz.passMark, pending, questions };
}

export function quizPoints(quiz: Pick<Quiz, "questions">) {
  return quiz.questions.reduce((sum, question) => sum + question.points, 0);
}

// --- Grading scales (FR-4.2, US-16) --------------------------------------------

const LETTER_BANDS: GradingScaleBand[] = [
  { min: 93, label: "A", points: 4 },
  { min: 90, label: "A−", points: 3.7 },
  { min: 87, label: "B+", points: 3.3 },
  { min: 83, label: "B", points: 3 },
  { min: 80, label: "B−", points: 2.7 },
  { min: 77, label: "C+", points: 2.3 },
  { min: 73, label: "C", points: 2 },
  { min: 70, label: "C−", points: 1.7 },
  { min: 60, label: "D", points: 1 },
  { min: 0, label: "F", points: 0 },
];

/** Q-17: the scales a school starts with. An admin changes the bands in Settings. */
export const DEFAULT_GRADING_SCALES: GradingScale[] = [
  { id: "scale-percentage", name: "Percentage", kind: "percentage", bands: [] },
  {
    id: "scale-letter",
    name: "Letter grades",
    kind: "letter",
    bands: LETTER_BANDS.map(({ min, label }) => ({ min, label })),
  },
  { id: "scale-gpa", name: "GPA (4.0)", kind: "gpa", bands: LETTER_BANDS },
];

export const DEFAULT_SCALE_ID = "scale-letter";

export const SCALE_KIND_LABELS: Record<GradingScale["kind"], string> = {
  percentage: "Percentage",
  letter: "Letter",
  gpa: "GPA",
};

/** The scale with this id, or the school's default when it is gone. */
export function findScale(
  settings: { gradingScales: GradingScale[]; defaultScaleId: string },
  scaleId?: string,
): GradingScale {
  const { gradingScales } = settings;
  return (
    gradingScales.find((scale) => scale.id === scaleId) ??
    gradingScales.find((scale) => scale.id === settings.defaultScaleId) ??
    gradingScales[0] ??
    DEFAULT_GRADING_SCALES[0]
  );
}

/** The band of a letter or GPA scale a percentage falls in. */
export function bandFor(percent: number, scale: GradingScale): GradingScaleBand | undefined {
  return [...scale.bands].sort((a, b) => b.min - a.min).find((band) => percent >= band.min);
}

/** Grade points for a percentage on a GPA scale; `null` on any other scale. */
export function gradePoints(percent: number, scale: GradingScale): number | null {
  if (scale.kind !== "gpa") return null;
  return bandFor(percent, scale)?.points ?? null;
}

/** A percentage as the scale reports it: "87%", "B+" or "3.3". */
export function gradeOnScale(percent: number, scale: GradingScale): string {
  if (scale.kind === "percentage") return `${percent}%`;
  const band = bandFor(percent, scale);
  if (!band) return "—";
  return scale.kind === "gpa" ? (band.points ?? 0).toFixed(1) : band.label;
}

/**
 * The grade to show beside a percentage: "Grade B+" or "GPA 3.3". `null` on a
 * percentage scale, where it would only repeat the number.
 */
export function gradeBeside(percent: number, scale: GradingScale): string | null {
  if (scale.kind === "percentage") return null;
  return `${scale.kind === "gpa" ? "GPA" : "Grade"} ${gradeOnScale(percent, scale)}`;
}

/** A percentage with its grade on the scale, for one line of text: "87% · B+", "87% · GPA 3.3" or "87%". */
export function percentAndGrade(percent: number, scale: GradingScale): string {
  if (scale.kind === "percentage") return `${percent}%`;
  return `${percent}% · ${scale.kind === "gpa" ? "GPA " : ""}${gradeOnScale(percent, scale)}`;
}

export const GRADE_POINTS_RANGE = { min: 0, max: 10 } as const;

/** Why a scale cannot be saved. Empty when it can. */
export function scaleProblems(scale: GradingScale): string[] {
  const name = scale.name.trim() || "The scale";
  if (scale.kind === "percentage") return [];
  const problems: string[] = [];
  if (scale.bands.length < 2) problems.push(`${name} needs at least two grades.`);
  const labels = scale.bands.map((band) => band.label.trim().toLowerCase());
  if (labels.some((label) => label === "")) problems.push(`Give every grade in ${name} a name.`);
  if (new Set(labels).size !== labels.length) problems.push(`Two grades in ${name} have the same name.`);
  const mins = scale.bands.map((band) => band.min);
  if (mins.some((min) => !Number.isFinite(min) || min < 0 || min > 100)) {
    problems.push(`Every grade in ${name} must start at a percentage from 0 to 100.`);
  } else {
    if (new Set(mins).size !== mins.length) problems.push(`Two grades in ${name} start at the same percentage.`);
    if (scale.bands.length > 0 && !mins.includes(0)) {
      problems.push(`The lowest grade in ${name} must start at 0%, so every score has a grade.`);
    }
  }
  if (scale.kind === "gpa") {
    const points = scale.bands.map((band) => band.points);
    if (
      points.some(
        (value) =>
          value === undefined || !Number.isFinite(value) || value < GRADE_POINTS_RANGE.min || value > GRADE_POINTS_RANGE.max,
      )
    ) {
      problems.push(
        `Every grade in ${name} needs grade points from ${GRADE_POINTS_RANGE.min} to ${GRADE_POINTS_RANGE.max}.`,
      );
    } else {
      const ordered = [...scale.bands].sort((a, b) => b.min - a.min);
      if (ordered.some((band, index) => index > 0 && (band.points ?? 0) > (ordered[index - 1].points ?? 0))) {
        problems.push(`In ${name} a higher percentage cannot earn fewer grade points than a lower one.`);
      }
    }
  }
  return problems;
}

/** A scale as it is stored: names trimmed and bands from the highest down. */
export function tidyScale(scale: GradingScale): GradingScale {
  return {
    ...scale,
    name: scale.name.trim(),
    bands: [...scale.bands]
      .sort((a, b) => b.min - a.min)
      .map((band) => ({
        min: band.min,
        label: band.label.trim(),
        ...(scale.kind === "gpa" ? { points: band.points } : {}),
      })),
  };
}

