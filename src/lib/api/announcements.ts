"use client";

/**
 * Announcements service (BR-20, FR-6.1): notices a teacher posts to a course
 * or to some of its sections, sent through the channels they choose, with a
 * count of the students who have read them (US-22).
 *
 * Backend seam: `GET /announcements`, `POST /courses/:id/announcements`,
 * `POST /announcements/:id/read`, `DELETE /announcements/:id`. The server
 * records each read itself and returns the read count only to staff.
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import { announcementProblems, audienceOf, isForSections, readStats } from "@/lib/domain/community";
import { can } from "@/lib/domain/permissions";
import type { Announcement, Course, NotificationChannel, Section, User } from "@/lib/types";
import { useRepository } from "./_repository";
import {
  announcementsRepo,
  coursesRepo,
  enrollmentsRepo,
  sectionsRepo,
  usersRepo,
  viewedChildRepo,
} from "./_stores";
import { notify } from "./notifications";
import { authorize, getActor, recordAudit, useActor } from "./session";
import { useLinkedChildren } from "./users";

/** An announcement that cannot be posted, with every reason. */
export class AnnouncementError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "AnnouncementError";
  }
}

export interface AnnouncementRow {
  announcement: Announcement;
  course: Pick<Course, "id" | "title" | "code"> | undefined;
  authorName: string;
  /** The sections it is for, by name. Empty: the whole course. */
  sectionNames: string[];
  /** Students, and a parent for their child: it has not been opened yet. */
  unread: boolean;
  /** Staff only (US-22): how many of the students it was sent to have read it, and who has not. */
  stats?: { read: number; total: number; unread: Array<Pick<User, "id" | "name">> };
  canDelete: boolean;
}

export interface AnnouncementsView {
  rows: AnnouncementRow[];
  /** The courses the signed-in user may post to, each with its sections. */
  postable: Array<{ course: Pick<Course, "id" | "title" | "code">; sections: Section[] }>;
  /** Whose announcements these are, when not the signed-in user's own: a parent's child. */
  learner: User | undefined;
  children: User[];
}

/**
 * The announcements the signed-in user has, newest first: a student's are
 * those for their sections, a parent's those of a linked child, a teacher's
 * those of the courses they teach, an admin's all of them. `undefined` while
 * loading; `null` for nobody.
 */
export function useAnnouncements(courseId?: string): AnnouncementsView | null | undefined {
  const actor = useActor();
  const announcements = useRepository(announcementsRepo);
  const courses = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const users = useRepository(usersRepo);
  const selection = useRepository(viewedChildRepo);
  const children = useLinkedChildren();

  return useMemo(() => {
    if (actor === undefined) return undefined;
    if (!actor) return null;
    const learner =
      actor.role === "parent" ? (children.find((child) => child.id === selection[actor.id]) ?? children[0]) : undefined;
    // The student whose sections decide what is shown: the signed-in student, or a parent's child.
    const studentId = actor.role === "student" ? actor.id : learner?.id;
    const mySectionIds = studentId ? enrollments.filter((entry) => entry.userId === studentId).map((entry) => entry.sectionId) : [];
    const readerId = actor.id;

    const rows = announcements
      .filter((announcement) => courseId === undefined || announcement.courseId === courseId)
      .filter((announcement) => {
        const courseSectionIds = sections.filter((section) => section.courseId === announcement.courseId).map((section) => section.id);
        if (studentId) {
          const allowed =
            actor.role === "student"
              ? can(actor, "view", { type: "announcement", courseId: announcement.courseId })
              : can(actor, "view", { type: "announcement", ownerId: studentId });
          return allowed && isForSections(announcement, courseSectionIds, mySectionIds);
        }
        return can(actor, "view", { type: "announcement", courseId: announcement.courseId });
      })
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
      .map((announcement): AnnouncementRow => {
        const staff = actor.role === "faculty" || actor.role === "admin";
        const audience = staff ? audienceOf(announcement, sections, enrollments, users) : [];
        const stats = staff ? readStats(announcement, audience) : undefined;
        return {
          announcement,
          course: courses.find((course) => course.id === announcement.courseId),
          authorName: users.find((user) => user.id === announcement.authorId)?.name ?? "A teacher",
          sectionNames: sections.filter((section) => announcement.sectionIds.includes(section.id)).map((section) => section.name),
          unread: !staff && announcement.readBy[readerId] === undefined,
          stats: stats && {
            read: stats.read,
            total: stats.total,
            unread: users
              .filter((user) => stats.unreadIds.includes(user.id))
              .map((user) => ({ id: user.id, name: user.name }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          },
          canDelete: can(actor, "delete", { type: "announcement", courseId: announcement.courseId }),
        };
      });

    const postable = courses
      .filter((course) => can(actor, "create", { type: "announcement", courseId: course.id }))
      .filter((course) => courseId === undefined || course.id === courseId)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((course) => ({
        course,
        sections: sections.filter((section) => section.courseId === course.id).sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return { rows, postable, learner, children };
  }, [actor, announcements, courses, sections, enrollments, users, selection, children, courseId]);
}

let idCounter = 0;

export interface AnnouncementInput {
  courseId: string;
  /** Empty: the whole course. */
  sectionIds: string[];
  title: string;
  body: string;
  channels: NotificationChannel[];
}

/**
 * US-22: posts an announcement. It appears on the course page at once and is
 * sent to every student it is for through the channels chosen, as far as each
 * student's own preferences allow. Returns how many students it was sent to.
 */
export async function postAnnouncement(input: AnnouncementInput): Promise<number> {
  const actor = authorize("create", { type: "announcement", courseId: input.courseId });
  const sections = sectionsRepo.get();
  const courseSectionIds = sections.filter((section) => section.courseId === input.courseId).map((section) => section.id);
  // Choosing every section is the same as choosing none: it is for the whole course.
  const sectionIds = input.sectionIds.length === courseSectionIds.length ? [] : input.sectionIds;
  const draft = { title: input.title.trim(), body: input.body.trim(), sectionIds, channels: input.channels };
  const problems = announcementProblems(draft, courseSectionIds);
  if (problems.length > 0) throw new AnnouncementError(problems);

  const postedAt = nowIso();
  idCounter += 1;
  const announcement: Announcement = {
    ...draft,
    id: `ann-${Date.parse(postedAt).toString(36)}${idCounter.toString(36)}`,
    courseId: input.courseId,
    authorId: actor.id,
    postedAt,
    readBy: {},
  };
  announcementsRepo.update((all) => [...all, announcement]);

  const course = coursesRepo.get().find((candidate) => candidate.id === input.courseId);
  const audience = audienceOf(announcement, sections, enrollmentsRepo.get(), usersRepo.get());
  for (const studentId of audience) {
    notify(
      {
        userId: studentId,
        category: "announcements",
        title: `${course?.title ?? "Course"}: ${announcement.title}`,
        body: announcement.body.length > 200 ? `${announcement.body.slice(0, 197)}...` : announcement.body,
        href: "/announcements",
      },
      { channels: announcement.channels },
    );
  }
  recordAudit({
    action: "announcement.post",
    resource: `announcement:${announcement.id}`,
    outcome: "allowed",
    detail: `${course?.code ?? input.courseId}: "${announcement.title}" to ${audience.length} ${audience.length === 1 ? "student" : "students"} by ${announcement.channels.join(", ")}`,
  });
  return audience.length;
}

/**
 * FR-6.1: records that the signed-in user has opened an announcement. Only a
 * student it was sent to counts towards the read count the teacher sees.
 */
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const actor = getActor();
  const announcement = announcementsRepo.get().find((candidate) => candidate.id === announcementId);
  if (!actor || !announcement || announcement.readBy[actor.id] !== undefined) return;
  // A parent holds this permission through a child; anyone else through the course.
  if (actor.role === "parent") {
    const sectionIds = sectionsRepo.get().filter((section) => section.courseId === announcement.courseId).map((section) => section.id);
    const childId = actor.childIds.find((id) =>
      enrollmentsRepo.get().some((entry) => entry.userId === id && sectionIds.includes(entry.sectionId)),
    );
    authorize("view", { type: "announcement", ownerId: childId });
  } else {
    authorize("view", { type: "announcement", courseId: announcement.courseId });
  }
  const readAt = nowIso();
  announcementsRepo.update((all) =>
    all.map((candidate) =>
      candidate.id === announcementId ? { ...candidate, readBy: { ...candidate.readBy, [actor.id]: readAt } } : candidate,
    ),
  );
}

/** Removes an announcement from the course. Notifications already sent are not recalled. */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const announcement = announcementsRepo.get().find((candidate) => candidate.id === announcementId);
  if (!announcement) return;
  authorize("delete", { type: "announcement", courseId: announcement.courseId });
  announcementsRepo.update((all) => all.filter((candidate) => candidate.id !== announcementId));
  recordAudit({
    action: "announcement.delete",
    resource: `announcement:${announcementId}`,
    outcome: "allowed",
    detail: announcement.title,
  });
}
