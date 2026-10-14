import type { Metadata } from "next";
import Image from "next/image";
import { Captions, CircleCheck, ListChecks, Sparkles } from "lucide-react";
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
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10 lg:px-14">
        <Brand />
        <main className="flex flex-1 items-center justify-center py-10">
          <LoginForm />
        </main>
        <p className="text-xs text-ink-3">Don Bosco College – Canlubang, Calamba, Laguna · 3rdLoopLearning</p>
      </div>

      {/* Photo panel. Text sits on a dark scrim, so it uses fixed light colours in both themes. */}
      <aside className="relative hidden p-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl bg-neutral-900 text-white">
          <Image
            src="/images/login-hero.jpg"
            alt="Three students laughing together around laptops at a study table"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/55 via-45% to-black/10" />

          <div className="absolute top-6 right-6 w-72 rounded-2xl border border-white/20 bg-white/15 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-medium text-white/80">
              <span className="grid size-6 place-items-center rounded-full bg-amber-300 text-neutral-950">
                <Sparkles aria-hidden className="size-3.5" />
              </span>
              AI tutor
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              Think of gradient descent as walking downhill in fog: feel the slope, take a small
              step, repeat.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs">
              <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-300" />
              Checkpoint answered correctly
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-10">
            <p className="max-w-lg text-4xl leading-[1.15] font-semibold tracking-tight text-balance">
              Learning that keeps up with you.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
              Short video lessons that check your understanding as you go, quizzes graded the
              moment you submit, and a tutor that never runs out of patience.
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
