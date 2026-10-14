"use client";

import { useState } from "react";
import { ChevronRight, FileSpreadsheet, FileText, LoaderCircle, TriangleAlert } from "lucide-react";
import { ColumnChart, type Column } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  PageContainer,
  PageHeader,
  PageSkeleton,
  ScrollRegion,
  StatTile,
  fieldClass,
} from "@/components/ui";
import {
  exportMeta,
  exportReport,
  useAnalyticsCourses,
  useClassView,
  useSchoolView,
  type ClassView,
  type SchoolView,
} from "@/lib/api/analytics";
import { useActor } from "@/lib/api/session";
import {
  classReport,
  describeLastLogin,
  filterClassRows,
  schoolReport,
  type ClassFilters,
  type ReportDocument,
} from "@/lib/domain/analytics";
import { formatRate } from "@/lib/domain/attendance";
import { can } from "@/lib/domain/permissions";
import { cn, formatDateTime } from "@/lib/utils";

function columns(distribution: Array<{ label: string; count: number }>): Column[] {
  return distribution.map((band) => ({
    label: band.label,
    value: band.count,
    valueLabel: `${band.count} ${band.count === 1 ? "student" : "students"}`,
  }));
}

const percent = (value: number | null) => (value === null ? "—" : `${value}%`);

/**
 * `/analytics`: the school dashboard for admins (US-27), drilling down to
 * any class, and the class dashboard for faculty (US-26). Either can be
 * exported as PDF or Excel exactly as filtered (US-28).
 */
export function AnalyticsView() {
  const actor = useActor();
  const courses = useAnalyticsCourses();
  const school = can(actor, "view", { type: "analytics" });
  const [level, setLevel] = useState<"school" | "class">("school");
  const [termId, setTermId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const showSchool = school && level === "school";
  const course = courses.find((entry) => entry.course.id === courseId) ?? courses[0];
  const schoolView = useSchoolView(showSchool ? termId : null);
  const classView = useClassView(showSchool ? undefined : course?.course.id, sectionId);

  if (actor === undefined) return <PageSkeleton />;
  if (!actor) return null;

  const openClass = (id: string) => {
    setCourseId(id);
    setSectionId(null);
    setOnlyAtRisk(false);
    setLevel("class");
  };

  return (
    <PageContainer>
      {school ? (
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-ink-3">
          {showSchool ? (
            <span aria-current="page" className="text-ink-2">
              School
            </span>
          ) : (
            <>
              <button type="button" onClick={() => setLevel("school")} className="hover:text-ink hover:underline">
                School
              </button>
              <ChevronRight aria-hidden className="size-3.5" />
              <span aria-current="page" className="text-ink-2">
                {classView?.course.title ?? "Class"}
              </span>
            </>
          )}
        </nav>
      ) : null}

      {showSchool ? (
        schoolView ? (
          <SchoolDashboard view={schoolView} actorName={actor.name} onTerm={setTermId} onOpen={openClass} />
        ) : (
          <PageSkeleton />
        )
      ) : !course ? (
        <PageHeader title="Class dashboard" description="No courses are assigned to you yet." />
      ) : classView ? (
        <ClassDashboard
          view={classView}
          actorName={actor.name}
          courses={courses.map((entry) => entry.course)}
          filters={{ sectionId: classView.section?.id ?? null, sectionName: classView.section?.name ?? null, onlyAtRisk }}
          onCourse={(id) => openClass(id)}
          onSection={setSectionId}
          onOnlyAtRisk={setOnlyAtRisk}
        />
      ) : (
        <PageSkeleton />
      )}
    </PageContainer>
  );
}

/** PDF and Excel buttons that export exactly what is on screen (US-28). */
function ExportButtons({ build, courseId }: { build: () => ReportDocument; courseId?: string }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState("");

  const run = async (format: "pdf" | "xlsx") => {
    setBusy(format);
    setNote("");
    setFailure("");
    try {
      await exportReport(build(), format, { courseId });
      setNote(`${format === "pdf" ? "PDF" : "Excel file"} downloaded, with the filters shown here.`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The file could not be made. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy !== null} onClick={() => void run("pdf")}>
          {busy === "pdf" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <FileText aria-hidden className="size-4" />}
          Export PDF
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={() => void run("xlsx")}>
          {busy === "xlsx" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <FileSpreadsheet aria-hidden className="size-4" />}
          Export Excel
        </Button>
      </div>
      {/* Always rendered, so the outcome of an export is announced (NFR-5). */}
      <p role="status" className="text-xs text-ink-3">
        {note}
      </p>
      {failure ? (
        <p role="alert" className="text-xs text-bad">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

function SchoolDashboard({
  view,
  actorName,
  onTerm,
  onOpen,
}: {
  view: SchoolView;
  actorName: string;
  onTerm: (termId: string | null) => void;
  onOpen: (courseId: string) => void;
}) {
  const { usage } = view;
  return (
    <>
      <PageHeader
        title="School dashboard"
        description="How the school is using the platform, how each course is doing, and which students may need help."
        actions={
          <>
            <label htmlFor="analytics-term" className="sr-only">
              Term
            </label>
            <select
              id="analytics-term"
              value={view.term?.id ?? ""}
              onChange={(event) => onTerm(event.target.value || null)}
              className={fieldClass}
            >
              <option value="">All terms</option>
              {view.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
            <ExportButtons build={() => schoolReport({ termName: view.term?.name ?? null, usage, courses: view.courses, atRisk: view.atRisk }, exportMeta(actorName))} />
          </>
        }
      />

      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="mb-3 text-lg font-semibold tracking-tight">
          Use in the last {usage.days} days
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Students signed in" value={usage.byRole.student.signedIn} hint={`of ${usage.byRole.student.accounts} students`} />
          <StatTile label="Faculty signed in" value={usage.byRole.faculty.signedIn} hint={`of ${usage.byRole.faculty.accounts} faculty`} />
          <StatTile label="Parents signed in" value={usage.byRole.parent.signedIn} hint={`of ${usage.byRole.parent.accounts} parents`} />
          <StatTile label="Quiz attempts" value={usage.quizAttempts} />
          <StatTile label="Assignments handed in" value={usage.handIns} />
          <StatTile label="Forum posts and messages" value={usage.forumPosts + usage.messages} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">Courses</h2>
            <p className="text-sm text-ink-3">Open a course to see its classes and students.</p>
          </div>
          <ScrollRegion label="Courses">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="px-5 py-2 font-medium">Course</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Students</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Average</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Attendance</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Missing</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">At risk</th>
                  <th scope="col" className="px-5 py-2">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.courses.map((course) => (
                  <tr key={course.courseId} className="border-t border-line">
                    <th scope="row" className="px-5 py-2.5 text-left font-medium">
                      {course.title}
                      <span className="block text-xs font-normal text-ink-3">
                        {course.code} · {course.term} · {course.sections} {course.sections === 1 ? "section" : "sections"}
                      </span>
                    </th>
                    <td className="px-2 py-2.5 text-right tabular-nums">{course.students}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{percent(course.average)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{percent(course.attendance)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{course.missing}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {course.atRisk > 0 ? <Badge tone="warn">{course.atRisk}</Badge> : 0}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onOpen(course.courseId)}>
                        Open<span className="sr-only"> {course.title}</span>
                        <ChevronRight aria-hidden className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {view.courses.length === 0 ? (
                  <tr className="border-t border-line">
                    <td colSpan={7} className="px-5 py-6 text-center text-ink-2">
                      No courses in this term.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScrollRegion>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Grade distribution</h2>
          <p className="mb-4 text-sm text-ink-3">Every student&apos;s total in every course shown.</p>
          <ColumnChart columns={columns(view.distribution)} ariaLabel="Students per course total band, whole school" />
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <TriangleAlert aria-hidden className="size-4 text-warn" />
            Students at risk <span className="font-normal text-ink-3">· {view.atRisk.length}</span>
          </h2>
          <p className="text-sm text-ink-3">By the school&apos;s at-risk rules, set in Settings. A student is listed once for each course.</p>
        </div>
        {view.atRisk.length === 0 ? (
          <p className="border-t border-line px-5 py-4 text-sm text-ink-2">Nobody matches the at-risk rules.</p>
        ) : (
          <ScrollRegion label="Students at risk">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="px-5 py-2 font-medium">Student</th>
                  <th scope="col" className="px-2 py-2 font-medium">Course</th>
                  <th scope="col" className="px-5 py-2 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {view.atRisk.map((entry) => (
                  <tr key={`${entry.studentId}-${entry.courseTitle}`} className="border-t border-line align-top">
                    <th scope="row" className="px-5 py-2.5 text-left font-medium whitespace-nowrap">{entry.name}</th>
                    <td className="px-2 py-2.5 text-ink-2">
                      {entry.courseTitle}
                      <span className="block text-xs text-ink-3">{entry.section}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <RiskList risks={entry.risks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Card>

      <p className="mt-4 text-xs text-ink-3">
        Worked out from current records at {formatDateTime(view.computedAt)}, and again whenever this page is shown.
      </p>
    </>
  );
}

function RiskList({ risks }: { risks: ClassView["rows"][number]["risks"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {risks.map((risk) => (
        <li key={risk.ruleId}>
          <Badge tone="warn">{risk.name}</Badge>
          <span className="ml-1.5 text-xs text-ink-2">{risk.reasons.join("; ")}</span>
        </li>
      ))}
    </ul>
  );
}

function ClassDashboard({
  view,
  actorName,
  courses,
  filters,
  onCourse,
  onSection,
  onOnlyAtRisk,
}: {
  view: ClassView;
  actorName: string;
  courses: Array<{ id: string; title: string }>;
  filters: ClassFilters;
  onCourse: (courseId: string) => void;
  onSection: (sectionId: string | null) => void;
  onOnlyAtRisk: (only: boolean) => void;
}) {
  const rows = filterClassRows(view.rows, filters);
  const atRisk = view.rows.filter((row) => row.risks.length > 0).length;
  const missing = view.rows.reduce((sum, row) => sum + row.missing, 0);
  const now = view.computedAt;

  return (
    <>
      <PageHeader
        eyebrow={view.course.status === "archived" ? <Badge tone="warn">Archived term · read-only</Badge> : undefined}
        title="Class dashboard"
        description="Grades, missing work, attendance and last sign-in for each student, so you can spot who needs help early."
        actions={
          <ExportButtons
            courseId={view.course.id}
            build={() => classReport({ courseTitle: view.course.title, courseCode: view.course.code, rows: view.rows, distribution: view.distribution }, filters, exportMeta(actorName))}
          />
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-course" className="text-sm text-ink-2">
            Course
          </label>
          <select id="analytics-course" value={view.course.id} onChange={(event) => onCourse(event.target.value)} className={cn(fieldClass, "max-w-64")}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-section" className="text-sm text-ink-2">
            Section
          </label>
          <select
            id="analytics-section"
            value={view.section?.id ?? ""}
            onChange={(event) => onSection(event.target.value || null)}
            className={fieldClass}
          >
            <option value="">All sections</option>
            {view.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.onlyAtRisk} onChange={(event) => onOnlyAtRisk(event.target.checked)} className="size-4 accent-primary" />
          Only students at risk
        </label>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Students" value={view.rows.length} />
        <StatTile label="Class average" value={percent(view.average)} hint="Course totals so far" />
        <StatTile label="Attendance" value={view.attendance === null ? "—" : formatRate(view.attendance)} hint="Average rate" />
        <StatTile label="Missing work" value={missing} hint="Past due, not handed in" />
        <StatTile label="At risk" value={atRisk} hint="By the school's rules" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="p-5">
          <h2 className="font-semibold">Grade distribution</h2>
          <p className="mb-4 text-sm text-ink-3">Students per course total band.</p>
          <ColumnChart columns={columns(view.distribution)} ariaLabel={`Students per course total band, ${view.course.title}`} />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Missing work</h2>
          <p className="mb-3 text-sm text-ink-3">Past its due date and not handed in.</p>
          {view.missingByItem.length === 0 ? (
            <p className="text-sm text-ink-2">Nothing is missing.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {view.missingByItem.map((item) => (
                <li key={item.title}>
                  <span className="font-medium">{item.title}</span>{" "}
                  <span className="text-ink-3">
                    · {item.names.length} {item.names.length === 1 ? "student" : "students"}
                  </span>
                  <span className="block text-ink-2">{item.names.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-semibold">
            Students <span className="font-normal text-ink-3">· {rows.length} shown</span>
          </h2>
        </div>
        <ScrollRegion label="Students">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-5 py-2 font-medium">Student</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Grade</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Attendance</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Missing</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Lessons</th>
                <th scope="col" className="px-2 py-2 font-medium">Last sign-in</th>
                <th scope="col" className="px-5 py-2 font-medium">At risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId} className="border-t border-line align-top">
                  <th scope="row" className="px-5 py-2.5 text-left font-medium whitespace-nowrap">
                    {row.name}
                    <span className="block text-xs font-normal text-ink-3">{row.section}</span>
                  </th>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {row.grade === null ? <span className="text-ink-3">—</span> : `${row.grade}%`}
                    {row.gradeLabel ? <span className="block text-xs text-ink-3">{row.gradeLabel}</span> : null}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatRate(row.attendance)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{row.missing}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {row.lessonsDone}/{row.lessonsTotal}
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-ink-2">{describeLastLogin(row.lastLoginAt, now)}</td>
                  <td className="px-5 py-2.5">{row.risks.length === 0 ? <span className="text-ink-3">No</span> : <RiskList risks={row.risks} />}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr className="border-t border-line">
                  <td colSpan={7} className="px-5 py-6 text-center text-ink-2">
                    {filters.onlyAtRisk ? "Nobody here is at risk." : "Nobody is enrolled."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </ScrollRegion>
      </Card>

      <p className="mt-4 text-xs text-ink-3">
        Worked out from current records at {formatDateTime(view.computedAt)}, and again whenever this page is shown.
      </p>
    </>
  );
}
