import { Suspense } from "react";
import { CourseOverview } from "@/components/course-overview";
import { PageSkeleton } from "@/components/ui";
import { courses } from "@/lib/data/courses";

/**
 * The seeded courses are prerendered. A course made in the course builder
 * exists only in the browser, so its page is rendered on first request and
 * the component decides in the browser whether the course exists.
 */
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
  return <CourseOverview courseId={courseId} />;
}
