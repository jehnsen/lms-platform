/**
 * US-08: copy a course, or start one from a template, without student data,
 * and shift its dates in bulk (FR-2.5, FR-2.6).
 *
 * "Without student data" is guaranteed by giving every unit, lesson and
 * checkpoint a new id: progress, attempts and checkpoint answers are all keyed
 * by those ids, so nothing recorded against the original can attach to the copy.
 */
import { sectionCode } from "@/lib/domain/course-outline";
import { copyQuiz } from "@/lib/domain/quizzes";
import type { Course, Quiz, Section } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Moves a date (YYYY-MM-DD) by a number of days. */
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Moves a date-time (ISO) by whole days, keeping the time of day. */
export function shiftDateTime(dateTime: string, days: number) {
  return new Date(Date.parse(dateTime) + days * DAY_MS).toISOString();
}

/** Whole days from one date (YYYY-MM-DD) to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS);
}

/** How many dates a bulk shift would move: the course's own two, every lesson release and every quiz due date. */
export function countCourseDates(course: Course, quizzes: Quiz[] = []) {
  const lessonDates = course.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.releaseAt).length;
  const quizDates = quizzes.filter((quiz) => quiz.courseId === course.id).length;
  return (course.startsOn ? 1 : 0) + (course.endsOn ? 1 : 0) + lessonDates + quizDates;
}

/** Every date in the course moved by the same number of days. */
export function shiftCourseDates(course: Course, days: number): Course {
  if (days === 0) return course;
  return {
    ...course,
    startsOn: course.startsOn && shiftDate(course.startsOn, days),
    endsOn: course.endsOn && shiftDate(course.endsOn, days),
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) =>
        lesson.releaseAt ? { ...lesson, releaseAt: shiftDateTime(lesson.releaseAt, days) } : lesson,
      ),
    })),
  };
}

export type SectionOutline = Pick<Section, "id" | "name" | "meetings">;

export interface CopyTarget {
  title: string;
  code: string;
  termId: string;
  instructor: string;
  facultyId: string;
  /** Days to move every date by. */
  shiftDays: number;
}

export interface CourseCopy {
  course: Course;
  sections: Section[];
  quizzes: Quiz[];
}

/**
 * A new course with the source's structure and content. Sections are recreated
 * empty, with the same names and schedules, and lessons restricted to a
 * section follow it to the new one.
 */
export function copyCourse(
  source: { course: Course; sections: SectionOutline[]; quizzes?: Quiz[] },
  target: CopyTarget,
  makeId: (prefix: string) => string,
): CourseCopy {
  const courseId = makeId("course");
  const sections: Section[] = source.sections.map((section) => ({
    id: makeId("section"),
    courseId,
    termId: target.termId,
    name: section.name,
    code: sectionCode(target.code, section.name),
    facultyIds: [target.facultyId],
    meetings: section.meetings.map((meeting) => ({ ...meeting })),
  }));
  const newSectionId = new Map(source.sections.map((section, index) => [section.id, sections[index].id]));

  // Quizzes come too, with new ids and their due dates moved with every other date.
  const quizzes = (source.quizzes ?? [])
    .filter((quiz) => quiz.courseId === source.course.id)
    .map((quiz) => ({ from: quiz.id, copy: copyQuiz(quiz, courseId, shiftDate(quiz.due.slice(0, 10), target.shiftDays), makeId) }));
  const newQuizId = new Map(quizzes.map(({ from, copy }) => [from, copy.id]));

  const shifted = shiftCourseDates(source.course, target.shiftDays);
  const course: Course = {
    ...shifted,
    id: courseId,
    title: target.title,
    code: target.code,
    termId: target.termId,
    instructor: target.instructor,
    status: "active",
    learners: 0,
    rating: 0,
    modules: shifted.modules.map((module) => ({
      id: makeId("unit"),
      title: module.title,
      quizId: module.quizId === undefined ? undefined : newQuizId.get(module.quizId),
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        id: makeId("lesson"),
        checkpoints: lesson.checkpoints?.map((checkpoint) => ({ ...checkpoint, id: makeId("checkpoint") })),
        sectionIds: lesson.sectionIds
          ?.map((id) => newSectionId.get(id))
          .filter((id): id is string => id !== undefined),
      })),
    })),
  };
  return { course, sections, quizzes: quizzes.map(({ copy }) => copy) };
}
