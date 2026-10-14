"use client";

/**
 * Forums service (BR-20, FR-6.3): discussion threads for each course, with
 * reporting and moderation (US-23).
 *
 * Backend seam: `GET /courses/:id/forum/threads`, `POST /courses/:id/forum/threads`,
 * `GET /forum/threads/:id`, `POST /forum/threads/:id/posts`,
 * `POST /forum/posts/:id/reports`, `PUT /forum/posts/:id/hidden`,
 * `DELETE /forum/posts/:id/reports`, `PUT /forum/threads/:id/locked`. The
 * server strips hidden posts and other people's reports before a student
 * receives them (`postFor()` in `src/lib/domain/community.ts`).
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import {
  postFor,
  postProblems,
  replyDecision,
  reportDecision,
  threadSummaries,
  type ThreadSummary,
} from "@/lib/domain/community";
import { can } from "@/lib/domain/permissions";
import type { Course, ForumPost, ForumThread } from "@/lib/types";
import { useRepository } from "./_repository";
import { coursesRepo, forumPostsRepo, forumThreadsRepo, sectionsRepo, usersRepo } from "./_stores";
import { notify } from "./notifications";
import { authorize, recordAudit, useActor } from "./session";

/** Something the forum rules do not allow, with every reason. */
export class ForumError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "ForumError";
  }
}

export interface ForumCourse {
  course: Pick<Course, "id" | "title" | "code" | "status">;
  threads: Array<ThreadSummary & { authorName: string }>;
  /** May start threads and reply. False for admins and in an archived course. */
  canPost: boolean;
  /** May hide posts, dismiss reports and lock threads. */
  canModerate: boolean;
}

/** US-23: the forums of the signed-in user's courses, each with its threads, most recently active first. */
export function useForums(): ForumCourse[] {
  const actor = useActor();
  const courses = useRepository(coursesRepo);
  const threads = useRepository(forumThreadsRepo);
  const posts = useRepository(forumPostsRepo);
  const users = useRepository(usersRepo);
  return useMemo(() => {
    if (!actor) return [];
    return courses
      .filter((course) => can(actor, "view", { type: "forum", courseId: course.id }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((course): ForumCourse => {
        const canModerate = can(actor, "update", { type: "forum", courseId: course.id });
        return {
          course,
          canPost: can(actor, "create", { type: "forum", courseId: course.id }),
          canModerate,
          threads: threadSummaries(
            threads.filter((thread) => thread.courseId === course.id),
            posts.filter((post) => post.courseId === course.id),
          ).map((summary) => ({
            ...summary,
            // Only moderators are told that a thread has reported posts.
            reported: canModerate ? summary.reported : 0,
            authorName: users.find((user) => user.id === summary.thread.authorId)?.name ?? "Someone",
          })),
        };
      });
  }, [actor, courses, threads, posts, users]);
}

export type ThreadAccess =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      thread: ForumThread;
      course: Pick<Course, "id" | "title" | "code" | "status"> | undefined;
      /** Oldest first, as this person may see them. */
      posts: ForumPost[];
      /** Names of the people who wrote, moderated or reported here, by user id. */
      names: Record<string, string>;
      /** Which authors are staff, so their posts can be marked. */
      staffIds: string[];
      viewerId: string;
      canReply: boolean;
      /** Why not, when the thread is locked or the course is read-only. */
      replyBlocked?: string;
      canModerate: boolean;
      /** May report posts: anyone who may post here. */
      canReport: boolean;
    };

/** One thread with its posts, with why it cannot be shown when it cannot. */
export function useForumThread(threadId: string | undefined): ThreadAccess {
  const actor = useActor();
  const threads = useRepository(forumThreadsRepo);
  const posts = useRepository(forumPostsRepo);
  const courses = useRepository(coursesRepo);
  const users = useRepository(usersRepo);
  return useMemo((): ThreadAccess => {
    if (actor === undefined) return { status: "loading" };
    const thread = threads.find((candidate) => candidate.id === threadId);
    if (!thread) return { status: "missing" };
    if (!actor || !can(actor, "view", { type: "forum", courseId: thread.courseId })) return { status: "forbidden" };
    const canModerate = can(actor, "update", { type: "forum", courseId: thread.courseId });
    const canPost = can(actor, "create", { type: "forum", courseId: thread.courseId });
    const reply = replyDecision(thread);
    return {
      status: "ok",
      thread,
      course: courses.find((course) => course.id === thread.courseId),
      posts: posts
        .filter((post) => post.threadId === thread.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((post) => postFor(post, { id: actor.id, moderator: canModerate })),
      names: Object.fromEntries(users.map((user) => [user.id, user.name])),
      staffIds: users.filter((user) => user.role === "faculty" || user.role === "admin").map((user) => user.id),
      viewerId: actor.id,
      canReply: canPost && reply.allowed,
      replyBlocked: !reply.allowed
        ? reply.reason
        : canPost
          ? undefined
          : actor.readOnlyCourseIds.includes(thread.courseId)
            ? "This course is archived, so its forum can be read but not posted in."
            : "You can read this forum but not post in it.",
      canModerate,
      canReport: canPost,
    };
  }, [actor, threads, posts, courses, users, threadId]);
}

let idCounter = 0;
const newId = (prefix: string, at: string) => `${prefix}-${Date.parse(at).toString(36)}${(idCounter += 1).toString(36)}`;

/** The staff who moderate a course's forum: the teachers of its sections. */
function moderatorIds(courseId: string) {
  return [...new Set(sectionsRepo.get().filter((section) => section.courseId === courseId).flatMap((section) => section.facultyIds))];
}

/** Starts a thread in a course's forum. Returns its id. */
export async function createThread(courseId: string, title: string, body: string): Promise<string> {
  const actor = authorize("create", { type: "forum", courseId });
  const problems = postProblems(body, title);
  if (problems.length > 0) throw new ForumError(problems);
  const createdAt = nowIso();
  const thread: ForumThread = { id: newId("thread", createdAt), courseId, title: title.trim(), authorId: actor.id, createdAt };
  const post: ForumPost = { id: newId("post", createdAt), threadId: thread.id, courseId, authorId: actor.id, body: body.trim(), createdAt, reports: [] };
  forumThreadsRepo.update((all) => [...all, thread]);
  forumPostsRepo.update((all) => [...all, post]);
  return thread.id;
}

/** Replies in a thread, and tells the person who started it. */
export async function replyToThread(threadId: string, body: string): Promise<void> {
  const thread = forumThreadsRepo.get().find((candidate) => candidate.id === threadId);
  if (!thread) throw new ForumError(["This thread no longer exists."]);
  const actor = authorize("create", { type: "forum", courseId: thread.courseId });
  const decision = replyDecision(thread);
  if (!decision.allowed) throw new ForumError([decision.reason]);
  const problems = postProblems(body);
  if (problems.length > 0) throw new ForumError(problems);
  const createdAt = nowIso();
  forumPostsRepo.update((all) => [
    ...all,
    { id: newId("post", createdAt), threadId, courseId: thread.courseId, authorId: actor.id, body: body.trim(), createdAt, reports: [] },
  ]);
  if (thread.authorId !== actor.id) {
    notify({
      userId: thread.authorId,
      category: "discussions",
      title: `${actor.name} replied to your thread`,
      body: thread.title,
      href: `/forums/${threadId}`,
    });
  }
}

function requirePost(postId: string) {
  const post = forumPostsRepo.get().find((candidate) => candidate.id === postId);
  if (!post) throw new ForumError(["This post no longer exists."]);
  return post;
}

function patchPost(postId: string, change: (post: ForumPost) => ForumPost) {
  forumPostsRepo.update((all) => all.map((post) => (post.id === postId ? change(post) : post)));
}

/**
 * US-23: reports a post as inappropriate. It stays visible until a moderator
 * decides, and the course's teachers are told.
 */
export async function reportPost(postId: string, reason: string): Promise<void> {
  const post = requirePost(postId);
  const actor = authorize("create", { type: "forum", courseId: post.courseId });
  const decision = reportDecision(post, actor.id);
  if (!decision.allowed) throw new ForumError([decision.reason]);
  if (!reason.trim()) throw new ForumError(["Say briefly what is wrong with the post."]);
  const at = nowIso();
  patchPost(postId, (current) => ({ ...current, reports: [...current.reports, { byId: actor.id, at, reason: reason.trim() }] }));
  const thread = forumThreadsRepo.get().find((candidate) => candidate.id === post.threadId);
  for (const moderatorId of moderatorIds(post.courseId)) {
    notify({
      userId: moderatorId,
      category: "discussions",
      title: "A forum post was reported",
      body: `In "${thread?.title ?? "a thread"}": ${reason.trim()}`,
      href: `/forums/${post.threadId}`,
    });
  }
  recordAudit({ action: "forum.report", resource: `forum-post:${postId}`, outcome: "allowed", detail: reason.trim() });
}

/** US-23: a moderator hides a post from students, or shows it again. Hiding settles its reports. */
export async function setPostHidden(postId: string, hidden: boolean): Promise<void> {
  const post = requirePost(postId);
  const actor = authorize("update", { type: "forum", courseId: post.courseId });
  if (Boolean(post.hidden) === hidden) return;
  const at = nowIso();
  patchPost(postId, (current) => ({ ...current, hidden: hidden ? { byId: actor.id, at } : undefined }));
  recordAudit({
    action: hidden ? "forum.hide-post" : "forum.unhide-post",
    resource: `forum-post:${postId}`,
    outcome: "allowed",
    detail: `${post.reports.length} ${post.reports.length === 1 ? "report" : "reports"}`,
  });
  if (hidden && post.authorId !== actor.id) {
    notify({
      userId: post.authorId,
      category: "discussions",
      title: "A moderator hid one of your forum posts",
      body: "Other students can no longer read it. Speak to your teacher if you think this is a mistake.",
      href: `/forums/${post.threadId}`,
    });
  }
}

/** A moderator decides a reported post is fine: its reports are cleared and it stays. */
export async function dismissReports(postId: string): Promise<void> {
  const post = requirePost(postId);
  authorize("update", { type: "forum", courseId: post.courseId });
  if (post.reports.length === 0) return;
  patchPost(postId, (current) => ({ ...current, reports: [] }));
  recordAudit({
    action: "forum.dismiss-reports",
    resource: `forum-post:${postId}`,
    outcome: "allowed",
    detail: `${post.reports.length} ${post.reports.length === 1 ? "report" : "reports"} dismissed`,
  });
}

/** A moderator locks a thread against replies, or opens it again. */
export async function setThreadLocked(threadId: string, locked: boolean): Promise<void> {
  const thread = forumThreadsRepo.get().find((candidate) => candidate.id === threadId);
  if (!thread) throw new ForumError(["This thread no longer exists."]);
  authorize("update", { type: "forum", courseId: thread.courseId });
  forumThreadsRepo.update((all) => all.map((candidate) => (candidate.id === threadId ? { ...candidate, locked: locked || undefined } : candidate)));
  recordAudit({ action: locked ? "forum.lock-thread" : "forum.unlock-thread", resource: `forum-thread:${threadId}`, outcome: "allowed", detail: thread.title });
}
