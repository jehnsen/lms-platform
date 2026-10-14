"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowUp, ArrowUpRight, Sparkles, Square } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { streamTutorReply, type TutorContext, type TutorTurn } from "@/lib/mock-ai/tutor";
import { cn } from "@/lib/utils";

export interface TutorChatHandle {
  /** Send a question on the learner's behalf (e.g. from an in-video quiz). */
  ask: (text: string) => void;
}

interface Message extends TutorTurn {
  id: number;
  streaming?: boolean;
}

const LESSON_SUGGESTIONS = [
  "Explain this simply",
  "Give me an example",
  "Summarise this lesson",
  "Quiz me",
];

const GENERAL_SUGGESTIONS = [
  "Explain overfitting simply",
  "Give me an example of compound interest",
  "What is semantic HTML?",
  "How should I study for a quiz?",
];

export function TutorChat({
  context,
  className,
  ref,
}: {
  context?: TutorContext;
  className?: string;
  ref?: Ref<TutorChatHandle>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  // Bumped to cancel whichever reply is currently streaming.
  const activeRun = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const suggestions = context?.lessonTitle ? LESSON_SUGGESTIONS : GENERAL_SUGGESTIONS;

  const settle = (list: Message[]) =>
    list.map((message) => (message.streaming ? { ...message, streaming: false } : message));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const run = ++activeRun.current;
    const history: TutorTurn[] = messages.map(({ role, text: body }) => ({ role, text: body }));
    const userMessage: Message = { id: nextId.current++, role: "user", text };
    const replyId = nextId.current++;

    setMessages((previous) => [
      ...settle(previous),
      userMessage,
      { id: replyId, role: "assistant", text: "", streaming: true },
    ]);
    setInput("");
    setBusy(true);

    for await (const chunk of streamTutorReply(text, context, history)) {
      if (activeRun.current !== run) return;
      setMessages((previous) =>
        previous.map((message) =>
          message.id === replyId ? { ...message, text: message.text + chunk } : message,
        ),
      );
    }
    if (activeRun.current !== run) return;
    setMessages(settle);
    setBusy(false);
  };

  const stop = () => {
    activeRun.current += 1;
    setMessages(settle);
    setBusy(false);
  };

  useImperativeHandle(ref, () => ({ ask: send }));

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <div className={cn("@container flex min-h-0 flex-col", className)}>
      <div ref={scroller} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border border-spark-solid/30 bg-linear-to-br from-spark-soft to-surface text-spark shadow-card">
              <Sparkles aria-hidden className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {context?.lessonTitle ? "Stuck on something?" : "What are you working on?"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-ink-2">
                {context?.lessonTitle
                  ? `Ask about “${context.lessonTitle}” and I'll explain, give examples, or quiz you.`
                  : "Ask about any concept from your courses, or start with one of these."}
              </p>
            </div>
            <ul aria-label="Suggested questions" className="mt-2 grid w-full max-w-xl gap-2 @md:grid-cols-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => send(suggestion)}
                    className="group flex h-full w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left text-sm text-ink-2 shadow-card transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
                  >
                    {suggestion}
                    <ArrowUpRight
                      aria-hidden
                      className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-soft px-3.5 py-2 text-sm whitespace-pre-wrap">
                    <span className="sr-only">You: </span>
                    {message.text}
                  </div>
                </li>
              ) : (
                <li key={message.id} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-spark-soft text-spark">
                    <Sparkles aria-hidden className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm leading-relaxed">
                    <span className="sr-only">Tutor: </span>
                    {message.text ? (
                      <RichText
                        text={message.text}
                        className={message.streaming ? "[&>*:last-child]:stream-caret" : undefined}
                      />
                    ) : (
                      <span className="text-ink-3">Thinking…</span>
                    )}
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      <div className="border-t border-line bg-surface-2/40 p-3">
        {/* Once the conversation starts, the suggestions move down here out of the way. */}
        {messages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 shadow-card focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
        >
          <label htmlFor="tutor-input" className="sr-only">
            Ask the AI tutor
          </label>
          <textarea
            id="tutor-input"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask a question…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-3"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop response"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink hover:bg-line"
            >
              <Square aria-hidden className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-on-primary shadow-button transition-colors hover:bg-primary-hover disabled:opacity-40 disabled:shadow-none"

            >
              <ArrowUp aria-hidden className="size-4" />
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-xs text-ink-3">
          Demo mode — replies are simulated, not from a live model.
        </p>
      </div>
    </div>
  );
}
