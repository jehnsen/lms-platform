"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, fieldClass } from "@/components/ui";
import { CalendarError, deleteCalendarEvent, saveCalendarEvent, useCalendarEvent } from "@/lib/api/calendar";
import type { CalendarEvent, Course } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_CLASS = "mb-1 block text-sm font-medium";
const SCHOOL = "";

const KIND_OPTIONS: Array<{ value: CalendarEvent["kind"]; label: string }> = [
  { value: "exam", label: "Exam" },
  { value: "holiday", label: "Holiday" },
  { value: "event", label: "Other event" },
];

/**
 * FR-5.3: add or change an exam, a holiday or another event. Faculty do this
 * for the courses they teach; an admin also for the whole school. Whatever is
 * saved is on everyone's calendar at once.
 */
export function CalendarEventDialog({
  eventId,
  defaultDate,
  courses,
  canAddSchoolWide,
  onClose,
}: {
  /** The event to change. Absent: a new one. */
  eventId?: string;
  defaultDate: string;
  /** The courses the signed-in user may add events to. */
  courses: Array<Pick<Course, "id" | "title" | "code">>;
  canAddSchoolWide: boolean;
  onClose: () => void;
}) {
  const existing = useCalendarEvent(eventId);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<CalendarEvent["kind"]>(existing?.kind ?? "exam");
  const [courseId, setCourseId] = useState(existing ? (existing.courseId ?? SCHOOL) : canAddSchoolWide ? SCHOOL : (courses[0]?.id ?? SCHOOL));
  const [date, setDate] = useState(existing?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [start, setStart] = useState(existing?.start ?? "");
  const [end, setEnd] = useState(existing?.end ?? "");
  const [room, setRoom] = useState(existing?.room ?? "");
  const [noClasses, setNoClasses] = useState(existing?.noClasses ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setProblems([]);
    try {
      await work();
      onClose();
    } catch (error) {
      setProblems(error instanceof CalendarError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
      setBusy(false);
    }
  };

  const save = () =>
    run(() =>
      saveCalendarEvent({
        id: existing?.id,
        title,
        kind,
        date,
        endDate,
        start,
        end,
        room,
        courseId: courseId === SCHOOL ? undefined : courseId,
        noClasses,
      }),
    );

  return (
    <Dialog title={existing ? "Change event" : "Add to the calendar"} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor="event-title" className={LABEL_CLASS}>
            Title
          </label>
          <input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} className={cn(fieldClass, "w-full")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="event-kind" className={LABEL_CLASS}>
              Kind
            </label>
            <select
              id="event-kind"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as CalendarEvent["kind"];
                setKind(next);
                // A holiday is a day without classes unless the box is cleared again.
                if (next === "holiday") setNoClasses(true);
              }}
              className={cn(fieldClass, "w-full")}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-course" className={LABEL_CLASS}>
              For
            </label>
            <select id="event-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className={cn(fieldClass, "w-full")}>
              {canAddSchoolWide ? <option value={SCHOOL}>The whole school</option> : null}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="event-date" className={LABEL_CLASS}>
              Date
            </label>
            <input id="event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={cn(fieldClass, "w-full")} />
          </div>
          <div>
            <label htmlFor="event-end-date" className={LABEL_CLASS}>
              Last day <span className="font-normal text-ink-3">(if more than one)</span>
            </label>
            <input
              id="event-end-date"
              type="date"
              min={date}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div>
            <label htmlFor="event-start" className={LABEL_CLASS}>
              Starts <span className="font-normal text-ink-3">(blank for all day)</span>
            </label>
            <input id="event-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} className={cn(fieldClass, "w-full")} />
          </div>
          <div>
            <label htmlFor="event-end" className={LABEL_CLASS}>
              Ends
            </label>
            <input id="event-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={cn(fieldClass, "w-full")} />
          </div>
        </div>

        <div>
          <label htmlFor="event-room" className={LABEL_CLASS}>
            Room or place <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input id="event-room" value={room} onChange={(event) => setRoom(event.target.value)} className={cn(fieldClass, "w-full")} />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={noClasses}
            onChange={(event) => setNoClasses(event.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            No classes meet on {endDate && endDate !== date ? "these days" : "this day"}
            <span className="block text-xs text-ink-3">
              {courseId === SCHOOL
                ? "Every section's classes come off the timetable, and no attendance is taken."
                : "This course's classes come off the timetable, and no attendance is taken for them."}
            </span>
          </span>
        </label>

        <div role="alert">
          {problems.length > 0 ? (
            <div className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </div>
          ) : null}
        </div>

        {confirmingDelete && existing ? (
          <div
            role="group"
            aria-label={`Remove ${existing.title}?`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-3 text-sm text-warn"
          >
            <span>Remove this event from everyone&apos;s calendar?</span>
            <span className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" autoFocus disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => deleteCalendarEvent(existing.id))}>
                Yes, remove
              </Button>
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {existing && !confirmingDelete ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden className="size-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              {existing ? "Save" : "Add"}
            </Button>
          </span>
        </div>
      </form>
    </Dialog>
  );
}
