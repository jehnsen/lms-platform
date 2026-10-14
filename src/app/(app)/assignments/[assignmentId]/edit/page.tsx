import type { Metadata } from "next";
import { Suspense } from "react";
import { AssignmentEdit } from "@/components/assignment-editor";
import { PageSkeleton } from "@/components/ui";
import { seedAssignments } from "@/lib/data/assignments";

export const metadata: Metadata = { title: "Edit assignment" };

export function generateStaticParams() {
  return seedAssignments.map((assignment) => ({ assignmentId: assignment.id }));
}

export default function EditAssignmentPage({ params }: PageProps<"/assignments/[assignmentId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditAssignmentContent params={params} />
    </Suspense>
  );
}

async function EditAssignmentContent({ params }: Pick<PageProps<"/assignments/[assignmentId]/edit">, "params">) {
  const { assignmentId } = await params;
  return <AssignmentEdit key={assignmentId} assignmentId={assignmentId} />;
}
