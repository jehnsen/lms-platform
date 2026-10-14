import { Suspense } from "react";
import { LessonWorkspace } from "@/components/lesson-workspace";
import { PageSkeleton } from "@/components/ui";
import { courses } from "@/lib/data/courses";
import { courseLessons } from "@/lib/domain/course-outline";

type Props = PageProps<"/courses/[courseId]/learn/[lessonId]">;

/** Seeded lessons are prerendered; lessons added in the course builder render on first request. */
export function generateStaticParams() {
  return courses.flatMap((course) =>
    courseLessons(course).map((lesson) => ({ courseId: course.id, lessonId: lesson.id })),
  );
}

export default function LessonPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LessonContent params={params} />
    </Suspense>
  );
}

async function LessonContent({ params }: Pick<Props, "params">) {
  const { courseId, lessonId } = await params;
  // Keyed so moving between lessons starts each one clean.
  return <LessonWorkspace key={lessonId} courseId={courseId} lessonId={lessonId} />;
}
