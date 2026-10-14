"use client";

/**
 * Live classes (BR-21, FR-6.4, FR-6.5): scheduled from the course page, joined
 * there when the time comes, with the recording linked afterwards (US-24).
 *
 * Backend seam: `GET /courses/:id/live-sessions`, `POST /courses/:id/live-sessions`,
 * `POST /live-sessions/:id/join` (returns the caller's own join address),
 * `POST /live-sessions/:id/end`, `DELETE /live-sessions/:id`, and a webhook
 * from the video service that ends a session and attaches its recording.
 */
import { useMemo } from "react";
import { mockVideoConferencing } from "@/lib/adapters/video-conferencing";
import { nowIso } from "@/lib/clock";
import { audienceOf, isForSections, liveEndsAt, liveProblems, liveState, type LiveState } from "@/lib/domain/community";
import { can } from "@/lib/domain/permissions";
import type { LiveSession } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { formatDateTime } from "@/lib/utils";
import { useRepository } from "./_repository";
import { coursesRepo, enrollmentsRepo, liveSessionsRepo, sectionsRepo, usersRepo } from "./_stores";
import { notify } from "./notifications";
import { authorize, recordAudit, useActor } from "./session";

/** Something the live class rules do not allow, with every reason. */
export class LiveError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "LiveError";
  }
}

export interface LiveRow {
  session: LiveSession;
  state: LiveState;
  /** The sections it is for, by name. Empty: the whole course. */
  sectionNames: string[];
}

export interface LiveClasses {
  /** Running and upcoming first, soonest first; then ended ones, newest first. */
  rows: LiveRow[];
  /** May schedule, end and cancel. False for students, admins and in an archived course. */
  canManage: boolean;
}

/**
 * A course's live classes as the signed-in user has them: a student gets the
 * ones for their sections. `null` unless they may see the course's.
 */
export function useLiveClasses(courseId: string): LiveClasses | null {
  const actor = useActor();
  const sessions = useRepository(liveSessionsRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const now = useNow();
  return useMemo(() => {
    if (!actor || !can(actor, "view", { type: "live-session", courseId })) return null;
    const courseSections = sections.filter((section) => section.courseId === courseId);
    const courseSectionIds = courseSections.map((section) => section.id);
    const mine = enrollments.filter((entry) => entry.userId === actor.id).map((entry) => entry.sectionId);
    const rows = sessions
      .filter((session) => session.courseId === courseId && session.status !== "cancelled")
      .filter((session) => actor.role !== "student" || isForSections(session, courseSectionIds, mine))
      .map((session): LiveRow => ({
        session,
        state: liveState(session, now),
        sectionNames: courseSections.filter((section) => session.sectionIds.includes(section.id)).map((section) => section.name),
      }));
    const rank = (row: LiveRow) => (row.state === "ended" ? 1 : 0);
    rows.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (rank(a) === 0 ? a.session.startsAt.localeCompare(b.session.startsAt) : b.session.startsAt.localeCompare(a.session.startsAt)),
    );
    return { rows, canManage: can(actor, "create", { type: "live-session", courseId }) };
  }, [actor, sessions, sections, enrollments, now, courseId]);
}

let idCounter = 0;

export interface LiveInput {
  courseId: string;
  title: string;
  /** ISO date-time. */
  startsAt: string;
  durationMinutes: number;
  /** Empty: the whole course. */
  sectionIds: string[];
}

/**
 * US-24: schedules a live class through the video conferencing service and
 * tells the students it is for. It then shows on the course page and the
 * calendar. Returns its id.
 */
export async function scheduleLiveClass(input: LiveInput): Promise<string> {
  const actor = authorize("create", { type: "live-session", courseId: input.courseId });
  const sections = sectionsRepo.get();
  const courseSectionIds = sections.filter((section) => section.courseId === input.courseId).map((section) => section.id);
  const sectionIds = input.sectionIds.length === courseSectionIds.length ? [] : input.sectionIds;
  const draft = { title: input.title.trim(), startsAt: input.startsAt, durationMinutes: input.durationMinutes, sectionIds };
  const createdAt = nowIso();
  const problems = liveProblems(draft, courseSectionIds, Date.parse(createdAt));
  if (problems.length > 0) throw new LiveError(problems);

  let meeting;
  try {
    meeting = await mockVideoConferencing.createMeeting(draft);
  } catch {
    throw new LiveError(["The video conferencing service could not be reached. Try again."]);
  }
  idCounter += 1;
  const session: LiveSession = {
    ...draft,
    id: `live-${Date.parse(createdAt).toString(36)}${idCounter.toString(36)}`,
    courseId: input.courseId,
    createdById: actor.id,
    provider: mockVideoConferencing.name,
    meetingId: meeting.meetingId,
    joinUrl: meeting.joinUrl,
    status: "scheduled",
  };
  liveSessionsRepo.update((all) => [...all, session]);

  const course = coursesRepo.get().find((candidate) => candidate.id === input.courseId);
  const audience = audienceOf(session, sections, enrollmentsRepo.get(), usersRepo.get());
  for (const studentId of audience) {
    notify({
      userId: studentId,
      category: "schedule",
      title: `Live class: ${session.title}`,
      body: `${course?.title ?? "Your course"}, ${formatDateTime(session.startsAt)}, ${session.durationMinutes} minutes. Join from the course page when it starts.`,
      href: `/courses/${input.courseId}`,
    });
  }
  recordAudit({
    action: "live.schedule",
    resource: `live-session:${session.id}`,
    outcome: "allowed",
    detail: `${course?.code ?? input.courseId}: ${session.title}, ${session.startsAt}`,
  });
  return session.id;
}

/**
 * The address to open for a live class, for someone who may attend it and
 * only while the join button shows (US-24).
 */
export async function joinLiveClass(sessionId: string): Promise<{ joinUrl: string; provider: string }> {
  const session = liveSessionsRepo.get().find((candidate) => candidate.id === sessionId);
  if (!session) throw new LiveError(["This live class no longer exists."]);
  authorize("view", { type: "live-session", courseId: session.courseId });
  const state = liveState(session, Date.parse(nowIso()));
  if (state !== "open") {
    throw new LiveError([state === "upcoming" ? "This class has not opened yet." : "This class is over."]);
  }
  return { joinUrl: session.joinUrl, provider: session.provider };
}

async function finish(session: LiveSession, endedAt: string) {
  // FR-6.5: the service's recording is linked to the course once the session has ended.
  const recording = await mockVideoConferencing.getRecording(session.meetingId).catch(() => null);
  liveSessionsRepo.update((all) =>
    all.map((candidate) =>
      candidate.id === session.id ? { ...candidate, status: "ended", endedAt, recording: recording ?? undefined } : candidate,
    ),
  );
}

/** The teacher ends a live class. Its recording is then linked on the course page. */
export async function endLiveClass(sessionId: string): Promise<void> {
  const session = liveSessionsRepo.get().find((candidate) => candidate.id === sessionId);
  if (!session || session.status !== "scheduled") return;
  authorize("update", { type: "live-session", courseId: session.courseId });
  await mockVideoConferencing.endMeeting(session.meetingId).catch(() => undefined);
  await finish(session, nowIso());
  recordAudit({ action: "live.end", resource: `live-session:${sessionId}`, outcome: "allowed", detail: session.title });
}

/** Cancels a live class that has not happened, and tells the students it was for. */
export async function cancelLiveClass(sessionId: string): Promise<void> {
  const session = liveSessionsRepo.get().find((candidate) => candidate.id === sessionId);
  if (!session || session.status !== "scheduled") return;
  authorize("update", { type: "live-session", courseId: session.courseId });
  liveSessionsRepo.update((all) => all.map((candidate) => (candidate.id === sessionId ? { ...candidate, status: "cancelled" } : candidate)));
  for (const studentId of audienceOf(session, sectionsRepo.get(), enrollmentsRepo.get(), usersRepo.get())) {
    notify({
      userId: studentId,
      category: "schedule",
      title: `Cancelled: ${session.title}`,
      body: `The live class planned for ${formatDateTime(session.startsAt)} will not take place.`,
      href: `/courses/${session.courseId}`,
    });
  }
  recordAudit({ action: "live.cancel", resource: `live-session:${sessionId}`, outcome: "allowed", detail: session.title });
}

/**
 * MOCK stand-in for the video service's webhook: marks every live class whose
 * time has run out as ended and links its recording. Called when a course
 * page is shown.
 */
export async function settleLiveClasses(): Promise<void> {
  const now = Date.parse(nowIso());
  for (const session of liveSessionsRepo.get()) {
    if (session.status === "scheduled" && now >= liveEndsAt(session)) {
      await finish(session, new Date(liveEndsAt(session)).toISOString());
    }
  }
}
