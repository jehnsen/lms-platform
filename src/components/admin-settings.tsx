"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { GradingScaleFields } from "@/components/grading-scale-fields";
import { LatePolicyFields } from "@/components/late-policy-fields";
import { Button, Card, PageContainer, PageHeader, fieldClass } from "@/components/ui";
import { SettingsError, updateSettings, useSettings } from "@/lib/api/settings";
import { useUsers } from "@/lib/api/users";
import { ATTENDANCE_RANGES } from "@/lib/domain/attendance";
import { CATEGORY_LABELS, NOTIFICATION_CATEGORIES } from "@/lib/domain/notifications";
import { MIN_LENGTH_RANGE } from "@/lib/domain/password-policy";
import { RETENTION_YEARS_RANGE, SUBMISSION_LIMIT_RANGE_MB } from "@/lib/domain/settings";
import { MATERIAL_KINDS, UPLOAD_FORMATS, UPLOAD_LIMIT_RANGE_MB } from "@/lib/domain/uploads";
import type { AttendancePolicy, MaterialKind, MessagingPolicy, PasswordPolicy, SchoolSettings } from "@/lib/types";

const MESSAGING_RULES: Array<{ key: keyof MessagingPolicy; label: string; detail: string }> = [
  { key: "studentsToTeachers", label: "Students may message their teachers", detail: "The teachers of the sections they are in." },
  {
    key: "studentsToClassmates",
    label: "Students may message each other",
    detail: "Only students in the same section. Off: a student can write to teachers only.",
  },
  { key: "parentsToTeachers", label: "Parents may message their children's teachers", detail: "The teachers of a linked child's sections." },
];
import { cn } from "@/lib/utils";

const CHARACTER_RULES: Array<{ key: keyof Omit<PasswordPolicy, "minLength">; label: string }> = [
  { key: "requireUppercase", label: "An uppercase letter" },
  { key: "requireLowercase", label: "A lowercase letter" },
  { key: "requireDigit", label: "A number" },
  { key: "requireSymbol", label: "A symbol" },
];

/**
 * Admin settings: school policy the requirements leave to the client, each
 * with a default (see OPEN-QUESTIONS.md). Later phases add their sections here.
 */
export function AdminSettings() {
  const settings = useSettings();
  // Keyed on the saved value, so the form starts again from it after a save or a reset of the demo data.
  return <SettingsForm key={JSON.stringify(settings)} saved={settings} />;
}

function SettingsForm({ saved }: { saved: SchoolSettings }) {
  const [draft, setDraft] = useState(saved);
  // Kept as text while it is typed, so the field can be cleared and retyped.
  const [minLength, setMinLength] = useState(String(saved.passwordPolicy.minLength));
  const [retentionYears, setRetentionYears] = useState(String(saved.retentionYears ?? 7));
  const [uploadLimits, setUploadLimits] = useState(() =>
    Object.fromEntries(MATERIAL_KINDS.map((kind) => [kind, String(saved.uploadLimitsMb[kind])])) as Record<MaterialKind, string>,
  );
  const [submissionLimit, setSubmissionLimit] = useState(String(saved.submissionLimitMb));
  const [threshold, setThreshold] = useState(String(saved.attendance.thresholdPercent));
  const [minSessions, setMinSessions] = useState(String(saved.attendance.minSessions));
  const [editWindow, setEditWindow] = useState(String(saved.attendance.editWindowHours));
  // Q-04: the academic coordinator is a responsibility given to staff accounts, not a fifth role.
  const staff = (useUsers() ?? []).filter(
    (user) => (user.role === "faculty" || user.role === "admin") && user.status === "active",
  );
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState(false);

  const keepForever = draft.retentionYears === null;
  const next: SchoolSettings = {
    passwordPolicy: { ...draft.passwordPolicy, minLength: Number(minLength) },
    retentionYears: keepForever ? null : Number(retentionYears),
    uploadLimitsMb: Object.fromEntries(
      MATERIAL_KINDS.map((kind) => [kind, Number(uploadLimits[kind])]),
    ) as Record<MaterialKind, number>,
    lateDefault: draft.lateDefault,
    submissionLimitMb: Number(submissionLimit),
    similarityVisibleToStudents: draft.similarityVisibleToStudents,
    gradingScales: draft.gradingScales,
    defaultScaleId: draft.defaultScaleId,
    attendance: {
      ...draft.attendance,
      thresholdPercent: threshold.trim() === "" ? Number.NaN : Number(threshold),
      minSessions: minSessions.trim() === "" ? Number.NaN : Number(minSessions),
      editWindowHours: editWindow.trim() === "" ? Number.NaN : Number(editWindow),
    },
    notifications: draft.notifications,
    messaging: draft.messaging,
  };
  const setAttendance = (changes: Partial<AttendancePolicy>) => {
    setSavedNote(false);
    setDraft((current) => ({ ...current, attendance: { ...current.attendance, ...changes } }));
  };
  const changed = JSON.stringify(next) !== JSON.stringify(saved);

  const setRule = (key: keyof Omit<PasswordPolicy, "minLength">, value: boolean) => {
    setSavedNote(false);
    setDraft((current) => ({ ...current, passwordPolicy: { ...current.passwordPolicy, [key]: value } }));
  };

  const save = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await updateSettings(next);
      // On success the form remounts from the saved value; this note is for when nothing changed.
      setSavedNote(true);
    } catch (error) {
      setProblems(error instanceof SettingsError ? error.problems : ["Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="School-wide policy. Each setting has a default until the school confirms its own."
      />

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Card className="p-5">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Password policy</legend>
            <p className="mt-1 text-sm text-ink-2">
              Applies when a password is set for a local account. Accounts that use the school&apos;s single
              sign-on follow the identity provider&apos;s policy instead.
            </p>

            <div className="mt-4">
              <label htmlFor="settings-min-length" className="mb-1 block text-sm font-medium">
                Minimum length
              </label>
              <input
                id="settings-min-length"
                type="number"
                inputMode="numeric"
                min={MIN_LENGTH_RANGE.min}
                max={MIN_LENGTH_RANGE.max}
                value={minLength}
                onChange={(event) => {
                  setSavedNote(false);
                  setMinLength(event.target.value);
                }}
                aria-describedby="settings-min-length-hint"
                className={cn(fieldClass, "w-28")}
              />
              <p id="settings-min-length-hint" className="mt-1 text-xs text-ink-3">
                Characters, from {MIN_LENGTH_RANGE.min} to {MIN_LENGTH_RANGE.max}.
              </p>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-1.5 text-sm font-medium">A password must contain</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHARACTER_RULES.map((rule) => (
                  <label key={rule.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.passwordPolicy[rule.key]}
                      onChange={(event) => setRule(rule.key, event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    {rule.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 text-xs text-ink-3">
              Administrators always confirm a second step when they sign in. That is not optional.
            </p>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Data retention</legend>
            <p className="mt-1 text-sm text-ink-2">
              How long the data of archived accounts is kept. Deactivated and archived accounts cannot sign in;
              their records stay available to authorized staff until this period ends.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="settings-retention"
                  checked={keepForever}
                  onChange={() => {
                    setSavedNote(false);
                    setDraft((current) => ({ ...current, retentionYears: null }));
                  }}
                  className="size-4 accent-primary"
                />
                Keep indefinitely
              </label>
              <div className="flex flex-wrap items-center gap-2.5 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    name="settings-retention"
                    checked={!keepForever}
                    onChange={() => {
                      setSavedNote(false);
                      setDraft((current) => ({ ...current, retentionYears: Number(retentionYears) }));
                    }}
                    className="size-4 accent-primary"
                  />
                  Delete after
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Years to keep archived accounts"
                  min={RETENTION_YEARS_RANGE.min}
                  max={RETENTION_YEARS_RANGE.max}
                  value={retentionYears}
                  disabled={keepForever}
                  onChange={(event) => {
                    setSavedNote(false);
                    setRetentionYears(event.target.value);
                  }}
                  className={cn(fieldClass, "w-24")}
                />
                <span>years</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-3">
              Deleting data is a server job. Nothing is deleted in this demo, whatever is chosen here.
            </p>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Upload size limits</legend>
            <p className="mt-1 text-sm text-ink-2">
              The largest file the content library accepts for each kind of material. Faculty see these limits
              before they upload.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {MATERIAL_KINDS.map((kind) => (
                <div key={kind}>
                  <label htmlFor={`settings-upload-${kind}`} className="mb-1 block text-sm font-medium">
                    {UPLOAD_FORMATS[kind].label}
                  </label>
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      id={`settings-upload-${kind}`}
                      type="number"
                      inputMode="numeric"
                      min={UPLOAD_LIMIT_RANGE_MB.min}
                      max={UPLOAD_LIMIT_RANGE_MB.max}
                      value={uploadLimits[kind]}
                      onChange={(event) => {
                        setSavedNote(false);
                        setUploadLimits((current) => ({ ...current, [kind]: event.target.value }));
                      }}
                      aria-describedby={`settings-upload-${kind}-hint`}
                      className={cn(fieldClass, "w-28")}
                    />
                    <span>MB</span>
                  </div>
                  <p id={`settings-upload-${kind}-hint`} className="mt-1 text-xs text-ink-3">
                    {UPLOAD_FORMATS[kind].extensions.map((extension) => extension.toUpperCase()).join(", ")}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-3">
              In this demo files are kept in the browser, which has its own storage limit. A server must enforce
              these limits again.
            </p>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Assignments</legend>
            <p className="mt-1 text-sm text-ink-2">
              The late rule a new assignment starts with. Teachers can change it for each assignment, and students
              are shown the rule before they hand in.
            </p>
            <div className="mt-4">
              <LatePolicyFields
                idPrefix="settings-late"
                value={draft.lateDefault}
                onChange={(lateDefault) => {
                  setSavedNote(false);
                  setDraft((current) => ({ ...current, lateDefault }));
                }}
              />
            </div>

            <div className="mt-5">
              <label htmlFor="settings-submission-limit" className="mb-1 block text-sm font-medium">
                Largest file a student may hand in
              </label>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="settings-submission-limit"
                  type="number"
                  inputMode="numeric"
                  min={SUBMISSION_LIMIT_RANGE_MB.min}
                  max={SUBMISSION_LIMIT_RANGE_MB.max}
                  value={submissionLimit}
                  onChange={(event) => {
                    setSavedNote(false);
                    setSubmissionLimit(event.target.value);
                  }}
                  className={cn(fieldClass, "w-28")}
                />
                <span>MB for each file</span>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={draft.similarityVisibleToStudents}
                onChange={(event) => {
                  setSavedNote(false);
                  setDraft((current) => ({ ...current, similarityVisibleToStudents: event.target.checked }));
                }}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Let students see the similarity report for their own work
                <span className="block text-xs text-ink-3">
                  Off: only faculty and administrators see similarity reports.
                </span>
              </span>
            </label>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="min-w-0">
            <legend className="text-lg font-semibold tracking-tight">Grading scales</legend>
            <p className="mt-1 mb-4 text-sm text-ink-2">
              How a course total is reported: as a percentage, a letter or grade points. Teachers choose a scale
              for each course; the grades of each scale are set here.
            </p>
            <GradingScaleFields
              scales={draft.gradingScales}
              defaultScaleId={draft.defaultScaleId}
              onChange={(gradingScales, defaultScaleId) => {
                setSavedNote(false);
                setDraft((current) => ({ ...current, gradingScales, defaultScaleId }));
              }}
            />
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="min-w-0">
            <legend className="text-lg font-semibold tracking-tight">Attendance</legend>
            <p className="mt-1 text-sm text-ink-2">
              When a student&apos;s attendance in a course falls below the threshold, the student, their linked
              parents and the academic coordinator are alerted once. They are not alerted again unless attendance
              recovers and then falls below it again. A change made here applies at once: students the new rule
              puts below the threshold are alerted when it is saved.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-attendance-threshold" className="mb-1 block text-sm font-medium">
                  Attendance threshold
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    id="settings-attendance-threshold"
                    type="number"
                    inputMode="decimal"
                    min={ATTENDANCE_RANGES.thresholdPercent.min}
                    max={ATTENDANCE_RANGES.thresholdPercent.max}
                    value={threshold}
                    onChange={(event) => {
                      setSavedNote(false);
                      setThreshold(event.target.value);
                    }}
                    className={cn(fieldClass, "w-28")}
                  />
                  <span>% of sessions</span>
                </div>
              </div>
              <div>
                <label htmlFor="settings-attendance-min" className="mb-1 block text-sm font-medium">
                  Start checking after
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    id="settings-attendance-min"
                    type="number"
                    inputMode="numeric"
                    min={ATTENDANCE_RANGES.minSessions.min}
                    max={ATTENDANCE_RANGES.minSessions.max}
                    value={minSessions}
                    onChange={(event) => {
                      setSavedNote(false);
                      setMinSessions(event.target.value);
                    }}
                    aria-describedby="settings-attendance-min-hint"
                    className={cn(fieldClass, "w-28")}
                  />
                  <span>recorded sessions</span>
                </div>
                <p id="settings-attendance-min-hint" className="mt-1 text-xs text-ink-3">
                  So one absence in the first week does not set off an alert.
                </p>
              </div>
              <div>
                <label htmlFor="settings-attendance-late" className="mb-1 block text-sm font-medium">
                  Late counts as
                </label>
                <select
                  id="settings-attendance-late"
                  value={draft.attendance.late}
                  onChange={(event) => setAttendance({ late: event.target.value as AttendancePolicy["late"] })}
                  className={cn(fieldClass, "w-full")}
                >
                  <option value="present">Attended</option>
                  <option value="half">Half a session</option>
                  <option value="absent">Missed</option>
                </select>
              </div>
              <div>
                <label htmlFor="settings-attendance-excused" className="mb-1 block text-sm font-medium">
                  Excused counts as
                </label>
                <select
                  id="settings-attendance-excused"
                  value={draft.attendance.excused}
                  onChange={(event) => setAttendance({ excused: event.target.value as AttendancePolicy["excused"] })}
                  className={cn(fieldClass, "w-full")}
                >
                  <option value="excluded">Not counted either way</option>
                  <option value="present">Attended</option>
                  <option value="absent">Missed</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="settings-attendance-window" className="mb-1 block text-sm font-medium">
                Attendance can be corrected for
              </label>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="settings-attendance-window"
                  type="number"
                  inputMode="numeric"
                  min={ATTENDANCE_RANGES.editWindowHours.min}
                  max={ATTENDANCE_RANGES.editWindowHours.max}
                  value={editWindow}
                  onChange={(event) => {
                    setSavedNote(false);
                    setEditWindow(event.target.value);
                  }}
                  aria-describedby="settings-attendance-window-hint"
                  className={cn(fieldClass, "w-28")}
                />
                <span>hours after it is submitted</span>
              </div>
              <p id="settings-attendance-window-hint" className="mt-1 text-xs text-ink-3">
                After that the record is locked. 0 locks it as soon as it is submitted. Every correction is logged.
              </p>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-1.5 text-sm font-medium">Academic coordinators</legend>
              <p className="mb-2 text-xs text-ink-3">
                The staff who receive attendance alerts. With nobody chosen, an alert goes to the teachers of the
                student&apos;s section.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {staff.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.attendance.coordinatorIds.includes(user.id)}
                      onChange={(event) =>
                        setAttendance({
                          coordinatorIds: event.target.checked
                            ? [...draft.attendance.coordinatorIds, user.id]
                            : draft.attendance.coordinatorIds.filter((id) => id !== user.id),
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    <span>
                      {user.name} <span className="text-ink-3">· {user.role === "admin" ? "Admin" : "Faculty"}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="min-w-0">
            <legend className="text-lg font-semibold tracking-tight">Notifications</legend>
            <p className="mt-1 text-sm text-ink-2">
              Everyone chooses email, push and in-app for each kind of notification. The kinds ticked here are
              required: they go out on every channel and nobody can switch them off.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <label key={category} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.notifications.mandatoryCategories.includes(category)}
                    onChange={(event) => {
                      setSavedNote(false);
                      setDraft((current) => ({
                        ...current,
                        notifications: {
                          mandatoryCategories: NOTIFICATION_CATEGORIES.filter((item) =>
                            item === category ? event.target.checked : current.notifications.mandatoryCategories.includes(item),
                          ),
                        },
                      }));
                    }}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    {CATEGORY_LABELS[category].label}
                    <span className="block text-xs text-ink-3">{CATEGORY_LABELS[category].detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="min-w-0">
            <legend className="text-lg font-semibold tracking-tight">Messages</legend>
            <p className="mt-1 text-sm text-ink-2">
              Teachers can always message the students they teach and those students&apos; parents, staff can
              message each other, and an administrator can message anyone. Anyone can answer a message they were
              sent. The rest is the school&apos;s choice.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {MESSAGING_RULES.map((rule) => (
                <label key={rule.key} className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.messaging[rule.key]}
                    onChange={(event) => {
                      setSavedNote(false);
                      setDraft((current) => ({ ...current, messaging: { ...current.messaging, [rule.key]: event.target.checked } }));
                    }}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    {rule.label}
                    <span className="block text-xs text-ink-3">{rule.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        {problems.length > 0 ? (
          <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !changed}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Save settings
          </Button>
          <p role="status" className="text-sm text-ink-2">
            {savedNote ? "Saved." : changed ? "You have unsaved changes." : "Everything is saved."}
          </p>
        </div>
      </form>
    </PageContainer>
  );
}
