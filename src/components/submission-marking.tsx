"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Download, Eye, LoaderCircle, MessageSquarePlus, RefreshCw, Trash2 } from "lucide-react";
import { AnnotatedText } from "@/components/annotated-text";
import { LateBadge, STATE_BADGES } from "@/components/assignment-parts";
import { ForbiddenView } from "@/components/forbidden-view";
import { NotFoundView } from "@/components/not-found-view";
import { RubricView } from "@/components/rubric";
import { Badge, Button, ButtonLink, Card, PageContainer, PageSkeleton, fieldBaseClass, fieldClass } from "@/components/ui";
import {
  AssignmentError,
  addInlineComment,
  downloadSubmissionFile,
  removeInlineComment,
  runSimilarityCheck,
  saveGrade,
  useAssignment,
  useCanSeeSimilarity,
  useStudentWork,
  useSubmissionFile,
} from "@/lib/api/assignments";
import { applyPenalty, rubricScore, submissionState } from "@/lib/domain/assignments";
import type { Assignment, CommentAnchor, Submission } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

function messagesOf(error: unknown) {
  if (error instanceof AssignmentError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** What a new comment will be anchored to. */
type Target = { kind: "text"; start: number; end: number } | { kind: "file"; fileId: string };

/**
 * `/assignments/[assignmentId]/submissions/[studentId]`: one student's work,
 * with inline comments anchored to parts of it, rubric scoring that totals
 * itself, and overall feedback (US-15). Nothing here reaches the student until
 * the grade is released from the assignment page.
 */
export function SubmissionMarking({ assignmentId, studentId }: { assignmentId: string; studentId: string }) {
  const access = useAssignment(assignmentId);
  const work = useStudentWork(assignmentId, studentId);
  const [chosenAttemptId, setChosenAttemptId] = useState<string | null>(null);

  if (access.status === "loading" || work.status === "loading") return <PageSkeleton />;
  if (access.status === "missing" || work.status === "missing") {
    return <NotFoundView message="This assignment or student couldn't be found, or the assignment isn't set for this student." />;
  }
  if (access.status === "forbidden" || !access.staff || work.status === "forbidden") {
    return <ForbiddenView resource={`submission:${assignmentId}:${studentId}`} what="this student's work" />;
  }

  const { assignment, canEdit } = access;
  const { student, section, attempts, previousId, nextId } = work;
  const latest = attempts[attempts.length - 1];
  const attempt = attempts.find((candidate) => candidate.id === chosenAttemptId) ?? latest;
  const state = submissionState(latest);

  return (
    <PageContainer className="max-w-[86rem]">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/assignments" className="hover:text-ink">
          Assignments
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link href={`/assignments/${assignment.id}`} className="hover:text-ink">
          {assignment.title}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">{student.name}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">{student.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {section?.name ?? "No section"}
            <Badge tone={STATE_BADGES[state].tone}>{STATE_BADGES[state].label}</Badge>
            <LateBadge late={latest?.late} />
          </p>
        </div>
        <div className="flex gap-2">
          {previousId ? (
            <ButtonLink href={`/assignments/${assignment.id}/submissions/${previousId}`} variant="secondary" size="sm">
              <ArrowLeft aria-hidden className="size-4" />
              Previous student
            </ButtonLink>
          ) : null}
          {nextId ? (
            <ButtonLink href={`/assignments/${assignment.id}/submissions/${nextId}`} variant="secondary" size="sm">
              Next student
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {!attempt ? (
        <Card className="p-6 text-sm text-ink-2">{student.name} has not handed anything in for this assignment.</Card>
      ) : (
        <>
          {attempts.length > 1 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="marking-attempt" className="text-ink-2">
                Showing
              </label>
              <select id="marking-attempt" value={attempt.id} onChange={(event) => setChosenAttemptId(event.target.value)} className={fieldClass}>
                {attempts.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    Attempt {candidate.attempt}
                    {candidate.id === latest.id ? " (latest, the one that counts)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {/* Keyed so the comment form and the mark start clean for each hand-in. */}
          <AttemptMarking key={attempt.id} assignment={assignment} attempt={attempt} canEdit={canEdit} />
        </>
      )}
    </PageContainer>
  );
}

function AttemptMarking({ assignment, attempt, canEdit }: { assignment: Assignment; attempt: Submission; canEdit: boolean }) {
  const seesSimilarity = useCanSeeSimilarity(assignment.courseId);
  const [target, setTarget] = useState<Target | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openFileId, setOpenFileId] = useState<string | undefined>(undefined);
  const openFile = useSubmissionFile(attempt, openFileId);
  const [notice, setNotice] = useState<string[]>([]);

  const textNotes = attempt.comments.flatMap((comment, index) =>
    comment.anchor.kind === "text"
      ? [{ id: comment.id, number: index + 1, start: comment.anchor.start, end: comment.anchor.end }]
      : [],
  );
  const fileName = (fileId: string) => attempt.files.find((file) => file.id === fileId)?.name ?? "a file";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="p-5">
          <p className="text-sm text-ink-3">
            Handed in {formatDateTime(attempt.submittedAt)} · receipt <span className="font-mono">{attempt.receipt}</span>
          </p>

          {attempt.text ? (
            <div className="mt-4">
              <h2 className="text-sm font-semibold">Typed answer</h2>
              {canEdit ? (
                <p className="mt-1 mb-3 text-xs text-ink-3">
                  To comment on part of it, select the words, or use the button beside a paragraph.
                </p>
              ) : null}
              <div className="mt-2 max-w-[75ch]">
                <AnnotatedText
                  text={attempt.text}
                  notes={textNotes}
                  activeId={activeId}
                  onPick={setActiveId}
                  onSelect={canEdit ? (start, end) => setTarget({ kind: "text", start, end }) : undefined}
                />
              </div>
            </div>
          ) : null}

          {attempt.files.length > 0 ? (
            <div className="mt-5 border-t border-line pt-4">
              <h2 className="mb-2 text-sm font-semibold">Files</h2>
              <ul className="flex flex-col gap-1.5">
                {attempt.files.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
                    <span className="min-w-0 flex-1 basis-40 truncate">{file.name}</span>
                    <span className="text-xs text-ink-3">{file.sizeLabel}</span>
                    <Button variant="ghost" size="sm" onClick={() => setOpenFileId(openFileId === file.id ? undefined : file.id)} aria-expanded={openFileId === file.id}>
                      <Eye aria-hidden className="size-4" />
                      {openFileId === file.id ? "Close" : "Open"}
                      <span className="sr-only"> {file.name}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void downloadSubmissionFile(attempt.id, file.id).then((found) =>
                          setNotice(found ? [] : [`${file.name} is not stored in this browser. In the demo, files stay on the device that uploaded them.`]),
                        )
                      }
                    >
                      <Download aria-hidden className="size-4" />
                      Download<span className="sr-only"> {file.name}</span>
                    </Button>
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={() => setTarget({ kind: "file", fileId: file.id })}>
                        <MessageSquarePlus aria-hidden className="size-4" />
                        Comment<span className="sr-only"> on {file.name}</span>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {openFileId ? (
                <div className="mt-3">
                  {openFile.state === "loading" ? (
                    <p className="text-sm text-ink-2">Loading the file…</p>
                  ) : openFile.state === "ready" ? (
                    <FileViewer url={openFile.url} name={fileName(openFileId)} mimeType={attempt.files.find((file) => file.id === openFileId)?.mimeType} />
                  ) : (
                    <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
                      This file is not stored in this browser. In the demo, files stay on the device that uploaded them.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div role="alert" className={notice.length > 0 ? "mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad" : undefined}>
            {notice.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">Inline comments</h2>
          {target ? (
            <CommentForm
              key={target.kind === "text" ? `${target.start}-${target.end}` : target.fileId}
              attempt={attempt}
              target={target}
              targetLabel={
                target.kind === "text" ? `“${(attempt.text ?? "").slice(target.start, target.end)}”` : fileName(target.fileId)
              }
              onDone={() => setTarget(null)}
            />
          ) : null}

          {attempt.comments.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              {canEdit ? "No comments yet. Choose part of the work above to add one." : "No comments on this work."}
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {attempt.comments.map((comment, index) => (
                <li
                  key={comment.id}
                  className={cn("rounded-lg border p-3 text-sm", activeId === comment.id ? "border-primary bg-primary-soft" : "border-line")}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveId(activeId === comment.id ? null : comment.id)}
                      aria-pressed={activeId === comment.id}
                      aria-label={`Show where comment ${index + 1} points`}
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg"
                    >
                      {index + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-2">
                        {comment.anchor.kind === "text"
                          ? `On “${comment.anchor.quote}”`
                          : `On ${fileName(comment.anchor.fileId)}${comment.anchor.page ? `, page ${comment.anchor.page}` : ""}`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => void removeInlineComment(attempt.id, comment.id).catch((error) => setNotice(messagesOf(error)))}
                        aria-label={`Remove comment ${index + 1}`}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {seesSimilarity ? <SimilarityCard attempt={attempt} canRun={canEdit} /> : null}
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <GradeCard assignment={assignment} attempt={attempt} canEdit={canEdit} />
      </div>
    </div>
  );
}

function FileViewer({ url, name, mimeType }: { url: string; name: string; mimeType?: string }) {
  if (mimeType === "application/pdf" || /\.pdf$/i.test(name)) {
    return <iframe src={url} title={name} className="h-[70vh] w-full rounded-lg border border-line bg-surface" />;
  }
  if (mimeType?.startsWith("image/") || /\.(png|jpe?g)$/i.test(name)) {
    // A blob address from the mock file store; the image optimiser has nothing to fetch.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Submitted file ${name}`} className="max-h-[70vh] max-w-full rounded-lg border border-line" />;
  }
  return (
    <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
      This kind of file can&apos;t be shown inside the page. Download it to open it.
    </p>
  );
}

/** FR-3.9: write a comment for the chosen part of the work. */
function CommentForm({
  attempt,
  target,
  targetLabel,
  onDone,
}: {
  attempt: Submission;
  target: Target;
  targetLabel: string;
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const save = async () => {
    setBusy(true);
    setProblems([]);
    const anchor: CommentAnchor =
      target.kind === "text"
        ? { kind: "text", start: target.start, end: target.end, quote: "" }
        : { kind: "file", fileId: target.fileId, page: Number(page) >= 1 ? Math.floor(Number(page)) : undefined };
    try {
      await addInlineComment(attempt.id, anchor, body);
      onDone();
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-3 rounded-lg border border-primary bg-primary-soft p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-sm">
        <span className="font-medium">Commenting on</span>{" "}
        <span className="break-words">{targetLabel.length > 160 ? `${targetLabel.slice(0, 160)}…”` : targetLabel}</span>
      </p>
      <label htmlFor="comment-body" className="mt-2 mb-1 block text-sm font-medium">
        Comment
      </label>
      <textarea
        id="comment-body"
        rows={3}
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={cn(fieldBaseClass, "w-full px-3 py-2")}
      />
      {target.kind === "file" ? (
        <div className="mt-2">
          <label htmlFor="comment-page" className="mb-1 block text-sm font-medium">
            Page <span className="font-normal text-ink-2">(optional)</span>
          </label>
          <input
            id="comment-page"
            type="number"
            inputMode="numeric"
            min={1}
            value={page}
            onChange={(event) => setPage(event.target.value)}
            className={cn(fieldClass, "w-24")}
          />
        </div>
      ) : null}
      {problems.length > 0 ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {problems.join(" ")}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          Add comment
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** US-14: the similarity report. Rendered only for roles that may see it. */
function SimilarityCard({ attempt, canRun }: { attempt: Submission; canRun: boolean }) {
  const [busy, setBusy] = useState(false);
  const report = attempt.similarity;
  const check = async () => {
    setBusy(true);
    try {
      await runSimilarityCheck(attempt.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Similarity report</h2>
          <p className="mt-1 text-sm text-ink-2">Visible to faculty and administrators only. A high score is a reason to look, not a verdict.</p>
        </div>
        {canRun ? (
          <Button variant="secondary" size="sm" onClick={() => void check()} disabled={busy}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />}
            {report ? "Check again" : "Run check"}
          </Button>
        ) : null}
      </div>
      <div role="status" className="mt-3">
        {report ? (
          <>
            <p className="text-sm">
              <span className={cn("text-2xl font-semibold tabular-nums", report.percent >= 40 && "text-bad")}>{report.percent}%</span>{" "}
              of this work matches other sources.
            </p>
            {report.matches.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
                {report.matches.map((match) => (
                  <li key={match.source} className="flex justify-between gap-3">
                    <span className="min-w-0">{match.source}</span>
                    <span className="shrink-0 tabular-nums">{match.percent}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-ink-3">
              {report.provider} · checked {formatDateTime(report.checkedAt)}. Simulated in this demo: nothing is compared with real sources.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2">{busy ? "Checking…" : "No report yet. It usually arrives a few seconds after the work is handed in."}</p>
        )}
      </div>
    </Card>
  );
}

/** US-15: rubric scoring that totals itself, the late deduction, and overall feedback. */
function GradeCard({ assignment, attempt, canEdit }: { assignment: Assignment; attempt: Submission; canEdit: boolean }) {
  const grade = attempt.grade;
  const [levels, setLevels] = useState<Record<string, string>>(grade?.rubricLevels ?? {});
  const [mark, setMark] = useState(grade ? String(grade.rawPoints) : "");
  const [feedback, setFeedback] = useState(grade?.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const penalty = attempt.late?.penaltyPercent ?? 0;
  const raw = assignment.rubric ? rubricScore(assignment.rubric, levels).points : Number(mark);
  // Nothing to show until a mark has been typed; a rubric always has a running total.
  const final = assignment.rubric || (mark !== "" && Number.isFinite(raw)) ? applyPenalty(raw, penalty) : null;
  const touch = () => {
    setSaved(false);
    setProblems([]);
  };

  const save = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await saveGrade(attempt.id, assignment.rubric ? { rubricLevels: levels, feedback } : { rawPoints: mark === "" ? undefined : Number(mark), feedback });
      setSaved(true);
    } catch (error) {
      setProblems(messagesOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold tracking-tight">Mark</h2>
      <p className="mt-1 text-sm text-ink-2">
        {grade?.releasedAt
          ? `Released to the student on ${formatDateTime(grade.releasedAt)}. Changes you save are visible to them at once.`
          : "The student sees none of this until you release grades from the assignment page."}
      </p>

      <fieldset disabled={!canEdit} className="mt-4 min-w-0">
        <legend className="sr-only">Mark for this hand-in</legend>
        {assignment.rubric ? (
          <RubricView
            rubric={assignment.rubric}
            idPrefix={`mark-${attempt.id}`}
            chosen={levels}
            onChoose={(criterionId, levelId) => {
              touch();
              setLevels((current) => ({ ...current, [criterionId]: levelId }));
            }}
          />
        ) : (
          <div>
            <label htmlFor="mark-points" className="mb-1 block text-sm font-medium">
              Mark out of {assignment.points}
            </label>
            <input
              id="mark-points"
              type="number"
              inputMode="decimal"
              min={0}
              max={assignment.points}
              value={mark}
              onChange={(event) => {
                touch();
                setMark(event.target.value);
              }}
              className={cn(fieldClass, "w-28")}
            />
          </div>
        )}

        <dl className="mt-4 flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-sm tabular-nums">
          {penalty > 0 ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Before the late deduction</dt>
                <dd>{final === null ? "—" : raw}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">
                  Late: {attempt.late?.daysLate} {attempt.late?.daysLate === 1 ? "day" : "days"}
                </dt>
                <dd>−{penalty}%</dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between gap-3 font-semibold">
            <dt>Mark that counts</dt>
            <dd>
              {/* The live region is inside the term's value, so the list keeps its structure (NFR-5). */}
              <span role="status">
                {final === null ? "—" : final} / {assignment.points}
              </span>
            </dd>
          </div>
        </dl>

        <label htmlFor="mark-feedback" className="mt-4 mb-1 block text-sm font-medium">
          Overall feedback
        </label>
        <textarea
          id="mark-feedback"
          rows={5}
          value={feedback}
          onChange={(event) => {
            touch();
            setFeedback(event.target.value);
          }}
          className={cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed")}
        />

        {problems.length > 0 ? (
          <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {problems.join(" ")}
          </p>
        ) : null}

        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              {grade ? "Save changes" : "Save mark"}
            </Button>
            <p role="status" className="text-sm text-ink-2">
              {saved ? (grade?.releasedAt ? "Saved." : "Saved. Not released yet.") : null}
            </p>
          </div>
        ) : null}
      </fieldset>
      {canEdit ? null : <p className="mt-3 text-xs text-ink-3">You can view this mark but not change it.</p>}
    </Card>
  );
}
