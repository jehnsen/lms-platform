"use client";

import { CircleCheck, CircleMinus, CircleX, Hourglass } from "lucide-react";
import { fieldClass } from "@/components/ui";
import { QUESTION_KIND_LABELS } from "@/lib/domain/quizzes";
import { isAnswered, isManuallyMarked, matchingChoices, matchingOrder, type QuestionStatus } from "@/lib/grading";
import type { Answer, MatchingQuestion, Question } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHOICE_CLASS =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 text-sm transition-colors hover:border-line-strong has-checked:border-primary has-checked:bg-primary-soft";

const STATUS_META: Record<QuestionStatus, { label: string; className: string; icon: typeof CircleCheck }> = {
  correct: { label: "Correct", className: "text-good", icon: CircleCheck },
  partial: { label: "Partly correct", className: "text-warn", icon: CircleMinus },
  incorrect: { label: "Incorrect", className: "text-bad", icon: CircleX },
  unanswered: { label: "Not answered", className: "text-ink-3", icon: CircleMinus },
  pending: { label: "Waiting to be marked", className: "text-ink-2", icon: Hourglass },
};

export function StatusIcon({ status }: { status: QuestionStatus }) {
  const meta = STATUS_META[status];
  return <meta.icon aria-label={meta.label} className={cn("mt-0.5 size-5 shrink-0", meta.className)} />;
}

/** The answers to a matching question, one per left-hand item, with nothing chosen yet. */
function matchingAnswer(question: MatchingQuestion, answer: Answer | undefined): number[] {
  const chosen = Array.isArray(answer) ? answer : [];
  return question.pairs.map((_, index) => chosen[index] ?? -1);
}

/** A response in words, for the review after a quiz and for staff reading an answer. */
export function describeAnswer(question: Question, answer: Answer | undefined): string | undefined {
  if (!isAnswered(answer)) return undefined;
  switch (question.kind) {
    case "single":
      return typeof answer === "number" ? question.options[answer] : undefined;
    case "multi":
      return Array.isArray(answer)
        ? [...answer].sort((a, b) => a - b).map((choice) => question.options[choice]).join("; ")
        : undefined;
    case "boolean":
      return answer ? "True" : "False";
    case "short":
      return typeof answer === "string" ? answer : undefined;
    case "matching": {
      const choices = matchingChoices(question);
      return matchingAnswer(question, answer)
        .map((choice, index) => `${question.pairs[index].left} → ${choice >= 0 ? choices[choice] : "not matched"}`)
        .join("; ");
    }
  }
}

export function describeCorrect(question: Question): string {
  switch (question.kind) {
    case "single":
      return question.options[question.answer] ?? "";
    case "multi":
      return question.answer.map((choice) => question.options[choice]).join("; ");
    case "boolean":
      return question.answer ? "True" : "False";
    case "short":
      return question.sample || question.accept.join(", ");
    case "matching":
      return question.pairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
  }
}

function hintFor(question: Question) {
  switch (question.kind) {
    case "multi":
      return "Select all that apply. Part marks are given.";
    case "short":
      return isManuallyMarked(question) ? "Write your answer. Your teacher marks this one." : "Type a short answer.";
    case "matching":
      return "Choose the match for each item. Part marks are given.";
    default:
      return "Select one answer.";
  }
}

/** One question as a student answers it (FR-3.5): every kind works with the keyboard alone. */
export function QuestionField({
  name,
  question,
  answer,
  onAnswer,
}: {
  name: string;
  question: Question;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-medium text-pretty">{question.prompt}</legend>
      <p className="mt-1 text-sm text-ink-3">
        {QUESTION_KIND_LABELS[question.kind]}. {hintFor(question)} {question.points}{" "}
        {question.points === 1 ? "point" : "points"}.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {question.kind === "single"
          ? question.options.map((option, optionIndex) => (
              <label key={option} className={CHOICE_CLASS}>
                <input
                  type="radio"
                  name={name}
                  checked={answer === optionIndex}
                  onChange={() => onAnswer(optionIndex)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>{option}</span>
              </label>
            ))
          : null}

        {question.kind === "multi"
          ? question.options.map((option, optionIndex) => {
              const chosen = Array.isArray(answer) ? answer : [];
              const checked = chosen.includes(optionIndex);
              return (
                <label key={option} className={CHOICE_CLASS}>
                  <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={() =>
                      onAnswer(
                        checked
                          ? chosen.filter((choice) => choice !== optionIndex)
                          : [...chosen, optionIndex],
                      )
                    }
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>{option}</span>
                </label>
              );
            })
          : null}

        {question.kind === "boolean"
          ? [true, false].map((value) => (
              <label key={String(value)} className={CHOICE_CLASS}>
                <input
                  type="radio"
                  name={name}
                  checked={answer === value}
                  onChange={() => onAnswer(value)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>{value ? "True" : "False"}</span>
              </label>
            ))
          : null}

        {question.kind === "short" ? (
          isManuallyMarked(question) ? (
            <textarea
              name={name}
              aria-label="Your answer"
              rows={5}
              value={typeof answer === "string" ? answer : ""}
              onChange={(event) => onAnswer(event.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed placeholder:text-ink-3"
            />
          ) : (
            <input
              type="text"
              name={name}
              aria-label="Your answer"
              value={typeof answer === "string" ? answer : ""}
              onChange={(event) => onAnswer(event.target.value)}
              autoComplete="off"
              placeholder="Your answer"
              className={cn(fieldClass, "h-11")}
            />
          )
        ) : null}

        {question.kind === "matching" ? <MatchingField name={name} question={question} answer={answer} onAnswer={onAnswer} /> : null}
      </div>
    </fieldset>
  );
}

/**
 * Matching as one list box per item rather than drag-and-drop, so it works
 * the same with a mouse, a keyboard, a screen reader and a phone (NFR-5).
 */
function MatchingField({
  name,
  question,
  answer,
  onAnswer,
}: {
  name: string;
  question: MatchingQuestion;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
}) {
  const choices = matchingChoices(question);
  const order = matchingOrder(question);
  const chosen = matchingAnswer(question, answer);

  return (
    <ul className="flex flex-col gap-2">
      {question.pairs.map((pair, index) => (
        <li key={pair.left} className="grid gap-1.5 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:gap-3">
          <label htmlFor={`${name}-${index}`} className="text-sm font-medium">
            {pair.left}
          </label>
          <select
            id={`${name}-${index}`}
            value={chosen[index]}
            onChange={(event) => onAnswer(chosen.map((value, position) => (position === index ? Number(event.target.value) : value)))}
            className={cn(fieldClass, "w-full")}
          >
            <option value={-1}>Choose a match</option>
            {order.map((choice) => (
              <option key={choice} value={choice}>
                {choices[choice]}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}
