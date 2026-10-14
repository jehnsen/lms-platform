"use client";

import { useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui";
import { describeLatePolicy, type SubmissionState } from "@/lib/domain/assignments";
import type { Assignment, AttachedFile, Section, Submission } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const STATE_BADGES: Record<SubmissionState, { label: string; tone: "neutral" | "primary" | "warn" | "good" }> = {
  missing: { label: "Not handed in", tone: "neutral" },
  submitted: { label: "Handed in", tone: "primary" },
  graded: { label: "Marked, not released", tone: "warn" },
  released: { label: "Grade released", tone: "good" },
};

/** "1 day late" with the deduction, when the late rule took marks off. */
export function lateText(late: NonNullable<Submission["late"]>) {
  const days = `${late.daysLate} ${late.daysLate === 1 ? "day" : "days"} late`;
  return late.penaltyPercent > 0 ? `${days} · ${late.penaltyPercent}% deducted` : days;
}

export function LateBadge({ late }: { late: Submission["late"] }) {
  return late ? <Badge tone="warn">{lateText(late)}</Badge> : null;
}

/** The facts every reader of an assignment needs: when it is due, what it is worth, who it is for, and the late rule. */
export function AssignmentFacts({ assignment, sections }: { assignment: Assignment; sections: Section[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-xs text-ink-3">Due</dt>
        <dd className="font-medium">{formatDateTime(assignment.dueAt)}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-3">Worth</dt>
        <dd className="font-medium tabular-nums">{assignment.points} points</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-3">Set for</dt>
        <dd className="font-medium">{sections.map((section) => section.name).join(", ") || "No section"}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-3">Hand in</dt>
        <dd className="font-medium">
          {assignment.accepts.length === 2 ? "Typed text or files" : assignment.accepts[0] === "file" ? "Files" : "Typed text"}
        </dd>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <dt className="text-xs text-ink-3">Late work and resubmission</dt>
        <dd>
          {describeLatePolicy(assignment.late)}{" "}
          {assignment.allowResubmission
            ? "Handing in again is allowed; the latest version is the one marked."
            : "Work can be handed in once."}
        </dd>
      </div>
    </dl>
  );
}

/** Files that can be downloaded. `onDownload` resolves to false when the file is not in this browser. */
export function FileList({
  files,
  onDownload,
  label,
}: {
  files: AttachedFile[];
  onDownload: (fileId: string) => Promise<boolean>;
  label: string;
}) {
  const [missing, setMissing] = useState<string | null>(null);
  if (files.length === 0) return null;
  return (
    <div>
      <ul aria-label={label} className="flex flex-col gap-1.5">
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
            <Paperclip aria-hidden className="size-4 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-ink-3">{file.sizeLabel}</span>
            <button
              type="button"
              onClick={() => {
                setMissing(null);
                void onDownload(file.id)
                  .then((found) => {
                    if (!found) setMissing(file.name);
                  })
                  .catch(() => setMissing(file.name));
              }}
              aria-label={`Download ${file.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface hover:text-ink"
            >
              <Download aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <p role="alert" className={missing ? "mt-1.5 text-sm text-bad" : undefined}>
        {missing ? `${missing} is not stored in this browser. In the demo, files stay on the device that uploaded them.` : null}
      </p>
    </div>
  );
}
