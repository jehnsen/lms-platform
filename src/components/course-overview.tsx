"use client";

import Link from "next/link";
import { useState } from "react";
import { Captions, ChevronRight, ListChecks, Pencil, Play, Sparkles, Star, TimerReset } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { ForbiddenView } from "@/components/forbidden-view";
import { Curriculum } from "@/components/curriculum";
import { NotFoundView } from "@/components/not-found-view";
import { Badge, ButtonLink, Card, Meter, PageContainer, PageSkeleton, fieldClass } from "@/components/ui";
import { useCourse, useCourseRoster, useCourseSections, useMySections } from "@/lib/api/courses";
import { useCanTrackProgress, useMyProgress } from "@/lib/api/progress";
import { courseForViewer } from "@/lib/domain/content-visibility";
import { courseLessons, courseMinutes } from "@/lib/domain/course-outline";
import { WEEKDAYS } from "@/lib/domain/course-rules";
import { letterGrade } from "@/lib/grading";
import { courseGrade, courseProgress, nextLesson } from "@/lib/progress";
import type { Section } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { formatDate, formatMinutes } from "@/lib/utils";

const FEATURES = [
  { icon: Captions, title: "Captioned video", detail: "Every lesson has captions and a clickable transcript." },
  { icon: TimerReset, title: "In-video checkpoints", detail: "Questions pause the video so ideas stick." },
  { icon: ListChecks, title: "Auto-graded quizzes", detail: "Instant scores and explanations. Retake any time." },
  { icon: Sparkles, title: "AI tutor", detail: "Ask for help without leaving the lesson." },
];

export function CourseOverview({ courseId }: { courseId: string }) {
  const state = useMyProgress();
  const tracking = useCanTrackProgress();
  const access = useCourse(courseId);
  const roster = useCourseRoster(courseId);
  const allSections = useCourseSections(courseId);
  const mySections = useMySections(courseId);
  const now = useNow();
  // Staff only: look at the course the way a student in one section sees it (US-09).
  const [previewSectionId, setPreviewSectionId] = useState("");

  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView />;
  // A learner who is not enrolled, or faculty who do not teach it (FR-1.1).
  if (access.status === "forbidden") return <ForbiddenView resource={`course:${courseId}`} what="this course" />;

  const { canEdit, staff } = access;
  const archived = access.course.status === "archived";
  const previewing = staff && previewSectionId !== "";
  const course = previewing
    ? courseForViewer(access.course, { staff: false, sectionIds: [previewSectionId] }, now)
    : access.course;

  const progress = courseProgress(course, state);
  const upNext = nextLesson(course, state);
  const grade = courseGrade(course, state);
  // An archived course can only be looked back on (FR-1.8).
  const finished = progress.done === progress.total || archived;
  const lessonCount = courseLessons(course).length;
  const hidden = courseLessons(access.course).length - lessonCount;
  const startHref = upNext ? `/courses/${course.id}/learn/${upNext.id}` : undefined;

  const cover = (
    <CourseCover course={course} eager sizes="(min-width: 1024px) 22rem, 100vw" className="aspect-video">
      {upNext ? (
        <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
          <span className="grid size-14 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-lg transition-transform group-hover:scale-105">
            <Play aria-hidden className="size-6 translate-x-0.5 fill-current" />
          </span>
        </span>
      ) : null}
    </CourseCover>
  );

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
            <Badge>{course.code}</Badge>
            <Badge>{course.subject}</Badge>
            <Badge>{course.level}</Badge>
            {archived ? <Badge tone="warn">Archived · read-only</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-3 max-w-[65ch] text-ink-2 text-pretty">{course.description}</p>
          ) : null}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <div>
              <dt className="sr-only">Instructor</dt>
              <dd>{course.instructor}</dd>
            </div>
            <div>
              <dt className="sr-only">Length</dt>
              <dd>
                {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
                {lessonCount > 0 ? ` · ${formatMinutes(courseMinutes(course))}` : null}
              </dd>
            </div>
            {course.startsOn && course.endsOn ? (
              <div>
                <dt className="sr-only">Dates</dt>
                <dd>
                  {formatDate(course.startsOn)} to {formatDate(course.endsOn, true)}
                </dd>
              </div>
            ) : null}
            {course.rating > 0 ? (
              <div>
                <dt className="sr-only">Rating</dt>
                <dd className="flex items-center gap-1 tabular-nums">
                  <Star aria-hidden className="size-3.5 fill-current" />
                  {course.rating} · {course.learners.toLocaleString("en-US")} learners
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          {startHref && upNext ? (
            <Link
              href={startHref}
              aria-label={`${!tracking ? "Preview" : finished ? "Review" : progress.done > 0 ? "Continue" : "Start"}: ${upNext.title}`}
              className="group block overflow-hidden rounded-lg"
            >
              {cover}
            </Link>
          ) : (
            <div className="overflow-hidden rounded-lg">{cover}</div>
          )}
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
              {startHref && upNext ? (
                <>
                  <ButtonLink href={startHref} className="mt-1">
                    <Play aria-hidden className="size-4 fill-current" />
                    {finished ? "Review course" : progress.done > 0 ? "Continue" : "Start course"}
                  </ButtonLink>
                  {!finished ? <p className="text-xs text-ink-3">Up next: {upNext.title}</p> : null}
                </>
              ) : (
                <p className="text-sm text-ink-2">No lessons have been released yet. Check back soon.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                {roster
                  ? `${roster.students.length} ${roster.students.length === 1 ? "learner" : "learners"} in ${roster.sections.length} ${roster.sections.length === 1 ? "section" : "sections"}.`
                  : "You are viewing this course as staff."}{" "}
                {archived
                  ? "This course is archived: it can be viewed but not changed."
                  : "Progress isn't recorded while you preview."}
              </p>
              {startHref ? (
                <ButtonLink href={startHref} className="mt-1">
                  <Play aria-hidden className="size-4 fill-current" />
                  Preview course
                </ButtonLink>
              ) : null}
              {canEdit ? (
                <ButtonLink href={`/courses/${course.id}/edit`} variant={startHref ? "secondary" : "primary"}>
                  <Pencil aria-hidden className="size-4" />
                  Edit course
                </ButtonLink>
              ) : null}
              <ButtonLink href="/gradebook" variant="secondary">
                Open gradebook
              </ButtonLink>
            </>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Course content</h2>
            {staff && allSections.length > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="course-preview-as" className="text-ink-2">
                  Show
                </label>
                <select
                  id="course-preview-as"
                  value={previewSectionId}
                  onChange={(event) => setPreviewSectionId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Everything (staff view)</option>
                  {allSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      What {section.name} students see now
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {previewing ? (
            <p role="status" className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
              {hidden === 0
                ? "Students in this section can see every lesson."
                : `${hidden} ${hidden === 1 ? "lesson is" : "lessons are"} hidden from this section right now: not released yet, or restricted to another section.`}
            </p>
          ) : null}
          <Card className="p-3 sm:p-4">
            <Curriculum course={course} staff={staff && !previewing} />
          </Card>
        </section>

        <div className="flex flex-col gap-8">
          <ScheduleSection sections={staff ? allSections : mySections} />

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
      </div>
    </PageContainer>
  );
}

/** FR-2.1: when each section meets. Students see their own section only. */
function ScheduleSection({ sections }: { sections: Section[] }) {
  if (sections.every((section) => section.meetings.length === 0)) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Class schedule</h2>
      <ul className="flex flex-col gap-3 text-sm">
        {sections
          .filter((section) => section.meetings.length > 0)
          .map((section) => (
            <li key={section.id}>
              <div className="font-medium">{section.name}</div>
              <ul className="mt-0.5 text-ink-2">
                {[...section.meetings]
                  .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
                  .map((meeting) => (
                    <li key={`${meeting.day}-${meeting.start}`} className="tabular-nums">
                      {WEEKDAYS[meeting.day]} {meeting.start}–{meeting.end}
                      {meeting.room ? ` · ${meeting.room}` : null}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
      </ul>
    </section>
  );
}
