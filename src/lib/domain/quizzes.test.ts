import { describe, expect, it } from "vitest";
import {
  applyManualMark,
  attemptsUsed,
  blankQuestion,
  buildAttempt,
  copyQuiz,
  deadlineOf,
  formatCountdown,
  isFinal,
  isRunningOut,
  isTimeUp,
  pendingQuestionIds,
  quizProblems,
  remainingMs,
  startDecision,
  timerAnnouncement,
} from "@/lib/domain/quizzes";
import {
  gradeQuestion,
  gradeQuiz,
  isAnswered,
  isManuallyMarked,
  matchingChoices,
  matchingOrder,
  quizPoints,
} from "@/lib/grading";
import type { ManualMark, MatchingQuestion, Question, Quiz, ShortAnswerQuestion } from "@/lib/types";

const single: Question = { id: "q1", kind: "single", prompt: "2 + 2?", points: 2, explanation: "", options: ["3", "4", "5"], answer: 1 };
const multi: Question = { id: "q2", kind: "multi", prompt: "Even numbers?", points: 3, explanation: "", options: ["2", "3", "4", "6"], answer: [0, 2, 3] };
const bool: Question = { id: "q3", kind: "boolean", prompt: "The sky is green.", points: 1, explanation: "", answer: false };
const matching: MatchingQuestion = {
  id: "q4",
  kind: "matching",
  prompt: "Match each term to its meaning.",
  points: 4,
  explanation: "",
  pairs: [
    { left: "Regression", right: "Predicts a number" },
    { left: "Classification", right: "Predicts a category" },
    { left: "Clustering", right: "Groups without labels" },
    { left: "Overfitting", right: "Memorises the training data" },
  ],
  distractors: ["Sorts a list"],
};
const autoShort: ShortAnswerQuestion = { id: "q5", kind: "short", prompt: "Name the numbers a model adjusts.", points: 2, explanation: "", accept: ["parameter", "weight"], sample: "Parameters." };
const manualShort: ShortAnswerQuestion = { id: "q6", kind: "short", marking: "manual", prompt: "Explain overfitting in a sentence.", points: 4, explanation: "", accept: [], sample: "It fits noise." };

const quiz: Quiz = {
  id: "quiz-1",
  courseId: "math",
  title: "Unit 1 quiz",
  description: "",
  minutes: 10,
  passMark: 70,
  due: "2026-10-20",
  questions: [single, multi, bool, matching, autoShort, manualShort],
  timeLimitMinutes: 20,
  status: "published",
};

const perfect = { q1: 1, q2: [0, 2, 3], q3: false, q4: [0, 1, 2, 3], q5: "They are the parameters", q6: "It memorises noise." };
const mark = (points: number): ManualMark => ({ points, markedById: "f1", markedAt: "2026-10-16T09:00:00.000Z" });
const STARTED = "2026-10-15T09:00:00.000Z";
const at = (iso: string) => Date.parse(iso);

describe("US-12: multiple choice, true/false and matching questions are auto-scored", () => {
  it("scores multiple choice and true/false", () => {
    expect(gradeQuestion(single, 1)).toMatchObject({ earned: 2, status: "correct" });
    expect(gradeQuestion(single, 0)).toMatchObject({ earned: 0, status: "incorrect" });
    expect(gradeQuestion(bool, false)).toMatchObject({ earned: 1, status: "correct" });
    expect(gradeQuestion(bool, true)).toMatchObject({ earned: 0, status: "incorrect" });
  });

  it("gives part marks for multiple answers and takes off for wrong ones", () => {
    expect(gradeQuestion(multi, [0, 2, 3])).toMatchObject({ earned: 3, status: "correct" });
    expect(gradeQuestion(multi, [0, 2])).toMatchObject({ earned: 2, status: "partial" });
    expect(gradeQuestion(multi, [0, 1])).toMatchObject({ earned: 0, status: "incorrect" });
  });

  it("scores a matching question with every pair right", () => {
    expect(gradeQuestion(matching, [0, 1, 2, 3])).toEqual({ questionId: "q4", possible: 4, earned: 4, status: "correct" });
  });

  it("gives part marks for the pairs that are right", () => {
    expect(gradeQuestion(matching, [0, 1, 3, 2])).toMatchObject({ earned: 2, status: "partial" });
    expect(gradeQuestion(matching, [0, -1, -1, -1])).toMatchObject({ earned: 1, status: "partial" });
  });

  it("gives nothing for a distractor or a wrong match", () => {
    expect(gradeQuestion(matching, [4, 0, 1, 2])).toMatchObject({ earned: 0, status: "incorrect" });
  });

  it("treats a matching question with nothing matched as unanswered", () => {
    expect(isAnswered([-1, -1, -1, -1])).toBe(false);
    expect(isAnswered([-1, 2, -1, -1])).toBe(true);
    expect(gradeQuestion(matching, [-1, -1, -1, -1])).toMatchObject({ earned: 0, status: "unanswered" });
    expect(gradeQuestion(matching, undefined)).toMatchObject({ status: "unanswered" });
  });

  it("offers every match and distractor once, in an order that does not give the answer away", () => {
    const order = matchingOrder(matching);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    expect(order).not.toEqual([0, 1, 2, 3, 4]);
    expect(matchingOrder(matching)).toEqual(order);
    expect(matchingChoices(matching)).toHaveLength(5);
    const two: MatchingQuestion = { ...matching, id: "q9", pairs: matching.pairs.slice(0, 2), distractors: undefined };
    expect(matchingOrder(two)).toEqual([1, 0]);
  });

  it("still marks keyword short answers automatically when the question is set that way", () => {
    expect(isManuallyMarked(autoShort)).toBe(false);
    expect(gradeQuestion(autoShort, "the WEIGHTS")).toMatchObject({ earned: 2, status: "correct" });
    expect(gradeQuestion(autoShort, "the bias")).toMatchObject({ earned: 0, status: "incorrect" });
  });
});

describe("US-12: questions needing manual marking go to a queue, and final scores post to the gradebook", () => {
  it("leaves a manually marked answer pending and the attempt awaiting marking", () => {
    const result = gradeQuiz(quiz, perfect);
    expect(result.questions[5]).toMatchObject({ status: "pending", earned: 0 });
    expect(result).toMatchObject({ earned: 12, possible: 16, pending: 1, passed: false });

    const attempt = buildAttempt(quiz, perfect, { id: "a1", startedAt: STARTED, submittedAt: "2026-10-15T09:12:00.000Z" });
    expect(attempt).toMatchObject({ status: "awaiting-marking", earned: 12, possible: 16 });
    expect(isFinal(attempt)).toBe(false);
    expect(pendingQuestionIds(quiz, attempt)).toEqual(["q6"]);
  });

  it("does not queue a manual question the student left blank", () => {
    const attempt = buildAttempt(quiz, { ...perfect, q6: "  " }, { id: "a1", submittedAt: "2026-10-15T09:12:00.000Z" });
    expect(attempt.status).toBe("graded");
    expect(pendingQuestionIds(quiz, attempt)).toEqual([]);
  });

  it("posts the teacher's mark back: the total is reworked and the attempt becomes final", () => {
    const attempt = buildAttempt(quiz, perfect, { id: "a1", startedAt: STARTED, submittedAt: "2026-10-15T09:12:00.000Z" });
    const marked = applyManualMark(quiz, attempt, "q6", mark(3));
    expect(marked).toMatchObject({
      attempt: { id: "a1", status: "graded", earned: 15, possible: 16, percent: 94, submittedAt: "2026-10-15T09:12:00.000Z" },
    });
    if ("attempt" in marked) {
      expect(isFinal(marked.attempt)).toBe(true);
      expect(gradeQuiz(quiz, perfect, marked.attempt.manual).questions[5]).toMatchObject({ earned: 3, status: "partial" });
    }
  });

  it("lets a mark be changed afterwards", () => {
    const attempt = buildAttempt(quiz, perfect, { id: "a1", submittedAt: "2026-10-15T09:12:00.000Z" }, { q6: mark(1) });
    expect(attempt.earned).toBe(13);
    expect(applyManualMark(quiz, attempt, "q6", mark(4))).toMatchObject({ attempt: { earned: 16, percent: 100 } });
  });

  it("refuses a mark outside the question's points, or for a question marked automatically", () => {
    const attempt = buildAttempt(quiz, perfect, { id: "a1", submittedAt: "2026-10-15T09:12:00.000Z" });
    expect(applyManualMark(quiz, attempt, "q6", mark(5))).toEqual({ problems: ["Enter a mark from 0 to 4."] });
    expect(applyManualMark(quiz, attempt, "q6", mark(-1))).toEqual({ problems: ["Enter a mark from 0 to 4."] });
    expect(applyManualMark(quiz, attempt, "q1", mark(1))).toEqual({ problems: ["That question is not marked by hand."] });
  });

  it("treats attempts saved before manual marking existed as final", () => {
    expect(isFinal({ id: "old", quizId: "quiz-1", earned: 8, possible: 10, percent: 80, submittedAt: STARTED })).toBe(true);
  });
});

describe("US-13: a timed attempt is submitted automatically when the time limit is reached", () => {
  it("counts down from the moment the attempt started", () => {
    expect(deadlineOf(quiz, STARTED)).toBe(at("2026-10-15T09:20:00.000Z"));
    expect(remainingMs(quiz, STARTED, at("2026-10-15T09:00:00.000Z"))).toBe(20 * 60_000);
    expect(remainingMs(quiz, STARTED, at("2026-10-15T09:19:30.000Z"))).toBe(30_000);
  });

  it("keeps counting while the page is closed: the limit belongs to the attempt, not the tab", () => {
    expect(remainingMs(quiz, STARTED, at("2026-10-15T09:07:00.000Z"))).toBe(13 * 60_000);
  });

  it("is up exactly at the limit and stays up afterwards", () => {
    expect(isTimeUp(quiz, STARTED, at("2026-10-15T09:19:59.000Z"))).toBe(false);
    expect(isTimeUp(quiz, STARTED, at("2026-10-15T09:20:00.000Z"))).toBe(true);
    expect(isTimeUp(quiz, STARTED, at("2026-10-16T09:00:00.000Z"))).toBe(true);
    expect(remainingMs(quiz, STARTED, at("2026-10-16T09:00:00.000Z"))).toBe(0);
  });

  it("never times out an untimed quiz", () => {
    const untimed = { ...quiz, timeLimitMinutes: undefined };
    expect(deadlineOf(untimed, STARTED)).toBeNull();
    expect(remainingMs(untimed, STARTED, at("2027-01-01T00:00:00.000Z"))).toBeNull();
    expect(isTimeUp(untimed, STARTED, at("2027-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("hands in whatever was saved, marked as submitted by the system", () => {
    const saved = { q1: 1, q4: [0, 1, -1, -1] };
    const attempt = buildAttempt(quiz, saved, { id: "a1", startedAt: STARTED, submittedAt: "2026-10-15T09:20:00.000Z", autoSubmitted: true });
    expect(attempt).toMatchObject({ autoSubmitted: true, earned: 4, possible: 16, status: "graded", answers: saved });
  });

  it("shows the time left as minutes and seconds", () => {
    expect(formatCountdown(20 * 60_000)).toBe("20:00");
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(500)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(62 * 60_000 + 5_000)).toBe("1:02:05");
  });

  it("announces the time to screen readers only when a threshold is crossed", () => {
    expect(timerAnnouncement(6 * 60_000, 5 * 60_000 + 1000)).toBeNull();
    expect(timerAnnouncement(5 * 60_000 + 1000, 5 * 60_000)).toBe("5 minutes left.");
    expect(timerAnnouncement(5 * 60_000, 5 * 60_000 - 1000)).toBeNull();
    expect(timerAnnouncement(61_000, 60_000)).toBe("1 minute left.");
    expect(timerAnnouncement(31_000, 30_000)).toBe("30 seconds left.");
    expect(timerAnnouncement(1000, 0)).toBe("Time is up. Your answers are being handed in.");
    expect(timerAnnouncement(0, 0)).toBeNull();
  });

  it("flags the last stretch so the timer can change colour", () => {
    expect(isRunningOut(quiz, 5 * 60_000)).toBe(false);
    expect(isRunningOut(quiz, 4 * 60_000)).toBe(true);
    expect(isRunningOut({ timeLimitMinutes: 2 }, 61_000)).toBe(false);
    expect(isRunningOut({ timeLimitMinutes: 2 }, 60_000)).toBe(true);
    expect(isRunningOut({ timeLimitMinutes: undefined }, 1000)).toBe(false);
  });
});

describe("attempt limits", () => {
  const attempts = [
    { id: "a1", quizId: "quiz-1", earned: 1, possible: 2, percent: 50, submittedAt: STARTED },
    { id: "a2", quizId: "quiz-1", earned: 1, possible: 2, percent: 50, submittedAt: STARTED, status: "awaiting-marking" as const },
    { id: "a3", quizId: "other", earned: 1, possible: 2, percent: 50, submittedAt: STARTED },
  ];

  it("counts every attempt handed in, marked or not", () => {
    expect(attemptsUsed("quiz-1", attempts)).toBe(2);
  });

  it("allows unlimited attempts unless the quiz sets a limit", () => {
    expect(startDecision(quiz, 12)).toEqual({ allowed: true });
    expect(startDecision({ ...quiz, maxAttempts: 2 }, 1)).toEqual({ allowed: true });
    expect(startDecision({ ...quiz, maxAttempts: 2 }, 2)).toMatchObject({ allowed: false });
    expect(startDecision({ ...quiz, maxAttempts: 1 }, 1)).toEqual({ allowed: false, reason: "You have used your one attempt at this quiz." });
  });

  it("does not open a draft quiz", () => {
    expect(startDecision({ ...quiz, status: "draft" }, 0)).toMatchObject({ allowed: false });
  });
});

describe("FR-3.5: a quiz is checked before it is published", () => {
  it("accepts a complete quiz with every kind of question", () => {
    expect(quizProblems(quiz)).toEqual([]);
    expect(quizPoints(quiz)).toBe(16);
  });

  it("needs a title, a due date and at least one question", () => {
    expect(quizProblems({ ...quiz, title: " ", due: "", questions: [] })).toEqual([
      "Give the quiz a title.",
      "Set a due date.",
      "Add at least one question.",
    ]);
  });

  it("checks the limits and percentages", () => {
    expect(quizProblems({ ...quiz, passMark: 120, minutes: 0, timeLimitMinutes: 0, maxAttempts: 1.5 })).toEqual([
      "The pass mark must be from 0 to 100 percent.",
      "The estimated time must be at least 1 minute.",
      "The time limit must be a whole number of minutes, at least 1.",
      "The number of attempts must be a whole number, at least 1.",
    ]);
  });

  it("checks each question by kind", () => {
    const broken: Quiz = {
      ...quiz,
      questions: [
        { ...single, prompt: "", options: ["4", "4"], answer: 5 },
        { ...(multi as Extract<Question, { kind: "multi" }>), answer: [] },
        { ...matching, pairs: [{ left: "A", right: "" }], distractors: undefined },
        { ...autoShort, accept: [" "] },
        { ...manualShort, points: 0 },
      ],
    };
    expect(quizProblems(broken)).toEqual([
      "Question 1 needs its question text.",
      "Question 1 has the same choice twice.",
      "Question 1 needs its correct choice marked.",
      "Question 2 needs at least one correct choice marked.",
      "Question 3 needs at least two pairs to match.",
      "Question 3 has a pair with an empty side.",
      "Question 4 is marked automatically, so it needs at least one accepted answer.",
      "Question 5 needs points greater than 0.",
    ]);
  });

  it("rejects two identical choices on the right of a matching question", () => {
    const twins = { ...matching, distractors: ["predicts a number"] };
    expect(quizProblems({ ...quiz, questions: [twins] })).toEqual([
      "Question 1 has the same choice twice on the right-hand side.",
    ]);
  });

  it("starts new questions empty, and new short answers as marked by a teacher", () => {
    expect(blankQuestion("matching", "n1")).toMatchObject({ kind: "matching", pairs: [{ left: "", right: "" }, { left: "", right: "" }] });
    expect(isManuallyMarked(blankQuestion("short", "n2"))).toBe(true);
    expect(quizProblems({ ...quiz, questions: [blankQuestion("single", "n3")] }).length).toBeGreaterThan(0);
  });
});

describe("US-08: quizzes are copied with a course, without student data", () => {
  it("gives the copy and every question a new id, so no attempt can attach to it", () => {
    let counter = 0;
    const copy = copyQuiz(quiz, "math-2", "2027-03-09", (prefix) => `${prefix}-new-${(counter += 1)}`);
    expect(copy).toMatchObject({ courseId: "math-2", due: "2027-03-09", title: quiz.title, timeLimitMinutes: 20, status: "published" });
    expect(copy.id).not.toBe(quiz.id);
    expect(copy.questions.map((question) => question.prompt)).toEqual(quiz.questions.map((question) => question.prompt));
    const originalIds = quiz.questions.map((question) => question.id);
    for (const question of copy.questions) expect(originalIds).not.toContain(question.id);
    expect(quiz.questions[0].id).toBe("q1");
  });
});
