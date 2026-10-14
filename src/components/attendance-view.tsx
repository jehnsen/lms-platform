"use client";

import { useState } from "react";
import { CheckCheck, LoaderCircle, Lock, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Meter, PageContainer, PageHeader, PageSkeleton, fieldClass } from "@/components/ui";
import {
  AttendanceError,
  saveAttendance,
  useAttendanceSections,
  useSectionAttendance,
  useViewedAttendance,
  type LearnerCourseAttendance,
  type SectionAttendance,
  type SessionRow,
} from "@/lib/api/attendance";
import { selectViewedChild } from "@/lib/api/progress";
import { useActor } from "@/lib/api/session";
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, describeCounting, formatRate } from "@/lib/domain/attendance";
import type { AttendanceStatus } from "@/lib/types";
import { cn, firstNameOf, formatDate, formatDateTime } from "@/lib/utils";

const STATUS_TONES: Record<AttendanceStatus, "good" | "bad" | "warn" | "neutral"> = {
  present: "good",
  absent: "bad",
  late: "warn",
  excused: "neutral",
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

/** "Wed, Oct 14" for a plain date. */
function dayLabel(date: string) {
  return `${WEEKDAY.format(new Date(`${date}T00:00:00.000Z`))}, ${formatDate(date)}`;
}

/** `/attendance`: faculty take it, admins look over it, and a student or a parent sees one student's record. */
export function AttendanceView() {
  const actor = useActor();
  if (actor === undefined) return <PageSkeleton />;
  if (!actor) return null;
  return actor.role === "faculty" || actor.role === "admin" ? <StaffAttendance /> : <LearnerAttendance />;
}

// --- Faculty and admins (US-19) ----------------------------------------------------------

function StaffAttendance() {
  const sections = useAttendanceSections();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Kept here, not in the roster: the roster starts again from the saved marks after each save.
  const [saved, setSaved] = useState<{ sessionId: string; text: string } | null>(null);
  const chosen = sections.find((entry) => entry.section.id === sectionId) ?? sections[0];
  const book = useSectionAttendance(chosen?.section.id);

  if (!chosen || !book) {
    return (
      <PageContainer>
        <PageHeader title="Attendance" description="No sections are assigned to you yet." />
      </PageContainer>
    );
  }

  const selected = book.sessions.find((row) => row.session.id === sessionId) ?? book.sessions[0];
  const listed = showAll ? book.sessions : book.sessions.slice(0, 6);
  const notTaken = book.sessions.filter((row) => !row.sheet).length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={book.course.status === "archived" ? <Badge tone="warn">Archived term · read-only</Badge> : undefined}
        title="Attendance"
        description={
          book.canTake
            ? "Mark each student for a class session. A submitted session can be corrected for a limited time, and every correction is logged."
            : "Attendance taken by the teachers of each section. You can look, but not change it."
        }
        actions={
          <>
            <label htmlFor="attendance-section" className="sr-only">
              Section
            </label>
            <select
              id="attendance-section"
              value={chosen.section.id}
              onChange={(event) => {
                setSectionId(event.target.value);
                setSessionId(null);
                setShowAll(false);
              }}
              className={cn(fieldClass, "max-w-full")}
            >
              {sections.map((entry) => (
                <option key={entry.section.id} value={entry.section.id}>
                  {entry.course.title} · {entry.section.name}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">Class sessions</h2>
            <p className="text-sm text-ink-3">
              {book.sessions.length === 0
                ? "No classes have met yet."
                : notTaken === 0
                  ? "Attendance is taken for every session so far."
                  : `${notTaken} ${notTaken === 1 ? "session has" : "sessions have"} no attendance yet.`}
            </p>
          </div>
          <ul>
            {listed.map((row) => (
              <li key={row.session.id} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => setSessionId(row.session.id)}
                  aria-current={row.session.id === selected?.session.id ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 text-left text-sm transition-colors hover:bg-surface-2",
                    row.session.id === selected?.session.id && "bg-primary-soft hover:bg-primary-soft",
                  )}
                >
                  <span>
                    <span className="font-medium">{dayLabel(row.session.date)}</span>
                    <span className="block text-xs text-ink-2">
                      {row.session.start}–{row.session.end}
                      {row.session.room ? ` · ${row.session.room}` : ""}
                    </span>
                  </span>
                  <SessionBadge row={row} />
                </button>
              </li>
            ))}
          </ul>
          {book.sessions.length > listed.length ? (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                Show {book.sessions.length - listed.length} earlier sessions
              </Button>
            </div>
          ) : null}
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          {selected ? (
            // Keyed by the session and by what is stored for it, so the form starts again from the saved marks.
            <Roster
              key={`${selected.session.id}:${selected.sheet?.changes.length ?? "new"}:${Boolean(selected.sheet)}`}
              book={book}
              row={selected}
              note={saved?.sessionId === selected.session.id ? saved.text : ""}
              onNote={(text) => setSaved(text ? { sessionId: selected.session.id, text } : null)}
            />
          ) : (
            <Card className="p-5 text-sm text-ink-2">
              This section has had no classes yet. Sessions appear here from the day they meet.
            </Card>
          )}
          <SummaryCard book={book} />
        </div>
      </div>
    </PageContainer>
  );
}

function SessionBadge({ row }: { row: SessionRow }) {
  if (!row.sheet) return <Badge tone="warn">Not taken</Badge>;
  if (row.edit?.allowed) return <Badge tone="good">Taken · can be corrected</Badge>;
  return (
    <Badge>
      <Lock aria-hidden className="size-3" />
      Taken · locked
    </Badge>
  );
}

/** FR-5.1, FR-5.2: the roster for one session, with Present, Absent, Late and Excused for each student. */
function Roster({
  book,
  row,
  note,
  onNote,
}: {
  book: SectionAttendance;
  row: SessionRow;
  /** What the last save of this session did. */
  note: string;
  onNote: (text: string) => void;
}) {
  const { session, sheet } = row;
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | undefined>>(() => ({ ...sheet?.marks }));
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const setNote = onNote;

  const editable = sheet ? book.canTake && row.edit?.allowed === true : row.canTake;
  const unmarked = book.students.filter((student) => !marks[student.id]).length;
  const dirty = book.students.some((student) => marks[student.id] !== sheet?.marks[student.id]);

  const save = async () => {
    setBusy(true);
    setProblems([]);
    setNote("");
    try {
      const result = await saveAttendance(session.sectionId, session.date, session.start, marks);
      const alerts =
        result.alerts === 0
          ? ""
          : ` ${result.alerts} low-attendance ${result.alerts === 1 ? "alert was" : "alerts were"} sent to the student, their parents and the coordinator.`;
      setNote(
        sheet
          ? `Saved ${result.changed} ${result.changed === 1 ? "correction" : "corrections"}. Each is in the log below.${alerts}`
          : `Attendance submitted for ${book.students.length} ${book.students.length === 1 ? "student" : "students"}.${alerts}`,
      );
    } catch (error) {
      setProblems(error instanceof AttendanceError ? error.problems : ["Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="font-semibold">
            Roster · {dayLabel(session.date)}, {session.start}
          </h2>
          <p className="text-sm text-ink-3">
            {book.course.title} · {book.section.name}
            {session.room ? ` · ${session.room}` : ""}
          </p>
        </div>
        {editable && book.students.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNote("");
              setMarks(Object.fromEntries(book.students.map((student) => [student.id, marks[student.id] ?? "present"])));
            }}
          >
            <CheckCheck aria-hidden className="size-4" />
            Mark the rest present
          </Button>
        ) : null}
      </div>

      <p className="px-5 pt-2 text-sm text-ink-2">
        {!sheet
          ? row.canTake
            ? "Not taken yet."
            : book.canTake
              ? "Attendance can be taken from the day of the class."
              : "The teacher has not taken attendance for this session."
          : `Submitted by ${book.names[sheet.submittedById] ?? "a teacher"} on ${formatDateTime(sheet.submittedAt)}. ${
              row.edit?.allowed
                ? `It can be corrected until ${formatDateTime(row.edit.closesAt)}.`
                : (row.edit?.reason ?? "")
            }`}
      </p>

      {book.students.length === 0 ? (
        <p className="p-5 text-sm text-ink-2">Nobody is enrolled in this section yet.</p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={!editable || busy} className="mt-3 min-w-0">
            <legend className="sr-only">Mark each student</legend>
            <ul>
              {book.students.map((student) => {
                const nameId = `roster-${session.id}-${student.id}`;
                return (
                  <li key={student.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-2.5">
                    <span id={nameId} className="min-w-0 basis-40 text-sm font-medium">
                      {student.name}
                    </span>
                    <div role="radiogroup" aria-labelledby={nameId} className="flex flex-wrap gap-1.5">
                      {ATTENDANCE_STATUSES.map((status) => (
                        <label
                          key={status}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary has-disabled:cursor-default",
                            marks[student.id] === status
                              ? "border-primary bg-primary-soft text-primary-ink"
                              : "border-line-strong hover:bg-surface-2",
                          )}
                        >
                          <input
                            type="radio"
                            name={nameId}
                            value={status}
                            checked={marks[student.id] === status}
                            onChange={() => {
                              setNote("");
                              setProblems([]);
                              setMarks((current) => ({ ...current, [student.id]: status }));
                            }}
                            className="size-4 accent-primary"
                          />
                          {ATTENDANCE_LABELS[status]}
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            {/* Always rendered, so the outcome and any alerts are announced (NFR-5). */}
            <p role="status" className="min-w-0 flex-1 basis-56 text-sm text-ink-2">
              {note ||
                (editable
                  ? unmarked > 0
                    ? `${unmarked} of ${book.students.length} still to mark.`
                    : sheet && !dirty
                      ? "No changes to save."
                      : "Everyone is marked."
                  : "")}
            </p>
            {editable ? (
              <Button type="submit" disabled={busy || (Boolean(sheet) && !dirty)}>
                {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                {sheet ? "Save corrections" : "Submit attendance"}
              </Button>
            ) : null}
          </div>
          <div role="alert">
            {problems.length > 0 ? (
              <p className="mx-5 mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problems.join(" ")}</p>
            ) : null}
          </div>
        </form>
      )}

      {sheet && sheet.changes.length > 0 ? (
        <details className="border-t border-line px-5 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Corrections ({sheet.changes.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-ink-2">
            {sheet.changes.map((change, index) => (
              <li key={`${change.at}-${change.studentId}-${index}`}>
                <span className="font-medium text-ink">{book.names[change.studentId] ?? "A student"}</span>:{" "}
                {change.from ? ATTENDANCE_LABELS[change.from] : "no mark"} to {ATTENDANCE_LABELS[change.to]}, by{" "}
                {book.names[change.byId] ?? "a teacher"} on {formatDateTime(change.at)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

/** FR-5.4: each student's attendance in the course so far, against the school's threshold. */
function SummaryCard({ book }: { book: SectionAttendance }) {
  const below = book.summaries.filter((entry) => entry.below).length;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {below > 0 ? <TriangleAlert aria-hidden className="size-4 text-warn" /> : null}
          Attendance so far
        </h2>
        <p className="text-sm text-ink-3">
          The school expects at least {book.policy.thresholdPercent}%. {describeCounting(book.policy)}{" "}
          {below > 0
            ? `${below} ${below === 1 ? "student is" : "students are"} below it.`
            : "Nobody is below it."}
        </p>
      </div>
      {book.summaries.length === 0 ? null : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-5 py-2 font-medium">Student</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Present</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Absent</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Late</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Excused</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {book.summaries.map(({ student, summary, below: isBelow }) => (
                <tr key={student.id} className="border-t border-line">
                  <th scope="row" className="px-5 py-2 text-left font-medium whitespace-nowrap">{student.name}</th>
                  <td className="px-2 py-2 text-right tabular-nums">{summary.present}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{summary.absent}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{summary.late}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{summary.excused}</td>
                  <td className="px-5 py-2 text-right whitespace-nowrap tabular-nums">
                    {isBelow ? (
                      <Badge tone="bad">
                        {formatRate(summary.rate)}
                        <span className="sr-only"> below the threshold</span>
                      </Badge>
                    ) : (
                      formatRate(summary.rate)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// --- A student, or a parent (US-05, US-21) ---------------------------------------------------

function LearnerAttendance() {
  const record = useViewedAttendance();
  if (record === undefined) return <PageSkeleton />;
  if (!record) {
    return (
      <PageContainer>
        <PageHeader
          title="Attendance"
          description="No student is linked to your account yet. Ask the school office to link your child."
        />
      </PageContainer>
    );
  }

  const { viewed, courses, policy } = record;
  const { learner, readOnly, children } = viewed;
  const firstName = firstNameOf(learner.name);
  const below = courses.filter((entry) => entry.below);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title={readOnly ? `${firstName}'s attendance` : "My attendance"}
        description={`The school expects at least ${policy.thresholdPercent}% in each course. ${describeCounting(policy)}`}
        actions={
          readOnly && children.length > 1 ? (
            <>
              <label htmlFor="attendance-child" className="text-sm text-ink-2">
                Student
              </label>
              <select
                id="attendance-child"
                value={learner.id}
                onChange={(event) => void selectViewedChild(event.target.value)}
                className={fieldClass}
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

      {below.length > 0 ? (
        <p className="mb-6 flex items-start gap-2 rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {readOnly ? `${firstName}'s attendance` : "Your attendance"} is below {policy.thresholdPercent}% in{" "}
            {below.map((entry) => entry.course.title).join(" and ")}.
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        {courses.map((entry) => (
          <CourseAttendanceCard key={entry.course.id} entry={entry} threshold={policy.thresholdPercent} />
        ))}
        {courses.length === 0 ? (
          <p className="text-sm text-ink-2">{readOnly ? `${firstName} is` : "You are"} not enrolled in any courses yet.</p>
        ) : null}
      </div>
    </PageContainer>
  );
}

function CourseAttendanceCard({ entry, threshold }: { entry: LearnerCourseAttendance; threshold: number }) {
  const { course, section, summary, below, marks } = entry;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="font-semibold">{course.title}</h2>
          <p className="text-sm text-ink-3">{[section?.name, course.instructor].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatRate(summary.rate)}</span>
          {summary.rate === null ? null : below ? (
            <Badge tone="bad">Below {threshold}%</Badge>
          ) : (
            <Badge tone="good">On track</Badge>
          )}
        </div>
      </div>

      <div className="px-5 pt-3">
        <Meter value={summary.rate ?? 0} label={`Attendance in ${course.title}`} />
      </div>

      <dl className="grid grid-cols-2 gap-3 px-5 py-4 text-sm sm:grid-cols-4">
        {ATTENDANCE_STATUSES.map((status) => (
          <div key={status}>
            <dt className="text-xs text-ink-3">{ATTENDANCE_LABELS[status]}</dt>
            <dd className="font-semibold tabular-nums">{summary[status]}</dd>
          </div>
        ))}
      </dl>

      {marks.length === 0 ? (
        <p className="border-t border-line px-5 py-3 text-sm text-ink-2">No attendance has been recorded yet.</p>
      ) : (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
            {marks.length} recorded {marks.length === 1 ? "session" : "sessions"}
          </summary>
          <ul>
            {marks.map(({ sheet, status }) => (
              <li key={sheet.id} className="flex items-center justify-between gap-3 border-t border-line px-5 py-2 text-sm">
                <span>
                  {dayLabel(sheet.date)} <span className="text-ink-3">· {sheet.start}</span>
                </span>
                <Badge tone={STATUS_TONES[status]}>{ATTENDANCE_LABELS[status]}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
