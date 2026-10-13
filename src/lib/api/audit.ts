"use client";

/**
 * Audit log reads (FR-1.2, NFR-3). Backend seam: `GET /audit-events`.
 * Events are written by `recordAudit` / `recordDenied` in `session.ts`.
 */
import { can } from "@/lib/domain/permissions";
import type { AuditEvent } from "@/lib/types";
import { resetAllRepositories, useRepository } from "./_repository";
import { auditRepo } from "./_stores";
import { authorize, recordAudit, useActor } from "./session";

/** Newest first. `null` unless the signed-in user may read the audit log. */
export function useAuditLog(): AuditEvent[] | null {
  const actor = useActor();
  const events = useRepository(auditRepo);
  return can(actor, "view", { type: "audit-log" }) ? events : null;
}

/** Demo helper for admins: return every mock store to its seed data. */
export async function resetDemoData(): Promise<void> {
  authorize("delete", { type: "user" });
  resetAllRepositories();
  recordAudit({ action: "demo.reset", resource: "all-data", outcome: "allowed" });
}
