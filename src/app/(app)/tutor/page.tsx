import type { Metadata } from "next";
import { TutorChat } from "@/components/tutor-chat";
import { AiBadge, Card, PageContainer, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "AI tutor" };

const TIPS = [
  { title: "Ask for it simpler", detail: "“Explain gradient descent like I'm new to this.”" },
  { title: "Ask for an example", detail: "“Give me a real-world example of osmosis.”" },
  { title: "Check yourself", detail: "Open any video lesson and say “quiz me” for practice questions." },
  { title: "Plan your study", detail: "“How should I prepare for the module quiz?”" },
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
        <section aria-label="Tips">
          <h2 className="mb-3 text-sm font-semibold">Ways to use the tutor</h2>
          <ul className="flex flex-col gap-4 text-sm">
            {TIPS.map((tip) => (
              <li key={tip.title}>
                <div className="font-medium">{tip.title}</div>
                <p className="text-ink-2">{tip.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
