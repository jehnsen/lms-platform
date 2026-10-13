"use client";

import { useState } from "react";
import { GraduationCap, Presentation, ShieldAlert, Users } from "lucide-react";
import { Badge, Button, Card, PageContainer, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { resetDemoData, useAuditLog } from "@/lib/api/audit";
import { useCourses, useTerms } from "@/lib/api/courses";
import { useUsers } from "@/lib/api/users";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";

const RECENT_EVENTS = 12;

/**
 * Admin home: who is in the system and what has just happened in it. User
 * management, terms and the full audit viewer arrive in Phase 1; school-wide
 * reporting (US-27) in Phase 7.
 */
export function AdminHome() {
  const users = useUsers() ?? [];
  const events = useAuditLog() ?? [];
  const courses = useCourses();
  const terms = useTerms();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const count = (role: string) => users.filter((user) => user.role === role && user.status === "active").length;
  const activeTerm = terms.find((term) => term.status === "active");
  const denied = events.filter((event) => event.outcome === "denied").length;
  const nameOf = (userId: string | null) => users.find((user) => user.id === userId)?.name ?? "Not signed in";

  return (
    <PageContainer>
      <PageHeader
        title="School overview"
        description={
          activeTerm
            ? `${activeTerm.name} runs ${formatDate(activeTerm.startsOn)} to ${formatDate(activeTerm.endsOn)}.`
            : "No term is active."
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={GraduationCap} label="Students" value={count("student")} hint="Active accounts" />
        <StatTile icon={Presentation} label="Faculty" value={count("faculty")} hint="Active accounts" />
        <StatTile icon={Users} label="Parents" value={count("parent")} hint="Linked to a student" />
        <StatTile
          icon={ShieldAlert}
          label="Denied attempts"
          value={denied}
          hint={`${courses.length} courses this term`}
        />
      </div>

      <section className="mt-10">
        <SectionTitle>Recent activity</SectionTitle>
        <Card className="overflow-hidden">
          {events.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">
              Nothing has been recorded yet. Sign-ins, exports and blocked attempts will appear here.
            </p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">The {RECENT_EVENTS} most recent audit events</caption>
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Who</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">On</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, RECENT_EVENTS).map((event) => (
                    <tr key={event.id} className="border-t border-line">
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-2 tabular-nums">
                        {formatDateTime(event.at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {nameOf(event.actorId)}
                        {event.actorRole ? (
                          <span className="text-ink-3"> · {ROLE_LABELS[event.actorRole]}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{event.action}</td>
                      <td className="px-3 py-2.5 font-mono text-xs break-all text-ink-2">{event.resource}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={event.outcome === "denied" ? "bad" : "good"}>
                          {event.outcome === "denied" ? "Denied" : "Allowed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Demo data</SectionTitle>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p className="max-w-xl text-ink-2">
            Everything is stored in this browser. Resetting returns users, progress, notifications and
            the audit log to the seeded starting point.
          </p>
          {confirmingReset ? (
            <span className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmingReset(false);
                  void resetDemoData();
                }}
              >
                Yes, reset everything
              </Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(true)}>
              Reset demo data
            </Button>
          )}
        </Card>
      </section>
    </PageContainer>
  );
}
