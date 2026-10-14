"use client";

import { useState } from "react";
import { Download, LoaderCircle, Send } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Button, ScrollRegion } from "@/components/ui";
import { exportGradesToSis, useSisExportPlan, type SisExportResult } from "@/lib/api/reports";
import { SIS_GRADE_COLUMNS, sisFailureRows, sisGradeRows } from "@/lib/domain/sis-export";
import { downloadCsv } from "@/lib/download";
import { formatDateTime } from "@/lib/utils";

/**
 * US-18: export final grades to the Student Information System. Shows what
 * will go and what cannot, with the reason for each, before anything is sent.
 */
export function SisExportDialog({
  courseIds,
  label,
  fileName,
  onClose,
}: {
  courseIds: string[];
  /** What is being exported, for the title and the audit log: a course or a term. */
  label: string;
  /** Base name for the downloaded files, without an extension. */
  fileName: string;
  onClose: () => void;
}) {
  const preview = useSisExportPlan(courseIds);
  const [result, setResult] = useState<SisExportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const plan = result?.plan ?? preview;

  const run = async () => {
    setBusy(true);
    setFailure("");
    try {
      setResult(await exportGradesToSis(courseIds, label));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog wide title="Export final grades to the SIS" description={label} onClose={onClose}>
      {!plan ? (
        <p className="text-sm text-ink-2">Only an administrator can export grades to the SIS.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Always rendered, so the outcome is announced when the export finishes (NFR-5). */}
          <div role="status">
            {result ? (
              <p className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">
                {result.plan.ready.length} {result.plan.ready.length === 1 ? "grade was" : "grades were"} sent to{" "}
                {result.system} on {formatDateTime(result.exportedAt)}. The export is in the audit log.
              </p>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-line p-3">
              <dt className="text-ink-2">{result ? "Sent" : "Ready to send"}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{plan.ready.length}</dd>
            </div>
            <div className="rounded-lg border border-line p-3">
              <dt className="text-ink-2">{result ? "Failed" : "Cannot be sent"}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{plan.failed.length}</dd>
            </div>
          </dl>

          {plan.failed.length > 0 ? (
            <section aria-labelledby="sis-failed-heading">
              <h3 id="sis-failed-heading" className="text-sm font-semibold">
                Failed records
              </h3>
              <p className="mt-0.5 text-sm text-ink-2">
                Put these right, then export again. The records that are ready are not held up by them.
              </p>
              <ScrollRegion label="Failed records" className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th scope="col" className="px-3 py-2 font-medium">Student</th>
                      <th scope="col" className="px-3 py-2 font-medium">Section</th>
                      <th scope="col" className="px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.failed.map((record) => (
                      <tr key={record.key} className="border-t border-line align-top">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          {record.studentName}
                          <span className="block text-xs font-normal text-ink-3">{record.studentSisId || "No SIS ID"}</span>
                        </th>
                        <td className="px-3 py-2 whitespace-nowrap text-ink-2">{record.sectionCode || record.courseCode}</td>
                        <td className="px-3 py-2">{record.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            </section>
          ) : (
            <p className="text-sm text-ink-2">Every record is complete.</p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">File format</summary>
            <p className="mt-1 text-ink-2">
              A CSV file with one row for each student and course, and these columns:{" "}
              <span className="font-mono text-xs break-words">{SIS_GRADE_COLUMNS.join(", ")}</span>. The format is a
              placeholder until the school&apos;s SIS is chosen.
            </p>
          </details>

          {failure ? (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {failure}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge>Demo: nothing leaves this browser</Badge>
            <div className="flex flex-wrap justify-end gap-2">
              {plan.failed.length > 0 ? (
                <Button variant="secondary" onClick={() => downloadCsv(`${fileName}-failed.csv`, sisFailureRows(plan.failed))}>
                  <Download aria-hidden className="size-4" />
                  Failed records
                </Button>
              ) : null}
              {result ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={result.plan.ready.length === 0}
                    onClick={() => downloadCsv(`${fileName}-sis.csv`, sisGradeRows(result.plan.ready))}
                  >
                    <Download aria-hidden className="size-4" />
                    SIS file
                  </Button>
                  <Button onClick={onClose}>Done</Button>
                </>
              ) : (
                <Button disabled={busy || plan.ready.length === 0} onClick={() => void run()}>
                  {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                  {busy ? "Sending" : `Export ${plan.ready.length} ${plan.ready.length === 1 ? "grade" : "grades"}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
