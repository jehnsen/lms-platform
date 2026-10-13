import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseOverview } from "@/components/course-overview";
import { PageSkeleton } from "@/components/ui";
import { courses, getCourse } from "@/lib/data/courses";

export function generateStaticParams() {
  return courses.map((course) => ({ courseId: course.id }));
}

export default function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CourseContent params={params} />
    </Suspense>
  );
}

async function CourseContent({ params }: Pick<PageProps<"/courses/[courseId]">, "params">) {
  const { courseId } = await params;
  if (!getCourse(courseId)) notFound();
  return <CourseOverview courseId={courseId} />;
}
