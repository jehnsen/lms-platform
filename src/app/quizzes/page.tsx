import type { Metadata } from "next";
import { QuizList } from "@/components/quiz-list";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage() {
  return <QuizList />;
}
