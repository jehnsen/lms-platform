"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { ScoreTrendChart, type TrendPoint } from "@/components/charts";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageContainer,
  PageHeader,
  PageSkeleton,
  ScrollRegion,
} from "@/components/ui";
import { useViewedGrades, type LearnerCourseGrade } from "@/lib/api/grades";
import { resetMyProgress, selectViewedChild } from "@/lib/api/progress";
import { courseLessons } from "@/lib/domain/course-outline";
import { formatPercent, type ItemScore } from "@/lib/domain/gradebook";
import { isFinal } from "@/lib/domain/quizzes";
import { gradeBeside } from "@/lib/grading";
import { attemptsFor, checkpointStats } from "@/lib/progress";
import type { LearnerProgress } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** US-17: the learner's released grades and feedback, with a running total for each course. */
export function GradesView() {
  // The student themselves, or the child a parent is viewing (US-05).
  const grades = useViewedGrades();
  if (grades === undefined) return <PageSkeleton />;
  if (!grades) {
    return (
      <PageContainer>
        <PageHeader
          title="Grades"
          description="No student is linked to your account yet. Ask the school office to link your child."
        />
      </PageContainer>
    );
  }

  const { viewed, courses, overall, overallScale } = grades;
  const { learner, progress: state, quizzes: learnerQuizzes, readOnly, children } = viewed;
  const firstName = learner.name.split(" ")[0];
  const checkpoints = checkpointStats(state);
  const scores = courses.flatMap((entry) => entry.scores.filter((score) => score.state !== "exempt"));
  const gradedCount = scores.filter((score) => score.state === "graded").length;
  const lessonTotal = viewed.courses.reduce((sum, course) => sum + courseLessons(course).length, 0);
  const overallGrade = overall === null ? null : gradeBeside(overall, overallScale);

  // Scores that count: an attempt still being marked, or held back, has none to plot.
  const trend: TrendPoint[] = state.attempts
    .filter(isFinal)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((attempt) => ({
      id: attempt.id,
      title: learnerQuizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? "Quiz",
      dateLabel: formatDate(attempt.submittedAt),
      percent: attempt.percent,
    }));

  return (
    <PageContainer>
      <PageHeader
        title={readOnly ? `${firstName}'s grades` : "My grades"}
        description={
          readOnly
            ? `Grades appear here as soon as a teacher releases them. You can see ${firstName}'s results but not change them.`
            : "Grades appear here as soon as they are released. Each course shows a running total of the released grades."
        }
        actions={
          <>
            {readOnly && children.length > 1 ? (
              <>
                <label htmlFor="viewed-child" className="text-sm text-ink-2">
                  Student
                </label>
                <select
                  id="viewed-child"
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
            <ButtonLink variant="secondary" href="/reports">
              <FileText aria-hidden className="size-4" />
              Progress report
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col justify-between gap-6 p-5">
          <div>
            <div className="text-sm text-ink-2">Overall average</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-tight">{overall === null ? "—" : `${overall}%`}</span>
              {overallGrade ? <Badge tone="primary">{overallGrade}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {overall === null
                ? "No grades have been released yet."
                : "The average of the course totals below."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <MiniStat label="Work graded" value={`${gradedCount}/${scores.length}`} />
            <MiniStat label="Checkpoints right" value={checkpoints.percent === null ? "—" : `${checkpoints.percent}%`} />
            <MiniStat label="Lessons done" value={`${state.completedLessons.length}/${lessonTotal}`} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Quiz scores over time</h2>
          <p className="mb-3 text-sm text-ink-3">Every marked attempt, in the order it was handed in.</p>
          {trend.length > 0 ? (
            <ScoreTrendChart points={trend} passMark={70} />
          ) : (
            <p className="py-12 text-center text-sm text-ink-2">No quiz scores yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {courses.map((entry) => (
          <CourseGrades key={entry.course.id} entry={entry} state={state} readOnly={readOnly} />
        ))}
        {courses.length === 0 ? (
          <p className="text-sm text-ink-2">{readOnly ? `${firstName} is` : "You are"} not enrolled in any courses yet.</p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3">
        <p>Progress is stored in this browser only while the app runs on mock data.</p>
        {readOnly ? null : (
          <Button variant="ghost" size="sm" onClick={() => void resetMyProgress()}>
            Reset demo progress
          </Button>
        )}
      </div>
    </PageContainer>
  );
}

function CourseGrades({ entry, state, readOnly }: { entry: LearnerCourseGrade; state: LearnerProgress; readOnly: boolean }) {
  const { course, total, scale, setup } = entry;
  const scores = entry.scores.filter((score) => score.state !== "exempt");
  const categoryName = (categoryId: string) => setup.categories.find((category) => category.id === categoryId)?.name ?? "—";
  const beside = total.percent === null ? null : gradeBeside(total.percent, scale);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold">
            {readOnly ? (
              course.title
            ) : (
              <Link href={`/courses/${course.id}`} className="hover:underline">
                {course.title}
              </Link>
            )}
          </h2>
          <p className="text-sm text-ink-3">{course.instructor}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-3">Running total</div>
          <div className="flex items-center justify-end gap-2">
            {total.percent === null ? (
              <span className="text-sm text-ink-3">Not graded yet</span>
            ) : (
              <>
                <span className="text-xl font-semibold tabular-nums">{total.percent}%</span>
                {beside ? <Badge tone="primary">{beside}</Badge> : null}
              </>
            )}
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-5 py-2.5 text-sm" aria-label="Grade so far in each category">
        {total.categories.map(({ category, percent }) => (
          <li key={category.id}>
            <span className="text-ink-2">
              {category.name} ({category.weight}%):
            </span>{" "}
            <span className="font-medium tabular-nums">{percent === null ? "no grades yet" : `${percent}%`}</span>
          </li>
        ))}
      </ul>

      {scores.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-2">Nothing to grade in this course yet.</p>
      ) : (
        <ScrollRegion label={`Grades in ${course.title}`}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-5 py-2.5 font-medium">Assessment</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Score</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                {readOnly ? null : (
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {scores.map((score) => {
                const { item } = score;
                const feedback = item.kind === "assignment" ? entry.latest[item.id]?.grade?.feedback : undefined;
                const attempts = item.kind === "quiz" ? attemptsFor(item.id, state.attempts).length : 0;
                return (
                  <tr key={item.id} className="border-t border-line align-top">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      {item.title}
                      <span className="block text-xs font-normal text-ink-3">
                        {item.kind === "quiz"
                          ? `Quiz · ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`
                          : "Assignment"}
                      </span>
                      {feedback ? (
                        <details className="mt-1.5 text-sm font-normal">
                          <summary className="cursor-pointer text-primary-ink">Teacher&apos;s feedback</summary>
                          <p className="mt-1 max-w-prose whitespace-pre-wrap text-ink-2">{feedback}</p>
                        </details>
                      ) : null}
                    </th>
                    <td className="px-3 py-3 text-ink-2">{categoryName(item.categoryId)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDate(item.due)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {score.state === "graded" && score.percent !== null ? (
                        <>
                          <span className="font-medium">{formatPercent(score.percent)}</span>
                          <span className="block text-xs text-ink-3">
                            {score.earned} of {item.points} points
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-3">
                          <span aria-hidden>—</span>
                          <span className="sr-only">No score yet</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge score={score} />
                    </td>
                    {readOnly ? null : (
                      <td className="px-5 py-3 text-right">
                        <ButtonLink
                          variant={score.state === "upcoming" || score.state === "missing" ? "secondary" : "ghost"}
                          size="sm"
                          href={item.kind === "quiz" ? `/quizzes/${item.id}` : `/assignments/${item.id}`}
                        >
                          {item.kind === "assignment" ? "Open" : attempts > 0 ? "Retake" : "Start"}
                          <span className="sr-only"> {item.title}</span>
                        </ButtonLink>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollRegion>
      )}
      <p className="border-t border-line px-5 py-2.5 text-xs text-ink-3">
        The running total counts released grades only.{" "}
        {setup.missingAsZero
          ? "Work not handed in by its due date counts as zero."
          : "Work with no grade yet is left out."}
      </p>
    </Card>
  );
}

function StatusBadge({ score }: { score: ItemScore }) {
  const { item } = score;
  switch (score.state) {
    case "graded":
      if (item.passMark === undefined || score.percent === null) return <Badge tone="good">Graded</Badge>;
      return score.percent >= item.passMark ? <Badge tone="good">Passed</Badge> : <Badge tone="bad">Below pass</Badge>;
    case "to-mark":
      return <Badge tone="warn">{item.kind === "quiz" ? "Awaiting marking" : "Handed in · awaiting grade"}</Badge>;
    case "held":
      return <Badge tone="warn">Grade not released yet</Badge>;
    case "missing":
      return <Badge tone="bad">Missing</Badge>;
    default:
      return <span className="text-ink-3">{item.kind === "quiz" ? "Not taken" : "Not handed in"}</span>;
  }
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}
