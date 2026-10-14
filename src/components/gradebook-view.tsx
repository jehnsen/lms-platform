"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { ArrowDownUp, Download, Search, Send, Settings2, TriangleAlert } from "lucide-react";
import { ColumnChart, type Column } from "@/components/charts";
import { GradebookSetupDialog } from "@/components/gradebook-setup-dialog";
import { SisExportDialog } from "@/components/sis-export-dialog";
import { Badge, Button, Card, PageContainer, PageHeader, StatTile } from "@/components/ui";
import { releaseGrades } from "@/lib/api/assignments";
import { useCourses } from "@/lib/api/courses";
import {
  logGradebookExport,
  setQuizGradesHeld,
  useGradebook,
  type Gradebook,
  type GradebookEntry,
  type ItemSummary,
} from "@/lib/api/grades";
import { useActor } from "@/lib/api/session";
import { averageOf, formatPercent, type GradeItem, type ItemScore } from "@/lib/domain/gradebook";
import { can } from "@/lib/domain/permissions";
import { SCALE_KIND_LABELS, gradeBeside, gradeOnScale } from "@/lib/grading";
import { downloadCsv } from "@/lib/download";
import { formatDate } from "@/lib/utils";

const BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "Below 60", min: 0, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

const PASS_MARK = 70;

/** Short column names: Q1, Q2 for quizzes and A1, A2 for assignments, in due order. */
function itemCodes(items: GradeItem[]): Record<string, string> {
  const counts = { quiz: 0, assignment: 0 };
  return Object.fromEntries(
    items.map((item) => {
      counts[item.kind] += 1;
      return [item.id, `${item.kind === "quiz" ? "Q" : "A"}${counts[item.kind]}`];
    }),
  );
}

export function GradebookView() {
  const actor = useActor();
  const courses = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "overall">("name");
  const [dialog, setDialog] = useState<"setup" | "sis" | null>(null);

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setDialog(null);
  }, []);

  const course = courses.find((item) => item.id === selectedCourseId) ?? courses[0];
  // Every enrolled learner with a score for each grade item; null if this role may not see the course.
  const book = useGradebook(course?.id ?? "");

  if (!course || !book) {
    return (
      <PageContainer>
        <PageHeader title="Gradebook" description="No courses are assigned to you yet." />
      </PageContainer>
    );
  }

  const { items, scale, setup } = book;
  const codes = itemCodes(items);
  const sections = [...new Map(book.entries.flatMap((entry) => (entry.section ? [[entry.section.id, entry.section]] : []))).values()];
  const rows = book.entries.filter((entry) => sectionId === "all" || entry.section?.id === sectionId);
  // US-18: only an administrator sends grades to the SIS.
  const canSis = can(actor, "create", { type: "sis-export" });

  const graded = rows.filter((row) => row.total.percent !== null);
  const classAverage = averageOf(rows.map((row) => row.total.percent));
  const applies = rows.flatMap((row) => row.scores.filter((score) => score.state !== "exempt" && score.state !== "upcoming"));
  const handedIn = applies.filter((score) => score.state !== "missing").length;
  const needsAttention = rows.filter(
    (row) => (row.total.percent !== null && row.total.percent < PASS_MARK) || row.total.counts.missing > 0,
  );

  const bands: Column[] = BANDS.map((band) => {
    const inBand = graded.filter((row) => row.total.percent! >= band.min && row.total.percent! <= band.max);
    return {
      label: band.label,
      value: inBand.length,
      valueLabel: `${inBand.length} ${inBand.length === 1 ? "learner" : "learners"}`,
      detail: inBand.map((row) => row.student.name).join(", ") || undefined,
    };
  });

  const visible = rows
    .filter((row) => row.student.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "name" ? a.student.name.localeCompare(b.student.name) : (b.total.percent ?? -1) - (a.total.percent ?? -1),
    );

  const exportCsv = async () => {
    // Authorized and written to the audit log before the file is produced.
    await logGradebookExport(course.id, rows.length);
    downloadCsv(`${course.id}-gradebook.csv`, [
      ["Student", "Section", ...items.map((item) => item.title), ...setup.categories.map((category) => `${category.name} (%)`), "Total (%)", "Grade"],
      ...rows.map((row) => [
        row.student.name,
        row.section?.name ?? "",
        ...row.scores.map((score) => (score.percent === null ? "" : String(score.percent))),
        ...row.total.categories.map((category) => (category.percent === null ? "" : String(category.percent))),
        row.total.percent === null ? "" : String(row.total.percent),
        row.total.percent === null ? "" : gradeOnScale(row.total.percent, scale),
      ]),
    ]);
  };

  const selectClass = "h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm";

  return (
    <PageContainer>
      <PageHeader
        // FR-1.8: an archived course keeps its grades, viewable and exportable.
        eyebrow={course.status === "archived" ? <Badge tone="warn">Archived term · read-only</Badge> : undefined}
        title="Gradebook"
        description="Quizzes and assignments, weighted by category. Totals follow every new score, and every change to the weights."
        actions={
          <>
            <label className="sr-only" htmlFor="gradebook-course">
              Course
            </label>
            <select
              id="gradebook-course"
              value={course.id}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSectionId("all");
              }}
              className={selectClass}
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="gradebook-section">
              Section
            </label>
            <select
              id="gradebook-section"
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              className={selectClass}
            >
              <option value="all">All sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => void exportCsv()}>
              <Download aria-hidden className="size-4" />
              Export CSV
            </Button>
            {canSis ? (
              <Button variant="secondary" onClick={() => setDialog("sis")}>
                <Send aria-hidden className="size-4" />
                Export to SIS
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label="Class average"
            value={classAverage === null ? "—" : `${classAverage}%`}
            hint={classAverage === null ? undefined : (gradeBeside(classAverage, scale) ?? undefined)}
          />
          <StatTile
            label="Handed in"
            value={`${applies.length ? Math.round((handedIn / applies.length) * 100) : 0}%`}
            hint={`${handedIn} of ${applies.length} pieces of work due so far`}
          />
          <StatTile label="Need attention" value={needsAttention.length} hint="Below 70% or missing work" />
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
                  <li key={row.student.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{row.student.name}</span>
                    <span className="flex gap-1.5">
                      {row.total.percent !== null && row.total.percent < PASS_MARK ? (
                        <Badge tone="bad">Total {row.total.percent}%</Badge>
                      ) : null}
                      {row.total.counts.missing > 0 ? <Badge tone="warn">{row.total.counts.missing} missing</Badge> : null}
                    </span>
                  </li>
                ))}
                {needsAttention.length > 5 ? <li className="text-ink-3">and {needsAttention.length - 5} more</li> : null}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="font-semibold">Course total distribution</h2>
          <p className="mb-4 text-sm text-ink-3">Learners per score band, {course.title}.</p>
          <ColumnChart columns={bands} ariaLabel="Learners per course total band" />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SetupCard book={book} onEdit={() => setDialog("setup")} />
        {/* Keyed by course, so a release message does not follow the teacher to another course. */}
        <ItemsCard key={course.id} book={book} codes={codes} />
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
              className="h-9 w-56 max-w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-primary"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSort(sort === "name" ? "overall" : "name")}>
            <ArrowDownUp aria-hidden className="size-4" />
            Sorted by {sort === "name" ? "name" : "course total"}
          </Button>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-medium">Learner</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Section</th>
                {items.map((item) => (
                  <th key={item.id} scope="col" title={item.title} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    <span aria-hidden>{codes[item.id]}</span>
                    <span className="sr-only">{item.title}</span>
                    <span className="font-normal"> · {item.points} pts</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                {scale.kind === "percentage" ? null : (
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {scale.kind === "gpa" ? "GPA" : "Grade"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <GradebookRow key={row.student.id} row={row} scale={book.scale} />
              ))}
              {visible.length === 0 ? (
                <tr className="border-t border-line">
                  <td colSpan={items.length + 4} className="px-4 py-8 text-center text-ink-2">
                    {rows.length === 0 ? "Nobody is enrolled yet." : `No learners match “${query}”.`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">
          <span className="text-bad">▾</span> a quiz score below its pass mark, or a total below {PASS_MARK}%.{" "}
          <span className="text-warn">*</span> a mark the student cannot see yet.{" "}
          {setup.missingAsZero
            ? "Missing work counts as zero in the total."
            : "The total is the grade so far: work with no grade is left out."}
        </p>
      </Card>

      {dialog === "setup" ? (
        <GradebookSetupDialog
          courseId={course.id}
          courseTitle={course.title}
          setup={setup}
          scales={book.scales}
          items={items}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "sis" ? (
        <SisExportDialog
          courseIds={[course.id]}
          label={`${course.code} · ${course.title}`}
          fileName={`${course.code.toLowerCase()}-final-grades`}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </PageContainer>
  );
}

function GradebookRow({ row, scale }: { row: GradebookEntry; scale: Gradebook["scale"] }) {
  const { percent } = row.total;
  return (
    <tr className="border-t border-line">
      <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
        {row.student.name}
      </th>
      <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{row.section?.name ?? "—"}</td>
      {row.scores.map((score) => (
        <td key={score.item.id} className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
          <ScoreCell score={score} />
        </td>
      ))}
      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
        {percent === null ? (
          <span className="font-normal text-ink-3">—</span>
        ) : percent < PASS_MARK ? (
          <span className="text-bad">
            <span aria-hidden>▾ </span>
            {percent}%<span className="sr-only"> (below {PASS_MARK}%)</span>
          </span>
        ) : (
          `${percent}%`
        )}
      </td>
      {scale.kind === "percentage" ? null : (
        <td className="px-4 py-2.5 text-right tabular-nums">
          {percent === null ? <span className="text-ink-3">—</span> : gradeOnScale(percent, scale)}
        </td>
      )}
    </tr>
  );
}

function ScoreCell({ score }: { score: ItemScore }) {
  switch (score.state) {
    case "to-mark":
      return <span className="text-warn">To mark</span>;
    case "missing":
      return <span className="text-ink-3">Missing</span>;
    case "upcoming":
      return (
        <span className="text-ink-3">
          <span aria-hidden>—</span>
          <span className="sr-only">Not due yet</span>
        </span>
      );
    case "exempt":
      return (
        <span className="text-ink-3">
          <span aria-hidden>n/a</span>
          <span className="sr-only">Not set for this section</span>
        </span>
      );
    default: {
      const percent = score.percent ?? 0;
      const below = score.item.passMark !== undefined && percent < score.item.passMark;
      return (
        <span className={below ? "text-bad" : undefined}>
          {below ? <span aria-hidden>▾ </span> : null}
          {formatPercent(percent)}
          {below ? <span className="sr-only"> (below pass mark)</span> : null}
          {score.unreleased ? (
            <>
              <span aria-hidden className="text-warn">
                *
              </span>
              <span className="sr-only"> (not released to the student)</span>
            </>
          ) : null}
        </span>
      );
    }
  }
}

/** FR-4.1, FR-4.2: how the course total is worked out, and the way in to change it. */
function SetupCard({ book, onEdit }: { book: Gradebook; onEdit: () => void }) {
  const { setup, scale, items } = book;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">How this course is graded</h2>
          <p className="text-sm text-ink-3">
            {scale.name} scale ({SCALE_KIND_LABELS[scale.kind].toLowerCase()})
          </p>
        </div>
        {book.canEdit ? (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Settings2 aria-hidden className="size-4" />
            Set up grading
          </Button>
        ) : null}
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th scope="col" className="py-1.5 font-medium">Category</th>
            <th scope="col" className="py-1.5 text-right font-medium">Items</th>
            <th scope="col" className="py-1.5 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {setup.categories.map((category) => (
            <tr key={category.id} className="border-t border-line">
              <th scope="row" className="py-2 text-left font-medium">{category.name}</th>
              <td className="py-2 text-right text-ink-2 tabular-nums">
                {items.filter((item) => item.categoryId === category.id).length}
              </td>
              <td className="py-2 text-right tabular-nums">{category.weight}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-3">
        {setup.missingAsZero
          ? "Work not handed in by its due date counts as zero."
          : "Work with no grade yet is left out of the total."}{" "}
        A category with nothing graded gives its share to the others.
      </p>
    </Card>
  );
}

/** FR-4.3: every grade item, how far its marking has got, and whether students can see its grades. */
function ItemsCard({ book, codes }: { book: Gradebook; codes: Record<string, string> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState("");
  const categoryName = (categoryId: string) =>
    book.setup.categories.find((category) => category.id === categoryId)?.name ?? "—";

  const run = async (summary: ItemSummary, work: () => Promise<string>) => {
    setBusyId(summary.item.id);
    setNote("");
    setFailure("");
    try {
      setNote(await work());
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const people = (count: number) => `${count} ${count === 1 ? "student" : "students"}`;

  const release = (summary: ItemSummary) => {
    const { item } = summary;
    if (item.kind === "assignment") {
      return run(summary, async () => {
        const released = await releaseGrades(item.id);
        return `Released ${released} ${released === 1 ? "grade" : "grades"} for ${item.title}. Each student has been notified.`;
      });
    }
    return run(summary, async () => {
      const told = await setQuizGradesHeld(item.id, false);
      return `Scores for ${item.title} are released. ${people(told)} notified.`;
    });
  };

  const hold = (summary: ItemSummary) =>
    run(summary, async () => {
      await setQuizGradesHeld(summary.item.id, true);
      return `Scores for ${summary.item.title} are held. Students see that they handed in, and no score, until you release them.`;
    });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="font-semibold">Grade items and release</h2>
        <p className="text-sm text-ink-3">Students see a grade, and it counts in their total, only once it is released.</p>
      </div>
      {/* Always rendered, so the outcome of a release is announced (NFR-5). */}
      <p role="status" className="px-5 text-sm text-good">
        {note}
      </p>
      {failure ? (
        <p role="alert" className="px-5 text-sm text-bad">
          {failure}
        </p>
      ) : null}
      {book.summaries.length === 0 ? (
        <p className="p-5 text-sm text-ink-2">No quizzes or assignments are published in this course yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-5 py-2 font-medium">Item</th>
                <th scope="col" className="px-3 py-2 font-medium">Category</th>
                <th scope="col" className="px-3 py-2 font-medium">Due</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Graded</th>
                <th scope="col" className="px-5 py-2 font-medium">Release</th>
              </tr>
            </thead>
            <tbody>
              {book.summaries.map((summary) => {
                const { item } = summary;
                const busy = busyId === item.id;
                return (
                  <tr key={item.id} className="border-t border-line align-top">
                    <th scope="row" className="px-5 py-2.5 text-left font-medium">
                      <span className="mr-1.5 text-ink-3 tabular-nums">{codes[item.id]}</span>
                      <Link href={item.kind === "quiz" ? `/quizzes/${item.id}` : `/assignments/${item.id}`} className="hover:underline">
                        {item.title}
                      </Link>
                      <span className="block text-xs font-normal text-ink-3">{item.points} points</span>
                    </th>
                    <td className="px-3 py-2.5 text-ink-2">{categoryName(item.categoryId)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{formatDate(item.due)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {summary.graded}/{summary.expected}
                      {summary.toMark > 0 ? <span className="block text-xs text-warn">{summary.toMark} to mark</span> : null}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.kind === "quiz" ? (
                          summary.held ? (
                            <Badge tone="warn">Held</Badge>
                          ) : (
                            <span className="text-ink-2">On hand-in</span>
                          )
                        ) : summary.unreleased > 0 ? (
                          <Badge tone="warn">{summary.unreleased} not released</Badge>
                        ) : summary.graded > 0 ? (
                          <Badge tone="good">Released</Badge>
                        ) : (
                          <span className="text-ink-3">Nothing marked</span>
                        )}
                        {!book.canEdit ? null : item.kind === "quiz" && !summary.held ? (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void hold(summary)}>
                            Hold<span className="sr-only"> scores for {item.title}</span>
                          </Button>
                        ) : summary.held || summary.unreleased > 0 ? (
                          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void release(summary)}>
                            Release<span className="sr-only"> grades for {item.title}</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
