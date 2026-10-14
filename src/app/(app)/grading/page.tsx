import type { Metadata } from "next";
import { GradingQueue } from "@/components/grading-queue";

export const metadata: Metadata = { title: "Grading queue" };

export default function GradingPage() {
  return <GradingQueue />;
}
