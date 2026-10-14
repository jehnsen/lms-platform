/**
 * Direct messaging rules (FR-6.2): who may write to whom. The fixed rules
 * follow from who teaches whom; three further rules are school policy (Q-20).
 * No storage here, so the server can apply the same rules to every message.
 */
import type { Enrollment, Message, MessagingPolicy, Section, User } from "@/lib/types";

/** Q-20: students do not message each other until the school allows it. */
export const DEFAULT_MESSAGING_POLICY: MessagingPolicy = {
  studentsToTeachers: true,
  studentsToClassmates: false,
  parentsToTeachers: true,
};

export const MAX_MESSAGE_LENGTH = 2000;

type Person = Pick<User, "id" | "role" | "status" | "childIds">;

export interface MessagingContext {
  sections: Array<Pick<Section, "id" | "facultyIds">>;
  enrollments: Enrollment[];
}

function sectionIdsOf(studentId: string, context: MessagingContext) {
  return context.enrollments.filter((entry) => entry.userId === studentId).map((entry) => entry.sectionId);
}

/** True when the teacher teaches a section the student is in. */
export function teaches(facultyId: string, studentId: string, context: MessagingContext) {
  const mine = sectionIdsOf(studentId, context);
  return context.sections.some((section) => mine.includes(section.id) && section.facultyIds.includes(facultyId));
}

function shareSection(a: string, b: string, context: MessagingContext) {
  const mine = sectionIdsOf(a, context);
  return sectionIdsOf(b, context).some((sectionId) => mine.includes(sectionId));
}

export type MessageDecision = { allowed: true } | { allowed: false; reason: string };

const no = (reason: string): MessageDecision => ({ allowed: false, reason });

/**
 * May `from` start a conversation with `to`?
 *
 * - An admin may write to anyone, and staff may write to each other.
 * - A teacher may write to the students they teach and to those students' parents.
 * - A student may write to their teachers, and to classmates, when the school allows each.
 * - A parent may write to their child's teachers when the school allows it, and to an admin.
 * - Nobody else: no student to parent, parent to parent, or parent to someone else's teacher.
 */
export function messageDecision(
  from: Person,
  to: Person,
  context: MessagingContext,
  policy: MessagingPolicy,
): MessageDecision {
  if (from.id === to.id) return no("You cannot message yourself.");
  if (to.status !== "active") return no("This account is not active, so it cannot receive messages.");
  if (from.role === "admin") return { allowed: true };

  const children = (person: Person) => person.childIds ?? [];

  if (from.role === "faculty") {
    if (to.role === "faculty" || to.role === "admin") return { allowed: true };
    if (to.role === "student") {
      return teaches(from.id, to.id, context) ? { allowed: true } : no("You can message only the students you teach.");
    }
    return children(to).some((childId) => teaches(from.id, childId, context))
      ? { allowed: true }
      : no("You can message only the parents of students you teach.");
  }

  if (from.role === "student") {
    if (to.role === "faculty") {
      if (!policy.studentsToTeachers) return no("The school has not opened messages from students to teachers.");
      return teaches(to.id, from.id, context) ? { allowed: true } : no("You can message only your own teachers.");
    }
    if (to.role === "student") {
      if (!policy.studentsToClassmates) return no("The school does not allow students to message each other.");
      return shareSection(from.id, to.id, context) ? { allowed: true } : no("You can message only students in your own sections.");
    }
    return no("Students can message their teachers. For anything else, ask a teacher.");
  }

  // Parents.
  if (to.role === "admin") return { allowed: true };
  if (to.role === "faculty") {
    if (!policy.parentsToTeachers) return no("The school has not opened messages from parents to teachers.");
    return children(from).some((childId) => teaches(to.id, childId, context))
      ? { allowed: true }
      : no("You can message only the teachers of your own children.");
  }
  return no("Parents can message their children's teachers and the school office.");
}

/**
 * May `from` send to `to` now? Starting a conversation follows the rules above.
 * Answering is always allowed: someone who was written to may reply.
 */
export function sendDecision(
  from: Person,
  to: Person,
  context: MessagingContext,
  policy: MessagingPolicy,
  messages: Message[],
): MessageDecision {
  const start = messageDecision(from, to, context, policy);
  if (start.allowed) return start;
  if (from.id !== to.id && to.status === "active" && messages.some((message) => message.fromId === to.id && message.toId === from.id)) {
    return { allowed: true };
  }
  return start;
}

/** Everyone `from` may start a conversation with, by name. */
export function contactsOf<T extends Person & Pick<User, "name">>(
  from: Person,
  everyone: T[],
  context: MessagingContext,
  policy: MessagingPolicy,
): T[] {
  return everyone
    .filter((person) => messageDecision(from, person, context, policy).allowed)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Why a message cannot be sent as written. Empty when it can. */
export function messageProblems(body: string): string[] {
  const text = body.trim();
  if (!text) return ["Write a message first."];
  if (text.length > MAX_MESSAGE_LENGTH) return [`A message can be up to ${MAX_MESSAGE_LENGTH} characters. This one is ${text.length}.`];
  return [];
}

export interface Conversation {
  otherId: string;
  /** Oldest first. */
  messages: Message[];
  last: Message;
  /** Messages from the other person that this person has not opened. */
  unread: number;
}

/** One person's conversations, the most recently active first. */
export function conversationsOf(userId: string, messages: Message[]): Conversation[] {
  const byOther = new Map<string, Message[]>();
  for (const message of messages) {
    if (message.fromId !== userId && message.toId !== userId) continue;
    const otherId = message.fromId === userId ? message.toId : message.fromId;
    byOther.set(otherId, [...(byOther.get(otherId) ?? []), message]);
  }
  return [...byOther.entries()]
    .map(([otherId, thread]) => {
      const ordered = [...thread].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
      return {
        otherId,
        messages: ordered,
        last: ordered[ordered.length - 1],
        unread: ordered.filter((message) => message.toId === userId && !message.readAt).length,
      };
    })
    .sort((a, b) => b.last.sentAt.localeCompare(a.last.sentAt));
}
