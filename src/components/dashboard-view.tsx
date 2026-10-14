"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookCheck,
  CircleCheckBig,
  ClipboardList,
  Flame,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { ColumnChart } from "@/components/charts";
import { CourseCover, Thumbnail } from "@/components/course-art";
import {
  Badge,
  ButtonLink,
  Card,
  Meter,
  PageContainer,
  PageHeader,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { useAssignments } from "@/lib/api/assignments";
import { useCourses } from "@/lib/api/courses";
import { useViewedGrades } from "@/lib/api/grades";
import { useMyProgress } from "@/lib/api/progress";
import { useQuizzes } from "@/lib/api/quizzes";
import { useActor } from "@/lib/api/session";
import { studyStreakDays, weeklyActivity } from "@/lib/data/people";
import { courseLessons } from "@/lib/domain/course-outline";
import {
  activeCourses,
  checkpointStats,
  courseProgress,
  nextLesson,
  pendingQuizzes,
} from "@/lib/progress";
import { dateParts, firstNameOf, formatMinutes } from "@/lib/utils";

const TUTOR_PROMPTS = ["Explain it more simply", "Give me an example", "Quiz me"];

/** The student home page: where they left off, what is due, and how they are doing. */
export function DashboardView() {
  const actor = useActor();
  const courses = useCourses();
  const state = useMyProgress();
  const assignments = useAssignments();
  const quizzes = useQuizzes();
  const grades = useViewedGrades();
  // Archived courses are read-only (FR-1.8), so there is nothing in them to resume or to do.
  const open = courses.filter((course) => course.status !== "archived");
  const active = activeCourses(state, open);
  // A course with no lessons released yet has nothing to start.
  const hasLessons = (course: (typeof courses)[number]) => courseLessons(course).length > 0;
  const resume = active[0]?.course ?? open.find(hasLessons) ?? courses.find(hasLessons);
  const resumeLesson = resume ? nextLesson(resume, state) : undefined;

  if (!resume || !resumeLesson) {
    return (
      <PageContainer>
        <PageHeader
          title={`Welcome, ${actor ? firstNameOf(actor.name) : ""}`}
          description={
            courses.length === 0
              ? "You are not enrolled in any courses yet. They will appear here once the school adds you to a section."
              : "Your courses have no lessons released yet. They will appear here as your teachers release them."
          }
        />
      </PageContainer>
    );
  }

  const resumeProgress = courseProgress(resume, state);
  const started = resumeProgress.done > 0;
  const average = grades?.overall ?? null;
  const checkpoints = checkpointStats(state);
  const pending = pendingQuizzes(state, open, quizzes);
  // Everything still to hand in or take, soonest first: quizzes and assignments together.
  const upNext = [
    ...pending.map((quiz) => ({
      id: quiz.id,
      href: `/quizzes/${quiz.id}`,
      title: quiz.title,
      due: quiz.due,
      detail: `${courses.find((course) => course.id === quiz.courseId)?.title ?? ""} · ${quiz.questions.length} questions`,
    })),
    ...assignments
      .filter((row) => !row.mine && open.some((course) => course.id === row.assignment.courseId))
      .map((row) => ({
        id: row.assignment.id,
        href: `/assignments/${row.assignment.id}`,
        title: row.assignment.title,
        due: row.assignment.dueAt,
        detail: `${row.courseTitle} · assignment · ${row.assignment.points} points`,
      })),
  ].sort((a, b) => a.due.localeCompare(b.due));

  const weekMinutes = weeklyActivity.reduce((sum, entry) => sum + entry.minutes, 0);
  const busiest = weeklyActivity.reduce((best, entry) => (entry.minutes > best.minutes ? entry : best));

  return (
    <PageContainer>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            Welcome back, {actor ? firstNameOf(actor.name) : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2 text-pretty">
            You have {upNext.length} {upNext.length === 1 ? "piece of work" : "pieces of work"} coming up and one
            lesson waiting. Here&apos;s where you left off.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone="warn" className="h-10 gap-1.5 px-3 text-sm">
            <Flame aria-hidden className="size-4" />
            {studyStreakDays}-day streak
          </Badge>
          <ButtonLink href="/courses" variant="secondary">
            Browse courses
          </ButtonLink>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="grid overflow-hidden md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:col-span-2">
          <Link
            href={`/courses/${resume.id}/learn/${resumeLesson.id}`}
            className="group relative block"
          >
            <span className="sr-only">
              {started ? "Resume" : "Start"} lesson: {resumeLesson.title},
            </span>
            <Thumbnail
              src={resumeLesson.thumbnail}
              accent={resume.accent}
              eager
              sizes="(min-width: 1024px) 28rem, (min-width: 768px) 45vw, 100vw"
              className="aspect-video h-full w-full md:aspect-auto md:min-h-64"
              imageClassName="transition-transform duration-300 group-hover:scale-105"
            >
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
                <span className="grid size-16 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-lg transition-transform group-hover:scale-105">
                  <Play aria-hidden className="size-7 translate-x-0.5 fill-current" />
                </span>
              </span>
              <span className="absolute right-3 bottom-3 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                {resumeLesson.minutes} min
              </span>
            </Thumbnail>
          </Link>

          <div className="flex flex-col justify-between gap-5 p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{started ? "Continue learning" : "Start learning"}</Badge>
                <span className="text-sm text-ink-3">{resume.title}</span>
              </div>
              <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-balance">
                {resumeLesson.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-ink-2 text-pretty">{resumeLesson.summary}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-2">
                  {resumeProgress.done} of {resumeProgress.total} lessons
                </span>
                <span className="font-medium tabular-nums">{resumeProgress.percent}%</span>
              </div>
              <Meter value={resumeProgress.percent} label={`${resume.title} progress`} className="h-2" />
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href={`/courses/${resume.id}/learn/${resumeLesson.id}`}>
                  <Play aria-hidden className="size-4 fill-current" />
                  {started ? "Resume lesson" : "Start lesson"}
                </ButtonLink>
                <ButtonLink href={`/courses/${resume.id}`} variant="ghost">
                  Course outline
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col p-5 sm:p-6">
          <div className="text-sm text-ink-2">Study time this week</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight">{formatMinutes(weekMinutes)}</div>
          <p className="mt-1 text-xs text-ink-3">
            Most active on {busiest.day} · {busiest.minutes} min
          </p>
          <div className="mt-5 flex-1">
            <ColumnChart
              ariaLabel="Minutes studied each day this week"
              showValues={false}
              className="h-28"
              columns={weeklyActivity.map((entry) => ({
                label: entry.day,
                value: entry.minutes,
                valueLabel: `${entry.minutes} min`,
              }))}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={BookCheck}
          label="Lessons completed"
          value={state.completedLessons.length}
          hint={`In ${active.length} ${active.length === 1 ? "course" : "courses"}`}
        />
        <StatTile
          icon={Target}
          label="Average grade"
          value={average === null ? "—" : `${average}%`}
          hint="Across your courses, released grades only"
        />
        <StatTile
          icon={CircleCheckBig}
          label="Checkpoints correct"
          value={checkpoints.percent === null ? "—" : `${checkpoints.percent}%`}
          hint={`${checkpoints.correct} of ${checkpoints.answered} in-video questions`}
        />
        <StatTile
          icon={ClipboardList}
          label="Work to do"
          value={upNext.length}
          hint={upNext[0] ? `Next due ${dateParts(upNext[0].due).month} ${dateParts(upNext[0].due).day}` : "All caught up"}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/courses" className="text-sm font-medium text-primary-ink hover:underline">
                Browse all
              </Link>
            }
          >
            Your courses
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => {
              const progress = courseProgress(course, state);
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md"
                  >
                    <CourseCover
                      course={course}
                      sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                      className="aspect-2/1"
                      imageClassName="transition-transform duration-300 group-hover:scale-105"
                    >
                      <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                        {course.subject}
                      </span>
                    </CourseCover>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="font-medium text-balance group-hover:underline">{course.title}</div>
                      <div className="mt-0.5 text-xs text-ink-3">{course.instructor}</div>
                      <div className="mt-auto flex items-center gap-3 pt-4">
                        <Meter value={progress.percent} label={`${course.title} progress`} className="flex-1" />
                        <span className="shrink-0 text-xs text-ink-2 tabular-nums">
                          {progress.done > 0 ? `${progress.done}/${progress.total} lessons` : "Not started"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <SectionTitle
              action={
                <Link href="/quizzes" className="text-sm font-medium text-primary-ink hover:underline">
                  All quizzes
                </Link>
              }
            >
              Up next
            </SectionTitle>
            <Card>
              {upNext.length === 0 ? (
                <p className="p-4 text-sm text-ink-2">Nothing to hand in and every quiz taken. Nice work.</p>
              ) : (
                <ul>
                  {upNext.slice(0, 5).map((item) => {
                    const due = dateParts(item.due);
                    return (
                      <li key={item.id} className="border-t border-line first:border-t-0">
                        <Link href={item.href} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2">
                          <span
                            aria-hidden
                            className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-center leading-none"
                          >
                            <span>
                              <span className="block text-[10px] font-medium text-ink-3 uppercase">{due.month}</span>
                              <span className="mt-0.5 block text-base font-semibold tabular-nums">{due.day}</span>
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.title}</span>
                            <span className="block truncate text-xs text-ink-3">
                              <span className="sr-only">
                                Due {due.month} {due.day} ·{" "}
                              </span>
                              {item.detail}
                            </span>
                          </span>
                          <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>

          <Card className="border-spark-solid/40 bg-spark-soft p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-spark">
              <Sparkles aria-hidden className="size-4" />
              AI tutor
            </div>
            <p className="mt-2 text-sm text-ink">
              Stuck on <span className="font-medium">{resumeLesson.title}</span>? Ask for help any time.
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {TUTOR_PROMPTS.map((prompt) => (
                <li key={prompt} className="rounded-full border border-spark-solid/40 bg-surface px-2.5 py-1 text-xs text-ink-2">
                  “{prompt}”
                </li>
              ))}
            </ul>
            <ButtonLink href="/tutor" variant="secondary" size="sm" className="mt-4">
              Ask the tutor
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
