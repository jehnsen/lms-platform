/**
 * US-09: which lessons a person sees. A lesson with a release time stays
 * hidden from students until then (FR-2.7); a lesson restricted to sections is
 * shown only to students enrolled in one of them (FR-2.8). Staff see
 * everything, labelled.
 *
 * The backend must apply the same rules when it answers `GET /courses`: a
 * hidden lesson must not be in the response at all.
 */
import type { Course, Lesson } from "@/lib/types";

export interface ContentViewer {
  /** Faculty who teach the course, and admins. */
  staff: boolean;
  /** The sections of this course the viewer is enrolled in. */
  sectionIds: string[];
}

export type LessonAvailability = "available" | "scheduled" | "other-section";

export function isScheduled(lesson: Lesson, nowMs: number) {
  return lesson.releaseAt !== undefined && Date.parse(lesson.releaseAt) > nowMs;
}

export function isRestricted(lesson: Lesson) {
  return (lesson.sectionIds?.length ?? 0) > 0;
}

/** Why a student with these sections can or cannot see the lesson right now. */
export function lessonAvailability(lesson: Lesson, sectionIds: string[], nowMs: number): LessonAvailability {
  if (isRestricted(lesson) && !lesson.sectionIds!.some((id) => sectionIds.includes(id))) {
    return "other-section";
  }
  return isScheduled(lesson, nowMs) ? "scheduled" : "available";
}

/**
 * The course as this viewer gets it. Staff get all of it. Students get only
 * the lessons available to them, and a unit left with nothing to show (no
 * lesson and no quiz) is dropped.
 */
export function courseForViewer(course: Course, viewer: ContentViewer, nowMs: number): Course {
  if (viewer.staff) return course;
  const modules = course.modules
    .map((module) => {
      const lessons = module.lessons.filter(
        (lesson) => lessonAvailability(lesson, viewer.sectionIds, nowMs) === "available",
      );
      return lessons.length === module.lessons.length ? module : { ...module, lessons };
    })
    .filter((module) => module.lessons.length > 0 || module.quizId !== undefined);
  const unchanged =
    modules.length === course.modules.length && modules.every((module, index) => module === course.modules[index]);
  return unchanged ? course : { ...course, modules };
}
