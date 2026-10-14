import type { Metadata } from "next";
import { QuizNew } from "@/components/quiz-builder";

export const metadata: Metadata = { title: "New quiz" };

export default function NewQuizPage() {
  return <QuizNew />;
}
