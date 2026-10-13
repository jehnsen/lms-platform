"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { Badge, Meter, PageContainer, PageHeader } from "@/components/ui";
import { courseLessons, courseMinutes, courses } from "@/lib/data/courses";
import { courseProgress } from "@/lib/progress";
import { useLearner } from "@/lib/store";
import { cn, formatMinutes } from "@/lib/utils";

const SUBJECTS = ["All", ...Array.from(new Set(courses.map((course) => course.subject)))];

export function CourseCatalog() {
  const state = useLearner();
  const [subject, setSubject] = useState("All");
  const visible = courses.filter((course) => subject === "All" || course.subject === subject);

  return (
    <PageContainer>
      <PageHeader
        title="Courses"
        description="Short captioned videos with questions along the way, auto-graded quizzes, and an AI tutor in every lesson."
      />

      <div className="mb-6 flex flex-wrap gap-1" role="group" aria-label="Filter by subject">
        {SUBJECTS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={subject === option}
            onClick={() => setSubject(option)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              subject === option ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((course) => {
          const progress = courseProgress(course, state);
          return (
            <li key={course.id}>
              <Link
                href={`/courses/${course.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <CourseCover course={course} className="h-32" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{course.subject}</Badge>
                    <Badge>{course.level}</Badge>
                  </div>
                  <h2 className="mt-3 font-display text-xl leading-snug font-semibold tracking-tight text-balance group-hover:underline">
                    {course.title}
                  </h2>
                  <p className="mt-1.5 flex-1 text-sm text-ink-2 text-pretty">{course.tagline}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-3">
                    <span>{course.instructor}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Star aria-hidden className="size-3.5 fill-current" />
                      <span className="sr-only">Rating </span>
                      {course.rating}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    {progress.done > 0 ? (
                      <div className="flex items-center gap-3">
                        <Meter value={progress.percent} label={`${course.title} progress`} className="flex-1" />
                        <span className="text-xs text-ink-2 tabular-nums">{progress.percent}% complete</span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-3">
                        {courseLessons(course).length} lessons · {formatMinutes(courseMinutes(course))}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
