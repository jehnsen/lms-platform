"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  Captions,
  ClipboardCheck,
  ListChecks,
  MessagesSquare,
  Pencil,
  Play,
  Sparkles,
  Star,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { CourseAnnouncements } from "@/components/announcements-view";
import { CourseCover } from "@/components/course-art";
import { ForbiddenView } from "@/components/forbidden-view";
import { Curriculum } from "@/components/curriculum";
import { LiveClasses } from "@/components/live-classes";
import { NotFoundView } from "@/components/not-found-view";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  FactTile,
  Meter,
  PageContainer,
  PageSkeleton,
  fieldClass,
} from "@/components/ui";
import { useAssignments, type AssignmentRow } from "@/lib/api/assignments";
import { useCourse, useCourseRoster, useCourseSections, useMySections } from "@/lib/api/courses";
import { useViewedGrades } from "@/lib/api/grades";
import { useCanTrackProgress, useMyProgress } from "@/lib/api/progress";
import { courseForViewer } from "@/lib/domain/content-visibility";
import { courseLessons, courseMinutes } from "@/lib/domain/course-outline";
import { WEEKDAYS } from "@/lib/domain/course-rules";
import { percentAndGrade } from "@/lib/grading";
import { courseProgress, nextLesson } from "@/lib/progress";
import type { Section } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { cn, formatDate, formatDateTime, formatMinutes, initialsOf } from "@/lib/utils";

const FEATURES = [
  { icon: Captions, title: "Captioned video", detail: "Every lesson has captions and a clickable transcript." },
  { icon: TimerReset, title: "In-video checkpoints", detail: "Questions pause the video so ideas stick." },
  { icon: ListChecks, title: "Quizzes", detail: "Instant scores for most questions, with explanations." },
  { icon: Sparkles, title: "AI tutor", detail: "Ask for help without leaving the lesson." },
];

export function CourseOverview({ courseId }: { courseId: string }) {
  const state = useMyProgress();
  const tracking = useCanTrackProgress();
  const access = useCourse(courseId);
  const roster = useCourseRoster(courseId);
  const allSections = useCourseSections(courseId);
  const mySections = useMySections(courseId);
  // The student's own running total, from released grades only (US-17).
  const myGrade = useViewedGrades()?.courses.find((entry) => entry.course.id === courseId);
  const assignments = useAssignments().filter((row) => row.assignment.courseId === courseId);
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
  const grade = myGrade?.total.percent ?? null;
  // An archived course can only be looked back on (FR-1.8).
  const finished = progress.done === progress.total || archived;
  const lessonCount = courseLessons(course).length;
  const hidden = courseLessons(access.course).length - lessonCount;
  const startHref = upNext ? `/courses/${course.id}/learn/${upNext.id}` : undefined;

  const cover = (
    <CourseCover course={course} eager sizes="(min-width: 1024px) 22rem, 100vw" className="aspect-video">
      {upNext ? (
        <span className="absolute inset-0 grid place-items-center bg-linear-to-t from-black/45 via-black/10 to-black/10 transition-colors group-hover:bg-black/20">
          <span className="grid size-14 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-lg ring-8 ring-white/20 transition-transform group-hover:scale-105">
            <Play aria-hidden className="size-6 translate-x-0.5 fill-current" />
          </span>
        </span>
      ) : null}
    </CourseCover>
  );

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: course.title }]} />

      <Card className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{course.code}</Badge>
            <Badge>{course.subject}</Badge>
            <Badge>{course.level}</Badge>
            {archived ? <Badge tone="warn">Archived · read-only</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-3 max-w-[65ch] leading-relaxed text-ink-2 text-pretty">{course.description}</p>
          ) : null}
          <div className="mt-5 flex items-center gap-3">
            <Avatar initials={initialsOf(course.instructor)} size="lg" />
            <div className="min-w-0 text-sm">
              <div className="text-xs text-ink-3">Taught by</div>
              <div className="truncate font-semibold">{course.instructor}</div>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 lg:mt-auto lg:pt-6">
            <FactTile
              icon={BookOpen}
              label="Length"
              value={`${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}${lessonCount > 0 ? ` · ${formatMinutes(courseMinutes(course))}` : ""}`}
            />
            {course.startsOn && course.endsOn ? (
              <FactTile
                icon={CalendarDays}
                label="Runs"
                value={`${formatDate(course.startsOn)} to ${formatDate(course.endsOn, true)}`}
              />
            ) : null}
            {course.rating > 0 ? (
              <FactTile
                icon={Star}
                label="Rating"
                value={
                  <span className="tabular-nums">
                    {course.rating} · {course.learners.toLocaleString("en-US")} learners
                  </span>
                }
              />
            ) : null}
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          {startHref && upNext ? (
            <Link
              href={startHref}
              aria-label={`${!tracking ? "Preview" : finished ? "Review" : progress.done > 0 ? "Continue" : "Start"}: ${upNext.title}`}
              className="group block overflow-hidden rounded-xl"
            >
              {cover}
            </Link>
          ) : (
            <div className="overflow-hidden rounded-xl">{cover}</div>
          )}
          {tracking ? (
            <>
              <div className="flex flex-col gap-3 rounded-xl bg-surface-2/70 p-4">
                <div>
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="text-ink-2">Your progress</span>
                    <span className="font-semibold tabular-nums">
                      {progress.done}/{progress.total} lessons
                    </span>
                  </div>
                  <Meter value={progress.percent} label="Course progress" className="h-2" />
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink-2">Course grade</span>
                  <span className="font-semibold tabular-nums">
                    {grade === null || !myGrade ? "Not graded yet" : percentAndGrade(grade, myGrade.scale)}
                  </span>
                </div>
              </div>
              {startHref && upNext ? (
                <>
                  <ButtonLink href={startHref} size="lg" className="mt-1">
                    <Play aria-hidden className="size-4 fill-current" />
                    {finished ? "Review course" : progress.done > 0 ? "Continue" : "Start course"}
                  </ButtonLink>
                  {!finished ? (
                    <p className="text-center text-xs text-ink-3">
                      Up next: <span className="font-medium text-ink-2">{upNext.title}</span>
                    </p>
                  ) : null}
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

      {/* US-22, US-24: announcements and live classes are on the course page itself. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <CourseAnnouncements courseId={courseId} />
        <LiveClasses courseId={courseId} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Course content
              <span className="ml-2 text-sm font-normal text-ink-3">
                {course.modules.length} {course.modules.length === 1 ? "unit" : "units"} · {lessonCount}{" "}
                {lessonCount === 1 ? "lesson" : "lessons"}
              </span>
            </h2>
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

        <div className="flex flex-col gap-4">
          <AssignmentsSection rows={assignments} staff={staff} canEdit={canEdit} />
          <ScheduleSection sections={staff ? allSections : mySections} />

          <SideCard icon={MessagesSquare} title="Discussion">
            <p className="text-sm text-ink-2">Ask a question or help a classmate in this course&apos;s forum.</p>
            <ButtonLink href="/forums" variant="secondary" size="sm" className="mt-3">
              Open the forum
            </ButtonLink>
          </SideCard>

          <SideCard title="How you'll learn" className="bg-surface-2/50 shadow-none">
            <ul className="flex flex-col gap-4">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-primary-ink shadow-card">
                    <feature.icon aria-hidden className="size-4" />
                  </span>
                  <div>
                    <div className="text-sm font-medium">{feature.title}</div>
                    <p className="text-sm text-ink-2">{feature.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SideCard>
        </div>
      </div>
    </PageContainer>
  );
}

/** A titled panel in the course page's side column. */
function SideCard({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
          {Icon ? <Icon aria-hidden className="size-4 text-ink-3" /> : null}
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

/** US-10: the course's assignments with their due dates. Students see the ones set for their section. */
function AssignmentsSection({ rows, staff, canEdit }: { rows: AssignmentRow[]; staff: boolean; canEdit: boolean }) {
  if (rows.length === 0 && !canEdit) return null;
  return (
    <SideCard icon={ClipboardCheck} title="Assignments">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-2">None set yet.</p>
      ) : (
        <ul className="-mx-2 flex flex-col text-sm">
          {rows.map(({ assignment, mine }) => (
            <li key={assignment.id} className="rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
              <Link href={`/assignments/${assignment.id}`} className="font-medium text-primary-ink hover:underline">
                {assignment.title || "Untitled assignment"}
              </Link>
              <div className="text-xs text-ink-2">
                Due {formatDateTime(assignment.dueAt)}
                {staff
                  ? assignment.status === "draft"
                    ? " · draft"
                    : null
                  : mine
                    ? mine.grade
                      ? ` · ${mine.grade.points}/${assignment.points}`
                      : " · handed in"
                    : " · to do"}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <ButtonLink href="/assignments/new" variant="secondary" size="sm" className="mt-3">
          New assignment
        </ButtonLink>
      ) : null}
    </SideCard>
  );
}

/** FR-2.1: when each section meets. Students see their own section only. */
function ScheduleSection({ sections }: { sections: Section[] }) {
  if (sections.every((section) => section.meetings.length === 0)) return null;
  return (
    <SideCard icon={CalendarClock} title="Class schedule">
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
    </SideCard>
  );
}

