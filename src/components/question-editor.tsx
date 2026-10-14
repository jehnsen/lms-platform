"use client";

import type { ReactNode } from "react";
import { BookmarkPlus, Plus, Trash2 } from "lucide-react";
import { Badge, Button, fieldBaseClass, fieldClass } from "@/components/ui";
import { QUESTION_KIND_LABELS } from "@/lib/domain/quizzes";
import { isManuallyMarked } from "@/lib/grading";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

const toNumber = (value: string) => (value === "" ? Number.NaN : Number(value));
const toField = (value: number) => (Number.isNaN(value) ? "" : value);
const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad disabled:pointer-events-none disabled:opacity-40";
const TEXTAREA_CLASS = cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed");
const LABEL_CLASS = "mb-1 block text-sm font-medium";

/** FR-3.5: edit one question of any kind: multiple choice, multiple answers, true or false, matching, short answer. */
export function QuestionEditor({
  question,
  number,
  controls,
  onChange,
  onRemove,
  onSaveToBank,
}: {
  question: Question;
  number: number;
  /** The drag handle and move buttons, from the sortable list. */
  controls: ReactNode;
  onChange: (next: Question) => void;
  onRemove: () => void;
  onSaveToBank: () => void;
}) {
  const id = `q-${question.id}`;
  const name = `question ${number}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {controls}
        <span className="text-sm font-semibold">Question {number}</span>
        <Badge>{QUESTION_KIND_LABELS[question.kind]}</Badge>
        {isManuallyMarked(question) ? <Badge tone="warn">Marked by a teacher</Badge> : <Badge tone="good">Marked automatically</Badge>}
        <span className="ml-auto flex items-center gap-1">
          <label htmlFor={`${id}-points`} className="text-sm text-ink-2">
            Points
          </label>
          <input
            id={`${id}-points`}
            type="number"
            inputMode="decimal"
            min={0}
            value={toField(question.points)}
            onChange={(event) => onChange({ ...question, points: toNumber(event.target.value) })}
            className={cn(fieldBaseClass, "h-8 w-20 px-2")}
          />
          <button type="button" onClick={onSaveToBank} aria-label={`Save ${name} to the question bank`} title="Save to the question bank" className={cn(ICON_BUTTON, "hover:text-ink")}>
            <BookmarkPlus aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className={ICON_BUTTON}>
            <Trash2 aria-hidden className="size-4" />
          </button>
        </span>
      </div>

      <label htmlFor={`${id}-prompt`} className={cn(LABEL_CLASS, "mt-3")}>
        Question
      </label>
      <textarea
        id={`${id}-prompt`}
        rows={2}
        value={question.prompt}
        onChange={(event) => onChange({ ...question, prompt: event.target.value })}
        className={TEXTAREA_CLASS}
      />

      {question.kind === "single" || question.kind === "multi" ? (
        <fieldset className="mt-3">
          <legend className={LABEL_CLASS}>
            Choices <span className="font-normal text-ink-3">· tick {question.kind === "single" ? "the correct one" : "every correct one"}</span>
          </legend>
          <ul className="flex flex-col gap-2">
            {question.options.map((option, index) => {
              const correct = question.kind === "single" ? question.answer === index : question.answer.includes(index);
              return (
                <li key={index} className="flex items-center gap-2">
                  <input
                    type={question.kind === "single" ? "radio" : "checkbox"}
                    name={`${id}-correct`}
                    checked={correct}
                    aria-label={`Choice ${index + 1} of ${name} is correct`}
                    onChange={() =>
                      onChange(
                        question.kind === "single"
                          ? { ...question, answer: index }
                          : {
                              ...question,
                              answer: correct ? question.answer.filter((choice) => choice !== index) : [...question.answer, index].sort((a, b) => a - b),
                            },
                      )
                    }
                    className="size-4 shrink-0 accent-primary"
                  />
                  <input
                    type="text"
                    aria-label={`Choice ${index + 1} of ${name}`}
                    value={option}
                    onChange={(event) =>
                      onChange({ ...question, options: question.options.map((text, position) => (position === index ? event.target.value : text)) })
                    }
                    className={cn(fieldClass, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    disabled={question.options.length <= 2}
                    aria-label={`Remove choice ${index + 1} of ${name}`}
                    onClick={() => {
                      const options = question.options.filter((_, position) => position !== index);
                      // Keep the ticks on the same choices after the list closes up.
                      const shift = (choice: number) => (choice > index ? choice - 1 : choice);
                      onChange(
                        question.kind === "single"
                          ? { ...question, options, answer: question.answer === index ? 0 : shift(question.answer) }
                          : { ...question, options, answer: question.answer.filter((choice) => choice !== index).map(shift) },
                      );
                    }}
                    className={ICON_BUTTON}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange({ ...question, options: [...question.options, ""] })}>
            <Plus aria-hidden className="size-4" />
            Add a choice<span className="sr-only"> to {name}</span>
          </Button>
        </fieldset>
      ) : null}

      {question.kind === "boolean" ? (
        <fieldset className="mt-3">
          <legend className={LABEL_CLASS}>Correct answer</legend>
          <div className="flex gap-5 text-sm">
            {[true, false].map((value) => (
              <label key={String(value)} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-correct`}
                  checked={question.answer === value}
                  onChange={() => onChange({ ...question, answer: value })}
                  className="size-4 accent-primary"
                />
                {value ? "True" : "False"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {question.kind === "matching" ? (
        <>
          <fieldset className="mt-3">
            <legend className={LABEL_CLASS}>
              Pairs <span className="font-normal text-ink-3">· students see the right-hand side shuffled</span>
            </legend>
            <ul className="flex flex-col gap-2">
              {question.pairs.map((pair, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Pair ${index + 1} of ${name}: item`}
                    placeholder="Item"
                    value={pair.left}
                    onChange={(event) =>
                      onChange({ ...question, pairs: question.pairs.map((item, position) => (position === index ? { ...item, left: event.target.value } : item)) })
                    }
                    className={cn(fieldClass, "min-w-0 flex-1 basis-40")}
                  />
                  <span aria-hidden className="text-ink-3">
                    →
                  </span>
                  <input
                    type="text"
                    aria-label={`Pair ${index + 1} of ${name}: its match`}
                    placeholder="Its match"
                    value={pair.right}
                    onChange={(event) =>
                      onChange({ ...question, pairs: question.pairs.map((item, position) => (position === index ? { ...item, right: event.target.value } : item)) })
                    }
                    className={cn(fieldClass, "min-w-0 flex-1 basis-40")}
                  />
                  <button
                    type="button"
                    disabled={question.pairs.length <= 2}
                    aria-label={`Remove pair ${index + 1} of ${name}`}
                    onClick={() => onChange({ ...question, pairs: question.pairs.filter((_, position) => position !== index) })}
                    className={ICON_BUTTON}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange({ ...question, pairs: [...question.pairs, { left: "", right: "" }] })}>
              <Plus aria-hidden className="size-4" />
              Add a pair<span className="sr-only"> to {name}</span>
            </Button>
          </fieldset>
          <label htmlFor={`${id}-distractors`} className={cn(LABEL_CLASS, "mt-3")}>
            Extra choices that match nothing <span className="font-normal text-ink-3">(optional, one per line)</span>
          </label>
          <textarea
            id={`${id}-distractors`}
            rows={2}
            defaultValue={(question.distractors ?? []).join("\n")}
            onChange={(event) => {
              const distractors = lines(event.target.value);
              onChange({ ...question, distractors: distractors.length > 0 ? distractors : undefined });
            }}
            className={TEXTAREA_CLASS}
          />
        </>
      ) : null}

      {question.kind === "short" ? (
        <>
          <label htmlFor={`${id}-marking`} className={cn(LABEL_CLASS, "mt-3")}>
            How it is marked
          </label>
          <select
            id={`${id}-marking`}
            value={isManuallyMarked(question) ? "manual" : "auto"}
            onChange={(event) => onChange({ ...question, marking: event.target.value as "auto" | "manual" })}
            className={cn(fieldClass, "w-full max-w-md")}
          >
            <option value="manual">A teacher marks each answer</option>
            <option value="auto">Automatically, when the answer contains a key phrase</option>
          </select>
          {isManuallyMarked(question) ? null : (
            <>
              <label htmlFor={`${id}-accept`} className={cn(LABEL_CLASS, "mt-3")}>
                Accepted phrases <span className="font-normal text-ink-3">(one per line; any one earns full marks)</span>
              </label>
              <textarea
                id={`${id}-accept`}
                rows={2}
                defaultValue={question.accept.join("\n")}
                onChange={(event) => onChange({ ...question, accept: lines(event.target.value) })}
                className={TEXTAREA_CLASS}
              />
            </>
          )}
          <label htmlFor={`${id}-sample`} className={cn(LABEL_CLASS, "mt-3")}>
            Sample answer <span className="font-normal text-ink-3">(shown to the marker, and to the student afterwards)</span>
          </label>
          <textarea
            id={`${id}-sample`}
            rows={2}
            value={question.sample}
            onChange={(event) => onChange({ ...question, sample: event.target.value })}
            className={TEXTAREA_CLASS}
          />
        </>
      ) : null}

      <label htmlFor={`${id}-explanation`} className={cn(LABEL_CLASS, "mt-3")}>
        Explanation <span className="font-normal text-ink-3">(optional, shown after the quiz)</span>
      </label>
      <textarea
        id={`${id}-explanation`}
        rows={2}
        value={question.explanation}
        onChange={(event) => onChange({ ...question, explanation: event.target.value })}
        className={TEXTAREA_CLASS}
      />
    </div>
  );
}
