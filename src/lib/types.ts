export type Level = "Beginner" | "Intermediate" | "Advanced";

// ---------------------------------------------------------------------------
// People, access and school structure (BR-01 to BR-04)
// ---------------------------------------------------------------------------

/** The four roles of BR-01. Coordinators and IT staff are open questions, not roles. */
export type Role = "student" | "faculty" | "admin" | "parent";

/** FR-1.7: only active accounts can sign in. */
export type AccountStatus = "active" | "inactive" | "archived";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  /** Parents only: the students this account is linked to (US-05). */
  childIds?: string[];
  /** Identifier in the Student Information System, when imported from it (FR-1.5). */
  sisId?: string;
  /** When the account last signed in. Written by the session service. */
  lastLoginAt?: string;
}

/** FR-1.4: what a new local-account password must contain. School policy, so it is data. */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

/** School-wide policy an admin can change. Later phases add their own settings here. */
export interface SchoolSettings {
  passwordPolicy: PasswordPolicy;
  /** US-04: years an archived account's data is kept. `null` keeps it indefinitely. */
  retentionYears: number | null;
  /** FR-2.3: largest file, in megabytes, accepted for each kind of material. */
  uploadLimitsMb: Record<MaterialKind, number>;
  /** FR-3.4: the late rule a new assignment starts with. Teachers can change it per assignment. */
  lateDefault: LatePolicy;
  /** FR-3.3: largest file, in megabytes, a student may attach to a submission. */
  submissionLimitMb: number;
  /** US-14: similarity reports are for faculty only unless the school turns this on. */
  similarityVisibleToStudents: boolean;
  /** FR-4.2: the scales a course's grade can be reported on. The bands are school policy. */
  gradingScales: GradingScale[];
  /** The scale a course uses until its teacher picks one, and the one used for averages across courses. */
  defaultScaleId: string;
  /** FR-5.2, FR-5.4: how attendance is counted, when it can be corrected and who is alerted. */
  attendance: AttendancePolicy;
  /** FR-6.7: the notifications nobody can switch off. */
  notifications: NotificationPolicy;
  /** FR-6.2: the role rules for direct messages. */
  messaging: MessagingPolicy;
  /** FR-7.3: when a student counts as at risk. */
  atRisk: AtRiskPolicy;
}

/**
 * FR-7.3: one at-risk rule. It matches a student in a course when every
 * condition it sets holds, so "low grades plus low attendance" is one rule
 * with two conditions. A student is at risk when any enabled rule matches.
 */
export interface AtRiskRule {
  id: string;
  name: string;
  enabled: boolean;
  /** The course total is below this percent. */
  gradeBelow?: number;
  /** Attendance in the course is below this percent. */
  attendanceBelow?: number;
  /** At least this many pieces of work are missing. */
  missingAtLeast?: number;
  /** No sign-in for at least this many days, or never. */
  inactiveDays?: number;
}

export interface AtRiskPolicy {
  rules: AtRiskRule[];
}

// ---------------------------------------------------------------------------
// Communication (BR-20 to BR-22)
// ---------------------------------------------------------------------------

/** FR-6.1: a notice from a teacher to a course, or to some of its sections. */
export interface Announcement {
  id: string;
  courseId: string;
  /** The sections it is for. Empty: every section of the course. */
  sectionIds: string[];
  title: string;
  body: string;
  authorId: string;
  postedAt: string;
  /** The channels the teacher chose to send it through (US-22). */
  channels: NotificationChannel[];
  /** When each person opened it, by user id. Only students in its audience count as readers. */
  readBy: Record<string, string>;
}

/** FR-6.2: one direct message between two people. */
export interface Message {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  sentAt: string;
  readAt?: string;
  /** Set when a teacher sent the same message to a whole section; each student still gets a private thread. */
  broadcastSectionId?: string;
}

/** FR-6.3: a discussion in a course's forum. */
export interface ForumThread {
  id: string;
  courseId: string;
  title: string;
  authorId: string;
  createdAt: string;
  /** Set by a moderator: the thread can be read but not replied to. */
  locked?: boolean;
}

export interface ForumReport {
  byId: string;
  at: string;
  reason: string;
}

/** One post in a thread. The first post of a thread is the question or topic itself. */
export interface ForumPost {
  id: string;
  threadId: string;
  courseId: string;
  authorId: string;
  body: string;
  createdAt: string;
  /** FR-6.3: reports that it is inappropriate, waiting for a moderator. */
  reports: ForumReport[];
  /** Set by a moderator: students no longer see what it says. */
  hidden?: { byId: string; at: string };
}

/** FR-6.4, FR-6.5: a live online class held through the video conferencing service. */
export interface LiveSession {
  id: string;
  courseId: string;
  /** The sections it is for. Empty: every section of the course. */
  sectionIds: string[];
  title: string;
  /** ISO date-time. */
  startsAt: string;
  durationMinutes: number;
  createdById: string;
  /** The video conferencing service and its own id and address for the meeting. */
  provider: string;
  meetingId: string;
  joinUrl: string;
  status: "scheduled" | "ended" | "cancelled";
  endedAt?: string;
  /** FR-6.5: where the recording can be watched, once the service has produced it. */
  recording?: { url: string; label: string };
}

// ---------------------------------------------------------------------------
// Attendance and scheduling (BR-17 to BR-19)
// ---------------------------------------------------------------------------

/** FR-5.1: what a teacher records for each student in a class session. */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/** FR-5.2, FR-5.4: school policy for attendance. Every value is an open question with a default (Q-19). */
export interface AttendancePolicy {
  /** A student whose attendance in a course falls below this percentage triggers an alert. */
  thresholdPercent: number;
  /** Sessions that must be recorded for a student in a course before the threshold is checked. */
  minSessions: number;
  /** How a Late mark counts: as attended, as half a session, or as missed. */
  late: "present" | "half" | "absent";
  /** How an Excused mark counts: left out of the rate, as attended, or as missed. */
  excused: "excluded" | "present" | "absent";
  /** Hours after a session's attendance is first submitted in which it can still be corrected. 0: never. */
  editWindowHours: number;
  /** Q-04: the staff accounts that receive attendance alerts as academic coordinator. Empty: the section's teachers. */
  coordinatorIds: string[];
}

/** One correction to a submitted attendance sheet (FR-5.2). */
export interface AttendanceChange {
  at: string;
  byId: string;
  studentId: string;
  /** `null` when the student had no mark, for example because they joined the section later. */
  from: AttendanceStatus | null;
  to: AttendanceStatus;
}

/** FR-5.1: the attendance taken for one class session of a section. */
export interface AttendanceSheet {
  /** The session's id: section, date and start time (`sessionId()` in `domain/schedule.ts`). */
  id: string;
  sectionId: string;
  courseId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** "HH:MM", as in the section's schedule. */
  start: string;
  marks: Record<string, AttendanceStatus>;
  submittedAt: string;
  submittedById: string;
  /** Every correction made after it was submitted, oldest first. */
  changes: AttendanceChange[];
}

/** FR-5.5: whether a student is currently below the threshold in a course, so an alert is sent once per breach. */
export interface AttendanceAlertState {
  breached: boolean;
  /** When the alert for the current, or the latest, breach was sent. */
  alertedAt?: string;
}

/** FR-5.3: an entry on the academic calendar that is not a class or a due date. */
export interface CalendarEvent {
  id: string;
  title: string;
  kind: "exam" | "holiday" | "event";
  /** YYYY-MM-DD. */
  date: string;
  /** Last day of an event that runs over several days. */
  endDate?: string;
  /** "HH:MM". Absent: all day. */
  start?: string;
  end?: string;
  room?: string;
  /** The course it belongs to. Absent: the whole school. */
  courseId?: string;
  /** No classes meet on these dates: for the whole school, or for this course when it has one. */
  noClasses?: boolean;
  createdById: string;
}

export interface Term {
  id: string;
  name: string;
  /** ISO dates (YYYY-MM-DD), inclusive. */
  startsOn: string;
  endsOn: string;
  status: "upcoming" | "active" | "archived";
}

/** One weekly class meeting of a section (FR-2.1). */
export interface Meeting {
  /** Day of the week: 0 is Sunday, 6 is Saturday. */
  day: number;
  /** 24-hour local times, "HH:MM". */
  start: string;
  end: string;
  room?: string;
}

/** A class group taking a course in a term. Faculty teach sections; students enrol in them. */
export interface Section {
  id: string;
  courseId: string;
  termId: string;
  name: string;
  /** Short code used in CSV imports and the SIS feed, e.g. "CS-110-A" (FR-1.5). */
  code: string;
  facultyIds: string[];
  /** The weekly schedule. Feeds the timetable and calendar in Phase 5. */
  meetings: Meeting[];
}

/** A student's place in a section. Created by CSV or SIS import, never by hand (out of scope). */
export interface Enrollment {
  userId: string;
  sectionId: string;
}

/** FR-1.2 and NFR-3: who did what, and whether it was allowed. */
export interface AuditEvent {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: Role | null;
  /** Dotted verb, e.g. "auth.sign-in", "access.denied", "progress.reset". */
  action: string;
  /** What was acted on, e.g. "route:/gradebook" or "grades:u-s03". */
  resource: string;
  outcome: "allowed" | "denied";
  detail?: string;
}

export type NotificationChannel = "in-app" | "email" | "push";

export type NotificationCategory =
  | "announcements"
  | "messages"
  | "discussions"
  | "grades"
  | "deadlines"
  /** Exams, live classes, cancelled classes and other changes to the timetable. */
  | "schedule"
  | "attendance"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  readAt?: string;
  /** FR-6.7: mandatory alerts cannot be switched off. */
  mandatory?: boolean;
}

/** FR-6.7: which channels one person wants for each kind of notification. A kind with no entry uses the defaults. */
export type NotificationPrefs = Partial<Record<NotificationCategory, Record<NotificationChannel, boolean>>>;

/** FR-6.6: one email or push message handed to a delivery adapter. */
export interface DeliveryRecord {
  id: string;
  userId: string;
  channel: Exclude<NotificationChannel, "in-app">;
  /** The address or device it went to. */
  to: string;
  category: NotificationCategory;
  subject: string;
  body: string;
  sentAt: string;
  /** Sent although the person had switched this channel off, because the alert is mandatory. */
  mandatory?: boolean;
}

/** FR-6.7: which kinds of notification nobody can switch off. School policy (Q-21). */
export interface NotificationPolicy {
  mandatoryCategories: NotificationCategory[];
}

/** FR-6.2: who may start a conversation with whom, beyond the fixed rules (Q-20). */
export interface MessagingPolicy {
  /** Students may message the teachers of their sections. */
  studentsToTeachers: boolean;
  /** Students may message other students in the same section. */
  studentsToClassmates: boolean;
  /** Parents may message the teachers of their linked children. */
  parentsToTeachers: boolean;
}

// ---------------------------------------------------------------------------
// Grading policy (BR-14)
// ---------------------------------------------------------------------------

/** FR-4.1: a weighted group of grade items. A course's weights must total 100. */
export interface GradeCategory {
  id: string;
  name: string;
  /** Share of the course grade, in percent. */
  weight: number;
}

/** FR-4.1, FR-4.2: how one course's final grade is worked out. Set by its teachers. */
export interface GradebookSetup {
  courseId: string;
  categories: GradeCategory[];
  /** Which of the school's grading scales the course reports on. */
  scaleId: string;
  /** When on, work not handed in by its due date counts as zero. Off: it is left out of the total. */
  missingAsZero: boolean;
  /** FR-4.3: quizzes whose scores are held back from students until the teacher releases them. */
  heldQuizIds: string[];
}

export type GradingScaleKind = "percentage" | "letter" | "gpa";

export interface GradingScaleBand {
  /** Lowest percentage that earns this band. */
  min: number;
  label: string;
  /** Grade points, for GPA scales. */
  points?: number;
}

/**
 * FR-4.2: how a percentage is reported. Bands are school policy, so they are
 * data. A percentage scale has no bands; letter and GPA scales list theirs
 * from the highest down, ending with one that starts at 0.
 */
export interface GradingScale {
  id: string;
  name: string;
  kind: GradingScaleKind;
  bands: GradingScaleBand[];
}

// ---------------------------------------------------------------------------
// Courses and content
// ---------------------------------------------------------------------------

export type VideoKey = "sintel" | "bunny";

/** A question that pauses the video mid-lesson (Coursera-style in-video quiz). */
export interface Checkpoint {
  id: string;
  /** Where in the video it appears, as a fraction (0–1) of the duration. */
  position: number;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** BR-06: what a lesson delivers. */
export type LessonType = "video" | "reading" | "link" | "document" | "slides";

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  minutes: number;
  summary: string;
  keyPoints: string[];
  /** Photo shown as the video poster and in lesson lists. */
  thumbnail: string;
  /** Video lessons: which sample clip to play and its caption lines. */
  video?: VideoKey;
  transcript?: string[];
  checkpoints?: Checkpoint[];
  /** Reading lessons: body paragraphs. */
  body?: string[];
  /** Link lessons: the external page or embeddable media (FR-2.4). */
  url?: string;
  /** Document, slides and uploaded-video lessons: the content library item to show. */
  materialId?: string;
  /** FR-2.7: hidden from students until this moment (ISO date-time). */
  releaseAt?: string;
  /** FR-2.8: when set and not empty, only students in these sections see the lesson. */
  sectionIds?: string[];
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
  quizId?: string;
}

export interface Course {
  id: string;
  title: string;
  tagline: string;
  description: string;
  subject: string;
  level: Level;
  instructor: string;
  /** Short catalogue code, e.g. "CS-101" (FR-2.1). */
  code: string;
  termId: string;
  /** Archived courses are read-only; their grades stay viewable (FR-1.8). */
  status: "active" | "archived";
  /** First and last teaching day (YYYY-MM-DD). The term's dates apply when absent. */
  startsOn?: string;
  endsOn?: string;
  thumbnail: string;
  /** Shown behind the thumbnail while it loads. */
  accent: string;
  learners: number;
  rating: number;
  modules: CourseModule[];
}

interface QuestionBase {
  id: string;
  prompt: string;
  points: number;
  explanation: string;
}

export interface SingleChoiceQuestion extends QuestionBase {
  kind: "single";
  options: string[];
  answer: number;
}

export interface MultiChoiceQuestion extends QuestionBase {
  kind: "multi";
  options: string[];
  answer: number[];
}

export interface BooleanQuestion extends QuestionBase {
  kind: "boolean";
  answer: boolean;
}

export interface ShortAnswerQuestion extends QuestionBase {
  kind: "short";
  /**
   * US-12: how the answer is marked. `auto` gives full marks when the response
   * contains one of the `accept` phrases; `manual` sends it to the grading
   * queue for a teacher. Absent means `auto`, as in the original prototype.
   */
  marking?: "auto" | "manual";
  /** Auto marking: any one of these phrases in the response earns full marks. */
  accept: string[];
  sample: string;
}

/** FR-3.5: match each item on the left with one on the right. Auto-marked, with part marks. */
export interface MatchingQuestion extends QuestionBase {
  kind: "matching";
  pairs: Array<{ left: string; right: string }>;
  /** Extra choices on the right that match nothing. */
  distractors?: string[];
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | BooleanQuestion
  | ShortAnswerQuestion
  | MatchingQuestion;

/**
 * A response to one question. For matching it is one entry per left item: the
 * index of the chosen right-hand choice (pairs first, then distractors), or -1.
 */
export type Answer = number | number[] | boolean | string;
export type AnswerSheet = Record<string, Answer | undefined>;

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** Roughly how long it takes; shown when there is no time limit. */
  minutes: number;
  /** Percent needed to pass. */
  passMark: number;
  /** FR-4.1: the gradebook category it counts in. Absent: the course's category for quizzes. */
  categoryId?: string;
  due: string;
  questions: Question[];
  /** FR-3.7: minutes allowed per attempt. Absent means untimed. */
  timeLimitMinutes?: number;
  /** Attempts allowed per student. Absent means unlimited. */
  maxAttempts?: number;
  /** Students see and take only published quizzes. */
  status: "draft" | "published";
}

/** A mark given by a teacher to one answer (US-12). */
export interface ManualMark {
  points: number;
  feedback?: string;
  markedById: string;
  markedAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  earned: number;
  possible: number;
  percent: number;
  submittedAt: string;
  /** What the student answered. Kept for manual marking and review; older attempts have none. */
  answers?: AnswerSheet;
  /** Marks given by hand, by question id. */
  manual?: Record<string, ManualMark>;
  /**
   * `awaiting-marking` until every manually marked answer has a mark; then the
   * score is final and counts. `held` is what a student is given in place of an
   * attempt whose score the teacher has not released (FR-4.3): it has no score
   * and no answers.
   */
  status?: "graded" | "awaiting-marking" | "held";
  startedAt?: string;
  /** FR-3.7: handed in by the system because the time limit was reached. */
  autoSubmitted?: boolean;
}

/** FR-3.7: an attempt in progress. Answers are saved here as they are given. */
export interface QuizDraft {
  quizId: string;
  userId: string;
  startedAt: string;
  answers: AnswerSheet;
  savedAt: string;
}

/** FR-3.5: a reusable question in the shared question bank. */
export interface BankQuestion {
  id: string;
  /** The course it was written for, used to filter the bank. */
  courseId: string;
  addedById: string;
  addedAt: string;
  question: Question;
}

/** Everything one learner has done. Stored per user by the progress service. */
export interface LearnerProgress {
  completedLessons: string[];
  attempts: QuizAttempt[];
  /** In-video checkpoint id -> whether the first answer was correct. */
  checkpoints: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Assignments (BR-09, BR-10, BR-12, BR-13)
// ---------------------------------------------------------------------------

/** FR-3.4: what happens to work handed in after the due time. */
export interface LatePolicy {
  /** `block` refuses it, `flag` accepts and marks it late, `penalty` accepts it and deducts marks. */
  rule: "block" | "flag" | "penalty";
  /** Penalty: percent of the mark deducted, once or for each day late. */
  penaltyPercent: number;
  penaltyPer: "submission" | "day";
  /** Penalty per day: the most that can ever be deducted, in percent. */
  maxPenaltyPercent: number;
}

export interface RubricLevel {
  id: string;
  label: string;
  points: number;
}

/** One row of a rubric. Its `points` are its weight: the most it can contribute. */
export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  points: number;
  levels: RubricLevel[];
}

/** FR-3.2: criteria, levels and weighted points. The criteria's points add up to the assignment's. */
export interface Rubric {
  criteria: RubricCriterion[];
}

/** A file kept in the file store under `id`: an assignment attachment or part of a submission. */
export interface AttachedFile {
  id: string;
  name: string;
  sizeLabel: string;
  mimeType?: string;
}

export type SubmissionKind = "text" | "file";

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  points: number;
  /** FR-4.1: the gradebook category it counts in. Absent: the course's category for assignments. */
  categoryId?: string;
  /** ISO date-time. */
  dueAt: string;
  /** FR-3.1: the sections the assignment is set for. Never empty. */
  sectionIds: string[];
  attachments: AttachedFile[];
  /** How students hand work in: typed text, files, or either. */
  accepts: SubmissionKind[];
  rubric?: Rubric;
  late: LatePolicy;
  /** US-11: students may hand in again only when this is on. */
  allowResubmission: boolean;
  /** Students see only published assignments. */
  status: "draft" | "published";
  createdById: string;
  createdAt: string;
  publishedAt?: string;
}

/** FR-3.9: where in the submission a comment points. */
export type CommentAnchor =
  /** A run of characters in the typed text. `quote` is that text, kept for display. */
  | { kind: "text"; start: number; end: number; quote: string }
  /** One of the submitted files, optionally a page in it. */
  | { kind: "file"; fileId: string; page?: number };

export interface InlineComment {
  id: string;
  anchor: CommentAnchor;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface SubmissionGrade {
  /** Rubric assignments: the level chosen for each criterion, by criterion id. */
  rubricLevels?: Record<string, string>;
  /** The mark before any late penalty. */
  rawPoints: number;
  /** The mark that counts, after the late penalty. */
  points: number;
  feedback: string;
  gradedById: string;
  gradedAt: string;
  /** FR-4.3: the student sees the grade, feedback and comments only once this is set. */
  releasedAt?: string;
}

/** FR-3.8: the outcome of a plagiarism check. */
export interface SimilarityReport {
  provider: string;
  checkedAt: string;
  /** Share of the work that matches other sources, 0 to 100. */
  percent: number;
  matches: Array<{ source: string; percent: number }>;
}

/** One hand-in. A resubmission is a new record with the next attempt number. */
export interface Submission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  attempt: number;
  submittedAt: string;
  /** FR-3.3: the reference shown to the student as proof of submission. */
  receipt: string;
  text?: string;
  files: AttachedFile[];
  /** Set when the work came in after the due time (FR-3.4). */
  late?: { daysLate: number; penaltyPercent: number };
  comments: InlineComment[];
  grade?: SubmissionGrade;
  similarity?: SimilarityReport;
}

export interface PlanSegment {
  label: string;
  minutes: number;
  activity: string;
}

export interface PlanSession {
  title: string;
  segments: PlanSegment[];
}

export interface PlanWeek {
  week: number;
  phase: string;
  theme: string;
  outcomes: string[];
  sessions: PlanSession[];
  materials: string[];
  assessment: string;
}

export interface LessonPlanInput {
  topic: string;
  audience: string;
  weeks: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  goals: string;
  style: "Blended" | "Project-based" | "Lecture + practice";
  includeVideo: boolean;
  includeQuizzes: boolean;
  includeGroupWork: boolean;
}

export interface LessonPlan {
  id: string;
  createdAt: string;
  input: LessonPlanInput;
  title: string;
  overview: string;
  objectives: string[];
  workflow: { stage: string; detail: string }[];
  weeks: PlanWeek[];
  grading: { item: string; weight: number }[];
}

export type MaterialKind = "video" | "audio" | "document" | "slides";

/** An item in the shared content library (FR-2.3, FR-2.6). */
export interface Material {
  id: string;
  title: string;
  kind: MaterialKind;
  courseId: string;
  sizeLabel: string;
  durationLabel?: string;
  captions: "ready" | "generating" | "none";
  uploadedAt: string;
  /** Set for uploads. Seeded sample items have no file behind them. */
  fileName?: string;
  mimeType?: string;
  /** WebVTT text of the caption track attached to this item. */
  captionsVtt?: string;
  /** Captions produced by the placeholder "auto-caption" action. */
  demoCaptions?: boolean;
}

/** FR-2.5: a reusable course structure with its content and no student data. */
export interface CourseTemplate {
  id: string;
  name: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  /** The course as it was when the template was saved. Its id and term are not reused. */
  course: Course;
  /** Section names and schedules, keyed by the ids the lessons' `sectionIds` refer to. */
  sections: Array<Pick<Section, "id" | "name" | "meetings">>;
  /** The course's quizzes, copied with it (US-08). Templates saved before quizzes could be copied have none. */
  quizzes?: Quiz[];
  /** The course's grade categories, scale and missing-work rule (US-16). Older templates have none. */
  gradebook?: Pick<GradebookSetup, "categories" | "scaleId" | "missingAsZero">;
}
