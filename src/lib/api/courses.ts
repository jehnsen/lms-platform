"use client";

/**
 * Courses service: the catalogue, who may see which lesson, course authoring,
 * copies and templates, and the term-end archive.
 *
 * Backend seam: `GET /courses` and `GET /courses/:id` (already filtered to the
 * lessons the caller may see), `POST /courses` (blank, from a template or as
 * a copy), `PUT /courses/:id`, `GET /courses/:id/roster`,
 * `GET|POST|DELETE /course-templates`, `GET /terms`,
 * `POST /terms/:id/archive` and `POST /terms/:id/reopen`.
 */
import { useMemo } from "react";
import { nowIso, todayIso } from "@/lib/clock";
import { courseForViewer, type ContentViewer } from "@/lib/domain/content-visibility";
import { copyCourse, type CourseCopy } from "@/lib/domain/course-copy";
import { sectionCode } from "@/lib/domain/course-outline";
import { courseProblems, type CourseRulesContext, type SectionDraft } from "@/lib/domain/course-rules";
import { can, scopeFor } from "@/lib/domain/permissions";
import { isCourseArchived, isTermDueForArchive } from "@/lib/domain/terms";
import type { Course, CourseTemplate, Enrollment, Section, Term, User } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { useRepository } from "./_repository";
import {
  coursesRepo,
  enrollmentsRepo,
  gradebookSetupsRepo,
  materialsRepo,
  quizzesRepo,
  sectionsRepo,
  templatesRepo,
  termsRepo,
  usersRepo,
} from "./_stores";
import { notify } from "./notifications";
import { authorize, recordAudit, useActor, type CurrentUser } from "./session";

const NO_COURSES: Course[] = [];
const NO_SECTIONS: Section[] = [];
const NO_TEMPLATES: CourseTemplate[] = [];

// --- Reading courses ---------------------------------------------------------

/** Students see what their sections may see (US-09); everyone else with access sees everything. */
function viewerOf(
  user: Pick<User, "id" | "role">,
  courseId: string,
  sections: Section[],
  enrollments: Enrollment[],
): ContentViewer {
  if (user.role !== "student") return { staff: true, sectionIds: [] };
  const courseSectionIds = sections.filter((section) => section.courseId === courseId).map((section) => section.id);
  return {
    staff: false,
    sectionIds: enrollments
      .filter((entry) => entry.userId === user.id && courseSectionIds.includes(entry.sectionId))
      .map((entry) => entry.sectionId),
  };
}

/** A course in an archived term is handed out with `status: "archived"` (FR-1.8). */
function withArchiveState(course: Course, archived: boolean): Course {
  return archived && course.status !== "archived" ? { ...course, status: "archived" } : course;
}

/**
 * The courses a student is enrolled in, each cut down to the lessons released
 * to that student's sections. Also used to show a parent their child's courses.
 */
export function coursesForLearner(
  learner: Pick<User, "id" | "role">,
  all: Course[],
  sections: Section[],
  enrollments: Enrollment[],
  terms: Term[],
  nowMs: number,
): Course[] {
  const sectionIds = enrollments.filter((entry) => entry.userId === learner.id).map((entry) => entry.sectionId);
  const courseIds = sections.filter((section) => sectionIds.includes(section.id)).map((section) => section.courseId);
  return all
    .filter((course) => courseIds.includes(course.id))
    .map((course) =>
      withArchiveState(
        courseForViewer(course, viewerOf({ id: learner.id, role: "student" }, course.id, sections, enrollments), nowMs),
        isCourseArchived(course, terms),
      ),
    );
}

function courseFor(actor: CurrentUser, course: Course, sections: Section[], enrollments: Enrollment[], nowMs: number) {
  return withArchiveState(
    courseForViewer(course, viewerOf(actor, course.id, sections, enrollments), nowMs),
    actor.readOnlyCourseIds.includes(course.id),
  );
}

/**
 * The courses the signed-in user may open: enrolled, taught, or all for
 * admins. Students get only the lessons released to their sections.
 */
export function useCourses(): Course[] {
  const actor = useActor();
  const all = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const now = useNow();
  return useMemo(() => {
    if (!actor) return NO_COURSES;
    return all
      .filter((course) => can(actor, "view", { type: "course", courseId: course.id }))
      .map((course) => courseFor(actor, course, sections, enrollments, now));
  }, [actor, all, sections, enrollments, now]);
}

export type CourseAccess =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      /** The course as the signed-in user may see it. */
      course: Course;
      /** May change the course. Always false once it is archived. */
      canEdit: boolean;
      /** Sees every lesson, including scheduled and section-restricted ones. */
      staff: boolean;
    };

/** One course, with why it cannot be shown when it cannot. */
export function useCourse(courseId: string | undefined): CourseAccess {
  const actor = useActor();
  const all = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const now = useNow();
  return useMemo((): CourseAccess => {
    if (actor === undefined) return { status: "loading" };
    const course = all.find((candidate) => candidate.id === courseId);
    if (!course) return { status: "missing" };
    if (!can(actor, "view", { type: "course", courseId: course.id })) return { status: "forbidden" };
    return {
      status: "ok",
      course: courseFor(actor!, course, sections, enrollments, now),
      canEdit: can(actor, "update", { type: "course", courseId: course.id }),
      staff: actor!.role !== "student",
    };
  }, [actor, all, sections, enrollments, now, courseId]);
}

/** The titles of courses by id, for labels. Limited to courses the signed-in user may open. */
export function useCourseTitles(): Record<string, string> {
  const courses = useCourses();
  return useMemo(() => Object.fromEntries(courses.map((course) => [course.id, course.title])), [courses]);
}

/** FR-1.8: true when the course is archived, so it can be viewed but not changed. */
export function useCourseReadOnly(courseId: string | undefined): boolean {
  const actor = useActor();
  return Boolean(actor && courseId !== undefined && actor.readOnlyCourseIds.includes(courseId));
}

/** The sections of a course, for anyone who may open it. */
export function useCourseSections(courseId: string | undefined): Section[] {
  const actor = useActor();
  const sections = useRepository(sectionsRepo);
  return useMemo(() => {
    if (courseId === undefined || !can(actor, "view", { type: "course", courseId })) return NO_SECTIONS;
    return sections
      .filter((section) => section.courseId === courseId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [actor, sections, courseId]);
}

/** The sections of a course that concern the signed-in user: a student's own, or all of them for staff. */
export function useMySections(courseId: string | undefined): Section[] {
  const actor = useActor();
  const sections = useCourseSections(courseId);
  const enrollments = useRepository(enrollmentsRepo);
  return useMemo(() => {
    if (!actor || actor.role !== "student") return sections;
    const mine = enrollments.filter((entry) => entry.userId === actor.id).map((entry) => entry.sectionId);
    return sections.filter((section) => mine.includes(section.id));
  }, [actor, sections, enrollments]);
}

export interface CourseRoster {
  sections: Section[];
  students: User[];
  /** Section id for each student id. */
  sectionOf: Record<string, string>;
}

/**
 * Who takes a course. `null` unless the signed-in user may see its gradebook
 * (the faculty who teach it, and admins).
 */
export function useCourseRoster(courseId: string): CourseRoster | null {
  const actor = useActor();
  const users = useRepository(usersRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);

  return useMemo(() => {
    if (!can(actor, "view", { type: "gradebook", courseId })) return null;
    const courseSections = sections.filter((section) => section.courseId === courseId);
    const sectionIds = courseSections.map((section) => section.id);
    const sectionOf: Record<string, string> = {};
    for (const entry of enrollments) {
      if (sectionIds.includes(entry.sectionId)) sectionOf[entry.userId] = entry.sectionId;
    }
    const students = users
      .filter((user) => user.role === "student" && user.status === "active" && user.id in sectionOf)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { sections: courseSections, students, sectionOf };
  }, [actor, courseId, users, sections, enrollments]);
}

export function useTerms(): Term[] {
  return useRepository(termsRepo);
}

/** May the signed-in user create courses (FR-2.1)? */
export function useCanCreateCourse(): boolean {
  return can(useActor(), "create", { type: "course" });
}

// --- Authoring (US-06, US-08, US-09) -----------------------------------------

/** A course that cannot be saved, with every reason. */
export class CourseError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "CourseError";
  }
}

export type CourseEditorState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      /** The whole course, with nothing hidden. */
      course: Course;
      sections: Section[];
      /** Students enrolled in each section. */
      enrolledBySection: Record<string, number>;
      /** Archived: it can be looked at in the builder but not saved (FR-1.8). */
      readOnly: boolean;
    };

/** What the course builder edits. Only for roles that may change courses. */
export function useCourseEditor(courseId: string): CourseEditorState {
  const actor = useActor();
  const all = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);
  return useMemo((): CourseEditorState => {
    if (actor === undefined) return { status: "loading" };
    const course = all.find((candidate) => candidate.id === courseId);
    if (!course) return { status: "missing" };
    const mayAuthor = actor !== null && scopeFor(actor.role, "update", "course") !== undefined;
    if (!mayAuthor || !can(actor, "view", { type: "course", courseId })) return { status: "forbidden" };
    const courseSections = sections
      .filter((section) => section.courseId === courseId)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      status: "ok",
      course,
      sections: courseSections,
      enrolledBySection: Object.fromEntries(
        courseSections.map((section) => [
          section.id,
          enrollments.filter((entry) => entry.sectionId === section.id).length,
        ]),
      ),
      readOnly: actor!.readOnlyCourseIds.includes(courseId),
    };
  }, [actor, all, sections, enrollments, courseId]);
}

let idCounter = 0;

/** A new id for a course, section, unit, lesson or template. */
export function makeId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function rulesContext(courseId: string | null): CourseRulesContext {
  const enrollments = enrollmentsRepo.get();
  const current = courseId === null ? [] : sectionsRepo.get().filter((section) => section.courseId === courseId);
  return {
    terms: termsRepo.get(),
    otherCourseCodes: coursesRepo
      .get()
      .filter((course) => course.id !== courseId)
      .map((course) => course.code),
    enrolledBySection: Object.fromEntries(
      current.map((section) => [section.id, enrollments.filter((entry) => entry.sectionId === section.id).length]),
    ),
    currentSectionIds: current.map((section) => section.id),
    materialIds: materialsRepo.get().map((material) => material.id),
  };
}

/** Cover photos shipped with the app. A new course starts with the first. */
export const COURSE_COVERS = [
  { src: "/thumbnails/course-ml-foundations.jpg", label: "Circuit board" },
  { src: "/thumbnails/course-web-dev.jpg", label: "Code on a screen" },
  { src: "/thumbnails/course-cell-biology.jpg", label: "Microscope" },
  { src: "/thumbnails/course-money-skills.jpg", label: "Coins and notebook" },
];

export type CourseSource =
  | { kind: "blank" }
  | { kind: "template"; templateId: string }
  | { kind: "course"; courseId: string };

export interface NewCourseInput {
  title: string;
  code: string;
  termId: string;
  source: CourseSource;
  /** US-08: days to move every date in a copied course by. */
  shiftDays: number;
}

/**
 * FR-2.1, FR-2.5: create a course, blank, from a template or as a copy of one
 * the caller can open. A copy takes the structure and content and no student
 * data; its sections start empty and are taught by the caller. Returns the id.
 */
export async function createCourse(input: NewCourseInput): Promise<string> {
  const actor = authorize("create", { type: "course" });
  const title = input.title.trim();
  const code = input.code.trim().toUpperCase();
  const target = { title, code, termId: input.termId, instructor: actor.name, facultyId: actor.id, shiftDays: input.shiftDays };

  let draft: CourseCopy;
  let gradebook: CourseTemplate["gradebook"];
  if (input.source.kind === "blank") {
    const term = termsRepo.get().find((candidate) => candidate.id === input.termId);
    const courseId = makeId("course");
    draft = {
      course: {
        id: courseId,
        title,
        tagline: "",
        description: "",
        subject: "General",
        level: "Beginner",
        instructor: actor.name,
        code,
        termId: input.termId,
        status: "active",
        startsOn: term?.startsOn,
        endsOn: term?.endsOn,
        thumbnail: COURSE_COVERS[0].src,
        accent: "#17346b",
        learners: 0,
        rating: 0,
        modules: [],
      },
      quizzes: [],
      sections: [
        {
          id: makeId("section"),
          courseId,
          termId: input.termId,
          name: "Section A",
          code: sectionCode(code, "Section A"),
          facultyIds: [actor.id],
          meetings: [],
        },
      ],
    };
  } else if (input.source.kind === "template") {
    const { templateId } = input.source;
    authorize("view", { type: "course-template" });
    const template = templatesRepo.get().find((candidate) => candidate.id === templateId);
    if (!template) throw new CourseError(["That template no longer exists."]);
    draft = copyCourse(template, target, makeId);
    gradebook = template.gradebook;
  } else {
    const { courseId } = input.source;
    authorize("view", { type: "course", courseId });
    const source = coursesRepo.get().find((candidate) => candidate.id === courseId);
    if (!source) throw new CourseError(["The course to copy no longer exists."]);
    draft = copyCourse(
      {
        course: source,
        sections: sectionsRepo.get().filter((section) => section.courseId === courseId),
        quizzes: quizzesRepo.get(),
      },
      target,
      makeId,
    );
    gradebook = gradebookSetupsRepo.get()[courseId];
  }

  const problems = courseProblems(draft.course, draft.sections, rulesContext(null));
  if (problems.length > 0) throw new CourseError(problems);

  coursesRepo.update((courses) => [...courses, draft.course]);
  sectionsRepo.update((sections) => [...sections, ...draft.sections]);
  if (draft.quizzes.length > 0) quizzesRepo.update((quizzes) => [...quizzes, ...draft.quizzes]);
  // US-08, US-16: a copy is graded the way its source was. Held quiz scores belong to the source's students.
  if (gradebook) {
    const { categories, scaleId, missingAsZero } = gradebook;
    gradebookSetupsRepo.update((setups) => ({
      ...setups,
      [draft.course.id]: { courseId: draft.course.id, categories, scaleId, missingAsZero, heldQuizIds: [] },
    }));
  }
  recordAudit({
    action: "course.create",
    resource: `course:${draft.course.id}`,
    outcome: "allowed",
    detail:
      input.source.kind === "blank"
        ? `${code}, blank`
        : input.source.kind === "template"
          ? `${code}, from template ${input.source.templateId}`
          : `${code}, copy of ${input.source.courseId}, dates moved ${input.shiftDays} days`,
  });
  return draft.course.id;
}

/**
 * FR-2.1, FR-2.2: save a course's details, sections, schedule and outline.
 * Everything is checked first; nothing is saved if anything is wrong.
 */
export async function saveCourse(course: Course, sections: SectionDraft[]): Promise<void> {
  const actor = authorize("update", { type: "course", courseId: course.id });
  const existing = coursesRepo.get().find((candidate) => candidate.id === course.id);
  if (!existing) throw new CourseError(["This course no longer exists."]);

  const problems = courseProblems(course, sections, rulesContext(course.id));
  if (problems.length > 0) throw new CourseError(problems);

  const code = course.code.trim().toUpperCase();
  const saved: Course = { ...course, title: course.title.trim(), code, status: existing.status };
  const current = sectionsRepo.get().filter((section) => section.courseId === course.id);
  // A new section is taught by whoever already teaches the course.
  const teachers = current[0]?.facultyIds ?? [actor.id];
  const nextSections: Section[] = sections.map((draft) => ({
    id: draft.id,
    courseId: course.id,
    termId: course.termId,
    name: draft.name.trim(),
    code: sectionCode(code, draft.name),
    facultyIds: current.find((section) => section.id === draft.id)?.facultyIds ?? teachers,
    meetings: draft.meetings,
  }));

  coursesRepo.update((courses) => courses.map((candidate) => (candidate.id === course.id ? saved : candidate)));
  sectionsRepo.update((all) => [...all.filter((section) => section.courseId !== course.id), ...nextSections]);
  recordAudit({ action: "course.update", resource: `course:${course.id}`, outcome: "allowed" });
}

/** Course templates, newest first. Empty unless the signed-in user may use them. */
export function useTemplates(): CourseTemplate[] {
  const actor = useActor();
  const templates = useRepository(templatesRepo);
  return useMemo(() => {
    if (!can(actor, "view", { type: "course-template" })) return NO_TEMPLATES;
    return [...templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [actor, templates]);
}

/** FR-2.5: save a course's structure and content as a template every teacher can start from. */
export async function saveCourseAsTemplate(courseId: string, name: string): Promise<void> {
  const actor = authorize("create", { type: "course-template" });
  authorize("view", { type: "course", courseId });
  const course = coursesRepo.get().find((candidate) => candidate.id === courseId);
  if (!course) throw new CourseError(["This course no longer exists."]);
  if (!name.trim()) throw new CourseError(["Give the template a name."]);
  const template: CourseTemplate = {
    id: makeId("template"),
    name: name.trim(),
    createdAt: nowIso(),
    createdById: actor.id,
    createdByName: actor.name,
    course,
    sections: sectionsRepo
      .get()
      .filter((section) => section.courseId === courseId)
      .map((section) => ({ id: section.id, name: section.name, meetings: section.meetings })),
    quizzes: quizzesRepo.get().filter((quiz) => quiz.courseId === courseId),
    gradebook: gradebookSetupsRepo.get()[courseId],
  };
  templatesRepo.update((templates) => [...templates, template]);
  recordAudit({ action: "template.create", resource: `template:${template.id}`, outcome: "allowed", detail: template.name });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const template = templatesRepo.get().find((candidate) => candidate.id === templateId);
  if (!template) return;
  authorize("delete", { type: "course-template", ownerId: template.createdById });
  templatesRepo.update((templates) => templates.filter((candidate) => candidate.id !== templateId));
  recordAudit({ action: "template.delete", resource: `template:${templateId}`, outcome: "allowed", detail: template.name });
}

// --- Term-end archive (US-04, FR-1.8) ----------------------------------------

export interface TermSummary {
  term: Term;
  courses: Course[];
  sectionCount: number;
  studentCount: number;
  /** The last day has passed and the term is still active. */
  dueForArchive: boolean;
}

/** Every term with what it contains, oldest first. `null` unless the signed-in user may manage terms. */
export function useTermSummaries(): TermSummary[] | null {
  const actor = useActor();
  const terms = useRepository(termsRepo);
  const courses = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);

  return useMemo(() => {
    if (!can(actor, "update", { type: "term" })) return null;
    const today = todayIso();
    return [...terms]
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      .map((term) => {
        const sectionIds = sections.filter((section) => section.termId === term.id).map((section) => section.id);
        const students = new Set(
          enrollments.filter((entry) => sectionIds.includes(entry.sectionId)).map((entry) => entry.userId),
        );
        return {
          term,
          courses: courses.filter((course) => course.termId === term.id),
          sectionCount: sectionIds.length,
          studentCount: students.size,
          dueForArchive: isTermDueForArchive(term, today),
        };
      });
  }, [actor, terms, courses, sections, enrollments]);
}

function facultyOfTerm(termId: string) {
  return [
    ...new Set(
      sectionsRepo
        .get()
        .filter((section) => section.termId === termId)
        .flatMap((section) => section.facultyIds),
    ),
  ];
}

/**
 * US-04: archive a term. Its courses become read-only for every role, and
 * their grades stay viewable. On a server this also runs on the term's end
 * date; here an admin starts it.
 */
export async function archiveTerm(termId: string): Promise<void> {
  authorize("update", { type: "term" });
  const term = termsRepo.get().find((candidate) => candidate.id === termId);
  if (!term || term.status === "archived") return;
  const courseCount = coursesRepo
    .get()
    .filter((course) => course.termId === termId && !isCourseArchived(course, termsRepo.get())).length;
  termsRepo.update((terms) =>
    terms.map((candidate) => (candidate.id === termId ? { ...candidate, status: "archived" } : candidate)),
  );
  recordAudit({
    action: "term.archive",
    resource: `term:${termId}`,
    outcome: "allowed",
    detail: `${courseCount} ${courseCount === 1 ? "course" : "courses"} made read-only`,
  });
  for (const userId of facultyOfTerm(termId)) {
    notify({
      userId,
      category: "system",
      title: `${term.name} has been archived`,
      body: "Its courses are now read-only. Grades can still be viewed and exported.",
      href: "/gradebook",
      mandatory: true,
    });
  }
}

/** Undo an archive made by mistake. The term goes back to active and its courses can be changed again. */
export async function reopenTerm(termId: string): Promise<void> {
  authorize("update", { type: "term" });
  const term = termsRepo.get().find((candidate) => candidate.id === termId);
  if (!term || term.status !== "archived") return;
  termsRepo.update((terms) =>
    terms.map((candidate) => (candidate.id === termId ? { ...candidate, status: "active" } : candidate)),
  );
  recordAudit({ action: "term.reopen", resource: `term:${termId}`, outcome: "allowed" });
}
