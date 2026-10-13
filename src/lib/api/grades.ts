"use client";

/**
 * Grades service: the class view of a course. Backend seam:
 * `GET /courses/:id/gradebook`.
 */
import { useMemo } from "react";
import type { LearnerProgress, Section, User } from "@/lib/types";
import { useRepository } from "./_repository";
import { progressRepo } from "./_stores";
import { useCourseRoster } from "./courses";
import { EMPTY_PROGRESS } from "./progress";
import { authorize, recordAudit } from "./session";

export interface GradebookEntry {
  student: User;
  section: Section | undefined;
  progress: LearnerProgress;
}

/**
 * Every enrolled student in a course with their progress. `null` unless the
 * signed-in user may see that course's gradebook.
 */
export function useGradebook(courseId: string): GradebookEntry[] | null {
  const roster = useCourseRoster(courseId);
  const all = useRepository(progressRepo);
  return useMemo(() => {
    if (!roster) return null;
    return roster.students.map((student) => ({
      student,
      section: roster.sections.find((section) => section.id === roster.sectionOf[student.id]),
      progress: all[student.id] ?? EMPTY_PROGRESS,
    }));
  }, [roster, all]);
}

/** Checks the caller may export this gradebook and records the export (NFR-3). */
export async function logGradebookExport(courseId: string, rowCount: number): Promise<void> {
  authorize("export", { type: "gradebook", courseId });
  recordAudit({
    action: "gradebook.export",
    resource: `gradebook:${courseId}`,
    outcome: "allowed",
    detail: `${rowCount} learners, CSV`,
  });
}
