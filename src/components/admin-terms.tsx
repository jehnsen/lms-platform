"use client";

import { useLayoutEffect, useState } from "react";
import { Archive, ArchiveRestore, LoaderCircle, Send } from "lucide-react";
import { SisExportDialog } from "@/components/sis-export-dialog";
import { Badge, Button, Card, PageContainer, PageHeader } from "@/components/ui";
import { archiveTerm, reopenTerm, useTermSummaries, type TermSummary } from "@/lib/api/courses";
import type { Term } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const STATUS_BADGES: Record<Term["status"], { label: string; tone: "good" | "neutral" | "primary" }> = {
  active: { label: "Active", tone: "good" },
  upcoming: { label: "Upcoming", tone: "primary" },
  archived: { label: "Archived", tone: "neutral" },
};

/**
 * Admin terms page (US-04, FR-1.8): archive a term at its end. Its courses
 * become read-only for everyone and their grades stay viewable.
 */
export function AdminTerms() {
  const summaries = useTermSummaries();
  if (!summaries) return null;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Terms"
        description="Archive a term when it ends. Its courses become read-only for every role; grades can still be viewed and exported."
      />
      <ul className="flex flex-col gap-4">
        {summaries.map((summary) => (
          <li key={summary.term.id}>
            <TermCard summary={summary} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-ink-3">
        In this demo an administrator starts the archive. With a backend it also runs automatically on the
        term&apos;s end date. To archive the accounts of people who have left, use the Users page.
      </p>
    </PageContainer>
  );
}

function TermCard({ summary }: { summary: TermSummary }) {
  const { term, courses, sectionCount, studentCount, dueForArchive } = summary;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const badge = STATUS_BADGES[term.status];

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setExporting(false);
  }, []);
  const courseText = `${courses.length} ${courses.length === 1 ? "course" : "courses"}`;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      setConfirming(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{term.name}</h2>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {dueForArchive ? <Badge tone="warn">Ended · ready to archive</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {formatDate(term.startsOn, true)} to {formatDate(term.endsOn, true)} · {courseText} ·{" "}
            {sectionCount} {sectionCount === 1 ? "section" : "sections"} · {studentCount}{" "}
            {studentCount === 1 ? "student" : "students"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* US-18: final grades for every course of the term, in one export. */}
          {courses.length > 0 && term.status !== "upcoming" ? (
            <Button variant="secondary" onClick={() => setExporting(true)}>
              <Send aria-hidden className="size-4" />
              Export grades to SIS
            </Button>
          ) : null}
          {term.status === "active" && !confirming ? (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              <Archive aria-hidden className="size-4" />
              Archive term
            </Button>
          ) : null}
          {term.status === "archived" && !confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              <ArchiveRestore aria-hidden className="size-4" />
              Reopen term
            </Button>
          ) : null}
        </div>
      </div>

      {courses.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {courses.map((course) => (
            <li key={course.id}>
              <Badge>
                {course.code} · {course.title}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {confirming ? (
        // Focus moves to Cancel, so a screen reader reads the group's name and this explanation.
        <div
          role="group"
          aria-label={term.status === "archived" ? `Reopen ${term.name}?` : `Archive ${term.name}?`}
          aria-describedby={`${term.id}-confirm`}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-4 text-sm text-warn"
        >
          <p id={`${term.id}-confirm`} className="max-w-xl">
            {term.status === "archived"
              ? `Reopening makes the ${courseText} in ${term.name} editable again.`
              : `Archiving makes the ${courseText} in ${term.name} read-only for students, faculty and admins. ` +
                (dueForArchive ? "" : `The term does not end until ${formatDate(term.endsOn, true)}. `) +
                "Grades stay viewable."}
          </p>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" autoFocus disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void run(() => (term.status === "archived" ? reopenTerm(term.id) : archiveTerm(term.id)))}
            >
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              {term.status === "archived" ? "Yes, reopen" : "Yes, archive"}
            </Button>
          </span>
        </div>
      ) : null}

      {failure ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {failure}
        </p>
      ) : null}

      {exporting ? (
        <SisExportDialog
          courseIds={courses.map((course) => course.id)}
          label={`${term.name} · ${courseText}`}
          fileName={`${term.id}-final-grades`}
          onClose={() => setExporting(false)}
        />
      ) : null}
    </Card>
  );
}
