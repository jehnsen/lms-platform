/**
 * School settings: the defaults used until the client decides, and the checks
 * a change must pass. Every default here is an open question in
 * docs/requirements/OPEN-QUESTIONS.md.
 */
import { DEFAULT_AT_RISK_POLICY, atRiskProblems } from "@/lib/domain/analytics";
import { DEFAULT_LATE_POLICY, latePolicyProblems } from "@/lib/domain/assignments";
import { DEFAULT_ATTENDANCE_POLICY, attendancePolicyProblems } from "@/lib/domain/attendance";
import { DEFAULT_MESSAGING_POLICY } from "@/lib/domain/messaging";
import { DEFAULT_NOTIFICATION_POLICY, notificationPolicyProblems } from "@/lib/domain/notifications";
import { DEFAULT_PASSWORD_POLICY, MIN_LENGTH_RANGE } from "@/lib/domain/password-policy";
import {
  DEFAULT_UPLOAD_LIMITS_MB,
  MATERIAL_KINDS,
  UPLOAD_FORMATS,
  UPLOAD_LIMIT_RANGE_MB,
} from "@/lib/domain/uploads";
import { DEFAULT_GRADING_SCALES, DEFAULT_SCALE_ID, scaleProblems } from "@/lib/grading";
import type { SchoolSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: SchoolSettings = {
  passwordPolicy: DEFAULT_PASSWORD_POLICY,
  // Q-12: nothing is deleted until the school sets a retention period.
  retentionYears: null,
  // Q-13: file size limits per kind of material.
  uploadLimitsMb: DEFAULT_UPLOAD_LIMITS_MB,
  // Q-14: late work is accepted and marked late until the school sets its rule.
  lateDefault: DEFAULT_LATE_POLICY,
  // Q-37: the largest file a student may hand in.
  submissionLimitMb: 25,
  // US-14: similarity reports are for faculty only unless the school decides otherwise.
  similarityVisibleToStudents: false,
  // Q-17: the grading scales and their bands, and the one a course starts with.
  gradingScales: DEFAULT_GRADING_SCALES,
  defaultScaleId: DEFAULT_SCALE_ID,
  // Q-19, Q-04: the attendance threshold, how marks count, the correction window and who is alerted.
  attendance: DEFAULT_ATTENDANCE_POLICY,
  // Q-21: which notifications nobody can switch off.
  notifications: DEFAULT_NOTIFICATION_POLICY,
  // Q-20: who may message whom.
  messaging: DEFAULT_MESSAGING_POLICY,
  // Q-22: when a student counts as at risk.
  atRisk: DEFAULT_AT_RISK_POLICY,
};

export const RETENTION_YEARS_RANGE = { min: 1, max: 99 } as const;
export const SUBMISSION_LIMIT_RANGE_MB = { min: 1, max: 500 } as const;

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
  problems.push(...latePolicyProblems(settings.lateDefault));
  const submissionLimit = settings.submissionLimitMb;
  if (
    !Number.isInteger(submissionLimit) ||
    submissionLimit < SUBMISSION_LIMIT_RANGE_MB.min ||
    submissionLimit > SUBMISSION_LIMIT_RANGE_MB.max
  ) {
    problems.push(
      `The size limit for submitted files must be a whole number of megabytes from ${SUBMISSION_LIMIT_RANGE_MB.min} to ${SUBMISSION_LIMIT_RANGE_MB.max}.`,
    );
  }
  for (const scale of settings.gradingScales) problems.push(...scaleProblems(scale));
  if (!settings.gradingScales.some((scale) => scale.id === settings.defaultScaleId)) {
    problems.push("Choose the grading scale a course starts with.");
  }
  problems.push(...attendancePolicyProblems(settings.attendance));
  problems.push(...notificationPolicyProblems(settings.notifications));
  problems.push(...atRiskProblems(settings.atRisk));
  return problems;
}
