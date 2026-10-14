"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Badge, Button, Card, PageContainer, PageHeader, SectionTitle, fieldBaseClass, fieldClass } from "@/components/ui";
import { QuizError, markAnswer, useGradingQueue, type QueueItem } from "@/lib/api/quizzes";
import { cn, formatDateTime } from "@/lib/utils";

const MARKED_SHOWN = 20;

/**
 * `/grading` (US-12): every quiz answer that needs a teacher's mark, oldest
 * first. Saving a mark posts it back to the student's attempt; once nothing in
 * the attempt is waiting, its score is final and counts in the gradebook.
 */
export function GradingQueue() {
  const queue = useGradingQueue();
  const [quizId, setQuizId] = useState("all");
  if (!queue) return null;

  const quizzes = [...new Map([...queue.pending, ...queue.marked].map((item) => [item.quiz.id, item.quiz.title])).entries()];
  const inScope = (item: QueueItem) => quizId === "all" || item.quiz.id === quizId;
  const pending = queue.pending.filter(inScope);
  const marked = queue.marked.filter(inScope);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Grading queue"
        description="Quiz answers that are marked by a teacher. Multiple choice, true or false and matching questions are marked automatically and never appear here."
        actions={
          quizzes.length > 1 ? (
            <>
              <label htmlFor="grading-quiz" className="sr-only">
                Quiz
              </label>
              <select id="grading-quiz" value={quizId} onChange={(event) => setQuizId(event.target.value)} className={cn(fieldClass, "max-w-64")}>
                <option value="all">All quizzes</option>
                {quizzes.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </>
          ) : undefined
        }
      />

      <section>
        <SectionTitle>
          Waiting for a mark <span className="font-normal text-ink-3 tabular-nums">· {pending.length}</span>
        </SectionTitle>
        {pending.length === 0 ? (
          <Card className="p-5 text-sm text-ink-2">Nothing is waiting. New answers appear here as students hand in.</Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((item) => (
              <li key={item.key}>
                <AnswerCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {marked.length > 0 ? (
        <section className="mt-10">
          <SectionTitle>
            Marked <span className="font-normal text-ink-3 tabular-nums">· {marked.length}</span>
          </SectionTitle>
          <ul className="flex flex-col gap-4">
            {marked.slice(0, MARKED_SHOWN).map((item) => (
              <li key={item.key}>
                <AnswerCard item={item} />
              </li>
            ))}
          </ul>
          {marked.length > MARKED_SHOWN ? (
            <p className="mt-3 text-sm text-ink-3">Showing the {MARKED_SHOWN} most recently handed in.</p>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}

function AnswerCard({ item }: { item: QueueItem }) {
  const { quiz, question, student, attempt, answer, mark } = item;
  const [points, setPoints] = useState(mark ? String(mark.points) : "");
  const [feedback, setFeedback] = useState(mark?.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const id = item.key.replace(/[^a-z0-9]/gi, "-");

  const save = async () => {
    setBusy(true);
    setProblems([]);
    setSaved(false);
    try {
      await markAnswer(student.id, attempt.id, question.id, points === "" ? Number.NaN : Number(points), feedback);
      setSaved(true);
    } catch (error) {
      setProblems(error instanceof QuizError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{student.name}</span>
        <Badge>{quiz.title}</Badge>
        {mark ? <Badge tone="good">Marked {mark.points}/{question.points}</Badge> : <Badge tone="warn">Waiting</Badge>}
        <span className="text-ink-3">Handed in {formatDateTime(attempt.submittedAt)}</span>
      </div>

      <p className="mt-3 font-medium text-pretty">{question.prompt}</p>
      <div className="mt-2 rounded-lg bg-surface-2 p-3">
        <p className="text-xs text-ink-3">{student.name}&apos;s answer</p>
        <p className="mt-1 max-w-[75ch] text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
      </div>
      {question.sample ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-ink-2">Sample answer</summary>
          <p className="mt-1 max-w-[75ch] text-ink-2">{question.sample}</p>
        </details>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor={`${id}-points`} className="mb-1 block text-sm font-medium">
            Mark out of {question.points}
          </label>
          <input
            id={`${id}-points`}
            type="number"
            inputMode="decimal"
            min={0}
            max={question.points}
            step="0.5"
            value={points}
            onChange={(event) => {
              setPoints(event.target.value);
              setSaved(false);
            }}
            className={cn(fieldClass, "w-24")}
          />
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={`${id}-feedback`} className="mb-1 block text-sm font-medium">
            Comment for the student <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <textarea
            id={`${id}-feedback`}
            rows={1}
            value={feedback}
            onChange={(event) => {
              setFeedback(event.target.value);
              setSaved(false);
            }}
            className={cn(fieldBaseClass, "min-h-10 w-full px-3 py-2")}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          {mark ? "Change mark" : "Save mark"}
        </Button>
      </form>
      {/* Always rendered, so the result is announced. */}
      <p role={problems.length > 0 ? "alert" : "status"} className={cn("text-sm", problems.length > 0 ? "mt-2 text-bad" : saved ? "mt-2 text-good" : undefined)}>
        {problems.length > 0 ? problems.join(" ") : saved ? "Saved. The student's score has been updated." : null}
      </p>
    </Card>
  );
}
