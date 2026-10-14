"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, LoaderCircle, Trash2 } from "lucide-react";
import { Button, ButtonLink, Card, PageContainer, PageHeader, fieldClass } from "@/components/ui";
import {
  CourseError,
  createCourse,
  deleteTemplate,
  useCourses,
  useTemplates,
  useTerms,
  type CourseSource,
} from "@/lib/api/courses";
import { useActor } from "@/lib/api/session";
import { countCourseDates, daysBetween, shiftDate } from "@/lib/domain/course-copy";
import { courseLessons } from "@/lib/domain/course-outline";
import { can } from "@/lib/domain/permissions";
import type { Course } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type StartFrom = CourseSource["kind"];

const LABEL_CLASS = "mb-1 block text-sm font-medium";

const OPTIONS: Array<{ value: StartFrom; label: string; detail: string }> = [
  { value: "blank", label: "A blank course", detail: "Start with one empty section and add units yourself." },
  { value: "template", label: "A template", detail: "Start from a structure a teacher has saved for reuse." },
  { value: "course", label: "A copy of a course", detail: "Reuse one of your courses, including last term's." },
];

/**
 * New course (FR-2.1, US-08): blank, from a template, or as a copy. A copy
 * takes the units, lessons, sections and schedule, never the students or their
 * work, and its dates can be moved in bulk to fit the new term.
 */
export function CourseNew() {
  const router = useRouter();
  const actor = useActor();
  const terms = useTerms();
  const courses = useCourses();
  const templates = useTemplates();
  const openTerms = terms.filter((term) => term.status !== "archived");

  const [startFrom, setStartFrom] = useState<StartFrom>("blank");
  const [templateId, setTemplateId] = useState("");
  const [sourceCourseId, setSourceCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [chosenTermId, setChosenTermId] = useState("");
  // `null` follows the suggestion; a string is what the teacher typed.
  const [typedShift, setTypedShift] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const termId = openTerms.some((term) => term.id === chosenTermId) ? chosenTermId : (openTerms[0]?.id ?? "");
  const term = terms.find((candidate) => candidate.id === termId);
  const template = templates.find((candidate) => candidate.id === templateId) ?? templates[0];
  const sourceCourse = courses.find((candidate) => candidate.id === sourceCourseId) ?? courses[0];
  const source: Course | undefined =
    startFrom === "template" ? template?.course : startFrom === "course" ? sourceCourse : undefined;

  // US-08: by default the copy's first day lands on the new term's first day.
  const sourceStart = source ? (source.startsOn ?? terms.find((candidate) => candidate.id === source.termId)?.startsOn) : undefined;
  const suggestedShift = sourceStart && term ? daysBetween(sourceStart, term.startsOn) : 0;
  const shiftText = typedShift ?? String(suggestedShift);
  const shiftDays = Number(shiftText);
  const dateCount = source ? countCourseDates(source) : 0;

  const submit = async () => {
    const found: string[] = [];
    if (startFrom !== "blank" && !source) found.push(startFrom === "template" ? "Choose a template." : "Choose a course to copy.");
    if (!Number.isInteger(shiftDays)) found.push("Days to move the dates by must be a whole number.");
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    setBusy(true);
    setProblems([]);
    try {
      const courseId = await createCourse({
        title,
        code,
        termId,
        source:
          startFrom === "template"
            ? { kind: "template", templateId: template!.id }
            : startFrom === "course"
              ? { kind: "course", courseId: sourceCourse!.id }
              : { kind: "blank" },
        shiftDays: startFrom === "blank" ? 0 : shiftDays,
      });
      router.push(`/courses/${courseId}/edit`);
    } catch (error) {
      setProblems(error instanceof CourseError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-ink-3">
        <Link href="/courses" className="hover:text-ink">
          Courses
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">New course</span>
      </nav>
      <PageHeader title="New course" description="You can change everything afterwards in the course builder." />

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Card className="p-5">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Start from</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer flex-col gap-1 rounded-lg border border-line p-3 text-sm transition-colors hover:border-line-strong has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="course-start-from"
                      checked={startFrom === option.value}
                      onChange={() => {
                        setStartFrom(option.value);
                        setTypedShift(null);
                        setProblems([]);
                      }}
                      className="size-4 accent-primary"
                    />
                    {option.label}
                  </span>
                  <span className="text-ink-2">{option.detail}</span>
                </label>
              ))}
            </div>

            {startFrom === "template" ? (
              <div className="mt-4">
                {templates.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
                    There are no templates yet. Open a course in the builder and choose “Save as template”.
                  </p>
                ) : (
                  <>
                    <label htmlFor="new-template" className={LABEL_CLASS}>
                      Template
                    </label>
                    <select
                      id="new-template"
                      value={template?.id ?? ""}
                      onChange={(event) => {
                        setTemplateId(event.target.value);
                        setTypedShift(null);
                      }}
                      className={cn(fieldClass, "w-full")}
                    >
                      {templates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} · by {candidate.createdByName}
                        </option>
                      ))}
                    </select>
                    {template && can(actor, "delete", { type: "course-template", ownerId: template.createdById }) ? (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => void deleteTemplate(template.id)}>
                        <Trash2 aria-hidden className="size-4" />
                        Delete this template
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {startFrom === "course" ? (
              <div className="mt-4">
                {courses.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">You have no courses to copy yet.</p>
                ) : (
                  <>
                    <label htmlFor="new-source-course" className={LABEL_CLASS}>
                      Course to copy
                    </label>
                    <select
                      id="new-source-course"
                      value={sourceCourse?.id ?? ""}
                      onChange={(event) => {
                        setSourceCourseId(event.target.value);
                        setTypedShift(null);
                      }}
                      className={cn(fieldClass, "w-full")}
                    >
                      {courses.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.code} · {candidate.title}
                          {candidate.status === "archived" ? " (archived)" : ""}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ) : null}

            {source ? (
              <p className="mt-3 text-sm text-ink-2">
                Copies {source.modules.length} {source.modules.length === 1 ? "unit" : "units"} and{" "}
                {courseLessons(source).length} {courseLessons(source).length === 1 ? "lesson" : "lessons"}, with the
                sections and their schedules. Students, progress and grades are not copied. Unit quizzes are not
                copied yet.
              </p>
            ) : null}
          </fieldset>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">The new course</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label htmlFor="new-title" className={LABEL_CLASS}>
                Name
              </label>
              <input id="new-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-code" className={LABEL_CLASS}>
                Code
              </label>
              <input
                id="new-code"
                type="text"
                placeholder="e.g. BIO-202"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={cn(fieldClass, "w-full uppercase placeholder:normal-case")}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="new-term" className={LABEL_CLASS}>
                Term
              </label>
              <select
                id="new-term"
                value={termId}
                onChange={(event) => {
                  setChosenTermId(event.target.value);
                  setTypedShift(null);
                }}
                className={cn(fieldClass, "w-full")}
              >
                {openTerms.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({formatDate(candidate.startsOn, true)} to {formatDate(candidate.endsOn, true)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {source ? (
          <Card className="p-5">
            <h2 className="text-lg font-semibold tracking-tight">Move the dates</h2>
            {dateCount === 0 ? (
              <p className="mt-1 text-sm text-ink-2">
                The course you are copying has no dates of its own, so there is nothing to move. The new term&apos;s
                dates apply.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  The course you are copying has {dateCount} {dateCount === 1 ? "date" : "dates"}: its first and last
                  day and each lesson&apos;s release time. They all move by the same number of days.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="new-shift" className={LABEL_CLASS}>
                      Days to move by
                    </label>
                    <input
                      id="new-shift"
                      type="number"
                      inputMode="numeric"
                      value={shiftText}
                      onChange={(event) => setTypedShift(event.target.value)}
                      aria-describedby="new-shift-hint"
                      className={cn(fieldClass, "w-28")}
                    />
                  </div>
                  {typedShift !== null && typedShift !== String(suggestedShift) ? (
                    <Button variant="ghost" size="sm" onClick={() => setTypedShift(null)}>
                      Use the suggestion ({suggestedShift})
                    </Button>
                  ) : null}
                </div>
                <p id="new-shift-hint" role="status" className="mt-2 text-sm text-ink-2">
                  {sourceStart && Number.isInteger(shiftDays)
                    ? `The first day moves from ${formatDate(sourceStart, true)} to ${formatDate(shiftDate(sourceStart, shiftDays), true)}.`
                    : "Enter a whole number. A negative number moves the dates earlier."}
                </p>
              </>
            )}
          </Card>
        ) : null}

        {problems.length > 0 ? (
          <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || openTerms.length === 0}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Create course
          </Button>
          <ButtonLink href="/courses" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </PageContainer>
  );
}
