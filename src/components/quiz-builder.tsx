"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { BookMarked, ChevronRight, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ForbiddenView } from "@/components/forbidden-view";
import { NotFoundView } from "@/components/not-found-view";
import { QuestionEditor } from "@/components/question-editor";
import { SortableList } from "@/components/sortable-list";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageContainer,
  PageHeader,
  PageSkeleton,
  fieldBaseClass,
  fieldClass,
} from "@/components/ui";
import { useCourses } from "@/lib/api/courses";
import {
  QuizError,
  addToBank,
  deleteQuiz,
  newQuizId,
  removeFromBank,
  saveQuiz,
  useQuestionBank,
  useQuiz,
  useQuizHasAttempts,
} from "@/lib/api/quizzes";
import { useActor } from "@/lib/api/session";
import { moveItem } from "@/lib/domain/course-outline";
import { can } from "@/lib/domain/permissions";
import { QUESTION_KINDS, QUESTION_KIND_LABELS, blankQuestion } from "@/lib/domain/quizzes";
import { quizPoints } from "@/lib/grading";
import type { Course, Question, Quiz } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_CLASS = "mb-1 block text-sm font-medium";
const toNumber = (value: string) => (value === "" ? Number.NaN : Number(value));
const toField = (value: number | undefined) => (value === undefined || Number.isNaN(value) ? "" : value);

function messagesOf(error: unknown) {
  if (error instanceof QuizError) return error.problems;
  return [error instanceof Error ? error.message : "Something went wrong. Try again."];
}

/** `/quizzes/new`: a blank quiz in one of the courses the teacher may build quizzes for. */
export function QuizNew() {
  const actor = useActor();
  const courses = useCourses();
  if (!actor) return <PageSkeleton />;

  const teachable = courses.filter(
    (course) => course.status !== "archived" && can(actor, "create", { type: "quiz", courseId: course.id }),
  );
  if (teachable.length === 0) {
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="New quiz"
          description="You have no course in a current term to build a quiz for. Create a course first."
          actions={<ButtonLink href="/courses/new">New course</ButtonLink>}
        />
      </PageContainer>
    );
  }
  return (
    <BuilderForm
      isNew
      locked={false}
      courses={teachable}
      savedUnitId={undefined}
      saved={{
        // Given its id when the form opens.
        id: "",
        courseId: teachable[0].id,
        title: "",
        description: "",
        minutes: 10,
        passMark: 70,
        weight: 0,
        due: "",
        questions: [],
        status: "draft",
      }}
    />
  );
}

/** `/quizzes/[quizId]/edit`. */
export function QuizEdit({ quizId }: { quizId: string }) {
  const access = useQuiz(quizId);
  const locked = useQuizHasAttempts(quizId);
  const courses = useCourses();
  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView message="This quiz doesn't exist, or it has been removed." />;
  if (access.status === "forbidden" || !access.canEdit) {
    return <ForbiddenView resource={`quiz:${quizId}:edit`} what="this quiz's editor" />;
  }
  return (
    <BuilderForm
      isNew={false}
      locked={locked}
      courses={courses.filter((course) => course.id === access.quiz.courseId)}
      savedUnitId={access.unitId}
      saved={access.quiz}
    />
  );
}

function BuilderForm({
  saved,
  savedUnitId,
  isNew,
  locked,
  courses,
}: {
  saved: Quiz;
  savedUnitId: string | undefined;
  isNew: boolean;
  /** Students have taken the quiz, so its questions are fixed. */
  locked: boolean;
  courses: Course[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => (saved.id ? saved : { ...saved, id: newQuizId("quiz") }));
  const [unitId, setUnitId] = useState(savedUnitId ?? "");
  const [addKind, setAddKind] = useState<Question["kind"]>("single");
  const [bankOpen, setBankOpen] = useState(false);
  const [busy, setBusy] = useState<"draft" | "publish" | "delete" | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setBankOpen(false);
  }, []);

  const published = saved.status === "published" && !isNew;
  const course = courses.find((candidate) => candidate.id === draft.courseId);
  const set = (changes: Partial<Quiz>) => setDraft((current) => ({ ...current, ...changes }));
  const setQuestion = (next: Question) =>
    set({ questions: draft.questions.map((question) => (question.id === next.id ? next : question)) });

  const save = async (publish: boolean) => {
    setBusy(publish ? "publish" : "draft");
    setProblems([]);
    try {
      const id = await saveQuiz(draft, { publish, unitId: unitId || null });
      router.push(`/quizzes/${id}`);
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setProblems([]);
    try {
      await deleteQuiz(saved.id);
      router.push("/quizzes");
    } catch (error) {
      setProblems(messagesOf(error));
      setBusy(null);
      setConfirmingDelete(false);
    }
  };

  const saveToBank = async (question: Question) => {
    try {
      await addToBank(draft.courseId, question);
      setNote("Saved to the question bank.");
    } catch (error) {
      setNote(messagesOf(error).join(" "));
    }
  };

  return (
    <PageContainer className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/quizzes" className="hover:text-ink">
          Quizzes
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        {isNew ? (
          <span className="text-ink-2">New quiz</span>
        ) : (
          <>
            <Link href={`/quizzes/${saved.id}`} className="hover:text-ink">
              {saved.title || "Untitled quiz"}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
            <span className="text-ink-2">Edit</span>
          </>
        )}
      </nav>
      <PageHeader
        title={isNew ? "New quiz" : "Edit quiz"}
        description={
          published
            ? "This quiz is published: students see changes as soon as you save."
            : "Save it as a draft while you work. Students see it only once it is published."
        }
      />

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
      >
        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="quiz-course" className={LABEL_CLASS}>
                Course
              </label>
              <select
                id="quiz-course"
                value={draft.courseId}
                disabled={!isNew || courses.length === 1}
                onChange={(event) => {
                  set({ courseId: event.target.value });
                  setUnitId("");
                }}
                className={cn(fieldClass, "w-full")}
              >
                {courses.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="quiz-unit" className={LABEL_CLASS}>
                Shown at the end of unit
              </label>
              <select id="quiz-unit" value={unitId} onChange={(event) => setUnitId(event.target.value)} className={cn(fieldClass, "w-full")}>
                <option value="">Not attached to a unit</option>
                {(course?.modules ?? []).map((unit, index) => (
                  <option key={unit.id} value={unit.id} disabled={unit.quizId !== undefined && unit.quizId !== draft.id}>
                    {unit.title || `Unit ${index + 1}`}
                    {unit.quizId !== undefined && unit.quizId !== draft.id ? " (already has a quiz)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="quiz-title" className={LABEL_CLASS}>
                Title
              </label>
              <input id="quiz-title" type="text" value={draft.title} onChange={(event) => set({ title: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="quiz-description" className={LABEL_CLASS}>
                Description
              </label>
              <textarea
                id="quiz-description"
                rows={2}
                value={draft.description}
                onChange={(event) => set({ description: event.target.value })}
                className={cn(fieldBaseClass, "w-full px-3 py-2")}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="quiz-due" className={LABEL_CLASS}>
                Due date
              </label>
              <input id="quiz-due" type="date" value={draft.due} onChange={(event) => set({ due: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="quiz-pass" className={LABEL_CLASS}>
                Pass mark (%)
              </label>
              <input
                id="quiz-pass"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={toField(draft.passMark)}
                onChange={(event) => set({ passMark: toNumber(event.target.value) })}
                className={cn(fieldClass, "w-full")}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="quiz-weight" className={LABEL_CLASS}>
                Share of course grade (%)
              </label>
              <input
                id="quiz-weight"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={toField(draft.weight)}
                onChange={(event) => set({ weight: toNumber(event.target.value) })}
                className={cn(fieldClass, "w-full")}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <fieldset className="rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold">Time</legend>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft.timeLimitMinutes !== undefined}
                  onChange={(event) => set({ timeLimitMinutes: event.target.checked ? draft.minutes || 10 : undefined })}
                  className="size-4 accent-primary"
                />
                Set a time limit
              </label>
              {draft.timeLimitMinutes !== undefined ? (
                <div className="mt-3">
                  <label htmlFor="quiz-limit" className={LABEL_CLASS}>
                    Minutes allowed
                  </label>
                  <input
                    id="quiz-limit"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={toField(draft.timeLimitMinutes)}
                    onChange={(event) => set({ timeLimitMinutes: toNumber(event.target.value) })}
                    aria-describedby="quiz-limit-hint"
                    className={cn(fieldClass, "w-28")}
                  />
                  <p id="quiz-limit-hint" className="mt-1 text-xs text-ink-3">
                    Students see a timer, their answers are saved as they go, and the attempt is handed in for them
                    when the time is up.
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor="quiz-minutes" className={LABEL_CLASS}>
                    About how long it takes (minutes)
                  </label>
                  <input
                    id="quiz-minutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={toField(draft.minutes)}
                    onChange={(event) => set({ minutes: toNumber(event.target.value) })}
                    className={cn(fieldClass, "w-28")}
                  />
                </div>
              )}
            </fieldset>

            <fieldset className="rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold">Attempts</legend>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={draft.maxAttempts !== undefined}
                  onChange={(event) => set({ maxAttempts: event.target.checked ? 1 : undefined })}
                  className="size-4 accent-primary"
                />
                Limit the number of attempts
              </label>
              {draft.maxAttempts !== undefined ? (
                <div className="mt-3">
                  <label htmlFor="quiz-attempts" className={LABEL_CLASS}>
                    Attempts allowed
                  </label>
                  <input
                    id="quiz-attempts"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={toField(draft.maxAttempts)}
                    onChange={(event) => set({ maxAttempts: toNumber(event.target.value) })}
                    className={cn(fieldClass, "w-28")}
                  />
                </div>
              ) : null}
              <p className="mt-3 text-xs text-ink-3">The best attempt is the one that counts.</p>
            </fieldset>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
              <p className="mt-1 text-sm text-ink-2 tabular-nums">
                {draft.questions.length} {draft.questions.length === 1 ? "question" : "questions"} · {quizPoints(draft) || 0} points.
                Multiple choice, true or false and matching are marked automatically.
              </p>
            </div>
          </div>

          {locked ? (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
              Students have taken this quiz, so its questions can no longer be changed. The settings above can.
            </p>
          ) : null}

          {/* A disabled fieldset switches off every control inside it. */}
          <fieldset disabled={locked} className="min-w-0">
            <legend className="sr-only">Questions</legend>
            {draft.questions.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">
                No questions yet. Add one below, or take one from the question bank.
              </p>
            ) : (
              <SortableList
                items={draft.questions}
                label="Questions"
                nameOf={(question) => question.prompt || "untitled question"}
                onMove={(from, to) => set({ questions: moveItem(draft.questions, from, to) })}
                disabled={locked}
                className="mt-4 flex flex-col gap-4"
                itemClassName="rounded-lg border border-line bg-surface p-3 sm:p-4"
                renderItem={(question, controls, index) => (
                  <QuestionEditor
                    question={question}
                    number={index + 1}
                    controls={controls}
                    onChange={setQuestion}
                    onRemove={() => set({ questions: draft.questions.filter((candidate) => candidate.id !== question.id) })}
                    onSaveToBank={() => void saveToBank(question)}
                  />
                )}
              />
            )}

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="quiz-add-kind" className={LABEL_CLASS}>
                  New question
                </label>
                <select id="quiz-add-kind" value={addKind} onChange={(event) => setAddKind(event.target.value as Question["kind"])} className={fieldClass}>
                  {QUESTION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {QUESTION_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" onClick={() => set({ questions: [...draft.questions, blankQuestion(addKind, newQuizId("q"))] })}>
                <Plus aria-hidden className="size-4" />
                Add question
              </Button>
              <Button variant="secondary" onClick={() => setBankOpen(true)}>
                <BookMarked aria-hidden className="size-4" />
                Add from the question bank
              </Button>
            </div>
          </fieldset>
          <p role="status" className={note ? "mt-3 text-sm text-ink-2" : undefined}>
            {note}
          </p>
        </Card>

        {problems.length > 0 ? (
          <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            <p className="font-medium">This needs fixing first:</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy !== null}>
            {busy === "publish" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            {published ? "Save changes" : "Publish"}
          </Button>
          {published ? null : (
            <Button variant="secondary" disabled={busy !== null} onClick={() => void save(false)}>
              {busy === "draft" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              Save draft
            </Button>
          )}
          <ButtonLink href={isNew ? "/quizzes" : `/quizzes/${saved.id}`} variant="ghost">
            Cancel
          </ButtonLink>
          {isNew || locked ? null : (
            <span className="ml-auto flex items-center gap-2">
              {confirmingDelete ? (
                <>
                  <span className="text-sm text-ink-2">Delete this quiz?</span>
                  <Button variant="secondary" size="sm" autoFocus onClick={() => setConfirmingDelete(false)}>
                    Keep it
                  </Button>
                  <Button size="sm" disabled={busy !== null} onClick={() => void remove()}>
                    Yes, delete
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 aria-hidden className="size-4" />
                  Delete
                </Button>
              )}
            </span>
          )}
        </div>
      </form>

      {bankOpen ? (
        <BankDialog
          courses={courses}
          currentCourseId={draft.courseId}
          onAdd={(question) => {
            set({ questions: [...draft.questions, { ...question, id: newQuizId("q") }] });
            setNote("Added a copy from the question bank.");
          }}
          onClose={() => setBankOpen(false)}
        />
      ) : null}
    </PageContainer>
  );
}

/** FR-3.5: the question bank shared by all faculty. Adding takes a copy, so the bank's question is never changed. */
function BankDialog({
  courses,
  currentCourseId,
  onAdd,
  onClose,
}: {
  courses: Course[];
  currentCourseId: string;
  onAdd: (question: Question) => void;
  onClose: () => void;
}) {
  const actor = useActor();
  const bank = useQuestionBank();
  const allCourses = useCourses();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Question["kind"] | "all">("all");
  const [scope, setScope] = useState<"course" | "all">(bank.some((entry) => entry.courseId === currentCourseId) ? "course" : "all");
  const [added, setAdded] = useState<string[]>([]);

  const wanted = query.trim().toLowerCase();
  const shown = bank.filter(
    (entry) =>
      (scope === "all" || entry.courseId === currentCourseId) &&
      (kind === "all" || entry.question.kind === kind) &&
      (wanted === "" || entry.question.prompt.toLowerCase().includes(wanted)),
  );
  const courseTitle = courses.find((course) => course.id === currentCourseId)?.title ?? "this course";

  return (
    <Dialog wide title="Question bank" description="Shared by all faculty. Adding a question takes a copy you can change." onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <label htmlFor="bank-search" className="sr-only">
            Search the question bank
          </label>
          <input
            id="bank-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions"
            className={cn(fieldBaseClass, "h-10 w-full pr-3 pl-9")}
          />
        </div>
        <label htmlFor="bank-scope" className="sr-only">
          Which questions
        </label>
        <select id="bank-scope" value={scope} onChange={(event) => setScope(event.target.value as "course" | "all")} className={fieldClass}>
          <option value="course">Written for {courseTitle}</option>
          <option value="all">Every course</option>
        </select>
        <label htmlFor="bank-kind" className="sr-only">
          Kind of question
        </label>
        <select id="bank-kind" value={kind} onChange={(event) => setKind(event.target.value as Question["kind"] | "all")} className={fieldClass}>
          <option value="all">All kinds</option>
          {QUESTION_KINDS.map((option) => (
            <option key={option} value={option}>
              {QUESTION_KIND_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <p role="status" className="mt-3 text-xs text-ink-3">
        {shown.length} {shown.length === 1 ? "question" : "questions"}
        {added.length > 0 ? ` · ${added.length} added to this quiz` : ""}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {shown.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-line p-3 text-sm">
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-medium text-pretty">{entry.question.prompt}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <Badge>{QUESTION_KIND_LABELS[entry.question.kind]}</Badge>
                {entry.question.points} {entry.question.points === 1 ? "point" : "points"} ·{" "}
                {allCourses.find((course) => course.id === entry.courseId)?.title ?? "Another course"}
              </p>
            </div>
            <span className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onAdd(entry.question);
                  setAdded((current) => [...current, entry.id]);
                }}
              >
                {added.includes(entry.id) ? "Add again" : "Add"}
                <span className="sr-only">: {entry.question.prompt}</span>
              </Button>
              {can(actor, "delete", { type: "question-bank", ownerId: entry.addedById }) ? (
                <button
                  type="button"
                  onClick={() => void removeFromBank(entry.id)}
                  aria-label={`Remove from the bank: ${entry.question.prompt}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              ) : null}
            </span>
          </li>
        ))}
        {shown.length === 0 ? <li className="py-6 text-center text-sm text-ink-2">No questions match.</li> : null}
      </ul>
    </Dialog>
  );
}
