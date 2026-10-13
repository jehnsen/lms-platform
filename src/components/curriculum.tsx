"use client";

import Link from "next/link";
import { CircleCheck, CirclePlay, FileText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui";
import { getQuiz } from "@/lib/data/quizzes";
import { bestAttempt } from "@/lib/progress";
import { useLearner } from "@/lib/store";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Module-by-module outline of a course with the learner's progress. */
export function Curriculum({
  course,
  currentLessonId,
}: {
  course: Course;
  currentLessonId?: string;
}) {
  const state = useLearner();

  return (
    <ol className="flex flex-col gap-5">
      {course.modules.map((module, moduleIndex) => {
        const done = module.lessons.filter((lesson) =>
          state.completedLessons.includes(lesson.id),
        ).length;
        const quiz = module.quizId ? getQuiz(module.quizId) : undefined;
        const best = quiz ? bestAttempt(quiz.id, state.attempts) : undefined;

        return (
          <li key={module.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 px-2">
              <h3 className="text-sm font-semibold">
                <span className="text-ink-3">Module {moduleIndex + 1} · </span>
                {module.title}
              </h3>
              <span className="shrink-0 text-xs text-ink-3 tabular-nums">
                {done}/{module.lessons.length}
              </span>
            </div>
            <ul className="flex flex-col">
              {module.lessons.map((lesson) => {
                const complete = state.completedLessons.includes(lesson.id);
                const current = lesson.id === currentLessonId;
                const TypeIcon = lesson.type === "video" ? CirclePlay : FileText;
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/courses/${course.id}/learn/${lesson.id}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex items-start gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                        current ? "bg-primary-soft" : "hover:bg-surface-2",
                      )}
                    >
                      {complete ? (
                        <CircleCheck aria-label="Completed" className="mt-0.5 size-4 shrink-0 text-good" />
                      ) : (
                        <TypeIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                      )}
                      <span className={cn("flex-1", current && "font-medium")}>{lesson.title}</span>
                      <span className="shrink-0 text-xs text-ink-3 tabular-nums">
                        {lesson.type === "video" ? "Video" : "Reading"} · {lesson.minutes} min
                      </span>
                    </Link>
                  </li>
                );
              })}
              {quiz ? (
                <li>
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-surface-2"
                  >
                    {best ? (
                      <CircleCheck aria-label="Submitted" className="mt-0.5 size-4 shrink-0 text-good" />
                    ) : (
                      <ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    )}
                    <span className="flex-1">Module quiz</span>
                    {best ? (
                      <Badge tone={best.percent >= quiz.passMark ? "good" : "warn"}>
                        Best {best.percent}%
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-ink-3">
                        Graded · {quiz.questions.length} questions
                      </span>
                    )}
                  </Link>
                </li>
              ) : null}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
