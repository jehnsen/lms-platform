import type { Answer, AnswerSheet, Question, Quiz } from "@/lib/types";

export type QuestionStatus = "correct" | "partial" | "incorrect" | "unanswered";

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
  questions: QuestionResult[];
}

export function isAnswered(answer: Answer | undefined) {
  if (answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return true;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
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
  }
}

export function gradeQuestion(question: Question, answer: Answer | undefined): QuestionResult {
  const base = { questionId: question.id, possible: question.points };
  if (answer === undefined || !isAnswered(answer)) {
    return { ...base, earned: 0, status: "unanswered" };
  }
  const fraction = scoreFraction(question, answer);
  // Round to the nearest half point so partial credit stays readable.
  const earned = Math.round(question.points * fraction * 2) / 2;
  const status: QuestionStatus =
    fraction === 1 ? "correct" : earned > 0 ? "partial" : "incorrect";
  return { ...base, earned, status };
}

export function gradeQuiz(quiz: Quiz, answers: AnswerSheet): QuizResult {
  const questions = quiz.questions.map((question) => gradeQuestion(question, answers[question.id]));
  const earned = questions.reduce((sum, result) => sum + result.earned, 0);
  const possible = questions.reduce((sum, result) => sum + result.possible, 0);
  const percent = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { earned, possible, percent, passed: percent >= quiz.passMark, questions };
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
