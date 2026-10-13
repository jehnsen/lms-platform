"use client";

import Link from "next/link";
import { Captions, ChevronRight, ListChecks, Play, Sparkles, Star, TimerReset } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { ForbiddenView } from "@/components/forbidden-view";
import { Curriculum } from "@/components/curriculum";
import { Badge, ButtonLink, Card, Meter, PageContainer } from "@/components/ui";
import { useCanViewCourse, useCourseRoster } from "@/lib/api/courses";
import { useCanTrackProgress, useMyProgress } from "@/lib/api/progress";
import { courseLessons, courseMinutes, getCourse } from "@/lib/data/courses";
import { letterGrade } from "@/lib/grading";
import { courseGrade, courseProgress, nextLesson } from "@/lib/progress";
import { formatMinutes } from "@/lib/utils";

const FEATURES = [
  { icon: Captions, title: "Captioned video", detail: "Every lesson has captions and a clickable transcript." },
  { icon: TimerReset, title: "In-video checkpoints", detail: "Questions pause the video so ideas stick." },
  { icon: ListChecks, title: "Auto-graded quizzes", detail: "Instant scores and explanations. Retake any time." },
  { icon: Sparkles, title: "AI tutor", detail: "Ask for help without leaving the lesson." },
];

export function CourseOverview({ courseId }: { courseId: string }) {
  const state = useMyProgress();
  const tracking = useCanTrackProgress();
  const allowed = useCanViewCourse(courseId);
  const roster = useCourseRoster(courseId);
  const course = getCourse(courseId);
  if (!course) return null;
  // A learner who is not enrolled, or faculty who do not teach it (FR-1.1).
  if (allowed === false) return <ForbiddenView resource={`course:${courseId}`} what="this course" />;

  const progress = courseProgress(course, state);
  const upNext = nextLesson(course, state);
  const grade = courseGrade(course, state);
  const finished = progress.done === progress.total;

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-ink-3">
        <Link href="/courses" className="hover:text-ink">
          Courses
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">{course.title}</span>
      </nav>

      <Card className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{course.subject}</Badge>
            <Badge>{course.level}</Badge>
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {course.title}
          </h1>
          <p className="mt-3 max-w-[65ch] text-ink-2 text-pretty">{course.description}</p>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <div>
              <dt className="sr-only">Instructor</dt>
              <dd>{course.instructor}</dd>
            </div>
            <div>
              <dt className="sr-only">Length</dt>
              <dd>
                {courseLessons(course).length} lessons · {formatMinutes(courseMinutes(course))}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Rating</dt>
              <dd className="flex items-center gap-1 tabular-nums">
                <Star aria-hidden className="size-3.5 fill-current" />
                {course.rating} · {course.learners.toLocaleString("en-US")} learners
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={`/courses/${course.id}/learn/${upNext.id}`}
            aria-label={`${!tracking ? "Preview" : finished ? "Review" : progress.done > 0 ? "Continue" : "Start"}: ${upNext.title}`}
            className="group block overflow-hidden rounded-lg"
          >
            <CourseCover course={course} eager sizes="(min-width: 1024px) 22rem, 100vw" className="aspect-video">
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
                <span className="grid size-14 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-lg transition-transform group-hover:scale-105">
                  <Play aria-hidden className="size-6 translate-x-0.5 fill-current" />
                </span>
              </span>
            </CourseCover>
          </Link>
          {tracking ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-2">Your progress</span>
                <span className="font-medium tabular-nums">
                  {progress.done}/{progress.total} lessons
                </span>
              </div>
              <Meter value={progress.percent} label="Course progress" />
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-2">Course grade</span>
                <span className="font-medium tabular-nums">
                  {grade === null ? "Not graded yet" : `${grade}% · ${letterGrade(grade)}`}
                </span>
              </div>
              <ButtonLink href={`/courses/${course.id}/learn/${upNext.id}`} className="mt-1">
                <Play aria-hidden className="size-4 fill-current" />
                {finished ? "Review course" : progress.done > 0 ? "Continue" : "Start course"}
              </ButtonLink>
              {!finished ? <p className="text-xs text-ink-3">Up next: {upNext.title}</p> : null}
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                {roster
                  ? `${roster.students.length} learners in ${roster.sections.length} sections.`
                  : "You are viewing this course as staff."}{" "}
                Progress isn&apos;t recorded while you preview.
              </p>
              <ButtonLink href={`/courses/${course.id}/learn/${upNext.id}`} className="mt-1">
                <Play aria-hidden className="size-4 fill-current" />
                Preview course
              </ButtonLink>
              <ButtonLink href="/gradebook" variant="secondary">
                Open gradebook
              </ButtonLink>
            </>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Course content</h2>
          <Card className="p-3 sm:p-4">
            <Curriculum course={course} />
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">How you&apos;ll learn</h2>
          <ul className="flex flex-col gap-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <feature.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
                <div>
                  <div className="text-sm font-medium">{feature.title}</div>
                  <p className="text-sm text-ink-2">{feature.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
