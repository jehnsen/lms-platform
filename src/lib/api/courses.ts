"use client";

/**
 * Courses service. Backend seam: `GET /courses` (already filtered to what the
 * caller may see), `GET /courses/:id/roster`, `GET /terms`.
 *
 * The course catalogue itself is still the static seed in
 * `src/lib/data/courses.ts`; it moves into a repository when the course
 * builder arrives (Phase 2).
 */
import { useMemo } from "react";
import { courses as courseCatalogue } from "@/lib/data/courses";
import { can } from "@/lib/domain/permissions";
import type { Course, Section, Term, User } from "@/lib/types";
import { useRepository } from "./_repository";
import { enrollmentsRepo, sectionsRepo, termsRepo, usersRepo } from "./_stores";
import { useActor } from "./session";

const NO_COURSES: Course[] = [];

/** The courses the signed-in user may open: enrolled, taught, or all for admins. */
export function useCourses(): Course[] {
  const actor = useActor();
  return useMemo(() => {
    if (!actor) return NO_COURSES;
    return courseCatalogue.filter((course) => can(actor, "view", { type: "course", courseId: course.id }));
  }, [actor]);
}

/** `undefined` while the session loads, then whether this course may be opened. */
export function useCanViewCourse(courseId: string): boolean | undefined {
  const actor = useActor();
  if (actor === undefined) return undefined;
  return can(actor, "view", { type: "course", courseId });
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
