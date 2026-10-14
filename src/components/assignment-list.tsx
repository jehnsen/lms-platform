"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { LateBadge, STATE_BADGES } from "@/components/assignment-parts";
import { Badge, ButtonLink, Card, PageContainer, PageHeader, SectionTitle, fieldClass } from "@/components/ui";
import { useAssignments, type AssignmentRow } from "@/lib/api/assignments";
import { useActor } from "@/lib/api/session";
import { submissionState } from "@/lib/domain/assignments";
import { can } from "@/lib/domain/permissions";
import { useNow } from "@/lib/use-now";
import { formatDateTime } from "@/lib/utils";

/** `/assignments`: what a student has to do and has handed in, or what staff have set and how each class stands. */
export function AssignmentList() {
  const actor = useActor();
  const rows = useAssignments();
  const now = useNow();
  const [courseId, setCourseId] = useState("all");
  if (!actor) return null;

  const student = actor.role === "student";
  const canCreate = actor.courseIds.some((id) => can(actor, "create", { type: "assignment", courseId: id }));
  const courses = [...new Map(rows.map((row) => [row.assignment.courseId, row.courseTitle])).entries()];
  const shown = rows.filter((row) => courseId === "all" || row.assignment.courseId === courseId);

  const groups: Array<{ title: string; rows: AssignmentRow[]; empty?: string }> = student
    ? [
        { title: "To do", rows: shown.filter((row) => !row.mine), empty: "Nothing to hand in. You are up to date." },
        { title: "Handed in", rows: shown.filter((row) => row.mine) },
      ]
    : [
        { title: "Published", rows: shown.filter((row) => row.assignment.status === "published"), empty: "No assignments are published yet." },
        { title: "Drafts", rows: shown.filter((row) => row.assignment.status === "draft") },
      ];

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Assignments"
        description={
          student
            ? "Work your teachers have set, with when it is due and what you have handed in."
            : "Assignments in your courses, with how many have been handed in and marked."
        }
        actions={
          <>
            {courses.length > 1 ? (
              <>
                <label htmlFor="assignments-course" className="sr-only">
                  Course
                </label>
                <select id="assignments-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className={fieldClass}>
                  <option value="all">All courses</option>
                  {courses.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {canCreate ? (
              <ButtonLink href="/assignments/new">
                <Plus aria-hidden className="size-4" />
                New assignment
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-8">
        {groups.map((group) =>
          group.rows.length === 0 && !group.empty ? null : (
            <section key={group.title}>
              <SectionTitle>{group.title}</SectionTitle>
              <Card>
                {group.rows.length === 0 ? (
                  <p className="p-4 text-sm text-ink-2">{group.empty}</p>
                ) : (
                  <ul>
                    {group.rows.map((row) => (
                      <li key={row.assignment.id} className="border-t border-line first:border-t-0">
                        <AssignmentLink row={row} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          ),
        )}
      </div>
    </PageContainer>
  );
}

function AssignmentLink({ row, now }: { row: AssignmentRow; now: number }) {
  const { assignment, counts, mine } = row;
  const overdue = now > Date.parse(assignment.dueAt);
  const state = submissionState(mine);
  return (
    <Link href={`/assignments/${assignment.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-2">
      <div className="min-w-0 flex-1 basis-64">
        <div className="font-medium">{assignment.title}</div>
        <div className="mt-0.5 text-sm text-ink-3">
          {row.courseTitle} · due {formatDateTime(assignment.dueAt)} · {assignment.points} points
        </div>
      </div>

      {counts ? (
        assignment.status === "draft" ? (
          <Badge>Draft · not visible to students</Badge>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
            <Badge>
              {counts.submitted}/{counts.expected} handed in
            </Badge>
            <Badge tone={counts.graded < counts.submitted ? "warn" : "neutral"}>{counts.graded} marked</Badge>
            {counts.unreleased > 0 ? <Badge tone="warn">{counts.unreleased} to release</Badge> : null}
          </span>
        )
      ) : (
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {mine ? (
            <>
              <LateBadge late={mine.late} />
              {mine.grade ? (
                <Badge tone="good">
                  {mine.grade.points}/{assignment.points}
                </Badge>
              ) : (
                <Badge tone={STATE_BADGES[state].tone}>{STATE_BADGES[state].label}</Badge>
              )}
            </>
          ) : overdue ? (
            <Badge tone={assignment.late.rule === "block" ? "bad" : "warn"}>
              {assignment.late.rule === "block" ? "Closed" : "Overdue"}
            </Badge>
          ) : (
            <Badge>To do</Badge>
          )}
        </span>
      )}

      <span className="flex items-center gap-1 text-sm font-medium text-primary-ink">
        Open
        <ArrowRight aria-hidden className="size-4" />
      </span>
    </Link>
  );
}
