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

/** Staff and students sign in with their college account; parents use a personal address. */
const SCHOOL_EMAIL_DOMAIN = "dbcc.edu.ph";
const PARENT_EMAIL_DOMAIN = "gmail.com";

/**
 * "Dr. Maria Cristina Alcantara" -> "maria.alcantara@dbcc.edu.ph": first given
 * name and surname, with titles and anything after a comma ("SDB") dropped.
 */
function emailFor(name: string, domain: string) {
  const words = name
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && !word.endsWith("."));
  const plain = words.length > 1 ? `${words[0]}.${words[words.length - 1]}` : (words[0] ?? "");
  return `${plain}@${domain}`;
}

function user(id: string, name: string, role: Role, extra: Partial<User> = {}): User {
  const domain = role === "parent" ? PARENT_EMAIL_DOMAIN : SCHOOL_EMAIL_DOMAIN;
  return { id, name, email: emailFor(name, domain), role, status: "active", ...extra };
}

/** The account each role signs in as from the demo role switcher. */
export const DEMO_USER_IDS: Record<Role, string> = {
  student: "u-student-manalo",
  faculty: "u-faculty-alcantara",
  admin: "u-admin-panganiban",
  parent: "u-parent-manalo",
};

const CLASSMATES = [
  "Angelica Mae Dimaano",
  "John Paul Mercado",
  "Kristine Joy Pascual",
  "Jericho Ramos",
  "Bea Patricia Lazaro",
  "Christian Dave Tolentino",
  "Mary Grace Cabrera",
  "Rafael Antonio Salvador",
  "Jasmine Nicole Macalalad",
  "Kenneth Ian Bondoc",
  "Jonalyn Hernandez",
  "Ezekiel James Pangilinan",
];

/** Student numbers are the admission year and a five-digit serial, as the registrar issues them. */
const STUDENT_NUMBERS = [
  "2023-00418",
  "2023-00455",
  "2023-00467",
  "2023-00502",
  "2023-00519",
  "2023-00536",
  "2023-00541",
  "2023-00588",
  "2023-00604",
  "2023-00627",
  "2023-00653",
  "2023-00671",
];

/** A last sign-in this many days before the seeded "today", 14 October 2026, at 08:30 UTC (FR-7.1). */
function signedIn(daysAgo: number) {
  return new Date(Date.parse("2026-10-14T08:30:00.000Z") - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

/** Days since each classmate last signed in. One has never signed in, and one not for over two weeks. */
const CLASSMATE_LAST_SIGN_IN: Array<number | null> = [0, 1, 0, 9, 1, 2, 0, 3, null, 0, 1, 16];

const demoStudent = user(DEMO_USER_IDS.student, "Miguel Angelo Manalo", "student", {
  sisId: "2023-00412",
  lastLoginAt: signedIn(1),
});

const classmates = CLASSMATES.map((name, index) => {
  const daysAgo = CLASSMATE_LAST_SIGN_IN[index];
  return user(`u-student-${String(index + 1).padStart(2, "0")}`, name, "student", {
    sisId: STUDENT_NUMBERS[index],
    ...(daysAgo === null ? {} : { lastLoginAt: signedIn(daysAgo) }),
  });
});

/** Which faculty member teaches each seeded course. Names match `Course.instructor`. */
const TEACHING: Array<{ courseId: string; facultyId: string; name: string }> = [
  { courseId: "ml-foundations", facultyId: "u-faculty-alcantara", name: "Dr. Maria Cristina Alcantara" },
  { courseId: "web-dev", facultyId: "u-faculty-villanueva", name: "Mr. Jerome Villanueva" },
  { courseId: "cell-biology", facultyId: "u-faculty-macaraeg", name: "Dr. Lourdes Macaraeg" },
  { courseId: "money-skills", facultyId: "u-faculty-dimaculangan", name: "Ms. Katrina Dimaculangan" },
  { courseId: "ethics", facultyId: "u-faculty-magtibay", name: "Mr. Joselito Magtibay" },
  { courseId: "salesian-formation", facultyId: "u-faculty-santiago", name: "Fr. Dennis Santiago, SDB" },
  { courseId: "assessment-learning", facultyId: "u-faculty-castillo", name: "Dr. Evangeline Castillo" },
  { courseId: "automotive-engines", facultyId: "u-faculty-abad", name: "Engr. Rodolfo Abad" },
];

export const seedUsers: User[] = [
  demoStudent,
  ...classmates,
  ...TEACHING.map((entry, index) => user(entry.facultyId, entry.name, "faculty", { lastLoginAt: signedIn([0, 1, 4, 2, 0, 1, 3, 5][index]) })),
  user(DEMO_USER_IDS.admin, "Ms. Rowena Panganiban", "admin", { lastLoginAt: signedIn(0) }),
  user(DEMO_USER_IDS.parent, "Teresita Manalo", "parent", { childIds: [demoStudent.id], lastLoginAt: signedIn(3) }),
  user("u-parent-dimaano", "Gloria Dimaano", "parent", { childIds: [classmates[0].id] }),
];

export const seedTerms: Term[] = [
  {
    id: "term-2026-1",
    name: "AY 2026–2027 · 1st Semester",
    startsOn: "2026-08-24",
    endsOn: "2026-12-18",
    status: "active",
  },
  {
    id: "term-2026-2",
    name: "AY 2026–2027 · 2nd Semester",
    startsOn: "2027-01-11",
    endsOn: "2027-05-28",
    status: "upcoming",
  },
];

interface ClassSlot {
  /** Days of the week, 0 is Sunday. */
  days: number[];
  start: string;
  end: string;
  room: string;
}

const MON_WED = [1, 3];
const TUE_THU = [2, 4];

/**
 * When and where each course meets, for Section A and Section B. Lecture
 * courses meet twice a week for 90 minutes. The Salesian formation class meets
 * on Fridays, and the automotive shop block is one long session. The midterm
 * exams are set in the classes' own slots (see `attendance.ts`), so no two of
 * a student's courses overlap.
 */
const CLASS_SLOTS: Record<string, [ClassSlot, ClassSlot]> = {
  "ml-foundations": [
    { days: MON_WED, start: "07:30", end: "09:00", room: "Computer Lab 3" },
    { days: TUE_THU, start: "07:30", end: "09:00", room: "Computer Lab 3" },
  ],
  "web-dev": [
    { days: MON_WED, start: "09:00", end: "10:30", room: "Computer Lab 1" },
    { days: TUE_THU, start: "09:00", end: "10:30", room: "Computer Lab 1" },
  ],
  "cell-biology": [
    { days: MON_WED, start: "10:30", end: "12:00", room: "Science Laboratory" },
    { days: TUE_THU, start: "10:30", end: "12:00", room: "Science Laboratory" },
  ],
  ethics: [
    { days: MON_WED, start: "13:00", end: "14:30", room: "Room 301" },
    { days: TUE_THU, start: "13:00", end: "14:30", room: "Room 301" },
  ],
  "assessment-learning": [
    { days: MON_WED, start: "14:30", end: "16:00", room: "Room 402" },
    { days: TUE_THU, start: "14:30", end: "16:00", room: "Room 402" },
  ],
  "money-skills": [
    { days: MON_WED, start: "16:00", end: "17:30", room: "Room 305" },
    { days: TUE_THU, start: "16:00", end: "17:30", room: "Room 305" },
  ],
  "salesian-formation": [
    { days: [5], start: "13:00", end: "14:30", room: "Salesian Hall" },
    { days: [5], start: "14:30", end: "16:00", room: "Salesian Hall" },
  ],
  "automotive-engines": [
    { days: [5], start: "07:30", end: "10:30", room: "Automotive Shop" },
    { days: [6], start: "07:30", end: "10:30", room: "Automotive Shop" },
  ],
};

/** Two sections per course, both taught by the course's instructor. */
export const seedSections: Section[] = courses.flatMap((course) => {
  const facultyId = TEACHING.find((entry) => entry.courseId === course.id)?.facultyId;
  return ["A", "B"].map((letter, letterIndex) => {
    const slot = CLASS_SLOTS[course.id][letterIndex];
    return {
      id: `${course.id}-${letter.toLowerCase()}`,
      courseId: course.id,
      termId: course.termId,
      name: `Section ${letter}`,
      code: `${course.code}-${letter}`,
      facultyIds: facultyId ? [facultyId] : [],
      meetings: slot.days.map((day) => ({ day, start: slot.start, end: slot.end, room: slot.room })),
    };
  });
});

/**
 * Who takes the program courses, by classmate index. Education students take
 * Assessment in Learning 1 and the technical-vocational teacher education
 * students take the automotive course; every other course is open to the whole
 * seeded class, which is a demo simplification.
 */
const COURSE_ROSTER: Record<string, number[]> = {
  "assessment-learning": [0, 1, 2, 3, 4, 5],
  "automotive-engines": [6, 7, 8, 9, 10, 11],
};

/** The demo student is an IT student, so does not take the education or automotive courses. */
const DEMO_STUDENT_EXCLUDED = new Set(["assessment-learning", "automotive-engines"]);

function classmateTakes(index: number, courseId: string) {
  const roster = COURSE_ROSTER[courseId];
  return roster === undefined || roster.includes(index);
}

/** Classmates alternate between sections. */
export const seedEnrollments: Enrollment[] = courses.flatMap((course) => [
  ...(DEMO_STUDENT_EXCLUDED.has(course.id) ? [] : [{ userId: demoStudent.id, sectionId: `${course.id}-a` }]),
  ...classmates.flatMap((classmate, index) =>
    classmateTakes(index, course.id)
      ? [{ userId: classmate.id, sectionId: `${course.id}-${index % 2 === 0 ? "a" : "b"}` }]
      : [],
  ),
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

/**
 * Classmates whose quiz scores are seeded low, by index. Jericho Ramos also has
 * low attendance in Machine Learning (`src/lib/data/attendance.ts`), so the
 * default at-risk rules list him (FR-7.3).
 */
const WEAK_PERFORMERS: Record<number, number> = { 3: 46 };

/** The seeded "today". A quiz that is still open has no seeded attempts from it onwards. */
const SEEDED_NOW = Date.parse("2026-10-14T08:30:00.000Z");

/** The general courses' quizzes keep the attempts they were first seeded with, even where the date is a little ahead of today. */
const GENERAL_QUIZ_COUNT = 6;

function classmateProgress(studentIndex: number, userId: string): LearnerProgress {
  const random = seeded(studentIndex * 97 + 13);
  const ability = WEAK_PERFORMERS[studentIndex] ?? 52 + random() * 44;
  const attempts: LearnerProgress["attempts"] = [];
  for (const [quizIndex, quiz] of quizzes.entries()) {
    if (!classmateTakes(studentIndex, quiz.courseId)) continue;
    const missed = random() < 0.12;
    const raw = ability + (random() - 0.5) * 26;
    if (missed) continue;
    // Scores land on multiples of 5 to look like real quiz results.
    const percent = Math.round(Math.min(100, Math.max(30, raw)) / 5) * 5;
    const possible = quizPoints(quiz);
    // Submitted a few days before the due date.
    const submittedAt = Date.parse(quiz.due) - (2 + (studentIndex % 5)) * DAY_MS;
    if (quizIndex >= GENERAL_QUIZ_COUNT && submittedAt > SEEDED_NOW) continue;
    attempts.push({
      id: `seed-${userId}-${quiz.id}`,
      quizId: quiz.id,
      earned: (percent / 100) * possible,
      possible,
      percent,
      submittedAt: new Date(submittedAt).toISOString(),
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
      : { q7: { points: seed.marked, feedback: "Clear and correct.", markedById: "u-faculty-alcantara", markedAt: "2026-10-13T15:00:00.000Z" } },
  );
  return [...attempts.filter((candidate) => candidate.quizId !== quiz.id), attempt];
}

const demoStudentProgress: LearnerProgress = {
  completedLessons: [
    "ml-learning-from-data",
    "ml-supervised-unsupervised",
    "ml-short-history",
    "web-how-web-works",
    "eth-moral-agent",
    "sal-becchi-valdocco",
    "sal-salesian-family",
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
    {
      id: "seed-4",
      quizId: "eth-quiz-1",
      earned: 11,
      possible: 14,
      percent: 79,
      submittedAt: "2026-10-03T11:40:00.000Z",
    },
    {
      id: "seed-5",
      quizId: "sal-quiz-1",
      earned: 10,
      possible: 12,
      percent: 83,
      submittedAt: "2026-10-05T05:55:00.000Z",
    },
  ],
  checkpoints: {
    "cp-ml-1a": true,
    "cp-ml-1b": true,
    "cp-ml-2a": false,
    "cp-web-1a": true,
    "cp-eth-1a": true,
    "cp-eth-1b": false,
    "cp-sal-1a": true,
    "cp-sal-1b": true,
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
    body: "Unit 1 quiz: Inside the cell is due in General Biology: Cells and Genetics.",
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
    id: "seed-note-6",
    userId: DEMO_USER_IDS.student,
    category: "grades",
    title: "Assignment graded: 17/20",
    body: "Your reflection paper in Ethics has been marked and released, with a comment from Mr. Magtibay.",
    href: "/grades",
    createdAt: "2026-10-14T03:00:00.000Z",
  },
  {
    id: "seed-note-7",
    userId: DEMO_USER_IDS.student,
    category: "deadlines",
    title: "Case analysis due Nov 6",
    body: "Case analysis: academic honesty in a group project is due in Ethics.",
    href: "/assignments/asg-eth-case",
    createdAt: "2026-10-12T02:30:00.000Z",
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
    title: "Miguel scored 90%",
    body: "Unit 1 quiz: HTML and structure in Web Systems and Technologies.",
    href: "/grades",
    createdAt: "2026-10-08T16:46:00.000Z",
  },
  {
    id: "seed-note-5",
    userId: DEMO_USER_IDS.admin,
    category: "system",
    title: "1st Semester ends Dec 18",
    body: "AY 2026–2027 · 1st Semester runs from Aug 24 to Dec 18. Final grades are due at the Registrar's Office by Jan 8.",
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
