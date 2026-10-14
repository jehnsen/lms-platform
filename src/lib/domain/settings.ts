/**
 * School settings: the defaults used until the client decides, and the checks
 * a change must pass. Every default here is an open question in
 * docs/requirements/OPEN-QUESTIONS.md.
 */
import { DEFAULT_PASSWORD_POLICY, MIN_LENGTH_RANGE } from "@/lib/domain/password-policy";
import {
  DEFAULT_UPLOAD_LIMITS_MB,
  MATERIAL_KINDS,
  UPLOAD_FORMATS,
  UPLOAD_LIMIT_RANGE_MB,
} from "@/lib/domain/uploads";
import type { SchoolSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: SchoolSettings = {
  passwordPolicy: DEFAULT_PASSWORD_POLICY,
  // Q-12: nothing is deleted until the school sets a retention period.
  retentionYears: null,
  // Q-13: file size limits per kind of material.
  uploadLimitsMb: DEFAULT_UPLOAD_LIMITS_MB,
};

export const RETENTION_YEARS_RANGE = { min: 1, max: 99 } as const;

/** Why these settings cannot be saved. Empty when they can. */
export function settingsProblems(settings: SchoolSettings): string[] {
  const problems: string[] = [];
  const { minLength } = settings.passwordPolicy;
  if (!Number.isInteger(minLength) || minLength < MIN_LENGTH_RANGE.min || minLength > MIN_LENGTH_RANGE.max) {
    problems.push(
      `Minimum password length must be a whole number from ${MIN_LENGTH_RANGE.min} to ${MIN_LENGTH_RANGE.max}.`,
    );
  }
  const years = settings.retentionYears;
  if (
    years !== null &&
    (!Number.isInteger(years) || years < RETENTION_YEARS_RANGE.min || years > RETENTION_YEARS_RANGE.max)
  ) {
    problems.push(
      `Retention must be a whole number of years from ${RETENTION_YEARS_RANGE.min} to ${RETENTION_YEARS_RANGE.max}, or kept indefinitely.`,
    );
  }
  for (const kind of MATERIAL_KINDS) {
    const limit = settings.uploadLimitsMb[kind];
    if (!Number.isInteger(limit) || limit < UPLOAD_LIMIT_RANGE_MB.min || limit > UPLOAD_LIMIT_RANGE_MB.max) {
      problems.push(
        `The size limit for ${UPLOAD_FORMATS[kind].label.toLowerCase()} must be a whole number of megabytes from ${UPLOAD_LIMIT_RANGE_MB.min} to ${UPLOAD_LIMIT_RANGE_MB.max}.`,
      );
    }
  }
  return problems;
}
