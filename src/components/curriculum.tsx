"use client";

import Link from "next/link";
import { CircleCheck, FileText, ListChecks, Play } from "lucide-react";
import { Thumbnail } from "@/components/course-art";
import { Badge } from "@/components/ui";
import { useCanTrackProgress, useMyProgress } from "@/lib/api/progress";
import { getQuiz } from "@/lib/data/quizzes";
import { bestAttempt } from "@/lib/progress";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";

const TILE = "h-13.5 w-24 shrink-0 rounded-md";

/** Module-by-module outline of a course with the learner's progress. */
export function Curriculum({
  course,
  currentLessonId,
}: {
  course: Course;
  currentLessonId?: string;
}) {
  const state = useMyProgress();
  // Staff previewing a course have no progress and cannot take its quizzes.
  const tracking = useCanTrackProgress();

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
                {tracking ? `${done}/${module.lessons.length}` : `${module.lessons.length} lessons`}
              </span>
            </div>
            <ul className="flex flex-col">
              {module.lessons.map((lesson) => {
                const complete = state.completedLessons.includes(lesson.id);
                const current = lesson.id === currentLessonId;
                const isVideo = lesson.type === "video";
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/courses/${course.id}/learn/${lesson.id}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg p-2 text-sm transition-colors",
                        current ? "bg-primary-soft" : "hover:bg-surface-2",
                      )}
                    >
                      <Thumbnail src={lesson.thumbnail} accent={course.accent} sizes="96px" className={TILE}>
                        {isVideo ? (
                          <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
                            <span className="grid size-6 place-items-center rounded-full bg-white/95 text-neutral-950">
                              <Play aria-hidden className="size-3 translate-x-px fill-current" />
                            </span>
                          </span>
                        ) : (
                          <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded bg-black/70 text-white">
                            <FileText aria-hidden className="size-3" />
                          </span>
                        )}
                        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 text-[10px] leading-4 font-medium text-white tabular-nums">
                          {lesson.minutes} min
                        </span>
                      </Thumbnail>
                      <span className="min-w-0 flex-1">
                        <span className={cn("line-clamp-2", current && "font-medium")}>{lesson.title}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {isVideo ? "Video" : "Reading"}
                        </span>
                      </span>
                      {complete ? (
                        <CircleCheck aria-label="Completed" className="size-4 shrink-0 text-good" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
              {quiz ? (
                <li>
                  <QuizRow href={tracking ? `/quizzes/${quiz.id}` : undefined}>
                    <span className={cn(TILE, "grid place-items-center bg-surface-2 text-ink-2")}>
                      <ListChecks aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">Module quiz</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        Graded · {quiz.questions.length} questions
                      </span>
                    </span>
                    {best ? (
                      <Badge tone={best.percent >= quiz.passMark ? "good" : "warn"}>
                        Best {best.percent}%
                      </Badge>
                    ) : null}
                  </QuizRow>
                </li>
              ) : null}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** A link for learners; plain text for staff, who manage quizzes elsewhere. */
function QuizRow({ href, children }: { href: string | undefined; children: React.ReactNode }) {
  const className = "flex items-center gap-3 rounded-lg p-2 text-sm";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:bg-surface-2")}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
