"use client";

import { useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, fieldClass } from "@/components/ui";
import { GradebookError, saveGradebookSetup } from "@/lib/api/grades";
import { weightTotal, type GradeItem } from "@/lib/domain/gradebook";
import { SCALE_KIND_LABELS } from "@/lib/grading";
import type { GradebookSetup, GradingScale } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryRow {
  id: string;
  name: string;
  /** Kept as text while it is typed, so the field can be cleared and retyped. */
  weight: string;
}

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

let rowCounter = 0;

/** What a scale's grades are, in a line: "A from 93%, A− from 90% …". */
function describeScale(scale: GradingScale) {
  if (scale.kind === "percentage") return "The grade is the percentage itself.";
  return scale.bands
    .map((band) => `${scale.kind === "gpa" ? `${(band.points ?? 0).toFixed(1)} (${band.label})` : band.label} from ${band.min}%`)
    .join(", ");
}

/**
 * US-16: a course's grade categories and weights, its grading scale and its
 * missing-work rule. The weights must total 100% before it can be saved.
 */
export function GradebookSetupDialog({
  courseId,
  courseTitle,
  setup,
  scales,
  items,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  setup: GradebookSetup;
  scales: GradingScale[];
  /** The published quizzes and assignments, each with the category it counts in now. */
  items: GradeItem[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<CategoryRow[]>(() =>
    setup.categories.map((category) => ({ id: category.id, name: category.name, weight: String(category.weight) })),
  );
  const [scaleId, setScaleId] = useState(() => (scales.some((scale) => scale.id === setup.scaleId) ? setup.scaleId : (scales[0]?.id ?? "")));
  const [missingAsZero, setMissingAsZero] = useState(setup.missingAsZero);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.categoryId])),
  );
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const total = weightTotal(rows.map((row) => ({ weight: toNumber(row.weight) })));
  const balanced = total === 100;
  const scale = scales.find((candidate) => candidate.id === scaleId);

  const setRow = (id: string, changes: Partial<CategoryRow>) => {
    setProblems([]);
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  };

  const addRow = () => {
    rowCounter += 1;
    setProblems([]);
    setRows((current) => [...current, { id: `cat-${Date.now().toString(36)}${rowCounter}`, name: "", weight: "" }]);
  };

  const removeRow = (id: string) => {
    const remaining = rows.filter((row) => row.id !== id);
    if (remaining.length === 0) return;
    setProblems([]);
    setRows(remaining);
    // Whatever counted in the removed category moves to the first one left.
    setItemCategories((current) =>
      Object.fromEntries(Object.entries(current).map(([itemId, categoryId]) => [itemId, categoryId === id ? remaining[0].id : categoryId])),
    );
  };

  const save = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await saveGradebookSetup(courseId, {
        categories: rows.map((row) => ({ id: row.id, name: row.name, weight: toNumber(row.weight) })),
        scaleId,
        missingAsZero,
        itemCategories,
      });
      onClose();
    } catch (error) {
      setProblems(error instanceof GradebookError ? error.problems : ["Something went wrong. Try again."]);
      setBusy(false);
    }
  };

  return (
    <Dialog wide title="Set up grading" description={courseTitle} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold">Categories and weights</legend>
          <p className="mt-1 text-sm text-ink-2">
            Each category is a share of the course grade. Inside a category, work counts in proportion to its points.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.id} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-32">
                  <label htmlFor={`cat-name-${row.id}`} className={cn("mb-1 block text-xs text-ink-3", index > 0 && "sr-only")}>
                    Category{index > 0 ? ` ${index + 1}` : ""}
                  </label>
                  <input
                    id={`cat-name-${row.id}`}
                    value={row.name}
                    onChange={(event) => setRow(row.id, { name: event.target.value })}
                    placeholder="For example, Exams"
                    className={cn(fieldClass, "w-full")}
                  />
                </div>
                <div className="w-24">
                  <label htmlFor={`cat-weight-${row.id}`} className={cn("mb-1 block text-xs text-ink-3", index > 0 && "sr-only")}>
                    Weight (%){index > 0 ? `, category ${index + 1}` : ""}
                  </label>
                  <input
                    id={`cat-weight-${row.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    value={row.weight}
                    onChange={(event) => setRow(row.id, { weight: event.target.value })}
                    className={cn(fieldClass, "w-full")}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove category ${row.name.trim() || index + 1}`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={addRow}>
              <Plus aria-hidden className="size-4" />
              Add category
            </Button>
            {/* Always rendered, so a screen reader hears the total change as weights are typed (NFR-5). */}
            <p role="status" className={cn("text-sm font-medium tabular-nums", balanced ? "text-good" : "text-warn")}>
              Total {total}%.{" "}
              {balanced ? "Ready to save." : "The weights must total 100% before you can save."}
            </p>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold">Which category each item counts in</legend>
          {items.length === 0 ? (
            <p className="mt-1 text-sm text-ink-2">
              No quizzes or assignments are published yet. Each one is given a category when it is made.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label htmlFor={`item-cat-${item.id}`} className="min-w-0 flex-1 basis-48 text-sm">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-ink-3">
                      {" "}
                      · {item.kind === "quiz" ? "Quiz" : "Assignment"} · {item.points} points
                    </span>
                  </label>
                  <select
                    id={`item-cat-${item.id}`}
                    value={rows.some((row) => row.id === itemCategories[item.id]) ? itemCategories[item.id] : rows[0].id}
                    onChange={(event) => setItemCategories((current) => ({ ...current, [item.id]: event.target.value }))}
                    className={cn(fieldClass, "w-44")}
                  >
                    {rows.map((row, index) => (
                      <option key={row.id} value={row.id}>
                        {row.name.trim() || `Category ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div>
          <label htmlFor="setup-scale" className="mb-1 block text-sm font-semibold">
            Grading scale
          </label>
          <select
            id="setup-scale"
            value={scaleId}
            onChange={(event) => setScaleId(event.target.value)}
            aria-describedby="setup-scale-hint"
            className={cn(fieldClass, "w-full sm:w-72")}
          >
            {scales.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({SCALE_KIND_LABELS[candidate.kind]})
              </option>
            ))}
          </select>
          <p id="setup-scale-hint" className="mt-1 text-xs text-ink-3">
            {scale ? describeScale(scale) : null} The school sets the grades of each scale in Settings.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={missingAsZero}
            onChange={(event) => setMissingAsZero(event.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Count work that is not handed in by its due date as zero
            <span className="block text-xs text-ink-3">
              Off: work that has no grade is left out, so the total is the grade so far.
            </span>
          </span>
        </label>

        {/* Always rendered, so the reasons are announced when a save is refused. */}
        <div role="alert">
          {problems.length > 0 ? (
            <div className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
