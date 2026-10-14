"use client";

/**
 * Courses service. Backend seam: `GET /courses` (already filtered to what the
 * caller may see), `GET /courses/:id/roster`, `GET /terms`,
 * `POST /terms/:id/archive` and `POST /terms/:id/reopen`.
 *
 * The course catalogue itself is still the static seed in
 * `src/lib/data/courses.ts`; it moves into a repository when the course
 * builder arrives (Phase 2).
 */
import { useMemo } from "react";
import { todayIso } from "@/lib/clock";
import { courses as courseCatalogue } from "@/lib/data/courses";
import { can } from "@/lib/domain/permissions";
import { isCourseArchived, isTermDueForArchive } from "@/lib/domain/terms";
import type { Course, Section, Term, User } from "@/lib/types";
import { useRepository } from "./_repository";
import { enrollmentsRepo, sectionsRepo, termsRepo, usersRepo } from "./_stores";
import { notify } from "./notifications";
import { authorize, recordAudit, useActor } from "./session";

const NO_COURSES: Course[] = [];

/**
 * The courses the signed-in user may open: enrolled, taught, or all for
 * admins. A course in an archived term is returned with `status: "archived"`.
 */
export function useCourses(): Course[] {
  const actor = useActor();
  return useMemo(() => {
    if (!actor) return NO_COURSES;
    return courseCatalogue
      .filter((course) => can(actor, "view", { type: "course", courseId: course.id }))
      .map((course) =>
        actor.readOnlyCourseIds.includes(course.id) && course.status !== "archived"
          ? { ...course, status: "archived" as const }
          : course,
      );
  }, [actor]);
}

/** `undefined` while the session loads, then whether this course may be opened. */
export function useCanViewCourse(courseId: string): boolean | undefined {
  const actor = useActor();
  if (actor === undefined) return undefined;
  return can(actor, "view", { type: "course", courseId });
}

/** FR-1.8: true when the course is archived, so it can be viewed but not changed. */
export function useCourseReadOnly(courseId: string | undefined): boolean {
  const actor = useActor();
  return Boolean(actor && courseId !== undefined && actor.readOnlyCourseIds.includes(courseId));
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
          courses: courseCatalogue.filter((course) => course.termId === term.id),
          sectionCount: sectionIds.length,
          studentCount: students.size,
          dueForArchive: isTermDueForArchive(term, today),
        };
      });
  }, [actor, terms, sections, enrollments]);
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
  const courseCount = courseCatalogue.filter(
    (course) => course.termId === termId && !isCourseArchived(course, termsRepo.get()),
  ).length;
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
