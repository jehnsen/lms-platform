"use client";

/**
 * Quizzes service (BR-11): the quiz catalogue and builder, the question bank,
 * attempts with autosave and time limits, and the grading queue.
 *
 * Backend seam: `GET /quizzes`, `GET|PUT|DELETE /quizzes/:id`, `POST /quizzes`,
 * `POST /quizzes/:id/attempts` (start), `PATCH /attempts/:id` (autosave),
 * `POST /attempts/:id/submit`, `GET /grading-queue`,
 * `PUT /attempts/:id/marks/:questionId`, `GET|POST|DELETE /question-bank`.
 *
 * MOCK limits a server must remove: quizzes reach the browser with their
 * answer keys and are marked there; the time limit is kept by the browser's
 * clock; and an attempt whose time ran out while the page was closed is only
 * handed in the next time the student opens the app.
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import {
  applyManualMark,
  attemptsUsed,
  buildAttempt,
  deadlineOf,
  isTimeUp,
  quizProblems,
  startDecision,
} from "@/lib/domain/quizzes";
import { can } from "@/lib/domain/permissions";
import { isManuallyMarked } from "@/lib/grading";
import type {
  AnswerSheet,
  BankQuestion,
  Course,
  ManualMark,
  Question,
  Quiz,
  QuizAttempt,
  QuizDraft,
  ShortAnswerQuestion,
  User,
} from "@/lib/types";
import { useRepository } from "./_repository";
import {
  coursesRepo,
  progressRepo,
  questionBankRepo,
  quizDraftsRepo,
  quizzesRepo,
  usersRepo,
} from "./_stores";
import { notify } from "./notifications";
import { EMPTY_PROGRESS } from "./progress";
import { authorize, getActor, recordAudit, useActor } from "./session";

/** Something the quiz rules do not allow, with every reason. */
export class QuizError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "QuizError";
  }
}

let idCounter = 0;

/** A new id for a quiz, question, attempt or bank entry. */
export function newQuizId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

const draftKey = (userId: string, quizId: string) => `${userId}:${quizId}`;
const NO_QUIZZES: Quiz[] = [];

function requireQuiz(quizId: string) {
  const quiz = quizzesRepo.get().find((candidate) => candidate.id === quizId);
  if (!quiz) throw new QuizError(["This quiz no longer exists."]);
  return quiz;
}

// --- Reading -----------------------------------------------------------------

/**
 * The quizzes the signed-in user has: published ones in a student's courses;
 * every quiz, drafts included, in the courses a teacher teaches; all of them
 * for an admin. Soonest due first.
 */
export function useQuizzes(): Quiz[] {
  const actor = useActor();
  const quizzes = useRepository(quizzesRepo);
  return useMemo(() => {
    if (!actor) return NO_QUIZZES;
    return quizzes
      .filter(
        (quiz) =>
          can(actor, "view", { type: "quiz", courseId: quiz.courseId }) &&
          (actor.role !== "student" || quiz.status === "published"),
      )
      .sort((a, b) => a.due.localeCompare(b.due));
  }, [actor, quizzes]);
}

export type QuizAccess =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      quiz: Quiz;
      course: Course | undefined;
      /** Faculty who teach the course, and admins. */
      staff: boolean;
      /** May change the quiz. False for admins and in an archived course. */
      canEdit: boolean;
      /** The unit of the course this quiz is attached to, if any. */
      unitId: string | undefined;
    };

/** One quiz, with why it cannot be shown when it cannot. */
export function useQuiz(quizId: string | undefined): QuizAccess {
  const actor = useActor();
  const quizzes = useRepository(quizzesRepo);
  const courses = useRepository(coursesRepo);
  return useMemo((): QuizAccess => {
    if (actor === undefined) return { status: "loading" };
    const quiz = quizzes.find((candidate) => candidate.id === quizId);
    if (!quiz) return { status: "missing" };
    if (!can(actor, "view", { type: "quiz", courseId: quiz.courseId })) return { status: "forbidden" };
    const staff = actor!.role !== "student";
    // A draft does not exist as far as a student is concerned.
    if (!staff && quiz.status !== "published") return { status: "missing" };
    const course = courses.find((candidate) => candidate.id === quiz.courseId);
    return {
      status: "ok",
      quiz,
      course,
      staff,
      canEdit: can(actor, "update", { type: "quiz", courseId: quiz.courseId }),
      unitId: course?.modules.find((unit) => unit.quizId === quiz.id)?.id,
    };
  }, [actor, quizzes, courses, quizId]);
}

/** True once any student has handed in an attempt, after which the questions can no longer change. */
export function useQuizHasAttempts(quizId: string | undefined): boolean {
  const progress = useRepository(progressRepo);
  return useMemo(
    () => Object.values(progress).some((learner) => learner.attempts.some((attempt) => attempt.quizId === quizId)),
    [progress, quizId],
  );
}

function hasAttempts(quizId: string) {
  return Object.values(progressRepo.get()).some((learner) => learner.attempts.some((attempt) => attempt.quizId === quizId));
}

// --- Taking a quiz (US-13, FR-3.7) ---------------------------------------------

/** The signed-in student's attempts in progress, by quiz id. */
export function useMyDrafts(): Record<string, QuizDraft> {
  const actor = useActor();
  const drafts = useRepository(quizDraftsRepo);
  return useMemo(() => {
    const mine: Record<string, QuizDraft> = {};
    if (!actor) return mine;
    for (const draft of Object.values(drafts)) {
      if (draft.userId === actor.id) mine[draft.quizId] = draft;
    }
    return mine;
  }, [actor, drafts]);
}

/**
 * Begins an attempt, or returns the one already in progress so it can be
 * resumed. For a timed quiz the clock starts now and keeps running whether or
 * not the page stays open.
 */
export async function startAttempt(quizId: string): Promise<QuizDraft> {
  const quiz = requireQuiz(quizId);
  const actor = authorize("submit", { type: "quiz", courseId: quiz.courseId });
  const key = draftKey(actor.id, quizId);
  const existing = quizDraftsRepo.get()[key];
  if (existing) return existing;

  const used = attemptsUsed(quizId, (progressRepo.get()[actor.id] ?? EMPTY_PROGRESS).attempts);
  const decision = startDecision(quiz, used);
  if (!decision.allowed) throw new QuizError([decision.reason]);

  const startedAt = nowIso();
  const draft: QuizDraft = { quizId, userId: actor.id, startedAt, answers: {}, savedAt: startedAt };
  quizDraftsRepo.update((drafts) => ({ ...drafts, [key]: draft }));
  recordAudit({ action: "quiz.start", resource: `quiz:${quizId}`, outcome: "allowed", detail: quiz.title });
  return draft;
}

/** US-13: answers autosave. Called on every change; refused once the time is up. */
export async function saveDraftAnswers(quizId: string, answers: AnswerSheet): Promise<void> {
  const quiz = requireQuiz(quizId);
  const actor = authorize("submit", { type: "quiz", courseId: quiz.courseId });
  const key = draftKey(actor.id, quizId);
  const draft = quizDraftsRepo.get()[key];
  if (!draft) throw new QuizError(["Start the quiz before answering."]);
  const savedAt = nowIso();
  if (isTimeUp(quiz, draft.startedAt, Date.parse(savedAt))) {
    throw new QuizError(["Time is up. Answers can no longer be changed."]);
  }
  quizDraftsRepo.update((drafts) => ({ ...drafts, [key]: { ...draft, answers, savedAt } }));
}

function finishAttempt(quiz: Quiz, draft: QuizDraft, auto: boolean): QuizAttempt {
  const now = nowIso();
  const deadline = deadlineOf(quiz, draft.startedAt);
  const late = deadline !== null && Date.parse(now) >= deadline;
  const attempt = buildAttempt(quiz, draft.answers, {
    id: newQuizId("attempt"),
    startedAt: draft.startedAt,
    // An attempt cannot be handed in after its time limit: it is stamped at the limit.
    submittedAt: late ? new Date(deadline).toISOString() : now,
    autoSubmitted: auto || late,
  });
  progressRepo.update((all) => {
    const current = all[draft.userId] ?? EMPTY_PROGRESS;
    return { ...all, [draft.userId]: { ...current, attempts: [...current.attempts, attempt] } };
  });
  quizDraftsRepo.update((drafts) => {
    const next = { ...drafts };
    delete next[draftKey(draft.userId, quiz.id)];
    return next;
  });
  recordAudit({
    action: "quiz.submit",
    resource: `quiz:${quiz.id}`,
    outcome: "allowed",
    detail: `${quiz.title}${attempt.autoSubmitted ? ", submitted automatically at the time limit" : ""}${attempt.status === "awaiting-marking" ? ", awaiting marking" : `, ${attempt.percent}%`}`,
  });
  return attempt;
}

/**
 * Hands in the attempt in progress with the answers saved so far. Objective
 * questions are marked at once; answers a teacher must mark go to the grading
 * queue (US-12). `auto` records that the system handed it in at the time limit.
 */
export async function submitAttempt(quizId: string, options: { auto?: boolean } = {}): Promise<QuizAttempt> {
  const quiz = requireQuiz(quizId);
  const actor = authorize("submit", { type: "quiz", courseId: quiz.courseId });
  const draft = quizDraftsRepo.get()[draftKey(actor.id, quizId)];
  if (!draft) throw new QuizError(["There is no attempt in progress to hand in."]);
  return finishAttempt(quiz, draft, options.auto ?? false);
}

/**
 * MOCK stand-in for the server's deadline: hands in every attempt of the
 * signed-in student whose time ran out while the quiz was not open. Returns
 * the quizzes it handed in.
 */
export async function settleExpiredAttempts(): Promise<Quiz[]> {
  const actor = getActor();
  if (!actor) return [];
  const now = Date.now();
  const settled: Quiz[] = [];
  for (const draft of Object.values(quizDraftsRepo.get())) {
    if (draft.userId !== actor.id) continue;
    const quiz = quizzesRepo.get().find((candidate) => candidate.id === draft.quizId);
    if (!quiz || !isTimeUp(quiz, draft.startedAt, now)) continue;
    finishAttempt(quiz, draft, true);
    settled.push(quiz);
  }
  return settled;
}

// --- Building (US-12, FR-3.5) ---------------------------------------------------

/**
 * Saves a quiz, new or existing. A draft is saved as it is; to publish, or to
 * change a published quiz, it must pass every check. `unitId` attaches the
 * quiz to a unit of its course (`null` detaches it; leave it out to keep the
 * attachment as it is). Returns the quiz's id.
 */
export async function saveQuiz(quiz: Quiz, options: { publish: boolean; unitId?: string | null }): Promise<string> {
  const existing = quizzesRepo.get().find((candidate) => candidate.id === quiz.id);
  const courseId = existing?.courseId ?? quiz.courseId;
  if (existing) authorize("update", { type: "quiz", courseId });
  else authorize("create", { type: "quiz", courseId });

  const published = existing?.status === "published" || options.publish;
  const next: Quiz = { ...quiz, courseId, title: quiz.title.trim(), status: published ? "published" : "draft" };

  const problems: string[] = [];
  if (!next.title) problems.push("Give the quiz a title.");
  if (published) problems.push(...quizProblems(next).filter((problem) => !problems.includes(problem)));
  if (existing && hasAttempts(existing.id) && JSON.stringify(existing.questions) !== JSON.stringify(next.questions)) {
    problems.push("Students have taken this quiz, so its questions can no longer be changed.");
  }
  const course = coursesRepo.get().find((candidate) => candidate.id === courseId);
  if (options.unitId) {
    const unit = course?.modules.find((candidate) => candidate.id === options.unitId);
    if (!unit) problems.push("The unit to attach the quiz to no longer exists.");
    else if (unit.quizId && unit.quizId !== next.id) problems.push(`"${unit.title}" already has a quiz. A unit can have one.`);
  }
  if (problems.length > 0) throw new QuizError(problems);

  quizzesRepo.update((quizzes) =>
    existing ? quizzes.map((candidate) => (candidate.id === next.id ? next : candidate)) : [...quizzes, next],
  );
  if (options.unitId !== undefined && course) {
    authorize("update", { type: "course", courseId });
    coursesRepo.update((courses) =>
      courses.map((candidate) =>
        candidate.id !== courseId
          ? candidate
          : {
              ...candidate,
              modules: candidate.modules.map((unit) =>
                unit.id === options.unitId
                  ? { ...unit, quizId: next.id }
                  : unit.quizId === next.id
                    ? { ...unit, quizId: undefined }
                    : unit,
              ),
            },
      ),
    );
  }
  recordAudit({
    action: !existing ? "quiz.create" : options.publish && existing.status !== "published" ? "quiz.publish" : "quiz.update",
    resource: `quiz:${next.id}`,
    outcome: "allowed",
    detail: next.title,
  });
  return next.id;
}

/** Removes a quiz nobody has taken, and detaches it from its unit. */
export async function deleteQuiz(quizId: string): Promise<void> {
  const quiz = quizzesRepo.get().find((candidate) => candidate.id === quizId);
  if (!quiz) return;
  authorize("delete", { type: "quiz", courseId: quiz.courseId });
  if (hasAttempts(quizId)) throw new QuizError(["Students have taken this quiz, so it cannot be deleted."]);
  quizzesRepo.update((quizzes) => quizzes.filter((candidate) => candidate.id !== quizId));
  coursesRepo.update((courses) =>
    courses.map((course) =>
      course.modules.some((unit) => unit.quizId === quizId)
        ? { ...course, modules: course.modules.map((unit) => (unit.quizId === quizId ? { ...unit, quizId: undefined } : unit)) }
        : course,
    ),
  );
  recordAudit({ action: "quiz.delete", resource: `quiz:${quizId}`, outcome: "allowed", detail: quiz.title });
}

// --- Question bank (FR-3.5) -----------------------------------------------------

/** The shared question bank, newest first. Empty unless the signed-in user may use it. */
export function useQuestionBank(): BankQuestion[] {
  const actor = useActor();
  const bank = useRepository(questionBankRepo);
  return useMemo(() => {
    if (!can(actor, "view", { type: "question-bank" })) return [];
    return [...bank].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [actor, bank]);
}

/** Saves a copy of a question to the bank for any teacher to reuse. */
export async function addToBank(courseId: string, question: Question): Promise<void> {
  const actor = authorize("create", { type: "question-bank" });
  const id = newQuizId("bank");
  questionBankRepo.update((bank) => [
    ...bank,
    { id, courseId, addedById: actor.id, addedAt: nowIso(), question: { ...question, id } },
  ]);
}

export async function removeFromBank(bankId: string): Promise<void> {
  const entry = questionBankRepo.get().find((candidate) => candidate.id === bankId);
  if (!entry) return;
  authorize("delete", { type: "question-bank", ownerId: entry.addedById });
  questionBankRepo.update((bank) => bank.filter((candidate) => candidate.id !== bankId));
}

// --- Grading queue (US-12, FR-3.6) ----------------------------------------------

export interface QueueItem {
  /** Unique per answer: student, attempt and question. */
  key: string;
  quiz: Quiz;
  question: ShortAnswerQuestion;
  student: User;
  attempt: QuizAttempt;
  answer: string;
  /** Present once a teacher has marked it. */
  mark?: ManualMark;
}

/**
 * Every answer that needs, or has had, a teacher's mark in the courses the
 * signed-in user may mark. `null` for anyone else. Oldest first, so the queue
 * is worked in order.
 */
export function useGradingQueue(): { pending: QueueItem[]; marked: QueueItem[] } | null {
  const actor = useActor();
  const quizzes = useRepository(quizzesRepo);
  const progress = useRepository(progressRepo);
  const users = useRepository(usersRepo);

  return useMemo(() => {
    if (!actor || !actor.courseIds.some((courseId) => can(actor, "update", { type: "gradebook", courseId }))) return null;
    const mine = quizzes.filter((quiz) => can(actor, "update", { type: "gradebook", courseId: quiz.courseId }));
    const items: QueueItem[] = [];
    for (const [studentId, learner] of Object.entries(progress)) {
      const student = users.find((user) => user.id === studentId);
      if (!student) continue;
      for (const attempt of learner.attempts) {
        const quiz = mine.find((candidate) => candidate.id === attempt.quizId);
        if (!quiz || !attempt.answers) continue;
        for (const question of quiz.questions) {
          if (question.kind !== "short" || !isManuallyMarked(question)) continue;
          const answer = attempt.answers[question.id];
          if (typeof answer !== "string" || !answer.trim()) continue;
          items.push({
            key: `${studentId}|${attempt.id}|${question.id}`,
            quiz,
            question,
            student,
            attempt,
            answer,
            mark: attempt.manual?.[question.id],
          });
        }
      }
    }
    items.sort((a, b) => a.attempt.submittedAt.localeCompare(b.attempt.submittedAt));
    return {
      pending: items.filter((item) => !item.mark),
      marked: items.filter((item) => item.mark).reverse(),
    };
  }, [actor, quizzes, progress, users]);
}

/**
 * US-12: marks one answer. The attempt's total is worked out again; once no
 * answer is left waiting, the score is final, counts in the gradebook, and the
 * student is told.
 */
export async function markAnswer(
  studentId: string,
  attemptId: string,
  questionId: string,
  points: number,
  feedback: string,
): Promise<void> {
  const attempt = (progressRepo.get()[studentId] ?? EMPTY_PROGRESS).attempts.find((candidate) => candidate.id === attemptId);
  if (!attempt) throw new QuizError(["This attempt no longer exists."]);
  const quiz = requireQuiz(attempt.quizId);
  const actor = authorize("update", { type: "gradebook", courseId: quiz.courseId });

  const result = applyManualMark(quiz, attempt, questionId, {
    points,
    feedback: feedback.trim() || undefined,
    markedById: actor.id,
    markedAt: nowIso(),
  });
  if ("problems" in result) throw new QuizError(result.problems);

  progressRepo.update((all) => ({
    ...all,
    [studentId]: {
      ...all[studentId],
      attempts: all[studentId].attempts.map((candidate) => (candidate.id === attemptId ? result.attempt : candidate)),
    },
  }));
  recordAudit({
    action: "quiz.mark",
    resource: `attempt:${attemptId}`,
    outcome: "allowed",
    detail: `${quiz.title}: ${points} of ${quiz.questions.find((question) => question.id === questionId)?.points ?? "?"}`,
  });
  if (attempt.status === "awaiting-marking" && result.attempt.status === "graded") {
    notify({
      userId: studentId,
      category: "grades",
      title: `Quiz marked: ${result.attempt.percent}%`,
      body: `Your teacher has finished marking ${quiz.title}.`,
      href: `/quizzes/${quiz.id}`,
    });
  }
}
