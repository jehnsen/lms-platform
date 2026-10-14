"use client";

/**
 * Direct messages (BR-20, FR-6.2). Conversations are between two people; a
 * teacher can also send one message to every student of a section, and each
 * student gets it in their own private conversation with the teacher.
 *
 * Backend seam: `GET /messages/conversations`, `GET /messages/contacts`,
 * `POST /messages`, `POST /sections/:id/messages`,
 * `POST /messages/conversations/:userId/read`. The server applies the role
 * rules (`src/lib/domain/messaging.ts`) to every message and returns only the
 * caller's own conversations.
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import {
  contactsOf,
  conversationsOf,
  messageProblems,
  sendDecision,
  type Conversation,
} from "@/lib/domain/messaging";
import { can, ROLE_LABELS } from "@/lib/domain/permissions";
import type { Message, Section, User } from "@/lib/types";
import { useRepository } from "./_repository";
import { coursesRepo, enrollmentsRepo, messagesRepo, sectionsRepo, settingsRepo, usersRepo } from "./_stores";
import { notify } from "./notifications";
import { authorizeOwn, recordDenied, useActor } from "./session";

/** A message the rules do not allow, with the reason. */
export class MessageError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "MessageError";
  }
}

export interface ConversationRow extends Conversation {
  other: Pick<User, "id" | "name" | "role"> | undefined;
  /** How the other person is described under their name, e.g. "Faculty". */
  otherLabel: string;
  /** Whether the signed-in user may write in this conversation now. */
  canSend: boolean;
  /** Why not, when they may not. */
  blocked?: string;
}

export interface Mailbox {
  conversations: ConversationRow[];
  /** The people the signed-in user may start a conversation with. */
  contacts: Array<Pick<User, "id" | "name" | "role">>;
  /** Faculty: the sections they can send one message to everyone in. */
  sections: Array<{ section: Section; courseTitle: string; students: number }>;
  unread: number;
}

/** The signed-in user's conversations and the people they may write to. `null` when signed out. */
export function useMailbox(): Mailbox | null | undefined {
  const actor = useActor();
  const messages = useRepository(messagesRepo);
  const users = useRepository(usersRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const courses = useRepository(coursesRepo);
  const settings = useRepository(settingsRepo);

  return useMemo(() => {
    if (actor === undefined) return undefined;
    const me = users.find((user) => user.id === actor?.id);
    if (!actor || !me || !can(actor, "view", { type: "message", ownerId: actor.id })) return null;
    const context = { sections, enrollments };
    const policy = settings.messaging;

    const conversations = conversationsOf(me.id, messages).map((conversation): ConversationRow => {
      const other = users.find((user) => user.id === conversation.otherId);
      const decision = other
        ? sendDecision(me, other, context, policy, messages)
        : { allowed: false as const, reason: "This account no longer exists." };
      return {
        ...conversation,
        other,
        otherLabel: other ? ROLE_LABELS[other.role] : "",
        canSend: decision.allowed,
        blocked: decision.allowed ? undefined : decision.reason,
      };
    });

    return {
      conversations,
      contacts: contactsOf(me, users, context, policy),
      sections:
        me.role === "faculty"
          ? sections
              .filter((section) => section.facultyIds.includes(me.id))
              .map((section) => ({
                section,
                courseTitle: courses.find((course) => course.id === section.courseId)?.title ?? "",
                students: users.filter(
                  (user) =>
                    user.role === "student" &&
                    user.status === "active" &&
                    enrollments.some((entry) => entry.userId === user.id && entry.sectionId === section.id),
                ).length,
              }))
              .filter((entry) => entry.students > 0)
              .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.section.name.localeCompare(b.section.name))
          : [],
      unread: conversations.reduce((sum, conversation) => sum + conversation.unread, 0),
    };
  }, [actor, messages, users, sections, enrollments, courses, settings]);
}

/** How many messages the signed-in user has not opened, for the menu. */
export function useUnreadMessages(): number {
  const actor = useActor();
  const messages = useRepository(messagesRepo);
  return useMemo(
    () => (actor ? messages.filter((message) => message.toId === actor.id && !message.readAt).length : 0),
    [actor, messages],
  );
}

let idCounter = 0;

function deliver(from: User, to: User, body: string, sentAt: string, broadcastSectionId?: string) {
  idCounter += 1;
  const message: Message = {
    id: `msg-${Date.parse(sentAt).toString(36)}${idCounter.toString(36)}`,
    fromId: from.id,
    toId: to.id,
    body,
    sentAt,
    broadcastSectionId,
  };
  messagesRepo.update((all) => [...all, message]);
  notify({
    userId: to.id,
    category: "messages",
    title: `Message from ${from.name}`,
    body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
    href: "/messages",
  });
}

/**
 * FR-6.2: sends a message to one person. Refused, and the attempt logged,
 * when the role rules do not allow the signed-in user to write to them.
 */
export async function sendMessage(toId: string, body: string): Promise<void> {
  const actor = authorizeOwn("create", "message");
  const users = usersRepo.get();
  const me = users.find((user) => user.id === actor.id);
  const to = users.find((user) => user.id === toId);
  if (!me || !to) throw new MessageError(["This person no longer has an account."]);
  const decision = sendDecision(
    me,
    to,
    { sections: sectionsRepo.get(), enrollments: enrollmentsRepo.get() },
    settingsRepo.get().messaging,
    messagesRepo.get(),
  );
  if (!decision.allowed) {
    recordDenied(`message:${toId}`, decision.reason);
    throw new MessageError([decision.reason]);
  }
  const problems = messageProblems(body);
  if (problems.length > 0) throw new MessageError(problems);
  deliver(me, to, body.trim(), nowIso());
}

/**
 * US-22: a teacher messages a class. Every active student in the section gets
 * the message in their own conversation with the teacher, so a reply is
 * private. Returns how many students it went to.
 */
export async function sendToSection(sectionId: string, body: string): Promise<number> {
  const actor = authorizeOwn("create", "message");
  const users = usersRepo.get();
  const me = users.find((user) => user.id === actor.id);
  const section = sectionsRepo.get().find((candidate) => candidate.id === sectionId);
  if (!me || !section || !section.facultyIds.includes(me.id)) {
    recordDenied(`message:section:${sectionId}`, "Not a teacher of this section.");
    throw new MessageError(["You can message only the sections you teach."]);
  }
  const problems = messageProblems(body);
  if (problems.length > 0) throw new MessageError(problems);
  const enrolled = new Set(enrollmentsRepo.get().filter((entry) => entry.sectionId === sectionId).map((entry) => entry.userId));
  const students = users.filter((user) => enrolled.has(user.id) && user.role === "student" && user.status === "active");
  const sentAt = nowIso();
  for (const student of students) deliver(me, student, body.trim(), sentAt, sectionId);
  return students.length;
}

/** Marks every message the other person sent in this conversation as read. */
export async function markConversationRead(otherId: string): Promise<void> {
  const actor = authorizeOwn("view", "message");
  const readAt = nowIso();
  messagesRepo.update((all) =>
    all.some((message) => message.fromId === otherId && message.toId === actor.id && !message.readAt)
      ? all.map((message) =>
          message.fromId === otherId && message.toId === actor.id && !message.readAt ? { ...message, readAt } : message,
        )
      : all,
  );
}
