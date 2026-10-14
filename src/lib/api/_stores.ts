"use client";

/**
 * Every mock repository, in one place so services can share them without
 * importing each other. Each one stands in for a backend table.
 */
import { seedAssignments, seedSubmissions } from "@/lib/data/assignments";
import { courses as seedCourses } from "@/lib/data/courses";
import {
  DEMO_USER_IDS,
  seedEnrollments,
  seedQuestionBank,
  seedNotifications,
  seedProgress,
  seedSections,
  seedTerms,
  seedUsers,
} from "@/lib/data/directory";
import { materials as seedMaterials } from "@/lib/data/people";
import { quizzes as seedQuizzes } from "@/lib/data/quizzes";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import type {
  Assignment,
  AuditEvent,
  BankQuestion,
  Course,
  CourseTemplate,
  Enrollment,
  LearnerProgress,
  LessonPlan,
  Material,
  Notification,
  Quiz,
  QuizDraft,
  SchoolSettings,
  Section,
  Submission,
  Term,
  User,
} from "@/lib/types";
import { createRepository } from "./_repository";

/** Progress saved by the single-user prototype, before accounts existed. */
const LEGACY_LEARNER_KEY = "lumen-lms:learner:v1";

function readLegacyLearner(): (Partial<LearnerProgress> & { savedPlans?: LessonPlan[] }) | undefined {
  try {
    const raw = window.localStorage.getItem(LEGACY_LEARNER_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export const usersRepo = createRepository<User[]>("users", 1, seedUsers);
export const termsRepo = createRepository<Term[]>("terms", 2, seedTerms);
export const sectionsRepo = createRepository<Section[]>("sections", 3, seedSections);

/** The course catalogue: every course with its units and lessons. */
export const coursesRepo = createRepository<Course[]>("courses", 1, seedCourses);

const NO_TEMPLATES: CourseTemplate[] = [];

/** FR-2.5: course templates shared by all faculty. */
export const templatesRepo = createRepository<CourseTemplate[]>("course-templates", 1, NO_TEMPLATES);

/** FR-2.6: the shared content library. The files themselves are in `_files.ts`. */
export const materialsRepo = createRepository<Material[]>("materials", 1, seedMaterials);
export const enrollmentsRepo = createRepository<Enrollment[]>("enrollments", 1, seedEnrollments);

/** Learner progress keyed by user id. */
export const progressRepo = createRepository<Record<string, LearnerProgress>>(
  "progress",
  2,
  seedProgress,
  () => {
    const legacy = readLegacyLearner();
    if (!legacy) return undefined;
    const seed = seedProgress[DEMO_USER_IDS.student];
    return {
      ...seedProgress,
      [DEMO_USER_IDS.student]: {
        completedLessons: legacy.completedLessons ?? seed.completedLessons,
        attempts: legacy.attempts ?? seed.attempts,
        checkpoints: legacy.checkpoints ?? seed.checkpoints,
      },
    };
  },
);

const NO_PLANS: Record<string, LessonPlan[]> = {};

/** Saved lesson plans keyed by the faculty member who owns them. */
export const lessonPlansRepo = createRepository<Record<string, LessonPlan[]>>(
  "lesson-plans",
  1,
  NO_PLANS,
  () => {
    const plans = readLegacyLearner()?.savedPlans;
    return plans?.length ? { [DEMO_USER_IDS.faculty]: plans } : undefined;
  },
);

export const notificationsRepo = createRepository<Notification[]>(
  "notifications",
  1,
  seedNotifications,
);

const NO_EVENTS: AuditEvent[] = [];

/** Newest first. A real audit store must be append-only and tamper-evident (NFR-3). */
export const auditRepo = createRepository<AuditEvent[]>("audit", 1, NO_EVENTS);

const NO_SELECTION: Record<string, string> = {};

/** Which linked child a parent is currently looking at, keyed by parent id. */
export const viewedChildRepo = createRepository<Record<string, string>>(
  "viewed-child",
  1,
  NO_SELECTION,
);

/** School-wide policy set by admins. One record, not a list. */
export const settingsRepo = createRepository<SchoolSettings>("settings", 3, DEFAULT_SETTINGS);

/** FR-3.1: assignments, drafts included. */
export const assignmentsRepo = createRepository<Assignment[]>("assignments", 1, seedAssignments);

/** FR-3.3: every hand-in, with its inline comments, grade and similarity report. Attached files are in `_files.ts`. */
export const submissionsRepo = createRepository<Submission[]>("submissions", 1, seedSubmissions);

export interface MockCredential {
  digest: string;
  setAt: string;
}

const NO_CREDENTIALS: Record<string, MockCredential> = {};

/**
 * MOCK passwords for local accounts, keyed by user id. An account with no
 * entry still accepts the shared demo password rule. The backend stores
 * salted, slow hashes and never sends them to a browser.
 */
export const credentialsRepo = createRepository<Record<string, MockCredential>>(
  "credentials",
  1,
  NO_CREDENTIALS,
);

export interface SisSyncState {
  lastRunAt: string | null;
  created: number;
  skipped: number;
  failed: number;
}

/** The outcome of the latest manual SIS sync (FR-1.6). */
export const sisSyncRepo = createRepository<SisSyncState>("sis-sync", 1, {
  lastRunAt: null,
  created: 0,
  skipped: 0,
  failed: 0,
});

/** FR-3.5: quizzes with their questions and answer keys, drafts included. */
export const quizzesRepo = createRepository<Quiz[]>("quizzes", 1, seedQuizzes);

const NO_DRAFTS: Record<string, QuizDraft> = {};

/** FR-3.7: attempts in progress, keyed by `userId:quizId`. Answers are saved here as they are given. */
export const quizDraftsRepo = createRepository<Record<string, QuizDraft>>("quiz-drafts", 1, NO_DRAFTS);

/** FR-3.5: the question bank shared by all faculty. */
export const questionBankRepo = createRepository<BankQuestion[]>("question-bank", 1, seedQuestionBank);
