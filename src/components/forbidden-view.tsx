"use client";

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { ButtonLink, PageContainer } from "@/components/ui";
import { recordDenied, useActor } from "@/lib/api/session";
import { ROLE_LABELS } from "@/lib/domain/permissions";

/**
 * Shown in place of a page or record the signed-in user may not open.
 * Showing it writes the attempt to the audit log (FR-1.2).
 */
export function ForbiddenView({ resource, what = "this page" }: { resource: string; what?: string }) {
  const actor = useActor();
  const signedIn = Boolean(actor);

  useEffect(() => {
    if (signedIn) recordDenied(resource, "Blocked in the browser");
  }, [signedIn, resource]);

  return (
    <PageContainer className="flex flex-col items-start gap-4 py-20">
      <span className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
        <ShieldAlert aria-hidden className="size-6" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">You don&apos;t have access to {what}</h1>
      <p className="max-w-xl text-ink-2">
        {actor
          ? `You are signed in as ${actor.name} (${ROLE_LABELS[actor.role]}), and that role can't open it. `
          : null}
        If you think this is a mistake, ask your school administrator. This attempt has been recorded.
      </p>
      <ButtonLink href="/">Go to your dashboard</ButtonLink>
    </PageContainer>
  );
}
