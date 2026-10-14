/**
 * Seed data for assignments and the work handed in for them, so each role has
 * something to look at: marked and released work, marked work waiting to be
 * released, unmarked work, late work, and assignments still to do.
 */
import { receiptCode } from "@/lib/domain/assignments";
import type { Assignment, LatePolicy, Rubric, Submission } from "@/lib/types";

const FLAG: LatePolicy = { rule: "flag", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 };

const reflectionRubric: Rubric = {
  criteria: [
    {
      id: "rf-understanding",
      title: "Understanding",
      description: "Shows what makes a system one that learns from data.",
      points: 12,
      levels: [
        { id: "rf-understanding-4", label: "Excellent", points: 12 },
        { id: "rf-understanding-3", label: "Good", points: 9 },
        { id: "rf-understanding-2", label: "Developing", points: 6 },
        { id: "rf-understanding-1", label: "Beginning", points: 3 },
      ],
    },
    {
      id: "rf-clarity",
      title: "Clarity",
      description: "Organised, concrete and easy to follow.",
      points: 8,
      levels: [
        { id: "rf-clarity-4", label: "Excellent", points: 8 },
        { id: "rf-clarity-3", label: "Good", points: 6 },
        { id: "rf-clarity-2", label: "Developing", points: 4 },
        { id: "rf-clarity-1", label: "Beginning", points: 2 },
      ],
    },
  ],
};

const projectRubric: Rubric = {
  criteria: [
    {
      id: "pj-method",
      title: "Method",
      description: "Splits the data sensibly and explains each step.",
      points: 20,
      levels: [
        { id: "pj-method-4", label: "Excellent", points: 20 },
        { id: "pj-method-3", label: "Good", points: 15 },
        { id: "pj-method-2", label: "Developing", points: 10 },
        { id: "pj-method-1", label: "Beginning", points: 5 },
      ],
    },
    {
      id: "pj-results",
      title: "Results",
      description: "Reports the error honestly and compares it with a baseline.",
      points: 20,
      levels: [
        { id: "pj-results-4", label: "Excellent", points: 20 },
        { id: "pj-results-3", label: "Good", points: 15 },
        { id: "pj-results-2", label: "Developing", points: 10 },
        { id: "pj-results-1", label: "Beginning", points: 5 },
      ],
    },
    {
      id: "pj-communication",
      title: "Communication",
      description: "A reader who missed the lesson could follow it.",
      points: 10,
      levels: [
        { id: "pj-communication-3", label: "Clear", points: 10 },
        { id: "pj-communication-2", label: "Mostly clear", points: 6 },
        { id: "pj-communication-1", label: "Hard to follow", points: 3 },
      ],
    },
  ],
};

const OKAFOR = "u-faculty-okafor";

export const seedAssignments: Assignment[] = [
  {
    id: "asg-ml-reflection",
    courseId: "ml-foundations",
    title: "Reflection: where have you met machine learning?",
    instructions:
      "In about 150 words, describe one thing you used this week that learns from data. Say what examples it learned from, what it predicts, and one way it could go wrong.",
    points: 20,
    dueAt: "2026-10-09T16:00:00.000Z",
    sectionIds: ["ml-foundations-a", "ml-foundations-b"],
    attachments: [],
    accepts: ["text"],
    rubric: reflectionRubric,
    late: FLAG,
    allowResubmission: false,
    status: "published",
    createdById: OKAFOR,
    createdAt: "2026-09-28T09:00:00.000Z",
    publishedAt: "2026-09-28T09:30:00.000Z",
  },
  {
    id: "asg-ml-house-prices",
    courseId: "ml-foundations",
    title: "Mini project: predict house prices",
    instructions:
      "Using the worksheet from Unit 2, fit a straight-line model to the house price data. Hand in your working and a short write-up: how you split the data, the error on the test set, and how it compares with always guessing the average price.",
    points: 50,
    dueAt: "2026-10-28T16:00:00.000Z",
    sectionIds: ["ml-foundations-a", "ml-foundations-b"],
    attachments: [],
    accepts: ["text", "file"],
    rubric: projectRubric,
    late: { rule: "penalty", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 },
    allowResubmission: true,
    status: "published",
    createdById: OKAFOR,
    createdAt: "2026-10-12T09:00:00.000Z",
    publishedAt: "2026-10-12T09:15:00.000Z",
  },
  {
    id: "asg-ml-metric-case",
    courseId: "ml-foundations",
    title: "Case study: choosing a metric",
    instructions: "",
    points: 10,
    dueAt: "2026-11-10T16:00:00.000Z",
    sectionIds: ["ml-foundations-a"],
    attachments: [],
    accepts: ["text"],
    late: FLAG,
    allowResubmission: false,
    status: "draft",
    createdById: OKAFOR,
    createdAt: "2026-10-13T14:00:00.000Z",
  },
  {
    id: "asg-web-profile-page",
    courseId: "web-dev",
    title: "Build a profile page",
    instructions:
      "Build a one-page profile using only semantic HTML and the CSS from Unit 2. Hand in your HTML as text, or attach a PDF print-out of the page and its source.",
    points: 30,
    dueAt: "2026-10-22T16:00:00.000Z",
    sectionIds: ["web-dev-a", "web-dev-b"],
    attachments: [],
    accepts: ["text", "file"],
    late: { rule: "block", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 },
    allowResubmission: false,
    status: "published",
    createdById: "u-faculty-reyes",
    createdAt: "2026-10-08T10:00:00.000Z",
    publishedAt: "2026-10-08T10:10:00.000Z",
  },
];

const REFLECTIONS = [
  "My phone's keyboard suggests the next word as I type. It learned from the messages people write, including mine, and it predicts which word is most likely to come next.\n\nIt goes wrong when I write in two languages in one sentence: it keeps correcting words that were already right, because most of what it learned from was in one language at a time.",
  "The music app I use builds a playlist for me every Monday. It learned from what I played and skipped, and from people who listen to similar songs. It predicts which new songs I will keep.\n\nOne way it fails is that it only ever gives me more of the same. I listened to one sad album in September and it decided that is all I like.",
  "Our email filter decides which messages are spam. It learned from messages that people marked as spam or not spam.\n\nIt predicts a label for every new message. It can go wrong by hiding a real message, like the one from the school office about the trip, because it had the word 'free' in it.",
  "A map app told us the bus would take 22 minutes. It learned from how long that journey took at the same time on other days.\n\nThe prediction was wrong on the day of the parade, because nothing in its examples looked like that day.",
  "Machine learning is a field of study in artificial intelligence concerned with the development of statistical algorithms that can learn from data and generalise to unseen data.\n\nI use a translation app, which is an example of this. It could go wrong with slang.",
];

function reflection(
  index: number,
  studentId: string,
  submittedAt: string,
  extra: Partial<Submission> = {},
): Submission {
  const id = `sub-ml-reflection-${studentId}`;
  return {
    id,
    assignmentId: "asg-ml-reflection",
    courseId: "ml-foundations",
    studentId,
    attempt: 1,
    submittedAt,
    receipt: receiptCode(id, submittedAt),
    text: REFLECTIONS[index],
    files: [],
    comments: [],
    ...extra,
  };
}

const similarity = (percent: number, source: string, checkedAt: string) => ({
  provider: "Mock similarity checker",
  checkedAt,
  percent,
  matches: [{ source, percent }],
});

export const seedSubmissions: Submission[] = [
  // The demo student: on time, marked and released, with one inline comment.
  reflection(0, "u-student-mike", "2026-10-08T15:20:00.000Z", {
    similarity: similarity(4, "Blog post: A beginner's guide", "2026-10-08T15:20:05.000Z"),
    comments: [
      {
        id: "cmt-seed-1",
        anchor: {
          kind: "text",
          start: REFLECTIONS[0].indexOf("most of what it learned from"),
          end: REFLECTIONS[0].indexOf("most of what it learned from") + "most of what it learned from was in one language at a time".length,
          quote: "most of what it learned from was in one language at a time",
        },
        body: "Exactly: the examples did not look like your real use. That is the idea of representative data from lesson 1.",
        authorId: OKAFOR,
        createdAt: "2026-10-11T10:05:00.000Z",
      },
    ],
    grade: {
      rubricLevels: { "rf-understanding": "rf-understanding-4", "rf-clarity": "rf-clarity-3" },
      rawPoints: 18,
      points: 18,
      feedback: "A clear, concrete example, and you explained the failure in terms of the training data. Next time say what the model's output actually is: a ranked list of words.",
      gradedById: OKAFOR,
      gradedAt: "2026-10-11T10:10:00.000Z",
      releasedAt: "2026-10-12T08:00:00.000Z",
    },
  }),
  // On time, marked and released.
  reflection(1, "u-student-01", "2026-10-07T18:45:00.000Z", {
    similarity: similarity(7, "Open textbook: Introduction to Data Science", "2026-10-07T18:45:05.000Z"),
    grade: {
      rubricLevels: { "rf-understanding": "rf-understanding-3", "rf-clarity": "rf-clarity-4" },
      rawPoints: 17,
      points: 17,
      feedback: "Well written. Push the 'what does it predict' part further.",
      gradedById: OKAFOR,
      gradedAt: "2026-10-11T10:20:00.000Z",
      releasedAt: "2026-10-12T08:00:00.000Z",
    },
  }),
  // A day late, so flagged. Marked, waiting to be released.
  reflection(2, "u-student-02", "2026-10-10T09:10:00.000Z", {
    late: { daysLate: 1, penaltyPercent: 0 },
    similarity: similarity(9, "Encyclopaedia entry", "2026-10-10T09:10:05.000Z"),
    grade: {
      rubricLevels: { "rf-understanding": "rf-understanding-3", "rf-clarity": "rf-clarity-3" },
      rawPoints: 15,
      points: 15,
      feedback: "Good example of a false positive. Handed in a day late.",
      gradedById: OKAFOR,
      gradedAt: "2026-10-13T09:00:00.000Z",
    },
  }),
  // On time, not marked yet.
  reflection(3, "u-student-03", "2026-10-09T14:30:00.000Z", {
    similarity: similarity(3, "Blog post: A beginner's guide", "2026-10-09T14:30:05.000Z"),
  }),
  // On time, not marked, with a high similarity score for faculty to look at.
  reflection(4, "u-student-04", "2026-10-09T15:55:00.000Z", {
    similarity: similarity(64, "Wikipedia: Machine learning", "2026-10-09T15:55:05.000Z"),
  }),
];
