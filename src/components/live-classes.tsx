"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { LoaderCircle, Plus, Video } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Button, Card, fieldClass } from "@/components/ui";
import {
  LiveError,
  cancelLiveClass,
  endLiveClass,
  joinLiveClass,
  scheduleLiveClass,
  settleLiveClasses,
  useLiveClasses,
  type LiveRow,
} from "@/lib/api/live";
import { useCourseSections } from "@/lib/api/courses";
import { JOIN_OPENS_MINUTES_BEFORE, LIVE_DURATION_RANGE, joinOpensAt } from "@/lib/domain/community";
import { useNow } from "@/lib/use-now";
import { cn, formatDateTime, fromLocalInput, toLocalInput } from "@/lib/utils";

function messagesOf(error: unknown) {
  if (error instanceof LiveError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/**
 * US-24: the course's live classes, on the course page. The join button shows
 * from shortly before the scheduled start until the class ends; afterwards the
 * recording is linked here.
 */
export function LiveClasses({ courseId }: { courseId: string }) {
  const live = useLiveClasses(courseId);
  const now = useNow();
  const [scheduling, setScheduling] = useState(false);
  const [joined, setJoined] = useState<{ title: string; joinUrl: string; provider: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => {
      setScheduling(false);
      setJoined(null);
    };
  }, []);

  // MOCK stand-in for the video service telling the app a class is over: checked whenever the clock moves on.
  useEffect(() => {
    if (now > 0) void settleLiveClasses();
  }, [now]);

  if (!live) return null;
  if (live.rows.length === 0 && !live.canManage) return null;

  const run = async (row: LiveRow, work: () => Promise<string>) => {
    setBusyId(row.session.id);
    setProblems([]);
    setNote("");
    try {
      setNote(await work());
    } catch (error) {
      setProblems(messagesOf(error));
    } finally {
      setBusyId(null);
    }
  };

  const join = (row: LiveRow) =>
    run(row, async () => {
      setJoined({ title: row.session.title, ...(await joinLiveClass(row.session.id)) });
      return "";
    });

  return (
    <section aria-labelledby="course-live">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="course-live" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Video aria-hidden className="size-5 text-ink-2" />
          Live classes
        </h2>
        {live.canManage ? (
          <Button variant="secondary" size="sm" onClick={() => setScheduling(true)}>
            <Plus aria-hidden className="size-4" />
            Schedule live class
          </Button>
        ) : null}
      </div>

      {live.rows.length === 0 ? (
        <p className="text-sm text-ink-2">None scheduled.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {live.rows.map((row) => {
            const { session, state } = row;
            const busy = busyId === session.id;
            return (
              <li key={session.id}>
                <Card className={cn("flex flex-wrap items-center justify-between gap-3 p-4", state === "open" && "border-primary")}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{session.title}</h3>
                      {state === "open" ? <Badge tone="good">Open now</Badge> : null}
                      {state === "ended" ? <Badge>Ended</Badge> : null}
                    </div>
                    <p className="text-sm text-ink-2">
                      {formatDateTime(session.startsAt)} · {session.durationMinutes} min
                      {row.sectionNames.length > 0 ? ` · ${row.sectionNames.join(", ")}` : ""}
                    </p>
                    {state === "upcoming" ? (
                      <p className="text-xs text-ink-3">
                        The join button appears here {JOIN_OPENS_MINUTES_BEFORE} minutes before the start, at{" "}
                        {formatDateTime(new Date(joinOpensAt(session)).toISOString())}.
                      </p>
                    ) : null}
                    {state === "ended" ? (
                      session.recording ? (
                        <a
                          href={session.recording.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary-ink hover:underline"
                        >
                          Watch the recording
                          <span className="sr-only"> of {session.title} (opens in a new tab)</span>
                        </a>
                      ) : (
                        <p className="text-xs text-ink-3">The recording is being prepared.</p>
                      )
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {state === "open" ? (
                      <Button disabled={busy} onClick={() => void join(row)}>
                        {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Video aria-hidden className="size-4" />}
                        Join<span className="sr-only"> {session.title}</span>
                      </Button>
                    ) : null}
                    {live.canManage && state === "open" ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(row, async () => {
                            await endLiveClass(session.id);
                            return `${session.title} has ended. Its recording is linked here.`;
                          })
                        }
                      >
                        End class
                      </Button>
                    ) : null}
                    {live.canManage && state === "upcoming" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void run(row, async () => {
                            await cancelLiveClass(session.id);
                            return `${session.title} is cancelled, and the students have been told.`;
                          })
                        }
                      >
                        Cancel<span className="sr-only"> {session.title}</span>
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Always rendered, so the join button appearing and a class ending are announced (NFR-5). */}
      <p role="status" className="mt-2 text-sm text-good">
        {note || (live.rows.some((row) => row.state === "open") ? "A live class is open to join." : "")}
      </p>
      <div role="alert">{problems.length > 0 ? <p className="text-sm text-bad">{problems.join(" ")}</p> : null}</div>

      {scheduling ? <ScheduleDialog courseId={courseId} onClose={() => setScheduling(false)} onDone={setNote} /> : null}
      {joined ? (
        <Dialog title={`Joining ${joined.title}`} onClose={() => setJoined(null)}>
          <p className="text-sm text-ink-2">
            With the school&apos;s video conferencing service connected, this is where {joined.provider} opens and you
            are taken into the class, with no separate link to find.
          </p>
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs break-all">{joined.joinUrl}</p>
          <p className="mt-3 text-sm text-ink-2">In this demo no call is started.</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setJoined(null)}>Close</Button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

function ScheduleDialog({ courseId, onClose, onDone }: { courseId: string; onClose: () => void; onDone: (note: string) => void }) {
  const sections = useCourseSections(courseId);
  const [title, setTitle] = useState("");
  // Starts in five minutes by default: inside the time the join button shows, so it can be tried at once.
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 5 * 60 * 1000).toISOString()));
  const [duration, setDuration] = useState("50");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const save = async () => {
    setBusy(true);
    setProblems([]);
    try {
      const sectionIds = sections.filter((section) => !excluded.includes(section.id)).map((section) => section.id);
      if (sections.length > 0 && sectionIds.length === 0) throw new LiveError(["Choose at least one section."]);
      await scheduleLiveClass({
        courseId,
        title,
        startsAt: fromLocalInput(startsAt) ?? "",
        durationMinutes: duration.trim() === "" ? Number.NaN : Number(duration),
        sectionIds,
      });
      onDone(`${title.trim()} is scheduled, and the students have been told.`);
      onClose();
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(false);
    }
  };

  return (
    <Dialog title="Schedule a live class" description="Students join from this course page. No separate link is sent." onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor="live-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="live-title" value={title} onChange={(event) => setTitle(event.target.value)} className={cn(fieldClass, "w-full")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="live-start" className="mb-1 block text-sm font-medium">
              Starts
            </label>
            <input
              id="live-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div>
            <label htmlFor="live-duration" className="mb-1 block text-sm font-medium">
              Length (minutes)
            </label>
            <input
              id="live-duration"
              type="number"
              inputMode="numeric"
              min={LIVE_DURATION_RANGE.min}
              max={LIVE_DURATION_RANGE.max}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className={cn(fieldClass, "w-full")}
            />
          </div>
        </div>
        {sections.length > 1 ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">For</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sections.map((section) => (
                <label key={section.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!excluded.includes(section.id)}
                    onChange={(event) =>
                      setExcluded(event.target.checked ? excluded.filter((id) => id !== section.id) : [...excluded, section.id])
                    }
                    className="size-4 accent-primary"
                  />
                  {section.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <p className="text-xs text-ink-3">
          The join button appears {JOIN_OPENS_MINUTES_BEFORE} minutes before the start. When the class ends, its
          recording is linked on this page.
        </p>
        <div role="alert">
          {problems.length > 0 ? (
            <div className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Schedule
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
