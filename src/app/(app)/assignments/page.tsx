import type { Metadata } from "next";
import { AssignmentList } from "@/components/assignment-list";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return <AssignmentList />;
}
