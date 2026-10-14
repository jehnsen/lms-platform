import type { Metadata } from "next";
import { Suspense } from "react";
import { AssignmentDetail } from "@/components/assignment-detail";
import { PageSkeleton } from "@/components/ui";
import { seedAssignments } from "@/lib/data/assignments";

export const metadata: Metadata = { title: "Assignment" };

/** Seeded assignments are prerendered; one made in the browser renders on first request. */
export function generateStaticParams() {
  return seedAssignments.map((assignment) => ({ assignmentId: assignment.id }));
}

export default function AssignmentPage({ params }: PageProps<"/assignments/[assignmentId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssignmentContent params={params} />
    </Suspense>
  );
}

async function AssignmentContent({ params }: Pick<PageProps<"/assignments/[assignmentId]">, "params">) {
  const { assignmentId } = await params;
  return <AssignmentDetail key={assignmentId} assignmentId={assignmentId} />;
}
