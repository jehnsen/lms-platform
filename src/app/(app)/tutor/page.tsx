import type { Metadata } from "next";
import { CalendarCheck, Lightbulb, ListChecks, MessageCircleQuestion } from "lucide-react";
import { TutorChat } from "@/components/tutor-chat";
import { AiBadge, Card, PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "AI tutor" };

const TIPS = [
  { icon: MessageCircleQuestion, title: "Ask for it simpler", detail: "“Explain gradient descent like I'm new to this.”" },
  { icon: Lightbulb, title: "Ask for an example", detail: "“Give me a real-world example of osmosis.”" },
  { icon: ListChecks, title: "Check yourself", detail: "Open any video lesson and say “quiz me” for practice questions." },
  { icon: CalendarCheck, title: "Plan your study", detail: "“How should I prepare for the unit quiz?”" },
];

export default function TutorPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<AiBadge>AI-assisted</AiBadge>}
        title="AI tutor"
        description="A patient study partner for any concept in your courses. For help tied to a specific lesson, open the tutor panel beside the video."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="flex h-[calc(100dvh-17rem)] min-h-[28rem] flex-col overflow-hidden">
          <TutorChat className="flex-1" />
        </Card>
        <Card className="p-5">
          <section aria-labelledby="tutor-tips">
            <h2 id="tutor-tips" className="mb-4 text-sm font-semibold">
              Ways to use the tutor
            </h2>
            <ul className="flex flex-col gap-4 text-sm">
              {TIPS.map((tip) => (
                <li key={tip.title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-spark-soft text-spark">
                    <tip.icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{tip.title}</div>
                    <p className="text-ink-2 text-pretty">{tip.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </Card>
      </div>
    </PageContainer>
  );
}
