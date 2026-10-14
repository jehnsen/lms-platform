"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { AuditTable } from "@/components/audit-table";
import { Button, Card, PageContainer, PageHeader, fieldBaseClass, fieldClass } from "@/components/ui";
import { useAuditLog } from "@/lib/api/audit";
import { useUsers } from "@/lib/api/users";
import type { AuditEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type OutcomeFilter = "all" | AuditEvent["outcome"];

/** The full audit log (FR-1.2): every sign-in, blocked attempt and admin change the app has recorded. */
export function AdminAudit() {
  const events = useAuditLog() ?? [];
  const users = useUsers() ?? [];
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const wanted = query.trim().toLowerCase();
  const nameOf = (userId: string | null) => users.find((user) => user.id === userId)?.name ?? "";
  const matching = events.filter(
    (event) =>
      (outcome === "all" || event.outcome === outcome) &&
      (wanted === "" ||
        [event.action, event.resource, event.detail ?? "", nameOf(event.actorId)].some((text) =>
          text.toLowerCase().includes(wanted),
        )),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Sign-ins, blocked attempts, exports and every change an administrator makes. Newest first."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <label htmlFor="audit-search" className="sr-only">
              Search the audit log
            </label>
            <input
              id="audit-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="Search by person, action or record"
              className={cn(fieldBaseClass, "h-10 w-full pr-3 pl-9")}
            />
          </div>
          <label htmlFor="audit-outcome" className="sr-only">
            Outcome
          </label>
          <select
            id="audit-outcome"
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value as OutcomeFilter);
              setShown(PAGE_SIZE);
            }}
            className={fieldClass}
          >
            <option value="all">All outcomes</option>
            <option value="allowed">Allowed</option>
            <option value="denied">Denied</option>
          </select>
        </div>

        {matching.length === 0 ? (
          <p className="p-5 text-sm text-ink-2">
            {events.length === 0 ? "Nothing has been recorded yet." : "No events match these filters."}
          </p>
        ) : (
          <AuditTable events={matching.slice(0, shown)} users={users} caption="Audit events, newest first" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-3">
          <p role="status">
            Showing {Math.min(shown, matching.length)} of {matching.length}{" "}
            {matching.length === 1 ? "event" : "events"}. The demo keeps the latest 500.
          </p>
          {matching.length > shown ? (
            <Button variant="secondary" size="sm" onClick={() => setShown(shown + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, matching.length - shown)} more
            </Button>
          ) : null}
        </div>
      </Card>
    </PageContainer>
  );
}
