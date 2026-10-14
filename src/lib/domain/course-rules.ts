/**
 * US-06, FR-2.1: what a course must have before it can be saved. The messages
 * name the unit, lesson or section they are about, because they are shown
 * together above the Save button.
 */
import { isWebUrl } from "@/lib/domain/links";
import type { Course, Meeting, Section, Term } from "@/lib/types";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type SectionDraft = Pick<Section, "id" | "name" | "meetings">;

export interface CourseRulesContext {
  terms: Term[];
  /** Codes of every other course, to keep codes unique. */
  otherCourseCodes: string[];
  /** Students enrolled in each existing section of this course. */
  enrolledBySection: Record<string, number>;
  /** Sections the course has now, before this change. */
  currentSectionIds: string[];
  /** Ids of the content library items that exist. */
  materialIds: string[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function meetingProblem(meeting: Meeting): string | undefined {
  if (!Number.isInteger(meeting.day) || meeting.day < 0 || meeting.day > 6) return "has a meeting with no day";
  if (!TIME.test(meeting.start) || !TIME.test(meeting.end)) return "has a meeting with a missing start or end time";
  if (meeting.start >= meeting.end) return `has a ${WEEKDAYS[meeting.day]} meeting that ends before it starts`;
  return undefined;
}

/** Why this course cannot be saved. Empty when it can. */
export function courseProblems(course: Course, sections: SectionDraft[], context: CourseRulesContext): string[] {
  const problems: string[] = [];

  if (!course.title.trim()) problems.push("Give the course a name.");
  const code = course.code.trim();
  if (!code) problems.push("Give the course a code.");
  else if (context.otherCourseCodes.some((other) => other.trim().toLowerCase() === code.toLowerCase())) {
    problems.push(`Another course already uses the code ${code}.`);
  }

  const term = context.terms.find((candidate) => candidate.id === course.termId);
  if (!term) problems.push("Choose a term.");
  else if (term.status === "archived") problems.push(`${term.name} is archived. Choose a current or upcoming term.`);

  for (const [label, value] of [["start", course.startsOn], ["end", course.endsOn]] as const) {
    if (value !== undefined && (!DATE.test(value) || Number.isNaN(Date.parse(value)))) {
      problems.push(`The course ${label} date is not a valid date.`);
    }
  }
  if (course.startsOn && course.endsOn && course.startsOn > course.endsOn) {
    problems.push("The course ends before it starts.");
  }

  // Sections: at least one, because access to a course comes from its sections.
  if (sections.length === 0) problems.push("Add at least one section.");
  const names = sections.map((section) => section.name.trim().toLowerCase());
  sections.forEach((section, index) => {
    const name = section.name.trim();
    if (!name) problems.push(`Section ${index + 1} needs a name.`);
    else if (names.indexOf(name.toLowerCase()) !== index) problems.push(`Two sections are called "${name}".`);
    for (const meeting of section.meetings) {
      const problem = meetingProblem(meeting);
      if (problem) problems.push(`${name || `Section ${index + 1}`} ${problem}.`);
    }
  });
  for (const sectionId of context.currentSectionIds) {
    const enrolled = context.enrolledBySection[sectionId] ?? 0;
    if (enrolled > 0 && !sections.some((section) => section.id === sectionId)) {
      problems.push(
        `A section with ${enrolled} enrolled ${enrolled === 1 ? "student" : "students"} cannot be removed.`,
      );
    }
  }

  const sectionIds = sections.map((section) => section.id);
  course.modules.forEach((module, moduleIndex) => {
    const unit = module.title.trim() ? `"${module.title.trim()}"` : `Unit ${moduleIndex + 1}`;
    if (!module.title.trim()) problems.push(`Unit ${moduleIndex + 1} needs a title.`);
    module.lessons.forEach((lesson, lessonIndex) => {
      const where = lesson.title.trim() ? `"${lesson.title.trim()}"` : `Lesson ${lessonIndex + 1} in ${unit}`;
      if (!lesson.title.trim()) problems.push(`Lesson ${lessonIndex + 1} in ${unit} needs a title.`);
      if (!Number.isInteger(lesson.minutes) || lesson.minutes < 1) {
        problems.push(`${where} needs a length of at least 1 minute.`);
      }
      if (lesson.type === "link" && !isWebUrl(lesson.url ?? "")) {
        problems.push(`${where} needs a link that starts with http:// or https://.`);
      }
      if ((lesson.type === "document" || lesson.type === "slides") && !lesson.materialId) {
        problems.push(`${where} needs a file from the content library.`);
      }
      if (lesson.materialId && !context.materialIds.includes(lesson.materialId)) {
        problems.push(`${where} uses a content library item that no longer exists.`);
      }
      if (lesson.releaseAt !== undefined && Number.isNaN(Date.parse(lesson.releaseAt))) {
        problems.push(`${where} has a release time that is not a valid date and time.`);
      }
      if (lesson.sectionIds?.some((id) => !sectionIds.includes(id))) {
        problems.push(`${where} is restricted to a section that no longer exists.`);
      }
    });
  });

  return problems;
}
