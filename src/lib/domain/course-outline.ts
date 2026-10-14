/**
 * Reading and reordering a course's outline: units ("modules" in the code) and
 * their lessons (FR-2.2). Pure helpers shared by the screens and the services.
 */
import type { Course, CourseModule, Lesson, LessonType } from "@/lib/types";

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  video: "Video",
  reading: "Reading",
  link: "Link",
  document: "Document",
  slides: "Slides",
};

export const LESSON_TYPES = Object.keys(LESSON_TYPE_LABELS) as LessonType[];

export function courseLessons(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

export function courseMinutes(course: Course) {
  return courseLessons(course).reduce((sum, lesson) => sum + lesson.minutes, 0);
}

export interface LessonLocation {
  course: Course;
  module: CourseModule;
  lesson: Lesson;
  index: number;
  total: number;
  previous?: Lesson;
  next?: Lesson;
}

/** Where a lesson sits in a course, with its neighbours in reading order. */
export function locateLesson(course: Course, lessonId: string): LessonLocation | undefined {
  const lessons = courseLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return undefined;
  const lesson = lessons[index];
  const courseModule = course.modules.find((module) => module.lessons.includes(lesson));
  if (!courseModule) return undefined;
  return {
    course,
    module: courseModule,
    lesson,
    index,
    total: lessons.length,
    previous: lessons[index - 1],
    next: lessons[index + 1],
  };
}

/** A copy of the list with one item moved. Out-of-range moves return the list unchanged. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The code a section is known by in imports and the SIS feed: the course code
 * plus the section's own name without the word "Section", e.g. "CS-110-A".
 */
export function sectionCode(courseCode: string, sectionName: string) {
  const suffix = sectionName
    .trim()
    .replace(/^section\s+/i, "")
    .replace(/\s+/g, "-")
    .toUpperCase();
  return `${courseCode.trim().toUpperCase()}-${suffix}`;
}
