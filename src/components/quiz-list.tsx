"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Clock, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, PageContainer, PageHeader, SectionTitle } from "@/components/ui";
import { useCourses } from "@/lib/api/courses";
import { useMyProgress } from "@/lib/api/progress";
import { settleExpiredAttempts, useMyDrafts, useQuizzes } from "@/lib/api/quizzes";
import { useActor } from "@/lib/api/session";
import { can } from "@/lib/domain/permissions";
import { isManuallyMarked, quizPoints } from "@/lib/grading";
import { attemptsFor, bestAttempt, pendingReason } from "@/lib/progress";
import type { Quiz } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** `/quizzes`: the quizzes a student has to take and has taken, or the quizzes staff have built. */
export function QuizList() {
  const actor = useActor();
  if (!actor) return null;
  return actor.role === "student" ? <StudentQuizzes /> : <StaffQuizzes />;
}

function StudentQuizzes() {
  const state = useMyProgress();
  // Only quizzes in the learner's own courses.
  const courses = useCourses();
  const quizzes = useQuizzes();
  const drafts = useMyDrafts();

  // An attempt whose time ran out while its page was closed is handed in when the student comes back here.
  useEffect(() => {
    void settleExpiredAttempts();
  }, []);

  const titleOf = (courseId: string) => courses.find((course) => course.id === courseId)?.title;
  // FR-1.8: quizzes of an archived course are closed; past results stay listed.
  const closed = (quiz: Quiz) => courses.find((course) => course.id === quiz.courseId)?.status === "archived";
  const taken = (quiz: Quiz) => attemptsFor(quiz.id, state.attempts).length > 0;
  const todo = quizzes.filter((quiz) => !taken(quiz) && !closed(quiz));
  const done = quizzes.filter(taken);

  const row = (quiz: Quiz) => {
    const best = bestAttempt(quiz.id, state.attempts);
    const waiting = pendingReason(quiz.id, state.attempts);
    const inProgress = drafts[quiz.id] !== undefined;
    return (
      <li key={quiz.id} className="border-t border-line first:border-t-0">
        <Link href={`/quizzes/${quiz.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-2">
          <div className="min-w-0 flex-1 basis-64">
            <div className="font-medium">{quiz.title}</div>
            <div className="mt-0.5 text-sm text-ink-3">
              {titleOf(quiz.courseId)} · {quiz.questions.length} questions ·{" "}
              {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min limit` : `about ${quiz.minutes} min`} · due{" "}
              {formatDate(quiz.due)}
            </div>
          </div>
          <span className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
            {inProgress ? (
              <Badge tone="warn">
                <Clock aria-hidden className="size-3" />
                In progress
              </Badge>
            ) : null}
            {best ? (
              <>
                <Badge tone={best.percent >= quiz.passMark ? "good" : "bad"}>
                  {best.percent >= quiz.passMark ? "Passed" : "Below pass"}
                </Badge>
                <span className="font-medium">Best {best.percent}%</span>
              </>
            ) : waiting ? (
              <Badge tone="warn">{waiting === "marking" ? "Awaiting marking" : "Grade not released yet"}</Badge>
            ) : inProgress ? null : (
              <Badge>{quizPoints(quiz)} points</Badge>
            )}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-primary-ink">
            {closed(quiz) ? "View" : inProgress ? "Resume" : taken(quiz) ? "Open" : "Start"}
            <ArrowRight aria-hidden className="size-4" />
          </span>
        </Link>
      </li>
    );
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Quizzes"
        description="Most quizzes are marked the moment you hand in. Answers your teacher marks by hand, and scores your teacher holds back, arrive later. Timed quizzes save your answers as you go."
      />

      <section>
        <SectionTitle>To do</SectionTitle>
        <Card>
          {todo.length === 0 ? (
            <p className="p-4 text-sm text-ink-2">Nothing outstanding — you&apos;ve taken every quiz.</p>
          ) : (
            <ul>{todo.map(row)}</ul>
          )}
        </Card>
      </section>

      {done.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Taken</SectionTitle>
          <Card>
            <ul>{done.map(row)}</ul>
          </Card>
        </section>
      ) : null}
    </PageContainer>
  );
}

/** US-12: the quizzes of the courses a teacher teaches (all of them for an admin), drafts included. */
function StaffQuizzes() {
  const actor = useActor();
  const courses = useCourses();
  const quizzes = useQuizzes();
  const canCreate = Boolean(actor?.courseIds.some((courseId) => can(actor, "create", { type: "quiz", courseId })));
  const titleOf = (courseId: string) => courses.find((course) => course.id === courseId)?.title;

  const groups = [
    { title: "Published", quizzes: quizzes.filter((quiz) => quiz.status === "published"), empty: "No quizzes are published yet." },
    { title: "Drafts", quizzes: quizzes.filter((quiz) => quiz.status === "draft"), empty: undefined },
  ];

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Quizzes"
        description="Quizzes in your courses. Open one to see its questions and answers."
        actions={
          canCreate ? (
            <>
              <ButtonLink href="/grading" variant="secondary">
                Grading queue
              </ButtonLink>
              <ButtonLink href="/quizzes/new">
                <Plus aria-hidden className="size-4" />
                New quiz
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-8">
        {groups.map((group) =>
          group.quizzes.length === 0 && !group.empty ? null : (
            <section key={group.title}>
              <SectionTitle>{group.title}</SectionTitle>
              <Card>
                {group.quizzes.length === 0 ? (
                  <p className="p-4 text-sm text-ink-2">{group.empty}</p>
                ) : (
                  <ul>
                    {group.quizzes.map((quiz) => {
                      const manual = quiz.questions.filter(isManuallyMarked).length;
                      return (
                        <li key={quiz.id} className="border-t border-line first:border-t-0">
                          <Link href={`/quizzes/${quiz.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-2">
                            <div className="min-w-0 flex-1 basis-64">
                              <div className="font-medium">{quiz.title || "Untitled quiz"}</div>
                              <div className="mt-0.5 text-sm text-ink-3">
                                {titleOf(quiz.courseId)} · {quiz.questions.length}{" "}
                                {quiz.questions.length === 1 ? "question" : "questions"} · due {formatDate(quiz.due)}
                              </div>
                            </div>
                            <span className="flex flex-wrap items-center gap-2 text-sm">
                              {quiz.timeLimitMinutes ? <Badge>{quiz.timeLimitMinutes} min limit</Badge> : null}
                              {manual > 0 ? <Badge tone="warn">{manual} marked by hand</Badge> : null}
                              <Badge>{quizPoints(quiz)} points</Badge>
                            </span>
                            <span className="flex items-center gap-1 text-sm font-medium text-primary-ink">
                              Open
                              <ArrowRight aria-hidden className="size-4" />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </section>
          ),
        )}
      </div>
    </PageContainer>
  );
}
