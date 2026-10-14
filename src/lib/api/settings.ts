"use client";

/**
 * School settings service. Backend seam: `GET /settings`, `PUT /settings`.
 *
 * Reading is open to every signed-in user because screens need the policy
 * itself (for example the password rules shown while a password is typed).
 * Only admins may change it.
 */
import { settingsProblems } from "@/lib/domain/settings";
import type { SchoolSettings } from "@/lib/types";
import { useRepository } from "./_repository";
import { settingsRepo } from "./_stores";
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
  return changed;
}

export async function updateSettings(next: SchoolSettings): Promise<void> {
  authorize("update", { type: "settings" });
  const problems = settingsProblems(next);
  if (problems.length > 0) throw new SettingsError(problems);
  const changed = describeChanges(settingsRepo.get(), next);
  if (changed.length === 0) return;
  settingsRepo.update(() => next);
  recordAudit({
    action: "settings.update",
    resource: "settings",
    outcome: "allowed",
    detail: `Changed ${changed.join(" and ")}`,
  });
}
