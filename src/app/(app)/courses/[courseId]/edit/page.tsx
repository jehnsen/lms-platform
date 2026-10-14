import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseBuilder } from "@/components/course-builder";
import { PageSkeleton } from "@/components/ui";
import { courses } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Edit course" };

/** Seeded courses are prerendered; a course made in the builder renders on first request. */
export function generateStaticParams() {
  return courses.map((course) => ({ courseId: course.id }));
}

export default function EditCoursePage({ params }: PageProps<"/courses/[courseId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditCourseContent params={params} />
    </Suspense>
  );
}

async function EditCourseContent({ params }: Pick<PageProps<"/courses/[courseId]/edit">, "params">) {
  const { courseId } = await params;
  return <CourseBuilder key={courseId} courseId={courseId} />;
}
