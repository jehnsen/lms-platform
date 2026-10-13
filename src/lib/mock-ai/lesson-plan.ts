/**
 * Mock lesson-plan generator. It builds a plan from templates so the UI can be
 * exercised end to end without a model. To go live, keep `generateLessonPlan`'s
 * signature and return type and replace the body with a call to your backend.
 */
import type {
  LessonPlan,
  LessonPlanInput,
  PlanSegment,
  PlanSession,
  PlanWeek,
} from "@/lib/types";

interface Phase {
  name: string;
  themes: Array<(topic: string) => string>;
  outcomes: Array<(topic: string) => string>;
  sessions: Array<(topic: string) => string>;
  practice: (topic: string) => string;
  assessment: (topic: string) => string;
}

const PHASES: Phase[] = [
  {
    name: "Foundations",
    themes: [
      (t) => `Why ${t} matters and the vocabulary you need`,
      (t) => `The big ideas behind ${t}`,
      (t) => `Building blocks of ${t}`,
    ],
    outcomes: [
      (t) => `Define the essential terms used in ${t}`,
      (t) => `Describe where ${t} shows up in everyday life`,
      () => "Identify what they already know and where the gaps are",
    ],
    sessions: [
      (t) => `Hook: a real problem that ${t} solves`,
      () => "Key terms and a shared concept map",
      () => "Diagnostic check and goal setting",
      (t) => `First hands-on taste of ${t}`,
    ],
    practice: (t) => `Sort and match key ${t} terms, then build a concept map`,
    assessment: () => "Ungraded diagnostic quiz to set a baseline",
  },
  {
    name: "Core concepts",
    themes: [
      (t) => `How ${t} works, step by step`,
      (t) => `The central models and rules of ${t}`,
      (t) => `Connecting the ideas within ${t}`,
    ],
    outcomes: [
      (t) => `Explain the core mechanism of ${t} in their own words`,
      () => "Work through a standard example without support",
      () => "Spot and correct a common misconception",
    ],
    sessions: [
      () => "Worked example, narrated",
      () => "Common misconceptions and how to test them",
      () => "Compare and contrast two approaches",
      () => "Concept check and reteach",
    ],
    practice: (t) => `Annotate a worked ${t} example, then complete a faded version`,
    assessment: () => "Auto-graded quiz on core concepts (counts towards the grade)",
  },
  {
    name: "Guided practice",
    themes: [
      (t) => `Practising ${t} with support`,
      (t) => `From examples to independent ${t} problems`,
      (t) => `Building fluency in ${t}`,
    ],
    outcomes: [
      () => "Solve varied problems with decreasing scaffolding",
      () => "Explain their reasoning to a peer",
      () => "Use feedback to revise an answer",
    ],
    sessions: [
      () => "I do, we do, you do",
      () => "Problem set clinic",
      () => "Peer explanation rounds",
      () => "Error analysis workshop",
    ],
    practice: (t) => `Tiered ${t} problem set with hints that unlock on request`,
    assessment: () => "Short auto-graded quiz plus one written explanation",
  },
  {
    name: "Application",
    themes: [
      (t) => `Using ${t} on unfamiliar problems`,
      (t) => `${t} in the real world`,
      (t) => `Designing with ${t}`,
    ],
    outcomes: [
      (t) => `Apply ${t} to a situation not seen in class`,
      () => "Justify the choice of method",
      () => "Plan and scope a piece of independent work",
    ],
    sessions: [
      () => "Case study walkthrough",
      () => "Project kick-off and planning",
      () => "Studio time with check-ins",
      () => "Mid-project critique",
    ],
    practice: (t) => `Tackle an open-ended ${t} case and document the decisions made`,
    assessment: () => "Project milestone reviewed against the rubric",
  },
  {
    name: "Synthesis and showcase",
    themes: [
      (t) => `Bringing ${t} together`,
      (t) => `Showcase and reflection on ${t}`,
      (t) => `What comes after ${t}`,
    ],
    outcomes: [
      (t) => `Present a finished piece of work that demonstrates ${t}`,
      () => "Give and receive structured feedback",
      () => "Reflect on progress against their starting goals",
    ],
    sessions: [
      () => "Review game and open questions",
      () => "Final presentations",
      () => "Reflection and next steps",
      () => "Cumulative assessment",
    ],
    practice: () => "Rehearse, present and respond to questions",
    assessment: () => "Final project and cumulative quiz",
  },
];

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function roundToFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function buildSegments(input: LessonPlanInput, phase: Phase): PlanSegment[] {
  const { sessionMinutes: total, topic } = input;
  const main =
    input.style === "Project-based"
      ? { label: "Project studio", activity: phase.practice(topic) }
      : input.includeGroupWork
        ? { label: "Group activity", activity: `In groups of three: ${lowerFirst(phase.practice(topic))}` }
        : { label: "Independent practice", activity: phase.practice(topic) };

  const parts: Array<{ share: number; label: string; activity: string }> = [
    {
      share: 0.1,
      label: "Warm-up",
      activity: "Two retrieval questions from the previous session",
    },
    input.includeVideo
      ? {
          share: input.style === "Lecture + practice" ? 0.3 : 0.2,
          label: "Video mini-lesson",
          activity: "Short captioned video; learners note one question each",
        }
      : {
          share: input.style === "Lecture + practice" ? 0.3 : 0.2,
          label: "Direct instruction",
          activity: "Teacher-led explanation with a worked example",
        },
    input.includeQuizzes
      ? {
          share: 0.1,
          label: "Checkpoint quiz",
          activity: "Three auto-graded questions; reteach anything under 70%",
        }
      : {
          share: 0.1,
          label: "Check for understanding",
          activity: "Cold-call questions and mini whiteboards",
        },
    { share: 0, label: main.label, activity: main.activity },
    {
      share: 0.1,
      label: "Exit ticket",
      activity: "One thing learned, one question remaining",
    },
  ];

  // The main activity takes whatever time is left after the fixed parts.
  const fixed = parts.map((part) => (part.share ? roundToFive(total * part.share) : 0));
  const mainMinutes = Math.max(5, total - fixed.reduce((sum, minutes) => sum + minutes, 0));
  return parts.map((part, index) => ({
    label: part.label,
    minutes: part.share ? fixed[index] : mainMinutes,
    activity: part.activity,
  }));
}

function buildMaterials(input: LessonPlanInput, phase: Phase): string[] {
  const materials = ["Slide deck with key terms", `Practice sheet: ${phase.name.toLowerCase()}`];
  if (input.includeVideo) materials.unshift("Captioned video (6–10 min) with in-video checkpoints");
  if (input.includeQuizzes) materials.push("Auto-graded quiz in the LMS");
  if (input.includeGroupWork) materials.push("Group role cards");
  if (input.style === "Project-based") materials.push("Project brief and rubric");
  return materials;
}

function parseGoals(goals: string) {
  return goals
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((goal) => goal.trim().replace(/[.;]+$/, ""))
    .filter((goal) => goal.length > 3)
    .slice(0, 3);
}

export function generateLessonPlan(input: LessonPlanInput, id: string, createdAt: string): LessonPlan {
  const topic = input.topic.trim();
  const phaseUse = new Map<number, number>();

  const weeks: PlanWeek[] = Array.from({ length: input.weeks }, (_, index) => {
    const position = input.weeks === 1 ? 0 : index / (input.weeks - 1);
    const phaseIndex = Math.round(position * (PHASES.length - 1));
    const phase = PHASES[phaseIndex];
    const seen = phaseUse.get(phaseIndex) ?? 0;
    phaseUse.set(phaseIndex, seen + 1);

    const sessions: PlanSession[] = Array.from({ length: input.sessionsPerWeek }, (_, session) => ({
      title: phase.sessions[(session + seen) % phase.sessions.length](topic),
      segments: buildSegments(input, phase),
    }));

    return {
      week: index + 1,
      phase: phase.name,
      theme: phase.themes[seen % phase.themes.length](topic),
      outcomes: phase.outcomes.map((outcome) => outcome(topic)),
      sessions,
      materials: buildMaterials(input, phase),
      assessment: input.includeQuizzes
        ? phase.assessment(topic)
        : "Teacher observation and exit tickets",
    };
  });

  const objectives = [
    ...parseGoals(input.goals),
    `Explain the key ideas of ${topic} in their own words`,
    `Apply ${topic} to problems they have not seen before`,
    input.includeGroupWork
      ? "Collaborate effectively and give useful feedback to peers"
      : "Work independently and check their own answers",
    `Produce a final piece of work that demonstrates understanding of ${topic}`,
  ].slice(0, 5);

  const grading = input.includeQuizzes
    ? [
        { item: "Weekly auto-graded quizzes", weight: 30 },
        { item: input.includeVideo ? "In-video checkpoints" : "Exit tickets", weight: 10 },
        { item: input.style === "Project-based" ? "Project milestones" : "Practice sets", weight: 20 },
        { item: "Final project and cumulative quiz", weight: 40 },
      ]
    : [
        { item: "Participation and exit tickets", weight: 20 },
        { item: input.style === "Project-based" ? "Project milestones" : "Practice sets", weight: 30 },
        { item: "Final project", weight: 50 },
      ];

  const workflow = [
    {
      stage: "Before class",
      detail: input.includeVideo
        ? "Learners watch the captioned video and answer its checkpoints. Results flag who needs support."
        : "Learners complete a short pre-reading and note one question.",
    },
    {
      stage: "In class",
      detail: `${input.sessionMinutes}-minute session: warm-up, a short input, then most of the time on ${
        input.style === "Project-based" ? "project work" : input.includeGroupWork ? "group practice" : "practice"
      }.`,
    },
    {
      stage: "After class",
      detail: input.includeQuizzes
        ? "An auto-graded quiz closes the loop. Learners can ask the AI tutor about anything they missed and retake."
        : "Learners review their exit ticket question with the AI tutor.",
    },
    {
      stage: "Weekly review",
      detail:
        "Check the gradebook for learners below the pass mark and topics with low scores, and reteach those first next week.",
    },
  ];

  return {
    id,
    createdAt,
    input,
    title: `${topic}: ${input.weeks}-week plan for ${input.audience}`,
    overview: `A ${input.weeks}-week ${input.style.toLowerCase()} course on ${topic} for ${input.audience}, with ${
      input.sessionsPerWeek
    } ${input.sessionsPerWeek === 1 ? "session" : "sessions"} of ${input.sessionMinutes} minutes each week. It moves from shared foundations to independent application, checking understanding in every session.`,
    objectives,
    workflow,
    weeks,
    grading,
  };
}

export function lessonPlanToMarkdown(plan: LessonPlan) {
  const lines: string[] = [`# ${plan.title}`, "", plan.overview, "", "## Learning objectives"];
  plan.objectives.forEach((objective) => lines.push(`- ${objective}`));
  lines.push("", "## Weekly workflow");
  plan.workflow.forEach((step) => lines.push(`- **${step.stage}:** ${step.detail}`));
  for (const week of plan.weeks) {
    lines.push("", `## Week ${week.week} — ${week.theme}`, `_Phase: ${week.phase}_`, "", "**Outcomes**");
    week.outcomes.forEach((outcome) => lines.push(`- ${outcome}`));
    week.sessions.forEach((session, index) => {
      lines.push("", `**Session ${index + 1}: ${session.title}**`);
      session.segments.forEach((segment) =>
        lines.push(`- ${segment.label} (${segment.minutes} min): ${segment.activity}`),
      );
    });
    lines.push("", `**Materials:** ${week.materials.join("; ")}`, `**Assessment:** ${week.assessment}`);
  }
  lines.push("", "## Grading");
  plan.grading.forEach((row) => lines.push(`- ${row.item}: ${row.weight}%`));
  return lines.join("\n");
}

/** The stages shown while a plan is being "generated". */
export const GENERATION_STEPS = [
  "Reading your goals",
  "Sequencing topics across the weeks",
  "Drafting session activities",
  "Adding assessments and grading",
];
