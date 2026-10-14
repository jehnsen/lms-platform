import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizEdit } from "@/components/quiz-builder";
import { PageSkeleton } from "@/components/ui";
import { quizzes } from "@/lib/data/quizzes";

export const metadata: Metadata = { title: "Edit quiz" };

export function generateStaticParams() {
  return quizzes.map((quiz) => ({ quizId: quiz.id }));
}

export default function EditQuizPage({ params }: PageProps<"/quizzes/[quizId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditQuizContent params={params} />
    </Suspense>
  );
}

async function EditQuizContent({ params }: Pick<PageProps<"/quizzes/[quizId]/edit">, "params">) {
  const { quizId } = await params;
  return <QuizEdit key={quizId} quizId={quizId} />;
}
