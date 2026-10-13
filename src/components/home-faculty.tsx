"use client";

import Link from "next/link";
import { ArrowUpRight, Clapperboard, Table2, WandSparkles } from "lucide-react";
import { CourseCover } from "@/components/course-art";
import { PageContainer, PageHeader, SectionTitle } from "@/components/ui";
import { useCourses } from "@/lib/api/courses";
import { useGradebook } from "@/lib/api/grades";
import { useActor } from "@/lib/api/session";
import { quizzesForCourse } from "@/lib/data/quizzes";
import { bestAttempt, courseGrade } from "@/lib/progress";
import type { Course } from "@/lib/types";
import { firstNameOf } from "@/lib/utils";

const TEACH_LINKS = [
  {
    href: "/gradebook",
    icon: Table2,
    title: "Open the gradebook",
    detail: "Auto-graded scores for each class.",
  },
  {
    href: "/content",
    icon: Clapperboard,
    title: "Upload video and captions",
    detail: "Add study materials to a course.",
  },
  {
    href: "/lesson-planner",
    icon: WandSparkles,
    title: "Generate a lesson plan",
    detail: "Week-by-week plan with timings and assessments.",
  },
];

/** Faculty home. The full class dashboard (US-26) replaces the summary cards in Phase 7. */
export function FacultyHome() {
  const actor = useActor();
  const courses = useCourses();

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${actor ? firstNameOf(actor.name) : ""}`}
        description={
          courses.length === 0
            ? "No courses are assigned to you this term."
            : `You teach ${courses.length} ${courses.length === 1 ? "course" : "courses"} this term.`
        }
      />

      {courses.length > 0 ? (
        <section>
          <SectionTitle>Your courses</SectionTitle>
          <ul className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id}>
                <TeachingCourseCard course={course} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionTitle>Teaching tools</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TEACH_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink">
                <link.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{link.title}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{link.detail}</span>
              </span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
            </Link>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function TeachingCourseCard({ course }: { course: Course }) {
  const entries = useGradebook(course.id) ?? [];
  const quizzes = quizzesForCourse(course.id);

  const grades = entries
    .map((entry) => courseGrade(course, entry.progress))
    .filter((grade): grade is number => grade !== null);
  const average = grades.length
    ? Math.round(grades.reduce((sum, grade) => sum + grade, 0) / grades.length)
    : null;
  const expected = entries.length * quizzes.length;
  const submitted = entries.reduce(
    (sum, entry) => sum + quizzes.filter((quiz) => bestAttempt(quiz.id, entry.progress.attempts)).length,
    0,
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <CourseCover course={course} sizes="(min-width: 768px) 28rem, 100vw" className="aspect-3/1">
        <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          {course.code}
        </span>
      </CourseCover>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-medium text-balance">{course.title}</h3>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-3">Learners</dt>
            <dd className="font-semibold tabular-nums">{entries.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Class average</dt>
            <dd className="font-semibold tabular-nums">{average === null ? "—" : `${average}%`}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Quizzes submitted</dt>
            <dd className="font-semibold tabular-nums">
              {submitted}/{expected}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <Link href={`/courses/${course.id}`} className="text-primary-ink hover:underline">
            Preview course
          </Link>
          <Link href="/gradebook" className="text-primary-ink hover:underline">
            Gradebook
          </Link>
        </div>
      </div>
    </div>
  );
}
