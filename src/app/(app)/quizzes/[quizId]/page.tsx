import { Suspense } from "react";
import { QuizRunner } from "@/components/quiz-runner";
import { PageSkeleton } from "@/components/ui";
import { quizzes } from "@/lib/data/quizzes";

/** Seeded quizzes are prerendered; a quiz made in the quiz builder renders on first request. */
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
  // Keyed so navigating between quizzes starts from a clean view.
  return <QuizRunner key={quizId} quizId={quizId} />;
}
