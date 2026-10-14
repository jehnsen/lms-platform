"use client";

import Link from "next/link";
import { Badge, Card, ButtonLink, Meter, PageContainer, PageHeader, SectionTitle } from "@/components/ui";
import { useViewedAttendance } from "@/lib/api/attendance";
import { useViewedGrades } from "@/lib/api/grades";
import { selectViewedChild } from "@/lib/api/progress";
import { useActor } from "@/lib/api/session";
import { formatRate } from "@/lib/domain/attendance";
import { isFinal } from "@/lib/domain/quizzes";
import { gradeBeside, percentAndGrade } from "@/lib/grading";
import { courseProgress } from "@/lib/progress";
import { firstNameOf, formatDate } from "@/lib/utils";

/**
 * Parent home (US-05): one linked child's results and attendance, read-only.
 * Announcements join it when that feature exists (Phase 6).
 */
export function ParentHome() {
  const actor = useActor();
  const grades = useViewedGrades();
  const attendance = useViewedAttendance();
  const greeting = `Welcome, ${actor ? firstNameOf(actor.name) : ""}`;

  if (!grades) {
    return (
      <PageContainer>
        <PageHeader
          title={greeting}
          description="No student is linked to your account yet. Ask the school office to link your child."
        />
      </PageContainer>
    );
  }

  const { learner, progress, quizzes, children } = grades.viewed;
  const childName = firstNameOf(learner.name);
  const { overall, overallScale } = grades;
  // Scores that count: not waiting for a teacher, and released (US-17).
  const recent = progress.attempts
    .filter(isFinal)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 4);

  return (
    <PageContainer>
      <PageHeader
        title={greeting}
        description={`Here is how ${childName} is doing this term. You can view results but not change them.`}
        actions={
          <>
            {children.length > 1 ? (
              <>
                <label htmlFor="home-child" className="text-sm text-ink-2">
                  Student
                </label>
                <select
                  id="home-child"
                  value={learner.id}
                  onChange={(event) => void selectViewedChild(event.target.value)}
                  className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <ButtonLink href="/grades">See all grades</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle>{childName}&apos;s courses</SectionTitle>
          <Card>
            <ul>
              {grades.courses.map(({ course, total, scale }) => {
                const grade = total.percent;
                const lessons = courseProgress(course, progress);
                return (
                  <li key={course.id} className="border-t border-line p-4 first:border-t-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        <div className="font-medium">{course.title}</div>
                        <div className="text-xs text-ink-3">{course.instructor}</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {grade === null ? (
                          <span className="font-normal text-ink-3">Not graded yet</span>
                        ) : (
                          percentAndGrade(grade, scale)
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Meter value={lessons.percent} label={`${course.title} lessons completed`} className="flex-1" />
                      <span className="shrink-0 text-xs text-ink-2 tabular-nums">
                        {lessons.done}/{lessons.total} lessons
                      </span>
                    </div>
                  </li>
                );
              })}
              {grades.courses.length === 0 ? (
                <li className="p-4 text-sm text-ink-2">{childName} is not enrolled in any courses yet.</li>
              ) : null}
            </ul>
          </Card>
        </section>

        <div className="flex flex-col gap-8">
          <Card className="p-5">
            <div className="text-sm text-ink-2">Overall average</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">
              {overall === null ? "—" : `${overall}%`}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {overall === null
                ? "Nothing is graded yet."
                : [gradeBeside(overall, overallScale), "Across the course grades released so far."].filter(Boolean).join(". ")}
            </p>
          </Card>

          <section>
            <SectionTitle
              action={
                <Link href="/attendance" className="text-sm font-medium text-primary-ink hover:underline">
                  Details
                </Link>
              }
            >
              Attendance
            </SectionTitle>
            <Card>
              {!attendance || attendance.courses.every((entry) => entry.summary.recorded === 0) ? (
                <p className="p-4 text-sm text-ink-2">No attendance has been recorded yet.</p>
              ) : (
                <ul>
                  {attendance.courses.map((entry) => (
                    <li
                      key={entry.course.id}
                      className="flex items-center justify-between gap-3 border-t border-line p-3.5 first:border-t-0"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{entry.course.title}</span>
                      <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
                        {entry.below ? <Badge tone="bad">Below {attendance.policy.thresholdPercent}%</Badge> : null}
                        {formatRate(entry.summary.rate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Recent results</SectionTitle>
            <Card>
              {recent.length === 0 ? (
                <p className="p-4 text-sm text-ink-2">Nothing has been graded yet.</p>
              ) : (
                <ul>
                  {recent.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="flex items-center justify-between gap-3 border-t border-line p-3.5 first:border-t-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {quizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? "Quiz"}
                        </span>
                        <span className="block text-xs text-ink-3">{formatDate(attempt.submittedAt)}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{attempt.percent}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
