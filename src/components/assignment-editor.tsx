"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, LoaderCircle, Paperclip, Trash2, Upload } from "lucide-react";
import { ForbiddenView } from "@/components/forbidden-view";
import { LatePolicyFields } from "@/components/late-policy-fields";
import { NotFoundView } from "@/components/not-found-view";
import { RubricBuilder } from "@/components/rubric";
import { Button, ButtonLink, Card, PageContainer, PageHeader, PageSkeleton, buttonClass, fieldBaseClass, fieldClass } from "@/components/ui";
import {
  AssignmentError,
  deleteAssignment,
  describeAttachment,
  newId,
  saveAssignment,
  useAssignment,
  useMarkingStarted,
} from "@/lib/api/assignments";
import { useCourseSections, useCourses } from "@/lib/api/courses";
import { useGradeCategories } from "@/lib/api/grades";
import { useActor } from "@/lib/api/session";
import { useSettings } from "@/lib/api/settings";
import { categoryIdFor } from "@/lib/domain/gradebook";
import { can } from "@/lib/domain/permissions";
import type { Assignment, SubmissionKind } from "@/lib/types";
import { cn, fromLocalInput, toLocalInput } from "@/lib/utils";

const LABEL_CLASS = "mb-1 block text-sm font-medium";
const toNumber = (value: string) => (value === "" ? Number.NaN : Number(value));
const toField = (value: number) => (Number.isNaN(value) ? "" : value);

/** `/assignments/new`: a blank assignment in one of the courses the teacher may set work for. */
export function AssignmentNew() {
  const actor = useActor();
  const courses = useCourses();
  const { lateDefault } = useSettings();
  if (!actor) return <PageSkeleton />;

  const teachable = courses.filter(
    (course) => course.status !== "archived" && can(actor, "create", { type: "assignment", courseId: course.id }),
  );
  if (teachable.length === 0) {
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="New assignment"
          description="You have no course in a current term to set an assignment for. Create a course first."
          actions={<ButtonLink href="/courses/new">New course</ButtonLink>}
        />
      </PageContainer>
    );
  }
  return (
    <EditorForm
      isNew
      markingStarted={false}
      courses={teachable.map(({ id, title }) => ({ id, title }))}
      saved={{
        // Given its id when the form opens.
        id: "",
        courseId: teachable[0].id,
        title: "",
        instructions: "",
        points: 100,
        dueAt: "",
        // Filled with every section of the chosen course until the teacher narrows it.
        sectionIds: [],
        attachments: [],
        accepts: ["text", "file"],
        late: lateDefault,
        allowResubmission: false,
        status: "draft",
        createdById: actor.id,
        createdAt: "",
      }}
    />
  );
}

/** `/assignments/[assignmentId]/edit`. */
export function AssignmentEdit({ assignmentId }: { assignmentId: string }) {
  const access = useAssignment(assignmentId);
  const markingStarted = useMarkingStarted(assignmentId);
  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView message="This assignment doesn't exist, or it has been removed." />;
  if (access.status === "forbidden" || !access.canEdit) {
    return <ForbiddenView resource={`assignment:${assignmentId}:edit`} what="this assignment's editor" />;
  }
  return (
    <EditorForm
      isNew={false}
      markingStarted={markingStarted}
      courses={[{ id: access.assignment.courseId, title: access.course?.title ?? "" }]}
      saved={access.assignment}
    />
  );
}

function EditorForm({
  saved,
  isNew,
  markingStarted,
  courses,
}: {
  saved: Assignment;
  isNew: boolean;
  /** Work has been marked, so points and rubric are fixed. */
  markingStarted: boolean;
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => (saved.id ? saved : { ...saved, id: newId("asg") }));
  // Null until the teacher touches the section boxes: then every section of the course is ticked.
  const [pickedSections, setPickedSections] = useState<string[] | null>(isNew ? null : saved.sectionIds);
  const [newFiles, setNewFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState<"draft" | "publish" | "delete" | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sections = useCourseSections(draft.courseId);
  // FR-4.1: the gradebook category the assignment counts in. Its weight is set in the gradebook.
  const categories = useGradeCategories(draft.courseId);
  const { submissionLimitMb } = useSettings();

  const published = saved.status === "published" && !isNew;
  const sectionIds = pickedSections ?? sections.map((section) => section.id);
  const set = (changes: Partial<Assignment>) => setDraft((current) => ({ ...current, ...changes }));

  const toggleAccept = (kind: SubmissionKind, on: boolean) =>
    set({ accepts: on ? [...draft.accepts.filter((item) => item !== kind), kind] : draft.accepts.filter((item) => item !== kind) });

  const addAttachments = (files: File[]) => {
    const added = files.map((file) => ({ file, attached: describeAttachment(file) }));
    setNewFiles((current) => ({ ...current, ...Object.fromEntries(added.map(({ file, attached }) => [attached.id, file])) }));
    set({ attachments: [...draft.attachments, ...added.map(({ attached }) => attached)] });
  };

  const save = async (publish: boolean) => {
    setBusy(publish ? "publish" : "draft");
    setProblems([]);
    try {
      const id = await saveAssignment({ ...draft, sectionIds }, { publish, newFiles });
      router.push(`/assignments/${id}`);
    } catch (error) {
      setProblems(error instanceof AssignmentError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setProblems([]);
    try {
      await deleteAssignment(saved.id);
      router.push("/assignments");
    } catch (error) {
      setProblems(error instanceof AssignmentError ? error.problems : ["Something went wrong. Try again."]);
      setBusy(null);
      setConfirmingDelete(false);
    }
  };

  return (
    <PageContainer className="max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/assignments" className="hover:text-ink">
          Assignments
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        {isNew ? (
          <span className="text-ink-2">New assignment</span>
        ) : (
          <>
            <Link href={`/assignments/${saved.id}`} className="hover:text-ink">
              {saved.title || "Untitled assignment"}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
            <span className="text-ink-2">Edit</span>
          </>
        )}
      </nav>
      <PageHeader
        title={isNew ? "New assignment" : "Edit assignment"}
        description={
          published
            ? "This assignment is published: students see changes as soon as you save."
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
          <h2 className="text-lg font-semibold tracking-tight">The task</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <label htmlFor="asg-course" className={LABEL_CLASS}>
                Course
              </label>
              <select
                id="asg-course"
                value={draft.courseId}
                disabled={!isNew || courses.length === 1}
                onChange={(event) => {
                  set({ courseId: event.target.value });
                  setPickedSections(null);
                }}
                className={cn(fieldClass, "w-full")}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="asg-title" className={LABEL_CLASS}>
                Title
              </label>
              <input id="asg-title" type="text" value={draft.title} onChange={(event) => set({ title: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="asg-instructions" className={LABEL_CLASS}>
                Instructions
              </label>
              <textarea
                id="asg-instructions"
                rows={6}
                value={draft.instructions}
                onChange={(event) => set({ instructions: event.target.value })}
                className={cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed")}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="asg-due" className={LABEL_CLASS}>
                Due date and time
              </label>
              <input
                id="asg-due"
                type="datetime-local"
                value={toLocalInput(draft.dueAt)}
                onChange={(event) => set({ dueAt: fromLocalInput(event.target.value) ?? "" })}
                className={cn(fieldClass, "w-full")}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="asg-points" className={LABEL_CLASS}>
                Points
              </label>
              <input
                id="asg-points"
                type="number"
                inputMode="decimal"
                min={1}
                value={toField(draft.points)}
                disabled={markingStarted}
                onChange={(event) => set({ points: toNumber(event.target.value) })}
                aria-describedby={markingStarted ? "asg-locked" : undefined}
                className={cn(fieldClass, "w-full")}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="asg-category" className={LABEL_CLASS}>
                Gradebook category
              </label>
              <select
                id="asg-category"
                value={categoryIdFor("assignment", draft.categoryId, categories)}
                onChange={(event) => set({ categoryId: event.target.value })}
                className={cn(fieldClass, "w-full")}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.weight}% of the grade)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className={LABEL_CLASS}>Set for sections</legend>
            {sections.length === 0 ? (
              <p className="text-sm text-ink-2">This course has no sections yet.</p>
            ) : (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {sections.map((section) => (
                  <label key={section.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sectionIds.includes(section.id)}
                      onChange={(event) =>
                        setPickedSections(
                          event.target.checked ? [...sectionIds, section.id] : sectionIds.filter((id) => id !== section.id),
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    {section.name}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-ink-3">Only students in the ticked sections see the assignment.</p>
          </fieldset>

          <fieldset className="mt-5">
            <legend className={LABEL_CLASS}>Attachments</legend>
            {draft.attachments.length > 0 ? (
              <ul className="mb-2 flex flex-col gap-1.5">
                {draft.attachments.map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
                    <Paperclip aria-hidden className="size-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">{file.sizeLabel}</span>
                    <button
                      type="button"
                      onClick={() => set({ attachments: draft.attachments.filter((candidate) => candidate.id !== file.id) })}
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
                className="sr-only"
                onChange={(event) => {
                  addAttachments(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            <p className="mt-1 text-xs text-ink-3">For example a brief, a data file or a template. Students can download them.</p>
          </fieldset>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">Handing in</h2>
          <fieldset className="mt-4">
            <legend className={LABEL_CLASS}>Students hand in</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={draft.accepts.includes("text")} onChange={(event) => toggleAccept("text", event.target.checked)} className="size-4 accent-primary" />
                Typed text
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={draft.accepts.includes("file")} onChange={(event) => toggleAccept("file", event.target.checked)} className="size-4 accent-primary" />
                Files, up to {submissionLimitMb} MB each
              </label>
            </div>
          </fieldset>

          <div className="mt-5">
            <LatePolicyFields idPrefix="asg-late" value={draft.late} onChange={(late) => set({ late })} />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={draft.allowResubmission}
              onChange={(event) => set({ allowResubmission: event.target.checked })}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              Allow students to hand in again
              <span className="block text-xs text-ink-3">
                Off: each student hands in once. On: the latest version is the one you mark, and the late rule applies to it.
              </span>
            </span>
          </label>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Rubric</h2>
              <p className="mt-1 text-sm text-ink-2">
                Criteria with levels. When you mark, you pick a level for each criterion and the total is worked out for
                you. Without a rubric you type one mark.
              </p>
            </div>
            {draft.rubric ? (
              <Button variant="ghost" size="sm" disabled={markingStarted} onClick={() => set({ rubric: undefined })}>
                Remove rubric
              </Button>
            ) : (
              <Button variant="secondary" disabled={markingStarted} onClick={() => set({ rubric: { criteria: [] } })}>
                Add a rubric
              </Button>
            )}
          </div>
          {markingStarted ? (
            <p id="asg-locked" className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
              Marking has started, so the points and the rubric can no longer be changed.
            </p>
          ) : null}
          {draft.rubric ? (
            <fieldset disabled={markingStarted} className="mt-4 min-w-0">
              <legend className="sr-only">Rubric criteria</legend>
              <RubricBuilder rubric={draft.rubric} points={draft.points} newId={newId} onChange={(rubric) => set({ rubric })} />
              {draft.rubric.criteria.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => set({ points: draft.rubric!.criteria.reduce((sum, criterion) => sum + (criterion.points || 0), 0) })}
                >
                  Set the assignment&apos;s points to the rubric total
                </Button>
              ) : null}
            </fieldset>
          ) : null}
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
          <ButtonLink href={isNew ? "/assignments" : `/assignments/${saved.id}`} variant="ghost">
            Cancel
          </ButtonLink>
          {isNew ? null : (
            <span className="ml-auto flex items-center gap-2">
              {confirmingDelete ? (
                <>
                  <span className="text-sm text-ink-2">Delete this assignment?</span>
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
    </PageContainer>
  );
}
