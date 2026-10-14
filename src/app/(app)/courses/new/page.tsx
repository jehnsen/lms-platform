import type { Metadata } from "next";
import { CourseNew } from "@/components/course-new";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return <CourseNew />;
}
