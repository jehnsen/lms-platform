/**
 * Rules for the course's shared spaces: announcements with read tracking
 * (FR-6.1), discussion forums with moderation and reporting (FR-6.3), and live
 * classes (FR-6.4, FR-6.5). No clock and no storage: callers pass `now`.
 */
import type { Announcement, Enrollment, ForumPost, ForumThread, LiveSession, Section, User } from "@/lib/types";

// --- Announcements (US-22) ------------------------------------------------------------

export const MAX_ANNOUNCEMENT_LENGTH = 5000;

/** Why an announcement cannot be posted. Empty when it can. */
export function announcementProblems(
  draft: Pick<Announcement, "title" | "body" | "sectionIds" | "channels">,
  courseSectionIds: string[],
): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Give the announcement a title.");
  if (!draft.body.trim()) problems.push("Write the announcement.");
  else if (draft.body.trim().length > MAX_ANNOUNCEMENT_LENGTH) {
    problems.push(`An announcement can be up to ${MAX_ANNOUNCEMENT_LENGTH} characters.`);
  }
  if (draft.sectionIds.some((id) => !courseSectionIds.includes(id))) {
    problems.push("One of the sections chosen is not a section of this course.");
  }
  if (draft.channels.length === 0) problems.push("Choose at least one way to send it.");
  return problems;
}

/** True when something addressed to these sections (none listed: the whole course) is for a student in `sectionIds`. */
export function isForSections(target: { sectionIds: string[] }, courseSectionIds: string[], sectionIds: string[]) {
  const audience = target.sectionIds.length > 0 ? target.sectionIds : courseSectionIds;
  return audience.some((id) => sectionIds.includes(id));
}

/** The active students something addressed to these sections reaches. */
export function audienceOf(
  target: { courseId: string; sectionIds: string[] },
  sections: Array<Pick<Section, "id" | "courseId">>,
  enrollments: Enrollment[],
  users: Array<Pick<User, "id" | "role" | "status">>,
): string[] {
  const courseSectionIds = sections.filter((section) => section.courseId === target.courseId).map((section) => section.id);
  const audience = target.sectionIds.length > 0 ? target.sectionIds.filter((id) => courseSectionIds.includes(id)) : courseSectionIds;
  const ids = new Set(enrollments.filter((entry) => audience.includes(entry.sectionId)).map((entry) => entry.userId));
  return users.filter((user) => ids.has(user.id) && user.role === "student" && user.status === "active").map((user) => user.id);
}

/**
 * US-22: how many of the students an announcement is for have read it. A
 * teacher, a parent or a student outside its audience opening it is not counted.
 */
export function readStats(announcement: Pick<Announcement, "readBy">, audienceIds: string[]) {
  const readIds = audienceIds.filter((id) => announcement.readBy[id] !== undefined);
  return {
    read: readIds.length,
    total: audienceIds.length,
    unreadIds: audienceIds.filter((id) => announcement.readBy[id] === undefined),
  };
}

// --- Forums (US-23) -----------------------------------------------------------------------

export const MAX_POST_LENGTH = 5000;

/** Why a thread or a reply cannot be posted. Empty when it can. */
export function postProblems(body: string, title?: string): string[] {
  const problems: string[] = [];
  if (title !== undefined && !title.trim()) problems.push("Give the thread a title.");
  if (!body.trim()) problems.push(title === undefined ? "Write your reply first." : "Write the first post.");
  else if (body.trim().length > MAX_POST_LENGTH) problems.push(`A post can be up to ${MAX_POST_LENGTH} characters.`);
  return problems;
}

/** May this thread be replied to? */
export function replyDecision(thread: Pick<ForumThread, "locked">): { allowed: true } | { allowed: false; reason: string } {
  return thread.locked
    ? { allowed: false, reason: "A moderator has locked this thread, so it can be read but not replied to." }
    : { allowed: true };
}

/** May this person report this post as inappropriate? Not their own, not twice, and not one already hidden. */
export function reportDecision(post: Pick<ForumPost, "authorId" | "reports" | "hidden">, userId: string) {
  if (post.authorId === userId) return { allowed: false as const, reason: "You cannot report your own post." };
  if (post.hidden) return { allowed: false as const, reason: "A moderator has already hidden this post." };
  if (post.reports.some((report) => report.byId === userId)) {
    return { allowed: false as const, reason: "You have already reported this post." };
  }
  return { allowed: true as const };
}

/**
 * A post as one person may see it (FR-6.3). Moderators see everything. Anyone
 * else gets a hidden post with its words removed, and never sees who reported
 * what: only whether they reported it themselves.
 */
export function postFor(post: ForumPost, viewer: { id: string; moderator: boolean }): ForumPost {
  if (viewer.moderator) return post;
  return {
    ...post,
    body: post.hidden ? "" : post.body,
    reports: post.reports.filter((report) => report.byId === viewer.id),
  };
}

export interface ThreadSummary {
  thread: ForumThread;
  /** Posts after the first one. */
  replies: number;
  lastPostAt: string;
  /** Posts with reports that no moderator has dealt with. */
  reported: number;
}

/** A course's threads for the list: the most recently active first. */
export function threadSummaries(threads: ForumThread[], posts: ForumPost[]): ThreadSummary[] {
  return threads
    .map((thread) => {
      const mine = posts.filter((post) => post.threadId === thread.id);
      return {
        thread,
        replies: Math.max(0, mine.length - 1),
        lastPostAt: mine.reduce((latest, post) => (post.createdAt > latest ? post.createdAt : latest), thread.createdAt),
        reported: mine.filter((post) => post.reports.length > 0 && !post.hidden).length,
      };
    })
    .sort((a, b) => b.lastPostAt.localeCompare(a.lastPostAt));
}

// --- Live classes (US-24) -----------------------------------------------------------------

/** The join button opens this long before the scheduled start, so people can settle in. */
export const JOIN_OPENS_MINUTES_BEFORE = 10;

export const LIVE_DURATION_RANGE = { min: 10, max: 480 } as const;

const MINUTE_MS = 60 * 1000;

export function liveEndsAt(session: Pick<LiveSession, "startsAt" | "durationMinutes">) {
  return Date.parse(session.startsAt) + session.durationMinutes * MINUTE_MS;
}

export function joinOpensAt(session: Pick<LiveSession, "startsAt">) {
  return Date.parse(session.startsAt) - JOIN_OPENS_MINUTES_BEFORE * MINUTE_MS;
}

export type LiveState =
  /** Scheduled, and the join button is not showing yet. */
  | "upcoming"
  /** The join button shows: from shortly before the start until the class ends. */
  | "open"
  /** Over: ended by the teacher, or its time has run out. */
  | "ended"
  | "cancelled";

/** US-24: where a live class stands at `nowMs`. The join button appears at the scheduled time, not before. */
export function liveState(session: Pick<LiveSession, "status" | "startsAt" | "durationMinutes">, nowMs: number): LiveState {
  if (session.status === "cancelled") return "cancelled";
  if (session.status === "ended" || nowMs >= liveEndsAt(session)) return "ended";
  return nowMs >= joinOpensAt(session) ? "open" : "upcoming";
}

/** Why a live class cannot be scheduled. Empty when it can. */
export function liveProblems(
  draft: Pick<LiveSession, "title" | "startsAt" | "durationMinutes" | "sectionIds">,
  courseSectionIds: string[],
  nowMs: number,
): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Give the live class a title.");
  const start = Date.parse(draft.startsAt);
  if (Number.isNaN(start)) problems.push("Choose when it starts.");
  else if (start + draft.durationMinutes * MINUTE_MS <= nowMs) problems.push("That time has already passed.");
  if (
    !Number.isInteger(draft.durationMinutes) ||
    draft.durationMinutes < LIVE_DURATION_RANGE.min ||
    draft.durationMinutes > LIVE_DURATION_RANGE.max
  ) {
    problems.push(`It must last from ${LIVE_DURATION_RANGE.min} to ${LIVE_DURATION_RANGE.max} minutes.`);
  }
  if (draft.sectionIds.some((id) => !courseSectionIds.includes(id))) {
    problems.push("One of the sections chosen is not a section of this course.");
  }
  return problems;
}
