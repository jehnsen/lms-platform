import type { Answer, AnswerSheet, ManualMark, MatchingQuestion, Question, Quiz } from "@/lib/types";

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

const LETTER_BANDS: Array<[number, string]> = [
  [93, "A"],
  [90, "A−"],
  [87, "B+"],
  [83, "B"],
  [80, "B−"],
  [77, "C+"],
  [73, "C"],
  [70, "C−"],
  [60, "D"],
];

export function letterGrade(percent: number) {
  return LETTER_BANDS.find(([min]) => percent >= min)?.[1] ?? "F";
}
