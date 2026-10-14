"use client";

import Link from "next/link";
import { ScoreTrendChart, type TrendPoint } from "@/components/charts";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageContainer,
  PageHeader,
  PageSkeleton,
} from "@/components/ui";
import { resetMyProgress, selectViewedChild, useViewedLearner } from "@/lib/api/progress";
import { courseLessons } from "@/lib/domain/course-outline";
import { letterGrade } from "@/lib/grading";
import {
  attemptsFor,
  awaitingMarking,
  bestAttempt,
  checkpointStats,
  courseGrade,
  overallGrade,
  quizzesOf,
} from "@/lib/progress";
import { formatDate } from "@/lib/utils";

export function GradesView() {
  // The student themselves, or the child a parent is viewing (US-05).
  const viewed = useViewedLearner();
  if (viewed === undefined) return <PageSkeleton />;
  if (!viewed) {
    return (
      <PageContainer>
        <PageHeader
          title="Grades"
          description="No student is linked to your account yet. Ask the school office to link your child."
        />
      </PageContainer>
    );
  }

  const { learner, progress: state, courses, quizzes: learnerQuizzes, readOnly, children } = viewed;
  const firstName = learner.name.split(" ")[0];
  const overall = overallGrade(state, courses, learnerQuizzes);
  const checkpoints = checkpointStats(state);
  const gradedCount = learnerQuizzes.filter((quiz) => bestAttempt(quiz.id, state.attempts)).length;
  const lessonTotal = courses.reduce((sum, course) => sum + courseLessons(course).length, 0);

  const trend: TrendPoint[] = [...state.attempts]
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
            ? `Scores appear here as soon as a quiz is graded. You can see ${firstName}'s results but not change them.`
            : "Quizzes are graded the moment you submit. Your best attempt on each quiz counts towards the course grade."
        }
        actions={
          readOnly && children.length > 1 ? (
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
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col justify-between gap-6 p-5">
          <div>
            <div className="text-sm text-ink-2">Overall average</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-tight">
                {overall === null ? "—" : `${overall}%`}
              </span>
              {overall !== null ? <Badge tone="primary">Grade {letterGrade(overall)}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {overall === null
                ? readOnly
                  ? "No quizzes graded yet."
                  : "Take a quiz to see your average."
                : `Across ${gradedCount} graded ${gradedCount === 1 ? "quiz" : "quizzes"}.`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <MiniStat label="Quizzes graded" value={`${gradedCount}/${learnerQuizzes.length}`} />
            <MiniStat
              label="Checkpoints right"
              value={checkpoints.percent === null ? "—" : `${checkpoints.percent}%`}
            />
            <MiniStat label="Lessons done" value={`${state.completedLessons.length}/${lessonTotal}`} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Quiz scores over time</h2>
          <p className="mb-3 text-sm text-ink-3">Every attempt, in the order it was submitted.</p>
          {trend.length > 0 ? (
            <ScoreTrendChart points={trend} passMark={70} />
          ) : (
            <p className="py-12 text-center text-sm text-ink-2">No attempts yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {courses.map((course) => {
          const grade = courseGrade(course, state, learnerQuizzes);
          const courseQuizzes = quizzesOf(course.id, learnerQuizzes);
          return (
            <Card key={course.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
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
                <div className="flex items-center gap-2">
                  {grade === null ? (
                    <span className="text-sm text-ink-3">Not graded yet</span>
                  ) : (
                    <>
                      <span className="text-xl font-semibold tabular-nums">{grade}%</span>
                      <Badge tone="primary">{letterGrade(grade)}</Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[46rem] table-fixed text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th scope="col" className="px-5 py-2.5 font-medium">Assessment</th>
                      <th scope="col" className="w-24 px-3 py-2.5 font-medium">Due</th>
                      <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Weight</th>
                      <th scope="col" className="w-24 px-3 py-2.5 text-right font-medium">Attempts</th>
                      <th scope="col" className="w-44 px-3 py-2.5 text-right font-medium">Best score</th>
                      {readOnly ? null : (
                        <th scope="col" className="w-28 px-5 py-2.5 font-medium">
                          <span className="sr-only">Action</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {courseQuizzes.map((quiz) => {
                      const best = bestAttempt(quiz.id, state.attempts);
                      const attemptCount = attemptsFor(quiz.id, state.attempts).length;
                      return (
                        <tr key={quiz.id} className="border-t border-line">
                          <th scope="row" className="px-5 py-3 text-left font-medium">{quiz.title}</th>
                          <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDate(quiz.due)}</td>
                          <td className="px-3 py-3 text-right text-ink-2 tabular-nums">{quiz.weight}%</td>
                          <td className="px-3 py-3 text-right text-ink-2 tabular-nums">{attemptCount}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                            {best ? (
                              <span className="inline-flex items-center gap-2">
                                <Badge tone={best.percent >= quiz.passMark ? "good" : "bad"}>
                                  {best.percent >= quiz.passMark ? "Passed" : "Below pass"}
                                </Badge>
                                <span className="font-medium">{best.percent}%</span>
                              </span>
                            ) : awaitingMarking(quiz.id, state.attempts) ? (
                              <Badge tone="warn">Awaiting marking</Badge>
                            ) : (
                              <span className="text-ink-3">Not taken</span>
                            )}
                          </td>
                          {readOnly ? null : (
                            <td className="px-5 py-3 text-right">
                              <ButtonLink variant={best ? "ghost" : "secondary"} size="sm" href={`/quizzes/${quiz.id}`}>
                                {best ? "Retake" : "Start"}
                              </ButtonLink>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}
