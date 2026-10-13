import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuizRunner } from "@/components/quiz-runner";
import { PageSkeleton } from "@/components/ui";
import { getQuiz, quizzes } from "@/lib/data/quizzes";

export function generateStaticParams() {
  return quizzes.map((quiz) => ({ quizId: quiz.id }));
}

export default function QuizPage({ params }: PageProps<"/quizzes/[quizId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuizContent params={params} />
    </Suspense>
  );
}

async function QuizContent({ params }: Pick<PageProps<"/quizzes/[quizId]">, "params">) {
  const { quizId } = await params;
  if (!getQuiz(quizId)) notFound();
  // Keyed so navigating between quizzes starts from a clean attempt.
  return <QuizRunner key={quizId} quizId={quizId} />;
}
