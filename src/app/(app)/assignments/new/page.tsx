import type { Metadata } from "next";
import { AssignmentNew } from "@/components/assignment-editor";

export const metadata: Metadata = { title: "New assignment" };

export default function NewAssignmentPage() {
  return <AssignmentNew />;
}
