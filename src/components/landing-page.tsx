import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarCheck,
  Captions,
  CircleCheck,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  GraduationCap,
  KeyRound,
  ListChecks,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Play,
  Presentation,
  Smartphone,
  Sparkles,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Backdrop } from "@/components/backdrop";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { SIGN_IN_PATH } from "@/lib/domain/routes";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "for-everyone", label: "Who it's for" },
  { id: "how-it-works", label: "How it works" },
];

const PROMISES = [
  { icon: KeyRound, label: "Sign in with your school account" },
  { icon: Captions, label: "Captions on every lesson" },
  { icon: Smartphone, label: "Works on any phone" },
];

const ROLES: Array<{ icon: LucideIcon; who: string; title: string; points: string[] }> = [
  {
    icon: GraduationCap,
    who: "Students",
    title: "Pick up where you left off",
    points: [
      "Short captioned lessons with checkpoint questions",
      "Quiz results straight away, with explanations",
      "Grades and feedback as soon as they are released",
    ],
  },
  {
    icon: Presentation,
    who: "Teachers",
    title: "Teach, mark and follow up",
    points: [
      "Build units and choose when each lesson is released",
      "Rubrics, inline comments and a weighted gradebook",
      "An AI lesson planner to draft from",
    ],
  },
  {
    icon: Building2,
    who: "School office",
    title: "See the whole school",
    points: [
      "Bring in users from the SIS or a CSV file",
      "School-wide dashboards and at-risk students",
      "An audit log of who changed what",
    ],
  },
  {
    icon: UsersRound,
    who: "Parents",
    title: "Stay in the loop",
    points: [
      "Your child's grades, progress and attendance",
      "Course announcements and the school calendar",
      "Read-only, and linked by the school",
    ],
  },
];

const STEPS = [
  { title: "Watch a short lesson", detail: "Bite-sized captioned videos and readings, with a transcript you can click to jump around." },
  { title: "Check yourself as you go", detail: "Checkpoint questions pause the video, so ideas stick before you move on." },
  { title: "Get help and see your grade", detail: "Ask the AI tutor when you're stuck, and see quiz scores the moment you hand in." },
];

/** Minutes studied each day in the dashboard preview, Monday to Sunday. */
const PREVIEW_WEEK = [35, 20, 10, 45, 30, 15, 0];

/** `/` for signed-out visitors: what 3rdLoopLearning is, and the way in. */
export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />
          <nav aria-label="On this page" className="hidden items-center gap-1 md:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ButtonLink href={SIGN_IN_PATH} variant="ghost" className="max-sm:hidden">
              Sign in
            </ButtonLink>
            {/* On a phone there is room for one short button beside the brand. */}
            <ButtonLink href={SIGN_IN_PATH} className="sm:hidden">
              Sign in
            </ButtonLink>
            <ButtonLink href={SIGN_IN_PATH} className="max-sm:hidden">
              Try the demo
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <Features />
        <Roles />
        <HowItWorks />
        <ClosingCall />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <Brand />
            <p className="mt-3 text-sm text-ink-3">Don Bosco College – Canlubang, Calamba, Laguna</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="hover:text-ink">
                {section.label}
              </a>
            ))}
            <Link href={SIGN_IN_PATH} className="font-medium text-primary-ink hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <Backdrop />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-8 lg:pt-24 lg:pb-28">
        <div className="max-w-2xl">
          <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3.5 pl-1 text-sm text-ink-2 shadow-card backdrop-blur">
            <span className="inline-flex items-center gap-1 rounded-full bg-spark-soft px-2 py-0.5 text-xs font-semibold text-spark">
              <Sparkles aria-hidden className="size-3" />
              AI tutor
            </span>
            A study partner beside every lesson
          </p>
          <h1
            id="hero-title"
            className="animate-rise mt-6 text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-6xl xl:text-[4.25rem]"
            style={{ animationDelay: "80ms" }}
          >
            Learning that{" "}
            <span className="bg-linear-to-r from-hero-from to-hero-to bg-clip-text whitespace-nowrap text-transparent">keeps up</span>{" "}
            with you.
          </h1>
          <p
            className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-ink-2 text-pretty"
            style={{ animationDelay: "160ms" }}
          >
            Courses, video lessons, quizzes, grades and class communication in one calm place, for students,
            teachers, parents and the school office.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <ButtonLink href={SIGN_IN_PATH} size="lg" className="h-12 px-6">
              Try the demo
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="#features" variant="secondary" size="lg" className="h-12 px-6">
              See what&apos;s inside
            </ButtonLink>
          </div>
          <ul className="animate-rise mt-10 flex flex-wrap gap-x-6 gap-y-3" style={{ animationDelay: "320ms" }}>
            {PROMISES.map((promise) => (
              <li key={promise.label} className="flex items-center gap-2 text-sm text-ink-2">
                <promise.icon aria-hidden className="size-4 text-primary-ink" />
                {promise.label}
              </li>
            ))}
          </ul>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A drawn-to-scale preview of the student dashboard, with the tutor and a quiz result floating around it. */
function HeroPreview() {
  const peak = Math.max(...PREVIEW_WEEK);
  return (
    <div
      role="img"
      aria-label="Preview of the student dashboard: a lesson in progress, study time this week, upcoming work, an AI tutor reply and a graded quiz."
      className="animate-rise relative mx-auto w-full max-w-xl lg:max-w-none"
      style={{ animationDelay: "300ms" }}
    >
      {/* A soft halo so the window lifts off the page. */}
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-hero-from/25 via-transparent to-hero-to/25 blur-2xl" />

      <div className="rounded-[1.75rem] border border-line bg-surface/70 p-2 shadow-raised backdrop-blur-xl">
        <div className="overflow-hidden rounded-[1.25rem] border border-line bg-bg">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-1 text-center text-[11px] text-ink-3">
              3rdLoopLearning · Dashboard
            </span>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] sm:p-4">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              <div className="relative aspect-video bg-neutral-900">
                <Image
                  src="/thumbnails/ml-gradient-descent.jpg"
                  alt=""
                  fill
                  loading="eager"
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 22rem, (min-width: 640px) 20rem, 90vw"
                  className="object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-linear-to-t from-black/50 to-black/5">
                  <span className="grid size-11 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-lg ring-6 ring-white/20">
                    <Play className="size-4.5 translate-x-px fill-current" />
                  </span>
                </span>
                <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  14 min
                </span>
              </div>
              <div className="p-3.5">
                <div className="text-[11px] font-semibold text-primary-ink">Continue learning</div>
                <div className="mt-1 text-sm leading-snug font-semibold">How models learn: loss and gradient descent</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-3">
                  <span>3 of 7 lessons</span>
                  <span className="font-semibold text-ink">43%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                  <div className="h-full w-[43%] rounded-full bg-primary" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
                <div className="text-[11px] text-ink-3">Study time this week</div>
                <div className="mt-0.5 text-xl font-semibold tracking-tight">2h 35m</div>
                <div className="mt-3 flex h-14 items-end gap-1.5 border-b border-chart-axis">
                  {PREVIEW_WEEK.map((minutes, day) => (
                    <span
                      key={day}
                      className="flex-1 rounded-t-[3px] bg-chart"
                      style={{ height: `${(minutes / peak) * 100}%`, minHeight: minutes > 0 ? 2 : 0 }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card">
                <div>
                  <div className="text-[11px] text-ink-3">Average grade</div>
                  <div className="mt-0.5 text-xl font-semibold tracking-tight">88%</div>
                </div>
                <ProgressRing percent={88} />
              </div>
            </div>
          </div>

          <ul className="mx-3 mb-3 hidden divide-y divide-line rounded-xl border border-line bg-surface shadow-card sm:mx-4 sm:mb-4 sm:block">
            <PreviewRow month="Oct" day="22" title="Build a profile page" detail="Assignment · 30 points" icon={ClipboardCheck} />
            <PreviewRow month="Oct" day="24" title="Unit 1 quiz: Inside the cell" detail="Quiz · 5 questions" icon={ListChecks} />
          </ul>
        </div>
      </div>

      <div className="animate-drift absolute -top-14 -right-2 hidden w-64 rounded-2xl border border-line bg-surface/90 p-4 shadow-raised backdrop-blur-xl sm:block xl:-right-10">
        <div className="flex items-center gap-2 text-xs font-semibold text-spark">
          <span className="grid size-6 place-items-center rounded-full bg-spark-soft">
            <Sparkles className="size-3.5" />
          </span>
          AI tutor
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink">
          Think of gradient descent as walking downhill in fog: feel the slope, take a small step, repeat.
        </p>
      </div>

      <div
        className="animate-drift absolute -bottom-7 -left-2 hidden items-center gap-3 rounded-2xl border border-line bg-surface/90 py-3 pr-5 pl-3 shadow-raised backdrop-blur-xl sm:flex xl:-left-10"
        style={{ animationDelay: "-3.5s" }}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-good-soft text-good">
          <CircleCheck className="size-5" />
        </span>
        <div>
          <div className="text-[11px] text-ink-3">Quiz graded instantly</div>
          <div className="text-sm font-semibold">9/10 · Passed</div>
        </div>
      </div>

      <div
        className="animate-drift absolute right-8 -bottom-5 hidden items-center gap-2 rounded-full border border-spark-solid/30 bg-spark-soft py-1.5 pr-3.5 pl-1.5 text-xs font-semibold text-spark shadow-raised lg:flex"
        style={{ animationDelay: "-1.5s" }}
      >
        <span className="grid size-6 place-items-center rounded-full bg-surface">
          <Flame className="size-3.5" />
        </span>
        6-day streak
      </div>
    </div>
  );
}

function PreviewRow({
  month,
  day,
  title,
  detail,
  icon: Icon,
}: {
  month: string;
  day: string;
  title: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-center leading-none">
        <span>
          <span className="block text-[9px] font-semibold text-ink-3 uppercase">{month}</span>
          <span className="block text-sm font-semibold">{day}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="flex items-center gap-1 text-[11px] text-ink-3">
          <Icon className="size-3" />
          {detail}
        </span>
      </span>
      <ArrowRight className="size-3.5 text-ink-3" />
    </li>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 36 36" className="size-11 -rotate-90">
      <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--primary-soft)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
      />
    </svg>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold tracking-wide text-primary-ink">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-4xl">{title}</h2>
      {children ? <p className="mt-4 text-lg leading-relaxed text-ink-2 text-pretty">{children}</p> : null}
    </div>
  );
}

function BentoCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-raised sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BentoTitle({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div>
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-ink">
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2 text-pretty">{children}</p>
    </div>
  );
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="features-title" eyebrow="Features" title="Everything a term needs, in one place">
          From the first lesson to the report card, without juggling five different tools.
        </SectionHeading>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          <BentoCard className="lg:col-span-4">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <BentoTitle icon={Video} title="Video lessons that check understanding">
                Short captioned videos with a clickable transcript. Checkpoint questions pause the video at the
                right moment, so ideas stick before you move on.
              </BentoTitle>
              <div aria-hidden className="relative overflow-hidden rounded-2xl border border-line bg-neutral-900">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/thumbnails/bio-organelles.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 22rem, (min-width: 768px) 40vw, 90vw"
                    className="object-cover opacity-70"
                  />
                </div>
                <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/60 p-3.5 text-white backdrop-blur-md">
                  <div className="text-[11px] font-medium text-white/70">Checkpoint · 4:12</div>
                  <div className="mt-1 text-sm font-semibold">Which organelle makes most of the cell&apos;s energy?</div>
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs">
                    <span className="rounded-lg bg-white/10 px-2.5 py-1.5">Nucleus</span>
                    <span className="flex items-center gap-1 rounded-lg bg-emerald-400/25 px-2.5 py-1.5 ring-1 ring-emerald-300/60">
                      <CircleCheck className="size-3.5 text-emerald-300" />
                      Mitochondria
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="border-spark-solid/30 bg-linear-to-br from-spark-soft to-surface lg:col-span-2">
            <div>
              <span className="grid size-10 place-items-center rounded-xl bg-surface text-spark shadow-card">
                <Sparkles aria-hidden className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">An AI tutor beside every lesson</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2 text-pretty">
                Ask for it simpler, ask for an example, or say “quiz me”. Help without leaving the lesson.
              </p>
            </div>
            <div aria-hidden className="mt-6 flex flex-col gap-2 text-[13px]">
              <span className="self-end rounded-2xl rounded-br-md bg-primary-soft px-3 py-2">Give me a real-world example of osmosis</span>
              <span className="flex gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-spark shadow-card">
                  <Sparkles className="size-3" />
                </span>
                <span className="rounded-2xl rounded-tl-md border border-line bg-surface px-3 py-2 text-ink-2">
                  A wilting lettuce leaf crisps up in water: water moves into its cells…
                </span>
              </span>
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-2">
            <BentoTitle icon={ListChecks} title="Quizzes marked the moment you hand in">
              Objective questions are graded instantly, with the correct answer and an explanation. Teachers mark
              the rest.
            </BentoTitle>
            <div aria-hidden className="mt-6 flex items-center gap-4 rounded-2xl bg-surface-2/70 p-4">
              <span className="text-3xl font-semibold tracking-tight">90%</span>
              <span className="flex flex-col gap-1 text-xs">
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 font-medium text-good">
                  <CircleCheck className="size-3" />
                  Passed
                </span>
                <span className="text-ink-3">9 of 10 points · best score counts</span>
              </span>
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-2">
            <BentoTitle icon={FileText} title="Gradebook and report cards">
              Weighted categories and grading scales, released when the teacher is ready, and progress reports
              ready for the SIS.
            </BentoTitle>
            <div aria-hidden className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
              {[
                { icon: FileText, label: "PDF" },
                { icon: FileSpreadsheet, label: "Excel" },
                { icon: Download, label: "CSV" },
              ].map((format) => (
                <span key={format.label} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 shadow-card">
                  <format.icon className="size-3.5 text-ink-3" />
                  {format.label}
                </span>
              ))}
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-2">
            <BentoTitle icon={CalendarCheck} title="Attendance with early warnings">
              Mark attendance per class or session. Students who drop below the school&apos;s threshold are
              flagged automatically.
            </BentoTitle>
            <div aria-hidden className="mt-6 flex items-center gap-3 rounded-2xl bg-surface-2/70 p-4 text-xs">
              <span className="grid size-8 place-items-center rounded-lg bg-warn-soft text-warn">
                <BellRing className="size-4" />
              </span>
              <span className="text-ink-2">
                <span className="font-semibold text-ink">Low attendance alert</span>
                <br />
                Sent to the student, their parents and the coordinator
              </span>
            </div>
          </BentoCard>

          <BentoCard className="lg:col-span-6">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <BentoTitle icon={MessagesSquare} title="A class that keeps talking">
                Announcements, private messages, course discussions and live classes with recordings, with
                notifications by email, push and in the app.
              </BentoTitle>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Megaphone, label: "Announcements" },
                  { icon: MessageSquare, label: "Messages" },
                  { icon: MessagesSquare, label: "Discussions" },
                  { icon: Video, label: "Live classes" },
                ].map((channel) => (
                  <li
                    key={channel.label}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2/50 px-3 py-5 text-center text-sm font-medium"
                  >
                    <channel.icon aria-hidden className="size-5 text-primary-ink" />
                    {channel.label}
                  </li>
                ))}
              </ul>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section
      id="for-everyone"
      aria-labelledby="roles-title"
      className="scroll-mt-20 border-y border-line bg-surface py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="roles-title" eyebrow="Who it's for" title="One platform, a home for everyone">
          Each person signs in to a home page made for what they do.
        </SectionHeading>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <li key={role.who} className="flex flex-col rounded-3xl border border-line bg-bg/60 p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-surface text-primary-ink shadow-card">
                <role.icon aria-hidden className="size-5" />
              </span>
              <p className="mt-5 text-xs font-semibold tracking-wider text-ink-3 uppercase">{role.who}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{role.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm text-ink-2">
                {role.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-ink" />
                    {point}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="steps-title" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="steps-title" eyebrow="How it works" title="Learn in loops, not in lectures" />
        <ol className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
          {/* The line joining the steps on wide screens. */}
          <span
            aria-hidden
            className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-line-strong to-transparent md:block"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col items-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-hero-from to-hero-to text-lg font-semibold text-white shadow-raised">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-2 text-pretty">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The last call to action. A dark panel in both themes, so its text uses fixed light colours. */
function ClosingCall() {
  return (
    <section aria-labelledby="closing-title" className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-neutral-950 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div aria-hidden className="absolute -top-32 left-1/4 -z-10 size-96 rounded-full bg-[#1f5fc2]/50 blur-3xl" />
        <div aria-hidden className="absolute -right-10 -bottom-40 -z-10 size-96 rounded-full bg-[#6d3fd6]/40 blur-3xl" />
        <h2 id="closing-title" className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
          Ready to pick up where you left off?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
          Sign in with your school account. Demo accounts for every role are on the sign-in page.
        </p>
        <Link
          href={SIGN_IN_PATH}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-medium text-neutral-950 shadow-lg transition-colors hover:bg-white/90 focus-visible:outline-white"
        >
          Sign in to 3rdLoopLearning
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
