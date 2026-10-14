import { Suspense } from "react";
import { ForumThreadView } from "@/components/forum-view";
import { PageSkeleton } from "@/components/ui";
import { seedForumThreads } from "@/lib/data/communication";

/** Seeded threads are prerendered; a thread started in the browser renders on first request. */
export function generateStaticParams() {
  return seedForumThreads.map((thread) => ({ threadId: thread.id }));
}

export default function ForumThreadPage({ params }: PageProps<"/forums/[threadId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ThreadContent params={params} />
    </Suspense>
  );
}

async function ThreadContent({ params }: Pick<PageProps<"/forums/[threadId]">, "params">) {
  const { threadId } = await params;
  // Keyed so navigating between threads starts from a clean view.
  return <ForumThreadView key={threadId} threadId={threadId} />;
}
