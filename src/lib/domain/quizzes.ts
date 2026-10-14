/**
 * Rules for quizzes (BR-11): what a quiz needs before it is published
 * (FR-3.5), who may start an attempt, timed attempts and their automatic
 * submission (FR-3.7, US-13), and turning answers into a stored attempt with
 * manual marks posted back to it (FR-3.6, US-12).
 *
 * The backend must run all of this itself: the answer key should never reach
 * a student's browser, and the time limit must be enforced on the server.
 */
import { gradeQuiz, isManuallyMarked } from "@/lib/grading";
import type { AnswerSheet, ManualMark, Question, Quiz, QuizAttempt } from "@/lib/types";

const MINUTE_MS = 60_000;

// --- Building (FR-3.5, US-12) ---------------------------------------------------

export const QUESTION_KIND_LABELS: Record<Question["kind"], string> = {
  single: "Multiple choice",
  multi: "Multiple answers",
  boolean: "True or false",
  matching: "Matching",
  short: "Short answer",
};

export const QUESTION_KINDS = Object.keys(QUESTION_KIND_LABELS) as Question["kind"][];

/** A new, empty question of a kind, ready to be filled in. Short answers start as marked by a teacher (Q-15). */
export function blankQuestion(kind: Question["kind"], id: string): Question {
  const base = { id, prompt: "", points: 1, explanation: "" };
  switch (kind) {
    case "single":
      return { ...base, kind, options: ["", ""], answer: 0 };
    case "multi":
      return { ...base, kind, options: ["", "", ""], answer: [] };
    case "boolean":
      return { ...base, kind, answer: true };
    case "matching":
      return { ...base, kind, points: 2, pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "short":
      return { ...base, kind, marking: "manual", accept: [], sample: "" };
  }
}

function questionProblems(question: Question, name: string): string[] {
  const problems: string[] = [];
  if (!question.prompt.trim()) problems.push(`${name} needs its question text.`);
  if (!Number.isFinite(question.points) || question.points <= 0) problems.push(`${name} needs points greater than 0.`);

  switch (question.kind) {
    case "single":
    case "multi": {
      const options = question.options.map((option) => option.trim());
      if (options.length < 2) problems.push(`${name} needs at least two choices.`);
      if (options.some((option) => !option)) problems.push(`${name} has an empty choice.`);
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
        problems.push(`${name} has the same choice twice.`);
      }
      if (question.kind === "single") {
        if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= options.length) {
          problems.push(`${name} needs its correct choice marked.`);
        }
      } else if (question.answer.length === 0) {
        problems.push(`${name} needs at least one correct choice marked.`);
      } else if (question.answer.some((choice) => choice < 0 || choice >= options.length)) {
        problems.push(`${name} marks a choice that no longer exists as correct.`);
      }
      break;
    }
    case "matching": {
      if (question.pairs.length < 2) problems.push(`${name} needs at least two pairs to match.`);
      if (question.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) {
        problems.push(`${name} has a pair with an empty side.`);
      }
      const rights = [...question.pairs.map((pair) => pair.right), ...(question.distractors ?? [])].map((text) =>
        text.trim().toLowerCase(),
      );
      // Two identical choices on the right would make one of them marked wrong for no reason.
      if (rights.every(Boolean) && new Set(rights).size !== rights.length) {
        problems.push(`${name} has the same choice twice on the right-hand side.`);
      }
      break;
    }
    case "short":
      if (!isManuallyMarked(question) && question.accept.every((phrase) => !phrase.trim())) {
        problems.push(`${name} is marked automatically, so it needs at least one accepted answer.`);
      }
      break;
    case "boolean":
      break;
  }
  return problems;
}

/** Why this quiz cannot be published. Empty when it can. A draft is saved whatever this says. */
export function quizProblems(quiz: Quiz): string[] {
  const problems: string[] = [];
  if (!quiz.title.trim()) problems.push("Give the quiz a title.");
  if (Number.isNaN(Date.parse(quiz.due))) problems.push("Set a due date.");
  if (!Number.isFinite(quiz.passMark) || quiz.passMark < 0 || quiz.passMark > 100) {
    problems.push("The pass mark must be from 0 to 100 percent.");
  }
  if (!Number.isFinite(quiz.weight) || quiz.weight < 0 || quiz.weight > 100) {
    problems.push("The share of the course grade must be from 0 to 100 percent.");
  }
  if (!Number.isInteger(quiz.minutes) || quiz.minutes < 1) problems.push("The estimated time must be at least 1 minute.");
  if (quiz.timeLimitMinutes !== undefined && (!Number.isInteger(quiz.timeLimitMinutes) || quiz.timeLimitMinutes < 1)) {
    problems.push("The time limit must be a whole number of minutes, at least 1.");
  }
  if (quiz.maxAttempts !== undefined && (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1)) {
    problems.push("The number of attempts must be a whole number, at least 1.");
  }
  if (quiz.questions.length === 0) problems.push("Add at least one question.");
  quiz.questions.forEach((question, index) => problems.push(...questionProblems(question, `Question ${index + 1}`)));
  return problems;
}

// --- Attempts and time limits (FR-3.7, US-13) -------------------------------------

/** How many attempts count against the limit: every one handed in, marked or not. */
export function attemptsUsed(quizId: string, attempts: QuizAttempt[]) {
  return attempts.filter((attempt) => attempt.quizId === quizId).length;
}

export type StartDecision = { allowed: true } | { allowed: false; reason: string };

/** May the student begin a new attempt? */
export function startDecision(quiz: Quiz, used: number): StartDecision {
  if (quiz.status !== "published") return { allowed: false, reason: "This quiz is not open yet." };
  if (quiz.maxAttempts !== undefined && used >= quiz.maxAttempts) {
    return {
      allowed: false,
      reason: `You have used ${quiz.maxAttempts === 1 ? "your one attempt" : `all ${quiz.maxAttempts} attempts`} at this quiz.`,
    };
  }
  return { allowed: true };
}

/** The moment a timed attempt ends, in milliseconds, or `null` for an untimed quiz. */
export function deadlineOf(quiz: Pick<Quiz, "timeLimitMinutes">, startedAt: string): number | null {
  return quiz.timeLimitMinutes === undefined ? null : Date.parse(startedAt) + quiz.timeLimitMinutes * MINUTE_MS;
}

/** Milliseconds left in a timed attempt, never below 0, or `null` for an untimed quiz. */
export function remainingMs(quiz: Pick<Quiz, "timeLimitMinutes">, startedAt: string, nowMs: number): number | null {
  const deadline = deadlineOf(quiz, startedAt);
  return deadline === null ? null : Math.max(0, deadline - nowMs);
}

/** US-13: once the time limit is reached the attempt is handed in for the student. */
export function isTimeUp(quiz: Pick<Quiz, "timeLimitMinutes">, startedAt: string, nowMs: number) {
  return remainingMs(quiz, startedAt, nowMs) === 0;
}

/** "12:05", or "1:02:05" from an hour up. */
export function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const tail = `${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${tail}` : `${minutes}:${tail}`;
}

/** The moments, in milliseconds left, at which a screen reader is told the time (NFR-5). */
const ANNOUNCE_AT_MS = [10 * MINUTE_MS, 5 * MINUTE_MS, MINUTE_MS, 30_000];

/**
 * What to announce as the clock moves from `previousMs` left to `currentMs`
 * left: something only when a threshold is crossed, so a screen reader is not
 * interrupted every second.
 */
export function timerAnnouncement(previousMs: number, currentMs: number): string | null {
  if (currentMs <= 0) return previousMs > 0 ? "Time is up. Your answers are being handed in." : null;
  const crossed = ANNOUNCE_AT_MS.find((mark) => previousMs > mark && currentMs <= mark);
  if (crossed === undefined) return null;
  return crossed >= MINUTE_MS
    ? `${crossed / MINUTE_MS} ${crossed === MINUTE_MS ? "minute" : "minutes"} left.`
    : `${crossed / 1000} seconds left.`;
}

/** True in the last fifth of the time, or the last minute, when the timer changes colour. */
export function isRunningOut(quiz: Pick<Quiz, "timeLimitMinutes">, leftMs: number) {
  if (quiz.timeLimitMinutes === undefined) return false;
  return leftMs <= Math.max(MINUTE_MS, (quiz.timeLimitMinutes * MINUTE_MS) / 5);
}

// --- Marking (FR-3.6, US-12) -------------------------------------------------------

/**
 * The stored attempt for a set of answers. Objective questions are marked at
 * once; answers that need a teacher leave the attempt `awaiting-marking`, and
 * its score does not count until they are marked.
 */
export function buildAttempt(
  quiz: Quiz,
  answers: AnswerSheet,
  details: { id: string; startedAt?: string; submittedAt: string; autoSubmitted?: boolean },
  manual: Record<string, ManualMark> = {},
): QuizAttempt {
  const result = gradeQuiz(quiz, answers, manual);
  return {
    id: details.id,
    quizId: quiz.id,
    earned: result.earned,
    possible: result.possible,
    percent: result.percent,
    submittedAt: details.submittedAt,
    startedAt: details.startedAt,
    autoSubmitted: details.autoSubmitted || undefined,
    answers,
    manual: Object.keys(manual).length > 0 ? manual : undefined,
    status: result.pending > 0 ? "awaiting-marking" : "graded",
  };
}

/** True when the attempt's score is final. Attempts from before manual marking existed are always final. */
export function isFinal(attempt: QuizAttempt) {
  return attempt.status !== "awaiting-marking";
}

/** The ids of the answers in this attempt that still wait for a teacher. */
export function pendingQuestionIds(quiz: Quiz, attempt: QuizAttempt): string[] {
  if (!attempt.answers) return [];
  return gradeQuiz(quiz, attempt.answers, attempt.manual)
    .questions.filter((result) => result.status === "pending")
    .map((result) => result.questionId);
}

/**
 * US-12: a teacher's mark for one answer, posted back to the attempt. The
 * total is worked out again, and once nothing is pending the attempt is
 * final and counts in the gradebook.
 */
export function applyManualMark(
  quiz: Quiz,
  attempt: QuizAttempt,
  questionId: string,
  mark: ManualMark,
): { attempt: QuizAttempt } | { problems: string[] } {
  const question = quiz.questions.find((candidate) => candidate.id === questionId);
  if (!question || !isManuallyMarked(question)) return { problems: ["That question is not marked by hand."] };
  if (!attempt.answers) return { problems: ["This attempt has no saved answers to mark."] };
  if (!Number.isFinite(mark.points) || mark.points < 0 || mark.points > question.points) {
    return { problems: [`Enter a mark from 0 to ${question.points}.`] };
  }
  return {
    attempt: buildAttempt(
      quiz,
      attempt.answers,
      { id: attempt.id, startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, autoSubmitted: attempt.autoSubmitted },
      { ...attempt.manual, [questionId]: mark },
    ),
  };
}

// --- Copying (US-08) ----------------------------------------------------------------

/** A copy of a quiz for another course: new ids, so no attempt recorded against the original can attach to it. */
export function copyQuiz(quiz: Quiz, courseId: string, due: string, makeId: (prefix: string) => string): Quiz {
  return {
    ...quiz,
    id: makeId("quiz"),
    courseId,
    due,
    questions: quiz.questions.map((question) => ({ ...question, id: makeId("q") })),
  };
}
