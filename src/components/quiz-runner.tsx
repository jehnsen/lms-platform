"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock,
  EyeOff,
  Hourglass,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ForbiddenView } from "@/components/forbidden-view";
import { NotFoundView } from "@/components/not-found-view";
import { QuizPreview } from "@/components/quiz-preview";
import { QuestionField, StatusIcon, describeAnswer, describeCorrect } from "@/components/quiz-questions";
import { Badge, Breadcrumbs, Button, ButtonLink, Card, FactTile, Meter, PageContainer, PageSkeleton } from "@/components/ui";
import { useCourseReadOnly } from "@/lib/api/courses";
import { useCourseScale, useQuizGradesHeld } from "@/lib/api/grades";
import { useMyProgress } from "@/lib/api/progress";
import {
  QuizError,
  saveDraftAnswers,
  settleExpiredAttempts,
  startAttempt,
  submitAttempt,
  useMyDrafts,
  useQuiz,
} from "@/lib/api/quizzes";
import {
  attemptsUsed,
  formatCountdown,
  isFinal,
  isRunningOut,
  remainingMs,
  startDecision,
  timerAnnouncement,
} from "@/lib/domain/quizzes";
import { gradeBeside, gradeQuiz, isAnswered, isManuallyMarked, quizPoints } from "@/lib/grading";
import { attemptsFor, bestAttempt } from "@/lib/progress";
import type { Answer, AnswerSheet, Course, GradingScale, Quiz, QuizAttempt, QuizDraft } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

function messagesOf(error: unknown) {
  if (error instanceof QuizError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** `/quizzes/[quizId]`: a student takes the quiz; staff see its questions and answers. */
export function QuizRunner({ quizId }: { quizId: string }) {
  const access = useQuiz(quizId);
  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView message="This quiz doesn't exist, or it isn't open yet." />;
  // Only learners enrolled in the quiz's course may take it (FR-1.1).
  if (access.status === "forbidden") return <ForbiddenView resource={`quiz:${quizId}`} what="this quiz" />;
  if (access.staff) return <QuizPreview quiz={access.quiz} course={access.course} canEdit={access.canEdit} />;
  return <StudentQuiz quiz={access.quiz} course={access.course} />;
}

function StudentQuiz({ quiz, course }: { quiz: Quiz; course: Course | undefined }) {
  const state = useMyProgress();
  const draft = useMyDrafts()[quiz.id];
  // FR-1.8: in an archived course the quiz and past results can be seen, but not retaken.
  const archived = useCourseReadOnly(quiz.courseId);
  const scale = useCourseScale(quiz.courseId);
  const scoresHeld = useQuizGradesHeld(quiz.courseId, quiz.id);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [timedOut, setTimedOut] = useState(false);

  // An attempt whose time ran out while this page was closed is handed in as soon as it is opened again.
  useEffect(() => {
    void settleExpiredAttempts().then((settled) => {
      if (settled.some((candidate) => candidate.id === quiz.id)) setTimedOut(true);
    });
  }, [quiz.id]);

  const attempts = attemptsFor(quiz.id, state.attempts);
  const best = bestAttempt(quiz.id, state.attempts);
  const decision = startDecision(quiz, attemptsUsed(quiz.id, state.attempts));
  const review = reviewId === null ? undefined : attempts.find((attempt) => attempt.id === reviewId);

  const start = async () => {
    setBusy(true);
    setProblems([]);
    setReviewId(null);
    setTimedOut(false);
    try {
      await startAttempt(quiz.id);
    } catch (error) {
      setProblems(messagesOf(error));
    } finally {
      setBusy(false);
    }
  };

  const finish = (attempt: QuizAttempt) => {
    setTimedOut(attempt.autoSubmitted === true);
    setReviewId(attempt.id);
  };

  return (
    <PageContainer className="max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Quizzes", href: "/quizzes" },
          ...(course ? [{ label: course.title, href: `/courses/${course.id}` }] : []),
          { label: quiz.title },
        ]}
      />
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">
            <ListChecks aria-hidden className="size-3" />
            Graded quiz
          </Badge>
          {quiz.timeLimitMinutes ? (
            <Badge>
              <Clock aria-hidden className="size-3" />
              Timed
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
          {quiz.title}
        </h1>
        {quiz.description && !draft && !review ? (
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-2 text-pretty">{quiz.description}</p>
        ) : null}
      </div>

      {/* Always rendered, so the automatic submission is announced when it happens (NFR-5). */}
      <div role="alert">
        {timedOut && !draft ? (
          <p className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
            Time was up, so your answers were handed in automatically.
          </p>
        ) : null}
      </div>

      {draft ? (
        // Keyed by the attempt, so a new attempt starts from its own saved answers.
        <TakingView key={draft.startedAt} quiz={quiz} draft={draft} onFinished={finish} />
      ) : review?.status === "held" ? (
        // FR-4.3: the teacher is holding this quiz's scores, so there is nothing to show yet.
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Handed in</h2>
          <p className="mt-2 text-ink-2">
            Your answers were handed in on {formatDateTime(review.submittedAt)}
            {review.autoSubmitted ? ", at the time limit" : ""}. Your teacher has not released the scores for this
            quiz yet. You will be notified when they do.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setReviewId(null)}>
              All attempts
            </Button>
            <ButtonLink variant="secondary" href="/grades">
              View my grades
            </ButtonLink>
          </div>
        </Card>
      ) : review ? (
        <ResultView
          quiz={quiz}
          attempt={review}
          scale={scale}
          best={best}
          canRetake={decision.allowed && !archived}
          onRetake={() => void start()}
          onBack={() => setReviewId(null)}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="p-5 sm:p-7">
            <dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
              <FactTile icon={ListChecks} label="Questions" value={quiz.questions.length} />
              <FactTile icon={Award} label="Points" value={quizPoints(quiz)} />
              <FactTile
                icon={Clock}
                label={quiz.timeLimitMinutes ? "Time limit" : "Time"}
                value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : `About ${quiz.minutes} min`}
              />
              <FactTile icon={Target} label="To pass" value={`${quiz.passMark}%`} />
            </dl>

            {archived ? (
              <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
                This course was archived at the end of term, so the quiz is closed. It is worth{" "}
                {quizPoints(quiz)} points; your best score counts.
              </p>
            ) : (
              <ul className="mt-6 flex flex-col gap-3 text-sm text-ink-2">
                <Rule icon={CalendarDays}>
                  Worth {quizPoints(quiz)} points · due <span className="font-medium text-ink">{formatDate(quiz.due)}</span>.
                </Rule>
                <Rule icon={RotateCcw}>
                  {quiz.maxAttempts
                    ? `You have ${quiz.maxAttempts} ${quiz.maxAttempts === 1 ? "attempt" : "attempts"}; your best score counts.`
                    : "You can retake it; your best score counts."}
                </Rule>
                {quiz.timeLimitMinutes ? (
                  <li className="flex items-start gap-3 rounded-xl border border-warn/25 bg-warn-soft p-3 text-ink">
                    <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                    <span>
                      This quiz is timed. You have {quiz.timeLimitMinutes} minutes from the moment you start, and the
                      clock keeps running if you leave the page. Your answers are saved as you go and handed in
                      automatically when the time is up.
                    </span>
                  </li>
                ) : (
                  <Rule icon={Save}>Your answers are saved as you go, so you can leave and come back.</Rule>
                )}
                {scoresHeld ? (
                  <Rule icon={EyeOff}>
                    Your teacher releases the scores for this quiz, so you will not see yours straight away. You will
                    be notified when they are released.
                  </Rule>
                ) : quiz.questions.some(isManuallyMarked) ? (
                  <Rule icon={UserCheck}>
                    Some answers are marked by your teacher, so your final score arrives once they have marked them.
                  </Rule>
                ) : (
                  <Rule icon={Zap}>Marked automatically as soon as you hand in.</Rule>
                )}
              </ul>
            )}

            {attempts.length > 0 ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-line">
                <h2 className="border-b border-line bg-surface-2/70 px-4 py-2.5 text-sm font-semibold">Your attempts</h2>
                <ul className="divide-y divide-line text-sm">
                  {attempts.map((attempt, attemptIndex) => (
                    <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block font-medium">Attempt {attemptIndex + 1}</span>
                        <span className="block text-xs text-ink-3">
                          {formatDate(attempt.submittedAt)}
                          {attempt.autoSubmitted ? " · handed in at the time limit" : null}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 tabular-nums">
                        {attempt.id === best?.id ? (
                          <Badge tone="primary">
                            <Award aria-hidden className="size-3" />
                            Best
                          </Badge>
                        ) : null}
                        {isFinal(attempt) ? (
                          <span className="flex items-center gap-3">
                            <Meter
                              value={attempt.percent}
                              label={`Attempt ${attemptIndex + 1} score`}
                              className="hidden w-24 sm:block"
                            />
                            <span>
                              <span className="text-ink-2">
                                {attempt.earned}/{attempt.possible} ·{" "}
                              </span>
                              <span className="font-semibold">{attempt.percent}%</span>
                            </span>
                          </span>
                        ) : (
                          <Badge tone="warn">{attempt.status === "held" ? "Grade not released yet" : "Awaiting marking"}</Badge>
                        )}
                        {attempt.answers ? (
                          <Button variant="ghost" size="sm" onClick={() => setReviewId(attempt.id)}>
                            Review<span className="sr-only"> attempt {attemptIndex + 1}</span>
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : archived ? (
              <p className="mt-6 text-sm text-ink-2">You did not take this quiz.</p>
            ) : null}

            {problems.length > 0 ? (
              <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                {problems.join(" ")}
              </p>
            ) : null}
          </div>

          {archived ? null : decision.allowed ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-5 py-4 sm:px-7">
              <p className="text-sm text-ink-2">
                {attempts.length > 0 && best && isFinal(best)
                  ? `Your best so far is ${best.percent}%. Try to beat it.`
                  : `${quiz.questions.length} questions · ${quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min limit` : `about ${quiz.minutes} min`}`}
              </p>
              <Button size="lg" onClick={() => void start()} disabled={busy}>
                {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                {attempts.length > 0 ? "Retake quiz" : "Start quiz"}
                {busy ? null : <ArrowRight aria-hidden className="size-4" />}
              </Button>
            </div>
          ) : (
            <p className="border-t border-line px-5 py-4 text-sm text-ink-2 sm:px-7">{decision.reason}</p>
          )}
        </Card>
      )}
    </PageContainer>
  );
}

/** US-13: the attempt in progress, with an always-visible timer, autosave and automatic submission. */
function TakingView({ quiz, draft, onFinished }: { quiz: Quiz; draft: QuizDraft; onFinished: (attempt: QuizAttempt) => void }) {
  const [answers, setAnswers] = useState<AnswerSheet>(draft.answers);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  // The clock: read once a second while the page is showing. `null` until the first reading.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const handingIn = useRef(false);

  const timed = quiz.timeLimitMinutes !== undefined;
  const left = nowMs === null ? null : remainingMs(quiz, draft.startedAt, nowMs);
  const timeUp = left === 0;
  const unanswered = quiz.questions.filter((question) => !isAnswered(answers[question.id])).length;
  const question = quiz.questions[index];

  // This effect stops when the page is hidden and starts again when it is shown, so on return
  // the clock is read at once and an attempt that ran out meanwhile is handed in.
  useEffect(() => {
    if (!timed) return;
    let previous = remainingMs(quiz, draft.startedAt, Date.now()) ?? 0;
    const tick = () => {
      const now = Date.now();
      const current = remainingMs(quiz, draft.startedAt, now) ?? 0;
      const message = timerAnnouncement(previous, current);
      if (message) setAnnouncement(message);
      previous = current;
      setNowMs(now);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [timed, quiz, draft.startedAt]);

  const handIn = async (auto: boolean) => {
    if (handingIn.current) return;
    handingIn.current = true;
    setBusy(true);
    setProblems([]);
    try {
      onFinished(await submitAttempt(quiz.id, { auto }));
    } catch (error) {
      setProblems(messagesOf(error));
      handingIn.current = false;
      setBusy(false);
    }
  };

  // US-13: when the time limit is reached the attempt is handed in for the student.
  useEffect(() => {
    if (!timeUp) return;
    const timer = setTimeout(() => void handIn(true), 0);
    return () => clearTimeout(timer);
    // `handIn` guards itself against running twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  const setAnswer = (questionId: string, answer: Answer) => {
    const next = { ...answers, [questionId]: answer };
    setAnswers(next);
    setConfirming(false);
    // US-13: every change is saved, so nothing is lost on a reload or when the time runs out.
    saveDraftAnswers(quiz.id, next).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  };

  return (
    <div>
      {timed ? (
        <div
          className={cn(
            "sticky top-14 z-20 -mx-4 mb-4 flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:mx-0 sm:rounded-lg sm:border lg:top-0",
            left !== null && isRunningOut(quiz, left) ? "border-warn bg-warn-soft text-warn" : "border-line bg-surface",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock aria-hidden className="size-4" />
            Time left
          </span>
          {/* Not a live region: it changes every second. Thresholds are announced separately below. */}
          <span role="timer" aria-live="off" className="font-mono text-lg font-semibold tabular-nums">
            {left === null ? "--:--" : formatCountdown(left)}
          </span>
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm text-ink-2">
          <span>
            Question {index + 1} of {quiz.questions.length}
          </span>
          <span>{quiz.questions.length - unanswered} answered</span>
        </div>
        <Meter value={((quiz.questions.length - unanswered) / quiz.questions.length) * 100} label="Questions answered" />
      </div>

      <Card className="p-5 sm:p-6">
        <fieldset disabled={timeUp || busy} className="min-w-0">
          <legend className="sr-only">Question {index + 1}</legend>
          <QuestionField
            key={question.id}
            name={`${quiz.id}-${question.id}`}
            question={question}
            answer={answers[question.id]}
            onAnswer={(answer) => setAnswer(question.id, answer)}
          />
        </fieldset>
      </Card>

      <p className={cn("mt-2 text-xs", saveFailed ? "text-bad" : "text-ink-3")}>
        {saveFailed
          ? "Your last change could not be saved. Check that this browser has storage space."
          : "Your answers are saved as you go."}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <ArrowLeft aria-hidden className="size-4" />
          Previous
        </Button>

        <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
          {quiz.questions.map((item, questionIndex) => {
            const answered = isAnswered(answers[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(questionIndex)}
                aria-current={questionIndex === index ? "step" : undefined}
                aria-label={`Question ${questionIndex + 1}${answered ? ", answered" : ", not answered"}`}
                className={cn(
                  "grid size-8 place-items-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                  questionIndex === index
                    ? "border-primary bg-primary text-on-primary"
                    : answered
                      ? "border-primary-soft bg-primary-soft text-primary-ink"
                      : "border-line text-ink-2 hover:border-line-strong",
                )}
              >
                {questionIndex + 1}
              </button>
            );
          })}
        </nav>

        {index < quiz.questions.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)}>
            Next
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => (unanswered > 0 ? setConfirming(true) : void handIn(false))}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Submit quiz
          </Button>
        )}
      </div>

      {confirming ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-4 text-sm text-warn">
          <span>
            {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered and will score zero.
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handIn(false)}>
              Submit anyway
            </Button>
          </span>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {problems.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

/** One attempt after it is handed in: the score, or what is still waiting for a teacher, and each answer. */
function ResultView({
  quiz,
  attempt,
  scale,
  best,
  canRetake,
  onRetake,
  onBack,
}: {
  quiz: Quiz;
  attempt: QuizAttempt;
  /** The course's grading scale (FR-4.2). */
  scale: GradingScale;
  best: QuizAttempt | undefined;
  canRetake: boolean;
  onRetake: () => void;
  onBack: () => void;
}) {
  const answers = attempt.answers ?? {};
  const result = gradeQuiz(quiz, answers, attempt.manual);
  const final = result.pending === 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <div className="text-sm text-ink-2">{final ? "Your score" : "Score so far"}</div>
            <div className="text-5xl font-semibold tracking-tight">{result.percent}%</div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {final ? (
                <>
                  <Badge tone={result.passed ? "good" : "bad"}>
                    {result.passed ? <CircleCheck aria-hidden className="size-3" /> : <CircleX aria-hidden className="size-3" />}
                    {result.passed ? "Passed" : "Below pass mark"}
                  </Badge>
                  {gradeBeside(result.percent, scale) ? <Badge>{gradeBeside(result.percent, scale)}</Badge> : null}
                </>
              ) : (
                <Badge tone="warn">
                  <Hourglass aria-hidden className="size-3" />
                  {result.pending} {result.pending === 1 ? "answer" : "answers"} waiting for your teacher
                </Badge>
              )}
              {attempt.autoSubmitted ? <Badge>Handed in at the time limit</Badge> : null}
            </div>
            <p className="text-ink-2">
              {result.earned} of {result.possible} points · pass mark {quiz.passMark}% · handed in{" "}
              {formatDateTime(attempt.submittedAt)}
            </p>
            {final ? null : (
              <p className="text-ink-2">This score does not count yet. You will be notified when the marking is done.</p>
            )}
            {final && best && best.percent > result.percent ? (
              <p className="text-ink-2">Your best score of {best.percent}% still counts.</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {canRetake ? (
            <Button variant="secondary" onClick={onRetake}>
              <RotateCcw aria-hidden className="size-4" />
              Retake
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onBack}>
            All attempts
          </Button>
          <ButtonLink variant="secondary" href="/grades">
            View my grades
          </ButtonLink>
          <ButtonLink variant="spark" href="/tutor">
            <Sparkles aria-hidden className="size-4" />
            Review with the AI tutor
          </ButtonLink>
        </div>
      </Card>

      <section aria-label="Question review">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Review</h2>
        <ol className="flex flex-col gap-3">
          {quiz.questions.map((question, questionIndex) => {
            const graded = result.questions[questionIndex];
            const mark = attempt.manual?.[question.id];
            return (
              <li key={question.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <StatusIcon status={graded.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="font-medium text-pretty">
                          {questionIndex + 1}. {question.prompt}
                        </p>
                        <span className="shrink-0 text-sm text-ink-2 tabular-nums">
                          {graded.status === "pending" ? `Not marked yet · ${graded.possible} pts` : `${graded.earned}/${graded.possible} pts`}
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_1fr]">
                        <dt className="text-ink-3">Your answer</dt>
                        <dd className="whitespace-pre-wrap">{describeAnswer(question, answers[question.id]) ?? "No answer"}</dd>
                        {graded.status !== "correct" && graded.status !== "pending" ? (
                          <>
                            <dt className="text-ink-3">{isManuallyMarked(question) ? "Sample answer" : "Correct answer"}</dt>
                            <dd>{describeCorrect(question)}</dd>
                          </>
                        ) : null}
                        {mark?.feedback ? (
                          <>
                            <dt className="text-ink-3">Teacher&apos;s comment</dt>
                            <dd className="whitespace-pre-wrap">{mark.feedback}</dd>
                          </>
                        ) : null}
                      </dl>
                      {question.explanation && graded.status !== "pending" ? (
                        <p className="mt-3 text-sm text-ink-2">{question.explanation}</p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** One rule of the quiz, with an icon, in the list on the quiz's start page. */
function Rule({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
      <span>{children}</span>
    </li>
  );
}

