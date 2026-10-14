"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, fieldBaseClass, fieldClass } from "@/components/ui";
import { rubricScore, rubricTotal } from "@/lib/domain/assignments";
import type { Rubric, RubricCriterion } from "@/lib/types";
import { cn } from "@/lib/utils";

const toNumber = (value: string) => (value === "" ? Number.NaN : Number(value));
const toField = (value: number) => (Number.isNaN(value) ? "" : value);

const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad disabled:pointer-events-none disabled:opacity-40";

/**
 * A rubric as students and markers read it (FR-3.2). With `onChoose` each
 * criterion becomes a group of radio buttons and the total updates as levels
 * are picked (US-15); without it, the levels in `chosen` are shown as picked.
 */
export function RubricView({
  rubric,
  idPrefix,
  chosen,
  onChoose,
}: {
  rubric: Rubric;
  idPrefix: string;
  chosen?: Record<string, string>;
  onChoose?: (criterionId: string, levelId: string) => void;
}) {
  const score = chosen ? rubricScore(rubric, chosen) : undefined;
  return (
    <div className="flex flex-col gap-4">
      {rubric.criteria.map((criterion) => {
        const levels = [...criterion.levels].sort((a, b) => b.points - a.points);
        return (
          <fieldset key={criterion.id}>
            <legend className="text-sm font-semibold">
              {criterion.title} <span className="font-normal text-ink-3">· {criterion.points} points</span>
            </legend>
            {criterion.description ? <p className="mt-0.5 text-sm text-ink-2">{criterion.description}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {levels.map((level) => {
                const picked = chosen?.[criterion.id] === level.id;
                const content = (
                  <>
                    <span className="font-medium">{level.label}</span>
                    <span className="text-ink-2 tabular-nums">{level.points}</span>
                  </>
                );
                return onChoose ? (
                  <label
                    key={level.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:border-line-strong has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-${criterion.id}`}
                      checked={picked}
                      onChange={() => onChoose(criterion.id, level.id)}
                      className="size-4 accent-primary"
                    />
                    {content}
                  </label>
                ) : (
                  <span
                    key={level.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                      picked ? "border-primary bg-primary-soft" : "border-line",
                    )}
                  >
                    {content}
                    {picked ? <span className="sr-only">(awarded)</span> : null}
                  </span>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {score ? (
        <p role="status" className="text-sm font-medium tabular-nums">
          Rubric total: {score.points} of {rubricTotal(rubric)}
          {score.complete ? null : <span className="font-normal text-ink-3"> · some criteria not scored yet</span>}
        </p>
      ) : null}
    </div>
  );
}

function defaultLevels(points: number, newId: (prefix: string) => string) {
  const round = (value: number) => Math.round(value * 100) / 100;
  return [
    { id: newId("lvl"), label: "Excellent", points },
    { id: newId("lvl"), label: "Good", points: round(points * 0.75) },
    { id: newId("lvl"), label: "Developing", points: round(points * 0.5) },
    { id: newId("lvl"), label: "Beginning", points: round(points * 0.25) },
  ];
}

/** FR-3.2: build a rubric from criteria, each with a weight in points and a set of levels. */
export function RubricBuilder({
  rubric,
  points,
  newId,
  onChange,
}: {
  rubric: Rubric;
  /** What the assignment is worth: the rubric must add up to this. */
  points: number;
  newId: (prefix: string) => string;
  onChange: (next: Rubric) => void;
}) {
  const total = rubricTotal(rubric);
  const setCriterion = (criterionId: string, changes: Partial<RubricCriterion>) =>
    onChange({
      criteria: rubric.criteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, ...changes } : criterion)),
    });

  const addCriterion = () => {
    const remaining = Number.isFinite(points - total) && points - total > 0 ? points - total : 10;
    onChange({
      criteria: [
        ...rubric.criteria,
        { id: newId("crit"), title: "", description: "", points: remaining, levels: defaultLevels(remaining, newId) },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {rubric.criteria.map((criterion, index) => {
        const name = criterion.title.trim() || `criterion ${index + 1}`;
        return (
          <div key={criterion.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-48">
                <label htmlFor={`crit-title-${criterion.id}`} className="mb-1 block text-sm font-medium">
                  Criterion {index + 1}
                </label>
                <input
                  id={`crit-title-${criterion.id}`}
                  type="text"
                  placeholder="What is being judged"
                  value={criterion.title}
                  onChange={(event) => setCriterion(criterion.id, { title: event.target.value })}
                  className={cn(fieldClass, "w-full")}
                />
              </div>
              <div>
                <label htmlFor={`crit-points-${criterion.id}`} className="mb-1 block text-sm font-medium">
                  Points
                </label>
                <input
                  id={`crit-points-${criterion.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={toField(criterion.points)}
                  onChange={(event) => setCriterion(criterion.id, { points: toNumber(event.target.value) })}
                  className={cn(fieldClass, "w-24")}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange({ criteria: rubric.criteria.filter((candidate) => candidate.id !== criterion.id) })}
                aria-label={`Remove ${name}`}
                className={cn(ICON_BUTTON, "mb-1")}
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>

            <label htmlFor={`crit-description-${criterion.id}`} className="mt-3 mb-1 block text-sm font-medium">
              Description <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <textarea
              id={`crit-description-${criterion.id}`}
              rows={2}
              value={criterion.description}
              onChange={(event) => setCriterion(criterion.id, { description: event.target.value })}
              className={cn(fieldBaseClass, "w-full px-3 py-2")}
            />

            <fieldset className="mt-3">
              <legend className="text-sm font-medium">Levels</legend>
              <p className="text-xs text-ink-3">The highest level is worth the criterion&apos;s points.</p>
              <ul className="mt-2 flex flex-col gap-2">
                {criterion.levels.map((level, levelIndex) => (
                  <li key={level.id} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      aria-label={`${name}, level ${levelIndex + 1}: name`}
                      placeholder="Level name"
                      value={level.label}
                      onChange={(event) =>
                        setCriterion(criterion.id, {
                          levels: criterion.levels.map((candidate) =>
                            candidate.id === level.id ? { ...candidate, label: event.target.value } : candidate,
                          ),
                        })
                      }
                      className={cn(fieldClass, "min-w-0 flex-1 basis-40")}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      aria-label={`${name}, level ${levelIndex + 1}: points`}
                      value={toField(level.points)}
                      onChange={(event) =>
                        setCriterion(criterion.id, {
                          levels: criterion.levels.map((candidate) =>
                            candidate.id === level.id ? { ...candidate, points: toNumber(event.target.value) } : candidate,
                          ),
                        })
                      }
                      className={cn(fieldClass, "w-24")}
                    />
                    <button
                      type="button"
                      onClick={() => setCriterion(criterion.id, { levels: criterion.levels.filter((candidate) => candidate.id !== level.id) })}
                      disabled={criterion.levels.length <= 2}
                      aria-label={`Remove level ${levelIndex + 1} of ${name}`}
                      title={criterion.levels.length <= 2 ? "A criterion needs at least two levels" : undefined}
                      className={ICON_BUTTON}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setCriterion(criterion.id, { levels: [...criterion.levels, { id: newId("lvl"), label: "", points: 0 }] })}
              >
                <Plus aria-hidden className="size-4" />
                Add a level<span className="sr-only"> to {name}</span>
              </Button>
            </fieldset>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={addCriterion}>
          <Plus aria-hidden className="size-4" />
          Add criterion
        </Button>
        <p
          role="status"
          className={cn("text-sm tabular-nums", total === points ? "text-good" : "text-warn")}
        >
          {total === points
            ? `The rubric adds up to ${points} points, the same as the assignment.`
            : `The rubric adds up to ${Number.isFinite(total) ? total : "?"} points; the assignment is worth ${Number.isFinite(points) ? points : "?"}.`}
        </p>
      </div>
    </div>
  );
}
