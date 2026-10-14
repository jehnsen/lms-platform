"use client";

/**
 * School settings service. Backend seam: `GET /settings`, `PUT /settings`.
 *
 * Reading is open to every signed-in user because screens need the policy
 * itself (for example the password rules shown while a password is typed).
 * Only admins may change it.
 */
import { settingsProblems } from "@/lib/domain/settings";
import { tidyScale } from "@/lib/grading";
import type { SchoolSettings } from "@/lib/types";
import { useRepository } from "./_repository";
import { settingsRepo } from "./_stores";
import { evaluateAttendanceAlerts } from "./attendance";
import { authorize, recordAudit } from "./session";

export class SettingsError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "SettingsError";
  }
}

export function useSettings(): SchoolSettings {
  return useRepository(settingsRepo);
}

function describeChanges(before: SchoolSettings, after: SchoolSettings) {
  const changed: string[] = [];
  if (JSON.stringify(before.passwordPolicy) !== JSON.stringify(after.passwordPolicy)) {
    changed.push("password policy");
  }
  if (before.retentionYears !== after.retentionYears) changed.push("data retention");
  if (JSON.stringify(before.uploadLimitsMb) !== JSON.stringify(after.uploadLimitsMb)) {
    changed.push("upload size limits");
  }
  if (JSON.stringify(before.lateDefault) !== JSON.stringify(after.lateDefault)) changed.push("default late rule");
  if (before.submissionLimitMb !== after.submissionLimitMb) changed.push("submission size limit");
  if (before.similarityVisibleToStudents !== after.similarityVisibleToStudents) {
    changed.push("who sees similarity reports");
  }
  if (
    JSON.stringify(before.gradingScales) !== JSON.stringify(after.gradingScales) ||
    before.defaultScaleId !== after.defaultScaleId
  ) {
    changed.push("grading scales");
  }
  if (JSON.stringify(before.attendance) !== JSON.stringify(after.attendance)) changed.push("attendance policy");
  return changed;
}

export async function updateSettings(input: SchoolSettings): Promise<void> {
  authorize("update", { type: "settings" });
  const next: SchoolSettings = { ...input, gradingScales: input.gradingScales.map(tidyScale) };
  const problems = settingsProblems(next);
  if (problems.length > 0) throw new SettingsError(problems);
  const changed = describeChanges(settingsRepo.get(), next);
  if (changed.length === 0) return;
  settingsRepo.update(() => next);
  recordAudit({
    action: "settings.update",
    resource: "settings",
    outcome: "allowed",
    detail: `Changed ${changed.join(", ")}`,
  });
  // FR-5.4: a new threshold or counting rule applies at once, so students it puts below are alerted now.
  if (changed.includes("attendance policy")) evaluateAttendanceAlerts();
}
