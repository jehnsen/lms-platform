"use client";

import { useState } from "react";
import { ArrowDownUp, Download, Search, TriangleAlert } from "lucide-react";
import { ColumnChart, type Column } from "@/components/charts";
import { Badge, Button, Card, PageContainer, PageHeader, StatTile } from "@/components/ui";
import { courses } from "@/lib/data/courses";
import { currentUser, students } from "@/lib/data/people";
import { quizzesForCourse } from "@/lib/data/quizzes";
import { letterGrade } from "@/lib/grading";
import { bestAttempt, weightedGrade } from "@/lib/progress";
import { useLearner } from "@/lib/store";
import type { Quiz } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  isYou: boolean;
  scores: Array<number | null>;
  overall: number | null;
  missing: number;
}

const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "Below 60", min: 0, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

const PASS_MARK = 70;

function buildRow(id: string, name: string, isYou: boolean, quizzes: Quiz[], scoreFor: (quiz: Quiz) => number | null): Row {
  const scores = quizzes.map(scoreFor);
  return {
    id,
    name,
    isYou,
    scores,
    overall: weightedGrade(quizzes.map((quiz, index) => ({ weight: quiz.weight, percent: scores[index] }))),
    missing: scores.filter((score) => score === null).length,
  };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function GradebookView() {
  const state = useLearner();
  const [courseId, setCourseId] = useState(courses[0].id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "overall">("name");

  const course = courses.find((item) => item.id === courseId) ?? courses[0];
  const quizzes = quizzesForCourse(course.id);

  const rows: Row[] = [
    // The signed-in learner's row is live: it reflects quizzes taken in this browser.
    buildRow(currentUser.id, currentUser.name, true, quizzes, (quiz) => bestAttempt(quiz.id, state.attempts)?.percent ?? null),
    ...students.map((student) =>
      buildRow(student.id, student.name, false, quizzes, (quiz) => student.scores[quiz.id] ?? null),
    ),
  ];

  const graded = rows.filter((row): row is Row & { overall: number } => row.overall !== null);
  const classAverage = graded.length
    ? Math.round(graded.reduce((sum, row) => sum + row.overall, 0) / graded.length)
    : null;
  const totalCells = rows.length * quizzes.length;
  const submitted = totalCells - rows.reduce((sum, row) => sum + row.missing, 0);
  const needsAttention = rows.filter(
    (row) => (row.overall !== null && row.overall < PASS_MARK) || row.missing > 0,
  );

  const bands: Column[] = BANDS.map((band) => {
    const inBand = graded.filter((row) => row.overall >= band.min && row.overall <= band.max);
    return {
      label: band.label,
      value: inBand.length,
      valueLabel: `${inBand.length} ${inBand.length === 1 ? "learner" : "learners"}`,
      detail: inBand.map((row) => row.name).join(", ") || undefined,
    };
  });

  const visible = rows
    .filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : (b.overall ?? -1) - (a.overall ?? -1),
    );

  const exportCsv = () =>
    downloadCsv(`${course.id}-gradebook.csv`, [
      ["Student", ...quizzes.map((quiz) => quiz.title), "Overall", "Grade"],
      ...rows.map((row) => [
        row.name,
        ...row.scores.map((score) => (score === null ? "" : String(score))),
        row.overall === null ? "" : String(row.overall),
        row.overall === null ? "" : letterGrade(row.overall),
      ]),
    ]);

  return (
    <PageContainer>
      <PageHeader
        title="Gradebook"
        description="Scores arrive here automatically when learners submit a quiz. No manual marking."
        actions={
          <>
            <label className="sr-only" htmlFor="gradebook-course">
              Course
            </label>
            <select
              id="gradebook-course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm"
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={exportCsv}>
              <Download aria-hidden className="size-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label="Class average"
            value={classAverage === null ? "—" : `${classAverage}%`}
            hint={classAverage === null ? undefined : `Grade ${letterGrade(classAverage)}`}
          />
          <StatTile
            label="Submission rate"
            value={`${totalCells ? Math.round((submitted / totalCells) * 100) : 0}%`}
            hint={`${submitted} of ${totalCells} submitted`}
          />
          <StatTile
            label="Need attention"
            value={needsAttention.length}
            hint="Below pass mark or missing work"
          />
          <Card className="col-span-2 p-4 sm:col-span-3 lg:col-span-2 xl:col-span-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert aria-hidden className="size-4 text-warn" />
              Follow up with
            </h2>
            {needsAttention.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Everyone is on track.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {needsAttention.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{row.name}</span>
                    <span className="flex gap-1.5">
                      {row.overall !== null && row.overall < PASS_MARK ? (
                        <Badge tone="bad">Average {row.overall}%</Badge>
                      ) : null}
                      {row.missing > 0 ? <Badge tone="warn">{row.missing} missing</Badge> : null}
                    </span>
                  </li>
                ))}
                {needsAttention.length > 5 ? (
                  <li className="text-ink-3">and {needsAttention.length - 5} more</li>
                ) : null}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="font-semibold">Overall grade distribution</h2>
          <p className="mb-4 text-sm text-ink-3">Learners per score band, {course.title}.</p>
          <ColumnChart columns={bands} ariaLabel="Learners per overall grade band" />
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <label htmlFor="gradebook-search" className="sr-only">
              Search learners
            </label>
            <input
              id="gradebook-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search learners"
              className="h-9 w-56 rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-primary"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSort(sort === "name" ? "overall" : "name")}>
            <ArrowDownUp aria-hidden className="size-4" />
            Sorted by {sort === "name" ? "name" : "overall grade"}
          </Button>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-medium">Learner</th>
                {quizzes.map((quiz, index) => (
                  <th key={quiz.id} scope="col" title={quiz.title} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    Quiz {index + 1} <span className="font-normal">· {quiz.weight}%</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Overall</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className={cn("border-t border-line", row.isYou && "bg-primary-soft/40")}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                    {row.name}
                    {row.isYou ? <Badge tone="primary" className="ml-2">You · live</Badge> : null}
                  </th>
                  {row.scores.map((score, index) => (
                    <td key={quizzes[index].id} className="px-3 py-2.5 text-right tabular-nums">
                      <ScoreCell score={score} passMark={quizzes[index].passMark} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    <ScoreCell score={row.overall} passMark={PASS_MARK} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.overall === null ? <span className="text-ink-3">—</span> : letterGrade(row.overall)}
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr className="border-t border-line">
                  <td colSpan={quizzes.length + 3} className="px-4 py-8 text-center text-ink-2">
                    No learners match “{query}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">
          <span className="text-bad">▾</span> marks a score below the pass mark. Overall is the weighted
          average of submitted quizzes.
        </p>
      </Card>
    </PageContainer>
  );
}

function ScoreCell({ score, passMark }: { score: number | null; passMark: number }) {
  if (score === null) return <span className="font-normal text-ink-3">Missing</span>;
  if (score < passMark) {
    return (
      <span className="text-bad">
        <span aria-hidden>▾ </span>
        {score}%<span className="sr-only"> (below pass mark)</span>
      </span>
    );
  }
  return <span>{score}%</span>;
}
