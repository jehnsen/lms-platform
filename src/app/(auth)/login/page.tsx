import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Captions, CircleCheck, KeyRound, ListChecks, Sparkles } from "lucide-react";
import { Backdrop } from "@/components/backdrop";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: Sparkles, label: "AI tutor in every lesson" },
  { icon: Captions, label: "Captioned video" },
  { icon: ListChecks, label: "Instant grading" },
];

export default function LoginPage() {
  return (
    <div className="relative isolate grid min-h-dvh overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Backdrop />

      <div className="flex min-w-0 flex-col px-4 py-5 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Home
          </Link>
        </div>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="animate-rise w-full max-w-md rounded-3xl border border-line bg-surface/85 p-5 shadow-raised backdrop-blur-xl min-[400px]:p-7 sm:p-9">
            <LoginForm />
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-ink-3">
          <p>Don Bosco College – Canlubang, Calamba, Laguna</p>
          <p className="flex items-center gap-1.5">
            <KeyRound aria-hidden className="size-3.5" />
            Single sign-on with your school account
          </p>
        </footer>
      </div>

      {/* Photo panel. Text sits on a dark scrim, so it uses fixed light colours in both themes. */}
      <aside className="relative hidden p-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-[2rem] bg-neutral-900 text-white shadow-raised">
          <Image
            src="/images/login-hero.jpg"
            alt="Three students laughing together around laptops at a study table"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#1f5fc2]/35 via-transparent to-[#6d3fd6]/35 mix-blend-multiply" />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 via-45% to-black/5" />

          <div className="animate-drift absolute top-8 right-8 w-72 rounded-2xl border border-white/20 bg-white/15 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-medium text-white/85">
              <span className="grid size-6 place-items-center rounded-full bg-amber-300 text-neutral-950">
                <Sparkles aria-hidden className="size-3.5" />
              </span>
              AI tutor
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              Think of gradient descent as walking downhill in fog: feel the slope, take a small step, repeat.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs">
              <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-300" />
              Checkpoint answered correctly
            </div>
          </div>

          <div
            aria-hidden
            className="animate-drift absolute top-[38%] left-8 flex w-64 flex-col gap-2 rounded-2xl border border-white/20 bg-white/15 p-4 shadow-2xl backdrop-blur-xl"
            style={{ animationDelay: "-3.5s" }}
          >
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>Introduction to Machine Learning</span>
              <span className="font-semibold text-white">43%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-[43%] rounded-full bg-white" />
            </div>
            <div className="text-xs text-white/70">3 of 7 lessons complete</div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-12">
            <p className="max-w-lg text-4xl leading-[1.12] font-semibold tracking-[-0.03em] text-balance xl:text-5xl">
              Learning that keeps up with you.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
              Short video lessons that check your understanding as you go, quizzes graded the moment you submit,
              and a tutor that never runs out of patience.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {HIGHLIGHTS.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur-md"
                >
                  <item.icon aria-hidden className="size-4" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
