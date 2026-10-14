/**
 * Seed data for communication (Epic F): announcements, direct messages, forum
 * threads and live classes. The service layer loads these into its mock
 * repositories.
 */
import { SAMPLE_VIDEOS } from "@/lib/sample-media";
import type { Announcement, ForumPost, ForumThread, LiveSession, Message } from "@/lib/types";
import { DEMO_USER_IDS } from "./directory";

const OKAFOR = "u-faculty-okafor";
const REYES = "u-faculty-reyes";
const MIKE = DEMO_USER_IDS.student;

export const seedAnnouncements: Announcement[] = [
  {
    id: "ann-ml-midterm",
    courseId: "ml-foundations",
    sectionIds: [],
    title: "Midterm exam on 21 October",
    body: "The midterm is on Wednesday 21 October, 13:00 to 14:30, in Hall A. It covers Units 1 and 2. Bring a pen; no laptops. There is a revision session online the day before: see Live classes on the course page.",
    authorId: OKAFOR,
    postedAt: "2026-10-12T07:30:00.000Z",
    channels: ["in-app", "email", "push"],
    // Seven of the course's thirteen students have opened it. The demo student has not.
    readBy: {
      "u-student-01": "2026-10-12T08:02:00.000Z",
      "u-student-02": "2026-10-12T08:15:00.000Z",
      "u-student-03": "2026-10-12T09:40:00.000Z",
      "u-student-05": "2026-10-12T12:05:00.000Z",
      "u-student-06": "2026-10-12T16:20:00.000Z",
      "u-student-08": "2026-10-13T07:10:00.000Z",
      "u-student-11": "2026-10-13T10:45:00.000Z",
    },
  },
  {
    id: "ann-ml-section-a-room",
    courseId: "ml-foundations",
    sectionIds: ["ml-foundations-a"],
    title: "Section A: Monday's class moves to Room 204",
    body: "Room 101 is being used for an event on Monday. Section A meets in Room 204 for that one class. Section B is not affected.",
    authorId: OKAFOR,
    postedAt: "2026-10-09T14:00:00.000Z",
    channels: ["in-app", "email"],
    readBy: {
      [MIKE]: "2026-10-09T15:12:00.000Z",
      "u-student-01": "2026-10-09T14:30:00.000Z",
      "u-student-03": "2026-10-10T07:55:00.000Z",
      "u-student-05": "2026-10-10T08:20:00.000Z",
    },
  },
  {
    id: "ann-web-profile",
    courseId: "web-dev",
    sectionIds: [],
    title: "Profile page assignment: starter files",
    body: "The starter files for the profile page assignment are attached to the assignment itself. Download them before Thursday's class and check that the page opens in your browser.",
    authorId: REYES,
    postedAt: "2026-10-13T09:00:00.000Z",
    channels: ["in-app"],
    readBy: {},
  },
];

export const seedMessages: Message[] = [
  {
    id: "msg-seed-1",
    fromId: OKAFOR,
    toId: MIKE,
    body: "Hi Mike, I noticed you missed two classes recently. Is everything all right? Come and find me after class if you want to go over what we covered.",
    sentAt: "2026-10-08T10:15:00.000Z",
    readAt: "2026-10-08T12:00:00.000Z",
  },
  {
    id: "msg-seed-2",
    fromId: MIKE,
    toId: OKAFOR,
    body: "Thank you, I was unwell. I have watched the lessons I missed. Could I ask you about the validation set on Wednesday?",
    sentAt: "2026-10-08T12:04:00.000Z",
    readAt: "2026-10-08T13:30:00.000Z",
  },
  {
    id: "msg-seed-3",
    fromId: OKAFOR,
    toId: MIKE,
    body: "Of course. Bring your notes from the Unit 2 quiz and we will look at it together.",
    sentAt: "2026-10-13T16:40:00.000Z",
  },
  {
    id: "msg-seed-4",
    fromId: OKAFOR,
    toId: DEMO_USER_IDS.parent,
    body: "Dear Ms Manabat, Mike has caught up well after his absences. His attendance is still above the school's threshold, but only just, so please let me know if there is anything we should be aware of.",
    sentAt: "2026-10-13T16:55:00.000Z",
  },
];

export const seedForumThreads: ForumThread[] = [
  {
    id: "thread-ml-validation",
    courseId: "ml-foundations",
    title: "Why do we need a validation set as well as a test set?",
    authorId: MIKE,
    createdAt: "2026-10-10T17:20:00.000Z",
  },
  {
    id: "thread-ml-study-group",
    courseId: "ml-foundations",
    title: "Study group before the midterm",
    authorId: "u-student-03",
    createdAt: "2026-10-12T18:05:00.000Z",
  },
  {
    id: "thread-web-flexbox",
    courseId: "web-dev",
    title: "Flexbox or grid for the profile page?",
    authorId: "u-student-02",
    createdAt: "2026-10-11T11:00:00.000Z",
  },
];

function post(id: string, threadId: string, courseId: string, authorId: string, createdAt: string, body: string, extra: Partial<ForumPost> = {}): ForumPost {
  return { id, threadId, courseId, authorId, createdAt, body, reports: [], ...extra };
}

export const seedForumPosts: ForumPost[] = [
  post(
    "post-ml-1",
    "thread-ml-validation",
    "ml-foundations",
    MIKE,
    "2026-10-10T17:20:00.000Z",
    "In Unit 2 we split the data three ways. I understand keeping test data back, but if we already have a test set, what is the validation set for?",
  ),
  post(
    "post-ml-2",
    "thread-ml-validation",
    "ml-foundations",
    "u-student-01",
    "2026-10-10T18:02:00.000Z",
    "I think it is because you use the validation set many times while you tune the model. If you used the test set for that, you would end up fitting to it without meaning to.",
  ),
  post(
    "post-ml-3",
    "thread-ml-validation",
    "ml-foundations",
    OKAFOR,
    "2026-10-11T08:15:00.000Z",
    "Aiko has it. The test set is looked at once, at the end, so its score is an honest estimate. Everything you look at repeatedly while making choices is validation. We will do an example in class on Wednesday.",
  ),
  // Reported and waiting for a moderator.
  post(
    "post-ml-4",
    "thread-ml-validation",
    "ml-foundations",
    "u-student-07",
    "2026-10-13T20:30:00.000Z",
    "Honestly this is a stupid question, it was on the slides. Some people should pay attention.",
    { reports: [{ byId: "u-student-01", at: "2026-10-13T20:41:00.000Z", reason: "Unkind to the person who asked." }] },
  ),
  post(
    "post-ml-5",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-03",
    "2026-10-12T18:05:00.000Z",
    "A few of us are meeting in the library on Monday at 16:00 to go through Units 1 and 2. Anyone from either section is welcome.",
  ),
  // Hidden by a moderator.
  post(
    "post-ml-6",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-09",
    "2026-10-12T19:10:00.000Z",
    "I can sell you last year's exam paper, message me.",
    {
      reports: [{ byId: "u-student-03", at: "2026-10-12T19:20:00.000Z", reason: "Offering exam papers for sale." }],
      hidden: { byId: OKAFOR, at: "2026-10-13T07:45:00.000Z" },
    },
  ),
  post(
    "post-ml-7",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-05",
    "2026-10-13T08:00:00.000Z",
    "I will come. Could we start with the bias and variance lesson?",
  ),
  post(
    "post-web-1",
    "thread-web-flexbox",
    "web-dev",
    "u-student-02",
    "2026-10-11T11:00:00.000Z",
    "For the two-column layout on the profile page, is it better to use flexbox or grid? Both seem to work.",
  ),
  post(
    "post-web-2",
    "thread-web-flexbox",
    "web-dev",
    REYES,
    "2026-10-11T13:30:00.000Z",
    "Either is accepted. Grid is easier when you want the two columns to line up row by row; flexbox is easier when one side should simply take the space that is left.",
  ),
];

export const seedLiveSessions: LiveSession[] = [
  {
    id: "live-ml-unit1-review",
    courseId: "ml-foundations",
    sectionIds: [],
    title: "Unit 1 review",
    startsAt: "2026-10-06T08:00:00.000Z",
    durationMinutes: 45,
    createdById: OKAFOR,
    provider: "Mock video",
    meetingId: "mock-seed-1",
    joinUrl: "https://meet.example.com/j/mock-seed-1",
    status: "ended",
    endedAt: "2026-10-06T08:47:00.000Z",
    recording: { url: SAMPLE_VIDEOS.bunny, label: "Sample clip standing in for the recording" },
  },
  {
    id: "live-ml-midterm-revision",
    courseId: "ml-foundations",
    sectionIds: [],
    title: "Midterm revision",
    startsAt: "2026-10-20T08:00:00.000Z",
    durationMinutes: 60,
    createdById: OKAFOR,
    provider: "Mock video",
    meetingId: "mock-seed-2",
    joinUrl: "https://meet.example.com/j/mock-seed-2",
    status: "scheduled",
  },
];
