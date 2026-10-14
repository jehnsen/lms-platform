"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, Card, PageContainer, PageHeader, fieldClass } from "@/components/ui";
import { SettingsError, updateSettings, useSettings } from "@/lib/api/settings";
import { MIN_LENGTH_RANGE } from "@/lib/domain/password-policy";
import { RETENTION_YEARS_RANGE } from "@/lib/domain/settings";
import type { PasswordPolicy, SchoolSettings } from "@/lib/types";
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
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState(false);

  const keepForever = draft.retentionYears === null;
  const next: SchoolSettings = {
    passwordPolicy: { ...draft.passwordPolicy, minLength: Number(minLength) },
    retentionYears: keepForever ? null : Number(retentionYears),
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
