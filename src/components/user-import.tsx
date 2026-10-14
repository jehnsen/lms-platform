"use client";

import { useRef, useState } from "react";
import { Download, FileDown, LoaderCircle, Upload } from "lucide-react";
import { Badge, Button, Card, buttonClass } from "@/components/ui";
import { commitUserImport, previewUserImport, userImportTemplate } from "@/lib/api/users";
import { countImport, importReport, type ImportPlan } from "@/lib/domain/user-import";
import { downloadCsv } from "@/lib/download";

/**
 * The outcome of an import, before or after it is saved: the counts, then one
 * line per row that will not create (or did not create) an account, with the
 * reason, including people who already have an account and are being added to
 * sections (FR-1.5, Q-25).
 */
export function ImportReport({
  plan,
  saved,
  rowLabel = "Row",
}: {
  plan: ImportPlan;
  /** False while this is still a preview. */
  saved: boolean;
  rowLabel?: string;
}) {
  const counts = countImport(plan);
  const skipped = plan.rows.filter((row) => row.status !== "ready");

  return (
    <div className="flex flex-col gap-3">
      {plan.problems.length > 0 ? (
        <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {plan.problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      ) : (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="good">
            {counts.ready} {saved ? "created" : "ready to create"}
          </Badge>
          <Badge tone={counts.update > 0 ? "primary" : "neutral"}>
            {counts.update} existing {counts.update === 1 ? "account" : "accounts"}{" "}
            {saved ? "added to sections" : "to add to sections"}
          </Badge>
          <Badge tone={counts.duplicate > 0 ? "warn" : "neutral"}>
            {counts.duplicate} {counts.duplicate === 1 ? "duplicate" : "duplicates"} skipped
          </Badge>
          <Badge tone={counts.error > 0 ? "bad" : "neutral"}>
            {counts.error} with errors
          </Badge>
        </p>
      )}

      {plan.ignoredColumns.length > 0 ? (
        <p className="text-sm text-ink-2">
          {plan.ignoredColumns.length === 1 ? "This column is" : "These columns are"} not used and{" "}
          {plan.ignoredColumns.length === 1 ? "was" : "were"} ignored: {plan.ignoredColumns.join(", ")}.
        </p>
      ) : null}

      {skipped.length > 0 ? (
        <div className="relative overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">
              {saved ? "Rows that did not create an account" : "Rows that will not create an account"}
            </caption>
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-3 py-2 font-medium">{rowLabel}</th>
                <th scope="col" className="px-3 py-2 font-medium">Person</th>
                <th scope="col" className="px-3 py-2 font-medium">Result</th>
                <th scope="col" className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {skipped.map((row) => (
                <tr key={row.row} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-2 text-left font-medium tabular-nums">{row.row}</th>
                  <td className="px-3 py-2">
                    <div>{row.name || "—"}</div>
                    <div className="text-xs break-all text-ink-3">{row.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={row.status === "update" ? "primary" : row.status === "duplicate" ? "warn" : "bad"}>
                      {row.status === "update" ? "Existing account" : row.status === "duplicate" ? "Duplicate" : "Error"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    <ul className="flex flex-col gap-0.5">
                      {(row.note ? [row.note] : row.problems).map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function downloadImportReport(plan: ImportPlan, filename: string) {
  downloadCsv(filename, importReport(plan));
}

type Stage = "choose" | "preview" | "done";

/**
 * US-01: bulk onboarding from a CSV file. The file is checked first and
 * nothing is saved until the admin confirms; rows with errors are reported and
 * the valid rows are still created.
 */
export function UserImportPanel({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    void run(async () => {
      setFile(chosen);
      setPlan(await previewUserImport(chosen));
      setStage("preview");
    });
  };

  const confirm = () => {
    if (!file) return;
    void run(async () => {
      setPlan(await commitUserImport(file));
      setStage("done");
    });
  };

  const startOver = () => {
    setFile(null);
    setPlan(null);
    setStage("choose");
    setFailure(null);
    if (input.current) input.current.value = "";
  };

  // Rows that do something: new accounts, and existing accounts being added to sections.
  const ready = plan ? countImport(plan).ready + countImport(plan).update : 0;
  const blocked = !plan || plan.problems.length > 0 || ready === 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Import users from a CSV file</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            One row per person: name, email and role are required. Put section codes in{" "}
            <code className="font-mono text-xs">sections</code> and, for parents, their children&apos;s emails in{" "}
            <code className="font-mono text-xs">children</code>, separated by semicolons. A person who already
            has an account is not created again: if their row lists sections they are added to them, and nothing
            else about their account changes.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* The visible control is the label, so the real file input stays keyboard-reachable. */}
        <label
          className={buttonClass(
            { variant: stage === "choose" ? "primary" : "secondary" },
            "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
          )}
        >
          {busy && stage === "choose" ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden className="size-4" />
          )}
          {stage === "choose" ? "Choose a CSV file" : "Choose another file"}
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              // Checking a new file starts a new preview.
              setStage("choose");
              choose(event.target.files?.[0]);
            }}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => downloadCsv("user-import-template.csv", userImportTemplate())}
        >
          <FileDown aria-hidden className="size-4" />
          Download template
        </Button>
      </div>

      {failure ? (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {failure}
        </p>
      ) : null}

      {plan && stage !== "choose" ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-semibold">
            {stage === "done" ? "Import finished" : "Check before importing"}
            {file ? <span className="font-normal text-ink-3"> · {file.name}</span> : null}
          </h3>
          <ImportReport plan={plan} saved={stage === "done"} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {stage === "preview" ? (
              <>
                <Button onClick={confirm} disabled={busy || blocked}>
                  {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
                  {blocked ? "Nothing to import" : `Import ${ready} ${ready === 1 ? "row" : "rows"}`}
                </Button>
                <Button variant="ghost" onClick={startOver} disabled={busy}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {plan.rows.length > 0 ? (
                  <Button variant="secondary" onClick={() => downloadImportReport(plan, "user-import-report.csv")}>
                    <Download aria-hidden className="size-4" />
                    Download report
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={startOver}>
                  Import another file
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
