import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionMarking } from "@/components/submission-marking";
import { PageSkeleton } from "@/components/ui";
import { seedSubmissions } from "@/lib/data/assignments";

type Props = PageProps<"/assignments/[assignmentId]/submissions/[studentId]">;

export const metadata: Metadata = { title: "Mark submission" };

/** The seeded hand-ins are prerendered; every other student and assignment renders on first request. */
export function generateStaticParams() {
  return seedSubmissions.map((submission) => ({
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
  }));
}

export default function SubmissionPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SubmissionContent params={params} />
    </Suspense>
  );
}

async function SubmissionContent({ params }: Pick<Props, "params">) {
  const { assignmentId, studentId } = await params;
  return <SubmissionMarking key={`${assignmentId}-${studentId}`} assignmentId={assignmentId} studentId={studentId} />;
}
