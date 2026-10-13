"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Play, Sparkles, Table2, WandSparkles } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { ButtonLink, Card, Meter, PageContainer, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { courses, getCourse } from "@/lib/data/courses";
import { currentUser } from "@/lib/data/people";
import {
  activeCourses,
  checkpointStats,
  courseProgress,
  nextLesson,
  overallGrade,
  pendingQuizzes,
} from "@/lib/progress";
import { useLearner } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const TEACH_LINKS = [
  {
    href: "/lesson-planner",
    icon: WandSparkles,
    title: "Generate a lesson plan",
    detail: "Week-by-week plan with timings and assessments.",
  },
  {
    href: "/content",
    icon: Clapperboard,
    title: "Upload video and captions",
    detail: "Add study materials to a course.",
  },
  {
    href: "/gradebook",
    icon: Table2,
    title: "Open the gradebook",
    detail: "Auto-graded scores for the whole class.",
  },
];

export function DashboardView() {
  const state = useLearner();
  const active = activeCourses(state);
  const resume = active[0]?.course ?? courses[0];
  const resumeProgress = courseProgress(resume, state);
  const resumeLesson = nextLesson(resume, state);
  const average = overallGrade(state);
  const checkpoints = checkpointStats(state);
  const pending = pendingQuizzes(state);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(" ")[0]}`}
        description="Pick up where you left off, or ask the AI tutor about anything that didn't click."
      />

      <Card className="grid overflow-hidden md:grid-cols-[16rem_minmax(0,1fr)]">
        <CourseCover course={resume} className="h-28 md:h-auto" />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <p className="text-sm text-ink-3">
              {resumeProgress.done > 0 ? "Continue learning" : "Start learning"} · {resume.title}
            </p>
            <h2 className="mt-1 font-display text-2xl leading-tight font-semibold tracking-tight text-balance">
              {resumeLesson.title}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-ink-2 text-pretty">{resumeLesson.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href={`/courses/${resume.id}/learn/${resumeLesson.id}`}>
              <Play aria-hidden className="size-4 fill-current" />
              {resumeProgress.done > 0 ? "Resume lesson" : "Start lesson"}
            </ButtonLink>
            <div className="flex min-w-40 flex-1 items-center gap-3 sm:max-w-xs">
              <Meter value={resumeProgress.percent} label={`${resume.title} progress`} className="flex-1" />
              <span className="text-sm text-ink-2 tabular-nums">{resumeProgress.percent}%</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Lessons completed" value={state.completedLessons.length} hint={`In ${active.length} ${active.length === 1 ? "course" : "courses"}`} />
        <StatTile
          label="Average quiz score"
          value={average === null ? "—" : `${average}%`}
          hint="Best attempt per quiz"
        />
        <StatTile
          label="Checkpoints correct"
          value={checkpoints.percent === null ? "—" : `${checkpoints.percent}%`}
          hint={`${checkpoints.correct} of ${checkpoints.answered} in-video questions`}
        />
        <StatTile label="Quizzes to do" value={pending.length} hint={pending[0] ? `Next due ${formatDate(pending[0].due)}` : "All caught up"} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionTitle
            action={
              <Link href="/courses" className="text-sm font-medium text-primary-ink hover:underline">
                Browse all
              </Link>
            }
          >
            Your courses
          </SectionTitle>
          <Card>
            <ul>
              {courses.map((course) => {
                const progress = courseProgress(course, state);
                return (
                  <li key={course.id} className="border-t border-line first:border-t-0">
                    <Link href={`/courses/${course.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-2">
                      <CourseCover course={course} variant="thumb" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{course.title}</div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <Meter value={progress.percent} label={`${course.title} progress`} className="flex-1" />
                          <span className="w-24 shrink-0 text-right text-xs text-ink-3 tabular-nums">
                            {progress.done > 0 ? `${progress.done}/${progress.total} lessons` : "Not started"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="mt-8">
            <SectionTitle>For instructors</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {TEACH_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                  <link.icon aria-hidden className="size-5 text-ink-2" />
                  <div className="mt-3 text-sm font-medium">{link.title}</div>
                  <p className="mt-1 text-xs text-ink-3">{link.detail}</p>
                </Link>
              ))}
            </div>
          </div>
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
              {pending.length === 0 ? (
                <p className="p-4 text-sm text-ink-2">You&apos;ve taken every quiz. Nice work.</p>
              ) : (
                <ul>
                  {pending.slice(0, 4).map((quiz) => (
                    <li key={quiz.id} className="border-t border-line first:border-t-0">
                      <Link href={`/quizzes/${quiz.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{quiz.title}</div>
                          <div className="text-xs text-ink-3">
                            {getCourse(quiz.courseId)?.title} · due {formatDate(quiz.due)}
                          </div>
                        </div>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                      </Link>
                    </li>
                  ))}
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
              Ask for a simpler explanation, a real-world example, or a practice question — any time,
              on any lesson.
            </p>
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
