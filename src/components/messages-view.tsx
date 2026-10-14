"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, PenSquare, Send, Users } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Button, Card, PageContainer, PageHeader, PageSkeleton, fieldBaseClass, fieldClass } from "@/components/ui";
import {
  MessageError,
  markConversationRead,
  sendMessage,
  sendToSection,
  useMailbox,
  type ConversationRow,
  type Mailbox,
} from "@/lib/api/messages";
import { useActor } from "@/lib/api/session";
import { MAX_MESSAGE_LENGTH } from "@/lib/domain/messaging";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { cn, formatDateTime } from "@/lib/utils";

const SECTION_PREFIX = "section:";

function messagesOf(error: unknown) {
  if (error instanceof MessageError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** `/messages` (FR-6.2): the signed-in user's conversations, and a way to start one with anyone the rules allow. */
export function MessagesView() {
  const actor = useActor();
  const mailbox = useMailbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setComposing(false);
  }, []);

  if (mailbox === undefined) return <PageSkeleton />;
  if (!mailbox || !actor) return null;

  const selected = mailbox.conversations.find((conversation) => conversation.otherId === selectedId);
  const canStart = mailbox.contacts.length > 0 || mailbox.sections.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Messages"
        description="Private conversations. Who you can write to depends on your role and on who teaches whom."
        actions={
          canStart ? (
            <Button onClick={() => setComposing(true)}>
              <PenSquare aria-hidden className="size-4" />
              New message
            </Button>
          ) : undefined
        }
      />

      {/* Always rendered, so a message to a whole section is confirmed aloud (NFR-5). */}
      <p role="status" className={cn("text-sm text-good", note && "mb-4")}>
        {note}
      </p>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* On a small screen the list and the open conversation take turns. */}
        <Card className={cn("self-start overflow-hidden", selected && "hidden lg:block")}>
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            Conversations{mailbox.unread > 0 ? <span className="font-normal text-ink-3"> · {mailbox.unread} unread</span> : null}
          </h2>
          {mailbox.conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-2">
              {canStart ? "No messages yet. Start with New message." : "No messages yet."}
            </p>
          ) : (
            <ul>
              {mailbox.conversations.map((conversation) => (
                <li key={conversation.otherId} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    onClick={() => {
                      setNote("");
                      setSelectedId(conversation.otherId);
                    }}
                    aria-current={conversation.otherId === selectedId ? "true" : undefined}
                    className={cn(
                      "block w-full px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      conversation.otherId === selectedId && "bg-primary-soft hover:bg-primary-soft",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{conversation.other?.name ?? "Former account"}</span>
                      {conversation.unread > 0 ? (
                        <Badge tone="primary">
                          {conversation.unread}
                          <span className="sr-only"> unread</span>
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-ink-3">{conversation.otherLabel}</span>
                    <span className="mt-0.5 block truncate text-sm text-ink-2">
                      {conversation.last.fromId === actor.id ? "You: " : ""}
                      {conversation.last.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <Thread key={selected.otherId} conversation={selected} myId={actor.id} onBack={() => setSelectedId(null)} />
        ) : (
          <Card className="hidden place-items-center p-10 text-sm text-ink-2 lg:grid">Choose a conversation to read it.</Card>
        )}
      </div>

      {composing ? (
        <ComposeDialog
          mailbox={mailbox}
          onClose={() => setComposing(false)}
          onSent={(target, count) => {
            if (target.startsWith(SECTION_PREFIX)) {
              setNote(`Sent to ${count} ${count === 1 ? "student" : "students"}, each in their own conversation with you.`);
            } else {
              setNote("");
              setSelectedId(target);
            }
          }}
        />
      ) : null}
    </PageContainer>
  );
}

function Thread({ conversation, myId, onBack }: { conversation: ConversationRow; myId: string; onBack: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const { otherId, unread, messages } = conversation;

  // Opening a conversation, or receiving a message while it is open, marks it read.
  useEffect(() => {
    if (unread > 0) void markConversationRead(otherId);
  }, [otherId, unread]);

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await sendMessage(otherId, body);
      setBody("");
    } catch (error) {
      setProblems(messagesOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden" aria-label="Back to conversations">
          <ArrowLeft aria-hidden className="size-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{conversation.other?.name ?? "Former account"}</h2>
          <p className="text-xs text-ink-3">{conversation.otherLabel}</p>
        </div>
      </div>

      {/* A log: new messages are announced as they arrive. The list inside keeps its own meaning. */}
      <div role="log" aria-label={`Messages with ${conversation.other?.name ?? "this person"}`} className="max-h-[28rem] overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-2">
          {messages.map((message) => {
            const mine = message.fromId === myId;
            return (
              <li key={message.id} className={cn("flex max-w-[85%] flex-col", mine ? "items-end self-end" : "items-start self-start")}>
                <p
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
                    mine ? "bg-primary text-on-primary" : "bg-surface-2 text-ink",
                  )}
                >
                  <span className="sr-only">{mine ? "You: " : `${conversation.other?.name ?? "They"}: `}</span>
                  {message.body}
                </p>
                <span className="mt-0.5 text-xs text-ink-3">
                  {formatDateTime(message.sentAt)}
                  {message.broadcastSectionId ? " · sent to the whole section" : ""}
                  {mine && message.readAt ? " · read" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        <div ref={end} />
      </div>

      {conversation.canSend ? (
        <form
          noValidate
          className="flex flex-col gap-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor={`reply-${otherId}`} className="sr-only">
            Message to {conversation.other?.name}
          </label>
          <textarea
            id={`reply-${otherId}`}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message"
            className={cn(fieldBaseClass, "w-full px-3 py-2")}
          />
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="min-w-0 text-sm text-bad">
              {problems.join(" ")}
            </p>
            <Button type="submit" disabled={busy || !body.trim()}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
              Send
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-2">{conversation.blocked}</p>
      )}
    </Card>
  );
}

/** Start a conversation with someone the role rules allow, or, for a teacher, message a whole section (US-22). */
function ComposeDialog({
  mailbox,
  onClose,
  onSent,
}: {
  mailbox: Mailbox;
  onClose: () => void;
  onSent: (target: string, count: number) => void;
}) {
  const first = mailbox.contacts[0]?.id ?? (mailbox.sections[0] ? `${SECTION_PREFIX}${mailbox.sections[0].section.id}` : "");
  const [target, setTarget] = useState(first);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const toSection = target.startsWith(SECTION_PREFIX);

  const send = async () => {
    setBusy(true);
    setProblems([]);
    try {
      const count = toSection ? await sendToSection(target.slice(SECTION_PREFIX.length), body) : (await sendMessage(target, body), 1);
      onSent(target, count);
      onClose();
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(false);
    }
  };

  return (
    <Dialog title="New message" onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div>
          <label htmlFor="message-to" className="mb-1 block text-sm font-medium">
            To
          </label>
          <select id="message-to" value={target} onChange={(event) => setTarget(event.target.value)} className={cn(fieldClass, "w-full")}>
            {mailbox.sections.length > 0 ? (
              <optgroup label="A whole section">
                {mailbox.sections.map(({ section, courseTitle, students }) => (
                  <option key={section.id} value={`${SECTION_PREFIX}${section.id}`}>
                    {courseTitle} · {section.name} ({students} {students === 1 ? "student" : "students"})
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="One person">
              {mailbox.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} · {ROLE_LABELS[contact.role]}
                </option>
              ))}
            </optgroup>
          </select>
          {toSection ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-3">
              <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Every student in the section gets this in their own conversation with you, so replies are private.
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="message-body" className="mb-1 block text-sm font-medium">
            Message
          </label>
          <textarea
            id="message-body"
            rows={5}
            maxLength={MAX_MESSAGE_LENGTH}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(fieldBaseClass, "w-full px-3 py-2")}
          />
        </div>
        <div role="alert">
          {problems.length > 0 ? <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{problems.join(" ")}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !target}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
            Send
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
