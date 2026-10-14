"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, EyeOff, Flag, LoaderCircle, Lock, MessageSquare, Plus } from "lucide-react";
import { ForbiddenView } from "@/components/forbidden-view";
import { NotFoundView } from "@/components/not-found-view";
import { Badge, Button, ButtonLink, Card, PageContainer, PageHeader, PageSkeleton, fieldBaseClass, fieldClass } from "@/components/ui";
import {
  ForumError,
  createThread,
  dismissReports,
  replyToThread,
  reportPost,
  setPostHidden,
  setThreadLocked,
  useForumThread,
  useForums,
  type ForumCourse,
} from "@/lib/api/forums";
import { useActor } from "@/lib/api/session";
import { reportDecision } from "@/lib/domain/community";
import type { ForumPost } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

function messagesOf(error: unknown) {
  if (error instanceof ForumError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** `/forums` (US-23): the discussion threads of each of the signed-in user's courses. */
export function ForumList() {
  const actor = useActor();
  const forums = useForums();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  if (actor === undefined) return <PageSkeleton />;
  const forum = forums.find((entry) => entry.course.id === courseId) ?? forums[0];

  if (!forum) {
    return (
      <PageContainer>
        <PageHeader title="Discussions" description="You have no courses with a forum yet." />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow={forum.course.status === "archived" ? <Badge tone="warn">Archived term · read-only</Badge> : undefined}
        title="Discussions"
        description="Ask questions and work things out together. Each course has its own forum, and its teachers moderate it."
        actions={
          <>
            <label htmlFor="forum-course" className="sr-only">
              Course
            </label>
            <select
              id="forum-course"
              value={forum.course.id}
              onChange={(event) => {
                setCourseId(event.target.value);
                setStarting(false);
              }}
              className={cn(fieldClass, "max-w-full")}
            >
              {forums.map((entry) => (
                <option key={entry.course.id} value={entry.course.id}>
                  {entry.course.title}
                </option>
              ))}
            </select>
            {forum.canPost && !starting ? (
              <Button onClick={() => setStarting(true)}>
                <Plus aria-hidden className="size-4" />
                New thread
              </Button>
            ) : null}
          </>
        }
      />

      {starting ? <NewThread key={forum.course.id} forum={forum} onCancel={() => setStarting(false)} /> : null}

      <Card className="overflow-hidden">
        {forum.threads.length === 0 ? (
          <p className="p-5 text-sm text-ink-2">
            Nobody has started a thread in {forum.course.title} yet.{forum.canPost ? " Be the first." : ""}
          </p>
        ) : (
          <ul>
            {forum.threads.map(({ thread, replies, lastPostAt, reported, authorName }) => (
              <li key={thread.id} className="border-t border-line first:border-t-0">
                <Link href={`/forums/${thread.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1 basis-64">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{thread.title}</span>
                      {thread.locked ? (
                        <Badge>
                          <Lock aria-hidden className="size-3" />
                          Locked
                        </Badge>
                      ) : null}
                      {reported > 0 ? (
                        <Badge tone="warn">
                          <Flag aria-hidden className="size-3" />
                          {reported} reported
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-ink-3">
                      Started by {authorName} · last post {formatDateTime(lastPostAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-2 tabular-nums">
                    <MessageSquare aria-hidden className="size-4" />
                    {replies} {replies === 1 ? "reply" : "replies"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}

function NewThread({ forum, onCancel }: { forum: ForumCourse; onCancel: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const post = async () => {
    setBusy(true);
    setProblems([]);
    try {
      router.push(`/forums/${await createThread(forum.course.id, title, body)}`);
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void post();
        }}
      >
        <h2 className="font-semibold">New thread in {forum.course.title}</h2>
        <div>
          <label htmlFor="thread-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="thread-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={cn(fieldClass, "w-full")} />
        </div>
        <div>
          <label htmlFor="thread-body" className="mb-1 block text-sm font-medium">
            Your question or topic
          </label>
          <textarea id="thread-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} className={cn(fieldBaseClass, "w-full px-3 py-2")} />
        </div>
        <div role="alert">
          {problems.length > 0 ? <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problems.join(" ")}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Post thread
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** `/forums/[threadId]` (US-23): one thread, with replying, reporting and moderation. */
export function ForumThreadView({ threadId }: { threadId: string }) {
  const access = useForumThread(threadId);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState("");

  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView message="This thread doesn't exist, or it has been removed." />;
  if (access.status === "forbidden") return <ForbiddenView resource={`forum-thread:${threadId}`} what="this discussion" />;

  const { thread, course, posts } = access;

  const run = async (work: () => Promise<void>, done: string) => {
    setProblems([]);
    setNote("");
    try {
      await work();
      setNote(done);
      return true;
    } catch (error) {
      setProblems(messagesOf(error));
      return false;
    }
  };

  const reply = async () => {
    setBusy(true);
    await run(async () => {
      await replyToThread(thread.id, body);
      setBody("");
    }, "Your reply is posted.");
    setBusy(false);
  };

  return (
    <PageContainer className="max-w-3xl">
      <ButtonLink variant="ghost" size="sm" href="/forums" className="-ml-3">
        <ArrowLeft aria-hidden className="size-4" />
        Discussions
      </ButtonLink>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{thread.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {course?.title}
            {thread.locked ? (
              <Badge>
                <Lock aria-hidden className="size-3" />
                Locked
              </Badge>
            ) : null}
          </p>
        </div>
        {access.canModerate ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void run(
                () => setThreadLocked(thread.id, !thread.locked),
                thread.locked ? "The thread is open for replies again." : "The thread is locked. It can be read but not replied to.",
              )
            }
          >
            <Lock aria-hidden className="size-4" />
            {thread.locked ? "Unlock thread" : "Lock thread"}
          </Button>
        ) : null}
      </div>

      <ol className="flex flex-col gap-3">
        {posts.map((post, index) => (
          <li key={post.id}>
            <Post
              post={post}
              first={index === 0}
              authorName={access.names[post.authorId] ?? "Someone"}
              staff={access.staffIds.includes(post.authorId)}
              names={access.names}
              viewerId={access.viewerId}
              canReport={access.canReport}
              canModerate={access.canModerate}
              run={run}
            />
          </li>
        ))}
      </ol>

      {/* Always rendered, so the result of a reply, a report or a moderator's action is announced (NFR-5). */}
      <p role="status" className="mt-4 text-sm text-good">
        {note}
      </p>
      <div role="alert">
        {problems.length > 0 ? <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problems.join(" ")}</p> : null}
      </div>

      {access.canReply ? (
        <Card className="mt-4 p-4">
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void reply();
            }}
          >
            <label htmlFor="thread-reply" className="text-sm font-medium">
              Your reply
            </label>
            <textarea id="thread-reply" rows={3} value={body} onChange={(event) => setBody(event.target.value)} className={cn(fieldBaseClass, "w-full px-3 py-2")} />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !body.trim()}>
                {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                Post reply
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">{access.replyBlocked}</p>
      )}
    </PageContainer>
  );
}

function Post({
  post,
  first,
  authorName,
  staff,
  names,
  viewerId,
  canReport,
  canModerate,
  run,
}: {
  post: ForumPost;
  first: boolean;
  authorName: string;
  staff: boolean;
  names: Record<string, string>;
  viewerId: string;
  canReport: boolean;
  canModerate: boolean;
  /** Runs a forum action and reports the outcome on the page. Resolves with whether it worked. */
  run: (work: () => Promise<void>, done: string) => Promise<boolean>;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const mayReport = canReport && reportDecision(post, viewerId).allowed;
  const reportedByMe = post.reports.some((report) => report.byId === viewerId);
  // A hidden post reaches a student with its words already removed.
  const concealed = Boolean(post.hidden) && !canModerate;

  return (
    <Card className={cn("p-4", post.hidden && "border-dashed", canModerate && post.reports.length > 0 && !post.hidden && "border-warn")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold">{authorName}</span>
        {staff ? <Badge tone="primary">Teacher</Badge> : null}
        {first ? <Badge>Started the thread</Badge> : null}
        <span className="text-xs text-ink-3">{formatDateTime(post.createdAt)}</span>
      </div>

      {concealed ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-3">
          <EyeOff aria-hidden className="size-4" />
          A moderator has hidden this post.
        </p>
      ) : (
        <>
          {post.hidden ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-warn">
              <EyeOff aria-hidden className="size-4" />
              Hidden from students by {names[post.hidden.byId] ?? "a moderator"} on {formatDateTime(post.hidden.at)}.
            </p>
          ) : null}
          <p className={cn("mt-2 max-w-prose text-sm break-words whitespace-pre-wrap", post.hidden && "text-ink-3")}>{post.body}</p>
        </>
      )}

      {canModerate && post.reports.length > 0 ? (
        <div className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          <p className="font-medium">
            Reported {post.reports.length} {post.reports.length === 1 ? "time" : "times"}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {post.reports.map((report) => (
              <li key={`${report.byId}-${report.at}`}>
                {names[report.byId] ?? "Someone"}: {report.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canModerate ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void run(
                  () => setPostHidden(post.id, !post.hidden),
                  post.hidden ? "The post is visible to students again." : "The post is hidden from students, and its author has been told.",
                )
              }
            >
              <EyeOff aria-hidden className="size-4" />
              {post.hidden ? "Show again" : "Hide post"}
              <span className="sr-only"> by {authorName}</span>
            </Button>
            {post.reports.length > 0 && !post.hidden ? (
              <Button variant="ghost" size="sm" onClick={() => void run(() => dismissReports(post.id), "The reports are dismissed. The post stays.")}>
                Dismiss reports<span className="sr-only"> on the post by {authorName}</span>
              </Button>
            ) : null}
          </>
        ) : null}
        {mayReport && !reporting ? (
          <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
            <Flag aria-hidden className="size-4" />
            Report<span className="sr-only"> the post by {authorName}</span>
          </Button>
        ) : null}
        {reportedByMe && !canModerate ? <span className="text-xs text-ink-3">You reported this post. A teacher will look at it.</span> : null}
      </div>

      {reporting ? (
        <form
          noValidate
          className="mt-3 flex flex-col gap-2 rounded-lg bg-surface-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => reportPost(post.id, reason), "Thank you. The course's teachers have been told.").then((sent) => {
              if (!sent) return;
              setReporting(false);
              setReason("");
            });
          }}
        >
          <label htmlFor={`report-${post.id}`} className="text-sm font-medium">
            What is wrong with this post?
          </label>
          <input
            id={`report-${post.id}`}
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={cn(fieldClass, "w-full")}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setReporting(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Send report
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
