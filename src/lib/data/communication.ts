/**
 * Seed data for communication (Epic F): announcements, direct messages, forum
 * threads and live classes. The service layer loads these into its mock
 * repositories.
 */
import { SAMPLE_VIDEOS } from "@/lib/sample-media";
import type { Announcement, ForumPost, ForumThread, LiveSession, Message } from "@/lib/types";
import { DEMO_USER_IDS } from "./directory";

const ALCANTARA = "u-faculty-alcantara";
const VILLANUEVA = "u-faculty-villanueva";
const MIGUEL = DEMO_USER_IDS.student;
const MAGTIBAY = "u-faculty-magtibay";
const SANTIAGO = "u-faculty-santiago";
const CASTILLO = "u-faculty-castillo";
const ABAD = "u-faculty-abad";

export const seedAnnouncements: Announcement[] = [
  {
    id: "ann-ml-midterm",
    courseId: "ml-foundations",
    sectionIds: [],
    title: "Midterm exam on 21 October",
    body: "Good day, class. The midterm is on Wednesday 21 October, 7:30 to 9:30 AM, in the AVR. It covers Units 1 and 2. Bring a black or blue pen and your school ID; no laptops or phones. There is a revision session online the day before: see Live classes on the course page.",
    authorId: ALCANTARA,
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
    body: "Computer Lab 3 is reserved for the IT Department's hardware servicing on Monday. Section A meets in Room 204 for that one class: it is a lecture, so no laptops needed. Section B is not affected.",
    authorId: ALCANTARA,
    postedAt: "2026-10-09T14:00:00.000Z",
    channels: ["in-app", "email"],
    readBy: {
      [MIGUEL]: "2026-10-09T15:12:00.000Z",
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
    body: "The starter files for the profile page assignment are attached to the assignment itself. Download them before Thursday's class and check that the page opens in your browser. If you have no laptop at home, Computer Lab 1 is open to Web Systems students from 1:00 to 5:00 PM.",
    authorId: VILLANUEVA,
    postedAt: "2026-10-13T09:00:00.000Z",
    channels: ["in-app"],
    readBy: {},
  },
  {
    id: "ann-eth-case",
    courseId: "ethics",
    sectionIds: [],
    title: "Case analysis released, due 6 November",
    body: "The case analysis on academic honesty in a group project is now under Assignments. It is 600 to 800 words and must apply two theories from Unit 2. You may hand it in again before the deadline if you want to improve it. Marks for the reflection papers will be released this week.",
    authorId: MAGTIBAY,
    postedAt: "2026-10-12T02:30:00.000Z",
    channels: ["in-app", "email"],
    readBy: {
      [MIGUEL]: "2026-10-12T05:10:00.000Z",
      "u-student-01": "2026-10-12T03:00:00.000Z",
      "u-student-03": "2026-10-12T06:45:00.000Z",
      "u-student-05": "2026-10-12T09:20:00.000Z",
      "u-student-08": "2026-10-13T01:30:00.000Z",
    },
  },
  {
    id: "ann-sal-recollection",
    courseId: "salesian-formation",
    sectionIds: [],
    title: "Annual Salesian Youth recollection on 30 October",
    body: "There are no classes on Friday 30 October because of the annual recollection for all college students. Assembly is at 7:30 AM at the Salesian Hall. Wear the complete school uniform and bring your own water. Please confirm with your class representative if you cannot attend for a serious reason.",
    authorId: SANTIAGO,
    postedAt: "2026-10-13T00:30:00.000Z",
    channels: ["in-app", "email", "push"],
    readBy: {
      [MIGUEL]: "2026-10-13T02:00:00.000Z",
      "u-student-02": "2026-10-13T03:15:00.000Z",
      "u-student-04": "2026-10-13T08:40:00.000Z",
      "u-student-06": "2026-10-13T11:00:00.000Z",
    },
  },
  {
    id: "ann-al-critique",
    courseId: "assessment-learning",
    sectionIds: [],
    title: "Item critique: submit by Friday",
    body: "A reminder that the item critique is due this Friday, 16 October. Please use the handout that was given in class. Remember to say what is wrong with each item before you rewrite it, since a good rewrite without the reason earns only half the marks.",
    authorId: CASTILLO,
    postedAt: "2026-10-13T05:00:00.000Z",
    channels: ["in-app", "email"],
    readBy: {
      "u-student-01": "2026-10-13T06:00:00.000Z",
      "u-student-02": "2026-10-13T07:30:00.000Z",
      "u-student-03": "2026-10-13T08:10:00.000Z",
    },
  },
  {
    id: "ann-auto-ppe",
    courseId: "automotive-engines",
    sectionIds: [],
    title: "Shop activity: PPE is required",
    body: "For the practical exam on 23 October and every shop activity before it, bring your own coveralls, safety shoes and safety glasses. Students without complete PPE will not be allowed in the bay. Long hair must be tied back and no jewelry may be worn.",
    authorId: ABAD,
    postedAt: "2026-10-12T00:15:00.000Z",
    channels: ["in-app", "push"],
    readBy: {
      "u-student-07": "2026-10-12T01:00:00.000Z",
      "u-student-08": "2026-10-12T02:20:00.000Z",
      "u-student-10": "2026-10-12T06:40:00.000Z",
    },
  },
];

export const seedMessages: Message[] = [
  {
    id: "msg-seed-1",
    fromId: ALCANTARA,
    toId: MIGUEL,
    body: "Hi Miguel, I noticed you missed two classes recently. Is everything all right? Come and find me after class if you want to go over what we covered.",
    sentAt: "2026-10-08T10:15:00.000Z",
    readAt: "2026-10-08T12:00:00.000Z",
  },
  {
    id: "msg-seed-2",
    fromId: MIGUEL,
    toId: ALCANTARA,
    body: "Thank you po, Ma'am. I was unwell. I have watched the lessons I missed. Could I ask you about the validation set on Wednesday?",
    sentAt: "2026-10-08T12:04:00.000Z",
    readAt: "2026-10-08T13:30:00.000Z",
  },
  {
    id: "msg-seed-3",
    fromId: ALCANTARA,
    toId: MIGUEL,
    body: "Of course. Bring your notes from the Unit 2 quiz and we will look at it together.",
    sentAt: "2026-10-13T16:40:00.000Z",
  },
  {
    id: "msg-seed-4",
    fromId: ALCANTARA,
    toId: DEMO_USER_IDS.parent,
    body: "Good day, Mrs. Manalo. Miguel has caught up well after his absences. His attendance is still above the college's threshold, but only just, so please let me know if there is anything we should be aware of.",
    sentAt: "2026-10-13T16:55:00.000Z",
  },
];

export const seedForumThreads: ForumThread[] = [
  {
    id: "thread-ml-validation",
    courseId: "ml-foundations",
    title: "Why do we need a validation set as well as a test set?",
    authorId: MIGUEL,
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
  {
    id: "thread-eth-utang",
    courseId: "ethics",
    title: "Can utang na loob justify staying silent about a wrong?",
    authorId: MIGUEL,
    createdAt: "2026-10-13T11:30:00.000Z",
  },
  {
    id: "thread-auto-torque",
    courseId: "automotive-engines",
    title: "Drain plug torque on the training vehicle",
    authorId: "u-student-10",
    createdAt: "2026-10-12T13:00:00.000Z",
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
    MIGUEL,
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
    ALCANTARA,
    "2026-10-11T08:15:00.000Z",
    "Angelica has it. The test set is looked at once, at the end, so its score is an honest estimate. Everything you look at repeatedly while making choices is validation. We will do an example in class on Wednesday.",
  ),
  // Reported and waiting for a moderator.
  post(
    "post-ml-4",
    "thread-ml-validation",
    "ml-foundations",
    "u-student-07",
    "2026-10-13T20:30:00.000Z",
    "Honestly this is a stupid question, it was on the slides. Some people should pay attention in class.",
    { reports: [{ byId: "u-student-01", at: "2026-10-13T20:41:00.000Z", reason: "Unkind to the person who asked." }] },
  ),
  post(
    "post-ml-5",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-03",
    "2026-10-12T18:05:00.000Z",
    "A few of us are meeting in the Learning Resource Center on Monday at 4:00 PM to go through Units 1 and 2. Anyone from either section is welcome.",
  ),
  // Hidden by a moderator.
  post(
    "post-ml-6",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-09",
    "2026-10-12T19:10:00.000Z",
    "I can sell you last year's midterm paper, message me.",
    {
      reports: [{ byId: "u-student-03", at: "2026-10-12T19:20:00.000Z", reason: "Offering exam papers for sale." }],
      hidden: { byId: ALCANTARA, at: "2026-10-13T07:45:00.000Z" },
    },
  ),
  post(
    "post-ml-7",
    "thread-ml-study-group",
    "ml-foundations",
    "u-student-05",
    "2026-10-13T08:00:00.000Z",
    "I will come po. Could we start with the overfitting lesson?",
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
    VILLANUEVA,
    "2026-10-11T13:30:00.000Z",
    "Either is accepted. Grid is easier when you want the two columns to line up row by row; flexbox is easier when one side should simply take the space that is left.",
  ),
  post(
    "post-eth-1",
    "thread-eth-utang",
    "ethics",
    MIGUEL,
    "2026-10-13T11:30:00.000Z",
    "For the reflection paper I wrote about keeping quiet because of utang na loob. Sir said in class that gratitude is a real obligation, but is it ever a good enough reason to stay silent when other people are being harmed?",
  ),
  post(
    "post-eth-2",
    "thread-eth-utang",
    "ethics",
    "u-student-03",
    "2026-10-13T12:10:00.000Z",
    "I think Kant would say no, because you cannot make 'hide the wrongdoing of whoever helped me' a universal law. Everyone would lose trust in everyone.",
  ),
  post(
    "post-eth-3",
    "thread-eth-utang",
    "ethics",
    MAGTIBAY,
    "2026-10-14T01:45:00.000Z",
    "Good discussion. Notice that both of you moved from a feeling to a principle. Gratitude can oblige you to help your benefactor in many ways, but it does not oblige you to join in or hide an injustice. Try testing it against utilitarianism too, and bring your result to Wednesday's class.",
  ),
  post(
    "post-auto-1",
    "thread-auto-torque",
    "automotive-engines",
    "u-student-10",
    "2026-10-12T13:00:00.000Z",
    "Sir, for the job sheet, is the drain plug torque in the manual for our training vehicle 25 N·m or 30 N·m? I found two numbers in different pages.",
  ),
  post(
    "post-auto-2",
    "thread-auto-torque",
    "automotive-engines",
    ABAD,
    "2026-10-12T14:20:00.000Z",
    "Use the figure in the engine section for our vehicle's model year. The other page is for the larger-displacement version. Always check the model and year in the header before using a number.",
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
    createdById: ALCANTARA,
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
    createdById: ALCANTARA,
    provider: "Mock video",
    meetingId: "mock-seed-2",
    joinUrl: "https://meet.example.com/j/mock-seed-2",
    status: "scheduled",
  },
];
