import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenFromQuery } from "@/components/forbidden-from-query";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "No access" };

/** Where `src/proxy.ts` sends a role that may not open the requested page. */
export default function ForbiddenPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ForbiddenFromQuery />
    </Suspense>
  );
}
