"use client";

import { useRef, useState } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Copy,
  Download,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AiBadge, Badge, Button, Card, PageContainer, PageHeader } from "@/components/ui";
import { deleteLessonPlan, saveLessonPlan, useMyLessonPlans } from "@/lib/api/lesson-plans";
import { now } from "@/lib/clock";
import {
  GENERATION_STEPS,
  generateLessonPlan,
  lessonPlanToMarkdown,
} from "@/lib/mock-ai/lesson-plan";
import type { LessonPlan, LessonPlanInput } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const TOPIC_IDEAS = ["Photosynthesis", "Introduction to Python", "The French Revolution", "Fractions and decimals"];
const STYLES: LessonPlanInput["style"][] = ["Blended", "Project-based", "Lecture + practice"];

const DEFAULT_INPUT: LessonPlanInput = {
  topic: "",
  audience: "Grade 9 students",
  weeks: 6,
  sessionsPerWeek: 2,
  sessionMinutes: 45,
  goals: "",
  style: "Blended",
  includeVideo: true,
  includeQuizzes: true,
  includeGroupWork: true,
};

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-primary";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function LessonPlanGenerator() {
  const savedPlans = useMyLessonPlans();
  const [input, setInput] = useState<LessonPlanInput>(DEFAULT_INPUT);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // Bumped to abandon a generation that is still "running".
  const activeRun = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const update = <Key extends keyof LessonPlanInput>(key: Key, value: LessonPlanInput[Key]) =>
    setInput((previous) => ({ ...previous, [key]: value }));

  const generating = step !== null;
  const saved = plan !== null && savedPlans.some((item) => item.id === plan.id);

  const generate = async () => {
    if (!input.topic.trim()) return;
    const run = ++activeRun.current;
    setPlan(null);
    for (let index = 0; index < GENERATION_STEPS.length; index += 1) {
      setStep(index);
      await wait(650);
      if (activeRun.current !== run) return;
    }
    const createdAt = now();
    setPlan(generateLessonPlan(input, `plan-${createdAt.getTime()}`, createdAt.toISOString()));
    setStep(null);
    resultRef.current?.focus();
  };

  const openSaved = (savedPlan: LessonPlan) => {
    activeRun.current += 1;
    setStep(null);
    setInput(savedPlan.input);
    setPlan(savedPlan);
  };

  const copyMarkdown = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(lessonPlanToMarkdown(plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied: the download button still works.
    }
  };

  const downloadMarkdown = () => {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([lessonPlanToMarkdown(plan)], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.input.topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "lesson"}-plan.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<AiBadge>AI-assisted</AiBadge>}
        title="Lesson planner"
        description="Describe the course and get a week-by-week plan with session timings, materials, assessments and a teaching workflow."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <div>
                <label htmlFor="plan-topic" className="mb-1.5 block text-sm font-medium">
                  Course or topic
                </label>
                <input
                  id="plan-topic"
                  required
                  value={input.topic}
                  onChange={(event) => update("topic", event.target.value)}
                  placeholder="e.g. Photosynthesis"
                  className={FIELD_CLASS}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TOPIC_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => update("topic", idea)}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="plan-audience" className="mb-1.5 block text-sm font-medium">
                  Learners
                </label>
                <input
                  id="plan-audience"
                  required
                  value={input.audience}
                  onChange={(event) => update("audience", event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <NumberSelect id="plan-weeks" label="Weeks" value={input.weeks} options={[1, 2, 3, 4, 5, 6, 8, 10, 12]} onChange={(value) => update("weeks", value)} />
                <NumberSelect id="plan-sessions" label="Per week" value={input.sessionsPerWeek} options={[1, 2, 3, 4, 5]} onChange={(value) => update("sessionsPerWeek", value)} />
                <NumberSelect id="plan-minutes" label="Minutes" value={input.sessionMinutes} options={[30, 45, 60, 90]} onChange={(value) => update("sessionMinutes", value)} />
              </div>

              <div>
                <label htmlFor="plan-goals" className="mb-1.5 block text-sm font-medium">
                  Learning goals <span className="font-normal text-ink-3">(optional)</span>
                </label>
                <textarea
                  id="plan-goals"
                  rows={3}
                  value={input.goals}
                  onChange={(event) => update("goals", event.target.value)}
                  placeholder="One per line. What should learners be able to do by the end?"
                  className={cn(FIELD_CLASS, "h-auto resize-y py-2")}
                />
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Teaching style</legend>
                <div className="flex flex-col gap-1.5">
                  {STYLES.map((style) => (
                    <label key={style} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-soft">
                      <input
                        type="radio"
                        name="plan-style"
                        checked={input.style === style}
                        onChange={() => update("style", style)}
                        className="size-4 accent-primary"
                      />
                      {style}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Include</legend>
                <div className="flex flex-col gap-2 text-sm">
                  <Toggle label="Captioned video lessons" checked={input.includeVideo} onChange={(value) => update("includeVideo", value)} />
                  <Toggle label="Auto-graded quizzes" checked={input.includeQuizzes} onChange={(value) => update("includeQuizzes", value)} />
                  <Toggle label="Group work" checked={input.includeGroupWork} onChange={(value) => update("includeGroupWork", value)} />
                </div>
              </fieldset>

              <Button type="submit" size="lg" disabled={generating} className="mt-1">
                {generating ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden className="size-4" />
                )}
                {generating ? "Generating…" : plan ? "Generate again" : "Generate lesson plan"}
              </Button>
            </form>
          </Card>

          {savedPlans.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Saved plans</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {savedPlans.map((savedPlan) => (
                  <li key={savedPlan.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openSaved(savedPlan)}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2",
                        plan?.id === savedPlan.id && "bg-primary-soft",
                      )}
                    >
                      <span className="block truncate font-medium">{savedPlan.input.topic}</span>
                      <span className="block text-xs text-ink-3">
                        {savedPlan.input.weeks} weeks · saved {formatDate(savedPlan.createdAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteLessonPlan(savedPlan.id)}
                      aria-label={`Delete plan for ${savedPlan.input.topic}`}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div ref={resultRef} tabIndex={-1} className="min-w-0 outline-none" aria-live="polite">
          {step !== null ? (
            <Card className="p-6">
              <h2 className="font-semibold">Drafting your plan</h2>
              <ol className="mt-4 flex flex-col gap-3 text-sm">
                {GENERATION_STEPS.map((label, index) => (
                  <li key={label} className={cn("flex items-center gap-3", index > step && "text-ink-3")}>
                    {index < step ? (
                      <Check aria-hidden className="size-4 text-good" />
                    ) : index === step ? (
                      <LoaderCircle aria-hidden className="size-4 animate-spin text-spark" />
                    ) : (
                      <span aria-hidden className="mx-1 size-2 rounded-full bg-line-strong" />
                    )}
                    {label}
                  </li>
                ))}
              </ol>
            </Card>
          ) : plan ? (
            <PlanView
              plan={plan}
              actions={
                <>
                  <Button variant={saved ? "secondary" : "primary"} size="sm" onClick={() => (saved ? void deleteLessonPlan(plan.id) : void saveLessonPlan(plan))} aria-pressed={saved}>
                    {saved ? <BookmarkCheck aria-hidden className="size-4" /> : <BookmarkPlus aria-hidden className="size-4" />}
                    {saved ? "Saved" : "Save plan"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={copyMarkdown}>
                    {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                    {copied ? "Copied" : "Copy Markdown"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadMarkdown}>
                    <Download aria-hidden className="size-4" />
                    Download
                  </Button>
                </>
              }
            />
          ) : (
            <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-spark-soft text-spark">
                <Sparkles aria-hidden className="size-6" />
              </span>
              <h2 className="font-semibold">Your lesson plan will appear here</h2>
              <p className="max-w-sm text-sm text-ink-2">
                Enter a topic and choose how the course runs. You&apos;ll get objectives, a weekly
                workflow and timed sessions you can save or export.
              </p>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function NumberSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))} className={cn(FIELD_CLASS, "px-2")}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

function PlanView({ plan, actions }: { plan: LessonPlan; actions: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AiBadge>AI draft — review before teaching</AiBadge>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-balance">
          {plan.title}
        </h2>
        <p className="mt-2 max-w-[65ch] text-ink-2 text-pretty">{plan.overview}</p>

        <h3 className="mt-6 text-sm font-semibold">Learning objectives</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {plan.objectives.map((objective) => (
            <li key={objective} className="flex gap-2.5">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-ink" />
              {objective}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="font-semibold">Weekly workflow</h3>
        <p className="text-sm text-ink-3">The rhythm each week follows.</p>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plan.workflow.map((stage, index) => (
            <li key={stage.stage} className="border-t-2 border-primary pt-3">
              <div className="text-xs font-medium text-ink-3">Step {index + 1}</div>
              <div className="font-medium">{stage.stage}</div>
              <p className="mt-1 text-sm text-ink-2">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-col gap-3">
        {plan.weeks.map((week) => (
          <Card key={week.week} className="overflow-hidden">
            <details open={week.week === 1} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-semibold text-primary-ink tabular-nums">
                  {week.week}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{week.theme}</span>
                  <span className="block text-xs text-ink-3">
                    Week {week.week} · {week.phase} · {week.sessions.length}{" "}
                    {week.sessions.length === 1 ? "session" : "sessions"}
                  </span>
                </span>
                <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">›</span>
              </summary>

              <div className="grid gap-6 border-t border-line px-5 py-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-5">
                  {week.sessions.map((session, sessionIndex) => (
                    <div key={sessionIndex}>
                      <h4 className="text-sm font-semibold">
                        Session {sessionIndex + 1}: {session.title}
                      </h4>
                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {session.segments.map((segment) => (
                            <tr key={segment.label} className="border-t border-line align-top">
                              <td className="w-16 py-2 pr-3 whitespace-nowrap text-ink-3 tabular-nums">
                                {segment.minutes} min
                              </td>
                              <td className="py-2">
                                <span className="font-medium">{segment.label}</span>
                                <span className="block text-ink-2">{segment.activity}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold">Outcomes</h4>
                    <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-ink-2">
                      {week.outcomes.map((outcome) => (
                        <li key={outcome}>{outcome}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold">Materials</h4>
                    <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-ink-2">
                      {week.materials.map((material) => (
                        <li key={material}>{material}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold">Assessment</h4>
                    <p className="mt-1.5 text-ink-2">{week.assessment}</p>
                  </div>
                </div>
              </div>
            </details>
          </Card>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <h3 className="font-semibold">Grading</h3>
        <ul className="mt-3 flex flex-col text-sm">
          {plan.grading.map((row) => (
            <li key={row.item} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
              <span>{row.item}</span>
              <Badge className="tabular-nums">{row.weight}%</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
