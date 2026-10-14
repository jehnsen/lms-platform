"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { CalendarEventDialog } from "@/components/calendar-event-dialog";
import { Badge, Button, Card, PageContainer, PageHeader, PageSkeleton, fieldClass } from "@/components/ui";
import { useCalendar } from "@/lib/api/calendar";
import { selectViewedChild } from "@/lib/api/progress";
import { localParts } from "@/lib/clock";
import {
  CALENDAR_KINDS,
  CALENDAR_KIND_LABELS,
  addDays,
  addMonths,
  filterCalendar,
  monthOf,
  monthWeeks,
  weekDates,
  type CalendarItem,
  type CalendarKind,
} from "@/lib/domain/schedule";
import { useNow } from "@/lib/use-now";
import { cn, firstNameOf } from "@/lib/utils";

const UTC = { timeZone: "UTC" } as const;
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", ...UTC });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-US", { weekday: "short", ...UTC });
const DAY_MONTH = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...UTC });
const FULL_DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", ...UTC });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", ...UTC });

const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

/** Each kind has its own bar colour and is always named in words as well. */
const KIND_STYLES: Record<CalendarKind, { bar: string; dot: string; singular: string }> = {
  class: { bar: "border-l-primary", dot: "bg-primary", singular: "Class" },
  due: { bar: "border-l-warn", dot: "bg-warn", singular: "Due" },
  exam: { bar: "border-l-bad", dot: "bg-bad", singular: "Exam" },
  holiday: { bar: "border-l-good", dot: "bg-good", singular: "Holiday" },
  event: { bar: "border-l-spark", dot: "bg-spark", singular: "Event" },
};

type OpenDialog = { eventId?: string; date: string } | null;

/** `/calendar` (US-20): the timetable for a week, or the calendar for a month, for whoever is signed in. */
export function CalendarView() {
  const now = useNow();
  const today = localParts(now).date;
  const [view, setView] = useState<"week" | "month">("week");
  const [picked, setPicked] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [kinds, setKinds] = useState<CalendarKind[]>(CALENDAR_KINDS);
  const [dialog, setDialog] = useState<OpenDialog>(null);

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setDialog(null);
  }, []);

  // The day the view is built around: the one picked, or today.
  const anchor = picked ?? today;
  const weeks = view === "week" ? [weekDates(anchor)] : monthWeeks(monthOf(anchor));
  const range = { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
  const calendar = useCalendar(range);

  if (calendar === undefined || now === 0) return <PageSkeleton />;
  if (!calendar) return null;

  const items = filterCalendar(calendar.items, { courseId: courseId || undefined, kinds });
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);

  const move = (direction: 1 | -1) =>
    setPicked(view === "week" ? addDays(anchor, 7 * direction) : `${addMonths(monthOf(anchor), direction)}-01`);
  const heading =
    view === "week"
      ? `${DAY_MONTH.format(at(range.from))} to ${DAY_MONTH.format(at(range.to))}, ${range.to.slice(0, 4)}`
      : MONTH_YEAR.format(at(`${monthOf(anchor)}-01`));
  const canAdd = calendar.canAddSchoolWide || calendar.editableCourses.length > 0;
  const { learner } = calendar;
  // A parent can look at the calendar but cannot open a course, a quiz or an assignment.
  const linkItems = !learner;
  const editable = (item: CalendarItem) => (item.eventId && calendar.editableEventIds.includes(item.eventId) ? item.eventId : undefined);
  const onEdit = (item: CalendarItem) => setDialog({ eventId: item.eventId, date: item.date });

  return (
    <PageContainer>
      <PageHeader
        title={learner ? `${firstNameOf(learner.name)}'s calendar` : "Calendar"}
        description="Classes, due dates, exams and school events. A change to a class or a deadline shows here as soon as it is made."
        actions={
          <>
            {learner && calendar.children.length > 1 ? (
              <>
                <label htmlFor="calendar-child" className="text-sm text-ink-2">
                  Student
                </label>
                <select id="calendar-child" value={learner.id} onChange={(event) => void selectViewedChild(event.target.value)} className={fieldClass}>
                  {calendar.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {canAdd ? (
              <Button onClick={() => setDialog({ date: anchor })}>
                <Plus aria-hidden className="size-4" />
                Add event
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => move(-1)} aria-label={view === "week" ? "Previous week" : "Previous month"}>
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPicked(null)}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => move(1)} aria-label={view === "week" ? "Next week" : "Next month"}>
              <ChevronRight aria-hidden className="size-4" />
            </Button>
            {/* Announced when the week or month changes (NFR-5). */}
            <h2 aria-live="polite" className="ml-2 text-lg font-semibold tracking-tight">
              {heading}
            </h2>
          </div>
          <div role="group" aria-label="View" className="flex rounded-lg border border-line-strong p-0.5">
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  view === option ? "bg-primary text-on-primary" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {option === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="calendar-course" className="text-sm text-ink-2">
              Course
            </label>
            <select id="calendar-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className={cn(fieldClass, "max-w-56")}>
              <option value="">All courses</option>
              {calendar.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <legend className="sr-only">Show</legend>
            {CALENDAR_KINDS.map((kind) => (
              <label key={kind} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={kinds.includes(kind)}
                  onChange={(event) =>
                    setKinds(event.target.checked ? CALENDAR_KINDS.filter((item) => item === kind || kinds.includes(item)) : kinds.filter((item) => item !== kind))
                  }
                  className="size-4 accent-primary"
                />
                <span aria-hidden className={cn("size-2 rounded-full", KIND_STYLES[kind].dot)} />
                {CALENDAR_KIND_LABELS[kind]}
              </label>
            ))}
          </fieldset>
        </div>
      </Card>

      {view === "week" ? (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {weeks[0].map((date) => (
            <li key={date}>
              <DayCard date={date} today={today} items={byDate.get(date) ?? []} link={linkItems} editable={editable} onEdit={onEdit} />
            </li>
          ))}
        </ol>
      ) : (
        <MonthGrid
          weeks={weeks}
          month={monthOf(anchor)}
          today={today}
          selected={anchor}
          byDate={byDate}
          onSelect={setPicked}
          link={linkItems}
          editable={editable}
          onEdit={onEdit}
        />
      )}

      {dialog ? (
        <CalendarEventDialog
          // Keyed by the event, so the form starts from that event's values.
          key={dialog.eventId ?? "new"}
          eventId={dialog.eventId}
          defaultDate={dialog.date}
          courses={calendar.editableCourses}
          canAddSchoolWide={calendar.canAddSchoolWide}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </PageContainer>
  );
}

interface EntryProps {
  /** Whether items open their course, quiz or assignment. */
  link: boolean;
  /** The id of the stored event behind an item, when the signed-in user may change it. */
  editable: (item: CalendarItem) => string | undefined;
  onEdit: (item: CalendarItem) => void;
}

function Entry({ item, link, editable, onEdit }: { item: CalendarItem } & EntryProps) {
  const style = KIND_STYLES[item.kind];
  return (
    <div className={cn("rounded-md border border-l-4 border-line bg-surface px-2.5 py-1.5 text-sm", style.bar)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-ink-2 tabular-nums">
            <span className="font-medium">{style.singular}</span> · {item.start ? `${item.start}${item.end ? `–${item.end}` : ""}` : "All day"}
          </div>
          <div className="font-medium break-words">
            {link && item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </div>
          {item.detail ? <div className="text-xs break-words text-ink-3">{item.detail}</div> : null}
        </div>
        {editable(item) ? (
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Change ${item.title}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-surface-2"
          >
            <Pencil aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** One day of the week view: the timetable for that day. */
function DayCard({ date, today, items, ...entry }: { date: string; today: string; items: CalendarItem[] } & EntryProps) {
  return (
    <Card className={cn("flex h-full flex-col gap-2 p-3", date === today && "border-primary")}>
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold">
        <span>
          {WEEKDAY_LONG.format(at(date))} <span className="font-normal text-ink-3">{DAY_MONTH.format(at(date))}</span>
        </span>
        {date === today ? <Badge tone="primary">Today</Badge> : null}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing scheduled.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <Entry item={item} {...entry} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The month as a grid of days to pick from, with the picked day's entries listed below it. */
function MonthGrid({
  weeks,
  month,
  today,
  selected,
  byDate,
  onSelect,
  ...entry
}: {
  weeks: string[][];
  month: string;
  today: string;
  selected: string;
  byDate: Map<string, CalendarItem[]>;
  onSelect: (date: string) => void;
} & EntryProps) {
  const dayItems = byDate.get(selected) ?? [];
  const describe = (items: CalendarItem[]) =>
    CALENDAR_KINDS.flatMap((kind) => {
      const count = items.filter((item) => item.kind === kind).length;
      return count === 0 ? [] : [`${count} ${count === 1 ? KIND_STYLES[kind].singular.toLowerCase() : CALENDAR_KIND_LABELS[kind].toLowerCase()}`];
    }).join(", ");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="overflow-hidden p-2 sm:p-3">
        <table className="w-full table-fixed border-separate border-spacing-1">
          <caption className="sr-only">{MONTH_YEAR.format(at(`${month}-01`))}. Choose a day to see what is on it.</caption>
          <thead>
            <tr>
              {weeks[0].map((date) => (
                <th key={date} scope="col" className="pb-1 text-center text-xs font-medium text-ink-3">
                  <span aria-hidden>{WEEKDAY_SHORT.format(at(date))}</span>
                  <span className="sr-only">{WEEKDAY_LONG.format(at(date))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((date) => {
                  const items = byDate.get(date) ?? [];
                  const kinds = CALENDAR_KINDS.filter((kind) => items.some((item) => item.kind === kind));
                  const summary = describe(items);
                  return (
                    <td key={date} className="p-0 align-top">
                      <button
                        type="button"
                        onClick={() => onSelect(date)}
                        aria-pressed={date === selected}
                        aria-label={`${FULL_DAY.format(at(date))}${date === today ? ", today" : ""}: ${summary || "nothing scheduled"}`}
                        className={cn(
                          "flex h-14 w-full flex-col items-center justify-start gap-1 rounded-lg border p-1 text-sm transition-colors sm:h-16",
                          date === selected ? "border-primary bg-primary-soft" : "border-transparent hover:bg-surface-2",
                          monthOf(date) !== month && "text-ink-3",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums",
                            date === today && "bg-primary text-on-primary",
                          )}
                        >
                          {Number(date.slice(8))}
                        </span>
                        <span aria-hidden className="flex flex-wrap justify-center gap-0.5">
                          {kinds.map((kind) => (
                            <span key={kind} className={cn("size-1.5 rounded-full", KIND_STYLES[kind].dot)} />
                          ))}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="self-start p-4">
        {/* Announced when another day is chosen. */}
        <h3 aria-live="polite" className="text-sm font-semibold">
          {FULL_DAY.format(at(selected))}
          {selected === today ? " · today" : ""}
        </h3>
        {dayItems.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Nothing scheduled.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {dayItems.map((item) => (
              <li key={item.id}>
                <Entry item={item} {...entry} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
