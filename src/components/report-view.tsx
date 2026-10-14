"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Badge, Button, Card, PageContainer, PageHeader, PageSkeleton, ScrollRegion } from "@/components/ui";
import { exportMeta } from "@/lib/api/analytics";
import {
  logReportExport,
  progressReportDocument,
  reportRows,
  useProgressReport,
  useReportStudents,
  type ProgressReport,
} from "@/lib/api/reports";
import { useActor } from "@/lib/api/session";
import { formatRate } from "@/lib/domain/attendance";
import { downloadCsv } from "@/lib/download";
import { formatDate } from "@/lib/utils";

const selectClass = "h-10 max-w-full rounded-lg border border-line-strong bg-surface px-3 text-sm";

/**
 * FR-4.4 (US-18): the progress report for one student in one term. A student
 * sees their own, a parent a linked child's, faculty the courses they teach,
 * and an admin everything.
 */
export function ReportView() {
  const actor = useActor();
  const students = useReportStudents();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const student = students.find((candidate) => candidate.id === studentId) ?? students[0];
  const report = useProgressReport(student?.id, termId ?? undefined);

  if (actor === undefined) return <PageSkeleton />;

  const staff = actor?.role === "faculty" || actor?.role === "admin";
  const title = staff ? "Progress reports" : "Progress report";

  if (!student) {
    return (
      <PageContainer>
        <PageHeader
          title={title}
          description={
            actor?.role === "parent"
              ? "No student is linked to your account yet. Ask the school office to link your child."
              : "There are no students to report on yet."
          }
        />
      </PageContainer>
    );
  }

  const download = async () => {
    if (!report) return;
    // Authorized and written to the audit log before the file is produced.
    await logReportExport(report.student.id, report.term.id, "CSV");
    const name = report.student.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadCsv(`progress-report-${name}-${report.term.id}.csv`, reportRows(report));
  };

  /** FR-7.4: the same report as a PDF or an Excel file. */
  const exportFile = async (format: "PDF" | "Excel") => {
    if (!report || !actor) return;
    await logReportExport(report.student.id, report.term.id, format);
    const document = progressReportDocument(report, exportMeta(actor.name));
    const files = await import("@/lib/export-files");
    await (format === "PDF" ? files.downloadPdf(document) : files.downloadExcel(document));
  };

  const print = async () => {
    if (!report) return;
    await logReportExport(report.student.id, report.term.id, "print");
    window.print();
  };

  return (
    <PageContainer className="max-w-5xl">
      <div className="print:hidden">
        <PageHeader
          title={title}
          description={
            staff
              ? "Report-card data for one student and term: the grade in each course, how it is made up, and what is outstanding."
              : "The grade in each course this term, how it is made up, and what is outstanding."
          }
          actions={
            <>
              {students.length > 1 ? (
                <>
                  <label htmlFor="report-student" className="sr-only">
                    Student
                  </label>
                  <select
                    id="report-student"
                    value={student.id}
                    onChange={(event) => {
                      setStudentId(event.target.value);
                      setTermId(null);
                    }}
                    className={selectClass}
                  >
                    {students.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              {report && report.terms.length > 1 ? (
                <>
                  <label htmlFor="report-term" className="sr-only">
                    Term
                  </label>
                  <select
                    id="report-term"
                    value={report.term.id}
                    onChange={(event) => setTermId(event.target.value)}
                    className={selectClass}
                  >
                    {report.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              <Button variant="secondary" disabled={!report} onClick={() => void print()}>
                <Printer aria-hidden className="size-4" />
                Print
              </Button>
              <Button variant="secondary" disabled={!report} onClick={() => void exportFile("PDF")}>
                <FileText aria-hidden className="size-4" />
                PDF
              </Button>
              <Button variant="secondary" disabled={!report} onClick={() => void exportFile("Excel")}>
                <FileSpreadsheet aria-hidden className="size-4" />
                Excel
              </Button>
              <Button variant="secondary" disabled={!report} onClick={() => void download()}>
                <Download aria-hidden className="size-4" />
                CSV
              </Button>
            </>
          }
        />
      </div>

      {report ? (
        <ReportCard report={report} />
      ) : (
        <Card className="p-5 text-sm text-ink-2">{student.name} has no courses to report on.</Card>
      )}
    </PageContainer>
  );
}

function ReportCard({ report }: { report: ProgressReport }) {
  const { student, term, courses, summary } = report;
  const missing = courses.reduce((sum, entry) => sum + entry.total.counts.missing, 0);
  const waiting = courses.reduce((sum, entry) => sum + entry.total.counts.toMark + entry.total.counts.held, 0);

  return (
    <Card className="overflow-hidden print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{student.name}</h2>
          <p className="text-sm text-ink-2">
            {student.sisId ? `Student ID ${student.sisId} · ` : ""}
            {term.name} · {formatDate(term.startsOn, true)} to {formatDate(term.endsOn, true)}
          </p>
        </div>
        {term.status === "archived" ? <Badge>Archived term</Badge> : null}
      </div>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        <Figure label="Term average" value={summary.average === null ? "—" : `${summary.average}%`} />
        <Figure
          label="GPA"
          value={summary.gpa === null ? "—" : summary.gpa.toFixed(2)}
          hint={report.gpaScale ? `On the ${report.gpaScale.name} scale` : "The school has no GPA scale"}
        />
        <Figure label="Courses graded" value={`${summary.graded}/${summary.courses}`} />
        <Figure label="Work missing" value={String(missing)} hint={waiting > 0 ? `${waiting} awaiting a grade` : undefined} />
      </dl>

      {courses.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-2">No courses in this term.</p>
      ) : (
        <ScrollRegion label="Courses in this report">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-5 py-2.5 font-medium">Course</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Made up of</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Lessons</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Attendance</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Missing</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((entry) => (
                <tr key={entry.course.id} className="border-t border-line align-top">
                  <th scope="row" className="px-5 py-3 text-left font-medium">
                    <span className="text-ink-3">{entry.course.code}</span> {entry.course.title}
                    <span className="block text-xs font-normal text-ink-3">
                      {[entry.section?.name, entry.teachers.join(", ")].filter(Boolean).join(" · ")}
                    </span>
                  </th>
                  <td className="px-3 py-3 text-ink-2">
                    <ul>
                      {entry.total.categories.map(({ category, percent }) => (
                        <li key={category.id} className="tabular-nums">
                          {category.name} ({category.weight}%): {percent === null ? "no grades yet" : `${percent}%`}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 text-right text-ink-2 tabular-nums">
                    {entry.lessons.done}/{entry.lessons.total}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    <span className={entry.attendance.below ? "font-medium text-bad" : undefined}>
                      {formatRate(entry.attendance.summary.rate)}
                    </span>
                    {entry.attendance.below ? <span className="sr-only"> (below {report.attendanceThreshold}%)</span> : null}
                    {entry.attendance.summary.absent > 0 ? (
                      <span className="block text-xs text-ink-3">{entry.attendance.summary.absent} absent</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{entry.total.counts.missing}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {entry.total.percent === null ? <span className="font-normal text-ink-3">—</span> : `${entry.total.percent}%`}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {entry.grade ?? <span className="text-ink-3">Not graded yet</span>}
                    <span className="block text-xs text-ink-3">{entry.scale.name}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      )}

      <div className="flex flex-col gap-1 border-t border-line px-5 py-3 text-xs text-ink-3">
        {report.audience === "learner" ? (
          <p>This report counts grades that have been released. Work with no grade yet is listed as outstanding.</p>
        ) : report.unreleased > 0 ? (
          <p className="text-warn">
            Includes {report.unreleased} {report.unreleased === 1 ? "mark" : "marks"} not yet released to the student.
            Their own report leaves {report.unreleased === 1 ? "it" : "them"} out until then.
          </p>
        ) : (
          <p>Every mark counted here has been released to the student.</p>
        )}
        <p>
          The term average is the plain average of the course totals. The GPA counts each course equally.
          Attendance is the share of recorded sessions attended; the school expects at least{" "}
          {report.attendanceThreshold}%.
        </p>
      </div>
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-5 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-ink-3">{hint}</dd> : null}
    </div>
  );
}
