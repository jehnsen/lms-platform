"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, CircleCheck, LoaderCircle, Paperclip, Pencil, Send, Trash2, Upload } from "lucide-react";
import { AnnotatedText } from "@/components/annotated-text";
import { AssignmentFacts, FileList, LateBadge, STATE_BADGES, lateText } from "@/components/assignment-parts";
import { ForbiddenView } from "@/components/forbidden-view";
import { NotFoundView } from "@/components/not-found-view";
import { RubricView } from "@/components/rubric";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageContainer,
  PageSkeleton,
  SectionTitle,
  StatTile,
  buttonClass,
  fieldBaseClass,
} from "@/components/ui";
import {
  AssignmentError,
  downloadAttachment,
  downloadSubmissionFile,
  releaseGrades,
  submitAssignment,
  useAssignment,
  useCanSeeSimilarity,
  useMySubmissions,
  useSubmissionRoster,
} from "@/lib/api/assignments";
import { useCourseReadOnly } from "@/lib/api/courses";
import { useSettings } from "@/lib/api/settings";
import {
  MAX_SUBMISSION_FILES,
  SUBMISSION_EXTENSIONS,
  submissionFileProblem,
  submissionState,
  submitDecision,
} from "@/lib/domain/assignments";
import type { Assignment, Submission } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";

function messagesOf(error: unknown) {
  if (error instanceof AssignmentError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** `/assignments/[assignmentId]`: the student's page to hand in and read feedback, or the staff page for the class. */
export function AssignmentDetail({ assignmentId }: { assignmentId: string }) {
  const access = useAssignment(assignmentId);
  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView message="This assignment doesn't exist, or it isn't set for you." />;
  if (access.status === "forbidden") return <ForbiddenView resource={`assignment:${assignmentId}`} what="this assignment" />;
  const { assignment, course, sections, staff, canEdit } = access;

  return (
    <PageContainer className="max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/assignments" className="hover:text-ink">
          Assignments
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">{assignment.title || "Untitled assignment"}</span>
      </nav>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
              {course ? (
                <Link href={`/courses/${course.id}`} className="hover:text-ink hover:underline">
                  {course.title}
                </Link>
              ) : null}
              {assignment.status === "draft" ? <Badge tone="warn">Draft · students cannot see it</Badge> : null}
            </div>
            <h1 className="mt-1 text-3xl leading-tight font-semibold tracking-tight text-balance">
              {assignment.title || "Untitled assignment"}
            </h1>
          </div>
          {canEdit ? (
            <ButtonLink href={`/assignments/${assignment.id}/edit`} variant="secondary">
              <Pencil aria-hidden className="size-4" />
              {assignment.status === "draft" ? "Edit and publish" : "Edit"}
            </ButtonLink>
          ) : null}
        </div>

        <div className="mt-5">
          <AssignmentFacts assignment={assignment} sections={sections} />
        </div>

        {assignment.instructions ? (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="text-sm font-semibold">Instructions</h2>
            <p className="mt-2 max-w-[70ch] leading-relaxed whitespace-pre-wrap text-pretty">{assignment.instructions}</p>
          </div>
        ) : null}

        {assignment.attachments.length > 0 ? (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="mb-2 text-sm font-semibold">Attachments</h2>
            <FileList
              label="Attachments"
              files={assignment.attachments}
              onDownload={(fileId) => downloadAttachment(assignment.id, fileId)}
            />
          </div>
        ) : null}

        {assignment.rubric ? (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="mb-3 text-sm font-semibold">How it will be marked</h2>
            <RubricView rubric={assignment.rubric} idPrefix="rubric-view" />
          </div>
        ) : null}
      </Card>

      {staff ? (
        <StaffSection assignment={assignment} canEdit={canEdit} />
      ) : (
        <StudentSection assignment={assignment} />
      )}
    </PageContainer>
  );
}

// --- Student: hand in, receipt, feedback (US-11, US-15) --------------------------

function StudentSection({ assignment }: { assignment: Assignment }) {
  const attempts = useMySubmissions(assignment.id);
  const archived = useCourseReadOnly(assignment.courseId);
  const { submissionLimitMb, similarityVisibleToStudents } = useSettings();
  const now = useNow();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<Submission | null>(null);

  const latest = attempts[attempts.length - 1];
  const decision = submitDecision(assignment, attempts.length, new Date(now || Date.parse(assignment.dueAt)).toISOString());
  const acceptsText = assignment.accepts.includes("text");
  const acceptsFiles = assignment.accepts.includes("file");

  const addFiles = (chosen: File[]) => {
    const found = chosen.flatMap((file) => submissionFileProblem(file, submissionLimitMb) ?? []);
    const good = chosen.filter((file) => submissionFileProblem(file, submissionLimitMb) === undefined);
    const next = [...files, ...good];
    if (next.length > MAX_SUBMISSION_FILES) found.push(`Attach at most ${MAX_SUBMISSION_FILES} files.`);
    setFiles(next.slice(0, MAX_SUBMISSION_FILES));
    setProblems(found);
  };

  const handIn = async () => {
    setBusy(true);
    setProblems([]);
    try {
      setReceipt(await submitAssignment(assignment.id, { text, files }));
      setText("");
      setFiles([]);
    } catch (error) {
      setProblems(messagesOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="mt-8">
        <SectionTitle>{attempts.length === 0 ? "Hand in your work" : "Hand in again"}</SectionTitle>
        <Card className="p-5">
          {/* FR-3.3: the timestamped confirmation. Always rendered, so it is announced when it appears. */}
          <div role="status">
            {receipt ? (
              <div className="mb-5 flex items-start gap-3 rounded-lg bg-good-soft p-4 text-sm text-good">
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Handed in on {formatDateTime(receipt.submittedAt)}.</p>
                  <p className="mt-0.5">
                    Receipt <span className="font-mono">{receipt.receipt}</span> · attempt {receipt.attempt}
                    {receipt.late ? ` · ${lateText(receipt.late)}` : " · on time"}. Keep the receipt as proof of submission.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {archived ? (
            <p className="text-sm text-ink-2">This course is archived, so nothing more can be handed in.</p>
          ) : !decision.allowed ? (
            <p className="text-sm text-ink-2">{decision.reason}</p>
          ) : (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handIn();
              }}
            >
              {/* US-11: the late rule that will be applied is shown before handing in. */}
              {decision.outcome.daysLate > 0 ? (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                  The due time has passed. If you hand in now, your work will be marked{" "}
                  {lateText({ daysLate: decision.outcome.daysLate, penaltyPercent: decision.outcome.penaltyPercent })}.
                </p>
              ) : null}

              {acceptsText ? (
                <div>
                  <label htmlFor="submit-text" className="mb-1 block text-sm font-medium">
                    Your answer
                  </label>
                  <textarea
                    id="submit-text"
                    rows={8}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className={cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed")}
                  />
                </div>
              ) : null}

              {acceptsFiles ? (
                <div>
                  <p className="mb-1 text-sm font-medium">Files</p>
                  {files.length > 0 ? (
                    <ul className="mb-2 flex flex-col gap-1.5">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
                          <Paperclip aria-hidden className="size-4 shrink-0 text-ink-3" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="shrink-0 text-xs text-ink-3">{formatBytes(file.size)}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, position) => position !== index))}
                            aria-label={`Remove ${file.name}`}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-bad"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <label className={buttonClass({ variant: "secondary", size: "sm" }, "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary")}>
                    <Upload aria-hidden className="size-4" />
                    Add files
                    <input
                      type="file"
                      multiple
                      accept={SUBMISSION_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
                      aria-describedby="submit-files-hint"
                      className="sr-only"
                      onChange={(event) => {
                        addFiles(Array.from(event.target.files ?? []));
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <p id="submit-files-hint" className="mt-1 text-xs text-ink-3">
                    Up to {MAX_SUBMISSION_FILES} files, {submissionLimitMb} MB each:{" "}
                    {SUBMISSION_EXTENSIONS.map((extension) => extension.toUpperCase()).join(", ")}.
                  </p>
                </div>
              ) : null}

              <div role="alert" className={problems.length > 0 ? "rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad" : undefined}>
                {problems.map((problem) => (
                  <p key={problem}>{problem}</p>
                ))}
              </div>

              <div>
                <Button type="submit" disabled={busy}>
                  {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
                  {attempts.length === 0 ? "Hand in" : "Hand in again"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </section>

      {latest ? (
        <section className="mt-8">
          <SectionTitle>Your work</SectionTitle>
          <div className="flex flex-col gap-4">
            {[...attempts].reverse().map((attempt) => (
              <StudentAttempt
                key={attempt.id}
                assignment={assignment}
                attempt={attempt}
                current={attempt.id === latest.id}
                showSimilarity={similarityVisibleToStudents}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function StudentAttempt({
  assignment,
  attempt,
  current,
  showSimilarity,
}: {
  assignment: Assignment;
  attempt: Submission;
  current: boolean;
  showSimilarity: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const grade = attempt.grade;
  const textNotes = attempt.comments.flatMap((comment, index) =>
    comment.anchor.kind === "text"
      ? [{ id: comment.id, number: index + 1, start: comment.anchor.start, end: comment.anchor.end }]
      : [],
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Attempt {attempt.attempt}</span>
        {current ? <Badge tone="primary">Current</Badge> : <Badge>Replaced</Badge>}
        <LateBadge late={attempt.late} />
        <span className="text-ink-3">
          Handed in {formatDateTime(attempt.submittedAt)} · receipt <span className="font-mono">{attempt.receipt}</span>
        </span>
      </div>

      {grade ? (
        <div className="mt-4 rounded-lg bg-surface-2 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {grade.points}
              <span className="text-lg font-medium text-ink-3"> / {assignment.points}</span>
            </span>
            {attempt.late && attempt.late.penaltyPercent > 0 ? (
              <span className="text-sm text-ink-2">
                {grade.rawPoints} before the {attempt.late.penaltyPercent}% late deduction
              </span>
            ) : null}
          </div>
          {grade.feedback ? <p className="mt-2 max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap">{grade.feedback}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          {current ? "No grade has been released for this yet. You will be notified when it is." : "This version was not marked."}
        </p>
      )}

      {grade?.rubricLevels && assignment.rubric ? (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Rubric</h3>
          <RubricView rubric={assignment.rubric} idPrefix={`graded-${attempt.id}`} chosen={grade.rubricLevels} />
        </div>
      ) : null}

      {attempt.text ? (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold">Your answer</h3>
          <AnnotatedText text={attempt.text} notes={textNotes} activeId={activeId} onPick={setActiveId} />
        </div>
      ) : null}

      {attempt.files.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold">Your files</h3>
          <FileList label="Your files" files={attempt.files} onDownload={(fileId) => downloadSubmissionFile(attempt.id, fileId)} />
        </div>
      ) : null}

      {attempt.comments.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold">Comments from your teacher</h3>
          <ol className="flex flex-col gap-2">
            {attempt.comments.map((comment, index) => (
              <li
                key={comment.id}
                className={cn("rounded-lg border p-3 text-sm", activeId === comment.id ? "border-primary bg-primary-soft" : "border-line")}
              >
                <div className="flex items-start gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-semibold text-bg">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-ink-2">
                      {comment.anchor.kind === "text"
                        ? `On “${comment.anchor.quote}”`
                        : `On ${attempt.files.find((file) => comment.anchor.kind === "file" && file.id === comment.anchor.fileId)?.name ?? "a file"}${comment.anchor.page ? `, page ${comment.anchor.page}` : ""}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {showSimilarity && attempt.similarity ? (
        <p className="mt-4 border-t border-line pt-4 text-sm text-ink-2">
          Similarity check: {attempt.similarity.percent}% of this work matches other sources.
        </p>
      ) : null}
    </Card>
  );
}

// --- Staff: the class (US-10, US-14, US-15) --------------------------------------

function StaffSection({ assignment, canEdit }: { assignment: Assignment; canEdit: boolean }) {
  const roster = useSubmissionRoster(assignment.id) ?? [];
  const seesSimilarity = useCanSeeSimilarity(assignment.courseId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const handedIn = roster.filter((row) => row.latest);
  const marked = handedIn.filter((row) => row.latest?.grade);
  const toRelease = marked.filter((row) => !row.latest?.grade?.releasedAt);
  const late = handedIn.filter((row) => row.latest?.late);

  const release = async () => {
    setBusy(true);
    try {
      const count = await releaseGrades(assignment.id);
      setNote(`${count} ${count === 1 ? "grade" : "grades"} released. Those students have been notified.`);
    } catch (error) {
      setNote(messagesOf(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  if (assignment.status === "draft") {
    return (
      <p className="mt-8 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
        This is a draft. Students cannot see it or hand anything in until it is published.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <SectionTitle
        action={
          canEdit ? (
            <Button onClick={() => void release()} disabled={busy || toRelease.length === 0}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              {toRelease.length === 0 ? "No grades to release" : `Release ${toRelease.length} ${toRelease.length === 1 ? "grade" : "grades"}`}
            </Button>
          ) : undefined
        }
      >
        Submissions
      </SectionTitle>

      <p role="status" className={note ? "mb-3 text-sm text-ink-2" : undefined}>
        {note}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Handed in" value={`${handedIn.length}/${roster.length}`} hint={`${late.length} late`} />
        <StatTile label="Marked" value={`${marked.length}/${handedIn.length}`} />
        <StatTile label="Waiting to be released" value={toRelease.length} hint="Students cannot see these yet" />
        <StatTile label="Not handed in" value={roster.length - handedIn.length} />
      </div>

      <Card className="overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">Students this assignment is set for, with their submissions</caption>
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Section</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Handed in</th>
                {seesSimilarity ? <th scope="col" className="px-3 py-2.5 text-right font-medium">Similarity</th> : null}
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Mark</th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map(({ student, section, latest, attempts }) => {
                const state = submissionState(latest);
                return (
                  <tr key={student.id} className="border-t border-line">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{student.name}</th>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{section?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={STATE_BADGES[state].tone}>{STATE_BADGES[state].label}</Badge>
                        <LateBadge late={latest?.late} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2 tabular-nums">
                      {latest ? formatDateTime(latest.submittedAt) : "—"}
                      {attempts > 1 ? <span className="text-ink-3"> · attempt {attempts}</span> : null}
                    </td>
                    {seesSimilarity ? (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {latest?.similarity ? (
                          <span className={latest.similarity.percent >= 40 ? "font-semibold text-bad" : undefined}>
                            {latest.similarity.percent}%
                            {latest.similarity.percent >= 40 ? <span className="sr-only"> (high)</span> : null}
                          </span>
                        ) : (
                          <span className="text-ink-3">{latest ? "Pending" : "—"}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {latest?.grade ? `${latest.grade.points}/${assignment.points}` : <span className="font-normal text-ink-3">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {latest ? (
                        <ButtonLink href={`/assignments/${assignment.id}/submissions/${student.id}`} variant="ghost" size="sm">
                          {canEdit ? (latest.grade ? "Review" : "Mark") : "View"}
                          <span className="sr-only"> {student.name}&apos;s work</span>
                        </ButtonLink>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {roster.length === 0 ? (
                <tr className="border-t border-line">
                  <td colSpan={seesSimilarity ? 7 : 6} className="px-4 py-8 text-center text-ink-2">
                    No students are enrolled in the sections this assignment is set for.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
