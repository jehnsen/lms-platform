"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, fieldClass } from "@/components/ui";
import { RISK_CONDITIONS, RISK_CONDITION_LABELS, RISK_RANGES, type RiskCondition } from "@/lib/domain/analytics";
import type { AtRiskRule } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  /** Text while typed; `null` when the condition is not used. */
  values: Record<RiskCondition, string | null>;
}

/** What a condition starts at when it is ticked. */
const STARTING_VALUES: Record<RiskCondition, number> = { gradeBelow: 60, attendanceBelow: 80, missingAtLeast: 3, inactiveDays: 14 };

let counter = 0;

function rowOf(rule: AtRiskRule): RuleRow {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    values: Object.fromEntries(
      RISK_CONDITIONS.map((condition) => [condition, rule[condition] === undefined ? null : String(rule[condition])]),
    ) as Record<RiskCondition, string | null>,
  };
}

function ruleOf(row: RuleRow): AtRiskRule {
  const rule: AtRiskRule = { id: row.id, name: row.name, enabled: row.enabled };
  for (const condition of RISK_CONDITIONS) {
    const value = row.values[condition];
    if (value !== null) rule[condition] = value.trim() === "" ? Number.NaN : Number(value);
  }
  return rule;
}

/**
 * FR-7.3 (US-27): the school's at-risk rules. Each rule sets one or more
 * conditions that must all hold; a student is at risk when any enabled rule
 * matches.
 */
export function AtRiskFields({ rules, onChange }: { rules: AtRiskRule[]; onChange: (rules: AtRiskRule[]) => void }) {
  const [rows, setRows] = useState<RuleRow[]>(() => rules.map(rowOf));

  const update = (next: RuleRow[]) => {
    setRows(next);
    onChange(next.map(ruleOf));
  };
  const setRow = (id: string, change: (row: RuleRow) => RuleRow) => update(rows.map((row) => (row.id === id ? change(row) : row)));

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <fieldset key={row.id} className="min-w-0 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{row.name.trim() || `Rule ${index + 1}`}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <label htmlFor={`risk-name-${row.id}`} className="mb-1 block text-xs text-ink-3">
                Name
              </label>
              <input
                id={`risk-name-${row.id}`}
                value={row.name}
                onChange={(event) => setRow(row.id, (current) => ({ ...current, name: event.target.value }))}
                className={cn(fieldClass, "w-full")}
              />
            </div>
            <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) => setRow(row.id, (current) => ({ ...current, enabled: event.target.checked }))}
                className="size-4 accent-primary"
              />
              In use
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => update(rows.filter((candidate) => candidate.id !== row.id))}
              aria-label={`Remove rule ${row.name.trim() || index + 1}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-3">A student matches this rule when every ticked condition holds.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {RISK_CONDITIONS.map((condition) => {
              const value = row.values[condition];
              const { label, unit } = RISK_CONDITION_LABELS[condition];
              const inputId = `risk-${row.id}-${condition}`;
              return (
                <li key={condition} className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex min-w-48 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value !== null}
                      onChange={(event) =>
                        setRow(row.id, (current) => ({
                          ...current,
                          values: { ...current.values, [condition]: event.target.checked ? String(STARTING_VALUES[condition]) : null },
                        }))
                      }
                      className="size-4 accent-primary"
                    />
                    {label}
                  </label>
                  <label htmlFor={inputId} className="sr-only">
                    {label} ({unit}), {row.name.trim() || `rule ${index + 1}`}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={RISK_RANGES[condition].min}
                    max={RISK_RANGES[condition].max}
                    disabled={value === null}
                    value={value ?? ""}
                    onChange={(event) =>
                      setRow(row.id, (current) => ({ ...current, values: { ...current.values, [condition]: event.target.value } }))
                    }
                    className={cn(fieldClass, "w-24")}
                  />
                  <span className="text-ink-3">{unit}</span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            counter += 1;
            update([
              ...rows,
              rowOf({ id: `risk-${Date.now().toString(36)}${counter}`, name: "", enabled: true, gradeBelow: 60 }),
            ]);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Add rule
        </Button>
      </div>
    </div>
  );
}
