import type { Metadata } from "next";
import { LessonPlanGenerator } from "@/components/lesson-plan-generator";

export const metadata: Metadata = { title: "Lesson planner" };

export default function LessonPlannerPage() {
  return <LessonPlanGenerator />;
}
