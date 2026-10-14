/**
 * FR-1.8: a course is read-only once it, or the term it belongs to, is
 * archived. Its grades stay viewable.
 */
import type { Course, Term } from "@/lib/types";

type CourseState = Pick<Course, "id" | "termId" | "status">;

export function isCourseArchived(course: CourseState, terms: Term[]) {
  if (course.status === "archived") return true;
  return terms.some((term) => term.id === course.termId && term.status === "archived");
}

export function archivedCourseIds(courses: CourseState[], terms: Term[]): string[] {
  return courses.filter((course) => isCourseArchived(course, terms)).map((course) => course.id);
}

/**
 * True when an active term's last day has passed, so it is due for archiving
 * (US-04). `today` is an ISO date, YYYY-MM-DD; the end date is inclusive.
 */
export function isTermDueForArchive(term: Term, today: string) {
  return term.status === "active" && today > term.endsOn;
}
