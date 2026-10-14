/**
 * Seed data: assignments and hand-ins for the program courses in
 * `courses-programs.ts`. Due times are 11:59 PM Philippine time (15:59 UTC).
 * `assignments.ts` adds these to the general assignments.
 */
import { receiptCode } from "@/lib/domain/assignments";
import type { Assignment, LatePolicy, Rubric, RubricCriterion, Submission } from "@/lib/types";

const FLAG: LatePolicy = { rule: "flag", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 };
const PENALTY: LatePolicy = { rule: "penalty", penaltyPercent: 10, penaltyPer: "day", maxPenaltyPercent: 50 };

const MAGTIBAY = "u-faculty-magtibay";
const SANTIAGO = "u-faculty-santiago";
const CASTILLO = "u-faculty-castillo";
const ABAD = "u-faculty-abad";
const MIGUEL = "u-student-manalo";

/** A four-level criterion worth `points`, with levels at 100%, 75%, 50% and 25%. */
function criterion(id: string, title: string, description: string, points: number): RubricCriterion {
  const labels = ["Excellent", "Good", "Developing", "Beginning"];
  return {
    id,
    title,
    description,
    points,
    levels: labels.map((label, index) => ({
      id: `${id}-${4 - index}`,
      label,
      points: Math.round((points * (4 - index)) / 4),
    })),
  };
}

const ethicsReflectionRubric: Rubric = {
  criteria: [
    criterion("er-analysis", "Moral analysis", "Names the human act, what affected freedom and knowledge, and what conscience said.", 12),
    criterion("er-clarity", "Clarity", "Honest, organised and easy to follow.", 8),
  ],
};

const ethicsCaseRubric: Rubric = {
  criteria: [
    criterion("ec-issue", "Identifying the issue", "States the moral problem and who is affected.", 10),
    criterion("ec-theories", "Applying theories", "Applies at least two theories correctly and fairly.", 20),
    criterion("ec-judgement", "Reasoned judgement", "Reaches a conclusion that follows from the analysis.", 10),
  ],
};

const salesianReflectionRubric: Rubric = {
  criteria: [
    criterion("sr-honesty", "Honesty and depth", "Describes a real person and what they did.", 10),
    criterion("sr-system", "Link to the Preventive System", "Connects the story to reason, religion or loving-kindness.", 10),
  ],
};

const tosRubric: Rubric = {
  criteria: [
    criterion("tos-alignment", "Alignment to targets", "Every learning target appears in the table at the right thinking level.", 15),
    criterion("tos-distribution", "Distribution of items", "Items are proportional to teaching hours and add up correctly.", 15),
    criterion("tos-format", "Format and clarity", "Neat, labelled, with sample items for two cells.", 10),
  ],
};

const jobSheetRubric: Rubric = {
  criteria: [
    criterion("js-safety", "Safety and PPE", "Wears the right PPE and supports the vehicle correctly.", 15),
    criterion("js-procedure", "Procedure", "Follows the steps in the manual in the right order.", 20),
    criterion("js-record", "Measurements and record", "Records the oil grade, quantity and torque value.", 10),
    criterion("js-housekeeping", "Housekeeping (5S)", "Leaves the bay clean and the tools in place.", 5),
  ],
};

export const programAssignments: Assignment[] = [
  // Ethics
  {
    id: "asg-eth-reflection",
    courseId: "ethics",
    title: "Reflection paper: a decision I had to make",
    instructions:
      "In about 300 words, describe a real decision you faced in the last year, where you had to choose between two goods, or between what was easy and what was right. Name the human act, say what affected your knowledge and your freedom, and say what your conscience told you. You may write in English or in Taglish.",
    points: 20,
    dueAt: "2026-10-12T15:59:00.000Z",
    sectionIds: ["ethics-a", "ethics-b"],
    attachments: [],
    accepts: ["text"],
    rubric: ethicsReflectionRubric,
    late: FLAG,
    allowResubmission: false,
    status: "published",
    createdById: MAGTIBAY,
    createdAt: "2026-09-28T02:00:00.000Z",
    publishedAt: "2026-09-28T02:10:00.000Z",
  },
  {
    id: "asg-eth-case",
    courseId: "ethics",
    title: "Case analysis: academic honesty in a group project",
    instructions:
      "Three members of a group project finish their parts. The fourth, who is carrying a heavy workload because his father is ill, hands in nothing, and the leader proposes to put his name on the paper anyway. Analyse the case in 600 to 800 words. Identify the moral issue and the people affected, apply two theories from Unit 2 (for example utilitarianism and Kant), and give your reasoned judgement. Hand in the paper as text or attach it as a document.",
    points: 40,
    dueAt: "2026-11-06T15:59:00.000Z",
    sectionIds: ["ethics-a", "ethics-b"],
    attachments: [],
    accepts: ["text", "file"],
    rubric: ethicsCaseRubric,
    late: PENALTY,
    allowResubmission: true,
    status: "published",
    createdById: MAGTIBAY,
    createdAt: "2026-10-12T02:00:00.000Z",
    publishedAt: "2026-10-12T02:30:00.000Z",
  },

  // Don Bosco and the Preventive System
  {
    id: "asg-sal-reflection",
    courseId: "salesian-formation",
    title: "Reflection: a person who believed in me",
    instructions:
      "Write about 250 words on a person, perhaps a teacher, a coach, a relative or a youth leader, who believed in you when it was not easy to. Say what they did, how you knew they cared, and which part of the Preventive System (reason, religion or loving-kindness) you see in it.",
    points: 20,
    dueAt: "2026-10-12T15:59:00.000Z",
    sectionIds: ["salesian-formation-a", "salesian-formation-b"],
    attachments: [],
    accepts: ["text"],
    rubric: salesianReflectionRubric,
    late: FLAG,
    allowResubmission: false,
    status: "published",
    createdById: SANTIAGO,
    createdAt: "2026-09-30T03:00:00.000Z",
    publishedAt: "2026-09-30T03:05:00.000Z",
  },
  {
    id: "asg-sal-campus-walk",
    courseId: "salesian-formation",
    title: "Campus observation: the four marks of a Salesian house",
    instructions:
      "Spend one recess or lunch break observing the campus. For each of the four marks (home, school, parish, playground), describe one thing you saw that shows it, and one thing that could be better. Write 400 to 500 words. You may attach photos of places, but do not photograph people without their permission.",
    points: 30,
    dueAt: "2026-11-09T15:59:00.000Z",
    sectionIds: ["salesian-formation-a", "salesian-formation-b"],
    attachments: [],
    accepts: ["text", "file"],
    late: FLAG,
    allowResubmission: true,
    status: "published",
    createdById: SANTIAGO,
    createdAt: "2026-10-12T03:00:00.000Z",
    publishedAt: "2026-10-12T03:05:00.000Z",
  },

  // Assessment in Learning 1
  {
    id: "asg-al-critique",
    courseId: "assessment-learning",
    title: "Item critique: improve five flawed test items",
    instructions:
      "You are given ten multiple-choice items from a Grade 8 Mathematics test (see the handout). Choose five that are flawed. For each, name the flaw (for example a clue in the stem, “all of the above,” or an implausible distractor) and rewrite the item so the flaw is gone.",
    points: 25,
    dueAt: "2026-10-16T15:59:00.000Z",
    sectionIds: ["assessment-learning-a", "assessment-learning-b"],
    attachments: [],
    accepts: ["text"],
    late: FLAG,
    allowResubmission: false,
    status: "published",
    createdById: CASTILLO,
    createdAt: "2026-10-05T01:00:00.000Z",
    publishedAt: "2026-10-05T01:10:00.000Z",
  },
  {
    id: "asg-al-tos",
    courseId: "assessment-learning",
    title: "Table of specification for a unit test",
    instructions:
      "Choose a unit from the K to 12 curriculum guide for the subject and grade you will teach. List five learning targets, assign teaching hours, and build a table of specification for a 40-item test, with the number of items per topic and per thinking level of the revised Bloom's taxonomy. Add one sample item for two different cells. Hand in as text, or attach the table as a document.",
    points: 40,
    dueAt: "2026-10-23T15:59:00.000Z",
    sectionIds: ["assessment-learning-a", "assessment-learning-b"],
    attachments: [],
    accepts: ["text", "file"],
    rubric: tosRubric,
    late: PENALTY,
    allowResubmission: true,
    status: "published",
    createdById: CASTILLO,
    createdAt: "2026-10-09T01:00:00.000Z",
    publishedAt: "2026-10-09T01:10:00.000Z",
  },

  // Engine Fundamentals and Servicing
  {
    id: "asg-auto-jobsheet",
    courseId: "automotive-engines",
    title: "Job sheet: engine oil and filter change",
    instructions:
      "After the shop activity, complete the job sheet for changing the engine oil and filter on the training vehicle. Record the PPE you wore, how the vehicle was supported, the oil grade and quantity, the drain plug torque from the manual, and any problem you found. Describe your steps in order.",
    points: 50,
    dueAt: "2026-10-17T15:59:00.000Z",
    sectionIds: ["automotive-engines-a", "automotive-engines-b"],
    attachments: [],
    accepts: ["text", "file"],
    rubric: jobSheetRubric,
    late: PENALTY,
    allowResubmission: false,
    status: "published",
    createdById: ABAD,
    createdAt: "2026-10-06T00:00:00.000Z",
    publishedAt: "2026-10-06T00:05:00.000Z",
  },
  {
    id: "asg-auto-diagnosis",
    courseId: "automotive-engines",
    title: "Written report: diagnosing an overheating engine",
    instructions: "",
    points: 30,
    dueAt: "2026-11-05T15:59:00.000Z",
    sectionIds: ["automotive-engines-a"],
    attachments: [],
    accepts: ["text"],
    late: FLAG,
    allowResubmission: false,
    status: "draft",
    createdById: ABAD,
    createdAt: "2026-10-13T06:00:00.000Z",
  },
];

function submission(
  assignmentId: string,
  courseId: string,
  studentId: string,
  submittedAt: string,
  text: string,
  extra: Partial<Submission> = {},
): Submission {
  const id = `sub-${assignmentId.replace(/^asg-/, "")}-${studentId}`;
  return {
    id,
    assignmentId,
    courseId,
    studentId,
    attempt: 1,
    submittedAt,
    receipt: receiptCode(id, submittedAt),
    text,
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

const ETHICS_MIGUEL =
  "Last June I had to decide whether to tell my section's adviser that two classmates were using a leaked copy of the quiz. They are my friends, and I owed one of them, because he lent me his notes when I was sick. Staying silent felt like utang na loob.\n\nI knew what was happening and I was free to speak, so it was a real human act, not something that happened to me. My fear of being called a snitch lessened my freedom a little, but not enough to excuse me. My conscience said that the other students who studied honestly were being cheated.\n\nI talked to my friends first and gave them a day to tell the adviser themselves. They did. I think it was the right choice, though I lost some trust with one of them.";

const ETHICS_ANGELICA =
  "In my second year I was offered a part-time job at a call center during my exam week. The pay would have helped my family, but it meant missing two review sessions. I chose to take the job for one week only.\n\nI was fully aware of what I was choosing. Pressure from my family's situation reduced my freedom but did not remove it. My conscience was uneasy because I was not sure that studying less was fair to my future students.\n\nLooking back, I would plan earlier, because most of the pressure came from not asking for help in time.";

const ETHICS_JOHN_PAUL =
  "I lent my motorcycle to my cousin without asking my father, who owns it. My cousin had an emergency, so I thought it was okay. I did not think about what could go wrong, and nothing did. Maybe I should have asked first. I am not sure if this is a real moral decision.";

const ETHICS_BEA =
  "When I was elected treasurer of our class, the adviser asked us to collect fifty pesos from each student for the Christmas party. A classmate could not pay and asked me not to record that she had not. If I did, the totals would be wrong, and I would be lying in the report.\n\nI knew what I was doing and had freedom to choose. My hiya made it hard to say no to her face. My conscience said that I could help her without falsifying records, so I recorded it as unpaid and paid her fifty pesos myself, and asked her to repay me when she could.";

const SALESIAN_MIGUEL =
  "The person who believed in me was my Grade 9 Values teacher, Ma'am Cruz. I was failing three subjects because I stopped doing my homework after my father lost his job. She did not scold me in front of the class. She asked me to stay after class, listened, and asked if I had anything for lunch.\n\nShe gave me a list of only two things to catch up on first. Each week she asked how it was going, and by the second quarter I had passed everything. I knew she cared because she remembered my name and my father's situation without being reminded.\n\nI see loving-kindness in this, because she made sure I felt loved, and reason, because she explained why catching up mattered and trusted me to decide how.";

const SALESIAN_ANGELICA =
  "My youth leader in our parish, Kuya Ben, believed in me when I was too shy to read at Mass. He did not force me. He asked me to read just one line during the first week, and then two. After a few months I was reading the first reading by myself.\n\nHe was always at the parish hall on Saturday afternoons, even when only two or three of us came. I think that is what Don Bosco meant by assistance: being present. I also see religion in it, because his patience came from his faith.";

const SALESIAN_KRISTINE =
  "My mother believed in me. She worked in Cabuyao so I could study here. She always said that I could finish. I think this shows love and religion because she prays the rosary every night for us.";

const SALESIAN_MARY_GRACE =
  "Coach Rey believed in me when I was dropped from the volleyball team in second year. Instead of just telling me I was not good enough, he showed me three things to improve and told me he would test me again in a month. I trained with the juniors in the mornings. In the next tryouts I made the team as a back-up setter.\n\nThe Preventive System says that the educator should be among the young. Coach Rey stayed after practice to practise with me. This is reason as well, because he gave me reasons and a plan, not just orders.";

const AL_CRITIQUE_ANGELICA =
  "Item 2: “Which of the following is NOT a factor of 12? a. 3  b. 5  c. 4  d. All of the above.” Flaw: “all of the above” makes no sense with a NOT stem, and it is confusing. Rewritten: remove option d and add 7 as another distractor.\n\nItem 4: the correct answer is the longest option. Rewritten: shorten it so all options have a similar length.\n\nItem 5: the stem says “a” before the options, so only options beginning with a consonant fit grammatically. Rewritten: use “a/an” or reword the stem.\n\nItem 7: one distractor, “banana,” is not plausible. Rewritten: replace it with a value a student would get by forgetting to carry over.\n\nItem 9: two options are correct. Rewritten: change one so only one answer is correct.";

const AL_CRITIQUE_KRISTINE =
  "Item 1 has a clue in the stem. Item 3 is too long. Item 6 has all of the above. Item 8 has an answer that is obviously wrong. Item 10 is unclear. I fixed them by rewriting each one to be simpler.";

const AUTO_JOBSHEET_FULL =
  "PPE: safety glasses, nitrile gloves, coveralls and safety shoes. Vehicle: raised with a floor jack at the front jacking point, then placed on two jack stands before I went underneath. Wheels chocked.\n\nSteps: 1) Warmed the engine for two minutes, then switched it off. 2) Placed the drain pan under the plug. 3) Loosened the drain plug and let the oil drain for ten minutes. 4) Replaced the crush washer and tightened the plug to 25 N·m with the torque wrench. 5) Removed the old filter, oiled the new gasket and tightened it by hand three-quarters of a turn after contact. 6) Added 3.5 L of 5W-30 oil. 7) Started the engine for one minute, checked for leaks, and rechecked the level on the dipstick.\n\nProblem found: the old crush washer was flattened and was replaced. Cleaned the bay and returned the tools to the board.";

const AUTO_JOBSHEET_BRIEF =
  "PPE: safety glasses and gloves. I raised the car with the jack and put the stand. Oil drained. Put new filter and oil, 3 liters. Torque 25. No problems found.";

export const programSubmissions: Submission[] = [
  // Ethics reflection. The demo student's is marked and released.
  submission("asg-eth-reflection", "ethics", MIGUEL, "2026-10-11T13:20:00.000Z", ETHICS_MIGUEL, {
    similarity: similarity(3, "Student paper: Don Bosco College – Canlubang, 2nd Semester 2025", "2026-10-11T13:20:05.000Z"),
    comments: [
      {
        id: "cmt-seed-eth-1",
        anchor: {
          kind: "text",
          start: ETHICS_MIGUEL.indexOf("Staying silent felt like utang na loob."),
          end: ETHICS_MIGUEL.indexOf("Staying silent felt like utang na loob.") + "Staying silent felt like utang na loob.".length,
          quote: "Staying silent felt like utang na loob.",
        },
        body: "This is the sharpest sentence in the paper. A debt of gratitude is real, but ask whether it can oblige you to hide a wrong that harms other people.",
        authorId: MAGTIBAY,
        createdAt: "2026-10-14T02:10:00.000Z",
      },
    ],
    grade: {
      rubricLevels: { "er-analysis": "er-analysis-3", "er-clarity": "er-clarity-4" },
      rawPoints: 17,
      points: 17,
      feedback: "Honest and well organised. You named the human act and the factors that affected your freedom. Go one step further next time and say which theory supports your final choice.",
      gradedById: MAGTIBAY,
      gradedAt: "2026-10-14T02:15:00.000Z",
      releasedAt: "2026-10-14T03:00:00.000Z",
    },
  }),
  // On time, marked, waiting to be released.
  submission("asg-eth-reflection", "ethics", "u-student-01", "2026-10-10T11:05:00.000Z", ETHICS_ANGELICA, {
    similarity: similarity(5, "Blog post: Making hard choices as a student", "2026-10-10T11:05:05.000Z"),
    grade: {
      rubricLevels: { "er-analysis": "er-analysis-3", "er-clarity": "er-clarity-3" },
      rawPoints: 15,
      points: 15,
      feedback: "A clear example. Say more about whether your family's situation limited your freedom, and by how much.",
      gradedById: MAGTIBAY,
      gradedAt: "2026-10-14T02:30:00.000Z",
    },
  }),
  // A few hours late, so flagged and not yet marked.
  submission("asg-eth-reflection", "ethics", "u-student-02", "2026-10-12T17:30:00.000Z", ETHICS_JOHN_PAUL, {
    late: { daysLate: 1, penaltyPercent: 0 },
    similarity: similarity(2, "Blog post: Making hard choices as a student", "2026-10-12T17:30:05.000Z"),
  }),
  // On time, not marked, with a higher similarity score for the teacher to look at.
  submission("asg-eth-reflection", "ethics", "u-student-05", "2026-10-12T09:40:00.000Z", ETHICS_BEA, {
    similarity: similarity(38, "Essay site: Integrity and honesty, sample essay", "2026-10-12T09:40:05.000Z"),
  }),

  // Salesian reflection.
  submission("asg-sal-reflection", "salesian-formation", MIGUEL, "2026-10-10T12:10:00.000Z", SALESIAN_MIGUEL, {
    similarity: similarity(2, "Blog post: A teacher who changed my life", "2026-10-10T12:10:05.000Z"),
    grade: {
      rubricLevels: { "sr-honesty": "sr-honesty-4", "sr-system": "sr-system-3" },
      rawPoints: 18,
      points: 18,
      feedback: "A moving and specific account. You identified loving-kindness well. Your link to reason can be stronger: what exactly did she explain?",
      gradedById: SANTIAGO,
      gradedAt: "2026-10-13T08:00:00.000Z",
      releasedAt: "2026-10-13T08:30:00.000Z",
    },
  }),
  submission("asg-sal-reflection", "salesian-formation", "u-student-01", "2026-10-11T07:30:00.000Z", SALESIAN_ANGELICA, {
    similarity: similarity(4, "Blog post: A teacher who changed my life", "2026-10-11T07:30:05.000Z"),
  }),
  submission("asg-sal-reflection", "salesian-formation", "u-student-03", "2026-10-12T10:05:00.000Z", SALESIAN_KRISTINE, {
    similarity: similarity(1, "Blog post: A teacher who changed my life", "2026-10-12T10:05:05.000Z"),
  }),
  submission("asg-sal-reflection", "salesian-formation", "u-student-07", "2026-10-12T14:50:00.000Z", SALESIAN_MARY_GRACE, {
    similarity: similarity(6, "Blog post: A teacher who changed my life", "2026-10-12T14:50:05.000Z"),
  }),

  // Assessment in Learning 1: item critique, no rubric.
  submission("asg-al-critique", "assessment-learning", "u-student-01", "2026-10-12T04:20:00.000Z", AL_CRITIQUE_ANGELICA, {
    grade: {
      rawPoints: 22,
      points: 22,
      feedback: "Thorough and well reasoned. Item 5: the “a/an” clue is correct. For item 9, say which of the two options you removed and why.",
      gradedById: CASTILLO,
      gradedAt: "2026-10-13T07:00:00.000Z",
    },
  }),
  submission("asg-al-critique", "assessment-learning", "u-student-03", "2026-10-13T12:00:00.000Z", AL_CRITIQUE_KRISTINE),

  // Engine Fundamentals: job sheets.
  submission("asg-auto-jobsheet", "automotive-engines", "u-student-07", "2026-10-13T06:30:00.000Z", AUTO_JOBSHEET_FULL, {
    grade: {
      rubricLevels: {
        "js-safety": "js-safety-4",
        "js-procedure": "js-procedure-4",
        "js-record": "js-record-3",
        "js-housekeeping": "js-housekeeping-4",
      },
      rawPoints: 48,
      points: 48,
      feedback: "A complete job sheet in the correct order. Record the oil quantity you actually added, not just the spec. Good use of the crush washer.",
      gradedById: ABAD,
      gradedAt: "2026-10-14T01:30:00.000Z",
      releasedAt: "2026-10-14T02:00:00.000Z",
    },
  }),
  submission("asg-auto-jobsheet", "automotive-engines", "u-student-08", "2026-10-13T09:15:00.000Z", AUTO_JOBSHEET_BRIEF),
];
