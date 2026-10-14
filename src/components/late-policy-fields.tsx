"use client";

import { fieldClass } from "@/components/ui";
import { describeLatePolicy } from "@/lib/domain/assignments";
import type { LatePolicy } from "@/lib/types";
import { cn } from "@/lib/utils";

const RULES: Array<{ value: LatePolicy["rule"]; label: string }> = [
  { value: "flag", label: "Accept it and mark it late" },
  { value: "penalty", label: "Accept it and deduct marks" },
  { value: "block", label: "Do not accept it" },
];

/** A cleared number field is NaN, which the rules reject, rather than a silent 0. */
const toNumber = (value: string) => (value === "" ? Number.NaN : Number(value));
const toField = (value: number) => (Number.isNaN(value) ? "" : value);

/**
 * FR-3.4: the late rule, as fields. Used for the school's default (admin
 * settings) and for one assignment (assignment editor).
 */
export function LatePolicyFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: LatePolicy;
  onChange: (next: LatePolicy) => void;
}) {
  return (
    <div>
      <label htmlFor={`${idPrefix}-rule`} className="mb-1 block text-sm font-medium">
        Work handed in after the due time
      </label>
      <select
        id={`${idPrefix}-rule`}
        value={value.rule}
        onChange={(event) => onChange({ ...value, rule: event.target.value as LatePolicy["rule"] })}
        aria-describedby={`${idPrefix}-summary`}
        className={cn(fieldClass, "w-full max-w-sm")}
      >
        {RULES.map((rule) => (
          <option key={rule.value} value={rule.value}>
            {rule.label}
          </option>
        ))}
      </select>

      {value.rule === "penalty" ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${idPrefix}-percent`} className="mb-1 block text-sm font-medium">
              Deduct (%)
            </label>
            <input
              id={`${idPrefix}-percent`}
              type="number"
              inputMode="decimal"
              min={1}
              max={100}
              value={toField(value.penaltyPercent)}
              onChange={(event) => onChange({ ...value, penaltyPercent: toNumber(event.target.value) })}
              className={cn(fieldClass, "w-24")}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-per`} className="mb-1 block text-sm font-medium">
              How often
            </label>
            <select
              id={`${idPrefix}-per`}
              value={value.penaltyPer}
              onChange={(event) => onChange({ ...value, penaltyPer: event.target.value as LatePolicy["penaltyPer"] })}
              className={fieldClass}
            >
              <option value="day">For each day late</option>
              <option value="submission">Once, however late</option>
            </select>
          </div>
          {value.penaltyPer === "day" ? (
            <div>
              <label htmlFor={`${idPrefix}-max`} className="mb-1 block text-sm font-medium">
                At most (%)
              </label>
              <input
                id={`${idPrefix}-max`}
                type="number"
                inputMode="decimal"
                min={1}
                max={100}
                value={toField(value.maxPenaltyPercent)}
                onChange={(event) => onChange({ ...value, maxPenaltyPercent: toNumber(event.target.value) })}
                className={cn(fieldClass, "w-24")}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <p id={`${idPrefix}-summary`} className="mt-2 text-sm text-ink-2">
        Students are told: “{describeLatePolicy(value)}”
      </p>
    </div>
  );
}
