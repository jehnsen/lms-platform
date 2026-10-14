"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge, Button, ButtonLink, Card, Meter, PageContainer } from "@/components/ui";
import { ForbiddenView } from "@/components/forbidden-view";
import { useCourse, useCourseReadOnly } from "@/lib/api/courses";
import { recordAttempt, useMyProgress } from "@/lib/api/progress";
import { useActor } from "@/lib/api/session";
import { now } from "@/lib/clock";
import { getQuiz, quizPoints } from "@/lib/data/quizzes";
import {
  gradeQuiz,
  isAnswered,
  letterGrade,
  type QuestionStatus,
  type QuizResult,
} from "@/lib/grading";
import { can } from "@/lib/domain/permissions";
import { attemptsFor, bestAttempt } from "@/lib/progress";
import type { Answer, AnswerSheet, Question } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Phase = "intro" | "taking" | "result";

const CHOICE_CLASS =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 text-sm transition-colors hover:border-line-strong has-checked:border-primary has-checked:bg-primary-soft";

export function QuizRunner({ quizId }: { quizId: string }) {
  const state = useMyProgress();
  const actor = useActor();
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<AnswerSheet>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const quiz = getQuiz(quizId);
  // FR-1.8: in an archived course the quiz and past results can be seen, but not retaken.
  const archived = useCourseReadOnly(quiz?.courseId);
  const courseAccess = useCourse(quiz?.courseId);
  if (!quiz) return null;
  // Only learners enrolled in the quiz's course may take it (FR-1.1).
  const enrolled = can(actor, archived ? "view" : "submit", { type: "quiz", courseId: quiz.courseId });
  if (actor && !enrolled) {
    return <ForbiddenView resource={`quiz:${quiz.id}`} what="this quiz" />;
  }
  const course = courseAccess.status === "ok" ? courseAccess.course : undefined;
  const attempts = attemptsFor(quiz.id, state.attempts);
  const best = bestAttempt(quiz.id, state.attempts);
  const unanswered = quiz.questions.filter((question) => !isAnswered(answers[question.id])).length;

  const start = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setConfirming(false);
    setPhase("taking");
  };

  const submit = () => {
    const graded = gradeQuiz(quiz, answers);
    const submittedAt = now();
    void recordAttempt(
      {
        id: `attempt-${submittedAt.getTime()}`,
        quizId: quiz.id,
        earned: graded.earned,
        possible: graded.possible,
        percent: graded.percent,
        submittedAt: submittedAt.toISOString(),
      },
      quiz.courseId,
    );
    setResult(graded);
    setPhase("result");
  };

  const setAnswer = (questionId: string, answer: Answer) => {
    setAnswers((previous) => ({ ...previous, [questionId]: answer }));
    setConfirming(false);
  };

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-6">
        {course ? (
          <ButtonLink variant="ghost" size="sm" href={`/courses/${course.id}`} className="-ml-3">
            <ArrowLeft aria-hidden className="size-4" />
            {course.title}
          </ButtonLink>
        ) : null}
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-balance">
          {quiz.title}
        </h1>
      </div>

      {phase === "intro" ? (
        <Card className="p-5 sm:p-6">
          <p className="text-ink-2">{quiz.description}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Fact label="Questions" value={quiz.questions.length} />
            <Fact label="Points" value={quizPoints(quiz)} />
            <Fact label="Time" value={`About ${quiz.minutes} min`} />
            <Fact label="To pass" value={`${quiz.passMark}%`} />
          </dl>
          {archived ? (
            <p className="mt-5 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
              This course was archived at the end of term, so the quiz is closed. Worth {quiz.weight}%
              of the course grade; your best score counts.
            </p>
          ) : (
            <p className="mt-5 text-sm text-ink-2">
              Graded automatically as soon as you submit. Worth {quiz.weight}% of the course grade ·
              due {formatDate(quiz.due)}. You can retake it; your best score counts.
            </p>
          )}

          {attempts.length > 0 ? (
            <div className="mt-5 rounded-lg bg-surface-2 p-4">
              <h2 className="text-sm font-semibold">Your attempts</h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {attempts.map((attempt, attemptIndex) => (
                  <li key={attempt.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-2">
                      Attempt {attemptIndex + 1} · {formatDate(attempt.submittedAt)}
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {attempt.id === best?.id ? <Badge tone="primary">Best</Badge> : null}
                      {attempt.earned}/{attempt.possible} · {attempt.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {archived ? (
            attempts.length === 0 ? (
              <p className="mt-5 text-sm text-ink-2">You did not take this quiz.</p>
            ) : null
          ) : (
            <div className="mt-6">
              <Button size="lg" onClick={start}>
                {attempts.length > 0 ? "Retake quiz" : "Start quiz"}
                <ArrowRight aria-hidden className="size-4" />
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      {phase === "taking" ? (
        <div>
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm text-ink-2">
              <span>
                Question {index + 1} of {quiz.questions.length}
              </span>
              <span>{quiz.questions.length - unanswered} answered</span>
            </div>
            <Meter
              value={((quiz.questions.length - unanswered) / quiz.questions.length) * 100}
              label="Questions answered"
            />
          </div>

          <Card className="p-5 sm:p-6">
            <QuestionField
              key={quiz.questions[index].id}
              name={`${quiz.id}-${quiz.questions[index].id}`}
              question={quiz.questions[index]}
              answer={answers[quiz.questions[index].id]}
              onAnswer={(answer) => setAnswer(quiz.questions[index].id, answer)}
            />
          </Card>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft aria-hidden className="size-4" />
              Previous
            </Button>

            <nav aria-label="Questions" className="flex gap-1.5">
              {quiz.questions.map((question, questionIndex) => {
                const answered = isAnswered(answers[question.id]);
                return (
                  <button
                    key={question.id}
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
              <Button onClick={() => (unanswered > 0 ? setConfirming(true) : submit())}>
                Submit quiz
              </Button>
            )}
          </div>

          {confirming ? (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-4 text-sm text-warn">
              <span>
                {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered and will
                score zero.
              </span>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                  Keep working
                </Button>
                <Button size="sm" onClick={submit}>
                  Submit anyway
                </Button>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "result" && result ? (
        <div className="flex flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="text-sm text-ink-2">Your score</div>
                <div className="text-5xl font-semibold tracking-tight">{result.percent}%</div>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.passed ? "good" : "bad"}>
                    {result.passed ? <CircleCheck aria-hidden className="size-3" /> : <CircleX aria-hidden className="size-3" />}
                    {result.passed ? "Passed" : "Below pass mark"}
                  </Badge>
                  <Badge>Grade {letterGrade(result.percent)}</Badge>
                  <Badge>Auto-graded</Badge>
                </div>
                <p className="text-ink-2">
                  {result.earned} of {result.possible} points · pass mark {quiz.passMark}%
                </p>
                {best && best.percent > result.percent ? (
                  <p className="text-ink-2">Your best score of {best.percent}% still counts.</p>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={start}>
                <RotateCcw aria-hidden className="size-4" />
                Retake
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
                              {graded.earned}/{graded.possible} pts
                            </span>
                          </div>
                          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_1fr]">
                            <dt className="text-ink-3">Your answer</dt>
                            <dd>{describeAnswer(question, answers[question.id]) ?? "No answer"}</dd>
                            {graded.status !== "correct" ? (
                              <>
                                <dt className="text-ink-3">Correct answer</dt>
                                <dd>{describeCorrect(question)}</dd>
                              </>
                            ) : null}
                          </dl>
                          <p className="mt-3 text-sm text-ink-2">{question.explanation}</p>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      ) : null}
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

const STATUS_META: Record<QuestionStatus, { label: string; className: string; icon: typeof CircleCheck }> = {
  correct: { label: "Correct", className: "text-good", icon: CircleCheck },
  partial: { label: "Partly correct", className: "text-warn", icon: CircleMinus },
  incorrect: { label: "Incorrect", className: "text-bad", icon: CircleX },
  unanswered: { label: "Not answered", className: "text-ink-3", icon: CircleMinus },
};

function StatusIcon({ status }: { status: QuestionStatus }) {
  const meta = STATUS_META[status];
  return <meta.icon aria-label={meta.label} className={cn("mt-0.5 size-5 shrink-0", meta.className)} />;
}

function describeAnswer(question: Question, answer: Answer | undefined) {
  if (!isAnswered(answer)) return undefined;
  switch (question.kind) {
    case "single":
      return typeof answer === "number" ? question.options[answer] : undefined;
    case "multi":
      return Array.isArray(answer)
        ? [...answer].sort((a, b) => a - b).map((choice) => question.options[choice]).join("; ")
        : undefined;
    case "boolean":
      return answer ? "True" : "False";
    case "short":
      return typeof answer === "string" ? answer : undefined;
  }
}

function describeCorrect(question: Question) {
  switch (question.kind) {
    case "single":
      return question.options[question.answer];
    case "multi":
      return question.answer.map((choice) => question.options[choice]).join("; ");
    case "boolean":
      return question.answer ? "True" : "False";
    case "short":
      return question.sample;
  }
}

function QuestionField({
  name,
  question,
  answer,
  onAnswer,
}: {
  name: string;
  question: Question;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
}) {
  const hint =
    question.kind === "multi"
      ? "Select all that apply. Partial credit is given."
      : question.kind === "short"
        ? "Type a short answer."
        : "Select one answer.";

  return (
    <fieldset>
      <legend className="text-lg font-medium text-pretty">{question.prompt}</legend>
      <p className="mt-1 text-sm text-ink-3">
        {hint} {question.points} {question.points === 1 ? "point" : "points"}.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {question.kind === "single"
          ? question.options.map((option, optionIndex) => (
              <label key={option} className={CHOICE_CLASS}>
                <input
                  type="radio"
                  name={name}
                  checked={answer === optionIndex}
                  onChange={() => onAnswer(optionIndex)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>{option}</span>
              </label>
            ))
          : null}

        {question.kind === "multi"
          ? question.options.map((option, optionIndex) => {
              const chosen = Array.isArray(answer) ? answer : [];
              const checked = chosen.includes(optionIndex);
              return (
                <label key={option} className={CHOICE_CLASS}>
                  <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={() =>
                      onAnswer(
                        checked
                          ? chosen.filter((choice) => choice !== optionIndex)
                          : [...chosen, optionIndex],
                      )
                    }
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>{option}</span>
                </label>
              );
            })
          : null}

        {question.kind === "boolean"
          ? [true, false].map((value) => (
              <label key={String(value)} className={CHOICE_CLASS}>
                <input
                  type="radio"
                  name={name}
                  checked={answer === value}
                  onChange={() => onAnswer(value)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>{value ? "True" : "False"}</span>
              </label>
            ))
          : null}

        {question.kind === "short" ? (
          <input
            type="text"
            name={name}
            aria-label="Your answer"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => onAnswer(event.target.value)}
            autoComplete="off"
            placeholder="Your answer"
            className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-ink-3 focus:border-primary"
          />
        ) : null}
      </div>
    </fieldset>
  );
}
