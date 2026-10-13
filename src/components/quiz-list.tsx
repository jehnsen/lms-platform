"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, PageContainer, PageHeader, SectionTitle } from "@/components/ui";
import { getCourse } from "@/lib/data/courses";
import { quizzes } from "@/lib/data/quizzes";
import { attemptsFor, bestAttempt } from "@/lib/progress";
import { useLearner } from "@/lib/store";
import type { Quiz } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function QuizList() {
  const state = useLearner();
  const byDue = [...quizzes].sort((a, b) => a.due.localeCompare(b.due));
  const todo = byDue.filter((quiz) => attemptsFor(quiz.id, state.attempts).length === 0);
  const done = byDue.filter((quiz) => attemptsFor(quiz.id, state.attempts).length > 0);

  const row = (quiz: Quiz) => {
    const best = bestAttempt(quiz.id, state.attempts);
    return (
      <li key={quiz.id} className="border-t border-line first:border-t-0">
        <Link href={`/quizzes/${quiz.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-2">
          <div className="min-w-0 flex-1 basis-64">
            <div className="font-medium">{quiz.title}</div>
            <div className="mt-0.5 text-sm text-ink-3">
              {getCourse(quiz.courseId)?.title} · {quiz.questions.length} questions · about{" "}
              {quiz.minutes} min · due {formatDate(quiz.due)}
            </div>
          </div>
          {best ? (
            <span className="flex items-center gap-2 text-sm tabular-nums">
              <Badge tone={best.percent >= quiz.passMark ? "good" : "bad"}>
                {best.percent >= quiz.passMark ? "Passed" : "Below pass"}
              </Badge>
              <span className="font-medium">Best {best.percent}%</span>
            </span>
          ) : (
            <Badge>{quiz.weight}% of grade</Badge>
          )}
          <span className="flex items-center gap-1 text-sm font-medium text-primary-ink">
            {best ? "Retake" : "Start"}
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
        description="Graded automatically the moment you submit, with an explanation for every question."
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
          <SectionTitle>Completed</SectionTitle>
          <Card>
            <ul>{done.map(row)}</ul>
          </Card>
        </section>
      ) : null}
    </PageContainer>
  );
}
