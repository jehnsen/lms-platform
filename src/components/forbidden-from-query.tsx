"use client";

import { useSearchParams } from "next/navigation";
import { ForbiddenView } from "@/components/forbidden-view";

/** Reads which page was refused from `?from=` so the audit entry names it. */
export function ForbiddenFromQuery() {
  const from = useSearchParams().get("from");
  // Only a local path is accepted: the value comes from the URL.
  const path = from && from.startsWith("/") && !from.startsWith("//") ? from : "/forbidden";
  return <ForbiddenView resource={`route:${path}`} />;
}
