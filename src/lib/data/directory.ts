/**
 * Seed data for people and school structure: users in all four roles, the
 * term, sections, enrollments, each learner's starting progress, and a few
 * notifications. The service layer loads these into its mock repositories.
 */
import { buildAttempt } from "@/lib/domain/quizzes";
import { quizPoints } from "@/lib/grading";
import type {
  AnswerSheet,
  BankQuestion,
  Enrollment,
  LearnerProgress,
  Notification,
  Role,
  Section,
  Term,
  User,
} from "@/lib/types";
import { courses } from "./courses";
import { quizzes } from "./quizzes";

function emailFor(name: string) {
  const plain = name
    .replace(/^Dr\.\s+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".");
  return `${plain}@example.com`;
}

function user(id: string, name: string, role: Role, extra: Partial<User> = {}): User {
  return { id, name, email: emailFor(name), role, status: "active", ...extra };
}

/** The account each role signs in as from the demo role switcher. */
export const DEMO_USER_IDS: Record<Role, string> = {
  student: "u-student-mike",
  faculty: "u-faculty-okafor",
  admin: "u-admin-nair",
  parent: "u-parent-manabat",
};

const CLASSMATES = [
  "Aiko Tanaka",
  "Ben Okonkwo",
  "Camila Duarte",
  "Devon Clarke",
  "Elif Yilmaz",
  "Farah Siddiqui",
  "Gabriel Santos",
  "Hana Kobayashi",
  "Isaac Mensah",
  "Jia Li",
  "Kofi Boateng",
  "Lucía Herrera",
];

const demoStudent = user(DEMO_USER_IDS.student, "Mike Manabat", "student", { sisId: "S-1000" });

const classmates = CLASSMATES.map((name, index) =>
  user(`u-student-${String(index + 1).padStart(2, "0")}`, name, "student", {
    sisId: `S-${1001 + index}`,
  }),
);

/** Which faculty member teaches each seeded course. Names match `Course.instructor`. */
const TEACHING: Array<{ courseId: string; facultyId: string; name: string }> = [
  { courseId: "ml-foundations", facultyId: "u-faculty-okafor", name: "Dr. Amara Okafor" },
  { courseId: "web-dev", facultyId: "u-faculty-reyes", name: "Marco Reyes" },
  { courseId: "cell-biology", facultyId: "u-faculty-park", name: "Dr. Lena Park" },
  { courseId: "money-skills", facultyId: "u-faculty-mendes", name: "Sofia Mendes" },
];

export const seedUsers: User[] = [
  demoStudent,
  ...classmates,
  ...TEACHING.map((entry) => user(entry.facultyId, entry.name, "faculty")),
  user(DEMO_USER_IDS.admin, "Priya Nair", "admin"),
  user(DEMO_USER_IDS.parent, "Rosa Manabat", "parent", { childIds: [demoStudent.id] }),
  user("u-parent-tanaka", "Kenji Tanaka", "parent", { childIds: [classmates[0].id] }),
];

export const seedTerms: Term[] = [
  {
    id: "term-2026-1",
    name: "2026–27 Term 1",
    startsOn: "2026-08-24",
    endsOn: "2026-12-18",
    status: "active",
  },
  {
    id: "term-2026-2",
    name: "2026–27 Term 2",
    startsOn: "2027-01-11",
    endsOn: "2027-05-28",
    status: "upcoming",
  },
];

/**
 * Two sections per course, both taught by the course's instructor. Section A
 * meets on Monday and Wednesday, Section B on Tuesday and Thursday; each
 * course has its own hour and room.
 */
export const seedSections: Section[] = courses.flatMap((course, courseIndex) => {
  const facultyId = TEACHING.find((entry) => entry.courseId === course.id)?.facultyId;
  const hour = String(8 + courseIndex).padStart(2, "0");
  return ["A", "B"].map((letter, letterIndex) => ({
    id: `${course.id}-${letter.toLowerCase()}`,
    courseId: course.id,
    termId: course.termId,
    name: `Section ${letter}`,
    code: `${course.code}-${letter}`,
    facultyIds: facultyId ? [facultyId] : [],
    meetings: [1 + letterIndex, 3 + letterIndex].map((day) => ({
      day,
      start: `${hour}:00`,
      end: `${hour}:50`,
      room: `Room ${101 + courseIndex}`,
    })),
  }));
});

/** Every seeded student takes every course; classmates alternate between sections. */
export const seedEnrollments: Enrollment[] = courses.flatMap((course) => [
  { userId: demoStudent.id, sectionId: `${course.id}-a` },
  ...classmates.map((classmate, index) => ({
    userId: classmate.id,
    sectionId: `${course.id}-${index % 2 === 0 ? "a" : "b"}`,
  })),
]);

/** Small deterministic generator so seeded scores are the same on every run. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function classmateProgress(studentIndex: number, userId: string): LearnerProgress {
  const random = seeded(studentIndex * 97 + 13);
  const ability = 52 + random() * 44;
  const attempts: LearnerProgress["attempts"] = [];
  for (const quiz of quizzes) {
    const missed = random() < 0.12;
    const raw = ability + (random() - 0.5) * 26;
    if (missed) continue;
    // Scores land on multiples of 5 to look like real quiz results.
    const percent = Math.round(Math.min(100, Math.max(30, raw)) / 5) * 5;
    const possible = quizPoints(quiz);
    attempts.push({
      id: `seed-${userId}-${quiz.id}`,
      quizId: quiz.id,
      earned: (percent / 100) * possible,
      possible,
      percent,
      // Submitted a few days before the due date.
      submittedAt: new Date(Date.parse(quiz.due) - (2 + (studentIndex % 5)) * DAY_MS).toISOString(),
    });
  }
  return { completedLessons: [], attempts: withHandMarkedQuiz(studentIndex, userId, attempts), checkpoints: {} };
}

/**
 * US-12: three classmates have taken the timed quiz, which has an answer a
 * teacher marks. Two are waiting in the grading queue; one is already marked.
 */
const HAND_MARKED_QUIZ_ID = "ml-quiz-2";

const HAND_MARKED_ANSWERS: Record<number, { answers: AnswerSheet; marked?: number }> = {
  2: {
    answers: {
      q1: 1,
      q2: 1,
      q3: [0, 1, 3],
      q4: false,
      q5: "generalization",
      q6: [0, 1, 2, 3],
      q7: "Because the model has already seen the training data, its score there is too kind. The validation set is new to it, so the score is honest and we can see if it is overfitting.",
    },
  },
  4: {
    answers: {
      q1: 1,
      q2: 0,
      q3: [0, 3],
      q4: false,
      q5: "generalisation",
      q6: [0, 1, 3, 2],
      q7: "So we can test it.",
    },
  },
  6: {
    answers: {
      q1: 1,
      q2: 1,
      q3: [0, 1],
      q4: true,
      q5: "accuracy",
      q6: [0, 1, 2, 3],
      q7: "The validation data is not used for training. If the error is low on training data but high on validation data the model is overfitting.",
    },
    marked: 3,
  },
};

function withHandMarkedQuiz(studentIndex: number, userId: string, attempts: LearnerProgress["attempts"]) {
  const seed = HAND_MARKED_ANSWERS[studentIndex];
  const quiz = quizzes.find((candidate) => candidate.id === HAND_MARKED_QUIZ_ID);
  if (!seed || !quiz) return attempts;
  const attempt = buildAttempt(
    quiz,
    seed.answers,
    {
      id: `seed-${userId}-${quiz.id}`,
      startedAt: `2026-10-13T10:0${studentIndex}:00.000Z`,
      submittedAt: `2026-10-13T10:1${studentIndex}:00.000Z`,
    },
    seed.marked === undefined
      ? {}
      : { q7: { points: seed.marked, feedback: "Clear and correct.", markedById: "u-faculty-okafor", markedAt: "2026-10-13T15:00:00.000Z" } },
  );
  return [...attempts.filter((candidate) => candidate.quizId !== quiz.id), attempt];
}

const demoStudentProgress: LearnerProgress = {
  completedLessons: [
    "ml-learning-from-data",
    "ml-supervised-unsupervised",
    "ml-short-history",
    "web-how-web-works",
  ],
  attempts: [
    {
      id: "seed-1",
      quizId: "ml-quiz-1",
      earned: 8,
      possible: 10,
      percent: 80,
      submittedAt: "2026-10-02T09:30:00.000Z",
    },
    {
      id: "seed-2",
      quizId: "web-quiz-1",
      earned: 6,
      possible: 10,
      percent: 60,
      submittedAt: "2026-10-06T15:10:00.000Z",
    },
    {
      id: "seed-3",
      quizId: "web-quiz-1",
      earned: 9,
      possible: 10,
      percent: 90,
      submittedAt: "2026-10-08T16:45:00.000Z",
    },
  ],
  checkpoints: {
    "cp-ml-1a": true,
    "cp-ml-1b": true,
    "cp-ml-2a": false,
    "cp-web-1a": true,
  },
};

/** Progress keyed by user id. */
export const seedProgress: Record<string, LearnerProgress> = {
  [demoStudent.id]: demoStudentProgress,
  ...Object.fromEntries(
    classmates.map((classmate, index) => [classmate.id, classmateProgress(index, classmate.id)]),
  ),
};

export const seedNotifications: Notification[] = [
  {
    id: "seed-note-1",
    userId: DEMO_USER_IDS.student,
    category: "deadlines",
    title: "Quiz due Oct 24",
    body: "Unit 1 quiz: Inside the cell is due in Biology: Cells and Genetics.",
    href: "/quizzes/bio-quiz-1",
    createdAt: "2026-10-12T08:00:00.000Z",
  },
  {
    id: "seed-note-2",
    userId: DEMO_USER_IDS.student,
    category: "grades",
    title: "Quiz graded: 90%",
    body: "Your score for Unit 1 quiz: HTML and structure is in.",
    href: "/grades",
    createdAt: "2026-10-08T16:46:00.000Z",
    readAt: "2026-10-08T18:00:00.000Z",
  },
  {
    id: "seed-note-3",
    userId: DEMO_USER_IDS.faculty,
    category: "grades",
    title: "New quiz submissions",
    body: "Learners have submitted Unit 1 quiz: What is machine learning?",
    href: "/gradebook",
    createdAt: "2026-10-12T09:15:00.000Z",
  },
  {
    id: "seed-note-4",
    userId: DEMO_USER_IDS.parent,
    category: "grades",
    title: "Mike scored 90%",
    body: "Unit 1 quiz: HTML and structure in Web Development Fundamentals.",
    href: "/grades",
    createdAt: "2026-10-08T16:46:00.000Z",
  },
  {
    id: "seed-note-5",
    userId: DEMO_USER_IDS.admin,
    category: "system",
    title: "Term 1 ends Dec 18",
    body: "2026–27 Term 1 runs from Aug 24 to Dec 18.",
    createdAt: "2026-10-01T08:00:00.000Z",
    mandatory: true,
  },
];

/** FR-3.5: the shared question bank starts with every seeded quiz question, filed under its course. */
export const seedQuestionBank: BankQuestion[] = quizzes.flatMap((quiz) =>
  quiz.questions.map((question) => {
    const id = `bank-${quiz.id}-${question.id}`;
    return {
      id,
      courseId: quiz.courseId,
      addedById: TEACHING.find((entry) => entry.courseId === quiz.courseId)?.facultyId ?? DEMO_USER_IDS.faculty,
      addedAt: "2026-09-01T08:00:00.000Z",
      question: { ...question, id },
    };
  }),
);
