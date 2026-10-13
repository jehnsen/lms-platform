import type { Metadata } from "next";
import { GradebookView } from "@/components/gradebook-view";

export const metadata: Metadata = { title: "Gradebook" };

export default function GradebookPage() {
  return <GradebookView />;
}
