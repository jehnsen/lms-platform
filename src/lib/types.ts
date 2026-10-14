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
}

export interface Term {
  id: string;
  name: string;
  /** ISO dates (YYYY-MM-DD), inclusive. */
  startsOn: string;
  endsOn: string;
  status: "upcoming" | "active" | "archived";
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
  | "grades"
  | "deadlines"
  | "announcements"
  | "attendance"
  | "messages"
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

/** FR-6.7: which channels a user wants for one category. */
export interface NotificationPref {
  userId: string;
  category: NotificationCategory;
  channels: Record<NotificationChannel, boolean>;
}

// ---------------------------------------------------------------------------
// Grading policy (BR-14)
// ---------------------------------------------------------------------------

/** FR-4.1: a weighted group of grade items. A course's weights must total 100. */
export interface GradeCategory {
  id: string;
  courseId: string;
  name: string;
  weight: number;
}

export type GradingScaleKind = "percentage" | "letter" | "gpa";

export interface GradingScaleBand {
  /** Lowest percentage that earns this band. */
  min: number;
  label: string;
  /** Grade points, for GPA scales. */
  points?: number;
}

/** FR-4.2: how a percentage is reported. Bands are school policy, so they are data. */
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

export interface Lesson {
  id: string;
  title: string;
  type: "video" | "reading";
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
  /** Any one of these phrases in the response earns full marks. */
  accept: string[];
  sample: string;
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | BooleanQuestion
  | ShortAnswerQuestion;

export type Answer = number | number[] | boolean | string;
export type AnswerSheet = Record<string, Answer | undefined>;

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  minutes: number;
  /** Percent needed to pass. */
  passMark: number;
  /** Share of the course grade, in percent. */
  weight: number;
  due: string;
  questions: Question[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  earned: number;
  possible: number;
  percent: number;
  submittedAt: string;
}

/** Everything one learner has done. Stored per user by the progress service. */
export interface LearnerProgress {
  completedLessons: string[];
  attempts: QuizAttempt[];
  /** In-video checkpoint id -> whether the first answer was correct. */
  checkpoints: Record<string, boolean>;
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

export interface Material {
  id: string;
  title: string;
  kind: "video" | "audio" | "document";
  courseId: string;
  sizeLabel: string;
  durationLabel?: string;
  captions: "ready" | "generating" | "none";
  uploadedAt: string;
}
