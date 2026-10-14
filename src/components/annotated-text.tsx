"use client";

import { useRef } from "react";
import { MessageSquarePlus } from "lucide-react";
import { segmentText } from "@/lib/domain/assignments";
import { cn } from "@/lib/utils";

/** A comment anchored to a run of the text, with the number it is known by on the page. */
export interface TextNote {
  id: string;
  number: number;
  start: number;
  end: number;
}

/**
 * The run of characters a selection covers, or null when it covers none of the
 * text. Every piece of text sits in an element that carries its position
 * (`data-offset`), so this works however the browser reports the ends of the
 * selection: inside a piece, or at the edge of a paragraph after a triple click.
 */
function selectedRun(root: HTMLElement, range: Range): { start: number; end: number } | null {
  let start = Number.POSITIVE_INFINITY;
  let end = -1;
  for (const holder of root.querySelectorAll<HTMLElement>("[data-offset]")) {
    if (!range.intersectsNode(holder)) continue;
    const base = Number(holder.dataset.offset);
    const length = holder.textContent?.length ?? 0;
    const inText = (node: Node) => node.nodeType === Node.TEXT_NODE && holder.contains(node);
    start = Math.min(start, inText(range.startContainer) ? base + range.startOffset : base);
    end = Math.max(end, inText(range.endContainer) ? base + range.endOffset : base + length);
  }
  return end > start ? { start, end } : null;
}

/**
 * A student's typed answer with the parts that have inline comments
 * highlighted and numbered (FR-3.9).
 *
 * With `onSelect`, a marker can anchor a new comment two ways: select any run
 * of text with the mouse or keyboard, or press a paragraph's "Comment on
 * paragraph" button, which needs no selection at all (NFR-5).
 */
export function AnnotatedText({
  text,
  notes,
  activeId,
  onPick,
  onSelect,
}: {
  text: string;
  notes: TextNote[];
  activeId?: string | null;
  /** A highlight's number was activated. */
  onPick?: (noteId: string) => void;
  /** A run of characters was chosen to comment on. */
  onSelect?: (start: number, end: number) => void;
}) {
  // Paragraphs keep their position in the whole text, so anchors never need translating.
  const paragraphs: Array<{ start: number; end: number; text: string }> = [];
  let position = 0;
  for (const line of text.split("\n")) {
    paragraphs.push({ start: position, end: position + line.length, text: line });
    position += line.length + 1;
  }

  const root = useRef<HTMLDivElement>(null);

  const capture = () => {
    if (!onSelect || !root.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const run = selectedRun(root.current, selection.getRangeAt(0));
    if (!run) return;
    let { start, end } = run;
    // Leave out spaces and line breaks swept up at either end.
    while (start < end && /\s/.test(text[start])) start += 1;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    if (end > start) onSelect(start, end);
  };

  let paragraphNumber = 0;

  return (
    <div ref={root} onMouseUp={capture} onKeyUp={capture} className="flex flex-col gap-3 leading-relaxed">
      {paragraphs.map((paragraph) => {
        if (paragraph.text.trim() === "") return null;
        paragraphNumber += 1;
        const number = paragraphNumber;
        const segments = segmentText(text, notes, paragraph.start, paragraph.end);
        return (
          <div key={paragraph.start} className="flex items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap">
              {segments.map((segment) => {
                const ending = notes.filter((note) => Math.min(note.end, paragraph.end) === segment.end && segment.commentIds.includes(note.id));
                const active = activeId !== undefined && activeId !== null && segment.commentIds.includes(activeId);
                return (
                  <span key={segment.start}>
                    {segment.commentIds.length > 0 ? (
                      <mark
                        data-offset={segment.start}
                        className={cn(
                          "rounded-sm px-0.5 text-ink underline decoration-dotted underline-offset-4",
                          active ? "bg-primary-soft outline-2 outline-primary" : "bg-warn-soft",
                        )}
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span data-offset={segment.start}>{segment.text}</span>
                    )}
                    {ending.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => onPick?.(note.id)}
                        aria-label={`Comment ${note.number}`}
                        className="mx-0.5 inline-grid size-5 place-items-center rounded-full bg-ink align-super text-[10px] leading-none font-semibold text-bg"
                      >
                        {note.number}
                      </button>
                    ))}
                  </span>
                );
              })}
            </p>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(paragraph.start, paragraph.end)}
                aria-label={`Comment on paragraph ${number}`}
                title={`Comment on paragraph ${number}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <MessageSquarePlus aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
