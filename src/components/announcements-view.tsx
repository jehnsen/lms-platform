"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { LoaderCircle, Megaphone, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Meter,
  PageContainer,
  PageHeader,
  PageSkeleton,
  fieldBaseClass,
  fieldClass,
} from "@/components/ui";
import {
  AnnouncementError,
  deleteAnnouncement,
  markAnnouncementRead,
  postAnnouncement,
  useAnnouncements,
  type AnnouncementRow,
  type AnnouncementsView as Announcements,
} from "@/lib/api/announcements";
import { selectViewedChild } from "@/lib/api/progress";
import { CHANNEL_LABELS, NOTIFICATION_CHANNELS } from "@/lib/domain/notifications";
import type { NotificationChannel } from "@/lib/types";
import { cn, firstNameOf, formatDateTime } from "@/lib/utils";

/** `/announcements` (US-22, US-05): every announcement the signed-in user has, newest first. */
export function AnnouncementsView() {
  const view = useAnnouncements();
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setComposing(false);
  }, []);

  if (view === undefined) return <PageSkeleton />;
  if (!view) return null;
  const { learner } = view;
  const unread = view.rows.filter((row) => row.unread).length;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title={learner ? `Announcements for ${firstNameOf(learner.name)}` : "Announcements"}
        description={
          view.postable.length > 0
            ? "Notices to your courses. Each shows how many students have read it."
            : learner
              ? `Notices from ${firstNameOf(learner.name)}'s teachers.`
              : "Notices from your teachers. Open one to read it."
        }
        actions={
          <>
            {learner && view.children.length > 1 ? (
              <>
                <label htmlFor="announcements-child" className="text-sm text-ink-2">
                  Student
                </label>
                <select
                  id="announcements-child"
                  value={learner.id}
                  onChange={(event) => void selectViewedChild(event.target.value)}
                  className={fieldClass}
                >
                  {view.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {view.postable.length > 0 ? (
              <Button onClick={() => setComposing(true)}>
                <Plus aria-hidden className="size-4" />
                New announcement
              </Button>
            ) : null}
          </>
        }
      />

      {/* Always rendered, so posting is announced (NFR-5). */}
      <p role="status" className={cn("text-sm text-good", note && "mb-4")}>
        {note}
      </p>

      {view.rows.length === 0 ? (
        <Card className="p-5 text-sm text-ink-2">There are no announcements yet.</Card>
      ) : (
        <>
          {view.postable.length === 0 && unread > 0 ? (
            <p className="mb-3 text-sm text-ink-2">
              {unread} not read yet.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {view.rows.map((row) => (
              <li key={row.announcement.id}>
                <AnnouncementCard row={row} showCourse />
              </li>
            ))}
          </ul>
        </>
      )}

      {composing ? (
        <AnnouncementDialog
          postable={view.postable}
          onClose={() => setComposing(false)}
          onPosted={(count) => setNote(`Posted, and sent to ${count} ${count === 1 ? "student" : "students"}.`)}
        />
      ) : null}
    </PageContainer>
  );
}

/** US-22: the course page's announcements, newest first, with the way to post one. */
export function CourseAnnouncements({ courseId }: { courseId: string }) {
  const view = useAnnouncements(courseId);
  const [composing, setComposing] = useState(false);

  useLayoutEffect(() => {
    return () => setComposing(false);
  }, []);

  if (!view) return null;
  const shown = view.rows.slice(0, 3);

  return (
    <section aria-labelledby="course-announcements">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="course-announcements" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Megaphone aria-hidden className="size-5 text-ink-2" />
          Announcements
        </h2>
        {view.postable.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => setComposing(true)}>
            <Plus aria-hidden className="size-4" />
            New announcement
          </Button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" className="py-6">
          News from your teacher about this course will show up here.
        </EmptyState>
      ) : (

        <ul className="flex flex-col gap-3">
          {shown.map((row) => (
            <li key={row.announcement.id}>
              <AnnouncementCard row={row} />
            </li>
          ))}
        </ul>
      )}
      {view.rows.length > shown.length ? (
        <Link href="/announcements" className="mt-3 inline-block text-sm font-medium text-primary-ink hover:underline">
          All {view.rows.length} announcements
        </Link>
      ) : null}
      {composing ? <AnnouncementDialog postable={view.postable} onClose={() => setComposing(false)} /> : null}
    </section>
  );
}

function AnnouncementCard({ row, showCourse = false }: { row: AnnouncementRow; showCourse?: boolean }) {
  const { announcement, stats } = row;
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState("");
  const meta = [
    showCourse ? row.course?.title : undefined,
    row.sectionNames.length > 0 ? row.sectionNames.join(", ") : "All sections",
    row.authorName,
    formatDateTime(announcement.postedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  const remove = async () => {
    try {
      await deleteAnnouncement(announcement.id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    }
  };

  // Staff see the announcement in full, with who has read it (US-22).
  if (stats) {
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{announcement.title}</h3>
            <p className="text-xs text-ink-3">{meta}</p>
          </div>
          {row.canDelete && !confirming ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Remove announcement ${announcement.title}`}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
        <p className="mt-2 max-w-prose text-sm whitespace-pre-wrap text-ink-2">{announcement.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium tabular-nums">
            Read by {stats.read} of {stats.total} {stats.total === 1 ? "student" : "students"}
          </span>
          <Meter
            value={stats.total === 0 ? 0 : (stats.read / stats.total) * 100}
            label={`Students who have read ${announcement.title}`}
            className="w-32"
          />
          <span className="flex flex-wrap gap-1">
            {announcement.channels.map((channel) => (
              <Badge key={channel}>{CHANNEL_LABELS[channel]}</Badge>
            ))}
          </span>
        </div>
        {stats.unread.length > 0 ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-primary-ink">Not read yet ({stats.unread.length})</summary>
            <p className="mt-1 text-ink-2">{stats.unread.map((student) => student.name).join(", ")}</p>
          </details>
        ) : null}
        {confirming ? (
          <div role="group" aria-label={`Remove ${announcement.title}?`} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">
            <span>Remove it from the course? Notifications already sent are not recalled.</span>
            <span className="flex gap-2">
              <Button variant="secondary" size="sm" autoFocus onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button size="sm" onClick={() => void remove()}>
                Yes, remove
              </Button>
            </span>
          </div>
        ) : null}
        {failure ? (
          <p role="alert" className="mt-2 text-sm text-bad">
            {failure}
          </p>
        ) : null}
      </Card>
    );
  }

  // A student, or a parent: opening it is what marks it read (FR-6.1).
  return (
    <Card className={cn("overflow-hidden", row.unread && "border-primary")}>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && row.unread) void markAnnouncementRead(announcement.id);
        }}
      >
        <summary className="cursor-pointer px-4 py-3">
          <span className="inline-flex flex-wrap items-center gap-2 align-middle">
            <span className="font-semibold">{announcement.title}</span>
            {row.unread ? <Badge tone="primary">New</Badge> : null}
          </span>
          <span className="mt-0.5 block text-xs text-ink-3">{meta}</span>
        </summary>
        <p className="max-w-prose border-t border-line px-4 py-3 text-sm whitespace-pre-wrap text-ink-2">{announcement.body}</p>
      </details>
    </Card>
  );
}

/** US-22: write an announcement, choose who it is for and how it is sent. */
function AnnouncementDialog({
  postable,
  onClose,
  onPosted,
}: {
  postable: Announcements["postable"];
  onClose: () => void;
  onPosted?: (students: number) => void;
}) {
  const [courseId, setCourseId] = useState(postable[0]?.course.id ?? "");
  const sections = postable.find((entry) => entry.course.id === courseId)?.sections ?? [];
  // Sections left unticked, so a new section added to the course is included by default.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<NotificationChannel[]>(["in-app", "email"]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const chosen = sections.filter((section) => !excluded.includes(section.id)).map((section) => section.id);

  const post = async () => {
    setBusy(true);
    setProblems([]);
    try {
      if (chosen.length === 0) throw new AnnouncementError(["Choose at least one section."]);
      const count = await postAnnouncement({ courseId, sectionIds: chosen, title, body, channels });
      onPosted?.(count);
      onClose();
    } catch (error) {
      setProblems(error instanceof AnnouncementError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
      setBusy(false);
    }
  };

  return (
    <Dialog wide title="New announcement" description="It appears on the course page and is sent to the students it is for." onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void post();
        }}
      >
        {postable.length > 1 ? (
          <div>
            <label htmlFor="announcement-course" className="mb-1 block text-sm font-medium">
              Course
            </label>
            <select
              id="announcement-course"
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setExcluded([]);
              }}
              className={cn(fieldClass, "w-full")}
            >
              {postable.map((entry) => (
                <option key={entry.course.id} value={entry.course.id}>
                  {entry.course.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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

        <div>
          <label htmlFor="announcement-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="announcement-title" value={title} onChange={(event) => setTitle(event.target.value)} className={cn(fieldClass, "w-full")} />
        </div>
        <div>
          <label htmlFor="announcement-body" className="mb-1 block text-sm font-medium">
            Message
          </label>
          <textarea
            id="announcement-body"
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(fieldBaseClass, "w-full px-3 py-2")}
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Send it by</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {NOTIFICATION_CHANNELS.map((channel) => (
              <label key={channel} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channels.includes(channel)}
                  onChange={(event) =>
                    setChannels(
                      event.target.checked
                        ? NOTIFICATION_CHANNELS.filter((item) => item === channel || channels.includes(item))
                        : channels.filter((item) => item !== channel),
                    )
                  }
                  className="size-4 accent-primary"
                />
                {CHANNEL_LABELS[channel]}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            A student who has switched a channel off for announcements does not get it that way. It is always on the
            course page.
          </p>
        </fieldset>

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
            Post announcement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
