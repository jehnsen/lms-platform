"use client";

import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { describeCorrect } from "@/components/quiz-questions";
import { Badge, ButtonLink, Card, PageContainer } from "@/components/ui";
import { QUESTION_KIND_LABELS } from "@/lib/domain/quizzes";
import { isManuallyMarked, matchingChoices, quizPoints } from "@/lib/grading";
import type { Course, Quiz } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** A quiz as staff see it: its settings and every question with its answer. Students never get this view. */
export function QuizPreview({ quiz, course, canEdit }: { quiz: Quiz; course: Course | undefined; canEdit: boolean }) {
  const manual = quiz.questions.filter(isManuallyMarked).length;
  return (
    <PageContainer className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/quizzes" className="hover:text-ink">
          Quizzes
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">{quiz.title || "Untitled quiz"}</span>
      </nav>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
              {course ? (
                <Link href={`/courses/${course.id}`} className="hover:text-ink hover:underline">
                  {course.title}
                </Link>
              ) : null}
              {quiz.status === "draft" ? <Badge tone="warn">Draft · students cannot see it</Badge> : null}
            </div>
            <h1 className="mt-1 text-3xl leading-tight font-semibold tracking-tight text-balance">{quiz.title || "Untitled quiz"}</h1>
            {quiz.description ? <p className="mt-2 text-ink-2">{quiz.description}</p> : null}
          </div>
          {canEdit ? (
            <ButtonLink href={`/quizzes/${quiz.id}/edit`} variant="secondary">
              <Pencil aria-hidden className="size-4" />
              {quiz.status === "draft" ? "Edit and publish" : "Edit"}
            </ButtonLink>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Due" value={formatDate(quiz.due, true)} />
          <Fact label="Questions" value={quiz.questions.length} />
          <Fact label="Points" value={quizPoints(quiz)} />
          <Fact label="Time limit" value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "None"} />
          <Fact label="Attempts" value={quiz.maxAttempts ?? "Unlimited"} />
          <Fact label="Pass mark" value={`${quiz.passMark}%`} />
        </dl>
        {manual > 0 ? (
          <p className="mt-4 text-sm text-ink-2">
            {manual} {manual === 1 ? "question is" : "questions are"} marked by a teacher. Answers arrive in the{" "}
            <Link href="/grading" className="font-medium text-primary-ink hover:underline">
              grading queue
            </Link>
            , and a student&apos;s score counts once they are marked.
          </p>
        ) : null}
      </Card>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Questions and answers</h2>
        {quiz.questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">No questions yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {quiz.questions.map((question, index) => (
              <li key={question.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium text-pretty">
                      {index + 1}. {question.prompt}
                    </p>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-ink-2 tabular-nums">
                      <Badge>{QUESTION_KIND_LABELS[question.kind]}</Badge>
                      {isManuallyMarked(question) ? <Badge tone="warn">Marked by a teacher</Badge> : null}
                      {question.points} {question.points === 1 ? "pt" : "pts"}
                    </span>
                  </div>

                  {question.kind === "single" || question.kind === "multi" ? (
                    <ul className="mt-3 flex flex-col gap-1 text-sm">
                      {question.options.map((option, optionIndex) => {
                        const right = question.kind === "single" ? question.answer === optionIndex : question.answer.includes(optionIndex);
                        return (
                          <li key={option} className={right ? "font-medium text-good" : "text-ink-2"}>
                            {right ? "✓ " : "· "}
                            {option}
                            {right ? <span className="sr-only"> (correct)</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
                      <dt className="text-ink-3">{isManuallyMarked(question) ? "Sample answer" : "Correct answer"}</dt>
                      <dd>{describeCorrect(question) || "None given"}</dd>
                      {question.kind === "matching" && question.distractors?.length ? (
                        <>
                          <dt className="text-ink-3">Extra choices</dt>
                          <dd>{matchingChoices(question).slice(question.pairs.length).join("; ")}</dd>
                        </>
                      ) : null}
                      {question.kind === "short" && !isManuallyMarked(question) ? (
                        <>
                          <dt className="text-ink-3">Accepted</dt>
                          <dd>Any answer containing: {question.accept.join(", ")}</dd>
                        </>
                      ) : null}
                    </dl>
                  )}
                  {question.explanation ? <p className="mt-3 text-sm text-ink-2">{question.explanation}</p> : null}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
