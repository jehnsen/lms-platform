import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonWorkspace } from "@/components/lesson-workspace";
import { PageSkeleton } from "@/components/ui";
import { courseLessons, courses, findLesson } from "@/lib/data/courses";

type Props = PageProps<"/courses/[courseId]/learn/[lessonId]">;

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
  if (!findLesson(courseId, lessonId)) notFound();
  return <LessonWorkspace courseId={courseId} lessonId={lessonId} />;
}
