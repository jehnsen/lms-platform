"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, fieldClass } from "@/components/ui";
import { GRADE_POINTS_RANGE, SCALE_KIND_LABELS } from "@/lib/grading";
import type { GradingScale } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BandRow {
  key: string;
  label: string;
  /** Kept as text while they are typed, so a field can be cleared and retyped. */
  min: string;
  points: string;
}

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

let rowCounter = 0;
const newKey = () => `band-${(rowCounter += 1)}`;

function rowsOf(scale: GradingScale): BandRow[] {
  return scale.bands.map((band) => ({
    key: newKey(),
    label: band.label,
    min: String(band.min),
    points: band.points === undefined ? "" : String(band.points),
  }));
}

/**
 * FR-4.2: the grades of the school's letter and GPA scales, and the scale a
 * course starts with. Teachers pick one of these scales for each course.
 */
export function GradingScaleFields({
  scales,
  defaultScaleId,
  onChange,
}: {
  scales: GradingScale[];
  defaultScaleId: string;
  onChange: (scales: GradingScale[], defaultScaleId: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, BandRow[]>>(() =>
    Object.fromEntries(scales.map((scale) => [scale.id, rowsOf(scale)])),
  );

  const update = (scaleId: string, next: BandRow[]) => {
    setRows((current) => ({ ...current, [scaleId]: next }));
    onChange(
      scales.map((scale) =>
        scale.id !== scaleId
          ? scale
          : {
              ...scale,
              bands: next.map((row) => ({
                label: row.label,
                min: toNumber(row.min),
                ...(scale.kind === "gpa" ? { points: toNumber(row.points) } : {}),
              })),
            },
      ),
      defaultScaleId,
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="settings-default-scale" className="mb-1 block text-sm font-medium">
          Scale a course starts with
        </label>
        <select
          id="settings-default-scale"
          value={defaultScaleId}
          onChange={(event) => onChange(scales, event.target.value)}
          aria-describedby="settings-default-scale-hint"
          className={cn(fieldClass, "w-full sm:w-72")}
        >
          {scales.map((scale) => (
            <option key={scale.id} value={scale.id}>
              {scale.name} ({SCALE_KIND_LABELS[scale.kind]})
            </option>
          ))}
        </select>
        <p id="settings-default-scale-hint" className="mt-1 text-xs text-ink-3">
          Also used for a student&apos;s average across courses. Teachers can choose another scale for a course.
        </p>
      </div>

      {scales
        .filter((scale) => scale.kind !== "percentage")
        .map((scale) => {
          const bandRows = rows[scale.id] ?? [];
          const setRow = (key: string, changes: Partial<BandRow>) =>
            update(scale.id, bandRows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
          return (
            <fieldset key={scale.id} className="min-w-0 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold">{scale.name}</legend>
              <p className="text-xs text-ink-3">
                A grade applies from its percentage up to the next grade above it. The lowest must start at 0%.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {bandRows.map((row, index) => (
                  <li key={row.key} className="flex flex-wrap items-end gap-2">
                    <div className="w-[4.5rem]">
                      <label htmlFor={`${scale.id}-${row.key}-label`} className={cn("mb-1 block text-xs text-ink-3", index > 0 && "sr-only")}>
                        Grade{index > 0 ? ` ${index + 1}` : ""}
                      </label>
                      <input
                        id={`${scale.id}-${row.key}-label`}
                        value={row.label}
                        onChange={(event) => setRow(row.key, { label: event.target.value })}
                        className={cn(fieldClass, "w-full")}
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label htmlFor={`${scale.id}-${row.key}-min`} className={cn("mb-1 block text-xs text-ink-3", index > 0 && "sr-only")}>
                        From (%){index > 0 ? `, grade ${index + 1}` : ""}
                      </label>
                      <input
                        id={`${scale.id}-${row.key}-min`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="any"
                        value={row.min}
                        onChange={(event) => setRow(row.key, { min: event.target.value })}
                        className={cn(fieldClass, "w-full")}
                      />
                    </div>
                    {scale.kind === "gpa" ? (
                      <div className="w-[4.5rem]">
                        <label htmlFor={`${scale.id}-${row.key}-points`} className={cn("mb-1 block text-xs text-ink-3", index > 0 && "sr-only")}>
                          Grade points{index > 0 ? `, grade ${index + 1}` : ""}
                        </label>
                        <input
                          id={`${scale.id}-${row.key}-points`}
                          type="number"
                          inputMode="decimal"
                          min={GRADE_POINTS_RANGE.min}
                          max={GRADE_POINTS_RANGE.max}
                          step="any"
                          value={row.points}
                          onChange={(event) => setRow(row.key, { points: event.target.value })}
                          className={cn(fieldClass, "w-full")}
                        />
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={bandRows.length <= 2}
                      onClick={() => update(scale.id, bandRows.filter((candidate) => candidate.key !== row.key))}
                      aria-label={`Remove grade ${row.label.trim() || index + 1} from ${scale.name}`}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => update(scale.id, [...bandRows, { key: newKey(), label: "", min: "", points: "" }])}
              >
                <Plus aria-hidden className="size-4" />
                Add grade
              </Button>
            </fieldset>
          );
        })}
    </div>
  );
}
