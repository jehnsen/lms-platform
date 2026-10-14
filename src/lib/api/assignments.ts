"use client";

/**
 * Assignments service (Epic C): setting assignments, handing work in, marking
 * it with a rubric and inline comments, releasing grades, and similarity
 * reports.
 *
 * Backend seam: `GET /assignments`, `GET|PUT|DELETE /assignments/:id`,
 * `POST /assignments`, `POST /assignments/:id/submissions` (multipart),
 * `GET /assignments/:id/submissions`, `PUT /submissions/:id/grade`,
 * `POST|DELETE /submissions/:id/comments`, `POST /assignments/:id/release`,
 * `POST /submissions/:id/similarity` and file downloads. The server decides
 * lateness from its own clock, applies the rules in
 * `src/lib/domain/assignments.ts` itself, and never sends an unreleased grade
 * or a similarity report to a student.
 */
import { useMemo } from "react";
import { mockPlagiarismProvider } from "@/lib/adapters/plagiarism";
import { nowIso } from "@/lib/clock";
import {
  assignmentProblems,
  forStudent,
  gradeFor,
  isSetFor,
  latestByStudent,
  receiptCode,
  submissionFileProblem,
  submissionProblems,
  submitDecision,
} from "@/lib/domain/assignments";
import { can } from "@/lib/domain/permissions";
import type {
  Assignment,
  AttachedFile,
  CommentAnchor,
  Course,
  InlineComment,
  Section,
  Submission,
  User,
} from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { saveStoredFile, useStoredFile, type StoredFile } from "./_file-url";
import { deleteFile, putFile } from "./_files";
import { useRepository } from "./_repository";
import {
  assignmentsRepo,
  coursesRepo,
  enrollmentsRepo,
  sectionsRepo,
  settingsRepo,
  submissionsRepo,
  usersRepo,
} from "./_stores";
import { notify } from "./notifications";
import { authorize, getActor, recordAudit, useActor, type CurrentUser } from "./session";

/** Something the rules do not allow, with every reason. */
export class AssignmentError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "AssignmentError";
  }
}

let idCounter = 0;

/** A new id for an assignment, rubric row, attachment, submission or comment. */
export function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function mySectionIds(actor: Pick<CurrentUser, "id">) {
  return enrollmentsRepo
    .get()
    .filter((entry) => entry.userId === actor.id)
    .map((entry) => entry.sectionId);
}

/** The active students an assignment is set for: everyone enrolled in one of its sections. */
function studentsSetFor(assignment: Assignment, users: User[], enrollments: { userId: string; sectionId: string }[]) {
  const ids = new Set(
    enrollments.filter((entry) => assignment.sectionIds.includes(entry.sectionId)).map((entry) => entry.userId),
  );
  return users.filter((user) => ids.has(user.id) && user.role === "student" && user.status === "active");
}

// --- Reading -----------------------------------------------------------------

export interface AssignmentRow {
  assignment: Assignment;
  courseTitle: string;
  /** Students: their latest hand-in, as they may see it. */
  mine?: Submission;
  /** Students: how many times they have handed in. */
  myAttempts: number;
  /** Staff: how the class stands. */
  counts?: { expected: number; submitted: number; graded: number; unreleased: number };
}

/**
 * The assignments the signed-in user has: for a student, those published for
 * their sections; for faculty, those of the courses they teach, drafts
 * included; for admins, all of them. Soonest due first.
 */
export function useAssignments(): AssignmentRow[] {
  const actor = useActor();
  const assignments = useRepository(assignmentsRepo);
  const submissions = useRepository(submissionsRepo);
  const courses = useRepository(coursesRepo);
  const enrollments = useRepository(enrollmentsRepo);
  const users = useRepository(usersRepo);
  const settings = useRepository(settingsRepo);

  return useMemo(() => {
    if (!actor) return [];
    const student = actor.role === "student";
    const sectionIds = enrollments.filter((entry) => entry.userId === actor.id).map((entry) => entry.sectionId);
    return assignments
      .filter(
        (assignment) =>
          can(actor, "view", { type: "assignment", courseId: assignment.courseId }) &&
          (!student || isSetFor(assignment, sectionIds)),
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .map((assignment): AssignmentRow => {
        const forThis = submissions.filter((submission) => submission.assignmentId === assignment.id);
        const courseTitle = courses.find((course) => course.id === assignment.courseId)?.title ?? "";
        if (student) {
          const own = forThis.filter((submission) => submission.studentId === actor.id);
          const latest = latestByStudent(own)[actor.id];
          return {
            assignment,
            courseTitle,
            mine: latest && forStudent(latest, { similarityVisible: settings.similarityVisibleToStudents }),
            myAttempts: own.length,
          };
        }
        const expected = studentsSetFor(assignment, users, enrollments);
        const latest = Object.values(latestByStudent(forThis)).filter((submission) =>
          expected.some((user) => user.id === submission.studentId),
        );
        return {
          assignment,
          courseTitle,
          myAttempts: 0,
          counts: {
            expected: expected.length,
            submitted: latest.length,
            graded: latest.filter((submission) => submission.grade).length,
            unreleased: latest.filter((submission) => submission.grade && !submission.grade.releasedAt).length,
          },
        };
      });
  }, [actor, assignments, submissions, courses, enrollments, users, settings]);
}

export type AssignmentAccess =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      assignment: Assignment;
      course: Course | undefined;
      /** The sections it is set for. */
      sections: Section[];
      /** Faculty who teach the course, and admins. */
      staff: boolean;
      /** May change the assignment and mark work. False for admins and in an archived course. */
      canEdit: boolean;
    };

/** One assignment, with why it cannot be shown when it cannot. */
export function useAssignment(assignmentId: string | undefined): AssignmentAccess {
  const actor = useActor();
  const assignments = useRepository(assignmentsRepo);
  const courses = useRepository(coursesRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);

  return useMemo((): AssignmentAccess => {
    if (actor === undefined) return { status: "loading" };
    const assignment = assignments.find((candidate) => candidate.id === assignmentId);
    if (!assignment) return { status: "missing" };
    if (!can(actor, "view", { type: "assignment", courseId: assignment.courseId })) return { status: "forbidden" };
    const staff = actor!.role !== "student";
    if (!staff) {
      const mine = enrollments.filter((entry) => entry.userId === actor!.id).map((entry) => entry.sectionId);
      // A draft, or one set for other sections, does not exist as far as this student is concerned.
      if (!isSetFor(assignment, mine)) return { status: "missing" };
    }
    return {
      status: "ok",
      assignment,
      course: courses.find((course) => course.id === assignment.courseId),
      sections: sections
        .filter((section) => assignment.sectionIds.includes(section.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
      staff,
      canEdit: can(actor, "update", { type: "assignment", courseId: assignment.courseId }),
    };
  }, [actor, assignments, courses, sections, enrollments, assignmentId]);
}

/** The signed-in student's own hand-ins for an assignment, oldest first, as they may see them. */
export function useMySubmissions(assignmentId: string): Submission[] {
  const actor = useActor();
  const submissions = useRepository(submissionsRepo);
  const settings = useRepository(settingsRepo);
  return useMemo(() => {
    if (!actor || !can(actor, "view", { type: "submission", ownerId: actor.id })) return [];
    return submissions
      .filter((submission) => submission.assignmentId === assignmentId && submission.studentId === actor.id)
      .sort((a, b) => a.attempt - b.attempt)
      .map((submission) => forStudent(submission, { similarityVisible: settings.similarityVisibleToStudents }));
  }, [actor, submissions, settings, assignmentId]);
}

export interface RosterRow {
  student: User;
  section: Section | undefined;
  /** The hand-in that is marked: the student's most recent. */
  latest: Submission | undefined;
  attempts: number;
}

/**
 * Staff: every student the assignment is set for, with their latest hand-in.
 * `null` unless the signed-in user may see the course's submissions.
 */
export function useSubmissionRoster(assignmentId: string): RosterRow[] | null {
  const actor = useActor();
  const assignments = useRepository(assignmentsRepo);
  const submissions = useRepository(submissionsRepo);
  const users = useRepository(usersRepo);
  const sections = useRepository(sectionsRepo);
  const enrollments = useRepository(enrollmentsRepo);

  return useMemo(() => {
    const assignment = assignments.find((candidate) => candidate.id === assignmentId);
    if (!assignment || !can(actor, "view", { type: "submission", courseId: assignment.courseId })) return null;
    const forThis = submissions.filter((submission) => submission.assignmentId === assignmentId);
    const latest = latestByStudent(forThis);
    return studentsSetFor(assignment, users, enrollments)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((student) => {
        const sectionId = enrollments.find(
          (entry) => entry.userId === student.id && assignment.sectionIds.includes(entry.sectionId),
        )?.sectionId;
        return {
          student,
          section: sections.find((section) => section.id === sectionId),
          latest: latest[student.id],
          attempts: forThis.filter((submission) => submission.studentId === student.id).length,
        };
      });
  }, [actor, assignments, submissions, users, sections, enrollments, assignmentId]);
}

/** Staff: may the signed-in user see similarity reports for this course (US-14)? */
export function useCanSeeSimilarity(courseId: string | undefined): boolean {
  return can(useActor(), "view", { type: "similarity-report", courseId });
}

export type StudentWork =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "forbidden" }
  | {
      status: "ok";
      student: User;
      section: Section | undefined;
      /** Every hand-in by this student, oldest first, with everything staff may see. */
      attempts: Submission[];
      /** The students before and after this one on the roster, for moving through a class. */
      previousId: string | undefined;
      nextId: string | undefined;
    };

/** Staff: one student's work for an assignment, for the marking page. */
export function useStudentWork(assignmentId: string, studentId: string): StudentWork {
  const actor = useActor();
  const roster = useSubmissionRoster(assignmentId);
  const submissions = useRepository(submissionsRepo);
  return useMemo((): StudentWork => {
    if (actor === undefined) return { status: "loading" };
    if (!roster) return { status: "forbidden" };
    const index = roster.findIndex((row) => row.student.id === studentId);
    if (index === -1) return { status: "missing" };
    return {
      status: "ok",
      student: roster[index].student,
      section: roster[index].section,
      attempts: submissions
        .filter((submission) => submission.assignmentId === assignmentId && submission.studentId === studentId)
        .sort((a, b) => a.attempt - b.attempt),
      previousId: roster[index - 1]?.student.id,
      nextId: roster[index + 1]?.student.id,
    };
  }, [actor, roster, submissions, assignmentId, studentId]);
}

/** True when any hand-in for the assignment has been marked, so its points and rubric can no longer change. */
function hasMarkedWork(assignmentId: string) {
  return submissionsRepo.get().some((submission) => submission.assignmentId === assignmentId && submission.grade);
}

/** Staff: true once any hand-in for the assignment has been marked. */
export function useMarkingStarted(assignmentId: string | undefined): boolean {
  const submissions = useRepository(submissionsRepo);
  return submissions.some((submission) => submission.assignmentId === assignmentId && submission.grade !== undefined);
}

// --- Setting assignments (US-10) -----------------------------------------------

/**
 * Saves an assignment, new or existing. A draft is saved as it is; to publish,
 * or to change one that is published, it must pass every check (US-10).
 * `newFiles` holds the files for attachments added in this edit, by attachment
 * id. Returns the assignment's id.
 */
export async function saveAssignment(
  draft: Assignment,
  options: { publish: boolean; newFiles?: Record<string, File> },
): Promise<string> {
  const existing = assignmentsRepo.get().find((candidate) => candidate.id === draft.id);
  // An assignment stays in the course it was made for.
  const courseId = existing?.courseId ?? draft.courseId;
  const actor = existing
    ? authorize("update", { type: "assignment", courseId })
    : authorize("create", { type: "assignment", courseId });

  const publishing = options.publish && existing?.status !== "published";
  const published = existing?.status === "published" || options.publish;
  const next: Assignment = {
    ...draft,
    courseId,
    title: draft.title.trim(),
    instructions: draft.instructions.trim(),
    status: published ? "published" : "draft",
    createdById: existing?.createdById ?? actor.id,
    createdAt: existing?.createdAt ?? nowIso(),
    publishedAt: existing?.publishedAt ?? (published ? nowIso() : undefined),
  };

  const problems: string[] = [];
  if (!next.title) problems.push("Give the assignment a title.");
  if (published) {
    const courseSectionIds = sectionsRepo
      .get()
      .filter((section) => section.courseId === courseId)
      .map((section) => section.id);
    problems.push(...assignmentProblems(next, { courseSectionIds }).filter((problem) => !problems.includes(problem)));
  }
  if (existing && hasMarkedWork(existing.id)) {
    if (existing.points !== next.points || JSON.stringify(existing.rubric) !== JSON.stringify(next.rubric)) {
      problems.push("Marking has started, so the points and the rubric can no longer be changed.");
    }
  }
  if (problems.length > 0) throw new AssignmentError(problems);

  for (const attachment of next.attachments) {
    const file = options.newFiles?.[attachment.id];
    if (file) await putFile(attachment.id, file);
  }
  for (const removed of existing?.attachments ?? []) {
    if (!next.attachments.some((attachment) => attachment.id === removed.id)) {
      await deleteFile(removed.id).catch(() => undefined);
    }
  }

  assignmentsRepo.update((assignments) =>
    existing ? assignments.map((candidate) => (candidate.id === next.id ? next : candidate)) : [...assignments, next],
  );
  recordAudit({
    action: publishing ? "assignment.publish" : existing ? "assignment.update" : "assignment.create",
    resource: `assignment:${next.id}`,
    outcome: "allowed",
    detail: next.title,
  });

  if (publishing) {
    // US-10: it reaches the selected sections, with the due date shown.
    for (const student of studentsSetFor(next, usersRepo.get(), enrollmentsRepo.get())) {
      notify({
        userId: student.id,
        category: "deadlines",
        title: `New assignment: ${next.title}`,
        body: `Due ${formatDate(next.dueAt, true)}. Worth ${next.points} points.`,
        href: `/assignments/${next.id}`,
      });
    }
  }
  return next.id;
}

/** Removes an assignment nobody has handed anything in for. */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  const assignment = assignmentsRepo.get().find((candidate) => candidate.id === assignmentId);
  if (!assignment) return;
  authorize("delete", { type: "assignment", courseId: assignment.courseId });
  if (submissionsRepo.get().some((submission) => submission.assignmentId === assignmentId)) {
    throw new AssignmentError(["Work has been handed in for this assignment, so it cannot be deleted."]);
  }
  for (const attachment of assignment.attachments) await deleteFile(attachment.id).catch(() => undefined);
  assignmentsRepo.update((assignments) => assignments.filter((candidate) => candidate.id !== assignmentId));
  recordAudit({ action: "assignment.delete", resource: `assignment:${assignmentId}`, outcome: "allowed", detail: assignment.title });
}

// --- Handing in (US-11) --------------------------------------------------------

function toAttached(file: File, prefix: string): AttachedFile {
  return { id: newId(prefix), name: file.name, sizeLabel: formatBytes(file.size), mimeType: file.type || undefined };
}

/** Describes a file chosen as an assignment attachment. The file itself is stored when the assignment is saved. */
export function describeAttachment(file: File): AttachedFile {
  return toAttached(file, "att");
}

/**
 * Hands in work for the signed-in student and returns the stored submission,
 * whose `receipt` and `submittedAt` are the confirmation (FR-3.3). The late
 * rule and the resubmission rule are applied here (FR-3.4).
 */
export async function submitAssignment(assignmentId: string, work: { text: string; files: File[] }): Promise<Submission> {
  const assignment = assignmentsRepo.get().find((candidate) => candidate.id === assignmentId);
  if (!assignment) throw new AssignmentError(["This assignment no longer exists."]);
  const actor = authorize("submit", { type: "assignment", courseId: assignment.courseId });
  if (!isSetFor(assignment, mySectionIds(actor))) throw new AssignmentError(["This assignment is not set for your section."]);

  const previous = submissionsRepo
    .get()
    .filter((submission) => submission.assignmentId === assignmentId && submission.studentId === actor.id);
  const submittedAt = nowIso();
  const decision = submitDecision(assignment, previous.length, submittedAt);
  if (!decision.allowed) throw new AssignmentError([decision.reason]);

  const limitMb = settingsRepo.get().submissionLimitMb;
  const problems = [
    ...submissionProblems(assignment.accepts, work.text, work.files.length),
    ...work.files.flatMap((file) => submissionFileProblem(file, limitMb) ?? []),
  ];
  if (problems.length > 0) throw new AssignmentError(problems);

  const files = work.files.map((file) => ({ file, attached: toAttached(file, "subfile") }));
  try {
    for (const { file, attached } of files) await putFile(attached.id, file);
  } catch {
    throw new AssignmentError(["Your files could not be stored in this browser. It may be out of space."]);
  }

  const id = newId("sub");
  const { daysLate, penaltyPercent } = decision.outcome;
  const submission: Submission = {
    id,
    assignmentId,
    courseId: assignment.courseId,
    studentId: actor.id,
    attempt: previous.length + 1,
    submittedAt,
    receipt: receiptCode(id, submittedAt),
    text: work.text.trim() || undefined,
    files: files.map(({ attached }) => attached),
    late: daysLate > 0 ? { daysLate, penaltyPercent } : undefined,
    comments: [],
  };
  submissionsRepo.update((submissions) => [...submissions, submission]);
  recordAudit({
    action: "assignment.submit",
    resource: `submission:${id}`,
    outcome: "allowed",
    detail: `${assignment.title}, attempt ${submission.attempt}, receipt ${submission.receipt}${daysLate > 0 ? `, ${daysLate} ${daysLate === 1 ? "day" : "days"} late` : ""}`,
  });
  // US-14: a similarity report for every submission. It arrives a moment later, as it would from a real service.
  void checkSimilarity(id);
  return forStudent(submission, { similarityVisible: settingsRepo.get().similarityVisibleToStudents });
}

// --- Similarity (US-14, FR-3.8) --------------------------------------------------

async function checkSimilarity(submissionId: string): Promise<void> {
  const submission = submissionsRepo.get().find((candidate) => candidate.id === submissionId);
  if (!submission) return;
  try {
    const result = await mockPlagiarismProvider.check({
      submissionId,
      text: submission.text ?? "",
      fileNames: submission.files.map((file) => file.name),
    });
    const similarity = { provider: mockPlagiarismProvider.name, checkedAt: nowIso(), ...result };
    submissionsRepo.update((submissions) =>
      submissions.map((candidate) => (candidate.id === submissionId ? { ...candidate, similarity } : candidate)),
    );
  } catch {
    // No report: faculty can ask for the check again from the marking page.
  }
}

/** Faculty: run the similarity check again for one hand-in. */
export async function runSimilarityCheck(submissionId: string): Promise<void> {
  const submission = submissionsRepo.get().find((candidate) => candidate.id === submissionId);
  if (!submission) return;
  authorize("create", { type: "similarity-report", courseId: submission.courseId });
  await checkSimilarity(submissionId);
}

// --- Marking (US-15) -----------------------------------------------------------

function requireSubmission(submissionId: string) {
  const submission = submissionsRepo.get().find((candidate) => candidate.id === submissionId);
  if (!submission) throw new AssignmentError(["This submission no longer exists."]);
  const assignment = assignmentsRepo.get().find((candidate) => candidate.id === submission.assignmentId);
  if (!assignment) throw new AssignmentError(["The assignment for this submission no longer exists."]);
  return { submission, assignment };
}

function patchSubmission(submissionId: string, change: (submission: Submission) => Submission) {
  submissionsRepo.update((submissions) =>
    submissions.map((candidate) => (candidate.id === submissionId ? change(candidate) : candidate)),
  );
}

/**
 * Marks a hand-in: rubric levels (totalled automatically) or a typed mark, and
 * overall feedback. The late penalty recorded at submission is applied. The
 * student sees nothing until the grade is released.
 */
export async function saveGrade(
  submissionId: string,
  input: { rubricLevels?: Record<string, string>; rawPoints?: number; feedback: string },
): Promise<void> {
  const { submission, assignment } = requireSubmission(submissionId);
  const actor = authorize("update", { type: "submission", courseId: submission.courseId });
  const result = gradeFor(assignment, submission, input, { gradedById: actor.id, gradedAt: nowIso() });
  if ("problems" in result) throw new AssignmentError(result.problems);
  patchSubmission(submissionId, (current) => ({ ...current, grade: result.grade }));
  recordAudit({
    action: "submission.grade",
    resource: `submission:${submissionId}`,
    outcome: "allowed",
    detail: `${result.grade.points} of ${assignment.points}`,
  });
}

/** Adds a comment anchored to part of the hand-in: a run of its text, or one of its files (FR-3.9). */
export async function addInlineComment(submissionId: string, anchor: CommentAnchor, body: string): Promise<void> {
  const { submission } = requireSubmission(submissionId);
  const actor = authorize("update", { type: "submission", courseId: submission.courseId });
  if (!body.trim()) throw new AssignmentError(["Write the comment first."]);
  if (anchor.kind === "text") {
    const text = submission.text ?? "";
    if (anchor.start < 0 || anchor.end > text.length || anchor.start >= anchor.end) {
      throw new AssignmentError(["Select the part of the text the comment is about."]);
    }
  } else if (!submission.files.some((file) => file.id === anchor.fileId)) {
    throw new AssignmentError(["That file is not part of this submission."]);
  }
  const comment: InlineComment = {
    id: newId("cmt"),
    anchor:
      anchor.kind === "text"
        ? { ...anchor, quote: (submission.text ?? "").slice(anchor.start, anchor.end) }
        : anchor,
    body: body.trim(),
    authorId: actor.id,
    createdAt: nowIso(),
  };
  patchSubmission(submissionId, (current) => ({ ...current, comments: [...current.comments, comment] }));
}

export async function removeInlineComment(submissionId: string, commentId: string): Promise<void> {
  const { submission } = requireSubmission(submissionId);
  authorize("update", { type: "submission", courseId: submission.courseId });
  patchSubmission(submissionId, (current) => ({
    ...current,
    comments: current.comments.filter((comment) => comment.id !== commentId),
  }));
}

/**
 * FR-4.3: release every marked, unreleased grade for an assignment. From then
 * on those students see their mark, the rubric levels, the feedback and the
 * inline comments, and each is notified. Returns how many were released.
 */
export async function releaseGrades(assignmentId: string): Promise<number> {
  const assignment = assignmentsRepo.get().find((candidate) => candidate.id === assignmentId);
  if (!assignment) return 0;
  authorize("update", { type: "assignment", courseId: assignment.courseId });
  const ready = submissionsRepo
    .get()
    .filter((submission) => submission.assignmentId === assignmentId && submission.grade && !submission.grade.releasedAt);
  if (ready.length === 0) return 0;
  const releasedAt = nowIso();
  const ids = new Set(ready.map((submission) => submission.id));
  submissionsRepo.update((submissions) =>
    submissions.map((submission) =>
      ids.has(submission.id) && submission.grade ? { ...submission, grade: { ...submission.grade, releasedAt } } : submission,
    ),
  );
  recordAudit({
    action: "assignment.release-grades",
    resource: `assignment:${assignmentId}`,
    outcome: "allowed",
    detail: `${ready.length} ${ready.length === 1 ? "grade" : "grades"} released`,
  });
  for (const studentId of new Set(ready.map((submission) => submission.studentId))) {
    notify({
      userId: studentId,
      category: "grades",
      title: `Grade released: ${assignment.title}`,
      body: "Your mark and feedback are ready to view.",
      href: `/assignments/${assignmentId}`,
    });
  }
  return ready.length;
}

// --- Files ---------------------------------------------------------------------

/** Downloads an attachment of an assignment the signed-in user may open. Returns false when the file is gone. */
export async function downloadAttachment(assignmentId: string, fileId: string): Promise<boolean> {
  const assignment = assignmentsRepo.get().find((candidate) => candidate.id === assignmentId);
  const attachment = assignment?.attachments.find((file) => file.id === fileId);
  if (!assignment || !attachment) return false;
  const actor = authorize("view", { type: "assignment", courseId: assignment.courseId });
  if (actor.role === "student" && !isSetFor(assignment, mySectionIds(actor))) return false;
  return saveStoredFile(fileId, attachment.name);
}

function authorizeSubmissionRead(submission: Submission) {
  // A student may read their own; faculty and admins the course's.
  const own = getActor()?.id === submission.studentId;
  return authorize("view", { type: "submission", ownerId: own ? submission.studentId : undefined, courseId: submission.courseId });
}

/** Downloads a file handed in with a submission: by its student, or by staff of the course. */
export async function downloadSubmissionFile(submissionId: string, fileId: string): Promise<boolean> {
  const submission = submissionsRepo.get().find((candidate) => candidate.id === submissionId);
  const file = submission?.files.find((candidate) => candidate.id === fileId);
  if (!submission || !file) return false;
  authorizeSubmissionRead(submission);
  return saveStoredFile(fileId, file.name);
}

/** One submitted file as an address the page can show, for whoever may read the submission. */
export function useSubmissionFile(submission: Submission | undefined, fileId: string | undefined): StoredFile {
  const actor = useActor();
  const allowed =
    submission !== undefined &&
    submission.files.some((file) => file.id === fileId) &&
    (can(actor, "view", { type: "submission", courseId: submission.courseId }) ||
      can(actor, "view", { type: "submission", ownerId: submission.studentId }));
  return useStoredFile(allowed ? fileId : undefined);
}
