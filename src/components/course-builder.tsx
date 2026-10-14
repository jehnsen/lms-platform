"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  Eye,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ForbiddenView } from "@/components/forbidden-view";
import { LessonEditor } from "@/components/lesson-editor";
import { NotFoundView } from "@/components/not-found-view";
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
import {
  COURSE_COVERS,
  CourseError,
  makeId,
  saveCourse,
  saveCourseAsTemplate,
  useCourseEditor,
  useTerms,
} from "@/lib/api/courses";
import { useMaterials } from "@/lib/api/materials";
import { countCourseDates, shiftCourseDates } from "@/lib/domain/course-copy";
import { LESSON_TYPE_LABELS, moveItem, sectionCode } from "@/lib/domain/course-outline";
import { WEEKDAYS, type SectionDraft } from "@/lib/domain/course-rules";
import type { Course, CourseModule, Lesson, Level, Meeting, Section } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced"];
const LABEL_CLASS = "mb-1 block text-sm font-medium";
const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad disabled:pointer-events-none disabled:opacity-40";

interface Draft {
  course: Course;
  sections: SectionDraft[];
}

interface EditingLesson {
  unitId: string;
  lesson: Lesson;
  isNew: boolean;
}

function toDraft(course: Course, sections: Section[]): Draft {
  return { course, sections: sections.map(({ id, name, meetings }) => ({ id, name, meetings })) };
}

/** For telling whether the draft differs from what is saved. The order of sections does not matter. */
function fingerprint({ course, sections }: Draft) {
  return JSON.stringify({ course, sections: [...sections].sort((a, b) => a.id.localeCompare(b.id)) });
}

/** The course builder (US-06, US-08, US-09): details, sections and schedule, and the outline of units and lessons. */
export function CourseBuilder({ courseId }: { courseId: string }) {
  const editor = useCourseEditor(courseId);
  if (editor.status === "loading") return <PageSkeleton />;
  if (editor.status === "missing") return <NotFoundView message="This course doesn't exist, or it has been removed." />;
  if (editor.status === "forbidden") return <ForbiddenView resource={`course:${courseId}:edit`} what="this course's editor" />;
  return (
    <BuilderForm
      saved={toDraft(editor.course, editor.sections)}
      enrolledBySection={editor.enrolledBySection}
      readOnly={editor.readOnly}
    />
  );
}

function BuilderForm({
  saved,
  enrolledBySection,
  readOnly,
}: {
  saved: Draft;
  enrolledBySection: Record<string, number>;
  readOnly: boolean;
}) {
  const terms = useTerms();
  const materials = useMaterials() ?? [];
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState<EditingLesson | null>(null);
  const [namingTemplate, setNamingTemplate] = useState(false);
  const [shiftDays, setShiftDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState("");

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => {
      setEditing(null);
      setNamingTemplate(false);
    };
  }, []);

  const { course, sections } = draft;
  const dirty = fingerprint(draft) !== fingerprint(saved);
  const dateCount = countCourseDates(course);

  const change = (next: Draft) => {
    setDraft(next);
    setNote("");
  };
  const setCourse = (changes: Partial<Course>) => change({ ...draft, course: { ...course, ...changes } });
  const setModules = (modules: CourseModule[]) => setCourse({ modules });
  const setUnit = (unitId: string, changes: Partial<CourseModule>) =>
    setModules(course.modules.map((unit) => (unit.id === unitId ? { ...unit, ...changes } : unit)));
  const setSections = (next: SectionDraft[]) => change({ ...draft, sections: next });
  const setSection = (sectionId: string, changes: Partial<SectionDraft>) =>
    setSections(sections.map((section) => (section.id === sectionId ? { ...section, ...changes } : section)));

  const addSection = () => {
    const used = sections.map((section) => section.name.trim().toLowerCase());
    const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((candidate) => !used.includes(`section ${candidate.toLowerCase()}`));
    setSections([...sections, { id: makeId("section"), name: `Section ${letter ?? sections.length + 1}`, meetings: [] }]);
  };

  const removeSection = (sectionId: string) =>
    change({
      // A lesson limited to the removed section is no longer limited to it.
      course: {
        ...course,
        modules: course.modules.map((unit) => ({
          ...unit,
          lessons: unit.lessons.map((lesson) =>
            lesson.sectionIds?.includes(sectionId)
              ? { ...lesson, sectionIds: lesson.sectionIds.filter((id) => id !== sectionId) }
              : lesson,
          ),
        })),
      },
      sections: sections.filter((section) => section.id !== sectionId),
    });

  const setMeeting = (section: SectionDraft, index: number, changes: Partial<Meeting>) =>
    setSection(section.id, {
      meetings: section.meetings.map((meeting, position) => (position === index ? { ...meeting, ...changes } : meeting)),
    });

  const addUnit = () => setModules([...course.modules, { id: makeId("unit"), title: "", lessons: [] }]);

  const startLesson = (unitId: string) =>
    setEditing({
      unitId,
      isNew: true,
      lesson: {
        id: makeId("lesson"),
        title: "",
        type: "reading",
        minutes: 10,
        summary: "",
        keyPoints: [],
        thumbnail: course.thumbnail,
      },
    });

  const applyLesson = (lesson: Lesson, toUnitId: string) => {
    setModules(
      course.modules.map((unit) => {
        const without = unit.lessons.filter((candidate) => candidate.id !== lesson.id);
        if (unit.id !== toUnitId) return without.length === unit.lessons.length ? unit : { ...unit, lessons: without };
        // Edited in place when it stays in its unit; added at the end when it is new or has moved here.
        const position = unit.lessons.findIndex((candidate) => candidate.id === lesson.id);
        return {
          ...unit,
          lessons: position === -1 ? [...without, lesson] : unit.lessons.map((candidate) => (candidate.id === lesson.id ? lesson : candidate)),
        };
      }),
    );
    setEditing(null);
  };

  const save = async () => {
    setBusy(true);
    setProblems([]);
    setNote("");
    try {
      await saveCourse(course, sections);
      // Match what was stored: the code in capitals, names without stray spaces.
      setDraft({
        course: { ...course, title: course.title.trim(), code: course.code.trim().toUpperCase() },
        sections: sections.map((section) => ({ ...section, name: section.name.trim() })),
      });
      setNote("Saved. Students see the changes straight away.");
    } catch (error) {
      setProblems(error instanceof CourseError ? error.problems : [error instanceof Error ? error.message : "Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  };

  const shiftDates = () => {
    const days = Number(shiftDays);
    if (!Number.isInteger(days) || days === 0) {
      setProblems(["Enter a whole number of days to move the dates by. Use a minus sign to move them earlier."]);
      return;
    }
    setProblems([]);
    change({ ...draft, course: shiftCourseDates(course, days) });
    setNote(`${dateCount} ${dateCount === 1 ? "date" : "dates"} moved ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ${days > 0 ? "later" : "earlier"}. Save to keep the change.`);
  };

  return (
    <PageContainer className="max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/courses" className="hover:text-ink">
          Courses
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link href={`/courses/${course.id}`} className="hover:text-ink">
          {saved.course.title}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">Edit</span>
      </nav>

      <PageHeader
        title="Edit course"
        description="Details, sections and schedule, then the units and lessons in the order students follow them."
        actions={
          <>
            <ButtonLink href={`/courses/${course.id}`} variant="secondary">
              <Eye aria-hidden className="size-4" />
              View course
            </ButtonLink>
            <Button variant="secondary" disabled={dirty} onClick={() => setNamingTemplate(true)} title={dirty ? "Save the course first" : undefined}>
              Save as template
            </Button>
          </>
        }
      />

      {readOnly ? (
        <p role="status" className="mb-6 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          This course is in an archived term. It can be looked at here and copied into a new course, but not changed.
        </p>
      ) : null}

      {/* A disabled fieldset switches off every control inside it, which is how an archived course is read-only here. */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">Course</legend>

        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label htmlFor="course-title" className={LABEL_CLASS}>
                Name
              </label>
              <input id="course-title" type="text" value={course.title} onChange={(event) => setCourse({ title: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="course-code" className={LABEL_CLASS}>
                Code
              </label>
              <input id="course-code" type="text" value={course.code} onChange={(event) => setCourse({ code: event.target.value })} className={cn(fieldClass, "w-full uppercase")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="course-term" className={LABEL_CLASS}>
                Term
              </label>
              <select id="course-term" value={course.termId} onChange={(event) => setCourse({ termId: event.target.value })} className={cn(fieldClass, "w-full")}>
                {terms
                  .filter((term) => term.status !== "archived" || term.id === course.termId)
                  .map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="course-start" className={LABEL_CLASS}>
                First day
              </label>
              <input id="course-start" type="date" value={course.startsOn ?? ""} onChange={(event) => setCourse({ startsOn: event.target.value || undefined })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="course-end" className={LABEL_CLASS}>
                Last day
              </label>
              <input id="course-end" type="date" value={course.endsOn ?? ""} onChange={(event) => setCourse({ endsOn: event.target.value || undefined })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="course-subject" className={LABEL_CLASS}>
                Subject
              </label>
              <input id="course-subject" type="text" value={course.subject} onChange={(event) => setCourse({ subject: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="course-level" className={LABEL_CLASS}>
                Level
              </label>
              <select id="course-level" value={course.level} onChange={(event) => setCourse({ level: event.target.value as Level })} className={cn(fieldClass, "w-full")}>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="course-tagline" className={LABEL_CLASS}>
                One-line summary
              </label>
              <input id="course-tagline" type="text" value={course.tagline} onChange={(event) => setCourse({ tagline: event.target.value })} className={cn(fieldClass, "w-full")} />
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="course-description" className={LABEL_CLASS}>
                Description
              </label>
              <textarea
                id="course-description"
                rows={3}
                value={course.description}
                onChange={(event) => setCourse({ description: event.target.value })}
                className={cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed")}
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="course-cover" className={LABEL_CLASS}>
                Cover photo
              </label>
              <select id="course-cover" value={course.thumbnail} onChange={(event) => setCourse({ thumbnail: event.target.value })} className={cn(fieldClass, "w-full")}>
                {COURSE_COVERS.map((cover) => (
                  <option key={cover.src} value={cover.src}>
                    {cover.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Sections and schedule</h2>
              <p className="mt-1 text-sm text-ink-2">
                Each section is a class group with its own weekly meeting times. Students are placed in sections by the
                school&apos;s import or SIS sync.
              </p>
            </div>
            <Button variant="secondary" onClick={addSection}>
              <Plus aria-hidden className="size-4" />
              Add section
            </Button>
          </div>

          <ul className="mt-4 flex flex-col gap-4">
            {sections.map((section, sectionIndex) => {
              const enrolled = enrolledBySection[section.id] ?? 0;
              const label = section.name.trim() || `Section ${sectionIndex + 1}`;
              return (
                <li key={section.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <label htmlFor={`section-name-${section.id}`} className={LABEL_CLASS}>
                        Section name
                      </label>
                      <input
                        id={`section-name-${section.id}`}
                        type="text"
                        value={section.name}
                        onChange={(event) => setSection(section.id, { name: event.target.value })}
                        className={cn(fieldClass, "w-full")}
                      />
                    </div>
                    <p className="pb-2.5 text-sm text-ink-2">
                      <span className="font-mono text-xs">{sectionCode(course.code || "CODE", section.name || "?")}</span> ·{" "}
                      {enrolled} {enrolled === 1 ? "student" : "students"}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      disabled={enrolled > 0 || sections.length === 1}
                      aria-label={`Remove ${label}`}
                      title={enrolled > 0 ? "A section with students cannot be removed" : sections.length === 1 ? "A course needs at least one section" : undefined}
                      className={cn(ICON_BUTTON, "mb-1")}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>

                  <fieldset className="mt-3">
                    <legend className="text-sm font-medium">Weekly meetings</legend>
                    {section.meetings.length === 0 ? (
                      <p className="mt-1 text-sm text-ink-3">No meeting times yet.</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {section.meetings.map((meeting, index) => (
                          <li key={index} className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`${label}, meeting ${index + 1}: day`}
                              value={meeting.day}
                              onChange={(event) => setMeeting(section, index, { day: Number(event.target.value) })}
                              className={fieldClass}
                            >
                              {WEEKDAYS.map((day, dayIndex) => (
                                <option key={day} value={dayIndex}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <input
                              type="time"
                              aria-label={`${label}, meeting ${index + 1}: starts`}
                              value={meeting.start}
                              onChange={(event) => setMeeting(section, index, { start: event.target.value })}
                              className={fieldClass}
                            />
                            <span className="text-sm text-ink-3">to</span>
                            <input
                              type="time"
                              aria-label={`${label}, meeting ${index + 1}: ends`}
                              value={meeting.end}
                              onChange={(event) => setMeeting(section, index, { end: event.target.value })}
                              className={fieldClass}
                            />
                            <input
                              type="text"
                              aria-label={`${label}, meeting ${index + 1}: room`}
                              placeholder="Room"
                              value={meeting.room ?? ""}
                              onChange={(event) => setMeeting(section, index, { room: event.target.value || undefined })}
                              className={cn(fieldClass, "w-32")}
                            />
                            <button
                              type="button"
                              aria-label={`Remove meeting ${index + 1} of ${label}`}
                              onClick={() => setSection(section.id, { meetings: section.meetings.filter((_, position) => position !== index) })}
                              className={ICON_BUTTON}
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setSection(section.id, { meetings: [...section.meetings, { day: 1, start: "09:00", end: "10:00" }] })}
                    >
                      <Plus aria-hidden className="size-4" />
                      Add a meeting<span className="sr-only"> to {label}</span>
                    </Button>
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Units and lessons</h2>
              <p className="mt-1 text-sm text-ink-2">
                Students see units and lessons in this order. Drag the handle, or use the arrow buttons, to reorder.
              </p>
            </div>
            <Button variant="secondary" onClick={addUnit}>
              <Plus aria-hidden className="size-4" />
              Add unit
            </Button>
          </div>

          {course.modules.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">
              No units yet. Add a unit, then add lessons to it.
            </p>
          ) : (
            <SortableList
              items={course.modules}
              label="Units"
              nameOf={(unit) => unit.title || "Untitled unit"}
              onMove={(from, to) => setModules(moveItem(course.modules, from, to))}
              disabled={readOnly}
              className="mt-4 flex flex-col gap-4"
              itemClassName="rounded-lg border border-line bg-surface p-3 sm:p-4"
              renderItem={(unit, controls, unitIndex) => (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {controls}
                    <label htmlFor={`unit-title-${unit.id}`} className="shrink-0 text-sm font-medium text-ink-3">
                      Unit {unitIndex + 1}
                    </label>
                    <input
                      id={`unit-title-${unit.id}`}
                      type="text"
                      placeholder="Unit title"
                      value={unit.title}
                      onChange={(event) => setUnit(unit.id, { title: event.target.value })}
                      className={cn(fieldClass, "min-w-0 flex-1 basis-40 font-medium")}
                    />
                    {unit.quizId ? (
                      <Badge>
                        <ListChecks aria-hidden className="size-3" />
                        Has a quiz
                      </Badge>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setModules(course.modules.filter((candidate) => candidate.id !== unit.id))}
                      disabled={unit.quizId !== undefined}
                      aria-label={`Remove ${unit.title || `unit ${unitIndex + 1}`} and its lessons`}
                      title={unit.quizId ? "A unit with a quiz cannot be removed here" : undefined}
                      className={ICON_BUTTON}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>

                  {unit.lessons.length > 0 ? (
                    <SortableList
                      items={unit.lessons}
                      label={`Lessons in ${unit.title || `unit ${unitIndex + 1}`}`}
                      nameOf={(lesson) => lesson.title}
                      onMove={(from, to) => setUnit(unit.id, { lessons: moveItem(unit.lessons, from, to) })}
                      disabled={readOnly}
                      className="mt-3 flex flex-col gap-1"
                      itemClassName="rounded-lg bg-surface-2"
                      renderItem={(lesson, lessonControls) => (
                        <LessonRow
                          lesson={lesson}
                          controls={lessonControls}
                          sections={sections}
                          onEdit={() => setEditing({ unitId: unit.id, lesson, isNew: false })}
                          onRemove={() => setUnit(unit.id, { lessons: unit.lessons.filter((candidate) => candidate.id !== lesson.id) })}
                        />
                      )}
                    />
                  ) : (
                    <p className="mt-3 text-sm text-ink-3">No lessons in this unit yet.</p>
                  )}

                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => startLesson(unit.id)}>
                    <Plus aria-hidden className="size-4" />
                    Add lesson<span className="sr-only"> to {unit.title || `unit ${unitIndex + 1}`}</span>
                  </Button>
                </>
              )}
            />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold tracking-tight">Move every date</h2>
          <p className="mt-1 text-sm text-ink-2">
            {dateCount === 0
              ? "This course has no dates yet: no first or last day and no lesson release times."
              : `Shifts the ${dateCount} ${dateCount === 1 ? "date" : "dates"} in this course together: its first and last day and every lesson release time.`}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="course-shift-days" className={LABEL_CLASS}>
                Days (negative moves earlier)
              </label>
              <input
                id="course-shift-days"
                type="number"
                inputMode="numeric"
                value={shiftDays}
                onChange={(event) => setShiftDays(event.target.value)}
                className={cn(fieldClass, "w-28")}
              />
            </div>
            <Button variant="secondary" disabled={dateCount === 0} onClick={shiftDates}>
              Move dates
            </Button>
          </div>
        </Card>

        <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-bg px-4 py-3 sm:mx-0 sm:rounded-xl sm:border sm:bg-surface sm:px-5 sm:shadow-md">
          {problems.length > 0 ? (
            <div role="alert" className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              <p className="font-medium">The course was not saved:</p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-ink-2">
              {note || (dirty ? "You have unsaved changes." : "Everything is saved.")}
            </p>
            <Button onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
              Save course
            </Button>
          </div>
        </div>
      </fieldset>

      {editing ? (
        <LessonEditor
          key={editing.lesson.id}
          lesson={editing.lesson}
          isNew={editing.isNew}
          unitId={editing.unitId}
          units={course.modules.map(({ id, title }) => ({ id, title }))}
          sections={sections}
          materials={materials}
          onSave={applyLesson}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {namingTemplate ? (
        <TemplateDialog courseId={course.id} courseTitle={saved.course.title} onClose={() => setNamingTemplate(false)} />
      ) : null}
    </PageContainer>
  );
}

function LessonRow({
  lesson,
  controls,
  sections,
  onEdit,
  onRemove,
}: {
  lesson: Lesson;
  controls: React.ReactNode;
  sections: SectionDraft[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const limitedTo = sections.filter((section) => lesson.sectionIds?.includes(section.id)).map((section) => section.name);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 pr-1">
      {controls}
      <div className="min-w-0 flex-1 basis-48">
        <div className="truncate text-sm font-medium">{lesson.title || "Untitled lesson"}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          {LESSON_TYPE_LABELS[lesson.type]} · {lesson.minutes} min
          {lesson.releaseAt ? (
            <Badge tone="warn">
              <CalendarClock aria-hidden className="size-3" />
              Releases {formatDateTime(lesson.releaseAt)}
            </Badge>
          ) : null}
          {limitedTo.length > 0 ? (
            <Badge tone="primary">
              <Users aria-hidden className="size-3" />
              {limitedTo.join(", ")} only
            </Badge>
          ) : null}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil aria-hidden className="size-4" />
        Edit<span className="sr-only"> {lesson.title || "untitled lesson"}</span>
      </Button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${lesson.title || "untitled lesson"}`} className={ICON_BUTTON}>
        <Trash2 aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** FR-2.5: save the course's structure and content as a template for any teacher to start from. */
function TemplateDialog({ courseId, courseTitle, onClose }: { courseId: string; courseTitle: string; onClose: () => void }) {
  const [name, setName] = useState(`${courseTitle} template`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await saveCourseAsTemplate(courseId, name);
      setDone(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Save as template" description="The units, lessons, sections and schedule are copied. No students, progress or grades." onClose={onClose}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-ink-2">
            Saved. Every teacher can now start a course from “{name.trim()}” on the New course page.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div>
            <label htmlFor="template-name" className={LABEL_CLASS}>
              Template name
            </label>
            <input id="template-name" type="text" value={name} onChange={(event) => setName(event.target.value)} className={cn(fieldClass, "w-full")} />
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-bad">
              {failure}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              Save template
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
