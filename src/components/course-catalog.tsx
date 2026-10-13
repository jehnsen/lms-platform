"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { Badge, Meter, PageContainer, PageHeader } from "@/components/ui";
import { useCourses } from "@/lib/api/courses";
import { useCanTrackProgress, useMyProgress } from "@/lib/api/progress";
import { courseLessons, courseMinutes } from "@/lib/data/courses";
import { courseProgress } from "@/lib/progress";
import { cn, formatMinutes } from "@/lib/utils";

export function CourseCatalog() {
  const courses = useCourses();
  const state = useMyProgress();
  // Faculty and admins open courses to preview them; only learners have progress.
  const tracking = useCanTrackProgress();
  const [subject, setSubject] = useState("All");
  const subjects = ["All", ...Array.from(new Set(courses.map((course) => course.subject)))];
  const visible = courses.filter((course) => subject === "All" || course.subject === subject);

  return (
    <PageContainer>
      <PageHeader
        title="Courses"
        description={
          tracking
            ? "Short captioned videos with questions along the way, auto-graded quizzes, and an AI tutor in every lesson."
            : "Open a course to preview it the way learners see it."
        }
      />

      <div className="mb-6 flex flex-wrap gap-1" role="group" aria-label="Filter by subject">
        {subjects.map((option) => (
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
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md"
              >
                <CourseCover
                  course={course}
                  sizes="(min-width: 1280px) 24rem, (min-width: 640px) 50vw, 100vw"
                  className="aspect-video"
                  imageClassName="transition-transform duration-300 group-hover:scale-105"
                >
                  <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                    {courseLessons(course).length} lessons · {formatMinutes(courseMinutes(course))}
                  </span>
                </CourseCover>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{course.subject}</Badge>
                    <Badge>{course.level}</Badge>
                  </div>
                  <h2 className="mt-3 text-xl leading-snug font-semibold tracking-tight text-balance group-hover:underline">
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
                    {!tracking ? (
                      <span className="text-xs font-medium text-primary-ink">Preview course</span>
                    ) : progress.done > 0 ? (
                      <div className="flex items-center gap-3">
                        <Meter value={progress.percent} label={`${course.title} progress`} className="flex-1" />
                        <span className="text-xs text-ink-2 tabular-nums">{progress.percent}% complete</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-primary-ink">Start course</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center text-ink-2">
          No courses are assigned to you yet.
        </p>
      ) : null}
    </PageContainer>
  );
}
