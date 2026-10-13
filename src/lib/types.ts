export type Level = "Beginner" | "Intermediate" | "Advanced";

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

export interface Student {
  id: string;
  name: string;
  /** Percent per quiz id; null when not submitted. */
  scores: Record<string, number | null>;
}
